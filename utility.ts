import 'types-mediawiki';
import type { ApiQueryRevisionsParams } from 'types-mediawiki-api';
import type { PageRevisionsResult } from './global-types';

export const api = new mw.Api();

/**
 * Fetches the content of a given page.
 * @param title The title to fetch.
 */
export async function getPageContent(title: string) {
    return (
        (await api.get({
            action: 'query',
            formatversion: '2',
            prop: 'revisions',
            rvprop: 'content',
            rvslots: 'main',
            titles: title,
        } satisfies ApiQueryRevisionsParams)) as PageRevisionsResult
    ).query.pages[0].revisions?.[0].slots.main.content.trim();
}
