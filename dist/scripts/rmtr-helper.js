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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9ybXRyLWhlbHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGFnZVJldmlzaW9uc1Jlc3VsdCB9IGZyb20gJy4uL2dsb2JhbC10eXBlcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gaW1wb3J0U3R5bGVzaGVldChwYWdlOiBzdHJpbmcpOiB2b2lkO1xuXG5tdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgY29uc3QgZGV2ZWxvcG1lbnRNb2RlID0gZmFsc2U7XG5cbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpICE9PSAoZGV2ZWxvcG1lbnRNb2RlID8gJ1VzZXI6RWVqaXQ0My9zYW5kYm94JyA6ICdXaWtpcGVkaWE6UmVxdWVzdGVkX21vdmVzL1RlY2huaWNhbF9yZXF1ZXN0cycpKSByZXR1cm47XG5cbiAgICBpbXBvcnRTdHlsZXNoZWV0KCdVc2VyOkVlaml0NDMvc2NyaXB0cy9ybXRyLWhlbHBlci5jc3MnKTtcblxuICAgIGNvbnN0IG5hbWVzcGFjZXMgPSBtdy5jb25maWcuZ2V0KCd3Z05hbWVzcGFjZUlkcycpO1xuXG4gICAgbGV0IGRpc3BsYXllZCA9IGZhbHNlO1xuXG4gICAgY29uc3QgbGluayA9IG13LnV0aWwuYWRkUG9ydGxldExpbmsobXcuY29uZmlnLmdldCgnc2tpbicpID09PSAnbWluZXJ2YScgPyAncC10YicgOiAncC1jYWN0aW9ucycsICcjJywgYFJldmlldyBtb3ZlIHJlcXVlc3RzJHtkZXZlbG9wbWVudE1vZGUgPyAnIChERVYpJyA6ICcnfWAsICdyZXZpZXctcm10ci1yZXF1ZXN0cycpO1xuXG4gICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGlmIChkaXNwbGF5ZWQpIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcm10ci1yZXZpZXctcmVzdWx0Jyk/LnNjcm9sbEludG9WaWV3KCk7XG4gICAgICAgIGVsc2UgZGlzcGxheWVkID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBwYWdlQ29udGVudCA9IChcbiAgICAgICAgICAgIChhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHsgYWN0aW9uOiAncXVlcnknLCBmb3JtYXR2ZXJzaW9uOiAyLCBwcm9wOiAncmV2aXNpb25zJywgcnZwcm9wOiAnY29udGVudCcsIHJ2c2xvdHM6ICcqJywgdGl0bGVzOiBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJykgfSkpIGFzIFBhZ2VSZXZpc2lvbnNSZXN1bHRcbiAgICAgICAgKS5xdWVyeS5wYWdlc1swXS5yZXZpc2lvbnNbMF0uc2xvdHMubWFpbi5jb250ZW50O1xuXG4gICAgICAgIGNvbnN0IHNlY3Rpb25zID0gWydVbmNvbnRyb3ZlcnNpYWwgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ1JlcXVlc3RzIHRvIHJldmVydCB1bmRpc2N1c3NlZCBtb3ZlcycsICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJywgJ0FkbWluaXN0cmF0b3IgbmVlZGVkJ107XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3Qge1xuICAgICAgICAgICAgcmVxdWVzdGVyOiBzdHJpbmc7XG4gICAgICAgICAgICByZWFzb246IHN0cmluZztcbiAgICAgICAgICAgIGZ1bGw6IHN0cmluZztcbiAgICAgICAgICAgIG9yaWdpbmFsOiBzdHJpbmc7XG4gICAgICAgICAgICBkZXN0aW5hdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgZWxlbWVudDogSFRNTExJRWxlbWVudDtcbiAgICAgICAgICAgIHJlc3VsdD86IFJlcXVlc3RSZXN1bHRNb3ZlIHwgUmVxdWVzdFJlc3VsdFJlbW92ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGludGVyZmFjZSBSZXF1ZXN0UmVzdWx0TW92ZSB7XG4gICAgICAgICAgICBtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgc2VjdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgcmVhc29uPzogc3RyaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlcXVlc3RSZXN1bHRSZW1vdmUge1xuICAgICAgICAgICAgcmVtb3ZlOiBib29sZWFuO1xuICAgICAgICAgICAgcmVhc29uOiBzdHJpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhbGxSZXF1ZXN0czogUmVjb3JkPHN0cmluZywgUmVxdWVzdFtdPiA9IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBwYWdlQ29udGVudFxuICAgICAgICAgICAgICAgIC5zcGxpdChuZXcgUmVnRXhwKGA9ezMsfSA/JHtzZWN0aW9ufSA/PXszLH1gKSlbMV1cbiAgICAgICAgICAgICAgICAuc3BsaXQoLz17Myx9L20pWzBdXG4gICAgICAgICAgICAgICAgLnRyaW0oKTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZFJlcXVlc3RzID0gc2VjdGlvbkNvbnRlbnQubWF0Y2goLyg/OlxcKiA/XFxuKT9cXCoge3tybWFzc2lzdFxcL2NvcmUuKz8oPz1cXCoge3tybWFzc2lzdFxcL2NvcmV8JCkvZ2lzKTtcblxuICAgICAgICAgICAgaWYgKG1hdGNoZWRSZXF1ZXN0cylcbiAgICAgICAgICAgICAgICBhbGxSZXF1ZXN0c1tzZWN0aW9uXSA9IG1hdGNoZWRSZXF1ZXN0cy5tYXAoKHJlcXVlc3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdCA9IHJlcXVlc3QudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdWxsID0gcmVxdWVzdDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHJlcXVlc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlQWxsKC8oPzpcXCogP1xcbik/XFwqIHt7cm1hc3Npc3RcXC9jb3JlIFxcfHx9fS4qL2dpcywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJyB8ICcpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChwYXJhbWV0ZXIpID0+IHBhcmFtZXRlci50cmltKCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbmFsUGFyYW1ldGVycyA9IE9iamVjdC5mcm9tRW50cmllcyhwYXJhbWV0ZXJzLm1hcCgocGFyYW1ldGVyKSA9PiBwYXJhbWV0ZXIuc3BsaXQoJyA9ICcpLm1hcCgodmFsdWUpID0+IHZhbHVlLnRyaW0oKSkpKSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5mdWxsID0gZnVsbDtcblxuICAgICAgICAgICAgICAgICAgICBmaW5hbFBhcmFtZXRlcnMub3JpZ2luYWwgPSBmaW5hbFBhcmFtZXRlcnNbMV07XG4gICAgICAgICAgICAgICAgICAgIGZpbmFsUGFyYW1ldGVycy5kZXN0aW5hdGlvbiA9IGZpbmFsUGFyYW1ldGVyc1syXTtcblxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzFdO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgZmluYWxQYXJhbWV0ZXJzWzJdO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmaW5hbFBhcmFtZXRlcnMgYXMgdW5rbm93biBhcyBSZXF1ZXN0O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl0gPSBbXTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLm1hcChhc3luYyAoWywgcmVxdWVzdHNdKSA9PiB7XG4gICAgICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RzLm1hcChhc3luYyAocmVxdWVzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdPbGRUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3Qub3JpZ2luYWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdOZXdUaXRsZSA9IG13LlRpdGxlLm5ld0Zyb21UZXh0KHJlcXVlc3QuZGVzdGluYXRpb24pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW13T2xkVGl0bGUpIHJldHVybiBtdy5ub3RpZnkoYEludmFsaWQgdGl0bGUgXCIke3JlcXVlc3Qub3JpZ2luYWx9XCIhYCwgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtd05ld1RpdGxlKSByZXR1cm4gbXcubm90aWZ5KGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWAsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsaWRUaXRsZSA9ICEvWyM8PltcXF17fH1dLy50ZXN0KHJlcXVlc3QuZGVzdGluYXRpb24pICYmIG13TmV3VGl0bGU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGludmFsaWRUaXRsZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkVGl0bGVXYXJuaW5nLmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LWludmFsaWQtd2FybmluZycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZFRpdGxlV2FybmluZy50ZXh0Q29udGVudCA9IGBJbnZhbGlkIHRpdGxlIFwiJHtyZXF1ZXN0LmRlc3RpbmF0aW9ufVwiIWA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkTmFtZXNwYWNlID0gIVtuYW1lc3BhY2VzLmZpbGUsIG5hbWVzcGFjZXMuY2F0ZWdvcnldLnNvbWUoKG5hbWVzcGFjZSkgPT4gbXdPbGRUaXRsZS5uYW1lc3BhY2UgPT09IG5hbWVzcGFjZSB8fCBtd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52YWxpZE5hbWVzcGFjZVdhcm5pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkTmFtZXNwYWNlV2FybmluZy5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1pbnZhbGlkLXdhcm5pbmcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWROYW1lc3BhY2VXYXJuaW5nLnRleHRDb250ZW50ID0gYFdhcm5pbmc6IG9yaWdpbmFsIG9yIGRlc3RpbmF0aW9uIHBhZ2UgaXMgaW4gbmFtZXNwYWNlIFwiJHttd05ld1RpdGxlLm5hbWVzcGFjZSA9PT0gbmFtZXNwYWNlcy5maWxlID8gJ2ZpbGUnIDogJ2NhdGVnb3J5J31cIiFgO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWRXaWtpdGV4dCA9IGF3YWl0IG5ldyBtdy5BcGkoKS5wYXJzZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgW1s6JHtyZXF1ZXN0Lm9yaWdpbmFsfV1dIFx1MjE5MiAke3ZhbGlkVGl0bGUgPyBgW1s6JHtyZXF1ZXN0LmRlc3RpbmF0aW9ufV1dYCA6IGludmFsaWRUaXRsZVdhcm5pbmcub3V0ZXJIVE1MfSByZXF1ZXN0ZWQgYnkgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbXcudXRpbC5pc0lQQWRkcmVzcyhyZXF1ZXN0LnJlcXVlc3RlcikgPyBgW1tTcGVjaWFsOkNvbnRyaWJ1dGlvbnMvJHtyZXF1ZXN0LnJlcXVlc3Rlcn18JHtyZXF1ZXN0LnJlcXVlc3Rlcn1dXWAgOiBgW1tVc2VyOiR7cmVxdWVzdC5yZXF1ZXN0ZXJ9fCR7cmVxdWVzdC5yZXF1ZXN0ZXJ9XV1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSB3aXRoIHJlYXNvbmluZyBcIiR7cmVxdWVzdC5yZWFzb259XCJgLFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZEh0bWwgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHBhcnNlZFdpa2l0ZXh0LCAndGV4dC9odG1sJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmlubmVySFRNTCA9IHBhcnNlZEh0bWwucXVlcnlTZWxlY3RvcignZGl2Lm13LXBhcnNlci1vdXRwdXQnKSEuZmlyc3RFbGVtZW50Q2hpbGQhLmlubmVySFRNTCE7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdmFsaWROYW1lc3BhY2UpIHJlcXVlc3RFbGVtZW50LmFwcGVuZChpbnZhbGlkTmFtZXNwYWNlV2FybmluZyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuZWxlbWVudCA9IHJlcXVlc3RFbGVtZW50O1xuICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3Qgb3V0cHV0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBvdXRwdXRFbGVtZW50LmlkID0gJ3JtdHItcmV2aWV3LXJlc3VsdCc7XG5cbiAgICAgICAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGhlYWRlci5pZCA9ICdybXRyLXJldmlldy1oZWFkZXInO1xuICAgICAgICBoZWFkZXIudGV4dENvbnRlbnQgPSAnVGVjaG5pY2FsIG1vdmUgcmVxdWVzdHMgcmV2aWV3JztcblxuICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChoZWFkZXIpO1xuXG4gICAgICAgIGZvciAoY29uc3QgW3NlY3Rpb25JbmRleCwgW3NlY3Rpb24sIHJlcXVlc3RzXV0gb2YgT2JqZWN0LmVudHJpZXMoYWxsUmVxdWVzdHMpLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgc2VjdGlvbkhlYWRlci5jbGFzc0xpc3QuYWRkKCdybXRyLXJldmlldy1oZWFkZXInKTtcbiAgICAgICAgICAgIHNlY3Rpb25IZWFkZXIudGV4dENvbnRlbnQgPSBzZWN0aW9uO1xuXG4gICAgICAgICAgICBvdXRwdXRFbGVtZW50LmFwcGVuZChzZWN0aW9uSGVhZGVyKTtcblxuICAgICAgICAgICAgY29uc3Qgc2VjdGlvbkNvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHNlY3Rpb25Db250ZW50LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXNlY3Rpb24tY29udGVudCcpO1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9SZXF1ZXN0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgIG5vUmVxdWVzdHMudGV4dENvbnRlbnQgPSAnTm8gcmVxdWVzdHMgaW4gdGhpcyBzZWN0aW9uJztcblxuICAgICAgICAgICAgICAgIHNlY3Rpb25Db250ZW50LmFwcGVuZChub1JlcXVlc3RzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdHNMaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW3JlcXVlc3RJbmRleCwgcmVxdWVzdF0gb2YgcmVxdWVzdHMuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RFbGVtZW50ID0gcmVxdWVzdC5lbGVtZW50O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3RDaGVja2JveCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RDaGVja2JveC50eXBlID0gJ2NoZWNrYm94JztcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXJlcXVlc3QtY2hlY2tib3gnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmlkID0gYHJtdHItcmV2aWV3LXJlbW92ZS1yZXF1ZXN0LSR7c2VjdGlvbkluZGV4fS0ke3JlcXVlc3RJbmRleH1gO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0Q2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZVJlcXVlc3RDaGVja2JveC5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgPSB7IHJlbW92ZTogdHJ1ZSwgcmVhc29uOiByZW1vdmVSZXF1ZXN0RHJvcGRvd24udmFsdWUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25DaGVja2JveC5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uQ2hlY2tib3guZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZlUmVxdWVzdExhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdExhYmVsLmh0bWxGb3IgPSBgcm10ci1yZXZpZXctcmVtb3ZlLXJlcXVlc3QtJHtzZWN0aW9uSW5kZXh9LSR7cmVxdWVzdEluZGV4fWA7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RMYWJlbC50ZXh0Q29udGVudCA9ICdSZW1vdmUgcmVxdWVzdCc7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHJlbW92ZVJlcXVlc3RDaGVja2JveCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmFwcGVuZChyZW1vdmVSZXF1ZXN0TGFiZWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92ZVJlcXVlc3RFeHRyYUlucHV0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLmFwcGVuZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnIGFzICcpKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0RHJvcGRvd24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlY3Rpb24gPT09ICdDb250ZXN0ZWQgdGVjaG5pY2FsIHJlcXVlc3RzJykgcmVtb3ZlUmVxdWVzdERyb3Bkb3duLnZhbHVlID0gJ0NvbnRlc3RlZCc7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3REcm9wZG93bi5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgYXMgUmVxdWVzdFJlc3VsdFJlbW92ZSkucmVhc29uID0gcmVtb3ZlUmVxdWVzdERyb3Bkb3duLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVSZXF1ZXN0RHJvcGRvd25PcHRpb25zID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ0NvbXBsZXRlZCcsIC8vXG4gICAgICAgICAgICAgICAgICAgICAgICAnQ29udGVzdGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBbHJlYWR5IGRvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0ludmFsaWQgcGFnZSBuYW1lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdJbmNvcnJlY3QgdmVudWUnLFxuICAgICAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgb3B0aW9uIG9mIHJlbW92ZVJlcXVlc3REcm9wZG93bk9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbkVsZW1lbnQudmFsdWUgPSBvcHRpb247XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25FbGVtZW50LnRleHRDb250ZW50ID0gb3B0aW9uO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVSZXF1ZXN0RHJvcGRvd24uYXBwZW5kKG9wdGlvbkVsZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdEV4dHJhSW5wdXRzLmFwcGVuZChyZW1vdmVSZXF1ZXN0RHJvcGRvd24pO1xuXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmFwcGVuZChyZW1vdmVSZXF1ZXN0RXh0cmFJbnB1dHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25DaGVja2JveCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25DaGVja2JveC50eXBlID0gJ2NoZWNrYm94JztcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkNoZWNrYm94LmNsYXNzTGlzdC5hZGQoJ3JtdHItcmV2aWV3LXJlcXVlc3QtY2hlY2tib3gnKTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkNoZWNrYm94LmlkID0gYHJtdHItcmV2aWV3LW1vdmUtcmVxdWVzdC0ke3NlY3Rpb25JbmRleH0tJHtyZXF1ZXN0SW5kZXh9YDtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzd2l0Y2hTZWN0aW9uQ2hlY2tib3guY2hlY2tlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdCBhcyBSZXF1ZXN0UmVzdWx0TW92ZSkgPSB7IG1vdmU6IHRydWUsIHNlY3Rpb246IHN3aXRjaFNlY3Rpb25Ecm9wZG93bi52YWx1ZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlUmVxdWVzdENoZWNrYm94LmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGFsbFJlcXVlc3RzW3NlY3Rpb25dW3JlcXVlc3RJbmRleF0ucmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVJlcXVlc3RDaGVja2JveC5kaXNhYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzd2l0Y2hTZWN0aW9uTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsYWJlbCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uTGFiZWwuaHRtbEZvciA9IGBybXRyLXJldmlldy1tb3ZlLXJlcXVlc3QtJHtzZWN0aW9uSW5kZXh9LSR7cmVxdWVzdEluZGV4fWA7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25MYWJlbC50ZXh0Q29udGVudCA9ICdTd2l0Y2ggc2VjdGlvbic7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHN3aXRjaFNlY3Rpb25DaGVja2JveCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RFbGVtZW50LmFwcGVuZChzd2l0Y2hTZWN0aW9uTGFiZWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLmFwcGVuZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnIHRvICcpKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzd2l0Y2hTZWN0aW9uRHJvcGRvd24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkRyb3Bkb3duLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIChhbGxSZXF1ZXN0c1tzZWN0aW9uXVtyZXF1ZXN0SW5kZXhdLnJlc3VsdCBhcyBSZXF1ZXN0UmVzdWx0TW92ZSkuc2VjdGlvbiA9IHN3aXRjaFNlY3Rpb25Ecm9wZG93bi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBvcHRpb24gb2Ygc2VjdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb24gPT09IHNlY3Rpb24pIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb3B0aW9uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25FbGVtZW50LnZhbHVlID0gb3B0aW9uO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uRWxlbWVudC50ZXh0Q29udGVudCA9IG9wdGlvbjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkRyb3Bkb3duLmFwcGVuZChvcHRpb25FbGVtZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cy5hcHBlbmQoc3dpdGNoU2VjdGlvbkRyb3Bkb3duKTtcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgd2l0aCByZWFzb25pbmcgJykpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXRjaFNlY3Rpb25SZWFzb25pbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uUmVhc29uaW5nLnR5cGUgPSAndGV4dCc7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaFNlY3Rpb25SZWFzb25pbmcuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoYWxsUmVxdWVzdHNbc2VjdGlvbl1bcmVxdWVzdEluZGV4XS5yZXN1bHQgYXMgUmVxdWVzdFJlc3VsdFJlbW92ZSkucmVhc29uID0gc3dpdGNoU2VjdGlvblJlYXNvbmluZy52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoU2VjdGlvbkV4dHJhSW5wdXRzLmFwcGVuZChzd2l0Y2hTZWN0aW9uUmVhc29uaW5nKTtcblxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2hTZWN0aW9uRXh0cmFJbnB1dHMuYXBwZW5kKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgKG9wdGlvbmFsLCBhdXRvbWF0aWNhbGx5IHNpZ25lZCknKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEVsZW1lbnQuYXBwZW5kKHN3aXRjaFNlY3Rpb25FeHRyYUlucHV0cyk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdHNMaXN0LmFwcGVuZChyZXF1ZXN0RWxlbWVudCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc2VjdGlvbkNvbnRlbnQuYXBwZW5kKHJlcXVlc3RzTGlzdCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG91dHB1dEVsZW1lbnQuYXBwZW5kKHNlY3Rpb25Db250ZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1Ym1pdEJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgICBzdWJtaXRCdXR0b24uaWQgPSAncm10ci1yZXZpZXctc3VibWl0JztcbiAgICAgICAgc3VibWl0QnV0dG9uLnRleHRDb250ZW50ID0gJ1N1Ym1pdCc7XG4gICAgICAgIHN1Ym1pdEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHN1Ym1pdEJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgICAgICBsb2FkaW5nU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG5cbiAgICAgICAgICAgIGxldCBlbmRSZXN1bHQgPSBwYWdlQ29udGVudDtcblxuICAgICAgICAgICAgaW50ZXJmYWNlIEFsbENoYW5nZXMge1xuICAgICAgICAgICAgICAgIHJlbW92ZTogUmVjb3JkPHN0cmluZywgUmVxdWVzdFtdPjtcbiAgICAgICAgICAgICAgICBtb3ZlOiBSZWNvcmQ8c3RyaW5nLCBSZXF1ZXN0W10+O1xuICAgICAgICAgICAgICAgIHRvdGFsOiBudW1iZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNoYW5nZXM6IEFsbENoYW5nZXMgPSB7IHJlbW92ZToge30sIG1vdmU6IHt9LCB0b3RhbDogMCB9O1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHNlY3Rpb24gb2YgT2JqZWN0LnZhbHVlcyhhbGxSZXF1ZXN0cykpXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByZXF1ZXN0IG9mIHNlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXF1ZXN0LnJlc3VsdCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCdyZW1vdmUnIGluIHJlcXVlc3QucmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbmRSZXN1bHQgPSBlbmRSZXN1bHQucmVwbGFjZShyZXF1ZXN0LmZ1bGwgKyAnXFxuJywgJycpLnJlcGxhY2UocmVxdWVzdC5mdWxsLCAnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNoYW5nZXMucmVtb3ZlW3JlcXVlc3QucmVzdWx0LnJlYXNvbl0pIGNoYW5nZXMucmVtb3ZlW3JlcXVlc3QucmVzdWx0LnJlYXNvbl0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZXMucmVtb3ZlW3JlcXVlc3QucmVzdWx0LnJlYXNvbl0ucHVzaChyZXF1ZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZXMudG90YWwrKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICgnbW92ZScgaW4gcmVxdWVzdC5yZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlY3Rpb25UaXRsZUFmdGVyID0gc2VjdGlvbnNbc2VjdGlvbnMuaW5kZXhPZihyZXF1ZXN0LnJlc3VsdC5zZWN0aW9uKSArIDFdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmRSZXN1bHQgPSBlbmRSZXN1bHQucmVwbGFjZShyZXF1ZXN0LmZ1bGwgKyAnXFxuJywgJycpLnJlcGxhY2UocmVxdWVzdC5mdWxsLCAnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbmRSZXN1bHQgPSBlbmRSZXN1bHQucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgUmVnRXhwKGAoXFxuP1xcbj8oPzo9ezMsfSA/JHtzZWN0aW9uVGl0bGVBZnRlcn0gPz17Myx9fCQpKWApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBcXG4ke3JlcXVlc3QuZnVsbH0ke3JlcXVlc3QucmVzdWx0LnJlYXNvbiA/IGBcXG46OiAke3JlcXVlc3QucmVzdWx0LnJlYXNvbn0gfn5+fmAgOiAnJ30kMWAsXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjaGFuZ2VzLm1vdmVbcmVxdWVzdC5yZXN1bHQuc2VjdGlvbl0pIGNoYW5nZXMubW92ZVtyZXF1ZXN0LnJlc3VsdC5zZWN0aW9uXSA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzLm1vdmVbcmVxdWVzdC5yZXN1bHQuc2VjdGlvbl0ucHVzaChyZXF1ZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZXMudG90YWwrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNoYW5nZXMudG90YWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICBzdWJtaXRCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBsb2FkaW5nU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIHJldHVybiBtdy5ub3RpZnkoJ05vIGNoYW5nZXMgdG8gbWFrZSEnLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vUmVtYWluaW5nID0gT2JqZWN0LnZhbHVlcyhhbGxSZXF1ZXN0cykuZXZlcnkoKHNlY3Rpb24pID0+IHNlY3Rpb24uZXZlcnkoKHJlcXVlc3QpID0+ICEocmVxdWVzdC5yZXN1bHQgJiYgJ3JlbW92ZScgaW4gcmVxdWVzdC5yZXN1bHQpKSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGVkaXRTdW1tYXJ5ID0gYEhhbmRsZWQgJHtjaGFuZ2VzLnRvdGFsfSByZXF1ZXN0JHtjaGFuZ2VzLnRvdGFsID4gMSA/ICdzJyA6ICcnfTogJHtcbiAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhjaGFuZ2VzLnJlbW92ZSkubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICAgICA/IGBSZW1vdmVkICR7T2JqZWN0LmVudHJpZXMoY2hhbmdlcy5yZW1vdmUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKFtyZWFzb24sIHBhZ2VzXSkgPT4gYCR7cGFnZXMubWFwKChwYWdlKSA9PiBgW1ske3BhZ2Uub3JpZ2luYWx9XV1gKS5qb2luKCcsICcpfSBhcyAke3JlYXNvbi50b0xvd2VyQ2FzZSgpfWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpfWBcbiAgICAgICAgICAgICAgICAgICAgOiAnJ1xuICAgICAgICAgICAgfSR7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoY2hhbmdlcy5tb3ZlKS5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgID8gYCR7T2JqZWN0LmVudHJpZXMoY2hhbmdlcy5yZW1vdmUpLmxlbmd0aCA+IDAgPyAnLCAnIDogJyd9TW92ZWQgJHtPYmplY3QuZW50cmllcyhjaGFuZ2VzLm1vdmUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKFtkZXN0aW5hdGlvbiwgcGFnZXNdKSA9PiBgJHtwYWdlcy5tYXAoKHBhZ2UpID0+IGBbWyR7cGFnZS5vcmlnaW5hbH1dXWApLmpvaW4oJywgJyl9IHRvIFwiJHtkZXN0aW5hdGlvbn1cImApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcsICcpfWBcbiAgICAgICAgICAgICAgICAgICAgOiAnJ1xuICAgICAgICAgICAgfSAke25vUmVtYWluaW5nID8gJyhubyByZXF1ZXN0cyByZW1haW4pJyA6ICcnfSAodmlhIFtbVXNlcjpFZWppdDQzL3NjcmlwdHMvcm10ci1oZWxwZXJ8c2NyaXB0XV0pYDtcblxuICAgICAgICAgICAgaWYgKGRldmVsb3BtZW50TW9kZSkgc2hvd0VkaXRQcmV2aWV3KG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSwgZW5kUmVzdWx0LCBlZGl0U3VtbWFyeSk7XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZWRpdChtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksICgpID0+ICh7IHRleHQ6IGVuZFJlc3VsdCwgc3VtbWFyeTogZWRpdFN1bW1hcnkgfSkpO1xuXG4gICAgICAgICAgICAgICAgbXcubm90aWZ5KGBTdWNjZXNzZnVsbHkgaGFuZGxlZCAke2NoYW5nZXMudG90YWx9IHJlcXVlc3RzLCByZWxvYWRpbmcuLi5gLCB7IHR5cGU6ICdzdWNjZXNzJyB9KTtcblxuICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgbG9hZGluZ1NwaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIGxvYWRpbmdTcGlubmVyLmlkID0gJ3JtdHItcmV2aWV3LWxvYWRpbmcnO1xuICAgICAgICBsb2FkaW5nU3Bpbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gICAgICAgIHN1Ym1pdEJ1dHRvbi5hcHBlbmQobG9hZGluZ1NwaW5uZXIpO1xuXG4gICAgICAgIG91dHB1dEVsZW1lbnQuYXBwZW5kKHN1Ym1pdEJ1dHRvbik7XG5cbiAgICAgICAgbXcudXRpbC4kY29udGVudFswXS5wcmVwZW5kKG91dHB1dEVsZW1lbnQpO1xuXG4gICAgICAgIG91dHB1dEVsZW1lbnQuc2Nyb2xsSW50b1ZpZXcoKTtcbiAgICB9KTtcbn0pO1xuXG4vKipcbiAqIFNob3dzIGEgZGlmZiBlZGl0IHByZXZpZXcgZm9yIHRoZSBnaXZlbiB3aWtpdGV4dCBvbiBhIGdpdmVuIHBhZ2UuXG4gKiBAcGFyYW0gdGl0bGUgVGhlIHRpdGxlIG9mIHRoZSBwYWdlIHRvIGVkaXQuXG4gKiBAcGFyYW0gdGV4dCBUaGUgcmVzdWx0aW5nIHdpa2l0ZXh0IG9mIHRoZSBwYWdlLlxuICogQHBhcmFtIHN1bW1hcnkgVGhlIGVkaXQgc3VtbWFyeS5cbiAqL1xuZnVuY3Rpb24gc2hvd0VkaXRQcmV2aWV3KHRpdGxlOiBzdHJpbmcsIHRleHQ6IHN0cmluZywgc3VtbWFyeTogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgYmFzZVVybCA9IG13LmNvbmZpZy5nZXQoJ3dnU2VydmVyJykgKyBtdy5jb25maWcuZ2V0KCd3Z1NjcmlwdFBhdGgnKSArICcvJztcblxuICAgIGNvbnN0IGZvcm0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdmb3JtJyk7XG4gICAgZm9ybS5hY3Rpb24gPSBgJHtiYXNlVXJsfWluZGV4LnBocD90aXRsZT0ke2VuY29kZVVSSUNvbXBvbmVudCh0aXRsZSl9JmFjdGlvbj1zdWJtaXRgO1xuICAgIGZvcm0ubWV0aG9kID0gJ1BPU1QnO1xuXG4gICAgY29uc3QgdGV4dGJveElucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICB0ZXh0Ym94SW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuICAgIHRleHRib3hJbnB1dC5uYW1lID0gJ3dwVGV4dGJveDEnO1xuICAgIHRleHRib3hJbnB1dC52YWx1ZSA9IHRleHQ7XG4gICAgZm9ybS5hcHBlbmQodGV4dGJveElucHV0KTtcblxuICAgIGNvbnN0IHN1bW1hcnlJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgc3VtbWFyeUlucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICBzdW1tYXJ5SW5wdXQubmFtZSA9ICd3cFN1bW1hcnknO1xuICAgIHN1bW1hcnlJbnB1dC52YWx1ZSA9IHN1bW1hcnk7XG4gICAgZm9ybS5hcHBlbmQoc3VtbWFyeUlucHV0KTtcblxuICAgIGNvbnN0IHByZXZpZXdJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gICAgcHJldmlld0lucHV0LnR5cGUgPSAnaGlkZGVuJztcbiAgICBwcmV2aWV3SW5wdXQubmFtZSA9ICdtb2RlJztcbiAgICBwcmV2aWV3SW5wdXQudmFsdWUgPSAncHJldmlldyc7XG4gICAgZm9ybS5hcHBlbmQocHJldmlld0lucHV0KTtcblxuICAgIGNvbnN0IHNob3dDaGFuZ2VzSW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHNob3dDaGFuZ2VzSW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuICAgIHNob3dDaGFuZ2VzSW5wdXQubmFtZSA9ICd3cERpZmYnO1xuICAgIHNob3dDaGFuZ2VzSW5wdXQudmFsdWUgPSAnU2hvdyBjaGFuZ2VzJztcbiAgICBmb3JtLmFwcGVuZChzaG93Q2hhbmdlc0lucHV0KTtcblxuICAgIGNvbnN0IHVsdGltYXRlUGFyYW1ldGVySW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgIHVsdGltYXRlUGFyYW1ldGVySW5wdXQudHlwZSA9ICdoaWRkZW4nO1xuICAgIHVsdGltYXRlUGFyYW1ldGVySW5wdXQubmFtZSA9ICd3cFVsdGltYXRlUGFyYW0nO1xuICAgIHVsdGltYXRlUGFyYW1ldGVySW5wdXQudmFsdWUgPSAnMSc7XG4gICAgZm9ybS5hcHBlbmQodWx0aW1hdGVQYXJhbWV0ZXJJbnB1dCk7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZChmb3JtKTtcbiAgICBmb3JtLnN1Ym1pdCgpO1xufVxu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
