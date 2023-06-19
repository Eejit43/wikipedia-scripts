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
mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui.styles.icons-editing-core'], () => {
    var _a;
    if (mw.config.get('wgNamespaceNumber') < 0)
        return;
    if (!mw.config.get('wgIsProbablyEditable'))
        return;
    mw.util.addCSS(`
#displaytitle-edit-button {
    font-size: 15px;
    margin-left: 3px;
    margin-right: 0;
}

#displaytitle-edit-box {
    display: inline-block;
    font-size: 15px;
    margin-bottom: 2px;
    max-width: 200px;
    width: 200px;
    ${mw.config.get('skin') === 'modern' ? 'margin-top: 2px;' : ''}
}`);
    if (mw.config.get('skin') === 'modern')
        mw.util.addCSS(`
#mw_header {
    height: 2.5em;
}

#p-personal {
    top: 2.5em;
}

#mw_main {
    margin-top: 4em;
}`);
    const editButton = new OO.ui.ButtonWidget({ icon: 'edit', framed: false, id: 'displaytitle-edit-button' });
    editButton.on('click', () => __awaiter(void 0, void 0, void 0, function* () {
        editButton.setDisabled(true);
        if (mw.config.get('skin') === 'modern')
            mw.util.addCSS(`
#mw_header {
    height: 3em;
}

#p-personal {
    top: 3em;
}

#mw_main {
    margin-top: 4.5em;
}`);
        const actualTitle = mw.config.get('wgPageName').replace(/_/g, ' ');
        const editBox = new OO.ui.TextInputWidget({ placeholder: actualTitle, id: 'displaytitle-edit-box' });
        editBox.on('enter', () => __awaiter(void 0, void 0, void 0, function* () {
            editBox.setDisabled(true);
            editBox.pushPending();
            yield new mw.Api().edit(mw.config.get('wgPageName'), (revision) => {
                const text = revision.content.replace(/{{\s*DISPLAYTITLE\s*:\s*(.*?)\s*}}\n?/gi, '');
                if (!editBox.getValue() || editBox.getValue().replace(/_/g, ' ') === actualTitle)
                    return { text, summary: 'Removing DISPLAYTITLE (via [[User:Eejit43/scripts/displaytitle-editor|script]])' };
                const isAdded = text === revision.content;
                if (/{{short description/i.test(text))
                    return { text: text.replace(/{{short description(.*?)}}/i, `{{short description$1}}\n{{DISPLAYTITLE:${editBox.getValue()}}}`), summary: `${isAdded ? 'Adding DISPLAYTITLE of' : 'Changing DISPLAYTITLE to'} "${editBox.getValue()}" (via [[User:Eejit43/scripts/displaytitle-editor|script]])` };
                else
                    return { text: `{{DISPLAYTITLE:${editBox.getValue()}}}\n${text}`, summary: `${isAdded ? 'Adding DISPLAYTITLE of' : 'Changing DISPLAYTITLE to'} "${editBox.getValue()}" (via [[User:Eejit43/scripts/displaytitle-editor|script]])` };
            });
            mw.notify('Successfully updated DISPLAYTITLE, reloading...', { type: 'success' });
            window.location.reload();
        }));
        editBox.setDisabled(true);
        editBox.pushPending();
        editButton.$element[0].after(editBox.$element[0]);
        const pageContent = (yield new mw.Api().get({ action: 'query', formatversion: 2, prop: 'revisions', rvprop: 'content', rvslots: '*', titles: mw.config.get('wgPageName') })).query.pages[0].revisions[0].slots.main.content;
        const foundMagicWords = pageContent.match(/{{\s*DISPLAYTITLE\s*:\s*(.*?)\s*}}/gi);
        if (foundMagicWords)
            editBox.setValue(foundMagicWords[foundMagicWords.length - 1].replace(/{{\s*DISPLAYTITLE\s*:\s*(.*?)\s*}}/i, '$1'));
        editBox.setDisabled(false);
        editBox.popPending();
    }));
    (_a = document.getElementById('firstHeading')) === null || _a === void 0 ? void 0 : _a.appendChild(editButton.$element[0]);
});
