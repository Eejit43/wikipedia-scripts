"use strict";
mw.loader.using(["mediawiki.util"], () => {
  if (mw.config.get("wgUserName") !== "Eejit43" || mw.config.get("wgPageName") !== "User:Eejit43")
    return;
  const repoOwner = "Eejit43";
  const repoName = "wikipedia-scripts";
  const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", "Sync user scripts from GitHub", "sync-scripts");
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    const latestCommitHashResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/commits`);
    if (!latestCommitHashResponse.ok)
      return mw.notify(`Failed to fetch latest commit hash from GitHub: ${latestCommitHashResponse.statusText} (${latestCommitHashResponse.status})`, {
        type: "error",
        tag: "sync-scripts-notification"
      });
    const latestCommitHash = (await latestCommitHashResponse.json())[0].sha;
    const scriptDataResponse = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/scripts.json`);
    if (!scriptDataResponse.ok)
      return mw.notify(`Failed to fetch script data from GitHub: ${scriptDataResponse.statusText} (${scriptDataResponse.status})`, { type: "error", tag: "sync-scripts-notification" });
    const scriptData = await scriptDataResponse.json();
    mw.notify("Syncing scripts...", { autoHide: false, tag: "sync-scripts-notification" });
    await Promise.all(
      scriptData.map(async (script) => {
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
          script.usage ? `| usage             = ${script.usage}` : null,
          `| skin-support      = {{User:Eejit43/skin-support|${Object.entries(script["skin-support"]).map(([skin, status]) => `${skin}=${status}`).join("|")}}}`,
          `| released          = {{start date and age|${script.released}}}`,
          `| updated           = {{start date and age|${script.updated}}}`,
          "}}"
        ].filter(Boolean);
        let scriptContent = null;
        const scriptContentResponse = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/dist/scripts/${script.name}.js`);
        if (scriptContentResponse.ok)
          scriptContent = await scriptContentResponse.text();
        else
          return mw.notify(`Failed to fetch "${script.name}.js" from GitHub: ${scriptContentResponse.statusText} (${scriptContentResponse.status})`, {
            type: "error",
            tag: "sync-scripts-notification"
          });
        let styleContent = null;
        if (script.css) {
          const styleContentResponse = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/${latestCommitHash}/dist/styles/${script.name}.css`);
          if (styleContentResponse.ok)
            styleContent = await styleContentResponse.text();
          else
            mw.notify(`Failed to fetch "${script.name}.css" from GitHub: ${styleContentResponse.statusText} (${styleContentResponse.status})`, {
              type: "error",
              tag: "sync-scripts-notification"
            });
        }
        if (!script.personal) {
          await editOrCreate(subpageName, fullSubpageInfo.join("\n"), "Syncing script documentation from GitHub");
          await editOrCreate(subpageTalkName, "#REDIRECT [[User talk:Eejit43]]", "Redirecting script documentation talk page to main user talk page");
        }
        if (scriptContent)
          await editOrCreate(
            scriptName,
            `// <nowiki>
// Note: This script was compiled from TypeScript. For a more readable version, see https://github.com/${repoOwner}/${repoName}/blob/main/scripts/${script.name}.ts

${scriptContent}
// </nowiki>`,
            "Syncing script from GitHub"
          );
        if (script.css && styleContent)
          await editOrCreate(
            styleName,
            `/* <nowiki> */
/* Note: This script was compiled from modern CSS. For a more readable version, see https://github.com/${repoOwner}/${repoName}/blob/main/styles/${script.name}.css */

${styleContent}
/* </nowiki> */`,
            "Syncing styles from GitHub"
          );
      })
    );
    await editOrCreate(
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
      return scripts.map(
        (script) => `* [[User:Eejit43/scripts/${script.name}${script.personal ? ".js" : ""}|${script.name}]] - ${script["short-description"] || script.description}${script["use-instead"] ? ' (<span style="color: #bd2828">deprecated</span>)' : ""}`
      ).join("\n");
    }
    async function editOrCreate(title, text, summary) {
      summary += " (via [[User:Eejit43/scripts/script-updater.js|script]])";
      await new mw.Api().edit(title, () => ({ text, summary, watchlist: "watch" })).catch(async (errorCode, errorInfo) => {
        if (errorCode === "nocreate-missing")
          await new mw.Api().create(title, { summary, watchlist: "watch" }, text).catch((errorCode2, errorInfo2) => {
            mw.notify(`Error creating ${title}: ${errorInfo2?.error.info ?? "Unknown error"} (${errorCode2})`, { type: "error" });
            return;
          });
        else {
          mw.notify(`Error editing or creating ${title}: ${errorInfo?.error.info ?? "Unknown error"} (${errorCode})`, { type: "error" });
          return;
        }
      });
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9zY3JpcHQtdXBkYXRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgTWVkaWFXaWtpRGF0YUVycm9yIH0gZnJvbSAnLi4vZ2xvYmFsLXR5cGVzJztcblxuaW50ZXJmYWNlIFNjcmlwdCB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgICd1c2UtaW5zdGVhZCc/OiBzdHJpbmc7XG4gICAgJ2ltYWdlLXNpemUnPzogc3RyaW5nO1xuICAgICdpbWFnZS1jYXB0aW9uJz86IHN0cmluZztcbiAgICAnc2hvcnQtZGVzY3JpcHRpb24nOiBzdHJpbmc7XG4gICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICB1c2FnZT86IHN0cmluZztcbiAgICAnb3RoZXItYXV0aG9ycyc/OiBzdHJpbmdbXTtcbiAgICBmb3JrPzogdHJ1ZTtcbiAgICBwZXJzb25hbD86IHRydWU7XG4gICAgJ3NraW4tc3VwcG9ydCc6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+O1xuICAgIHJlbGVhc2VkOiBzdHJpbmc7XG4gICAgdXBkYXRlZDogc3RyaW5nO1xuICAgIGNzcz86IHRydWU7XG59XG5cbm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sICgpID0+IHtcbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dVc2VyTmFtZScpICE9PSAnRWVqaXQ0MycgfHwgbXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpICE9PSAnVXNlcjpFZWppdDQzJykgcmV0dXJuO1xuXG4gICAgY29uc3QgcmVwb093bmVyID0gJ0Vlaml0NDMnO1xuICAgIGNvbnN0IHJlcG9OYW1lID0gJ3dpa2lwZWRpYS1zY3JpcHRzJztcblxuICAgIGNvbnN0IGxpbmsgPSBtdy51dGlsLmFkZFBvcnRsZXRMaW5rKG13LmNvbmZpZy5nZXQoJ3NraW4nKSA9PT0gJ21pbmVydmEnID8gJ3AtdGInIDogJ3AtY2FjdGlvbnMnLCAnIycsICdTeW5jIHVzZXIgc2NyaXB0cyBmcm9tIEdpdEh1YicsICdzeW5jLXNjcmlwdHMnKSE7XG5cbiAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgY29uc3QgbGF0ZXN0Q29tbWl0SGFzaFJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvJHtyZXBvT3duZXJ9LyR7cmVwb05hbWV9L2NvbW1pdHNgKTtcbiAgICAgICAgaWYgKCFsYXRlc3RDb21taXRIYXNoUmVzcG9uc2Uub2spXG4gICAgICAgICAgICByZXR1cm4gbXcubm90aWZ5KGBGYWlsZWQgdG8gZmV0Y2ggbGF0ZXN0IGNvbW1pdCBoYXNoIGZyb20gR2l0SHViOiAke2xhdGVzdENvbW1pdEhhc2hSZXNwb25zZS5zdGF0dXNUZXh0fSAoJHtsYXRlc3RDb21taXRIYXNoUmVzcG9uc2Uuc3RhdHVzfSlgLCB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICB0YWc6ICdzeW5jLXNjcmlwdHMtbm90aWZpY2F0aW9uJyxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGxhdGVzdENvbW1pdEhhc2ggPSAoKGF3YWl0IGxhdGVzdENvbW1pdEhhc2hSZXNwb25zZS5qc29uKCkpIGFzIHsgc2hhOiBzdHJpbmcgfVtdKVswXS5zaGE7XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0RGF0YVJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS8ke3JlcG9Pd25lcn0vJHtyZXBvTmFtZX0vJHtsYXRlc3RDb21taXRIYXNofS9zY3JpcHRzLmpzb25gKTtcbiAgICAgICAgaWYgKCFzY3JpcHREYXRhUmVzcG9uc2Uub2spXG4gICAgICAgICAgICByZXR1cm4gbXcubm90aWZ5KGBGYWlsZWQgdG8gZmV0Y2ggc2NyaXB0IGRhdGEgZnJvbSBHaXRIdWI6ICR7c2NyaXB0RGF0YVJlc3BvbnNlLnN0YXR1c1RleHR9ICgke3NjcmlwdERhdGFSZXNwb25zZS5zdGF0dXN9KWAsIHsgdHlwZTogJ2Vycm9yJywgdGFnOiAnc3luYy1zY3JpcHRzLW5vdGlmaWNhdGlvbicgfSk7XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0RGF0YSA9IChhd2FpdCBzY3JpcHREYXRhUmVzcG9uc2UuanNvbigpKSBhcyBTY3JpcHRbXTtcblxuICAgICAgICBtdy5ub3RpZnkoJ1N5bmNpbmcgc2NyaXB0cy4uLicsIHsgYXV0b0hpZGU6IGZhbHNlLCB0YWc6ICdzeW5jLXNjcmlwdHMtbm90aWZpY2F0aW9uJyB9KTtcblxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIHNjcmlwdERhdGEubWFwKGFzeW5jIChzY3JpcHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWJwYWdlTmFtZSA9IGBVc2VyOkVlaml0NDMvc2NyaXB0cy8ke3NjcmlwdC5uYW1lfWA7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3VicGFnZVRhbGtOYW1lID0gYFVzZXIgdGFsazpFZWppdDQzL3NjcmlwdHMvJHtzY3JpcHQubmFtZX1gO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjcmlwdE5hbWUgPSBgJHtzdWJwYWdlTmFtZX0uanNgO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0eWxlTmFtZSA9IGAke3N1YnBhZ2VOYW1lfS5jc3NgO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFN1YnBhZ2VJbmZvID0gW1xuICAgICAgICAgICAgICAgICAgICAne3tVc2VyOkVlaml0NDMvc2NyaXB0LWRvY3VtZW50YXRpb24nLCAvL1xuICAgICAgICAgICAgICAgICAgICBzY3JpcHRbJ3VzZS1pbnN0ZWFkJ10gPyBgfCB1c2UtaW5zdGVhZCAgICAgICA9IFtbVXNlcjpFZWppdDQzL3NjcmlwdHMvJHtzY3JpcHRbJ3VzZS1pbnN0ZWFkJ119fCR7c2NyaXB0Wyd1c2UtaW5zdGVhZCddfV1dYCA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdFsnaW1hZ2Utc2l6ZSddID8gYHwgaW1hZ2Utc2l6ZSAgICAgICAgPSAke3NjcmlwdFsnaW1hZ2Utc2l6ZSddfWAgOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBzY3JpcHRbJ2ltYWdlLWNhcHRpb24nXSA/IGB8IGltYWdlLWNhcHRpb24gICAgID0gJHtzY3JpcHRbJ2ltYWdlLWNhcHRpb24nXX1gIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0WydvdGhlci1hdXRob3JzJ10gPyBgfCBvdGhlci1hdXRob3JzICAgICA9ICR7c2NyaXB0WydvdGhlci1hdXRob3JzJ10ubWFwKChhdXRob3IpID0+IGBbW1VzZXI6JHthdXRob3J9fCR7YXV0aG9yfV1dYCkuam9pbignLCAnKX1gIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYHwgZGVzY3JpcHRpb24tc2hvcnQgPSAke3NjcmlwdFsnc2hvcnQtZGVzY3JpcHRpb24nXX1gLFxuICAgICAgICAgICAgICAgICAgICBgfCBkZXNjcmlwdGlvbiAgICAgICA9ICR7c2NyaXB0LmRlc2NyaXB0aW9ufWAsXG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdC51c2FnZSA/IGB8IHVzYWdlICAgICAgICAgICAgID0gJHtzY3JpcHQudXNhZ2V9YCA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGB8IHNraW4tc3VwcG9ydCAgICAgID0ge3tVc2VyOkVlaml0NDMvc2tpbi1zdXBwb3J0fCR7T2JqZWN0LmVudHJpZXMoc2NyaXB0Wydza2luLXN1cHBvcnQnXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKFtza2luLCBzdGF0dXNdKSA9PiBgJHtza2lufT0ke3N0YXR1c31gKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJ3wnKX19fWAsXG4gICAgICAgICAgICAgICAgICAgIGB8IHJlbGVhc2VkICAgICAgICAgID0ge3tzdGFydCBkYXRlIGFuZCBhZ2V8JHtzY3JpcHQucmVsZWFzZWR9fX1gLFxuICAgICAgICAgICAgICAgICAgICBgfCB1cGRhdGVkICAgICAgICAgICA9IHt7c3RhcnQgZGF0ZSBhbmQgYWdlfCR7c2NyaXB0LnVwZGF0ZWR9fX1gLFxuICAgICAgICAgICAgICAgICAgICAnfX0nLFxuICAgICAgICAgICAgICAgIF0uZmlsdGVyKEJvb2xlYW4pO1xuXG4gICAgICAgICAgICAgICAgbGV0IHNjcmlwdENvbnRlbnQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2NyaXB0Q29udGVudFJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS8ke3JlcG9Pd25lcn0vJHtyZXBvTmFtZX0vJHtsYXRlc3RDb21taXRIYXNofS9kaXN0L3NjcmlwdHMvJHtzY3JpcHQubmFtZX0uanNgKTtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0Q29udGVudFJlc3BvbnNlLm9rKSBzY3JpcHRDb250ZW50ID0gYXdhaXQgc2NyaXB0Q29udGVudFJlc3BvbnNlLnRleHQoKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtdy5ub3RpZnkoYEZhaWxlZCB0byBmZXRjaCBcIiR7c2NyaXB0Lm5hbWV9LmpzXCIgZnJvbSBHaXRIdWI6ICR7c2NyaXB0Q29udGVudFJlc3BvbnNlLnN0YXR1c1RleHR9ICgke3NjcmlwdENvbnRlbnRSZXNwb25zZS5zdGF0dXN9KWAsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWc6ICdzeW5jLXNjcmlwdHMtbm90aWZpY2F0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgc3R5bGVDb250ZW50ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0LmNzcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdHlsZUNvbnRlbnRSZXNwb25zZSA9IGF3YWl0IGZldGNoKGBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vJHtyZXBvT3duZXJ9LyR7cmVwb05hbWV9LyR7bGF0ZXN0Q29tbWl0SGFzaH0vZGlzdC9zdHlsZXMvJHtzY3JpcHQubmFtZX0uY3NzYCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0eWxlQ29udGVudFJlc3BvbnNlLm9rKSBzdHlsZUNvbnRlbnQgPSBhd2FpdCBzdHlsZUNvbnRlbnRSZXNwb25zZS50ZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIG13Lm5vdGlmeShgRmFpbGVkIHRvIGZldGNoIFwiJHtzY3JpcHQubmFtZX0uY3NzXCIgZnJvbSBHaXRIdWI6ICR7c3R5bGVDb250ZW50UmVzcG9uc2Uuc3RhdHVzVGV4dH0gKCR7c3R5bGVDb250ZW50UmVzcG9uc2Uuc3RhdHVzfSlgLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YWc6ICdzeW5jLXNjcmlwdHMtbm90aWZpY2F0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghc2NyaXB0LnBlcnNvbmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGVkaXRPckNyZWF0ZShzdWJwYWdlTmFtZSwgZnVsbFN1YnBhZ2VJbmZvLmpvaW4oJ1xcbicpLCAnU3luY2luZyBzY3JpcHQgZG9jdW1lbnRhdGlvbiBmcm9tIEdpdEh1YicpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBlZGl0T3JDcmVhdGUoc3VicGFnZVRhbGtOYW1lLCAnI1JFRElSRUNUIFtbVXNlciB0YWxrOkVlaml0NDNdXScsICdSZWRpcmVjdGluZyBzY3JpcHQgZG9jdW1lbnRhdGlvbiB0YWxrIHBhZ2UgdG8gbWFpbiB1c2VyIHRhbGsgcGFnZScpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzY3JpcHRDb250ZW50KVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBlZGl0T3JDcmVhdGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JpcHROYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgYC8vIDxub3dpa2k+XFxuLy8gTm90ZTogVGhpcyBzY3JpcHQgd2FzIGNvbXBpbGVkIGZyb20gVHlwZVNjcmlwdC4gRm9yIGEgbW9yZSByZWFkYWJsZSB2ZXJzaW9uLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tLyR7cmVwb093bmVyfS8ke3JlcG9OYW1lfS9ibG9iL21haW4vc2NyaXB0cy8ke3NjcmlwdC5uYW1lfS50c1xcblxcbiR7c2NyaXB0Q29udGVudH1cXG4vLyA8L25vd2lraT5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ1N5bmNpbmcgc2NyaXB0IGZyb20gR2l0SHViJyxcbiAgICAgICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIGlmIChzY3JpcHQuY3NzICYmIHN0eWxlQ29udGVudClcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgZWRpdE9yQ3JlYXRlKFxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgYC8qIDxub3dpa2k+ICovXFxuLyogTm90ZTogVGhpcyBzY3JpcHQgd2FzIGNvbXBpbGVkIGZyb20gbW9kZXJuIENTUy4gRm9yIGEgbW9yZSByZWFkYWJsZSB2ZXJzaW9uLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tLyR7cmVwb093bmVyfS8ke3JlcG9OYW1lfS9ibG9iL21haW4vc3R5bGVzLyR7c2NyaXB0Lm5hbWV9LmNzcyAqL1xcblxcbiR7c3R5bGVDb250ZW50fVxcbi8qIDwvbm93aWtpPiAqL2AsXG4gICAgICAgICAgICAgICAgICAgICAgICAnU3luY2luZyBzdHlsZXMgZnJvbSBHaXRIdWInLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgYXdhaXQgZWRpdE9yQ3JlYXRlKFxuICAgICAgICAgICAgJ1VzZXI6RWVqaXQ0My9zY3JpcHRzLWluZm8nLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAgIG1hcFNjcmlwdHMoc2NyaXB0RGF0YS5maWx0ZXIoKHNjcmlwdCkgPT4gIXNjcmlwdC5wZXJzb25hbCAmJiAhc2NyaXB0LmZvcmspKSwgLy9cbiAgICAgICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICAgICAnPT09IFBlcnNvbmFsLXVzZSBzY3JpcHRzID09PScsXG4gICAgICAgICAgICAgICAgbWFwU2NyaXB0cyhzY3JpcHREYXRhLmZpbHRlcigoc2NyaXB0KSA9PiBzY3JpcHQucGVyc29uYWwpKSxcbiAgICAgICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICAgICAnPT09IEZvcmtzID09PScsXG4gICAgICAgICAgICAgICAgbWFwU2NyaXB0cyhzY3JpcHREYXRhLmZpbHRlcigoc2NyaXB0KSA9PiBzY3JpcHQuZm9yaykpLFxuICAgICAgICAgICAgXS5qb2luKCdcXG4nKSxcbiAgICAgICAgICAgICdTeW5jaW5nIHNjcmlwdCBsaXN0IGZyb20gR2l0SHViJyxcbiAgICAgICAgKTtcblxuICAgICAgICBtdy5ub3RpZnkoYFN5bmNlZCAke3NjcmlwdERhdGEubGVuZ3RofSBzY3JpcHRzIGZyb20gR2l0SHViIWAsIHsgdHlwZTogJ3N1Y2Nlc3MnLCB0YWc6ICdzeW5jLXNjcmlwdHMtbm90aWZpY2F0aW9uJyB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWFwcyBzY3JpcHRzIHRvIGEgYnVsbGV0ZWQgbGlzdC5cbiAgICAgICAgICogQHBhcmFtIHNjcmlwdHMgVGhlIHNjcmlwdHMgdG8gbWFwLlxuICAgICAgICAgKiBAcmV0dXJucyBUaGUgbWFwcGVkIHNjcmlwdHMuXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBtYXBTY3JpcHRzKHNjcmlwdHM6IFNjcmlwdFtdKSB7XG4gICAgICAgICAgICByZXR1cm4gc2NyaXB0c1xuICAgICAgICAgICAgICAgIC5tYXAoXG4gICAgICAgICAgICAgICAgICAgIChzY3JpcHQpID0+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKiBbW1VzZXI6RWVqaXQ0My9zY3JpcHRzLyR7c2NyaXB0Lm5hbWV9JHtzY3JpcHQucGVyc29uYWwgPyAnLmpzJyA6ICcnfXwke3NjcmlwdC5uYW1lfV1dIC0gJHtzY3JpcHRbJ3Nob3J0LWRlc2NyaXB0aW9uJ10gfHwgc2NyaXB0LmRlc2NyaXB0aW9ufSR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NyaXB0Wyd1c2UtaW5zdGVhZCddID8gJyAoPHNwYW4gc3R5bGU9XCJjb2xvcjogI2JkMjgyOFwiPmRlcHJlY2F0ZWQ8L3NwYW4+KScgOiAnJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfWAsXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIC5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBFZGl0cyBhIHBhZ2UsIG9yIGNyZWF0ZXMgaXQgaWYgaXQgZG9lc24ndCBleGlzdC5cbiAgICAgICAgICogQHBhcmFtIHRpdGxlIFRoZSB0aXRsZSBvZiB0aGUgcGFnZSB0byBlZGl0LlxuICAgICAgICAgKiBAcGFyYW0gdGV4dCBUaGUgcGFnZSBjb250ZW50IHRvIHNldC5cbiAgICAgICAgICogQHBhcmFtIHN1bW1hcnkgVGhlIGVkaXQgc3VtbWFyeSAod2lsbCBhcHBlbmQgc2NyaXB0IG5vdGljZSkuXG4gICAgICAgICAqL1xuICAgICAgICBhc3luYyBmdW5jdGlvbiBlZGl0T3JDcmVhdGUodGl0bGU6IHN0cmluZywgdGV4dDogc3RyaW5nLCBzdW1tYXJ5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgICAgIHN1bW1hcnkgKz0gJyAodmlhIFtbVXNlcjpFZWppdDQzL3NjcmlwdHMvc2NyaXB0LXVwZGF0ZXIuanN8c2NyaXB0XV0pJztcbiAgICAgICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKVxuICAgICAgICAgICAgICAgIC5lZGl0KHRpdGxlLCAoKSA9PiAoeyB0ZXh0LCBzdW1tYXJ5LCB3YXRjaGxpc3Q6ICd3YXRjaCcgfSkpXG4gICAgICAgICAgICAgICAgLmNhdGNoKGFzeW5jIChlcnJvckNvZGU6IHN0cmluZywgZXJyb3JJbmZvOiBNZWRpYVdpa2lEYXRhRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yQ29kZSA9PT0gJ25vY3JlYXRlLW1pc3NpbmcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmNyZWF0ZSh0aXRsZSwgeyBzdW1tYXJ5LCB3YXRjaGxpc3Q6ICd3YXRjaCcgfSwgdGV4dCkuY2F0Y2goKGVycm9yQ29kZTogc3RyaW5nLCBlcnJvckluZm86IE1lZGlhV2lraURhdGFFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG13Lm5vdGlmeShgRXJyb3IgY3JlYXRpbmcgJHt0aXRsZX06ICR7ZXJyb3JJbmZvPy5lcnJvci5pbmZvID8/ICdVbmtub3duIGVycm9yJ30gKCR7ZXJyb3JDb2RlfSlgLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbXcubm90aWZ5KGBFcnJvciBlZGl0aW5nIG9yIGNyZWF0aW5nICR7dGl0bGV9OiAke2Vycm9ySW5mbz8uZXJyb3IuaW5mbyA/PyAnVW5rbm93biBlcnJvcid9ICgke2Vycm9yQ29kZX0pYCwgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQW1CQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixHQUFHLE1BQU07QUFDdEMsTUFBSSxHQUFHLE9BQU8sSUFBSSxZQUFZLE1BQU0sYUFBYSxHQUFHLE9BQU8sSUFBSSxZQUFZLE1BQU07QUFBZ0I7QUFFakcsUUFBTSxZQUFZO0FBQ2xCLFFBQU0sV0FBVztBQUVqQixRQUFNLE9BQU8sR0FBRyxLQUFLLGVBQWUsR0FBRyxPQUFPLElBQUksTUFBTSxNQUFNLFlBQVksU0FBUyxjQUFjLEtBQUssaUNBQWlDLGNBQWM7QUFFckosT0FBSyxpQkFBaUIsU0FBUyxPQUFPLFVBQVU7QUFDNUMsVUFBTSxlQUFlO0FBRXJCLFVBQU0sMkJBQTJCLE1BQU0sTUFBTSxnQ0FBZ0MsU0FBUyxJQUFJLFFBQVEsVUFBVTtBQUM1RyxRQUFJLENBQUMseUJBQXlCO0FBQzFCLGFBQU8sR0FBRyxPQUFPLG1EQUFtRCx5QkFBeUIsVUFBVSxLQUFLLHlCQUF5QixNQUFNLEtBQUs7QUFBQSxRQUM1SSxNQUFNO0FBQUEsUUFDTixLQUFLO0FBQUEsTUFDVCxDQUFDO0FBRUwsVUFBTSxvQkFBcUIsTUFBTSx5QkFBeUIsS0FBSyxHQUF5QixDQUFDLEVBQUU7QUFFM0YsVUFBTSxxQkFBcUIsTUFBTSxNQUFNLHFDQUFxQyxTQUFTLElBQUksUUFBUSxJQUFJLGdCQUFnQixlQUFlO0FBQ3BJLFFBQUksQ0FBQyxtQkFBbUI7QUFDcEIsYUFBTyxHQUFHLE9BQU8sNENBQTRDLG1CQUFtQixVQUFVLEtBQUssbUJBQW1CLE1BQU0sS0FBSyxFQUFFLE1BQU0sU0FBUyxLQUFLLDRCQUE0QixDQUFDO0FBRXBMLFVBQU0sYUFBYyxNQUFNLG1CQUFtQixLQUFLO0FBRWxELE9BQUcsT0FBTyxzQkFBc0IsRUFBRSxVQUFVLE9BQU8sS0FBSyw0QkFBNEIsQ0FB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Q1IsQ0FBQztBQUFBLElBQ0w7QUFFQSxVQUFNO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNJLFdBQVcsV0FBVyxPQUFPLENBQUMsV0FBVyxDQUFDLE9BQU8sWUFBWSxDQUFDLE9BQU8sSUFBSSxDQUFDO0FBQUE7QUFBQSxRQUMxRTtBQUFBLFFBQ0E7QUFBQSxRQUNBLFdBQVcsV0FBVyxPQUFPLENBQUMsV0FBVyxPQUFPLFFBQVEsQ0FBQztBQUFBLFFBQ3pEO0FBQUEsUUFDQTtBQUFBLFFBQ0EsV0FBVyxXQUFXLE9BQU8sQ0FBQyxXQUFXLE9BQU8sSUFBSSxDQUFDO0FBQUEsTUFDekQsRUFBRSxLQUFLLElBQUk7QUFBQSxNQUNYO0FBQUEsSUFDSjtBQUVBLE9BQUcsT0FBTyxVQUFVLFdBQVcsTUFBTSx5QkFBeUIsRUFBRSxNQUFNLFdBQVcsS0FBSyw0QkFBNEIsQ0FBQztBQU9uSCxhQUFTLFdBQVcsU0FBbUI7QUFDbkMsYUFBTyxRQUNGO0FBQUEsUUFDRyxDQUFDLFdBQ0csNEJBQTRCLE9BQU8sSUFBSSxHQUFHLE9BQU8sV0FBVyxRQUFRLEVBQUUsSUFBSSxPQUFPLElBQUksUUFBUSxPQUFPLG1CQUFtQixLQUFLLE9BQU8sV0FBVyxHQUMxSSxPQUFPLGFBQWEsSUFBSSxzREFBc0QsRUFDbEY7QUFBQSxNQUNSLEVBQ0MsS0FBSyxJQUFJO0FBQUEsSUFDbEI7QUFRQSxtQkFBZSxhQUFhLE9BQWUsTUFBYyxTQUFnQztBQUNyRixpQkFBVztBQUNYLFlBQU0sSUFBSSxHQUFHLElBQUksRUFDWixLQUFLLE9BQU8sT0FBTyxFQUFFLE1BQU0sU0FBUyxXQUFXLFFBQVEsRUFBRSxFQUN6RCxNQUFNLE9BQU8sV0FBbUIsY0FBa0M7QUFDL0QsWUFBSSxjQUFjO0FBQ2QsZ0JBQU0sSUFBSSxHQUFHLElBQUksRUFBRSxPQUFPLE9BQU8sRUFBRSxTQUFTLFdBQVcsUUFBUSxHQUFHLElBQUksRUFBRSxNQUFNLENBQUNBLFlBQW1CQyxlQUFrQztBQUNoSSxlQUFHLE9BQU8sa0JBQWtCLEtBQUssS0FBS0EsWUFBVyxNQUFNLFFBQVEsZUFBZSxLQUFLRCxVQUFTLEtBQUssRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUNsSDtBQUFBLFVBQ0osQ0FBQztBQUFBLGFBQ0E7QUFDRCxhQUFHLE9BQU8sNkJBQTZCLEtBQUssS0FBSyxXQUFXLE1BQU0sUUFBUSxlQUFlLEtBQUssU0FBUyxLQUFLLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDN0g7QUFBQSxRQUNKO0FBQUEsTUFDSixDQUFDO0FBQUEsSUFDVDtBQUFBLEVBQ0osQ0FBQztBQUNMLENBQUM7IiwKICAibmFtZXMiOiBbImVycm9yQ29kZSIsICJlcnJvckluZm8iXQp9Cg==
