import cssContent from '@styles/afcrc-helper.css' with { type: 'css' };

export type WatchMethod = 'nochange' | 'preferences' | 'unwatch' | 'watch';

const ALLOWED_USER_GROUPS = new Set(['extendedconfirmed', 'sysop']);

declare global {
    interface Window {
        afcrcConfiguration?: { createdPageWatchMethod?: WatchMethod };
    }
}

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui-windows'], async () => {
    const { default: RedirectsDialog } = await import('@scripts/afcrc-helper/redirects-dialog'); // eslint-disable-line @typescript-eslint/naming-convention
    const { default: CategoriesDialog } = await import('@scripts/afcrc-helper/categories-dialog'); // eslint-disable-line @typescript-eslint/naming-convention

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

        if (!mw.config.get('wgUserGroups')?.some((group) => ALLOWED_USER_GROUPS.has(group))) {
            const messageContainer = document.createElement('span');

            const extendedConfirmedLink = document.createElement('a');
            extendedConfirmedLink.href = mw.util.getUrl('Wikipedia:Extended confirmed');
            extendedConfirmedLink.target = '_blank';
            extendedConfirmedLink.textContent = 'extended confirmed';

            const documentationLink = document.createElement('a');
            documentationLink.href = mw.util.getUrl('User:Eejit43/scripts/afcrc-helper');
            documentationLink.target = '_blank';
            documentationLink.textContent = 'script documentation';

            messageContainer.append(
                'Error: afcrc-helper requires ',
                extendedConfirmedLink,
                ' permissions to use. For more information see the ',
                documentationLink,
                '.',
            );

            mw.notification.notify(messageContainer, { type: 'error', autoHideSeconds: 'long' });

            return;
        }

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
