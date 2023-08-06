if (mw.config.get('wgCanonicalSpecialPageName') === 'Search')
    for (const header of document.querySelectorAll('.mw-search-result-heading')) {
        const link = header.querySelector('a')?.href;
        if (!link) continue;

        const links = ['edit', 'history'].map((action) => {
            const url = new mw.Uri(link).extend({ action }).toString();
            const linkElement = document.createElement('a');
            linkElement.href = url;
            linkElement.textContent = action;

            return linkElement;
        });

        header.append(
            document.createTextNode(' ('), //
            ...links.flatMap((link) => [link, document.createTextNode(' | ')]).slice(0, -1),
            document.createTextNode(')'),
        );
    }
