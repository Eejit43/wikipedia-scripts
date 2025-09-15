import { getPageContent } from '../utility';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class VeRange {
        constructor(start: number, end: number);
    }

    class VeFragment {
        insertContent(content: string): void;
    }

    class VeSurfaceModel {
        getLinearFragment(range: VeRange): VeFragment;
        getRangeFromSourceOffsets(start: number, end: number): VeRange;
        setSelection(selection: VeLinearSelection): void;
    }

    class VeTarget {
        getSurface(): { getModel(): VeSurfaceModel };
    }

    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class VeLinearSelection {
        constructor(range: VeRange);
    }

    const ve: {
        Range: typeof VeRange; // eslint-disable-line @typescript-eslint/naming-convention
        dm: { LinearSelection: typeof VeLinearSelection }; // eslint-disable-line @typescript-eslint/naming-convention
        init?: { target: VeTarget };
    };
}

(() => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page

    const dependencies = ['mediawiki.util', 'jquery.textSelection'];

    if (mw.config.get('skin') !== 'minerva') dependencies.push('mobile.editor.overlay');

    mw.loader.using(dependencies, () => {
        let shouldAddScriptMessage = false;

        const SCRIPT_MESSAGE = 'Cleaned up article content (via [[User:Eejit43/scripts/article-cleaner|article-cleaner]])';

        /**
         * Updates the summary textarea with the script message if it is not already present.
         * @param textarea The summary textarea element to update.
         */
        function updateSummary(textarea: HTMLTextAreaElement | HTMLInputElement) {
            // Add timeout before setting textarea value as this is overwritten sometimes for some reason
            setTimeout(() => {
                if (!textarea.value.includes(SCRIPT_MESSAGE.slice(1)))
                    textarea.value +=
                        textarea.value && !textarea.value.startsWith('/* ') && !textarea.value.endsWith(' */ ')
                            ? `; ${SCRIPT_MESSAGE.charAt(0).toLowerCase() + SCRIPT_MESSAGE.slice(1)}`
                            : SCRIPT_MESSAGE;
            }, 0);

            shouldAddScriptMessage = false;
        }

        /**
         * Handles the click event for the activation button.
         * @param event The mouse event that triggered the click.
         */
        async function handleActivation(event: MouseEvent) {
            event.preventDefault();

            const editor = $(mw.config.get('skin') === 'minerva' ? '#wikitext-editor' : '#wpTextbox1');
            if (editor.length === 0) return mw.notify('Edit box not found!', { type: 'error', autoHideSeconds: 'short' });

            const originalText = editor.textSelection('getContents');

            let finalText = originalText;

            finalText = cleanupStrayUnicodeCharacters(finalText);
            finalText = cleanupSectionHeaders(finalText);
            finalText = cleanupMagicWords(finalText);
            finalText = cleanupDisplaytitlesAndDefaultsorts(finalText);
            finalText = cleanupCategories(finalText);
            finalText = cleanupLinks(finalText, [cleanupImproperCharacters, cleanupYearRanges]);
            finalText = cleanupStrayMarkup(finalText);
            finalText = cleanupSpacing(finalText);
            finalText = cleanupReferences(finalText);
            finalText = await formatTemplates(finalText);
            finalText = removeComments(finalText);
            finalText = cleanupSpacing(finalText, true);
            finalText = autoTagPage(finalText);

            if (originalText === finalText) mw.notify('No changes to be made to the article!', { type: 'warn', autoHideSeconds: 'short' });
            else {
                if (ve.init) {
                    const surfaceModel = ve.init.target.getSurface().getModel();
                    const fragment = surfaceModel.getLinearFragment(surfaceModel.getRangeFromSourceOffsets(0, originalText.length));
                    fragment.insertContent(finalText);
                    surfaceModel.setSelection(new ve.dm.LinearSelection(new ve.Range(0, 0)));
                } else {
                    editor.textSelection('setContents', finalText);

                    editor.textSelection('setSelection', { start: 0 });
                }

                mw.notify('Article cleanup complete!', { type: 'success', autoHideSeconds: 'short' });

                const summaryInput = document.querySelector<HTMLInputElement>('#wpSummary');

                if (summaryInput) updateSummary(summaryInput);
                else shouldAddScriptMessage = true;
            }
        }

        if (mw.config.get('skin') === 'minerva') {
            // Set up hook to add button to editing toolbar
            mw.hook('mobileFrontend.editorOpened').add(() => {
                const headerSwitcher = document.querySelector<HTMLDivElement>('.overlay-header .switcher-container')!;

                const tool = new OO.ui.ButtonWidget({ icon: 'articleCheck', framed: false });

                const button = tool.$element[0];
                button.addEventListener('click', handleActivation);

                headerSwitcher.before(button);
            });

            // Set up hook for updating edit summary
            mw.hook('wikipage.content').add((content) => {
                // Ignore if triggered by main content load instead of preview
                if (!content[0]?.classList.contains('preview')) return; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

                if (shouldAddScriptMessage) {
                    const summaryInput = document.querySelector<HTMLInputElement>('.summary-input textarea')!;

                    updateSummary(summaryInput);
                }
            });
        } else {
            // Set up link in side menu
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
            link.addEventListener('click', handleActivation);

            // Set up hook for updating edit summary in VisualEditor
            mw.hook('ve.saveDialog.stateChanged').add(() => {
                if (shouldAddScriptMessage) {
                    const summaryInput = document.querySelector<HTMLTextAreaElement>('.ve-ui-mwSaveDialog-summary textarea')!;

                    updateSummary(summaryInput);
                }
            });
        }
    });
})();

