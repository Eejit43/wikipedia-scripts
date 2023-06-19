type MediaWikiDataError = { error: { code: string; info: string } };

type PageRevisionsResult = { query: { pages: { revisions: { slots: { main: { content: string } } }[] }[] } };
