"use strict";
mw.loader.using(["mediawiki.util"], async () => {
  if (mw.config.get("wgNamespaceNumber") !== 0)
    return;
  if (mw.config.get("wgAction") !== "view")
    return;
  if (mw.config.get("wgPageName") === "Main_Page")
    return;
  mw.util.addCSS(`
#deletion-finder-previously-deleted {
    color: #dd3333;
    display: inline-block;
    font-size: 12px;
    margin-left: 5px;
}

#deletion-finder-previously-deleted::before {
    content: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22%23dd3333%22 viewBox=%220 0 20 20%22%3E%3Ctitle%3E trash %3C/title%3E%3Cpath d=%22M17 2h-3.5l-1-1h-5l-1 1H3v2h14zM4 17a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5H4z%22/%3E%3C/svg%3E");
    display: inline-block;
    margin-right: 3px;
    transform: translateY(2px);
}

#deletion-finder-previous-afd {
    color: #3366cc;
    display: inline-block;
    font-size: 12px;
    margin-left: 5px;
}

#deletion-finder-previous-afd::before {
    content: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2215%22 height=%2215%22 fill=%22%233366cc%22 viewBox=%220 0 20 20%22%3E%3Ctitle%3E info %3C/title%3E%3Cpath d=%22M4 10a6 6 0 1 0 12 0 6 6 0 0 0-12 0m6-8a8 8 0 1 1 0 16 8 8 0 0 1 0-16m1 7v5H9V9zm0-1V6H9v2z%22/%3E%3C/svg%3E");
    display: inline-block;
    margin-right: 3px;
    transform: translateY(2px);
}
`);
  const titleElement = document.querySelector("#firstHeading");
  if (!titleElement)
    return mw.notify("Could not find title element", { type: "error" });
  const deletionResult = await new mw.Api().get({
    action: "query",
    leaction: "delete/delete",
    lelimit: "1",
    letitle: mw.config.get("wgPageName"),
    list: "logevents"
  });
  if (deletionResult.query.logevents.length > 0) {
    const link = document.createElement("a");
    link.id = "deletion-finder-previously-deleted";
    link.href = mw.util.getUrl("Special:Log/delete", { page: mw.config.get("wgPageName").replaceAll("_", " "), subtype: "delete" });
    link.target = "_blank";
    link.textContent = "Previously deleted";
    titleElement.append(link);
  }
  const afdExists = await new mw.Api().get({ action: "query", formatversion: 2, titles: `Wikipedia:Articles_for_deletion/${mw.config.get("wgPageName")}` });
  if (!afdExists.query.pages[0].missing) {
    const link = document.createElement("a");
    link.id = "deletion-finder-previous-afd";
    link.href = mw.util.getUrl("Special:AllPages", { from: `Articles for deletion/${mw.config.get("wgPageName").replaceAll("_", " ")}`, to: `Articles for deletion/${mw.config.get("wgPageName").replaceAll("_", " ")} (9z)`, namespace: "4" });
    link.target = "_blank";
    link.textContent = "Previously at AfD";
    titleElement.append(link);
  }
});
