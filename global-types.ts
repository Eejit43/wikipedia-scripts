export type MediaWikiDataError =
    | {
          error: { code: string; info: string };
      }
    | undefined;

export interface PageRevisionsResult {
    query: { pages: { revisions: { slots: { main: { content: string } } }[] }[] };
}
