/* global mw */

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgNamespaceNumber') !== mw.config.get('wgNamespaceIds').talk) return;

    /* Setup "Mark as disambiguation talk page" */
    mw.util.addPortletLink('p-cactions', '#', 'Mark as disambiguation talk page', 'mark-disambiguation');

    document.getElementById('mark-disambiguation').addEventListener('click', (event) => {
        event.preventDefault();
        new mw.Api().edit(mw.config.get('wgPageName'), () => ({ text: '{{WikiProject Disambiguation}}', summary: 'Mark as disambiguation talk page' }));

        mw.notify('Successfully marked as disambiguation, reloading...', { type: 'success' });

        window.location.reload();
    });

    /* Setup "Blank pending speedy deletion" */
    if (!mw.config.get('wgCategories').includes('Articles with talk page redirects')) return;

    mw.util.addPortletLink('p-cactions', '#', 'Blank pending speedy deletion', 'blank-pending-speedy');

    document.getElementById('blank-pending-speedy').addEventListener('click', (event) => {
        event.preventDefault();
        new mw.Api().edit(mw.config.get('wgPageName'), () => ({ text: '', summary: 'Blanked page, main page pending speedy deletion' }));

        mw.notify('Successfully blanked page, reloading...', { type: 'success' });

        window.location.reload();
    });
});
