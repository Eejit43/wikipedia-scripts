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
mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui.styles.icons-content', 'oojs-ui.styles.icons-editing-core'], () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    if (mw.config.get('wgNamespaceNumber') < 0)
        return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable'))
        return; // Don't run if user can't edit page
    if (mw.config.get('wgAction') !== 'view' || !mw.config.get('wgIsArticle'))
        return; // Don't run if not viewing page
    if (mw.util.getParamValue('oldid') || mw.config.get('wgDiffOldId'))
        return; // Don't run if viewing old revision or diff
    const contentText = document.getElementById('mw-content-text');
    if (!contentText)
        return mw.notify('Failed to find content text element!', { type: 'error' });
    const redirectTemplates = JSON.parse(((_f = (_e = (_d = (_c = (_b = (_a = (yield new mw.Api().get({ action: 'query', prop: 'revisions', formatversion: 2, titles: 'User:Eejit43/scripts/redirect-helper.json', rvprop: 'content', rvslots: '*' })).query.pages) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.revisions) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.slots) === null || _e === void 0 ? void 0 : _e.main) === null || _f === void 0 ? void 0 : _f.content) || '[]');
    const pageTitle = mw.config.get('wgPageName');
    const pageTitleParsed = mw.Title.newFromText(pageTitle);
    if (!pageTitleParsed)
        return mw.notify('Failed to parse page title!', { type: 'error' });
    const pageInfo = yield new mw.Api().get({ action: 'query', prop: 'info', formatversion: 2, titles: pageTitle });
    if (pageInfo.query.pages[0].missing) {
        const button = new OO.ui.ButtonWidget({ label: 'Create redirect', icon: 'articleRedirect', flags: ['progressive'] });
        button.$element[0].style.marginBottom = '10px';
        button.on('click', () => {
            contentText.removeChild(button.$element[0]);
            showRedirectInfo(false);
        });
        contentText.prepend(button.$element[0]);
    }
    else if (pageInfo.query.pages[0].redirect)
        showRedirectInfo(true);
    else {
        const portletLink = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Redirect page', 'redirect-helper');
        portletLink.addEventListener('click', (event) => {
            event.preventDefault();
            showRedirectInfo(false);
        });
    }
    /**
     * Shows the redirect information box
     * @param {boolean} exists Whether or not the page exists
     */
    function showRedirectInfo(exists) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __awaiter(this, void 0, void 0, function* () {
            const editorBox = new OO.ui.PanelLayout({ padded: true, expanded: false, framed: true });
            editorBox.$element[0].style.backgroundColor = '#95d4bc';
            editorBox.$element[0].style.width = '700px';
            editorBox.$element[0].style.maxWidth = 'calc(100% - 50px)';
            editorBox.$element[0].style.marginLeft = 'auto';
            editorBox.$element[0].style.marginRight = 'auto';
            editorBox.$element[0].style.marginBottom = '20px';
            let syncWithMainButton;
            if (pageTitleParsed.isTalkPage()) {
                const mainPageData = yield new mw.Api().get({ action: 'query', prop: 'info', formatversion: 2, titles: pageTitleParsed.getSubjectPage().getPrefixedText() });
                if (mainPageData.query.pages[0].redirect) {
                    const mainPageContent = (yield new mw.Api().get({ action: 'query', prop: 'revisions', formatversion: 2, titles: pageTitleParsed.getSubjectPage().getPrefixedText(), rvprop: 'content', rvslots: '*' })).query.pages[0].revisions[0].slots.main.content.trim();
                    syncWithMainButton = new OO.ui.ButtonWidget({ label: 'Sync with main page', icon: 'link', flags: ['progressive'] });
                    syncWithMainButton.on('click', () => {
                        var _a, _b, _c;
                        redirectInput.setValue(((_c = (_b = mw.Title.newFromText((_a = /^#REDIRECT:?\s*\[\[\s*([^|{}[\]]+?)\s*]]\s*/i.exec(mainPageContent)) === null || _a === void 0 ? void 0 : _a[1])) === null || _b === void 0 ? void 0 : _b.getTalkPage()) === null || _c === void 0 ? void 0 : _c.toString()) || '');
                        const fromMove = ['R from move', ...redirectTemplates['R from move']].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.substring(1)}\\s*(\\||}})`).test(mainPageContent));
                        if (fromMove)
                            tagSelect.setValue(['R from move']);
                    });
                }
            }
            /* Redirect target input */
            const RedirectInputWidget = function RedirectInputWidget(config) {
                OO.ui.TextInputWidget.call(this, config);
                OO.ui.mixin.LookupElement.call(this, config);
            };
            OO.inheritClass(RedirectInputWidget, OO.ui.TextInputWidget);
            OO.mixinClass(RedirectInputWidget, OO.ui.mixin.LookupElement);
            RedirectInputWidget.prototype.getLookupRequest = function () {
                var _a, _b;
                const value = this.getValue();
                const deferred = $.Deferred();
                if (!value)
                    deferred.resolve([]);
                else if (value.includes('#')) {
                    const title = value.split('#')[0];
                    new mw.Api()
                        .get({ action: 'parse', page: title, prop: 'sections', redirects: '1' })
                        .catch(() => null)
                        .then((result) => {
                        if (!result)
                            deferred.resolve([]);
                        else {
                            const matchedSections = result.parse.sections.filter((section) => section.line.toLowerCase().startsWith(value.split('#')[1].toLowerCase()));
                            deferred.resolve(matchedSections.map((section) => ({ data: `${result.parse.title}#${section.line}`, label: `${result.parse.title}#${section.line}` })));
                        }
                    });
                }
                else {
                    const parsedTitle = mw.Title.newFromText(value);
                    new mw.Api()
                        .get({ action: 'query', generator: 'allpages', gapprefix: (_a = parsedTitle === null || parsedTitle === void 0 ? void 0 : parsedTitle.title) !== null && _a !== void 0 ? _a : value, gapnamespace: (_b = parsedTitle === null || parsedTitle === void 0 ? void 0 : parsedTitle.namespace) !== null && _b !== void 0 ? _b : 'e', gaplimit: 20, prop: 'info|pageprops' })
                        .catch(() => null)
                        .then((result) => {
                        var _a;
                        if (!result)
                            deferred.resolve([]);
                        else {
                            deferred.resolve(((_a = result.query) === null || _a === void 0 ? void 0 : _a.pages)
                                ? Object.values(result.query.pages)
                                    .filter((page) => page.title !== pageTitleParsed.toString())
                                    .map((page) => ({ data: page.title, label: new OO.ui.HtmlSnippet(`${page.title}${page.pageprops && 'disambiguation' in page.pageprops ? ' <i>(disambiguation)</i>' : ''}${'redirect' in page ? ' <i>(redirect)</i>' : ''}`) }))
                                : [] // prettier-ignore
                            );
                        }
                    });
                }
                return deferred.promise({ abort() { } }); // eslint-disable-line no-empty-function
            };
            RedirectInputWidget.prototype.getLookupCacheDataFromResponse = (response) => response || [];
            RedirectInputWidget.prototype.getLookupMenuOptionsFromData = (data) => data.map((item) => new OO.ui.MenuOptionWidget({ data: item.data, label: item.label }));
            const redirectInput = new RedirectInputWidget({ placeholder: 'Target page name', required: true });
            redirectInput.on('change', () => {
                let value = redirectInput.getValue();
                value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
                value = value.replace(/^:/, '');
                if (value.length > 0) {
                    redirectInput.setValue(value[0].toUpperCase() + value.slice(1).replace(/_/g, ' '));
                    submitButton.setDisabled(false);
                }
                else
                    submitButton.setDisabled(true);
                updateSummary();
                submitButton.setLabel('Submit');
                needsCheck = true;
            });
            const redirectInputLayout = new OO.ui.FieldLayout(redirectInput, { label: new OO.ui.HtmlSnippet('<b>Redirect target:</b>'), align: 'top' });
            /* Redirect categorization template selection */
            const tagSelect = new OO.ui.MenuTagMultiselectWidget({
                allowArbitrary: false,
                verticalPosition: 'below',
                allowReordering: false,
                options: Object.keys(redirectTemplates).map((tag) => ({ data: tag, label: tag }))
            });
            tagSelect.getMenu().filterMode = 'substring';
            tagSelect.on('change', () => {
                const sortedTags = tagSelect.getValue().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
                if (tagSelect.getValue().join(';') !== sortedTags.join(';'))
                    tagSelect.setValue(sortedTags);
                updateSummary();
                submitButton.setLabel('Submit');
                needsCheck = true;
            });
            const tagSelectLayout = new OO.ui.FieldLayout(tagSelect, { label: new OO.ui.HtmlSnippet('<b>Redirect categorization template(s):</b>'), align: 'top' });
            /* Summary input */
            const summaryInput = new OO.ui.ComboBoxInputWidget({
                options: [
                    { data: 'Resolve double redirect' },
                    { data: 'Resolve self redirect' },
                    { data: 'Remove incorrect rcats' }
                ]
            });
            const summaryInputLayout = new OO.ui.FieldLayout(summaryInput, { label: new OO.ui.HtmlSnippet('<b>Summary:</b>'), align: 'top' });
            /* Submit button */
            const submitButton = new OO.ui.ButtonWidget({ label: 'Submit', disabled: true, flags: ['progressive'] });
            submitButton.$element[0].style.marginBottom = '0';
            let needsCheck = true;
            submitButton.on('click', () => __awaiter(this, void 0, void 0, function* () {
                var _j, _k, _l, _m, _o, _p;
                [redirectInput, tagSelect, summaryInput, submitButton, syncTalkCheckbox, patrolCheckbox].filter(Boolean).forEach((element) => element.setDisabled(true));
                submitButton.setLabel('Checking target validity...');
                let parsedDestination;
                const errors = [];
                /* Title validation */
                if (needsCheck) {
                    const destination = redirectInput.getValue().trim();
                    /* Invalid characters */
                    if (!/^\s*[^|{}[\]]+\s*$/.exec(destination))
                        errors.push({ title: destination, message: 'is not a valid page title!' });
                    /* Failed during title parsing */
                    try {
                        parsedDestination = mw.Title.newFromText(destination);
                    }
                    catch (_q) {
                        if (errors.length === 0)
                            errors.push({ title: destination, message: 'is not a valid page title!' });
                    }
                    if (!parsedDestination && errors.length === 0)
                        errors.push({ title: destination, message: 'is not a valid page title!' });
                    /* Self redirects */
                    if (parsedDestination.toString() === pageTitleParsed.toString())
                        errors.push({ message: 'cannot redirect to itself!' });
                    const destinationData = yield new mw.Api().get({ action: 'query', titles: destination, prop: 'pageprops', formatversion: 2 }).catch((_, data) => {
                        /* Non-existent destination */ if (data.error.code === 'missingtitle')
                            errors.push({ title: destination, message: 'does not exist!' });
                        /* Other API error */ else
                            errors.push({ title: destination, message: 'was not able to be fetched from the API!' });
                        return null;
                    });
                    const destinationParseResult = yield new mw.Api().get({ action: 'parse', page: destination, prop: 'sections', redirects: '1' });
                    /* Double redirects */
                    if ((_j = destinationParseResult.parse.redirects) === null || _j === void 0 ? void 0 : _j[0]) {
                        const destinationRedirect = destinationParseResult.parse.redirects[0].to + (destinationParseResult.parse.redirects[0].tofragment ? `#${destinationParseResult.parse.redirects[0].tofragment}` : '');
                        errors.push({ title: destination, message: `is a redirect to <a href="${mw.util.getUrl(destinationRedirect)}" target="_blank">${destinationRedirect}</a>. Retarget to that page instead, as double redirects aren't allowed.` });
                    }
                    /* Non-existent section */
                    if (destination.split('#').length > 1) {
                        const validSection = destinationParseResult.parse.sections.find((section) => section.line === destination.split('#')[1]);
                        if (validSection) {
                            if (tagSelect.getValue().includes('R to anchor'))
                                errors.push({ message: 'is tagged as a redirect to an anchor, but it is actually a redirect to a section!' });
                            if (!tagSelect.getValue().includes('R to section'))
                                errors.push({ message: 'is a redirect to a section, but it is not tagged with <code>{{R to section}}</code>!' });
                        }
                        else {
                            const destinationContent = (yield new mw.Api().get({ action: 'query', prop: 'revisions', formatversion: 2, titles: parsedDestination.toString(), rvprop: 'content', rvslots: '*' })).query.pages[0].revisions[0].slots.main.content;
                            const anchors = [
                                ...(((_l = (_k = destinationContent
                                    .match(/(?<={{\s*?[aA](?:nchors?|nchor for redirect|nker|NCHOR|nc)\s*?\|).+?(?=}})/g)) === null || _k === void 0 ? void 0 : _k.map((anchor) => anchor.split('|').map((part) => part.trim()))) === null || _l === void 0 ? void 0 : _l.flat()) || []),
                                ...(((_o = (_m = destinationContent
                                    .match(/(?<={{\s*?(?:[vV](?:isible anchors?|isanc|Anch|anchor|isibleanchor|a)|[aA](?:nchord|chored|nchor\+)|[tT]ext anchor)\s*?\|).+?(?=(?<!!|=)}})/g)) === null || _m === void 0 ? void 0 : _m.map((anchor) => anchor
                                    .split('|')
                                    .map((part) => part.trim())
                                    .filter((part) => !/^text\s*?=/.exec(part)))) === null || _o === void 0 ? void 0 : _o.flat()) || []),
                                ...(((_p = destinationContent.match(/(?<=id=)"?.+?(?="|>|\|)/g)) === null || _p === void 0 ? void 0 : _p.map((anchor) => anchor.trim())) || [])
                            ];
                            if (!anchors.includes(destination.split('#')[1]))
                                errors.push({ message: `is a redirect to <a href="${mw.util.getUrl(destination)}" target="_blank">${destination}</a>, but that section or anchor does not exist!` });
                            else {
                                if (tagSelect.getValue().includes('R to section'))
                                    errors.push({ message: 'is tagged as a redirect to a section, but it is actually a redirect to an anchor!' });
                                if (!tagSelect.getValue().includes('R to anchor'))
                                    errors.push({ message: 'is a redirect to an anchor, but it is not tagged with <code>{{R from anchor}}</code>!' });
                            }
                        }
                    }
                    /* Improperly tagged as redirect to section/anchor */
                    if (destination.split('#').length === 1 && (tagSelect.getValue().includes('R to section') || tagSelect.getValue().includes('R to anchor')))
                        errors.push({ message: 'is not a redirect to a section/anchor, but it is tagged with <code>{{R from section}}</code> or <code>{{R from anchor}}</code>!' });
                    /* Redirect to disambiguation page without template */
                    if ('disambiguation' in destinationData.query.pages[0].pageprops && !['R from ambiguous sort name', 'R from ambiguous term', 'R to disambiguation page', 'R from incomplete disambiguation', 'R from incorrect disambiguation', 'R from other disambiguation'].some((template) => tagSelect.getValue().includes(template)))
                        errors.push({ message: 'is a redirect to a disambiguation page, but it is not tagged with a disambiguation categorization template!' });
                    /* Improperly tagged as redirect to disambiguation page */
                    if (!('disambiguation' in destinationData.query.pages[0].pageprops) && ['R from ambiguous sort name', 'R from ambiguous term', 'R to disambiguation page', 'R from incomplete disambiguation', 'R from incorrect disambiguation', 'R from other disambiguation'].some((template) => tagSelect.getValue().includes(template)))
                        errors.push({ message: 'is not a redirect to a disambiguation page, but it is tagged with a disambiguation categorization template!' });
                    /* {{R to disambiguation page}} without " (disambiguation)" at end of title */
                    if (tagSelect.getValue().includes('R to disambiguation page') && !/ \(disambiguation\)$/.exec(pageTitleParsed.getMainText()))
                        errors.push({ message: 'is tagged with <code>{{R to disambiguation page}}</code>, but this title does not end with " (disambiguation)". Use <code>{{R from ambiguous term}}</code> or a similar categorization template instead!' });
                    /* Syncing talk page but talk page exists and isn't a redirect */
                    if ((syncTalkCheckbox === null || syncTalkCheckbox === void 0 ? void 0 : syncTalkCheckbox.isSelected()) && !talkData.query.pages[0].missing && !talkData.query.pages[0].redirect)
                        errors.push({ title: pageTitleParsed.getTalkPage().getPrefixedText(), message: 'exists, but is not a redirect!' });
                }
                if (errors.length > 0) {
                    document.querySelectorAll('.redirect-helper-warning').forEach((element) => element.remove());
                    errors.forEach(({ title, message }) => {
                        const label = new OO.ui.HtmlSnippet(`${title ? `<a href="${mw.util.getUrl(title)}" target="_blank">${title}</a>` : 'This page'} ${message} Click again without making changes to submit anyway.`);
                        const warningMessage = new OO.ui.MessageWidget({ type: 'error', classes: ['redirect-helper-warning'], inline: true, label });
                        warningMessage.$element[0].style.marginTop = '8px';
                        editorBox.$element[0].append(warningMessage.$element[0]);
                    });
                    [redirectInput, tagSelect, summaryInput, submitButton, syncTalkCheckbox, patrolCheckbox].filter(Boolean).forEach((element) => element.setDisabled(false));
                    submitButton.setLabel('Submit anyway');
                    needsCheck = false;
                    return;
                }
                parsedDestination = mw.Title.newFromText(redirectInput.getValue());
                /* Edit/create redirect */
                submitButton.setLabel(`${exists ? 'Editing' : 'Creating'} redirect...`);
                const output = [
                    `#REDIRECT [[${redirectInput.getValue().trim()}]]`,
                    tagSelect.getValue().length > 0
                        ? `{{Redirect category shell|\n${tagSelect
                            .getValue()
                            .map((tag) => `{{${tag}${(oldRedirectTagData === null || oldRedirectTagData === void 0 ? void 0 : oldRedirectTagData[tag]) ? `|${oldRedirectTagData[tag]}` : ''}}}`)
                            .join('\n')}\n}}`
                        : null,
                    oldStrayText
                ]
                    .filter(Boolean)
                    .join('\n\n');
                const summary = (summaryInput.getValue() || summaryInput.$tabIndexed[0].placeholder) + ' (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])';
                const result = yield new mw.Api()
                    .edit(pageTitle, () => ({ text: output, summary }))
                    .catch((error, data) => {
                    if (error === 'nocreate-missing')
                        return new mw.Api().create(pageTitle, { summary }, output).catch((error, data) => {
                            console.error(error);
                            mw.notify(`Error creating ${pageTitle}: ${data.error.info} (${error})`, { type: 'error' });
                        });
                    else {
                        console.error(error);
                        mw.notify(`Error editing or creating ${pageTitle}: ${data.error.info} (${error})`, { type: 'error' });
                        return null;
                    }
                });
                if (!result)
                    return;
                mw.notify(`Redirect ${exists ? 'edited' : 'created'} successfully!`, { type: 'success' });
                /* Sync talk page checkbox handler */
                if (syncTalkCheckbox === null || syncTalkCheckbox === void 0 ? void 0 : syncTalkCheckbox.isSelected()) {
                    submitButton.setLabel('Editing talk page...');
                    const fromMove = tagSelect.getValue().includes('R from move');
                    const output = [
                        `#REDIRECT [[${parsedDestination.getTalkPage().getPrefixedText()}]]`,
                        fromMove ? '{{Redirect category shell|\n{{R from move}}\n}}' : null
                    ]
                        .filter(Boolean)
                        .join('\n\n');
                    const talkPage = pageTitleParsed.getTalkPage().getPrefixedText();
                    const talkResult = yield new mw.Api()
                        .edit(talkPage, () => ({ text: output, summary: 'Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])' }))
                        .catch((error, data) => {
                        if (error === 'nocreate-missing')
                            return new mw.Api().create(talkPage, { summary: 'Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])' }, output).catch((error, data) => {
                                console.error(error);
                                mw.notify(`Error creating ${talkPage}: ${data.error.info} (${error})`, { type: 'error' });
                            });
                        else {
                            console.error(error);
                            mw.notify(`Error editing or creating ${talkPage}: ${data.error.info} (${error})`, { type: 'error' });
                            return null;
                        }
                    });
                    if (!talkResult)
                        return;
                    mw.notify('Talk page synced successfully!', { type: 'success' });
                }
                /* Patrol checkbox handler */
                if (patrolCheckbox === null || patrolCheckbox === void 0 ? void 0 : patrolCheckbox.isSelected()) {
                    submitButton.setLabel('Patrolling redirect...');
                    if (document.querySelector('.patrollink a')) {
                        const patrolResult = yield new mw.Api().postWithToken('patrol', { action: 'patrol', rcid: new URL(document.querySelector('.patrollink a').href).searchParams.get('rcid') }).catch((error, data) => {
                            console.error(error);
                            mw.notify(`Error patrolling ${pageTitle} via API: ${data.error.info} (${error})`, { type: 'error' });
                            return null;
                        });
                        if (patrolResult)
                            mw.notify('Redirect patrolled successfully!', { type: 'success' });
                    }
                    else if (!document.getElementById('mwe-pt-mark-as-reviewed-button'))
                        mw.notify('Page curation toolbar not found, redirect cannot be patrolled!', { type: 'error' });
                    else {
                        document.getElementById('mwe-pt-mark-as-reviewed-button').click();
                        mw.notify('Redirect patrolled successfully!', { type: 'success' });
                    }
                }
                submitButton.setLabel('Complete, reloading...');
                window.location.href = mw.util.getUrl(pageTitle, { redirect: 'no' });
            }));
            let talkData;
            let syncTalkCheckbox, syncTalkLayout;
            if (!pageTitleParsed.isTalkPage()) {
                talkData = yield new mw.Api().get({ action: 'query', titles: pageTitleParsed.getTalkPage().getPrefixedText(), prop: 'info', formatversion: 2 });
                syncTalkCheckbox = new OO.ui.CheckboxInputWidget({ selected: !!talkData.query.pages[0].redirect });
                syncTalkLayout = new OO.ui.Widget({ content: [new OO.ui.FieldLayout(syncTalkCheckbox, { label: 'Sync talk page', align: 'inline' })] });
                syncTalkLayout.$element[0].style.marginBottom = '0';
            }
            let shouldPromptPatrol;
            if (mw.config.get('wgNamespaceNumber') !== 0)
                shouldPromptPatrol = false;
            else if (document.querySelector('.patrollink'))
                shouldPromptPatrol = true;
            else if (document.getElementById('mwe-pt-mark-as-reviewed-button'))
                shouldPromptPatrol = true;
            else if (document.getElementById('mwe-pt-mark-as-unreviewed-button'))
                shouldPromptPatrol = false;
            else {
                if (!mw.config.get('wgArticleId'))
                    shouldPromptPatrol = false;
                const userPermissions = yield new mw.Api().get({ action: 'query', meta: 'userinfo', uiprop: 'rights' });
                if (!userPermissions.query.userinfo.rights.includes('patrol'))
                    shouldPromptPatrol = false;
                const patrolResponse = yield new mw.Api().get({ action: 'pagetriagelist', page_id: mw.config.get('wgArticleId') }); // eslint-disable-line camelcase
                if (((_a = patrolResponse.pagetriagelist.pages[0]) === null || _a === void 0 ? void 0 : _a.user_name) === mw.config.get('wgUserName'))
                    shouldPromptPatrol = false;
                else if (patrolResponse.pagetriagelist.result !== 'success' || patrolResponse.pagetriagelist.pages.length === 0)
                    shouldPromptPatrol = false;
                else
                    shouldPromptPatrol = !parseInt((_b = patrolResponse.pagetriagelist.pages[0]) === null || _b === void 0 ? void 0 : _b.patrol_status);
            }
            let patrolCheckbox, patrolLayout;
            if (shouldPromptPatrol) {
                patrolCheckbox = new OO.ui.CheckboxInputWidget({ selected: true });
                patrolLayout = new OO.ui.Widget({ content: [new OO.ui.FieldLayout(patrolCheckbox, { label: 'Mark as patrolled', align: 'inline' })] });
                patrolLayout.$element[0].style.marginBottom = '0';
            }
            const submitLayout = new OO.ui.HorizontalLayout({ items: [submitButton, syncTalkLayout, patrolLayout].filter(Boolean) });
            submitLayout.$element[0].style.marginTop = '10px';
            /* Add elements to screen */
            editorBox.$element[0].append(...[(_c = syncWithMainButton === null || syncWithMainButton === void 0 ? void 0 : syncWithMainButton.$element) === null || _c === void 0 ? void 0 : _c[0], redirectInputLayout.$element[0], tagSelectLayout.$element[0], summaryInputLayout.$element[0], submitLayout.$element[0]].filter(Boolean));
            contentText.prepend(editorBox.$element[0]);
            /**
             * Updates the summary input placeholder
             */
            function updateSummary() {
                const redirectValue = redirectInput.getValue().trim();
                if (!redirectValue)
                    summaryInput.$tabIndexed[0].placeholder = '';
                else if (!exists)
                    summaryInput.$tabIndexed[0].placeholder = `Creating redirect to [[${redirectValue}]]`;
                else {
                    const targetChanged = redirectValue !== oldRedirectTarget;
                    const tagsChanged = tagSelect.getValue().join(';') !== oldRedirectTags.join(';');
                    if (targetChanged && tagsChanged)
                        summaryInput.$tabIndexed[0].placeholder = `Changing redirect to [[${redirectValue}]] and changing categorization templates`;
                    else if (targetChanged)
                        summaryInput.$tabIndexed[0].placeholder = `Changing redirect to [[${redirectValue}]]`;
                    else if (tagsChanged)
                        summaryInput.$tabIndexed[0].placeholder = 'Changing categorization templates';
                    else
                        summaryInput.$tabIndexed[0].placeholder = 'Redirect cleanup';
                }
            }
            /* Load current target and tags, if applicable */
            let oldRedirectTarget, oldRedirectTags, oldRedirectTagData, oldStrayText;
            if (exists) {
                const pageContent = (yield new mw.Api().get({ action: 'query', prop: 'revisions', formatversion: 2, titles: pageTitle, rvprop: 'content', rvslots: '*' })).query.pages[0].revisions[0].slots.main.content.trim();
                oldRedirectTarget = (_d = /^#REDIRECT:?\s*\[\[\s*([^|{}[\]]+?)\s*(?:\|[^|{}[\]]+?)?]]\s*/i.exec(pageContent)) === null || _d === void 0 ? void 0 : _d[1];
                oldRedirectTags = Object.entries(redirectTemplates)
                    .map(([tag, redirects]) => ([tag, ...redirects].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.substring(1)}\\s*(\\||}})`).test(pageContent)) ? tag : null))
                    .filter(Boolean)
                    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
                oldRedirectTagData = Object.fromEntries(oldRedirectTags
                    .map((tag) => {
                    const match = new RegExp(`{{\\s*(?:${[tag, ...redirectTemplates[tag]].map((tag) => `[${tag[0].toLowerCase()}${tag[0]}]${tag.substring(1)}`).join('|')})\\|?(.*?)\\s*}}`).exec(pageContent);
                    return match ? [tag, match[1]] : null;
                })
                    .filter(Boolean));
                oldStrayText = [(_e = pageContent.match(/{{Short description\|.*?}}/i)) === null || _e === void 0 ? void 0 : _e[0], (_f = pageContent.match(/{{DISPLAYTITLE:.*?}}/)) === null || _f === void 0 ? void 0 : _f[0], (_g = pageContent.match(/{{italic title\|?.*?}}/i)) === null || _g === void 0 ? void 0 : _g[0], (_h = pageContent.match(/{{DEFAULTSORT:.*?}}/)) === null || _h === void 0 ? void 0 : _h[0]].filter(Boolean).join('\n');
                if (oldRedirectTarget)
                    redirectInput.setValue(oldRedirectTarget.replaceAll('_', ' '));
                else
                    mw.notify('Could not find redirect target!', { type: 'error' });
                tagSelect.setValue(oldRedirectTags);
            }
        });
    }
}));
