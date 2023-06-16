"use strict";
if (mw.config.get('wgCanonicalSpecialPageName') === 'Search')
    document.querySelectorAll('.mw-search-result-heading').forEach((header) => {
        var _a;
        const link = (_a = header.querySelector('a')) === null || _a === void 0 ? void 0 : _a.href;
        if (!link)
            return;
        const links = ['edit', 'history'].map((action) => {
            const url = new mw.Uri(link).extend({ action }).toString();
            const linkElement = document.createElement('a');
            linkElement.href = url;
            linkElement.textContent = action;
            return linkElement;
        });
        header.append(document.createTextNode(' ('), ...links
            .map((link) => [link, document.createTextNode(' | ')])
            .flat()
            .slice(0, -1), document.createTextNode(')'));
    });
