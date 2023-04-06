/* global mw */

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgUserName') !== 'Eejit43' || mw.config.get('wgPageName') !== 'User:Eejit43') return;

    mw.util.addPortletLink('p-cactions', '#', 'Sync user scripts from GitHub', 'sync-scripts');
    document.getElementById('sync-scripts').addEventListener('click', async () => {
        const scriptData = await (await fetch('https://raw.githubusercontent.com/Eejit43/wikipedia-scripts/main/scripts.json')).json();

        mw.notify('Syncing scripts...', { autoHide: false, tag: 'sync-scripts-notification' });

        await Promise.all(
            scriptData.map(async (script) => {
                const subpageName = `User:Eejit43/scripts/${script.name}`;
                const subpageTalkName = `User talk:Eejit43/scripts/${script.name}`;
                const scriptName = `${subpageName}.js`;
                const styleName = `${subpageName}.css`;

                const fullSubpageInfo = [
                    '{{User:Eejit43/script-documentation', //
                    `| description-short = ${script['short-description']}`,
                    `| description       = ${script.description}`,
                    `| released          = {{start date and age|${script.released}}}`,
                    `| updated           = {{start date and age|${script.updated}}}`,
                    '}}'
                ];

                const scriptContent = await (await fetch(`https://raw.githubusercontent.com/Eejit43/wikipedia-scripts/main/scripts/${script.name}.js`)).text().catch((error) => {
                    console.error(error); // eslint-disable-line no-console
                    return false;
                });
                const styleContent = script.css
                    ? await (await fetch(`https://raw.githubusercontent.com/Eejit43/wikipedia-scripts/main/styles/${script.name}.css`)).text().catch((error) => {
                        console.error(error); // eslint-disable-line no-console
                        return false;
                    })
                    : null;

                if (!scriptContent || (script.css && !styleContent)) {
                    mw.notify(`Error syncing "${script.name}" from GitHub, skipping...`, { type: 'error' });
                    return;
                }

                if (script.subpage !== false) {
                    await editOrCreate(subpageName, fullSubpageInfo.join('\n'), 'Syncing script documentation from GitHub');
                    await editOrCreate(subpageTalkName, '#REDIRECT [[User talk:Eejit43]]', 'Redirecting script documentation talk page to main user talk page');
                }
                await editOrCreate(scriptName, `// <nowiki>\n${scriptContent}\n// </nowiki>`, 'Syncing script from GitHub');
                if (script.css) await editOrCreate(styleName, styleContent, 'Syncing CSS from GitHub');
            })
        );

        mw.notify(`Synced ${scriptData.length} scripts from GitHub!`, { type: 'success', tag: 'sync-scripts-notification' });

        /**
         * Edits a page, or creates it if it doesn't exist
         * @param {string} title the title of the page to edit
         * @param {string} text the page content to set
         * @param {string} summary the edit summary (will append script notice)
         */
        async function editOrCreate(title, text, summary) {
            summary += ' (via [[User:Eejit43/scripts/script-updater.js|script]])';
            await new mw.Api()
                .edit(title, () => ({ text, summary }))
                .catch(async (error, data) => {
                    if (error === 'nocreate-missing')
                        await new mw.Api().create(title, { summary }, text).catch((error, data) => {
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
