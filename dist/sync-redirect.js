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
mw.loader.using(['mediawiki.util'], () => __awaiter(void 0, void 0, void 0, function* () {
    if (!mw.Title.isTalkNamespace(mw.config.get('wgNamespaceNumber')))
        return;
    const mainPageInfoRevisions = (yield new mw.Api().get({ action: 'query', formatversion: 2, prop: 'info|revisions', rvprop: 'content', rvslots: '*', titles: `${mw.config.get('wgFormattedNamespaces')[mw.config.get('wgNamespaceNumber') - 1]}:${mw.config.get('wgTitle')}` }));
    if (!mainPageInfoRevisions.query.pages[0].redirect)
        return;
    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Sync with main page redirect', 'sync-redirect');
    link.addEventListener('click', (event) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        event.preventDefault();
        mw.notify('Editing...', { tag: 'sync-redirect-notification' });
        const mainPageContent = mainPageInfoRevisions.query.pages[0].revisions[0].slots.main.content;
        const redirectTarget = (_a = /#REDIRECT:? *\[\[(.+)\]\]/i.exec(mainPageContent)) === null || _a === void 0 ? void 0 : _a[1].replaceAll('_', ' ').split('|')[0].split('#')[0].trim();
        if (!redirectTarget)
            return mw.notify('Failed to parse redirect target!', { type: 'error', tag: 'sync-redirect-notification' });
        const redirectTargetParsed = new DOMParser().parseFromString(redirectTarget, 'text/html').documentElement.textContent;
        if (!redirectTargetParsed)
            return mw.notify('Failed to parse redirect target!', { type: 'error', tag: 'sync-redirect-notification' });
        const mwRedirectTarget = mw.Title.newFromText(redirectTargetParsed);
        if (!mwRedirectTarget)
            return mw.notify('Failed to parse redirect target!', { type: 'error', tag: 'sync-redirect-notification' });
        const mainTargetText = mwRedirectTarget.getMainText();
        const pageMove = /{{ *r(edirect)?( from)?(( a)? page)? (move|rename|pm) *}}/i.test(mainPageContent);
        const destinationTalkNamespaceName = mw.config.get('wgFormattedNamespaces')[mwRedirectTarget.getNamespaceId() + 1];
        yield new mw.Api()
            .edit(mw.config.get('wgPageName'), () => ({ text: `#REDIRECT [[${destinationTalkNamespaceName}:${mainTargetText}]]${pageMove ? '\n\n{{Redirect category shell|\n{{R from move}}\n}}' : ''}`, summary: `Sync redirect with main page, to [[${destinationTalkNamespaceName}:${mainTargetText}]] (via [[User:Eejit43/scripts/sync-redirect|script]])`, minor: true }))
            .catch((errorCode, { error }) => __awaiter(void 0, void 0, void 0, function* () {
            if (errorCode === 'nocreate-missing')
                yield new mw.Api().create(mw.config.get('wgPageName'), { summary: `Create redirect matching main page, to [[${destinationTalkNamespaceName}:${mainTargetText}]] (via [[User:Eejit43/scripts/sync-redirect|script]])` }, `#REDIRECT [[${destinationTalkNamespaceName}:${mainTargetText}]]${pageMove ? '\n\n{{Redirect category shell|\n{{R from move}}\n}}' : ''}`).catch((errorCode, { error }) => {
                    mw.notify(`Failed to redirect page: ${error.info} (${errorCode})`, { type: 'error', tag: 'sync-redirect-notification' });
                });
            else
                mw.notify(`Failed to redirect page: ${error.info} (${errorCode})`, { type: 'error', tag: 'sync-redirect-notification' });
        }));
        mw.notify('Successfully redirected page, reloading...', { type: 'success', tag: 'sync-redirect-notification' });
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('redirect', 'no');
        window.location.href = newUrl.href;
    }));
}));
