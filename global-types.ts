export type MediaWikiDataError =
    | {
          error: { code: string; info: string };
      }
    | undefined;

export interface PageRevisionsResult {
    query: { pages: { revisions: { revid: number; slots: { main: { content: string } } }[] }[] };
}
