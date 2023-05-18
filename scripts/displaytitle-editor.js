/* global mw, OO */

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui.styles.icons-editing-core'], () => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page

    mw.util.addCSS(`
#displaytitle-edit-button {
    font-size: 15px;
    margin-left: 3px;
    margin-right: 0;
}

#displaytitle-edit-box {
    display: inline-block;
    font-size: 15px;
    max-width: 200px;
    width: 200px;
}`);

    const editButton = new OO.ui.ButtonWidget({ icon: 'edit', framed: false, id: 'displaytitle-edit-button' });
    editButton.on('click', async () => {
        editButton.setDisabled(true);

        const actualTitle = mw.config.get('wgPageName').replace(/_/g, ' ');

        const editBox = new OO.ui.TextInputWidget({ placeholder: actualTitle, id: 'displaytitle-edit-box' });
        editBox.on('enter', async () => {
            editBox.setDisabled(true);
            editBox.pushPending();

            await new mw.Api().edit(mw.config.get('wgPageName'), (revision) => {
                const text = revision.content.replace(/{{\s*DISPLAYTITLE\s*:\s*(.*?)\s*}}\n?/gi, '');

                if (!editBox.getValue() || editBox.getValue().replace(/_/g, ' ') === actualTitle) return { text, summary: 'Removing DISPLAYTITLE (via [[User:Eejit43/scripts/displaytitle-editor|script]])' };

                const isAdded = text === revision.content;

                if (/{{short description/i.test(text)) return { text: text.replace(/{{short description(.*?)}}/i, `{{short description$1}}\n{{DISPLAYTITLE:${editBox.getValue()}}}`), summary: `${isAdded ? 'Adding DISPLAYTITLE of' : 'Changing DISPLAYTITLE to'} "${editBox.getValue()}" (via [[User:Eejit43/scripts/displaytitle-editor|script]])` };
                else return { text: `{{DISPLAYTITLE:${editBox.getValue()}}}\n${text}`, summary: `${isAdded ? 'Adding DISPLAYTITLE of' : 'Changing DISPLAYTITLE to'} "${editBox.getValue()}" (via [[User:Eejit43/scripts/displaytitle-editor|script]])` };
            });

            mw.notify('Successfully updated DISPLAYTITLE, reloading...', { type: 'success' });
            window.location.reload();
        });
        editBox.setDisabled(true);
        editBox.pushPending();

        editButton.$element[0].after(editBox.$element[0]);

        const pageContent = (await new mw.Api().get({ action: 'query', prop: 'revisions', formatversion: 2, titles: mw.config.get('wgPageName'), rvprop: 'content', rvslots: '*' })).query.pages[0].revisions[0].slots.main.content;

        const foundMagicWords = pageContent.match(/{{\s*DISPLAYTITLE\s*:\s*(.*?)\s*}}/gi);
        if (foundMagicWords) editBox.setValue(foundMagicWords[foundMagicWords.length - 1].replace(/{{\s*DISPLAYTITLE\s*:\s*(.*?)\s*}}/i, '$1'));

        editBox.setDisabled(false);
        editBox.popPending();
    });

    document.getElementById('firstHeading').appendChild(editButton.$element[0]);
});
