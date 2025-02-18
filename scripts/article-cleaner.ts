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

            text = cleanupSpacing(text);
            text = formatTemplates(text);
            text = cleanupSectionHeaders(text);
            text = cleanupMagicWords(text);
            text = cleanupDisplaytitlesAndDefaultsorts(text);
            text = cleanupCategories(text);
            text = cleanupLinks(text);
            text = cleanupStrayMarkup(text);

            editBox.textSelection('setContents', text);

            editBox.textSelection('setSelection', { start: 0 });

            mw.notify('Article cleanup complete!', { type: 'success', autoHideSeconds: 'short' });
        });
    });
})();

/**
 * Cleans up spacing in an article's content.
 * @param content The article content to clean up.
 */
function cleanupSpacing(content: string) {
    content = content.replaceAll(/(\b) {2,}(\b)/g, '$1 $2'); // Remove extra spaces between words
    content = content.replaceAll(/(\n|^) +| +(\n|$)/g, '$1'); // Remove extra spaces at the start or end of lines
    content = content.replaceAll(/\n{3,}/g, '\n\n'); // Remove extra newlines
    content = content.replace(/\s*({{[^}]*stub}})/i, '\n\n\n$1'); // Ensure there are three newlines before the first stub template
    content = content.replaceAll(/\s+$/g, ''); // Remove trailing spaces

    return content;
}

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

        private placeholderStrings = ['\u{F0000}', '\u{10FFFF}'];

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

                this.fullTextEscaped = this.fullTextEscaped.replace(subTemplate.fullText!, this.placeholderStrings[0]);
            }

            let trimmedInnerText = this.fullTextEscaped.slice(2, -2).trim();

            for (const pipeEscapeRegex of this.pipeEscapeRegexes)
                while (pipeEscapeRegex.test(trimmedInnerText))
                    trimmedInnerText = trimmedInnerText.replaceAll(pipeEscapeRegex, `$1${this.placeholderStrings[1]}$2`);

            const parameters = trimmedInnerText.split('|').map((parameter) => parameter.replaceAll(this.placeholderStrings[1], '|').trim());

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

            for (const subTemplate of this.subTemplates)
                joinedOutput = joinedOutput.replace(this.placeholderStrings[0], subTemplate.format());

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

/**
 * Cleans up section headers in an article's content.
 * @param content The article content to clean up.
 */
function cleanupSectionHeaders(content: string) {
    const commonReplacements = {
        /* eslint-disable @typescript-eslint/naming-convention */
        'See also': ['also see'],
        'References': ['reference', 'source', 'sources', 'citation', 'citations'],
        'Further reading': ['further reading'],
        'External links': ['external link', 'weblink', 'weblinks'],
        /* eslint-enable @typescript-eslint/naming-convention */
    };

    const commonMiscapitalizedWords = ['life', 'career'];

    const reverseCommonReplacements = Object.fromEntries(
        Object.entries(commonReplacements).flatMap(([key, values]) => values.map((value) => [value, key])),
    );

    const headers = content.matchAll(/(?<=\n)(?<startMarkup>=+) *(?<name>.*?) *(?<endMarkup>=+)(?=\n)/g);

    const parsedHeaders = [...headers].map((header) => {
        const { startMarkup, name, endMarkup } = header.groups!;

        const cleanedName = name.replaceAll(/'{3}/g, '');

        const depth = Math.max(startMarkup.length, endMarkup.length, 2);

        return { name: cleanedName, depth, original: header[0] };
    });

    for (const header of parsedHeaders) {
        const replacedName =
            header.name.toLowerCase() in reverseCommonReplacements ? reverseCommonReplacements[header.name.toLowerCase()] : header.name;

        let capitalizedName = replacedName;

        for (const word of commonMiscapitalizedWords) capitalizedName = capitalizedName.replaceAll(new RegExp(`\\b${word}\\b`, 'gi'), word);

        capitalizedName = capitalizedName.charAt(0).toUpperCase() + capitalizedName.slice(1);

        const output = `${'='.repeat(header.depth)} ${capitalizedName} ${'='.repeat(header.depth)}`;

        if (header.original !== output) content = content.replace(header.original, output);
    }

    return content;
}

/**
 * Removes unnecessary magic words from an article's content.
 * @param content The article content to clean up.
 */
function cleanupMagicWords(content: string) {
    return content.replaceAll(/__(INDEX|NOINDEX|NEWSECTIONLINK|NONEWSECTIONLINK|NOEDITSECTION|DISAMBIG|STATICREDIRECT|FORCETOC)__\n*/g, '');
}

/**
 * Cleans up DISPLAYTITLEs and DEFAULTSORTs in an article's content.
 * @param content The article content to clean up.
 */
function cleanupDisplaytitlesAndDefaultsorts(content: string) {
    const tags = content.matchAll(/{{(displaytitle|defaultsort)[:|](.*?)}}/gi);

    const parsedTags = [...tags].map((tag) => {
        const [fullTag, type, value] = tag;

        return { type: type.toUpperCase(), value, original: fullTag };
    });

    const currentTitle = mw.Title.newFromText(mw.config.get('wgPageName'))!;

    for (const tag of parsedTags) {
        const originalTagRegex = new RegExp(`${tag.original.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&')}\n*`, 'g');

        const title = mw.Title.makeTitle(currentTitle.getNamespaceId(), tag.value.includes(':') ? tag.value.split(':')[1] : tag.value)!;

        if (currentTitle.toText() === title.toText()) {
            content = content.replace(originalTagRegex, '');
            continue;
        }

        const newText = `{{${tag.type}:${title.toText()}}}\n`;

        content = content.replace(originalTagRegex, newText);
    }

    return content;
}

/**
 * Cleans up categories in an article's content.
 * @param content The article content to clean up.
 */
function cleanupCategories(content: string) {
    return content.replaceAll(/(\[\[|}}):?category:(.*?)(]]|}})/gi, '[[Category:$2]]');
}

