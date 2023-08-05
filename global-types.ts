export interface MediaWikiDataError {
    error: { code: string; info: string };
}

export interface PageRevisionsResult {
    query: { pages: { revisions: { slots: { main: { content: string } } }[] }[] };
}
