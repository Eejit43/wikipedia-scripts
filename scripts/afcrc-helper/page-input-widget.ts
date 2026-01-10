import type { ApiQueryAllPagesGeneratorParameters } from '@/global-types';
import { api } from '@/utility';
import type { LookupElementConfig } from '@scripts/redirect-helper/redirect-target-input-widget';

/**
 * An instance of this class is a page lookup element.
 */
export default class PageInputWidget extends OO.ui.TextInputWidget {
    constructor(config: LookupElementConfig) {
        super(config);
        OO.ui.mixin.LookupElement.call(this as unknown as OO.ui.mixin.LookupElement, config);
    }

    getLookupRequest = () => {
        const value = this.getValue();
        const deferred = $.Deferred();

        if (!value) deferred.resolve([]);

        const parsedTitle = mw.Title.newFromText(value);

        api.get({
            action: 'query',
            formatversion: '2',
            gaplimit: 20,
            gapnamespace: parsedTitle?.getNamespaceId() ?? 0,
            gapprefix: parsedTitle?.getMainText() ?? value,
            generator: 'allpages',
        } satisfies ApiQueryAllPagesGeneratorParameters)
            .catch(() => null)
            .then((result: { query?: { pages: { title: string }[] } } | null) => {
                if (result?.query?.pages) {
                    const pages = result.query.pages.map((page) => ({ data: page.title, label: page.title }));

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

Object.assign(PageInputWidget.prototype, OO.ui.mixin.LookupElement.prototype);
