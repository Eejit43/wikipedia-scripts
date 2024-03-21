import { ApiEditPageParams, ApiQueryRevisionsParams } from 'types-mediawiki/api_params';
import { ApiQueryAllPagesGeneratorParams, MediaWikiDataError, PageRevisionsResult } from '../global-types'; // eslint-disable-line unicorn/prevent-abbreviations

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui-windows'], () => {
    const isRedirectRequestPage = mw.config.get('wgPageName') === 'Wikipedia:Articles_for_creation/Redirects';
    const isCategoryRequestPage = mw.config.get('wgPageName') === 'Wikipedia:Articles_for_creation/Categories';

    if (!isRedirectRequestPage && !isCategoryRequestPage) return;

    const requestPageType = isRedirectRequestPage ? 'redirect' : 'category';

    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', `Handle ${requestPageType} creation requests`, 'afcrc-helper')!;

    link.addEventListener('click', (event) => {
        event.preventDefault();

        const windowManager = new OO.ui.WindowManager();
        document.body.append(windowManager.$element[0]);

        const afcrcHelperDialog = new AfcrcHelperDialog(requestPageType, mw.config.get('wgPageName').replaceAll('_', ' '));

        windowManager.addWindows([afcrcHelperDialog]);

        afcrcHelperDialog.open();
        afcrcHelperDialog.load();
    });

    /**
     * An instance of this class is an action dialog.
     */
    class ShowActionsDialog extends OO.ui.Dialog {
        private contentLayout!: OO.ui.PanelLayout;
        private logOutput!: HTMLDivElement;
        private closeButton!: OO.ui.ButtonWidget;

        constructor() {
            super({ size: 'large' });

            ShowActionsDialog.static.name = 'ShowActionsDialog';
            ShowActionsDialog.static.title = 'Actions';
        }

        initialize = () => {
            OO.ui.Dialog.prototype.initialize.apply(this);

            mw.util.addCSS(`
.afcrc-helper-actions-container div {
    margin-block: 8px;
}`);

            this.contentLayout = new OO.ui.PanelLayout({ padded: true, expanded: false });
            (this as unknown as { $body: JQuery }).$body.append(this.contentLayout.$element);

            this.logOutput = document.createElement('div');
            this.logOutput.classList.add('afcrc-helper-actions-container');

            this.closeButton = new OO.ui.ButtonWidget({ label: 'Close', flags: ['safe', 'close'] });
            this.closeButton.on('click', () => this.close());

            this.contentLayout.$element.append(this.logOutput, this.closeButton.$element);

            return this;
        };

        /**
         * Adds a log entry to the dialog.
         * @param message The message to add.
         * @param type The message type.
         */
        public addLogEntry(message: string, type: OO.ui.MessageWidget.Type = 'notice') {
            const messageWidget = new OO.ui.MessageWidget({ type, inline: true, label: message });

            this.logOutput.append(messageWidget.$element[0]);

            this.updateSize();

            this.closeButton.scrollElementIntoView();
        }

        /**
         * Removes the close button and adds a reload button.
         */
        public showReload() {
            this.closeButton.$element.remove();

            const reloadButton = new OO.ui.ButtonWidget({ label: 'Reload', flags: ['primary'] });
            reloadButton.on('click', () => window.location.reload());

            this.contentLayout.$element.append(reloadButton.$element);
        }
    }

    Object.assign(ShowActionsDialog.prototype, OO.ui.Dialog.prototype);

    interface LookupElementConfig extends OO.ui.TextInputWidget.ConfigOptions, OO.ui.mixin.LookupElement.ConfigOptions {}

    /**
     * An instance of this class is a page lookup element.
     */
    class PageInputWidget extends OO.ui.TextInputWidget {
        // Utility variables
        private api = new mw.Api();

        constructor(config: LookupElementConfig) {
            super(config);
            OO.ui.mixin.LookupElement.call(this as unknown as OO.ui.mixin.LookupElement, config);
        }

        getLookupRequest = () => {
            const value = this.getValue();
            const deferred = $.Deferred();

            if (!value) deferred.resolve([]);

            const parsedTitle = mw.Title.newFromText(value);

            this.api
                .get({
                    action: 'query',
                    formatversion: '2',
                    gaplimit: 20,
                    gapnamespace: parsedTitle?.getNamespaceId() ?? 0,
                    gapprefix: parsedTitle?.getMainText() ?? value,
                    generator: 'allpages',
                } satisfies ApiQueryAllPagesGeneratorParams)
                .catch(() => null)
                .then((result: { query: { pages: { title: string }[] } } | null) => {
                    if (result?.query?.pages) {
                        const pages = result.query.pages.map((page) => ({ data: page.title, label: page.title }));

                        this.emit('showing-values', pages);

                        deferred.resolve(pages);
                    } else deferred.resolve([]);
                });

            return deferred.promise({ abort() {} }); // eslint-disable-line @typescript-eslint/no-empty-function
        };

        getLookupCacheDataFromResponse = <T>(response: T[] | null | undefined) => response ?? [];

        getLookupMenuOptionsFromData = (data: { data: string; label: string }[]) => data.map(({ data, label }) => new OO.ui.MenuOptionWidget({ data, label }));
    }

    Object.assign(PageInputWidget.prototype, OO.ui.mixin.LookupElement.prototype);

    /**
     * An instance of this class is a category lookup element.
     */
    class CategoryInputWidget extends OO.ui.TextInputWidget {
        // Utility variables
        private api = new mw.Api();

        constructor(config: LookupElementConfig) {
            super(config);
            OO.ui.mixin.LookupElement.call(this as unknown as OO.ui.mixin.LookupElement, config);
        }

        getLookupRequest = () => {
            const value = this.getValue();
            const deferred = $.Deferred();

            if (!value) deferred.resolve([]);

            const parsedTitle = mw.Title.newFromText(value);

            this.api
                .get({
                    action: 'query',
                    formatversion: '2',
                    gaplimit: 20,
                    gapnamespace: 14,
                    gapprefix: parsedTitle?.getMainText() ?? value,
                    generator: 'allpages',
                    prop: 'categories',
                } satisfies ApiQueryAllPagesGeneratorParams)
                .catch(() => null)
                .then((result: { query: { pages: { title: string; categories?: { title: string }[] }[] } } | null) => {
                    if (result?.query?.pages) {
                        const pages = result.query.pages //
                            .filter((page) => !(page.categories && page.categories.some((category) => category.title === 'Category:Wikipedia soft redirected categories')))
                            .map((page) => {
                                const titleWithoutNamespace = page.title.split(':')[1];

                                return { data: titleWithoutNamespace, label: titleWithoutNamespace };
                            });

                        this.emit('showing-values', pages);

                        deferred.resolve(pages);
                    } else deferred.resolve([]);
                });

            return deferred.promise({ abort() {} }); // eslint-disable-line @typescript-eslint/no-empty-function
        };

        getLookupCacheDataFromResponse = <T>(response: T[] | null | undefined) => response ?? [];

        getLookupMenuOptionsFromData = (data: { data: string; label: string }[]) => data.map(({ data, label }) => new OO.ui.MenuOptionWidget({ data, label }));
    }

    Object.assign(CategoryInputWidget.prototype, OO.ui.mixin.LookupElement.prototype);

    interface RedirectRequestData {
        pages: string[];
        target: string;
        reason: string;
        source: string;
        requester: { type: 'user' | 'ip'; name: string };
    }

    interface CategoryRequestData {
        category: string;
        examples: string[];
        parents: string[];
        requester: { type: 'user' | 'ip'; name: string };
    }

    type ActionType = 'accept' | 'deny' | 'comment' | 'close' | 'none';

    interface Action {
        originalText: { fullSectionText: string; sectionText: string };
        action: ActionType;
        comment?: string;
        denyReason?: string;
        closingReason?: { name: string; id: string };
    }

    type RedirectAction = Action & { redirectTemplates?: string[] };

    type CategoryAction = Action & { category: string; examples: string[]; parents: string[] };

    type RedirectActions = { target: string; requests: Record<string, RedirectAction> }[];

    type CategoryActions = CategoryAction[];

    /**
     * An instance of this class is a dialog that handles redirect and category requests.
     */
    class AfcrcHelperDialog extends OO.ui.ProcessDialog {
        private api = new mw.Api();

        private scriptMessage = ' ([[User:Eejit43/scripts/afcrc-helper|afcrc-helper]])';

        private requestPageType: 'redirect' | 'category';
        private pageTitle!: string;

        private redirectTemplateItems!: { data: string; label: string }[];

        private beforeText!: string;
        private pageContent!: string;

        private parsedRequests: RedirectRequestData[] | CategoryRequestData[] = [];
        private actionsToTake: RedirectActions | CategoryActions = [];
        private editsCreationsToMake: (
            | { type: 'edit'; title: string; transform: (data: { content: string }) => ApiEditPageParams }
            | { type: 'create'; title: string; text: string; summary: string }
        )[] = [];

        constructor(requestPageType: 'redirect' | 'category', pageTitle: string) {
            super({ size: 'large' });

            AfcrcHelperDialog.static.name = 'AfcrcHelperDialog';
            AfcrcHelperDialog.static.title = 'afcrc-helper';
            AfcrcHelperDialog.static.actions = [
                { action: 'cancel', label: 'Close', flags: ['safe', 'close'] },
                { action: 'save', label: 'Run', flags: ['primary', 'progressive'] },
            ];

            this.pageTitle = pageTitle;
            this.requestPageType = requestPageType;

            mw.util.addCSS(`
.afcrc-helper-request {
    background-color: #eee;
    border-radius: 5px;
    margin: 10px;
    padding: 5px;
}

.afcrc-helper-request summary {
    cursor: pointer;
}

.afcrc-helper-request-info, .afcrc-helper-request-responder {
    margin: 5px;
}

.afcrc-helper-request-info > div, .afcrc-helper-request-responder > div {
    margin-block: 8px;
}

.afcrc-helper-request-responder > div:last-of-type {
    margin-bottom: 0;
}

.afcrc-helper-request-responder .oo-ui-fieldLayout {
    margin-left: 8px;
}

.afcrc-helper-action-radio {
    margin-top: 8px;
}

.afcrc-helper-action-radio .oo-ui-radioOptionWidget {
    display: inline;
    padding: 8px;
}

.afcrc-closing-reason-input, .afcrc-comment-input {
    max-width: 50%;
}`);
        }

        getActionProcess = (action: string) => {
            if (action === 'cancel')
                return new OO.ui.Process(() => {
                    this.getManager().closeWindow(this);
                });
            else if (action === 'save')
                return new OO.ui.Process(() => {
                    this.performActions();
                });
            else return AfcrcHelperDialog.super.prototype.getActionProcess.call(this, action);
        };

        getTeardownProcess = () => {
            return AfcrcHelperDialog.super.prototype.getTeardownProcess.call(this).next(() => {
                (this as unknown as { $body: JQuery }).$body.empty();
            });
        };

        /**
         * Load elements in the window.
         */
        public async load() {
            const redirectTemplateResponse = (await this.api.get({
                action: 'query',
                formatversion: '2',
                prop: 'revisions',
                rvprop: 'content',
                rvslots: 'main',
                titles: 'User:Eejit43/scripts/redirect-helper.json',
            } satisfies ApiQueryRevisionsParams)) as PageRevisionsResult;

            this.redirectTemplateItems = Object.keys(JSON.parse(redirectTemplateResponse.query.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '{}') as Record<string, unknown>).map((tag) => ({
                data: tag,
                label: tag,
            }));

            const pageRevision = (await this.api.get({
                action: 'query',
                formatversion: '2',
                prop: 'revisions',
                rvprop: 'content',
                rvslots: 'main',
                titles: this.pageTitle,
            } satisfies ApiQueryRevisionsParams)) as PageRevisionsResult;

            this.pageContent = pageRevision.query.pages[0].revisions[0].slots.main.content.trim();

            this.parseRequests();
            this.loadInputElements();
        }

        /**
         * Parses requests from the page content.
         */
        private parseRequests() {
            this.beforeText = this.pageContent.match(/^(.*?)==/s)![1];

            this.pageContent = this.pageContent.replace(/^.*?==/s, '==').replaceAll(new RegExp(`\\[https?:${mw.config.get('wgServer')}/(.*?)]`, 'g'), '[[$1]]');

            const sections = [...this.pageContent.matchAll(/^==.*?==$(\s*(?!==[^=]).*)*/gim)].map((match) => match[0]);

            for (const sectionText of sections) {
                const isClosed = /{{afc-c\|/i.test(sectionText);
                if (isClosed) continue;

                const sectionHeader = sectionText.match(/^==(.*?)==$/m)![1].trim();

                if (requestPageType === 'redirect') {
                    const parsedData = {} as RedirectRequestData;

                    const requestedPages = [...sectionHeader.matchAll(/\[\[(.*?)]]/g)].map((match) => match[1]?.trim().replace(/^:/, '').replaceAll('_', ' ')).filter(Boolean);
                    if (requestedPages.length === 0) continue;

                    parsedData.pages = requestedPages;

                    const parsedTarget = sectionText
                        .match(/Target of redirect: ?\[\[(.*?)]]/)?.[1]
                        .trim()
                        .replace(/^:/, '')
                        .replaceAll('_', ' ');
                    if (!parsedTarget) continue;

                    parsedData.target = parsedTarget;

                    parsedData.reason = sectionText.match(/reason: ?(.*?)\*source(?: \(if applicable\))?:/is)?.[1].trim() ?? '';

                    parsedData.source = sectionText.match(/source(?: \(if applicable\))?: ?(.*?)(?:<references \/>|\n\n)/is)?.[1].trim() ?? '';

                    const requester = sectionText
                        .match(
                            sectionText.includes('<references />')
                                ? /<references \/>\n+(.*)/
                                : new RegExp(`(?:<references \\/>${parsedData.source ? `|${parsedData.source.replaceAll(/[\s#$()*+,.?[\\\]^{|}-]/g, '\\$&')}` : ''})\n+(.*)`),
                        )?.[1]
                        .trim();
                    if (!requester) continue;

                    parsedData.requester = { type: requester.includes('[[User:') ? 'user' : 'ip', name: requester.match(/(?:Special:Contributions\/|User:)(.*?)\|/)![1].trim() };

                    (this.parsedRequests as RedirectRequestData[]).push(parsedData);

                    (this.actionsToTake as RedirectActions).push({
                        target: parsedData.target,
                        requests: Object.fromEntries(
                            requestedPages.map((page) => [page, { originalText: { fullSectionText: sectionText, sectionText: sectionText.replace(/^==.*?==$/m, '').trim() }, action: 'none' }]),
                        ),
                    });
                } else {
                    const parsedData = {} as CategoryRequestData;

                    const foundCategory = sectionHeader.match(/:?Category:(.*?)(]]|$)/)?.[1].trim();
                    if (!foundCategory) continue;

                    parsedData.category = foundCategory.replaceAll('_', ' ');

                    parsedData.examples =
                        [...sectionText.match(/example pages which belong to this category:(.*?)parent category\/categories:/is)![1].matchAll(/\*\s*(?:\[\[)?(.*?)(\||]]|\s*?\n)/g)]
                            .map((match) => match[1].trim().replace(/^:/, '').replaceAll('_', ' '))
                            .filter(Boolean) ?? [];

                    parsedData.parents =
                        [...sectionText.match(/parent category\/categories:(.*?)(\n\n|\n\[\[(special:contributions\/|user:))/is)![1].matchAll(/(?<!\|)#?:?Category:(.*?)(\||]]|\s*?\n)/g)]
                            ?.map((match) => match[1].trim().replace(/^:/, '').replaceAll('_', ' '))
                            .filter(Boolean) ?? [];

                    const matchedUser = sectionText.match(/\[\[User:(.*?)\|/);

                    parsedData.requester = { type: matchedUser ? 'user' : 'ip', name: matchedUser ? matchedUser[1].trim() : sectionText.match(/Special:Contributions\/(.*?)\|/)![1].trim() };

                    (this.parsedRequests as CategoryRequestData[]).push(parsedData);

                    (this.actionsToTake as CategoryActions).push({
                        category: parsedData.category,
                        examples: parsedData.examples,
                        parents: parsedData.parents,
                        originalText: { fullSectionText: sectionText, sectionText: sectionText.replace(/^==.*?==$/m, '').trim() },
                        action: 'none',
                    });
                }
            }
        }

        /**
         * Loads the input elements in the dialog.
         */
        private loadInputElements() {
            if (this.parsedRequests.length > 0) {
                let index = 0;

                const handle = () => {
                    const batchSize = 5;
                    const endIndex = Math.min(index + batchSize, this.parsedRequests.length);
                    (this as unknown as { title: OO.ui.LabelWidget }).title.setLabel(`afcrc-helper (loading ${index + 1}-${endIndex}/${this.parsedRequests.length} requests)`);

                    for (let subIndex = index; subIndex < endIndex; subIndex++)
                        if (this.requestPageType === 'redirect') this.loadRedirectRequestElements(subIndex);
                        else this.loadCategoryRequestElements(subIndex);

                    if (endIndex < this.parsedRequests.length) {
                        index = endIndex;
                        setTimeout(handle, 0);
                    } else (this as unknown as { title: OO.ui.LabelWidget }).title.setLabel(`afcrc-helper (${this.parsedRequests.length} requests loaded)`);
                };

                handle();
            } else {
                const messageWidget = new OO.ui.MessageWidget({ type: 'notice', label: 'No valid requests to handle!' });

                const messageWidgetLayout = new OO.ui.PanelLayout({ padded: true, expanded: false });
                messageWidgetLayout.$element.append(messageWidget.$element);

                (this as unknown as { $body: JQuery }).$body.append(messageWidgetLayout.$element);

                this.updateSize();
            }
        }

        /**
         * Loads a given redirect request into the dialog.
         * @param index The index of the request to load.
         */
        private loadRedirectRequestElements(index: number) {
            const request = this.parsedRequests[index] as RedirectRequestData;

            const detailsElement = document.createElement('details');
            detailsElement.classList.add('afcrc-helper-request');
            detailsElement.addEventListener('click', () => setTimeout(() => this.updateSize(), 0));

            const summaryElement = document.createElement('summary');
            summaryElement.innerHTML = request.pages.map((page) => `<b>${page}</b>`).join(', ') + ' → ';

            const linkElement = document.createElement('a');
            linkElement.target = '_blank';
            linkElement.href = mw.util.getUrl(request.target);
            linkElement.textContent = request.target;

            summaryElement.append(linkElement);

            detailsElement.append(summaryElement);

            const requestInfoElement = document.createElement('div');
            requestInfoElement.classList.add('afcrc-helper-request-info');

            const noneElement = document.createElement('span');
            noneElement.style.color = 'dimgray';
            noneElement.textContent = 'None';

            const reasonDiv = document.createElement('div');

            const reasonLabel = document.createElement('b');
            reasonLabel.textContent = 'Reason: ';
            reasonDiv.append(reasonLabel);

            if (request.reason) reasonDiv.append(request.reason);
            else reasonDiv.append(noneElement.cloneNode(true));

            requestInfoElement.append(reasonDiv);

            const sourceDiv = document.createElement('div');

            const sourceLabel = document.createElement('b');
            sourceLabel.textContent = 'Source: ';
            sourceDiv.append(sourceLabel);

            if (request.source) sourceDiv.append(request.source);
            else sourceDiv.append(noneElement.cloneNode(true));

            requestInfoElement.append(sourceDiv);

            const requesterDiv = document.createElement('div');

            const requesterLabel = document.createElement('b');
            requesterLabel.textContent = 'Requester: ';
            requesterDiv.append(requesterLabel);

            const requesterLink = document.createElement('a');
            requesterLink.target = '_blank';
            requesterLink.href = request.requester.type === 'user' ? mw.util.getUrl(`User:${request.requester.name}`) : mw.util.getUrl(`Special:Contributions/${request.requester.name}`);
            requesterLink.textContent = request.requester.name;
            requesterDiv.append(requesterLink);

            requestInfoElement.append(requesterDiv);

            detailsElement.append(requestInfoElement);

            detailsElement.append(document.createElement('hr'));

            const requestResponderElement = document.createElement('div');
            requestResponderElement.classList.add('afcrc-helper-request-responder');

            for (const requestedTitle of request.pages) {
                const requestedTitleDiv = document.createElement('div');

                const label = document.createElement('b');
                label.textContent = requestedTitle + ' → ' + request.target;
                requestedTitleDiv.append(label);

                const actionRadioInput = new OO.ui.RadioSelectWidget({
                    classes: ['afcrc-helper-action-radio'],
                    items: ['Accept', 'Deny', 'Comment', 'Close', 'None'].map((label) => new OO.ui.RadioOptionWidget({ data: label, label })),
                });
                actionRadioInput.selectItemByLabel('None');
                actionRadioInput.on('choose', () => {
                    setTimeout(() => this.updateSize(), 0);

                    const option = ((actionRadioInput.findSelectedItem() as OO.ui.RadioOptionWidget).getData() as string).toLowerCase() as ActionType;

                    (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].action = option;

                    if (['comment', 'close'].includes(option)) {
                        commentInputLayout.$element.show();

                        const comment = commentInput.getValue().trim();
                        if (comment) (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].comment = comment;
                        else delete (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].comment;
                    } else {
                        commentInputLayout.$element.hide();

                        delete (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].comment;
                    }

                    this.updateRequestColor(detailsElement, index);

                    const tagSelectElement = requestedTitleDiv.querySelector('.afcrc-helper-tag-select-layout');
                    if (tagSelectElement) tagSelectElement.remove();

                    denyReasonLayout.$element.hide();
                    closingReasonLayout.$element.hide();

                    switch (option) {
                        case 'accept': {
                            const tagSelect = new OO.ui.MenuTagMultiselectWidget({
                                allowArbitrary: false,
                                allowReordering: false,
                                options: this.redirectTemplateItems,
                            });
                            (tagSelect.getMenu() as OO.ui.MenuSelectWidget.ConfigOptions).filterMode = 'substring';
                            tagSelect.on('change', () => {
                                const sortedTags = (tagSelect.getValue() as string[]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

                                if ((tagSelect.getValue() as string[]).join(';') !== sortedTags.join(';')) tagSelect.setValue(sortedTags);

                                (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].redirectTemplates = sortedTags;
                            });
                            tagSelect.setValue((this.actionsToTake as RedirectActions)[index].requests[requestedTitle].redirectTemplates ?? []);

                            const tagSelectLayout = new OO.ui.FieldLayout(tagSelect, { classes: ['afcrc-helper-tag-select-layout'], align: 'inline', label: 'Redirect templates:' });

                            requestedTitleDiv.append(tagSelectLayout.$element[0]);

                            break;
                        }
                        case 'deny': {
                            denyReasonLayout.$element.show();

                            break;
                        }
                        case 'close': {
                            closingReasonLayout.$element.show();

                            break;
                        }
                    }
                });

                const denyReason = new OO.ui.ComboBoxInputWidget({
                    classes: ['afcrc-closing-reason-input'],
                    placeholder: 'autofill:unlikely',
                    options: [
                        ['exists', 'existing pages'],
                        ['empty', 'empty submissions'],
                        ['notarget', 'nonexistent or no provided target'],
                        ['notitle', 'no title provided'],
                        ['unlikely', 'unlikely redirects'],
                        ['notredirect', 'article creation requests'],
                        ['externallink', 'external link redirects'],
                        ['editrequest', 'edit requests'],
                        ['notenglish', 'requests not in English'],
                    ].map(([value, label]) => ({ data: `autofill:${value}`, label: `Autofilled text for ${label}` })),
                });
                denyReason.on('change', () => {
                    (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].denyReason = denyReason.getValue() || 'autofill:unlikely';
                });
                denyReason.setValue('autofill:unlikely');
                denyReason.getMenu().selectItemByData('autofill:unlikely');

                const denyReasonLayout = new OO.ui.FieldLayout(denyReason, { align: 'inline', label: 'Deny reason:' });
                denyReasonLayout.$element.hide();

                const closingReason = new OO.ui.DropdownWidget({
                    classes: ['afcrc-closing-reason-input'],
                    menu: {
                        items: [
                            ['No response', 'r'],
                            ['Succeeded', 's'],
                            ['Withdrawn', 'w'],
                        ].map(([title, id]) => new OO.ui.MenuOptionWidget({ data: id, label: title })),
                    },
                });
                closingReason.getMenu().on('choose', () => {
                    const selected = closingReason.getMenu().findSelectedItem() as OO.ui.MenuOptionWidget;

                    (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].closingReason = { name: selected.getLabel() as string, id: selected.getData() as string };

                    this.updateRequestColor(detailsElement, index);
                });
                closingReason.getMenu().selectItemByData('r');
                (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].closingReason = { name: 'No response', id: 'r' };

                const closingReasonLayout = new OO.ui.FieldLayout(closingReason, { align: 'inline', label: 'Closing reason:' });
                closingReasonLayout.$element.hide();

                const commentInput = new OO.ui.TextInputWidget();
                commentInput.on('change', () => {
                    const comment = commentInput.getValue().trim();

                    if (comment) (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].comment = comment;
                    else delete (this.actionsToTake as RedirectActions)[index].requests[requestedTitle].comment;
                });

                const commentInputLayout = new OO.ui.FieldLayout(commentInput, { classes: ['afcrc-comment-input'], align: 'inline', label: 'Comment:' });
                commentInputLayout.$element.hide();

                requestedTitleDiv.append(actionRadioInput.$element[0], denyReasonLayout.$element[0], closingReasonLayout.$element[0], commentInputLayout.$element[0]);

                requestResponderElement.append(requestedTitleDiv);
            }

            detailsElement.append(requestResponderElement);

            (this as unknown as { $body: JQuery }).$body.append(detailsElement);

            this.updateSize();
        }

        /**
         * Loads a given category request into the dialog.
         * @param index The index of the request to load.
         */
        private loadCategoryRequestElements(index: number) {
            const request = this.parsedRequests[index] as CategoryRequestData;

            const detailsElement = document.createElement('details');
            detailsElement.classList.add('afcrc-helper-request');
            detailsElement.addEventListener('click', () => setTimeout(() => this.updateSize(), 0));

            const summaryElement = document.createElement('summary');
            summaryElement.innerHTML = `<b>Category:${request.category}</b>`;
            detailsElement.append(summaryElement);

            const requestInfoElement = document.createElement('div');
            requestInfoElement.classList.add('afcrc-helper-request-info');

            const noneElement = document.createElement('span');
            noneElement.style.color = 'dimgray';
            noneElement.textContent = 'None';

            const examplesDiv = document.createElement('div');

            const examplesLabel = document.createElement('b');
            examplesLabel.textContent = 'Examples: ';
            examplesDiv.append(examplesLabel);

            if (request.examples.length > 0)
                for (const [index, example] of request.examples.entries()) {
                    const linkElement = document.createElement('a');
                    linkElement.target = '_blank';
                    linkElement.href = mw.util.getUrl(example);
                    linkElement.textContent = example;

                    examplesDiv.append(linkElement);

                    if (index !== request.examples.length - 1) examplesDiv.append(', ');
                }
            else examplesDiv.append(noneElement.cloneNode(true));

            requestInfoElement.append(examplesDiv);

            const parentsDiv = document.createElement('div');

            const parentsLabel = document.createElement('b');
            parentsLabel.textContent = 'Parents: ';
            parentsDiv.append(parentsLabel);

            if (request.parents.length > 0)
                for (const [index, parent] of request.parents.entries()) {
                    const linkElement = document.createElement('a');
                    linkElement.target = '_blank';
                    linkElement.href = mw.util.getUrl(`Category:${parent}`);
                    linkElement.textContent = parent;

                    parentsDiv.append(linkElement);

                    if (index !== request.parents.length - 1) parentsDiv.append(', ');
                }
            else parentsDiv.append(noneElement.cloneNode(true));

            requestInfoElement.append(parentsDiv);

            const requesterDiv = document.createElement('div');

            const requesterLabel = document.createElement('b');
            requesterLabel.textContent = 'Requester: ';
            requesterDiv.append(requesterLabel);

            const requesterLink = document.createElement('a');
            requesterLink.target = '_blank';
            requesterLink.href = request.requester.type === 'user' ? mw.util.getUrl(`User:${request.requester.name}`) : mw.util.getUrl(`Special:Contributions/${request.requester.name}`);
            requesterLink.textContent = request.requester.name;
            requesterDiv.append(requesterLink);

            requestInfoElement.append(requesterDiv);

            detailsElement.append(requestInfoElement);

            detailsElement.append(document.createElement('hr'));

            const requestResponderElement = document.createElement('div');
            requestResponderElement.classList.add('afcrc-helper-request-responder');

            const actionRadioInput = new OO.ui.RadioSelectWidget({
                classes: ['afcrc-helper-action-radio'],
                items: ['Accept', 'Deny', 'Comment', 'Close', 'None'].map((label) => new OO.ui.RadioOptionWidget({ data: label, label })),
            });
            actionRadioInput.selectItemByLabel('None');
            actionRadioInput.on('choose', () => {
                setTimeout(() => this.updateSize(), 0);

                const option = ((actionRadioInput.findSelectedItem() as OO.ui.RadioOptionWidget).getData() as string).toLowerCase() as ActionType;

                (this.actionsToTake as CategoryActions)[index].action = option;

                if (['comment', 'close'].includes(option)) {
                    commentInputLayout.$element.show();

                    const comment = commentInput.getValue().trim();
                    if (comment) (this.actionsToTake as CategoryActions)[index].comment = comment;
                    else delete (this.actionsToTake as CategoryActions)[index].comment;
                } else {
                    commentInputLayout.$element.hide();

                    delete (this.actionsToTake as CategoryActions)[index].comment;
                }

                this.updateRequestColor(detailsElement, index);

                pageSelectLayout.$element.hide();
                categorySelectLayout.$element.hide();
                denyReasonLayout.$element.hide();
                closingReasonLayout.$element.hide();

                switch (option) {
                    case 'accept': {
                        pageSelectLayout.$element.show();
                        categorySelectLayout.$element.show();

                        break;
                    }
                    case 'deny': {
                        denyReasonLayout.$element.show();

                        break;
                    }
                    case 'close': {
                        closingReasonLayout.$element.show();

                        break;
                    }
                }
            });

            const pageSelectInput = new PageInputWidget({ placeholder: 'Add pages here' });
            pageSelectInput.on('change', () => {
                let value = pageSelectInput.getValue();
                value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
                value = value.replace(/^:/, '');

                if (value.length > 0) pageSelectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll('_', ' '));
            });
            pageSelectInput.on('showing-values', (pages: { data: string; label: string }[]) => {
                for (const page of pages) pageSelect.addAllowedValue(page.data);
            });

            const pageSelect = new OO.ui.TagMultiselectWidget({ allowReordering: false, inputPosition: 'outline', inputWidget: pageSelectInput });
            pageSelect.on('change', () => {
                const sortedTags = (pageSelect.getValue() as string[]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

                if ((pageSelect.getValue() as string[]).join(';') !== sortedTags.join(';')) pageSelect.setValue(sortedTags);

                (this.actionsToTake as CategoryActions)[index].examples = sortedTags;
            });

            const { examples } = (this.actionsToTake as CategoryActions)[index];

            for (const example of examples) pageSelect.addAllowedValue(example);
            pageSelect.setValue(examples);

            const pageSelectLayout = new OO.ui.FieldLayout(pageSelect, { align: 'inline', label: 'Pages to categorize:' });
            pageSelectLayout.$element.hide();

            const categorySelectInput = new CategoryInputWidget({ placeholder: 'Add categories here' });
            categorySelectInput.on('change', () => {
                let value = categorySelectInput.getValue();
                value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
                value = value.replace(/^Category:/, '');

                if (value.length > 0) categorySelectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll('_', ' '));
            });
            categorySelectInput.on('showing-values', (pages: { data: string; label: string }[]) => {
                for (const page of pages) categorySelect.addAllowedValue(page.data);
            });

            const categorySelect = new OO.ui.TagMultiselectWidget({ allowReordering: false, inputPosition: 'outline', inputWidget: categorySelectInput });
            categorySelect.on('change', () => {
                const sortedTags = (categorySelect.getValue() as string[]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

                if ((categorySelect.getValue() as string[]).join(';') !== sortedTags.join(';')) categorySelect.setValue(sortedTags);

                (this.actionsToTake as CategoryActions)[index].parents = sortedTags;
            });

            const { parents } = (this.actionsToTake as CategoryActions)[index];

            for (const parent of parents) categorySelect.addAllowedValue(parent);
            categorySelect.setValue(parents);

            const categorySelectLayout = new OO.ui.FieldLayout(categorySelect, { align: 'inline', label: 'Categories:' });
            categorySelectLayout.$element.hide();

            const denyReason = new OO.ui.ComboBoxInputWidget({
                classes: ['afcrc-closing-reason-input'],
                placeholder: 'autofill:unlikely',
                options: [
                    ['exists', 'existing categories'],
                    ['empty', 'empty submissions'],
                    ['unlikely', 'categories that are unlikely to have enough pages'],
                    ['notcategory', 'page creation requests'],
                    ['notenglish', 'requests not in English'],
                ].map(([value, label]) => ({ data: `autofill:${value}`, label: `Autofilled text for ${label}` })),
            });
            denyReason.on('change', () => {
                (this.actionsToTake as CategoryActions)[index].denyReason = denyReason.getValue() || 'autofill:unlikely';
            });
            denyReason.setValue('autofill:unlikely');
            denyReason.getMenu().selectItemByData('autofill:unlikely');

            const denyReasonLayout = new OO.ui.FieldLayout(denyReason, { align: 'inline', label: 'Deny reason:' });
            denyReasonLayout.$element.hide();

            const closingReason = new OO.ui.DropdownWidget({
                classes: ['afcrc-closing-reason-input'],
                menu: {
                    items: [
                        ['No response', 'r'],
                        ['Succeeded', 's'],
                        ['Withdrawn', 'w'],
                    ].map(([title, id]) => new OO.ui.MenuOptionWidget({ data: id, label: title })),
                },
            });
            closingReason.getMenu().on('choose', () => {
                const selected = closingReason.getMenu().findSelectedItem() as OO.ui.MenuOptionWidget;

                (this.actionsToTake as CategoryActions)[index].closingReason = { name: selected.getLabel() as string, id: selected.getData() as string };

                this.updateRequestColor(detailsElement, index);
            });
            closingReason.getMenu().selectItemByData('r');
            (this.actionsToTake as CategoryActions)[index].closingReason = { name: 'No response', id: 'r' };

            const closingReasonLayout = new OO.ui.FieldLayout(closingReason, { align: 'inline', label: 'Closing reason:' });
            closingReasonLayout.$element.hide();

            const commentInput = new OO.ui.TextInputWidget();
            commentInput.on('change', () => {
                const comment = commentInput.getValue().trim();

                if (comment) (this.actionsToTake as CategoryActions)[index].comment = comment;
                else delete (this.actionsToTake as CategoryActions)[index].comment;
            });

            const commentInputLayout = new OO.ui.FieldLayout(commentInput, { classes: ['afcrc-comment-input'], align: 'inline', label: 'Comment:' });
            commentInputLayout.$element.hide();

            requestResponderElement.append(
                actionRadioInput.$element[0],
                pageSelectLayout.$element[0],
                categorySelectLayout.$element[0],
                denyReasonLayout.$element[0],
                closingReasonLayout.$element[0],
                commentInputLayout.$element[0],
            );

            detailsElement.append(requestResponderElement);

            (this as unknown as { $body: JQuery }).$body.append(detailsElement);

            this.updateSize();
        }

        /**
         * Updates the color of a details element based on the handling of the requests inside.
         * @param detailsElement The details element to update.
         * @param index The index of the redirect target.
         */
        private updateRequestColor(detailsElement: HTMLDetailsElement, index: number) {
            if (this.requestPageType === 'redirect') {
                const actionsToTake = Object.values((this.actionsToTake as RedirectActions)[index].requests);

                const allRequestsAcceptedDenied = actionsToTake.every((action) => action.action === 'accept' || action.action === 'deny');

                const firstCloseReason = actionsToTake.find((action) => action.action === 'close')?.closingReason?.id;
                const allRequestsClosed = actionsToTake.every((action) => action.action === 'close' && action.closingReason?.id === firstCloseReason);

                let backgroundColor = '';

                if (allRequestsAcceptedDenied) {
                    const acceptedCount = actionsToTake.filter((action) => action.action === 'accept').length;
                    const deniedCount = actionsToTake.filter((action) => action.action === 'deny').length;

                    if (acceptedCount > 0 && deniedCount > 0) backgroundColor = '#fff17e';
                    else if (acceptedCount > 0) backgroundColor = '#a0ffa0';
                    else backgroundColor = '#ffcece';
                } else if (allRequestsClosed)
                    if (firstCloseReason === 'r') backgroundColor = '#ffcece';
                    else if (firstCloseReason === 's') backgroundColor = '#90c090';
                    else backgroundColor = '#b8b8b8';

                detailsElement.style.backgroundColor = backgroundColor;
            } else {
                const { action } = (this.actionsToTake as CategoryActions)[index];

                let backgroundColor = '';

                // eslint-disable-next-line unicorn/prefer-switch
                if (action === 'accept') backgroundColor = '#a0ffa0';
                else if (action === 'deny') backgroundColor = '#ffcece';
                else if (action === 'close')
                    if ((this.actionsToTake as CategoryActions)[index].closingReason?.id === 'r') backgroundColor = '#ffcece';
                    else if ((this.actionsToTake as CategoryActions)[index].closingReason?.id === 's') backgroundColor = '#90c090';
                    else backgroundColor = '#b8b8b8';

                detailsElement.style.backgroundColor = backgroundColor;
            }
        }

        /**
         * Performs all actions and logs their results.
         */
        private async performActions() {
            const windowManager = new OO.ui.WindowManager();
            document.body.append(windowManager.$element[0]);

            const showActionsDialog = new ShowActionsDialog();
            windowManager.addWindows([showActionsDialog]);
            showActionsDialog.open();

            const counts = { accepted: 0, denied: 0, 'commented on': 0, closed: 0 }; // eslint-disable-line @typescript-eslint/naming-convention

            let newPageText = (
                (await this.api.get({
                    action: 'query',
                    formatversion: '2',
                    prop: 'revisions',
                    rvprop: 'content',
                    rvslots: 'main',
                    titles: this.pageTitle,
                } satisfies ApiQueryRevisionsParams)) as PageRevisionsResult
            ).query.pages[0].revisions[0].slots.main.content.trim();

            if (this.requestPageType === 'redirect') {
                const anyRequestHandled = (this.actionsToTake as RedirectActions).some((actionData) => Object.values(actionData.requests).some((action) => action.action !== 'none'));

                if (anyRequestHandled) {
                    for (const { target, requests } of this.actionsToTake as RedirectActions) {
                        const someRequestAcceptedDenied = Object.values(requests).some((action) => action.action === 'accept' || action.action === 'deny');
                        const allRequestsAcceptedDenied = Object.values(requests).every((action) => action.action === 'accept' || action.action === 'deny');

                        const firstCloseReason = Object.values(requests as Record<string, RedirectAction>).find((action) => action.action === 'close')?.closingReason?.id;
                        const allRequestsClosed = Object.values(requests as Record<string, RedirectAction>).every(
                            (action) => action.action === 'close' && action.closingReason?.id === firstCloseReason,
                        );

                        const acceptedPages = [];
                        const deniedPages = [];
                        const comments = [];

                        const amountOfPages = Object.keys(requests).length;

                        for (const [requestedTitle, action] of Object.entries(requests) as [string, RedirectAction][])
                            switch (action.action) {
                                case 'accept': {
                                    if (someRequestAcceptedDenied && !allRequestsAcceptedDenied)
                                        showActionsDialog.addLogEntry(`Not all requests to "${target}" were accepted or denied, the handling of "${requestedTitle}" will be ignored.`, 'warning');
                                    else {
                                        acceptedPages.push(requestedTitle);
                                        counts.accepted++;
                                    }

                                    break;
                                }
                                case 'deny': {
                                    if (someRequestAcceptedDenied && !allRequestsAcceptedDenied)
                                        showActionsDialog.addLogEntry(`Not all requests to "${target}" were accepted or denied, the handling of "${requestedTitle}" is being ignored.`, 'warning');
                                    else {
                                        deniedPages.push([requestedTitle, action.denyReason!]);
                                        counts.denied++;
                                    }

                                    break;
                                }
                                case 'comment': {
                                    if (action.comment) {
                                        comments.push([requestedTitle, action.comment]);
                                        counts['commented on']++;
                                    } else
                                        showActionsDialog.addLogEntry(
                                            `The request to create "${requestedTitle}" → "${target}" was marked to be commented on, but no comment was provided so it will be skipped.`,
                                            'warning',
                                        );

                                    break;
                                }
                                case 'close': {
                                    if (allRequestsClosed) {
                                        if (action.comment) comments.push([requestedTitle, action.comment]);
                                        counts.closed++;
                                    } else
                                        showActionsDialog.addLogEntry(
                                            `Not all requests to "${target}" were closed with the same reason, the handling of "${requestedTitle}" is being ignored.`,
                                            'warning',
                                        );
                                    break;
                                }
                            }

                        let sectionData = { pageText: newPageText, ...Object.values(requests)[0].originalText };

                        if (comments.length > 0) sectionData = this.modifySectionData(sectionData, { append: this.mapComments(comments, amountOfPages === 1, comments.length === amountOfPages) });

                        if (allRequestsAcceptedDenied) {
                            let closingId: string;

                            if (acceptedPages.length > 0 && deniedPages.length > 0) {
                                closingId = 'p';

                                const acceptedPagesMessage = `* {{subst:AfC redirect}} (${acceptedPages.map((page) => `[[${page}]]`).join(', ')}) ~~~~`;
                                const deniedPagesMessage = this.mapDeniedReasons(deniedPages, false, false);

                                for (const page of acceptedPages) this.handleAcceptedRedirect(page, requests[page], target);

                                sectionData = this.modifySectionData(sectionData, { append: `${acceptedPagesMessage}\n${deniedPagesMessage}` });
                            } else if (acceptedPages.length > 0) {
                                closingId = 'a';

                                for (const page of acceptedPages) this.handleAcceptedRedirect(page, requests[page], target);

                                sectionData = this.modifySectionData(sectionData, { append: `* {{subst:AfC redirect${acceptedPages.length > 1 ? '|all' : ''}}} ~~~~` });
                            } else {
                                closingId = 'd';

                                sectionData = this.modifySectionData(sectionData, { append: this.mapDeniedReasons(deniedPages, amountOfPages === 1, true) });
                            }

                            sectionData = this.modifySectionData(sectionData, { prepend: `{{AfC-c|${closingId}}}`, append: '{{AfC-c|b}}' });
                        } else if (allRequestsClosed) sectionData = this.modifySectionData(sectionData, { prepend: `{{AfC-c|${firstCloseReason}}}`, append: '{{AfC-c|b}}' });

                        newPageText = sectionData.pageText;
                    }

                    if (this.beforeText + this.pageContent === newPageText) return showActionsDialog.addLogEntry('No requests have been handled (page content identical)!');

                    const mappedCounts = Object.entries(counts)
                        .filter(([, count]) => count > 0)
                        .map(([action, count]) => `${action} ${count}`)
                        .join(', ');

                    this.editsCreationsToMake.push({
                        type: 'edit',
                        title: this.pageTitle,
                        transform: () => ({ text: newPageText, summary: `Handling AfC redirect requests (${mappedCounts})${this.scriptMessage}` }),
                    });

                    await this.makeAllEditsCreations(showActionsDialog);

                    showActionsDialog.addLogEntry('All changes made, click below to reload!', 'success');

                    showActionsDialog.showReload();
                } else showActionsDialog.addLogEntry('No requests have been handled!');
            } else {
                const anyRequestHandled = (this.actionsToTake as CategoryActions).some((actionData) => actionData.action !== 'none');

                if (anyRequestHandled) {
                    for (const actionData of this.actionsToTake as CategoryActions) {
                        let sectionData = { pageText: newPageText, ...actionData.originalText };

                        switch (actionData.action) {
                            case 'accept': {
                                sectionData = this.modifySectionData(sectionData, { prepend: '{{AfC-c|a}}', append: '* {{subst:AfC category}} ~~~~\n{{AfC-c|b}}' });

                                this.handleAcceptedCategory(actionData);

                                counts.accepted++;

                                break;
                            }
                            case 'deny': {
                                sectionData = this.modifySectionData(sectionData, {
                                    prepend: '{{AfC-c|d}}',
                                    append: `* ${this.formatDeniedReason(actionData.denyReason!)} ~~~~\n{{AfC-c|b}}`,
                                });

                                counts.denied++;

                                break;
                            }
                            case 'comment': {
                                if (actionData.comment) {
                                    sectionData = this.modifySectionData(sectionData, { append: `* {{AfC comment|1=${actionData.comment}}} ~~~~` });

                                    counts['commented on']++;
                                } else
                                    showActionsDialog.addLogEntry(
                                        `The request to create "${actionData.category}" was marked to be commented on, but no comment was provided so it will be skipped.`,
                                        'warning',
                                    );

                                break;
                            }
                            case 'close': {
                                sectionData = this.modifySectionData(sectionData, {
                                    prepend: `{{AfC-c|${actionData.closingReason!.id}}}`,
                                    append: (actionData.comment ? `* {{AfC comment|1=${actionData.comment}}} ~~~~` : '') + '\n{{AfC-c|b}',
                                });

                                counts.closed++;

                                break;
                            }
                        }

                        newPageText = sectionData.pageText;
                    }

                    if (this.beforeText + this.pageContent === newPageText) return showActionsDialog.addLogEntry('No requests have been handled (page content identical)!');

                    const mappedCounts = Object.entries(counts)
                        .filter(([, count]) => count > 0)
                        .map(([action, count]) => `${action} ${count}`)
                        .join(', ');

                    this.editsCreationsToMake.push({
                        type: 'edit',
                        title: this.pageTitle,
                        transform: () => ({ text: newPageText, summary: `Handling AfC category requests (${mappedCounts})${this.scriptMessage}` }),
                    });

                    await this.makeAllEditsCreations(showActionsDialog);

                    showActionsDialog.addLogEntry('All changes made, click below to reload!', 'success');

                    showActionsDialog.showReload();
                } else showActionsDialog.addLogEntry('No requests have been handled!');
            }
        }

        /**
         * Formats a request denial reason to a {{subst:AfC redirect}} call.
         * @param reason The reason to format.
         */
        private formatDeniedReason(reason: string) {
            const templateParameters = reason.startsWith('autofill:') ? reason.replace('autofill:', '') : `decline|2=${reason}`;

            return `{{subst:AfC ${this.requestPageType}|${templateParameters}}}`;
        }

        /**
         * Maps a group of denied reasons.
         * @param deniedPages The pages to map.
         * @param singularRequest Whether the request is the only request.
         * @param allRequests Whether all requests are being mapped.
         */
        private mapDeniedReasons(deniedPages: string[][], singularRequest: boolean, allRequests: boolean) {
            if (singularRequest) return `* ${this.formatDeniedReason(deniedPages[0][1])} ~~~~`;

            const reasons: Record<string, string[]> = {};

            for (const [page, reason] of deniedPages) {
                if (!reasons[reason]) reasons[reason] = [];
                reasons[reason].push(page);
            }

            const reasonsArray = Object.entries(reasons);

            return reasonsArray
                .map(([reason, pages]) => `* ${this.formatDeniedReason(reason)}${reasonsArray.length > 1 || !allRequests ? ` (${pages.map((page) => `[[${page}]]`).join(', ')})` : ''} ~~~~`)
                .join('\n');
        }

        /**
         * Maps a group of comments.
         * @param comments The comments to map.
         * @param singularRequest Whether the request is the only request.
         * @param allRequests Whether all requests are being mapped.
         */
        private mapComments(comments: string[][], singularRequest: boolean, allRequests: boolean) {
            if (singularRequest) return `* {{AfC comment|1=${comments[0][1]}}} ~~~~`;

            const commentMessages: Record<string, string[]> = {};

            for (const [page, comment] of comments) {
                if (!commentMessages[comment]) commentMessages[comment] = [];
                commentMessages[comment].push(page);
            }

            const commentsArray = Object.entries(commentMessages);

            return commentsArray
                .map(([comment, pages]) => `* {{AfC comment|1=${comment}}}${commentsArray.length > 1 || !allRequests ? ` (${pages.map((page) => `[[${page}]]`).join(', ')})` : ''} ~~~~`)
                .join('\n');
        }

        /**
         * Modifies a given section text with prepended and appended text.
         * @param sectionData The section data.
         * @param changes The prepending and appending text.
         * @param changes.prepend The text to prepend to the section text.
         * @param changes.append The text to append to the section text.
         */
        private modifySectionData(sectionData: { pageText: string } & Action['originalText'], { prepend, append }: { prepend?: string; append?: string }) {
            const { fullSectionText: oldFullSectionText, sectionText: oldSectionText } = sectionData;

            if (prepend) sectionData.sectionText = prepend + '\n' + sectionData.sectionText;
            if (append) sectionData.sectionText += '\n' + append;

            sectionData.fullSectionText = sectionData.fullSectionText.replace(oldSectionText, sectionData.sectionText);

            sectionData.pageText = sectionData.pageText.replace(oldFullSectionText, sectionData.fullSectionText);

            return sectionData;
        }

        /**
         * Handles the creation of pages related to an accepted redirect request.
         * @param page The requested page.
         * @param data The data of the requested page.
         * @param target The target of the requested page.
         */
        private handleAcceptedRedirect(page: string, data: RedirectAction, target: string) {
            const mappedTags = data.redirectTemplates && data.redirectTemplates.length > 0 ? data.redirectTemplates?.map((tag) => `{{${tag}}}`).join('\n') : null;

            this.editsCreationsToMake.push(
                {
                    type: 'create',
                    title: page,
                    text: `#REDIRECT [[${target}]]${mappedTags ? `\n\n{{Redirect category shell|\n${mappedTags}\n}}` : ''}`,
                    summary: `Creating redirect to [[${target}]] as requested at [[WP:AFC/R]]${this.scriptMessage}`,
                },
                {
                    type: 'create',
                    title: mw.Title.newFromText(page)!.getTalkPage()!.getPrefixedText(),
                    text: `{{WikiProject banner shell|\n{{WikiProject Articles for creation|ts={{subst:LOCALTIMESTAMP}}|reviewer=${mw.config.get('wgUserName')}}}\n}}`,
                    summary: `Adding [[Wikipedia:WikiProject Articles for creation|WikiProject Articles for creation]] banner${this.scriptMessage}`,
                },
            );
        }

        /**
         * Handles the creation of pages related to an accepted category request.
         * @param data The data of the requested category.
         */
        private handleAcceptedCategory(data: CategoryAction) {
            this.editsCreationsToMake.push(
                {
                    type: 'create',
                    title: `Category:${data.category}`,
                    text: data.parents.map((parent) => `[[Category:${parent}]]`).join('\n'),
                    summary: `Creating category as requested at [[WP:AFC/C]]${this.scriptMessage}`,
                },
                {
                    type: 'create',
                    title: `Category talk:${data.category}`,
                    text: `{{WikiProject banner shell|\n{{WikiProject Articles for creation|ts={{subst:LOCALTIMESTAMP}}|reviewer=${mw.config.get('wgUserName')}}}\n}}`,
                    summary: `Adding [[Wikipedia:WikiProject Articles for creation|WikiProject Articles for creation]] banner${this.scriptMessage}`,
                },
                ...data.examples.map((example) => ({
                    type: 'edit' as const,
                    title: example,
                    transform: ({ content }: { content: string }) => ({
                        text: `${content}\n[[Category:${data.category}]]`,
                        summary: `Adding page to [[:Category:${data.category}]] as requested at [[WP:AFC/C]]${this.scriptMessage}`,
                    }),
                })),
            );
        }

        /**
         * Makes all edits and creations that need to be made.
         * @param showActionsDialog The dialog to log the results to.
         */
        private async makeAllEditsCreations(showActionsDialog: ShowActionsDialog) {
            for (const action of this.editsCreationsToMake) {
                const apiFunction = action.type === 'edit' ? this.api.edit(action.title, action.transform) : this.api.create(action.title, { summary: action.summary }, action.text);

                showActionsDialog.addLogEntry(`${action.type === 'edit' ? 'Editing' : 'Creating'} ${action.title}...`);

                // eslint-disable-next-line no-await-in-loop
                await apiFunction.catch(async (errorCode: string, errorInfo: MediaWikiDataError) => {
                    if (errorCode === 'ratelimited') {
                        showActionsDialog.addLogEntry(`Rate limited. Waiting for 70 seconds... (resuming at ${new Date(Date.now() + 70_000).toLocaleTimeString()})`, 'warning');
                        await new Promise((resolve) => setTimeout(resolve, 70_000));

                        showActionsDialog.addLogEntry('Continuing...', 'success');

                        // eslint-disable-next-line no-await-in-loop
                        await apiFunction.catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                            showActionsDialog.addLogEntry(
                                `Error ${action.type === 'edit' ? 'editing' : 'creating'} ${action.title}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode}).`,
                                'error',
                            );
                        });
                    } else
                        showActionsDialog.addLogEntry(`Error ${action.type === 'edit' ? 'editing' : 'creating'} ${action.title}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode}).`, 'error');
                });
            }
        }
    }

    Object.assign(AfcrcHelperDialog.prototype, OO.ui.ProcessDialog.prototype);
});
