interface MediaWikiDataError {
    error: { code: string; info: string };
}

interface PageRevisionsResult {
    query: { pages: { revisions: { slots: { main: { content: string } } }[] }[] };
}
