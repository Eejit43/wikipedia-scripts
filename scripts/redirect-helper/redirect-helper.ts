import { getPageContent } from '@/utility';
import type { WatchMethod } from '@scripts/afcrc-helper/afcrc-helper';
import type { RedirectTemplateData } from '@scripts/redirect-helper/redirect-helper-dialog';
import cssContent from '@styles/redirect-helper.css' with { type: 'css' };

export interface RedirectHelperConfig {
    createdWatchMethod: WatchMethod;
    patrolByDefault: boolean;
}

declare global {
    interface Window {
        redirectHelperConfiguration?: Partial<RedirectHelperConfig>;
    }
}

const dependencies = [
    'mediawiki.util',
    'oojs-ui-core',
    'oojs-ui-widgets',
    'oojs-ui-windows',
    'oojs-ui.styles.icons-content',
    'oojs-ui.styles.icons-editing-core',
];

mw.loader.using(dependencies, async () => {
    const { default: RedirectHelperDialog } = await import('@scripts/redirect-helper/redirect-helper-dialog'); // eslint-disable-line @typescript-eslint/naming-convention
    const { default: RedirectPageHereDialog } = await import('@scripts/redirect-helper/redirect-page-here-dialog'); // eslint-disable-line @typescript-eslint/naming-convention

    /**
     * An instance of this class handles the entire functionality of the redirect-helper script.
     */
    class RedirectHelper {
        private redirectTemplates!: RedirectTemplateData;
        private contentText!: HTMLDivElement;
        private pageTitle!: string;
        private pageTitleParsed!: mw.Title;
        private config!: RedirectHelperConfig;

        private isOnEnwiki = mw.config.get('wgDBname') === 'enwiki';
        private isMissing = mw.config.get('wgArticleId') === 0;
        private isRedirect = mw.config.get('wgIsRedirect');

        /**
         * Runs the redirect helper.
         */
        async run() {
            this.pageTitle = mw.config.get('wgPageName');

            const pageTitleParsed = mw.Title.newFromText(this.pageTitle);
            if (!pageTitleParsed) return mw.notify('redirect-helper: Failed to parse page title!', { type: 'error' });

            this.pageTitleParsed = pageTitleParsed;

            if (!this.passesPreChecks()) {
                this.loadRedirectPageHere();

                return;
            }

            this.redirectTemplates = await this.fetchRedirectTemplates();

            const contentText = document.querySelector<HTMLDivElement>('#mw-content-text');
            if (!contentText) return mw.notify('redirect-helper: Failed to find content text element!', { type: 'error' });

            this.contentText = contentText;

            const configOverrides = window.redirectHelperConfiguration;

            const createdWatchMethod =
                configOverrides?.createdWatchMethod &&
                ['nochange', 'preferences', 'unwatch', 'watch'].includes(configOverrides.createdWatchMethod)
                    ? configOverrides.createdWatchMethod
                    : 'preferences';

            const patrolByDefault = !(configOverrides && 'patrolByDefault' in configOverrides && configOverrides.patrolByDefault === false);

            this.config = { createdWatchMethod, patrolByDefault };

            this.checkPageAndLoad();
        }

        /**
         * Checks if the page passes pre checks.
         */
        private passesPreChecks() {
            const conditions = [
                mw.config.get('wgNamespaceNumber') >= 0, // Is not virtual namespace
                mw.config.get('wgIsProbablyEditable'), // Page is editable
                mw.config.get('wgAction') === 'view' || mw.config.get('wgAction') === 'edit', // Viewing or editing the page
                (mw.config.get('wgRevisionId') || mw.config.get('wgCurRevisionId')) === mw.config.get('wgCurRevisionId'), // Viewing the current revision
                !mw.config.get('wgDiffOldId'), // Not viewing a diff
            ];

            return conditions.every(Boolean);
        }

        /**
         * Fetches the redirect templates.
         */
        private async fetchRedirectTemplates() {
            if (!this.isOnEnwiki) return {};

            return JSON.parse((await getPageContent('User:Eejit43/scripts/redirect-helper.json')) ?? '{}') as RedirectTemplateData;
        }

        /**
         * Checks a page's status and loads the helper appropriately.
         */
        private checkPageAndLoad() {
            mw.util.addCSS(cssContent);

            const dialogInfo = {
                redirectTemplates: this.redirectTemplates,
                contentText: this.contentText,
                pageTitle: this.pageTitle,
                pageTitleParsed: this.pageTitleParsed,
            };

            let hasLoaded = false;

            const redirectHelperTarget = new URLSearchParams(window.location.search).get('redirectHelperTarget');
            if (redirectHelperTarget) {
                const parsedTarget = mw.Title.newFromText(redirectHelperTarget);
                if (parsedTarget) {
                    void new RedirectHelperDialog(
                        { ...dialogInfo, defaultRedirectTarget: parsedTarget.getPrefixedText() },
                        !this.isMissing,
                        this.config,
                        this.isOnEnwiki,
                    ).load();
                    hasLoaded = true;
                } else mw.notify('redirect-helper: Invalid redirect target specified in URL.', { type: 'error' });
            }

            if (!hasLoaded)
                if (this.isMissing) {
                    const button = new OO.ui.ButtonWidget({
                        id: 'create-redirect-button',
                        label: 'Create redirect',
                        icon: 'articleRedirect',
                        flags: ['progressive'],
                    });
                    button.on('click', () => {
                        button.$element[0].remove();
                        void new RedirectHelperDialog(dialogInfo, false, this.config, this.isOnEnwiki).load();
                    });

                    this.contentText.prepend(button.$element[0]);
                } else if (this.isRedirect) void new RedirectHelperDialog(dialogInfo, true, this.config, this.isOnEnwiki).load();
                else {
                    const redirectHelperPortletLink = mw.util.addPortletLink(
                        mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions',
                        '#',
                        'Redirect page',
                        'redirect-helper',
                    )!;
                    redirectHelperPortletLink.addEventListener('click', (event) => {
                        event.preventDefault();

                        void new RedirectHelperDialog(dialogInfo, false, this.config, this.isOnEnwiki).load();

                        window.scrollTo({ top: 0, behavior: 'smooth' });

                        redirectHelperPortletLink.remove();
                    });
                }

            this.loadRedirectPageHere();
        }

        /**
         * Loads the "Redirect page here" functionality, if not on a redirect.
         */
        private loadRedirectPageHere() {
            if (!this.isMissing && !this.isRedirect) {
                const redirectPageHerePortletLink = mw.util.addPortletLink(
                    mw.config.get('skin') === 'minerva' ? 'p-cactions' : 'p-cactions',
                    '#',
                    'Redirect page here',
                    'redirect-page-here',
                )!;
                redirectPageHerePortletLink.addEventListener('click', (event) => {
                    event.preventDefault();

                    const windowManager = new OO.ui.WindowManager();
                    document.body.append(windowManager.$element[0]);

                    const dialog = new RedirectPageHereDialog(this.pageTitleParsed);
                    windowManager.addWindows([dialog]);

                    dialog.open();
                });
            }
        }
    }

    void new RedirectHelper().run();
});
