import type { ApiQueryAllPagesGeneratorParameters, PageParseResult } from '@/global-types';
import { api } from '@/utility';
import type { ApiParseParams } from 'types-mediawiki-api';

export interface LookupElementConfig extends OO.ui.TextInputWidget.ConfigOptions, OO.ui.mixin.LookupElement.ConfigOptions {}

interface PageSectionData {
    fragment: string;
    isSection: boolean;
    result: { data: string; label: string | OO.ui.HtmlSnippet };
}

const ANCHOR_QUERIES_TO_REMOVE = ['div.navbox', 'ol.references'];

const ANCHOR_CLASSES_TO_EXCLUDE = ['citation', 'mw-file-element', 'reference'];

/**
 * Gets the anchors from the HTML of a page.
 * @param html The HTML of the page.
 * @param title The title of the page.
 */
export function getAnchorsFromHtml(html: string, title: string): PageSectionData[] {
    const domParser = new DOMParser();

    const document = domParser.parseFromString(html, 'text/html');

    for (const query of ANCHOR_QUERIES_TO_REMOVE) for (const element of document.querySelectorAll(query)) element.remove();

    console.log(document.body.outerHTML);

    const anchors = [...document.querySelectorAll<HTMLElement>('[id]')]
        .map((element) => {
            if (ANCHOR_CLASSES_TO_EXCLUDE.some((className) => element.classList.contains(className)) || 'mwCommentStart' in element.dataset)
                return null;

            // TODO: handle edge cases like cite refs, weird stuff like the .2C on WP:NOT and the image markup on 9/11

            const fragment = element.id.replaceAll('_', ' ');

            const fullTitle = `${title}#${fragment}`;

            return {
                fragment,
                isSection: false,
                result: { data: fullTitle, label: new OO.ui.HtmlSnippet(`${fullTitle} <i>(anchor)</i>`) },
            };
        })
        .filter(Boolean) as PageSectionData[];

    return anchors;
}

/**
 * An instance of this class is a title lookup element.
 */
export default class RedirectTargetInputWidget extends OO.ui.TextInputWidget {
    private pageTitleParsed: mw.Title;

    private knownPageSections = new Map<string, PageSectionData[]>();

    constructor(config: LookupElementConfig, pageTitleParsed: mw.Title) {
        super(config);

        OO.ui.mixin.LookupElement.call(this as unknown as OO.ui.mixin.LookupElement, config);

        this.pageTitleParsed = pageTitleParsed;
    }

    private getMatchingFragmentResults = (allSections: PageSectionData[], allAnchors: PageSectionData[], searchedFragment: string) => {
        const matchedSections = allSections.filter(({ fragment }) => fragment.toLowerCase().startsWith(searchedFragment));
        const matchedSectionsSet = new Set(matchedSections.map(({ fragment }) => fragment.toLowerCase()));

        const matchedAnchors = allAnchors.filter(
            ({ fragment }) => fragment.toLowerCase().startsWith(searchedFragment) && !matchedSectionsSet.has(fragment.toLowerCase()),
        );

        const mappedMatchedSections = matchedSections.map(({ result }) => result);

        const mappedMatchedAnchors = matchedAnchors.map(({ result }) => result);

        return [...mappedMatchedSections, ...mappedMatchedAnchors];
    };

    getLookupRequest = () => {
        const value = this.getValue();
        const deferred = $.Deferred();

        if (!value) deferred.resolve([]);
        else if (value.includes('#')) {
            const title = value.split('#')[0];
            const searchedFragment = value.split('#').slice(1).join('#').toLowerCase();

            if (this.knownPageSections.has(title)) {
                const sectionsAndFragments = this.knownPageSections.get(title)!;

                const sections = sectionsAndFragments.filter(({ isSection }) => isSection);
                const anchors = sectionsAndFragments.filter(({ isSection }) => !isSection);

                deferred.resolve(this.getMatchingFragmentResults(sections, anchors, searchedFragment));
            } else
                api.get({ action: 'parse', page: title, prop: ['text', 'tocdata'], redirects: true } satisfies ApiParseParams)
                    .catch(() => null)
                    .then((result: PageParseResult | null) => {
                        if (result) {
                            const allSections = result.parse!.tocdata.sections.map((section) => {
                                const fragment = section.line.replaceAll(/<\/?i>/g, '');

                                const fullTitle = `${result.parse!.title}#${fragment}`;

                                return { fragment, isSection: true, result: { data: fullTitle, label: fullTitle } };
                            });

                            const allAnchors = getAnchorsFromHtml(result.parse!.text['*'], result.parse!.title);

                            this.knownPageSections.set(title, [...allSections, ...allAnchors]);

                            deferred.resolve(this.getMatchingFragmentResults(allSections, allAnchors, searchedFragment));
                        } else deferred.resolve([]);
                    });
        } else {
            const parsedTitle = mw.Title.newFromText(value);

            api.get({
                action: 'query',
                formatversion: '2',
                gaplimit: 20,
                gapnamespace: parsedTitle?.getNamespaceId() ?? 0,
                gapprefix: parsedTitle?.getMainText() ?? value,
                generator: 'allpages',
                prop: ['info', 'pageprops'],
            } satisfies ApiQueryAllPagesGeneratorParameters)
                .catch(() => null)
                .then(
                    (
                        result: {
                            query: { pages: { title: string; pageprops?: { disambiguation?: string }; redirect?: string }[] };
                        } | null,
                    ) => {
                        if (result?.query)
                            deferred.resolve(
                                result.query.pages
                                    .filter((page) => page.title !== this.pageTitleParsed.getPrefixedText())
                                    .map((page) => ({
                                        data: page.title,
                                        label: new OO.ui.HtmlSnippet(
                                            `${page.title}${page.pageprops && 'disambiguation' in page.pageprops ? ' <i>(disambiguation)</i>' : ''}${'redirect' in page ? ' <i>(redirect)</i>' : ''}`,
                                        ),
                                    })),
                            );
                        else deferred.resolve([]);
                    },
                );
        }

        return deferred.promise({ abort() {} }); // eslint-disable-line @typescript-eslint/no-empty-function
    };

    getLookupCacheDataFromResponse = <T>(response: T[] | null | undefined) => response ?? [];

    getLookupMenuOptionsFromData = (data: { data: string; label: string }[]) =>
        data.map(({ data, label }) => new OO.ui.MenuOptionWidget({ data, label }));
}

Object.assign(RedirectTargetInputWidget.prototype, OO.ui.mixin.LookupElement.prototype);
