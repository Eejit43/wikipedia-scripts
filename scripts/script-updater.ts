import type { MediaWikiDataError } from '../global-types';

interface Script {
    'name': string;
    'in-development'?: boolean;
    'use-instead'?: string;
    'image'?: false;
    'image-caption'?: string;
    'short-description': string;
    'description': string;
    'usage'?: string;
    'configuration'?: string;
    'changelog'?: Record<string, string | string[]>;
    'other-authors'?: string[];
    'fork'?: true;
    'personal'?: true;
    'skin-support': Record<string, boolean>;
    'released': string;
    'updated': string;
    'css'?: true;
}

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui-windows'], () => {
    if (mw.config.get('wgUserName') !== 'Eejit43' || mw.config.get('wgPageName') !== 'User:Eejit43') return;

    const fullLinkElement = document.querySelector('.mw-editsection')!.cloneNode(true) as HTMLSpanElement;

    const link = document.createElement('a');
    link.href = '#';
    link.style.fontWeight = 'bold';
    link.textContent = 'Sync from GitHub';
    link.addEventListener('click', (event) => {
        event.preventDefault();

        const windowManager = new OO.ui.WindowManager();
        document.body.append(windowManager.$element[0]);

        const scriptUpdaterDialog = new ScriptUpdaterDialog();
        windowManager.addWindows([scriptUpdaterDialog]);

        scriptUpdaterDialog.open();
    });

    fullLinkElement.querySelector('a')!.replaceWith(link);

    document.querySelector('h2#My_user_scripts + .mw-editsection')!.after(fullLinkElement);

    /**
     * An instance of this class is a dialog that manages updating scripts.
     */
    class ScriptUpdaterDialog extends OO.ui.ProcessDialog {
        private repoOwner = 'Eejit43';
        private repoName = 'wikipedia-scripts';

        private content!: OO.ui.PanelLayout;
        private checkboxElements: [string, OO.ui.CheckboxInputWidget][] = [];

        private latestCommitHash!: string;
        private scripts!: Script[];

        constructor() {
            super({ size: 'medium' });

            ScriptUpdaterDialog.static.name = 'ScriptUpdaterDialog';
            ScriptUpdaterDialog.static.title = 'What scripts do you want to update?';
            ScriptUpdaterDialog.static.actions = [
                { action: 'cancel', label: 'Close', flags: ['safe', 'close'] },
                { action: 'save', label: 'Run', flags: ['primary', 'progressive'] },
            ];
        }

        getSetupProcess = () => {
            return ScriptUpdaterDialog.super.prototype.getSetupProcess.call(this).next(() => {
                return this.wrapAsyncMethod(this.loadScriptData).then((error?: string) => {
                    if (error) {
                        const messageElement = new OO.ui.MessageWidget({ type: 'error', label: error });

                        this.content = new OO.ui.PanelLayout({ padded: true, expanded: false });
                        this.content.$element.append(messageElement.$element);

                        (this as unknown as { $body: JQuery }).$body.append(this.content.$element);

                        this.getActions().setAbilities({ save: false });

                        return;
                    }

                    this.content = new OO.ui.PanelLayout({ padded: true, expanded: false });

                    for (const script of this.scripts) {
                        const checkbox = new OO.ui.CheckboxInputWidget();

                        this.checkboxElements.push([script.name, checkbox]);

                        const layout = new OO.ui.FieldLayout(checkbox, { align: 'inline', label: script.name });

                        this.content.$element.append(layout.$element);
                    }

                    (this as unknown as { $body: JQuery }).$body.append(this.content.$element);
                });
            });
        };

        getActionProcess = (action: string) => {
            if (action === 'cancel')
                return new OO.ui.Process(() => {
                    this.getManager().closeWindow(this);
                });
            else if (action === 'save')
                return new OO.ui.Process(() => {
                    const selectedScripts = [];
                    for (const [scriptName, checkbox] of this.checkboxElements)
                        if (checkbox.isSelected()) selectedScripts.push(this.scripts.find((script) => script.name === scriptName)!);

                    this.getManager().closeWindow(this);

                    (async () => {
                        mw.notify('Syncing scripts...', { tag: 'sync-scripts-notification' });

                        await Promise.all(selectedScripts.map((script) => this.handleScript(script)));

                        await this.editOrCreate(
                            'User:Eejit43/scripts-info',
                            [
                                this.mapScripts(this.scripts.filter((script) => !script.personal && !script.fork)), //
                                '',
                                '=== Forks ===',
                                this.mapScripts(this.scripts.filter((script) => script.fork)),
                                '',
                                '=== Personal scripts ===',
                                this.mapScripts(this.scripts.filter((script) => script.personal)),
                            ].join('\n'),
                            'Syncing script list from GitHub',
                        );

                        mw.notify(`Synced ${selectedScripts.length} script${selectedScripts.length === 1 ? '' : 's'} from GitHub!`, {
                            type: 'success',
                            tag: 'sync-scripts-notification',
                        });
                    })();
                });
            else return ScriptUpdaterDialog.super.prototype.getActionProcess.call(this, action);
        };

        getTeardownProcess = () => {
            return ScriptUpdaterDialog.super.prototype.getTeardownProcess.call(this).next(() => {
                (this as unknown as { $body: JQuery }).$body.empty();
            });
        };

        /**
         * Wraps an async method into a jQuery Deferred object.
         * @param method The method to wrap.
         */
        private wrapAsyncMethod(method: () => Promise<unknown>) {
            const deferred = $.Deferred();

            method().then((result) => deferred.resolve(result));

            return deferred.promise();
        }

        /**
         * Loads data for all scripts.
         */
        private loadScriptData = async () => {
            const latestCommitHashResponse = await fetch(`https://api.github.com/repos/${this.repoOwner}/${this.repoName}/commits`);
            if (!latestCommitHashResponse.ok)
                return `Failed to fetch latest commit hash from GitHub: ${latestCommitHashResponse.statusText} (${latestCommitHashResponse.status})`;

            this.latestCommitHash = ((await latestCommitHashResponse.json()) as { sha: string }[])[0].sha;

            const scriptDataResponse = await fetch(
                `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.latestCommitHash}/scripts.json`,
            );
            if (!scriptDataResponse.ok)
                return `Failed to fetch script data from GitHub: ${scriptDataResponse.statusText} (${scriptDataResponse.status})`;

            this.scripts = (await scriptDataResponse.json()) as Script[];
        };

        /**
         * Handles and edits/creates pages for a given script.
         * @param script The script to handle.
         */
        private async handleScript(script: Script) {
            const subpageName = `User:Eejit43/scripts/${script.name}`;
            const subpageTalkName = `User talk:Eejit43/scripts/${script.name}`;
            const scriptName = `${subpageName}.js`;
            const styleName = `${subpageName}.css`;

            const fullSubpageInfo = [
                '{{User:Eejit43/script-documentation', //
                script.image === false ? `| image             = ${script.image}` : null,
                script['in-development'] ? `| in-development    = ${script['in-development']}` : null,
                script['use-instead']
                    ? `| use-instead       = ${script['use-instead'].includes('User:') ? script['use-instead'] : `[[User:Eejit43/scripts/${script['use-instead']}|${script['use-instead']}]]`}`
                    : null,
                script['image-caption'] ? `| image-caption     = ${script['image-caption']}` : null,
                script['other-authors']
                    ? `| other-authors     = ${script['other-authors'].map((author) => `[[User:${author}|${author}]]`).join(', ')}`
                    : null,
                `| description-short = ${script['short-description']}`,
                `| description       = ${script.description}`,
                script.usage ? `| usage             = ${script.usage}` : null,
                script.configuration ? `| configuration     = ${script.configuration}` : null,
                script.changelog
                    ? `| changelog         = \n${Object.entries(script.changelog)
                          .map(
                              ([date, description]) =>
                                  `* '''{{start date and age|${date}}}:'''${Array.isArray(description) ? `\n${description.map((line) => `** ${line}`).join('\n')}` : ` ${description}`}`,
                          )
                          .join('\n')}`
                    : null,
                `| skin-support      = {{User:Eejit43/script-documentation/skin-support|${Object.entries(script['skin-support'])
                    .map(([skin, status]) => `${skin}=${status}`)
                    .join('|')}}}`,
                `| released          = {{start date and age|${script.released}}}`,
                `| updated           = {{start date and age|${script.updated}}}`,
                '}}',
            ].filter(Boolean);

            let scriptContent = null;

            const scriptContentResponse = await fetch(
                `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.latestCommitHash}/dist/scripts/${script.name}.js`,
            );
            if (scriptContentResponse.ok) scriptContent = await scriptContentResponse.text();
            else
                return mw.notify(
                    `Failed to fetch "${script.name}.js" from GitHub: ${scriptContentResponse.statusText} (${scriptContentResponse.status})`,
                    {
                        type: 'error',
                        tag: 'sync-scripts-notification',
                    },
                );

            let styleContent = null;
            if (script.css) {
                const styleContentResponse = await fetch(
                    `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.latestCommitHash}/dist/styles/${script.name}.css`,
                );

                if (styleContentResponse.ok) styleContent = await styleContentResponse.text();
                else
                    mw.notify(
                        `Failed to fetch "${script.name}.css" from GitHub: ${styleContentResponse.statusText} (${styleContentResponse.status})`,
                        {
                            type: 'error',
                            tag: 'sync-scripts-notification',
                        },
                    );
            }

            if (!script.personal) {
                await this.editOrCreate(subpageName, fullSubpageInfo.join('\n'), 'Syncing script documentation from GitHub');
                await this.editOrCreate(
                    subpageTalkName,
                    '#REDIRECT [[User talk:Eejit43]]',
                    'Redirecting script documentation talk page to main user talk page',
                );
            }

            if (scriptContent) await this.editOrCreate(scriptName, scriptContent, 'Syncing script from GitHub');

            if (script.css && styleContent) await this.editOrCreate(styleName, styleContent, 'Syncing styles from GitHub');
        }

        /**
         * Maps scripts to a bulleted list.
         * @param scripts The scripts to map.
         * @returns The mapped scripts.
         */
        private mapScripts(scripts: Script[]) {
            return scripts
                .map(
                    (script) =>
                        `* [[User:Eejit43/scripts/${script.name}${script.personal ? '.js' : ''}|${script.name}]] - ${script['short-description'] || script.description}${
                            script['in-development'] ? ' (<span style="color: #bd2828">in development</span>)' : ''
                        }${script['use-instead'] ? ' (<span style="color: #bd2828">deprecated</span>)' : ''}`,
                )
                .join('\n');
        }

        /**
         * Edits a page, or creates it if it doesn't exist.
         * @param title The title of the page to edit.
         * @param text The page content to set.
         * @param summary The edit summary (will append script notice).
         */
        private async editOrCreate(title: string, text: string, summary: string) {
            summary += ' (via [[User:Eejit43/scripts/script-updater.js|script]])';
            await new mw.Api()
                .edit(title, () => ({ text, summary, watchlist: 'watch' }))
                .catch(async (errorCode: string, errorInfo: MediaWikiDataError) => {
                    if (errorCode === 'nocreate-missing')
                        await new mw.Api()
                            .create(title, { summary, watchlist: 'watch' }, text)
                            .catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                                mw.notify(`Error creating ${title}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, {
                                    type: 'error',
                                });
                                return;
                            });
                    else {
                        mw.notify(`Error editing or creating ${title}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, {
                            type: 'error',
                        });
                        return;
                    }
                });
        }
    }

    Object.assign(ScriptUpdaterDialog.prototype, OO.ui.ProcessDialog.prototype);
});
