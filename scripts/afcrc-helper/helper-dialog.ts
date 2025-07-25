import type { ApiEditPageParams } from 'types-mediawiki/api_params';
import type { MediaWikiDataError } from '../../global-types';
import { api, getPageContent } from '../../utility';
import ActionsDialog from './actions-dialog';
import type { WatchMethod } from './afcrc-helper';

export type RequestRequester = { type: 'user' | 'ip'; name: string } | null;

export type RequestActionType = 'accept' | 'deny' | 'comment' | 'close' | 'none';

export interface RequestAction {
    originalText: { fullSectionText: string; sectionText: string };
    action: RequestActionType;
    comment?: string;
    denyReason?: string;
    closingReason?: { name: string; id: string };
}

/**
 * An instance of this class is a dialog that handles redirect and category requests.
 */
export default class HelperDialog extends OO.ui.ProcessDialog {
    protected readonly SCRIPT_MESSAGE = ' ([[User:Eejit43/scripts/afcrc-helper|afcrc-helper]])';

    private requestPageType: 'redirect' | 'category';
    protected pageTitle: string;

    private createdPageWatchMethod: WatchMethod;

    protected beforeText!: string;
    protected pageContent!: string;

    protected parsedRequests!: unknown[];
    protected editsCreationsToMake: (
        | { type: 'edit'; title: string; transform: (data: { content: string }) => ApiEditPageParams }
        | { type: 'create'; isRedirect: boolean; title: string; text: string; summary: string }
    )[] = [];

    private shouldStopTabClosure = true;

    constructor(requestPageType: 'redirect' | 'category', pageTitle: string, createdWatchMethod: WatchMethod | undefined) {
        super({ size: 'large' });

        HelperDialog.static.name = 'AfcrcHelperDialog';
        HelperDialog.static.title = 'afcrc-helper';
        HelperDialog.static.actions = [
            { action: 'cancel', label: 'Close', flags: ['safe', 'close'] },
            { action: 'save', label: 'Run', flags: ['primary', 'progressive'] },
        ];

        this.pageTitle = pageTitle;
        this.requestPageType = requestPageType;

        this.createdPageWatchMethod =
            createdWatchMethod && ['nochange', 'preferences', 'unwatch', 'watch'].includes(createdWatchMethod)
                ? createdWatchMethod
                : 'preferences';

        document.body.classList.add('afcrc-helper-open');

        window.addEventListener('beforeunload', (event) => {
            if (this.parsedRequests.length > 0 && this.shouldStopTabClosure) event.preventDefault();
        });
    }

    getActionProcess = (action: string) => {
        if (!action || action === 'cancel')
            return new OO.ui.Process(() => {
                if (this.parsedRequests.length > 0)
                    OO.ui.confirm('Are you sure you want to close? All changes will be discarded.').then((confirmed) => {
                        if (!confirmed) return;

                        this.close();
                        this.shouldStopTabClosure = false;
                    });
                else this.close();
            });
        else if (action === 'save')
            return new OO.ui.Process(() => {
                void this.performActions();
            });
        else return HelperDialog.super.prototype.getActionProcess.call(this, action);
    };

    getTeardownProcess = () => {
        return HelperDialog.super.prototype.getTeardownProcess.call(this).next(() => {
            (this as unknown as { $body: JQuery }).$body.empty();

            document.body.classList.remove('afcrc-helper-open');
        });
    };

    /**
     * Load elements in the window.
     */
    public async load() {
        this.pageContent = (await getPageContent(this.pageTitle)) ?? '';

        this.parseRequests();
        this.loadInputElements();
    }

