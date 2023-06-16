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
    const devMode = false;
    if (mw.config.get('wgPageName') !== (devMode ? 'User:Eejit43/sandbox' : 'Wikipedia:Requested_moves/Technical_requests'))
        return;
    importStylesheet('User:Eejit43/scripts/rmtr-helper.css');
    const namespaces = mw.config.get('wgNamespaceIds');
    let displayed = false;
    const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', `Review move requests${devMode ? ' (DEV)' : ''}`, 'review-rmtr-requests');
    link.addEventListener('click', (event) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        event.preventDefault();
        if (displayed)
            return (_a = document.getElementById('rmtr-review-result')) === null || _a === void 0 ? void 0 : _a.scrollIntoView();
        else
            displayed = true;
        const pageContent = (yield new mw.Api().get({ action: 'query', prop: 'revisions', formatversion: 2, titles: mw.config.get('wgPageName'), rvprop: 'content', rvslots: '*' })).query.pages[0].revisions[0].slots.main.content;
        const sections = ['Uncontroversial technical requests', 'Requests to revert undiscussed moves', 'Contested technical requests', 'Administrator needed'];
        const allRequests = {};
        sections.forEach((section) => {
            const sectionContent = pageContent
                .split(new RegExp(`={3,} ?${section} ?={3,}`))[1]
                .split(/={3,}/m)[0]
                .trim();
            const matchedRequests = sectionContent.match(/(?:\* ?\n)?\* {{RMassist\/core.+?(?=\* {{RMassist\/core|$)/gis);
            if (!matchedRequests)
                return (allRequests[section] = []);
            else
                allRequests[section] = matchedRequests.map((request) => {
                    request = request.trim();
                    const full = request;
                    const params = request
                        .replace(/(?:\* ?\n)?\* {{RMassist\/core \||}}.*/gis, '')
                        .split(' | ')
                        .map((param) => param.trim());
                    const finalParams = Object.fromEntries(params.map((param) => param.split(' = ').map((value) => value.trim())));
                    finalParams.full = full;
                    finalParams.original = finalParams[1];
                    finalParams.destination = finalParams[2];
                    delete finalParams[1];
                    delete finalParams[2];
                    return finalParams;
                });
        });
        yield Promise.all(Object.entries(allRequests).map(([, requests]) => __awaiter(void 0, void 0, void 0, function* () {
            yield Promise.all(requests.map((request) => __awaiter(void 0, void 0, void 0, function* () {
                var _b, _c;
                const mwOldTitle = mw.Title.newFromText(request.original);
                const mwNewTitle = mw.Title.newFromText(request.destination);
                if (!mwOldTitle)
                    return mw.notify(`Invalid title "${request.original}"!`, { type: 'error' });
                if (!mwNewTitle)
                    return mw.notify(`Invalid title "${request.destination}"!`, { type: 'error' });
                const validTitle = !/[#<>[\]|{}]/.test(request.destination) && mwNewTitle;
                const invalidTitleWarning = document.createElement('span');
                invalidTitleWarning.classList.add('rmtr-review-invalid-warning');
                invalidTitleWarning.textContent = `Invalid title "${request.destination}"!`;
                const validNamespace = ![namespaces.file, namespaces.category].some((namespace) => mwOldTitle.namespace === namespace || mwNewTitle.namespace === namespace);
                const invalidNamespaceWarning = document.createElement('span');
                invalidNamespaceWarning.classList.add('rmtr-review-invalid-warning');
                invalidNamespaceWarning.textContent = `Warning: original or destination page is in namespace "${mwNewTitle.namespace === namespaces.file ? 'file' : 'category'}"!`;
                const parsedWikitext = yield new mw.Api().parse(`[[:${request.original}]] → ${validTitle ? `[[:${request.destination}]]` : invalidTitleWarning.outerHTML} requested by ${mw.util.isIPAddress(request.requester) ? `[[Special:Contributions/${request.requester}|${request.requester}]]` : `[[User:${request.requester}|${request.requester}]]`} with reasoning "${request.reason}"`);
                const parsedHTML = new DOMParser().parseFromString(parsedWikitext, 'text/html');
                const requestElement = document.createElement('li');
                requestElement.innerHTML = (_c = (_b = parsedHTML.querySelector('div.mw-parser-output')) === null || _b === void 0 ? void 0 : _b.firstElementChild) === null || _c === void 0 ? void 0 : _c.innerHTML;
                if (!validNamespace)
                    requestElement.appendChild(invalidNamespaceWarning);
                request.element = requestElement;
            })));
        })));
        const outputElement = document.createElement('div');
        outputElement.id = 'rmtr-review-result';
        const header = document.createElement('div');
        header.id = 'rmtr-review-header';
        header.textContent = 'Technical move requests review';
        outputElement.appendChild(header);
        Object.entries(allRequests).forEach(([section, requests], sectionIndex) => {
            const sectionHeader = document.createElement('div');
            sectionHeader.classList.add('rmtr-review-header');
            sectionHeader.textContent = section;
            outputElement.appendChild(sectionHeader);
            const sectionContent = document.createElement('div');
            sectionContent.classList.add('rmtr-review-section-content');
            if (requests.length === 0) {
                const noRequests = document.createElement('div');
                noRequests.textContent = 'No requests in this section';
                sectionContent.appendChild(noRequests);
            }
            else {
                const requestsList = document.createElement('ul');
                requests.forEach((request, requestIndex) => {
                    const requestElement = request.element;
                    const removeRequestCheckbox = document.createElement('input');
                    removeRequestCheckbox.type = 'checkbox';
                    removeRequestCheckbox.classList.add('rmtr-review-request-checkbox');
                    removeRequestCheckbox.id = `rmtr-review-remove-request-${sectionIndex}-${requestIndex}`;
                    removeRequestCheckbox.addEventListener('change', () => {
                        if (removeRequestCheckbox.checked) {
                            allRequests[section][requestIndex].result = { remove: true, reason: removeRequestDropdown.value };
                            removeRequestExtraInputs.style.display = 'inline';
                            switchSectionCheckbox.disabled = true;
                        }
                        else {
                            delete allRequests[section][requestIndex].result;
                            removeRequestExtraInputs.style.display = 'none';
                            switchSectionCheckbox.disabled = false;
                        }
                    });
                    const removeRequestLabel = document.createElement('label');
                    removeRequestLabel.htmlFor = `rmtr-review-remove-request-${sectionIndex}-${requestIndex}`;
                    removeRequestLabel.textContent = 'Remove request';
                    requestElement.appendChild(removeRequestCheckbox);
                    requestElement.appendChild(removeRequestLabel);
                    const removeRequestExtraInputs = document.createElement('span');
                    removeRequestExtraInputs.style.display = 'none';
                    removeRequestExtraInputs.appendChild(document.createTextNode(' as '));
                    const removeRequestDropdown = document.createElement('select');
                    if (section === 'Contested technical requests')
                        removeRequestDropdown.value = 'Contested';
                    removeRequestDropdown.addEventListener('change', () => {
                        allRequests[section][requestIndex].result.reason = removeRequestDropdown.value;
                    });
                    const removeRequestDropdownOptions = [
                        'Completed',
                        'Contested',
                        'Already done',
                        'Invalid page name',
                        'Incorrect venue'
                    ];
                    removeRequestDropdownOptions.forEach((option) => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        removeRequestDropdown.appendChild(optionElement);
                    });
                    removeRequestExtraInputs.appendChild(removeRequestDropdown);
                    requestElement.appendChild(removeRequestExtraInputs);
                    const switchSectionCheckbox = document.createElement('input');
                    switchSectionCheckbox.type = 'checkbox';
                    switchSectionCheckbox.classList.add('rmtr-review-request-checkbox');
                    switchSectionCheckbox.id = `rmtr-review-move-request-${sectionIndex}-${requestIndex}`;
                    switchSectionCheckbox.addEventListener('change', () => {
                        if (switchSectionCheckbox.checked) {
                            allRequests[section][requestIndex].result = { move: true, section: switchSectionDropdown.value };
                            switchSectionExtraInputs.style.display = 'inline';
                            removeRequestCheckbox.disabled = true;
                        }
                        else {
                            delete allRequests[section][requestIndex].result;
                            switchSectionExtraInputs.style.display = 'none';
                            removeRequestCheckbox.disabled = false;
                        }
                    });
                    const switchSectionLabel = document.createElement('label');
                    switchSectionLabel.htmlFor = `rmtr-review-move-request-${sectionIndex}-${requestIndex}`;
                    switchSectionLabel.textContent = 'Switch section';
                    requestElement.appendChild(switchSectionCheckbox);
                    requestElement.appendChild(switchSectionLabel);
                    const switchSectionExtraInputs = document.createElement('span');
                    switchSectionExtraInputs.style.display = 'none';
                    switchSectionExtraInputs.appendChild(document.createTextNode(' to '));
                    const switchSectionDropdown = document.createElement('select');
                    switchSectionDropdown.addEventListener('change', () => {
                        allRequests[section][requestIndex].result.section = switchSectionDropdown.value;
                    });
                    sections.forEach((option) => {
                        if (option === section)
                            return;
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        switchSectionDropdown.appendChild(optionElement);
                    });
                    switchSectionExtraInputs.appendChild(switchSectionDropdown);
                    switchSectionExtraInputs.appendChild(document.createTextNode(' with reasoning '));
                    const switchSectionReasoning = document.createElement('input');
                    switchSectionReasoning.type = 'text';
                    switchSectionReasoning.addEventListener('input', () => {
                        allRequests[section][requestIndex].result.reason = switchSectionReasoning.value;
                    });
                    switchSectionExtraInputs.appendChild(switchSectionReasoning);
                    switchSectionExtraInputs.appendChild(document.createTextNode(' (optional, automatically signed)'));
                    requestElement.appendChild(switchSectionExtraInputs);
                    requestsList.appendChild(requestElement);
                });
                sectionContent.appendChild(requestsList);
            }
            outputElement.appendChild(sectionContent);
        });
        const submitButton = document.createElement('button');
        submitButton.id = 'rmtr-review-submit';
        submitButton.textContent = 'Submit';
        submitButton.addEventListener('click', () => __awaiter(void 0, void 0, void 0, function* () {
            submitButton.disabled = true;
            loadingSpinner.style.display = 'inline-block';
            let endResult = pageContent;
            const changes = { remove: {}, move: {}, total: 0 };
            Object.values(allRequests).forEach((section) => {
                section.forEach((request) => {
                    if (!request.result)
                        return;
                    if ('remove' in request.result) {
                        endResult = endResult.replace(request.full + '\n', '').replace(request.full, '');
                        if (!changes.remove[request.result.reason])
                            changes.remove[request.result.reason] = [];
                        changes.remove[request.result.reason].push(request);
                        changes.total++;
                    }
                    else if ('move' in request.result) {
                        const sectionTitleAfter = sections[sections.indexOf(request.result.section) + 1];
                        endResult = endResult.replace(request.full + '\n', '').replace(request.full, '');
                        endResult = endResult.replace(new RegExp(`(\n?\n?(?:={3,} ?${sectionTitleAfter} ?={3,}|$))`), `\n${request.full}${request.result.reason ? `\n:: ${request.result.reason} ~~~~` : ''}$1`);
                        if (!changes.move[request.result.section])
                            changes.move[request.result.section] = [];
                        changes.move[request.result.section].push(request);
                        changes.total++;
                    }
                });
            });
            if (changes.total === 0) {
                submitButton.disabled = false;
                loadingSpinner.style.display = 'none';
                return mw.notify('No changes to make!', { type: 'error' });
            }
            const noRemaining = Object.values(allRequests).every((section) => section.every((request) => !(request.result && 'remove' in request.result)));
            const editSummary = `Handled ${changes.total} request${changes.total > 1 ? 's' : ''}: ${Object.entries(changes.remove).length > 0
                ? `Removed ${Object.entries(changes.remove)
                    .map(([reason, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(', ')} as ${reason.toLowerCase()}`)
                    .join(', ')}`
                : ''}${Object.entries(changes.move).length > 0
                ? `${Object.entries(changes.remove).length > 0 ? ', ' : ''}Moved ${Object.entries(changes.move)
                    .map(([destination, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(', ')} to "${destination}"`)
                    .join(', ')}`
                : ''} ${noRemaining ? '(no requests remain)' : ''} (via [[User:Eejit43/scripts/rmtr-helper|script]])`;
            if (devMode)
                showEditPreview(mw.config.get('wgPageName'), endResult, editSummary);
            else {
                yield new mw.Api().edit(mw.config.get('wgPageName'), () => ({ text: endResult, summary: editSummary }));
                mw.notify(`Successfully handled ${changes.total} requests, reloading...`, { type: 'success' });
                window.location.reload();
            }
        }));
        const loadingSpinner = document.createElement('span');
        loadingSpinner.id = 'rmtr-review-loading';
        loadingSpinner.style.display = 'none';
        submitButton.appendChild(loadingSpinner);
        outputElement.appendChild(submitButton);
        mw.util.$content[0].prepend(outputElement);
        outputElement.scrollIntoView();
    }));
});
function showEditPreview(title, text, summary) {
    const baseURL = mw.config.get('wgServer') + mw.config.get('wgScriptPath') + '/';
    const form = document.createElement('form');
    form.action = `${baseURL}index.php?title=${encodeURIComponent(title)}&action=submit`;
    form.method = 'POST';
    const textboxInput = document.createElement('input');
    textboxInput.type = 'hidden';
    textboxInput.name = 'wpTextbox1';
    textboxInput.value = text;
    form.appendChild(textboxInput);
    const summaryInput = document.createElement('input');
    summaryInput.type = 'hidden';
    summaryInput.name = 'wpSummary';
    summaryInput.value = summary;
    form.appendChild(summaryInput);
    const previewInput = document.createElement('input');
    previewInput.type = 'hidden';
    previewInput.name = 'mode';
    previewInput.value = 'preview';
    form.appendChild(previewInput);
    const showChangesInput = document.createElement('input');
    showChangesInput.type = 'hidden';
    showChangesInput.name = 'wpDiff';
    showChangesInput.value = 'Show changes';
    form.appendChild(showChangesInput);
    const ultimateParamInput = document.createElement('input');
    ultimateParamInput.type = 'hidden';
    ultimateParamInput.name = 'wpUltimateParam';
    ultimateParamInput.value = '1';
    form.appendChild(ultimateParamInput);
    document.body.appendChild(form);
    form.submit();
}
