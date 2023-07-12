interface PageInfoResult {
    query: { pages: { missing?: string; redirect?: string }[] };
}

interface AllPagesGeneratorResult {
    query: { pages: { title: string; pageprops: { disambiguation?: string }; redirect?: string }[] };
}

interface PageParseResult {
    parse: { title: string; redirects: { to: string; tofragment: string }[]; sections: { line: string }[] };
}

interface PagepropsResult {
    query: { pages: { pageprops: { disambiguation?: string } }[] };
}

interface UserPermissionsResponse {
    query: { userinfo: { rights: string[] } };
}

interface PageTriageListResponse {
    pagetriagelist: { pages: { user_name: string; patrol_status: string }[]; result: string }; // eslint-disable-line @typescript-eslint/naming-convention
}

mw.loader.using(['mediawiki.util', 'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui.styles.icons-content', 'oojs-ui.styles.icons-editing-core'], async () => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page
    if (mw.config.get('wgAction') !== 'view' || !mw.config.get('wgIsArticle')) return; // Don't run if not viewing page
    if (mw.util.getParamValue('oldid') || mw.config.get('wgDiffOldId')) return; // Don't run if viewing old revision or diff

    const contentText = document.getElementById('mw-content-text') as HTMLDivElement;

    if (!contentText) return mw.notify('Failed to find content text element!', { type: 'error' });

    const redirectTemplates = JSON.parse(((await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'revisions', rvprop: 'content', rvslots: '*', titles: 'User:Eejit43/scripts/redirect-helper.json' })) as PageRevisionsResult).query.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '[]') as Record<string, string[]>;

    const pageTitle = mw.config.get('wgPageName');
    const pageTitleParsed = mw.Title.newFromText(pageTitle)!;

    if (!pageTitleParsed) return mw.notify('Failed to parse page title!', { type: 'error' });

    const pageInfo = (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'info', titles: pageTitle })) as PageInfoResult;

    if (pageInfo.query.pages[0].missing) {
        const button = new OO.ui.ButtonWidget({ label: 'Create redirect', icon: 'articleRedirect', flags: ['progressive'] });
        button.$element[0].style.marginBottom = '10px';
        button.on('click', () => {
            contentText.removeChild(button.$element[0]);
            showRedirectInfo(false);
        });

        contentText.prepend(button.$element[0]);
    } else if (pageInfo.query.pages[0].redirect) showRedirectInfo(true);
    else {
        const portletLink = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Redirect page', 'redirect-helper');
        portletLink.addEventListener('click', (event) => {
            event.preventDefault();
            showRedirectInfo(false);
        });
    }

    /**
     * Shows the redirect information box.
     * @param exists Whether the page exists.
     */
    async function showRedirectInfo(exists: boolean): Promise<void> {
        const editorBox = new OO.ui.PanelLayout({ padded: true, expanded: false, framed: true });
        editorBox.$element[0].style.backgroundColor = '#95d4bc';
        editorBox.$element[0].style.width = '700px';
        editorBox.$element[0].style.maxWidth = 'calc(100% - 50px)';
        editorBox.$element[0].style.marginLeft = 'auto';
        editorBox.$element[0].style.marginRight = 'auto';
        editorBox.$element[0].style.marginBottom = '20px';

        let syncWithMainButton;

        if (pageTitleParsed.isTalkPage()) {
            const mainPageData = (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'info', titles: pageTitleParsed.getSubjectPage()!.getPrefixedText() })) as PageInfoResult;

            if (mainPageData.query.pages[0].redirect) {
                const mainPageContent = ((await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'revisions', rvprop: 'content', rvslots: '*', titles: pageTitleParsed.getSubjectPage()!.getPrefixedText() })) as PageRevisionsResult).query.pages[0].revisions[0].slots.main.content.trim();
                syncWithMainButton = new OO.ui.ButtonWidget({ label: 'Sync with main page', icon: 'link', flags: ['progressive'] });
                syncWithMainButton.on('click', () => {
                    const target = /^#REDIRECT:?\s*\[\[\s*([^|{}[\]]+?)\s*(?:\|[^|{}[\]]+?)?]]\s*/i.exec(mainPageContent)?.[1];
                    if (!target) return mw.notify('Failed to parse main page content!', { type: 'error' });

                    redirectInput.setValue(mw.Title.newFromText(target)?.getTalkPage()?.toString() ?? '');
                    const fromMove = ['R from move', ...redirectTemplates['R from move']].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.substring(1)}\\s*(\\||}})`).test(mainPageContent));
                    if (fromMove) tagSelect.setValue(['R from move']);
                });
            }
        }

        /* Redirect target input */
        interface RedirectInputWidgetConfig extends OO.ui.TextInputWidget.ConfigOptions, OO.ui.mixin.LookupElement.ConfigOptions {}

        class RedirectInputWidget extends OO.ui.TextInputWidget {
            constructor(config: RedirectInputWidgetConfig) {
                super(config);
                OO.ui.mixin.LookupElement.call(this as unknown as OO.ui.mixin.LookupElement, config);
            }

            getLookupRequest = () => {
                const value = this.getValue();
                const deferred = $.Deferred();

                if (!value) deferred.resolve([]);
                else if (value.includes('#')) {
                    const title = value.split('#')[0];

                    new mw.Api()
                        .get({ action: 'parse', page: title, prop: 'sections', redirects: '1' })
                        .catch(() => null)
                        .then((result: PageParseResult | null) => {
                            if (!result) deferred.resolve([]);
                            else {
                                const matchedSections = result.parse.sections.filter((section) => section.line.toLowerCase().startsWith(value.split('#')[1].toLowerCase()));
                                deferred.resolve(matchedSections.map((section) => ({ data: `${result.parse.title}#${section.line}`, label: `${result.parse.title}#${section.line}` })));
                            }
                        });
                } else {
                    const parsedTitle = mw.Title.newFromText(value);
                    new mw.Api()
                        .get({ action: 'query', formatversion: 2, gaplimit: 20, gapnamespace: parsedTitle?.namespace ?? 0, gapprefix: parsedTitle?.title ?? value, generator: 'allpages', prop: 'info|pageprops' })
                        .catch(() => null)
                        .then((result: AllPagesGeneratorResult | null) => {
                            if (!result) deferred.resolve([]);
                            else
                                deferred.resolve(
                                    result.query?.pages //
                                        ? result.query.pages //
                                              .filter((page) => page.title !== pageTitleParsed.toString())
                                              .map((page) => ({ data: page.title, label: new OO.ui.HtmlSnippet(`${page.title}${page.pageprops && 'disambiguation' in page.pageprops ? ' <i>(disambiguation)</i>' : ''}${'redirect' in page ? ' <i>(redirect)</i>' : ''}`) }))
                                        : []
                                );
                        });
                }

                return deferred.promise({ abort() {} }); // eslint-disable-line @typescript-eslint/no-empty-function
            };

            getLookupCacheDataFromResponse = <T>(response: T[] | null | undefined) => response ?? [];

            getLookupMenuOptionsFromData = (data: { data: string; label: string }[]) => data.map(({ data, label }) => new OO.ui.MenuOptionWidget({ data, label }));
        }

        Object.assign(RedirectInputWidget.prototype, OO.ui.mixin.LookupElement.prototype);

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
            allowReordering: false,
            options: Object.keys(redirectTemplates).map((tag) => ({ data: tag, label: tag }))
        });
        (tagSelect.getMenu() as OO.ui.MenuSelectWidget.ConfigOptions).filterMode = 'substring';
        tagSelect.on('change', () => {
            const sortedTags = (tagSelect.getValue() as string[]).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            if ((tagSelect.getValue() as string[]).join(';') !== sortedTags.join(';')) tagSelect.setValue(sortedTags);

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
            [redirectInput, tagSelect, summaryInput, submitButton, syncTalkCheckbox, patrolCheckbox].filter(Boolean).forEach((element) => (element as OO.ui.Widget).setDisabled(true));
            submitButton.setLabel('Checking target validity...');

            let parsedDestination;

            const errors = [];

            /* Title validation */
            if (needsCheck) {
                const destination = redirectInput.getValue().trim();

                /* Invalid characters */
                if (!/^\s*[^|{}[\]]+\s*$/.exec(destination)) errors.push({ title: destination, message: 'is not a valid page title!' });

                /* Failed during title parsing */
                try {
                    parsedDestination = mw.Title.newFromText(destination);
                } catch {
                    if (errors.length === 0) errors.push({ title: destination, message: 'is not a valid page title!' });
                }
                if (!parsedDestination && errors.length === 0) errors.push({ title: destination, message: 'is not a valid page title!' });

                /* Self redirects */
                if (parsedDestination?.toString() === pageTitleParsed.toString()) errors.push({ message: 'cannot redirect to itself!' });

                const destinationData = (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'pageprops', titles: destination }).catch((errorCode: string) => {
                    /* Non-existent destination */ if (errorCode === 'missingtitle') errors.push({ title: destination, message: 'does not exist!' });
                    /* Other API error */ else errors.push({ title: destination, message: `was not able to be fetched from the API (${errorCode})!` });
                    return null;
                })) as PagepropsResult | null;
                const destinationParseResult = (await new mw.Api().get({ action: 'parse', page: destination, prop: 'sections', redirects: '1' })) as PageParseResult;

                /* Double redirects */
                if (destinationParseResult.parse.redirects?.[0]) {
                    const destinationRedirect = destinationParseResult.parse.redirects[0].to + (destinationParseResult.parse.redirects[0].tofragment ? `#${destinationParseResult.parse.redirects[0].tofragment}` : '');
                    errors.push({ title: destination, message: `is a redirect to <a href="${mw.util.getUrl(destinationRedirect)}" target="_blank">${destinationRedirect}</a>. Retarget to that page instead, as double redirects aren't allowed.` });
                }

                /* Non-existent section */
                if (destination.split('#').length > 1) {
                    const validSection = destinationParseResult.parse.sections.find((section) => section.line === destination.split('#')[1]);
                    if (validSection) {
                        if (tagSelect.getValue().includes('R to anchor')) errors.push({ message: 'is tagged as a redirect to an anchor, but it is actually a redirect to a section!' });
                        if (!tagSelect.getValue().includes('R to section')) errors.push({ message: 'is a redirect to a section, but it is not tagged with <code>{{R to section}}</code>!' });
                    } else {
                        const destinationContent = ((await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'revisions', rvprop: 'content', rvslots: '*', titles: parsedDestination!.toString() })) as PageRevisionsResult).query.pages[0].revisions[0].slots.main.content;

                        const anchors = [
                            ...(destinationContent
                                .match(/(?<={{\s*?[aA](?:nchors?|nchor for redirect|nker|NCHOR|nc)\s*?\|).+?(?=}})/g)
                                ?.map((anchor: string) => anchor.split('|').map((part) => part.trim()))
                                ?.flat() ?? []),
                            ...(destinationContent
                                .match(/(?<={{\s*?(?:[vV](?:isible anchors?|isanc|Anch|anchor|isibleanchor|a)|[aA](?:nchord|chored|nchor\+)|[tT]ext anchor)\s*?\|).+?(?=(?<!!|=)}})/g)
                                ?.map((anchor: string) =>
                                    anchor
                                        .split('|')
                                        .map((part) => part.trim())
                                        .filter((part) => !/^text\s*?=/.exec(part))
                                )
                                ?.flat() ?? []),
                            ...(destinationContent.match(/(?<=id=)"?.+?(?="|>|\|)/g)?.map((anchor: string) => anchor.trim()) ?? [])
                        ];
                        if (!anchors.includes(destination.split('#')[1])) errors.push({ message: `is a redirect to <a href="${mw.util.getUrl(destination)}" target="_blank">${destination}</a>, but that section or anchor does not exist!` });
                        else {
                            if (tagSelect.getValue().includes('R to section')) errors.push({ message: 'is tagged as a redirect to a section, but it is actually a redirect to an anchor!' });
                            if (!tagSelect.getValue().includes('R to anchor')) errors.push({ message: 'is a redirect to an anchor, but it is not tagged with <code>{{R from anchor}}</code>!' });
                        }
                    }
                }

                /* Improperly tagged as redirect to section/anchor */
                if (destination.split('#').length === 1 && (tagSelect.getValue().includes('R to section') || tagSelect.getValue().includes('R to anchor'))) errors.push({ message: 'is not a redirect to a section/anchor, but it is tagged with <code>{{R from section}}</code> or <code>{{R from anchor}}</code>!' });

                /* Redirect to disambiguation page without template */
                if ('disambiguation' in destinationData!.query.pages[0].pageprops && !['R from ambiguous sort name', 'R from ambiguous term', 'R to disambiguation page', 'R from incomplete disambiguation', 'R from incorrect disambiguation', 'R from other disambiguation'].some((template) => tagSelect.getValue().includes(template))) errors.push({ message: 'is a redirect to a disambiguation page, but it is not tagged with a disambiguation categorization template!' });

                /* Improperly tagged as redirect to disambiguation page */
                if (!('disambiguation' in destinationData!.query.pages[0].pageprops) && ['R from ambiguous sort name', 'R from ambiguous term', 'R to disambiguation page', 'R from incomplete disambiguation', 'R from incorrect disambiguation', 'R from other disambiguation'].some((template) => tagSelect.getValue().includes(template))) errors.push({ message: 'is not a redirect to a disambiguation page, but it is tagged with a disambiguation categorization template!' });

                /* {{R to disambiguation page}} without " (disambiguation)" at end of title */
                if (tagSelect.getValue().includes('R to disambiguation page') && !/ \(disambiguation\)$/.exec(pageTitleParsed.getMainText())) errors.push({ message: 'is tagged with <code>{{R to disambiguation page}}</code>, but this title does not end with " (disambiguation)". Use <code>{{R from ambiguous term}}</code> or a similar categorization template instead!' });

                /* Syncing talk page but talk page exists and isn't a redirect */
                if (syncTalkCheckbox?.isSelected() && !talkData!.query.pages[0].missing && !talkData!.query.pages[0].redirect) errors.push({ title: pageTitleParsed.getTalkPage()!.getPrefixedText(), message: 'exists, but is not a redirect!' });
            }

            if (errors.length > 0) {
                document.querySelectorAll('.redirect-helper-warning').forEach((element) => element.remove());
                errors.forEach(({ title, message }) => {
                    const label = new OO.ui.HtmlSnippet(`${title ? `<a href="${mw.util.getUrl(title)}" target="_blank">${title}</a>` : 'This page'} ${message} Click again without making changes to submit anyway.`);
                    const warningMessage = new OO.ui.MessageWidget({ type: 'error', classes: ['redirect-helper-warning'], inline: true, label });
                    warningMessage.$element[0].style.marginTop = '8px';

                    editorBox.$element[0].append(warningMessage.$element[0]);
                });

                [redirectInput, tagSelect, summaryInput, submitButton, syncTalkCheckbox, patrolCheckbox].filter(Boolean).forEach((element) => (element as OO.ui.Widget).setDisabled(false));

                submitButton.setLabel('Submit anyway');
                needsCheck = false;

                return;
            }

            parsedDestination = mw.Title.newFromText(redirectInput.getValue());

            /* Edit/create redirect */
            submitButton.setLabel(`${exists ? 'Editing' : 'Creating'} redirect...`);

            const output = [
                `#REDIRECT [[${redirectInput.getValue().trim()}]]`, //
                tagSelect.getValue().length > 0 ? `{{Redirect category shell|\n${(tagSelect.getValue() as string[]).map((tag) => `{{${tag}${oldRedirectTagData?.[tag] ? `|${oldRedirectTagData[tag]}` : ''}}}`).join('\n')}\n}}` : null,
                oldStrayText
            ]
                .filter(Boolean)
                .join('\n\n');

            const summary = (summaryInput.getValue() || (summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder) + ' (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])';

            const result = await new mw.Api()
                .edit(pageTitle, () => ({ text: output, summary }))
                .catch((errorCode: string, { error }: MediaWikiDataError) => {
                    if (errorCode === 'nocreate-missing')
                        return new mw.Api().create(pageTitle, { summary }, output).catch((errorCode: string, { error }: MediaWikiDataError) => {
                            mw.notify(`Error creating ${pageTitle}: ${error.info} (${errorCode})`, { type: 'error' });
                        });
                    else {
                        mw.notify(`Error editing or creating ${pageTitle}: ${error.info} (${errorCode})`, { type: 'error' });
                        return null;
                    }
                });

            if (!result) return;

            mw.notify(`Redirect ${exists ? 'edited' : 'created'} successfully!`, { type: 'success' });

            /* Sync talk page checkbox handler */
            if (syncTalkCheckbox?.isSelected()) {
                submitButton.setLabel('Editing talk page...');

                const fromMove = tagSelect.getValue().includes('R from move');

                const output = [
                    `#REDIRECT [[${parsedDestination!.getTalkPage()!.getPrefixedText()}]]`, //
                    fromMove ? '{{Redirect category shell|\n{{R from move}}\n}}' : null
                ]
                    .filter(Boolean)
                    .join('\n\n');

                const talkPage = pageTitleParsed.getTalkPage()!.getPrefixedText();

                const talkResult = await new mw.Api()
                    .edit(talkPage, () => ({ text: output, summary: 'Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])' }))
                    .catch((errorCode: string, { error }: MediaWikiDataError) => {
                        if (errorCode === 'nocreate-missing')
                            return new mw.Api().create(talkPage, { summary: 'Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])' }, output).catch((errorCode: string, { error }: MediaWikiDataError) => {
                                mw.notify(`Error creating ${talkPage}: ${error.info} (${errorCode})`, { type: 'error' });
                            });
                        else {
                            mw.notify(`Error editing or creating ${talkPage}: ${error.info} (${errorCode})`, { type: 'error' });
                            return null;
                        }
                    });

                if (!talkResult) return;

                mw.notify('Talk page synced successfully!', { type: 'success' });
            }

            /* Patrol checkbox handler */
            if (patrolCheckbox?.isSelected()) {
                submitButton.setLabel('Patrolling redirect...');

                const patrolLink: HTMLAnchorElement | null = document.querySelector('.patrollink a');
                const markReviewedButton = document.getElementById('mwe-pt-mark-as-reviewed-button');

                if (patrolLink) {
                    const patrolResult = await new mw.Api().postWithToken('patrol', { action: 'patrol', rcid: new URL(patrolLink.href).searchParams.get('rcid')! }).catch((errorCode: string, { error }: MediaWikiDataError) => {
                        mw.notify(`Error patrolling ${pageTitle} via API: ${error.info} (${errorCode})`, { type: 'error' });
                        return null;
                    });
                    if (patrolResult) mw.notify('Redirect patrolled successfully!', { type: 'success' });
                } else if (!markReviewedButton) mw.notify('Page curation toolbar not found, redirect cannot be patrolled!', { type: 'error' });
                else {
                    markReviewedButton.click();
                    mw.notify('Redirect patrolled successfully!', { type: 'success' });
                }
            }

            submitButton.setLabel('Complete, reloading...');

            window.location.href = mw.util.getUrl(pageTitle, { redirect: 'no' });
        });

        let talkData: PageInfoResult | undefined;

        let syncTalkCheckbox: OO.ui.CheckboxInputWidget | undefined, syncTalkLayout: OO.ui.Widget | undefined;
        if (!pageTitleParsed.isTalkPage()) {
            talkData = (await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'info', titles: pageTitleParsed.getTalkPage()!.getPrefixedText() })) as PageInfoResult;
            syncTalkCheckbox = new OO.ui.CheckboxInputWidget({ selected: !!talkData.query.pages[0].redirect });

            syncTalkLayout = new OO.ui.Widget({ content: [new OO.ui.FieldLayout(syncTalkCheckbox, { label: 'Sync talk page', align: 'inline' })] });
            syncTalkLayout.$element[0].style.marginBottom = '0';
        }

        let shouldPromptPatrol;
        if (mw.config.get('wgNamespaceNumber') !== 0) shouldPromptPatrol = false;
        else if (document.querySelector('.patrollink')) shouldPromptPatrol = true;
        else if (document.getElementById('mwe-pt-mark-as-reviewed-button')) shouldPromptPatrol = true;
        else if (document.getElementById('mwe-pt-mark-as-unreviewed-button')) shouldPromptPatrol = false;
        else {
            if (!mw.config.get('wgArticleId')) shouldPromptPatrol = false;
            const userPermissions = (await new mw.Api().get({ action: 'query', meta: 'userinfo', uiprop: 'rights' })) as UserPermissionsResponse;
            if (!userPermissions.query.userinfo.rights.includes('patrol')) shouldPromptPatrol = false;

            const patrolResponse = (await new mw.Api().get({ action: 'pagetriagelist', page_id: mw.config.get('wgArticleId') })) as PageTriageListResponse; // eslint-disable-line @typescript-eslint/naming-convention

            if (patrolResponse.pagetriagelist.pages[0]?.user_name === mw.config.get('wgUserName')) shouldPromptPatrol = false;
            else if (patrolResponse.pagetriagelist.result !== 'success' || patrolResponse.pagetriagelist.pages.length === 0) shouldPromptPatrol = false;
            else shouldPromptPatrol = !parseInt(patrolResponse.pagetriagelist.pages[0]?.patrol_status);
        }

        let patrolCheckbox: OO.ui.CheckboxInputWidget | undefined, patrolLayout: OO.ui.Widget | undefined;
        if (shouldPromptPatrol) {
            patrolCheckbox = new OO.ui.CheckboxInputWidget({ selected: true });

            patrolLayout = new OO.ui.Widget({ content: [new OO.ui.FieldLayout(patrolCheckbox, { label: 'Mark as patrolled', align: 'inline' })] });
            patrolLayout.$element[0].style.marginBottom = '0';
        }

        const submitLayout = new OO.ui.HorizontalLayout({ items: [submitButton, syncTalkLayout, patrolLayout].filter(Boolean) as OO.ui.Widget[] });
        submitLayout.$element[0].style.marginTop = '10px';

        /* Add elements to screen */
        editorBox.$element[0].append(...([syncWithMainButton?.$element?.[0], redirectInputLayout.$element[0], tagSelectLayout.$element[0], summaryInputLayout.$element[0], submitLayout.$element[0]].filter(Boolean) as HTMLElement[]));

        contentText.prepend(editorBox.$element[0]);

        /**
         * Updates the summary input placeholder.
         */
        function updateSummary() {
            const redirectValue = redirectInput.getValue().trim();

            if (!redirectValue) (summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = '';
            else if (!exists) (summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = `Creating redirect to [[${redirectValue}]]`;
            else {
                const targetChanged = redirectValue !== oldRedirectTarget;
                const tagsChanged = tagSelect.getValue().join(';') !== oldRedirectTags?.join(';');

                if (targetChanged && tagsChanged) (summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = `Changing redirect to [[${redirectValue}]] and changing categorization templates`;
                else if (targetChanged) (summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = `Changing redirect to [[${redirectValue}]]`;
                else if (tagsChanged) (summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = 'Changing categorization templates';
                else (summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = 'Redirect cleanup';
            }
        }

        /* Load current target and tags, if applicable */
        let oldRedirectTarget: string | undefined, oldRedirectTags: string[] | undefined, oldRedirectTagData: Record<string, string> | undefined, oldStrayText: string | undefined;
        if (exists) {
            const pageContent = ((await new mw.Api().get({ action: 'query', formatversion: 2, prop: 'revisions', rvprop: 'content', rvslots: '*', titles: pageTitle })) as PageRevisionsResult).query.pages[0].revisions[0].slots.main.content.trim();

            oldRedirectTarget = /^#REDIRECT:?\s*\[\[\s*([^|{}[\]]+?)\s*(?:\|[^|{}[\]]+?)?]]\s*/i.exec(pageContent)?.[1];
            oldRedirectTags = (
                Object.entries(redirectTemplates)
                    .map(([tag, redirects]) => ([tag, ...redirects].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.substring(1)}\\s*(\\||}})`).test(pageContent)) ? tag : null))
                    .filter(Boolean) as string[]
            ).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            oldRedirectTagData = Object.fromEntries(
                oldRedirectTags
                    .map((tag) => {
                        const match = new RegExp(`{{\\s*(?:${[tag, ...redirectTemplates[tag]].map((tag) => `[${tag[0].toLowerCase()}${tag[0]}]${tag.substring(1)}`).join('|')})\\|?(.*?)\\s*}}`).exec(pageContent);
                        return match ? [tag, match[1]] : null;
                    })
                    .filter(Boolean) as [string, string][]
            );
            oldStrayText = [pageContent.match(/{{Short description\|.*?}}/i)?.[0], pageContent.match(/{{DISPLAYTITLE:.*?}}/)?.[0], pageContent.match(/{{italic title\|?.*?}}/i)?.[0], pageContent.match(/{{DEFAULTSORT:.*?}}/)?.[0]].filter(Boolean).join('\n');

            if (oldRedirectTarget) redirectInput.setValue(oldRedirectTarget.replaceAll('_', ' '));
            else mw.notify('Could not find redirect target!', { type: 'error' });
            tagSelect.setValue(oldRedirectTags);
        }
    }
});
