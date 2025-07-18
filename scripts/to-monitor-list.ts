import type { ApiQueryBacklinksParams, ApiQuerySearchParams } from 'types-mediawiki/api_params';
import type { BacklinksResult, EmbeddedinResult, MediaWikiDataError, SearchResult } from '../global-types';
import { api, getPageContent } from '../utility';

interface SearchData {
    categories: { id: string; category: string; namespaces?: string[]; notNamespaces?: string[] }[];
    searches: { id: string; search: string; namespaces?: string[]; notNamespaces?: string[] }[];
    whatLinksHere: { id: string; title: string; namespaces?: string[]; notNamespaces?: string[] }[];
    transclusions: { id: string; title: string; namespaces?: string[]; notNamespaces?: string[] }[];
}

type SearchDataCheck = SearchData[keyof SearchData][0];

/**
 * An instance of this class handles the entire functionality of the to-monitor-list script.
 */
class MonitoringListManager {
    private link!: HTMLAnchorElement;

    private toCheck!: SearchData;
    private totalToCheck!: number;

    private isRunning = false;

    private handledRequests = 0;

    /**
     * Loads the "Add missing counts" link element.
     */
    public load() {
        mw.util.addCSS(`
.to-monitor-list-count {
    cursor: pointer;
}`);

        const fullLinkElement = document.querySelector('.mw-editsection')!.cloneNode(true) as HTMLSpanElement;

        this.link = document.createElement('a');
        this.link.href = '#';
        this.link.style.fontWeight = 'bold';
        this.link.textContent = 'Add missing counts';
        this.link.addEventListener('click', async (event) => {
            event.preventDefault();

            if (this.isRunning) return;
            this.isRunning = true;

            for (const element of document.querySelectorAll('.to-monitor-list-count'))
                if (element.id) element.innerHTML = '<span style="color: #ed8e07; font-weight: bold">?</span>';

            await this.loadToCheckData();

            for (const check of this.toCheck.categories)
                void this.handleCheck(check, async () => {
                    const data = (await api
                        .get({
                            action: 'query',
                            list: 'search',
                            srinfo: 'totalhits',
                            srnamespace: this.getCategory(check),
                            srsearch: `incategory:"${check.category}"`,
                        } satisfies ApiQuerySearchParams)
                        .catch((errorCode, errorInfo) => {
                            mw.notify(
                                `An error occurred while trying to get category members: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                                { type: 'error' },
                            );
                            return null;
                        })) as SearchResult | null;
                    if (!data) return;

                    return data.query!.searchinfo.totalhits;
                });

            for (const check of this.toCheck.searches)
                void this.handleCheck(check, async () => {
                    const data = (await api
                        .get({
                            action: 'query',
                            list: 'search',
                            srinfo: 'totalhits',
                            srnamespace: this.getCategory(check),
                            srsearch: check.search,
                        } satisfies ApiQuerySearchParams)
                        .catch((errorCode, errorInfo) => {
                            mw.notify(
                                `An error occurred while trying to get search results: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                                { type: 'error' },
                            );
                            return null;
                        })) as SearchResult | null;
                    if (!data) return;

                    return data.query!.searchinfo.totalhits;
                });

            for (const check of this.toCheck.whatLinksHere)
                void this.handleCheck(check, async () => {
                    const data = (await api
                        .get({
                            action: 'query',
                            list: 'backlinks',
                            bllimit: 500,
                            blnamespace: this.getCategory(check),
                            bltitle: check.title,
                        } satisfies ApiQueryBacklinksParams)
                        .catch((errorCode, errorInfo) => {
                            mw.notify(
                                `An error occurred while trying to get backlinks: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                                { type: 'error' },
                            );
                            return null;
                        })) as BacklinksResult | null;
                    if (!data) return;

                    return data.query!.backlinks.length;
                });

            for (const check of this.toCheck.transclusions)
                void this.handleCheck(check, async () => {
                    const data = (await api
                        .get({
                            action: 'query',
                            list: 'embeddedin',
                            eilimit: 500,
                            einamespace: this.getCategory(check),
                            eititle: check.title,
                        } satisfies ApiQueryBacklinksParams)
                        .catch((errorCode, errorInfo) => {
                            mw.notify(
                                `An error occurred while trying to get transclusions: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                                { type: 'error' },
                            );
                            return null;
                        })) as EmbeddedinResult | null;
                    if (!data) return;

                    return data.query!.embeddedin.length;
                });
        });

        fullLinkElement.querySelector('a')!.replaceWith(this.link);

        document.querySelector('h2#Stuff_to_monitor + .mw-editsection')!.after(fullLinkElement);

        for (const element of document.querySelectorAll('.to-monitor-list-count'))
            element.addEventListener('click', () => {
                element.innerHTML = '<span style="color: #00733f">None</span>';
            });
    }

    /**
     * Loads the data of checks to handle.
     */
    public async loadToCheckData() {
        this.toCheck = JSON.parse((await getPageContent('User:Eejit43/scripts/to-monitor-list.json')) ?? '{}') as SearchData;

        this.totalToCheck = Object.values(this.toCheck).flat().length;
    }

    /**
     * Handles a given check.
     * @param check The check data to handle.
     * @param handler The handler to find the count from a check.
     */
    private async handleCheck(check: SearchDataCheck, handler: () => Promise<number | undefined>) {
        const count = await handler();
        if (count === undefined) return;

        const element = document.querySelector(`#to-monitor-list-${check.id}`);
        if (!element) return mw.notify(`Failed to find element for ID "${check.id}"`);
        element.innerHTML =
            count === 0
                ? '<span style="color: #00733f">None</span>'
                : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;

        this.handledRequests++;
        this.link.textContent = `Add missing counts (${this.handledRequests}/${this.totalToCheck} loaded)`;

        if (this.handledRequests === this.totalToCheck)
            setTimeout(() => {
                this.isRunning = false;

                this.handledRequests = 0;
                this.link.textContent = 'Add missing counts';
            }, 1000);
    }

    /**
     * Parses the searched categories from the check object.
     * @param check The check object.
     * @param check.namespaces The namespace to search in.
     * @param check.notNamespaces The namespaces to exclude from the search.
     * @returns The category ID or array of category IDs.
     */
    private getCategory({ namespaces, notNamespaces }: { namespaces?: string[]; notNamespaces?: string[] }) {
        if (!namespaces && !notNamespaces) return 0;
        else if (namespaces) {
            const foundNamespaces = namespaces
                .map((namespace) =>
                    Object.entries(mw.config.get('wgFormattedNamespaces')).find(([, namespaceName]) => namespaceName === namespace),
                )
                .filter(Boolean) as [string, string][];

            return foundNamespaces.length > 0 ? foundNamespaces.map((foundNamespace) => Number.parseInt(foundNamespace[0])) : 0;
        } else
            return Object.entries(mw.config.get('wgFormattedNamespaces'))
                .filter(([, namespaceName]) => !notNamespaces!.includes(namespaceName || 'Article'))
                .map(([namespaceId]) => Number.parseInt(namespaceId));
    }
}

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgPageName') === 'User:Eejit43') new MonitoringListManager().load();
});
