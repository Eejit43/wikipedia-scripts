/* global mw */

const toCheck = {
    categories: [
        { id: 'empty-short-description', category: 'Pages with empty short description' }, //
        { id: 'disallowed-displaytitle', category: 'Pages with disallowed DISPLAYTITLE modifications' },
        { id: 'defaultsort-conflicts', category: 'Pages with DEFAULTSORT conflicts' }
    ],
    searches: [
        { id: 'wp-list-article', search: 'insource:"Wikipedia list article"' },
        { id: 'wm-list-article', search: 'insource:"Wikimedia list article"' },
        { id: 'template-incorrect-namespace', search: 'incategory:"Pages with templates in the wrong namespace" -intitle:"Contactpage-arbcom-block-appeal-prior-onwiki" -subpageof:"SDZeroBot"' },
        { id: 'draft-displaytitles', search: 'insource:"Draft" insource:/\\{\\{DISPLAYTITLE:Draft:/i' },
        { id: 'draft-defaultsorts', search: 'insource:"Draft" insource:/\\{\\{DEFAULTSORT:Draft:/i' },
        { id: 'mainspace-category-links', search: 'insource:"Category" insource:/((\\]{2}|\\}{2})[^ -�,]|[^ -�,]{2,})\\[\\[:[Cc]ategory:[A-Za-z0-9_\\-–\' ]*\\|? ?\\]\\]/' },
        { id: 'external-link-header', search: 'insource:"External link" insource:/= ?External link ?=/i' },
        { id: 'reference-header-1', search: '"Reference" insource:"Reference" insource:/=Reference=/' },
        { id: 'reference-header-2', search: '"Reference" insource:"Reference" insource:/= Reference =/' },
        { id: 'capitalized-section-titles', search: 'insource:/= ?(Personal Life|Early Life|See Also|External Links) ?=/' },
        { id: 'bold-text', search: 'insource:"Bold text" insource:/\'{3}Bold text\'{3}/ -indicates -denotes -"Class pole winner"' }, //
        { id: 'italic-text', search: 'insource:"Italic text" insource:/\'{2}Italic text\'{2}/ -indicates -denotes' },
        { id: 'heading-text', search: 'insource:"Heading text" -intitle:/Markdown|Table of contents|Org-mode|Lightweight markup language|Psalm 60|Spectrum (band)|Warnier/Orr diagram|ImpressPages|Korinna/' },
        { id: 'bulleted-list-item', search: 'insource:"Bulleted list item" -intitle:/Bullet \\(typography\\)|List of World Heritage Sites in the Philippines|Makassan contact with Australia|Presidential Succession Act|Setext/' },
        { id: 'numbered-list-item', search: 'insource:"Numbered list item"' },
        { id: 'nowiki-tag', search: 'insource:"Insert non-formatted text here"' },
        { id: 'big-text', search: 'insource:"Big text" insource:/\\<big\\>Big text\\<\\/big\\>/' },
        { id: 'small-text', search: 'insource:"Small text" insource:/\\<small\\>Small text\\<\\/small\\>/ -denotes' },
        { id: 'superscript-text', search: 'insource:"Superscript text" insource:/\\<sup\\>Superscript text\\<\\/sup\\>/' },
        { id: 'subscript-text', search: 'insource: "Subscript text" insource:/\\<sub\\>Subscript text\\<\\/sub\\>/' }
    ],
    whatLinksHere: [
        { id: 'default-redirect', title: 'Target page name' }, //
        { id: 'default-image', title: 'File:Example.jpg' }
    ],
    transclusions: [
        { id: 'cat-main-article-namespace', title: 'Template:Cat main' } //
    ]
};

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgPageName') !== 'User:Eejit43') return;

    mw.util.addPortletLink('p-cactions', '#', 'Add counts to monitoring list', 'add-monitoring-counts');

    document.getElementById('add-monitoring-counts').addEventListener('click', (event) => {
        event.preventDefault();

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
