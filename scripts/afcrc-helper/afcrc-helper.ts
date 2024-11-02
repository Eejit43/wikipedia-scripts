import AfcrcHelperDialog from './afcrc-helper-dialog';

export type WatchMethod = 'nochange' | 'preferences' | 'unwatch' | 'watch';

declare global {
    interface Window {
        afcrcConfiguration?: { createdPageWatchMethod?: WatchMethod };
    }
}

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui-windows'], () => {
    const pageName = mw.config.get('wgPageName').replaceAll('_', ' ');

    const isRedirectRequestPage = pageName === 'Wikipedia:Articles for creation/Redirects';
    const isCategoryRequestPage = pageName === 'Wikipedia:Articles for creation/Categories';

    if (!isRedirectRequestPage && !isCategoryRequestPage) return;

    const requestPageType = isRedirectRequestPage ? 'redirect' : 'category';

    const link = mw.util.addPortletLink(
        mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions',
        '#',
        `Handle ${requestPageType} creation requests`,
        'afcrc-helper',
    )!;

    link.addEventListener('click', (event) => {
        event.preventDefault();

        const windowManager = new OO.ui.WindowManager();
        document.body.append(windowManager.$element[0]);

        const afcrcHelperDialog = new AfcrcHelperDialog(requestPageType, pageName, window.afcrcConfiguration?.createdPageWatchMethod);

        windowManager.addWindows([afcrcHelperDialog]);

        afcrcHelperDialog.open();
        afcrcHelperDialog.load();
    });
});
