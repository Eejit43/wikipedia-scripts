"use strict";
mw.loader.using(["mediawiki.util"], () => {
  const isDiff = mw.config.get("wgDiffOldId");
  if (mw.config.get("wgAction") !== "history" && !isDiff)
    return;
  const isMinerva = mw.config.get("skin") === "minerva";
  const STAGES = {
    awaitingClick: 0,
    awaitingConfirmation: 1,
    awaitingReload: 2
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
    content: "\u280B\\A\u2819\\A\u2839\\A\u2838\\A\u283C\\A\u2834\\A\u2826\\A\u2827\\A\u2807\\A\u280F";
    color: gray;
    text-align: left;
    white-space: pre;
}

#ajax-undo-loading.is-diff {
    height: 1.55em;
}

#ajax-undo-loading:not(.is-diff) {
    margin: -0.3em 3px 0;
}

#ajax-undo-loading.is-minerva.is-diff {
    margin: -0.2em 3px;
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
  for (const undoSpan of document.querySelectorAll(".mw-history-undo, .mw-diff-undo")) {
    const undoLink = undoSpan.querySelector("a");
    if (!undoLink?.href) {
      mw.notify("Could not find undo link!", { type: "error" });
      continue;
    }
    const undoUrl = new URL(undoLink.href);
    const span = document.createElement("span");
    let stage = STAGES.awaitingClick;
    const ajaxUndoLink = document.createElement("a");
    ajaxUndoLink.textContent = "ajax undo";
    ajaxUndoLink.href = undoUrl.href;
    if (isMinerva && !isDiff)
      ajaxUndoLink.style.marginLeft = "1em";
    ajaxUndoLink.addEventListener("click", async (event) => {
      event.preventDefault();
      if (stage === STAGES.awaitingClick) {
        stage = STAGES.awaitingConfirmation;
        reasonInput.style.display = "inline";
        reasonInput.focus();
        ajaxUndoLink.textContent = "confirm ajax undo";
      } else if (stage === STAGES.awaitingConfirmation) {
        stage = STAGES.awaitingReload;
        loadingSpinner.style.display = "inline-block";
        ajaxUndoLink.style.color = "gray";
        reasonInput.disabled = true;
        if (isMinerva)
          ajaxUndoLink.append(loadingSpinner);
        const undoId = undoUrl.searchParams.get("undo");
        const undoAfter = undoUrl.searchParams.get("undoafter");
        if (!undoId || !undoAfter)
          return mw.notify("Could not find undo parameters in URL!", { type: "error" });
        const revisionUser = undoSpan.closest(isDiff ? "td" : "li")?.querySelector(".mw-userlink bdi")?.textContent;
        if (!revisionUser)
          return mw.notify("Could not find revision user!", { type: "error" });
        const success = await new mw.Api().postWithEditToken({
          action: "edit",
          title: mw.config.get("wgPageName"),
          undo: undoId,
          undoafter: undoAfter,
          summary: `Undid revision ${undoId} by [[Special:Contributions/${revisionUser}|${revisionUser}]] ([[User talk:${revisionUser}|talk]])${reasonInput.value ? `: ${reasonInput.value}` : ""}`
        }).catch((errorCode, { error }) => {
          mw.notify(`${error.info} (${errorCode})`, { type: "error" });
          setTimeout(() => window.location.reload(), 2e3);
          return false;
        });
        if (!success)
          return;
        mw.notify("Revision successfully undone, reloading...", { type: "success" });
        window.location.reload();
      }
    });
    if (isDiff)
      span.append(document.createTextNode("("));
    span.append(ajaxUndoLink);
    const loadingSpinner = document.createElement("span");
    loadingSpinner.id = "ajax-undo-loading";
    if (isDiff)
      loadingSpinner.classList.add("is-diff");
    if (isMinerva)
      loadingSpinner.classList.add("is-minerva");
    if (!isMinerva)
      span.append(loadingSpinner);
    const reasonInput = document.createElement("input");
    reasonInput.type = "text";
    reasonInput.id = "ajax-undo-reason";
    if (isDiff)
      reasonInput.classList.add("is-diff");
    if (isMinerva)
      reasonInput.classList.add("is-minerva");
    reasonInput.placeholder = "Insert reason here...";
    reasonInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter")
        ajaxUndoLink.click();
    });
    if (isMinerva && !isDiff)
      span.prepend(reasonInput);
    else
      span.append(reasonInput);
    if (isDiff)
      span.append(document.createTextNode(")"));
    if (isDiff) {
      undoSpan.after(span);
      undoSpan.after(document.createTextNode(" "));
    } else if (isMinerva)
      undoSpan.parentElement?.before(span);
    else
      undoSpan.parentElement?.after(span);
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9hamF4LXVuZG8udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IE1lZGlhV2lraURhdGFFcnJvciB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sICgpID0+IHtcbiAgICBjb25zdCBpc0RpZmYgPSBtdy5jb25maWcuZ2V0KCd3Z0RpZmZPbGRJZCcpO1xuXG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnQWN0aW9uJykgIT09ICdoaXN0b3J5JyAmJiAhaXNEaWZmKSByZXR1cm47XG5cbiAgICBjb25zdCBpc01pbmVydmEgPSBtdy5jb25maWcuZ2V0KCdza2luJykgPT09ICdtaW5lcnZhJztcblxuICAgIGNvbnN0IFNUQUdFUyA9IHtcbiAgICAgICAgYXdhaXRpbmdDbGljazogMCxcbiAgICAgICAgYXdhaXRpbmdDb25maXJtYXRpb246IDEsXG4gICAgICAgIGF3YWl0aW5nUmVsb2FkOiAyLFxuICAgIH07XG5cbiAgICBtdy51dGlsLmFkZENTUyhgXG4jYWpheC11bmRvLWxvYWRpbmcge1xuICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgdmVydGljYWwtYWxpZ246IHRleHQtYm90dG9tO1xuICAgIGhlaWdodDogMS4zZW07XG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICBsaW5lLWhlaWdodDogMS41ZW07XG59XG5cbiNhamF4LXVuZG8tbG9hZGluZzo6YWZ0ZXIge1xuICAgIGRpc3BsYXk6IGlubGluZS10YWJsZTtcbiAgICBhbmltYXRpb246IGFqYXgtdW5kby1sb2FkaW5nIDAuOHMgc3RlcHMoMTApIGluZmluaXRlO1xuICAgIGNvbnRlbnQ6IFwiXHUyODBCXFxcXEFcdTI4MTlcXFxcQVx1MjgzOVxcXFxBXHUyODM4XFxcXEFcdTI4M0NcXFxcQVx1MjgzNFxcXFxBXHUyODI2XFxcXEFcdTI4MjdcXFxcQVx1MjgwN1xcXFxBXHUyODBGXCI7XG4gICAgY29sb3I6IGdyYXk7XG4gICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICB3aGl0ZS1zcGFjZTogcHJlO1xufVxuXG4jYWpheC11bmRvLWxvYWRpbmcuaXMtZGlmZiB7XG4gICAgaGVpZ2h0OiAxLjU1ZW07XG59XG5cbiNhamF4LXVuZG8tbG9hZGluZzpub3QoLmlzLWRpZmYpIHtcbiAgICBtYXJnaW46IC0wLjNlbSAzcHggMDtcbn1cblxuI2FqYXgtdW5kby1sb2FkaW5nLmlzLW1pbmVydmEuaXMtZGlmZiB7XG4gICAgbWFyZ2luOiAtMC4yZW0gM3B4O1xufVxuXG4jYWpheC11bmRvLWxvYWRpbmcuaXMtbWluZXJ2YTpub3QoLmlzLWRpZmYpIHtcbiAgICBmbG9hdDogcmlnaHQ7XG4gICAgbWFyZ2luLXRvcDogMHB4O1xufVxuXG5Aa2V5ZnJhbWVzIGFqYXgtdW5kby1sb2FkaW5nIHtcbiAgICB0byB7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTVlbSk7XG4gICAgfVxufVxuXG4jYWpheC11bmRvLXJlYXNvbiB7XG4gICAgZGlzcGxheTogbm9uZTtcbiAgICBtYXJnaW4tbGVmdDogM3B4O1xufVxuXG4jYWpheC11bmRvLXJlYXNvbi5pcy1taW5lcnZhIHtcbiAgICBib3JkZXI6IHJldmVydDtcbiAgICBiYWNrZ3JvdW5kOiByZXZlcnQ7XG4gICAgcGFkZGluZzogcmV2ZXJ0O1xufVxuXG4jYWpheC11bmRvLXJlYXNvbi5pcy1taW5lcnZhOm5vdCguaXMtZGlmZikge1xuICAgIGZsb2F0OiByaWdodDtcbiAgICBoZWlnaHQ6IDI2cHg7XG59YCk7XG5cbiAgICBmb3IgKGNvbnN0IHVuZG9TcGFuIG9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5tdy1oaXN0b3J5LXVuZG8sIC5tdy1kaWZmLXVuZG8nKSkge1xuICAgICAgICBjb25zdCB1bmRvTGluayA9IHVuZG9TcGFuLnF1ZXJ5U2VsZWN0b3IoJ2EnKTtcblxuICAgICAgICBpZiAoIXVuZG9MaW5rPy5ocmVmKSB7XG4gICAgICAgICAgICBtdy5ub3RpZnkoJ0NvdWxkIG5vdCBmaW5kIHVuZG8gbGluayEnLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVuZG9VcmwgPSBuZXcgVVJMKHVuZG9MaW5rLmhyZWYpO1xuXG4gICAgICAgIGNvbnN0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cbiAgICAgICAgbGV0IHN0YWdlID0gU1RBR0VTLmF3YWl0aW5nQ2xpY2s7XG5cbiAgICAgICAgY29uc3QgYWpheFVuZG9MaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgICBhamF4VW5kb0xpbmsudGV4dENvbnRlbnQgPSAnYWpheCB1bmRvJztcbiAgICAgICAgYWpheFVuZG9MaW5rLmhyZWYgPSB1bmRvVXJsLmhyZWY7XG4gICAgICAgIGlmIChpc01pbmVydmEgJiYgIWlzRGlmZikgYWpheFVuZG9MaW5rLnN0eWxlLm1hcmdpbkxlZnQgPSAnMWVtJztcbiAgICAgICAgYWpheFVuZG9MaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICBpZiAoc3RhZ2UgPT09IFNUQUdFUy5hd2FpdGluZ0NsaWNrKSB7XG4gICAgICAgICAgICAgICAgc3RhZ2UgPSBTVEFHRVMuYXdhaXRpbmdDb25maXJtYXRpb247XG5cbiAgICAgICAgICAgICAgICByZWFzb25JbnB1dC5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgICAgICAgICAgICAgcmVhc29uSW5wdXQuZm9jdXMoKTtcblxuICAgICAgICAgICAgICAgIGFqYXhVbmRvTGluay50ZXh0Q29udGVudCA9ICdjb25maXJtIGFqYXggdW5kbyc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0YWdlID09PSBTVEFHRVMuYXdhaXRpbmdDb25maXJtYXRpb24pIHtcbiAgICAgICAgICAgICAgICBzdGFnZSA9IFNUQUdFUy5hd2FpdGluZ1JlbG9hZDtcbiAgICAgICAgICAgICAgICBsb2FkaW5nU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgICAgICAgICAgICAgYWpheFVuZG9MaW5rLnN0eWxlLmNvbG9yID0gJ2dyYXknO1xuICAgICAgICAgICAgICAgIHJlYXNvbklucHV0LmRpc2FibGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGlmIChpc01pbmVydmEpIGFqYXhVbmRvTGluay5hcHBlbmQobG9hZGluZ1NwaW5uZXIpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdW5kb0lkID0gdW5kb1VybC5zZWFyY2hQYXJhbXMuZ2V0KCd1bmRvJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5kb0FmdGVyID0gdW5kb1VybC5zZWFyY2hQYXJhbXMuZ2V0KCd1bmRvYWZ0ZXInKTtcblxuICAgICAgICAgICAgICAgIGlmICghdW5kb0lkIHx8ICF1bmRvQWZ0ZXIpIHJldHVybiBtdy5ub3RpZnkoJ0NvdWxkIG5vdCBmaW5kIHVuZG8gcGFyYW1ldGVycyBpbiBVUkwhJywgeyB0eXBlOiAnZXJyb3InIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcmV2aXNpb25Vc2VyID0gdW5kb1NwYW4uY2xvc2VzdChpc0RpZmYgPyAndGQnIDogJ2xpJyk/LnF1ZXJ5U2VsZWN0b3IoJy5tdy11c2VybGluayBiZGknKT8udGV4dENvbnRlbnQ7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJldmlzaW9uVXNlcikgcmV0dXJuIG13Lm5vdGlmeSgnQ291bGQgbm90IGZpbmQgcmV2aXNpb24gdXNlciEnLCB7IHR5cGU6ICdlcnJvcicgfSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgbmV3IG13LkFwaSgpXG4gICAgICAgICAgICAgICAgICAgIC5wb3N0V2l0aEVkaXRUb2tlbih7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246ICdlZGl0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksXG4gICAgICAgICAgICAgICAgICAgICAgICB1bmRvOiB1bmRvSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1bmRvYWZ0ZXI6IHVuZG9BZnRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IGBVbmRpZCByZXZpc2lvbiAke3VuZG9JZH0gYnkgW1tTcGVjaWFsOkNvbnRyaWJ1dGlvbnMvJHtyZXZpc2lvblVzZXJ9fCR7cmV2aXNpb25Vc2VyfV1dIChbW1VzZXIgdGFsazoke3JldmlzaW9uVXNlcn18dGFsa11dKSR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVhc29uSW5wdXQudmFsdWUgPyBgOiAke3JlYXNvbklucHV0LnZhbHVlfWAgOiAnJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfWAsXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3JDb2RlOiBzdHJpbmcsIHsgZXJyb3IgfTogTWVkaWFXaWtpRGF0YUVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtdy5ub3RpZnkoYCR7ZXJyb3IuaW5mb30gKCR7ZXJyb3JDb2RlfSlgLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKSwgMjAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSByZXR1cm47XG5cbiAgICAgICAgICAgICAgICBtdy5ub3RpZnkoJ1JldmlzaW9uIHN1Y2Nlc3NmdWxseSB1bmRvbmUsIHJlbG9hZGluZy4uLicsIHsgdHlwZTogJ3N1Y2Nlc3MnIH0pO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGlzRGlmZikgc3Bhbi5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJygnKSk7XG4gICAgICAgIHNwYW4uYXBwZW5kKGFqYXhVbmRvTGluayk7XG5cbiAgICAgICAgY29uc3QgbG9hZGluZ1NwaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIGxvYWRpbmdTcGlubmVyLmlkID0gJ2FqYXgtdW5kby1sb2FkaW5nJztcbiAgICAgICAgaWYgKGlzRGlmZikgbG9hZGluZ1NwaW5uZXIuY2xhc3NMaXN0LmFkZCgnaXMtZGlmZicpO1xuICAgICAgICBpZiAoaXNNaW5lcnZhKSBsb2FkaW5nU3Bpbm5lci5jbGFzc0xpc3QuYWRkKCdpcy1taW5lcnZhJyk7XG5cbiAgICAgICAgaWYgKCFpc01pbmVydmEpIHNwYW4uYXBwZW5kKGxvYWRpbmdTcGlubmVyKTtcblxuICAgICAgICBjb25zdCByZWFzb25JbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgIHJlYXNvbklucHV0LnR5cGUgPSAndGV4dCc7XG4gICAgICAgIHJlYXNvbklucHV0LmlkID0gJ2FqYXgtdW5kby1yZWFzb24nO1xuICAgICAgICBpZiAoaXNEaWZmKSByZWFzb25JbnB1dC5jbGFzc0xpc3QuYWRkKCdpcy1kaWZmJyk7XG4gICAgICAgIGlmIChpc01pbmVydmEpIHJlYXNvbklucHV0LmNsYXNzTGlzdC5hZGQoJ2lzLW1pbmVydmEnKTtcbiAgICAgICAgcmVhc29uSW5wdXQucGxhY2Vob2xkZXIgPSAnSW5zZXJ0IHJlYXNvbiBoZXJlLi4uJztcbiAgICAgICAgcmVhc29uSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJykgYWpheFVuZG9MaW5rLmNsaWNrKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChpc01pbmVydmEgJiYgIWlzRGlmZikgc3Bhbi5wcmVwZW5kKHJlYXNvbklucHV0KTtcbiAgICAgICAgZWxzZSBzcGFuLmFwcGVuZChyZWFzb25JbnB1dCk7XG5cbiAgICAgICAgaWYgKGlzRGlmZikgc3Bhbi5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyknKSk7XG5cbiAgICAgICAgaWYgKGlzRGlmZikge1xuICAgICAgICAgICAgdW5kb1NwYW4uYWZ0ZXIoc3Bhbik7XG4gICAgICAgICAgICB1bmRvU3Bhbi5hZnRlcihkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnICcpKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc01pbmVydmEpIHVuZG9TcGFuLnBhcmVudEVsZW1lbnQ/LmJlZm9yZShzcGFuKTtcbiAgICAgICAgZWxzZSB1bmRvU3Bhbi5wYXJlbnRFbGVtZW50Py5hZnRlcihzcGFuKTtcbiAgICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFFQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixHQUFHLE1BQU07QUFDdEMsUUFBTSxTQUFTLEdBQUcsT0FBTyxJQUFJLGFBQWE7QUFFMUMsTUFBSSxHQUFHLE9BQU8sSUFBSSxVQUFVLE1BQU0sYUFBYSxDQUFDO0FBQVE7QUFFeEQsUUFBTSxZQUFZLEdBQUcsT0FBTyxJQUFJLE1BQU0sTUFBTTtBQUU1QyxRQUFNLFNBQVM7QUFBQSxJQUNYLGVBQWU7QUFBQSxJQUNmLHNCQUFzQjtBQUFBLElBQ3RCLGdCQUFnQjtBQUFBLEVBQ3BCO0FBRUEsS0FBRyxLQUFLLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FB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
