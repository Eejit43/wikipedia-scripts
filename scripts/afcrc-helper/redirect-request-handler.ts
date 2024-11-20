import type { TemplateEditorElementInfo } from '../redirect-helper/redirect-helper-dialog';
import type { RequestActionType } from './helper-dialog';
import type RedirectsDialog from './redirects-dialog';
import type { RedirectAction } from './redirects-dialog';

export default class RedirectRequestHandler {
    private titleIndex: number;
    private title: string;
    private detailsElement: HTMLDetailsElement;
    private responderElement: HTMLDivElement;
    private dialog: RedirectsDialog;

    private templateParametersEditor?: HTMLDetailsElement;

    private templateEditorsInfo: TemplateEditorElementInfo[] = [];

    private commentInput!: OO.ui.TextInputWidget;

    private tagSelectLayout?: OO.ui.FieldLayout;
    private denyReasonLayout?: OO.ui.FieldLayout;
    private closingReasonLayout?: OO.ui.FieldLayout;
    private commentLayout!: OO.ui.FieldLayout;

    constructor(
        titleIndex: number,
        title: string,
        detailsElement: HTMLDetailsElement,
        responderElement: HTMLDivElement,
        dialog: RedirectsDialog,
    ) {
        this.titleIndex = titleIndex;
        this.title = title;
        this.detailsElement = detailsElement;
        this.responderElement = responderElement;
        this.dialog = dialog;
    }

    /**
     * Sets up the request handler, loading elements into the DOM.
     */
    public setup() {
        const requestedTitleDiv = document.createElement('div');

        const label = document.createElement('b');
        label.textContent = this.title;
        requestedTitleDiv.append(label);

        const actionRadioInput = new OO.ui.RadioSelectWidget({
            classes: ['afcrc-helper-action-radio'],
            items: ['Accept', 'Deny', 'Comment', 'Close', 'None'].map((label) => new OO.ui.RadioOptionWidget({ data: label, label })),
        });

        actionRadioInput.selectItemByLabel('None');

        actionRadioInput.on('choose', (selected) => this.handleActionChange(selected));

        this.loadCommentLayout();

        requestedTitleDiv.append(actionRadioInput.$element[0], this.commentLayout.$element[0]);

        this.responderElement.append(requestedTitleDiv);
    }

    /**
     * Handler for selected action changes.
     * @param selected The new selected option.
     */
    private handleActionChange(selected: OO.ui.OptionWidget) {
        setTimeout(() => this.dialog.updateSize(), 0);

        const option = (selected.getData() as string).toLowerCase() as RequestActionType;

        this.updateActionsToTake({ action: option });

        this.dialog.updateRequestColor(this.detailsElement, this.titleIndex);

        if (this.tagSelectLayout) this.tagSelectLayout.$element.hide();
        if (this.templateParametersEditor) this.templateParametersEditor.style.display = 'none';

        if (this.denyReasonLayout) this.denyReasonLayout.$element.hide();
        if (this.closingReasonLayout) this.closingReasonLayout.$element.hide();

        switch (option) {
            case 'accept': {
                if (!this.tagSelectLayout || !this.templateParametersEditor) this.loadTagSelectAndParametersEditor();

                this.tagSelectLayout!.$element.show();
                this.templateParametersEditor!.style.display = 'block';

                break;
            }
            case 'deny': {
                if (!this.denyReasonLayout) this.loadDenyReasonLayout();

                this.denyReasonLayout!.$element.show();

                break;
            }
            case 'close': {
                if (!this.closingReasonLayout) this.loadClosingReasonLayout();

                this.closingReasonLayout!.$element.show();

                break;
            }
        }

        if (['accept', 'comment', 'close'].includes(option)) {
            this.commentLayout.$element.show();

            const comment = this.commentInput.getValue().trim();

            if (comment) this.updateActionsToTake({ comment });
            else this.updateActionsToTake({ comment: undefined });
        } else {
            this.commentLayout.$element.hide();

            this.updateActionsToTake({ comment: undefined });
        }
    }

