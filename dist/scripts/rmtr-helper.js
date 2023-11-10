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
            const parsedWikitext = await new mw.Api().parse(
              `[[:${request.original}]] \u2192 ${validTitle ? `[[:${request.destination}]]` : invalidTitleWarning.outerHTML} requested by ${mw.util.isIPAddress(request.requester) ? `[[Special:Contributions/${request.requester}|${request.requester}]]` : `[[User:${request.requester}|${request.requester}]]`} with reasoning "${request.reason}"`
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
            "Withdrawn"
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9ybXRyLWhlbHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGFnZVJldmlzaW9uc1Jlc3VsdCB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gaW1wb3J0U3R5bGVzaGVldChwYWdlOiBzdHJpbmcpOiB2b2lkO1xuXG5tdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgY29uc3QgZGV2ZWxvcG1lbnRNb2RlID0gZmFsc2U7XG5cbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpICE9PSAoZGV2ZWxvcG1lbnRNb2RlID8gJ1VzZXI6RWVqaXQ0My9zYW5kYm94JyA6ICdXaWtpcGVkaWE6UmVxdWVzdGVkX21vdmVzL1RlY2huaWNhbF9yZXF1ZXN0cycpKSByZXR1cm47XG5cbiAgICBpbXBvcnRTdHlsZXNoZWV0KCdVc2VyOkVlaml0NDMvc2NyaXB0cy9ybXRyLWhlbHBlci5jc3MnKTtcblxuICAgIGNvbnN0IG5hbWVzcGFjZXMgPSBtdy5jb25maWcuZ2V0KCd3Z05hbWVzcGFjZUlkcycpO1xuXG4gICAgbGV0IGRpc3BsYXllZCA9IGZhbHNlO1xuXG4gICAgY29uc3QgbGluayA9IG13LnV0aWwuYWRkUG9ydGxldExpbmsobXcuY29uZmlnLmdldCgnc2tpbicpID09PSAnbWluZXJ2YScgPyAncC10YicgOiAncC1jYWN0aW9ucycsICcjJywgYFJldmlldyBtb3ZlIHJlcXVlc3RzJHtkZXZlbG9wbWVudE1vZGUgPyAnIChERVYpJyA6ICcnfWAsICdyZXZpZXctcm10ci1yZXF1ZXN0cycpO1xuXG4gICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGlmIChkaXNwbGF5ZWQpIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcm10ci1yZXZpZXctcmVzdWx0Jyk/LnNjcm9sbEludG9WaWV3KCk7XG4gICAgICAgIGVsc2UgZGlzcGxheWVkID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBwYWdlQ29udGVudCA9IChcbiAgICAgICAgICAgIChhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHsgYWN0aW9uOiAncXVlcnknLCBmb3JtYXR2ZXJzaW9uOiAyLCBwcm9wOiAncmV2aXNpb25zJywgcnZwcm9wOiAnY29udGVudCcsIHJ2c2xvdHM6ICcqJywgdGl0bGVzOiBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJykgfSkpIGFzIFBhZ2VSZXZpc2lvbnNSZXN1bHRcbiAgICAgICAgKS5xdWVyeS5wYWdlc1swXS5yZXZpc2lvbnNbMF0uc2xvdHMubWFpbi5jb250ZW50O1xuXG4gICAgICAgIGNvbnN0IHNlY3Rpb25zID0gWydVbmNvbnRyb3ZlcnNpYWwgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ1JlcXVlc3RzIHRvIHJldmVydCB1bmRpc2N1c3NlZCBtb3ZlcycsICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ0FkbWluaXN0cmF0b3IgbmVlZGVkJ107XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3Qge1xuICAgICAgICAgICAgcmVxdWVzdGVyOiBzdHJpbmc7XG4gICAgICAgICAgICByZWFzb246IHN0cmluZztcbiAgICAgICAgICAgIGZ1bGw6IHN0cmluZztcbiAgICAgICAgICAgIG9yaWdpbmFsOiBzdHJpbmc7XG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgZWxlbWVudDogSFRNTExJRWxlbWVudDtcbiAgICAgICAgICAgIHJlc3VsdD86IFJlcXVlc3RSZXN1bHRNb3ZlIHwgUmVxdWVzdFJlc3VsdFJlbW92ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGludGVyZmFjZSBSZXF1ZXN0UmVzdWx0TW92ZSB7XG4gICAgICAgICAgICBtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgc2VjdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgcmVhc29uPzogc3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3RSZXN1bHRSZW1vdmUge1xuICAgICAgICAgICAgcmVtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgcmVhc29uOiBzdHJpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhbGxSZXF1ZXN0czogUmVjb3JkPHN0cmluZywgUmVxdWVzdFtdPiA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBwYWdlQ29udGVudFxuICAgICAgICAgICAgICAgIC5zcGxpdChuZXcgUmVnRXhwKGA9ezMsfSA/JHtzZWN0aW9ufSA/PXszLH1gKSlbMV1cbiAgICAgICAgICAgICAgICAuc3BsaXQoLz17Myx9L20pWzBdXG4gICAgICAgICAgICAgICAgLnRyaW0oKTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZFJlcXVlc3RzID0gc2VjdGlvbkNvbnRlbnQubWF0Y2goLyg/OlxcKiA/XFxuKT9cXCoge3tybWFzc2lzdFxcL2NvcmUuKz8oPz1cXCoge3tybWFzc2lzdFxcL2NvcmV8JCkvZ2lzKTtcblxuICAgICAgICAgICAgaWYgKG1hdGNoZWRSZXF1ZXN0cylcbiAgICAgICAgICAgICAgICBhbGxSZXF1ZXN0c1tzZWN0aW9uXSA9IG1hdGNoZWRSZXF1ZXN0cy5tYXAoKHJlcXVlc3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCA9IHJlcXVlc3QudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdWxsID0gcmVxdWVzdDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHJlcXVlc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKC8oPzpcXCogP1xcbik/XFwqIHt7cm1hc3Npc3RcXC9jb3JlIFxcfHx9fS4qL2dpcywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJyB8ICcpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChwYXJhbWV0ZXIpID0+IHBhcmFtZXRlci50cmltKCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbmFsUGFyYW1ldGVycyA9IE9iamVjdC5mcm9tRW50cmllcyhwYXJhbWV0ZXJzLm1hcCgocGFyYW1ldGVyKSA9PiBwYXJhbWV0ZXIuc3BsaXQoJyA9ICcpLm1hcCgodmFsdWUpID0+IHZhbHVlLnRyaW0oKSkpKSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5mdWxsID0gZnVsbDtcblxuICAgICAgICAgICAgICAgICAgICBmaW5hbFBhcmFtZXRlcnMub3JpZ2luYWwgPSBmaW5hbFBhcmFtZXRlcnNbMV07XG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5kZXN0aW5hdGlvbiA9IGZpbmFsUGFyYW1ldGVyc1syXTtcblxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzFdO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzJdO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaW5hbFBhcmFtZXRlcnMgYXMgdW5rbm93biBhcyBSZXF1ZXN0O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl0gPSBbXTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLm1hcChhc3luYyAoWywgcmVxdWVzdHNdKSA9PiB7XG4gICAgICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RzLm1hcChhc3luYyAocmVxdWVzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdPbGRUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3Qub3JpZ2luYWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdOZXdUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3QuZGVzdGluYXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW13T2xkVGl0bGUpIHJldHVybiBtdy5ub3RpZnkoYEludmFsaWQgdGl0bGUgXCIke3JlcXVlc3Qub3JpZ2luYWx9XCIhYCwgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtd05ld1RpdGxlKSByZXR1cm4gbXcubm90aWZ5KGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWAsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsaWRUaXRsZSA9ICEvWyM8PltcXF17fH1dLy50ZXN0KHJlcXVlc3QuZGVzdGluYXRpb24pICYmIG13TmV3VGl0bGU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGludmFsaWRUaXRsZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkVGl0bGVXYXJuaW5nLmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LWludmFsaWQtd2FybmluZycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZFRpdGxlV2FybmluZy50ZXh0Q29udGVudCA9IGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkTmFtZXNwYWNlID0gIVtuYW1lc3BhY2VzLmZpbGUsIG5hbWVzcGFjZXMuY2F0ZWdvcnldLnNvbWUoKG5hbWVzcGFjZSkgPT4gbXdPbGRUaXRsZS5uYW1lc3BhY2UgPT09IG5hbWVzcGFjZSB8fCBtd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52YWxpZE5hbWVzcGFjZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkTmFtZXNwYWNlV2FybmluZy5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1pbnZhbGlkLXdhcm5pbmcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWROYW1lc3BhY2VXYXJuaW5nLnRleHRDb250ZW50ID0gYFdhcm5pbmc6IG9yaWdpbmFsIG9yIGRlc3RpbmF0aW9uIHBhZ2UgaXMgaW4gbmFtZXNwYWNlIFwiJHttd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlcy5maWxlID8gJ2ZpbGUnIDogJ2NhdGVnb3J5J31cIiFgO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRXaWtpdGV4dCA9IGF3YWl0IG5ldyBtdy5BcGkoKS5wYXJzZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgW1s6JHtyZXF1ZXN0Lm9yaWdpbmFsfV1dIFx1MjE5MiAke3ZhbGlkVGl0bGUgPyBgW1s6JHtyZXF1ZXN0LmRlc3RpbmF0aW9ufV1dYCA6IGludmFsaWRUaXRsZVdhcm5pbmcub3V0ZXJIVE1MfSByZXF1ZXN0ZWQgYnkgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbXcudXRpbC5pc0lQQWRkcmVzcyhyZXF1ZXN0LnJlcXVlc3RlcikgPyBgW1tTcGVjaWFsOkNvbnRyaWJ1dGlvbnMvJHtyZXF1ZXN0LnJlcXVlc3Rlcn18JHtyZXF1ZXN0LnJlcXVlc3Rlcn1dXWAgOiBgW1tVc2VyOiR7cmVxdWVzdC5yZXF1ZXN0ZXJ9fCR7cmVxdWVzdC5yZXF1ZXN0ZXJ9XV1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSB3aXRoIHJlYXNvbmluZyBcIiR7cmVxdWVzdC5yZWFzb259XCJgLFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZEh0bWwgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHBhcnNlZFdpa2l0ZXh0LCAndGV4dC9odG1sJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmlubmVySFRNTCA9IHBhcnNlZEh0bWwucXVlcnlTZWxlY3RvcignZGl2Lm13LXBhcnNlci1vdXRwdXQnKSEuZmlyc3RFbGVtZW50Q2hpbGQhLmlubmVySFRNTCE7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdmFsaWROYW1lc3BhY2UpIHJlcXVlc3RFbGVtZW50LmFwcGVuZChpbnZhbGlkTmFtZXNwYWNlV2FybmluZyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuZWxlbWVudCA9IHJlcXVlc3RFbGVtZW50O1xuICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3Qgb3V0cHV0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBvdXRwdXRFbGVtZW50LmlkID0gJ3JtdHItcmV2aWV3LXJlc3VsdCc7XG5cbiAgICAgICAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGhlYWRlci5pZCA9ICdybXRyLXJldmlldy1oZWFkZXInO1xuICAgICAgICBoZWFkZXIudGV4dENvbnRlbnQgPSAnVGVjaG5pY2FsIG1vdmUgcmVxdWVzdHMgcmV2aWV3JztcblxuICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChoZWFkZXIpO1xuXG4gICAgICAgIGZvciAoY29uc3QgW3NlY3Rpb25JbmRleCwgW3NlY3Rpb24sIHJlcXVlc3RzXV0gb2YgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgc2VjdGlvbkhlYWRlci5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1oZWFkZXInKTtcbiAgICAgICAgICAgIHNlY3Rpb25IZWFkZXIudGV4dENvbnRlbnQgPSBzZWN0aW9uO1xuXG4gICAgICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChzZWN0aW9uSGVhZGVyKTtcblxuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHNlY3Rpb25Db250ZW50LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXNlY3Rpb24tY29udGVudCcpO1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9SZXF1ZXN0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgIG5vUmVxdWVzdHMudGV4dENvbnRlbnQgPSAnTm8gcmVxdWVzdHMgaW4gdGhpcyBzZWN0aW9uJztcblxuICAgICAgICAgICAgICAgIHNlY3Rpb25Db250ZW50LmFwcGVuZChub1JlcXVlc3RzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdHNMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW3JlcXVlc3RJbmRleCwgcmVxdWVzdF0gb2YgcmVxdWVzdHMuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RFbGVtZW50ID0gcmVxdWVzdC5lbGVtZW50O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3RDaGVja2JveCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RDaGVja2JveC50eXBlID0gJ2NoZWNrYm94JztcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXJlcXVlc3QtY2hlY2tib3gnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmlkID0gYHJtdHItcmV2aWV3LXJlbW92ZS1yZXF1ZXN0LSR7c2VjdGlvbkluZGV4fS0ke3JlcXVlc3RJbmRleH1gO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZVJlcXVlc3RDaGVja2JveC5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgPSB7IHJlbW92ZTogdHJ1ZSwgcmVhc29uOiByZW1vdmVSZXF1ZXN0RHJvcGRvd24udmFsdWUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25DaGVja2JveC5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZlUmVxdWVzdExhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdExhYmVsLmh0bWxGb3IgPSBgcm10ci1yZXZpZXctcmVtb3ZlLXJlcXVlc3QtJHtzZWN0aW9uSW5kZXh9LSR7cmVxdWVzdEluZGV4fWA7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RMYWJlbC50ZXh0Q29udGVudCA9ICdSZW1vdmUgcmVxdWVzdCc7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RDaGVja2JveCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmFwcGVuZChyZW1vdmVSZXF1ZXN0TGFiZWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLmFwcGVuZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnIGFzICcpKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0RHJvcGRvd24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlY3Rpb24gPT09ICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJykgcmVtb3ZlUmVxdWVzdERyb3Bkb3duLnZhbHVlID0gJ0NvbnRlc3RlZCc7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3REcm9wZG93bi5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgYXMgUmVxdWVzdFJlc3VsdFJlbW92ZSkucmVhc29uID0gcmVtb3ZlUmVxdWVzdERyb3Bkb3duLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0RHJvcGRvd25PcHRpb25zID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ0NvbXBsZXRlZCcsIC8vXG4gICAgICAgICAgICAgICAgICAgICAgICAnQ29udGVzdGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBbHJlYWR5IGRvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0ludmFsaWQgcGFnZSBuYW1lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdJbmNvcnJlY3QgdmVudWUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ1dpdGhkcmF3bicsXG4gICAgICAgICAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBvcHRpb24gb2YgcmVtb3ZlUmVxdWVzdERyb3Bkb3duT3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uRWxlbWVudC52YWx1ZSA9IG9wdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudGV4dENvbnRlbnQgPSBvcHRpb247XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3REcm9wZG93bi5hcHBlbmQob3B0aW9uRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuYXBwZW5kKHJlbW92ZVJlcXVlc3REcm9wZG93bik7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvbkNoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkNoZWNrYm94LnR5cGUgPSAnY2hlY2tib3gnO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guY2xhc3NMaXN0LmFkZCgncm10ci1yZXZpZXctcmVxdWVzdC1jaGVja2JveCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guaWQgPSBgcm10ci1yZXZpZXctbW92ZS1yZXF1ZXN0LSR7c2VjdGlvbkluZGV4fS0ke3JlcXVlc3RJbmRleH1gO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN3aXRjaFNlY3Rpb25DaGVja2JveC5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0IGFzIFJlcXVlc3RSZXN1bHRNb3ZlKSA9IHsgbW92ZTogdHJ1ZSwgc2VjdGlvbjogc3dpdGNoU2VjdGlvbkRyb3Bkb3duLnZhbHVlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25MYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25MYWJlbC5odG1sRm9yID0gYHJtdHItcmV2aWV3LW1vdmUtcmVxdWVzdC0ke3NlY3Rpb25JbmRleH0tJHtyZXF1ZXN0SW5kZXh9YDtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkxhYmVsLnRleHRDb250ZW50ID0gJ1N3aXRjaCBzZWN0aW9uJztcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQoc3dpdGNoU2VjdGlvbkNoZWNrYm94KTtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHN3aXRjaFNlY3Rpb25MYWJlbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgdG8gJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25Ecm9wZG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRHJvcGRvd24uYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgKGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0IGFzIFJlcXVlc3RSZXN1bHRNb3ZlKS5zZWN0aW9uID0gc3dpdGNoU2VjdGlvbkRyb3Bkb3duLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG9wdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbiA9PT0gc2VjdGlvbikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudmFsdWUgPSBvcHRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25FbGVtZW50LnRleHRDb250ZW50ID0gb3B0aW9uO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRHJvcGRvd24uYXBwZW5kKG9wdGlvbkVsZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLmFwcGVuZChzd2l0Y2hTZWN0aW9uRHJvcGRvd24pO1xuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyB3aXRoIHJlYXNvbmluZyAnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvblJlYXNvbmluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25SZWFzb25pbmcudHlwZSA9ICd0ZXh0JztcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvblJlYXNvbmluZy5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdCBhcyBSZXF1ZXN0UmVzdWx0UmVtb3ZlKS5yZWFzb24gPSBzd2l0Y2hTZWN0aW9uUmVhc29uaW5nLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKHN3aXRjaFNlY3Rpb25SZWFzb25pbmcpO1xuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyAob3B0aW9uYWwsIGF1dG9tYXRpY2FsbHkgc2lnbmVkKScpKTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQoc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzKTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0c0xpc3QuYXBwZW5kKHJlcXVlc3RFbGVtZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWN0aW9uQ29udGVudC5hcHBlbmQocmVxdWVzdHNMaXN0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3V0cHV0RWxlbWVudC5hcHBlbmQoc2VjdGlvbkNvbnRlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3VibWl0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIHN1Ym1pdEJ1dHRvbi5pZCA9ICdybXRyLXJldmlldy1zdWJtaXQnO1xuICAgICAgICBzdWJtaXRCdXR0b24udGV4dENvbnRlbnQgPSAnU3VibWl0JztcbiAgICAgICAgc3VibWl0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgc3VibWl0QnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGxvYWRpbmdTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcblxuICAgICAgICAgICAgbGV0IGVuZFJlc3VsdCA9IHBhZ2VDb250ZW50O1xuXG4gICAgICAgICAgICBpbnRlcmZhY2UgQWxsQ2hhbmdlcyB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlOiBSZWNvcmQ8c3RyaW5nLCBSZXF1ZXN0W10+O1xuICAgICAgICAgICAgICAgIG1vdmU6IFJlY29yZDxzdHJpbmcsIFJlcXVlc3RbXT47XG4gICAgICAgICAgICAgICAgdG90YWw6IG51bWJlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2hhbmdlczogQWxsQ2hhbmdlcyA9IHsgcmVtb3ZlOiB7fSwgbW92ZToge30sIHRvdGFsOiAwIH07XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBPYmplY3QudmFsdWVzKGFsbFJlcXVlc3RzKSlcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJlcXVlc3Qgb2Ygc2VjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlcXVlc3QucmVzdWx0KSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoJ3JlbW92ZScgaW4gcmVxdWVzdC5yZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKHJlcXVlc3QuZnVsbCArICdcXG4nLCAnJykucmVwbGFjZShyZXF1ZXN0LmZ1bGwsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXSkgY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXS5wdXNoKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy50b3RhbCsrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCdtb3ZlJyBpbiByZXF1ZXN0LnJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VjdGlvblRpdGxlQWZ0ZXIgPSBzZWN0aW9uc1tzZWN0aW9ucy5pbmRleE9mKHJlcXVlc3QucmVzdWx0LnNlY3Rpb24pICsgMV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKHJlcXVlc3QuZnVsbCArICdcXG4nLCAnJykucmVwbGFjZShyZXF1ZXN0LmZ1bGwsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBSZWdFeHAoYChcXG4/XFxuPyg/Oj17Myx9ID8ke3NlY3Rpb25UaXRsZUFmdGVyfSA/PXszLH18JCkpYCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYFxcbiR7cmVxdWVzdC5mdWxsfSR7cmVxdWVzdC5yZXN1bHQucmVhc29uID8gYFxcbjo6ICR7cmVxdWVzdC5yZXN1bHQucmVhc29ufSB+fn5+YCA6ICcnfSQxYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNoYW5nZXMubW92ZVtyZXF1ZXN0LnJlc3VsdC5zZWN0aW9uXSkgY2hhbmdlcy5tb3ZlW3JlcXVlc3QucmVzdWx0LnNlY3Rpb25dID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZXMubW92ZVtyZXF1ZXN0LnJlc3VsdC5zZWN0aW9uXS5wdXNoKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy50b3RhbCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY2hhbmdlcy50b3RhbCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHN1Ym1pdEJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGxvYWRpbmdTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG13Lm5vdGlmeSgnTm8gY2hhbmdlcyB0byBtYWtlIScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9SZW1haW5pbmcgPSBPYmplY3QudmFsdWVzKGFsbFJlcXVlc3RzKS5ldmVyeSgoc2VjdGlvbikgPT4gc2VjdGlvbi5ldmVyeSgocmVxdWVzdCkgPT4gcmVxdWVzdC5yZXN1bHQgJiYgJ3JlbW92ZScgaW4gcmVxdWVzdC5yZXN1bHQpKTtcblxuICAgICAgICAgICAgY29uc3QgZWRpdFN1bW1hcnkgPSBgSGFuZGxlZCAke2NoYW5nZXMudG90YWx9IHJlcXVlc3Qke2NoYW5nZXMudG90YWwgPiAxID8gJ3MnIDogJyd9OiAke1xuICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKGNoYW5nZXMucmVtb3ZlKS5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgID8gYFJlbW92ZWQgJHtPYmplY3QuZW50cmllcyhjaGFuZ2VzLnJlbW92ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoW3JlYXNvbiwgcGFnZXNdKSA9PiBgJHtwYWdlcy5tYXAoKHBhZ2UpID0+IGBbWyR7cGFnZS5vcmlnaW5hbH1dXWApLmpvaW4oJywgJyl9IGFzICR7cmVhc29uLnRvTG93ZXJDYXNlKCl9YClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyl9YFxuICAgICAgICAgICAgICAgICAgICA6ICcnXG4gICAgICAgICAgICB9JHtcbiAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhjaGFuZ2VzLm1vdmUpLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgPyBgJHtPYmplY3QuZW50cmllcyhjaGFuZ2VzLnJlbW92ZSkubGVuZ3RoID4gMCA/ICcsICcgOiAnJ31Nb3ZlZCAke09iamVjdC5lbnRyaWVzKGNoYW5nZXMubW92ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoW2Rlc3RpbmF0aW9uLCBwYWdlc10pID0+IGAke3BhZ2VzLm1hcCgocGFnZSkgPT4gYFtbJHtwYWdlLm9yaWdpbmFsfV1dYCkuam9pbignLCAnKX0gdG8gXCIke2Rlc3RpbmF0aW9ufVwiYClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyl9YFxuICAgICAgICAgICAgICAgICAgICA6ICcnXG4gICAgICAgICAgICB9JHtub1JlbWFpbmluZyA/ICcgKG5vIHJlcXVlc3RzIHJlbWFpbiknIDogJyd9ICh2aWEgW1tVc2VyOkVlaml0NDMvc2NyaXB0cy9ybXRyLWhlbHBlcnxzY3JpcHRdXSlgO1xuXG4gICAgICAgICAgICBpZiAoZGV2ZWxvcG1lbnRNb2RlKSBzaG93RWRpdFByZXZpZXcobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpLCBlbmRSZXN1bHQsIGVkaXRTdW1tYXJ5KTtcbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKS5lZGl0KG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSwgKCkgPT4gKHsgdGV4dDogZW5kUmVzdWx0LCBzdW1tYXJ5OiBlZGl0U3VtbWFyeSB9KSk7XG5cbiAgICAgICAgICAgICAgICBtdy5ub3RpZnkoYFN1Y2Nlc3NmdWxseSBoYW5kbGVkICR7Y2hhbmdlcy50b3RhbH0gcmVxdWVzdHMsIHJlbG9hZGluZy4uLmAsIHsgdHlwZTogJ3N1Y2Nlc3MnIH0pO1xuXG4gICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBsb2FkaW5nU3Bpbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgbG9hZGluZ1NwaW5uZXIuaWQgPSAncm10ci1yZXZpZXctbG9hZGluZyc7XG4gICAgICAgIGxvYWRpbmdTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICAgICAgc3VibWl0QnV0dG9uLmFwcGVuZChsb2FkaW5nU3Bpbm5lcik7XG5cbiAgICAgICAgb3V0cHV0RWxlbWVudC5hcHBlbmQoc3VibWl0QnV0dG9uKTtcblxuICAgICAgICBtdy51dGlsLiRjb250ZW50WzBdLnByZXBlbmQob3V0cHV0RWxlbWVudCk7XG5cbiAgICAgICAgb3V0cHV0RWxlbWVudC5zY3JvbGxJbnRvVmlldygpO1xuICAgIH0pO1xufSk7XG5cbi8qKlxuICogU2hvd3MgYSBkaWZmIGVkaXQgcHJldmlldyBmb3IgdGhlIGdpdmVuIHdpa2l0ZXh0IG9uIGEgZ2l2ZW4gcGFnZS5cbiAqIEBwYXJhbSB0aXRsZSBUaGUgdGl0bGUgb2YgdGhlIHBhZ2UgdG8gZWRpdC5cbiAqIEBwYXJhbSB0ZXh0IFRoZSByZXN1bHRpbmcgd2lraXRleHQgb2YgdGhlIHBhZ2UuXG4gKiBAcGFyYW0gc3VtbWFyeSBUaGUgZWRpdCBzdW1tYXJ5LlxuICovXG5mdW5jdGlvbiBzaG93RWRpdFByZXZpZXcodGl0bGU6IHN0cmluZywgdGV4dDogc3RyaW5nLCBzdW1tYXJ5OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBiYXNlVXJsID0gbXcuY29uZmlnLmdldCgnd2dTZXJ2ZXInKSArIG13LmNvbmZpZy5nZXQoJ3dnU2NyaXB0UGF0aCcpICsgJy8nO1xuXG4gICAgY29uc3QgZm9ybSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2Zvcm0nKTtcbiAgICBmb3JtLmFjdGlvbiA9IGAke2Jhc2VVcmx9aW5kZXgucGhwP3RpdGxlPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHRpdGxlKX0mYWN0aW9uPXN1Ym1pdGA7XG4gICAgZm9ybS5tZXRob2QgPSAnUE9TVCc7XG5cbiAgICBjb25zdCB0ZXh0Ym94SW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHRleHRib3hJbnB1dC50eXBlID0gJ2hpZGRlbic7XG4gICAgdGV4dGJveElucHV0Lm5hbWUgPSAnd3BUZXh0Ym94MSc7XG4gICAgdGV4dGJveElucHV0LnZhbHVlID0gdGV4dDtcbiAgICBmb3JtLmFwcGVuZCh0ZXh0Ym94SW5wdXQpO1xuXG4gICAgY29uc3Qgc3VtbWFyeUlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICBzdW1tYXJ5SW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuICAgIHN1bW1hcnlJbnB1dC5uYW1lID0gJ3dwU3VtbWFyeSc7XG4gICAgc3VtbWFyeUlucHV0LnZhbHVlID0gc3VtbWFyeTtcbiAgICBmb3JtLmFwcGVuZChzdW1tYXJ5SW5wdXQpO1xuXG4gICAgY29uc3QgcHJldmlld0lucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICBwcmV2aWV3SW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuICAgIHByZXZpZXdJbnB1dC5uYW1lID0gJ21vZGUnO1xuICAgIHByZXZpZXdJbnB1dC52YWx1ZSA9ICdwcmV2aWV3JztcbiAgICBmb3JtLmFwcGVuZChwcmV2aWV3SW5wdXQpO1xuXG4gICAgY29uc3Qgc2hvd0NoYW5nZXNJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgc2hvd0NoYW5nZXNJbnB1dC50eXBlID0gJ2hpZGRlbic7XG4gICAgc2hvd0NoYW5nZXNJbnB1dC5uYW1lID0gJ3dwRGlmZic7XG4gICAgc2hvd0NoYW5nZXNJbnB1dC52YWx1ZSA9ICdTaG93IGNoYW5nZXMnO1xuICAgIGZvcm0uYXBwZW5kKHNob3dDaGFuZ2VzSW5wdXQpO1xuXG4gICAgY29uc3QgdWx0aW1hdGVQYXJhbWV0ZXJJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgdWx0aW1hdGVQYXJhbWV0ZXJJbnB1dC50eXBlID0gJ2hpZGRlbic7XG4gICAgdWx0aW1hdGVQYXJhbWV0ZXJJbnB1dC5uYW1lID0gJ3dwVWx0aW1hdGVQYXJhbSc7XG4gICAgdWx0aW1hdGVQYXJhbWV0ZXJJbnB1dC52YWx1ZSA9ICcxJztcbiAgICBmb3JtLmFwcGVuZCh1bHRpbWF0ZVBhcmFtZXRlcklucHV0KTtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBw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
