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
mw.loader.using(["mediawiki.util"], () => {
  if (mw.config.get("wgNamespaceNumber") < 0)
    return;
  if (!mw.config.get("wgIsProbablyEditable"))
    return;
  const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", "Null edit", "null-edit");
  link.addEventListener("click", (event) => __async(this, null, function* () {
    event.preventDefault();
    mw.notify("Null editing page...", { tag: "null-edit-notification" });
    try {
      yield new mw.Api().edit(mw.config.get("wgPageName"), (text) => ({ text: text.content, summary: "Null edit- if you see this, something went wrong!", minor: true }));
    } catch (error) {
      console.error(error);
      return mw.notify("An error occurred when null editing this page!", { type: "error", tag: "null-edit-notification" });
    }
    mw.notify("Successfully null edited page, reloading...", { type: "success", tag: "null-edit-notification" });
    window.location.reload();
  }));
});
