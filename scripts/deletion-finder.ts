import { api } from '@/utility';
import cssContent from '@styles/deletion-finder.css' with { type: 'css' };
import type { ApiQueryLogEventsParams, ApiQueryParams } from 'types-mediawiki-api';

mw.loader.using(['mediawiki.util'], async () => {
    if (
        mw.config.get('wgNamespaceNumber') !== 0 || // Only run in the main namespace
        mw.config.get('wgAction') !== 'view' || // Only run when viewing the page
        mw.config.get('wgPageName') === 'Main_Page' // Don't run on the main page
    )
        return;

    mw.util.addCSS(cssContent);

    const titleElement = document.querySelector('#firstHeading');

    if (!titleElement) return mw.notify('deletion-finder: Could not find title element!', { type: 'error' });

    const deletionResult = (await api.get({
        action: 'query',
        leaction: 'delete/delete',
        lelimit: 1,
        letitle: mw.config.get('wgPageName'),
        list: 'logevents',
    } satisfies ApiQueryLogEventsParams)) as { query: { logevents: unknown[] } };

    if (deletionResult.query.logevents.length > 0) {
        const link = document.createElement('a');
        link.id = 'deletion-finder-previously-deleted';
        link.classList.add('deletion-finder-link');
        link.href = mw.util.getUrl('Special:Log/delete', { page: mw.config.get('wgPageName').replaceAll('_', ' '), subtype: 'delete' });
        link.target = '_blank';
        link.textContent = 'Previously deleted';

        titleElement.append(link);
    }

    const afdExists = (await api.get({
        action: 'query',
        formatversion: '2',
        titles: `Wikipedia:Articles_for_deletion/${mw.config.get('wgPageName')}`,
    } satisfies ApiQueryParams)) as {
        query: { pages: { missing?: true }[] };
    };

    // eslint-disable-next-line unicorn/prefer-early-return
    if (!afdExists.query.pages[0].missing) {
        const link = document.createElement('a');
        link.id = 'deletion-finder-previous-afd';
        link.classList.add('deletion-finder-link');
        link.href = mw.util.getUrl('Special:AllPages', {
            from: `Articles for deletion/${mw.config.get('wgPageName').replaceAll('_', ' ')}`,
            to: `Articles for deletion/${mw.config.get('wgPageName').replaceAll('_', ' ')} (9z)`,
            namespace: '4',
        });
        link.target = '_blank';
        link.textContent = 'Previously at AfD';

        titleElement.append(link);
    }
});
