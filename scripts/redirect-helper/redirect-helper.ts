import type { ApiQueryInfoParams, ApiQueryRevisionsParams } from 'types-mediawiki/api_params';
import type { PageInfoResult, PageRevisionsResult } from '../../global-types';
import RedirectHelperDialog, { type RedirectTemplateData } from './redirect-helper-dialog';

const dependencies = [
    'mediawiki.util',
    'oojs-ui-core',
    'oojs-ui-widgets',
    'oojs-ui-windows',
    'oojs-ui.styles.icons-content',
    'oojs-ui.styles.icons-editing-core',
];

mw.loader.using(dependencies, () => {
    /**
     * An instance of this class handles the entire functionality of the redirect-helper script.
     */
    class RedirectHelper {
        // Utility variables
        private api = new mw.Api();

        // Assigned in constructor
        private redirectTemplates!: RedirectTemplateData;
        private contentText!: HTMLDivElement;
        private pageTitle!: string;
        private pageTitleParsed!: mw.Title;

        /**
         * Runs the redirect helper.
         */
        async run() {
            if (!this.passesPreChecks()) return;

            this.redirectTemplates = await this.fetchRedirectTemplates();

            this.contentText = document.querySelector<HTMLDivElement>('#mw-content-text')!;
            if (!this.contentText) return mw.notify('redirect-helper: Failed to find content text element!', { type: 'error' });

            this.pageTitle = mw.config.get('wgPageName');

            this.pageTitleParsed = mw.Title.newFromText(this.pageTitle)!;
            if (!this.pageTitleParsed) return mw.notify('redirect-helper: Failed to parse page title!', { type: 'error' });

            await this.checkPageAndLoad();
        }

        /**
         * Checks if the page passes pre checks.
         */
        private passesPreChecks() {
            const conditions = [
                mw.config.get('wgNamespaceNumber') >= 0, // Is not virtual namespace
                mw.config.get('wgIsProbablyEditable'), // Page is editable
                mw.config.get('wgIsArticle'), // Viewing the content of a page
                mw.config.get('wgAction') === 'view', // Viewing the page (not editing)
                mw.config.get('wgRevisionId') === mw.config.get('wgCurRevisionId'), // Viewing the current revision
                !mw.config.get('wgDiffOldId'), // Not viewing a diff
            ];

            return conditions.every(Boolean);
        }

        /**
         * Fetches the redirect templates.
         */
        private async fetchRedirectTemplates() {
            return JSON.parse(
                (
                    (await this.api.get({
                        action: 'query',
                        formatversion: '2',
                        prop: 'revisions',
                        rvprop: 'content',
                        rvslots: 'main',
                        titles: 'User:Eejit43/scripts/redirect-helper.json',
                    } satisfies ApiQueryRevisionsParams)) as PageRevisionsResult
                ).query.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '{}',
            ) as RedirectTemplateData;
        }

        /**
         * Checks a page's status and loads the helper appropriately.
         */
        private async checkPageAndLoad() {
            const pageInfo = (await this.api.get({
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

            if (pageInfo.query.pages[0].missing) {
                mw.util.addCSS(`
#create-redirect-button {
    margin-bottom: 20px;
}`);

                const button = new OO.ui.ButtonWidget({
                    id: 'create-redirect-button',
                    label: 'Create redirect',
                    icon: 'articleRedirect',
                    flags: ['progressive'],
                });
                button.on('click', () => {
                    button.$element[0].remove();
                    new RedirectHelperDialog(dialogInfo, false).load();
                });

                this.contentText.prepend(button.$element[0]);
            } else if (pageInfo.query.pages[0].redirect) new RedirectHelperDialog(dialogInfo, true).load();
            else {
                const portletLink = mw.util.addPortletLink(
                    mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions',
                    '#',
                    'Redirect page',
                    'redirect-helper',
                )!;
                portletLink.addEventListener('click', (event) => {
                    event.preventDefault();

                    new RedirectHelperDialog(dialogInfo, false).load();

                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    portletLink.remove();
                });
            }
        }
    }

    new RedirectHelper().run();
});
