import type { ApiQueryRevisionsParams } from 'types-mediawiki/api_params';
import type { PageRevisionsResult } from '../../global-types';
import type { RedirectTemplateData, TemplateEditorElementInfo } from '../redirect-helper/redirect-helper-dialog';
import AfcrcHelperDialog, { type AfcrcRequestAction, type AfcrcRequestActionType, type AfcrcRequestRequester } from './afcrc-helper-dialog';
import type ActionsDialog from './show-actions-dialog';

interface RedirectRequestData {
    pages: string[];
    target: string;
    reason: string;
    source: string;
    requester: AfcrcRequestRequester;
}

type RedirectAction = AfcrcRequestAction & { redirectTemplates?: string[]; redirectTemplateParameters?: TemplateEditorElementInfo[] };

type RedirectActions = { target: string; requests: Record<string, RedirectAction> }[];

export default class AfcrcHelperRedirectDialog extends AfcrcHelperDialog {
    private redirectTemplates!: RedirectTemplateData;

    protected parsedRequests: RedirectRequestData[] = [];
    private actionsToTake: RedirectActions = [];

    public async load() {
        const redirectTemplateResponse = (await this.api.get({
            action: 'query',
            formatversion: '2',
            prop: 'revisions',
            rvprop: 'content',
            rvslots: 'main',
            titles: 'User:Eejit43/scripts/redirect-helper.json',
        } satisfies ApiQueryRevisionsParams)) as PageRevisionsResult;

        this.redirectTemplates = JSON.parse(
            redirectTemplateResponse.query.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '{}',
        ) as RedirectTemplateData;

        super.load();
    }

