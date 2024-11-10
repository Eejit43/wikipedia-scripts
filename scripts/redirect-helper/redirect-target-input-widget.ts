import type { ApiParseParams } from 'types-mediawiki/api_params';
import type { ApiQueryAllPagesGeneratorParameters, PageParseResult } from '../../global-types';

export interface LookupElementConfig extends OO.ui.TextInputWidget.ConfigOptions, OO.ui.mixin.LookupElement.ConfigOptions {}

/**
 * An instance of this class is a title lookup element.
 */
export default class RedirectTargetInputWidget extends OO.ui.TextInputWidget {
    // Utility variables
    private api = new mw.Api();

    // Assigned in constructor
    private pageTitleParsed: mw.Title;

    constructor(config: LookupElementConfig, pageTitleParsed: mw.Title) {
        super(config);

        OO.ui.mixin.LookupElement.call(this as unknown as OO.ui.mixin.LookupElement, config);

        this.pageTitleParsed = pageTitleParsed;
    }

    getLookupRequest = () => {
        const value = this.getValue();
        const deferred = $.Deferred();

        if (!value) deferred.resolve([]);
        else if (value.includes('#')) {
            const title = value.split('#')[0];

            this.api
                .get({ action: 'parse', page: title, prop: 'sections', redirects: true } satisfies ApiParseParams)
                .catch(() => null)
                .then((result: PageParseResult | null) => {
                    if (result) {
                        const matchedSections = result.parse.sections.filter((section) =>
                            section.line
                                .toLowerCase()
                                .replaceAll(/<\/?i>/g, '')
                                .startsWith(value.split('#')[1].toLowerCase()),
                        );
                        deferred.resolve(
                            matchedSections.map((section) => ({
                                data: `${result.parse.title}#${section.line.replaceAll(/<\/?i>/g, '')}`,
                                label: `${result.parse.title}#${section.line.replaceAll(/<\/?i>/g, '')}`,
                            })),
                        );
                    } else deferred.resolve([]);
                });
        } else {
            const parsedTitle = mw.Title.newFromText(value);

            this.api
                .get({
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
                            query: { pages: { title: string; pageprops: { disambiguation?: string }; redirect?: string }[] };
                        } | null,
                    ) => {
                        if (result)
                            deferred.resolve(
                                result.query?.pages
                                    ? result.query.pages
                                          .filter((page) => page.title !== this.pageTitleParsed.getPrefixedText())
                                          .map((page) => ({
                                              data: page.title,
                                              label: new OO.ui.HtmlSnippet(
                                                  `${page.title}${page.pageprops && 'disambiguation' in page.pageprops ? ' <i>(disambiguation)</i>' : ''}${'redirect' in page ? ' <i>(redirect)</i>' : ''}`,
                                              ),
                                          }))
                                    : [],
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