    /**
     * Parses requests from the page content.
     */
    private parseRequests() {
        this.beforeText = /^(.*?)==/s.exec(this.pageContent)![1];

        this.pageContent = this.pageContent.replace(/^.*?==/s, '==');

        const sections = [...this.pageContent.matchAll(/^==.*?==$(\s*(?!==[^=]).*)*/gim)].map((match) => match[0]);

        for (const sectionText of sections) {
            const isClosed = /{{afc-c\|/i.test(sectionText);
            if (isClosed) continue;

            const sectionHeader = /^==(.*?)==$/m.exec(sectionText)![1].trim();

            this.parseSubtypeRequests(sectionText, sectionHeader);
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
                (this as unknown as { title: OO.ui.LabelWidget }).title.setLabel(
                    `afcrc-helper (loading ${index + 1}-${endIndex}/${this.parsedRequests.length} requests)`,
                );

                for (let subIndex = index; subIndex < endIndex; subIndex++) this.loadSubtypeElements(subIndex);

                if (endIndex < this.parsedRequests.length) {
                    index = endIndex;
                    setTimeout(handle, 0);
                } else
                    (this as unknown as { title: OO.ui.LabelWidget }).title.setLabel(
                        `afcrc-helper (${this.parsedRequests.length} requests loaded)`,
                    );
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
     * Performs all actions and logs their results.
     */
    private async performActions() {
        const windowManager = new OO.ui.WindowManager();
        document.body.append(windowManager.$element[0]);

        const actionsDialog = new ActionsDialog(this);
        windowManager.addWindows([actionsDialog]);
        actionsDialog.open();

        const counts = { 'accepted': 0, 'denied': 0, 'commented on': 0, 'closed': 0 }; // eslint-disable-line @typescript-eslint/naming-convention

        const newPageText = (await getPageContent(this.pageTitle)) ?? '';

        void this.performSubtypeActions(actionsDialog, counts, newPageText);
    }

    /**
     * Formats a request denial reason to a {{subst:AfC redirect/category}} call.
     * @param reason The reason to format.
     */
    protected formatDeniedReason(reason: string) {
        const templateParameters = reason.startsWith('autofill:') ? /autofill:(\w+)/.exec(reason)![1] : `decline|2=${reason}`;

        const additionalReasoning =
            reason.startsWith('autofill:') && reason.includes(',') ? ' ' + reason.slice(reason.indexOf(',') + 1).trim() : '';

        return `{{subst:AfC ${this.requestPageType}|${templateParameters}}}${additionalReasoning}`;
    }

    /**
     * Maps a group of denied reasons.
     * @param deniedPages The pages to map.
     * @param singularRequest Whether the request is the only request.
     * @param allRequests Whether all requests are being mapped.
     */
    protected mapDeniedReasons(deniedPages: string[][], singularRequest: boolean, allRequests: boolean) {
        if (singularRequest) return `* ${this.formatDeniedReason(deniedPages[0][1])} ~~~~`;

        const reasons: Record<string, string[]> = {};

        for (const [page, reason] of deniedPages) {
            if (!(reason in reasons)) reasons[reason] = [];
            reasons[reason].push(page);
        }

        const reasonsArray = Object.entries(reasons);

        return reasonsArray
            .map(
                ([reason, pages]) =>
                    `* ${this.formatDeniedReason(reason)}${reasonsArray.length > 1 || !allRequests ? ` (${pages.map((page) => `[[${page}]]`).join(', ')})` : ''} ~~~~`,
            )
            .join('\n');
    }

    /**
     * Maps a group of comments.
     * @param comments The comments to map.
     * @param singularRequest Whether the request is the only request.
     * @param allRequests Whether all requests are being mapped.
     */
    protected mapComments(comments: string[][], singularRequest: boolean, allRequests: boolean) {
        if (singularRequest) return `* {{AfC comment|1=${comments[0][1]}}} ~~~~`;

        const commentMessages: Record<string, string[]> = {};

        for (const [page, comment] of comments) {
            if (!(comment in commentMessages)) commentMessages[comment] = [];
            commentMessages[comment].push(page);
        }

        const commentsArray = Object.entries(commentMessages);

        return commentsArray
            .map(
                ([comment, pages]) =>
                    `* {{AfC comment|1=${comment}}}${commentsArray.length > 1 || !allRequests ? ` (${pages.map((page) => `[[${page}]]`).join(', ')})` : ''} ~~~~`,
            )
            .join('\n');
    }

    /**
     * Modifies a given section text with prepended and appended text.
     * @param sectionData The section data.
     * @param changes The prepending and appending text.
     * @param changes.prepend The text to prepend to the section text.
     * @param changes.append The text to append to the section text.
     */
    protected modifySectionData(
        sectionData: { pageText: string } & RequestAction['originalText'],
        { prepend, append }: { prepend?: string; append?: string },
    ) {
        const { fullSectionText: oldFullSectionText, sectionText: oldSectionText } = sectionData;

        if (prepend) sectionData.sectionText = prepend + '\n' + sectionData.sectionText;
        if (append) sectionData.sectionText += '\n' + append;

        sectionData.fullSectionText = sectionData.fullSectionText.replace(oldSectionText, sectionData.sectionText);

        sectionData.pageText = sectionData.pageText.replace(oldFullSectionText, sectionData.fullSectionText);

        return sectionData;
    }

    /**
     * Makes all edits and creations that need to be made.
     * @param actionsDialog The dialog to log the results to.
     */
    protected async makeAllEditsCreations(actionsDialog: ActionsDialog) {
        for (const [index, action] of this.editsCreationsToMake.entries()) {
            const apiFunction =
                action.type === 'edit'
                    ? () => api.edit(action.title, action.transform)
                    : () => api.create(action.title, { summary: action.summary, watchlist: this.createdPageWatchMethod }, action.text);

            const linkElement = document.createElement('a');
            linkElement.target = '_blank';
            linkElement.href = mw.util.getUrl(action.title, 'isRedirect' in action && action.isRedirect ? { redirect: 'no' } : undefined);
            linkElement.textContent = action.title;

            const actionResultElementId = `afcrc-helper-action-result-${index}`;

            actionsDialog.addLogEntry(
                `${action.type === 'edit' ? 'Editing' : 'Creating'} ${linkElement.outerHTML}... <span id="${actionResultElementId}"></span>`,
            );

            // eslint-disable-next-line no-await-in-loop
            await apiFunction()
                .then((result) => {
                    if (result.result === 'Success') {
                        let linkElement: HTMLAnchorElement | undefined;
                        if (!('nochange' in result)) {
                            linkElement = document.createElement('a');
                            linkElement.target = '_blank';
                            linkElement.href = mw.util.getUrl(
                                `Special:Diff/${result.oldrevid ? `${result.oldrevid}/` : ''}${result.newrevid}`, // oldrevid is 0 on page creations, and is thus unneeded
                            );
                            linkElement.textContent = 'diff';
                        }

                        const actionResultElement = document.querySelector(`#${actionResultElementId}`)!;

                        if (linkElement) actionResultElement.append('(done, see ', linkElement, ')');
                        else actionResultElement.textContent = '(done, no changes)';
                    }
                })
                .catch(async (errorCode, errorInfo) => {
                    if (errorCode === 'ratelimited') {
                        actionsDialog.addLogEntry(
                            `Rate limited. Waiting for 70 seconds... (resuming at ${new Date(Date.now() + 70_000).toLocaleTimeString()})`,
                            'warning',
                        );
                        await new Promise((resolve) => setTimeout(resolve, 70_000));

                        actionsDialog.addLogEntry('Continuing...', 'success');

                        await apiFunction().catch((errorCode, errorInfo) => {
                            actionsDialog.addLogEntry(
                                `Error ${action.type === 'edit' ? 'editing' : 'creating'} ${linkElement.outerHTML}: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode}).`,
                                'error',
                            );
                        });
                    } else
                        actionsDialog.addLogEntry(
                            `Error ${action.type === 'edit' ? 'editing' : 'creating'} ${linkElement.outerHTML}: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode as string}).`,
                            'error',
                        );
                });
        }
    }

    /**
     * Disables the block against tab closure.
     */
    public allowTabClosure() {
        this.shouldStopTabClosure = false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected parseSubtypeRequests(sectionText: string, sectionHeader: string) {
        throw new Error('Not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected loadSubtypeElements(index: number) {
        throw new Error('Not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected updateRequestColor(detailsElement: HTMLDetailsElement, index: number) {
        throw new Error('Not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/require-await
    protected async performSubtypeActions(dialog: ActionsDialog, counts: Record<string, number>, newPageText: string) {
        throw new Error('Not implemented.');
    }
}

Object.assign(HelperDialog.prototype, OO.ui.ProcessDialog.prototype);
