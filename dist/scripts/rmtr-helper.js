"use strict";
mw.loader.using(["mediawiki.util"], () => {
  const developmentMode = false;
  if (mw.config.get("wgPageName") !== (developmentMode ? "User:Eejit43/sandbox" : "Wikipedia:Requested_moves/Technical_requests"))
    return;
  importStylesheet("User:Eejit43/scripts/rmtr-helper.css");
  const namespaces = mw.config.get("wgNamespaceIds");
  let displayed = false;
  const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", `Review move requests${developmentMode ? " (DEV)" : ""}`, "review-rmtr-requests");
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    if (displayed)
      return document.querySelector("#rmtr-review-result")?.scrollIntoView();
    else
      displayed = true;
    const pageRevision = await getPageRevision();
    const revId = pageRevision.revid;
    const pageContent = pageRevision.slots.main.content;
    const sections = ["Uncontroversial technical requests", "Requests to revert undiscussed moves", "Contested technical requests", "Administrator needed"];
    const allRequests = {};
    for (const section of sections) {
      const sectionContent = pageContent.split(new RegExp(`={3,} ?${section} ?={3,}`))[1].split(/={3,}/m)[0].trim();
      const matchedRequests = sectionContent.match(/(?:\* ?\n)?\* {{rmassist\/core.+?(?=\* {{rmassist\/core|$)/gis);
      if (matchedRequests)
        allRequests[section] = matchedRequests.map((request) => {
          request = request.trim();
          const full = request;
          const parameters = request.replaceAll(/(?:\* ?\n)?\* {{rmassist\/core \||}}.*/gis, "").split(" | ").map((parameter) => parameter.trim());
          const finalParameters = Object.fromEntries(parameters.map((parameter) => parameter.split(" = ").map((value) => value.trim())));
          finalParameters.full = full;
          finalParameters.original = finalParameters[1];
          finalParameters.destination = finalParameters[2];
          delete finalParameters[1];
          delete finalParameters[2];
          return finalParameters;
        });
      else {
        allRequests[section] = [];
        continue;
      }
    }
    await Promise.all(
      Object.entries(allRequests).map(async ([, requests]) => {
        await Promise.all(
          requests.map(async (request) => {
            const mwOldTitle = mw.Title.newFromText(request.original);
            const mwNewTitle = mw.Title.newFromText(request.destination);
            if (!mwOldTitle)
              return mw.notify(`Invalid title "${request.original}"!`, { type: "error" });
            if (!mwNewTitle)
              return mw.notify(`Invalid title "${request.destination}"!`, { type: "error" });
            const validTitle = !/[#<>[\]{|}]/.test(request.destination) && mwNewTitle;
            const invalidTitleWarning = document.createElement("span");
            invalidTitleWarning.classList.add("rmtr-review-invalid-warning");
            invalidTitleWarning.textContent = `Invalid title "${request.destination}"!`;
            const validNamespace = ![namespaces.file, namespaces.category].some((namespace) => mwOldTitle.namespace === namespace || mwNewTitle.namespace === namespace);
            const invalidNamespaceWarning = document.createElement("span");
            invalidNamespaceWarning.classList.add("rmtr-review-invalid-warning");
            invalidNamespaceWarning.textContent = `Warning: original or destination page is in namespace "${mwNewTitle.namespace === namespaces.file ? "file" : "category"}"!`;
            const parsedWikitext = await new mw.Api().parse(
              `[[:${request.original}]] \u2192 ${validTitle ? `[[:${request.destination}]]` : invalidTitleWarning.outerHTML} requested by ${request.requester ? mw.util.isIPAddress(request.requester) ? `[[Special:Contributions/${request.requester}|${request.requester}]]` : `[[User:${request.requester}|${request.requester}]]` : request.sig.match(/(\[{2}Special:Contributions\/(.*?)\|\2]{2})/)[1]} with reasoning "${request.reason}"`
            );
            const parsedHtml = new DOMParser().parseFromString(parsedWikitext, "text/html");
            const requestElement = document.createElement("li");
            requestElement.innerHTML = parsedHtml.querySelector("div.mw-parser-output").firstElementChild.innerHTML;
            if (!validNamespace)
              requestElement.append(invalidNamespaceWarning);
            request.element = requestElement;
          })
        );
      })
    );
    const outputElement = document.createElement("div");
    outputElement.id = "rmtr-review-result";
    const header = document.createElement("div");
    header.id = "rmtr-review-header";
    header.textContent = "Technical move requests review";
    outputElement.append(header);
    for (const [sectionIndex, [section, requests]] of Object.entries(allRequests).entries()) {
      const sectionHeader = document.createElement("div");
      sectionHeader.classList.add("rmtr-review-header");
      sectionHeader.textContent = section;
      outputElement.append(sectionHeader);
      const sectionContent = document.createElement("div");
      sectionContent.classList.add("rmtr-review-section-content");
      if (requests.length === 0) {
        const noRequests = document.createElement("div");
        noRequests.textContent = "No requests in this section";
        sectionContent.append(noRequests);
      } else {
        const requestsList = document.createElement("ul");
        for (const [requestIndex, request] of requests.entries()) {
          const requestElement = request.element;
          const removeRequestCheckbox = document.createElement("input");
          removeRequestCheckbox.type = "checkbox";
          removeRequestCheckbox.classList.add("rmtr-review-request-checkbox");
          removeRequestCheckbox.id = `rmtr-review-remove-request-${sectionIndex}-${requestIndex}`;
          removeRequestCheckbox.addEventListener("change", () => {
            if (removeRequestCheckbox.checked) {
              allRequests[section][requestIndex].result = { remove: true, reason: removeRequestDropdown.value };
              removeRequestExtraInputs.style.display = "inline";
              switchSectionCheckbox.disabled = true;
            } else {
              delete allRequests[section][requestIndex].result;
              removeRequestExtraInputs.style.display = "none";
              switchSectionCheckbox.disabled = false;
            }
          });
          const removeRequestLabel = document.createElement("label");
          removeRequestLabel.htmlFor = `rmtr-review-remove-request-${sectionIndex}-${requestIndex}`;
          removeRequestLabel.textContent = "Remove request";
          requestElement.append(removeRequestCheckbox);
          requestElement.append(removeRequestLabel);
          const removeRequestExtraInputs = document.createElement("span");
          removeRequestExtraInputs.style.display = "none";
          removeRequestExtraInputs.append(document.createTextNode(" as "));
          const removeRequestDropdown = document.createElement("select");
          if (section === "Contested technical requests")
            removeRequestDropdown.value = "Contested";
          removeRequestDropdown.addEventListener("change", () => {
            allRequests[section][requestIndex].result.reason = removeRequestDropdown.value;
          });
          const removeRequestDropdownOptions = [
            "Completed",
            //
            "Contested",
            "Already done",
            "Invalid page name",
            "Incorrect venue",
            "Withdrawn",
            "Not done"
          ];
          for (const option of removeRequestDropdownOptions) {
            const optionElement = document.createElement("option");
            optionElement.value = option;
            optionElement.textContent = option;
            removeRequestDropdown.append(optionElement);
          }
          removeRequestExtraInputs.append(removeRequestDropdown);
          requestElement.append(removeRequestExtraInputs);
          const switchSectionCheckbox = document.createElement("input");
          switchSectionCheckbox.type = "checkbox";
          switchSectionCheckbox.classList.add("rmtr-review-request-checkbox");
          switchSectionCheckbox.id = `rmtr-review-move-request-${sectionIndex}-${requestIndex}`;
          switchSectionCheckbox.addEventListener("change", () => {
            if (switchSectionCheckbox.checked) {
              allRequests[section][requestIndex].result = { move: true, section: switchSectionDropdown.value };
              switchSectionExtraInputs.style.display = "inline";
              removeRequestCheckbox.disabled = true;
            } else {
              delete allRequests[section][requestIndex].result;
              switchSectionExtraInputs.style.display = "none";
              removeRequestCheckbox.disabled = false;
            }
          });
          const switchSectionLabel = document.createElement("label");
          switchSectionLabel.htmlFor = `rmtr-review-move-request-${sectionIndex}-${requestIndex}`;
          switchSectionLabel.textContent = "Switch section";
          requestElement.append(switchSectionCheckbox);
          requestElement.append(switchSectionLabel);
          const switchSectionExtraInputs = document.createElement("span");
          switchSectionExtraInputs.style.display = "none";
          switchSectionExtraInputs.append(document.createTextNode(" to "));
          const switchSectionDropdown = document.createElement("select");
          switchSectionDropdown.addEventListener("change", () => {
            allRequests[section][requestIndex].result.section = switchSectionDropdown.value;
          });
          for (const option of sections) {
            if (option === section)
              continue;
            const optionElement = document.createElement("option");
            optionElement.value = option;
            optionElement.textContent = option;
            switchSectionDropdown.append(optionElement);
          }
          switchSectionExtraInputs.append(switchSectionDropdown);
          switchSectionExtraInputs.append(document.createTextNode(" with reasoning "));
          const switchSectionReasoning = document.createElement("input");
          switchSectionReasoning.type = "text";
          switchSectionReasoning.addEventListener("input", () => {
            allRequests[section][requestIndex].result.reason = switchSectionReasoning.value;
          });
          switchSectionExtraInputs.append(switchSectionReasoning);
          switchSectionExtraInputs.append(document.createTextNode(" (optional, automatically signed)"));
          requestElement.append(switchSectionExtraInputs);
          requestsList.append(requestElement);
        }
        sectionContent.append(requestsList);
      }
      outputElement.append(sectionContent);
    }
    const submitButton = document.createElement("button");
    submitButton.id = "rmtr-review-submit";
    submitButton.textContent = "Submit";
    submitButton.addEventListener("click", async () => {
      const newPageRevision = await getPageRevision();
      if (newPageRevision.revid !== revId)
        return mw.notify("rmtr-helper: An edit conflict occurred, please start over!", { type: "error" });
      submitButton.disabled = true;
      loadingSpinner.style.display = "inline-block";
      let endResult = pageContent;
      const changes = { remove: {}, move: {}, total: 0 };
      for (const section of Object.values(allRequests))
        for (const request of section) {
          if (!request.result)
            continue;
          if ("remove" in request.result) {
            endResult = endResult.replace(request.full + "\n", "").replace(request.full, "");
            if (!changes.remove[request.result.reason])
              changes.remove[request.result.reason] = [];
            changes.remove[request.result.reason].push(request);
            changes.total++;
          } else if ("move" in request.result) {
            const sectionTitleAfter = sections[sections.indexOf(request.result.section) + 1];
            endResult = endResult.replace(request.full + "\n", "").replace(request.full, "");
            endResult = endResult.replace(
              new RegExp(`(
?
?(?:={3,} ?${sectionTitleAfter} ?={3,}|$))`),
              `
${request.full}${request.result.reason ? `
:: ${request.result.reason} ~~~~` : ""}$1`
            );
            if (!changes.move[request.result.section])
              changes.move[request.result.section] = [];
            changes.move[request.result.section].push(request);
            changes.total++;
          }
        }
      if (changes.total === 0) {
        submitButton.disabled = false;
        loadingSpinner.style.display = "none";
        return mw.notify("No changes to make!", { type: "error" });
      }
      const noRemaining = Object.values(allRequests).every((section) => section.every((request) => request.result && "remove" in request.result));
      const editSummary = `Handled ${changes.total} request${changes.total > 1 ? "s" : ""}: ${Object.entries(changes.remove).length > 0 ? `Removed ${Object.entries(changes.remove).map(([reason, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(", ")} as ${reason.toLowerCase()}`).join(", ")}` : ""}${Object.entries(changes.move).length > 0 ? `${Object.entries(changes.remove).length > 0 ? ", " : ""}Moved ${Object.entries(changes.move).map(([destination, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(", ")} to "${destination}"`).join(", ")}` : ""}${noRemaining ? " (no requests remain)" : ""} (via [[User:Eejit43/scripts/rmtr-helper|script]])`;
      if (developmentMode)
        showEditPreview(mw.config.get("wgPageName"), endResult, editSummary);
      else {
        await new mw.Api().edit(mw.config.get("wgPageName"), () => ({ text: endResult, summary: editSummary }));
        mw.notify(`Successfully handled ${changes.total} requests, reloading...`, { type: "success" });
        window.location.reload();
      }
    });
    const loadingSpinner = document.createElement("span");
    loadingSpinner.id = "rmtr-review-loading";
    loadingSpinner.style.display = "none";
    submitButton.append(loadingSpinner);
    outputElement.append(submitButton);
    mw.util.$content[0].prepend(outputElement);
    outputElement.scrollIntoView();
  });
});
async function getPageRevision() {
  return (await new mw.Api().get({ action: "query", formatversion: 2, prop: "revisions", rvprop: "content|ids", rvslots: "*", titles: mw.config.get("wgPageName") })).query.pages[0].revisions[0];
}
function showEditPreview(title, text, summary) {
  const baseUrl = mw.config.get("wgServer") + mw.config.get("wgScriptPath") + "/";
  const form = document.createElement("form");
  form.action = `${baseUrl}index.php?title=${encodeURIComponent(title)}&action=submit`;
  form.method = "POST";
  const textboxInput = document.createElement("input");
  textboxInput.type = "hidden";
  textboxInput.name = "wpTextbox1";
  textboxInput.value = text;
  form.append(textboxInput);
  const summaryInput = document.createElement("input");
  summaryInput.type = "hidden";
  summaryInput.name = "wpSummary";
  summaryInput.value = summary;
  form.append(summaryInput);
  const previewInput = document.createElement("input");
  previewInput.type = "hidden";
  previewInput.name = "mode";
  previewInput.value = "preview";
  form.append(previewInput);
  const showChangesInput = document.createElement("input");
  showChangesInput.type = "hidden";
  showChangesInput.name = "wpDiff";
  showChangesInput.value = "Show changes";
  form.append(showChangesInput);
  const ultimateParameterInput = document.createElement("input");
  ultimateParameterInput.type = "hidden";
  ultimateParameterInput.name = "wpUltimateParam";
  ultimateParameterInput.value = "1";
  form.append(ultimateParameterInput);
  document.body.append(form);
  form.submit();
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9ybXRyLWhlbHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGFnZVJldmlzaW9uc1Jlc3VsdCB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gaW1wb3J0U3R5bGVzaGVldChwYWdlOiBzdHJpbmcpOiB2b2lkO1xuXG5tdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgY29uc3QgZGV2ZWxvcG1lbnRNb2RlID0gZmFsc2U7XG5cbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpICE9PSAoZGV2ZWxvcG1lbnRNb2RlID8gJ1VzZXI6RWVqaXQ0My9zYW5kYm94JyA6ICdXaWtpcGVkaWE6UmVxdWVzdGVkX21vdmVzL1RlY2huaWNhbF9yZXF1ZXN0cycpKSByZXR1cm47XG5cbiAgICBpbXBvcnRTdHlsZXNoZWV0KCdVc2VyOkVlaml0NDMvc2NyaXB0cy9ybXRyLWhlbHBlci5jc3MnKTtcblxuICAgIGNvbnN0IG5hbWVzcGFjZXMgPSBtdy5jb25maWcuZ2V0KCd3Z05hbWVzcGFjZUlkcycpO1xuXG4gICAgbGV0IGRpc3BsYXllZCA9IGZhbHNlO1xuXG4gICAgY29uc3QgbGluayA9IG13LnV0aWwuYWRkUG9ydGxldExpbmsobXcuY29uZmlnLmdldCgnc2tpbicpID09PSAnbWluZXJ2YScgPyAncC10YicgOiAncC1jYWN0aW9ucycsICcjJywgYFJldmlldyBtb3ZlIHJlcXVlc3RzJHtkZXZlbG9wbWVudE1vZGUgPyAnIChERVYpJyA6ICcnfWAsICdyZXZpZXctcm10ci1yZXF1ZXN0cycpO1xuXG4gICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGlmIChkaXNwbGF5ZWQpIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcm10ci1yZXZpZXctcmVzdWx0Jyk/LnNjcm9sbEludG9WaWV3KCk7XG4gICAgICAgIGVsc2UgZGlzcGxheWVkID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBwYWdlUmV2aXNpb24gPSBhd2FpdCBnZXRQYWdlUmV2aXNpb24oKTtcblxuICAgICAgICBjb25zdCByZXZJZCA9IHBhZ2VSZXZpc2lvbi5yZXZpZDtcbiAgICAgICAgY29uc3QgcGFnZUNvbnRlbnQgPSBwYWdlUmV2aXNpb24uc2xvdHMubWFpbi5jb250ZW50O1xuXG4gICAgICAgIGNvbnN0IHNlY3Rpb25zID0gWydVbmNvbnRyb3ZlcnNpYWwgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ1JlcXVlc3RzIHRvIHJldmVydCB1bmRpc2N1c3NlZCBtb3ZlcycsICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ0FkbWluaXN0cmF0b3IgbmVlZGVkJ107XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3Qge1xuICAgICAgICAgICAgc2lnOiBzdHJpbmc7XG4gICAgICAgICAgICByZXF1ZXN0ZXI/OiBzdHJpbmc7XG4gICAgICAgICAgICByZWFzb246IHN0cmluZztcbiAgICAgICAgICAgIGZ1bGw6IHN0cmluZztcbiAgICAgICAgICAgIG9yaWdpbmFsOiBzdHJpbmc7XG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgZWxlbWVudDogSFRNTExJRWxlbWVudDtcbiAgICAgICAgICAgIHJlc3VsdD86IFJlcXVlc3RSZXN1bHRNb3ZlIHwgUmVxdWVzdFJlc3VsdFJlbW92ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGludGVyZmFjZSBSZXF1ZXN0UmVzdWx0TW92ZSB7XG4gICAgICAgICAgICBtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgc2VjdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgcmVhc29uPzogc3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3RSZXN1bHRSZW1vdmUge1xuICAgICAgICAgICAgcmVtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgcmVhc29uOiBzdHJpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhbGxSZXF1ZXN0czogUmVjb3JkPHN0cmluZywgUmVxdWVzdFtdPiA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBwYWdlQ29udGVudFxuICAgICAgICAgICAgICAgIC5zcGxpdChuZXcgUmVnRXhwKGA9ezMsfSA/JHtzZWN0aW9ufSA/PXszLH1gKSlbMV1cbiAgICAgICAgICAgICAgICAuc3BsaXQoLz17Myx9L20pWzBdXG4gICAgICAgICAgICAgICAgLnRyaW0oKTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZFJlcXVlc3RzID0gc2VjdGlvbkNvbnRlbnQubWF0Y2goLyg/OlxcKiA/XFxuKT9cXCoge3tybWFzc2lzdFxcL2NvcmUuKz8oPz1cXCoge3tybWFzc2lzdFxcL2NvcmV8JCkvZ2lzKTtcblxuICAgICAgICAgICAgaWYgKG1hdGNoZWRSZXF1ZXN0cylcbiAgICAgICAgICAgICAgICBhbGxSZXF1ZXN0c1tzZWN0aW9uXSA9IG1hdGNoZWRSZXF1ZXN0cy5tYXAoKHJlcXVlc3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCA9IHJlcXVlc3QudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdWxsID0gcmVxdWVzdDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHJlcXVlc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKC8oPzpcXCogP1xcbik/XFwqIHt7cm1hc3Npc3RcXC9jb3JlIFxcfHx9fS4qL2dpcywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJyB8ICcpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChwYXJhbWV0ZXIpID0+IHBhcmFtZXRlci50cmltKCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbmFsUGFyYW1ldGVycyA9IE9iamVjdC5mcm9tRW50cmllcyhwYXJhbWV0ZXJzLm1hcCgocGFyYW1ldGVyKSA9PiBwYXJhbWV0ZXIuc3BsaXQoJyA9ICcpLm1hcCgodmFsdWUpID0+IHZhbHVlLnRyaW0oKSkpKSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5mdWxsID0gZnVsbDtcblxuICAgICAgICAgICAgICAgICAgICBmaW5hbFBhcmFtZXRlcnMub3JpZ2luYWwgPSBmaW5hbFBhcmFtZXRlcnNbMV07XG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5kZXN0aW5hdGlvbiA9IGZpbmFsUGFyYW1ldGVyc1syXTtcblxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzFdO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzJdO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaW5hbFBhcmFtZXRlcnMgYXMgdW5rbm93biBhcyBSZXF1ZXN0O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl0gPSBbXTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLm1hcChhc3luYyAoWywgcmVxdWVzdHNdKSA9PiB7XG4gICAgICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RzLm1hcChhc3luYyAocmVxdWVzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdPbGRUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3Qub3JpZ2luYWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdOZXdUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3QuZGVzdGluYXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW13T2xkVGl0bGUpIHJldHVybiBtdy5ub3RpZnkoYEludmFsaWQgdGl0bGUgXCIke3JlcXVlc3Qub3JpZ2luYWx9XCIhYCwgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtd05ld1RpdGxlKSByZXR1cm4gbXcubm90aWZ5KGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWAsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsaWRUaXRsZSA9ICEvWyM8PltcXF17fH1dLy50ZXN0KHJlcXVlc3QuZGVzdGluYXRpb24pICYmIG13TmV3VGl0bGU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGludmFsaWRUaXRsZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkVGl0bGVXYXJuaW5nLmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LWludmFsaWQtd2FybmluZycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZFRpdGxlV2FybmluZy50ZXh0Q29udGVudCA9IGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkTmFtZXNwYWNlID0gIVtuYW1lc3BhY2VzLmZpbGUsIG5hbWVzcGFjZXMuY2F0ZWdvcnldLnNvbWUoKG5hbWVzcGFjZSkgPT4gbXdPbGRUaXRsZS5uYW1lc3BhY2UgPT09IG5hbWVzcGFjZSB8fCBtd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52YWxpZE5hbWVzcGFjZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkTmFtZXNwYWNlV2FybmluZy5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1pbnZhbGlkLXdhcm5pbmcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWROYW1lc3BhY2VXYXJuaW5nLnRleHRDb250ZW50ID0gYFdhcm5pbmc6IG9yaWdpbmFsIG9yIGRlc3RpbmF0aW9uIHBhZ2UgaXMgaW4gbmFtZXNwYWNlIFwiJHttd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlcy5maWxlID8gJ2ZpbGUnIDogJ2NhdGVnb3J5J31cIiFgO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRXaWtpdGV4dCA9IGF3YWl0IG5ldyBtdy5BcGkoKS5wYXJzZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgW1s6JHtyZXF1ZXN0Lm9yaWdpbmFsfV1dIFx1MjE5MiAke3ZhbGlkVGl0bGUgPyBgW1s6JHtyZXF1ZXN0LmRlc3RpbmF0aW9ufV1dYCA6IGludmFsaWRUaXRsZVdhcm5pbmcub3V0ZXJIVE1MfSByZXF1ZXN0ZWQgYnkgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5yZXF1ZXN0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gbXcudXRpbC5pc0lQQWRkcmVzcyhyZXF1ZXN0LnJlcXVlc3RlcilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGBbW1NwZWNpYWw6Q29udHJpYnV0aW9ucy8ke3JlcXVlc3QucmVxdWVzdGVyfXwke3JlcXVlc3QucmVxdWVzdGVyfV1dYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogYFtbVXNlcjoke3JlcXVlc3QucmVxdWVzdGVyfXwke3JlcXVlc3QucmVxdWVzdGVyfV1dYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiByZXF1ZXN0LnNpZy5tYXRjaCgvKFxcW3syfVNwZWNpYWw6Q29udHJpYnV0aW9uc1xcLyguKj8pXFx8XFwyXXsyfSkvKSFbMV1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IHdpdGggcmVhc29uaW5nIFwiJHtyZXF1ZXN0LnJlYXNvbn1cImAsXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkSHRtbCA9IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcocGFyc2VkV2lraXRleHQsICd0ZXh0L2h0bWwnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuaW5uZXJIVE1MID0gcGFyc2VkSHRtbC5xdWVyeVNlbGVjdG9yKCdkaXYubXctcGFyc2VyLW91dHB1dCcpIS5maXJzdEVsZW1lbnRDaGlsZCEuaW5uZXJIVE1MITtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF2YWxpZE5hbWVzcGFjZSkgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKGludmFsaWROYW1lc3BhY2VXYXJuaW5nKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5lbGVtZW50ID0gcmVxdWVzdEVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBvdXRwdXRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIG91dHB1dEVsZW1lbnQuaWQgPSAncm10ci1yZXZpZXctcmVzdWx0JztcblxuICAgICAgICBjb25zdCBoZWFkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgaGVhZGVyLmlkID0gJ3JtdHItcmV2aWV3LWhlYWRlcic7XG4gICAgICAgIGhlYWRlci50ZXh0Q29udGVudCA9ICdUZWNobmljYWwgbW92ZSByZXF1ZXN0cyByZXZpZXcnO1xuXG4gICAgICAgIG91dHB1dEVsZW1lbnQuYXBwZW5kKGhlYWRlcik7XG5cbiAgICAgICAgZm9yIChjb25zdCBbc2VjdGlvbkluZGV4LCBbc2VjdGlvbiwgcmVxdWVzdHNdXSBvZiBPYmplY3QuZW50cmllcyhhbGxSZXF1ZXN0cykuZW50cmllcygpKSB7XG4gICAgICAgICAgICBjb25zdCBzZWN0aW9uSGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICBzZWN0aW9uSGVhZGVyLmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LWhlYWRlcicpO1xuICAgICAgICAgICAgc2VjdGlvbkhlYWRlci50ZXh0Q29udGVudCA9IHNlY3Rpb247XG5cbiAgICAgICAgICAgIG91dHB1dEVsZW1lbnQuYXBwZW5kKHNlY3Rpb25IZWFkZXIpO1xuXG4gICAgICAgICAgICBjb25zdCBzZWN0aW9uQ29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgc2VjdGlvbkNvbnRlbnQuY2xhc3NMaXN0LmFkZCgncm10ci1yZXZpZXctc2VjdGlvbi1jb250ZW50Jyk7XG5cbiAgICAgICAgICAgIGlmIChyZXF1ZXN0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub1JlcXVlc3RzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICAgICAgbm9SZXF1ZXN0cy50ZXh0Q29udGVudCA9ICdObyByZXF1ZXN0cyBpbiB0aGlzIHNlY3Rpb24nO1xuXG4gICAgICAgICAgICAgICAgc2VjdGlvbkNvbnRlbnQuYXBwZW5kKG5vUmVxdWVzdHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0c0xpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd1bCcpO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBbcmVxdWVzdEluZGV4LCByZXF1ZXN0XSBvZiByZXF1ZXN0cy5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdEVsZW1lbnQgPSByZXF1ZXN0LmVsZW1lbnQ7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZlUmVxdWVzdENoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LnR5cGUgPSAnY2hlY2tib3gnO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guY2xhc3NMaXN0LmFkZCgncm10ci1yZXZpZXctcmVxdWVzdC1jaGVja2JveCcpO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guaWQgPSBgcm10ci1yZXZpZXctcmVtb3ZlLXJlcXVlc3QtJHtzZWN0aW9uSW5kZXh9LSR7cmVxdWVzdEluZGV4fWA7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVtb3ZlUmVxdWVzdENoZWNrYm94LmNoZWNrZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdCA9IHsgcmVtb3ZlOiB0cnVlLCByZWFzb246IHJlbW92ZVJlcXVlc3REcm9wZG93bi52YWx1ZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cy5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkNoZWNrYm94LmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25DaGVja2JveC5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0TGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsYWJlbCcpO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0TGFiZWwuaHRtbEZvciA9IGBybXRyLXJldmlldy1yZW1vdmUtcmVxdWVzdC0ke3NlY3Rpb25JbmRleH0tJHtyZXF1ZXN0SW5kZXh9YDtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdExhYmVsLnRleHRDb250ZW50ID0gJ1JlbW92ZSByZXF1ZXN0JztcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQocmVtb3ZlUmVxdWVzdENoZWNrYm94KTtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RMYWJlbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgYXMgJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3REcm9wZG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VjdGlvbiA9PT0gJ0NvbnRlc3RlZCB0ZWNobmljYWwgcmVxdWVzdHMnKSByZW1vdmVSZXF1ZXN0RHJvcGRvd24udmFsdWUgPSAnQ29udGVzdGVkJztcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdERyb3Bkb3duLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdCBhcyBSZXF1ZXN0UmVzdWx0UmVtb3ZlKS5yZWFzb24gPSByZW1vdmVSZXF1ZXN0RHJvcGRvd24udmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3REcm9wZG93bk9wdGlvbnMgPSBbXG4gICAgICAgICAgICAgICAgICAgICAgICAnQ29tcGxldGVkJywgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgICdDb250ZXN0ZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0FscmVhZHkgZG9uZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnSW52YWxpZCBwYWdlIG5hbWUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0luY29ycmVjdCB2ZW51ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnV2l0aGRyYXduJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdOb3QgZG9uZScsXG4gICAgICAgICAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBvcHRpb24gb2YgcmVtb3ZlUmVxdWVzdERyb3Bkb3duT3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uRWxlbWVudC52YWx1ZSA9IG9wdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudGV4dENvbnRlbnQgPSBvcHRpb247XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3REcm9wZG93bi5hcHBlbmQob3B0aW9uRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuYXBwZW5kKHJlbW92ZVJlcXVlc3REcm9wZG93bik7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvbkNoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkNoZWNrYm94LnR5cGUgPSAnY2hlY2tib3gnO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guY2xhc3NMaXN0LmFkZCgncm10ci1yZXZpZXctcmVxdWVzdC1jaGVja2JveCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guaWQgPSBgcm10ci1yZXZpZXctbW92ZS1yZXF1ZXN0LSR7c2VjdGlvbkluZGV4fS0ke3JlcXVlc3RJbmRleH1gO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN3aXRjaFNlY3Rpb25DaGVja2JveC5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0IGFzIFJlcXVlc3RSZXN1bHRNb3ZlKSA9IHsgbW92ZTogdHJ1ZSwgc2VjdGlvbjogc3dpdGNoU2VjdGlvbkRyb3Bkb3duLnZhbHVlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25MYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25MYWJlbC5odG1sRm9yID0gYHJtdHItcmV2aWV3LW1vdmUtcmVxdWVzdC0ke3NlY3Rpb25JbmRleH0tJHtyZXF1ZXN0SW5kZXh9YDtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkxhYmVsLnRleHRDb250ZW50ID0gJ1N3aXRjaCBzZWN0aW9uJztcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQoc3dpdGNoU2VjdGlvbkNoZWNrYm94KTtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHN3aXRjaFNlY3Rpb25MYWJlbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgdG8gJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25Ecm9wZG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRHJvcGRvd24uYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgKGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0IGFzIFJlcXVlc3RSZXN1bHRNb3ZlKS5zZWN0aW9uID0gc3dpdGNoU2VjdGlvbkRyb3Bkb3duLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG9wdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbiA9PT0gc2VjdGlvbikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudmFsdWUgPSBvcHRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25FbGVtZW50LnRleHRDb250ZW50ID0gb3B0aW9uO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRHJvcGRvd24uYXBwZW5kKG9wdGlvbkVsZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLmFwcGVuZChzd2l0Y2hTZWN0aW9uRHJvcGRvd24pO1xuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyB3aXRoIHJlYXNvbmluZyAnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvblJlYXNvbmluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25SZWFzb25pbmcudHlwZSA9ICd0ZXh0JztcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvblJlYXNvbmluZy5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdCBhcyBSZXF1ZXN0UmVzdWx0UmVtb3ZlKS5yZWFzb24gPSBzd2l0Y2hTZWN0aW9uUmVhc29uaW5nLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKHN3aXRjaFNlY3Rpb25SZWFzb25pbmcpO1xuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyAob3B0aW9uYWwsIGF1dG9tYXRpY2FsbHkgc2lnbmVkKScpKTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQoc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzKTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0c0xpc3QuYXBwZW5kKHJlcXVlc3RFbGVtZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWN0aW9uQ29udGVudC5hcHBlbmQocmVxdWVzdHNMaXN0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3V0cHV0RWxlbWVudC5hcHBlbmQoc2VjdGlvbkNvbnRlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3VibWl0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIHN1Ym1pdEJ1dHRvbi5pZCA9ICdybXRyLXJldmlldy1zdWJtaXQnO1xuICAgICAgICBzdWJtaXRCdXR0b24udGV4dENvbnRlbnQgPSAnU3VibWl0JztcbiAgICAgICAgc3VibWl0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmV3UGFnZVJldmlzaW9uID0gYXdhaXQgZ2V0UGFnZVJldmlzaW9uKCk7XG5cbiAgICAgICAgICAgIGlmIChuZXdQYWdlUmV2aXNpb24ucmV2aWQgIT09IHJldklkKSByZXR1cm4gbXcubm90aWZ5KCdybXRyLWhlbHBlcjogQW4gZWRpdCBjb25mbGljdCBvY2N1cnJlZCwgcGxlYXNlIHN0YXJ0IG92ZXIhJywgeyB0eXBlOiAnZXJyb3InIH0pO1xuXG4gICAgICAgICAgICBzdWJtaXRCdXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgbG9hZGluZ1NwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuXG4gICAgICAgICAgICBsZXQgZW5kUmVzdWx0ID0gcGFnZUNvbnRlbnQ7XG5cbiAgICAgICAgICAgIGludGVyZmFjZSBBbGxDaGFuZ2VzIHtcbiAgICAgICAgICAgICAgICByZW1vdmU6IFJlY29yZDxzdHJpbmcsIFJlcXVlc3RbXT47XG4gICAgICAgICAgICAgICAgbW92ZTogUmVjb3JkPHN0cmluZywgUmVxdWVzdFtdPjtcbiAgICAgICAgICAgICAgICB0b3RhbDogbnVtYmVyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjaGFuZ2VzOiBBbGxDaGFuZ2VzID0geyByZW1vdmU6IHt9LCBtb3ZlOiB7fSwgdG90YWw6IDAgfTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCBzZWN0aW9uIG9mIE9iamVjdC52YWx1ZXMoYWxsUmVxdWVzdHMpKVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcmVxdWVzdCBvZiBzZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVxdWVzdC5yZXN1bHQpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICgncmVtb3ZlJyBpbiByZXF1ZXN0LnJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZW5kUmVzdWx0ID0gZW5kUmVzdWx0LnJlcGxhY2UocmVxdWVzdC5mdWxsICsgJ1xcbicsICcnKS5yZXBsYWNlKHJlcXVlc3QuZnVsbCwgJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjaGFuZ2VzLnJlbW92ZVtyZXF1ZXN0LnJlc3VsdC5yZWFzb25dKSBjaGFuZ2VzLnJlbW92ZVtyZXF1ZXN0LnJlc3VsdC5yZWFzb25dID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzLnJlbW92ZVtyZXF1ZXN0LnJlc3VsdC5yZWFzb25dLnB1c2gocmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzLnRvdGFsKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoJ21vdmUnIGluIHJlcXVlc3QucmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWN0aW9uVGl0bGVBZnRlciA9IHNlY3Rpb25zW3NlY3Rpb25zLmluZGV4T2YocmVxdWVzdC5yZXN1bHQuc2VjdGlvbikgKyAxXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZW5kUmVzdWx0ID0gZW5kUmVzdWx0LnJlcGxhY2UocmVxdWVzdC5mdWxsICsgJ1xcbicsICcnKS5yZXBsYWNlKHJlcXVlc3QuZnVsbCwgJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZW5kUmVzdWx0ID0gZW5kUmVzdWx0LnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFJlZ0V4cChgKFxcbj9cXG4/KD86PXszLH0gPyR7c2VjdGlvblRpdGxlQWZ0ZXJ9ID89ezMsfXwkKSlgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgXFxuJHtyZXF1ZXN0LmZ1bGx9JHtyZXF1ZXN0LnJlc3VsdC5yZWFzb24gPyBgXFxuOjogJHtyZXF1ZXN0LnJlc3VsdC5yZWFzb259IH5+fn5gIDogJyd9JDFgLFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2hhbmdlcy5tb3ZlW3JlcXVlc3QucmVzdWx0LnNlY3Rpb25dKSBjaGFuZ2VzLm1vdmVbcmVxdWVzdC5yZXN1bHQuc2VjdGlvbl0gPSBbXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy5tb3ZlW3JlcXVlc3QucmVzdWx0LnNlY3Rpb25dLnB1c2gocmVxdWVzdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzLnRvdGFsKys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjaGFuZ2VzLnRvdGFsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgc3VibWl0QnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgbG9hZGluZ1NwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICByZXR1cm4gbXcubm90aWZ5KCdObyBjaGFuZ2VzIHRvIG1ha2UhJywgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub1JlbWFpbmluZyA9IE9iamVjdC52YWx1ZXMoYWxsUmVxdWVzdHMpLmV2ZXJ5KChzZWN0aW9uKSA9PiBzZWN0aW9uLmV2ZXJ5KChyZXF1ZXN0KSA9PiByZXF1ZXN0LnJlc3VsdCAmJiAncmVtb3ZlJyBpbiByZXF1ZXN0LnJlc3VsdCkpO1xuXG4gICAgICAgICAgICBjb25zdCBlZGl0U3VtbWFyeSA9IGBIYW5kbGVkICR7Y2hhbmdlcy50b3RhbH0gcmVxdWVzdCR7Y2hhbmdlcy50b3RhbCA+IDEgPyAncycgOiAnJ306ICR7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoY2hhbmdlcy5yZW1vdmUpLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgPyBgUmVtb3ZlZCAke09iamVjdC5lbnRyaWVzKGNoYW5nZXMucmVtb3ZlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKChbcmVhc29uLCBwYWdlc10pID0+IGAke3BhZ2VzLm1hcCgocGFnZSkgPT4gYFtbJHtwYWdlLm9yaWdpbmFsfV1dYCkuam9pbignLCAnKX0gYXMgJHtyZWFzb24udG9Mb3dlckNhc2UoKX1gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKX1gXG4gICAgICAgICAgICAgICAgICAgIDogJydcbiAgICAgICAgICAgIH0ke1xuICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKGNoYW5nZXMubW92ZSkubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICAgICA/IGAke09iamVjdC5lbnRyaWVzKGNoYW5nZXMucmVtb3ZlKS5sZW5ndGggPiAwID8gJywgJyA6ICcnfU1vdmVkICR7T2JqZWN0LmVudHJpZXMoY2hhbmdlcy5tb3ZlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKChbZGVzdGluYXRpb24sIHBhZ2VzXSkgPT4gYCR7cGFnZXMubWFwKChwYWdlKSA9PiBgW1ske3BhZ2Uub3JpZ2luYWx9XV1gKS5qb2luKCcsICcpfSB0byBcIiR7ZGVzdGluYXRpb259XCJgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKX1gXG4gICAgICAgICAgICAgICAgICAgIDogJydcbiAgICAgICAgICAgIH0ke25vUmVtYWluaW5nID8gJyAobm8gcmVxdWVzdHMgcmVtYWluKScgOiAnJ30gKHZpYSBbW1VzZXI6RWVqaXQ0My9zY3JpcHRzL3JtdHItaGVscGVyfHNjcmlwdF1dKWA7XG5cbiAgICAgICAgICAgIGlmIChkZXZlbG9wbWVudE1vZGUpIHNob3dFZGl0UHJldmlldyhtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksIGVuZFJlc3VsdCwgZWRpdFN1bW1hcnkpO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmVkaXQobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpLCAoKSA9PiAoeyB0ZXh0OiBlbmRSZXN1bHQsIHN1bW1hcnk6IGVkaXRTdW1tYXJ5IH0pKTtcblxuICAgICAgICAgICAgICAgIG13Lm5vdGlmeShgU3VjY2Vzc2Z1bGx5IGhhbmRsZWQgJHtjaGFuZ2VzLnRvdGFsfSByZXF1ZXN0cywgcmVsb2FkaW5nLi4uYCwgeyB0eXBlOiAnc3VjY2VzcycgfSk7XG5cbiAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGxvYWRpbmdTcGlubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICBsb2FkaW5nU3Bpbm5lci5pZCA9ICdybXRyLXJldmlldy1sb2FkaW5nJztcbiAgICAgICAgbG9hZGluZ1NwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICBzdWJtaXRCdXR0b24uYXBwZW5kKGxvYWRpbmdTcGlubmVyKTtcblxuICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChzdWJtaXRCdXR0b24pO1xuXG4gICAgICAgIG13LnV0aWwuJGNvbnRlbnRbMF0ucHJlcGVuZChvdXRwdXRFbGVtZW50KTtcblxuICAgICAgICBvdXRwdXRFbGVtZW50LnNjcm9sbEludG9WaWV3KCk7XG4gICAgfSk7XG59KTtcblxuLyoqXG4gKiBHZXRzIGluZm9ybWF0aW9uIGFib3V0IGEgd2lraSBwYWdlJ3MgbGF0ZXN0IHJldmlzaW9uLlxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQYWdlUmV2aXNpb24oKSB7XG4gICAgcmV0dXJuICgoYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7IGFjdGlvbjogJ3F1ZXJ5JywgZm9ybWF0dmVyc2lvbjogMiwgcHJvcDogJ3JldmlzaW9ucycsIHJ2cHJvcDogJ2NvbnRlbnR8aWRzJywgcnZzbG90czogJyonLCB0aXRsZXM6IG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSB9KSkgYXMgUGFnZVJldmlzaW9uc1Jlc3VsdCkucXVlcnlcbiAgICAgICAgLnBhZ2VzWzBdLnJldmlzaW9uc1swXTtcbn1cblxuLyoqXG4gKiBTaG93cyBhIGRpZmYgZWRpdCBwcmV2aWV3IGZvciB0aGUgZ2l2ZW4gd2lraXRleHQgb24gYSBnaXZlbiBwYWdlLlxuICogQHBhcmFtIHRpdGxlIFRoZSB0aXRsZSBvZiB0aGUgcGFnZSB0byBlZGl0LlxuICogQHBhcmFtIHRleHQgVGhlIHJlc3VsdGluZyB3aWtpdGV4dCBvZiB0aGUgcGFnZS5cbiAqIEBwYXJhbSBzdW1tYXJ5IFRoZSBlZGl0IHN1bW1hcnkuXG4gKi9cbmZ1bmN0aW9uIHNob3dFZGl0UHJldmlldyh0aXRsZTogc3RyaW5nLCB0ZXh0OiBzdHJpbmcsIHN1bW1hcnk6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGJhc2VVcmwgPSBtdy5jb25maWcuZ2V0KCd3Z1NlcnZlcicpICsgbXcuY29uZmlnLmdldCgnd2dTY3JpcHRQYXRoJykgKyAnLyc7XG5cbiAgICBjb25zdCBmb3JtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZm9ybScpO1xuICAgIGZvcm0uYWN0aW9uID0gYCR7YmFzZVVybH1pbmRleC5waHA/dGl0bGU9JHtlbmNvZGVVUklDb21wb25lbnQodGl0bGUpfSZhY3Rpb249c3VibWl0YDtcbiAgICBmb3JtLm1ldGhvZCA9ICdQT1NUJztcblxuICAgIGNvbnN0IHRleHRib3hJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgdGV4dGJveElucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICB0ZXh0Ym94SW5wdXQubmFtZSA9ICd3cFRleHRib3gxJztcbiAgICB0ZXh0Ym94SW5wdXQudmFsdWUgPSB0ZXh0O1xuICAgIGZvcm0uYXBwZW5kKHRleHRib3hJbnB1dCk7XG5cbiAgICBjb25zdCBzdW1tYXJ5SW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHN1bW1hcnlJbnB1dC50eXBlID0gJ2hpZGRlbic7XG4gICAgc3VtbWFyeUlucHV0Lm5hbWUgPSAnd3BTdW1tYXJ5JztcbiAgICBzdW1tYXJ5SW5wdXQudmFsdWUgPSBzdW1tYXJ5O1xuICAgIGZvcm0uYXBwZW5kKHN1bW1hcnlJbnB1dCk7XG5cbiAgICBjb25zdCBwcmV2aWV3SW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHByZXZpZXdJbnB1dC50eXBlID0gJ2hpZGRlbic7XG4gICAgcHJldmlld0lucHV0Lm5hbWUgPSAnbW9kZSc7XG4gICAgcHJldmlld0lucHV0LnZhbHVlID0gJ3ByZXZpZXcnO1xuICAgIGZvcm0uYXBwZW5kKHByZXZpZXdJbnB1dCk7XG5cbiAgICBjb25zdCBzaG93Q2hhbmdlc0lucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICBzaG93Q2hhbmdlc0lucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICBzaG93Q2hhbmdlc0lucHV0Lm5hbWUgPSAnd3BEaWZmJztcbiAgICBzaG93Q2hhbmdlc0lucHV0LnZhbHVlID0gJ1Nob3cgY2hhbmdlcyc7XG4gICAgZm9ybS5hcHBlbmQoc2hvd0NoYW5nZXNJbnB1dCk7XG5cbiAgICBjb25zdCB1bHRpbWF0ZVBhcmFtZXRlcklucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICB1bHRpbWF0ZVBhcmFtZXRlcklucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICB1bHRpbWF0ZVBhcmFtZXRlcklucHV0Lm5hbWUgPSAnd3BVbHRpbWF0ZVBhcmFtJztcbiAgICB1bHRpbWF0ZVBhcmFtZXRlcklucHV0LnZhbHVlID0gJzEnO1xuICAgIGZvcm0uYXBwZW5kKHVsdGltYXRlUGFyYW1ldGVySW5wdXQpO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmQoZm9ybSk7XG4gICAgZm9ybS5zdWJtaXQoKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFJQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixHQUFHLE1BQU07QUFDdEMsUUFBTSxrQkFBa0I7QUFFeEIsTUFBSSxHQUFHLE9BQU8sSUFBSSxZQUFZ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
