import type { ApiQueryParams } from 'types-mediawiki/api_params';

type OneOrMore<T> = T | T[];

// Generators (modified from their ApiQueryParams counterparts)
export interface ApiQueryAllPagesGeneratorParameters extends ApiQueryParams {
    gapfrom?: string;
    gapcontinue?: string;
    gapto?: string;
    gapprefix?: string;
    gapnamespace?: number;
    gapfilterredir?: 'all' | 'nonredirects' | 'redirects';
    gapminsize?: number;
    gapmaxsize?: number;
    gapprtype?: OneOrMore<'edit' | 'move' | 'upload'>;
    gapprlevel?: OneOrMore<'' | 'autoconfirmed' | 'extendedconfirmed' | 'sysop' | 'templateeditor'>;
    gapprfiltercascade?: 'all' | 'cascading' | 'noncascading';
    gaplimit?: number | 'max';
    gapdir?: 'ascending' | 'descending';
    gapfilterlanglinks?: 'all' | 'withlanglinks' | 'withoutlanglinks';
    gapprexpiry?: 'all' | 'definite' | 'indefinite';
}

// Page searches
export interface BacklinksResult {
    query?: { backlinks: unknown[] };
}

export interface EmbeddedinResult {
    query?: { embeddedin: unknown[] };
}

export interface SearchResult {
    query?: { searchinfo: { totalhits: number } };
}

export interface CategoryMembersResult {
    query: { categorymembers: { title: string }[] };
}

export interface LinksHereResult {
    query: { pages: { linkshere?: { title: string; redirect: boolean }[] }[] };
}

export interface RedirectsResult {
    query: { pages: { redirects?: { ns: number; title: string }[] }[] };
}

// Page information
export interface PageInfoResult {
    query?: { pages: { missing?: string; redirect?: string }[] };
}

export interface PageParseResult {
    parse?: { title: string; redirects: { to: string; tofragment: string }[]; sections: { line: string }[] };
}

export interface PagepropsResult {
    query?: { pages: { pageprops?: { defaultsort?: string; disambiguation?: string; displaytitle?: string } }[] };
}

export interface CategoriesResult {
    query?: { pages: { title: string; categories?: { title: string }[] }[] };
}

export interface PageRevisionsResult {
    batchcomplete: true;
    query: {
        pages: {
            ns: number;
            title: string;
            missing?: true;
            revisions?: {
                slots: {
                    main: {
                        content: string;
                        contentmodel: string;
                        contentformat: string;
                    };
                };
            }[];
        }[];
    };
}

export interface TemplateDataParameterData {
    type: string;
    aliases: string[];
    suggested: boolean;
    required: boolean;
    default: { en: string } | null;
    example: { en: string } | null;
    description: { en: string } | null;
    label: { en: string } | null;
}

export interface TemplateDataResult {
    pages: Record<number, { params: Record<number, TemplateDataParameterData> }>;
}

// Other
export interface PageTriageListResponse {
    pagetriagelist: { pages: { user_name: string; patrol_status: string }[]; result: string }; // eslint-disable-line @typescript-eslint/naming-convention
}

export type MediaWikiDataError = { error?: { code: string; info: string } } | undefined;
