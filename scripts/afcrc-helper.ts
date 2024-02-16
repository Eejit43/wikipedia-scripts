import { ApiQueryRevisionsParams } from 'types-mediawiki/api_params';
import { PageRevisionsResult } from '../global-types';

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

        const afcrcHelperDialog = new AfcrcHelperDialog(requestPageType, mw.config.get('wgPageName'));

        windowManager.addWindows([afcrcHelperDialog]);

        afcrcHelperDialog.open();
    });

    class ShowActionsDialog extends OO.ui.Dialog {
        private contentLayout!: OO.ui.PanelLayout;
        private logOutput!: HTMLDivElement;

        constructor() {
            super({ size: 'medium' });

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

            const closeButton = new OO.ui.ButtonWidget({ label: 'Close', flags: ['safe', 'close'] });
            closeButton.on('click', () => this.close());

            this.contentLayout.$element.append(this.logOutput, closeButton.$element);

            return this;
        };

        getBodyHeight = () => {
            return this.contentLayout.$element.outerHeight(true)!;
        };

        /**
         * Adds a log entry to the dialog.
         * @param message The message to add.
         */
        public addLogEntry(message: string) {
            const logEntry = document.createElement('div');
            logEntry.textContent = message;

            this.logOutput.append(logEntry);
        }
    }

    Object.assign(ShowActionsDialog.prototype, OO.ui.Dialog.prototype);

    interface RedirectRequestData {
        pages: string[];
        target: string;
        reason: string;
        source: string;
        requester: { type: 'user' | 'ip'; name: string };
    }

    interface CategoryRequestData {}

    type ActionType = 'accept' | 'deny' | 'comment' | 'close' | 'none';

    interface Action {
        originalText: string;
        action: ActionType;
        comment?: string;
    }

    type RedirectAction = Action & { denyReason?: string; closingReason?: { name: string; id: string } };

    type RedirectActions = Record<string, Record<string, RedirectAction>>;

    type CategoryActions = Record<string, Record<string, Action>>;

    /**
     * An instance of this class is a dialog that handles redirect and category requests.
     */
    class AfcrcHelperDialog extends OO.ui.ProcessDialog {
        private api = new mw.Api();

        private scriptMessage = ' ([[User:Eejit43/scripts/afcrc-helper|afcrc-helper]])';

        private requestPageType: 'redirect' | 'category';
        private pageTitle!: string;

        private beforeText!: string;
        private pageContent!: string;

        private parsedRequests: RedirectRequestData[] | CategoryRequestData[] = [];
        private actionsToTake: RedirectActions | CategoryActions = {};

        constructor(requestPageType: 'redirect' | 'category', pageTitle: string) {
            super({ size: 'large' });

            AfcrcHelperDialog.static.name = 'AfcrcHelperDialog';
            AfcrcHelperDialog.static.title = 'afcrc-helper';
            AfcrcHelperDialog.static.actions = [
                { action: 'cancel', label: 'Close', flags: ['safe', 'close'] },
                { action: 'show-actions', label: 'Show actions to take' },
                { action: 'save', label: 'Run', flags: ['primary', 'progressive'] },
            ];

            this.pageTitle = pageTitle;
            this.requestPageType = requestPageType;
        }

        getSetupProcess = () => {
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

            return AfcrcHelperDialog.super.prototype.getSetupProcess.call(this).next(() => {
                return this.api
                    .get({
                        action: 'query',
                        formatversion: '2',
                        prop: 'revisions',
                        rvprop: 'content',
                        rvslots: 'main',
                        titles: this.pageTitle,
                    } satisfies ApiQueryRevisionsParams)
                    .then((response) => {
                        this.pageContent = (response as PageRevisionsResult).query.pages[0].revisions[0].slots.main.content.trim();

                        this.parseRequests();
                        this.loadInputElements();
                    });
            });
        };

        getActionProcess = (action: string) => {
            switch (action) {
                case 'cancel': {
                    return new OO.ui.Process(() => {
                        this.getManager().closeWindow(this);
                    });
                }
                case 'show-actions': {
                    return new OO.ui.Process(() => {
                        this.performActions(true);
                    });
                }
                case 'save': {
                    return new OO.ui.Process(() => {
                        this.performActions(false);
                    });
                }
                default: {
                    return AfcrcHelperDialog.super.prototype.getActionProcess.call(this, action);
                }
            }
        };

        getTeardownProcess = () => {
            return AfcrcHelperDialog.super.prototype.getTeardownProcess.call(this).next(() => {
                (this as unknown as { $body: JQuery }).$body.empty();
            });
        };

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

                    const requestedPages = [...sectionHeader.matchAll(/\[\[(.*?)]]/g)].map((match) => match[1].trim().replace(/^:/, '').replaceAll('_', ' '));

                    parsedData.pages = requestedPages;

                    const parsedTarget = sectionText
                        .match(/Target of redirect: ?\[\[(.*?)]]/)?.[1]
                        .trim()
                        .replace(/^:/, '')
                        .replaceAll('_', ' ');

                    if (!parsedTarget) continue;

                    parsedData.target = parsedTarget;

                    parsedData.reason = sectionText.match(/reason: ?(.*?)\*source(?: \(if applicable\))?:/is)![1].trim();

                    parsedData.source = sectionText.match(/source(?: \(if applicable\))?: ?(.*?)(?:<references \/>|\n)/is)![1].trim();

                    const requester = sectionText
                        .match(
                            sectionText.includes('<references />')
                                ? /<references \/>\n(.*)/
                                : new RegExp(`(?:<references \\/>${parsedData.source ? `|${parsedData.source.replaceAll(/[\s#$()*+,.?[\\\]^{|}-]/g, '\\$&')}` : ''})\n+(.*)`),
                        )![1]
                        .trim();

                    parsedData.requester = { type: requester.includes('[[User:') ? 'user' : 'ip', name: requester.match(/(?:Special:Contributions\/|User:)(.*?)\|/)![1].trim() };

                    this.parsedRequests.push(parsedData);

                    this.actionsToTake[parsedData.target] = Object.fromEntries(requestedPages.map((page) => [page, { originalText: sectionText.replace(/^==.*?==$/m, '').trim(), action: 'none' }]));
                } else {
                    const parsedData = {} as RedirectRequestData;
                }
            }
        }

        /**
         * Loads the input elements in the dialog.
         */
        private loadInputElements() {
            if (this.requestPageType === 'redirect')
                for (const request of this.parsedRequests as RedirectRequestData[]) {
                    const detailsElement = document.createElement('details');
                    detailsElement.classList.add('afcrc-helper-request');

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
                    else reasonDiv.append(noneElement);

                    requestInfoElement.append(reasonDiv);

                    const sourceDiv = document.createElement('div');

                    const sourceLabel = document.createElement('b');
                    sourceLabel.textContent = 'Source: ';
                    sourceDiv.append(sourceLabel);

                    if (request.source) sourceDiv.append(request.source);
                    else sourceDiv.append(noneElement);

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
                            const option = ((actionRadioInput.findSelectedItem() as OO.ui.RadioOptionWidget).getData() as string).toLowerCase() as ActionType;

                            this.actionsToTake[request.target][requestedTitle].action = option;

                            if (['comment', 'close'].includes(option)) {
                                commentInputLayout.$element.show();

                                const comment = commentInput.getValue().trim();
                                if (comment) this.actionsToTake[request.target][requestedTitle].comment = comment;
                                else delete this.actionsToTake[request.target][requestedTitle].comment;
                            } else {
                                commentInputLayout.$element.hide();

                                delete this.actionsToTake[request.target][requestedTitle].comment;
                            }

                            if (option === 'deny') {
                                denyReasonLayout.$element.show();

                                (this.actionsToTake as RedirectActions)[request.target][requestedTitle].denyReason = denyReason.getValue();
                            } else if (option === 'close') {
                                closingReasonLayout.$element.show();

                                const selected = closingReason.getMenu().findSelectedItem() as OO.ui.MenuOptionWidget;
                                (this.actionsToTake as RedirectActions)[request.target][requestedTitle].closingReason = { name: selected.getLabel() as string, id: selected.getData() as string };

                                delete (this.actionsToTake as RedirectActions)[request.target][requestedTitle].denyReason;
                            } else {
                                denyReasonLayout.$element.hide();
                                closingReasonLayout.$element.hide();

                                delete (this.actionsToTake as RedirectActions)[request.target][requestedTitle].denyReason;
                                delete (this.actionsToTake as RedirectActions)[request.target][requestedTitle].closingReason;
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
                                ['externallink', 'external link redirects'],
                                ['editrequest', 'edit requests'],
                                ['notenglish', 'requests not in English'],
                            ].map(([value, label]) => ({ data: `autofill:${value}`, label: `Autofilled text for ${label}` })),
                        });
                        denyReason.getMenu().on('choose', () => {
                            (this.actionsToTake as RedirectActions)[request.target][requestedTitle].denyReason = denyReason.getValue();
                        });
                        denyReason.setValue('autofill:unlikely');
                        denyReason.getMenu().selectItemByData('autofill:unlikely');

                        const denyReasonLayout = new OO.ui.FieldLayout(denyReason, { align: 'inline', label: 'Deny reason' });
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

                            (this.actionsToTake as RedirectActions)[request.target][requestedTitle].closingReason = { name: selected.getLabel() as string, id: selected.getData() as string };
                        });
                        closingReason.getMenu().selectItemByLabel('No response');

                        const closingReasonLayout = new OO.ui.FieldLayout(closingReason, { align: 'inline', label: 'Closing reason' });
                        closingReasonLayout.$element.hide();

                        const commentInput = new OO.ui.TextInputWidget();
                        commentInput.on('change', () => {
                            const comment = commentInput.getValue().trim();

                            if (comment) this.actionsToTake[request.target][requestedTitle].comment = comment;
                            else delete this.actionsToTake[request.target][requestedTitle].comment;
                        });

                        const commentInputLayout = new OO.ui.FieldLayout(commentInput, { classes: ['afcrc-comment-input'], align: 'inline', label: 'Comment' });
                        commentInputLayout.$element.hide();

                        requestedTitleDiv.append(actionRadioInput.$element[0], denyReasonLayout.$element[0], closingReasonLayout.$element[0], commentInputLayout.$element[0]);

                        requestResponderElement.append(requestedTitleDiv);
                    }

                    detailsElement.append(requestResponderElement);

                    (this as unknown as { $body: JQuery }).$body.append(detailsElement);
                }
            else
                for (const request of this.parsedRequests as CategoryRequestData[]) {
                    const detailsElement = document.createElement('details');
                    detailsElement.classList.add('afcrc-helper-request');

                    const summaryElement = document.createElement('summary');
                    summaryElement.textContent = request.name;

                    detailsElement.append(summaryElement);

                    (this as unknown as { $body: JQuery }).$body.append(detailsElement);
                }
        }

        /**
         * Performs all actions and logs their results.
         * @param dryRun If true, no pages will be edited or created.
         */
        private performActions(dryRun: boolean) {
            const tense = dryRun ? 'will be' : 'has been';

            const windowManager = new OO.ui.WindowManager();
            document.body.append(windowManager.$element[0]);

            const showActionsDialog = new ShowActionsDialog();
            windowManager.addWindows([showActionsDialog]);
            showActionsDialog.open();

            const counts = { accepted: 0, denied: 0, commented: 0, closed: 0 };
            let newPageText = this.beforeText + this.pageContent;

            if (this.requestPageType === 'redirect') {
                const anyRequestHandled = Object.values(this.actionsToTake).some((actions) => Object.values(actions).some((action) => action.action !== 'none'));

                if (anyRequestHandled) {
                    for (const [target, actions] of Object.entries(this.actionsToTake)) {
                        const someRequestAcceptedDenied = Object.values(actions).some((action) => action.action === 'accept' || action.action === 'deny');
                        const allRequestsAcceptedDenied = Object.values(actions).every((action) => action.action === 'accept' || action.action === 'deny');

                        const firstCloseReason = Object.values(actions as Record<string, RedirectAction>).find((action) => action.action === 'close')?.closingReason?.id;
                        const allRequestsClosed = Object.values(actions as Record<string, RedirectAction>).every(
                            (action) => action.action === 'close' && action.closingReason?.id === firstCloseReason,
                        );

                        const acceptedPages = [];
                        const deniedPages = [];
                        const comments = [];

                        for (const [requestedTitle, action] of Object.entries(actions) as [string, RedirectAction][]) {
                            const messagePrefix = `The request to create "${requestedTitle}" → "${target}" ${tense} `;
                            const commentedMessage = action.comment ? ' and commented on' : '';

                            switch (action.action) {
                                case 'accept': {
                                    if (someRequestAcceptedDenied && !allRequestsAcceptedDenied)
                                        showActionsDialog.addLogEntry(`Not all requests to "${target}" were accepted or denied, the handling of "${requestedTitle}" will be ignored.`);
                                    else {
                                        showActionsDialog.addLogEntry(messagePrefix + `accepted${commentedMessage}.`);

                                        acceptedPages.push(requestedTitle);
                                        counts.accepted++;
                                    }

                                    break;
                                }
                                case 'deny': {
                                    if (someRequestAcceptedDenied && !allRequestsAcceptedDenied)
                                        showActionsDialog.addLogEntry(`Not all requests to "${target}" were accepted or denied, the handling of "${requestedTitle}" is being ignored.`);
                                    else {
                                        showActionsDialog.addLogEntry(messagePrefix + 'denied.');

                                        deniedPages.push([requestedTitle, action.denyReason! || 'decline']);
                                        counts.denied++;
                                    }

                                    break;
                                }
                                case 'comment': {
                                    if (action.comment) {
                                        showActionsDialog.addLogEntry(messagePrefix + 'commented on.');

                                        comments.push(`[${requestedTitle} → ${target}] ${action.comment}`);
                                        counts.commented++;
                                    } else showActionsDialog.addLogEntry(messagePrefix + 'marked to be commented on, but no comment was provided.');

                                    break;
                                }
                                case 'close': {
                                    if (allRequestsClosed) {
                                        showActionsDialog.addLogEntry(messagePrefix + `closed as ${action.closingReason!.name.toLowerCase()}${commentedMessage}.`);

                                        counts.closed++;
                                    } else showActionsDialog.addLogEntry(`Not all requests to "${target}" were closed with the same reason, the handling of "${requestedTitle}" is being ignored.`);
                                    break;
                                }
                            }
                        }

                        let sectionReplaceText = Object.values(actions)[0].originalText;

                        if (comments.length > 0) {
                            sectionReplaceText += '\n' + comments.map((comment) => `* {{AfC comment|1=${comment}}} ~~~~`).join('\n');

                            newPageText = newPageText.replace(Object.values(actions)[0].originalText, sectionReplaceText);
                        }

                        if (someRequestAcceptedDenied) {
                            let closingId: string;

                            const sectionTextBefore = sectionReplaceText;

                            if (acceptedPages.length > 0 && deniedPages.length > 0) {
                                closingId = 'p';

                                const mappedAcceptedPages = acceptedPages.map((page) => `* {{subst:AfC redirect}} [${page}] ~~~~`);
                                const mappedDeniedPages = deniedPages.map(
                                    ([page, reason]) => `* {{subst:AfC redirect|${reason.startsWith('autofill:') ? reason.replace('autofill:', '') : `decline|1=${reason}`}}} [${page}] ~~~~`,
                                );

                                if (!dryRun) for (const page of acceptedPages) this.handleAcceptedRedirect(page, actions[page], target);

                                sectionReplaceText += '\n' + mappedAcceptedPages.join('\n') + '\n' + mappedDeniedPages.join('\n');
                                newPageText = newPageText.replace(sectionTextBefore, sectionReplaceText);
                            } else if (acceptedPages.length > 0) {
                                closingId = 'a';

                                if (!dryRun) for (const page of acceptedPages) this.handleAcceptedRedirect(page, actions[page], target);

                                sectionReplaceText += `\n* {{subst:AfC redirect${acceptedPages.length > 1 ? '|all' : ''}}} ~~~~`;
                                newPageText = newPageText.replace(sectionTextBefore, sectionReplaceText);
                            } else {
                                closingId = 'd';

                                const mappedReasons = deniedPages.map(
                                    ([page, reason]) =>
                                        `* {{subst:AfC redirect|${reason.startsWith('autofill:') ? reason.replace('autofill:', '') : `decline|1=${reason}`}}}${deniedPages.length > 1 ? ` [${page}]` : ''} ~~~~`,
                                );

                                sectionReplaceText += '\n' + mappedReasons.join('\n');
                                newPageText = newPageText.replace(sectionTextBefore, sectionReplaceText);
                            }

                            newPageText = newPageText.replace(sectionReplaceText, `{{AfC-c|${closingId}}}\n${sectionReplaceText}\n{{AfC-c|b}}`);
                        } else if (allRequestsClosed) newPageText = newPageText.replace(sectionReplaceText, `{{AfC-c|${firstCloseReason}}}\n${sectionReplaceText}\n{{AfC-c|b}}`);
                    }

                    if (dryRun || this.beforeText + this.pageContent === newPageText) return;

                    const mappedCounts = Object.entries(counts)
                        .filter(([, count]) => count > 0)
                        .map(([action, count]) => `${action} ${count}`)
                        .join(', ');

                    this.api.edit(this.pageTitle, () => ({ text: newPageText, summary: `Handling AfC redirect requests (${mappedCounts})${this.scriptMessage}` }));
                } else showActionsDialog.addLogEntry(`No requests ${dryRun ? 'will be' : 'have been'} handled!`);
            }
        }

        private handleAcceptedRedirect(page: string, data: RedirectAction, target: string) {
            this.api.create(page, { summary: `Creating redirect to [[${target}]] as requested at [[WP:AFC/R]]${this.scriptMessage}` }, `#REDIRECT [[${target}]]`);

            const talkName = mw.Title.newFromText(page)!.getTalkPage()!.getPrefixedText();

            this.api.create(
                talkName,
                { summary: `Placing banner for [[Wikipedia:WikiProject Articles for creation|WikiProject Articles for creation]] ${this.scriptMessage}` },
                `{{WikiProject banner shell|class=Redirect|\n{{WikiProject Articles for creation|ts={{subst:LOCALTIMESTAMP}}|reviewer=${mw.config.get('wgUserName')}}}\n}}`,
            );
        }
    }

    Object.assign(AfcrcHelperDialog.prototype, OO.ui.ProcessDialog.prototype);
});
