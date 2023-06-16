mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page

    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Null edit', 'null-edit');

    link.addEventListener('click', async (event) => {
        event.preventDefault();

        mw.notify('Null editing page...', { tag: 'null-edit-notification' });

        try {
            await new mw.Api().edit(mw.config.get('wgPageName'), (text) => ({ text: text.content, summary: 'Null edit- if you see this, something went wrong!', minor: true }));
        } catch (error) {
            console.error(error);
            return mw.notify('An error occurred when null editing this page!', { type: 'error', tag: 'null-edit-notification' });
        }

        mw.notify('Successfully null edited page, reloading...', { type: 'success', tag: 'null-edit-notification' });

        window.location.reload();
    });
});
