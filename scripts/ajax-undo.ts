import type { MediaWikiDataError } from '../global-types';
import cssContent from '../styles/ajax-undo.css' with { type: 'css' };

mw.loader.using(['mediawiki.util'], () => {
    const isDiff = mw.config.get('wgDiffOldId');

    if (mw.config.get('wgAction') !== 'history' && !isDiff) return;

    mw.util.addCSS(cssContent);

    const isMinerva = mw.config.get('skin') === 'minerva';

    const STAGES = {
        awaitingClick: 0,
        awaitingConfirmation: 1,
        awaitingReload: 2,
    };

    for (const undoSpan of document.querySelectorAll('.mw-history-undo, .mw-diff-undo')) {
        const undoLink = undoSpan.querySelector('a');

        if (!undoLink?.href) {
            mw.notify('ajax-undo: Could not find undo link for a diff!', { type: 'error' });
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

                if (isMinerva) ajaxUndoLink.append(loadingSpinner);

                const undoId = undoUrl.searchParams.get('undo');
                const undoAfter = undoUrl.searchParams.get('undoafter');

                if (!undoId || !undoAfter) {
                    mw.notify('Could not find undo parameters in URL!', { type: 'error' });
                    return;
                }

                const revisionUser = undoSpan.closest(isDiff ? 'td' : 'li')?.querySelector('.mw-userlink bdi')?.textContent;

                if (!revisionUser) {
                    mw.notify('Could not find revision user!', { type: 'error' });
                    return;
                }

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
                    .catch((errorCode, errorInfo) => {
                        mw.notify(
                            `Error undoing revision: ${(errorInfo as MediaWikiDataError)?.error.code ?? 'Unknown error'} (${errorCode})`,
                            {
                                type: 'error',
                            },
                        );
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
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

        if (isMinerva && !isDiff) span.prepend(reasonInput);
        else span.append(reasonInput);

        if (isDiff) span.append(document.createTextNode(')'));

        if (isDiff) {
            undoSpan.after(span);
            undoSpan.after(document.createTextNode(' '));
        } else if (isMinerva) undoSpan.parentElement?.before(span);
        else undoSpan.parentElement?.after(span);
    }
});
