import type { ApiQueryParams } from 'types-mediawiki/api_params';

type OneOrMore<T> = T | T[];

// Page searches
export interface BacklinksResult {
    query?: { backlinks: object[] };
}

export interface EmbeddedinResult {
    query?: { embeddedin: object[] };
}

export interface SearchResult {
    query?: { searchinfo: { totalhits: number } };
}

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
    query?: { pages: { revisions: { revid: number; slots: { main: { content: string } } }[] }[] };
}

// Other
export interface PageTriageListResponse {
    pagetriagelist: { pages: { user_name: string; patrol_status: string }[]; result: string }; // eslint-disable-line @typescript-eslint/naming-convention
}

export type MediaWikiDataError = { error?: { code: string; info: string } } | undefined;
