/* global mw */

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgPageName') !== 'Special:Search') return;

    mw.util.addPortletLink('p-cactions', '#', 'Copy search result titles', 'copy-search-results');
    document.getElementById('copy-search-results').addEventListener('click', (event) => {
        event.preventDefault();

        const titles = Array.from(document.querySelectorAll('.mw-search-result-heading a[data-serp-pos]'))
            .map((element) => element.textContent)
            .join('\n');

        if (!titles) return mw.notify('No search results to copy!', { type: 'error' });

        navigator.clipboard.writeText(titles).then(
            () => mw.notify('Successfully copied search results to clipboard!', { type: 'success' }),
            () => mw.notify('An error occurred when copying search results to clipboard!', { type: 'error' })
        );
    });
});
