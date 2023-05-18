/* global mw */

mw.loader.using(['mediawiki.util'], async () => {
    if (!mw.Title.isTalkNamespace(mw.config.get('wgNamespaceNumber'))) return;
    const mainPageInfo = await new mw.Api().get({ action: 'query', prop: 'info|revisions', formatversion: 2, titles: `${mw.config.get('wgFormattedNamespaces')[mw.config.get('wgNamespaceNumber') - 1]}:${mw.config.get('wgTitle')}`, rvprop: 'content', rvslots: '*' });
    if (!mainPageInfo.query.pages[0].redirect) return;

    mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Sync with main page redirect', 'sync-redirect');

    document.getElementById('sync-redirect').addEventListener('click', async (event) => {
        event.preventDefault();

        mw.notify('Editing...', { tag: 'sync-redirect-notification' });

        const mainPageContent = mainPageInfo.query.pages[0].revisions[0].slots.main.content;
        const redirectTarget = new DOMParser().parseFromString(/#REDIRECT:? *\[\[(.+)\]\]/i.exec(mainPageContent)[1].replaceAll('_', ' ').split('|')[0].split('#')[0].trim(), 'text/html').documentElement.textContent;
        const mainTargetText = mw.Title.newFromText(redirectTarget)?.getMainText();
        if (!mainTargetText) return mw.notify('Failed to redirect page: Invalid redirect target', { type: 'error', tag: 'sync-redirect-notification' });
        const pageMove = /{{ *r(edirect)?( from)?(( a)? page)? (move|rename|pm) *}}/i.test(mainPageContent);

        const destinationTalkNamespaceName = mw.config.get('wgFormattedNamespaces')[mw.Title.newFromText(redirectTarget).getNamespaceId() + 1];
        try {
            await new mw.Api().edit(mw.config.get('wgPageName'), () => ({ text: `#REDIRECT [[${destinationTalkNamespaceName}:${mainTargetText}]]${pageMove ? '\n\n{{Redirect category shell|\n{{R from move}}\n}}' : ''}`, summary: `Sync redirect with main page, to [[${destinationTalkNamespaceName}:${mainTargetText}]] (via [[User:Eejit43/scripts/sync-redirect|script]])`, minor: true }));
        } catch (error) {
            try {
                if (error === 'nocreate-missing') await new mw.Api().create(mw.config.get('wgPageName'), { summary: `Create redirect matching main page, to [[${destinationTalkNamespaceName}:${mainTargetText}]] (via [[User:Eejit43/scripts/sync-redirect|script]])` }, `#REDIRECT [[${destinationTalkNamespaceName}:${mainTargetText}]]${pageMove ? '\n\n{{Redirect category shell|\n{{R from move}}\n}}' : ''}`);
                else throw error;
            } catch (error) {
                console.error(error); // eslint-disable-line no-console
                mw.notify(`Failed to redirect page: ${error}`, { type: 'error', tag: 'sync-redirect-notification' });
                return;
            }
        }

        mw.notify('Successfully redirected page, reloading...', { type: 'success', tag: 'sync-redirect-notification' });

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('redirect', 'no');

        window.location.href = newUrl.href;
    });
});
