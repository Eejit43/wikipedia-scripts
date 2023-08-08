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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9hamF4LXVuZG8udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IE1lZGlhV2lraURhdGFFcnJvciB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sICgpID0+IHtcbiAgICBjb25zdCBpc0RpZmYgPSBtdy5jb25maWcuZ2V0KCd3Z0RpZmZPbGRJZCcpO1xuXG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnQWN0aW9uJykgIT09ICdoaXN0b3J5JyAmJiAhaXNEaWZmKSByZXR1cm47XG5cbiAgICBjb25zdCBpc01pbmVydmEgPSBtdy5jb25maWcuZ2V0KCdza2luJykgPT09ICdtaW5lcnZhJztcblxuICAgIGNvbnN0IFNUQUdFUyA9IHtcbiAgICAgICAgYXdhaXRpbmdDbGljazogMCxcbiAgICAgICAgYXdhaXRpbmdDb25maXJtYXRpb246IDEsXG4gICAgICAgIGF3YWl0aW5nUmVsb2FkOiAyLFxuICAgIH07XG5cbiAgICBtdy51dGlsLmFkZENTUyhgXG4jYWpheC11bmRvLWxvYWRpbmcge1xuICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgdmVydGljYWwtYWxpZ246IHRleHQtYm90dG9tO1xuICAgIGhlaWdodDogMS4zZW07XG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICBsaW5lLWhlaWdodDogMS41ZW07XG59XG5cbiNhamF4LXVuZG8tbG9hZGluZzo6YWZ0ZXIge1xuICAgIGRpc3BsYXk6IGlubGluZS10YWJsZTtcbiAgICBhbmltYXRpb246IGFqYXgtdW5kby1sb2FkaW5nIDAuOHMgc3RlcHMoMTApIGluZmluaXRlO1xuICAgIGNvbnRlbnQ6IFwiXHUyODBCXFxcXEFcdTI4MTlcXFxcQVx1MjgzOVxcXFxBXHUyODM4XFxcXEFcdTI4M0NcXFxcQVx1MjgzNFxcXFxBXHUyODI2XFxcXEFcdTI4MjdcXFxcQVx1MjgwN1xcXFxBXHUyODBGXCI7XG4gICAgY29sb3I6IGdyYXk7XG4gICAgdGV4dC1hbGlnbjogbGVmdDtcbiAgICB3aGl0ZS1zcGFjZTogcHJlO1xufVxuXG4jYWpheC11bmRvLWxvYWRpbmcuaXMtZGlmZiB7XG4gICAgaGVpZ2h0OiAxLjU1ZW07XG59XG5cbiNhamF4LXVuZG8tbG9hZGluZzpub3QoLmlzLWRpZmYpIHtcbiAgICBtYXJnaW46IC0wLjNlbSAzcHggMCAzcHg7XG59XG5cbiNhamF4LXVuZG8tbG9hZGluZy5pcy1taW5lcnZhOm5vdCguaXMtZGlmZikge1xuICAgIGZsb2F0OiByaWdodDtcbiAgICBtYXJnaW4tdG9wOiAwcHg7XG59XG5cbkBrZXlmcmFtZXMgYWpheC11bmRvLWxvYWRpbmcge1xuICAgIHRvIHtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xNWVtKTtcbiAgICB9XG59XG5cbiNhamF4LXVuZG8tcmVhc29uIHtcbiAgICBkaXNwbGF5OiBub25lO1xuICAgIG1hcmdpbi1sZWZ0OiAzcHg7XG59XG5cbiNhamF4LXVuZG8tcmVhc29uLmlzLW1pbmVydmEge1xuICAgIGJvcmRlcjogcmV2ZXJ0O1xuICAgIGJhY2tncm91bmQ6IHJldmVydDtcbiAgICBwYWRkaW5nOiByZXZlcnQ7XG59XG5cbiNhamF4LXVuZG8tcmVhc29uLmlzLW1pbmVydmE6bm90KC5pcy1kaWZmKSB7XG4gICAgZmxvYXQ6IHJpZ2h0O1xuICAgIGhlaWdodDogMjZweDtcbn1gKTtcblxuICAgIGZvciAoY29uc3QgdW5kb1NwYW4gb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLm13LWhpc3RvcnktdW5kbywgLm13LWRpZmYtdW5kbycpKSB7XG4gICAgICAgIGNvbnN0IHVuZG9MaW5rID0gdW5kb1NwYW4ucXVlcnlTZWxlY3RvcignYScpO1xuXG4gICAgICAgIGlmICghdW5kb0xpbms/LmhyZWYpIHtcbiAgICAgICAgICAgIG13Lm5vdGlmeSgnQ291bGQgbm90IGZpbmQgdW5kbyBsaW5rIScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdW5kb1VybCA9IG5ldyBVUkwodW5kb0xpbmsuaHJlZik7XG5cbiAgICAgICAgY29uc3Qgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblxuICAgICAgICBsZXQgc3RhZ2UgPSBTVEFHRVMuYXdhaXRpbmdDbGljaztcblxuICAgICAgICBjb25zdCBhamF4VW5kb0xpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGFqYXhVbmRvTGluay50ZXh0Q29udGVudCA9ICdhamF4IHVuZG8nO1xuICAgICAgICBhamF4VW5kb0xpbmsuaHJlZiA9IHVuZG9VcmwuaHJlZjtcbiAgICAgICAgaWYgKGlzTWluZXJ2YSAmJiAhaXNEaWZmKSBhamF4VW5kb0xpbmsuc3R5bGUubWFyZ2luTGVmdCA9ICcxZW0nO1xuICAgICAgICBhamF4VW5kb0xpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmIChzdGFnZSA9PT0gU1RBR0VTLmF3YWl0aW5nQ2xpY2spIHtcbiAgICAgICAgICAgICAgICBzdGFnZSA9IFNUQUdFUy5hd2FpdGluZ0NvbmZpcm1hdGlvbjtcblxuICAgICAgICAgICAgICAgIHJlYXNvbklucHV0LnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgICAgICAgICByZWFzb25JbnB1dC5mb2N1cygpO1xuXG4gICAgICAgICAgICAgICAgYWpheFVuZG9MaW5rLnRleHRDb250ZW50ID0gJ2NvbmZpcm0gYWpheCB1bmRvJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhZ2UgPT09IFNUQUdFUy5hd2FpdGluZ0NvbmZpcm1hdGlvbikge1xuICAgICAgICAgICAgICAgIHN0YWdlID0gU1RBR0VTLmF3YWl0aW5nUmVsb2FkO1xuICAgICAgICAgICAgICAgIGxvYWRpbmdTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgICAgICAgICAgICAgICBhamF4VW5kb0xpbmsuc3R5bGUuY29sb3IgPSAnZ3JheSc7XG4gICAgICAgICAgICAgICAgcmVhc29uSW5wdXQuZGlzYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzTWluZXJ2YSAmJiAhaXNEaWZmKSBhamF4VW5kb0xpbmsuYXBwZW5kKGxvYWRpbmdTcGlubmVyKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHVuZG9JZCA9IHVuZG9Vcmwuc2VhcmNoUGFyYW1zLmdldCgndW5kbycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVuZG9BZnRlciA9IHVuZG9Vcmwuc2VhcmNoUGFyYW1zLmdldCgndW5kb2FmdGVyJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXVuZG9JZCB8fCAhdW5kb0FmdGVyKSByZXR1cm4gbXcubm90aWZ5KCdDb3VsZCBub3QgZmluZCB1bmRvIHBhcmFtZXRlcnMgaW4gVVJMIScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHJldmlzaW9uVXNlciA9IHVuZG9TcGFuLmNsb3Nlc3QoaXNEaWZmID8gJ3RkJyA6ICdsaScpPy5xdWVyeVNlbGVjdG9yKCcubXctdXNlcmxpbmsgYmRpJyk/LnRleHRDb250ZW50O1xuXG4gICAgICAgICAgICAgICAgaWYgKCFyZXZpc2lvblVzZXIpIHJldHVybiBtdy5ub3RpZnkoJ0NvdWxkIG5vdCBmaW5kIHJldmlzaW9uIHVzZXIhJywgeyB0eXBlOiAnZXJyb3InIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IG5ldyBtdy5BcGkoKVxuICAgICAgICAgICAgICAgICAgICAucG9zdFdpdGhFZGl0VG9rZW4oe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiAnZWRpdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogbXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5kbzogdW5kb0lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5kb2FmdGVyOiB1bmRvQWZ0ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBgVW5kaWQgcmV2aXNpb24gJHt1bmRvSWR9IGJ5IFtbU3BlY2lhbDpDb250cmlidXRpb25zLyR7cmV2aXNpb25Vc2VyfXwke3JldmlzaW9uVXNlcn1dXSAoW1tVc2VyIHRhbGs6JHtyZXZpc2lvblVzZXJ9fHRhbGtdXSkke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYXNvbklucHV0LnZhbHVlID8gYDogJHtyZWFzb25JbnB1dC52YWx1ZX1gIDogJydcbiAgICAgICAgICAgICAgICAgICAgICAgIH1gLFxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yQ29kZTogc3RyaW5nLCB7IGVycm9yIH06IE1lZGlhV2lraURhdGFFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbXcubm90aWZ5KGAke2Vycm9yLmluZm99ICgke2Vycm9yQ29kZX0pYCwgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCksIDIwMDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmICghc3VjY2VzcykgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgbXcubm90aWZ5KCdSZXZpc2lvbiBzdWNjZXNzZnVsbHkgdW5kb25lLCByZWxvYWRpbmcuLi4nLCB7IHR5cGU6ICdzdWNjZXNzJyB9KTtcbiAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChpc0RpZmYpIHNwYW4uYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcoJykpO1xuICAgICAgICBzcGFuLmFwcGVuZChhamF4VW5kb0xpbmspO1xuXG4gICAgICAgIGNvbnN0IGxvYWRpbmdTcGlubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICBsb2FkaW5nU3Bpbm5lci5pZCA9ICdhamF4LXVuZG8tbG9hZGluZyc7XG4gICAgICAgIGlmIChpc0RpZmYpIGxvYWRpbmdTcGlubmVyLmNsYXNzTGlzdC5hZGQoJ2lzLWRpZmYnKTtcbiAgICAgICAgaWYgKGlzTWluZXJ2YSkgbG9hZGluZ1NwaW5uZXIuY2xhc3NMaXN0LmFkZCgnaXMtbWluZXJ2YScpO1xuXG4gICAgICAgIGlmICghaXNNaW5lcnZhKSBzcGFuLmFwcGVuZChsb2FkaW5nU3Bpbm5lcik7XG5cbiAgICAgICAgY29uc3QgcmVhc29uSW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgICAgICByZWFzb25JbnB1dC50eXBlID0gJ3RleHQnO1xuICAgICAgICByZWFzb25JbnB1dC5pZCA9ICdhamF4LXVuZG8tcmVhc29uJztcbiAgICAgICAgaWYgKGlzRGlmZikgcmVhc29uSW5wdXQuY2xhc3NMaXN0LmFkZCgnaXMtZGlmZicpO1xuICAgICAgICBpZiAoaXNNaW5lcnZhKSByZWFzb25JbnB1dC5jbGFzc0xpc3QuYWRkKCdpcy1taW5lcnZhJyk7XG4gICAgICAgIHJlYXNvbklucHV0LnBsYWNlaG9sZGVyID0gJ0luc2VydCByZWFzb24gaGVyZS4uLic7XG4gICAgICAgIHJlYXNvbklucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC5rZXkgPT09ICdFbnRlcicpIGFqYXhVbmRvTGluay5jbGljaygpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoaXNNaW5lcnZhKSBzcGFuLnByZXBlbmQocmVhc29uSW5wdXQpO1xuICAgICAgICBlbHNlIHNwYW4uYXBwZW5kKHJlYXNvbklucHV0KTtcblxuICAgICAgICBpZiAoaXNEaWZmKSBzcGFuLmFwcGVuZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnKScpKTtcblxuICAgICAgICBpZiAoaXNEaWZmKSB7XG4gICAgICAgICAgICB1bmRvU3Bhbi5hZnRlcihzcGFuKTtcbiAgICAgICAgICAgIHVuZG9TcGFuLmFmdGVyKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgJykpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzTWluZXJ2YSkgdW5kb1NwYW4ucGFyZW50RWxlbWVudD8uYmVmb3JlKHNwYW4pO1xuICAgICAgICBlbHNlIHVuZG9TcGFuLnBhcmVudEVsZW1lbnQ/LmFmdGVyKHNwYW4pO1xuICAgIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVBLEdBQUcsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsTUFBTTtBQUN0QyxRQUFNLFNBQVMsR0FBRyxPQUFPLElBQUksYUFBYTtBQUUxQyxNQUFJLEdBQUcsT0FBTyxJQUFJLFVBQVUsTUFBTSxhQUFhLENBQUM7QUFBUTtBQUV4RCxRQUFNLFlBQVksR0FBRyxPQUFPLElBQUksTUFBTSxNQUFNO0FBRTVDLFFBQU0sU0FBUztBQUFBLElBQ1gsZUFBZTtBQUFBLElBQ2Ysc0JBQXNCO0FBQUEsSUFDdEIsZ0JBQWdCO0FBQUEsRUFDcEI7QUFFQSxLQUFHLEtBQUssT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFB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
