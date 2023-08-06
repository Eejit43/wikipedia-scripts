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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9hamF4LXVuZG8udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IE1lZGlhV2lraURhdGFFcnJvciB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sICgpID0+IHtcbiAgICBjb25zdCBpc0RpZmYgPSBtdy5jb25maWcuZ2V0KCd3Z0RpZmZPbGRJZCcpO1xuXG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnQWN0aW9uJykgIT09ICdoaXN0b3J5JyAmJiAhaXNEaWZmKSByZXR1cm47XG5cbiAgICBjb25zdCBpc01pbmVydmEgPSBtdy5jb25maWcuZ2V0KCdza2luJykgPT09ICdtaW5lcnZhJztcblxuICAgIGNvbnN0IFNUQUdFUyA9IHtcbiAgICAgICAgYXdhaXRpbmdDbGljazogMCxcbiAgICAgICAgYXdhaXRpbmdDb25maXJtYXRpb246IDEsXG4gICAgICAgIGF3YWl0aW5nUmVsb2FkOiAyLFxuICAgIH07XG5cbiAgICBtdy51dGlsLmFkZENTUyhgXG4vKiBNb2RpZmllZCBmcm9tIE1heCBCZWllcidzIFwidGV4dC1zcGlubmVyc1wiIChodHRwczovL2dpdGh1Yi5jb20vbWF4YmVpZXIvdGV4dC1zcGlubmVycykgKi9cbiNhamF4LXVuZG8tbG9hZGluZyB7XG4gICAgZGlzcGxheTogbm9uZTtcbiAgICAke2lzTWluZXJ2YSAmJiAhaXNEaWZmID8gJ2Zsb2F0OiByaWdodDsnIDogJyd9XG4gICAgaGVpZ2h0OiAke2lzRGlmZiA/ICcxLjU1JyA6ICcxLjMnfWVtO1xuICAgIGxpbmUtaGVpZ2h0OiAxLjVlbTtcbiAgICAke2lzRGlmZiA/ICcnIDogYG1hcmdpbjogJHtpc01pbmVydmEgPyAnMCcgOiAnLTAuM2VtJ30gM3B4IDAgMnB4O2B9XG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICB2ZXJ0aWNhbC1hbGlnbjogdGV4dC1ib3R0b207XG59XG5cbiNhamF4LXVuZG8tbG9hZGluZzo6YWZ0ZXIge1xuICAgIGFuaW1hdGlvbjogYWpheC11bmRvLWxvYWRpbmcgMC44cyBzdGVwcygxMCkgaW5maW5pdGU7XG4gICAgY29sb3I6IGdyYXk7XG4gICAgY29udGVudDogJ1x1MjgwQlxcXFxBXHUyODE5XFxcXEFcdTI4MzlcXFxcQVx1MjgzOFxcXFxBXHUyODNDXFxcXEFcdTI4MzRcXFxcQVx1MjgyNlxcXFxBXHUyODI3XFxcXEFcdTI4MDdcXFxcQVx1MjgwRic7XG4gICAgZGlzcGxheTogaW5saW5lLXRhYmxlO1xuICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgd2hpdGUtc3BhY2U6IHByZTtcbn1cblxuQGtleWZyYW1lcyBhamF4LXVuZG8tbG9hZGluZyB7XG4gICAgdG8ge1xuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTE1ZW0pO1xuICAgIH1cbn1cblxuI2FqYXgtdW5kby1yZWFzb24ge1xuICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgbWFyZ2luLWxlZnQ6IDNweDtcbiR7XG4gICAgaXNNaW5lcnZhICYmICFpc0RpZmZcbiAgICAgICAgPyBgZmxvYXQ6IHJpZ2h0O1xuaGVpZ2h0OiAyNnB4O2BcbiAgICAgICAgOiAnJ1xufVxuJHtcbiAgICBpc01pbmVydmFcbiAgICAgICAgPyBgYm9yZGVyOiByZXZlcnQ7XG5iYWNrZ3JvdW5kOiByZXZlcnQ7XG5wYWRkaW5nOiByZXZlcnQ7YFxuICAgICAgICA6ICcnXG59XG59XG5gKTtcblxuICAgIGZvciAoY29uc3QgdW5kb1NwYW4gb2YgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLm13LWhpc3RvcnktdW5kbywgLm13LWRpZmYtdW5kbycpKSB7XG4gICAgICAgIGNvbnN0IHVuZG9MaW5rID0gdW5kb1NwYW4ucXVlcnlTZWxlY3RvcignYScpO1xuXG4gICAgICAgIGlmICghdW5kb0xpbms/LmhyZWYpIHtcbiAgICAgICAgICAgIG13Lm5vdGlmeSgnQ291bGQgbm90IGZpbmQgdW5kbyBsaW5rIScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdW5kb1VybCA9IG5ldyBVUkwodW5kb0xpbmsuaHJlZik7XG5cbiAgICAgICAgY29uc3Qgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblxuICAgICAgICBsZXQgc3RhZ2UgPSBTVEFHRVMuYXdhaXRpbmdDbGljaztcblxuICAgICAgICBjb25zdCBhamF4VW5kb0xpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGFqYXhVbmRvTGluay50ZXh0Q29udGVudCA9ICdhamF4IHVuZG8nO1xuICAgICAgICBhamF4VW5kb0xpbmsuaHJlZiA9IHVuZG9VcmwuaHJlZjtcbiAgICAgICAgaWYgKGlzTWluZXJ2YSAmJiAhaXNEaWZmKSBhamF4VW5kb0xpbmsuc3R5bGUubWFyZ2luTGVmdCA9ICcxZW0nO1xuICAgICAgICBhamF4VW5kb0xpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmIChzdGFnZSA9PT0gU1RBR0VTLmF3YWl0aW5nQ2xpY2spIHtcbiAgICAgICAgICAgICAgICBzdGFnZSA9IFNUQUdFUy5hd2FpdGluZ0NvbmZpcm1hdGlvbjtcblxuICAgICAgICAgICAgICAgIHJlYXNvbklucHV0LnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgICAgICAgICByZWFzb25JbnB1dC5mb2N1cygpO1xuXG4gICAgICAgICAgICAgICAgYWpheFVuZG9MaW5rLnRleHRDb250ZW50ID0gJ2NvbmZpcm0gYWpheCB1bmRvJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhZ2UgPT09IFNUQUdFUy5hd2FpdGluZ0NvbmZpcm1hdGlvbikge1xuICAgICAgICAgICAgICAgIHN0YWdlID0gU1RBR0VTLmF3YWl0aW5nUmVsb2FkO1xuICAgICAgICAgICAgICAgIGxvYWRpbmdTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgICAgICAgICAgICAgICBhamF4VW5kb0xpbmsuc3R5bGUuY29sb3IgPSAnZ3JheSc7XG4gICAgICAgICAgICAgICAgcmVhc29uSW5wdXQuZGlzYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzTWluZXJ2YSAmJiAhaXNEaWZmKSBhamF4VW5kb0xpbmsuYXBwZW5kKGxvYWRpbmdTcGlubmVyKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHVuZG9JZCA9IHVuZG9Vcmwuc2VhcmNoUGFyYW1zLmdldCgndW5kbycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVuZG9BZnRlciA9IHVuZG9Vcmwuc2VhcmNoUGFyYW1zLmdldCgndW5kb2FmdGVyJyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXVuZG9JZCB8fCAhdW5kb0FmdGVyKSByZXR1cm4gbXcubm90aWZ5KCdDb3VsZCBub3QgZmluZCB1bmRvIHBhcmFtZXRlcnMgaW4gVVJMIScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHJldmlzaW9uVXNlciA9IHVuZG9TcGFuLmNsb3Nlc3QoaXNEaWZmID8gJ3RkJyA6ICdsaScpPy5xdWVyeVNlbGVjdG9yKCcubXctdXNlcmxpbmsgYmRpJyk/LnRleHRDb250ZW50O1xuXG4gICAgICAgICAgICAgICAgaWYgKCFyZXZpc2lvblVzZXIpIHJldHVybiBtdy5ub3RpZnkoJ0NvdWxkIG5vdCBmaW5kIHJldmlzaW9uIHVzZXIhJywgeyB0eXBlOiAnZXJyb3InIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IG5ldyBtdy5BcGkoKVxuICAgICAgICAgICAgICAgICAgICAucG9zdFdpdGhFZGl0VG9rZW4oe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiAnZWRpdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogbXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5kbzogdW5kb0lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5kb2FmdGVyOiB1bmRvQWZ0ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBgVW5kaWQgcmV2aXNpb24gJHt1bmRvSWR9IGJ5IFtbU3BlY2lhbDpDb250cmlidXRpb25zLyR7cmV2aXNpb25Vc2VyfXwke3JldmlzaW9uVXNlcn1dXSAoW1tVc2VyIHRhbGs6JHtyZXZpc2lvblVzZXJ9fHRhbGtdXSkke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYXNvbklucHV0LnZhbHVlID8gYDogJHtyZWFzb25JbnB1dC52YWx1ZX1gIDogJydcbiAgICAgICAgICAgICAgICAgICAgICAgIH1gLFxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yQ29kZTogc3RyaW5nLCB7IGVycm9yIH06IE1lZGlhV2lraURhdGFFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbXcubm90aWZ5KGAke2Vycm9yLmluZm99ICgke2Vycm9yQ29kZX0pYCwgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCksIDIwMDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmICghc3VjY2VzcykgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgbXcubm90aWZ5KCdSZXZpc2lvbiBzdWNjZXNzZnVsbHkgdW5kb25lLCByZWxvYWRpbmcuLi4nLCB7IHR5cGU6ICdzdWNjZXNzJyB9KTtcbiAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChpc0RpZmYpIHNwYW4uYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcoJykpO1xuICAgICAgICBzcGFuLmFwcGVuZChhamF4VW5kb0xpbmspO1xuXG4gICAgICAgIGNvbnN0IGxvYWRpbmdTcGlubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICBsb2FkaW5nU3Bpbm5lci5pZCA9ICdhamF4LXVuZG8tbG9hZGluZyc7XG5cbiAgICAgICAgaWYgKCFpc01pbmVydmEpIHNwYW4uYXBwZW5kKGxvYWRpbmdTcGlubmVyKTtcblxuICAgICAgICBjb25zdCByZWFzb25JbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgIHJlYXNvbklucHV0LnR5cGUgPSAndGV4dCc7XG4gICAgICAgIHJlYXNvbklucHV0LmlkID0gJ2FqYXgtdW5kby1yZWFzb24nO1xuICAgICAgICByZWFzb25JbnB1dC5wbGFjZWhvbGRlciA9ICdJbnNlcnQgcmVhc29uIGhlcmUuLi4nO1xuICAgICAgICByZWFzb25JbnB1dC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXZlbnQua2V5ID09PSAnRW50ZXInKSBhamF4VW5kb0xpbmsuY2xpY2soKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGlzTWluZXJ2YSkgc3Bhbi5wcmVwZW5kKHJlYXNvbklucHV0KTtcbiAgICAgICAgZWxzZSBzcGFuLmFwcGVuZChyZWFzb25JbnB1dCk7XG5cbiAgICAgICAgaWYgKGlzRGlmZikgc3Bhbi5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyknKSk7XG5cbiAgICAgICAgaWYgKGlzRGlmZikge1xuICAgICAgICAgICAgdW5kb1NwYW4uYWZ0ZXIoc3Bhbik7XG4gICAgICAgICAgICB1bmRvU3Bhbi5hZnRlcihkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnICcpKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc01pbmVydmEpIHVuZG9TcGFuLnBhcmVudEVsZW1lbnQ/LmJlZm9yZShzcGFuKTtcbiAgICAgICAgZWxzZSB1bmRvU3Bhbi5wYXJlbnRFbGVtZW50Py5hZnRlcihzcGFuKTtcbiAgICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFFQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixHQUFHLE1BQU07QUFDdEMsUUFBTSxTQUFTLEdBQUcsT0FBTyxJQUFJLGFBQWE7QUFFMUMsTUFBSSxHQUFHLE9BQU8sSUFBSSxVQUFVLE1BQU0sYUFBYSxDQUFDO0FBQVE7QUFFeEQsUUFBTSxZQUFZLEdBQUcsT0FBTyxJQUFJLE1BQU0sTUFBTTtBQUU1QyxRQUFNLFNBQVM7QUFBQSxJQUNYLGVBQWU7QUFBQSxJQUNmLHNCQUFzQjtBQUFBLElBQ3RCLGdCQUFnQjtBQUFBLEVBQ3BCO0FBRUEsS0FBRyxLQUFLLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUliLGFBQWEsQ0FBQyxTQUFTLGtCQUFrQixFQUFFO0FBQUEsY0FDbkMsU0FBUyxTQUFTLEtBQUs7QUFBQTtBQUFBLE1BRS9CLFNBQVMsS0FBSyxXQUFXLFlBQVksTUFBTSxRQUFRLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBd0JsRSxhQUFhLENBQUMsU0FDUjtBQUFBLGlCQUVBLEVBQ1Y7QUFBQSxFQUVJLFlBQ007QUFBQTtBQUFBLG9CQUdBLEVBQ1Y7QUFBQTtBQUFBLENBRUM7QUFFRyxhQUFXLFlBQVksU0FBUyxpQkFBaUIsaUNBQWlDLEdBQUc7QUFDakYsVUFBTSxXQUFXLFNBQVMsY0FBYyxHQUFHO0FBRTNDLFFBQUksQ0FBQyxVQUFVLE1BQU07QUFDakIsU0FBRyxPQUFPLDZCQUE2QixFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3hEO0FBQUEsSUFDSjtBQUVBLFVBQU0sVUFBVSxJQUFJLElBQUksU0FBUyxJQUFJO0FBRXJDLFVBQU0sT0FBTyxTQUFTLGNBQWMsTUFBTTtBQUUxQyxRQUFJLFFBQVEsT0FBTztBQUVuQixVQUFNLGVBQWUsU0FBUyxjQUFjLEdBQUc7QUFDL0MsaUJBQWEsY0FBYztBQUMzQixpQkFBYSxPQUFPLFFBQVE7QUFDNUIsUUFBSSxhQUFhLENBQUM7QUFBUSxtQkFBYSxNQUFNLGFBQWE7QUFDMUQsaUJBQWEsaUJBQWlCLFNBQVMsT0FBTyxVQUFVO0FBQ3BELFlBQU0sZUFBZTtBQUVyQixVQUFJLFVBQVUsT0FBTyxlQUFlO0FBQ2hDLGdCQUFRLE9BQU87QUFFZixvQkFBWSxNQUFNLFVBQVU7QUFDNUIsb0JBQVksTUFBTTtBQUVsQixxQkFBYSxjQUFjO0FBQUEsTUFDL0IsV0FBVyxVQUFVLE9BQU8sc0JBQXNCO0FBQzlDLGdCQUFRLE9BQU87QUFDZix1QkFBZSxNQUFNLFVBQVU7QUFDL0IscUJBQWEsTUFBTSxRQUFRO0FBQzNCLG9CQUFZLFdBQVc7QUFFdkIsWUFBSSxhQUFhLENBQUM7QUFBUSx1QkFBYSxPQUFPLGNBQWM7QUFFNUQsY0FBTSxTQUFTLFFBQVEsYUFBYSxJQUFJLE1BQU07QUFDOUMsY0FBTSxZQUFZLFFBQVEsYUFBYSxJQUFJLFdBQVc7QUFFdEQsWUFBSSxDQUFDLFVBQVUsQ0FBQztBQUFXLGlCQUFPLEdBQUcsT0FBTywwQ0FBMEMsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUV2RyxjQUFNLGVBQWUsU0FBUyxRQUFRLFNBQVMsT0FBTyxJQUFJLEdBQUcsY0FBYyxrQkFBa0IsR0FBRztBQUVoRyxZQUFJLENBQUM7QUFBYyxpQkFBTyxHQUFHLE9BQU8saUNBQWlDLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFdEYsY0FBTSxVQUFVLE1BQU0sSUFBSSxHQUFHLElBQUksRUFDNUIsa0JBQWtCO0FBQUEsVUFDZixRQUFRO0FBQUEsVUFDUixPQUFPLEdBQUcsT0FBTyxJQUFJLFlBQVk7QUFBQSxVQUNqQyxNQUFNO0FBQUEsVUFDTixXQUFXO0FBQUEsVUFDWCxTQUFTLGtCQUFrQixNQUFNLCtCQUErQixZQUFZLElBQUksWUFBWSxtQkFBbUIsWUFBWSxXQUN2SCxZQUFZLFFBQVEsS0FBSyxZQUFZLEtBQUssS0FBSyxFQUNuRDtBQUFBLFFBQ0osQ0FBQyxFQUNBLE1BQU0sQ0FBQyxXQUFtQixFQUFFLE1BQU0sTUFBMEI7QUFDekQsYUFBRyxPQUFPLEdBQUcsTUFBTSxJQUFJLEtBQUssU0FBUyxLQUFLLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDM0QscUJBQVcsTUFBTSxPQUFPLFNBQVMsT0FBTyxHQUFHLEdBQUk7QUFDL0MsaUJBQU87QUFBQSxRQUNYLENBQUM7QUFFTCxZQUFJLENBQUM7QUFBUztBQUVkLFdBQUcsT0FBTyw4Q0FBOEMsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUMzRSxlQUFPLFNBQVMsT0FBTztBQUFBLE1BQzNCO0FBQUEsSUFDSixDQUFDO0FBRUQsUUFBSTtBQUFRLFdBQUssT0FBTyxTQUFTLGVBQWUsR0FBRyxDQUFDO0FBQ3BELFNBQUssT0FBTyxZQUFZO0FBRXhCLFVBQU0saUJBQWlCLFNBQVMsY0FBYyxNQUFNO0FBQ3BELG1CQUFlLEtBQUs7QUFFcEIsUUFBSSxDQUFDO0FBQVcsV0FBSyxPQUFPLGNBQWM7QUFFMUMsVUFBTSxjQUFjLFNBQVMsY0FBYyxPQUFPO0FBQ2xELGdCQUFZLE9BQU87QUFDbkIsZ0JBQVksS0FBSztBQUNqQixnQkFBWSxjQUFjO0FBQzFCLGdCQUFZLGlCQUFpQixXQUFXLENBQUMsVUFBVTtBQUMvQyxVQUFJLE1BQU0sUUFBUTtBQUFTLHFCQUFhLE1BQU07QUFBQSxJQUNsRCxDQUFDO0FBRUQsUUFBSTtBQUFXLFdBQUssUUFBUSxXQUFXO0FBQUE7QUFDbEMsV0FBSyxPQUFPLFdBQVc7QUFFNUIsUUFBSTtBQUFRLFdBQUssT0FBTyxTQUFTLGVBQWUsR0FBRyxDQUFDO0FBRXBELFFBQUksUUFBUTtBQUNSLGVBQVMsTUFBTSxJQUFJO0FBQ25CLGVBQVMsTUFBTSxTQUFTLGVBQWUsR0FBRyxDQUFDO0FBQUEsSUFDL0MsV0FBVztBQUFXLGVBQVMsZUFBZSxPQUFPLElBQUk7QUFBQTtBQUNwRCxlQUFTLGVBQWUsTUFBTSxJQUFJO0FBQUEsRUFDM0M7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
