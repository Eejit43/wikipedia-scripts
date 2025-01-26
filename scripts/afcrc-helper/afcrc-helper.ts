import cssContent from '../../styles/afcrc-helper.css' with { type: 'css' };

export type WatchMethod = 'nochange' | 'preferences' | 'unwatch' | 'watch';

declare global {
    interface Window {
        afcrcConfiguration?: { createdPageWatchMethod?: WatchMethod };
    }
}

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui-windows'], async () => {
    const { default: RedirectsDialog } = await import('./redirects-dialog'); // eslint-disable-line @typescript-eslint/naming-convention
    const { default: CategoriesDialog } = await import('./categories-dialog'); // eslint-disable-line @typescript-eslint/naming-convention

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

        mw.util.addCSS(cssContent);

        const windowManager = new OO.ui.WindowManager();
        document.body.append(windowManager.$element[0]);

        const helper = requestPageType === 'redirect' ? RedirectsDialog : CategoriesDialog;

        const afcrcHelperDialog = new helper(requestPageType, pageName, window.afcrcConfiguration?.createdPageWatchMethod);

        windowManager.addWindows([afcrcHelperDialog]);

        afcrcHelperDialog.open();
        void afcrcHelperDialog.load();
    });
});
