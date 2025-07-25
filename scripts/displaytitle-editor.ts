import { api, getPageContent } from '../utility';

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui.styles.icons-editing-core'], () => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page

    mw.util.addCSS(`
#displaytitle-edit-button {
    margin-right: 0;
    margin-left: 3px;
    font-size: 15px;
}

#displaytitle-edit-box {
    display: inline-block;
    ${mw.config.get('skin') === 'modern' ? 'margin-top: 2px;' : ''}
    margin-bottom: 2px;
    width: 200px;
    max-width: 200px;
    font-size: 15px;
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
    editButton.on('click', async () => {
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

        const actualTitle = mw.config.get('wgPageName').replaceAll('_', ' ');

        const editBox = new OO.ui.TextInputWidget({ placeholder: actualTitle, id: 'displaytitle-edit-box' });
        editBox.on('enter', async () => {
            editBox.setDisabled(true);
            editBox.pushPending();

            await api.edit(mw.config.get('wgPageName'), (revision) => {
                const text = revision.content.replaceAll(/{{\s*displaytitle\s*:\s*(.*?)\s*}}\n*/gi, '');

                if (!editBox.getValue() || editBox.getValue().replaceAll('_', ' ') === actualTitle)
                    return { text, summary: 'Removing DISPLAYTITLE (via [[User:Eejit43/scripts/displaytitle-editor|script]])' };

                const isAdded = text === revision.content;

                const summary = `${isAdded ? 'Adding DISPLAYTITLE of' : 'Changing DISPLAYTITLE to'} "${editBox.getValue()}" (via [[User:Eejit43/scripts/displaytitle-editor|script]])`;

                const redirectRegex = /^#redirect\s*\[\[.*?]]/i;

                if (/{{short description/i.test(text))
                    return {
                        text: text.replace(
                            /{{short description(.*?)}}/i,
                            `{{short description$1}}\n{{DISPLAYTITLE:${editBox.getValue()}}}`,
                        ),
                        summary,
                    };
                else if (redirectRegex.test(text))
                    return {
                        text: text.replace(redirectRegex, `$&\n\n{{DISPLAYTITLE:${editBox.getValue()}}}`),
                        summary,
                    };
                else return { text: `{{DISPLAYTITLE:${editBox.getValue()}}}\n${text}`, summary };
            });

            mw.notify('Successfully updated DISPLAYTITLE, reloading...', { type: 'success' });
            window.location.reload();
        });
        editBox.setDisabled(true);
        editBox.pushPending();

        editButton.$element[0].after(editBox.$element[0]);

        const pageContent = (await getPageContent(mw.config.get('wgPageName'))) ?? '';

        const foundMagicWords = pageContent.match(/{{\s*displaytitle\s*:\s*(.*?)\s*}}/gi);
        if (foundMagicWords) editBox.setValue(foundMagicWords.at(-1)!.replace(/{{\s*displaytitle\s*:\s*(.*?)\s*}}/i, '$1'));

        editBox.setDisabled(false);
        editBox.popPending();
    });

    document.querySelector('#firstHeading')?.append(editButton.$element[0]);
});
