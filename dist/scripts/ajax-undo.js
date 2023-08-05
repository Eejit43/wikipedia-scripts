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
/* Modified from Max Beier's "text-spinners" (https://github.com/maxbeier/text-spinners) */
#ajax-undo-loading {
    display: none;
    ${isMinerva && !isDiff ? "float: right;" : ""}
    height: ${isDiff ? "1.55" : "1.3"}em;
    line-height: 1.5em;
    ${isDiff ? "" : `margin: ${isMinerva ? "0" : "-0.3em"} 3px 0 2px;`}
    overflow: hidden;
    vertical-align: text-bottom;
}

#ajax-undo-loading::after {
    animation: ajax-undo-loading 0.8s steps(10) infinite;
    color: gray;
    content: '\u280B\\A\u2819\\A\u2839\\A\u2838\\A\u283C\\A\u2834\\A\u2826\\A\u2827\\A\u2807\\A\u280F';
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
${isMinerva && !isDiff ? `float: right;
height: 26px;` : ""}
${isMinerva ? `border: revert;
background: revert;
padding: revert;` : ""}
}
`);
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
        if (isMinerva && !isDiff)
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
    if (!isMinerva)
      span.append(loadingSpinner);
    const reasonInput = document.createElement("input");
    reasonInput.type = "text";
    reasonInput.id = "ajax-undo-reason";
    reasonInput.placeholder = "Insert reason here...";
    reasonInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter")
        ajaxUndoLink.click();
    });
    if (isMinerva)
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9hamF4LXVuZG8udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IE1lZGlhV2lraURhdGFFcnJvciB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sICgpID0+IHtcbiAgICBjb25zdCBpc0RpZmYgPSBtdy5jb25maWcuZ2V0KCd3Z0RpZmZPbGRJZCcpO1xuXG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnQWN0aW9uJykgIT09ICdoaXN0b3J5JyAmJiAhaXNEaWZmKSByZXR1cm47XG5cbiAgICBjb25zdCBpc01pbmVydmEgPSBtdy5jb25maWcuZ2V0KCdza2luJykgPT09ICdtaW5lcnZhJztcblxuICAgIGNvbnN0IFNUQUdFUyA9IHtcbiAgICAgICAgYXdhaXRpbmdDbGljazogMCxcbiAgICAgICAgYXdhaXRpbmdDb25maXJtYXRpb246IDEsXG4gICAgICAgIGF3YWl0aW5nUmVsb2FkOiAyXG4gICAgfTtcblxuICAgIG13LnV0aWwuYWRkQ1NTKGBcbi8qIE1vZGlmaWVkIGZyb20gTWF4IEJlaWVyJ3MgXCJ0ZXh0LXNwaW5uZXJzXCIgKGh0dHBzOi8vZ2l0aHViLmNvbS9tYXhiZWllci90ZXh0LXNwaW5uZXJzKSAqL1xuI2FqYXgtdW5kby1sb2FkaW5nIHtcbiAgICBkaXNwbGF5OiBub25lO1xuICAgICR7aXNNaW5lcnZhICYmICFpc0RpZmYgPyAnZmxvYXQ6IHJpZ2h0OycgOiAnJ31cbiAgICBoZWlnaHQ6ICR7aXNEaWZmID8gJzEuNTUnIDogJzEuMyd9ZW07XG4gICAgbGluZS1oZWlnaHQ6IDEuNWVtO1xuICAgICR7aXNEaWZmID8gJycgOiBgbWFyZ2luOiAke2lzTWluZXJ2YSA/ICcwJyA6ICctMC4zZW0nfSAzcHggMCAycHg7YH1cbiAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgIHZlcnRpY2FsLWFsaWduOiB0ZXh0LWJvdHRvbTtcbn1cblxuI2FqYXgtdW5kby1sb2FkaW5nOjphZnRlciB7XG4gICAgYW5pbWF0aW9uOiBhamF4LXVuZG8tbG9hZGluZyAwLjhzIHN0ZXBzKDEwKSBpbmZpbml0ZTtcbiAgICBjb2xvcjogZ3JheTtcbiAgICBjb250ZW50OiAnXHUyODBCXFxcXEFcdTI4MTlcXFxcQVx1MjgzOVxcXFxBXHUyODM4XFxcXEFcdTI4M0NcXFxcQVx1MjgzNFxcXFxBXHUyODI2XFxcXEFcdTI4MjdcXFxcQVx1MjgwN1xcXFxBXHUyODBGJztcbiAgICBkaXNwbGF5OiBpbmxpbmUtdGFibGU7XG4gICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICB3aGl0ZS1zcGFjZTogcHJlO1xufVxuXG5Aa2V5ZnJhbWVzIGFqYXgtdW5kby1sb2FkaW5nIHtcbiAgICB0byB7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTVlbSk7XG4gICAgfVxufVxuXG4jYWpheC11bmRvLXJlYXNvbiB7XG4gICAgZGlzcGxheTogbm9uZTtcbiAgICBtYXJnaW4tbGVmdDogM3B4O1xuJHtcbiAgICBpc01pbmVydmEgJiYgIWlzRGlmZlxuICAgICAgICA/IGBmbG9hdDogcmlnaHQ7XG5oZWlnaHQ6IDI2cHg7YFxuICAgICAgICA6ICcnXG59XG4ke1xuICAgIGlzTWluZXJ2YVxuICAgICAgICA/IGBib3JkZXI6IHJldmVydDtcbmJhY2tncm91bmQ6IHJldmVydDtcbnBhZGRpbmc6IHJldmVydDtgXG4gICAgICAgIDogJydcbn1cbn1cbmApO1xuXG4gICAgZm9yIChjb25zdCB1bmRvU3BhbiBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubXctaGlzdG9yeS11bmRvLCAubXctZGlmZi11bmRvJykpIHtcbiAgICAgICAgY29uc3QgdW5kb0xpbmsgPSB1bmRvU3Bhbi5xdWVyeVNlbGVjdG9yKCdhJyk7XG5cbiAgICAgICAgaWYgKCF1bmRvTGluaz8uaHJlZikge1xuICAgICAgICAgICAgbXcubm90aWZ5KCdDb3VsZCBub3QgZmluZCB1bmRvIGxpbmshJywgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1bmRvVXJsID0gbmV3IFVSTCh1bmRvTGluay5ocmVmKTtcblxuICAgICAgICBjb25zdCBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXG4gICAgICAgIGxldCBzdGFnZSA9IFNUQUdFUy5hd2FpdGluZ0NsaWNrO1xuXG4gICAgICAgIGNvbnN0IGFqYXhVbmRvTGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgYWpheFVuZG9MaW5rLnRleHRDb250ZW50ID0gJ2FqYXggdW5kbyc7XG4gICAgICAgIGFqYXhVbmRvTGluay5ocmVmID0gdW5kb1VybC5ocmVmO1xuICAgICAgICBpZiAoaXNNaW5lcnZhICYmICFpc0RpZmYpIGFqYXhVbmRvTGluay5zdHlsZS5tYXJnaW5MZWZ0ID0gJzFlbSc7XG4gICAgICAgIGFqYXhVbmRvTGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgaWYgKHN0YWdlID09PSBTVEFHRVMuYXdhaXRpbmdDbGljaykge1xuICAgICAgICAgICAgICAgIHN0YWdlID0gU1RBR0VTLmF3YWl0aW5nQ29uZmlybWF0aW9uO1xuXG4gICAgICAgICAgICAgICAgcmVhc29uSW5wdXQuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgICAgICAgICAgICAgIHJlYXNvbklucHV0LmZvY3VzKCk7XG5cbiAgICAgICAgICAgICAgICBhamF4VW5kb0xpbmsudGV4dENvbnRlbnQgPSAnY29uZmlybSBhamF4IHVuZG8nO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGFnZSA9PT0gU1RBR0VTLmF3YWl0aW5nQ29uZmlybWF0aW9uKSB7XG4gICAgICAgICAgICAgICAgc3RhZ2UgPSBTVEFHRVMuYXdhaXRpbmdSZWxvYWQ7XG4gICAgICAgICAgICAgICAgbG9hZGluZ1NwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICAgICAgICAgICAgICAgIGFqYXhVbmRvTGluay5zdHlsZS5jb2xvciA9ICdncmF5JztcbiAgICAgICAgICAgICAgICByZWFzb25JbnB1dC5kaXNhYmxlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNNaW5lcnZhICYmICFpc0RpZmYpIGFqYXhVbmRvTGluay5hcHBlbmQobG9hZGluZ1NwaW5uZXIpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdW5kb0lkID0gdW5kb1VybC5zZWFyY2hQYXJhbXMuZ2V0KCd1bmRvJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5kb0FmdGVyID0gdW5kb1VybC5zZWFyY2hQYXJhbXMuZ2V0KCd1bmRvYWZ0ZXInKTtcblxuICAgICAgICAgICAgICAgIGlmICghdW5kb0lkIHx8ICF1bmRvQWZ0ZXIpIHJldHVybiBtdy5ub3RpZnkoJ0NvdWxkIG5vdCBmaW5kIHVuZG8gcGFyYW1ldGVycyBpbiBVUkwhJywgeyB0eXBlOiAnZXJyb3InIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcmV2aXNpb25Vc2VyID0gdW5kb1NwYW4uY2xvc2VzdChpc0RpZmYgPyAndGQnIDogJ2xpJyk/LnF1ZXJ5U2VsZWN0b3IoJy5tdy11c2VybGluayBiZGknKT8udGV4dENvbnRlbnQ7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJldmlzaW9uVXNlcikgcmV0dXJuIG13Lm5vdGlmeSgnQ291bGQgbm90IGZpbmQgcmV2aXNpb24gdXNlciEnLCB7IHR5cGU6ICdlcnJvcicgfSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgbmV3IG13LkFwaSgpXG4gICAgICAgICAgICAgICAgICAgIC5wb3N0V2l0aEVkaXRUb2tlbih7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246ICdlZGl0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksXG4gICAgICAgICAgICAgICAgICAgICAgICB1bmRvOiB1bmRvSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1bmRvYWZ0ZXI6IHVuZG9BZnRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IGBVbmRpZCByZXZpc2lvbiAke3VuZG9JZH0gYnkgW1tTcGVjaWFsOkNvbnRyaWJ1dGlvbnMvJHtyZXZpc2lvblVzZXJ9fCR7cmV2aXNpb25Vc2VyfV1dIChbW1VzZXIgdGFsazoke3JldmlzaW9uVXNlcn18dGFsa11dKSR7cmVhc29uSW5wdXQudmFsdWUgPyBgOiAke3JlYXNvbklucHV0LnZhbHVlfWAgOiAnJ31gXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3JDb2RlOiBzdHJpbmcsIHsgZXJyb3IgfTogTWVkaWFXaWtpRGF0YUVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtdy5ub3RpZnkoYCR7ZXJyb3IuaW5mb30gKCR7ZXJyb3JDb2RlfSlgLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKSwgMjAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSByZXR1cm47XG5cbiAgICAgICAgICAgICAgICBtdy5ub3RpZnkoJ1JldmlzaW9uIHN1Y2Nlc3NmdWxseSB1bmRvbmUsIHJlbG9hZGluZy4uLicsIHsgdHlwZTogJ3N1Y2Nlc3MnIH0pO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGlzRGlmZikgc3Bhbi5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJygnKSk7XG4gICAgICAgIHNwYW4uYXBwZW5kKGFqYXhVbmRvTGluayk7XG5cbiAgICAgICAgY29uc3QgbG9hZGluZ1NwaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIGxvYWRpbmdTcGlubmVyLmlkID0gJ2FqYXgtdW5kby1sb2FkaW5nJztcblxuICAgICAgICBpZiAoIWlzTWluZXJ2YSkgc3Bhbi5hcHBlbmQobG9hZGluZ1NwaW5uZXIpO1xuXG4gICAgICAgIGNvbnN0IHJlYXNvbklucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgICAgcmVhc29uSW5wdXQudHlwZSA9ICd0ZXh0JztcbiAgICAgICAgcmVhc29uSW5wdXQuaWQgPSAnYWpheC11bmRvLXJlYXNvbic7XG4gICAgICAgIHJlYXNvbklucHV0LnBsYWNlaG9sZGVyID0gJ0luc2VydCByZWFzb24gaGVyZS4uLic7XG4gICAgICAgIHJlYXNvbklucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC5rZXkgPT09ICdFbnRlcicpIGFqYXhVbmRvTGluay5jbGljaygpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoaXNNaW5lcnZhKSBzcGFuLnByZXBlbmQocmVhc29uSW5wdXQpO1xuICAgICAgICBlbHNlIHNwYW4uYXBwZW5kKHJlYXNvbklucHV0KTtcblxuICAgICAgICBpZiAoaXNEaWZmKSBzcGFuLmFwcGVuZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnKScpKTtcblxuICAgICAgICBpZiAoaXNEaWZmKSB7XG4gICAgICAgICAgICB1bmRvU3Bhbi5hZnRlcihzcGFuKTtcbiAgICAgICAgICAgIHVuZG9TcGFuLmFmdGVyKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgJykpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzTWluZXJ2YSkgdW5kb1NwYW4ucGFyZW50RWxlbWVudD8uYmVmb3JlKHNwYW4pO1xuICAgICAgICBlbHNlIHVuZG9TcGFuLnBhcmVudEVsZW1lbnQ/LmFmdGVyKHNwYW4pO1xuICAgIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVBLEdBQUcsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsTUFBTTtBQUN0QyxRQUFNLFNBQVMsR0FBRyxPQUFPLElBQUksYUFBYTtBQUUxQyxNQUFJLEdBQUcsT0FBTyxJQUFJLFVBQVUsTUFBTSxhQUFhLENBQUM7QUFBUTtBQUV4RCxRQUFNLFlBQVksR0FBRyxPQUFPLElBQUksTUFBTSxNQUFNO0FBRTVDLFFBQU0sU0FBUztBQUFBLElBQ1gsZUFBZTtBQUFBLElBQ2Ysc0JBQXNCO0FBQUEsSUFDdEIsZ0JBQWdCO0FBQUEsRUFDcEI7QUFFQSxLQUFHLEtBQUssT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBLE1BSWIsYUFBYSxDQUFDLFNBQVMsa0JBQWtCLEVBQUU7QUFBQSxjQUNuQyxTQUFTLFNBQVMsS0FBSztBQUFBO0FBQUEsTUFFL0IsU0FBUyxLQUFLLFdBQVcsWUFBWSxNQUFNLFFBQVEsYUFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUF3QmxFLGFBQWEsQ0FBQyxTQUNSO0FBQUEsaUJBRUEsRUFDVjtBQUFBLEVBRUksWUFDTTtBQUFBO0FBQUEsb0JBR0EsRUFDVjtBQUFBO0FBQUEsQ0FFQztBQUVHLGFBQVcsWUFBWSxTQUFTLGlCQUFpQixpQ0FBaUMsR0FBRztBQUNqRixVQUFNLFdBQVcsU0FBUyxjQUFjLEdBQUc7QUFFM0MsUUFBSSxDQUFDLFVBQVUsTUFBTTtBQUNqQixTQUFHLE9BQU8sNkJBQTZCLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFD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
