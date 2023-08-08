import { MediaWikiDataError } from '../global-types';

mw.loader.using(['mediawiki.util'], () => {
    const isDiff = mw.config.get('wgDiffOldId');

    if (mw.config.get('wgAction') !== 'history' && !isDiff) return;

    const isMinerva = mw.config.get('skin') === 'minerva';

    const STAGES = {
        awaitingClick: 0,
        awaitingConfirmation: 1,
        awaitingReload: 2,
    };

    mw.util.addCSS(`
#ajax-undo-loading {
    display: none;
    vertical-align: text-bottom;
    height: 1.3em;
    overflow: hidden;
    line-height: 1.5em;
}

#ajax-undo-loading::after {
    display: inline-table;
    animation: ajax-undo-loading 0.8s steps(10) infinite;
    content: "⠋\\A⠙\\A⠹\\A⠸\\A⠼\\A⠴\\A⠦\\A⠧\\A⠇\\A⠏";
    color: gray;
    text-align: left;
    white-space: pre;
}

#ajax-undo-loading.is-diff {
    height: 1.55em;
}

#ajax-undo-loading:not(.is-diff) {
    margin: -0.3em 3px 0 3px;
}

#ajax-undo-loading.is-minerva:not(.is-diff) {
    float: right;
    margin-top: 0px;
}

@keyframes ajax-undo-loading {
    to {
        transform: translateY(-15em);
    }
}

#ajax-undo-reason {
    display: none;
    margin-left: 3px;
}

#ajax-undo-reason.is-minerva {
    border: revert;
    background: revert;
    padding: revert;
}

#ajax-undo-reason.is-minerva:not(.is-diff) {
    float: right;
    height: 26px;
}`);

    for (const undoSpan of document.querySelectorAll('.mw-history-undo, .mw-diff-undo')) {
        const undoLink = undoSpan.querySelector('a');

        if (!undoLink?.href) {
            mw.notify('Could not find undo link!', { type: 'error' });
            continue;
        }

        const undoUrl = new URL(undoLink.href);

        const span = document.createElement('span');

        let stage = STAGES.awaitingClick;

        const ajaxUndoLink = document.createElement('a');
        ajaxUndoLink.textContent = 'ajax undo';
        ajaxUndoLink.href = undoUrl.href;
        if (isMinerva && !isDiff) ajaxUndoLink.style.marginLeft = '1em';
        ajaxUndoLink.addEventListener('click', async (event) => {
            event.preventDefault();

            if (stage === STAGES.awaitingClick) {
                stage = STAGES.awaitingConfirmation;

                reasonInput.style.display = 'inline';
                reasonInput.focus();

                ajaxUndoLink.textContent = 'confirm ajax undo';
            } else if (stage === STAGES.awaitingConfirmation) {
                stage = STAGES.awaitingReload;
                loadingSpinner.style.display = 'inline-block';
                ajaxUndoLink.style.color = 'gray';
                reasonInput.disabled = true;

                if (isMinerva && !isDiff) ajaxUndoLink.append(loadingSpinner);

                const undoId = undoUrl.searchParams.get('undo');
                const undoAfter = undoUrl.searchParams.get('undoafter');

                if (!undoId || !undoAfter) return mw.notify('Could not find undo parameters in URL!', { type: 'error' });

                const revisionUser = undoSpan.closest(isDiff ? 'td' : 'li')?.querySelector('.mw-userlink bdi')?.textContent;

                if (!revisionUser) return mw.notify('Could not find revision user!', { type: 'error' });

                const success = await new mw.Api()
                    .postWithEditToken({
                        action: 'edit',
                        title: mw.config.get('wgPageName'),
                        undo: undoId,
                        undoafter: undoAfter,
                        summary: `Undid revision ${undoId} by [[Special:Contributions/${revisionUser}|${revisionUser}]] ([[User talk:${revisionUser}|talk]])${
                            reasonInput.value ? `: ${reasonInput.value}` : ''
                        }`,
                    })
                    .catch((errorCode: string, { error }: MediaWikiDataError) => {
                        mw.notify(`${error.info} (${errorCode})`, { type: 'error' });
                        setTimeout(() => window.location.reload(), 2000);
                        return false;
                    });

                if (!success) return;

                mw.notify('Revision successfully undone, reloading...', { type: 'success' });
                window.location.reload();
            }
        });

        if (isDiff) span.append(document.createTextNode('('));
        span.append(ajaxUndoLink);

        const loadingSpinner = document.createElement('span');
        loadingSpinner.id = 'ajax-undo-loading';
        if (isDiff) loadingSpinner.classList.add('is-diff');
        if (isMinerva) loadingSpinner.classList.add('is-minerva');

        if (!isMinerva) span.append(loadingSpinner);

        const reasonInput = document.createElement('input');
        reasonInput.type = 'text';
        reasonInput.id = 'ajax-undo-reason';
        if (isDiff) reasonInput.classList.add('is-diff');
        if (isMinerva) reasonInput.classList.add('is-minerva');
        reasonInput.placeholder = 'Insert reason here...';
        reasonInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') ajaxUndoLink.click();
        });

        if (isMinerva) span.prepend(reasonInput);
        else span.append(reasonInput);

        if (isDiff) span.append(document.createTextNode(')'));

        if (isDiff) {
            undoSpan.after(span);
            undoSpan.after(document.createTextNode(' '));
        } else if (isMinerva) undoSpan.parentElement?.before(span);
        else undoSpan.parentElement?.after(span);
    }
});
