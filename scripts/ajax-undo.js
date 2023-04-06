/* global mw */

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgAction') !== 'history') return;

    const stages = {
        AWAITING_CLICK: 0,
        AWAITING_CONFIRMATION: 1,
        AWAITING_RELOAD: 2
    };

    mw.util.addCSS(`
/* Modified from Max Beier's "text-spinners" (https://github.com/maxbeier/text-spinners) */
#ajax-undo-loading {
    display: inline-block;
    height: 1.3em;
    line-height: 1.5em;
    margin: -0.3em 3px 0 2px;
    overflow: hidden;
    vertical-align: text-bottom;
}

#ajax-undo-loading::after {
    animation: ajax-undo-loading 0.8s steps(10) infinite;
    color: gray;
    content: '⠋\\A⠙\\A⠹\\A⠸\\A⠼\\A⠴\\A⠦\\A⠧\\A⠇\\A⠏';
    display: inline-table;
    text-align: left;
    white-space: pre;
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
`);

    document.querySelectorAll('.mw-history-undo').forEach((undoSpan) => {
        const undoUrl = new URL(undoSpan.querySelector('a').href);

        const span = document.createElement('span');

        let stage = stages.AWAITING_CLICK;

        const ajaxUndoLink = document.createElement('a');
        ajaxUndoLink.textContent = 'ajax undo';
        ajaxUndoLink.href = undoUrl.href;
        ajaxUndoLink.addEventListener('click', async (event) => {
            event.preventDefault();

            if (stage === stages.AWAITING_CLICK) {
                stage = stages.AWAITING_CONFIRMATION;

                reasonInput.style.display = 'inline';
                reasonInput.focus();

                ajaxUndoLink.textContent = 'confirm ajax undo';
            } else if (stage === stages.AWAITING_CONFIRMATION) {
                stage = stages.AWAITING_RELOAD;
                loadingSpinner.style.display = 'inline-block';
                ajaxUndoLink.style.color = 'gray';
                reasonInput.disabled = true;

                const undoId = undoUrl.searchParams.get('undo');
                const undoAfter = undoUrl.searchParams.get('undoafter');

                const revisionUser = undoSpan.closest('li').querySelector('.mw-userlink bdi').textContent;

                const success = await new mw.Api()
                    .postWithEditToken({
                        action: 'edit',
                        title: mw.config.get('wgPageName'),
                        undo: undoId,
                        undoafter: undoAfter,
                        summary: `Undid revision ${undoId} by [[Special:Contributions/${revisionUser}|${revisionUser}]] ([[User talk:${revisionUser}|talk]])${reasonInput.value ? `: ${reasonInput.value}` : ''}`
                    })
                    .catch((_, data) => {
                        mw.notify(`${data.error.info} (${data.error.code})`, { type: 'error' });
                        setTimeout(() => window.location.reload(), 2000);
                        return false;
                    });

                if (!success) return;

                mw.notify('Revision successfully undone, reloading...', { type: 'success' });
                window.location.reload();
            }
        });

        span.appendChild(ajaxUndoLink);

        const loadingSpinner = document.createElement('span');
        loadingSpinner.id = 'ajax-undo-loading';
        loadingSpinner.style.display = 'none';

        span.appendChild(loadingSpinner);

        const reasonInput = document.createElement('input');
        reasonInput.type = 'text';
        reasonInput.id = 'ajax-undo-reason';
        reasonInput.placeholder = 'Insert reason here...';
        reasonInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') ajaxUndoLink.click();
        });

        span.appendChild(reasonInput);

        undoSpan.parentElement.after(span);
    });
});
