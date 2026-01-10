import type HelperDialog from '@scripts/afcrc-helper/helper-dialog';

/**
 * An instance of this class is an action dialog.
 */
export default class ActionsDialog extends OO.ui.Dialog {
    private contentLayout!: OO.ui.PanelLayout;
    private logOutput!: HTMLDivElement;
    private closeButton!: OO.ui.ButtonWidget;

    private helperDialog!: HelperDialog;

    constructor(helperDialog: HelperDialog) {
        super({ size: 'large' });

        ActionsDialog.static.name = 'ActionsDialog';
        ActionsDialog.static.title = 'Actions';

        this.helperDialog = helperDialog;
    }

    initialize = () => {
        OO.ui.Dialog.prototype.initialize.apply(this);

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
        const messageWidget = new OO.ui.MessageWidget({ type, inline: true, label: new OO.ui.HtmlSnippet(message) });

        this.logOutput.append(messageWidget.$element[0]);

        this.updateSize();

        const bodyElement = (this as unknown as { $body: JQuery }).$body;

        bodyElement[0].scrollTo({ top: bodyElement[0].scrollHeight, behavior: 'smooth' });
    }

    /**
     * Removes the close button and adds a reload button.
     */
    public showReload() {
        this.closeButton.$element.remove();

        const reloadButton = new OO.ui.ButtonWidget({ label: 'Reload', flags: ['primary'] });
        reloadButton.on('click', () => {
            this.helperDialog.allowTabClosure();

            window.location.reload();
        });

        this.contentLayout.$element.append(reloadButton.$element);
    }
}

Object.assign(ActionsDialog.prototype, OO.ui.Dialog.prototype);
