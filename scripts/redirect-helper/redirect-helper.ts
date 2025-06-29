import type { ApiQueryInfoParams } from 'types-mediawiki/api_params';
import type { PageInfoResult } from '../../global-types';
import cssContent from '../../styles/redirect-helper.css' with { type: 'css' };
import { api, getPageContent } from '../../utility';
import type { WatchMethod } from '../afcrc-helper/afcrc-helper';
import type { RedirectTemplateData } from './redirect-helper-dialog';

declare global {
    interface Window {
        redirectHelperConfiguration?: { createdWatchMethod?: WatchMethod };
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
    const { default: RedirectHelperDialog } = await import('./redirect-helper-dialog'); // eslint-disable-line @typescript-eslint/naming-convention

    /**
     * An instance of this class handles the entire functionality of the redirect-helper script.
     */
    class RedirectHelper {
        private redirectTemplates!: RedirectTemplateData;
        private contentText!: HTMLDivElement;
        private pageTitle!: string;
        private pageTitleParsed!: mw.Title;
        private createdWatchMethod!: WatchMethod;

        /**
         * Runs the redirect helper.
         */
        async run() {
            if (!this.passesPreChecks()) return;

            this.redirectTemplates = await this.fetchRedirectTemplates();

            const contentText = document.querySelector<HTMLDivElement>('#mw-content-text');
            if (!contentText) return mw.notify('redirect-helper: Failed to find content text element!', { type: 'error' });

            this.contentText = contentText;

            this.pageTitle = mw.config.get('wgPageName');

            const pageTitleParsed = mw.Title.newFromText(this.pageTitle);
            if (!pageTitleParsed) return mw.notify('redirect-helper: Failed to parse page title!', { type: 'error' });

            this.pageTitleParsed = pageTitleParsed;

            const configCreatedWatchMethod = window.redirectHelperConfiguration?.createdWatchMethod;

            this.createdWatchMethod =
                configCreatedWatchMethod && ['nochange', 'preferences', 'unwatch', 'watch'].includes(configCreatedWatchMethod)
                    ? configCreatedWatchMethod
                    : 'preferences';

            await this.checkPageAndLoad();
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
            return JSON.parse((await getPageContent('User:Eejit43/scripts/redirect-helper.json')) ?? '{}') as RedirectTemplateData;
        }

        /**
         * Checks a page's status and loads the helper appropriately.
         */
        private async checkPageAndLoad() {
            mw.util.addCSS(cssContent);

            const pageInfo = (await api.get({
                action: 'query',
                formatversion: '2',
                prop: 'info',
                titles: this.pageTitle,
            } satisfies ApiQueryInfoParams)) as PageInfoResult;

            const dialogInfo = {
                redirectTemplates: this.redirectTemplates,
                contentText: this.contentText,
                pageTitle: this.pageTitle,
                pageTitleParsed: this.pageTitleParsed,
            };

            if (pageInfo.query!.pages[0].missing) {
                const button = new OO.ui.ButtonWidget({
                    id: 'create-redirect-button',
                    label: 'Create redirect',
                    icon: 'articleRedirect',
                    flags: ['progressive'],
                });
                button.on('click', () => {
                    button.$element[0].remove();
                    void new RedirectHelperDialog(dialogInfo, false, this.createdWatchMethod).load();
                });

                this.contentText.prepend(button.$element[0]);
            } else if (pageInfo.query!.pages[0].redirect) void new RedirectHelperDialog(dialogInfo, true, this.createdWatchMethod).load();
            else {
                const portletLink = mw.util.addPortletLink(
                    mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions',
                    '#',
                    'Redirect page',
                    'redirect-helper',
                )!;
                portletLink.addEventListener('click', (event) => {
                    event.preventDefault();

                    void new RedirectHelperDialog(dialogInfo, false, this.createdWatchMethod).load();

                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    portletLink.remove();
                });
            }
        }
    }

    void new RedirectHelper().run();
});
