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
  if (mw.config.get("wgUserName") !== "Eejit43" || mw.config.get("wgPageName") !== "User:Eejit43")
    return;
  const repoOwner = "Eejit43";
  const repoName = "wikipedia-scripts";
  const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", "Sync user scripts from GitHub", "sync-scripts");
  link.addEventListener("click", (event) => __async(this, null, function* () {
    event.preventDefault();
    const latestCommitHash = (yield (yield fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/commits`)).json())[0].sha;
    const scriptData = yield (yield fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/scripts.json`)).json();
    mw.notify("Syncing scripts...", { autoHide: false, tag: "sync-scripts-notification" });
    yield Promise.all(
      scriptData.map((script) => __async(this, null, function* () {
        const subpageName = `User:Eejit43/scripts/${script.name}`;
        const subpageTalkName = `User talk:Eejit43/scripts/${script.name}`;
        const scriptName = `${subpageName}.js`;
        const styleName = `${subpageName}.css`;
        const fullSubpageInfo = [
          "{{User:Eejit43/script-documentation",
          //
          script["use-instead"] ? `| use-instead       = [[User:Eejit43/scripts/${script["use-instead"]}|${script["use-instead"]}]]` : null,
          script["image-size"] ? `| image-size        = ${script["image-size"]}` : null,
          script["image-caption"] ? `| image-caption     = ${script["image-caption"]}` : null,
          script["other-authors"] ? `| other-authors     = ${script["other-authors"].map((author) => `[[User:${author}|${author}]]`).join(", ")}` : null,
          `| description-short = ${script["short-description"]}`,
          `| description       = ${script.description}`,
          `| skin-support      = {{User:Eejit43/skin-support|${Object.entries(script["skin-support"]).map(([skin, status]) => `${skin}=${status}`).join("|")}}}`,
          `| released          = {{start date and age|${script.released}}}`,
          `| updated           = {{start date and age|${script.updated}}}`,
          "}}"
        ].filter(Boolean);
        const scriptContent = yield (yield fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/dist/${script.name}.js`)).text().catch((error) => {
          console.error(error);
          return null;
        });
        const styleContent = script.css ? yield (yield fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/styles/${script.name}.css`)).text().catch((error) => {
          console.error(error);
          return null;
        }) : null;
        if (!scriptContent || script.css && !styleContent)
          return mw.notify(`Error syncing "${script.name}" from GitHub, skipping...`, { type: "error" });
        if (!script.personal) {
          yield editOrCreate(subpageName, fullSubpageInfo.join("\n"), "Syncing script documentation from GitHub");
          yield editOrCreate(subpageTalkName, "#REDIRECT [[User talk:Eejit43]]", "Redirecting script documentation talk page to main user talk page");
        }
        yield editOrCreate(scriptName, `// <nowiki>
// Note: This script was compiled from TypeScript. For a more readable version, see https://github.com/${repoOwner}/${repoName}/blob/main/scripts/${script.name}.ts

${scriptContent}
// </nowiki>`, "Syncing script from GitHub");
        if (script.css && styleContent)
          yield editOrCreate(styleName, styleContent, "Syncing CSS from GitHub");
      }))
    );
    yield editOrCreate(
      "User:Eejit43/scripts-info",
      [
        mapScripts(scriptData.filter((script) => !script.personal && !script.fork)),
        //
        "",
        "=== Personal-use scripts ===",
        mapScripts(scriptData.filter((script) => script.personal)),
        "",
        "=== Forks ===",
        mapScripts(scriptData.filter((script) => script.fork))
      ].join("\n"),
      "Syncing script list from GitHub"
    );
    mw.notify(`Synced ${scriptData.length} scripts from GitHub!`, { type: "success", tag: "sync-scripts-notification" });
    function mapScripts(scripts) {
      return scripts.map((script) => `* [[User:Eejit43/scripts/${script.name}${script.personal ? ".js" : ""}|${script.name}]] - ${script["short-description"] || script.description}${script["use-instead"] ? ' (<span style="color: #bd2828">deprecated</span>)' : ""}`).join("\n");
    }
    function editOrCreate(title, text, summary) {
      return __async(this, null, function* () {
        summary += " (via [[User:Eejit43/scripts/script-updater.js|script]])";
        yield new mw.Api().edit(title, () => ({ text, summary, watchlist: "watch" })).catch((_0, _1) => __async(this, [_0, _1], function* (errorCode, { error }) {
          if (errorCode === "nocreate-missing")
            yield new mw.Api().create(title, { summary, watchlist: "watch" }, text).catch((errorCode2, { error: error2 }) => {
              mw.notify(`Error creating ${title}: ${error2.info} (${errorCode2})`, { type: "error" });
              return;
            });
          else {
            mw.notify(`Error editing or creating ${title}: ${error.info} (${errorCode})`, { type: "error" });
            return;
          }
        }));
      });
    }
  }));
});
