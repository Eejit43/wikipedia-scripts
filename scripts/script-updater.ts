import type {
    CategoryMembersResult,
    LinksHereResult,
    MediaWikiDataError,
    QueryContinuation,
    RedirectsResult,
    TemplateDataResult,
} from '@/global-types';
import { api, getPageContent } from '@/utility';
import type {
    ApiQueryBacklinkspropParams,
    ApiQueryCategoryMembersParams,
    ApiQueryParams,
    TemplateDataApiTemplateDataParams,
} from 'types-mediawiki-api';
import type { ApiResponse } from 'types-mediawiki/mw/Api';

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
        private readonly REPO_OWNER = 'Eejit43';
        private readonly REPO_NAME = 'wikipedia-scripts';

        private readonly SCRIPT_MESSAGE = ' (via [[User:Eejit43/scripts/script-updater.js|script]])';

        private content!: OO.ui.PanelLayout;
        private scriptsMultiselect!: OO.ui.CheckboxMultiselectWidget;
        private actionsMultiselect!: OO.ui.CheckboxMultiselectWidget;

        private latestCommitHash!: string;
        private scripts!: Script[];

        private scriptDataUpdaters = {
            'article-cleaner': getArticleCleanerData,
            'redirect-helper': getRedirectHelperData,
        };

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
                    this.scriptsMultiselect.$element[0].style.columnCount = '2';

                    const scriptsMultiselectLayout = new OO.ui.FieldLayout(this.scriptsMultiselect, {
                        label: new OO.ui.HtmlSnippet('<b>Scripts to update:</b>'),
                        align: 'top',
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
                        align: 'top',
                    });

                    const buttonGroup = new OO.ui.ButtonGroupWidget({
                        items: Object.entries(this.scriptDataUpdaters).map(([name, updater]) => {
                            const button = new OO.ui.ButtonWidget({
                                label: name,
                                flags: ['progressive'],
                            });
                            button.on('click', async () => {
                                mw.notify(`Fetching ${name} data...`, { tag: 'update-script-data-notification' });

                                const data = await updater();

                                mw.notify(`Successfully fetched ${name} data, opening diff...`, {
                                    type: 'success',
                                    tag: 'update-script-data-notification',
                                });

                                await new Promise((resolve) => setTimeout(resolve, 500)); // Allow the notification to be shown

                                this.openDiff(`User:Eejit43/scripts/${name}.json`, data);
                            });

                            return button;
                        }),
                    });

                    const scriptDataUpdatersMultiselectLayout = new OO.ui.FieldLayout(buttonGroup, {
                        label: new OO.ui.HtmlSnippet('<b>Script data updaters:</b>'),
                        align: 'top',
                    });

                    this.content.$element.append(scriptsMultiselectLayout.$element);
                    this.content.$element.append(actionsMultiselectLayout.$element);
                    this.content.$element.append(scriptDataUpdatersMultiselectLayout.$element);

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
            const latestCommitHashResponse = await fetch(`https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/commits`);
            if (!latestCommitHashResponse.ok)
                return `Failed to fetch latest commit hash from GitHub: ${latestCommitHashResponse.statusText} (${latestCommitHashResponse.status})`;

            this.latestCommitHash = ((await latestCommitHashResponse.json()) as { sha: string }[])[0].sha;

            const scriptDataResponse = await fetch(
                `https://raw.githubusercontent.com/${this.REPO_OWNER}/${this.REPO_NAME}/${this.latestCommitHash}/scripts.json`,
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
                    `https://raw.githubusercontent.com/${this.REPO_OWNER}/${this.REPO_NAME}/${this.latestCommitHash}/dist/${script.name}.js`,
                );
                if (scriptContentResponse.ok) scriptContent = await scriptContentResponse.text();
                else
                    return mw.notify(
                        `Failed to fetch "${script.name}.js" from GitHub: ${scriptContentResponse.statusText} (${scriptContentResponse.status})`,
                        { type: 'error', tag: 'sync-scripts-notification' },
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
            summary += this.SCRIPT_MESSAGE;

            await api
                .edit(title, () => ({ text, summary, watchlist: 'watch' }))
                .catch(async (errorCode, errorInfo) => {
                    if (errorCode === 'nocreate-missing')
                        await api.create(title, { summary, watchlist: 'watch' }, text).catch((errorCode, errorInfo) => {
                            mw.notify(
                                `Error creating ${title}: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                                { type: 'error' },
                            );
                            return;
                        });
                    else {
                        mw.notify(
                            `Error editing or creating ${title}: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                            { type: 'error' },
                        );
                        return;
                    }
                });
        }

        /**
         * Opens a diff for the given page title and content.
         * @param pageTitle The title of the page to open a diff for.
         * @param content The content to set for the page.
         */
        private openDiff(pageTitle: string, content: string) {
            const formData = {
                wpTextbox1: content,
                wpSummary: `Updating data${this.SCRIPT_MESSAGE}`,
                wpDiff: '1', // Any truthy value makes this work
                wpWatchthis: '1',
                wpUltimateParam: '1', // Marks the end of form data
            };

            const formUrl = new URL(`${mw.config.get('wgScriptPath')}/index.php`, window.location.origin);
            formUrl.searchParams.set('title', pageTitle);
            formUrl.searchParams.set('action', 'submit');

            const form = document.createElement('form');
            form.action = formUrl.toString();
            form.method = 'POST';
            form.target = '_blank';

            for (const [key, value] of Object.entries(formData)) {
                const hiddenField = document.createElement('input');
                hiddenField.type = 'hidden';
                hiddenField.name = key;
                hiddenField.value = value;

                form.append(hiddenField);
            }

            document.body.append(form);
            form.submit();
            form.remove();
        }
    }

    Object.assign(ScriptUpdaterDialog.prototype, OO.ui.ProcessDialog.prototype);
});

