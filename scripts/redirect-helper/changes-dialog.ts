import type { ApiComparePagesParams } from 'types-mediawiki/api_params';

/**
 * An instance of this class is a dialog used for showing changes to be made.
 */
export default class ChangesDialog extends OO.ui.ProcessDialog {
    // Utility variables
    private api = new mw.Api();

    constructor(config: OO.ui.ProcessDialog.ConfigOptions) {
        super(config);

        ChangesDialog.static.name = 'ShowChangesDialog';
        ChangesDialog.static.title = 'Changes to be made';
        ChangesDialog.static.actions = [{ action: 'cancel', label: 'Close', flags: ['safe', 'close'] }];
    }

    getSetupProcess = () => {
        return ChangesDialog.super.prototype.getSetupProcess.call(this).next(() => {
            const [oldText, newText] = this.getData() as string[];

            return this.api
                .post({
                    'action': 'compare',
                    'formatversion': '2',
                    'prop': ['diff'],
                    'fromslots': 'main',
                    'fromtext-main': oldText,
                    'fromcontentmodel-main': 'wikitext',
                    'toslots': 'main',
                    'totext-main': newText,
                    'tocontentmodel-main': 'wikitext',
                } satisfies ApiComparePagesParams & {
                    'fromtext-main': string;
                    'fromcontentmodel-main': string;
                    'totext-main': string;
                    'tocontentmodel-main': string;
                })
                .then((result) => {
                    const comparison = (result as { compare: { body: string } }).compare.body;

                    const noChangesElement = new OO.ui.MessageWidget({ type: 'warning', label: 'No changes to make!' });

                    const panelLayout = new OO.ui.PanelLayout({ padded: true, expanded: false });
                    panelLayout.$element.append(
                        comparison
                            ? `
<table class="diff diff-editfont-monospace">
    <colgroup>
        <col class="diff-marker">
        <col class="diff-content">
        <col class="diff-marker">
        <col class="diff-content">
    </colgroup>
    <tbody>
        ${comparison}
    </tbody>
</table>`
                            : noChangesElement.$element[0],
                    );

                    (this as unknown as { $body: JQuery }).$body.append(panelLayout.$element);
                });
        });
    };

    getActionProcess = (action: string) => {
        return action
            ? new OO.ui.Process(() => {
                  this.getManager().closeWindow(this);
              })
            : ChangesDialog.super.prototype.getActionProcess.call(this, action);
    };

    getTeardownProcess = () => {
        return ChangesDialog.super.prototype.getTeardownProcess.call(this).next(() => {
            (this as unknown as { $body: JQuery }).$body.empty();
        });
    };
}

Object.assign(ChangesDialog.prototype, OO.ui.ProcessDialog.prototype);
