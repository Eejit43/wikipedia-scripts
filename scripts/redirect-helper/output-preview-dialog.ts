import type { ApiParseParams } from 'types-mediawiki/api_params';
import { api } from '../../utility';

/**
 * An instance of this class is a dialog used for previewing template output.
 */
export default class OutputPreviewDialog extends OO.ui.ProcessDialog {
    private pageTitleParsed: mw.Title;

    constructor(config: OO.ui.ProcessDialog.ConfigOptions, pageTitleParsed: mw.Title) {
        super(config);

        this.pageTitleParsed = pageTitleParsed;

        OutputPreviewDialog.static.name = 'OutputPreviewDialog';
        OutputPreviewDialog.static.title = 'Redirect categorization templates preview';
        OutputPreviewDialog.static.actions = [{ action: 'cancel', label: 'Close', flags: ['safe', 'close'] }];
    }

    getSetupProcess = () => {
        return OutputPreviewDialog.super.prototype.getSetupProcess.call(this).next(() => {
            return api
                .post({
                    action: 'parse',
                    formatversion: '2',
                    contentmodel: 'wikitext',
                    prop: ['text', 'categorieshtml'],
                    title: this.pageTitleParsed.getPrefixedDb(),
                    text: this.getData() as string,
                } satisfies ApiParseParams)
                .then((result) => {
                    const tagsContent = (result as { parse: { text: string } }).parse.text;
                    const categoriesContent = (result as { parse: { categorieshtml: string } }).parse.categorieshtml;

                    const panelLayout = new OO.ui.PanelLayout({ padded: true, expanded: false });
                    panelLayout.$element.append(tagsContent, categoriesContent);

                    (this as unknown as { $body: JQuery }).$body.append(panelLayout.$element);
                });
        });
    };

    getActionProcess = (action: string) => {
        return action
            ? new OO.ui.Process(() => {
                  this.close();
              })
            : OutputPreviewDialog.super.prototype.getActionProcess.call(this, action);
    };

    getTeardownProcess = () => {
        return OutputPreviewDialog.super.prototype.getTeardownProcess.call(this).next(() => {
            (this as unknown as { $body: JQuery }).$body.empty();
        });
    };
}

Object.assign(OutputPreviewDialog.prototype, OO.ui.ProcessDialog.prototype);
