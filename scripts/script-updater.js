/* global mw */

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgUserName') !== 'Eejit43' || mw.config.get('wgPageName') !== 'User:Eejit43') return;

    const repoOwner = 'Eejit43';
    const repoName = 'wikipedia-scripts';

    mw.util.addPortletLink('p-cactions', '#', 'Sync user scripts from GitHub', 'sync-scripts');
    document.getElementById('sync-scripts').addEventListener('click', async () => {
        const latestCommitHash = (await (await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/commits`)).json())[0].sha;

        const scriptData = await (await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/scripts.json`)).json();

        mw.notify('Syncing scripts...', { autoHide: false, tag: 'sync-scripts-notification' });

        await Promise.all(
            scriptData.map(async (script) => {
                const subpageName = `User:Eejit43/scripts/${script.name}`;
                const subpageTalkName = `User talk:Eejit43/scripts/${script.name}`;
                const scriptName = `${subpageName}.js`;
                const styleName = `${subpageName}.css`;

                const fullSubpageInfo = [
                    '{{User:Eejit43/script-documentation', //
                    script['other-authors'] ? `| other-authors     = ${script['other-authors'].map((author) => `[[User:${author}|${author}]]`).join(', ')}` : null,
                    `| description-short = ${script['short-description']}`,
                    `| description       = ${script.description}`,
                    `| skin-support      = {{User:Eejit43/skin-support|${Object.entries(script['skin-support'])
                        .map(([skin, status]) => `${skin}=${status}`)
                        .join('|')}}}`,
                    `| released          = {{start date and age|${script.released}}}`,
                    `| updated           = {{start date and age|${script.updated}}}`,
                    '}}'
                ].filter(Boolean);

                const scriptContent = await (await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/scripts/${script.name}.js`)).text().catch((error) => {
                    console.error(error); // eslint-disable-line no-console
                    return false;
                });
                const styleContent = script.css
                    ? await (await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/styles/${script.name}.css`)).text().catch((error) => {
                          console.error(error); // eslint-disable-line no-console
                          return false;
                      })
                    : null;

                if (!scriptContent || (script.css && !styleContent)) {
                    mw.notify(`Error syncing "${script.name}" from GitHub, skipping...`, { type: 'error' });
                    return;
                }

                if (!script.personal) {
                    await editOrCreate(subpageName, fullSubpageInfo.join('\n'), 'Syncing script documentation from GitHub');
                    await editOrCreate(subpageTalkName, '#REDIRECT [[User talk:Eejit43]]', 'Redirecting script documentation talk page to main user talk page');
                }
                await editOrCreate(scriptName, `// <nowiki>\n${scriptContent}\n// </nowiki>`, 'Syncing script from GitHub');
                if (script.css) await editOrCreate(styleName, styleContent, 'Syncing CSS from GitHub');
            })
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
                mapScripts(scriptData.filter((script) => script.fork))
            ].join('\n'),
            'Syncing script list from GitHub'
        );

        mw.notify(`Synced ${scriptData.length} scripts from GitHub!`, { type: 'success', tag: 'sync-scripts-notification' });

        /**
         * Maps scripts to a bulleted list
         * @param {object[]} scripts The scripts to map
         * @returns {string} The mapped scripts
         */
        function mapScripts(scripts) {
            return scripts.map((script) => `* [[User:Eejit43/scripts/${script.name}${script.personal ? '.js' : ''}|${script.name}]] - ${script['short-description'] || script.description}`).join('\n');
        }

        /**
         * Edits a page, or creates it if it doesn't exist
         * @param {string} title the title of the page to edit
         * @param {string} text the page content to set
         * @param {string} summary the edit summary (will append script notice)
         */
        async function editOrCreate(title, text, summary) {
            summary += ' (via [[User:Eejit43/scripts/script-updater.js|script]])';
            await new mw.Api()
                .edit(title, () => ({ text, summary, watchlist: 'watch' }))
                .catch(async (error, data) => {
                    if (error === 'nocreate-missing')
                        await new mw.Api().create(title, { summary, watchlist: 'watch' }, text).catch((error, data) => {
                            console.error(error); // eslint-disable-line no-console
                            mw.notify(`Error creating ${title}: ${data.error.info} (${error})`, { type: 'error' });
                            return;
                        });
                    else {
                        console.error(error); // eslint-disable-line no-console
                        mw.notify(`Error editing or creating ${title}: ${data.error.info} (${error})`, { type: 'error' });
                        return;
                    }
                });
        }
    });
});
