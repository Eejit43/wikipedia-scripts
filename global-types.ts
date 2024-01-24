// Page searches
export interface AllPagesGeneratorResult {
    query: { pages: { title: string; pageprops: { disambiguation?: string }; redirect?: string }[] };
}

export interface BacklinksResult {
    query: { backlinks: object[] };
}

export interface EmbeddedinResult {
    query: { embeddedin: object[] };
}

export interface SearchResult {
    query: { searchinfo: { totalhits: number } };
}

// Page information
export interface PageInfoResult {
    query: { pages: { missing?: string; redirect?: string }[] };
}

export interface PageParseResult {
    parse: { title: string; redirects: { to: string; tofragment: string }[]; sections: { line: string }[] };
}

export interface PagepropsResult {
    query: { pages: { pageprops?: { disambiguation?: string } }[] };
}

export interface PageRevisionsResult {
    query: { pages: { revisions: { revid: number; slots: { main: { content: string } } }[] }[] };
}

// Other
export interface PageTriageListResponse {
    pagetriagelist: { pages: { user_name: string; patrol_status: string }[]; result: string }; // eslint-disable-line @typescript-eslint/naming-convention
}

export interface UserPermissionsResponse {
    query: { userinfo: { rights: string[] } };
}

export type MediaWikiDataError =
    | {
          error: { code: string; info: string };
      }
    | undefined;
