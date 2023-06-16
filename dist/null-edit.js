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
    if (mw.config.get('wgNamespaceNumber') < 0)
        return;
    if (!mw.config.get('wgIsProbablyEditable'))
        return;
    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Null edit', 'null-edit');
    link.addEventListener('click', (event) => __awaiter(void 0, void 0, void 0, function* () {
        event.preventDefault();
        mw.notify('Null editing page...', { tag: 'null-edit-notification' });
        try {
            yield new mw.Api().edit(mw.config.get('wgPageName'), (text) => ({ text: text.content, summary: 'Null edit- if you see this, something went wrong!', minor: true }));
        }
        catch (error) {
            console.error(error);
            return mw.notify('An error occurred when null editing this page!', { type: 'error', tag: 'null-edit-notification' });
        }
        mw.notify('Successfully null edited page, reloading...', { type: 'success', tag: 'null-edit-notification' });
        window.location.reload();
    }));
});
