"use strict";
mw.loader.using(["mediawiki.util", "oojs-ui-core", "oojs-ui-widgets", "oojs-ui.styles.icons-content", "oojs-ui.styles.icons-editing-core"], async () => {
  if (mw.config.get("wgNamespaceNumber") < 0)
    return;
  if (!mw.config.get("wgIsProbablyEditable"))
    return;
  if (mw.config.get("wgAction") !== "view" || !mw.config.get("wgIsArticle"))
    return;
  if (mw.util.getParamValue("oldid") || mw.config.get("wgDiffOldId"))
    return;
  const contentText = document.querySelector("#mw-content-text");
  if (!contentText)
    return mw.notify("Failed to find content text element!", { type: "error" });
  const redirectTemplates = JSON.parse((await new mw.Api().get({ action: "query", formatversion: 2, prop: "revisions", rvprop: "content", rvslots: "*", titles: "User:Eejit43/scripts/redirect-helper.json" })).query.pages?.[0]?.revisions?.[0]?.slots?.main?.content || "[]");
  const pageTitle = mw.config.get("wgPageName");
  const pageTitleParsed = mw.Title.newFromText(pageTitle);
  if (!pageTitleParsed)
    return mw.notify("Failed to parse page title!", { type: "error" });
  const pageInfo = await new mw.Api().get({ action: "query", formatversion: 2, prop: "info", titles: pageTitle });
  if (pageInfo.query.pages[0].missing) {
    const button = new OO.ui.ButtonWidget({ label: "Create redirect", icon: "articleRedirect", flags: ["progressive"] });
    button.$element[0].style.marginBottom = "10px";
    button.on("click", () => {
      button.$element[0].remove();
      showRedirectInfo(false);
    });
    contentText.prepend(button.$element[0]);
  } else if (pageInfo.query.pages[0].redirect)
    showRedirectInfo(true);
  else {
    const portletLink = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", "Redirect page", "redirect-helper");
    portletLink.addEventListener("click", (event) => {
      event.preventDefault();
      showRedirectInfo(false);
    });
  }
  async function showRedirectInfo(exists) {
    const editorBox = new OO.ui.PanelLayout({ padded: true, expanded: false, framed: true });
    editorBox.$element[0].style.backgroundColor = "#95d4bc";
    editorBox.$element[0].style.width = "700px";
    editorBox.$element[0].style.maxWidth = "calc(100% - 50px)";
    editorBox.$element[0].style.marginLeft = "auto";
    editorBox.$element[0].style.marginRight = "auto";
    editorBox.$element[0].style.marginBottom = "20px";
    let syncWithMainButton;
    if (pageTitleParsed.isTalkPage()) {
      const mainPageData = await new mw.Api().get({ action: "query", formatversion: 2, prop: "info", titles: pageTitleParsed.getSubjectPage().getPrefixedText() });
      if (mainPageData.query.pages[0].redirect) {
        const mainPageContent = (await new mw.Api().get({ action: "query", formatversion: 2, prop: "revisions", rvprop: "content", rvslots: "*", titles: pageTitleParsed.getSubjectPage().getPrefixedText() })).query.pages[0].revisions[0].slots.main.content.trim();
        syncWithMainButton = new OO.ui.ButtonWidget({ label: "Sync with main page", icon: "link", flags: ["progressive"] });
        syncWithMainButton.on("click", () => {
          const target = /^#redirect:?\s*\[\[\s*([^[\]{|}]+?)\s*(?:\|[^[\]{|}]+?)?]]\s*/i.exec(mainPageContent)?.[1];
          if (!target)
            return mw.notify("Failed to parse main page content!", { type: "error" });
          redirectInput.setValue(mw.Title.newFromText(target)?.getTalkPage()?.toString() ?? "");
          const fromMove = ["R from move", ...redirectTemplates["R from move"]].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`).test(mainPageContent));
          if (fromMove)
            tagSelect.setValue(["R from move"]);
        });
      }
    }
    class RedirectInputWidget extends OO.ui.TextInputWidget {
      constructor(config) {
        super(config);
        this.getLookupRequest = () => {
          const value = this.getValue();
          const deferred = $.Deferred();
          if (!value)
            deferred.resolve([]);
          else if (value.includes("#")) {
            const title = value.split("#")[0];
            new mw.Api().get({ action: "parse", page: title, prop: "sections", redirects: "1" }).catch(() => null).then((result) => {
              if (result) {
                const matchedSections = result.parse.sections.filter((section) => section.line.toLowerCase().startsWith(value.split("#")[1].toLowerCase()));
                deferred.resolve(matchedSections.map((section) => ({ data: `${result.parse.title}#${section.line}`, label: `${result.parse.title}#${section.line}` })));
              } else
                deferred.resolve([]);
            });
          } else {
            const parsedTitle = mw.Title.newFromText(value);
            new mw.Api().get({ action: "query", formatversion: 2, gaplimit: 20, gapnamespace: parsedTitle?.namespace ?? 0, gapprefix: parsedTitle?.title ?? value, generator: "allpages", prop: "info|pageprops" }).catch(() => null).then((result) => {
              if (result)
                deferred.resolve(
                  result.query?.pages ? result.query.pages.filter((page) => page.title !== pageTitleParsed.toString()).map((page) => ({ data: page.title, label: new OO.ui.HtmlSnippet(`${page.title}${page.pageprops && "disambiguation" in page.pageprops ? " <i>(disambiguation)</i>" : ""}${"redirect" in page ? " <i>(redirect)</i>" : ""}`) })) : []
                );
              else
                deferred.resolve([]);
            });
          }
          return deferred.promise({ abort() {
          } });
        };
        this.getLookupCacheDataFromResponse = (response) => response ?? [];
        this.getLookupMenuOptionsFromData = (data) => data.map(({ data: data2, label }) => new OO.ui.MenuOptionWidget({ data: data2, label }));
        OO.ui.mixin.LookupElement.call(this, config);
      }
    }
    Object.assign(RedirectInputWidget.prototype, OO.ui.mixin.LookupElement.prototype);
    const redirectInput = new RedirectInputWidget({ placeholder: "Target page name", required: true });
    redirectInput.on("change", () => {
      let value = redirectInput.getValue();
      value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get("wgServer").replace(/^\/{2}/, "")}/wiki/`), "");
      value = value.replace(/^:/, "");
      if (value.length > 0) {
        redirectInput.setValue(value[0].toUpperCase() + value.slice(1).replaceAll("_", " "));
        submitButton.setDisabled(false);
      } else
        submitButton.setDisabled(true);
      updateSummary();
      submitButton.setLabel("Submit");
      needsCheck = true;
    });
    const redirectInputLayout = new OO.ui.FieldLayout(redirectInput, { label: new OO.ui.HtmlSnippet("<b>Redirect target:</b>"), align: "top" });
    const tagSelect = new OO.ui.MenuTagMultiselectWidget({
      allowArbitrary: false,
      allowReordering: false,
      options: Object.keys(redirectTemplates).map((tag) => ({ data: tag, label: tag }))
    });
    tagSelect.getMenu().filterMode = "substring";
    tagSelect.on("change", () => {
      const sortedTags = tagSelect.getValue().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      if (tagSelect.getValue().join(";") !== sortedTags.join(";"))
        tagSelect.setValue(sortedTags);
      updateSummary();
      submitButton.setLabel("Submit");
      needsCheck = true;
    });
    const tagSelectLayout = new OO.ui.FieldLayout(tagSelect, { label: new OO.ui.HtmlSnippet("<b>Redirect categorization template(s):</b>"), align: "top" });
    const summaryInput = new OO.ui.ComboBoxInputWidget({
      options: [
        { data: "Resolve double redirect" },
        //
        { data: "Resolve self redirect" },
        { data: "Remove incorrect rcats" }
      ]
    });
    const summaryInputLayout = new OO.ui.FieldLayout(summaryInput, { label: new OO.ui.HtmlSnippet("<b>Summary:</b>"), align: "top" });
    const submitButton = new OO.ui.ButtonWidget({ label: "Submit", disabled: true, flags: ["progressive"] });
    submitButton.$element[0].style.marginBottom = "0";
    let needsCheck = true;
    submitButton.on("click", async () => {
      for (const element of [redirectInput, tagSelect, summaryInput, submitButton, syncTalkCheckbox, patrolCheckbox].filter(Boolean))
        element.setDisabled(true);
      submitButton.setLabel("Checking target validity...");
      let parsedDestination;
      const errors = [];
      if (needsCheck) {
        const destination = redirectInput.getValue().trim();
        if (!/^\s*[^[\]{|}]+\s*$/.test(destination))
          errors.push({ title: destination, message: "is not a valid page title!" });
        try {
          parsedDestination = mw.Title.newFromText(destination);
        } catch {
          if (errors.length === 0)
            errors.push({ title: destination, message: "is not a valid page title!" });
        }
        if (!parsedDestination && errors.length === 0)
          errors.push({ title: destination, message: "is not a valid page title!" });
        if (parsedDestination?.toString() === pageTitleParsed.toString())
          errors.push({ message: "cannot redirect to itself!" });
        const destinationData = await new mw.Api().get({ action: "query", formatversion: 2, prop: "pageprops", titles: destination }).catch((errorCode) => {
          if (errorCode === "missingtitle")
            errors.push({ title: destination, message: "does not exist!" });
          else
            errors.push({ title: destination, message: `was not able to be fetched from the API (${errorCode})!` });
          return null;
        });
        const destinationParseResult = await new mw.Api().get({ action: "parse", page: destination, prop: "sections", redirects: "1" });
        if (destinationParseResult.parse.redirects?.[0]) {
          const destinationRedirect = destinationParseResult.parse.redirects[0].to + (destinationParseResult.parse.redirects[0].tofragment ? `#${destinationParseResult.parse.redirects[0].tofragment}` : "");
          errors.push({ title: destination, message: `is a redirect to <a href="${mw.util.getUrl(destinationRedirect)}" target="_blank">${destinationRedirect}</a>. Retarget to that page instead, as double redirects aren't allowed.` });
        }
        if (destination.split("#").length > 1) {
          const validSection = destinationParseResult.parse.sections.find((section) => section.line === destination.split("#")[1]);
          if (validSection) {
            if (tagSelect.getValue().includes("R to anchor"))
              errors.push({ message: "is tagged as a redirect to an anchor, but it is actually a redirect to a section!" });
            if (!tagSelect.getValue().includes("R to section"))
              errors.push({ message: "is a redirect to a section, but it is not tagged with <code>{{R to section}}</code>!" });
          } else {
            const destinationContent = (await new mw.Api().get({ action: "query", formatversion: 2, prop: "revisions", rvprop: "content", rvslots: "*", titles: parsedDestination.toString() })).query.pages[0].revisions[0].slots.main.content;
            const anchors = [
              ...destinationContent.match(/(?<={{\s*?[Aa](?:nchors?|nchor for redirect|nker|NCHOR|nc)\s*?\|).+?(?=}})/g)?.map((anchor) => anchor.split("|").map((part) => part.trim()))?.flat() ?? [],
              ...destinationContent.match(/(?<={{\s*?(?:[Vv](?:isible anchors?|isanc|Anch|anchor|isibleanchor|a)|[Aa](?:nchord|chored|nchor\+)|[Tt]ext anchor)\s*?\|).+?(?=(?<!!|=)}})/g)?.map(
                (anchor) => anchor.split("|").map((part) => part.trim()).filter((part) => !/^text\s*?=/.test(part))
              )?.flat() ?? [],
              ...destinationContent.match(/(?<=id=)"?.+?(?="|>|\|)/g)?.map((anchor) => anchor.trim()) ?? []
            ];
            if (anchors.includes(destination.split("#")[1])) {
              if (tagSelect.getValue().includes("R to section"))
                errors.push({ message: "is tagged as a redirect to a section, but it is actually a redirect to an anchor!" });
              if (!tagSelect.getValue().includes("R to anchor"))
                errors.push({ message: "is a redirect to an anchor, but it is not tagged with <code>{{R from anchor}}</code>!" });
            } else
              errors.push({ message: `is a redirect to <a href="${mw.util.getUrl(destination)}" target="_blank">${destination}</a>, but that section or anchor does not exist!` });
          }
        }
        if (destination.split("#").length === 1 && (tagSelect.getValue().includes("R to section") || tagSelect.getValue().includes("R to anchor")))
          errors.push({ message: "is not a redirect to a section/anchor, but it is tagged with <code>{{R from section}}</code> or <code>{{R from anchor}}</code>!" });
        if ("disambiguation" in destinationData.query.pages[0].pageprops && !["R from ambiguous sort name", "R from ambiguous term", "R to disambiguation page", "R from incomplete disambiguation", "R from incorrect disambiguation", "R from other disambiguation"].some((template) => tagSelect.getValue().includes(template)))
          errors.push({ message: "is a redirect to a disambiguation page, but it is not tagged with a disambiguation categorization template!" });
        if (!("disambiguation" in destinationData.query.pages[0].pageprops) && ["R from ambiguous sort name", "R from ambiguous term", "R to disambiguation page", "R from incomplete disambiguation", "R from incorrect disambiguation", "R from other disambiguation"].some((template) => tagSelect.getValue().includes(template)))
          errors.push({ message: "is not a redirect to a disambiguation page, but it is tagged with a disambiguation categorization template!" });
        if (tagSelect.getValue().includes("R to disambiguation page") && !pageTitleParsed.getMainText().endsWith(" (disambiguation)"))
          errors.push({ message: 'is tagged with <code>{{R to disambiguation page}}</code>, but this title does not end with " (disambiguation)". Use <code>{{R from ambiguous term}}</code> or a similar categorization template instead!' });
        if (syncTalkCheckbox?.isSelected() && !talkData.query.pages[0].missing && !talkData.query.pages[0].redirect)
          errors.push({ title: pageTitleParsed.getTalkPage().getPrefixedText(), message: "exists, but is not a redirect!" });
      }
      if (errors.length > 0) {
        for (const element of document.querySelectorAll(".redirect-helper-warning"))
          element.remove();
        for (const { title, message } of errors) {
          const label = new OO.ui.HtmlSnippet(`${title ? `<a href="${mw.util.getUrl(title)}" target="_blank">${title}</a>` : "This page"} ${message} Click again without making changes to submit anyway.`);
          const warningMessage = new OO.ui.MessageWidget({ type: "error", classes: ["redirect-helper-warning"], inline: true, label });
          warningMessage.$element[0].style.marginTop = "8px";
          editorBox.$element[0].append(warningMessage.$element[0]);
        }
        for (const element of [redirectInput, tagSelect, summaryInput, submitButton, syncTalkCheckbox, patrolCheckbox].filter(Boolean))
          element.setDisabled(false);
        submitButton.setLabel("Submit anyway");
        needsCheck = false;
        return;
      }
      parsedDestination = mw.Title.newFromText(redirectInput.getValue());
      submitButton.setLabel(`${exists ? "Editing" : "Creating"} redirect...`);
      const output = [
        `#REDIRECT [[${redirectInput.getValue().trim()}]]`,
        //
        tagSelect.getValue().length > 0 ? `{{Redirect category shell|
${tagSelect.getValue().map((tag) => `{{${tag}${oldRedirectTagData?.[tag] ? `|${oldRedirectTagData[tag]}` : ""}}}`).join("\n")}
}}` : null,
        oldStrayText
      ].filter(Boolean).join("\n\n");
      const summary = (summaryInput.getValue() || summaryInput.$tabIndexed[0].placeholder) + " (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])";
      const result = await new mw.Api().edit(pageTitle, () => ({ text: output, summary })).catch((errorCode, { error }) => {
        if (errorCode === "nocreate-missing")
          return new mw.Api().create(pageTitle, { summary }, output).catch((errorCode2, { error: error2 }) => {
            mw.notify(`Error creating ${pageTitle}: ${error2.info} (${errorCode2})`, { type: "error" });
          });
        else {
          mw.notify(`Error editing or creating ${pageTitle}: ${error.info} (${errorCode})`, { type: "error" });
          return null;
        }
      });
      if (!result)
        return;
      mw.notify(`Redirect ${exists ? "edited" : "created"} successfully!`, { type: "success" });
      if (syncTalkCheckbox?.isSelected()) {
        submitButton.setLabel("Editing talk page...");
        const fromMove = tagSelect.getValue().includes("R from move");
        const output2 = [
          `#REDIRECT [[${parsedDestination.getTalkPage().getPrefixedText()}]]`,
          //
          fromMove ? "{{Redirect category shell|\n{{R from move}}\n}}" : null
        ].filter(Boolean).join("\n\n");
        const talkPage = pageTitleParsed.getTalkPage().getPrefixedText();
        const talkResult = await new mw.Api().edit(talkPage, () => ({ text: output2, summary: "Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])" })).catch((errorCode, { error }) => {
          if (errorCode === "nocreate-missing")
            return new mw.Api().create(talkPage, { summary: "Syncing redirect from main page (via [[User:Eejit43/scripts/redirect-helper|redirect-helper]])" }, output2).catch((errorCode2, { error: error2 }) => {
              mw.notify(`Error creating ${talkPage}: ${error2.info} (${errorCode2})`, { type: "error" });
            });
          else {
            mw.notify(`Error editing or creating ${talkPage}: ${error.info} (${errorCode})`, { type: "error" });
            return null;
          }
        });
        if (!talkResult)
          return;
        mw.notify("Talk page synced successfully!", { type: "success" });
      }
      if (patrolCheckbox?.isSelected()) {
        submitButton.setLabel("Patrolling redirect...");
        const patrolLink = document.querySelector(".patrollink a");
        const markReviewedButton = document.querySelector("#mwe-pt-mark-as-reviewed-button");
        if (patrolLink) {
          const patrolResult = await new mw.Api().postWithToken("patrol", { action: "patrol", rcid: new URL(patrolLink.href).searchParams.get("rcid") }).catch((errorCode, { error }) => {
            mw.notify(`Error patrolling ${pageTitle} via API: ${error.info} (${errorCode})`, { type: "error" });
            return null;
          });
          if (patrolResult)
            mw.notify("Redirect patrolled successfully!", { type: "success" });
        } else if (markReviewedButton) {
          markReviewedButton.click();
          mw.notify("Redirect patrolled successfully!", { type: "success" });
        } else
          mw.notify("Page curation toolbar not found, redirect cannot be patrolled!", { type: "error" });
      }
      submitButton.setLabel("Complete, reloading...");
      window.location.href = mw.util.getUrl(pageTitle, { redirect: "no" });
    });
    let talkData;
    let syncTalkCheckbox, syncTalkLayout;
    if (!pageTitleParsed.isTalkPage()) {
      talkData = await new mw.Api().get({ action: "query", formatversion: 2, prop: "info", titles: pageTitleParsed.getTalkPage().getPrefixedText() });
      syncTalkCheckbox = new OO.ui.CheckboxInputWidget({ selected: !!talkData.query.pages[0].redirect });
      syncTalkLayout = new OO.ui.Widget({ content: [new OO.ui.FieldLayout(syncTalkCheckbox, { label: "Sync talk page", align: "inline" })] });
      syncTalkLayout.$element[0].style.marginBottom = "0";
    }
    let shouldPromptPatrol;
    if (mw.config.get("wgNamespaceNumber") !== 0)
      shouldPromptPatrol = false;
    else if (document.querySelector(".patrollink"))
      shouldPromptPatrol = true;
    else if (document.querySelector("#mwe-pt-mark-as-reviewed-button"))
      shouldPromptPatrol = true;
    else if (document.querySelector("#mwe-pt-mark-as-unreviewed-button"))
      shouldPromptPatrol = false;
    else {
      if (!mw.config.get("wgArticleId"))
        shouldPromptPatrol = false;
      const userPermissions = await new mw.Api().get({ action: "query", meta: "userinfo", uiprop: "rights" });
      if (!userPermissions.query.userinfo.rights.includes("patrol"))
        shouldPromptPatrol = false;
      const patrolResponse = await new mw.Api().get({ action: "pagetriagelist", page_id: mw.config.get("wgArticleId") });
      if (patrolResponse.pagetriagelist.pages[0]?.user_name === mw.config.get("wgUserName"))
        shouldPromptPatrol = false;
      else if (patrolResponse.pagetriagelist.result !== "success" || patrolResponse.pagetriagelist.pages.length === 0)
        shouldPromptPatrol = false;
      else
        shouldPromptPatrol = !Number.parseInt(patrolResponse.pagetriagelist.pages[0]?.patrol_status);
    }
    let patrolCheckbox, patrolLayout;
    if (shouldPromptPatrol) {
      patrolCheckbox = new OO.ui.CheckboxInputWidget({ selected: true });
      patrolLayout = new OO.ui.Widget({ content: [new OO.ui.FieldLayout(patrolCheckbox, { label: "Mark as patrolled", align: "inline" })] });
      patrolLayout.$element[0].style.marginBottom = "0";
    }
    const submitLayout = new OO.ui.HorizontalLayout({ items: [submitButton, syncTalkLayout, patrolLayout].filter(Boolean) });
    submitLayout.$element[0].style.marginTop = "10px";
    editorBox.$element[0].append(...[syncWithMainButton?.$element?.[0], redirectInputLayout.$element[0], tagSelectLayout.$element[0], summaryInputLayout.$element[0], submitLayout.$element[0]].filter(Boolean));
    contentText.prepend(editorBox.$element[0]);
    function updateSummary() {
      const redirectValue = redirectInput.getValue().trim();
      if (!redirectValue)
        summaryInput.$tabIndexed[0].placeholder = "";
      else if (exists) {
        const targetChanged = redirectValue !== oldRedirectTarget;
        const tagsChanged = tagSelect.getValue().join(";") !== oldRedirectTags?.join(";");
        if (targetChanged && tagsChanged)
          summaryInput.$tabIndexed[0].placeholder = `Changing redirect to [[${redirectValue}]] and changing categorization templates`;
        else if (targetChanged)
          summaryInput.$tabIndexed[0].placeholder = `Changing redirect to [[${redirectValue}]]`;
        else if (tagsChanged)
          summaryInput.$tabIndexed[0].placeholder = "Changing categorization templates";
        else
          summaryInput.$tabIndexed[0].placeholder = "Redirect cleanup";
      } else
        summaryInput.$tabIndexed[0].placeholder = `Creating redirect to [[${redirectValue}]]`;
    }
    let oldRedirectTarget, oldRedirectTags, oldRedirectTagData, oldStrayText;
    if (exists) {
      const pageContent = (await new mw.Api().get({ action: "query", formatversion: 2, prop: "revisions", rvprop: "content", rvslots: "*", titles: pageTitle })).query.pages[0].revisions[0].slots.main.content.trim();
      oldRedirectTarget = /^#redirect:?\s*\[\[\s*([^[\]{|}]+?)\s*(?:\|[^[\]{|}]+?)?]]\s*/i.exec(pageContent)?.[1];
      oldRedirectTags = Object.entries(redirectTemplates).map(([tag, redirects]) => [tag, ...redirects].some((tagOrRedirect) => new RegExp(`{{\\s*[${tagOrRedirect[0].toLowerCase()}${tagOrRedirect[0]}]${tagOrRedirect.slice(1)}\\s*(\\||}})`).test(pageContent)) ? tag : null).filter(Boolean).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      oldRedirectTagData = Object.fromEntries(
        oldRedirectTags.map((tag) => {
          const match = new RegExp(`{{\\s*(?:${[tag, ...redirectTemplates[tag]].map((tag2) => `[${tag2[0].toLowerCase()}${tag2[0]}]${tag2.slice(1)}`).join("|")})\\|?(.*?)\\s*}}`).exec(pageContent);
          return match ? [tag, match[1]] : null;
        }).filter(Boolean)
      );
      oldStrayText = [pageContent.match(/{{short description\|.*?}}/i)?.[0], pageContent.match(/{{DISPLAYTITLE:.*?}}/)?.[0], pageContent.match(/{{italic title\|?.*?}}/i)?.[0], pageContent.match(/{{DEFAULTSORT:.*?}}/)?.[0]].filter(Boolean).join("\n");
      if (oldRedirectTarget)
        redirectInput.setValue(oldRedirectTarget.replaceAll("_", " "));
      else
        mw.notify("Could not find redirect target!", { type: "error" });
      tagSelect.setValue(oldRedirectTags);
    }
  }
});
