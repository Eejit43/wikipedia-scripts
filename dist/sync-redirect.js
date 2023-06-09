"use strict";
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
mw.loader.using(["mediawiki.util"], () => __async(this, null, function* () {
  if (!mw.Title.isTalkNamespace(mw.config.get("wgNamespaceNumber")))
    return;
  const mainPageInfoRevisions = yield new mw.Api().get({ action: "query", formatversion: 2, prop: "info|revisions", rvprop: "content", rvslots: "*", titles: `${mw.config.get("wgFormattedNamespaces")[mw.config.get("wgNamespaceNumber") - 1]}:${mw.config.get("wgTitle")}` });
  if (!mainPageInfoRevisions.query.pages[0].redirect)
    return;
  const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", "Sync with main page redirect", "sync-redirect");
  link.addEventListener("click", (event) => __async(this, null, function* () {
    var _a;
    event.preventDefault();
    mw.notify("Editing...", { tag: "sync-redirect-notification" });
    const mainPageContent = mainPageInfoRevisions.query.pages[0].revisions[0].slots.main.content;
    const redirectTarget = (_a = /#REDIRECT:? *\[\[(.+)\]\]/i.exec(mainPageContent)) == null ? void 0 : _a[1].replaceAll("_", " ").split("|")[0].split("#")[0].trim();
    if (!redirectTarget)
      return mw.notify("Failed to parse redirect target!", { type: "error", tag: "sync-redirect-notification" });
    const redirectTargetParsed = new DOMParser().parseFromString(redirectTarget, "text/html").documentElement.textContent;
    if (!redirectTargetParsed)
      return mw.notify("Failed to parse redirect target!", { type: "error", tag: "sync-redirect-notification" });
    const mwRedirectTarget = mw.Title.newFromText(redirectTargetParsed);
    if (!mwRedirectTarget)
      return mw.notify("Failed to parse redirect target!", { type: "error", tag: "sync-redirect-notification" });
    const mainTargetText = mwRedirectTarget.getMainText();
    const pageMove = /{{ *r(edirect)?( from)?(( a)? page)? (move|rename|pm) *}}/i.test(mainPageContent);
    const destinationTalkNamespaceName = mw.config.get("wgFormattedNamespaces")[mwRedirectTarget.getNamespaceId() + 1];
    yield new mw.Api().edit(mw.config.get("wgPageName"), () => ({ text: `#REDIRECT [[${destinationTalkNamespaceName}:${mainTargetText}]]${pageMove ? "\n\n{{Redirect category shell|\n{{R from move}}\n}}" : ""}`, summary: `Sync redirect with main page, to [[${destinationTalkNamespaceName}:${mainTargetText}]] (via [[User:Eejit43/scripts/sync-redirect|script]])`, minor: true })).catch((_0, _1) => __async(this, [_0, _1], function* (errorCode, { error }) {
      if (errorCode === "nocreate-missing")
        yield new mw.Api().create(mw.config.get("wgPageName"), { summary: `Create redirect matching main page, to [[${destinationTalkNamespaceName}:${mainTargetText}]] (via [[User:Eejit43/scripts/sync-redirect|script]])` }, `#REDIRECT [[${destinationTalkNamespaceName}:${mainTargetText}]]${pageMove ? "\n\n{{Redirect category shell|\n{{R from move}}\n}}" : ""}`).catch((errorCode2, { error: error2 }) => {
          mw.notify(`Failed to redirect page: ${error2.info} (${errorCode2})`, { type: "error", tag: "sync-redirect-notification" });
        });
      else
        mw.notify(`Failed to redirect page: ${error.info} (${errorCode})`, { type: "error", tag: "sync-redirect-notification" });
    }));
    mw.notify("Successfully redirected page, reloading...", { type: "success", tag: "sync-redirect-notification" });
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("redirect", "no");
    window.location.href = newUrl.href;
  }));
}));
