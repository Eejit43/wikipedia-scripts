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
    const pageContent = (await new mw.Api().get({ action: "query", formatversion: 2, prop: "revisions", rvprop: "content", rvslots: "*", titles: mw.config.get("wgPageName") })).query.pages[0].revisions[0].slots.main.content;
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
            const parsedWikitext = await new mw.Api().parse(`[[:${request.original}]] \u2192 ${validTitle ? `[[:${request.destination}]]` : invalidTitleWarning.outerHTML} requested by ${mw.util.isIPAddress(request.requester) ? `[[Special:Contributions/${request.requester}|${request.requester}]]` : `[[User:${request.requester}|${request.requester}]]`} with reasoning "${request.reason}"`);
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
            "Incorrect venue"
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
            endResult = endResult.replace(new RegExp(`(
?
?(?:={3,} ?${sectionTitleAfter} ?={3,}|$))`), `
${request.full}${request.result.reason ? `
:: ${request.result.reason} ~~~~` : ""}$1`);
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
      const noRemaining = Object.values(allRequests).every((section) => section.every((request) => !(request.result && "remove" in request.result)));
      const editSummary = `Handled ${changes.total} request${changes.total > 1 ? "s" : ""}: ${Object.entries(changes.remove).length > 0 ? `Removed ${Object.entries(changes.remove).map(([reason, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(", ")} as ${reason.toLowerCase()}`).join(", ")}` : ""}${Object.entries(changes.move).length > 0 ? `${Object.entries(changes.remove).length > 0 ? ", " : ""}Moved ${Object.entries(changes.move).map(([destination, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(", ")} to "${destination}"`).join(", ")}` : ""} ${noRemaining ? "(no requests remain)" : ""} (via [[User:Eejit43/scripts/rmtr-helper|script]])`;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9ybXRyLWhlbHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGFnZVJldmlzaW9uc1Jlc3VsdCB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gaW1wb3J0U3R5bGVzaGVldChwYWdlOiBzdHJpbmcpOiB2b2lkO1xuXG5tdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgY29uc3QgZGV2ZWxvcG1lbnRNb2RlID0gZmFsc2U7XG5cbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpICE9PSAoZGV2ZWxvcG1lbnRNb2RlID8gJ1VzZXI6RWVqaXQ0My9zYW5kYm94JyA6ICdXaWtpcGVkaWE6UmVxdWVzdGVkX21vdmVzL1RlY2huaWNhbF9yZXF1ZXN0cycpKSByZXR1cm47XG5cbiAgICBpbXBvcnRTdHlsZXNoZWV0KCdVc2VyOkVlaml0NDMvc2NyaXB0cy9ybXRyLWhlbHBlci5jc3MnKTtcblxuICAgIGNvbnN0IG5hbWVzcGFjZXMgPSBtdy5jb25maWcuZ2V0KCd3Z05hbWVzcGFjZUlkcycpO1xuXG4gICAgbGV0IGRpc3BsYXllZCA9IGZhbHNlO1xuXG4gICAgY29uc3QgbGluayA9IG13LnV0aWwuYWRkUG9ydGxldExpbmsobXcuY29uZmlnLmdldCgnc2tpbicpID09PSAnbWluZXJ2YScgPyAncC10YicgOiAncC1jYWN0aW9ucycsICcjJywgYFJldmlldyBtb3ZlIHJlcXVlc3RzJHtkZXZlbG9wbWVudE1vZGUgPyAnIChERVYpJyA6ICcnfWAsICdyZXZpZXctcm10ci1yZXF1ZXN0cycpO1xuXG4gICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGlmIChkaXNwbGF5ZWQpIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcm10ci1yZXZpZXctcmVzdWx0Jyk/LnNjcm9sbEludG9WaWV3KCk7XG4gICAgICAgIGVsc2UgZGlzcGxheWVkID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBwYWdlQ29udGVudCA9ICgoYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7IGFjdGlvbjogJ3F1ZXJ5JywgZm9ybWF0dmVyc2lvbjogMiwgcHJvcDogJ3JldmlzaW9ucycsIHJ2cHJvcDogJ2NvbnRlbnQnLCBydnNsb3RzOiAnKicsIHRpdGxlczogbXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpIH0pKSBhcyBQYWdlUmV2aXNpb25zUmVzdWx0KS5xdWVyeS5wYWdlc1swXS5yZXZpc2lvbnNbMF0uc2xvdHMubWFpbi5jb250ZW50O1xuXG4gICAgICAgIGNvbnN0IHNlY3Rpb25zID0gWydVbmNvbnRyb3ZlcnNpYWwgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ1JlcXVlc3RzIHRvIHJldmVydCB1bmRpc2N1c3NlZCBtb3ZlcycsICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ0FkbWluaXN0cmF0b3IgbmVlZGVkJ107XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3Qge1xuICAgICAgICAgICAgcmVxdWVzdGVyOiBzdHJpbmc7XG4gICAgICAgICAgICByZWFzb246IHN0cmluZztcbiAgICAgICAgICAgIGZ1bGw6IHN0cmluZztcbiAgICAgICAgICAgIG9yaWdpbmFsOiBzdHJpbmc7XG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgZWxlbWVudDogSFRNTExJRWxlbWVudDtcbiAgICAgICAgICAgIHJlc3VsdD86IFJlcXVlc3RSZXN1bHRNb3ZlIHwgUmVxdWVzdFJlc3VsdFJlbW92ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGludGVyZmFjZSBSZXF1ZXN0UmVzdWx0TW92ZSB7XG4gICAgICAgICAgICBtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgc2VjdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgcmVhc29uPzogc3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3RSZXN1bHRSZW1vdmUge1xuICAgICAgICAgICAgcmVtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgcmVhc29uOiBzdHJpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhbGxSZXF1ZXN0czogUmVjb3JkPHN0cmluZywgUmVxdWVzdFtdPiA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBwYWdlQ29udGVudFxuICAgICAgICAgICAgICAgIC5zcGxpdChuZXcgUmVnRXhwKGA9ezMsfSA/JHtzZWN0aW9ufSA/PXszLH1gKSlbMV1cbiAgICAgICAgICAgICAgICAuc3BsaXQoLz17Myx9L20pWzBdXG4gICAgICAgICAgICAgICAgLnRyaW0oKTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZFJlcXVlc3RzID0gc2VjdGlvbkNvbnRlbnQubWF0Y2goLyg/OlxcKiA/XFxuKT9cXCoge3tybWFzc2lzdFxcL2NvcmUuKz8oPz1cXCoge3tybWFzc2lzdFxcL2NvcmV8JCkvZ2lzKTtcblxuICAgICAgICAgICAgaWYgKG1hdGNoZWRSZXF1ZXN0cylcbiAgICAgICAgICAgICAgICBhbGxSZXF1ZXN0c1tzZWN0aW9uXSA9IG1hdGNoZWRSZXF1ZXN0cy5tYXAoKHJlcXVlc3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCA9IHJlcXVlc3QudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdWxsID0gcmVxdWVzdDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHJlcXVlc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKC8oPzpcXCogP1xcbik/XFwqIHt7cm1hc3Npc3RcXC9jb3JlIFxcfHx9fS4qL2dpcywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJyB8ICcpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChwYXJhbWV0ZXIpID0+IHBhcmFtZXRlci50cmltKCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbmFsUGFyYW1ldGVycyA9IE9iamVjdC5mcm9tRW50cmllcyhwYXJhbWV0ZXJzLm1hcCgocGFyYW1ldGVyKSA9PiBwYXJhbWV0ZXIuc3BsaXQoJyA9ICcpLm1hcCgodmFsdWUpID0+IHZhbHVlLnRyaW0oKSkpKSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5mdWxsID0gZnVsbDtcblxuICAgICAgICAgICAgICAgICAgICBmaW5hbFBhcmFtZXRlcnMub3JpZ2luYWwgPSBmaW5hbFBhcmFtZXRlcnNbMV07XG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5kZXN0aW5hdGlvbiA9IGZpbmFsUGFyYW1ldGVyc1syXTtcblxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzFdO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzJdO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaW5hbFBhcmFtZXRlcnMgYXMgdW5rbm93biBhcyBSZXF1ZXN0O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl0gPSBbXTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLm1hcChhc3luYyAoWywgcmVxdWVzdHNdKSA9PiB7XG4gICAgICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RzLm1hcChhc3luYyAocmVxdWVzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdPbGRUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3Qub3JpZ2luYWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdOZXdUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3QuZGVzdGluYXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW13T2xkVGl0bGUpIHJldHVybiBtdy5ub3RpZnkoYEludmFsaWQgdGl0bGUgXCIke3JlcXVlc3Qub3JpZ2luYWx9XCIhYCwgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtd05ld1RpdGxlKSByZXR1cm4gbXcubm90aWZ5KGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWAsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsaWRUaXRsZSA9ICEvWyM8PltcXF17fH1dLy50ZXN0KHJlcXVlc3QuZGVzdGluYXRpb24pICYmIG13TmV3VGl0bGU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGludmFsaWRUaXRsZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkVGl0bGVXYXJuaW5nLmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LWludmFsaWQtd2FybmluZycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZFRpdGxlV2FybmluZy50ZXh0Q29udGVudCA9IGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkTmFtZXNwYWNlID0gIVtuYW1lc3BhY2VzLmZpbGUsIG5hbWVzcGFjZXMuY2F0ZWdvcnldLnNvbWUoKG5hbWVzcGFjZSkgPT4gbXdPbGRUaXRsZS5uYW1lc3BhY2UgPT09IG5hbWVzcGFjZSB8fCBtd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52YWxpZE5hbWVzcGFjZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkTmFtZXNwYWNlV2FybmluZy5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1pbnZhbGlkLXdhcm5pbmcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWROYW1lc3BhY2VXYXJuaW5nLnRleHRDb250ZW50ID0gYFdhcm5pbmc6IG9yaWdpbmFsIG9yIGRlc3RpbmF0aW9uIHBhZ2UgaXMgaW4gbmFtZXNwYWNlIFwiJHttd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlcy5maWxlID8gJ2ZpbGUnIDogJ2NhdGVnb3J5J31cIiFgO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRXaWtpdGV4dCA9IGF3YWl0IG5ldyBtdy5BcGkoKS5wYXJzZShgW1s6JHtyZXF1ZXN0Lm9yaWdpbmFsfV1dIFx1MjE5MiAke3ZhbGlkVGl0bGUgPyBgW1s6JHtyZXF1ZXN0LmRlc3RpbmF0aW9ufV1dYCA6IGludmFsaWRUaXRsZVdhcm5pbmcub3V0ZXJIVE1MfSByZXF1ZXN0ZWQgYnkgJHttdy51dGlsLmlzSVBBZGRyZXNzKHJlcXVlc3QucmVxdWVzdGVyKSA/IGBbW1NwZWNpYWw6Q29udHJpYnV0aW9ucy8ke3JlcXVlc3QucmVxdWVzdGVyfXwke3JlcXVlc3QucmVxdWVzdGVyfV1dYCA6IGBbW1VzZXI6JHtyZXF1ZXN0LnJlcXVlc3Rlcn18JHtyZXF1ZXN0LnJlcXVlc3Rlcn1dXWB9IHdpdGggcmVhc29uaW5nIFwiJHtyZXF1ZXN0LnJlYXNvbn1cImApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkSHRtbCA9IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcocGFyc2VkV2lraXRleHQsICd0ZXh0L2h0bWwnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuaW5uZXJIVE1MID0gcGFyc2VkSHRtbC5xdWVyeVNlbGVjdG9yKCdkaXYubXctcGFyc2VyLW91dHB1dCcpIS5maXJzdEVsZW1lbnRDaGlsZCEuaW5uZXJIVE1MITtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF2YWxpZE5hbWVzcGFjZSkgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKGludmFsaWROYW1lc3BhY2VXYXJuaW5nKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5lbGVtZW50ID0gcmVxdWVzdEVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3Qgb3V0cHV0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBvdXRwdXRFbGVtZW50LmlkID0gJ3JtdHItcmV2aWV3LXJlc3VsdCc7XG5cbiAgICAgICAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGhlYWRlci5pZCA9ICdybXRyLXJldmlldy1oZWFkZXInO1xuICAgICAgICBoZWFkZXIudGV4dENvbnRlbnQgPSAnVGVjaG5pY2FsIG1vdmUgcmVxdWVzdHMgcmV2aWV3JztcblxuICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChoZWFkZXIpO1xuXG4gICAgICAgIGZvciAoY29uc3QgW3NlY3Rpb25JbmRleCwgW3NlY3Rpb24sIHJlcXVlc3RzXV0gb2YgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgc2VjdGlvbkhlYWRlci5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1oZWFkZXInKTtcbiAgICAgICAgICAgIHNlY3Rpb25IZWFkZXIudGV4dENvbnRlbnQgPSBzZWN0aW9uO1xuXG4gICAgICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChzZWN0aW9uSGVhZGVyKTtcblxuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHNlY3Rpb25Db250ZW50LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXNlY3Rpb24tY29udGVudCcpO1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9SZXF1ZXN0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgIG5vUmVxdWVzdHMudGV4dENvbnRlbnQgPSAnTm8gcmVxdWVzdHMgaW4gdGhpcyBzZWN0aW9uJztcblxuICAgICAgICAgICAgICAgIHNlY3Rpb25Db250ZW50LmFwcGVuZChub1JlcXVlc3RzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdHNMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW3JlcXVlc3RJbmRleCwgcmVxdWVzdF0gb2YgcmVxdWVzdHMuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RFbGVtZW50ID0gcmVxdWVzdC5lbGVtZW50O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3RDaGVja2JveCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RDaGVja2JveC50eXBlID0gJ2NoZWNrYm94JztcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXJlcXVlc3QtY2hlY2tib3gnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmlkID0gYHJtdHItcmV2aWV3LXJlbW92ZS1yZXF1ZXN0LSR7c2VjdGlvbkluZGV4fS0ke3JlcXVlc3RJbmRleH1gO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZVJlcXVlc3RDaGVja2JveC5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgPSB7IHJlbW92ZTogdHJ1ZSwgcmVhc29uOiByZW1vdmVSZXF1ZXN0RHJvcGRvd24udmFsdWUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25DaGVja2JveC5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZlUmVxdWVzdExhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdExhYmVsLmh0bWxGb3IgPSBgcm10ci1yZXZpZXctcmVtb3ZlLXJlcXVlc3QtJHtzZWN0aW9uSW5kZXh9LSR7cmVxdWVzdEluZGV4fWA7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RMYWJlbC50ZXh0Q29udGVudCA9ICdSZW1vdmUgcmVxdWVzdCc7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RDaGVja2JveCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmFwcGVuZChyZW1vdmVSZXF1ZXN0TGFiZWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLmFwcGVuZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnIGFzICcpKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0RHJvcGRvd24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlY3Rpb24gPT09ICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJykgcmVtb3ZlUmVxdWVzdERyb3Bkb3duLnZhbHVlID0gJ0NvbnRlc3RlZCc7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3REcm9wZG93bi5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgYXMgUmVxdWVzdFJlc3VsdFJlbW92ZSkucmVhc29uID0gcmVtb3ZlUmVxdWVzdERyb3Bkb3duLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0RHJvcGRvd25PcHRpb25zID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ0NvbXBsZXRlZCcsIC8vXG4gICAgICAgICAgICAgICAgICAgICAgICAnQ29udGVzdGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBbHJlYWR5IGRvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0ludmFsaWQgcGFnZSBuYW1lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdJbmNvcnJlY3QgdmVudWUnXG4gICAgICAgICAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBvcHRpb24gb2YgcmVtb3ZlUmVxdWVzdERyb3Bkb3duT3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uRWxlbWVudC52YWx1ZSA9IG9wdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudGV4dENvbnRlbnQgPSBvcHRpb247XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3REcm9wZG93bi5hcHBlbmQob3B0aW9uRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuYXBwZW5kKHJlbW92ZVJlcXVlc3REcm9wZG93bik7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvbkNoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkNoZWNrYm94LnR5cGUgPSAnY2hlY2tib3gnO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guY2xhc3NMaXN0LmFkZCgncm10ci1yZXZpZXctcmVxdWVzdC1jaGVja2JveCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guaWQgPSBgcm10ci1yZXZpZXctbW92ZS1yZXF1ZXN0LSR7c2VjdGlvbkluZGV4fS0ke3JlcXVlc3RJbmRleH1gO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN3aXRjaFNlY3Rpb25DaGVja2JveC5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0IGFzIFJlcXVlc3RSZXN1bHRNb3ZlKSA9IHsgbW92ZTogdHJ1ZSwgc2VjdGlvbjogc3dpdGNoU2VjdGlvbkRyb3Bkb3duLnZhbHVlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25MYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25MYWJlbC5odG1sRm9yID0gYHJtdHItcmV2aWV3LW1vdmUtcmVxdWVzdC0ke3NlY3Rpb25JbmRleH0tJHtyZXF1ZXN0SW5kZXh9YDtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkxhYmVsLnRleHRDb250ZW50ID0gJ1N3aXRjaCBzZWN0aW9uJztcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQoc3dpdGNoU2VjdGlvbkNoZWNrYm94KTtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHN3aXRjaFNlY3Rpb25MYWJlbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgdG8gJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25Ecm9wZG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRHJvcGRvd24uYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgKGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0IGFzIFJlcXVlc3RSZXN1bHRNb3ZlKS5zZWN0aW9uID0gc3dpdGNoU2VjdGlvbkRyb3Bkb3duLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG9wdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbiA9PT0gc2VjdGlvbikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudmFsdWUgPSBvcHRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25FbGVtZW50LnRleHRDb250ZW50ID0gb3B0aW9uO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRHJvcGRvd24uYXBwZW5kKG9wdGlvbkVsZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLmFwcGVuZChzd2l0Y2hTZWN0aW9uRHJvcGRvd24pO1xuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyB3aXRoIHJlYXNvbmluZyAnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvblJlYXNvbmluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25SZWFzb25pbmcudHlwZSA9ICd0ZXh0JztcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvblJlYXNvbmluZy5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdCBhcyBSZXF1ZXN0UmVzdWx0UmVtb3ZlKS5yZWFzb24gPSBzd2l0Y2hTZWN0aW9uUmVhc29uaW5nLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKHN3aXRjaFNlY3Rpb25SZWFzb25pbmcpO1xuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyAob3B0aW9uYWwsIGF1dG9tYXRpY2FsbHkgc2lnbmVkKScpKTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQoc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzKTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0c0xpc3QuYXBwZW5kKHJlcXVlc3RFbGVtZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWN0aW9uQ29udGVudC5hcHBlbmQocmVxdWVzdHNMaXN0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3V0cHV0RWxlbWVudC5hcHBlbmQoc2VjdGlvbkNvbnRlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3VibWl0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIHN1Ym1pdEJ1dHRvbi5pZCA9ICdybXRyLXJldmlldy1zdWJtaXQnO1xuICAgICAgICBzdWJtaXRCdXR0b24udGV4dENvbnRlbnQgPSAnU3VibWl0JztcbiAgICAgICAgc3VibWl0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgc3VibWl0QnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGxvYWRpbmdTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcblxuICAgICAgICAgICAgbGV0IGVuZFJlc3VsdCA9IHBhZ2VDb250ZW50O1xuXG4gICAgICAgICAgICBpbnRlcmZhY2UgQWxsQ2hhbmdlcyB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlOiBSZWNvcmQ8c3RyaW5nLCBSZXF1ZXN0W10+O1xuICAgICAgICAgICAgICAgIG1vdmU6IFJlY29yZDxzdHJpbmcsIFJlcXVlc3RbXT47XG4gICAgICAgICAgICAgICAgdG90YWw6IG51bWJlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2hhbmdlczogQWxsQ2hhbmdlcyA9IHsgcmVtb3ZlOiB7fSwgbW92ZToge30sIHRvdGFsOiAwIH07XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBPYmplY3QudmFsdWVzKGFsbFJlcXVlc3RzKSlcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJlcXVlc3Qgb2Ygc2VjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlcXVlc3QucmVzdWx0KSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoJ3JlbW92ZScgaW4gcmVxdWVzdC5yZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKHJlcXVlc3QuZnVsbCArICdcXG4nLCAnJykucmVwbGFjZShyZXF1ZXN0LmZ1bGwsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXSkgY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXS5wdXNoKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy50b3RhbCsrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCdtb3ZlJyBpbiByZXF1ZXN0LnJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VjdGlvblRpdGxlQWZ0ZXIgPSBzZWN0aW9uc1tzZWN0aW9ucy5pbmRleE9mKHJlcXVlc3QucmVzdWx0LnNlY3Rpb24pICsgMV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKHJlcXVlc3QuZnVsbCArICdcXG4nLCAnJykucmVwbGFjZShyZXF1ZXN0LmZ1bGwsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKG5ldyBSZWdFeHAoYChcXG4/XFxuPyg/Oj17Myx9ID8ke3NlY3Rpb25UaXRsZUFmdGVyfSA/PXszLH18JCkpYCksIGBcXG4ke3JlcXVlc3QuZnVsbH0ke3JlcXVlc3QucmVzdWx0LnJlYXNvbiA/IGBcXG46OiAke3JlcXVlc3QucmVzdWx0LnJlYXNvbn0gfn5+fmAgOiAnJ30kMWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjaGFuZ2VzLm1vdmVbcmVxdWVzdC5yZXN1bHQuc2VjdGlvbl0pIGNoYW5nZXMubW92ZVtyZXF1ZXN0LnJlc3VsdC5zZWN0aW9uXSA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzLm1vdmVbcmVxdWVzdC5yZXN1bHQuc2VjdGlvbl0ucHVzaChyZXF1ZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZXMudG90YWwrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNoYW5nZXMudG90YWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICBzdWJtaXRCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBsb2FkaW5nU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIHJldHVybiBtdy5ub3RpZnkoJ05vIGNoYW5nZXMgdG8gbWFrZSEnLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vUmVtYWluaW5nID0gT2JqZWN0LnZhbHVlcyhhbGxSZXF1ZXN0cykuZXZlcnkoKHNlY3Rpb24pID0+IHNlY3Rpb24uZXZlcnkoKHJlcXVlc3QpID0+ICEocmVxdWVzdC5yZXN1bHQgJiYgJ3JlbW92ZScgaW4gcmVxdWVzdC5yZXN1bHQpKSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGVkaXRTdW1tYXJ5ID0gYEhhbmRsZWQgJHtjaGFuZ2VzLnRvdGFsfSByZXF1ZXN0JHtjaGFuZ2VzLnRvdGFsID4gMSA/ICdzJyA6ICcnfTogJHtcbiAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhjaGFuZ2VzLnJlbW92ZSkubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICAgICA/IGBSZW1vdmVkICR7T2JqZWN0LmVudHJpZXMoY2hhbmdlcy5yZW1vdmUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKFtyZWFzb24sIHBhZ2VzXSkgPT4gYCR7cGFnZXMubWFwKChwYWdlKSA9PiBgW1ske3BhZ2Uub3JpZ2luYWx9XV1gKS5qb2luKCcsICcpfSBhcyAke3JlYXNvbi50b0xvd2VyQ2FzZSgpfWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpfWBcbiAgICAgICAgICAgICAgICAgICAgOiAnJ1xuICAgICAgICAgICAgfSR7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoY2hhbmdlcy5tb3ZlKS5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgID8gYCR7T2JqZWN0LmVudHJpZXMoY2hhbmdlcy5yZW1vdmUpLmxlbmd0aCA+IDAgPyAnLCAnIDogJyd9TW92ZWQgJHtPYmplY3QuZW50cmllcyhjaGFuZ2VzLm1vdmUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKFtkZXN0aW5hdGlvbiwgcGFnZXNdKSA9PiBgJHtwYWdlcy5tYXAoKHBhZ2UpID0+IGBbWyR7cGFnZS5vcmlnaW5hbH1dXWApLmpvaW4oJywgJyl9IHRvIFwiJHtkZXN0aW5hdGlvbn1cImApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpfWBcbiAgICAgICAgICAgICAgICAgICAgOiAnJ1xuICAgICAgICAgICAgfSAke25vUmVtYWluaW5nID8gJyhubyByZXF1ZXN0cyByZW1haW4pJyA6ICcnfSAodmlhIFtbVXNlcjpFZWppdDQzL3NjcmlwdHMvcm10ci1oZWxwZXJ8c2NyaXB0XV0pYDtcblxuICAgICAgICAgICAgaWYgKGRldmVsb3BtZW50TW9kZSkgc2hvd0VkaXRQcmV2aWV3KG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSwgZW5kUmVzdWx0LCBlZGl0U3VtbWFyeSk7XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZWRpdChtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksICgpID0+ICh7IHRleHQ6IGVuZFJlc3VsdCwgc3VtbWFyeTogZWRpdFN1bW1hcnkgfSkpO1xuXG4gICAgICAgICAgICAgICAgbXcubm90aWZ5KGBTdWNjZXNzZnVsbHkgaGFuZGxlZCAke2NoYW5nZXMudG90YWx9IHJlcXVlc3RzLCByZWxvYWRpbmcuLi5gLCB7IHR5cGU6ICdzdWNjZXNzJyB9KTtcblxuICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgbG9hZGluZ1NwaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIGxvYWRpbmdTcGlubmVyLmlkID0gJ3JtdHItcmV2aWV3LWxvYWRpbmcnO1xuICAgICAgICBsb2FkaW5nU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gICAgICAgIHN1Ym1pdEJ1dHRvbi5hcHBlbmQobG9hZGluZ1NwaW5uZXIpO1xuXG4gICAgICAgIG91dHB1dEVsZW1lbnQuYXBwZW5kKHN1Ym1pdEJ1dHRvbik7XG5cbiAgICAgICAgbXcudXRpbC4kY29udGVudFswXS5wcmVwZW5kKG91dHB1dEVsZW1lbnQpO1xuXG4gICAgICAgIG91dHB1dEVsZW1lbnQuc2Nyb2xsSW50b1ZpZXcoKTtcbiAgICB9KTtcbn0pO1xuXG4vKipcbiAqIFNob3dzIGEgZGlmZiBlZGl0IHByZXZpZXcgZm9yIHRoZSBnaXZlbiB3aWtpdGV4dCBvbiBhIGdpdmVuIHBhZ2UuXG4gKiBAcGFyYW0gdGl0bGUgVGhlIHRpdGxlIG9mIHRoZSBwYWdlIHRvIGVkaXQuXG4gKiBAcGFyYW0gdGV4dCBUaGUgcmVzdWx0aW5nIHdpa2l0ZXh0IG9mIHRoZSBwYWdlLlxuICogQHBhcmFtIHN1bW1hcnkgVGhlIGVkaXQgc3VtbWFyeS5cbiAqL1xuZnVuY3Rpb24gc2hvd0VkaXRQcmV2aWV3KHRpdGxlOiBzdHJpbmcsIHRleHQ6IHN0cmluZywgc3VtbWFyeTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgYmFzZVVybCA9IG13LmNvbmZpZy5nZXQoJ3dnU2VydmVyJykgKyBtdy5jb25maWcuZ2V0KCd3Z1NjcmlwdFBhdGgnKSArICcvJztcblxuICAgIGNvbnN0IGZvcm0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdmb3JtJyk7XG4gICAgZm9ybS5hY3Rpb24gPSBgJHtiYXNlVXJsfWluZGV4LnBocD90aXRsZT0ke2VuY29kZVVSSUNvbXBvbmVudCh0aXRsZSl9JmFjdGlvbj1zdWJtaXRgO1xuICAgIGZvcm0ubWV0aG9kID0gJ1BPU1QnO1xuXG4gICAgY29uc3QgdGV4dGJveElucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICB0ZXh0Ym94SW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuICAgIHRleHRib3hJbnB1dC5uYW1lID0gJ3dwVGV4dGJveDEnO1xuICAgIHRleHRib3hJbnB1dC52YWx1ZSA9IHRleHQ7XG4gICAgZm9ybS5hcHBlbmQodGV4dGJveElucHV0KTtcblxuICAgIGNvbnN0IHN1bW1hcnlJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgc3VtbWFyeUlucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICBzdW1tYXJ5SW5wdXQubmFtZSA9ICd3cFN1bW1hcnknO1xuICAgIHN1bW1hcnlJbnB1dC52YWx1ZSA9IHN1bW1hcnk7XG4gICAgZm9ybS5hcHBlbmQoc3VtbWFyeUlucHV0KTtcblxuICAgIGNvbnN0IHByZXZpZXdJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgcHJldmlld0lucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICBwcmV2aWV3SW5wdXQubmFtZSA9ICdtb2RlJztcbiAgICBwcmV2aWV3SW5wdXQudmFsdWUgPSAncHJldmlldyc7XG4gICAgZm9ybS5hcHBlbmQocHJldmlld0lucHV0KTtcblxuICAgIGNvbnN0IHNob3dDaGFuZ2VzSW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHNob3dDaGFuZ2VzSW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuICAgIHNob3dDaGFuZ2VzSW5wdXQubmFtZSA9ICd3cERpZmYnO1xuICAgIHNob3dDaGFuZ2VzSW5wdXQudmFsdWUgPSAnU2hvdyBjaGFuZ2VzJztcbiAgICBmb3JtLmFwcGVuZChzaG93Q2hhbmdlc0lucHV0KTtcblxuICAgIGNvbnN0IHVsdGltYXRlUGFyYW1ldGVySW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHVsdGltYXRlUGFyYW1ldGVySW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuICAgIHVsdGltYXRlUGFyYW1ldGVySW5wdXQubmFtZSA9ICd3cFVsdGltYXRlUGFyYW0nO1xuICAgIHVsdGltYXRlUGFyYW1ldGVySW5wdXQudmFsdWUgPSAnMSc7XG4gICAgZm9ybS5hcHBlbmQodWx0aW1hdGVQYXJhbWV0ZXJJbnB1dCk7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZChmb3JtKTtcbiAgICBmb3JtLnN1Ym1pdCgpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUlBLEdBQUcsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsTUFBTTtBQUN0QyxRQUFNLGtCQUFrQjtBQUV4QixNQUFJLEdBQUcsT0FBTyxJQUFJLFlBQVksT0FBTyxrQkFBa0IseUJBQXlCO0FBQWlEO0FBRWpJLG1CQUFpQixzQ0FBc0M7QUFFdkQsUUFBTSxhQUFhLEdBQUcsT0FBTyxJQUFJLGdCQUFnQjtBQUVqRCxNQUFJLFlBQVk7QUFFaEIsUUFBTSxPQUFPLEdBQUcsS0FBSyxlQUFlLEdBQUcsT0FBTyxJQUFJLE1BQU0sTUFBTSxZQUFZLFNBQVMsY0FBYyxLQUFLLHVCQUF1QixrQkFBa0IsV0FBVyxFQUFFLElBQUksc0JBQXNCO0FBRXRMLE9BQUssaUJBQWlCLFNBQVMsT0FBTyxVQUFVO0FBQzVDLFVBQU0sZUFBZTtBQUVyQixRQUFJO0FBQVcsYUFBTyxTQUFTLGNBQWMscUJBQXFCLEdBQUcsZUFBZTtBQUFBO0FBQy9FLGtCQUFZO0FBRWpCLFVBQU0sZUFBZ0IsTUFBTSxJQUFJLEdBQUcsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLFNBQVMsZUFBZSxHQUFHLE1BQU0sYUFBYSxRQUFRLFdBQVcsU0FBUyxLQUFLLFFBQVEsR0FBRyxPQUFPLElBQUksWUFBWSxFQUFFLENBQUMsR0FBMkIsTUFBTSxNQUFNLENBQUMsRUFBRSxVQUFVLENBQUMsRUFBRSxNQUFNLEtBQUs7QUFFN08sVUFBTSxXQUFXLENBQUMsc0NBQXNDLHdDQUF3QyxnQ0FBZ0Msc0JBQXNCO0FBdUJ0SixVQUFNLGNBQXlDLENBQUM7QUFFaEQsZUFBVyxXQUFXLFVBQVU7QUFDNUIsWUFBTSxpQkFBaUIsWUFDbEIsTUFBTSxJQUFJLE9BQU8sVUFBVSxPQUFPLFNBQVMsQ0FBQyxFQUFFLENBQUMsRUFDL0MsTUFBTSxRQUFRLEVBQUUsQ0FBQyxFQUNqQixLQUFLO0FBRVYsWUFBTSxrQkFBa0IsZUFBZSxNQUFNLCtEQUErRDtBQUU1RyxVQUFJO0FBQ0Esb0JBQVksT0FBTyxJQUFJLGdCQUFnQixJQUFJLENBQUMsWUFBWTtBQUNwRCxvQkFBVSxRQUFRLEtBQUs7QUFDdkIsZ0JBQU0sT0FBTztBQUNiLGdCQUFNLGFBQWEsUUFDZCxXQUFXLDZDQUE2QyxFQUFFLEVBQzFELE1BQU0sS0FBSyxFQUNYLElBQUksQ0FBQyxjQUFjLFVBQVUsS0FBSyxDQUFDO0FBRXhDLGdCQUFNLGtCQUFrQixPQUFPLFlBQVksV0FBVyxJQUFJLENBQUMsY0FBYyxVQUFVLE1BQU0sS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztBQUU3SCwwQkFBZ0IsT0FBTztBQUV2QiwwQkFBZ0IsV0FBVyxnQkFBZ0IsQ0FBQztBQUM1QywwQkFBZ0IsY0FBYyxnQkFBZ0IsQ0FBQztBQUUvQyxpQkFBTyxnQkFBZ0IsQ0FBQztBQUN4QixpQkFBTyxnQkFBZ0IsQ0FBQztBQUV4QixpQkFBTztBQUFBLFFBQ1gsQ0FBQztBQUFBLFdBQ0E7QUFDRCxvQkFBWSxPQUFPLElBQUksQ0FBQztBQUN4QjtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBRUEsVUFBTSxRQUFRO0FBQUEsTUFDVixPQUFPLFFBQVEsV0FBVyxFQUFFLElBQUksT0FBTyxDQUFDLEVBQUUsUUFBUSxNQUFNO0FBQ3BELGNBQU0sUUFBUTtBQUFBLFVBQ1YsU0FBUyxJQUFJLE9BQU8sWUFBWTtBQUM1QixrQkFBTSxhQUFhLEdBQUcsTUFBTSxZQUFZLFFBQVEsUUFBUTtBQUN4RCxrQkFBTSxhQUFhLEdBQUcsTUFBTSxZQUFZLFFBQVEsV0FBVztBQUUzRCxnQkFBSSxDQUFDO0FBQVkscUJBQU8sR0FBRyxPQUFPLGtCQUFrQixRQUFRLFFBQVEsTUFBTSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQzNGLGdCQUFJLENBQUM7QUFBWSxxQkFBTyxHQUFHLE9BQU8sa0JBQWtCLFFBQVEsV0FBVyxNQUFNLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFOUYsa0JBQU0sYUFBYSxDQUFDLGNBQWMsS0FBSyxRQUFRLFdBQVcsS0FBSztBQUUvRCxrQkFBTSxzQkFBc0IsU0FBUyxjQUFjLE1BQU07QUFDekQsZ0NBQW9CLFVBQVUsSUFBSSw2QkFBNkI7QUFDL0QsZ0NBQW9CLGNBQWMsa0JBQWtCLFFBQVEsV0FBVztBQUV2RSxrQkFBTSxpQkFBaUIsQ0FBQyxDQUFDLFdBQVcsTUFBTSxXQUFXLFFBQVEsRUFBRSxLQUFLLENBQUMsY0FBYyxXQUFXLGNBQWMsYUFBYSxXQUFXLGNBQWMsU0FBUztBQUUzSixrQkFBTSwwQkFBMEIsU0FBUyxjQUFjLE1BQU07QUFDN0Qsb0NBQXdCLFVBQVUsSUFBSSw2QkFBNkI7QUFDbkUsb0NBQXdCLGNBQWMsMERBQTBELFdBQVcsY0FBYyxXQUFXLE9BQU8sU0FBUyxVQUFVO0FBRTlKLGtCQUFNLGlCQUFpQixNQUFNLElBQUksR0FBRyxJQUFJLEVBQUUsTUFBTSxNQUFNLFFBQVEsUUFBUSxhQUFRLGFBQWEsTUFBTSxRQUFRLFdBQVcsT0FBTyxvQkFBb0IsU0FBUyxpQkFBaUIsR0FBRyxLQUFLLFlBQVksUUFBUSxTQUFTLElBQUksMkJBQTJCLFFBQVEsU0FBUyxJQUFJLFFBQVEsU0FBUyxPQUFPLFVBQVUsUUFBUSxTQUFTLElBQUksUUFBUSxTQUFTLElBQUksb0JBQW9CLFFBQVEsTUFBTSxHQUFHO0FBQ25YLGtCQUFNLGFBQWEsSUFBSSxVQUFVLEVBQUUsZ0JBQWdCLGdCQUFnQixXQUFXO0FBRTlFLGtCQUFNLGlCQUFpQixTQUFTLGNBQWMsSUFBSTtBQUNsRCwyQkFBZSxZQUFZLFdBQVcsY0FBYyxzQkFBc0IsRUFBRyxrQkFBbUI7QUFFaEcsZ0JBQUksQ0FBQztBQUFnQiw2QkFBZSxPQUFPLHVCQUF1QjtBQUVsRSxvQkFBUSxVQUFVO0FBQUEsVUFDdEIsQ0FBQztBQUFBLFFBQ0w7QUFBQSxNQUNKLENBQUM7QUFBQSxJQUNMO0FBRUEsVUFBTSxnQkFBZ0IsU0FBUyxjQUFjLEtBQUs7QUFDbEQsa0JBQWMsS0FBSztBQUVuQixVQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsV0FBTyxLQUFLO0FBQ1osV0FBTyxjQUFjO0FBRXJCLGtCQUFjLE9BQU8sTUFBTTtBQUUzQixlQUFXLENBQUMsY0FBYyxDQUFDLFNBQVMsUUFBUSxDQUFDLEtBQUssT0FBTyxRQUFRLFdBQVcsRUFBRSxRQUFRLEdBQUc7QUFDckYsWUFBTSxnQkFBZ0IsU0FBUyxjQUFjLEtBQUs7QUFDbEQsb0JBQWMsVUFBVSxJQUFJLG9CQUFvQjtBQUNoRCxvQkFBYyxjQUFjO0FBRTVCLG9CQUFjLE9BQU8sYUFBYTtBQUVsQyxZQUFNLGlCQUFpQixTQUFTLGNBQWMsS0FBSztBQUNuRCxxQkFBZSxVQUFVLElBQUksNkJBQTZCO0FBRTFELFVBQUksU0FBUyxXQUFXLEdBQUc7QUFDdkIsY0FBTSxhQUFhLFNBQVMsY0FBYyxLQUFLO0FBQy9DLG1CQUFXLGNBQWM7QUFFekIsdUJBQWUsT0FBTyxVQUFVO0FBQUEsTUFDcEMsT0FBTztBQUNILGNBQU0sZUFBZSxTQUFTLGNBQWMsSUFBSTtBQUVoRCxtQkFBVyxDQUFDLGNBQWMsT0FBTyxLQUFLLFNBQVMsUUFBUSxHQUFHO0FBQ3RELGdCQUFNLGlCQUFpQixRQUFRO0FBRS9CLGdCQUFNLHdCQUF3QixTQUFTLGNBQWMsT0FBTztBQUM1RCxnQ0FBc0IsT0FBTztBQUM3QixnQ0FBc0IsVUFBVSxJQUFJLDhCQUE4QjtBQUNsRSxnQ0FBc0IsS0FBSyw4QkFBOEIsWUFBWSxJQUFJLFlBQVk7QUFDckYsZ0NBQXNCLGlCQUFpQixVQUFVLE1BQU07QUFDbkQsZ0JBQUksc0JBQXNCLFNBQVM7QUFDL0IsMEJBQVksT0FBTyxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsUUFBUSxNQUFNLFFBQVEsc0JBQXNCLE1BQU07QUFDaEcsdUNBQXlCLE1BQU0sVUFBVTtBQUN6QyxvQ0FBc0IsV0FBVztBQUFBLFlBQ3JDLE9BQU87QUFDSCxxQkFBTyxZQUFZLE9BQU8sRUFBRSxZQUFZLEVBQUU7QUFDMUMsdUNBQXlCLE1BQU0sVUFBVTtBQUN6QyxvQ0FBc0IsV0FBVztBQUFBLFlBQ3JDO0FBQUEsVUFDSixDQUFDO0FBRUQsZ0JBQU0scUJBQXFCLFNBQVMsY0FBYyxPQUFPO0FBQ3pELDZCQUFtQixVQUFVLDhCQUE4QixZQUFZLElBQUksWUFBWTtBQUN2Riw2QkFBbUIsY0FBYztBQUVqQyx5QkFBZSxPQUFPLHFCQUFxQjtBQUMzQyx5QkFBZSxPQUFPLGtCQUFrQjtBQUV4QyxnQkFBTSwyQkFBMkIsU0FBUyxjQUFjLE1BQU07QUFDOUQsbUNBQXlCLE1BQU0sVUFBVTtBQUV6QyxtQ0FBeUIsT0FBTyxTQUFTLGVBQWUsTUFBTSxDQUFDO0FBRS9ELGdCQUFNLHdCQUF3QixTQUFTLGNBQWMsUUFBUTtBQUM3RCxjQUFJLFlBQVk7QUFBZ0Msa0NBQXNCLFFBQVE7QUFDOUUsZ0NBQXNCLGlCQUFpQixVQUFVLE1BQU07QUFDbkQsWUFBQyxZQUFZLE9BQU8sRUFBRSxZQUFZLEVBQUUsT0FBK0IsU0FBUyxzQkFBc0I7QUFBQSxVQUN0RyxDQUFDO0FBRUQsZ0JBQU0sK0JBQStCO0FBQUEsWUFDakM7QUFBQTtBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNKO0FBRUEscUJBQVcsVUFBVSw4QkFBOEI7QUFDL0Msa0JBQU0sZ0JBQWdCLFNBQVMsY0FBYyxRQUFRO0FBQ3JELDBCQUFjLFFBQVE7QUFDdEIsMEJBQWMsY0FBYztBQUU1QixrQ0FBc0IsT0FBTyxhQUFhO0FBQUEsVUFDOUM7QUFFQSxtQ0FBeUIsT0FBTyxxQkFBcUI7QUFFckQseUJBQWUsT0FBTyx3QkFBd0I7QUFFOUMsZ0JBQU0sd0JBQXdCLFNBQVMsY0FBYyxPQUFPO0FBQzVELGdDQUFzQixPQUFPO0FBQzdCLGdDQUFzQixVQUFVLElBQUksOEJBQThCO0FBQ2xFLGdDQUFzQixLQUFLLDRCQUE0QixZQUFZLElBQUksWUFBWTtBQUNuRixnQ0FBc0IsaUJBQWlCLFVBQVUsTUFBTTtBQUNuRCxnQkFBSSxzQkFBc0IsU0FBUztBQUMvQixjQUFDLFlBQVksT0FBTyxFQUFFLFlBQVksRUFBRSxTQUErQixFQUFFLE1BQU0sTUFBTSxTQUFTLHNCQUFzQixNQUFNO0FBQ3RILHVDQUF5QixNQUFNLFVBQVU7QUFDekMsb0NBQXNCLFdBQVc7QUFBQSxZQUNyQyxPQUFPO0FBQ0gscUJBQU8sWUFBWSxPQUFPLEVBQUUsWUFBWSxFQUFFO0FBQzFDLHVDQUF5QixNQUFNLFVBQVU7QUFDekMsb0NBQXNCLFdBQVc7QUFBQSxZQUNyQztBQUFBLFVBQ0osQ0FBQztBQUVELGdCQUFNLHFCQUFxQixTQUFTLGNBQWMsT0FBTztBQUN6RCw2QkFBbUIsVUFBVSw0QkFBNEIsWUFBWSxJQUFJLFlBQVk7QUFDckYsNkJBQW1CLGNBQWM7QUFFakMseUJBQWUsT0FBTyxxQkFBcUI7QUFDM0MseUJBQWUsT0FBTyxrQkFBa0I7QUFFeEMsZ0JBQU0sMkJBQTJCLFNBQVMsY0FBYyxNQUFNO0FBQzlELG1DQUF5QixNQUFNLFVBQVU7QUFFekMsbUNBQXlCLE9BQU8sU0FBUyxlQUFlLE1BQU0sQ0FBQztBQUUvRCxnQkFBTSx3QkFBd0IsU0FBUyxjQUFjLFFBQVE7QUFDN0QsZ0NBQXNCLGlCQUFpQixVQUFVLE1BQU07QUFDbkQsWUFBQyxZQUFZLE9BQU8sRUFBRSxZQUFZLEVBQUUsT0FBNkIsVUFBVSxzQkFBc0I7QUFBQSxVQUNyRyxDQUFDO0FBRUQscUJBQVcsVUFBVSxVQUFVO0FBQzNCLGdCQUFJLFdBQVc7QUFBUztBQUV4QixrQkFBTSxnQkFBZ0IsU0FBUyxjQUFjLFFBQVE7QUFDckQsMEJBQWMsUUFBUTtBQUN0QiwwQkFBYyxjQUFjO0FBRTVCLGtDQUFzQixPQUFPLGFBQWE7QUFBQSxVQUM5QztBQUVBLG1DQUF5QixPQUFPLHFCQUFxQjtBQUVyRCxtQ0FBeUIsT0FBTyxTQUFTLGVBQWUsa0JBQWtCLENBQUM7QUFFM0UsZ0JBQU0seUJBQXlCLFNBQVMsY0FBYyxPQUFPO0FBQzdELGlDQUF1QixPQUFPO0FBQzlCLGlDQUF1QixpQkFBaUIsU0FBUyxNQUFNO0FBQ25ELFlBQUMsWUFBWSxPQUFPLEVBQUUsWUFBWSxFQUFFLE9BQStCLFNBQVMsdUJBQXVCO0FBQUEsVUFDdkcsQ0FBQztBQUVELG1DQUF5QixPQUFPLHNCQUFzQjtBQUV0RCxtQ0FBeUIsT0FBTyxTQUFTLGVBQWUsbUNBQW1DLENBQUM7QUFFNUYseUJBQWUsT0FBTyx3QkFBd0I7QUFFOUMsdUJBQWEsT0FBTyxjQUFjO0FBQUEsUUFDdEM7QUFFQSx1QkFBZSxPQUFPLFlBQVk7QUFBQSxNQUN0QztBQUVBLG9CQUFjLE9BQU8sY0FBYztBQUFBLElBQ3ZDO0FBRUEsVUFBTSxlQUFlLFNBQVMsY0FBYyxRQUFRO0FBQ3BELGlCQUFhLEtBQUs7QUFDbEIsaUJBQWEsY0FBYztBQUMzQixpQkFBYSxpQkFBaUIsU0FBUyxZQUFZO0FBQy9DLG1CQUFhLFdBQVc7QUFDeEIscUJBQWUsTUFBTSxVQUFVO0FBRS9CLFVBQUksWUFBWTtBQVFoQixZQUFNLFVBQXNCLEVBQUUsUUFBUSxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsT0FBTyxFQUFFO0FBRTdELGlCQUFXLFdBQVcsT0FBTyxPQUFPLFdBQVc7QUFDM0MsbUJBQVcsV0FBVyxTQUFTO0FBQzNCLGNBQUksQ0FBQyxRQUFRO0FBQVE7QUFFckIsY0FBSSxZQUFZLFFBQVEsUUFBUTtBQUM1Qix3QkFBWSxVQUFVLFFBQVEsUUFBUSxPQUFPLE1BQU0sRUFBRSxFQUFFLFFBQVEsUUFBUSxNQUFNLEVBQUU7QUFDL0UsZ0JBQUksQ0FBQyxRQUFRLE9BQU8sUUFBUSxPQUFPLE1BQU07QUFBRyxzQkFBUSxPQUFPLFFBQVEsT0FBTyxNQUFNLElBQUksQ0FBQztBQUNyRixvQkFBUSxPQUFPLFFBQVEsT0FBTyxNQUFNLEVBQUUsS0FBSyxPQUFPO0FBQ2xELG9CQUFRO0FBQUEsVUFDWixXQUFXLFVBQVUsUUFBUSxRQUFRO0FBQ2pDLGtCQUFNLG9CQUFvQixTQUFTLFNBQVMsUUFBUSxRQUFRLE9BQU8sT0FBTyxJQUFJLENBQUM7QUFFL0Usd0JBQVksVUFBVSxRQUFRLFFBQVEsT0FBTyxNQUFNLEVBQUUsRUFBRSxRQUFRLFFBQVEsTUFBTSxFQUFFO0FBQy9FLHdCQUFZLFVBQVUsUUFBUSxJQUFJLE9BQU87QUFBQTtBQUFBLGFBQW9CLGlCQUFpQixhQUFhLEdBQUc7QUFBQSxFQUFLLFFBQVEsSUFBSSxHQUFHLFFBQVEsT0FBTyxTQUFTO0FBQUEsS0FBUSxRQUFRLE9BQU8sTUFBTSxVQUFVLEVBQUUsSUFBSTtBQUN2TCxnQkFBSSxDQUFDLFFBQVEsS0FBSyxRQUFRLE9BQU8sT0FBTztBQUFHLHNCQUFRLEtBQUssUUFBUSxPQUFPLE9BQU8sSUFBSSxDQUFDO0FBRW5GLG9CQUFRLEtBQUssUUFBUSxPQUFPLE9BQU8sRUFBRSxLQUFLLE9BQU87QUFDakQsb0JBQVE7QUFBQSxVQUNaO0FBQUEsUUFDSjtBQUVKLFVBQUksUUFBUSxVQUFVLEdBQUc7QUFDckIscUJBQWEsV0FBVztBQUN4Qix1QkFBZSxNQUFNLFVBQVU7QUFDL0IsZUFBTyxHQUFHLE9BQU8sdUJBQXVCLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFBQSxNQUM3RDtBQUVBLFlBQU0sY0FBYyxPQUFPLE9BQU8sV0FBVyxFQUFFLE1BQU0sQ0FBQyxZQUFZLFFBQVEsTUFBTSxDQUFDLFlBQVksRUFBRSxRQUFRLFVBQVUsWUFBWSxRQUFRLE9BQU8sQ0FBQztBQUU3SSxZQUFNLGNBQWMsV0FBVyxRQUFRLEtBQUssV0FBVyxRQUFRLFFBQVEsSUFBSSxNQUFNLEVBQUUsS0FDL0UsT0FBTyxRQUFRLFFBQVEsTUFBTSxFQUFFLFNBQVMsSUFDbEMsV0FBVyxPQUFPLFFBQVEsUUFBUSxNQUFNLEVBQ25DLElBQUksQ0FBQyxDQUFDLFFBQVEsS0FBSyxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxLQUFLLEtBQUssUUFBUSxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUMsT0FBTyxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQy9HLEtBQUssSUFBSSxDQUFDLEtBQ2YsRUFDVixHQUNJLE9BQU8sUUFBUSxRQUFRLElBQUksRUFBRSxTQUFTLElBQ2hDLEdBQUcsT0FBTyxRQUFRLFFBQVEsTUFBTSxFQUFFLFNBQVMsSUFBSSxPQUFPLEVBQUUsU0FBUyxPQUFPLFFBQVEsUUFBUSxJQUFJLEVBQ3ZGLElBQUksQ0FBQyxDQUFDLGFBQWEsS0FBSyxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxLQUFLLEtBQUssUUFBUSxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUMsUUFBUSxXQUFXLEdBQUcsRUFDN0csS0FBSyxJQUFJLENBQUMsS0FDZixFQUNWLElBQUksY0FBYyx5QkFBeUIsRUFBRTtBQUU3QyxVQUFJO0FBQWlCLHdCQUFnQixHQUFHLE9BQU8sSUFBSSxZQUFZLEdBQUcsV0FBVyxXQUFXO0FBQUEsV0FDbkY7QUFDRCxjQUFNLElBQUksR0FBRyxJQUFJLEVBQUUsS0FBSyxHQUFHLE9BQU8sSUFBSSxZQUFZLEdBQUcsT0FBTyxFQUFFLE1BQU0sV0FBVyxTQUFTLFlBQVksRUFBRTtBQUV0RyxXQUFHLE9BQU8sd0JBQXdCLFFBQVEsS0FBSywyQkFBMkIsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUU3RixlQUFPLFNBQVMsT0FBTztBQUFBLE1BQzNCO0FBQUEsSUFDSixDQUFDO0FBRUQsVUFBTSxpQkFBaUIsU0FBUyxjQUFjLE1BQU07QUFDcEQsbUJBQWUsS0FBSztBQUNwQixtQkFBZSxNQUFNLFVBQVU7QUFFL0IsaUJBQWEsT0FBTyxjQUFjO0FBRWxDLGtCQUFjLE9BQU8sWUFBWTtBQUVqQyxPQUFHLEtBQUssU0FBUyxDQUFDLEVBQUUsUUFBUSxhQUFhO0FBRXpDLGtCQUFjLGVBQWU7QUFBQSxFQUNqQyxDQUFDO0FBQ0wsQ0FBQztBQVFELFNBQVMsZ0JBQWdCLE9BQWUsTUFBYyxTQUF1QjtBQUN6RSxRQUFNLFVBQVUsR0FBRyxPQUFPLElBQUksVUFBVSxJQUFJLEdBQUcsT0FBTyxJQUFJLGNBQWMsSUFBSTtBQUU1RSxRQUFNLE9BQU8sU0FBUyxjQUFjLE1BQU07QUFDMUMsT0FBSyxTQUFTLEdBQUcsT0FBTyxtQkFBbUIsbUJBQW1CLEtBQUssQ0FBQztBQUNwRSxPQUFLLFNBQVM7QUFFZCxRQUFNLGVBQWUsU0FBUyxjQUFjLE9BQU87QUFDbkQsZUFBYSxPQUFPO0FBQ3BCLGVBQWEsT0FBTztBQUNwQixlQUFhLFFBQVE7QUFDckIsT0FBSyxPQUFPLFlBQVk7QUFFeEIsUUFBTSxlQUFlLFNBQVMsY0FBYyxPQUFPO0FBQ25ELGVBQWEsT0FBTztBQUNwQixlQUFhLE9BQU87QUFDcEIsZUFBYSxRQUFRO0FBQ3JCLE9BQUssT0FBTyxZQUFZO0FBRXhCLFFBQU0sZUFBZSxTQUFTLGNBQWMsT0FBTztBQUNuRCxlQUFhLE9BQU87QUFDcEIsZUFBYSxPQUFPO0FBQ3BCLGVBQWEsUUFBUTtBQUNyQixPQUFLLE9BQU8sWUFBWTtBQUV4QixRQUFNLG1CQUFtQixTQUFTLGNBQWMsT0FBTztBQUN2RCxtQkFBaUIsT0FBTztBQUN4QixtQkFBaUIsT0FBTztBQUN4QixtQkFBaUIsUUFBUTtBQUN6QixPQUFLLE9BQU8sZ0JBQWdCO0FBRTVCLFFBQU0seUJBQXlCLFNBQVMsY0FBYyxPQUFPO0FBQzdELHlCQUF1QixPQUFPO0FBQzlCLHlCQUF1QixPQUFPO0FBQzlCLHlCQUF1QixRQUFRO0FBQy9CLE9BQUssT0FBTyxzQkFBc0I7QUFFbEMsV0FBUyxLQUFLLE9BQU8sSUFBSTtBQUN6QixPQUFLLE9BQU87QUFDaEI7IiwKICAibmFtZXMiOiBbXQp9Cg==
