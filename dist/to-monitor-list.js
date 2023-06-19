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
    if (mw.config.get('wgPageName') !== 'User:Eejit43')
        return;
    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Add counts to monitoring list', 'add-monitoring-counts');
    link.addEventListener('click', (event) => __awaiter(void 0, void 0, void 0, function* () {
        event.preventDefault();
        const toCheck = JSON.parse((yield new mw.Api().get({
            action: 'query',
            formatversion: 2,
            prop: 'revisions',
            rvprop: 'content',
            rvslots: '*',
            titles: 'User:Eejit43/scripts/to-monitor-list.json'
        })).query.pages[0].revisions[0].slots.main.content);
        toCheck.categories.forEach((check) => __awaiter(void 0, void 0, void 0, function* () {
            const data = yield new mw.Api()
                .get({
                action: 'query',
                list: 'search',
                srinfo: 'totalhits',
                srnamespace: getCategory(check),
                srsearch: `incategory:"${check.category}"`
            })
                .catch((errorCode, { error }) => {
                mw.notify(`An error occurred while trying to get category members: ${error.info} (${errorCode})`, { type: 'error' });
                return null;
            });
            if (!data)
                return;
            const count = data.query.searchinfo.totalhits;
            const element = document.getElementById(`to-monitor-list-${check.id}`);
            if (!element)
                return mw.notify(`Failed to find element for ID "${check.id}"`);
            element.innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        }));
        toCheck.searches.forEach((check) => __awaiter(void 0, void 0, void 0, function* () {
            const data = yield new mw.Api()
                .get({
                action: 'query',
                list: 'search',
                srinfo: 'totalhits',
                srnamespace: getCategory(check),
                srsearch: check.search
            })
                .catch((errorCode, { error }) => {
                mw.notify(`An error occurred while trying to get search results: ${error.info} (${errorCode})`, { type: 'error' });
                return null;
            });
            if (!data)
                return;
            const count = data.query.searchinfo.totalhits;
            const element = document.getElementById(`to-monitor-list-${check.id}`);
            if (!element)
                return mw.notify(`Failed to find element for ID "${check.id}"`);
            element.innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count.toLocaleString()}</span></b>`;
        }));
        toCheck.whatLinksHere.forEach((check) => __awaiter(void 0, void 0, void 0, function* () {
            const data = yield new mw.Api()
                .get({
                action: 'query',
                bllimit: 500,
                blnamespace: getCategory(check),
                bltitle: check.title,
                list: 'backlinks'
            })
                .catch((errorCode, { error }) => {
                mw.notify(`An error occurred while trying to get backlinks: ${error.info} (${errorCode})`, { type: 'error' });
                return null;
            });
            if (!data)
                return;
            const count = data.query.backlinks.length;
            const element = document.getElementById(`to-monitor-list-${check.id}`);
            if (!element)
                return mw.notify(`Failed to find element for ID "${check.id}"`);
            element.innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        }));
        toCheck.transclusions.forEach((check) => __awaiter(void 0, void 0, void 0, function* () {
            const data = yield new mw.Api()
                .get({
                action: 'query',
                eilimit: 500,
                einamespace: getCategory(check),
                eititle: check.title,
                list: 'embeddedin'
            })
                .catch((errorCode, { error }) => {
                mw.notify(`An error occurred while trying to get transclusions: ${error.info} (${errorCode})`, { type: 'error' });
                return null;
            });
            if (!data)
                return;
            const count = data.query.embeddedin.length;
            const element = document.getElementById(`to-monitor-list-${check.id}`);
            if (!element)
                return mw.notify(`Failed to find element for ID "${check.id}"`);
            element.innerHTML = count === 0 ? '<span style="color: #00733f">None</span>' : `<b><span style="color: #bd2828">${count === 500 ? '500+' : count}</span></b>`;
        }));
        mw.notify('Successfully added missing counts to "Stuff to monitor"', { type: 'success' });
    }));
});
function getCategory({ namespace, notNamespace }) {
    var _a, _b;
    if (!namespace && !notNamespace)
        return 0;
    else if (namespace)
        return (_b = (_a = Object.entries(mw.config.get('wgFormattedNamespaces')).find(([, value]) => value === namespace)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : 0;
    else
        return Object.entries(mw.config.get('wgFormattedNamespaces'))
            .filter(([, value]) => notNamespace !== (value || 'Article'))
            .map(([key]) => key)
            .join('|');
}
