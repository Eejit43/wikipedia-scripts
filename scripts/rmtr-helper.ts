import type { ApiQueryRevisionsParams } from 'types-mediawiki/api_params';
import type { PageRevisionsResult } from '../global-types';
import cssContent from '../styles/rmtr-helper.css' with { type: 'css' };
import { api } from '../utility';

mw.loader.using(['mediawiki.util'], () => {
    if (mw.config.get('wgPageName') !== 'Wikipedia:Requested_moves/Technical_requests') return;

    mw.util.addCSS(cssContent);

    const namespaces = mw.config.get('wgNamespaceIds');

    let displayed = false;

    const link = mw.util.addPortletLink(
        mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions',
        '#',
        'Review move requests',
        'review-rmtr-requests',
    )!;

    link.addEventListener('click', async (event) => {
        event.preventDefault();

        let shouldStopTabClosure = true;
        window.addEventListener('beforeunload', (event) => {
            if (shouldStopTabClosure) event.preventDefault();
        });

        if (displayed) return document.querySelector('#rmtr-review-result')?.scrollIntoView();
        else displayed = true;

        const pageRevision = await getPageRevision();

        const revId = pageRevision.revid;
        const pageContent = pageRevision.slots.main.content;

        const sections = [
            'Uncontroversial technical requests',
            'Requests to revert undiscussed moves',
            'Contested technical requests',
            'Administrator needed',
        ];

        const defaultMoveSection = sections[2];
        const fallbackDefaultMoveSection = sections[3];

        interface Request {
            sig: string;
            requester?: string;
            reason: string;
            full: string;
            original: string;
            destination: string;
            element: HTMLLIElement;
            result?: RequestResultMove | RequestResultRemove;
        }

        interface RequestResultMove {
            move: boolean;
            section: string;
            reason?: string;
        }

        interface RequestResultRemove {
            remove: boolean;
            reason: string;
        }

        const allRequests: Record<string, Request[]> = {};

        /**
         * Parses the parameters of a given Wikitext template.
         * @param template The template to parse.
         */
        function parseTemplateParameters(template: string) {
            const rawParameters: string[] = [];

            const ignoredStartSymbols = ['[', '{'];
            const ignoredEndSymbols = [']', '}'];

            let insideLinkOrTemplate = false;
            let currentText = '';

            for (let index = 0; index < template.length; index++) {
                const character = template[index];
                const nextCharacter: string | undefined = template[index + 1];

                if ((character === '|' && !insideLinkOrTemplate) || index === template.length - 1) {
                    if (character !== '|') currentText += character;

                    rawParameters.push(currentText);
                    currentText = '';

                    continue;
                }

                currentText += character;

                if (ignoredStartSymbols.some((symbol) => symbol === character && symbol === nextCharacter)) insideLinkOrTemplate = true;
                else if (ignoredEndSymbols.some((symbol) => symbol === character && symbol === nextCharacter)) insideLinkOrTemplate = false;
            }

            const parameters: Record<string, string | undefined> = {};

            for (const [index, parameter] of rawParameters.entries()) {
                const splitParameter = parameter.split('=').map((value) => value.trim());

                if (splitParameter.length === 1) splitParameter.unshift((index + 1).toString());

                parameters[splitParameter.shift()!] = splitParameter.join('=');
            }

            return parameters;
        }

        for (const section of sections) {
            const sectionContent = pageContent
                .split(new RegExp(`={3,} ?${section} ?={3,}`))[1]
                .split(/={3,}/m)[0]
                .trim();

            const matchedRequests = sectionContent.match(/(?:\* ?\n)?[ *:]*{{rmassist\/core.+?(?=[ *:]*{{rmassist\/core|$)/gis);

            if (matchedRequests)
                allRequests[section] = matchedRequests.map((request) => {
                    request = request.trim();

                    const parameters = parseTemplateParameters(
                        request.replaceAll(/(?:\* ?\n)?[ *:]*{{rmassist\/core\s*\||}}(?![^\n]*}}).*/gis, ''),
                    );

                    parameters.full = request;

                    parameters.original = parameters[1]?.replace(/^\[+/, '').replace(/]+$/, '') ?? 'UNKNOWN';
                    parameters.destination = parameters[2]?.replace(/^\[+/, '').replace(/]+$/, '') ?? 'UNKNOWN';

                    parameters.requester ??= parameters.sig?.match(/\[\[User:(.*?)(\||]])/)?.[1].trim();

                    delete parameters[1];
                    delete parameters[2];

                    return parameters as unknown as Request;
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

                        if (!mwOldTitle) return mw.notify(`Invalid title "${request.original}"!`, { type: 'error' });
                        if (!mwNewTitle) return mw.notify(`Invalid title "${request.destination}"!`, { type: 'error' });

                        const validTitle = !/[#<>[\]{|}]/.test(request.destination) && mwNewTitle;

                        const invalidTitleWarning = document.createElement('span');
                        invalidTitleWarning.classList.add('rmtr-review-invalid-warning');
                        invalidTitleWarning.textContent = `Invalid title "${request.destination}"!`;

                        const validNamespace = ![namespaces.file, namespaces.category].some(
                            (namespace) => mwOldTitle.getNamespaceId() === namespace || mwNewTitle.getNamespaceId() === namespace,
                        );

                        const invalidNamespaceWarning = document.createElement('span');
                        invalidNamespaceWarning.classList.add('rmtr-review-invalid-warning');
                        invalidNamespaceWarning.textContent = `Warning: original or destination page is in namespace "${mwNewTitle.getNamespaceId() === namespaces.file ? 'file' : 'category'}"!`;

                        const parsedWikitext = await api.parse(
                            `[[:${request.original}]] → ${validTitle ? `[[:${request.destination}]]` : invalidTitleWarning.outerHTML} requested by ${
                                request.requester
                                    ? mw.util.isIPAddress(request.requester)
                                        ? `[[Special:Contributions/${request.requester}|${request.requester}]]`
                                        : `[[User:${request.requester}|${request.requester}]]`
                                    : (/(\[{2}Special:Contributions\/(.*?)\|\2]{2})/.exec(request.sig)?.[1] ?? '(unknown)')
                            } with reasoning "${request.reason}"`,
                        );
                        const parsedHtml = new DOMParser().parseFromString(parsedWikitext, 'text/html');

                        const requestElement = document.createElement('li');
                        requestElement.innerHTML = parsedHtml.querySelector('div.mw-parser-output')!.firstElementChild!.innerHTML!;

                        if (!validNamespace) requestElement.append(invalidNamespaceWarning);

                        request.element = requestElement;
                    }),
                );
            }),
        );

        const outputElement = document.createElement('div');
        outputElement.id = 'rmtr-review-result';

        const header = document.createElement('div');
        header.id = 'rmtr-review-header';
        header.textContent = 'Technical move requests review';

        outputElement.append(header);

        for (const [sectionIndex, [section, requests]] of Object.entries(allRequests).entries()) {
            const sectionHeader = document.createElement('div');
            sectionHeader.classList.add('rmtr-review-header');
            sectionHeader.textContent = section;

            outputElement.append(sectionHeader);

            const sectionContent = document.createElement('div');
            sectionContent.classList.add('rmtr-review-section-content');

            if (requests.length === 0) {
                const noRequests = document.createElement('div');
                noRequests.textContent = 'No requests in this section';

                sectionContent.append(noRequests);
            } else {
                const requestsList = document.createElement('ul');

                for (const [requestIndex, request] of requests.entries()) {
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
                        } else {
                            delete allRequests[section][requestIndex].result;
                            removeRequestExtraInputs.style.display = 'none';
                            switchSectionCheckbox.disabled = false;
                        }
                    });

                    const removeRequestLabel = document.createElement('label');
                    removeRequestLabel.htmlFor = `rmtr-review-remove-request-${sectionIndex}-${requestIndex}`;
                    removeRequestLabel.textContent = 'Remove request';

                    requestElement.append(removeRequestCheckbox);
                    requestElement.append(removeRequestLabel);

                    const removeRequestExtraInputs = document.createElement('span');
                    removeRequestExtraInputs.style.display = 'none';

                    removeRequestExtraInputs.append(document.createTextNode(' as '));

                    const removeRequestDropdown = document.createElement('select');
                    if (section === 'Contested technical requests') removeRequestDropdown.value = 'Contested';
                    removeRequestDropdown.addEventListener('change', () => {
                        (allRequests[section][requestIndex].result as RequestResultRemove).reason = removeRequestDropdown.value;
                    });

                    const removeRequestDropdownOptions = [
                        'Completed',
                        'Contested',
                        'Already done',
                        'Invalid page name',
                        'Incorrect venue',
                        'Withdrawn',
                        'Stale',
                        'Not done',
                    ];

                    for (const option of removeRequestDropdownOptions) {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;

                        removeRequestDropdown.append(optionElement);
                    }

                    removeRequestExtraInputs.append(removeRequestDropdown);

                    requestElement.append(removeRequestExtraInputs);

                    const switchSectionCheckbox = document.createElement('input');
                    switchSectionCheckbox.type = 'checkbox';
                    switchSectionCheckbox.classList.add('rmtr-review-request-checkbox');
                    switchSectionCheckbox.id = `rmtr-review-move-request-${sectionIndex}-${requestIndex}`;
                    switchSectionCheckbox.addEventListener('change', () => {
                        if (switchSectionCheckbox.checked) {
                            (allRequests[section][requestIndex].result as RequestResultMove) = {
                                move: true,
                                section: switchSectionDropdown.value,
                            };
                            switchSectionExtraInputs.style.display = 'inline';
                            removeRequestCheckbox.disabled = true;
                        } else {
                            delete allRequests[section][requestIndex].result;
                            switchSectionExtraInputs.style.display = 'none';
                            removeRequestCheckbox.disabled = false;
                        }
                    });

                    const switchSectionLabel = document.createElement('label');
                    switchSectionLabel.htmlFor = `rmtr-review-move-request-${sectionIndex}-${requestIndex}`;
                    switchSectionLabel.textContent = 'Switch section';

                    requestElement.append(switchSectionCheckbox);
                    requestElement.append(switchSectionLabel);

                    const switchSectionExtraInputs = document.createElement('span');
                    switchSectionExtraInputs.style.display = 'none';

                    switchSectionExtraInputs.append(document.createTextNode(' to '));

                    const switchSectionDropdown = document.createElement('select');
                    switchSectionDropdown.addEventListener('change', () => {
                        (allRequests[section][requestIndex].result as RequestResultMove).section = switchSectionDropdown.value;
                    });

                    for (const option of sections) {
                        if (option === section) continue;

                        const optionElement = document.createElement('option');
                        optionElement.selected =
                            option === (section === defaultMoveSection ? fallbackDefaultMoveSection : defaultMoveSection);
                        optionElement.value = option;
                        optionElement.textContent = option;

                        switchSectionDropdown.append(optionElement);
                    }

                    switchSectionExtraInputs.append(switchSectionDropdown);

                    switchSectionExtraInputs.append(document.createTextNode(' with reasoning '));

                    const switchSectionReasoning = document.createElement('input');
                    switchSectionReasoning.type = 'text';
                    switchSectionReasoning.addEventListener('input', () => {
                        (allRequests[section][requestIndex].result as RequestResultRemove).reason = switchSectionReasoning.value;
                    });

                    switchSectionExtraInputs.append(switchSectionReasoning);

                    switchSectionExtraInputs.append(document.createTextNode(' (optional, automatically pings requestor and signs)'));

                    requestElement.append(switchSectionExtraInputs);

                    requestsList.append(requestElement);
                }

                sectionContent.append(requestsList);
            }

            outputElement.append(sectionContent);
        }

        const submitButton = document.createElement('button');
        submitButton.id = 'rmtr-review-submit';
        submitButton.textContent = 'Submit';
        submitButton.addEventListener('click', async () => {
            const newPageRevision = await getPageRevision();

            if (newPageRevision.revid !== revId) return mw.notify('An edit conflict occurred, please start over!', { type: 'error' });

            submitButton.disabled = true;
            loadingSpinner.style.display = 'inline-block';

            let endResult = pageContent;

            interface AllChanges {
                remove: Record<string, Request[]>;
                move: Record<string, Request[]>;
                total: number;
            }

            const changes: AllChanges = { remove: {}, move: {}, total: 0 };

            for (const section of Object.values(allRequests))
                for (const request of section) {
                    if (!request.result) continue;

                    if ('remove' in request.result) {
                        endResult = endResult.replace(request.full + '\n', '').replace(request.full, '');
                        if (!(request.result.reason in changes.remove)) changes.remove[request.result.reason] = [];
                        changes.remove[request.result.reason].push(request);
                        changes.total++;
                    } else if ('move' in request.result) {
                        const sectionTitleAfter = sections[sections.indexOf(request.result.section) + 1];

                        endResult = endResult.replace(request.full + '\n', '').replace(request.full, '');
                        endResult = endResult.replace(
                            new RegExp(`(\n?\n?(?:={3,} ?${sectionTitleAfter} ?={3,}|$))`),
                            `\n${request.full}${request.result.reason ? `\n:: ${request.requester && request.requester.length > 0 ? (mw.util.isIPAddress(request.requester) ? '' : `@[[User:${request.requester}|${request.requester}]] `) : ''} ${request.result.reason} ~~~~` : ''}$1`,
                        );
                        if (!(request.result.section in changes.move)) changes.move[request.result.section] = [];

                        changes.move[request.result.section].push(request);
                        changes.total++;
                    }
                }

            if (changes.total === 0) {
                submitButton.disabled = false;
                loadingSpinner.style.display = 'none';
                return mw.notify('No changes to make!', { type: 'error' });
            }

            const noRemaining = Object.values(allRequests).every((section) =>
                section.every((request) => request.result && 'remove' in request.result),
            );

            const editSummary = `Handled ${changes.total} request${changes.total > 1 ? 's' : ''}: ${
                Object.entries(changes.remove).length > 0
                    ? `Removed ${Object.entries(changes.remove)
                          .map(([reason, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(', ')} as ${reason.toLowerCase()}`)
                          .join(', ')}`
                    : ''
            }${
                Object.entries(changes.move).length > 0
                    ? `${Object.entries(changes.remove).length > 0 ? ', ' : ''}Moved ${Object.entries(changes.move)
                          .map(([destination, pages]) => `${pages.map((page) => `[[${page.original}]]`).join(', ')} to "${destination}"`)
                          .join(', ')}`
                    : ''
            }${noRemaining ? ' (no requests remain)' : ''} (via [[User:Eejit43/scripts/rmtr-helper|script]])`;

            await api.edit(mw.config.get('wgPageName'), () => ({ text: endResult, summary: editSummary }));

            mw.notify(`Successfully handled ${changes.total} requests, reloading...`, { type: 'success' });

            shouldStopTabClosure = false;

            window.location.reload();
        });

        const loadingSpinner = document.createElement('span');
        loadingSpinner.id = 'rmtr-review-loading';
        loadingSpinner.style.display = 'none';

        submitButton.append(loadingSpinner);

        outputElement.append(submitButton);

        mw.util.$content[0].prepend(outputElement);

        outputElement.scrollIntoView();
    });
});

/**
 * Gets information about a wiki page's latest revision.
 */
async function getPageRevision() {
    return (
        (await api.get({
            action: 'query',
            formatversion: '2',
            prop: 'revisions',
            rvprop: ['content', 'ids'],
            rvslots: 'main',
            titles: mw.config.get('wgPageName'),
        } satisfies ApiQueryRevisionsParams)) as PageRevisionsResult & { query: { pages: { revisions: { revid: number }[] }[] } }
    ).query.pages[0].revisions[0];
}
