/* global mw */

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgPageName') !== 'User:Eejit43') return;

    mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Add counts to monitoring list', 'add-monitoring-counts');

    document.getElementById('add-monitoring-counts').addEventListener('click', async (event) => {
        event.preventDefault();

        const toCheck = JSON.parse(
            (
                await new mw.Api().get({
                    action: 'query',
                    prop: 'revisions',
                    formatversion: 2,
                    titles: 'User:Eejit43/scripts/to-monitor-list.json',
                    rvprop: 'content',
                    rvslots: '*'
                })
            ).query.pages[0].revisions[0].slots.main.content
        );

        toCheck.categories.forEach(async (check) => {
            const data = await new mw.Api()
                .get({
                    action: 'query',
                    list: 'search',
                    srsearch: `incategory:"${check.category}"`,
                    srnamespace: getCategory(check),
                    srinfo: 'totalhits'
                })
                .catch((_, data) => {
                    console.error(data.error); // eslint-disable-line no-console
                    mw.notify(`An error occurred while trying to get category members! (${data.error.info})`, { type: 'error' });
                    return null;
                });

            if (!data) return;

            const count = data.query.searchinfo.totalhits;

            document.getElementById(`to-monitor-list-${check.id}`).innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        });

        toCheck.searches.forEach(async (check) => {
            const data = await new mw.Api()
                .get({
                    action: 'query',
                    list: 'search',
                    srsearch: check.search,
                    srnamespace: getCategory(check),
                    srinfo: 'totalhits'
                })
                .catch((_, data) => {
                    console.error(data.error); // eslint-disable-line no-console
                    mw.notify(`An error occurred while trying to get search results! (${data.error.info})`, { type: 'error' });
                    return null;
                });

            if (!data) return;

            const count = data.query.searchinfo.totalhits;

            document.getElementById(`to-monitor-list-${check.id}`).innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count.toLocaleString()}</span></b>`;
        });

        toCheck.whatLinksHere.forEach(async (check) => {
            const data = await new mw.Api()
                .get({
                    action: 'query',
                    list: 'backlinks',
                    bltitle: check.title,
                    blnamespace: getCategory(check),
                    bllimit: 500
                })
                .catch((_, data) => {
                    console.error(data.error); // eslint-disable-line no-console
                    mw.notify(`An error occurred while trying to get backlinks! (${data.error.info})`, { type: 'error' });
                    return null;
                });

            if (!data) return;

            const count = data.query.backlinks.length;

            document.getElementById(`to-monitor-list-${check.id}`).innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        });

        toCheck.transclusions.forEach(async (check) => {
            const data = await new mw.Api()
                .get({
                    action: 'query',
                    list: 'embeddedin',
                    eititle: check.title,
                    einamespace: getCategory(check),
                    eilimit: 500
                })
                .catch((_, data) => {
                    console.error(data.error); // eslint-disable-line no-console
                    mw.notify(`An error occurred while trying to get transclusions! (${data.error.info})`, { type: 'error' });
                    return null;
                });

            if (!data) return;

            const count = data.query.embeddedin.length;

            document.getElementById(`to-monitor-list-${check.id}`).innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        });

        mw.notify('Successfully added missing counts to "Stuff to monitor"', { type: 'success' });
    });
});

/**
 * Parses the searched categories from the check object
 * @param {object} check the check object
 * @param {string} [check.namespace] the namespace to search in
 * @param {string} [check.notNamespace] the namespace to exclude from the search
 * @returns {number|string} the category ID or list of category IDs (separated by '|')
 */
function getCategory({ namespace, notNamespace }) {
    if (!namespace && !notNamespace) return 0;
    else if (namespace) return Object.entries(mw.config.get('wgFormattedNamespaces')).find(([, value]) => value === namespace)[0] ?? 0;
    else
        return Object.entries(mw.config.get('wgFormattedNamespaces'))
            .filter(([, value]) => notNamespace !== (value || 'Article'))
            .map(([key]) => key)
            .join('|');
}
