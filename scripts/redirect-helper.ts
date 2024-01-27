import { ApiParseParams } from 'types-mediawiki/api_params';
import { AllPagesGeneratorResult, MediaWikiDataError, PageInfoResult, PageParseResult, PageRevisionsResult, PageTriageListResponse, PagepropsResult, UserPermissionsResponse } from '../global-types';

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui-windows', 'oojs-ui.styles.icons-content', 'oojs-ui.styles.icons-editing-core'], () => {
    // Setup RedirectInputWidget
    interface RedirectInputWidgetConfig extends OO.ui.TextInputWidget.ConfigOptions, OO.ui.mixin.LookupElement.ConfigOptions {}

    /**
     * An instance of this class is a title lookup element.
     */
    class RedirectInputWidget extends OO.ui.TextInputWidget {
        private pageTitleParsed: mw.Title;

        constructor(config: RedirectInputWidgetConfig, pageTitleParsed: mw.Title) {
            super(config);
            OO.ui.mixin.LookupElement.call(this as unknown as OO.ui.mixin.LookupElement, config);

            this.pageTitleParsed = pageTitleParsed;
        }

        getLookupRequest = () => {
            const value = this.getValue();
            const deferred = $.Deferred();

            if (!value) deferred.resolve([]);
            else if (value.includes('#')) {
                const title = value.split('#')[0];

                new mw.Api()
                    .get({ action: 'parse', page: title, prop: 'sections', redirects: '1' })
                    .catch(() => null)
                    .then((result: PageParseResult | null) => {
                        if (result) {
                            const matchedSections = result.parse.sections.filter((section) => section.line.toLowerCase().startsWith(value.split('#')[1].toLowerCase()));
                            deferred.resolve(matchedSections.map((section) => ({ data: `${result.parse.title}#${section.line}`, label: `${result.parse.title}#${section.line}` })));
                        } else deferred.resolve([]);
                    });
            } else {
                const parsedTitle = mw.Title.newFromText(value);
                new mw.Api()
                    .get({
                        action: 'query',
                        formatversion: 2,
                        gaplimit: 20,
                        gapnamespace: parsedTitle?.getNamespaceId() ?? 0,
                        gapprefix: parsedTitle?.getMainText() ?? value,
                        generator: 'allpages',
                        prop: 'info|pageprops',
                    })
                    .catch(() => null)
                    .then((result: AllPagesGeneratorResult | null) => {
                        if (result)
                            deferred.resolve(
                                result.query?.pages //
                                    ? result.query.pages //
                                          .filter((page) => page.title !== this.pageTitleParsed.toString())
                                          .map((page) => ({
                                              data: page.title,
                                              label: new OO.ui.HtmlSnippet(
                                                  `${page.title}${page.pageprops && 'disambiguation' in page.pageprops ? ' <i>(disambiguation)</i>' : ''}${'redirect' in page ? ' <i>(redirect)</i>' : ''}`,
                                              ),
                                          }))
                                    : [],
                            );
                        else deferred.resolve([]);
                    });
            }

            return deferred.promise({ abort() {} }); // eslint-disable-line @typescript-eslint/no-empty-function
        };

        getLookupCacheDataFromResponse = <T>(response: T[] | null | undefined) => response ?? [];

        getLookupMenuOptionsFromData = (data: { data: string; label: string }[]) => data.map(({ data, label }) => new OO.ui.MenuOptionWidget({ data, label }));
    }

    Object.assign(RedirectInputWidget.prototype, OO.ui.mixin.LookupElement.prototype);

    // Setup TemplatePreviewDialog

    /**
     * An instance of this class is a dialog used for previewing templates.
     */
    class TemplatePreviewDialog extends OO.ui.ProcessDialog {
        private pageTitleParsed: mw.Title;

        constructor(config: OO.ui.ProcessDialog.ConfigOptions, pageTitleParsed: mw.Title) {
            super(config);

            this.pageTitleParsed = pageTitleParsed;

            TemplatePreviewDialog.static.name = 'TemplatePreviewDialog';
            TemplatePreviewDialog.static.title = 'Redirect categorization templates preview';
            TemplatePreviewDialog.static.actions = [{ action: 'cancel', label: 'Close', flags: ['safe', 'close'] }];
        }

        getSetupProcess() {
            return TemplatePreviewDialog.super.prototype.getSetupProcess.call(this).next(() => {
                const postConfig: ApiParseParams & Record<string, string> = {
                    action: 'parse',
                    formatversion: '2',
                    contentmodel: 'wikitext',
                    title: this.pageTitleParsed.getPrefixedDb(),
                    text: `{{Redirect category shell|${(this.getData() as string[]).map((tag) => `{{${tag}}}`).join('')}}}`,
                };

                return new mw.Api().post(postConfig).then((result) => {
                    const content = (result as { parse: { text: string } }).parse.text;

                    const panelLayout = new OO.ui.PanelLayout({ padded: true, expanded: false });
                    panelLayout.$element.append(content);

                    (this as unknown as { $body: JQuery }).$body.append(panelLayout.$element);
                });
            });
        }

        getActionProcess(action: string) {
            return action
                ? new OO.ui.Process(() => {
                      this.getManager().closeWindow(this);
                  })
                : TemplatePreviewDialog.super.prototype.getActionProcess.call(this, action);
        }
    }

    Object.assign(TemplatePreviewDialog.prototype, OO.ui.ProcessDialog.prototype);

    // Overwrite TemplatePreviewDialog.prototype.getTeardownProcess as it always gets overwritten by the above Object.assign call
    TemplatePreviewDialog.prototype.getTeardownProcess = function () {
        return TemplatePreviewDialog.super.prototype.getTeardownProcess.call(this).next(() => {
            (this as unknown as { $body: JQuery }).$body.empty();
        });
    };

    /**
     * An instance of this class handles the entire functionality of the redirect-helper script.
     */
    class RedirectHelper {
        private redirectTemplates!: Record<string, string[]>;
        private contentText!: HTMLDivElement;
        private pageTitle!: string;
        private pageTitleParsed!: mw.Title;

        /**
         * Runs the redirect helper.
         */
        async run() {
            if (!this.passesPreChecks()) return;

            this.redirectTemplates = await this.fetchRedirectTemplates();

            this.contentText = document.querySelector('#mw-content-text') as HTMLDivElement;
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
                    (await new mw.Api().get({
                        action: 'query',
                        formatversion: 2,
                        prop: 'revisions',
                        rvprop: 'content',
                        rvslots: '*',
                        titles: 'User:Eejit43/scripts/redirect-helper.json',
                    })) as PageRevisionsResult
                ).query.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '{}',
            ) as Record<string, string[]>;
        }

        /**
         * Checks a page's status and loads the helper appropriately.
         */
        private async checkPageAndLoad() {
            const pageInfo = (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'info', titles: this.pageTitle })) as PageInfoResult;

            const dialogInfo = { redirectTemplates: this.redirectTemplates, contentText: this.contentText, pageTitle: this.pageTitle, pageTitleParsed: this.pageTitleParsed };

            if (pageInfo.query.pages[0].missing) {
                const button = new OO.ui.ButtonWidget({ id: 'create-redirect-button', label: 'Create redirect', icon: 'articleRedirect', flags: ['progressive'] });
                button.on('click', () => {
                    button.$element[0].remove();
                    new RedirectHelperDialog(dialogInfo, false).load();
                });

                this.contentText.prepend(button.$element[0]);
            } else if (pageInfo.query.pages[0].redirect) new RedirectHelperDialog(dialogInfo, true).load();
            else {
                const portletLink = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Redirect page', 'redirect-helper')!;
                portletLink.addEventListener('click', (event) => {
                    event.preventDefault();

                    new RedirectHelperDialog(dialogInfo, false).load();

                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    portletLink.remove();
                });
            }
        }
    }

    /**
     * An instance of this class handles the dialog portion of redirect-helper script.
     */
    class RedirectHelperDialog {
        // Created in constructor
        private redirectTemplates: Record<string, string[]>;
        private contentText: HTMLDivElement;
        private pageTitle: string;
        private pageTitleParsed: mw.Title;

        private exists: boolean;

        // Used during run()
        private needsCheck = true;

        private editorBox!: OO.ui.PanelLayout;
        private syncWithMainButton?: OO.ui.ButtonWidget;
        private redirectInput!: RedirectInputWidget;
        private redirectInputLayout!: OO.ui.FieldLayout;
        private tagSelect!: OO.ui.MenuTagMultiselectWidget;
        private tagSelectLayout!: OO.ui.FieldLayout;
        private summaryInput!: OO.ui.ComboBoxInputWidget;
        private summaryInputLayout!: OO.ui.FieldLayout;
        private submitButton!: OO.ui.ButtonWidget;
        private previewButton!: OO.ui.ButtonWidget;
        private syncTalkCheckbox?: OO.ui.CheckboxInputWidget;
        private syncTalkCheckboxLayout?: OO.ui.Widget;
        private patrolCheckbox?: OO.ui.CheckboxInputWidget;
        private patrolCheckboxLayout?: OO.ui.Widget;
        private submitLayout!: OO.ui.HorizontalLayout;

        private talkData?: PageInfoResult;

        private oldRedirectTarget?: string;
        private oldRedirectTags?: string[];
        private oldRedirectTagData?: Record<string, string>;
        private oldStrayText?: string;

        private parsedDestination!: mw.Title | null;

        constructor(
            { redirectTemplates, contentText, pageTitle, pageTitleParsed }: { redirectTemplates: Record<string, string[]>; contentText: HTMLDivElement; pageTitle: string; pageTitleParsed: mw.Title },
            exists: boolean,
        ) {
            this.redirectTemplates = redirectTemplates;
            this.contentText = contentText;
            this.pageTitle = pageTitle;
            this.pageTitleParsed = pageTitleParsed;

            this.exists = exists;
        }

        /**
         * Loads the redirect-helper dialog into the page.
         */
        async load() {
            mw.util.addCSS(`
#create-redirect-button {
    margin-bottom: 20px;
}

#redirect-helper-box {
    background-color: whitesmoke;
    width: 700px;
    max-width: calc(100% - 50px);
    margin-left: auto;
    margin-right: auto;
    margin-bottom: 20px;
}

#submit-layout {
    margin-top: 10px;
}

#submit-layout > * {
    margin-bottom: 0;
}

.redirect-helper-warning {
    margin-top: 8px;
}`);

            /* Load elements */
            this.editorBox = new OO.ui.PanelLayout({ id: 'redirect-helper-box', padded: true, expanded: false, framed: true });

            if (this.pageTitleParsed.isTalkPage()) {
                const mainPageData = (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'info', titles: this.pageTitleParsed.getSubjectPage()!.getPrefixedText() })) as PageInfoResult;

                if (mainPageData.query.pages[0].redirect) this.loadSyncWithMainButton();
            }

            this.loadInputElements();
            await this.loadSubmitElements();

            /* Add elements to screen and load data (if applicable) */
            this.editorBox.$element[0].append(
                ...([
                    this.syncWithMainButton?.$element?.[0],
                    this.redirectInputLayout.$element[0],
                    this.tagSelectLayout.$element[0],
                    this.summaryInputLayout.$element[0],
                    this.submitLayout.$element[0],
                ].filter(Boolean) as HTMLElement[]),
            );

            this.contentText.prepend(this.editorBox.$element[0]);

            if (this.exists) this.loadExistingData();
        }

        private async loadSyncWithMainButton() {
            const mainPageContent = (
                (await new mw.Api().get({
                    action: 'query',
                    formatversion: 2,
                    prop: 'revisions',
                    rvprop: 'content',
                    rvslots: '*',
                    titles: this.pageTitleParsed.getSubjectPage()!.getPrefixedText(),
                })) as PageRevisionsResult
            ).query.pages[0].revisions[0].slots.main.content.trim();
            this.syncWithMainButton = new OO.ui.ButtonWidget({ label: 'Sync with main page', icon: 'link', flags: ['progressive'] });
            this.syncWithMainButton.on('click', () => {
                const target = /^#redirect:?\s*\[\[\s*([^[\]{|}]+?)\s*(?:\|[^[\]{|}]+?)?]]\s*/i.exec(mainPageContent)?.[1];
                if (!target) return mw.notify('Failed to parse main page content!', { type: 'error' });

                this.redirectInput.setValue(mw.Title.newFromText(target)?.getTalkPage()?.toString() ?? '');
                const fromMove = ['R from move', ...this.redirectTemplates['R from move']].some((tagOrRedirect) =>
                    new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`).test(mainPageContent),
                );
                if (fromMove) this.tagSelect.setValue(['R from move']);
            });
        }

        /**
         * Loads the input elements.
         */
        private loadInputElements() {
            /* Redirect target input */
            this.redirectInput = new RedirectInputWidget({ placeholder: 'Target page name', required: true }, this.pageTitleParsed);
            this.redirectInput.on('change', () => {
                let value = this.redirectInput.getValue();
                value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
                value = value.replace(/^:/, '');

                if (value.length > 0) {
                    this.redirectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll('_', ' '));
                    this.submitButton.setDisabled(false);
                } else this.submitButton.setDisabled(true);

                this.updateSummary();
                this.submitButton.setLabel('Submit');
                this.needsCheck = true;
            });

            this.redirectInputLayout = new OO.ui.FieldLayout(this.redirectInput, { label: new OO.ui.HtmlSnippet('<b>Redirect target:</b>'), align: 'top' });

            /* Redirect categorization template selection */
            this.tagSelect = new OO.ui.MenuTagMultiselectWidget({
                allowArbitrary: false,
                allowReordering: false,
                options: Object.keys(this.redirectTemplates).map((tag) => ({ data: tag, label: tag })),
            });
            (this.tagSelect.getMenu() as OO.ui.MenuSelectWidget.ConfigOptions).filterMode = 'substring';
            this.tagSelect.on('change', () => {
                const sortedTags = (this.tagSelect.getValue() as string[]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

                if ((this.tagSelect.getValue() as string[]).join(';') !== sortedTags.join(';')) this.tagSelect.setValue(sortedTags);

                this.updateSummary();
                this.submitButton.setLabel('Submit');
                this.needsCheck = true;

                if (this.tagSelect.getValue().length > 0) this.previewButton.setDisabled(false);
                else this.previewButton.setDisabled(true);
            });

            this.tagSelectLayout = new OO.ui.FieldLayout(this.tagSelect, { label: new OO.ui.HtmlSnippet('<b>Redirect categorization template(s):</b>'), align: 'top' });

            /* Summary input */
            this.summaryInput = new OO.ui.ComboBoxInputWidget({
                options: [
                    { data: 'Resolve double redirect' }, //
                    { data: 'Resolve self redirect' },
                    { data: 'Remove incorrect rcats' },
                ],
            });

            this.summaryInputLayout = new OO.ui.FieldLayout(this.summaryInput, { label: new OO.ui.HtmlSnippet('<b>Summary:</b>'), align: 'top' });
        }

        /**
         * Loads the elements in the submit button row.
         */
        private async loadSubmitElements() {
            /* Setup submit button */
            this.submitButton = new OO.ui.ButtonWidget({ classes: ['redirect-helper-bottom-element'], label: 'Submit', disabled: true, flags: ['progressive'] });
            this.submitButton.on('click', () => this.handleSubmitButtonClick());

            /* Setup preview button */
            const windowManager = new OO.ui.WindowManager();
            document.body.append(windowManager.$element[0]);

            const templatePreviewDialog = new TemplatePreviewDialog({ size: 'large' }, this.pageTitleParsed);
            windowManager.addWindows([templatePreviewDialog]);

            this.previewButton = new OO.ui.ButtonWidget({ classes: ['redirect-helper-bottom-element'], label: 'Preview templates', disabled: true });
            this.previewButton.on('click', () => {
                templatePreviewDialog.setData(this.tagSelect.getValue());
                templatePreviewDialog.open();
            });

            /* Setup sync talk checkbox */
            if (!this.pageTitleParsed.isTalkPage()) {
                this.talkData = (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'info', titles: this.pageTitleParsed.getTalkPage()!.getPrefixedText() })) as PageInfoResult;
                this.syncTalkCheckbox = new OO.ui.CheckboxInputWidget({ selected: !!this.talkData.query.pages[0].redirect });

                this.syncTalkCheckboxLayout = new OO.ui.Widget({
                    classes: ['redirect-helper-bottom-element'],
                    content: [new OO.ui.FieldLayout(this.syncTalkCheckbox, { label: 'Sync talk page', align: 'inline' })],
                });
            }

            /* Setup patrol checkbox */
            if (await this.checkShouldPromptPatrol()) {
                this.patrolCheckbox = new OO.ui.CheckboxInputWidget({ selected: true });

                this.patrolCheckboxLayout = new OO.ui.Widget({
                    classes: ['redirect-helper-bottom-element'],
                    content: [new OO.ui.FieldLayout(this.patrolCheckbox, { label: 'Mark as patrolled', align: 'inline' })],
                });
            }

            /* Setup layout */
            this.submitLayout = new OO.ui.HorizontalLayout({
                id: 'submit-layout',
                items: [this.submitButton, this.previewButton, this.syncTalkCheckboxLayout, this.patrolCheckboxLayout].filter(Boolean) as OO.ui.Widget[],
            });
        }

        /**
         * Determines if the user should be prompted to patrol the page.
         */
        private async checkShouldPromptPatrol() {
            const pageTriageMarkButton = document.querySelector('#mwe-pt-mark .mwe-pt-tool-icon') as HTMLImageElement | null;
            pageTriageMarkButton?.click();
            pageTriageMarkButton?.click();

            if (mw.config.get('wgNamespaceNumber') !== 0) return false;
            else if (document.querySelector('.patrollink')) return true;
            else if (document.querySelector('#mwe-pt-mark-as-reviewed-button')) return true;
            else if (document.querySelector('#mwe-pt-mark-as-unreviewed-button')) return false;
            else {
                if (!mw.config.get('wgArticleId')) return false;
                const userPermissions = (await new mw.Api().get({ action: 'query', meta: 'userinfo', uiprop: 'rights' })) as UserPermissionsResponse;
                if (!userPermissions.query.userinfo.rights.includes('patrol')) return false;

                const patrolResponse = (await new mw.Api().get({ action: 'pagetriagelist', page_id: mw.config.get('wgArticleId') })) as PageTriageListResponse; // eslint-disable-line @typescript-eslint/naming-convention

                if (patrolResponse.pagetriagelist.pages[0]?.user_name === mw.config.get('wgUserName')) return false;
                else if (patrolResponse.pagetriagelist.result !== 'success' || patrolResponse.pagetriagelist.pages.length === 0) return false;
                else return !Number.parseInt(patrolResponse.pagetriagelist.pages[0]?.patrol_status);
            }
        }

        /**
         * Updates the summary input placeholder.
         */
        private updateSummary() {
            const redirectValue = this.redirectInput.getValue().trim();

            if (!redirectValue) (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = '';
            else if (this.exists) {
                const targetChanged = redirectValue !== this.oldRedirectTarget?.replaceAll('_', ' ');
                const tagsChanged = this.tagSelect.getValue().join(';') !== this.oldRedirectTags?.join(';');

                if (targetChanged && tagsChanged) (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = `Retarget redirect to [[${redirectValue}]] and change categorization templates`;
                else if (targetChanged) (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = `Retarget redirect to [[${redirectValue}]]`;
                else if (tagsChanged) (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = 'Change categorization templates';
                else (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = 'Perform redirect cleanup';
            } else (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = `Create redirect to [[${redirectValue}]]`;
        }

        /**
         * Loads existing page target, tags, and stray text.
         */
        private async loadExistingData() {
            const pageContent = (
                (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'revisions', rvprop: 'content', rvslots: '*', titles: this.pageTitle })) as PageRevisionsResult
            ).query.pages[0].revisions[0].slots.main.content.trim();

            this.oldRedirectTarget = /^#redirect:?\s*\[\[\s*([^[\]{|}]+?)\s*(?:\|[^[\]{|}]+?)?]]\s*/i.exec(pageContent)?.[1];
            this.oldRedirectTags = (
                Object.entries(this.redirectTemplates)
                    .map(([tag, redirects]) =>
                        [tag, ...redirects].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`).test(pageContent))
                            ? tag
                            : null,
                    )
                    .filter(Boolean) as string[]
            ).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            const originalRedirectTags = Object.entries(this.redirectTemplates)
                .flatMap(([tag, redirects]) => [tag, ...redirects])
                .map((tagOrRedirect) => (new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`).test(pageContent) ? tagOrRedirect : null))
                .filter(Boolean) as string[];

            this.oldRedirectTagData = Object.fromEntries(
                originalRedirectTags
                    .map((tag) => {
                        const match = new RegExp(`{{\\s*[${tag[0].toLowerCase()}${tag[0]}]${tag.slice(1)}\\|?(.*?)\\s*}}`).exec(pageContent);

                        const newTag = Object.entries(this.redirectTemplates).find(([template, redirects]) => [template, ...redirects].includes(tag))?.[0];

                        return match ? [newTag, match[1]] : null;
                    })
                    .filter(Boolean) as [string, string][],
            );

            this.oldStrayText = [
                pageContent.match(/{{short description\|.*?}}/i)?.[0],
                pageContent.match(/{{DISPLAYTITLE:.*?}}/)?.[0],
                pageContent.match(/{{italic title\|?.*?}}/i)?.[0],
                pageContent.match(/{{DEFAULTSORT:.*?}}/)?.[0],
                pageContent.match(/{{title language\|.*?}}/)?.[0],
                ...(pageContent.match(/\[\[[Cc]ategory:.+?]]/g) ?? []),
            ]
                .filter(Boolean)
                .join('\n');

            if (this.oldRedirectTarget) this.redirectInput.setValue(this.oldRedirectTarget.replaceAll('_', ' '));
            else mw.notify('Could not find redirect target!', { type: 'error' });
            this.tagSelect.setValue(this.oldRedirectTags);

            this.updateSummary();
        }

        private async validateSubmission() {
            const errors = [];

            const destination = this.redirectInput.getValue().trim();

            /* Invalid characters */
            if (!/^\s*[^[\]{|}]+\s*$/.test(destination)) errors.push({ title: destination, message: 'is not a valid page title!' });

            /* Failed during title parsing */
            try {
                this.parsedDestination = mw.Title.newFromText(destination);
            } catch {
                if (errors.length === 0) errors.push({ title: destination, message: 'is not a valid page title!' });
            }
            if (!this.parsedDestination && errors.length === 0) errors.push({ title: destination, message: 'is not a valid page title!' });

            /* Self redirects */
            if (this.parsedDestination?.toString() === this.pageTitleParsed.toString()) errors.push({ message: 'cannot redirect to itself!' });

            const destinationData = (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'pageprops', titles: destination }).catch((errorCode: string) => {
                /* Nonexistent destination */ if (errorCode === 'missingtitle') errors.push({ title: destination, message: 'does not exist!' });
                /* Other API error */ else errors.push({ title: destination, message: `was not able to be fetched from the API (${errorCode})!` });
                return null;
            })) as PagepropsResult | null;
            const destinationParseResult = (await new mw.Api().get({ action: 'parse', page: destination, prop: 'sections', redirects: '1' })) as PageParseResult;

            /* Double redirects */
            if (destinationParseResult.parse.redirects?.[0]) {
                const destinationRedirect =
                    destinationParseResult.parse.redirects[0].to + (destinationParseResult.parse.redirects[0].tofragment ? `#${destinationParseResult.parse.redirects[0].tofragment}` : '');
                errors.push({
                    title: destination,
                    message: `is a redirect to <a href="${mw.util.getUrl(
                        destinationRedirect,
                    )}" target="_blank">${destinationRedirect}</a>. Retarget to that page instead, as double redirects aren't allowed.`,
                });
            }

            /* Nonexistent section */
            if (destination.split('#').length > 1) {
                const validSection = destinationParseResult.parse.sections.find((section) => section.line === destination.split('#')[1]);
                if (validSection) {
                    if (this.tagSelect.getValue().includes('R to anchor')) errors.push({ message: 'is tagged as a redirect to an anchor, but it is actually a redirect to a section!' });
                    if (!this.tagSelect.getValue().includes('R to section')) errors.push({ message: 'is a redirect to a section, but it is not tagged with <code>{{R to section}}</code>!' });
                } else {
                    const destinationContent = (
                        (await new mw.Api().get({
                            action: 'query',
                            formatversion: 2,
                            prop: 'revisions',
                            rvprop: 'content',
                            rvslots: '*',
                            titles: this.parsedDestination!.toString(),
                        })) as PageRevisionsResult
                    ).query.pages[0].revisions[0].slots.main.content;

                    const anchors = [
                        ...(destinationContent
                            .match(/(?<={{\s*?[Aa](?:nchors?|nchor for redirect|nker|NCHOR|nc)\s*?\|).+?(?=}})/g)
                            ?.map((anchor: string) => anchor.split('|').map((part) => part.trim()))
                            ?.flat() ?? []),
                        ...(destinationContent
                            .match(/(?<={{\s*?(?:[Vv](?:isible anchors?|isanc|Anch|anchor|isibleanchor|a)|[Aa](?:nchord|chored|nchor\+)|[Tt]ext anchor)\s*?\|).+?(?=(?<!!|=)}})/g)
                            ?.map((anchor: string) =>
                                anchor
                                    .split('|')
                                    .map((part) => part.trim())
                                    .filter((part) => !/^text\s*?=/.test(part)),
                            )
                            ?.flat() ?? []),
                        ...(destinationContent.match(/(?<=id=)"?.+?(?="|>|\|)/g)?.map((anchor: string) => anchor.trim()) ?? []),
                    ];
                    if (anchors.includes(destination.split('#')[1])) {
                        if (this.tagSelect.getValue().includes('R to section')) errors.push({ message: 'is tagged as a redirect to a section, but it is actually a redirect to an anchor!' });
                        if (!this.tagSelect.getValue().includes('R to anchor')) errors.push({ message: 'is a redirect to an anchor, but it is not tagged with <code>{{R from anchor}}</code>!' });
                    } else errors.push({ message: `is a redirect to <a href="${mw.util.getUrl(destination)}" target="_blank">${destination}</a>, but that section or anchor does not exist!` });
                }
            }

            /* Improperly tagged as redirect to section/anchor */
            if (destination.split('#').length === 1 && (this.tagSelect.getValue().includes('R to section') || this.tagSelect.getValue().includes('R to anchor')))
                errors.push({ message: 'is not a redirect to a section/anchor, but it is tagged with <code>{{R from section}}</code> or <code>{{R from anchor}}</code>!' });

            /* Redirect to disambiguation page without template */
            if (
                destinationData!.query.pages[0].pageprops &&
                'disambiguation' in destinationData!.query.pages[0].pageprops &&
                ![
                    'R from ambiguous sort name',
                    'R from ambiguous term',
                    'R to disambiguation page',
                    'R from incomplete disambiguation',
                    'R from incorrect disambiguation',
                    'R from other disambiguation',
                ].some((template) => this.tagSelect.getValue().includes(template))
            )
                errors.push({ message: 'is a redirect to a disambiguation page, but it is not tagged with a disambiguation categorization template!' });

            /* Improperly tagged as redirect to disambiguation page */
            if (
                destinationData!.query.pages[0].pageprops &&
                !('disambiguation' in destinationData!.query.pages[0].pageprops) &&
                ['R from ambiguous sort name', 'R from ambiguous term', 'R to disambiguation page', 'R from incomplete disambiguation'].some((template) => this.tagSelect.getValue().includes(template))
            )
                errors.push({ message: 'is not a redirect to a disambiguation page, but it is tagged with a disambiguation categorization template!' });

            /* {{R to disambiguation page}} without " (disambiguation)" at end of title */
            if (this.tagSelect.getValue().includes('R to disambiguation page') && !this.pageTitleParsed.getMainText().endsWith(' (disambiguation)'))
                errors.push({
                    message:
                        'is tagged with <code>{{R to disambiguation page}}</code>, but this title does not end with " (disambiguation)". Use <code>{{R from ambiguous term}}</code> or a similar categorization template instead!',
                });

            /* Tagged with a protection template */
            for (const template of ['R semi-protected', 'R extended-protected', 'R template-protected', 'R fully protected'])
                if (this.tagSelect.getValue().includes(template))
                    errors.push({ message: `is tagged with unnecessarily tagged with <code>{{${template}}}</code> which will be duplicated by the redirect category shell!` });

            /* Syncing talk page but talk page exists and isn't a redirect */
            if (this.syncTalkCheckbox?.isSelected() && !this.talkData!.query.pages[0].missing && !this.talkData!.query.pages[0].redirect)
                errors.push({ title: this.pageTitleParsed.getTalkPage()!.getPrefixedText(), message: 'exists, but is not a redirect!' });

            return errors;
        }

        private async handleSubmitButtonClick() {
            for (const element of [this.redirectInput, this.tagSelect, this.summaryInput, this.submitButton, this.previewButton, this.syncTalkCheckbox, this.patrolCheckbox].filter(Boolean))
                (element as OO.ui.Widget).setDisabled(true);
            this.submitButton.setLabel('Checking target validity...');

            let errors: Awaited<ReturnType<typeof this.validateSubmission>> = [];
            if (this.needsCheck) errors = await this.validateSubmission();
            else this.parsedDestination = mw.Title.newFromText(this.redirectInput.getValue());

            if (errors.length > 0) {
                for (const element of document.querySelectorAll('.redirect-helper-warning')) element.remove();
                for (const { title, message } of errors) {
                    const label = new OO.ui.HtmlSnippet(
                        `${title ? `<a href="${mw.util.getUrl(title)}" target="_blank">${title}</a>` : 'This page'} ${message} Click again without making changes to submit anyway.`,
                    );
                    const warningMessage = new OO.ui.MessageWidget({ type: 'error', classes: ['redirect-helper-warning'], inline: true, label });

                    this.editorBox.$element[0].append(warningMessage.$element[0]);
                }

                for (const element of [this.redirectInput, this.tagSelect, this.summaryInput, this.submitButton, this.syncTalkCheckbox, this.patrolCheckbox].filter(Boolean))
                    (element as OO.ui.Widget).setDisabled(false);

                if (this.tagSelect.getValue().length > 0) this.previewButton.setDisabled(false);

                this.submitButton.setLabel('Submit anyway');
                this.needsCheck = false;

                return;
            }

            /* Edit/create redirect */
            this.submitButton.setLabel(`${this.exists ? 'Editing' : 'Creating'} redirect...`);

            const output = [
                `#REDIRECT [[${this.redirectInput.getValue().trim()}]]`, //
                this.tagSelect.getValue().length > 0
                    ? `{{Redirect category shell|\n${(this.tagSelect.getValue() as string[]).map((tag) => `{{${tag}${this.oldRedirectTagData?.[tag] ? `|${this.oldRedirectTagData[tag]}` : ''}}}`).join('\n')}\n}}`
                    : null,
                this.oldStrayText,
            ]
                .filter(Boolean)
                .join('\n\n');

            const summary = (this.summaryInput.getValue() || (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder) + ' (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])';

            const result = await new mw.Api()
                .edit(this.pageTitle, () => ({ text: output, summary }))
                .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                    if (errorCode === 'nocreate-missing')
                        return new mw.Api().create(this.pageTitle, { summary }, output).catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                            mw.notify(`Error creating ${this.pageTitle}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                        });
                    else {
                        mw.notify(`Error editing or creating ${this.pageTitle}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                        return null;
                    }
                });

            if (!result) return;

            mw.notify(`Redirect ${this.exists ? 'edited' : 'created'} successfully!`, { type: 'success' });

            /* Sync talk page checkbox handler */
            if (this.syncTalkCheckbox?.isSelected()) {
                this.submitButton.setLabel('Editing talk page...');

                const fromMove = this.tagSelect.getValue().includes('R from move');

                const output = [
                    `#REDIRECT [[${this.parsedDestination!.getTalkPage()!.getPrefixedText()}]]`, //
                    fromMove ? '{{Redirect category shell|\n{{R from move}}\n}}' : null,
                ]
                    .filter(Boolean)
                    .join('\n\n');

                const talkPage = this.pageTitleParsed.getTalkPage()!.getPrefixedText();

                const talkResult = await new mw.Api()
                    .edit(talkPage, () => ({ text: output, summary: 'Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])' }))
                    .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                        if (errorCode === 'nocreate-missing')
                            return new mw.Api()
                                .create(talkPage, { summary: 'Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])' }, output)
                                .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                                    mw.notify(`Error creating ${talkPage}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                                });
                        else {
                            mw.notify(`Error editing or creating ${talkPage}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                            return null;
                        }
                    });

                if (!talkResult) return;

                mw.notify('Talk page synced successfully!', { type: 'success' });
            }

            /* Patrol checkbox handler */
            if (this.patrolCheckbox?.isSelected()) {
                this.submitButton.setLabel('Patrolling redirect...');

                const patrolLink: HTMLAnchorElement | null = document.querySelector('.patrollink a');
                const markReviewedButton = document.querySelector('#mwe-pt-mark-as-reviewed-button') as HTMLButtonElement | null;

                if (patrolLink) {
                    const patrolResult = await new mw.Api()
                        .postWithToken('patrol', { action: 'patrol', rcid: new URL(patrolLink.href).searchParams.get('rcid')! })
                        .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                            mw.notify(`Error patrolling ${this.pageTitle} via API: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                            return null;
                        });
                    if (patrolResult) mw.notify('Redirect patrolled successfully!', { type: 'success' });
                } else if (markReviewedButton) {
                    markReviewedButton.click();
                    mw.notify('Redirect patrolled successfully!', { type: 'success' });
                } else mw.notify('Page curation toolbar not found, redirect cannot be patrolled!', { type: 'error' });
            }

            this.submitButton.setLabel('Complete, reloading...');

            window.location.href = mw.util.getUrl(this.pageTitle, { redirect: 'no' });
        }
    }

    new RedirectHelper().run();
});
