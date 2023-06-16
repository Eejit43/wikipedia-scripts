"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgUserName') !== 'Eejit43' || mw.config.get('wgPageName') !== 'User:Eejit43')
        return;
    const repoOwner = 'Eejit43';
    const repoName = 'wikipedia-scripts';
    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Sync user scripts from GitHub', 'sync-scripts');
    link.addEventListener('click', (event) => __awaiter(void 0, void 0, void 0, function* () {
        event.preventDefault();
        const latestCommitHash = (yield (yield fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/commits`)).json())[0].sha;
        const scriptData = yield (yield fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/scripts.json`)).json();
        mw.notify('Syncing scripts...', { autoHide: false, tag: 'sync-scripts-notification' });
        yield Promise.all(scriptData.map((script) => __awaiter(void 0, void 0, void 0, function* () {
            const subpageName = `User:Eejit43/scripts/${script.name}`;
            const subpageTalkName = `User talk:Eejit43/scripts/${script.name}`;
            const scriptName = `${subpageName}.js`;
            const styleName = `${subpageName}.css`;
            const fullSubpageInfo = [
                '{{User:Eejit43/script-documentation',
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
                '}}'
            ].filter(Boolean);
            const scriptContent = yield (yield fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/dist/${script.name}.js`)).text().catch((error) => {
                console.error(error);
                return null;
            });
            const styleContent = script.css
                ? yield (yield fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/styles/${script.name}.css`)).text().catch((error) => {
                    console.error(error);
                    return null;
                })
                : null;
            if (!scriptContent || (script.css && !styleContent))
                return mw.notify(`Error syncing "${script.name}" from GitHub, skipping...`, { type: 'error' });
            if (!script.personal) {
                yield editOrCreate(subpageName, fullSubpageInfo.join('\n'), 'Syncing script documentation from GitHub');
                yield editOrCreate(subpageTalkName, '#REDIRECT [[User talk:Eejit43]]', 'Redirecting script documentation talk page to main user talk page');
            }
            yield editOrCreate(scriptName, `// <nowiki>\n// Note: This script was compiled from TypeScript. For a more readable version, see https://github.com/${repoOwner}/${repoName}/blob/main/scripts/${script.name}.ts\n\n${scriptContent}\n// </nowiki>`, 'Syncing script from GitHub');
            if (script.css && styleContent)
                yield editOrCreate(styleName, styleContent, 'Syncing CSS from GitHub');
        })));
        yield editOrCreate('User:Eejit43/scripts-info', [
            mapScripts(scriptData.filter((script) => !script.personal && !script.fork)),
            '',
            '=== Personal-use scripts ===',
            mapScripts(scriptData.filter((script) => script.personal)),
            '',
            '=== Forks ===',
            mapScripts(scriptData.filter((script) => script.fork))
        ].join('\n'), 'Syncing script list from GitHub');
        mw.notify(`Synced ${scriptData.length} scripts from GitHub!`, { type: 'success', tag: 'sync-scripts-notification' });
        function mapScripts(scripts) {
            return scripts.map((script) => `* [[User:Eejit43/scripts/${script.name}${script.personal ? '.js' : ''}|${script.name}]] - ${script['short-description'] || script.description}`).join('\n');
        }
        function editOrCreate(title, text, summary) {
            return __awaiter(this, void 0, void 0, function* () {
                summary += ' (via [[User:Eejit43/scripts/script-updater.js|script]])';
                yield new mw.Api()
                    .edit(title, () => ({ text, summary, watchlist: 'watch' }))
                    .catch((error, data) => __awaiter(this, void 0, void 0, function* () {
                    if (error === 'nocreate-missing')
                        yield new mw.Api().create(title, { summary, watchlist: 'watch' }, text).catch((error, data) => {
                            console.error(error);
                            mw.notify(`Error creating ${title}: ${data.error.info} (${error})`, { type: 'error' });
                            return;
                        });
                    else {
                        console.error(error);
                        mw.notify(`Error editing or creating ${title}: ${data.error.info} (${error})`, { type: 'error' });
                        return;
                    }
                }));
            });
        }
    }));
});
