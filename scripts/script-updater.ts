import { MediaWikiDataError } from '../global-types';

interface Script {
    name: string;
    'use-instead'?: string;
    'image-size'?: string;
    'image-caption'?: string;
    'short-description': string;
    description: string;
    'other-authors'?: string[];
    fork?: true;
    personal?: true;
    'skin-support': Record<string, boolean>;
    released: string;
    updated: string;
    css?: true;
}

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgUserName') !== 'Eejit43' || mw.config.get('wgPageName') !== 'User:Eejit43') return;

    const repoOwner = 'Eejit43';
    const repoName = 'wikipedia-scripts';

    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Sync user scripts from GitHub', 'sync-scripts')!;

    link.addEventListener('click', async (event) => {
        event.preventDefault();

        const latestCommitHashResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/commits`);
        if (!latestCommitHashResponse.ok)
            return mw.notify(`Failed to fetch latest commit hash from GitHub: ${latestCommitHashResponse.statusText} (${latestCommitHashResponse.status})`, {
                type: 'error',
                tag: 'sync-scripts-notification',
            });

        const latestCommitHash = ((await latestCommitHashResponse.json()) as { sha: string }[])[0].sha;

        const scriptDataResponse = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/scripts.json`);
        if (!scriptDataResponse.ok)
            return mw.notify(`Failed to fetch script data from GitHub: ${scriptDataResponse.statusText} (${scriptDataResponse.status})`, { type: 'error', tag: 'sync-scripts-notification' });

        const scriptData = (await scriptDataResponse.json()) as Script[];

        mw.notify('Syncing scripts...', { autoHide: false, tag: 'sync-scripts-notification' });

        await Promise.all(
            scriptData.map(async (script) => {
                const subpageName = `User:Eejit43/scripts/${script.name}`;
                const subpageTalkName = `User talk:Eejit43/scripts/${script.name}`;
                const scriptName = `${subpageName}.js`;
                const styleName = `${subpageName}.css`;

                const fullSubpageInfo = [
                    '{{User:Eejit43/script-documentation', //
                    script['use-instead'] ? `| use-instead       = [[User:Eejit43/scripts/${script['use-instead']}|${script['use-instead']}]]` : null,
                    script['image-size'] ? `| image-size        = ${script['image-size']}` : null,
                    script['image-caption'] ? `| image-caption     = ${script['image-caption']}` : null,
                    script['other-authors'] ? `| other-authors     = ${script['other-authors'].map((author) => `[[User:${author}|${author}]]`).join(', ')}` : null,
                    `| description-short = ${script['short-description']}`,
                    `| description       = ${script.description}`,
                    `| skin-support      = {{User:Eejit43/skin-support|${Object.entries(script['skin-support'])
                        .map(([skin, status]) => `${skin}=${status}`)
                        .join('|')}}}`,
                    `| released          = {{start date and age|${script.released}}}`,
                    `| updated           = {{start date and age|${script.updated}}}`,
                    '}}',
                ].filter(Boolean);

                let scriptContent = null;

                const scriptContentResponse = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/dist/scripts/${script.name}.js`);
                if (scriptContentResponse.ok) scriptContent = await scriptContentResponse.text();
                else
                    return mw.notify(`Failed to fetch "${script.name}.js" from GitHub: ${scriptContentResponse.statusText} (${scriptContentResponse.status})`, {
                        type: 'error',
                        tag: 'sync-scripts-notification',
                    });

                let styleContent = null;
                if (script.css) {
                    const styleContentResponse = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/dist/styles/${script.name}.css`);

                    if (styleContentResponse.ok) styleContent = await styleContentResponse.text();
                    else
                        mw.notify(`Failed to fetch "${script.name}.css" from GitHub: ${styleContentResponse.statusText} (${styleContentResponse.status})`, {
                            type: 'error',
                            tag: 'sync-scripts-notification',
                        });
                }

                if (!script.personal) {
                    await editOrCreate(subpageName, fullSubpageInfo.join('\n'), 'Syncing script documentation from GitHub');
                    await editOrCreate(subpageTalkName, '#REDIRECT [[User talk:Eejit43]]', 'Redirecting script documentation talk page to main user talk page');
                }

                if (scriptContent)
                    await editOrCreate(
                        scriptName,
                        `// <nowiki>\n// Note: This script was compiled from TypeScript. For a more readable version, see https://github.com/${repoOwner}/${repoName}/blob/main/scripts/${script.name}.ts\n\n${scriptContent}\n// </nowiki>`,
                        'Syncing script from GitHub',
                    );

                if (script.css && styleContent)
                    await editOrCreate(
                        styleName,
                        `/* <nowiki> */\n/* Note: This script was compiled from modern CSS. For a more readable version, see https://github.com/${repoOwner}/${repoName}/blob/main/styles/${script.name}.css */\n\n${styleContent}\n/* </nowiki> */`,
                        'Syncing styles from GitHub',
                    );
            }),
        );

        await editOrCreate(
            'User:Eejit43/scripts-info',
            [
                mapScripts(scriptData.filter((script) => !script.personal && !script.fork)), //
                '',
                '=== Personal-use scripts ===',
                mapScripts(scriptData.filter((script) => script.personal)),
                '',
                '=== Forks ===',
                mapScripts(scriptData.filter((script) => script.fork)),
            ].join('\n'),
            'Syncing script list from GitHub',
        );

        mw.notify(`Synced ${scriptData.length} scripts from GitHub!`, { type: 'success', tag: 'sync-scripts-notification' });

        /**
         * Maps scripts to a bulleted list.
         * @param scripts The scripts to map.
         * @returns The mapped scripts.
         */
        function mapScripts(scripts: Script[]) {
            return scripts
                .map(
                    (script) =>
                        `* [[User:Eejit43/scripts/${script.name}${script.personal ? '.js' : ''}|${script.name}]] - ${script['short-description'] || script.description}${
                            script['use-instead'] ? ' (<span style="color: #bd2828">deprecated</span>)' : ''
                        }`,
                )
                .join('\n');
        }

        /**
         * Edits a page, or creates it if it doesn't exist.
         * @param title The title of the page to edit.
         * @param text The page content to set.
         * @param summary The edit summary (will append script notice).
         */
        async function editOrCreate(title: string, text: string, summary: string): Promise<void> {
            summary += ' (via [[User:Eejit43/scripts/script-updater.js|script]])';
            await new mw.Api()
                .edit(title, () => ({ text, summary, watchlist: 'watch' }))
                .catch(async (errorCode: string, errorInfo: MediaWikiDataError) => {
                    if (errorCode === 'nocreate-missing')
                        await new mw.Api().create(title, { summary, watchlist: 'watch' }, text).catch((errorCode: string, errorInfo: MediaWikiDataError) => {
                            mw.notify(`Error creating ${title}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                            return;
                        });
                    else {
                        mw.notify(`Error editing or creating ${title}: ${errorInfo?.error.info ?? 'Unknown error'} (${errorCode})`, { type: 'error' });
                        return;
                    }
                });
        }
    });
});