    /**
     * Loads the tag select and template parameters editors.
     */
    private loadTagSelectAndParametersEditor() {
        const tagSelect = new OO.ui.MenuTagMultiselectWidget({
            allowArbitrary: false,
            allowReordering: false,
            options: Object.entries(this.dialog.redirectTemplates).map(([tag, { redirect }]) => {
                if (!redirect) return { data: tag, label: tag };

                const label = new OO.ui.HtmlSnippet(`${tag} <i>(redirect with possibilities)</i>`);

                return { data: tag, label };
            }),
        });
        (tagSelect.getMenu() as OO.ui.MenuSelectWidget.ConfigOptions).filterMode = 'substring';
        tagSelect.on('change', () => {
            const sortedTags = (tagSelect.getValue() as string[]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            if ((tagSelect.getValue() as string[]).join(';') !== sortedTags.join(';')) tagSelect.setValue(sortedTags);

            this.updateActionsToTake({ redirectTemplates: sortedTags });

            let shownTemplateEditors = 0;
            for (const editorInfo of this.templateEditorsInfo) {
                const isTagSelected = sortedTags.includes(editorInfo.name);

                editorInfo.details.style.display = isTagSelected ? 'block' : 'none';

                if (isTagSelected) shownTemplateEditors++;
            }

            summaryElement.textContent = `Template parameters (${shownTemplateEditors > 0 ? `for ${shownTemplateEditors} template${shownTemplateEditors > 1 ? 's' : ''}` : 'none to show'})`;

            noTemplatesMessage.style.display = shownTemplateEditors > 0 ? 'none' : 'block';
        });

        this.tagSelectLayout = new OO.ui.FieldLayout(tagSelect, {
            classes: ['afcrc-helper-tag-select-layout'],
            align: 'inline',
            label: 'Redirect templates:',
        });
        this.commentLayout.$element[0].before(this.tagSelectLayout.$element[0]);

        this.templateParametersEditor = document.createElement('details');
        this.templateParametersEditor.classList.add('afcrc-helper-template-parameters-container');

        const summaryElement = document.createElement('summary');
        summaryElement.textContent = 'Template parameters (none to show)';
        this.templateParametersEditor.append(summaryElement);

        for (const [templateName, templateData] of Object.entries(this.dialog.redirectTemplates)) {
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

            this.templateParametersEditor.append(details);

            this.templateEditorsInfo.push(elementData);
        }

        this.updateActionsToTake({ redirectTemplateParameters: this.templateEditorsInfo });

        const noTemplatesMessage = document.createElement('div');
        noTemplatesMessage.id = 'afcrc-helper-no-templates-message';
        noTemplatesMessage.textContent = 'No templates with parameters to display!';

        this.templateParametersEditor.append(noTemplatesMessage);

        this.commentLayout.$element[0].before(this.templateParametersEditor);
    }

    /**
     * Loads the deny reason layout.
     */
    private loadDenyReasonLayout() {
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

        denyReasonInput.on('change', (value) => {
            this.updateActionsToTake({ denyReason: value || 'autofill:unlikely' });
        });

        denyReasonInput.setValue('autofill:unlikely');
        denyReasonInput.getMenu().selectItemByData('autofill:unlikely');

        this.denyReasonLayout = new OO.ui.FieldLayout(denyReasonInput, {
            align: 'inline',
            label: 'Deny reason:',
            help: 'Supports automatic reasoning, custom reasoning, or a combination of the two with "autofill:REASON, CUSTOM" format',
        });
        this.denyReasonLayout.$element.hide();

        this.commentLayout.$element[0].before(this.denyReasonLayout.$element[0]);
    }

    /**
     * Loads the closing reason layout.
     */
    private loadClosingReasonLayout() {
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
        closingReasonDropdown.getMenu().selectItemByData('r');

        closingReasonDropdown.getMenu().on('choose', (selected) => {
            this.updateActionsToTake({ closingReason: { name: selected.getLabel() as string, id: selected.getData() as string } });

            this.dialog.updateRequestColor(this.detailsElement, this.titleIndex);
        });

        this.closingReasonLayout = new OO.ui.FieldLayout(closingReasonDropdown, { align: 'inline', label: 'Closing reason:' });
        this.closingReasonLayout.$element.hide();

        this.commentLayout.$element[0].before(this.closingReasonLayout.$element[0]);
    }

    /**
     * Loads the comment layout.
     */
    private loadCommentLayout() {
        this.commentInput = new OO.ui.TextInputWidget();

        this.commentInput.on('change', (value) => {
            const comment = value.trim();

            if (comment) this.updateActionsToTake({ comment });
            else this.updateActionsToTake({ comment: undefined });
        });

        this.commentLayout = new OO.ui.FieldLayout(this.commentInput, {
            classes: ['afcrc-comment-input'],
            align: 'inline',
            label: 'Comment:',
        });
        this.commentLayout.$element.hide();
    }

    /**
     * Updates a request's actions data.
     * @param update The updates to make.
     */
    private updateActionsToTake(update: Partial<RedirectAction>) {
        Object.assign(this.dialog.actionsToTake[this.titleIndex].requests[this.title], update);
    }
}
