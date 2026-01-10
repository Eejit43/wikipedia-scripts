import type { ApiQueryAllPagesGeneratorParameters, CategoriesResult } from '@/global-types';
import { api } from '@/utility';
import type { LookupElementConfig } from '@scripts/redirect-helper/redirect-target-input-widget';

/**
 * An instance of this class is a category lookup element.
 */
export default class CategoryInputWidget extends OO.ui.TextInputWidget {
    public validCategories = new Set<string>();

    constructor(config: LookupElementConfig) {
        super(config);

        OO.ui.mixin.LookupElement.call(this as unknown as OO.ui.mixin.LookupElement, config);
    }

    getLookupRequest = () => {
        const value = this.getValue().split('|')[0];
        const deferred = $.Deferred();

        if (!value) deferred.resolve([]);

        const sortKey = this.getValue().split('|')[1];

        if (sortKey && this.validCategories.has(value)) {
            const response = [{ data: `${value}|${sortKey}`, label: `${value} (with sort key "${sortKey}")` }];

            deferred.resolve(response);

            this.emit('showing-values', response);
        }

        const parsedTitle = mw.Title.newFromText(value);

        api.get({
            action: 'query',
            formatversion: '2',
            gaplimit: 20,
            gapnamespace: 14,
            gapprefix: parsedTitle?.getMainText() ?? value,
            generator: 'allpages',
            prop: 'categories',
        } satisfies ApiQueryAllPagesGeneratorParameters)
            .catch(() => null)
            .then((result: CategoriesResult | null) => {
                if (result?.query?.pages) {
                    const pages = result.query.pages
                        .filter(
                            (page) =>
                                !page.categories?.some((category) => category.title === 'Category:Wikipedia soft redirected categories'),
                        )
                        .map((page) => {
                            const titleWithoutNamespace = page.title.split(':')[1];

                            this.validCategories.add(titleWithoutNamespace);

                            return { data: titleWithoutNamespace, label: titleWithoutNamespace };
                        });

                    this.emit('showing-values', pages);

                    deferred.resolve(pages);
                } else deferred.resolve([]);
            });

        return deferred.promise({ abort() {} }); // eslint-disable-line @typescript-eslint/no-empty-function
    };

    getLookupCacheDataFromResponse = <T>(response: T[] | null | undefined) => response ?? [];

    getLookupMenuOptionsFromData = (data: { data: string; label: string }[]) =>
        data.map(({ data, label }) => new OO.ui.MenuOptionWidget({ data, label }));
}

Object.assign(CategoryInputWidget.prototype, OO.ui.mixin.LookupElement.prototype);
