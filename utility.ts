import type { ApiQueryAllMessagesParams, ApiQueryRevisionsParams } from 'types-mediawiki-api';
import type { AllMessagesResult, PageRevisionsResult } from './global-types';

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

/**
 * Gets a system message.
 * @param messageName The name of the system message.
 */
export async function getSystemMessage(messageName: string) {
    return (
        (await api.get({
            action: 'query',
            meta: 'allmessages',
            ammessages: messageName,
            amlang: mw.config.get('wgContentLanguage'),
        } satisfies ApiQueryAllMessagesParams)) as AllMessagesResult
    ).query?.allmessages[0].content;
}

/**
 * Interpolates a system message with values.
 * @param message The system message to interpolate.
 * @param values The values to interpolate into the message.
 */
export function interpolateSystemMessage(message: string, values: string[]) {
    let result = message;

    for (const [index, value] of values.entries()) result = result.replaceAll(`$${index + 1}`, value);

    return result;
}