/**
 * Escapes regex characters in a string.
 * @param string The string to escape regex characters in.
 */
function escapeRegexCharacters(string: string) {
    return string.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

/**
 * Cleans up stray Unicode characters in an article's content.
 * @param content The article content to clean up.
 */
function cleanupStrayUnicodeCharacters(content: string) {
    // This regex removes:
    //   - ASCII control characters (\u0000-\u0009, \u000B-\u000C, \u000E-\u001F)
    //   - DEL (\u007F)
    //   - Soft hyphen (\u00AD)
    //   - Zero-width characters and directionality marks (\u200B-\u200F)
    //   - Bidi override and formatting characters (\u202A-\u202E)
    //   - Word joiner and invisible separator (\u2060, \u2063)
    //   - Byte order mark (BOM) (\uFEFF)
    const STRAY_UNICODE_REGEX = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2063\uFEFF]/g; // eslint-disable-line no-control-regex

    if (STRAY_UNICODE_REGEX.test(content)) content = content.replaceAll(STRAY_UNICODE_REGEX, '');

    return content;
}

/**
 * Cleans up section headers in an article's content.
 * @param content The article content to clean up.
 */
function cleanupSectionHeaders(content: string) {
    const COMMON_REPLACEMENTS = {
        /* eslint-disable @typescript-eslint/naming-convention */
        'See also': ['also see'],
        'References': ['reference', 'source', 'sources', 'citation', 'citations'],
        'Further reading': ['further reading'],
        'External links': ['external link', 'weblink', 'weblinks'],
        /* eslint-enable @typescript-eslint/naming-convention */
    };

    const COMMON_MISCAPITALIZED_WORDS = ['and', 'birth', 'career', 'death', 'education', 'life', 'of', 'or'];

    const reverseCommonReplacements = Object.fromEntries(
        Object.entries(COMMON_REPLACEMENTS).flatMap(([key, values]) => [
            [key.toLowerCase(), key],
            ...(values.map((value) => [value, key]) as [string, string][]), // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
        ]),
    );

    const headers = content.matchAll(/(?<=^|\n)\n*(?<startMarkup>=+) *(?<name>.*?) *(?<endMarkup>=+)(\n+|$)/g);

    const parsedHeaders = [...headers].map((header) => {
        let { name } = header.groups!;
        const { startMarkup, endMarkup } = header.groups!;

        name = name.replaceAll(/'{3}/g, '');

        const links = name.matchAll(/\[\[(.+?)]]/g).toArray();

        for (const link of links) name = name.replace(link[0], link[1].split('|').at(-1)!);

        const depth = Math.max(startMarkup.length, endMarkup.length, 2);

        return { name, depth, original: header[0] };
    });

    const headersSet = new Set(parsedHeaders.map((header) => header.name));

    const titleSpacer = parsedHeaders.length > 0 ? (/^\n*=+ | =+\n+$/.test(parsedHeaders[0].original) ? ' ' : '') : '';

    for (const header of parsedHeaders) {
        const lowercaseName = header.name.toLowerCase();

        const replacedName =
            lowercaseName in reverseCommonReplacements && !headersSet.has(reverseCommonReplacements[lowercaseName])
                ? reverseCommonReplacements[lowercaseName]
                : header.name;

        let capitalizedName = replacedName;

        for (const word of COMMON_MISCAPITALIZED_WORDS)
            capitalizedName = capitalizedName.replaceAll(new RegExp(`\\b${word}\\b`, 'gi'), word);

        capitalizedName = capitalizedName.charAt(0).toUpperCase() + capitalizedName.slice(1);

        const output = `${'='.repeat(header.depth)}${titleSpacer}${capitalizedName}${titleSpacer}${'='.repeat(header.depth)}`;

        if (header.original !== output) content = content.replace(header.original, `\n\n${output}\n`);
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
        const originalTagRegex = new RegExp(`${escapeRegexCharacters(tag.original)}\n*`, 'g');

        const unprefixedTitle = mw.Title.newFromText(tag.value);

        if (!unprefixedTitle) continue;

        const title = mw.Title.makeTitle(currentTitle.getNamespaceId(), unprefixedTitle.getMainText());

        if (!title) continue;

        const defaultKey = tag.type === 'DISPLAYTITLE' ? currentTitle.toText() : currentTitle.getMainText();

        const customKey = tag.type === 'DISPLAYTITLE' ? title.toText() : title.getMainText();

        if (defaultKey === customKey) {
            content = content.replace(originalTagRegex, '');
            continue;
        }

        const newText = `{{${tag.type}:${customKey}}}\n`;

        content = content.replace(originalTagRegex, newText);
    }

    return content;
}

/**
 * Cleans up categories in an article's content.
 * @param content The article content to clean up.
 */
function cleanupCategories(content: string) {
    return content.replaceAll(
        /(\[\[|}}):?category:(.*?)(]]|}})/gi,
        `[[${mw.config.get('wgCanonicalNamespace') === 'Draft' ? ':' : ''}Category:$2]]`,
    );
}

