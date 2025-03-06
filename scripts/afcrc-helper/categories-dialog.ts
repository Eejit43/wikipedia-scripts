import CategoryInputWidget from './category-input-widget';
import HelperDialog, { type RequestAction, type RequestActionType, type RequestRequester } from './helper-dialog';
import PageInputWidget from './page-input-widget';
import type ActionsDialog from './show-actions-dialog';

interface CategoryRequestData {
    category: string;
    examples: string[];
    parents: string[];
    requester: RequestRequester;
}

type CategoryAction = RequestAction & { category: string; categorizedPages: string[]; parents: string[]; categoriesToRemove: string[] };

type CategoryActions = CategoryAction[];

export default class CategoriesDialog extends HelperDialog {
    protected parsedRequests: CategoryRequestData[] = [];
    private actionsToTake: CategoryActions = [];

    /**
     * Parses redirect requests from section text.
     * @param sectionText The section text.
     * @param sectionHeader The section header.
     */
    protected parseSubtypeRequests(sectionText: string, sectionHeader: string) {
        const parsedData = {} as CategoryRequestData;

        const foundCategory = /:?Category:(.*?)(]]|$)/.exec(sectionHeader)?.[1].trim();
        if (!foundCategory) return;

        parsedData.category = foundCategory.replaceAll('_', ' ');

        parsedData.examples = [
            ...(
                /example pages which belong to this category:(.*?)(parent category\/categories:|\n\[\[(special:contributions\/|user:))/is.exec(
                    sectionText,
                )?.[1] ?? ''
            ).matchAll(/\*\s*(?:\[\[)?(.*?)(\||]]|\s*?\n)/g),
        ]
            .map((match) => match[1].trim().replace(/^:/, '').replaceAll('_', ' '))
            .filter(Boolean);

        parsedData.parents = [
            ...(/parent category\/categories:(.*?)(\n\n|\n\[\[(special:contributions\/|user:))/is.exec(sectionText)?.[1] ?? '').matchAll(
                /(?<!\|)#?:?Category:(.*?)(\||]]|\s*?\n)/g,
            ),
        ]
            .map((match) => match[1].trim().replace(/^:/, '').replaceAll('_', ' '))
            .filter(Boolean);

        const firstUserIndex = sectionText.indexOf('[[User:');
        const firstUserTalkIndex = sectionText.indexOf('[[User talk:');
        const firstIpIndex = sectionText.indexOf('[[Special:Contributions/');

        const firstIndex = Math.min(...[firstUserIndex, firstUserTalkIndex, firstIpIndex].filter((index) => index !== -1));

        parsedData.requester =
            firstIndex === Number.POSITIVE_INFINITY
                ? null
                : firstIndex === firstIpIndex
                  ? { type: 'ip', name: /\[\[Special:Contributions\/(.*?)(\||]])/.exec(sectionText)![1].trim() }
                  : { type: 'user', name: /\[\[User(?: talk)?:(.*?)(\||]])/.exec(sectionText)![1].trim() };
        if (!parsedData.requester?.name) parsedData.requester = null;

        this.parsedRequests.push(parsedData);

        this.actionsToTake.push({
            category: parsedData.category,
            categorizedPages: parsedData.examples,
            parents: parsedData.parents,
            categoriesToRemove: parsedData.parents,
            originalText: { fullSectionText: sectionText, sectionText: sectionText.replace(/^==.*?==$/m, '').trim() },
            action: 'none',
        });
    }

    /**
     * Loads a given category request into the dialog.
     * @param index The index of the request to load.
     */
    protected loadSubtypeElements(index: number) {
        const request = this.parsedRequests[index];

        const detailsElement = document.createElement('details');
        detailsElement.classList.add('afcrc-helper-request');
        detailsElement.addEventListener('click', () => setTimeout(() => this.updateSize(), 0));

        const summaryElement = document.createElement('summary');
        summaryElement.innerHTML = `<b>Category:${request.category}</b>`;
        detailsElement.append(summaryElement);

        const requestInfoElement = document.createElement('div');
        requestInfoElement.classList.add('afcrc-helper-request-info');

        const noneElement = document.createElement('span');
        noneElement.style.color = 'dimgray';
        noneElement.textContent = 'None';

        const unknownElement = document.createElement('span');
        unknownElement.style.color = 'dimgray';
        unknownElement.textContent = 'Unknown';

        const examplesDiv = document.createElement('div');

        const examplesLabel = document.createElement('b');
        examplesLabel.textContent = 'Examples: ';
        examplesDiv.append(examplesLabel);

        if (request.examples.length > 0)
            for (const [index, example] of request.examples.entries()) {
                const linkElement = document.createElement('a');
                linkElement.target = '_blank';
                linkElement.href = mw.util.getUrl(example);
                linkElement.textContent = example;

                examplesDiv.append(linkElement);

                if (index !== request.examples.length - 1) examplesDiv.append(', ');
            }
        else examplesDiv.append(noneElement.cloneNode(true));

        requestInfoElement.append(examplesDiv);

        const parentsDiv = document.createElement('div');

        const parentsLabel = document.createElement('b');
        parentsLabel.textContent = 'Parents: ';
        parentsDiv.append(parentsLabel);

        if (request.parents.length > 0)
            for (const [index, parent] of request.parents.entries()) {
                const linkElement = document.createElement('a');
                linkElement.target = '_blank';
                linkElement.href = mw.util.getUrl(`Category:${parent}`);
                linkElement.textContent = parent;

                parentsDiv.append(linkElement);

                if (index !== request.parents.length - 1) parentsDiv.append(', ');
            }
        else parentsDiv.append(noneElement.cloneNode(true));

        requestInfoElement.append(parentsDiv);

        const requesterDiv = document.createElement('div');

        const requesterLabel = document.createElement('b');
        requesterLabel.textContent = 'Requester: ';
        requesterDiv.append(requesterLabel);

        if (request.requester) {
            const requesterLink = document.createElement('a');
            requesterLink.target = '_blank';
            requesterLink.href =
                request.requester.type === 'user'
                    ? mw.util.getUrl(`User:${request.requester.name}`)
                    : mw.util.getUrl(`Special:Contributions/${request.requester.name}`);
            requesterLink.textContent = request.requester.name;
            requesterDiv.append(requesterLink);
        } else requesterDiv.append(unknownElement.cloneNode(true));

        requestInfoElement.append(requesterDiv);

        detailsElement.append(requestInfoElement);

        detailsElement.append(document.createElement('hr'));

        const requestResponderElement = document.createElement('div');
        requestResponderElement.classList.add('afcrc-helper-request-responder');

        const actionRadioInput = new OO.ui.RadioSelectWidget({
            classes: ['afcrc-helper-action-radio'],
            items: ['Accept', 'Deny', 'Comment', 'Close', 'None'].map((label) => new OO.ui.RadioOptionWidget({ data: label, label })),
        });
        actionRadioInput.selectItemByLabel('None');
        actionRadioInput.on('choose', () => {
            setTimeout(() => this.updateSize(), 0);

            const option = (
                (actionRadioInput.findSelectedItem() as OO.ui.RadioOptionWidget).getData() as string
            ).toLowerCase() as RequestActionType;

            this.actionsToTake[index].action = option;

            if (['comment', 'close'].includes(option)) {
                commentInputLayout.$element.show();

                const comment = commentInput.getValue().trim();
                if (comment) this.actionsToTake[index].comment = comment;
                else delete this.actionsToTake[index].comment;
            } else {
                commentInputLayout.$element.hide();

                delete this.actionsToTake[index].comment;
            }

            this.updateRequestColor(detailsElement, index);

            pageSelectLayout.$element.hide();
            categoryRemoveSelectLayout.$element.hide();
            parentCategorySelectLayout.$element.hide();
            denyReasonLayout.$element.hide();
            closingReasonLayout.$element.hide();

            switch (option) {
                case 'accept': {
                    pageSelectLayout.$element.show();
                    categoryRemoveSelectLayout.$element.show();
                    parentCategorySelectLayout.$element.show();

                    break;
                }
                case 'deny': {
                    denyReasonLayout.$element.show();

                    break;
                }
                case 'close': {
                    closingReasonLayout.$element.show();

                    break;
                }
            }
        });

        const pageSelectInput = new PageInputWidget({ placeholder: 'Add pages here' });
        pageSelectInput.on('change', () => {
            let value = pageSelectInput.getValue();
            value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
            value = value.replace(/^:/, '');

            if (value.length > 0) pageSelectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll('_', ' '));
        });
        pageSelectInput.on('showing-values', (pages: { data: string; label: string }[]) => {
            for (const page of pages) pageSelect.addAllowedValue(page.data);
        });

        const pageSelect = new OO.ui.TagMultiselectWidget({
            allowReordering: false,
            inputPosition: 'outline',
            inputWidget: pageSelectInput,
        });
        pageSelect.on('change', () => {
            const selectedTags = pageSelect.getValue() as string[];

            const sortedTags = selectedTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            if (selectedTags.join(';') !== sortedTags.join(';')) pageSelect.setValue(sortedTags);

            this.actionsToTake[index].categorizedPages = sortedTags;
        });

        const { categorizedPages } = this.actionsToTake[index];

        for (const page of categorizedPages) pageSelect.addAllowedValue(page);
        pageSelect.setValue(categorizedPages);

        const pageSelectLayout = new OO.ui.FieldLayout(pageSelect, { align: 'inline', label: 'Pages to categorize:' });
        pageSelectLayout.$element.hide();

        const categoryRemoveSelectInput = new CategoryInputWidget({ placeholder: 'Add categories here' });
        categoryRemoveSelectInput.on('change', () => {
            let value = categoryRemoveSelectInput.getValue();
            value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
            value = value.replace(/^Category:/, '');

            if (value.length > 0) categoryRemoveSelectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll('_', ' '));
        });
        categoryRemoveSelectInput.on('showing-values', (pages: { data: string; label: string }[]) => {
            for (const page of pages) parentCategorySelect.addAllowedValue(page.data);
        });

        const categoryRemoveSelect = new OO.ui.TagMultiselectWidget({
            allowReordering: false,
            inputPosition: 'outline',
            inputWidget: categoryRemoveSelectInput,
        });
        categoryRemoveSelect.on('change', () => {
            const selectedTags = categoryRemoveSelect.getValue() as string[];

            const sortedTags = selectedTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            if (selectedTags.join(';') !== sortedTags.join(';')) categoryRemoveSelect.setValue(sortedTags);

            this.actionsToTake[index].categoriesToRemove = sortedTags;
        });

        const { parents: parentCategories } = this.actionsToTake[index];

        for (const parent of parentCategories) categoryRemoveSelect.addAllowedValue(parent);
        categoryRemoveSelect.setValue(parentCategories);

        const categoryRemoveSelectLayout = new OO.ui.FieldLayout(categoryRemoveSelect, {
            align: 'inline',
            label: 'Categories to remove from pages to categorize:',
        });
        categoryRemoveSelectLayout.$element.hide();

        const parentCategorySelectInput = new CategoryInputWidget({ placeholder: 'Add categories here' });
        parentCategorySelectInput.on('change', () => {
            let value = parentCategorySelectInput.getValue();
            value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
            value = value.replace(/^Category:/, '');

            if (value.length > 0) parentCategorySelectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll('_', ' '));
        });
        parentCategorySelectInput.on('showing-values', (pages: { data: string; label: string }[]) => {
            for (const page of pages) parentCategorySelect.addAllowedValue(page.data);
        });

        const parentCategorySelect = new OO.ui.TagMultiselectWidget({
            allowReordering: false,
            inputPosition: 'outline',
            inputWidget: parentCategorySelectInput,
        });
        parentCategorySelect.on('change', () => {
            const selectedTags = parentCategorySelect.getValue() as string[];

            const sortedTags = selectedTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            if (selectedTags.join(';') !== sortedTags.join(';')) parentCategorySelect.setValue(sortedTags);

            this.actionsToTake[index].parents = sortedTags;
        });

        for (const parentCategory of parentCategories) parentCategorySelect.addAllowedValue(parentCategory);
        parentCategorySelect.setValue(parentCategories);

        const parentCategorySelectLayout = new OO.ui.FieldLayout(parentCategorySelect, { align: 'inline', label: 'Parent categories:' });
        parentCategorySelectLayout.$element.hide();

        const denyReason = new OO.ui.ComboBoxInputWidget({
            classes: ['afcrc-closing-reason-input'],
            placeholder: 'autofill:unlikely',
            options: [
                ['exists', 'existing categories'],
                ['empty', 'empty submissions'],
                ['unlikely', 'categories that are unlikely to have enough pages'],
                ['notcategory', 'page creation requests'],
                ['notenglish', 'requests not in English'],
            ].map(([value, label]) => ({ data: `autofill:${value}`, label: `Autofilled text for ${label}` })),
        });
        denyReason.on('change', () => {
            this.actionsToTake[index].denyReason = denyReason.getValue() || 'autofill:unlikely';
        });
        denyReason.setValue('autofill:unlikely');
        denyReason.getMenu().selectItemByData('autofill:unlikely');

        const denyReasonLayout = new OO.ui.FieldLayout(denyReason, {
            align: 'inline',
            label: 'Deny reason:',
            help: 'Supports automatic reasoning, custom reasoning, or a combination of the two with "autofill:REASON, CUSTOM" format',
        });
        denyReasonLayout.$element.hide();

        const closingReason = new OO.ui.DropdownWidget({
            classes: ['afcrc-closing-reason-input'],
            menu: {
                items: [
                    ['No response', 'r'],
                    ['Succeeded', 's'],
                    ['Withdrawn', 'w'],
                ].map(([title, id]) => new OO.ui.MenuOptionWidget({ data: id, label: title })),
            },
        });
        closingReason.getMenu().on('choose', () => {
            const selected = closingReason.getMenu().findSelectedItem() as OO.ui.MenuOptionWidget;

            this.actionsToTake[index].closingReason = {
                name: selected.getLabel() as string,
                id: selected.getData() as string,
            };

            this.updateRequestColor(detailsElement, index);
        });
        closingReason.getMenu().selectItemByData('r');
        this.actionsToTake[index].closingReason = { name: 'No response', id: 'r' };

        const closingReasonLayout = new OO.ui.FieldLayout(closingReason, { align: 'inline', label: 'Closing reason:' });
        closingReasonLayout.$element.hide();

        const commentInput = new OO.ui.TextInputWidget();
        commentInput.on('change', () => {
            const comment = commentInput.getValue().trim();

            if (comment) this.actionsToTake[index].comment = comment;
            else delete this.actionsToTake[index].comment;
        });

        const commentInputLayout = new OO.ui.FieldLayout(commentInput, {
            classes: ['afcrc-comment-input'],
            align: 'inline',
            label: 'Comment:',
        });
        commentInputLayout.$element.hide();

        requestResponderElement.append(
            actionRadioInput.$element[0],
            pageSelectLayout.$element[0],
            categoryRemoveSelectLayout.$element[0],
            parentCategorySelectLayout.$element[0],
            denyReasonLayout.$element[0],
            closingReasonLayout.$element[0],
            commentInputLayout.$element[0],
        );

        detailsElement.append(requestResponderElement);

        (this as unknown as { $body: JQuery }).$body.append(detailsElement);

        this.updateSize();
    }

    /**
     * Updates the color of a details element based on the handling of the requests inside.
     * @param detailsElement The details element to update.
     * @param index The index of the redirect target.
     */
    protected updateRequestColor(detailsElement: HTMLDetailsElement, index: number) {
        const { action } = this.actionsToTake[index];

        let backgroundColor = '';

        // eslint-disable-next-line unicorn/prefer-switch
        if (action === 'accept') backgroundColor = '#a0ffa0';
        else if (action === 'deny') backgroundColor = '#ffcece';
        else if (action === 'close')
            if (this.actionsToTake[index].closingReason?.id === 'r') backgroundColor = '#ffcece';
            else if (this.actionsToTake[index].closingReason?.id === 's') backgroundColor = '#90c090';
            else backgroundColor = '#b8b8b8';

        detailsElement.style.backgroundColor = backgroundColor;
    }

    /**
     * Performs actions on a given category request.
     * @param showActionsDialog The dialog to add messages to.
     * @param counts The count object used to track requests for the edit summary.
     * @param newPageText The new page text.
     */
    protected async performSubtypeActions(showActionsDialog: ActionsDialog, counts: Record<string, number>, newPageText: string) {
        const anyRequestHandled = this.actionsToTake.some((actionData) => actionData.action !== 'none');

        if (anyRequestHandled) {
            for (const actionData of this.actionsToTake) {
                let sectionData = { pageText: newPageText, ...actionData.originalText };

                switch (actionData.action) {
                    case 'accept': {
                        sectionData = this.modifySectionData(sectionData, {
                            prepend: '{{AfC-c|a}}',
                            append: '* {{subst:AfC category}} ~~~~\n{{AfC-c|b}}',
                        });

                        this.handleAcceptedCategory(actionData);

                        counts.accepted++;

                        break;
                    }
                    case 'deny': {
                        sectionData = this.modifySectionData(sectionData, {
                            prepend: '{{AfC-c|d}}',
                            append: `* ${this.formatDeniedReason(actionData.denyReason!)} ~~~~\n{{AfC-c|b}}`,
                        });

                        counts.denied++;

                        break;
                    }
                    case 'comment': {
                        if (actionData.comment) {
                            sectionData = this.modifySectionData(sectionData, {
                                append: `* {{AfC comment|1=${actionData.comment}}} ~~~~`,
                            });

                            counts['commented on']++;
                        } else
                            showActionsDialog.addLogEntry(
                                `The request to create "${actionData.category}" was marked to be commented on, but no comment was provided so it will be skipped.`,
                                'warning',
                            );

                        break;
                    }
                    case 'close': {
                        sectionData = this.modifySectionData(sectionData, {
                            prepend: `{{AfC-c|${actionData.closingReason!.id}}}`,
                            append: (actionData.comment ? `* {{AfC comment|1=${actionData.comment}}} ~~~~` : '') + '\n{{AfC-c|b}}',
                        });

                        counts.closed++;

                        break;
                    }
                }

                newPageText = sectionData.pageText;
            }

            if (this.beforeText + this.pageContent === newPageText) {
                showActionsDialog.addLogEntry('No requests have been handled (page content identical)!');

                return;
            }

            const mappedCounts = Object.entries(counts)
                .filter(([, count]) => count > 0)
                .map(([action, count]) => `${action} ${count}`)
                .join(', ');

            this.editsCreationsToMake.push({
                type: 'edit',
                title: this.pageTitle,
                transform: () => ({
                    text: newPageText,
                    summary: `Handling AfC category requests (${mappedCounts})${this.scriptMessage}`,
                }),
            });

            await this.makeAllEditsCreations(showActionsDialog);

            showActionsDialog.addLogEntry('All changes made, click below to reload!', 'success');

            showActionsDialog.showReload();
        } else showActionsDialog.addLogEntry('No requests have been handled!');
    }

    /**
     * Handles the creation of pages related to an accepted category request.
     * @param data The data of the requested category.
     */
    protected handleAcceptedCategory(data: CategoryAction) {
        this.editsCreationsToMake.push(
            {
                type: 'create',
                isRedirect: false,
                title: `Category:${data.category}`,
                text: data.parents.map((parent) => `[[Category:${parent}]]`).join('\n'),
                summary: `Creating category as requested at [[WP:AFC/C]]${this.scriptMessage}`,
            },
            {
                type: 'create',
                isRedirect: false,
                title: `Category talk:${data.category}`,
                text: `{{WikiProject banner shell|\n{{WikiProject Articles for creation|ts={{subst:LOCALTIMESTAMP}}|reviewer=${mw.config.get('wgUserName')}}}\n}}`,
                summary: `Adding [[Wikipedia:WikiProject Articles for creation|WikiProject Articles for creation]] banner${this.scriptMessage}`,
            },
            ...data.categorizedPages.map((example) => ({
                type: 'edit' as const,
                title: example,
                transform: ({ content }: { content: string }) => {
                    for (const category of data.categoriesToRemove)
                        content = content.replaceAll(new RegExp(`\\[\\[:?[Cc]ategory:${category}\\]\\]\n?`, 'gi'), '');

                    content = content.replace(/((\[\[:?[Cc]ategory:.+?]]\n?)+)/, `$1[[Category:${data.category}]]`);

                    return {
                        text: content,
                        summary: `Adding page to [[:Category:${data.category}]] as requested at [[WP:AFC/C]]${this.scriptMessage}`,
                    };
                },
            })),
        );
    }
}
