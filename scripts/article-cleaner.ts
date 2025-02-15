(() => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page

    mw.loader.using(['mediawiki.util', 'jquery.textSelection'], () => {
        mw.util.addCSS(`
#article-cleaner {
    display: none;
}

#content:has(#wpTextbox1) #article-cleaner {
    display: unset;
}`);

        const link = mw.util.addPortletLink(
            mw.config.get('skin') === 'minerva' ? 'p-navigation' : 'p-cactions',
            '#',
            'Perform article cleanup',
            'article-cleaner',
        )!;

        link.addEventListener('click', (event) => {
            event.preventDefault();

            const editBox = $('#wpTextbox1');
            if (editBox.length === 0) return mw.notify('Edit box not found!', { type: 'error', autoHideSeconds: 'short' });

            let text = editBox.textSelection('getContents');
            if (!text) return mw.notify('Edit box value not found!', { type: 'error', autoHideSeconds: 'short' });

            text = formatTemplates(text);

            console.log(text);

            editBox.textSelection('setContents', text);

            editBox.textSelection('setSelection', { start: 0 });

            mw.notify('Article cleanup complete!', { type: 'success', autoHideSeconds: 'short' });
        });
    });
})();

/**
 * Formats template spacing in an article's content.
 * @param content The article content to format.
 */
function formatTemplates(content: string) {
    enum FormatStyle {
        Expanded,
        ExpandedAligned,
        Minimized,
        MinimizedSpaced,
    }

    class Template {
        public location: { start: number; end?: number };
        public isNested = false;

        public fullText?: string;
        private fullTextEscaped?: string;
        private name?: string;
        private parameters: { key: string | null; value: string }[] = [];
        public subTemplates: Template[] = [];

        private pipeEscapeRegexes = [/(\[\[[^\]]*?)\|(.*?]])/g, /(<!--.*?)\|(.*?-->)/g, /(<nowiki>.*?)\|(.*?<\/nowiki>)/g];

        private defaultTemplateStyles = {
            [FormatStyle.ExpandedAligned]: [
                'infobox',
                'speciesbox',
                'taxobox',
                'automatic taxobox',
                'osm location map',
                'motorsport season',
            ],
            [FormatStyle.Minimized]: ['coord', 'start date', 'end date'],
        };

        constructor(startLocation: number) {
            this.location = { start: startLocation };
        }

        public parse() {
            this.fullText = content.slice(this.location.start, this.location.end);
            this.fullTextEscaped = this.fullText;

            for (const subTemplate of this.subTemplates) {
                subTemplate.parse();

                this.fullTextEscaped = this.fullTextEscaped.replace(subTemplate.fullText!, '\u0002');
            }

            let trimmedInnerText = this.fullTextEscaped.slice(2, -2).trim();

            for (const pipeEscapeRegex of this.pipeEscapeRegexes)
                while (pipeEscapeRegex.test(trimmedInnerText))
                    trimmedInnerText = trimmedInnerText.replaceAll(pipeEscapeRegex, '$1\u0001$2');

            const parameters = trimmedInnerText.split('|').map((parameter) => parameter.replaceAll('\u0001', '|').trim());

            this.name = parameters.shift();

            const splitParameters = parameters.map((parameters) => {
                const equalsLocation = parameters.indexOf('=');

                if (equalsLocation === -1) return { key: null, value: parameters.trim() };

                return {
                    key: parameters.slice(0, equalsLocation).trim(),
                    value: parameters.slice(equalsLocation + 1).trim(),
                };
            });

            this.parameters = splitParameters;
        }

        private getStyle() {
            for (const [formatStyle, templatePrefixes] of Object.entries(this.defaultTemplateStyles))
                for (const templatePrefix of templatePrefixes)
                    if (this.name!.toLowerCase().startsWith(templatePrefix)) return Number.parseInt(formatStyle) as FormatStyle;
        }

        public format() {
            if (!this.fullText) this.parse();

            const style = this.getStyle();
            if (style === undefined) return this.fullText!;

            const output = [`{{${this.name}`];

            if (style === FormatStyle.Expanded || style === FormatStyle.ExpandedAligned) {
                let requiredKeyLength = 0;

                if (style === FormatStyle.ExpandedAligned)
                    requiredKeyLength = Math.max(...this.parameters.map((parameter) => parameter.key?.length ?? 0));

                for (const parameter of this.parameters)
                    output.push(`| ${parameter.key ? `${parameter.key.padEnd(requiredKeyLength)} = ` : ''}${parameter.value}`);
            } else
                for (const parameter of this.parameters)
                    if (parameter.value) output.push(`|${parameter.key ? `${parameter.key}=` : ''}${parameter.value}`);

            output.push('}}');

            if (output.length === 2) {
                output[0] += '}}';

                output.pop();
            } else if (style === FormatStyle.MinimizedSpaced) {
                output[output.length - 2] += '}}';

                output.pop();
            }

            let joinedOutput = output.join(
                style === FormatStyle.Expanded || style === FormatStyle.ExpandedAligned
                    ? '\n'
                    : style === FormatStyle.MinimizedSpaced
                      ? ' '
                      : '',
            );

            for (const subTemplate of this.subTemplates) {
                console.log(joinedOutput, subTemplate.format());
                joinedOutput = joinedOutput.replace('\u0002', subTemplate.format());
            }

            return joinedOutput;
        }
    }

    const allTemplates: Template[] = [];

    const insideTemplates: Template[] = [];
    let isInsideLink = false;
    let isInsideNowiki = false;
    let isInsideComment = false;

    let currentLocation = 0;

    /**
     * Checks if the content following the current location matches the desired string.
     * @param desiredString The string to search for.
     * @param shouldIncrement Whether to increment the current location if the string is found.
     */
    function isAtString(desiredString: string, shouldIncrement = true) {
        const isAtString = content.slice(currentLocation, currentLocation + desiredString.length) === desiredString;

        if (isAtString && shouldIncrement) currentLocation += desiredString.length;

        return isAtString;
    }

    while (currentLocation < content.length)
        if (isAtString('<nowiki>')) isInsideNowiki = true;
        else if (isAtString('</nowiki>')) isInsideNowiki = false;
        else if (isAtString('<!--')) isInsideComment = true;
        else if (isAtString('-->')) isInsideComment = false;
        else if (!isInsideNowiki && !isInsideComment)
            if (isAtString('[[')) isInsideLink = true;
            else if (isInsideLink && isAtString(']]')) isInsideLink = false;
            else if (isAtString('{{')) {
                const template = new Template(currentLocation - 2);

                if (insideTemplates.length > 0) {
                    template.isNested = true;
                    insideTemplates.at(-1)?.subTemplates.push(template);
                }

                insideTemplates.push(template);
            } else if (isAtString('}}')) {
                const lastTemplate = insideTemplates.pop();
                if (!lastTemplate) continue;

                lastTemplate.location.end = currentLocation;

                allTemplates.push(lastTemplate);
            } else currentLocation++;
        else currentLocation++;

    let newContent = content;

    for (const template of allTemplates)
        if (!template.isNested) {
            template.parse();

            newContent = newContent.replace(template.fullText!, template.format());
        }

    return newContent;
}
