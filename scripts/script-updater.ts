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
    'source-multiple'?: true;
    'released': string;
    'updated': string;
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
        private scriptsMultiselect!: OO.ui.CheckboxMultiselectWidget;
        private actionsMultiselect!: OO.ui.CheckboxMultiselectWidget;

        private latestCommitHash!: string;
        private scripts!: Script[];

        constructor() {
            super({ size: 'medium' });

            ScriptUpdaterDialog.static.name = 'ScriptUpdaterDialog';
            ScriptUpdaterDialog.static.title = 'script-updater';
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

                    this.scriptsMultiselect = new OO.ui.CheckboxMultiselectWidget({
                        items: this.scripts.map((script) => new OO.ui.CheckboxMultioptionWidget({ data: script.name, label: script.name })),
                    });

                    const scriptsMultiselectLayout = new OO.ui.FieldLayout(this.scriptsMultiselect, {
                        label: new OO.ui.HtmlSnippet('<b>Scripts to update:</b>'),
                        align: 'inline',
                    });

                    this.actionsMultiselect = new OO.ui.CheckboxMultiselectWidget({
                        items: [
                            { id: 'documentation', name: 'Update script documentation' },
                            { id: 'script', name: 'Update script code' },
                            { id: 'talk', name: 'Create talk redirect', selectedDefault: false },
                        ].map(
                            ({ id, name, selectedDefault }) =>
                                new OO.ui.CheckboxMultioptionWidget({ data: id, label: name, selected: selectedDefault ?? true }),
                        ),
                    });

                    const actionsMultiselectLayout = new OO.ui.FieldLayout(this.actionsMultiselect, {
                        label: new OO.ui.HtmlSnippet('<b>Actions to take (if applicable):</b>'),
                        align: 'inline',
                    });

                    this.content.$element.append(scriptsMultiselectLayout.$element);
                    this.content.$element.append(actionsMultiselectLayout.$element);

                    (this as unknown as { $body: JQuery }).$body.append(this.content.$element);
                });
            });
        };

        getActionProcess = (action: string) => {
            if (action === 'cancel')
                return new OO.ui.Process(() => {
                    this.close();
                });
            else if (action === 'save')
                return new OO.ui.Process(() => {
                    const selectedScripts = (this.scriptsMultiselect.findSelectedItemsData() as string[]).map(
                        (scriptName) => this.scripts.find((script) => script.name === scriptName)!,
                    );

                    this.close();

                    void (async () => {
                        mw.notify('Syncing scripts...', { tag: 'sync-scripts-notification' });

                        await Promise.all(selectedScripts.map((script) => this.handleScript(script)));

                        await this.editOrCreate(
                            'User:Eejit43/scripts-info',
                            [
                                this.mapScripts(this.scripts.filter((script) => !script.personal && !script.fork)),
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

            void method().then((result) => deferred.resolve(result));

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

            const scriptData = (await scriptDataResponse.json()) as Record<string, Omit<Script, 'name'>>;

            this.scripts = Object.entries(scriptData).map(([scriptName, script]) => ({ name: scriptName, ...script }));
        };

        /**
         * Handles and edits/creates pages for a given script.
         * @param script The script to handle.
         */
        private async handleScript(script: Script) {
            const actionsToTake = this.actionsMultiselect.findSelectedItemsData() as ('documentation' | 'script' | 'talk')[];

            const subpageName = `User:Eejit43/scripts/${script.name}`;
            const subpageTalkName = `User talk:Eejit43/scripts/${script.name}`;
            const scriptName = `${subpageName}.js`;

            const fullSubpageInfo = [
                '{{User:Eejit43/script-documentation',
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
                script['source-multiple'] ? `| source-multiple   = ${script['source-multiple']}` : null,
                `| released          = {{start date and age|${script.released}}}`,
                `| updated           = {{start date and age|${script.updated}}}`,
                '}}',
            ].filter(Boolean);

            let scriptContent = null;

            if (actionsToTake.includes('script')) {
                const scriptContentResponse = await fetch(
                    `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.latestCommitHash}/dist/${script.name}.js`,
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
            }

            if (!script.personal) {
                if (actionsToTake.includes('documentation'))
                    await this.editOrCreate(subpageName, fullSubpageInfo.join('\n'), 'Syncing script documentation from GitHub');

                if (actionsToTake.includes('talk'))
                    await this.editOrCreate(
                        subpageTalkName,
                        '#REDIRECT [[User talk:Eejit43]]',
                        'Redirecting script documentation talk page to main user talk page',
                    );
            }

            if (scriptContent) await this.editOrCreate(scriptName, scriptContent, 'Syncing script from GitHub');
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
                .catch(async (errorCode, errorInfo) => {
                    if (errorCode === 'nocreate-missing')
                        await new mw.Api().create(title, { summary, watchlist: 'watch' }, text).catch((errorCode, errorInfo) => {
                            mw.notify(
                                `Error creating ${title}: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                                {
                                    type: 'error',
                                },
                            );
                            return;
                        });
                    else {
                        mw.notify(
                            `Error editing or creating ${title}: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                            {
                                type: 'error',
                            },
                        );
                        return;
                    }
                });
        }
    }

    Object.assign(ScriptUpdaterDialog.prototype, OO.ui.ProcessDialog.prototype);
});