interface LinkInformation {
    start: number;
    end: number;
    isNested: boolean;
}

/**
 * Cleans up links in an article's content.
 * @param content The article content to clean up.
 */
function cleanupLinks(content: string) {
    const closedLinks: LinkInformation[] = [];
    const links: LinkInformation[] = [];

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
        if (isAtString('[[')) links.push({ start: currentLocation - 2, end: -1, isNested: links.length > 0 });
        else if (isAtString(']]')) {
            const lastLink = links.pop();
            if (!lastLink) continue;

            lastLink.end = currentLocation;

            closedLinks.push(lastLink);
        } else currentLocation++;

    const newLinkContent: [LinkInformation, string][] = [];

    for (const linkLocation of closedLinks) {
        const innerLink = content.slice(linkLocation.start + 2, linkLocation.end - 2);

        const [unparsedLink, ...parameters] = innerLink.split('|');

        let link = unparsedLink.replaceAll('_', ' ').trim();
        let altText = parameters.join('|').trim();

        const isFirstCharacterColon = link.startsWith(':');
        if (isFirstCharacterColon) link = link.slice(1);

        let shouldFirstCharacterBeColon = false;

        const linkUppercaseStart = link.charAt(0).toUpperCase() + link.slice(1);
        const linkLowercaseStart = link.charAt(0).toLowerCase() + link.slice(1);

        if (link.includes(':')) {
            if (linkUppercaseStart.startsWith('Image:')) {
                const shouldStartUppercase = link.startsWith('Image:');

                link = `${shouldStartUppercase ? 'F' : 'f'}ile:${link.slice(6)}`;
            }

            if (isFirstCharacterColon && ['Image', 'File', 'Category'].includes(linkUppercaseStart.split(':')[0]))
                shouldFirstCharacterBeColon = true;
        }

        let afterLinkText = '';

        if (link === altText) altText = '';
        else if (new RegExp(`^${link.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&')}[a-z]+$`).test(altText)) {
            afterLinkText = altText.slice(link.length);
            altText = '';
        }

        for (const newLink of [linkUppercaseStart, linkLowercaseStart])
            if (newLink === altText) {
                link = newLink;
                altText = '';
            } else if (new RegExp(`^${newLink.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&')}[a-z]+$`).test(altText)) {
                link = newLink;
                afterLinkText = altText.slice(newLink.length);
                altText = '';
            }

        if ((altText && link.includes(':')) || link.startsWith('file:') || link.startsWith('category:'))
            link = link.charAt(0).toUpperCase() + link.slice(1);

        const output = `[[${shouldFirstCharacterBeColon ? ':' : ''}${link}${altText ? `|${altText}` : ''}]]${afterLinkText}`;

        newLinkContent.push([linkLocation, output]);
    }

    for (let loopCounter = 0; loopCounter < 2; loopCounter++)
        for (const [linkData, linkContent] of newLinkContent) {
            if (loopCounter === 0 && linkData.isNested) continue;
            else if (loopCounter === 1 && !linkData.isNested) continue;

            content =
                content.slice(0, linkData.start) + linkContent.padStart(linkData.end - linkData.start, '\0') + content.slice(linkData.end);
        }

    return content.replaceAll('\0', '');
}

/**
 * Removes stray markup in an article's content.
 * @param content The article content to clean up.
 */
function cleanupStrayMarkup(content: string) {
    const strayMarkupRegexes = [
        /'+(Bold|Italic)( text)?'+\s*/g,
        /(<big>)+Big( text)?(<\/big>)+\s*/g,
        /(<small>)+Small( text)?(<\/small>)+\s*/g,
        /(<sup>)+Superscript( text)?(<\/sup>)+\s*/g,
        /(<sub>)+Subscript( text)?(<\/sub>)+\s*/g,
        /(<s>)+Strikethrough(<\/s>)+\s*/g,
        /(<u>)+Underline(<\/u>)+\s*/g,
        /(<code>)+Computer code(<\/code>)+\s*/g,
        /(<nowiki>)+Insert non-formatted text here(<\/nowiki>)+\s*/g,
        /=+ Heading text =+\s*/g,
        /\* Bulleted list item\s*/g,
        /# Numbered list item\s*/g,
        /<gallery>\nExample.jpg\|Caption1\nExample.jpg\|Caption2\n<\/gallery>\s*/g,
        /#REDIRECT \[\[Target page name]]\s*/g,
        /<!-- Invisible comment -->\s*/g,
        /<noinclude>\s*<\/noinclude>\s*/g,
    ];

    for (const regex of strayMarkupRegexes) while (regex.test(content)) content = content.replace(regex, '');

    return content;
}
