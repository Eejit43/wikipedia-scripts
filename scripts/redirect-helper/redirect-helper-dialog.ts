import type {
    ApiParseParams,
    ApiQueryInfoParams,
    ApiQueryPagePropsParams,
    PageTriageApiPageTriageListParams,
} from 'types-mediawiki/api_params';
import type {
    CategoriesResult,
    MediaWikiDataError,
    PageInfoResult,
    PageParseResult,
    PageTriageListResponse,
    PagepropsResult,
} from '../../global-types';
import { api, getPageContent } from '../../utility';
import type { WatchMethod } from '../afcrc-helper/afcrc-helper';
import CategoryInputWidget from './category-input-widget';
import ChangesDialog from './changes-dialog';
import OutputPreviewDialog from './output-preview-dialog';
import RedirectTargetInputWidget from './redirect-target-input-widget';

export type RedirectTemplateData = Record<string, { redirect?: true; parameters: RedirectTemplateParameters; aliases: string[] }>;

type RedirectTemplateParameters = Record<
    string,
    {
        aliases: string[];
        label: string | null;
        description: string | null;
        type: string;
        required: boolean;
        suggested: boolean;
        default: string | number | boolean | null;
        example: string | number | boolean | null;
    }
>;

export interface TemplateEditorElementInfo {
    name: string;
    details: HTMLDetailsElement;
    parameters: { name: string; aliases: string[]; editor: OO.ui.TextInputWidget }[];
}

/**
 * An instance of this class handles the dialog portion of redirect-helper script.
 */
export default class RedirectHelperDialog {
    // Utility variables
    private readonly REDIRECT_REGEX = /^#.*?:?\s*\[\[\s*:?([^[\]{|}]+?)\s*(?:\|[^[\]{|}]+?)?]]\s*/i;
    private readonly SCRIPT_MESSAGE = ' (via [[w:en:User:Eejit43/scripts/redirect-helper|redirect-helper]])';

    // Assigned in constructor
    private redirectTemplates: RedirectTemplateData;
    private contentText: HTMLDivElement;
    private pageTitle: string;
    private pageTitleParsed: mw.Title;

    private exists: boolean;
    private defaultCreatedWatchMethod: WatchMethod;

    // Used during run()
    private needsCheck = true;

    private editorBox!: OO.ui.PanelLayout;
    private syncWithSubjectPageButton?: OO.ui.ButtonWidget;
    private syncWithRootPageButton?: OO.ui.ButtonWidget;
    private redirectInput!: RedirectTargetInputWidget;
    private redirectInputLayout!: OO.ui.FieldLayout;
    private tagSelect!: OO.ui.MenuTagMultiselectWidget;
    private tagSelectLayout!: OO.ui.ActionFieldLayout;
    private templateParametersEditor!: HTMLDetailsElement;
    private templateEditorsInfo: TemplateEditorElementInfo[] = [];
    private categorySelect!: OO.ui.TagMultiselectWidget;
    private categorySelectInput!: CategoryInputWidget;
    private categorySelectLayout!: OO.ui.FieldLayout;
    private defaultSortInput!: OO.ui.TextInputWidget;
    private defaultSortSuggestButton!: OO.ui.ButtonWidget;
    private defaultSortInputLayout!: OO.ui.ActionFieldLayout;
    private summaryInput!: OO.ui.ComboBoxInputWidget;
    private summaryInputLayout!: OO.ui.FieldLayout;
    private submitButton!: OO.ui.ButtonWidget;
    private showChangesButton!: OO.ui.ButtonWidget;
    private showPreviewButton!: OO.ui.ButtonWidget;
    private syncTalkCheckbox?: OO.ui.CheckboxInputWidget;
    private syncTalkCheckboxLayout?: OO.ui.Widget;
    private watchCheckbox?: OO.ui.CheckboxInputWidget;
    private watchCheckboxLayout?: OO.ui.Widget;
    private patrolCheckbox?: OO.ui.CheckboxInputWidget;
    private patrolCheckboxLayout?: OO.ui.Widget;
    private submitLayout!: OO.ui.HorizontalLayout;

    private talkData?: PageInfoResult;

    private pageContent = '';

    private oldRedirectTarget?: string;
    private oldRedirectTags?: string[];
    private oldRedirectTagData?: Record<string, string[][]>;
    private oldDefaultSort?: string;
    private oldCategories?: string[];
    private oldStrayText?: string;

    private parsedDestination!: mw.Title | null;

    constructor(
        {
            redirectTemplates,
            contentText,
            pageTitle,
            pageTitleParsed,
        }: { redirectTemplates: RedirectTemplateData; contentText: HTMLDivElement; pageTitle: string; pageTitleParsed: mw.Title },
        exists: boolean,
        createdWatchMethod: WatchMethod,
    ) {
        this.redirectTemplates = redirectTemplates;
        this.contentText = contentText;
        this.pageTitle = pageTitle;
        this.pageTitleParsed = pageTitleParsed;

        this.exists = exists;

        this.defaultCreatedWatchMethod = createdWatchMethod;
    }

    /**
     * Loads the redirect-helper dialog into the page.
     */
    async load() {
        /* Load elements */
        this.editorBox = new OO.ui.PanelLayout({ id: 'redirect-helper-box', padded: true, expanded: false, framed: true });

        if (this.pageTitleParsed.isTalkPage()) {
            const subjectPageData = (await api.get({
                action: 'query',
                formatversion: '2',
                prop: 'info',
                titles: this.pageTitleParsed.getSubjectPage()!.getPrefixedText(),
            } satisfies ApiQueryInfoParams)) as PageInfoResult;

            if (subjectPageData.query!.pages[0].redirect) await this.loadSyncWithSubjectPageButton();
            else if (this.pageTitleParsed.getPrefixedText().includes('/')) {
                const rootPageData = (await api.get({
                    action: 'query',
                    formatversion: '2',
                    prop: 'info',
                    titles: this.pageTitleParsed.getPrefixedText().split('/')[0],
                } satisfies ApiQueryInfoParams)) as PageInfoResult;

                if (rootPageData.query!.pages[0].redirect) await this.loadSyncWithRootPageButton();
            }
        }

        this.loadInputElements();
        await this.loadSubmitElements();

        /* Add elements to screen and load data (if applicable) */
        this.editorBox.$element[0].append(
            ...([
                this.syncWithSubjectPageButton?.$element[0],
                this.syncWithRootPageButton?.$element[0],
                this.redirectInputLayout.$element[0],
                this.tagSelectLayout.$element[0],
                this.templateParametersEditor,
                this.defaultSortInputLayout.$element[0],
                this.categorySelectLayout.$element[0],
                this.summaryInputLayout.$element[0],
                this.submitLayout.$element[0],
            ].filter(Boolean) as HTMLElement[]),
        );

        this.contentText.prepend(this.editorBox.$element[0]);

        if (this.exists) void this.loadExistingData();
    }