interface LinkInformation {
    start: number;
    end: number;
    isNested: boolean;
}

/**
 * Cleans up links in an article's content.
 * @param content The article content to clean up.
 * @param functionsCalledWhileEscaped The functions called while the links are escaped.
 */
function cleanupLinks(content: string, functionsCalledWhileEscaped: ((content: string, run: 1 | 2) => string)[]) {
    const closedLinks: LinkInformation[] = [];
    const links: LinkInformation[] = [];

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
            if (isAtString('[[')) links.push({ start: currentLocation - 2, end: -1, isNested: links.length > 0 });
            else if (isAtString(']]')) {
                const lastLink = links.pop();
                if (!lastLink) continue;

                lastLink.end = currentLocation;

                closedLinks.push(lastLink);
            } else currentLocation++;
        else currentLocation++;

    const newLinkContent: [LinkInformation, string][] = [];

    const namespaceNames = Object.values(mw.config.get('wgFormattedNamespaces'));

    for (const linkLocation of closedLinks) {
        const innerLink = content.slice(linkLocation.start + 2, linkLocation.end - 2);

        const [unparsedLink, ...parameters] = innerLink.split('|');

        // Replace link names so these won't be affected by functions called while escaped
        content =
            content.slice(0, linkLocation.start + 2) +
            '\0'.repeat(unparsedLink.length) +
            content.slice(linkLocation.start + 2 + unparsedLink.length);

        let link = unparsedLink.replaceAll('_', ' ').trim();
        let altText = parameters.join('|');
        altText = altText === ' ' ? ' ' : altText.trim();

        const isFirstCharacterColon = link.startsWith(':');
        if (isFirstCharacterColon) link = link.slice(1);

        let shouldFirstCharacterBeColon = false;

        const linkUppercaseStart = link.charAt(0).toUpperCase() + link.slice(1);
        const linkLowercaseStart = link.charAt(0).toLowerCase() + link.slice(1);

        let namespace = link.split(':')[0];
        namespace = namespace.charAt(0).toUpperCase() + namespace.slice(1);

        if (link.includes(':')) {
            if (linkUppercaseStart.startsWith('Image:')) {
                const shouldStartUppercase = link.startsWith('Image:');

                link = `${shouldStartUppercase ? 'F' : 'f'}ile:${link.slice(6)}`;
            }

            if (
                isFirstCharacterColon &&
                (['Image', 'File', 'Category'].includes(linkUppercaseStart.split(':')[0]) || !namespaceNames.includes(namespace))
            )
                shouldFirstCharacterBeColon = true;
        }

        let beforeLinkText = '';
        let afterLinkText = '';

        const matchedMarkup = /^('{2,})(.*?)\1$/.exec(altText);

        if (matchedMarkup && !matchedMarkup[2].includes("''")) {
            beforeLinkText = matchedMarkup[1];
            altText = matchedMarkup[2].trim();
            afterLinkText = matchedMarkup[1];
        }

        if (/[!,.:;?]$/.test(altText) && !['Image', 'File', 'Category'].includes(linkUppercaseStart.split(':')[0])) {
            const addedPunctuation = altText.slice(-1);

            if (!link.endsWith(addedPunctuation)) {
                afterLinkText += addedPunctuation;
                altText = altText.slice(0, -1);
            }
        }

        if (link === altText) altText = '';
        else if (new RegExp(`^${escapeRegexCharacters(link)}[a-z]+$`).test(altText)) {
            afterLinkText = altText.slice(link.length) + afterLinkText;
            altText = '';
        }

        for (const newLink of [linkUppercaseStart, linkLowercaseStart])
            if (newLink === altText) {
                link = newLink;
                altText = '';
            } else if (new RegExp(`^${escapeRegexCharacters(newLink)}[a-z]+$`).test(altText)) {
                link = newLink;
                afterLinkText = altText.slice(newLink.length) + afterLinkText;
                altText = '';
            }

        if (
            (altText && link.includes(':') && namespaceNames.includes(namespace)) ||
            link.startsWith('file:') ||
            link.startsWith('category:')
        )
            link = link.charAt(0).toUpperCase() + link.slice(1);

        link = `${shouldFirstCharacterBeColon ? ':' : ''}${link}`;

        link = link.padStart(unparsedLink.length, '\0');

        const output = `${beforeLinkText}[[${link}${altText ? `|${altText}` : ''}]]${afterLinkText}`;

        newLinkContent.push([linkLocation, output]);
    }

    for (const functionToCall of functionsCalledWhileEscaped) content = functionToCall(content, 1);

    for (let loopCounter = 0; loopCounter < 2; loopCounter++)
        for (const [linkData, linkContent] of newLinkContent) {
            if (loopCounter === 0 && linkData.isNested) continue;
            else if (loopCounter === 1 && !linkData.isNested) continue;

            content =
                content.slice(0, linkData.start) + linkContent.padEnd(linkData.end - linkData.start, '\0') + content.slice(linkData.end);
        }

    for (const functionToCall of functionsCalledWhileEscaped) content = functionToCall(content, 2);

    return content.replaceAll('\0', '');
}

/**
 * Cleans up improper characters in an article's content.
 * @param content The article content to clean up.
 * @param run The run number of the function.
 */
function cleanupImproperCharacters(content: string, run: 1 | 2) {
    const ELIPSIS_PLACEHOLDER = '\u007F';
    const NBSP_PLACEHOLDER = '\u009F';

    if (run === 1) {
        content = content.replaceAll(/[“”„‟]/g, '"');
        content = content.replaceAll(/[‘’‚‛]/g, "'");
        content = content.replaceAll('…', ELIPSIS_PLACEHOLDER);
        content = content.replaceAll(' ', NBSP_PLACEHOLDER);
    } else {
        content = content.replaceAll(ELIPSIS_PLACEHOLDER, '...');
        content = content.replaceAll(NBSP_PLACEHOLDER, '&nbsp;');
    }

    return content;
}

/**
 * Cleans up year ranges in an article's content.
 * @param content The article content to clean up.
 * @param run The run number of the function.
 */
function cleanupYearRanges(content: string, run: 1 | 2) {
    if (run === 1)
        content = content.replaceAll(/(\(\d{3,4}) ?[‒–−-] ?(\d{3,4}\))/g, (original, start, end) =>
            `${start}–${end}`.padEnd(original.length, '\0'),
        );

    return content;
}

/**
 * Removes stray markup in an article's content.
 * @param content The article content to clean up.
 */
function cleanupStrayMarkup(content: string) {
    const STRAY_MARKUP_REGEXES = [
        /'+(Bold|Italic)( text)?'+ */g,
        /(<big>)+Big( text)?(<\/big>)+ */g,
        /(<small>)+Small( text)?(<\/small>)+ */g,
        /(<sup>)+Superscript( text)?(<\/sup>)+ */g,
        /(<sub>)+Subscript( text)?(<\/sub>)+ */g,
        /(<s>)+Strikethrough(<\/s>)+ */g,
        /(<u>)+Underline(<\/u>)+ */g,
        /(<code>)+Computer code(<\/code>)+ */g,
        /(<nowiki>)+Insert non-formatted text here(<\/nowiki>)+ */g,
        /=+ Heading text =+ */g,
        /\* Bulleted list item */g,
        /# Numbered list item */g,
        /<gallery>\nExample.jpg\|Caption1\nExample.jpg\|Caption2\n<\/gallery> */g,
        /#REDIRECT \[\[Target page name]] */g,
        /<!-- Invisible comment --> */g,
        /<\s*(big|small|sup|sub|s|u|code|nowiki|noinclude|onlyinclude|includeonly|center|blockquote|gallery)\s*(\s+[^<>]*)?>\s*<\s*\/\s*\1\s*>/gi,
    ];

    for (const regex of STRAY_MARKUP_REGEXES) while (regex.test(content)) content = content.replace(regex, '');

    return content;
}

/**
 * Cleans up spacing in an article's content.
 * @param content The article content to clean up.
 * @param secondRun Whether the function is being run for the second time, after other processing.
 */
function cleanupSpacing(content: string, secondRun = false) {
    const PLACEHOLDER = '\u{F0000}';

    const TAGS_TO_IGNORE = ['poem', 'pre', 'references', 'templatedata'];

    const ignoredTagsContent: string[] = [];

    content = content.replaceAll(
        new RegExp(`(<(${TAGS_TO_IGNORE.join('|')})(?: [^<>]*?)?>)(.*?)(</\\2>)`, 'gs'),
        (fullMatch, startTag: string, tagName: string, innerContent: string, endTag: string) => {
            innerContent = innerContent.replaceAll(/ +$/gm, '').trim();

            ignoredTagsContent.push(`${startTag}\n${innerContent}\n${endTag}`);

            return PLACEHOLDER;
        },
    );

    content = content.replaceAll(/(\b|\p{Punctuation}|\]\]|\}\}|\w>) {2,}(\b|\p{Punctuation}|\[\[|\{\{|<\w)/gu, '$1 $2'); // Remove extra spaces between words and sentences
    if (!secondRun) content = content.replaceAll(/^ +| +$/gm, ''); // Remove extra spaces at the start or end of lines
    content = content.replaceAll(/\n{3,}/g, '\n\n'); // Remove extra newlines
    content = content.replace(/\s*({{[^}]*stub}})/i, '\n\n$1'); // Ensure there is one blank line before the first stub template
    content = content.replaceAll(/\s+$/g, ''); // Remove trailing spaces
    content = content.replaceAll(/^([#*]+) */gm, '$1 '); // Ensure there is a space after a bullet or hash in a list item
    content = content.replaceAll(/^([#*]+ .*)\n+(?=[#*]+ )/gm, '$1\n'); // Remove newlines between list items
    if (!secondRun) content = content.replaceAll(/(?<!\|)\s+(?=<ref(?!erences))/g, ''); // Remove spaces before references
    content = content.replaceAll(/<\/([A-Za-z]+) +>/g, '</$1>'); // Remove excess space in closing tags
    content = content.replaceAll(/^(=+.*?=+)$\n{2,}(?=^=+.*?=+$)/gm, '$1\n'); // Remove extra newlines between empty section and following section
    content = content.trim(); // Remove whitespace at the start or end of the content

    // Add back ignored tags
    for (const tagContent of ignoredTagsContent) content = content.replace(PLACEHOLDER, tagContent);

    return content;
}

/**
 * Cleans up references in an article's content.
 * @param content The article content to clean up.
 */
function cleanupReferences(content: string) {
    content = content.replaceAll(
        /((?:<ref(?!erences)[^/]*?>.*?<\/ref>|<ref(?!erences).*?\/>)+)([!,.;?])?/g,
        (fullMatch, referenceTag: string, punctuation: string | undefined) => (punctuation ?? '') + referenceTag,
    ); // Fix punctuation following references

    const references: { start: number; end: number; isSelfClosing?: true }[] = [];

    let isInsideNowiki = false;
    let isInsideComment = false;

    let currentLocation = 0;

    /**
     * Checks if the content following the current location matches the desired string.
     * @param desiredString The string to search for.
     */
    function isAtString(desiredString: string) {
        const isAtString = content.slice(currentLocation, currentLocation + desiredString.length) === desiredString;

        if (isAtString) currentLocation += desiredString.length;

        return isAtString;
    }

    /**
     * Proceeds through the content until the desired string is found.
     * @param desiredString The string to search for.
     */
    function proceedUntilString(desiredString: string) {
        while (currentLocation < content.length && !isAtString(desiredString)) currentLocation++;
    }

    while (currentLocation < content.length)
        if (isAtString('<nowiki>')) isInsideNowiki = true;
        else if (isAtString('</nowiki>')) isInsideNowiki = false;
        else if (isAtString('<!--')) isInsideComment = true;
        else if (isAtString('-->')) isInsideComment = false;
        else if (!isInsideNowiki && !isInsideComment)
            if (!isAtString('<references') && isAtString('<ref')) {
                const start = currentLocation - 4;

                proceedUntilString('>');

                const isSelfClosing = content
                    .slice(start, currentLocation - 1)
                    .trim()
                    .endsWith('/');

                references.push(isSelfClosing ? { start, end: currentLocation, isSelfClosing } : { start, end: -1 });
            } else if (isAtString('</ref>')) references.at(-1)!.end = currentLocation;
            else currentLocation++;
        else currentLocation++;

    const parser = new DOMParser();

    const replacements: [string, string][] = [];

    for (const reference of references) {
        const originalText = content.slice(reference.start, reference.end);

        const startTag = /<ref(?!erences).*?>/is.exec(originalText)![0];

        const parsedTag = parser.parseFromString(
            reference.isSelfClosing ? startTag.replace(/ *\/ *>/, ' />') : startTag + '</ref>',
            'text/html',
        ).body.firstChild as HTMLUnknownElement;

        let output = parsedTag.outerHTML.replaceAll('&amp;', '&');

        const tagContent = originalText
            .slice(startTag.length, -6)
            .trim()
            .replaceAll(/^\[ *([^ \]]*) *]$/gm, '$1')
            .trim();

        output =
            reference.isSelfClosing || tagContent.length === 0
                ? output.replace(/>\s*<\/ref>/, ' />')
                : `${output.slice(0, -6)}${tagContent}</ref>`;

        if (originalText !== output) replacements.push([originalText, output]);
    }

    for (const [originalText, output] of replacements) content = content.replace(originalText, output);

    return content;
}

interface TemplateRedirect {
    from: string[];
    to: string;
}

let templateAliases: TemplateRedirect[] | undefined;

/**
 * Formats template spacing in an article's content.
 * @param content The article content to format.
 */
async function formatTemplates(content: string) {
    enum FormatStyle {
        Expanded,
        ExpandedAligned,
        Minimized,
        MinimizedSpaced,
    }

    enum Namespace {
        User = 2,
        Template = 10,
        Draft = 118,
    }

    templateAliases ??= JSON.parse((await getPageContent('User:Eejit43/scripts/article-cleaner.json')) ?? '[]') as TemplateRedirect[];

    const mappedTemplateAliases = Object.fromEntries(
        templateAliases.flatMap((alias) => alias.from.map((from) => [from.charAt(0).toLowerCase() + from.slice(1), alias.to])),
    );

    class Template {
        public location: { start: number; end?: number };
        public isNested = false;

        public fullText?: string;
        private fullTextEscaped?: string;
        private rawName?: string;
        private name?: string;
        private parameters: { key: string | null; value: string }[] = [];
        public subTemplates: Template[] = [];

        private PLACEHOLDER_STRINGS = ['\u{F0000}', '\u{10FFFF}', '\u{FFFFE}'];

        private PIPE_ESCAPE_REGEXES = [/(\[\[[^\]]*?)\|(.*?]])/g, /(<!--.*?)\|(.*?-->)/g, /(<nowiki>.*?)\|(.*?<\/nowiki>)/g];

        private TAG_EQUALS_ESCAPE_REGEXES = [/<(\w+)( [^<>]+?)(?<!\/)>.*?<\/\1>/g, /<(\w+)( [^<>]+?)\/>/g];

        private TEMPLATE_ALIASES = mappedTemplateAliases;

        private DEFAULT_TEMPLATE_STYLES = {
            [FormatStyle.ExpandedAligned]: [
                'album rating',
                'album reviews',
                'american football uniform',
                'australian rules football kit',
                'automatic taxobox',
                'baseball uniform',
                'basketball kit',
                'beachhandball kit',
                'blockquote',
                'chembox',
                'cricket uniform',
                'election box',
                'emblem table',
                'episode list',
                'external music video',
                'extra album cover',
                'field hockey kit',
                'football box',
                'football kit',
                'footballbox',
                'gallery',
                'handball kit',
                'hybridbox',
                'icehockey kit',
                'ichnobox',
                'infobox',
                'infraspeciesbox',
                'judo bracket',
                'judo repechage',
                'listen',
                'location map',
                'medical resources',
                'motorsport season',
                'multiple image',
                'music ratings',
                'mycomorphbox',
                'navbox',
                'oobox',
                'orbitbox',
                'osm location map',
                'quote box',
                'repechage',
                'rugbybox',
                'sidebar',
                'single ratings',
                'singles',
                'song ratings',
                'speciesbox',
                'starbox',
                'succession box',
                'taxobox',
                'team bracket',
                'track listing',
                'tweet',
                'virusbox',
                'volleyball kit',
                'weather box',

                // Numbered brackets
                'nteambracket',
                '2nteam-nteambracket',
                '2teambracket',
                '3teambracket',
                '3teamrr',
                '4teambracket',
                '4teamrr',
                '5teambracket',
                '5teamrr',
                '6teambracket',
                '6teamrr',
                '7teambracket',
                '7teamrr',
                '8teambracket',
                '8teamroundrobin',
                '8teamrr',
                '9teambracket',
                '10teambracket',
                '11teambracket',
                '12teambracket',
                '13teambracket',
                '14teambracket',
                '15teambracket',
                '16teambracket',
                '18teambracket',
                '20teambracket',
                '24teambracket',
                '27teambracket',
                '32teambracket',
                '40teambracket',
                '48teambracket',
                '64teambracket',
                '128teambracket',
            ],
            [FormatStyle.Minimized]: ['birth date', 'coord', 'death date', 'end date', 'lang', 'start date'],
            [FormatStyle.MinimizedSpaced]: ['infobox mapframe'],
        };

        private NAMESPACE_SPECIFIC_TEMPLATES = {
            [Namespace.Draft]: [
                'afc comment',
                'afc submission',
                'afc submission/draft',
                'afc topic',
                'draft article',
                'draft categories',
                'draft topics',
                'draft',
                'drafts moved from mainspace',
                'preloaddraft submit',
            ],
            [Namespace.User]: ['dashboard.wikiedu.org sandbox', 'user sandbox', 'userspace draft'],
        };

        private TEMPLATES_TO_KEEP_CONTENT = ['draft categories'];

        private TEMPLATES_TO_SUBST = [
            // Magic words
            'articlepagename',
            'articlespace',
            'basepagename',
            'fullpagename',
            'namespace',
            'namespacenumber',
            'pagename',
            'rootpagename',
            'subjectpagename',
            'subjectspace',
            'subpagename',
            'talkpagename',
            'talkspace',

            // Templates
            'pagenamebase',
        ];

        private IMAGE_PARAMETERS = new Set(['cover', 'image_flag', 'image_seal', 'image_skyline', 'image', 'logo', 'map_image']);

        private IGNORED_IMAGE_SYNTAX = new Set([
            // Type
            'thumb',
            'thumbnail',
            'frame',
            'framed',
            'frameless',
            // Border
            'border',
            'right',
            'left',
            'center',
            'none',
            // Alignment
            'baseline',
            'middle',
            'sub',
            'super',
            'text-top',
            'text-bottom',
            'top',
            'bottom',
        ]);

        constructor(startLocation: number) {
            this.location = { start: startLocation };

            for (let number = 1; number <= 10; number++) this.IMAGE_PARAMETERS.add(`image${number}`);
        }

        public parse() {
            this.fullText = content.slice(this.location.start, this.location.end);
            this.fullTextEscaped = this.fullText;

            for (const subTemplate of this.subTemplates) {
                subTemplate.parse();

                this.fullTextEscaped = this.fullTextEscaped.replace(subTemplate.fullText!, this.PLACEHOLDER_STRINGS[0]);
            }

            let trimmedInnerText = this.fullTextEscaped.slice(2, -2).trim();

            for (const pipeEscapeRegex of this.PIPE_ESCAPE_REGEXES)
                while (pipeEscapeRegex.test(trimmedInnerText))
                    trimmedInnerText = trimmedInnerText.replaceAll(pipeEscapeRegex, `$1${this.PLACEHOLDER_STRINGS[1]}$2`);

            for (const regex of this.TAG_EQUALS_ESCAPE_REGEXES)
                trimmedInnerText = trimmedInnerText.replaceAll(regex, (fullText, tagName: string, attributes: string) => {
                    return fullText.replace(attributes, attributes.replaceAll('=', this.PLACEHOLDER_STRINGS[2]));
                });

            const parameters = trimmedInnerText
                .split('|')
                .map((parameter) => parameter.replaceAll(this.PLACEHOLDER_STRINGS[1], '|').trim());

            this.rawName = parameters.shift()!;
            this.name = this.rawName.replaceAll('_', ' ');

            // Strip namespace prefix from name
            if (this.name.toLowerCase().startsWith('template:')) this.name = this.name.slice(9);

            const nameLowercaseFirst = this.name.charAt(0).toLowerCase() + this.name.slice(1);

            // Resolve template alias in name
            if (nameLowercaseFirst in this.TEMPLATE_ALIASES) {
                const isStartLower = this.name.startsWith(this.name.charAt(0).toLowerCase());

                const finalName = this.TEMPLATE_ALIASES[nameLowercaseFirst];

                const mustStartBeUppercase =
                    finalName.startsWith(finalName.slice(0, 2).toUpperCase()) && /^[A-Z]+$/.exec(finalName.slice(0, 2));

                this.name = isStartLower && !mustStartBeUppercase ? finalName.charAt(0).toLowerCase() + finalName.slice(1) : finalName;
            }

            const splitParameters = parameters.map((parameters) => {
                const equalsLocation = parameters.indexOf('=');

                if (equalsLocation === -1) return { key: null, value: parameters.replaceAll(this.PLACEHOLDER_STRINGS[2], '=').trim() };

                const value = parameters.slice(equalsLocation + 1).replaceAll(this.PLACEHOLDER_STRINGS[2], '=');

                return {
                    key: parameters.slice(0, equalsLocation).trim(),
                    value: `${value.startsWith('\n') ? '\n' : ''}${value.trim()}`,
                };
            });

            this.parameters = splitParameters;
        }

        private shouldBeRemoved() {
            for (const [namespace, templates] of Object.entries(this.NAMESPACE_SPECIFIC_TEMPLATES)) {
                if (mw.config.get('wgNamespaceNumber') === Number.parseInt(namespace)) continue;

                if (templates.includes(this.name!.toLowerCase())) return true;
            }

            return false;
        }

        private getStyle() {
            let mostSpecificDefaultStylePrefixLength = 0;
            let mostSpecificDefaultStyleFormatStyle: FormatStyle | undefined;

            for (const [formatStyle, templatePrefixes] of Object.entries(this.DEFAULT_TEMPLATE_STYLES))
                for (const templatePrefix of templatePrefixes)
                    if (
                        this.name!.toLowerCase().startsWith(templatePrefix) &&
                        templatePrefix.length >= mostSpecificDefaultStylePrefixLength
                    ) {
                        mostSpecificDefaultStylePrefixLength = templatePrefix.length;
                        mostSpecificDefaultStyleFormatStyle = Number.parseInt(formatStyle) as FormatStyle;
                    }

            return mostSpecificDefaultStyleFormatStyle;
        }

        private cleanupParameters() {
            this.parameters = this.parameters.map(({ key, value }) => {
                if (key && this.IMAGE_PARAMETERS.has(key)) {
                    value = value.trim();

                    const valueBefore = value;

                    let imageParameters = [];

                    if (value.startsWith('[[') && value.endsWith(']]')) {
                        imageParameters = value.slice(2, -2).split('|');

                        value = imageParameters[0].trim();
                    }

                    value = value.replace(/^(File|Image):/, '').replaceAll('_', ' ');

                    const additionalData = valueBefore
                        .slice(2, -2)
                        .split('|')
                        .slice(1)
                        .map((parameter) => parameter.trim())
                        .filter((parameter) => !this.IGNORED_IMAGE_SYNTAX.has(parameter))
                        .join('|');

                    if (additionalData.length > 0) value += ` <!-- Previous additional data: "${additionalData}" -->`;
                }

                return { key, value };
            });
        }

        public format() {
            if (!this.fullText) this.parse();

            if (this.shouldBeRemoved())
                return this.TEMPLATES_TO_KEEP_CONTENT.includes(this.name!.toLowerCase()) ? this.parameters[0].value : '';

            const shouldSubst =
                mw.config.get('wgNamespaceNumber') !== (Namespace.Template as number) &&
                this.TEMPLATES_TO_SUBST.some(
                    (name) => name === this.name!.toLowerCase() || this.name!.toLowerCase().startsWith(`${name}:`),
                );

            const style = this.getStyle();
            if (style === undefined) {
                let newName = this.name!;
                if (this.name!.toLowerCase().startsWith('template:')) newName = this.name!.slice(9);

                if (shouldSubst) newName = `subst:${newName}`;

                if (newName !== this.rawName!) this.fullTextEscaped = this.fullTextEscaped!.replace(this.rawName!, newName);

                for (const subTemplate of this.subTemplates)
                    this.fullTextEscaped = this.fullTextEscaped!.replace(this.PLACEHOLDER_STRINGS[0], subTemplate.format());

                return this.fullTextEscaped!;
            }

            const output = [`{{${shouldSubst ? 'subst:' : ''}${this.name!}`];

            this.cleanupParameters();

            if (style === FormatStyle.Expanded || style === FormatStyle.ExpandedAligned) {
                let requiredKeyLength = 0;

                if (style === FormatStyle.ExpandedAligned)
                    requiredKeyLength = Math.max(...this.parameters.map((parameter) => parameter.key?.length ?? 0));

                for (const [index, parameter] of this.parameters.entries()) {
                    if (
                        !parameter.key &&
                        !parameter.value &&
                        this.parameters.slice(index + 1).every((parameter) => parameter.key ?? !parameter.value)
                    )
                        continue;

                    output.push(`| ${parameter.key ? `${parameter.key.padEnd(requiredKeyLength)} = ` : ''}${parameter.value}`);
                }
            } else
                for (const [index, parameter] of this.parameters.entries()) {
                    if (
                        !parameter.value &&
                        (parameter.key || this.parameters.slice(index + 1).every((parameter) => parameter.key ?? !parameter.value))
                    )
                        continue;

                    output.push(`|${parameter.key ? `${parameter.key}=` : ''}${parameter.value}`);
                }

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
                joinedOutput = joinedOutput.replace(this.PLACEHOLDER_STRINGS[0], subTemplate.format());

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
     */
    function isAtString(desiredString: string) {
        const isAtString = content.slice(currentLocation, currentLocation + desiredString.length) === desiredString;

        if (isAtString) currentLocation += desiredString.length;

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
 * Removes unnecessary comments from an article's content.
 * @param content The article content to clean up.
 */
function removeComments(content: string) {
    if (mw.config.get('wgNamespaceNumber') !== 0) return content;

    const COMMENTS_TO_REMOVE = [
        'Do not remove this line',
        'EDIT BELOW THIS LINE',
        'Important, do not remove anything above this line before article has been created',
        'Important, do not remove this line before article has been created',
        'Inline citations added to your article will automatically display here',
        'Note: The following pages were redirects to ',
    ];

    for (const comment of COMMENTS_TO_REMOVE)
        content = content.replaceAll(new RegExp(` *<!-- ?${escapeRegexCharacters(comment)}.*?--> *\n?`, 'gs'), '');

    return content;
}

/**
 * Adds relevant tags to an article's content.
 * @param content The article content to add tags to.
 */
function autoTagPage(content: string) {
    const isOutsideMainspace = mw.config.get('wgNamespaceNumber') !== 0;
    const isEditingSection = !!new URLSearchParams(window.location.search).get('section');
    const isDisambiguation = mw.config.get('wgCategories').includes('All disambiguation pages');
    const isRedirect = mw.config.get('wgIsRedirect');

    if (isOutsideMainspace || isEditingSection || isDisambiguation || isRedirect) return content;

    const numberOfCategories = [...content.matchAll(/\[\[Category:/g)].length;

    content = content.replaceAll(/\n*{{(uncategorized|improve categories)(\|.+?)?}}({{|\n+|$)/gi, '');

    if (numberOfCategories === 0 && !/{{uncategorized/i.test(content))
        content += '\n\n{{Uncategorized|{{subst:CURRENTMONTHNAME}} {{subst:CURRENTYEAR}}}}';
    else if (numberOfCategories === 1 && !/{{improve categories/i.test(content))
        content += '\n\n{{Improve categories|{{subst:CURRENTMONTHNAME}} {{subst:CURRENTYEAR}}}}';

    return content;
}