    protected parseSubtypeRequests(sectionText: string, sectionHeader: string) {
        const parsedData = {} as RedirectRequestData;

        const requestedPages = [...sectionHeader.matchAll(/\[\[(.*?)]]/g)]
            .map((match) => match[1]?.trim().replace(/^:/, '').replaceAll('_', ' '))
            .filter(Boolean);
        if (requestedPages.length === 0) return;

        parsedData.pages = requestedPages;

        const parsedTarget = /Target of redirect: ?\[\[(.*?)]]/.exec(sectionText)?.[1].trim().replace(/^:/, '').replaceAll('_', ' ');
        if (!parsedTarget) return;

        parsedData.target = parsedTarget;

        parsedData.reason = /reason: ?(.*?)\*source(?: \(if applicable\))?:/is.exec(sectionText)?.[1].trim() ?? '';

        parsedData.source = /source(?: \(if applicable\))?: ?(.*?)(?:<references \/>|\n\n)/is.exec(sectionText)?.[1].trim() ?? '';

        const requester = sectionText
            .match(
                sectionText.includes('<references />')
                    ? /<references \/>\n+(.*)/
                    : new RegExp(
                          `(?:<references \\/>${parsedData.source ? `|${parsedData.source.replaceAll(/[\s#$()*+,.?[\\\]^{|}-]/g, '\\$&')}` : ''})\n+(.*)`,
                      ),
            )?.[1]
            .trim();

        const name = requester ? /(?:Special:Contributions\/|User(?: talk)?:)(.*?)\|/.exec(requester)?.[1].trim() : null;

        parsedData.requester = requester && name ? { type: /\[\[User( talk)?:/.test(requester) ? 'user' : 'ip', name } : null;

        this.parsedRequests.push(parsedData);

        this.actionsToTake.push({
            target: parsedData.target,
            requests: Object.fromEntries(
                requestedPages.map((page) => [
                    page,
                    {
                        originalText: {
                            fullSectionText: sectionText,
                            sectionText: sectionText.replace(/^==.*?==$/m, '').trim(),
                        },
                        action: 'none',
                    },
                ]),
            ),
        });
    }

    /**
     * Loads a given redirect request into the dialog.
     * @param index The index of the request to load.
     */
    protected loadSubtypeElements(index: number) {
        const request = this.parsedRequests[index];

        const detailsElement = document.createElement('details');
        detailsElement.classList.add('afcrc-helper-request');
        detailsElement.addEventListener('click', () => setTimeout(() => this.updateSize(), 0));

        const summaryElement = document.createElement('summary');
        summaryElement.innerHTML = request.pages.map((page) => `<b>${page}</b>`).join(', ') + ' → ';
        summaryElement.addEventListener('keyup', (event) => {
            if (document.activeElement?.tagName === 'INPUT' && event.key === ' ') event.preventDefault();
        });

        const targetEditorElement = document.createElement('input');
        targetEditorElement.classList.add('afcrc-helper-target-editor');
        targetEditorElement.style.width = `${request.target.length}ch`;
        targetEditorElement.value = request.target;
        targetEditorElement.addEventListener('input', () => {
            targetEditorElement.value = targetEditorElement.value.replaceAll('_', ' ');

            targetEditorElement.style.width = `${targetEditorElement.value.length}ch`;

            this.actionsToTake[index].target = targetEditorElement.value;

            linkElement.href = mw.util.getUrl(targetEditorElement.value);
        });

        summaryElement.append(targetEditorElement);

        const linkElement = document.createElement('a');
        linkElement.classList.add('afcrc-helper-external-link');
        linkElement.target = '_blank';
        linkElement.href = mw.util.getUrl(request.target);
        linkElement.innerHTML = `
<svg viewbox="0 0 48 48">
<path d="M36 24c-1.2 0-2 0.8-2 2v12c0 1.2-0.8 2-2 2h-22c-1.2
    0-2-0.8-2-2v-22c0-1.2 0.8-2 2-2h12c1.2 0 2-0.8 2-2s-0.8-2-2-2h-12c-3.4
    0-6 2.6-6 6v22c0 3.4 2.6 6 6 6h22c3.4 0 6-2.6
    6-6v-12c0-1.2-0.8-2-2-2z"></path>
<path d="M43.8 5.2c-0.2-0.4-0.6-0.8-1-1-0.2-0.2-0.6-0.2-0.8-0.2h-12c-1.2
    0-2 0.8-2 2s0.8 2 2 2h7.2l-18.6 18.6c-0.8 0.8-0.8 2 0 2.8 0.4 0.4 0.8
    0.6 1.4 0.6s1-0.2 1.4-0.6l18.6-18.6v7.2c0 1.2 0.8 2 2 2s2-0.8
    2-2v-12c0-0.2 0-0.6-0.2-0.8z"></path>
</svg>`;

        summaryElement.append(linkElement);

        detailsElement.append(summaryElement);

        const requestInfoElement = document.createElement('div');
        requestInfoElement.classList.add('afcrc-helper-request-info');

        const noneElement = document.createElement('span');
        noneElement.style.color = 'dimgray';
        noneElement.textContent = 'None';

        const unknownElement = document.createElement('span');
        unknownElement.style.color = 'dimgray';
        unknownElement.textContent = 'Unknown';

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

        if (request.requester) {
            const requesterLink = document.createElement('a');
            requesterLink.target = '_blank';
            requesterLink.href =
                request.requester.type === 'user'
                    ? mw.util.getUrl(`User:${request.requester.name}`)
                    : mw.util.getUrl(`Special:Contributions/${request.requester.name}`);
            requesterLink.textContent = request.requester.name;
            requesterDiv.append(requesterLink);
        } else requesterDiv.append(unknownElement.cloneNode(true));

        requestInfoElement.append(requesterDiv);

        detailsElement.append(requestInfoElement);

        detailsElement.append(document.createElement('hr'));

        const requestResponderElement = document.createElement('div');
        requestResponderElement.classList.add('afcrc-helper-request-responder');

        const actionRadioInputs: OO.ui.RadioSelectWidget[] = [];
        const denyReasonInputs: OO.ui.ComboBoxInputWidget[] = [];
        const closingReasonDropdowns: OO.ui.DropdownWidget[] = [];
        const commentInputs: OO.ui.TextInputWidget[] = [];

        for (const requestedTitle of request.pages) {
            const requestedTitleDiv = document.createElement('div');

            const label = document.createElement('b');
            label.textContent = requestedTitle;
            requestedTitleDiv.append(label);

            let tagSelectLayout: OO.ui.FieldLayout, templateParametersEditor: HTMLDetailsElement;

            const templateEditorsInfo: TemplateEditorElementInfo[] = [];

            const actionRadioInput = new OO.ui.RadioSelectWidget({
                classes: ['afcrc-helper-action-radio'],
                items: ['Accept', 'Deny', 'Comment', 'Close', 'None'].map((label) => new OO.ui.RadioOptionWidget({ data: label, label })),
            });
            actionRadioInputs.push(actionRadioInput);
            actionRadioInput.selectItemByLabel('None');
            actionRadioInput.on('choose', (selected) => {
                setTimeout(() => this.updateSize(), 0);

                const option = (selected.getData() as string).toLowerCase() as AfcrcRequestActionType;

                this.actionsToTake[index].requests[requestedTitle].action = option;

                if (!tagSelectLayout || !templateParametersEditor) {
                    const tagSelect = new OO.ui.MenuTagMultiselectWidget({
                        allowArbitrary: false,
                        allowReordering: false,
                        options: Object.entries(this.redirectTemplates).map(([tag, { redirect }]) => {
                            if (!redirect) return { data: tag, label: tag };

                            const label = new OO.ui.HtmlSnippet(`${tag} <i>(redirect with possibilities)</i>`);

                            return { data: tag, label };
                        }),
                    });
                    (tagSelect.getMenu() as OO.ui.MenuSelectWidget.ConfigOptions).filterMode = 'substring';
                    tagSelect.on('change', () => {
                        const sortedTags = (tagSelect.getValue() as string[]).sort((a, b) =>
                            a.toLowerCase().localeCompare(b.toLowerCase()),
                        );

                        if ((tagSelect.getValue() as string[]).join(';') !== sortedTags.join(';')) tagSelect.setValue(sortedTags);

                        this.actionsToTake[index].requests[requestedTitle].redirectTemplates = sortedTags;

                        for (const editorInfo of templateEditorsInfo) editorInfo.details.style.display = 'none';

                        let shownTemplateEditors = 0;
                        for (const tag of tagSelect.getValue() as string[]) {
                            const editorInfo = templateEditorsInfo.find((editorInfo) => editorInfo.name === tag);

                            if (editorInfo) {
                                editorInfo.details.style.display = 'block';
                                shownTemplateEditors++;
                            }
                        }

                        summaryElement.textContent = `Template parameters (${shownTemplateEditors > 0 ? `for ${shownTemplateEditors} template${shownTemplateEditors > 1 ? 's' : ''}` : 'none to show'})`;

                        noTemplatesMessage.style.display = shownTemplateEditors > 0 ? 'none' : 'block';
                    });

                    tagSelectLayout = new OO.ui.FieldLayout(tagSelect, {
                        classes: ['afcrc-helper-tag-select-layout'],
                        align: 'inline',
                        label: 'Redirect templates:',
                    });
                    commentInputLayout.$element[0].before(tagSelectLayout.$element[0]);

                    templateParametersEditor = document.createElement('details');
                    templateParametersEditor.classList.add('afcrc-helper-template-parameters-container');

                    const summaryElement = document.createElement('summary');
                    summaryElement.textContent = 'Template parameters (none to show)';
                    templateParametersEditor.append(summaryElement);

                    for (const [templateName, templateData] of Object.entries(this.redirectTemplates)) {
                        const parameters = Object.entries(templateData.parameters);
                        if (parameters.length === 0) continue;

                        const details = document.createElement('details');
                        details.style.display = 'none';

                        const summary = document.createElement('summary');
                        summary.textContent = templateName;
                        details.append(summary);

                        const elementData: TemplateEditorElementInfo = { name: templateName, details, parameters: [] };

                        for (const [parameterName, parameterData] of parameters) {
                            const input = new OO.ui.TextInputWidget({
                                placeholder: parameterData.default?.toString(),
                                required: parameterData.required,
                            });

                            const inputLayout = new OO.ui.FieldLayout(input, {
                                label: new OO.ui.HtmlSnippet(
                                    `${parameterName}${!parameterData.label || parameterName.toLowerCase() === parameterData.label?.toLowerCase() ? '' : ` (${parameterData.label})`}${parameterData.description ? ` (${parameterData.description})` : ''} (type: ${parameterData.type}) ${parameterData.suggested ? ' (suggested)' : ''}${parameterData.example ? ` (example: "${parameterData.example}")` : ''}`,
                                ),
                                align: 'inline',
                            });
                            details.append(inputLayout.$element[0]);

                            elementData.parameters.push({ name: parameterName, aliases: parameterData.aliases, editor: input });
                        }

                        templateParametersEditor.append(details);

                        templateEditorsInfo.push(elementData);
                    }

                    this.actionsToTake[index].requests[requestedTitle].redirectTemplateParameters = templateEditorsInfo;

                    const noTemplatesMessage = document.createElement('div');
                    noTemplatesMessage.id = 'afcrc-helper-no-templates-message';
                    noTemplatesMessage.textContent = 'No templates with parameters to display!';

                    templateParametersEditor.append(noTemplatesMessage);

                    commentInputLayout.$element[0].before(templateParametersEditor);
                }

                if (['accept', 'comment', 'close'].includes(option)) {
                    commentInputLayout.$element.show();

                    const comment = commentInput.getValue().trim();
                    if (comment) this.actionsToTake[index].requests[requestedTitle].comment = comment;
                    else delete this.actionsToTake[index].requests[requestedTitle].comment;
                } else {
                    commentInputLayout.$element.hide();

                    delete this.actionsToTake[index].requests[requestedTitle].comment;
                }

                this.updateRequestColor(detailsElement, index);

                tagSelectLayout.$element.hide();
                templateParametersEditor.style.display = 'none';
                denyReasonLayout.$element.hide();
                closingReasonLayout.$element.hide();

                switch (option) {
                    case 'accept': {
                        tagSelectLayout.$element.show();
                        templateParametersEditor.style.display = 'block';

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

            const denyReasonInput = new OO.ui.ComboBoxInputWidget({
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
            denyReasonInputs.push(denyReasonInput);
            denyReasonInput.on('change', (value) => {
                this.actionsToTake[index].requests[requestedTitle].denyReason = value || 'autofill:unlikely';
            });
            denyReasonInput.setValue('autofill:unlikely');
            denyReasonInput.getMenu().selectItemByData('autofill:unlikely');

            const denyReasonLayout = new OO.ui.FieldLayout(denyReasonInput, {
                align: 'inline',
                label: 'Deny reason:',
                help: 'Supports automatic reasoning, custom reasoning, or a combination of the two with "autofill:REASON, CUSTOM" format',
            });
            denyReasonLayout.$element.hide();

            const closingReasonDropdown = new OO.ui.DropdownWidget({
                classes: ['afcrc-closing-reason-input'],
                menu: {
                    items: [
                        ['No response', 'r'],
                        ['Succeeded', 's'],
                        ['Withdrawn', 'w'],
                    ].map(([title, id]) => new OO.ui.MenuOptionWidget({ data: id, label: title })),
                },
            });
            closingReasonDropdowns.push(closingReasonDropdown);
            closingReasonDropdown.getMenu().on('choose', (selected) => {
                this.actionsToTake[index].requests[requestedTitle].closingReason = {
                    name: selected.getLabel() as string,
                    id: selected.getData() as string,
                };

                this.updateRequestColor(detailsElement, index);
            });
            closingReasonDropdown.getMenu().selectItemByData('r');
            if (requestedTitle) this.actionsToTake[index].requests[requestedTitle].closingReason = { name: 'No response', id: 'r' };

            const closingReasonLayout = new OO.ui.FieldLayout(closingReasonDropdown, { align: 'inline', label: 'Closing reason:' });
            closingReasonLayout.$element.hide();

            const commentInput = new OO.ui.TextInputWidget();
            commentInputs.push(commentInput);
            commentInput.on('change', () => {
                const comment = commentInput.getValue().trim();

                if (comment) this.actionsToTake[index].requests[requestedTitle].comment = comment;
                else delete this.actionsToTake[index].requests[requestedTitle].comment;
            });

            const commentInputLayout = new OO.ui.FieldLayout(commentInput, {
                classes: ['afcrc-comment-input'],
                align: 'inline',
                label: 'Comment:',
            });
            commentInputLayout.$element.hide();

            requestedTitleDiv.append(
                actionRadioInput.$element[0],
                denyReasonLayout.$element[0],
                closingReasonLayout.$element[0],
                commentInputLayout.$element[0],
            );

            requestResponderElement.append(requestedTitleDiv);
        }

        detailsElement.append(requestResponderElement);

        (this as unknown as { $body: JQuery }).$body.append(detailsElement);

        this.updateSize();
    }

    /**
     * Updates the color of a details element based on the handling of the requests inside.
     * @param detailsElement The details element to update.
     * @param index The index of the redirect target.
     */
    protected updateRequestColor(detailsElement: HTMLDetailsElement, index: number) {
        const actionsToTake = Object.values(this.actionsToTake[index].requests);

        const allRequestsAcceptedDenied = actionsToTake.every((action) => action.action === 'accept' || action.action === 'deny');

        const firstCloseReason = actionsToTake.find((action) => action.action === 'close')?.closingReason?.id;
        const allRequestsClosed = actionsToTake.every(
            (action) => action.action === 'close' && action.closingReason?.id === firstCloseReason,
        );

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
    }

    protected async performSubtypeActions(showActionsDialog: ActionsDialog, counts: Record<string, number>, newPageText: string) {
        const anyRequestHandled = this.actionsToTake.some((actionData) =>
            Object.values(actionData.requests).some((action) => action.action !== 'none'),
        );

        if (anyRequestHandled) {
            for (const { target, requests } of this.actionsToTake) {
                const someRequestAcceptedDenied = Object.values(requests).some(
                    (action) => action.action === 'accept' || action.action === 'deny',
                );
                const allRequestsAcceptedDenied = Object.values(requests).every(
                    (action) => action.action === 'accept' || action.action === 'deny',
                );

                const firstCloseReason = Object.values(requests).find((action) => action.action === 'close')?.closingReason?.id;
                const allRequestsClosed = Object.values(requests).every(
                    (action) => action.action === 'close' && action.closingReason?.id === firstCloseReason,
                );

                const acceptedPages = [];
                const deniedPages = [];
                const comments = [];

                const amountOfPages = Object.keys(requests).length;

                for (const [requestedTitle, action] of Object.entries(requests))
                    switch (action.action) {
                        case 'accept': {
                            if (someRequestAcceptedDenied && !allRequestsAcceptedDenied)
                                showActionsDialog.addLogEntry(
                                    `Not all requests to "${target}" were accepted or denied, the handling of "${requestedTitle}" will be ignored.`,
                                    'warning',
                                );
                            else {
                                acceptedPages.push(requestedTitle);
                                if (action.comment) comments.push([requestedTitle, action.comment]);
                                counts.accepted++;
                            }

                            break;
                        }
                        case 'deny': {
                            if (someRequestAcceptedDenied && !allRequestsAcceptedDenied)
                                showActionsDialog.addLogEntry(
                                    `Not all requests to "${target}" were accepted or denied, the handling of "${requestedTitle}" is being ignored.`,
                                    'warning',
                                );
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

                if (comments.length > 0)
                    sectionData = this.modifySectionData(sectionData, {
                        append: this.mapComments(comments, amountOfPages === 1, comments.length === amountOfPages),
                    });

                if (allRequestsAcceptedDenied) {
                    let closingId: string;

                    if (acceptedPages.length > 0 && deniedPages.length > 0) {
                        closingId = 'p';

                        const acceptedPagesMessage = `* {{subst:AfC redirect}} (${acceptedPages.map((page) => `[[${page}]]`).join(', ')}) ~~~~`;
                        const deniedPagesMessage = this.mapDeniedReasons(deniedPages, false, false);

                        for (const page of acceptedPages) this.handleAcceptedRedirect(page, requests[page], target);

                        sectionData = this.modifySectionData(sectionData, {
                            append: `${acceptedPagesMessage}\n${deniedPagesMessage}`,
                        });
                    } else if (acceptedPages.length > 0) {
                        closingId = 'a';

                        for (const page of acceptedPages) this.handleAcceptedRedirect(page, requests[page], target);

                        sectionData = this.modifySectionData(sectionData, {
                            append: `* {{subst:AfC redirect${acceptedPages.length > 1 ? '|all' : ''}}} ~~~~`,
                        });
                    } else {
                        closingId = 'd';

                        sectionData = this.modifySectionData(sectionData, {
                            append: this.mapDeniedReasons(deniedPages, amountOfPages === 1, true),
                        });
                    }

                    sectionData = this.modifySectionData(sectionData, { prepend: `{{AfC-c|${closingId}}}`, append: '{{AfC-c|b}}' });
                } else if (allRequestsClosed)
                    sectionData = this.modifySectionData(sectionData, {
                        prepend: `{{AfC-c|${firstCloseReason}}}`,
                        append: '{{AfC-c|b}}',
                    });

                newPageText = sectionData.pageText;
            }

            if (this.beforeText + this.pageContent === newPageText)
                return showActionsDialog.addLogEntry('No requests have been handled (page content identical)!');

            const mappedCounts = Object.entries(counts)
                .filter(([, count]) => count > 0)
                .map(([action, count]) => `${action} ${count}`)
                .join(', ');

            this.editsCreationsToMake.push({
                type: 'edit',
                title: this.pageTitle,
                transform: () => ({
                    text: newPageText,
                    summary: `Handling AfC redirect requests (${mappedCounts})${this.scriptMessage}`,
                }),
            });

            await this.makeAllEditsCreations(showActionsDialog);

            showActionsDialog.addLogEntry('All changes made, click below to reload!', 'success');

            showActionsDialog.showReload();
        } else showActionsDialog.addLogEntry('No requests have been handled!');
    }

    /**
     * Handles the creation of pages related to an accepted redirect request.
     * @param page The requested page.
     * @param data The data of the requested page.
     * @param target The target of the requested page.
     */
    protected handleAcceptedRedirect(page: string, data: RedirectAction, target: string) {
        const tagsWithArguments =
            data.redirectTemplates && data.redirectTemplates.length > 0
                ? data.redirectTemplates.map((tag) => {
                      const foundArgumentEditor = data.redirectTemplateParameters?.find((editorInfo) => editorInfo.name === tag);
                      if (!foundArgumentEditor) return `{{${tag}}}`;

                      const lastNumberParameterIndex = foundArgumentEditor.parameters.findLastIndex(
                          (parameter, index) => parameter.name === (index + 1).toString() && parameter.editor.getValue().trim(),
                      );

                      const mappedArguments = foundArgumentEditor.parameters
                          .map((parameter, index) => {
                              const value = parameter.editor.getValue().trim();
                              if (!value && index > lastNumberParameterIndex) return null;

                              return `|${parameter.name === (index + 1).toString() ? '' : `${parameter.name}=`}${value}`;
                          })
                          .filter(Boolean)
                          .join('');

                      return `{{${tag}${mappedArguments}}}`;
                  })
                : null;

        const title = mw.Title.newFromText(page)!;

        this.editsCreationsToMake.push(
            {
                type: 'create',
                isRedirect: true,
                title: title.getPrefixedText(),
                text: `#REDIRECT [[${target}]]${tagsWithArguments ? `\n\n{{Redirect category shell|\n${tagsWithArguments.join('\n')}\n}}` : ''}`,
                summary: `Creating redirect to [[${target}]] as requested at [[WP:AFC/R]]${this.scriptMessage}`,
            },
            {
                type: 'create',
                isRedirect: false,
                title: title.getTalkPage()!.getPrefixedText(),
                text: `{{WikiProject banner shell|\n{{WikiProject Articles for creation|ts={{subst:LOCALTIMESTAMP}}|reviewer=${mw.config.get('wgUserName')}}}\n}}`,
                summary: `Adding [[Wikipedia:WikiProject Articles for creation|WikiProject Articles for creation]] banner${this.scriptMessage}`,
            },
        );
    }
}