/**
 * Gets the script data for article-cleaner.
 */
async function getArticleCleanerData() {
    const content = (await getPageContent('Wikipedia:AutoWikiBrowser/Template redirects')) ?? '';

    const replacements = content
        .matchAll(/\* {{tl\|.+/g)
        .toArray()
        .map((line) => {
            const templates = line[0].matchAll(/{{tl\|(.+?)}}/g).toArray();

            return { from: templates.slice(0, -1).map((template) => template[1]), to: templates.at(-1)![1] };
        });

    return JSON.stringify(replacements);
}

/**
 * Chunks an array into smaller arrays of a specified size.
 * @param array The array to chunk.
 * @param chunkSize The size of each chunk.
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunked = [];

    for (let index = 0; index < array.length; index += chunkSize) {
        const chunk = array.slice(index, index + chunkSize);

        chunked.push(chunk);
    }

    return chunked;
}

/**
 * Gets a continued query result from the API, returning an array of results.
 * @param query The query parameters to use for the API request.
 */
async function getContinuedQuery(query: ApiQueryParams): Promise<ApiResponse[]> {
    let iteration = 0;

    const returnValue = [];

    let response = { continue: {} } as ApiResponse & QueryContinuation;

    while ('continue' in response && iteration < 10) {
        response = await api.get({ ...query, ...response.continue } as ApiQueryParams); // eslint-disable-line no-await-in-loop

        returnValue.push(response);

        iteration++;
    }

    return returnValue;
}

/**
 * Gets the script data for redirect-helper.
 */
async function getRedirectHelperData() {
    const allRedirectTemplates = (await api.get({
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Redirect templates',
        cmlimit: 'max',
        formatversion: '2',
    } satisfies ApiQueryCategoryMembersParams)) as CategoryMembersResult;
    const allPossibleRedirectTemplates = (await api.get({
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Template redirects with possibilities',
        cmlimit: 'max',
        formatversion: '2',
    } satisfies ApiQueryCategoryMembersParams)) as CategoryMembersResult;

    const redirectTemplates = allRedirectTemplates.query.categorymembers
        .filter((page) => page.title.startsWith('Template:R ') && page.title !== 'Template:R template index')
        .map((page) => ({ name: page.title.split(':')[1], redirect: false }));
    const possibleRedirectTemplates = allPossibleRedirectTemplates.query.categorymembers
        .filter((page) => page.title.startsWith('Template:R ') && page.title !== 'Template:R with possibilities')
        .map((page) => ({ name: page.title.split(':')[1], redirect: true }));

    // eslint-disable-next-line unicorn/no-array-sort
    const allTemplates = [...redirectTemplates, ...possibleRedirectTemplates].sort((a, b) => {
        // Force comics and Middle Earth templates to the end of the list
        if (a.name.startsWith('R comics') || a.name.startsWith('R ME')) return 1;
        else if (b.name.startsWith('R comics') || b.name.startsWith('R ME')) return -1;
        else return a.name.localeCompare(b.name);
    });

    const finalData = Object.fromEntries(
        allTemplates.map((page) => [page.name, { redirect: page.redirect, parameters: {}, aliases: [] as string[] }]),
    );

    // Fetch the TemplateData for all templates
    await Promise.all(
        chunkArray(allTemplates, 50).map(async (chunk) => {
            const templateDataQueryResult = (await api.get({
                action: 'templatedata',
                titles: chunk.map((page) => `Template:${page.name}`),
                formatversion: '2',
            } satisfies TemplateDataApiTemplateDataParams)) as TemplateDataResult;

            for (const page of Object.values(templateDataQueryResult.pages)) {
                const formattedParameters = Object.fromEntries(
                    Object.entries(page.params).map(([name, data]) => [
                        name,
                        {
                            aliases: data.aliases,
                            label: data.label?.en ?? null,
                            description: data.description?.en ?? null,
                            type: data.type,
                            required: data.required,
                            suggested: data.suggested,
                            default: data.default?.en ?? null,
                            example: data.example?.en ?? null,
                        },
                    ]),
                );

                finalData[page.title.split(':')[1]].parameters = formattedParameters;
            }
        }),
    );

    // Find aliases of redirect templates
    await Promise.all(
        chunkArray(redirectTemplates, 50).map(async (chunk) => {
            const allRedirectsQueryResult = (await getContinuedQuery({
                action: 'query',
                titles: chunk.map((page) => `Template:${page.name}`),
                prop: 'redirects',
                rdnamespace: 10,
                rdlimit: 'max',
                formatversion: '2',
            } satisfies ApiQueryBacklinkspropParams)) as RedirectsResult[];

            const redirectsQueryResultPages = allRedirectsQueryResult.flatMap((result) => result.query.pages);

            for (const page of redirectsQueryResultPages) {
                const mappedRedirects =
                    page.redirects
                        ?.map((redirect) => redirect.title.split(':')[1])
                        .filter((redirect) => !possibleRedirectTemplates.some((template) => template.name === redirect))
                        .sort((a, b) => a.localeCompare(b)) ?? []; // eslint-disable-line unicorn/no-array-sort

                finalData[page.title.split(':')[1]].aliases.push(...mappedRedirects); // Data might exist from previous queries, so update instead of overwriting
            }
        }),
    );

    // Find aliases of possible redirect templates
    const allAliasesOfPossibleTemplates: string[] = [];

    await Promise.all(
        chunkArray(possibleRedirectTemplates, 50).map(async (chunk) => {
            const linksQueryResult = (await api.get({
                action: 'query',
                titles: chunk.map((page) => `Template:${page.name}`),
                prop: 'linkshere',
                lhnamespace: 10,
                lhlimit: 'max',
                formatversion: '2',
            } satisfies ApiQueryBacklinkspropParams)) as LinksHereResult;

            for (const page of linksQueryResult.query.pages) {
                const mappedRedirects =
                    page.linkshere
                        ?.filter((page) => page.redirect)
                        .map((page) => page.title.split(':')[1])
                        .filter((page) => !page.endsWith('/doc') && !page.endsWith('/sandbox'))
                        .sort((a, b) => a.localeCompare(b)) ?? []; // eslint-disable-line unicorn/no-array-sort

                allAliasesOfPossibleTemplates.push(...mappedRedirects);

                finalData[page.title.split(':')[1]].aliases = mappedRedirects;
            }
        }),
    );

    const mappedFinalData = Object.entries(finalData).map(([name, templateData]) => {
        const finalTemplateData = {
            ...(templateData.redirect ? { redirect: true } : {}),
            parameters: templateData.parameters,
            aliases: templateData.aliases.sort((a, b) => a.localeCompare(b)), // eslint-disable-line unicorn/no-array-sort
        };

        return [name, finalTemplateData] as const;
    });

    for (const possibleTemplateAlias of allAliasesOfPossibleTemplates)
        for (const [, data] of mappedFinalData)
            if (!data.redirect && data.aliases.includes(possibleTemplateAlias))
                data.aliases = data.aliases.filter((alias) => alias !== possibleTemplateAlias);

    return JSON.stringify(Object.fromEntries(mappedFinalData));
}
