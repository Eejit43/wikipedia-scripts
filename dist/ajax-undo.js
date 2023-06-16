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
    const isDiff = mw.config.get('wgDiffOldId');
    if (mw.config.get('wgAction') !== 'history' && !isDiff)
        return;
    const isMinerva = mw.config.get('skin') === 'minerva';
    const stages = {
        AWAITING_CLICK: 0,
        AWAITING_CONFIRMATION: 1,
        AWAITING_RELOAD: 2
    };
    mw.util.addCSS(`
/* Modified from Max Beier's "text-spinners" (https://github.com/maxbeier/text-spinners) */
#ajax-undo-loading {
    display: none;
    ${isMinerva && !isDiff ? 'float: right;' : ''}
    height: ${isDiff ? '1.55' : '1.3'}em;
    line-height: 1.5em;
    ${!isDiff ? `margin: ${isMinerva ? '0' : '-0.3em'} 3px 0 2px;` : ''}
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
${isMinerva && !isDiff
        ? `float: right;
height: 26px;`
        : ''}
${isMinerva
        ? `border: revert;
background: revert;
padding: revert;`
        : ''}
}
`);
    document.querySelectorAll('.mw-history-undo, .mw-diff-undo').forEach((undoSpan) => {
        var _a, _b;
        const undoLink = undoSpan.querySelector('a');
        if (!(undoLink === null || undoLink === void 0 ? void 0 : undoLink.href))
            return mw.notify('Could not find undo link!', { type: 'error' });
        const undoUrl = new URL(undoLink.href);
        const span = document.createElement('span');
        let stage = stages.AWAITING_CLICK;
        const ajaxUndoLink = document.createElement('a');
        ajaxUndoLink.textContent = 'ajax undo';
        ajaxUndoLink.href = undoUrl.href;
        if (isMinerva && !isDiff)
            ajaxUndoLink.style.marginLeft = '1em';
        ajaxUndoLink.addEventListener('click', (event) => __awaiter(void 0, void 0, void 0, function* () {
            var _c, _d;
            event.preventDefault();
            if (stage === stages.AWAITING_CLICK) {
                stage = stages.AWAITING_CONFIRMATION;
                reasonInput.style.display = 'inline';
                reasonInput.focus();
                ajaxUndoLink.textContent = 'confirm ajax undo';
            }
            else if (stage === stages.AWAITING_CONFIRMATION) {
                stage = stages.AWAITING_RELOAD;
                loadingSpinner.style.display = 'inline-block';
                ajaxUndoLink.style.color = 'gray';
                reasonInput.disabled = true;
                if (isMinerva && !isDiff)
                    ajaxUndoLink.appendChild(loadingSpinner);
                const undoId = undoUrl.searchParams.get('undo');
                const undoAfter = undoUrl.searchParams.get('undoafter');
                if (!undoId || !undoAfter)
                    return mw.notify('Could not find undo parameters in URL!', { type: 'error' });
                const revisionUser = (_d = (_c = undoSpan.closest(isDiff ? 'td' : 'li')) === null || _c === void 0 ? void 0 : _c.querySelector('.mw-userlink bdi')) === null || _d === void 0 ? void 0 : _d.textContent;
                if (!revisionUser)
                    return mw.notify('Could not find revision user!', { type: 'error' });
                const success = yield new mw.Api()
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
                if (!success)
                    return;
                mw.notify('Revision successfully undone, reloading...', { type: 'success' });
                window.location.reload();
            }
        }));
        if (isDiff)
            span.appendChild(document.createTextNode('('));
        span.appendChild(ajaxUndoLink);
        const loadingSpinner = document.createElement('span');
        loadingSpinner.id = 'ajax-undo-loading';
        if (!isMinerva)
            span.appendChild(loadingSpinner);
        const reasonInput = document.createElement('input');
        reasonInput.type = 'text';
        reasonInput.id = 'ajax-undo-reason';
        reasonInput.placeholder = 'Insert reason here...';
        reasonInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter')
                ajaxUndoLink.click();
        });
        if (isMinerva)
            span.prepend(reasonInput);
        else
            span.appendChild(reasonInput);
        if (isDiff)
            span.appendChild(document.createTextNode(')'));
        if (isDiff) {
            undoSpan.after(span);
            undoSpan.after(document.createTextNode(' '));
        }
        else if (isMinerva)
            (_a = undoSpan.parentElement) === null || _a === void 0 ? void 0 : _a.before(span);
        else
            (_b = undoSpan.parentElement) === null || _b === void 0 ? void 0 : _b.after(span);
    });
});