    /**
     * Loads the "Sync with subject page" button" on talk pages.
     */
    private async loadSyncWithSubjectPageButton() {
        const subjectPageContent = (await getPageContent(this.pageTitleParsed.getSubjectPage()!.getPrefixedText())) ?? '';

        this.syncWithSubjectPageButton = new OO.ui.ButtonWidget({ label: 'Sync with subject page', icon: 'link', flags: ['progressive'] });
        this.syncWithSubjectPageButton.on('click', () => {
            const target = this.REDIRECT_REGEX.exec(subjectPageContent)?.[1];
            if (!target) return mw.notify('Failed to parse subject page content!', { type: 'error' });

            this.redirectInput.setValue(mw.Title.newFromText(target)?.getTalkPage()?.getPrefixedText() ?? '');

            const isFromMove = ['R from move', ...this.redirectTemplates['R from move'].aliases].some((tagOrRedirect) =>
                new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`).test(
                    subjectPageContent,
                ),
            );

            this.tagSelect.setValue(isFromMove ? ['R from move'] : []);
        });
    }

    /**
     * Loads the "Sync with root page" button on subpage talk pages.
     */
    private async loadSyncWithRootPageButton() {
        const currentTitleSplit = this.pageTitleParsed.getPrefixedText().split('/');
        const currentSubpage = currentTitleSplit.slice(1).join('/');

        const rootPageContent = (await getPageContent(currentTitleSplit[0])) ?? '';

        this.syncWithRootPageButton = new OO.ui.ButtonWidget({ label: 'Sync with root page', icon: 'link', flags: ['progressive'] });
        this.syncWithRootPageButton.on('click', () => {
            const target = this.REDIRECT_REGEX.exec(rootPageContent)?.[1];
            if (!target) return mw.notify('Failed to parse root page content!', { type: 'error' });

            const targetTitle = mw.Title.newFromText(target)?.getPrefixedText();

            this.redirectInput.setValue(targetTitle ? `${targetTitle}/${currentSubpage}` : '');

            const isFromMove = ['R from move', ...this.redirectTemplates['R from move'].aliases].some((tagOrRedirect) =>
                new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`).test(
                    rootPageContent,
                ),
            );

            this.tagSelect.setValue(isFromMove ? ['R from move'] : []);
        });
    }

    /**
     * Loads the input elements.
     */
    private loadInputElements() {
        /* Redirect target input */
        this.redirectInput = new RedirectTargetInputWidget({ placeholder: 'Target page name', required: true }, this.pageTitleParsed);
        this.redirectInput.on('change', () => {
            let value = this.redirectInput.getValue();
            value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
            value = value.replace(/^:/, '');

            if (value.length > 0) {
                this.redirectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll('_', ' '));
                this.defaultSortSuggestButton.setDisabled(false);
                this.submitButton.setDisabled(false);
                this.showPreviewButton.setDisabled(false);
                this.showChangesButton.setDisabled(false);
            } else {
                this.defaultSortSuggestButton.setDisabled(true);
                this.submitButton.setDisabled(true);
                this.showPreviewButton.setDisabled(true);
                this.showChangesButton.setDisabled(true);
            }

            this.updateSummary();
            this.submitButton.setLabel('Submit');
            this.needsCheck = true;
        });

        this.redirectInputLayout = new OO.ui.FieldLayout(this.redirectInput, {
            label: 'Redirect target:',
            classes: ['redirect-input-layout'],
            align: 'top',
        });

        /* Redirect categorization template selection */
        this.tagSelect = new OO.ui.MenuTagMultiselectWidget({
            allowArbitrary: false,
            allowReordering: false,
            options: Object.entries(this.redirectTemplates).map(([tag, { redirect }]) => {
                if (!redirect) return { data: tag, label: tag };

                const label = new OO.ui.HtmlSnippet(`<span class="redirect-helper-redirect-possibilities">${tag}</span>`);

                return { data: tag, label };
            }),
        });
        (this.tagSelect.getMenu() as OO.ui.MenuSelectWidget.ConfigOptions).filterMode = 'substring';
        this.tagSelect.on('change', (selectedElements) => {
            const selectedTags = selectedElements.map((element) => element.getData() as string);

            const sortedTags = selectedTags.toSorted((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            if (selectedTags.join(';') !== sortedTags.join(';')) {
                const lastElement = selectedElements.at(-1) as unknown as OO.ui.mixin.DraggableElement & OO.ui.Element;

                this.tagSelect.reorder(lastElement, sortedTags.indexOf(lastElement.getData() as string));
            }

            this.updateSummary();
            this.submitButton.setLabel('Submit');
            this.needsCheck = true;

            for (const editorInfo of this.templateEditorsInfo) editorInfo.details.style.display = 'none';

            let shownTemplateEditors = 0;
            for (const tag of this.tagSelect.getValue() as string[]) {
                const editorInfo = this.templateEditorsInfo.find((editorInfo) => editorInfo.name === tag);

                if (editorInfo) {
                    editorInfo.details.style.display = 'block';
                    shownTemplateEditors++;
                }
            }

            summaryElement.textContent = `Template parameters (${shownTemplateEditors > 0 ? `for ${shownTemplateEditors} template${shownTemplateEditors > 1 ? 's' : ''}` : 'none to show'})`;

            noTemplatesMessage.style.display = shownTemplateEditors > 0 ? 'none' : 'block';
        });

        this.tagSelectLayout = new OO.ui.FieldLayout(this.tagSelect, {
            label: 'Redirect categorization templates:',
            classes: ['redirect-input-layout'],
            align: 'top',
        });

        /* Redirect categorization template parameters */
        this.templateParametersEditor = document.createElement('details');
        this.templateParametersEditor.classList.add('redirect-helper-template-parameters-container');

        const summaryElement = document.createElement('summary');
        summaryElement.textContent = 'Template parameters (none to show)';
        this.templateParametersEditor.append(summaryElement);

        for (const [templateName, templateData] of Object.entries(this.redirectTemplates)) {
            const parameters = Object.entries(templateData.parameters);
            if (parameters.length === 0) continue;

            const details = document.createElement('details');
            details.style.display = 'none';

            const summary = document.createElement('summary');
            summary.textContent = templateName;
            details.append(summary);

            const elementData: TemplateEditorElementInfo = { name: templateName, details, parameters: [] };

            for (const [parameterName, parameterData] of parameters) {
                const input = new OO.ui.TextInputWidget({
                    placeholder: parameterData.default?.toString(),
                    required: parameterData.required,
                });
                input.on('change', () => {
                    this.updateSummary();
                    this.submitButton.setLabel('Submit');
                    this.needsCheck = true;
                });

                const inputLayout = new OO.ui.FieldLayout(input, {
                    label: new OO.ui.HtmlSnippet(
                        `${parameterName}${!parameterData.label || parameterName.toLowerCase() === parameterData.label.toLowerCase() ? '' : ` (${parameterData.label})`}${parameterData.description ? ` (${parameterData.description})` : ''} (type: ${parameterData.type}) ${parameterData.suggested ? ' (suggested)' : ''}${parameterData.example ? ` (example: "${parameterData.example}")` : ''}`,
                    ),
                    align: 'inline',
                });
                details.append(inputLayout.$element[0]);

                elementData.parameters.push({ name: parameterName, aliases: parameterData.aliases, editor: input });
            }

            this.templateParametersEditor.append(details);

            this.templateEditorsInfo.push(elementData);
        }

        const noTemplatesMessage = document.createElement('div');
        noTemplatesMessage.id = 'redirect-helper-no-templates-message';
        noTemplatesMessage.textContent = 'No templates with parameters to display!';

        this.templateParametersEditor.append(noTemplatesMessage);

        /* DEFAULTSORT input */
        this.defaultSortInput = new OO.ui.TextInputWidget();
        this.defaultSortInput.on('change', () => {
            const value = this.defaultSortInput.getValue();

            if (value.length > 0) this.defaultSortInput.setValue(value.replaceAll('_', ' '));

            this.updateSummary();
            this.submitButton.setLabel('Submit');
            this.needsCheck = true;
        });

        this.defaultSortSuggestButton = new OO.ui.ButtonWidget({ icon: 'robot', label: 'Suggest', disabled: true });
        this.defaultSortSuggestButton.on('click', () => {
            let name = this.pageTitleParsed.getMainText().replace(/ \(.*\)$/, ''); // Remove disambiguation

            if (
                [
                    'R from birth name',
                    'R from fictional character',
                    'R from band member',
                    'R from member',
                    'R from person',
                    'R from personal name',
                    'R from relative',
                    'R from spouse',
                ].some((tag) => this.tagSelect.getValue().includes(tag))
            ) {
                // Handling is modified from evad37's "Rater"

                if (!name.includes(' '))
                    return mw.notify("redirect-helper wasn't able to determine a sort key different from the current page title!", {
                        type: 'warn',
                    });

                let generationalSuffix = '';
                if (/ (?:[JS]r.?|[IVX]+)$/.test(name)) {
                    generationalSuffix = name.slice(name.lastIndexOf(' '));
                    name = name.slice(0, name.lastIndexOf(' '));
                    if (!name.includes(' ')) return name + generationalSuffix;
                }

                const lastName = name
                    .slice(name.lastIndexOf(' ') + 1)
                    .replace(/,$/, '')
                    .replace(/O'/, 'O');
                const otherNames = name.slice(0, name.lastIndexOf(' '));

                this.defaultSortInput.setValue(lastName + ', ' + otherNames + generationalSuffix);
            } else {
                let newName = name.replaceAll('Mr.', 'Mister').replaceAll('&', 'And');

                for (const leadingArticle of ['An', 'A', 'The'])
                    if (newName.startsWith(leadingArticle + ' ')) {
                        newName = newName.slice(leadingArticle.length + 1) + ', ' + leadingArticle;
                        break;
                    }

                if (newName === name)
                    mw.notify("redirect-helper wasn't able to determine a sort key different from the current page title!", {
                        type: 'warn',
                    });
                else this.defaultSortInput.setValue(newName);
            }
        });

        this.defaultSortInputLayout = new OO.ui.ActionFieldLayout(this.defaultSortInput, this.defaultSortSuggestButton, {
            label: new OO.ui.HtmlSnippet(
                `Default sort key (DEFAULTSORT) (see <a href="${mw.util.getUrl('Wikipedia:Categorization#Sort keys')}" target="_blank">guideline</a>):`,
            ),
            classes: ['redirect-input-layout'],
            align: 'top',
        });

        /* Categories selection */
        this.categorySelectInput = new CategoryInputWidget({ placeholder: 'Add categories here' });
        this.categorySelectInput.on('change', () => {
            let value = this.categorySelectInput.getValue();
            value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get('wgServer').replace(/^\/{2}/, '')}/wiki/`), '');
            value = value.replace(/^Category:/, '');

            if (value.length > 0) this.categorySelectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll('_', ' '));
        });
        this.categorySelectInput.on('showing-values', (pages: { data: string; label: string }[]) => {
            for (const page of pages) this.categorySelect.addAllowedValue(page.data);
        });
        this.categorySelect = new OO.ui.TagMultiselectWidget({
            allowReordering: false,
            inputPosition: 'outline',
            inputWidget: this.categorySelectInput,
        });
        this.categorySelect.on('change', (selectedElements) => {
            const selectedCategories = selectedElements.map((element) => element.getData() as string);

            const sortedCategories = selectedCategories.toSorted((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            if (selectedCategories.join(';') !== sortedCategories.join(';')) {
                const lastElement = selectedElements.at(-1) as unknown as OO.ui.mixin.DraggableElement & OO.ui.Element;

                this.categorySelect.reorder(lastElement, sortedCategories.indexOf(lastElement.getData() as string));
            }

            this.updateSummary();
            this.submitButton.setLabel('Submit');
            this.needsCheck = true;
        });

        this.categorySelectLayout = new OO.ui.FieldLayout(this.categorySelect, {
            label: 'Categories:',
            classes: ['redirect-input-layout'],
            align: 'top',
        });

        /* Summary input */
        this.summaryInput = new OO.ui.ComboBoxInputWidget({
            options: [
                { data: 'Resolve double redirect' }, //
                { data: 'Resolve self redirect' },
                { data: 'Remove incorrect rcats' },
            ],
        });

        this.summaryInputLayout = new OO.ui.FieldLayout(this.summaryInput, {
            id: 'redirect-helper-summary-layout',
            label: 'Summary:',
            classes: ['redirect-input-layout'],
            align: 'top',
        });
    }

    /**
     * Loads the elements in the submit button row.
     */
    private async loadSubmitElements() {
        const windowManager = new OO.ui.WindowManager();
        document.body.append(windowManager.$element[0]);

        /* Set up submit button */
        this.submitButton = new OO.ui.ButtonWidget({ label: 'Submit', disabled: true, flags: ['progressive'] });
        this.submitButton.on('click', () => this.handleSubmitButtonClick());

        /* Set up show preview button */
        const templatePreviewDialog = new OutputPreviewDialog({ size: 'large' }, this.pageTitleParsed);
        windowManager.addWindows([templatePreviewDialog]);

        this.showPreviewButton = new OO.ui.ButtonWidget({ label: 'Show preview', disabled: true });
        this.showPreviewButton.on('click', () => {
            templatePreviewDialog.setData(
                this.createOutput(
                    this.redirectInput.getValue(),
                    this.tagSelect.getValue() as string[],
                    this.oldStrayText,
                    this.defaultSortInput.getValue(),
                    this.categorySelect.getValue() as string[],
                ),
            );
            templatePreviewDialog.open();
        });

        /* Set up show changes button */
        const showChangesDialog = new ChangesDialog({ size: 'large' });
        windowManager.addWindows([showChangesDialog]);

        this.showChangesButton = new OO.ui.ButtonWidget({ label: 'Show changes', disabled: true });
        this.showChangesButton.on('click', async () => {
            if (this.exists) this.pageContent = (await getPageContent(this.pageTitle)) ?? '';

            showChangesDialog.setData([
                this.pageContent,
                this.createOutput(
                    this.redirectInput.getValue(),
                    this.tagSelect.getValue() as string[],
                    this.oldStrayText,
                    this.defaultSortInput.getValue(),
                    this.categorySelect.getValue() as string[],
                ),
            ]);
            showChangesDialog.open();
        });

        /* Set up sync talk checkbox */
        if (!this.pageTitleParsed.isTalkPage()) {
            this.talkData = (await api.get({
                action: 'query',
                formatversion: '2',
                prop: 'info',
                titles: this.pageTitleParsed.getTalkPage()!.getPrefixedText(),
            } satisfies ApiQueryInfoParams)) as PageInfoResult;
            this.syncTalkCheckbox = new OO.ui.CheckboxInputWidget({ selected: !!this.talkData.query!.pages[0].redirect });

            this.syncTalkCheckboxLayout = new OO.ui.Widget({
                content: [new OO.ui.FieldLayout(this.syncTalkCheckbox, { label: 'Sync talk page', align: 'inline' })],
            });
        }

        /* Set up watch page checkbox */
        if (!this.exists) {
            const config: OO.ui.CheckboxInputWidget.ConfigOptions = {};

            if (['nochange', 'preferences'].includes(this.defaultCreatedWatchMethod)) config.indeterminate = true;
            else if (this.defaultCreatedWatchMethod === 'watch') config.selected = true;
            else config.selected = false;

            this.watchCheckbox = new OO.ui.CheckboxInputWidget(config);

            this.watchCheckboxLayout = new OO.ui.Widget({
                content: [new OO.ui.FieldLayout(this.watchCheckbox, { label: 'Watch page', align: 'inline' })],
            });
        }

        /* Set up patrol checkbox */
        if (await this.checkShouldPromptPatrol()) {
            this.patrolCheckbox = new OO.ui.CheckboxInputWidget({ selected: true });

            this.patrolCheckboxLayout = new OO.ui.Widget({
                content: [new OO.ui.FieldLayout(this.patrolCheckbox, { label: 'Mark as patrolled', align: 'inline' })],
            });
        }

        /* Set up layout */
        this.submitLayout = new OO.ui.HorizontalLayout({
            id: 'redirect-helper-submit-layout',
            items: [
                this.submitButton,
                this.showPreviewButton,
                this.showChangesButton,
                this.syncTalkCheckboxLayout,
                this.watchCheckboxLayout,
                this.patrolCheckboxLayout,
            ].filter(Boolean) as OO.ui.Widget[],
        });
    }

    /**
     * Determines if the user should be prompted to patrol the page.
     */
    private async checkShouldPromptPatrol() {
        const pageTriageMarkButton = document.querySelector<HTMLImageElement>('#mwe-pt-mark .mwe-pt-tool-icon');
        pageTriageMarkButton?.click();
        pageTriageMarkButton?.click();

        if (mw.config.get('wgNamespaceNumber') !== 0) return false;
        else if (document.querySelector('.patrollink')) return true;
        else if (document.querySelector('#mwe-pt-mark-as-reviewed-button')) return true;
        else if (document.querySelector('#mwe-pt-mark-as-unreviewed-button')) return false;
        else {
            if (!mw.config.get('wgArticleId')) return false;
            const userPermissions = await mw.user.getRights();
            if (!userPermissions.includes('patrol')) return false;

            const patrolResponse = (await api.get({
                action: 'pagetriagelist',
                page_id: mw.config.get('wgArticleId'), // eslint-disable-line @typescript-eslint/naming-convention
            } satisfies PageTriageApiPageTriageListParams)) as PageTriageListResponse;

            if (patrolResponse.pagetriagelist.pages[0]?.user_name === mw.config.get('wgUserName')) return false;
            else if (patrolResponse.pagetriagelist.result !== 'success' || patrolResponse.pagetriagelist.pages.length === 0) return false;
            else return !Number.parseInt(patrolResponse.pagetriagelist.pages[0]?.patrol_status);
        }
    }

    /**
     * Updates the summary input placeholder.
     */
    private updateSummary() {
        const redirectValue = this.redirectInput.getValue().trim();

        if (!redirectValue) (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = '';
        else if (this.exists) {
            let oldTarget = this.oldRedirectTarget?.replaceAll('_', ' ');
            if (oldTarget) oldTarget = oldTarget[0].toUpperCase() + oldTarget.slice(1);

            const targetChanged = redirectValue !== oldTarget;

            const tagsChanged =
                this.tagSelect.getValue().some((tag) => !this.oldRedirectTags!.includes(tag as string)) ||
                this.oldRedirectTags!.some((tag) => !this.tagSelect.getValue().includes(tag));

            let tagArgumentsChanged = false;
            if (this.oldRedirectTagData) {
                const tagsWithParameters = Object.entries(this.redirectTemplates).filter(
                    ([, data]) => Object.entries(data.parameters).length > 0,
                );

                for (const [tag, data] of tagsWithParameters) {
                    const tagWasSelected = this.oldRedirectTags!.includes(tag);
                    if (!tagWasSelected || !this.tagSelect.getValue().includes(tag)) continue;

                    const oldTagData = this.oldRedirectTagData[tag] ?? Object.entries(data.parameters).map(([name]) => [name, '']);

                    const foundTagEditorData = this.templateEditorsInfo.find((template) => template.name === tag)!;

                    for (const parameter of foundTagEditorData.parameters) {
                        const oldArgument = oldTagData.find((argument) => argument[0] === parameter.name)?.[1] ?? '';
                        const newArgument = parameter.editor.getValue().trim();

                        if (oldArgument !== newArgument) {
                            tagArgumentsChanged = true;
                            break;
                        }
                    }

                    if (tagArgumentsChanged) break;
                }
            }

            const defaultSortChanged = this.defaultSortInput.getValue().trim() !== this.oldDefaultSort!.replaceAll('_', ' ');

            const categoriesChanged =
                this.categorySelect.getValue().some((category) => !this.oldCategories!.includes(category as string)) ||
                this.oldCategories!.some((category) => !this.categorySelect.getValue().includes(category));

            const changes = [];

            if (targetChanged) changes.push(`retarget to [[${redirectValue}]]`);
            if (tagsChanged)
                changes.push(
                    `${this.tagSelect.getValue().length > 0 && this.oldRedirectTags!.length > 0 ? 'change' : this.tagSelect.getValue().length > 0 ? 'add' : 'remove'} categorization templates`,
                );
            if (tagArgumentsChanged) changes.push('change categorization template arguments');
            if (defaultSortChanged)
                changes.push(
                    `${this.defaultSortInput.getValue().trim().length > 0 && this.oldDefaultSort!.replaceAll('_', ' ').length > 0 ? 'change' : this.defaultSortInput.getValue().trim().length > 0 ? 'add' : 'remove'} default sort key`,
                );
            if (categoriesChanged)
                changes.push(
                    `${this.categorySelect.getValue().length > 0 && this.oldCategories!.length > 0 ? 'change' : this.categorySelect.getValue().length > 0 ? 'add' : 'remove'} categories`,
                );

            if (changes.length === 0) changes.push('perform redirect cleanup');

            changes[0] = changes[0][0].toUpperCase() + changes[0].slice(1);
            if (changes.length > 1) changes[changes.length - 1] = `and ${changes.at(-1)}`;

            (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = changes.join(changes.length > 2 ? ', ' : ' ');
        } else (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder = `Create redirect to [[${redirectValue}]]`;
    }

    /**
     * Loads existing page data.
     */
    private async loadExistingData() {
        if (this.exists) this.pageContent = (await getPageContent(this.pageTitle)) ?? '';

        this.oldRedirectTarget = this.REDIRECT_REGEX.exec(this.pageContent)?.[1];

        this.oldRedirectTags = (
            Object.entries(this.redirectTemplates)
                .map(([tag, tagData]) =>
                    [tag, ...tagData.aliases].some((tagOrRedirect) =>
                        new RegExp(
                            `{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`,
                        ).test(this.pageContent),
                    )
                        ? tag
                        : null,
                )
                .filter(Boolean) as string[]
        ).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        const originalRedirectTags = Object.entries(this.redirectTemplates)
            .flatMap(([tag, tagData]) => [tag, ...tagData.aliases])
            .map((tagOrRedirect) =>
                new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`).test(
                    this.pageContent,
                )
                    ? tagOrRedirect
                    : null,
            )
            .filter(Boolean) as string[];

        this.oldRedirectTagData = Object.fromEntries(
            originalRedirectTags
                .map((tag) => {
                    const match = new RegExp(`{{\\s*[${tag[0].toLowerCase()}${tag[0]}]${tag.slice(1)}\\|?(.*?)\\s*}}`).exec(
                        this.pageContent,
                    );

                    const newTag = Object.entries(this.redirectTemplates).find(([template, tagData]) =>
                        [template, ...tagData.aliases].includes(tag),
                    )?.[0];

                    const originalArguments = match?.[1];
                    if (!originalArguments) return null;

                    const formattedArguments = match[1].split('|').map((argument, index) => {
                        if (!argument.includes('=')) return [(index + 1).toString(), argument.trim()];

                        const [name, value] = argument.split('=');

                        return [name.trim(), value.trim()];
                    });

                    return [newTag, formattedArguments];
                })
                .filter(Boolean) as [string, string[][]][],
        );

        this.oldDefaultSort =
            this.pageContent
                .match(/{{DEFAULTSORT:.*?}}/g)
                ?.at(-1)
                ?.slice(14, -2)
                .trim() ?? '';

        this.oldCategories =
            this.pageContent
                .match(/\[\[[Cc]ategory:.+?]]/g)
                ?.map((category) => category.slice(11, -2))
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())) ?? [];

        this.oldStrayText = [
            /{{short description\|.*?}}/i.exec(this.pageContent)?.[0],
            /{{DISPLAYTITLE:.*?}}/.exec(this.pageContent)?.[0],
            /{{italic title\|?.*?}}/i.exec(this.pageContent)?.[0],
            /{{title language\|.*?}}/.exec(this.pageContent)?.[0],
            /{{authority control(\|.*?)?}}/i.exec(this.pageContent)?.[0],
        ]
            .filter(Boolean)
            .join('\n');

        if (this.oldRedirectTarget) this.redirectInput.setValue(this.oldRedirectTarget.replaceAll('_', ' '));
        else mw.notify('redirect-helper: Could not find redirect target!', { type: 'error' });

        this.tagSelect.setValue(this.oldRedirectTags);

        for (const [templateName, data] of Object.entries(this.oldRedirectTagData)) {
            const foundTemplateEditor = this.templateEditorsInfo.find((editorInfo) => editorInfo.name === templateName);
            if (!foundTemplateEditor) continue;

            for (const [parameterName, argument] of data) {
                const foundParameterEditor = foundTemplateEditor.parameters.find((parameter) =>
                    [parameter.name, ...parameter.aliases].includes(parameterName),
                );

                if (foundParameterEditor) foundParameterEditor.editor.setValue(argument);
            }
        }

        if (this.oldDefaultSort) this.defaultSortInput.setValue(this.oldDefaultSort);

        for (const category of this.oldCategories) {
            this.categorySelect.addAllowedValue(category);
            this.categorySelectInput.validCategories.add(category);
        }
        this.categorySelect.setValue(this.oldCategories.map((category) => ({ data: category, label: category })));

        this.updateSummary();
    }

    /**
     * Runs checks on the provided data and returns the errors (if any).
     */
    private async validateSubmission() {
        const errors: {
            title?: string;
            message: string;
            autoFixes?: ({ type: 'add' | 'remove'; tag: string } | { type: 'change-target'; target: string })[];
        }[] = [];

        const destination = this.redirectInput.getValue().trim();
        const tags = this.tagSelect.getValue() as string[];

        /* Invalid characters */
        if (!/^\s*[^[\]{|}]+\s*$/.test(destination)) errors.push({ title: destination, message: 'is not a valid page title!' });

        /* Failed during title parsing */
        try {
            this.parsedDestination = mw.Title.newFromText(destination);
        } catch {
            if (errors.length === 0) errors.push({ title: destination, message: 'is not a valid page title!' });
        }
        if (!this.parsedDestination && errors.length === 0) errors.push({ title: destination, message: 'is not a valid page title!' });

        /* Self redirects */
        if (this.parsedDestination?.getPrefixedText() === this.pageTitleParsed.getPrefixedText())
            errors.push({ message: 'cannot redirect to itself!' });

        const destinationData = (await api
            .get({
                action: 'query',
                formatversion: '2',
                prop: ['pageprops', 'categories'],
                titles: destination,
            } satisfies ApiQueryPagePropsParams)
            .catch((errorCode) => {
                if (errorCode === 'missingtitle') errors.push({ title: destination, message: 'does not exist!' });
                else errors.push({ title: destination, message: `was not able to be fetched from the API (${errorCode})!` });

                return null;
            })) as (PagepropsResult & CategoriesResult) | null;
        const destinationParseResult = (await api.get({
            action: 'parse',
            page: destination,
            prop: 'sections',
            redirects: true,
        } satisfies ApiParseParams)) as PageParseResult;

        /* Double redirects */
        if (destinationParseResult.parse!.redirects.length > 0) {
            const destinationRedirect =
                destinationParseResult.parse!.redirects[0].to +
                (destinationParseResult.parse!.redirects[0].tofragment ? `#${destinationParseResult.parse!.redirects[0].tofragment}` : '');
            errors.push({
                title: destination,
                message: `is a redirect to <a href="${mw.util.getUrl(
                    destinationRedirect,
                )}" target="_blank">${destinationRedirect}</a>. Retarget to that page instead, as double redirects aren't allowed.`,
                autoFixes: [{ type: 'change-target', target: destinationRedirect }],
            });
        }

        /* Nonexistent section */
        if (destination.split('#').length > 1) {
            const validSection = destinationParseResult.parse!.sections.find(
                (section) => section.line.replaceAll(/<\/?i>/g, '') === destination.split('#')[1],
            );
            if (validSection) {
                if (tags.includes('R to anchor'))
                    errors.push({
                        message: 'is tagged as a redirect to an anchor, but it is actually a redirect to a section!',
                        autoFixes: [
                            { type: 'add', tag: 'R to section' },
                            { type: 'remove', tag: 'R to anchor' },
                        ],
                    });
                if (!tags.includes('R to section'))
                    errors.push({
                        message: 'is a redirect to a section, but it is not tagged with <code>{{R to section}}</code>!',
                        autoFixes: [{ type: 'add', tag: 'R to section' }],
                    });
            } else {
                const destinationContent = (await getPageContent(this.parsedDestination!.getPrefixedText())) ?? '';

                const anchors = [
                    ...(destinationContent
                        .match(/(?<={{\s*?[Aa](?:nchors?|nchor for redirect|nker|NCHOR|nc)\s*?\|).+?(?=}})/g)
                        ?.map((anchor: string) => anchor.split('|').map((part) => part.trim()))
                        .flat() ?? []),
                    ...(destinationContent
                        .match(
                            /(?<={{\s*?(?:[Vv](?:isible anchors?|isanc|Anch|anchor|isibleanchor|a)|[Aa](?:nchord|chored|nchor\+)|[Tt]ext anchor)\s*?\|).+?(?=(?<!!|=)}})/g,
                        )
                        ?.map((anchor: string) =>
                            anchor
                                .split('|')
                                .map((part) => part.trim())
                                .filter((part) => !/^text\s*?=/.test(part)),
                        )
                        .flat() ?? []),
                    ...(destinationContent.match(/(?<=id=)"?.+?(?="|>|\|)/g)?.map((anchor: string) => anchor.trim()) ?? []),
                    ...(destinationContent.match(/EpisodeNumber += +\d+/g)?.map((anchor: string) => `ep${anchor.split('=')[1].trim()}`) ??
                        []),
                ];
                if (anchors.includes(destination.split('#')[1])) {
                    if (tags.includes('R to section'))
                        errors.push({
                            message: 'is tagged as a redirect to a section, but it is actually a redirect to an anchor!',
                            autoFixes: [
                                { type: 'add', tag: 'R to anchor' },
                                { type: 'remove', tag: 'R to section' },
                            ],
                        });
                    if (!tags.includes('R to anchor'))
                        errors.push({
                            message: 'is a redirect to an anchor, but it is not tagged with <code>{{R to anchor}}</code>!',
                            autoFixes: [{ type: 'add', tag: 'R to anchor' }],
                        });
                } else
                    errors.push({
                        message: `is a redirect to <a href="${mw.util.getUrl(destination)}" target="_blank">${destination}</a>, but that section or anchor does not exist!`,
                        autoFixes: [{ type: 'change-target', target: destination.split('#')[0] }],
                    });
            }
        }

        /* Improperly tagged as redirect to section/anchor */
        if (destination.split('#').length === 1)
            for (const tag of ['R to section', 'R to anchor'])
                if (tags.includes(tag))
                    errors.push({
                        message: `is not a redirect to a section/anchor, but it is tagged with <code>{{${tag}}}</code>!`,
                        autoFixes: [{ type: 'remove', tag }],
                    });

        const targetIsDisambiguationPage = !!(
            destinationData!.query!.pages[0].pageprops && 'disambiguation' in destinationData!.query!.pages[0].pageprops
        );
        const targetIsSurnameList = !!destinationData!.query!.pages[0].categories?.some(
            (category) => category.title === 'Category:Surnames',
        );

        const toDisambiguationPageTags = ['R to disambiguation page', 'R from incomplete disambiguation'];
        const toSurnameListTags = ['R from ambiguous sort name', 'R from ambiguous term'];

        const taggedAsRedirectToDisambiguationPage = toDisambiguationPageTags.some((template) => tags.includes(template));
        const taggedAsRedirectToSurnameList = toSurnameListTags.some((template) => tags.includes(template));

        /* Redirect to disambiguation page without template */
        if (targetIsDisambiguationPage && !taggedAsRedirectToDisambiguationPage && !taggedAsRedirectToSurnameList)
            errors.push({
                message: 'is a redirect to a disambiguation page, but it is not tagged with a disambiguation categorization template!',
            });

        if (destinationData!.query!.pages[0].pageprops && !targetIsDisambiguationPage) {
            /* Improperly tagged as redirect to disambiguation page */
            if (
                (!targetIsSurnameList && (taggedAsRedirectToDisambiguationPage || taggedAsRedirectToSurnameList)) ||
                (targetIsSurnameList && taggedAsRedirectToDisambiguationPage)
            )
                errors.push({
                    message: 'is not a redirect to a disambiguation page, but it is tagged with a disambiguation categorization template!',
                    autoFixes: [...toDisambiguationPageTags, ...toSurnameListTags].map((tag) => ({ type: 'remove', tag })),
                });

            /* Redirect to surname list without template */
            if (targetIsSurnameList && !taggedAsRedirectToSurnameList)
                errors.push({
                    message: 'is a redirect to a surname list, but it is not tagged with a correct disambiguation categorization template!',
                });
        }

        /* {{R to disambiguation page}} without " (disambiguation)" at end of title */
        if (
            targetIsDisambiguationPage &&
            tags.includes('R to disambiguation page') &&
            !this.pageTitleParsed.getMainText().endsWith(' (disambiguation)')
        )
            errors.push({
                message:
                    'is tagged with <code>{{R to disambiguation page}}</code>, but this title does not end with " (disambiguation)". Use <code>{{R from ambiguous term}}</code> or a similar categorization template instead!',
                autoFixes: [{ type: 'remove', tag: 'R to disambiguation page' }],
            });

        /* Tagged with a protection template */
        for (const template of ['R protected', 'R protected/semi', 'R protected/excon', 'R protected/template', 'R protected/full'])
            if (tags.includes(template))
                errors.push({
                    message: `is tagged with unnecessarily tagged with <code>{{${template}}}</code> which will be duplicated by the redirect category shell!`,
                    autoFixes: [{ type: 'remove', tag: template }],
                });

        /* Linked to a Wikidata item without being tagged with {{R with Wikidata item}} */
        if (mw.config.get('wgWikibaseItemId') && !tags.includes('R with Wikidata item'))
            errors.push({
                message: "is linked to a Wikidata item but it isn't tagged with <code>{{R with Wikidata item}}</code>!",
                autoFixes: [{ type: 'add', tag: 'R with Wikidata item' }],
            });

        /* Tagged with {{R with Wikidata item}} without being linked to an item */
        if (tags.includes('R with Wikidata item') && !mw.config.get('wgWikibaseItemId'))
            errors.push({
                message: 'is tagged with <code>{{R with Wikidata item}}</code> but it is not actually linked to a Wikidata item!',
                autoFixes: [{ type: 'remove', tag: 'R with Wikidata item' }],
            });

        /* Missing tag required parameter */
        for (const tag of tags) {
            if (!(tag in this.redirectTemplates)) continue;

            const tagData = this.redirectTemplates[tag];

            for (const [parameterName, parameterData] of Object.entries(tagData.parameters)) {
                const foundParameter = this.templateEditorsInfo
                    .find((editorInfo) => editorInfo.name === tag)
                    ?.parameters.find((parameter) => [parameter.name, ...parameter.aliases].includes(parameterName));

                if (!foundParameter) continue;

                if (parameterData.required && !foundParameter.editor.getValue().trim())
                    errors.push({
                        message: `is tagged with <code>{{${tag}}}</code> but it is missing the required parameter <code>${parameterName}</code>!`,
                    });
            }
        }

        /* Syncing talk page but talk page exists and isn't a redirect */
        if (this.syncTalkCheckbox?.isSelected() && !this.talkData!.query!.pages[0].missing && !this.talkData!.query!.pages[0].redirect)
            errors.push({
                title: this.pageTitleParsed.getTalkPage()!.getPrefixedText(),
                message: 'exists, but is not a redirect!',
            });

        return errors;
    }

    /**
     * Handles the event when the user clicks the "Submit" button.
     */
    private async handleSubmitButtonClick() {
        const elementsToDisable = [
            this.redirectInput,
            this.tagSelect,
            ...this.templateEditorsInfo.flatMap((template) => template.parameters.map((parameter) => parameter.editor)),
            this.defaultSortInput,
            this.defaultSortSuggestButton,
            this.categorySelect,
            this.summaryInput,
            this.submitButton,
            this.showPreviewButton,
            this.showChangesButton,
            this.syncTalkCheckbox,
            this.watchCheckbox,
            this.patrolCheckbox,
        ].filter(Boolean);

        for (const element of elementsToDisable) (element as OO.ui.Widget).setDisabled(true);

        this.submitButton.setLabel('Checking target validity...');

        let errors: Awaited<ReturnType<typeof this.validateSubmission>> = [];
        if (this.needsCheck) errors = await this.validateSubmission();
        else this.parsedDestination = mw.Title.newFromText(this.redirectInput.getValue());

        if (errors.length > 0) {
            for (const element of document.querySelectorAll('.redirect-helper-warning')) element.remove();
            for (const { title, message, autoFixes } of errors) {
                const label = new OO.ui.HtmlSnippet(
                    `${title ? `<a href="${mw.util.getUrl(title)}" target="_blank">${title}</a>` : 'This page'} ${message} Click again without making changes to submit anyway.`,
                );
                const warningMessage = new OO.ui.MessageWidget({
                    type: 'error',
                    classes: ['redirect-helper-warning'],
                    inline: true,
                    label,
                });

                if (autoFixes) {
                    const autoFixButton = new OO.ui.ButtonWidget({
                        label: 'Perform auto-fix',
                        flags: ['progressive'],
                        classes: ['redirect-helper-autofix-button'],
                    });
                    autoFixButton.on('click', () => {
                        const tags = this.tagSelect.getValue() as string[];

                        for (const autoFix of autoFixes) {
                            if (autoFix.type === 'add' && !tags.includes(autoFix.tag)) this.tagSelect.addTag(autoFix.tag, autoFix.tag);

                            if (autoFix.type === 'remove' && tags.includes(autoFix.tag)) this.tagSelect.removeTagByData(autoFix.tag);

                            if (autoFix.type === 'change-target') this.redirectInput.setValue(autoFix.target);
                        }

                        warningMessage.$element[0].style.textDecoration = 'line-through 2px black';
                        autoFixButton.$element[0].remove();
                    });

                    warningMessage.$element[0].querySelector('.oo-ui-labelElement-label')!.append(autoFixButton.$element[0]);
                }

                this.editorBox.$element[0].append(warningMessage.$element[0]);
            }

            for (const element of elementsToDisable) (element as OO.ui.Widget).setDisabled(false);

            this.submitButton.setLabel('Submit anyway');
            this.needsCheck = false;

            return;
        }

        /* Edit/create redirect */
        this.submitButton.setLabel(`${this.exists ? 'Editing' : 'Creating'} redirect...`);

        const output = this.createOutput(
            this.redirectInput.getValue(),
            this.tagSelect.getValue() as string[],
            this.oldStrayText,
            this.defaultSortInput.getValue(),
            this.categorySelect.getValue() as string[],
        );

        const summary =
            (this.summaryInput.getValue() || (this.summaryInput.$tabIndexed[0] as HTMLInputElement).placeholder) + this.SCRIPT_MESSAGE;

        const result = await this.editOrCreate(this.pageTitle, output, summary);
        if (!result) return;

        mw.notify(`Redirect ${this.exists ? 'edited' : 'created'} successfully!`, { type: 'success' });

        /* Sync talk page checkbox handler */
        if (this.syncTalkCheckbox?.isSelected()) {
            this.submitButton.setLabel('Editing talk page...');

            const fromMove = this.tagSelect.getValue().includes('R from move');

            const output = this.createOutput(
                this.parsedDestination!.getTalkPage()!.getPrefixedText(),
                fromMove ? ['R from move'] : [],
                undefined,
                undefined,
                [],
            );

            const talkResult = await this.editOrCreate(
                this.pageTitleParsed.getTalkPage()!.getPrefixedText(),
                output,
                'Syncing redirect from subject page' + this.SCRIPT_MESSAGE,
            );
            if (!talkResult) return;

            mw.notify('Talk page synced successfully!', { type: 'success' });
        }

        /* Patrol checkbox handler */
        if (this.patrolCheckbox?.isSelected()) {
            this.submitButton.setLabel('Patrolling redirect...');

            const patrolLink: HTMLAnchorElement | null = document.querySelector('.patrollink a');
            const markReviewedButton = document.querySelector<HTMLButtonElement>('#mwe-pt-mark-as-reviewed-button');

            if (patrolLink) {
                const patrolResult = (await api
                    .postWithToken('patrol', { action: 'patrol', rcid: new URL(patrolLink.href).searchParams.get('rcid')! })
                    .catch((errorCode, errorInfo) => {
                        mw.notify(
                            `Error patrolling ${this.pageTitle} via API: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                            { type: 'error' },
                        );

                        return null;
                    })) as object | null;
                if (patrolResult) mw.notify('Redirect patrolled successfully!', { type: 'success' });
            } else if (markReviewedButton) {
                markReviewedButton.click();
                mw.notify('Redirect patrolled successfully!', { type: 'success' });
            } else mw.notify('Page curation toolbar not found, redirect cannot be patrolled!', { type: 'error' });
        }

        this.submitButton.setLabel('Complete, reloading...');

        window.location.href = mw.util.getUrl(this.pageTitle, { redirect: 'no' });
    }

    /*
     * Takes provided values to create the page output.
     */
    private createOutput(
        target: string,
        tags: string[],
        strayText: string | undefined,
        defaultSort: string | undefined,
        categories: string[],
    ) {
        const parsedTarget = mw.Title.newFromText(target);

        const formattedTitle = parsedTarget
            ? `${parsedTarget.getNamespaceId() === 14 ? ':' : ''}${parsedTarget.getPrefixedText()}${parsedTarget.getFragment() ? `#${parsedTarget.getFragment()}` : ''}`
            : target.trim();

        if (
            this.pageTitleParsed
                .getMainText()
                .toLocaleLowerCase()
                .normalize('NFD')
                .replaceAll(/[\u0300-\u036F]/g, '') ===
            defaultSort
                ?.toLowerCase()
                .normalize('NFD')
                .replaceAll(/[\u0300-\u036F]/g, '')
        )
            defaultSort = undefined; // Check if titles normalize to the same text, and removes the DEFAULTSORT if so

        const tagsWithArguments = tags.map((tag) => {
            const foundArgumentEditor = this.templateEditorsInfo.find((editorInfo) => editorInfo.name === tag);
            if (!foundArgumentEditor) return `{{${tag}}}`;

            const lastNumberParameterIndex = foundArgumentEditor.parameters.findLastIndex(
                (parameter, index) => parameter.name === (index + 1).toString() && parameter.editor.getValue().trim(),
            );

            const mappedArguments = foundArgumentEditor.parameters
                .map((parameter, index) => {
                    const value = parameter.editor.getValue().trim();
                    if (!value && index > lastNumberParameterIndex) return null;

                    return `|${parameter.name === (index + 1).toString() ? '' : `${parameter.name}=`}${value}`;
                })
                .filter(Boolean)
                .join('');

            return `{{${tag}${mappedArguments}}}`;
        });

        return [
            `#REDIRECT [[${formattedTitle}]]\n`,
            tags.length > 0 ? `{{Redirect category shell|\n${tagsWithArguments.join('\n')}\n}}\n` : null,
            strayText ? strayText + '\n' : null,
            defaultSort ? `{{DEFAULTSORT:${defaultSort.trim()}}}` : null,
            categories.length > 0 ? categories.map((category) => `[[Category:${category}]]`).join('\n') : null,
        ]
            .filter(Boolean)
            .join('\n');
    }

    /**
     * Edits or creates a page with given text.
     * @param title The page title.
     * @param text The page text.
     * @param summary The edit summary.
     */
    private async editOrCreate(title: string, text: string, summary: string) {
        let watchlist: WatchMethod = 'preferences';

        if (this.watchCheckbox)
            if (this.watchCheckbox.isIndeterminate()) watchlist = this.defaultCreatedWatchMethod;
            else if (this.watchCheckbox.isSelected()) watchlist = 'watch';
            else watchlist = 'unwatch';

        return (await api
            .edit(title, () => ({ text, summary }))
            .catch((errorCode, errorInfo) => {
                if (errorCode === 'nocreate-missing')
                    return api.create(title, { summary, watchlist }, text).catch((errorCode, errorInfo) => {
                        mw.notify(
                            `Error creating ${title}: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                            { type: 'error' },
                        );
                        return null;
                    });
                else {
                    mw.notify(
                        `Error editing or creating ${title}: ${(errorInfo as MediaWikiDataError)?.error?.info ?? 'Unknown error'} (${errorCode})`,
                        { type: 'error' },
                    );
                    return null;
                }
            })) as ReturnType<typeof api.edit> | null;
    }
}
