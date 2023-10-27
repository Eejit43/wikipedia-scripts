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
      const editSummary = `Handled ${changes.total} request${changes.total > 1 ? "s" : ""}: ${Object.entries(changes.remove).length > 0 ? `Removed ${Object.entries(changes.remove).map(([reason, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(", ")} as ${reason.toLowerCase()}`).join(", ")}` : ""}${Object.entries(changes.move).length > 0 ? `${Object.entries(changes.remove).length > 0 ? ", " : ""}Moved ${Object.entries(changes.move).map(([destination, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(", ")} to "${destination}"`).join(", ")}` : ""}${noRemaining ? "(no requests remain)" : ""} (via [[User:Eejit43/scripts/rmtr-helper|script]])`;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9ybXRyLWhlbHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGFnZVJldmlzaW9uc1Jlc3VsdCB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gaW1wb3J0U3R5bGVzaGVldChwYWdlOiBzdHJpbmcpOiB2b2lkO1xuXG5tdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgY29uc3QgZGV2ZWxvcG1lbnRNb2RlID0gZmFsc2U7XG5cbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpICE9PSAoZGV2ZWxvcG1lbnRNb2RlID8gJ1VzZXI6RWVqaXQ0My9zYW5kYm94JyA6ICdXaWtpcGVkaWE6UmVxdWVzdGVkX21vdmVzL1RlY2huaWNhbF9yZXF1ZXN0cycpKSByZXR1cm47XG5cbiAgICBpbXBvcnRTdHlsZXNoZWV0KCdVc2VyOkVlaml0NDMvc2NyaXB0cy9ybXRyLWhlbHBlci5jc3MnKTtcblxuICAgIGNvbnN0IG5hbWVzcGFjZXMgPSBtdy5jb25maWcuZ2V0KCd3Z05hbWVzcGFjZUlkcycpO1xuXG4gICAgbGV0IGRpc3BsYXllZCA9IGZhbHNlO1xuXG4gICAgY29uc3QgbGluayA9IG13LnV0aWwuYWRkUG9ydGxldExpbmsobXcuY29uZmlnLmdldCgnc2tpbicpID09PSAnbWluZXJ2YScgPyAncC10YicgOiAncC1jYWN0aW9ucycsICcjJywgYFJldmlldyBtb3ZlIHJlcXVlc3RzJHtkZXZlbG9wbWVudE1vZGUgPyAnIChERVYpJyA6ICcnfWAsICdyZXZpZXctcm10ci1yZXF1ZXN0cycpO1xuXG4gICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGlmIChkaXNwbGF5ZWQpIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcm10ci1yZXZpZXctcmVzdWx0Jyk/LnNjcm9sbEludG9WaWV3KCk7XG4gICAgICAgIGVsc2UgZGlzcGxheWVkID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBwYWdlQ29udGVudCA9IChcbiAgICAgICAgICAgIChhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHsgYWN0aW9uOiAncXVlcnknLCBmb3JtYXR2ZXJzaW9uOiAyLCBwcm9wOiAncmV2aXNpb25zJywgcnZwcm9wOiAnY29udGVudCcsIHJ2c2xvdHM6ICcqJywgdGl0bGVzOiBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJykgfSkpIGFzIFBhZ2VSZXZpc2lvbnNSZXN1bHRcbiAgICAgICAgKS5xdWVyeS5wYWdlc1swXS5yZXZpc2lvbnNbMF0uc2xvdHMubWFpbi5jb250ZW50O1xuXG4gICAgICAgIGNvbnN0IHNlY3Rpb25zID0gWydVbmNvbnRyb3ZlcnNpYWwgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ1JlcXVlc3RzIHRvIHJldmVydCB1bmRpc2N1c3NlZCBtb3ZlcycsICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ0FkbWluaXN0cmF0b3IgbmVlZGVkJ107XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3Qge1xuICAgICAgICAgICAgcmVxdWVzdGVyOiBzdHJpbmc7XG4gICAgICAgICAgICByZWFzb246IHN0cmluZztcbiAgICAgICAgICAgIGZ1bGw6IHN0cmluZztcbiAgICAgICAgICAgIG9yaWdpbmFsOiBzdHJpbmc7XG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgZWxlbWVudDogSFRNTExJRWxlbWVudDtcbiAgICAgICAgICAgIHJlc3VsdD86IFJlcXVlc3RSZXN1bHRNb3ZlIHwgUmVxdWVzdFJlc3VsdFJlbW92ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGludGVyZmFjZSBSZXF1ZXN0UmVzdWx0TW92ZSB7XG4gICAgICAgICAgICBtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgc2VjdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgcmVhc29uPzogc3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3RSZXN1bHRSZW1vdmUge1xuICAgICAgICAgICAgcmVtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgcmVhc29uOiBzdHJpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhbGxSZXF1ZXN0czogUmVjb3JkPHN0cmluZywgUmVxdWVzdFtdPiA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBwYWdlQ29udGVudFxuICAgICAgICAgICAgICAgIC5zcGxpdChuZXcgUmVnRXhwKGA9ezMsfSA/JHtzZWN0aW9ufSA/PXszLH1gKSlbMV1cbiAgICAgICAgICAgICAgICAuc3BsaXQoLz17Myx9L20pWzBdXG4gICAgICAgICAgICAgICAgLnRyaW0oKTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZFJlcXVlc3RzID0gc2VjdGlvbkNvbnRlbnQubWF0Y2goLyg/OlxcKiA/XFxuKT9cXCoge3tybWFzc2lzdFxcL2NvcmUuKz8oPz1cXCoge3tybWFzc2lzdFxcL2NvcmV8JCkvZ2lzKTtcblxuICAgICAgICAgICAgaWYgKG1hdGNoZWRSZXF1ZXN0cylcbiAgICAgICAgICAgICAgICBhbGxSZXF1ZXN0c1tzZWN0aW9uXSA9IG1hdGNoZWRSZXF1ZXN0cy5tYXAoKHJlcXVlc3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCA9IHJlcXVlc3QudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdWxsID0gcmVxdWVzdDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHJlcXVlc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKC8oPzpcXCogP1xcbik/XFwqIHt7cm1hc3Npc3RcXC9jb3JlIFxcfHx9fS4qL2dpcywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJyB8ICcpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChwYXJhbWV0ZXIpID0+IHBhcmFtZXRlci50cmltKCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbmFsUGFyYW1ldGVycyA9IE9iamVjdC5mcm9tRW50cmllcyhwYXJhbWV0ZXJzLm1hcCgocGFyYW1ldGVyKSA9PiBwYXJhbWV0ZXIuc3BsaXQoJyA9ICcpLm1hcCgodmFsdWUpID0+IHZhbHVlLnRyaW0oKSkpKSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5mdWxsID0gZnVsbDtcblxuICAgICAgICAgICAgICAgICAgICBmaW5hbFBhcmFtZXRlcnMub3JpZ2luYWwgPSBmaW5hbFBhcmFtZXRlcnNbMV07XG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5kZXN0aW5hdGlvbiA9IGZpbmFsUGFyYW1ldGVyc1syXTtcblxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzFdO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzJdO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaW5hbFBhcmFtZXRlcnMgYXMgdW5rbm93biBhcyBSZXF1ZXN0O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl0gPSBbXTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLm1hcChhc3luYyAoWywgcmVxdWVzdHNdKSA9PiB7XG4gICAgICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RzLm1hcChhc3luYyAocmVxdWVzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdPbGRUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3Qub3JpZ2luYWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdOZXdUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3QuZGVzdGluYXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW13T2xkVGl0bGUpIHJldHVybiBtdy5ub3RpZnkoYEludmFsaWQgdGl0bGUgXCIke3JlcXVlc3Qub3JpZ2luYWx9XCIhYCwgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtd05ld1RpdGxlKSByZXR1cm4gbXcubm90aWZ5KGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWAsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsaWRUaXRsZSA9ICEvWyM8PltcXF17fH1dLy50ZXN0KHJlcXVlc3QuZGVzdGluYXRpb24pICYmIG13TmV3VGl0bGU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGludmFsaWRUaXRsZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkVGl0bGVXYXJuaW5nLmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LWludmFsaWQtd2FybmluZycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZFRpdGxlV2FybmluZy50ZXh0Q29udGVudCA9IGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkTmFtZXNwYWNlID0gIVtuYW1lc3BhY2VzLmZpbGUsIG5hbWVzcGFjZXMuY2F0ZWdvcnldLnNvbWUoKG5hbWVzcGFjZSkgPT4gbXdPbGRUaXRsZS5uYW1lc3BhY2UgPT09IG5hbWVzcGFjZSB8fCBtd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52YWxpZE5hbWVzcGFjZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkTmFtZXNwYWNlV2FybmluZy5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1pbnZhbGlkLXdhcm5pbmcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWROYW1lc3BhY2VXYXJuaW5nLnRleHRDb250ZW50ID0gYFdhcm5pbmc6IG9yaWdpbmFsIG9yIGRlc3RpbmF0aW9uIHBhZ2UgaXMgaW4gbmFtZXNwYWNlIFwiJHttd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlcy5maWxlID8gJ2ZpbGUnIDogJ2NhdGVnb3J5J31cIiFgO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRXaWtpdGV4dCA9IGF3YWl0IG5ldyBtdy5BcGkoKS5wYXJzZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgW1s6JHtyZXF1ZXN0Lm9yaWdpbmFsfV1dIFx1MjE5MiAke3ZhbGlkVGl0bGUgPyBgW1s6JHtyZXF1ZXN0LmRlc3RpbmF0aW9ufV1dYCA6IGludmFsaWRUaXRsZVdhcm5pbmcub3V0ZXJIVE1MfSByZXF1ZXN0ZWQgYnkgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbXcudXRpbC5pc0lQQWRkcmVzcyhyZXF1ZXN0LnJlcXVlc3RlcikgPyBgW1tTcGVjaWFsOkNvbnRyaWJ1dGlvbnMvJHtyZXF1ZXN0LnJlcXVlc3Rlcn18JHtyZXF1ZXN0LnJlcXVlc3Rlcn1dXWAgOiBgW1tVc2VyOiR7cmVxdWVzdC5yZXF1ZXN0ZXJ9fCR7cmVxdWVzdC5yZXF1ZXN0ZXJ9XV1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSB3aXRoIHJlYXNvbmluZyBcIiR7cmVxdWVzdC5yZWFzb259XCJgLFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZEh0bWwgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHBhcnNlZFdpa2l0ZXh0LCAndGV4dC9odG1sJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmlubmVySFRNTCA9IHBhcnNlZEh0bWwucXVlcnlTZWxlY3RvcignZGl2Lm13LXBhcnNlci1vdXRwdXQnKSEuZmlyc3RFbGVtZW50Q2hpbGQhLmlubmVySFRNTCE7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdmFsaWROYW1lc3BhY2UpIHJlcXVlc3RFbGVtZW50LmFwcGVuZChpbnZhbGlkTmFtZXNwYWNlV2FybmluZyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuZWxlbWVudCA9IHJlcXVlc3RFbGVtZW50O1xuICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3Qgb3V0cHV0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBvdXRwdXRFbGVtZW50LmlkID0gJ3JtdHItcmV2aWV3LXJlc3VsdCc7XG5cbiAgICAgICAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGhlYWRlci5pZCA9ICdybXRyLXJldmlldy1oZWFkZXInO1xuICAgICAgICBoZWFkZXIudGV4dENvbnRlbnQgPSAnVGVjaG5pY2FsIG1vdmUgcmVxdWVzdHMgcmV2aWV3JztcblxuICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChoZWFkZXIpO1xuXG4gICAgICAgIGZvciAoY29uc3QgW3NlY3Rpb25JbmRleCwgW3NlY3Rpb24sIHJlcXVlc3RzXV0gb2YgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgc2VjdGlvbkhlYWRlci5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1oZWFkZXInKTtcbiAgICAgICAgICAgIHNlY3Rpb25IZWFkZXIudGV4dENvbnRlbnQgPSBzZWN0aW9uO1xuXG4gICAgICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChzZWN0aW9uSGVhZGVyKTtcblxuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHNlY3Rpb25Db250ZW50LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXNlY3Rpb24tY29udGVudCcpO1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9SZXF1ZXN0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgIG5vUmVxdWVzdHMudGV4dENvbnRlbnQgPSAnTm8gcmVxdWVzdHMgaW4gdGhpcyBzZWN0aW9uJztcblxuICAgICAgICAgICAgICAgIHNlY3Rpb25Db250ZW50LmFwcGVuZChub1JlcXVlc3RzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdHNMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW3JlcXVlc3RJbmRleCwgcmVxdWVzdF0gb2YgcmVxdWVzdHMuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RFbGVtZW50ID0gcmVxdWVzdC5lbGVtZW50O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3RDaGVja2JveCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RDaGVja2JveC50eXBlID0gJ2NoZWNrYm94JztcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXJlcXVlc3QtY2hlY2tib3gnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmlkID0gYHJtdHItcmV2aWV3LXJlbW92ZS1yZXF1ZXN0LSR7c2VjdGlvbkluZGV4fS0ke3JlcXVlc3RJbmRleH1gO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZVJlcXVlc3RDaGVja2JveC5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgPSB7IHJlbW92ZTogdHJ1ZSwgcmVhc29uOiByZW1vdmVSZXF1ZXN0RHJvcGRvd24udmFsdWUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25DaGVja2JveC5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZlUmVxdWVzdExhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdExhYmVsLmh0bWxGb3IgPSBgcm10ci1yZXZpZXctcmVtb3ZlLXJlcXVlc3QtJHtzZWN0aW9uSW5kZXh9LSR7cmVxdWVzdEluZGV4fWA7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RMYWJlbC50ZXh0Q29udGVudCA9ICdSZW1vdmUgcmVxdWVzdCc7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RDaGVja2JveCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmFwcGVuZChyZW1vdmVSZXF1ZXN0TGFiZWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLmFwcGVuZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnIGFzICcpKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0RHJvcGRvd24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlY3Rpb24gPT09ICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJykgcmVtb3ZlUmVxdWVzdERyb3Bkb3duLnZhbHVlID0gJ0NvbnRlc3RlZCc7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3REcm9wZG93bi5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgYXMgUmVxdWVzdFJlc3VsdFJlbW92ZSkucmVhc29uID0gcmVtb3ZlUmVxdWVzdERyb3Bkb3duLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0RHJvcGRvd25PcHRpb25zID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ0NvbXBsZXRlZCcsIC8vXG4gICAgICAgICAgICAgICAgICAgICAgICAnQ29udGVzdGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBbHJlYWR5IGRvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0ludmFsaWQgcGFnZSBuYW1lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdJbmNvcnJlY3QgdmVudWUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ1dpdGhkcmF3bicsXG4gICAgICAgICAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBvcHRpb24gb2YgcmVtb3ZlUmVxdWVzdERyb3Bkb3duT3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uRWxlbWVudC52YWx1ZSA9IG9wdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudGV4dENvbnRlbnQgPSBvcHRpb247XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3REcm9wZG93bi5hcHBlbmQob3B0aW9uRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuYXBwZW5kKHJlbW92ZVJlcXVlc3REcm9wZG93bik7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvbkNoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkNoZWNrYm94LnR5cGUgPSAnY2hlY2tib3gnO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guY2xhc3NMaXN0LmFkZCgncm10ci1yZXZpZXctcmVxdWVzdC1jaGVja2JveCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guaWQgPSBgcm10ci1yZXZpZXctbW92ZS1yZXF1ZXN0LSR7c2VjdGlvbkluZGV4fS0ke3JlcXVlc3RJbmRleH1gO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN3aXRjaFNlY3Rpb25DaGVja2JveC5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0IGFzIFJlcXVlc3RSZXN1bHRNb3ZlKSA9IHsgbW92ZTogdHJ1ZSwgc2VjdGlvbjogc3dpdGNoU2VjdGlvbkRyb3Bkb3duLnZhbHVlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25MYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25MYWJlbC5odG1sRm9yID0gYHJtdHItcmV2aWV3LW1vdmUtcmVxdWVzdC0ke3NlY3Rpb25JbmRleH0tJHtyZXF1ZXN0SW5kZXh9YDtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkxhYmVsLnRleHRDb250ZW50ID0gJ1N3aXRjaCBzZWN0aW9uJztcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQoc3dpdGNoU2VjdGlvbkNoZWNrYm94KTtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHN3aXRjaFNlY3Rpb25MYWJlbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgdG8gJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25Ecm9wZG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRHJvcGRvd24uYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgKGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0IGFzIFJlcXVlc3RSZXN1bHRNb3ZlKS5zZWN0aW9uID0gc3dpdGNoU2VjdGlvbkRyb3Bkb3duLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG9wdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbiA9PT0gc2VjdGlvbikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudmFsdWUgPSBvcHRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25FbGVtZW50LnRleHRDb250ZW50ID0gb3B0aW9uO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRHJvcGRvd24uYXBwZW5kKG9wdGlvbkVsZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLmFwcGVuZChzd2l0Y2hTZWN0aW9uRHJvcGRvd24pO1xuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyB3aXRoIHJlYXNvbmluZyAnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoU2VjdGlvblJlYXNvbmluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25SZWFzb25pbmcudHlwZSA9ICd0ZXh0JztcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvblJlYXNvbmluZy5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdCBhcyBSZXF1ZXN0UmVzdWx0UmVtb3ZlKS5yZWFzb24gPSBzd2l0Y2hTZWN0aW9uUmVhc29uaW5nLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKHN3aXRjaFNlY3Rpb25SZWFzb25pbmcpO1xuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyAob3B0aW9uYWwsIGF1dG9tYXRpY2FsbHkgc2lnbmVkKScpKTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0RWxlbWVudC5hcHBlbmQoc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzKTtcblxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0c0xpc3QuYXBwZW5kKHJlcXVlc3RFbGVtZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWN0aW9uQ29udGVudC5hcHBlbmQocmVxdWVzdHNMaXN0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3V0cHV0RWxlbWVudC5hcHBlbmQoc2VjdGlvbkNvbnRlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3VibWl0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIHN1Ym1pdEJ1dHRvbi5pZCA9ICdybXRyLXJldmlldy1zdWJtaXQnO1xuICAgICAgICBzdWJtaXRCdXR0b24udGV4dENvbnRlbnQgPSAnU3VibWl0JztcbiAgICAgICAgc3VibWl0QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgc3VibWl0QnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGxvYWRpbmdTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcblxuICAgICAgICAgICAgbGV0IGVuZFJlc3VsdCA9IHBhZ2VDb250ZW50O1xuXG4gICAgICAgICAgICBpbnRlcmZhY2UgQWxsQ2hhbmdlcyB7XG4gICAgICAgICAgICAgICAgcmVtb3ZlOiBSZWNvcmQ8c3RyaW5nLCBSZXF1ZXN0W10+O1xuICAgICAgICAgICAgICAgIG1vdmU6IFJlY29yZDxzdHJpbmcsIFJlcXVlc3RbXT47XG4gICAgICAgICAgICAgICAgdG90YWw6IG51bWJlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2hhbmdlczogQWxsQ2hhbmdlcyA9IHsgcmVtb3ZlOiB7fSwgbW92ZToge30sIHRvdGFsOiAwIH07XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBPYmplY3QudmFsdWVzKGFsbFJlcXVlc3RzKSlcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJlcXVlc3Qgb2Ygc2VjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlcXVlc3QucmVzdWx0KSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoJ3JlbW92ZScgaW4gcmVxdWVzdC5yZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKHJlcXVlc3QuZnVsbCArICdcXG4nLCAnJykucmVwbGFjZShyZXF1ZXN0LmZ1bGwsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXSkgY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy5yZW1vdmVbcmVxdWVzdC5yZXN1bHQucmVhc29uXS5wdXNoKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy50b3RhbCsrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCdtb3ZlJyBpbiByZXF1ZXN0LnJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VjdGlvblRpdGxlQWZ0ZXIgPSBzZWN0aW9uc1tzZWN0aW9ucy5pbmRleE9mKHJlcXVlc3QucmVzdWx0LnNlY3Rpb24pICsgMV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKHJlcXVlc3QuZnVsbCArICdcXG4nLCAnJykucmVwbGFjZShyZXF1ZXN0LmZ1bGwsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuZFJlc3VsdCA9IGVuZFJlc3VsdC5yZXBsYWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBSZWdFeHAoYChcXG4/XFxuPyg/Oj17Myx9ID8ke3NlY3Rpb25UaXRsZUFmdGVyfSA/PXszLH18JCkpYCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYFxcbiR7cmVxdWVzdC5mdWxsfSR7cmVxdWVzdC5yZXN1bHQucmVhc29uID8gYFxcbjo6ICR7cmVxdWVzdC5yZXN1bHQucmVhc29ufSB+fn5+YCA6ICcnfSQxYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNoYW5nZXMubW92ZVtyZXF1ZXN0LnJlc3VsdC5zZWN0aW9uXSkgY2hhbmdlcy5tb3ZlW3JlcXVlc3QucmVzdWx0LnNlY3Rpb25dID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZXMubW92ZVtyZXF1ZXN0LnJlc3VsdC5zZWN0aW9uXS5wdXNoKHJlcXVlc3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlcy50b3RhbCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY2hhbmdlcy50b3RhbCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHN1Ym1pdEJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGxvYWRpbmdTcGlubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG13Lm5vdGlmeSgnTm8gY2hhbmdlcyB0byBtYWtlIScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9SZW1haW5pbmcgPSBPYmplY3QudmFsdWVzKGFsbFJlcXVlc3RzKS5ldmVyeSgoc2VjdGlvbikgPT4gc2VjdGlvbi5ldmVyeSgocmVxdWVzdCkgPT4gcmVxdWVzdC5yZXN1bHQgJiYgJ3JlbW92ZScgaW4gcmVxdWVzdC5yZXN1bHQpKTtcblxuICAgICAgICAgICAgY29uc3QgZWRpdFN1bW1hcnkgPSBgSGFuZGxlZCAke2NoYW5nZXMudG90YWx9IHJlcXVlc3Qke2NoYW5nZXMudG90YWwgPiAxID8gJ3MnIDogJyd9OiAke1xuICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKGNoYW5nZXMucmVtb3ZlKS5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgID8gYFJlbW92ZWQgJHtPYmplY3QuZW50cmllcyhjaGFuZ2VzLnJlbW92ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoW3JlYXNvbiwgcGFnZXNdKSA9PiBgJHtwYWdlcy5tYXAoKHBhZ2UpID0+IGBbWyR7cGFnZS5vcmlnaW5hbH1dXWApLmpvaW4oJywgJyl9IGFzICR7cmVhc29uLnRvTG93ZXJDYXNlKCl9YClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyl9YFxuICAgICAgICAgICAgICAgICAgICA6ICcnXG4gICAgICAgICAgICB9JHtcbiAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhjaGFuZ2VzLm1vdmUpLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgPyBgJHtPYmplY3QuZW50cmllcyhjaGFuZ2VzLnJlbW92ZSkubGVuZ3RoID4gMCA/ICcsICcgOiAnJ31Nb3ZlZCAke09iamVjdC5lbnRyaWVzKGNoYW5nZXMubW92ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoW2Rlc3RpbmF0aW9uLCBwYWdlc10pID0+IGAke3BhZ2VzLm1hcCgocGFnZSkgPT4gYFtbJHtwYWdlLm9yaWdpbmFsfV1dYCkuam9pbignLCAnKX0gdG8gXCIke2Rlc3RpbmF0aW9ufVwiYClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyl9YFxuICAgICAgICAgICAgICAgICAgICA6ICcnXG4gICAgICAgICAgICB9JHtub1JlbWFpbmluZyA/ICcobm8gcmVxdWVzdHMgcmVtYWluKScgOiAnJ30gKHZpYSBbW1VzZXI6RWVqaXQ0My9zY3JpcHRzL3JtdHItaGVscGVyfHNjcmlwdF1dKWA7XG5cbiAgICAgICAgICAgIGlmIChkZXZlbG9wbWVudE1vZGUpIHNob3dFZGl0UHJldmlldyhtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksIGVuZFJlc3VsdCwgZWRpdFN1bW1hcnkpO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmVkaXQobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpLCAoKSA9PiAoeyB0ZXh0OiBlbmRSZXN1bHQsIHN1bW1hcnk6IGVkaXRTdW1tYXJ5IH0pKTtcblxuICAgICAgICAgICAgICAgIG13Lm5vdGlmeShgU3VjY2Vzc2Z1bGx5IGhhbmRsZWQgJHtjaGFuZ2VzLnRvdGFsfSByZXF1ZXN0cywgcmVsb2FkaW5nLi4uYCwgeyB0eXBlOiAnc3VjY2VzcycgfSk7XG5cbiAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGxvYWRpbmdTcGlubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICBsb2FkaW5nU3Bpbm5lci5pZCA9ICdybXRyLXJldmlldy1sb2FkaW5nJztcbiAgICAgICAgbG9hZGluZ1NwaW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICBzdWJtaXRCdXR0b24uYXBwZW5kKGxvYWRpbmdTcGlubmVyKTtcblxuICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChzdWJtaXRCdXR0b24pO1xuXG4gICAgICAgIG13LnV0aWwuJGNvbnRlbnRbMF0ucHJlcGVuZChvdXRwdXRFbGVtZW50KTtcblxuICAgICAgICBvdXRwdXRFbGVtZW50LnNjcm9sbEludG9WaWV3KCk7XG4gICAgfSk7XG59KTtcblxuLyoqXG4gKiBTaG93cyBhIGRpZmYgZWRpdCBwcmV2aWV3IGZvciB0aGUgZ2l2ZW4gd2lraXRleHQgb24gYSBnaXZlbiBwYWdlLlxuICogQHBhcmFtIHRpdGxlIFRoZSB0aXRsZSBvZiB0aGUgcGFnZSB0byBlZGl0LlxuICogQHBhcmFtIHRleHQgVGhlIHJlc3VsdGluZyB3aWtpdGV4dCBvZiB0aGUgcGFnZS5cbiAqIEBwYXJhbSBzdW1tYXJ5IFRoZSBlZGl0IHN1bW1hcnkuXG4gKi9cbmZ1bmN0aW9uIHNob3dFZGl0UHJldmlldyh0aXRsZTogc3RyaW5nLCB0ZXh0OiBzdHJpbmcsIHN1bW1hcnk6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGJhc2VVcmwgPSBtdy5jb25maWcuZ2V0KCd3Z1NlcnZlcicpICsgbXcuY29uZmlnLmdldCgnd2dTY3JpcHRQYXRoJykgKyAnLyc7XG5cbiAgICBjb25zdCBmb3JtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZm9ybScpO1xuICAgIGZvcm0uYWN0aW9uID0gYCR7YmFzZVVybH1pbmRleC5waHA/dGl0bGU9JHtlbmNvZGVVUklDb21wb25lbnQodGl0bGUpfSZhY3Rpb249c3VibWl0YDtcbiAgICBmb3JtLm1ldGhvZCA9ICdQT1NUJztcblxuICAgIGNvbnN0IHRleHRib3hJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgdGV4dGJveElucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICB0ZXh0Ym94SW5wdXQubmFtZSA9ICd3cFRleHRib3gxJztcbiAgICB0ZXh0Ym94SW5wdXQudmFsdWUgPSB0ZXh0O1xuICAgIGZvcm0uYXBwZW5kKHRleHRib3hJbnB1dCk7XG5cbiAgICBjb25zdCBzdW1tYXJ5SW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHN1bW1hcnlJbnB1dC50eXBlID0gJ2hpZGRlbic7XG4gICAgc3VtbWFyeUlucHV0Lm5hbWUgPSAnd3BTdW1tYXJ5JztcbiAgICBzdW1tYXJ5SW5wdXQudmFsdWUgPSBzdW1tYXJ5O1xuICAgIGZvcm0uYXBwZW5kKHN1bW1hcnlJbnB1dCk7XG5cbiAgICBjb25zdCBwcmV2aWV3SW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHByZXZpZXdJbnB1dC50eXBlID0gJ2hpZGRlbic7XG4gICAgcHJldmlld0lucHV0Lm5hbWUgPSAnbW9kZSc7XG4gICAgcHJldmlld0lucHV0LnZhbHVlID0gJ3ByZXZpZXcnO1xuICAgIGZvcm0uYXBwZW5kKHByZXZpZXdJbnB1dCk7XG5cbiAgICBjb25zdCBzaG93Q2hhbmdlc0lucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICBzaG93Q2hhbmdlc0lucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICBzaG93Q2hhbmdlc0lucHV0Lm5hbWUgPSAnd3BEaWZmJztcbiAgICBzaG93Q2hhbmdlc0lucHV0LnZhbHVlID0gJ1Nob3cgY2hhbmdlcyc7XG4gICAgZm9ybS5hcHBlbmQoc2hvd0NoYW5nZXNJbnB1dCk7XG5cbiAgICBjb25zdCB1bHRpbWF0ZVBhcmFtZXRlcklucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICB1bHRpbWF0ZVBhcmFtZXRlcklucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICB1bHRpbWF0ZVBhcmFtZXRlcklucHV0Lm5hbWUgPSAnd3BVbHRpbWF0ZVBhcmFtJztcbiAgICB1bHRpbWF0ZVBhcmFtZXRlcklucHV0LnZhbHVlID0gJzEnO1xuICAgIGZvcm0uYXBwZW5kKHVsdGltYXRlUGFyYW1ldGVySW5wdXQpO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBl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
