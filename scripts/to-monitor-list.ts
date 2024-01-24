import { BacklinksResult, EmbeddedinResult, MediaWikiDataError, PageRevisionsResult, SearchResult } from '../global-types';

interface SearchData {
    categories: { id: string; category: string; namespace?: string; notNamespace?: string }[];
    searches: { id: string; search: string; namespace?: string; notNamespace?: string }[];
    whatLinksHere: { id: string; title: string; namespace?: string; notNamespace?: string }[];
    transclusions: { id: string; title: string; namespace?: string; notNamespace?: string }[];
}

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgPageName') !== 'User:Eejit43') return;

    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Add counts to monitoring list', 'add-monitoring-counts')!;

    link.addEventListener('click', async (event) => {
        event.preventDefault();

        const toCheck = JSON.parse(
            (
                (await new mw.Api().get({
                    action: 'query',
                    formatversion: 2,
                    prop: 'revisions',
                    rvprop: 'content',
                    rvslots: '*',
                    titles: 'User:Eejit43/scripts/to-monitor-list.json',
                })) as PageRevisionsResult
            ).query.pages[0].revisions[0].slots.main.content,
        ) as SearchData;

        // eslint-disable-next-line unicorn/no-array-for-each
        toCheck.categories.forEach(async (check) => {
            const data: SearchResult | null = await new mw.Api()
                .get({
                    action: 'query',
                    list: 'search',
                    srinfo: 'totalhits',
                    srnamespace: getCategory(check),
                    srsearch: `incategory:"${check.category}"`,
                })
                .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                    mw.notify(`An error occurred while trying to get category members: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                    return null;
                });

            if (!data) return;

            const count = (data as SearchResult).query.searchinfo.totalhits;

            const element = document.querySelector(`#to-monitor-list-${check.id}`);
            if (!element) return mw.notify(`Failed to find element for ID "${check.id}"`);
            element.innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        });

        // eslint-disable-next-line unicorn/no-array-for-each
        toCheck.searches.forEach(async (check) => {
            const data: SearchResult | null = await new mw.Api()
                .get({
                    action: 'query',
                    list: 'search',
                    srinfo: 'totalhits',
                    srnamespace: getCategory(check),
                    srsearch: check.search,
                })
                .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                    mw.notify(`An error occurred while trying to get search results: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                    return null;
                });

            if (!data) return;

            const count = (data as SearchResult).query.searchinfo.totalhits;

            const element = document.querySelector(`#to-monitor-list-${check.id}`);
            if (!element) return mw.notify(`Failed to find element for ID "${check.id}"`);
            element.innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count.toLocaleString()}</span></b>`;
        });

        // eslint-disable-next-line unicorn/no-array-for-each
        toCheck.whatLinksHere.forEach(async (check) => {
            const data: BacklinksResult | null = await new mw.Api()
                .get({
                    action: 'query',
                    bllimit: 500,
                    blnamespace: getCategory(check),
                    bltitle: check.title,
                    list: 'backlinks',
                })
                .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                    mw.notify(`An error occurred while trying to get backlinks: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                    return null;
                });

            if (!data) return;

            const count = (data as BacklinksResult).query.backlinks.length;

            const element = document.querySelector(`#to-monitor-list-${check.id}`);
            if (!element) return mw.notify(`Failed to find element for ID "${check.id}"`);
            element.innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        });

        // eslint-disable-next-line unicorn/no-array-for-each
        toCheck.transclusions.forEach(async (check) => {
            const data: EmbeddedinResult | null = await new mw.Api()
                .get({
                    action: 'query',
                    eilimit: 500,
                    einamespace: getCategory(check),
                    eititle: check.title,
                    list: 'embeddedin',
                })
                .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                    mw.notify(`An error occurred while trying to get transclusions: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                    return null;
                });

            if (!data) return;

            const count = (data as EmbeddedinResult).query.embeddedin.length;

            const element = document.querySelector(`#to-monitor-list-${check.id}`);
            if (!element) return mw.notify(`Failed to find element for ID "${check.id}"`);
            element.innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        });

        mw.notify('Successfully added missing counts to "Stuff to monitor"', { type: 'success' });
    });
});

/**
 * Parses the searched categories from the check object.
 * @param check The check object.
 * @param check.namespace The namespace to search in.
 * @param check.notNamespace The namespace to exclude from the search.
 * @returns The category ID or list of category IDs (separated by '|').
 */
function getCategory({ namespace, notNamespace }: { namespace?: string; notNamespace?: string }): number | string {
    if (!namespace && !notNamespace) return 0;
    else if (namespace) return Object.entries(mw.config.get('wgFormattedNamespaces')).find(([, value]) => value === namespace)?.[0] ?? 0;
    else
        return Object.entries(mw.config.get('wgFormattedNamespaces'))
            .filter(([, value]) => notNamespace !== (value || 'Article'))
            .map(([key]) => key)
            .join('|');
}
