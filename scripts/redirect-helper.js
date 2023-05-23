/* global mw, OO, $ */

mw.loader.using(['oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui.styles.icons-content'], async () => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page
    if (mw.config.get('wgAction') !== 'view' || !mw.config.get('wgIsArticle')) return; // Don't run if not viewing page
    if (mw.util.getParamValue('oldid')) return; // Don't run if viewing old revision

    const contentText = document.getElementById('mw-content-text');

    const redirectTemplates = JSON.parse((await new mw.Api().get({ action: 'query', prop: 'revisions', formatversion: 2, titles: 'User:Eejit43/scripts/redirect-helper.json', rvprop: 'content', rvslots: '*' })).query.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '[]');

    const pageTitle = mw.config.get('wgPageName');
    const pageTitleParsed = mw.Title.newFromText(pageTitle);

    const pageInfo = await new mw.Api().get({ action: 'query', prop: 'info', formatversion: 2, titles: pageTitle });

    if (pageInfo.query.pages[0].missing) promptCreation();
    else if (pageInfo.query.pages[0].redirect) showRedirectInfo(true);

    /**
     * Prompts the creation of a redirect if a page doesn't exist
     */
    function promptCreation() {
        const button = new OO.ui.ButtonWidget({ label: 'Create redirect', icon: 'articleRedirect', flags: ['progressive'] });
        button.$element[0].style.marginBottom = '10px';
        button.on('click', () => {
            contentText.removeChild(button.$element[0]);
            showRedirectInfo(false);
        });

        contentText.prepend(button.$element[0]);
    }

    /**
     * Shows the redirect information box
     * @param {boolean} exists Whether or not the page exists
     */
    async function showRedirectInfo(exists) {
        const editorBox = new OO.ui.PanelLayout({ padded: true, expanded: false, framed: true });
        editorBox.$element[0].style.backgroundColor = '#95d4bc';
        editorBox.$element[0].style.width = '700px';
        editorBox.$element[0].style.maxWidth = 'calc(100% - 50px)';
        editorBox.$element[0].style.margin = '0 auto 20px';

        /* Redirect target input */
        const RedirectInputWidget = function RedirectInputWidget(config) {
            OO.ui.TextInputWidget.call(this, config);
            OO.ui.mixin.LookupElement.call(this, config);
        };
        OO.inheritClass(RedirectInputWidget, OO.ui.TextInputWidget);
        OO.mixinClass(RedirectInputWidget, OO.ui.mixin.LookupElement);

        RedirectInputWidget.prototype.getLookupRequest = function () {
            const value = this.getValue();
            const deferred = $.Deferred();

            if (!value) deferred.resolve([]);
            else if (value.includes('#')) {
                const title = value.split('#')[0];

                new mw.Api()
                    .get({ action: 'parse', page: title, prop: 'sections', redirects: '1' })
                    .catch(() => null)
                    .then((result) => {
                        if (!result) deferred.resolve([]);
                        else {
                            const matchedSections = result.parse.sections.filter((section) => section.line.toLowerCase().startsWith(value.split('#')[1].toLowerCase()));
                            deferred.resolve(matchedSections.map((section) => ({ data: `${result.parse.title}#${section.line}`, label: `${result.parse.title}#${section.line}` })));
                        }
                    });
            } else {
                const parsedTitle = mw.Title.newFromText(value);
                new mw.Api()
                    .get({ action: 'query', generator: 'allpages', gapprefix: parsedTitle?.title ?? value, gapnamespace: parsedTitle?.namespace ?? 'e', gaplimit: 20, prop: 'info|pageprops' })
                    .catch(() => null)
                    .then((result) => {
                        if (!result) deferred.resolve([]);
                        else {
                            deferred.resolve(
                                result.query?.pages
                                    ? Object.values(result.query.pages)
                                        .filter((page) => page.title !== pageTitleParsed.toString())
                                        .map((page) => ({ data: page.title, label: new OO.ui.HtmlSnippet(`${page.title}${page.pageprops && 'disambiguation' in page.pageprops ? ' <i>(disambiguation)</i>' : ''}${'redirect' in page ? ' <i>(redirect)</i>' : ''}`) }))
                                    : [] // prettier-ignore
                            );
                        }
                    });
            }

            return deferred.promise({ abort() {} }); // eslint-disable-line no-empty-function
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
            } else submitButton.setDisabled(true);

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

            if (tagSelect.getValue().join(';') !== sortedTags.join(';')) tagSelect.setValue(sortedTags);

            updateSummary();
            submitButton.setLabel('Submit');
            needsCheck = true;
        });

        const tagSelectLayout = new OO.ui.FieldLayout(tagSelect, { label: new OO.ui.HtmlSnippet('<b>Redirect categorization template(s):</b>'), align: 'top' });

        /* Summary input */
        const summaryInput = new OO.ui.ComboBoxInputWidget({
            options: [
                { data: 'Resolve double redirect' }, //
                { data: 'Resolve self redirect' },
                { data: 'Remove incorrect rcats' }
            ]
        });

        const summaryInputLayout = new OO.ui.FieldLayout(summaryInput, { label: new OO.ui.HtmlSnippet('<b>Summary:</b>'), align: 'top' });

        /* Submit button */
        const submitButton = new OO.ui.ButtonWidget({ label: 'Submit', disabled: true, flags: ['progressive'] });
        submitButton.$element[0].style.marginBottom = '0';

        let needsCheck = true;
        submitButton.on('click', async () => {
            [redirectInput, tagSelect, summaryInput, submitButton, syncTalkCheckbox, patrolCheckbox].filter(Boolean).forEach((element) => element.setDisabled(true));
            submitButton.setLabel('Checking target validity...');

            let parsedDestination;

            /* Title validation */
            if (needsCheck) {
                const destination = redirectInput.getValue().trim();
                const destinationData = await new mw.Api().get({ action: 'query', titles: destination, prop: 'pageprops', formatversion: 2 }).catch((_, data) => {
                    /* Non-existent destination */ if (data.error.code === 'missingtitle') promptError(destination, 'does not exist!');
                    /* Other API error */ else promptError(destination, 'was not able to be fetched from the API!');
                    return null;
                });
                const destinationParseResult = await new mw.Api().get({ action: 'parse', page: destination, prop: 'sections', redirects: '1' });

                /* Invalid characters */
                if (!/^\s*[^|{}[\]]+\s*$/.exec(destination)) return promptError(destination, 'is not a valid page title!');

                /* Failed during title parsing */
                try {
                    parsedDestination = new mw.Title(destination);
                } catch {
                    return promptError(destination, 'is not a valid page title!');
                }
                if (!parsedDestination) return promptError(destination, 'is not a valid page title!');

                /* Self redirects */
                if (parsedDestination.toString() === pageTitleParsed.toString()) return promptError(null, 'cannot redirect to itself!');

                /* Double redirects */
                if (destinationParseResult.parse.redirects?.[0]) {
                    const destinationRedirect = destinationParseResult.parse.redirects[0].to + (destinationParseResult.parse.redirects[0].tofragment ? `#${destinationParseResult.parse.redirects[0].tofragment}` : '');
                    return promptError(destination, `is a redirect to <a href="${mw.util.getUrl(destinationRedirect)}" target="_blank">${destinationRedirect}</a>. Retarget to that page instead, as double redirects aren't allowed.`);
                }

                /* Non-existent section */
                if (destination.split('#').length > 1) {
                    const validSection = destinationParseResult.parse.sections.find((section) => section.line === destination.split('#')[1]);
                    if (!validSection) return promptError(null, `is a redirect to <a href="${mw.util.getUrl(destination)}" target="_blank">${destination}</a>, but that section does not exist!`);
                }

                /* Redirect to section/anchor without template */
                if (destination.split('#').length > 1 && !tagSelect.getValue().includes('R to section') && !tagSelect.getValue().includes('R to anchor')) return promptError(null, 'is a redirect to a section/anchor, but it is not tagged with <code>{{R from section}}</code> or <code>{{R from anchor}}</code>!');

                /* Improperly tagged as redirect to section/anchor */
                if (destination.split('#').length === 1 && (tagSelect.getValue().includes('R to section') || tagSelect.getValue().includes('R to anchor'))) return promptError(null, 'is not a redirect to a section/anchor, but it is tagged with <code>{{R from section}}</code> or <code>{{R from anchor}}</code>!');

                /* Redirect to disambiguation page without template */
                if ('disambiguation' in destinationData.query.pages[0].pageprops && !['R from ambiguous sort name', 'R from ambiguous term', 'R to disambiguation page', 'R from incomplete disambiguation', 'R from incorrect disambiguation', 'R from other disambiguation'].some((template) => tagSelect.getValue().includes(template))) return promptError(null, 'is a redirect to a disambiguation page, but it is not tagged with a disambiguation categorization template!');

                /* Improperly tagged as redirect to disambiguation page */
                if (!('disambiguation' in destinationData.query.pages[0].pageprops) && ['R from ambiguous sort name', 'R from ambiguous term', 'R to disambiguation page', 'R from incomplete disambiguation', 'R from incorrect disambiguation', 'R from other disambiguation'].some((template) => tagSelect.getValue().includes(template))) return promptError(null, 'is not a redirect to a disambiguation page, but it is tagged with a disambiguation categorization template!');

                /* {{R to disambiguation page}} without " (disambiguation)" at end of title */
                if (tagSelect.getValue().includes('R to disambiguation page') && !/ \(disambiguation\)$/.exec(pageTitleParsed.getMainText())) return promptError(null, 'is tagged with <code>{{R to disambiguation page}}</code>, but this title does not end with " (disambiguation)". Use <code>{{R from ambiguous term}}</code> or a similar categorization template instead!');

                /* Syncing talk page but talk page exists and isn't a redirect */
                if (syncTalkCheckbox?.isSelected() && !talkData.query.pages[0].missing && !talkData.query.pages[0].redirect) return promptError(pageTitleParsed.getTalkPage().getPrefixedText(), 'exists, but is not a redirect!');
            }

            /* Edit/create redirect */
            submitButton.setLabel(`${exists ? 'Editing' : 'Creating'} redirect...`);

            const output = [
                `#REDIRECT [[${redirectInput.getValue().trim()}]]`, //
                tagSelect.getValue().length > 0
                    ? `{{Redirect category shell|\n${tagSelect 
                        .getValue()
                        .map((tag) => `{{${tag}${oldRedirectTagData?.[tag] ? `|${oldRedirectTagData[tag]}` : ''}}}`)
                        .join('\n')}\n}}`
                    : null, // prettier-ignore
                oldStrayText
            ]
                .filter(Boolean)
                .join('\n\n');

            const summary = (summaryInput.getValue() || summaryInput.$tabIndexed[0].placeholder) + ' (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])';

            const result = await new mw.Api()
                .edit(pageTitle, () => ({ text: output, summary }))
                .catch((error, data) => {
                    if (error === 'nocreate-missing')
                        return new mw.Api().create(pageTitle, { summary }, output).catch((error, data) => {
                            console.error(error); // eslint-disable-line no-console
                            mw.notify(`Error creating ${pageTitle}: ${data.error.info} (${error})`, { type: 'error' });
                        });
                    else {
                        console.error(error); // eslint-disable-line no-console
                        mw.notify(`Error editing or creating ${pageTitle}: ${data.error.info} (${error})`, { type: 'error' });
                        return false;
                    }
                });

            if (!result) return;

            mw.notify(`Redirect ${exists ? 'edited' : 'created'} successfully!`, { type: 'success' });

            /* Sync talk page checkbox handler */
            if (syncTalkCheckbox?.isSelected()) {
                submitButton.setLabel('Editing talk page...');

                const fromMove = tagSelect.getValue().includes('R from move');

                const output = [
                    `#REDIRECT [[${parsedDestination.getTalkPage().getPrefixedText()}]]`, //
                    fromMove ? '{{Redirect category shell|\n{{R from move}}\n}}' : null
                ]
                    .filter(Boolean)
                    .join('\n\n');

                const talkPage = pageTitleParsed.getTalkPage().getPrefixedText();

                const talkResult = await new mw.Api()
                    .edit(talkPage, () => ({ text: output, summary: 'Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])' }))
                    .catch((error, data) => {
                        if (error === 'nocreate-missing')
                            return new mw.Api().create(talkPage, { summary: 'Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])' }, output).catch((error, data) => {
                                console.error(error); // eslint-disable-line no-console
                                mw.notify(`Error creating ${talkPage}: ${data.error.info} (${error})`, { type: 'error' });
                            });
                        else {
                            console.error(error); // eslint-disable-line no-console
                            mw.notify(`Error editing or creating ${talkPage}: ${data.error.info} (${error})`, { type: 'error' });
                            return false;
                        }
                    });

                if (!talkResult) return;

                mw.notify('Talk page synced successfully!', { type: 'success' });
            }

            /* Patrol checkbox handler */
            if (patrolCheckbox?.isSelected()) {
                submitButton.setLabel('Patrolling redirect...');

                await new mw.Api().postWithToken('patrol', { action: 'patrol', rcid: new URL(document.querySelector('.patrollink a').href).searchParams.get('rcid') }).catch((error, data) => {
                    console.error(error); // eslint-disable-line no-console
                    mw.notify(`Error patrolling ${pageTitle}: ${data.error.info} (${error})`, { type: 'error' });
                });

                mw.notify('Redirect patrolled successfully!', { type: 'success' });
            }

            submitButton.setLabel('Complete, reloading...');

            window.location.href = mw.util.getUrl(pageTitle, { redirect: 'no' });
        });

        let talkData;

        let syncTalkCheckbox, syncTalkLabel;
        if (!pageTitleParsed.isTalkPage()) {
            talkData = await new mw.Api().get({ action: 'query', titles: pageTitleParsed.getTalkPage().getPrefixedText(), prop: 'info', formatversion: 2 });
            syncTalkCheckbox = new OO.ui.CheckboxInputWidget({ selected: !!talkData.query.pages[0].redirect });
            syncTalkCheckbox.$element[0].style.marginBottom = '0';

            syncTalkLabel = new OO.ui.LabelWidget({ id: 'sync-talk-label', label: 'Sync talk page' });
            syncTalkLabel.$element[0].style.marginBottom = '0';

            syncTalkCheckbox.setLabelledBy('sync-talk-label');
        }

        let patrolCheckbox, patrolLabel;
        if (document.querySelector('.patrollink')) {
            patrolCheckbox = new OO.ui.CheckboxInputWidget({ selected: true });
            patrolCheckbox.$element[0].style.marginBottom = '0';

            patrolLabel = new OO.ui.LabelWidget({ id: 'patrol-label', label: 'Mark page as patrolled' });
            patrolLabel.$element[0].style.marginBottom = '0';

            patrolCheckbox.setLabelledBy('patrol-label');
        }

        const submitLayout = new OO.ui.HorizontalLayout({ items: [submitButton, syncTalkCheckbox, syncTalkLabel, patrolCheckbox, patrolLabel].filter(Boolean) });
        submitLayout.$element[0].style.marginTop = '10px';

        let warningMessage;

        /**
         * Alerts a user of an issue with the destination title
         * @param {string?} title The destination title
         * @param {string} message The error message
         */
        function promptError(title, message) {
            const label = new OO.ui.HtmlSnippet(`${title ? `<a href="${mw.util.getUrl(title)}" target="_blank">${title}</a>` : 'This page'} ${message} Click again without making changes to submit anyway.`);
            if (warningMessage) warningMessage.setLabel(label);
            else {
                warningMessage = new OO.ui.MessageWidget({ type: 'error', inline: true, label });
                warningMessage.$element[0].style.marginTop = '8px';

                editorBox.$element[0].append(warningMessage.$element[0]);
            }
            [redirectInput, tagSelect, summaryInput, submitButton, syncTalkCheckbox, patrolCheckbox].filter(Boolean).forEach((element) => element.setDisabled(false));

            submitButton.setLabel('Submit anyway');
            needsCheck = false;
        }

        /* Add elements to screen */
        editorBox.$element[0].append(redirectInputLayout.$element[0], tagSelectLayout.$element[0], summaryInputLayout.$element[0], submitLayout.$element[0]);

        contentText.prepend(editorBox.$element[0]);

        /**
         * Updates the summary input placeholder
         */
        function updateSummary() {
            const redirectValue = redirectInput.getValue().trim();

            if (!redirectValue) summaryInput.$tabIndexed[0].placeholder = '';
            else if (!exists) summaryInput.$tabIndexed[0].placeholder = `Creating redirect to [[${redirectValue}]]`;
            else {
                const targetChanged = redirectValue !== oldRedirectTarget;
                const tagsChanged = tagSelect.getValue().join(';') !== oldRedirectTags.join(';');

                if (targetChanged && tagsChanged) summaryInput.$tabIndexed[0].placeholder = `Changing redirect to [[${redirectValue}]] and changing categorization templates`;
                else if (targetChanged) summaryInput.$tabIndexed[0].placeholder = `Changing redirect to [[${redirectValue}]]`;
                else if (tagsChanged) summaryInput.$tabIndexed[0].placeholder = 'Changing categorization templates';
                else summaryInput.$tabIndexed[0].placeholder = 'Redirect cleanup';
            }
        }

        /* Load current target and tags, if applicable */
        let oldRedirectTarget, oldRedirectTags, oldRedirectTagData, oldStrayText;
        if (exists) {
            const pageContent = (await new mw.Api().get({ action: 'query', prop: 'revisions', formatversion: 2, titles: pageTitle, rvprop: 'content', rvslots: '*' })).query.pages[0].revisions[0].slots.main.content.trim();

            oldRedirectTarget = /^#REDIRECT:?\s*\[\[\s*([^|{}[\]]+?)\s*]]\s*/i.exec(pageContent)?.[1];
            oldRedirectTags = Object.entries(redirectTemplates)
                .map(([tag, redirects]) => ([tag, ...redirects].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.substring(1)}\\s*(\\||}})`).test(pageContent)) ? tag : null))
                .filter(Boolean)
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            oldRedirectTagData = Object.fromEntries(
                oldRedirectTags
                    .map((tag) => {
                        const match = new RegExp(`{{\\s*(?:${[tag, ...redirectTemplates[tag]].map((tag) => `[${tag[0].toLowerCase()}${tag[0]}]${tag.substring(1)}`).join('|')})\\|?(.*?)\\s*}}`).exec(pageContent);
                        return match ? [tag, match[1]] : null;
                    })
                    .filter(Boolean)
            );
            oldStrayText = [pageContent.match(/{{Short description\|.*?}}/i)?.[0], pageContent.match(/{{DISPLAYTITLE:.*?}}/)?.[0], pageContent.match(/{{italic title\|?.*?}}/i)?.[0], pageContent.match(/{{DEFAULTSORT:.*?}}/)?.[0]].filter(Boolean).join('\n');

            redirectInput.setValue(oldRedirectTarget.replaceAll('_', ' '));
            tagSelect.setValue(oldRedirectTags);
        }
    }
});
