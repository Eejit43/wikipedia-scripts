/**
 * An instance of this class is a dialog prompting the user for a target page to redirect to.
 */
export default class RedirectPageHereDialog extends OO.ui.ProcessDialog {
    private pageTitleParsed: mw.Title;

    private titleInputElement!: OO.ui.TextInputWidget;

    constructor(pageTitleParsed: mw.Title) {
        super();

        this.pageTitleParsed = pageTitleParsed;

        RedirectPageHereDialog.static.name = 'RedirectPageHereDialog';
        RedirectPageHereDialog.static.title = 'Redirect page here';
        RedirectPageHereDialog.static.actions = [
            { action: 'cancel', label: 'Close', flags: ['safe', 'close'] },
            { action: 'create', label: 'Create', flags: ['primary', 'progressive'] },
        ];
    }

    getSetupProcess = () => {
        return RedirectPageHereDialog.super.prototype.getSetupProcess.call(this).next(() => {
            const panelLayout = new OO.ui.PanelLayout({ padded: true, expanded: false });

            this.titleInputElement = new OO.ui.TextInputWidget();
            this.titleInputElement.on('enter', () => this.executeAction('create'));

            const fieldLayout = new OO.ui.FieldLayout(this.titleInputElement, {
                label: new OO.ui.HtmlSnippet('<b>Page to redirect here:</b>'),
                align: 'top',
                help: 'This title will be opened in a new tab upon clicking "Create", where the editor will automatically open and be targeting the current title.',
                helpInline: true,
            });

            panelLayout.$element.append(fieldLayout.$element);

            (this as unknown as { $body: JQuery }).$body.append(panelLayout.$element);
        });
    };

    getActionProcess = (action: string) => {
        switch (action) {
            case 'create': {
                return new OO.ui.Process(() => {
                    const title = this.titleInputElement.getValue().trim();

                    let parsedTitle = mw.Title.newFromText(title);
                    if (!parsedTitle) {
                        mw.notify('Invalid title. Please enter a valid page title.', { type: 'error' });
                        return;
                    }

                    if (parsedTitle.getFragment()) {
                        mw.notify('The title cannot contain a fragment, this will be ignored.', { type: 'warn' });
                        parsedTitle = mw.Title.newFromText(parsedTitle.getPrefixedText())!;
                    }

                    const url = parsedTitle.getUrl({ redirect: 'no', redirectHelperTarget: this.pageTitleParsed.getPrefixedText() });

                    this.close();

                    window.open(url, '_blank');
                });
            }
            case 'cancel': {
                return new OO.ui.Process(() => {
                    this.close();
                });
            }
            default: {
                return RedirectPageHereDialog.super.prototype.getActionProcess.call(this, action);
            }
        }
    };

    getTeardownProcess = () => {
        return RedirectPageHereDialog.super.prototype.getTeardownProcess.call(this).next(() => {
            (this as unknown as { $body: JQuery }).$body.empty();
        });
    };
}

Object.assign(RedirectPageHereDialog.prototype, OO.ui.ProcessDialog.prototype);
