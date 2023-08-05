"use strict";
mw.loader.using(["mediawiki.util", "oojs-ui-core", "oojs-ui-widgets", "oojs-ui-windows", "mediawiki.widgets"]).then(async () => {
  const namespace = mw.config.get("wgNamespaceNumber");
  if (namespace < 0 || namespace >= 120 || namespace >= 6 && namespace <= 9 || namespace >= 14 && namespace <= 99)
    return;
  const currentTitle = mw.config.get("wgPageName");
  const userPermissions = await fetchUserPermissions();
  const pageInfo = await new mw.Api().get({ action: "query", prop: "info", titles: currentTitle });
  if (pageInfo.query.pages[-1])
    return;
  const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", "Swap", "eejit-pageswap");
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (!userPermissions.canSwap)
      return mw.notify("You do not have sufficient permissions to swap pages.", { type: "error" });
    function SwapDialog() {
      SwapDialog.super.apply(this, arguments);
    }
    OO.inheritClass(SwapDialog, OO.ui.ProcessDialog);
    SwapDialog.static.name = "swap";
    SwapDialog.static.title = $("<span>").append(
      $("<a>").attr({ href: mw.util.getUrl("WP:ROUNDROBIN"), target: "_blank" }).text("Swap"),
      " two pages"
    );
    SwapDialog.static.actions = [
      {
        action: "swap",
        label: "Swap",
        flags: ["primary", "progressive"],
        disabled: true
      },
      {
        action: "cancel",
        label: "Cancel",
        flags: ["safe", "close"]
      }
    ];
    SwapDialog.prototype.initialize = function() {
      SwapDialog.super.prototype.initialize.call(this);
      this.panel = new OO.ui.PanelLayout({
        padded: true,
        expanded: false
      });
      this.content = new OO.ui.FieldsetLayout();
      this.destinationInput = new mw.widgets.TitleInputWidget({
        required: true,
        $overlay: this.$overlay,
        excludeCurrentPage: true,
        showDescriptions: true,
        showRedirectTargets: false,
        excludeDynamicNamespaces: true,
        // "Special" and "Media"
        showMissing: false,
        validate: (value) => {
          if (value === "" || value === mw.config.get("wgPageName"))
            return false;
          return true;
        }
      });
      this.destinationInput.on("change", () => {
        let value = this.destinationInput.getValue().replaceAll("_", " ").replace(/^\s+/, "");
        value = value.replace(new RegExp(`^(https?:)?/{2}?${mw.config.get("wgServer").replace(/^\/{2}/, "")}/wiki/`), "");
        value = value.split("#")[0];
        value = value.charAt(0).toUpperCase() + value.slice(1);
        this.destinationInput.setValue(value);
      });
      this.destinationInput.connect(this, { change: "updateActionState" });
      this.destinationInputField = new OO.ui.FieldLayout(this.destinationInput, { label: "Destination page", align: "top" });
      this.summaryInput = new OO.ui.ComboBoxInputWidget({
        required: true,
        $overlay: this.$overlay,
        options: [
          { data: "Performing [[WP:RM/TR|requested technical move]]" },
          //
          { data: "Result of [[WP:RM|requested move]]" },
          { data: "Move to [[WP:COMMONNAME|common name]]" },
          { data: "Fixing typo" },
          { data: "Fixing capitalization" },
          { data: "Fixing per [[WP:NC|naming conventions]]" }
        ]
      });
      this.summaryInput.connect(this, { change: "updateActionState" });
      this.summaryInputField = new OO.ui.FieldLayout(this.summaryInput, { label: "Summary", align: "top" });
      this.moveTalkCheckbox = new OO.ui.CheckboxInputWidget({ selected: true });
      this.moveTalkCheckboxField = new OO.ui.FieldLayout(this.moveTalkCheckbox, { label: "Move talk page (if applicable)", align: "inline" });
      this.moveSubpagesCheckbox = new OO.ui.CheckboxInputWidget({ selected: true });
      this.moveSubpagesCheckboxField = new OO.ui.FieldLayout(this.moveSubpagesCheckbox, { label: "Move subpages (if applicable)", align: "inline" });
      this.content.addItems([this.destinationInputField, this.summaryInputField, this.moveTalkCheckboxField, this.moveSubpagesCheckboxField]);
      this.panel.$element.append(this.content.$element);
      this.$body.append(this.panel.$element);
    };
    SwapDialog.prototype.updateActionState = function() {
      const isValid = this.destinationInput.getValue() !== "" && this.destinationInput.getValidity() && this.summaryInput.getValue() !== "";
      this.actions.setAbilities({ swap: isValid });
    };
    SwapDialog.prototype.getActionProcess = function(action) {
      if (action === "swap") {
        const destination = this.destinationInput.getValue().trim();
        const summary = this.summaryInput.getValue();
        const moveTalk = this.moveTalkCheckbox.isSelected();
        const moveSubpages = this.moveSubpagesCheckbox.isSelected();
        return new OO.ui.Process().next(
          () => roundRobin(userPermissions, currentTitle, destination, summary, moveTalk, moveSubpages).catch((error) => {
            console.error(error);
            return $.Deferred().reject(this.showErrors([new OO.ui.Error(error?.message || "An unknown error occurred.")]));
          })
        ).next(() => {
          mw.notify("Moves complete! Reloading...", { type: "success" });
          this.close({ action, success: true });
          setTimeout(() => window.location.reload(), 1e3);
        });
      } else if (action === "cancel")
        return new OO.ui.Process(() => {
          this.close({ action });
        });
      return SwapDialog.super.prototype.getActionProcess.call(this, action);
    };
    const dialog = new SwapDialog();
    const windowManager = new OO.ui.WindowManager();
    $("body").append(windowManager.$element);
    windowManager.addWindows([dialog]);
    windowManager.openWindow(dialog);
  });
});
function fetchUserPermissions() {
  return new mw.Api().get({
    action: "query",
    meta: "userinfo",
    uiprop: "rights"
  }).then((data) => {
    const rightsList = data.query.userinfo.rights;
    return {
      canSwap: rightsList.includes("suppressredirect") && rightsList.includes("move-subpages"),
      // Page mover right on the English Wikipedia
      allowSwapTemplates: rightsList.includes("templateeditor")
    };
  });
}
function getTalkPageName(namespaceData, title, titleNamespace) {
  const result = {};
  const prefixLength = namespaceData[titleNamespace.toString()]["*"].length === 0 ? 0 : namespaceData[titleNamespace.toString()]["*"].length + 1;
  result.titleWithoutPrefix = title.substring(prefixLength, title.length);
  result.talkTitle = `${namespaceData[(titleNamespace + 1).toString()]["*"]}:${result.titleWithoutPrefix}`;
  return result;
}
function swapValidate(startTitle, endTitle, pagesData, namespacesData, userPermissions) {
  const result = { valid: true, allowMoveSubpages: true, checkTalk: true };
  let count = 0;
  for (const [pageId, pageData] of Object.entries(pagesData)) {
    count++;
    if (pageId === "-1" || pageData.ns < 0) {
      result.valid = false;
      result.error = `Page ${pageData.title} does not exist.`;
      return result;
    }
    if (pageData.ns >= 6 && pageData.ns <= 9 || pageData.ns >= 10 && pageData.ns <= 11 && !userPermissions.allowSwapTemplates || pageData.ns >= 14 && pageData.ns <= 117 || pageData.ns >= 120) {
      result.valid = false;
      result.error = `Namespace of ${pageData.title} (${pageData.ns}) not supported.

Likely reasons:
- Names of pages in this namespace relies on other pages
- Namespace features heavily-transcluded pages
- Namespace involves subpages: swaps produce many redlinks


If the move is legitimate, consider a careful manual swap.`;
      return result;
    }
    if (startTitle === pageData.title) {
      result.currentTitle = pageData.title;
      result.currentNamespace = pageData.ns;
      result.currentTalkId = pageData.talkid;
      result.currentCanMove = pageData.actions.move === "";
      result.currentIsRedirect = pageData.redirect === "";
    }
    if (endTitle === pageData.title) {
      result.destinationTitle = pageData.title;
      result.destinationNamespace = pageData.ns;
      result.destinationTalkId = pageData.talkid;
      result.destinationCanMove = pageData.actions.move === "";
      result.destinationIsRedirect = pageData.redirect === "";
    }
  }
  if (!result.valid)
    return result;
  if (!result.currentCanMove) {
    result.valid = false;
    result.error = `${result.currentTitle} is immovable`;
    return result;
  }
  if (!result.destinationCanMove) {
    result.valid = false;
    result.error = `${result.destinationTitle} is immovable`;
    return result;
  }
  if (result.currentNamespace % 2 !== result.destinationNamespace % 2) {
    result.valid = false;
    result.error = "Namespaces don't match: one is a talk page, the other is not";
    return result;
  }
  if (count !== 2) {
    result.valid = false;
    result.error = "Destination title is the same as the current title";
    return result;
  }
  result.currentNamespaceAllowSubpages = namespacesData[result.currentNamespace.toString()].subpages !== "";
  result.destinationNamespaceAllowSubpages = namespacesData[result.destinationNamespace.toString()].subpages !== "";
  if (result.currentTitle.startsWith(result.destinationTitle + "/") || result.destinationTitle.startsWith(result.currentTitle + "/")) {
    if (result.currentNamespace !== result.destinationNamespace) {
      result.valid = false;
      result.error = `${result.currentTitle} in ns ${result.currentNamespace}
${result.destinationTitle} in ns ${result.destinationNamespace}. Disallowing.`;
      return result;
    }
    result.allowMoveSubpages = result.currentNamespaceAllowSubpages;
    if (!result.allowMoveSubpages)
      result.addLineInfo = "One page is a subpage. Disallowing move-subpages";
  }
  if (result.currentNamespace % 2 === 1)
    result.checkTalk = false;
  else {
    const currentTalkData = getTalkPageName(namespacesData, result.currentTitle, result.currentNamespace);
    result.currentTitleWithoutPrefix = currentTalkData.titleWithoutPrefix;
    result.currentTalkName = currentTalkData.talkTitle;
    const destinationData = getTalkPageName(namespacesData, result.destinationTitle, result.destinationNamespace);
    result.destinationTitleWithoutPrefix = destinationData.titleWithoutPrefix;
    result.destinationTalkName = destinationData.talkTitle;
  }
  return result;
}
async function talkValidate(checkTalk, firstTalk, secondTalk) {
  const result = {};
  result.allowMoveTalk = true;
  if (!checkTalk)
    return result;
  if (firstTalk === void 0 || secondTalk === void 0) {
    mw.notify("Unable to validate talk. Disallowing movetalk to be safe", { type: "error" });
    result.allowMoveTalk = false;
    return result;
  }
  result.currTDNE = true;
  result.destTDNE = true;
  result.currentTalkCanCreate = true;
  result.destinationTalkCanCreate = true;
  const talkTitleArr = [firstTalk, secondTalk];
  if (talkTitleArr.length > 0) {
    const talkData = (await new mw.Api().get({
      action: "query",
      prop: "info",
      intestactions: "move|create",
      titles: talkTitleArr.join("|")
    })).query.pages;
    for (const [, pageData] of Object.entries(talkData))
      if (pageData.title === firstTalk) {
        result.currTDNE = pageData.invalid === "" || pageData.missing === "";
        result.currentTalkTitle = pageData.title;
        result.currentTalkCanMove = pageData.actions.move === "";
        result.currentTalkCanCreate = pageData.actions.create === "";
        result.currentTalkIsRedirect = pageData.redirect === "";
      } else if (pageData.title === secondTalk) {
        result.destTDNE = pageData.invalid === "" || pageData.missing === "";
        result.destinationTalkTitle = pageData.title;
        result.destinationTalkCanMove = pageData.actions.move === "";
        result.destinationTalkCanCreate = pageData.actions.create === "";
        result.destinationTalkIsRedirect = pageData.redirect === "";
      } else {
        mw.notify("Found pageid not matching given ids.", { type: "error" });
        return {};
      }
  }
  result.allowMoveTalk = result.currentTalkCanCreate && result.currentTalkCanMove && result.destinationTalkCanCreate && result.destinationTalkCanMove;
  return result;
}
async function getSubpages(namespaceData, title, titleNamespace, isTalk) {
  if (!isTalk && namespaceData[titleNamespace.toString()].subpages !== "")
    return { data: [] };
  const titlePageData = getTalkPageName(namespaceData, title, titleNamespace);
  const subpages = (await new mw.Api().get({
    action: "query",
    list: "allpages",
    apnamespace: isTalk ? titleNamespace + 1 : titleNamespace,
    apfrom: titlePageData.titleWithoutPrefix + "/",
    apto: titlePageData.titleWithoutPrefix + "0",
    aplimit: 101
  })).query.allpages;
  const subpageIds = [[], []];
  for (const id in subpages)
    subpageIds[id < 50 ? 0 : 1].push(subpages[id].pageid);
  if (subpageIds[0].length === 0)
    return { data: [] };
  if (subpageIds[1].length === 51)
    return { error: "100+ subpages, too many to move." };
  const result = [];
  const subpageDataOne = (await new mw.Api().get({
    action: "query",
    prop: "info",
    intestactions: "move|create",
    pageids: subpageIds[0].join("|")
  })).query.pages;
  for (const [, pageData] of Object.entries(subpageDataOne))
    result.push({
      title: pageData.title,
      isRedir: pageData.redirect === "",
      canMove: pageData.actions?.move === ""
    });
  if (subpageIds[1].length === 0)
    return { data: result };
  const subpageDataTwo = (await new mw.Api().get({
    action: "query",
    prop: "info",
    intestactions: "move|create",
    pageids: subpageIds[1].join("|")
  })).query.pages;
  for (const [, pageData] of Object.entries(subpageDataTwo))
    result.push({
      title: pageData.title,
      isRedirect: pageData.redirect === "",
      canMove: pageData.actions?.move === ""
    });
  return { data: result };
}
function printSubpageInfo(basePage, currentSubpage) {
  const result = {};
  const currentSubpages = [];
  const subpagesCannotMove = [];
  let redirectCount = 0;
  for (const [, pageData] of Object.entries(currentSubpage.data)) {
    if (!pageData.canMove)
      subpagesCannotMove.push(pageData.title);
    currentSubpages.push((pageData.isRedirect ? "(R) " : "  ") + pageData.title);
    if (pageData.isRedirect)
      redirectCount++;
  }
  if (currentSubpages.length > 0)
    mw.notify(subpagesCannotMove.length > 0 ? `Disabling move-subpages.
The following ${subpagesCannotMove.length} (of ${currentSubpages.length}) total subpages of ${basePage} CANNOT be moved:

${subpagesCannotMove.join(", ")}` : `${currentSubpages.length} total subpages of ${basePage}.${redirectCount !== 0 ? ` ${redirectCount} redirects, labeled (R)` : ""}: ${currentSubpages.join(", ")}`);
  result.allowMoveSubpages = subpagesCannotMove.length === 0;
  result.noNeed = currentSubpages.length === 0;
  return result;
}
function swapPages(titleOne, titleTwo, summary, moveTalk, moveSubpages) {
  const intermediateTitle = `Draft:Move/${titleOne}`;
  const moves = [
    { action: "move", from: titleTwo, to: intermediateTitle, reason: "[[WP:ROUNDROBIN|Round-robin page move]] step 1 (with [[User:Eejit43/scripts/pageswap|pageswap 2]])", watchlist: "unwatch", noredirect: 1 },
    { action: "move", from: titleOne, to: titleTwo, reason: summary, watchlist: "unwatch", noredirect: 1 },
    { action: "move", from: intermediateTitle, to: titleOne, reason: "[[WP:ROUNDROBIN|Round-robin page move]] step 3 (with [[User:Eejit43/scripts/pageswap|pageswap 2]])", watchlist: "unwatch", noredirect: 1 }
  ];
  for (const move of moves) {
    if (moveTalk)
      move.movetalk = 1;
    if (moveSubpages)
      move.movesubpages = 1;
  }
  return new Promise((resolve, reject) => {
    const result = { success: true };
    let i = 0;
    function doMove() {
      if (i >= moves.length)
        return resolve(result);
      new mw.Api().postWithToken("csrf", moves[i]).done(() => {
        i++;
        doMove();
      }).fail(() => {
        result.success = false;
        result.message = `Failed on move ${i + 1} (${moves[i].from} \u2192 ${moves[i].to})`;
        reject(result);
      });
    }
    doMove();
    return result;
  });
}
async function roundRobin(userPermissions, currentTitle, destinationTitle, summary, moveTalk, moveSubpages) {
  const namespacesInformation = (await new mw.Api().get({
    action: "query",
    meta: "siteinfo",
    siprop: "namespaces"
  })).query.namespaces;
  const pagesData = (await new mw.Api().get({
    action: "query",
    prop: "info",
    inprop: "talkid",
    intestactions: "move|create",
    titles: `${currentTitle}|${destinationTitle}`
  })).query;
  for (const changes in pagesData.normalized) {
    if (currentTitle === pagesData.normalized[changes].from)
      currentTitle = pagesData.normalized[changes].to;
    if (destinationTitle === pagesData.normalized[changes].from)
      destinationTitle = pagesData.normalized[changes].to;
  }
  const validationData = swapValidate(currentTitle, destinationTitle, pagesData.pages, namespacesInformation, userPermissions);
  if (!validationData.valid)
    throw new Error(validationData.error);
  if (validationData.addLineInfo !== void 0)
    mw.notify(validationData.addLineInfo);
  const currentSubpages = await getSubpages(namespacesInformation, validationData.currentTitle, validationData.currentNamespace, false);
  if (currentSubpages.error !== void 0)
    throw new Error(currentSubpages.error);
  const currentSubpageFlags = printSubpageInfo(validationData.currentTitle, currentSubpages);
  const destinationSubpages = await getSubpages(namespacesInformation, validationData.destinationTitle, validationData.destinationNamespace, false);
  if (destinationSubpages.error !== void 0)
    throw new Error(destinationSubpages.error);
  const destinationSubpageFlags = printSubpageInfo(validationData.destinationTitle, destinationSubpages);
  const talkValidationData = await talkValidate(validationData.checkTalk, validationData.currentTalkName, validationData.destinationTalkName);
  const currentTalkSubpages = await getSubpages(namespacesInformation, validationData.currentTitle, validationData.currentNamespace, true);
  if (currentTalkSubpages.error !== void 0)
    throw new Error(currentTalkSubpages.error);
  const currentTalkSubpageFlags = printSubpageInfo(validationData.currentTalkName, currentTalkSubpages);
  const destinationTalkSubpages = await getSubpages(namespacesInformation, validationData.destinationTitle, validationData.destinationNamespace, true);
  if (destinationTalkSubpages.error !== void 0)
    throw new Error(destinationTalkSubpages.error);
  const destinationTalkSubpageFlags = printSubpageInfo(validationData.destinationTalkName, destinationTalkSubpages);
  const noSubpages = currentSubpageFlags.noNeed && destinationSubpageFlags.noNeed && currentTalkSubpageFlags.noNeed && destinationTalkSubpageFlags.noNeed;
  const subpageCollision = validationData.currentNamespaceAllowSubpages && !destinationSubpageFlags.noNeed || validationData.destinationNamespaceAllowSubpages && !currentSubpageFlags.noNeed;
  if (moveTalk && validationData.checkTalk && !talkValidationData.allowMoveTalk) {
    moveTalk = false;
    mw.notify(`Disallowing moving talk. ${!talkValidationData.currentTalkCanCreate ? `${validationData.currentTalkName} is create-protected` : !talkValidationData.destinationTalkCanCreate ? `${validationData.destinationTalkName} is create-protected` : "Talk page is immovable"}`);
  }
  let finalMoveSubpages = false;
  if (!subpageCollision && !noSubpages && validationData.allowMoveSubpages && currentSubpageFlags.allowMoveSubpages && destinationSubpageFlags.allowMoveSubpages && currentTalkSubpageFlags.allowMoveSubpages && destinationTalkSubpageFlags.allowMoveSubpages)
    finalMoveSubpages = moveSubpages;
  else if (subpageCollision) {
    finalMoveSubpages = false;
    mw.notify("One namespace does not have subpages enabled. Disallowing move subpages.");
  }
  console.log(`[Pageswap] Swapping "${currentTitle}" with "${destinationTitle}" with summary "${summary}" and moveTalk ${moveTalk} and moveSubpages ${finalMoveSubpages}`);
  const result = await swapPages(currentTitle, destinationTitle, summary, moveTalk, finalMoveSubpages);
  console.log(result);
  if (!result.success)
    throw new Error(result.error);
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9wYWdlc3dhcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsibXcubG9hZGVyLnVzaW5nKFsnbWVkaWF3aWtpLnV0aWwnLCAnb29qcy11aS1jb3JlJywgJ29vanMtdWktd2lkZ2V0cycsICdvb2pzLXVpLXdpbmRvd3MnLCAnbWVkaWF3aWtpLndpZGdldHMnXSkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgbmFtZXNwYWNlID0gbXcuY29uZmlnLmdldCgnd2dOYW1lc3BhY2VOdW1iZXInKTtcbiAgICBpZiAobmFtZXNwYWNlIDwgMCB8fCBuYW1lc3BhY2UgPj0gMTIwIHx8IChuYW1lc3BhY2UgPj0gNiAmJiBuYW1lc3BhY2UgPD0gOSkgfHwgKG5hbWVzcGFjZSA+PSAxNCAmJiBuYW1lc3BhY2UgPD0gOTkpKSByZXR1cm47XG5cbiAgICBjb25zdCBjdXJyZW50VGl0bGUgPSBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyk7XG5cbiAgICBjb25zdCB1c2VyUGVybWlzc2lvbnMgPSBhd2FpdCBmZXRjaFVzZXJQZXJtaXNzaW9ucygpO1xuXG4gICAgY29uc3QgcGFnZUluZm8gPSBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHsgYWN0aW9uOiAncXVlcnknLCBwcm9wOiAnaW5mbycsIHRpdGxlczogY3VycmVudFRpdGxlIH0pO1xuICAgIGlmIChwYWdlSW5mby5xdWVyeS5wYWdlc1stMV0pIHJldHVybjtcblxuICAgIGNvbnN0IGxpbmsgPSBtdy51dGlsLmFkZFBvcnRsZXRMaW5rKG13LmNvbmZpZy5nZXQoJ3NraW4nKSA9PT0gJ21pbmVydmEnID8gJ3AtdGInIDogJ3AtY2FjdGlvbnMnLCAnIycsICdTd2FwJywgJ2Vlaml0LXBhZ2Vzd2FwJyk7XG5cbiAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgaWYgKCF1c2VyUGVybWlzc2lvbnMuY2FuU3dhcCkgcmV0dXJuIG13Lm5vdGlmeSgnWW91IGRvIG5vdCBoYXZlIHN1ZmZpY2llbnQgcGVybWlzc2lvbnMgdG8gc3dhcCBwYWdlcy4nLCB7IHR5cGU6ICdlcnJvcicgfSk7XG5cbiAgICAgICAgZnVuY3Rpb24gU3dhcERpYWxvZygpIHtcbiAgICAgICAgICAgIFN3YXBEaWFsb2cuc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgICAgICBPTy5pbmhlcml0Q2xhc3MoU3dhcERpYWxvZywgT08udWkuUHJvY2Vzc0RpYWxvZyk7XG5cbiAgICAgICAgU3dhcERpYWxvZy5zdGF0aWMubmFtZSA9ICdzd2FwJztcbiAgICAgICAgU3dhcERpYWxvZy5zdGF0aWMudGl0bGUgPSAkKCc8c3Bhbj4nKS5hcHBlbmQoXG4gICAgICAgICAgICAkKCc8YT4nKVxuICAgICAgICAgICAgICAgIC5hdHRyKHsgaHJlZjogbXcudXRpbC5nZXRVcmwoJ1dQOlJPVU5EUk9CSU4nKSwgdGFyZ2V0OiAnX2JsYW5rJyB9KVxuICAgICAgICAgICAgICAgIC50ZXh0KCdTd2FwJyksXG4gICAgICAgICAgICAnIHR3byBwYWdlcydcbiAgICAgICAgKTtcbiAgICAgICAgU3dhcERpYWxvZy5zdGF0aWMuYWN0aW9ucyA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBhY3Rpb246ICdzd2FwJyxcbiAgICAgICAgICAgICAgICBsYWJlbDogJ1N3YXAnLFxuICAgICAgICAgICAgICAgIGZsYWdzOiBbJ3ByaW1hcnknLCAncHJvZ3Jlc3NpdmUnXSxcbiAgICAgICAgICAgICAgICBkaXNhYmxlZDogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBhY3Rpb246ICdjYW5jZWwnLFxuICAgICAgICAgICAgICAgIGxhYmVsOiAnQ2FuY2VsJyxcbiAgICAgICAgICAgICAgICBmbGFnczogWydzYWZlJywgJ2Nsb3NlJ11cbiAgICAgICAgICAgIH1cbiAgICAgICAgXTtcblxuICAgICAgICBTd2FwRGlhbG9nLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgU3dhcERpYWxvZy5zdXBlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLnBhbmVsID0gbmV3IE9PLnVpLlBhbmVsTGF5b3V0KHtcbiAgICAgICAgICAgICAgICBwYWRkZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgZXhwYW5kZWQ6IGZhbHNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5jb250ZW50ID0gbmV3IE9PLnVpLkZpZWxkc2V0TGF5b3V0KCk7XG5cbiAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25JbnB1dCA9IG5ldyBtdy53aWRnZXRzLlRpdGxlSW5wdXRXaWRnZXQoe1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICRvdmVybGF5OiB0aGlzLiRvdmVybGF5LFxuICAgICAgICAgICAgICAgIGV4Y2x1ZGVDdXJyZW50UGFnZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzaG93RGVzY3JpcHRpb25zOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNob3dSZWRpcmVjdFRhcmdldHM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGV4Y2x1ZGVEeW5hbWljTmFtZXNwYWNlczogdHJ1ZSwgLy8gXCJTcGVjaWFsXCIgYW5kIFwiTWVkaWFcIlxuICAgICAgICAgICAgICAgIHNob3dNaXNzaW5nOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZTogKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gJycgfHwgdmFsdWUgPT09IG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25JbnB1dC5vbignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCB2YWx1ZSA9IHRoaXMuZGVzdGluYXRpb25JbnB1dC5nZXRWYWx1ZSgpLnJlcGxhY2VBbGwoJ18nLCAnICcpLnJlcGxhY2UoL15cXHMrLywgJycpO1xuICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZShuZXcgUmVnRXhwKGBeKGh0dHBzPzopPy97Mn0/JHttdy5jb25maWcuZ2V0KCd3Z1NlcnZlcicpLnJlcGxhY2UoL15cXC97Mn0vLCAnJyl9L3dpa2kvYCksICcnKTtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnNwbGl0KCcjJylbMF07XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHZhbHVlLnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25JbnB1dC5zZXRWYWx1ZSh2YWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25JbnB1dC5jb25uZWN0KHRoaXMsIHsgY2hhbmdlOiAndXBkYXRlQWN0aW9uU3RhdGUnIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3RpbmF0aW9uSW5wdXRGaWVsZCA9IG5ldyBPTy51aS5GaWVsZExheW91dCh0aGlzLmRlc3RpbmF0aW9uSW5wdXQsIHsgbGFiZWw6ICdEZXN0aW5hdGlvbiBwYWdlJywgYWxpZ246ICd0b3AnIH0pO1xuXG4gICAgICAgICAgICB0aGlzLnN1bW1hcnlJbnB1dCA9IG5ldyBPTy51aS5Db21ib0JveElucHV0V2lkZ2V0KHtcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAkb3ZlcmxheTogdGhpcy4kb3ZlcmxheSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgZGF0YTogJ1BlcmZvcm1pbmcgW1tXUDpSTS9UUnxyZXF1ZXN0ZWQgdGVjaG5pY2FsIG1vdmVdXScgfSwgLy9cbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnUmVzdWx0IG9mIFtbV1A6Uk18cmVxdWVzdGVkIG1vdmVdXScgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnTW92ZSB0byBbW1dQOkNPTU1PTk5BTUV8Y29tbW9uIG5hbWVdXScgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnRml4aW5nIHR5cG8nIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgZGF0YTogJ0ZpeGluZyBjYXBpdGFsaXphdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnRml4aW5nIHBlciBbW1dQOk5DfG5hbWluZyBjb252ZW50aW9uc11dJyB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuc3VtbWFyeUlucHV0LmNvbm5lY3QodGhpcywgeyBjaGFuZ2U6ICd1cGRhdGVBY3Rpb25TdGF0ZScgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuc3VtbWFyeUlucHV0RmllbGQgPSBuZXcgT08udWkuRmllbGRMYXlvdXQodGhpcy5zdW1tYXJ5SW5wdXQsIHsgbGFiZWw6ICdTdW1tYXJ5JywgYWxpZ246ICd0b3AnIH0pO1xuXG4gICAgICAgICAgICB0aGlzLm1vdmVUYWxrQ2hlY2tib3ggPSBuZXcgT08udWkuQ2hlY2tib3hJbnB1dFdpZGdldCh7IHNlbGVjdGVkOiB0cnVlIH0pO1xuICAgICAgICAgICAgdGhpcy5tb3ZlVGFsa0NoZWNrYm94RmllbGQgPSBuZXcgT08udWkuRmllbGRMYXlvdXQodGhpcy5tb3ZlVGFsa0NoZWNrYm94LCB7IGxhYmVsOiAnTW92ZSB0YWxrIHBhZ2UgKGlmIGFwcGxpY2FibGUpJywgYWxpZ246ICdpbmxpbmUnIH0pO1xuXG4gICAgICAgICAgICB0aGlzLm1vdmVTdWJwYWdlc0NoZWNrYm94ID0gbmV3IE9PLnVpLkNoZWNrYm94SW5wdXRXaWRnZXQoeyBzZWxlY3RlZDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIHRoaXMubW92ZVN1YnBhZ2VzQ2hlY2tib3hGaWVsZCA9IG5ldyBPTy51aS5GaWVsZExheW91dCh0aGlzLm1vdmVTdWJwYWdlc0NoZWNrYm94LCB7IGxhYmVsOiAnTW92ZSBzdWJwYWdlcyAoaWYgYXBwbGljYWJsZSknLCBhbGlnbjogJ2lubGluZScgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuY29udGVudC5hZGRJdGVtcyhbdGhpcy5kZXN0aW5hdGlvbklucHV0RmllbGQsIHRoaXMuc3VtbWFyeUlucHV0RmllbGQsIHRoaXMubW92ZVRhbGtDaGVja2JveEZpZWxkLCB0aGlzLm1vdmVTdWJwYWdlc0NoZWNrYm94RmllbGRdKTtcblxuICAgICAgICAgICAgdGhpcy5wYW5lbC4kZWxlbWVudC5hcHBlbmQodGhpcy5jb250ZW50LiRlbGVtZW50KTtcbiAgICAgICAgICAgIHRoaXMuJGJvZHkuYXBwZW5kKHRoaXMucGFuZWwuJGVsZW1lbnQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIFN3YXBEaWFsb2cucHJvdG90eXBlLnVwZGF0ZUFjdGlvblN0YXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29uc3QgaXNWYWxpZCA9IHRoaXMuZGVzdGluYXRpb25JbnB1dC5nZXRWYWx1ZSgpICE9PSAnJyAmJiB0aGlzLmRlc3RpbmF0aW9uSW5wdXQuZ2V0VmFsaWRpdHkoKSAmJiB0aGlzLnN1bW1hcnlJbnB1dC5nZXRWYWx1ZSgpICE9PSAnJztcbiAgICAgICAgICAgIHRoaXMuYWN0aW9ucy5zZXRBYmlsaXRpZXMoeyBzd2FwOiBpc1ZhbGlkIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIFN3YXBEaWFsb2cucHJvdG90eXBlLmdldEFjdGlvblByb2Nlc3MgPSBmdW5jdGlvbiAoYWN0aW9uOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGlmIChhY3Rpb24gPT09ICdzd2FwJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlc3RpbmF0aW9uID0gdGhpcy5kZXN0aW5hdGlvbklucHV0LmdldFZhbHVlKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLnN1bW1hcnlJbnB1dC5nZXRWYWx1ZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vdmVUYWxrID0gdGhpcy5tb3ZlVGFsa0NoZWNrYm94LmlzU2VsZWN0ZWQoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBtb3ZlU3VicGFnZXMgPSB0aGlzLm1vdmVTdWJwYWdlc0NoZWNrYm94LmlzU2VsZWN0ZWQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgT08udWkuUHJvY2VzcygpXG4gICAgICAgICAgICAgICAgICAgIC5uZXh0KCgpID0+XG4gICAgICAgICAgICAgICAgICAgICAgICByb3VuZFJvYmluKHVzZXJQZXJtaXNzaW9ucywgY3VycmVudFRpdGxlLCBkZXN0aW5hdGlvbiwgc3VtbWFyeSwgbW92ZVRhbGssIG1vdmVTdWJwYWdlcykuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICQuRGVmZXJyZWQoKS5yZWplY3QodGhpcy5zaG93RXJyb3JzKFtuZXcgT08udWkuRXJyb3IoZXJyb3I/Lm1lc3NhZ2UgfHwgJ0FuIHVua25vd24gZXJyb3Igb2NjdXJyZWQuJyldKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5uZXh0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG13Lm5vdGlmeSgnTW92ZXMgY29tcGxldGUhIFJlbG9hZGluZy4uLicsIHsgdHlwZTogJ3N1Y2Nlc3MnIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZSh7IGFjdGlvbiwgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpLCAxMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2NhbmNlbCcpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBPTy51aS5Qcm9jZXNzKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZSh7IGFjdGlvbiB9KTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIFN3YXBEaWFsb2cuc3VwZXIucHJvdG90eXBlLmdldEFjdGlvblByb2Nlc3MuY2FsbCh0aGlzLCBhY3Rpb24pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IG5ldyBTd2FwRGlhbG9nKCk7XG4gICAgICAgIGNvbnN0IHdpbmRvd01hbmFnZXIgPSBuZXcgT08udWkuV2luZG93TWFuYWdlcigpO1xuICAgICAgICAkKCdib2R5JykuYXBwZW5kKHdpbmRvd01hbmFnZXIuJGVsZW1lbnQpO1xuICAgICAgICB3aW5kb3dNYW5hZ2VyLmFkZFdpbmRvd3MoW2RpYWxvZ10pO1xuICAgICAgICB3aW5kb3dNYW5hZ2VyLm9wZW5XaW5kb3coZGlhbG9nKTtcbiAgICB9KTtcbn0pO1xuXG4vLyAhISBTb21lIGNvbnRlbnQgYmVsb3cgdGhpcyBjb250YWlucyBjb2RlIG1vZGlmaWVkIGZyb20gW1tVc2VyOkFuZHkgTS4gV2FuZy9wYWdlc3dhcC5qc11dICEhXG5cbi8qKlxuICogQ2hlY2tzIGlmIHVzZXIgaGFzIHRoZSByZXF1aXJlZCBwZXJtaXNzaW9ucyB0byBwZXJmb3JtIGEgc3dhcFxuICogQHJldHVybnMge1Byb21pc2U8e2NhblN3YXA6IGJvb2xlYW4sIGFsbG93U3dhcFRlbXBsYXRlczogYm9vbGVhbn0+fVxuICovXG5mdW5jdGlvbiBmZXRjaFVzZXJQZXJtaXNzaW9ucygpIHtcbiAgICByZXR1cm4gbmV3IG13LkFwaSgpXG4gICAgICAgIC5nZXQoe1xuICAgICAgICAgICAgYWN0aW9uOiAncXVlcnknLFxuICAgICAgICAgICAgbWV0YTogJ3VzZXJpbmZvJyxcbiAgICAgICAgICAgIHVpcHJvcDogJ3JpZ2h0cydcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJpZ2h0c0xpc3QgPSBkYXRhLnF1ZXJ5LnVzZXJpbmZvLnJpZ2h0cztcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgY2FuU3dhcDogcmlnaHRzTGlzdC5pbmNsdWRlcygnc3VwcHJlc3NyZWRpcmVjdCcpICYmIHJpZ2h0c0xpc3QuaW5jbHVkZXMoJ21vdmUtc3VicGFnZXMnKSwgLy8gUGFnZSBtb3ZlciByaWdodCBvbiB0aGUgRW5nbGlzaCBXaWtpcGVkaWFcbiAgICAgICAgICAgICAgICBhbGxvd1N3YXBUZW1wbGF0ZXM6IHJpZ2h0c0xpc3QuaW5jbHVkZXMoJ3RlbXBsYXRlZWRpdG9yJylcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xufVxuXG4vKipcbiAqIEdpdmVuIG5hbWVzcGFjZSBkYXRhLCB0aXRsZSwgdGl0bGUgbmFtZXNwYWNlLCByZXR1cm5zIGV4cGVjdGVkIHRpdGxlIG9mIHBhZ2VcbiAqIEFsb25nIHdpdGggdGl0bGUgd2l0aG91dCBwcmVmaXhcbiAqIFByZWNvbmRpdGlvbiwgdGl0bGUsIHRpdGxlTnMgaXMgYSBzdWJqZWN0IHBhZ2UhXG4gKi9cbmZ1bmN0aW9uIGdldFRhbGtQYWdlTmFtZShuYW1lc3BhY2VEYXRhLCB0aXRsZSwgdGl0bGVOYW1lc3BhY2UpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBjb25zdCBwcmVmaXhMZW5ndGggPSBuYW1lc3BhY2VEYXRhW3RpdGxlTmFtZXNwYWNlLnRvU3RyaW5nKCldWycqJ10ubGVuZ3RoID09PSAwID8gMCA6IG5hbWVzcGFjZURhdGFbdGl0bGVOYW1lc3BhY2UudG9TdHJpbmcoKV1bJyonXS5sZW5ndGggKyAxO1xuICAgIHJlc3VsdC50aXRsZVdpdGhvdXRQcmVmaXggPSB0aXRsZS5zdWJzdHJpbmcocHJlZml4TGVuZ3RoLCB0aXRsZS5sZW5ndGgpO1xuICAgIHJlc3VsdC50YWxrVGl0bGUgPSBgJHtuYW1lc3BhY2VEYXRhWyh0aXRsZU5hbWVzcGFjZSArIDEpLnRvU3RyaW5nKCldWycqJ119OiR7cmVzdWx0LnRpdGxlV2l0aG91dFByZWZpeH1gO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogR2l2ZW4gdHdvIChub3JtYWxpemVkKSB0aXRsZXMsIGZpbmQgdGhlaXIgbmFtZXNwYWNlcywgaWYgdGhleSBhcmUgcmVkaXJlY3RzLFxuICogaWYgaGF2ZSBhIHRhbGsgcGFnZSwgd2hldGhlciB0aGUgY3VycmVudCB1c2VyIGNhbiBtb3ZlIHRoZSBwYWdlcywgc3VnZ2VzdHNcbiAqIHdoZXRoZXIgbW92ZXN1YnBhZ2VzIHNob3VsZCBiZSBhbGxvd2VkLCB3aGV0aGVyIHRhbGsgcGFnZXMgbmVlZCB0byBiZSBjaGVja2VkXG4gKi9cbmZ1bmN0aW9uIHN3YXBWYWxpZGF0ZShzdGFydFRpdGxlLCBlbmRUaXRsZSwgcGFnZXNEYXRhLCBuYW1lc3BhY2VzRGF0YSwgdXNlclBlcm1pc3Npb25zKSB7XG4gICAgY29uc3QgcmVzdWx0ID0geyB2YWxpZDogdHJ1ZSwgYWxsb3dNb3ZlU3VicGFnZXM6IHRydWUsIGNoZWNrVGFsazogdHJ1ZSB9O1xuXG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBmb3IgKGNvbnN0IFtwYWdlSWQsIHBhZ2VEYXRhXSBvZiBPYmplY3QuZW50cmllcyhwYWdlc0RhdGEpKSB7XG4gICAgICAgIGNvdW50Kys7XG4gICAgICAgIGlmIChwYWdlSWQgPT09ICctMScgfHwgcGFnZURhdGEubnMgPCAwKSB7XG4gICAgICAgICAgICByZXN1bHQudmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHJlc3VsdC5lcnJvciA9IGBQYWdlICR7cGFnZURhdGEudGl0bGV9IGRvZXMgbm90IGV4aXN0LmA7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIC8vIEVuYWJsZSBvbmx5IGluIE1haW4sIFRhbGssIFVzZXIsIFVzZXIgdGFsaywgV2lraXBlZGlhLCBXaWtpcGVkaWEgdGFsaywgSGVscCwgSGVscCB0YWxrLCBEcmFmdCwgYW5kIERyYWZ0IHRhbGtcbiAgICAgICAgaWYgKChwYWdlRGF0YS5ucyA+PSA2ICYmIHBhZ2VEYXRhLm5zIDw9IDkpIHx8IChwYWdlRGF0YS5ucyA+PSAxMCAmJiBwYWdlRGF0YS5ucyA8PSAxMSAmJiAhdXNlclBlcm1pc3Npb25zLmFsbG93U3dhcFRlbXBsYXRlcykgfHwgKHBhZ2VEYXRhLm5zID49IDE0ICYmIHBhZ2VEYXRhLm5zIDw9IDExNykgfHwgcGFnZURhdGEubnMgPj0gMTIwKSB7XG4gICAgICAgICAgICByZXN1bHQudmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHJlc3VsdC5lcnJvciA9IGBOYW1lc3BhY2Ugb2YgJHtwYWdlRGF0YS50aXRsZX0gKCR7cGFnZURhdGEubnN9KSBub3Qgc3VwcG9ydGVkLlxcblxcbkxpa2VseSByZWFzb25zOlxcbi0gTmFtZXMgb2YgcGFnZXMgaW4gdGhpcyBuYW1lc3BhY2UgcmVsaWVzIG9uIG90aGVyIHBhZ2VzXFxuLSBOYW1lc3BhY2UgZmVhdHVyZXMgaGVhdmlseS10cmFuc2NsdWRlZCBwYWdlc1xcbi0gTmFtZXNwYWNlIGludm9sdmVzIHN1YnBhZ2VzOiBzd2FwcyBwcm9kdWNlIG1hbnkgcmVkbGlua3NcXG5cXG5cXG5JZiB0aGUgbW92ZSBpcyBsZWdpdGltYXRlLCBjb25zaWRlciBhIGNhcmVmdWwgbWFudWFsIHN3YXAuYDtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXJ0VGl0bGUgPT09IHBhZ2VEYXRhLnRpdGxlKSB7XG4gICAgICAgICAgICByZXN1bHQuY3VycmVudFRpdGxlID0gcGFnZURhdGEudGl0bGU7XG4gICAgICAgICAgICByZXN1bHQuY3VycmVudE5hbWVzcGFjZSA9IHBhZ2VEYXRhLm5zO1xuICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnRUYWxrSWQgPSBwYWdlRGF0YS50YWxraWQ7XG4gICAgICAgICAgICByZXN1bHQuY3VycmVudENhbk1vdmUgPSBwYWdlRGF0YS5hY3Rpb25zLm1vdmUgPT09ICcnO1xuICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnRJc1JlZGlyZWN0ID0gcGFnZURhdGEucmVkaXJlY3QgPT09ICcnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbmRUaXRsZSA9PT0gcGFnZURhdGEudGl0bGUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvblRpdGxlID0gcGFnZURhdGEudGl0bGU7XG4gICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25OYW1lc3BhY2UgPSBwYWdlRGF0YS5ucztcbiAgICAgICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvblRhbGtJZCA9IHBhZ2VEYXRhLnRhbGtpZDtcbiAgICAgICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvbkNhbk1vdmUgPSBwYWdlRGF0YS5hY3Rpb25zLm1vdmUgPT09ICcnO1xuICAgICAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uSXNSZWRpcmVjdCA9IHBhZ2VEYXRhLnJlZGlyZWN0ID09PSAnJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghcmVzdWx0LnZhbGlkKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmICghcmVzdWx0LmN1cnJlbnRDYW5Nb3ZlKSB7XG4gICAgICAgIHJlc3VsdC52YWxpZCA9IGZhbHNlO1xuICAgICAgICByZXN1bHQuZXJyb3IgPSBgJHtyZXN1bHQuY3VycmVudFRpdGxlfSBpcyBpbW1vdmFibGVgO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBpZiAoIXJlc3VsdC5kZXN0aW5hdGlvbkNhbk1vdmUpIHtcbiAgICAgICAgcmVzdWx0LnZhbGlkID0gZmFsc2U7XG4gICAgICAgIHJlc3VsdC5lcnJvciA9IGAke3Jlc3VsdC5kZXN0aW5hdGlvblRpdGxlfSBpcyBpbW1vdmFibGVgO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBpZiAocmVzdWx0LmN1cnJlbnROYW1lc3BhY2UgJSAyICE9PSByZXN1bHQuZGVzdGluYXRpb25OYW1lc3BhY2UgJSAyKSB7XG4gICAgICAgIHJlc3VsdC52YWxpZCA9IGZhbHNlO1xuICAgICAgICByZXN1bHQuZXJyb3IgPSBcIk5hbWVzcGFjZXMgZG9uJ3QgbWF0Y2g6IG9uZSBpcyBhIHRhbGsgcGFnZSwgdGhlIG90aGVyIGlzIG5vdFwiO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBpZiAoY291bnQgIT09IDIpIHtcbiAgICAgICAgcmVzdWx0LnZhbGlkID0gZmFsc2U7XG4gICAgICAgIHJlc3VsdC5lcnJvciA9ICdEZXN0aW5hdGlvbiB0aXRsZSBpcyB0aGUgc2FtZSBhcyB0aGUgY3VycmVudCB0aXRsZSc7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIHJlc3VsdC5jdXJyZW50TmFtZXNwYWNlQWxsb3dTdWJwYWdlcyA9IG5hbWVzcGFjZXNEYXRhW3Jlc3VsdC5jdXJyZW50TmFtZXNwYWNlLnRvU3RyaW5nKCldLnN1YnBhZ2VzICE9PSAnJztcbiAgICByZXN1bHQuZGVzdGluYXRpb25OYW1lc3BhY2VBbGxvd1N1YnBhZ2VzID0gbmFtZXNwYWNlc0RhdGFbcmVzdWx0LmRlc3RpbmF0aW9uTmFtZXNwYWNlLnRvU3RyaW5nKCldLnN1YnBhZ2VzICE9PSAnJztcblxuICAgIC8vIElmIHNhbWUgbmFtZXNwYWNlIChzdWJwYWdlcyBhbGxvd2VkKSwgaWYgb25lIGlzIHN1YnBhZ2Ugb2YgYW5vdGhlciwgZGlzYWxsb3cgbW92aW5nIHN1YnBhZ2VzXG4gICAgaWYgKHJlc3VsdC5jdXJyZW50VGl0bGUuc3RhcnRzV2l0aChyZXN1bHQuZGVzdGluYXRpb25UaXRsZSArICcvJykgfHwgcmVzdWx0LmRlc3RpbmF0aW9uVGl0bGUuc3RhcnRzV2l0aChyZXN1bHQuY3VycmVudFRpdGxlICsgJy8nKSkge1xuICAgICAgICBpZiAocmVzdWx0LmN1cnJlbnROYW1lc3BhY2UgIT09IHJlc3VsdC5kZXN0aW5hdGlvbk5hbWVzcGFjZSkge1xuICAgICAgICAgICAgcmVzdWx0LnZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgICByZXN1bHQuZXJyb3IgPSBgJHtyZXN1bHQuY3VycmVudFRpdGxlfSBpbiBucyAke3Jlc3VsdC5jdXJyZW50TmFtZXNwYWNlfVxcbiR7cmVzdWx0LmRlc3RpbmF0aW9uVGl0bGV9IGluIG5zICR7cmVzdWx0LmRlc3RpbmF0aW9uTmFtZXNwYWNlfS4gRGlzYWxsb3dpbmcuYDtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQuYWxsb3dNb3ZlU3VicGFnZXMgPSByZXN1bHQuY3VycmVudE5hbWVzcGFjZUFsbG93U3VicGFnZXM7XG4gICAgICAgIGlmICghcmVzdWx0LmFsbG93TW92ZVN1YnBhZ2VzKSByZXN1bHQuYWRkTGluZUluZm8gPSAnT25lIHBhZ2UgaXMgYSBzdWJwYWdlLiBEaXNhbGxvd2luZyBtb3ZlLXN1YnBhZ2VzJztcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0LmN1cnJlbnROYW1lc3BhY2UgJSAyID09PSAxKSByZXN1bHQuY2hlY2tUYWxrID0gZmFsc2U7IC8vIE5vIG5lZWQgdG8gY2hlY2sgdGFsa3MsIGFscmVhZHkgdGFsayBwYWdlc1xuICAgIGVsc2Uge1xuICAgICAgICBjb25zdCBjdXJyZW50VGFsa0RhdGEgPSBnZXRUYWxrUGFnZU5hbWUobmFtZXNwYWNlc0RhdGEsIHJlc3VsdC5jdXJyZW50VGl0bGUsIHJlc3VsdC5jdXJyZW50TmFtZXNwYWNlKTtcbiAgICAgICAgcmVzdWx0LmN1cnJlbnRUaXRsZVdpdGhvdXRQcmVmaXggPSBjdXJyZW50VGFsa0RhdGEudGl0bGVXaXRob3V0UHJlZml4O1xuICAgICAgICByZXN1bHQuY3VycmVudFRhbGtOYW1lID0gY3VycmVudFRhbGtEYXRhLnRhbGtUaXRsZTtcbiAgICAgICAgY29uc3QgZGVzdGluYXRpb25EYXRhID0gZ2V0VGFsa1BhZ2VOYW1lKG5hbWVzcGFjZXNEYXRhLCByZXN1bHQuZGVzdGluYXRpb25UaXRsZSwgcmVzdWx0LmRlc3RpbmF0aW9uTmFtZXNwYWNlKTtcbiAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uVGl0bGVXaXRob3V0UHJlZml4ID0gZGVzdGluYXRpb25EYXRhLnRpdGxlV2l0aG91dFByZWZpeDtcbiAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uVGFsa05hbWUgPSBkZXN0aW5hdGlvbkRhdGEudGFsa1RpdGxlO1xuICAgICAgICAvLyBUT0RPOiBwb3NzaWJsZSB0aGF0IHJldC5jdXJyZW50VGFsa0lkIGlzIHVuZGVmaW5lZCwgYnV0IHN1YmplY3QgcGFnZSBoYXMgdGFsayBzdWJwYWdlc1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogR2l2ZW4gdHdvIHRhbGsgcGFnZSB0aXRsZXMgKG1heSBiZSB1bmRlZmluZWQpLCByZXRyaWV2ZXMgdGhlaXIgcGFnZXMgZm9yIGNvbXBhcmlzb25cbiAqIEFzc3VtZXMgdGhhdCB0YWxrIHBhZ2VzIGFsd2F5cyBoYXZlIHN1YnBhZ2VzIGVuYWJsZWQuXG4gKiBBc3N1bWVzIHRoYXQgcGFnZXMgYXJlIG5vdCBpZGVudGljYWwgKHN1YmplY3QgcGFnZXMgd2VyZSBhbHJlYWR5IHZlcmlmaWVkKVxuICogQXNzdW1lcyBuYW1lc3BhY2VzIGFyZSBva2F5IChzdWJqZWN0IHBhZ2VzIGFscmVhZHkgY2hlY2tlZClcbiAqIChDdXJyZW50bHkpIGFzc3VtZXMgdGhhdCB0aGUgbWFsaWNpb3VzIGNhc2Ugb2Ygc3ViamVjdCBwYWdlc1xuICogICBub3QgZGV0ZWN0ZWQgYXMgc3VicGFnZXMgYW5kIHRoZSB0YWxrIHBhZ2VzIEFSRSBzdWJwYWdlc1xuICogICAoaS5lLiBBIGFuZCBBL0IgdnMuIFRhbGs6QSBhbmQgVGFsazpBL0IpIGRvZXMgbm90IGhhcHBlbiAvIGRvZXMgbm90IGhhbmRsZVxuICogUmV0dXJucyBzdHJ1Y3R1cmUgaW5kaWNhdGluZyB3aGV0aGVyIG1vdmUgdGFsayBzaG91bGQgYmUgYWxsb3dlZFxuICovXG5hc3luYyBmdW5jdGlvbiB0YWxrVmFsaWRhdGUoY2hlY2tUYWxrLCBmaXJzdFRhbGssIHNlY29uZFRhbGspIHtcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICByZXN1bHQuYWxsb3dNb3ZlVGFsayA9IHRydWU7XG4gICAgaWYgKCFjaGVja1RhbGspIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKGZpcnN0VGFsayA9PT0gdW5kZWZpbmVkIHx8IHNlY29uZFRhbGsgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtdy5ub3RpZnkoJ1VuYWJsZSB0byB2YWxpZGF0ZSB0YWxrLiBEaXNhbGxvd2luZyBtb3ZldGFsayB0byBiZSBzYWZlJywgeyB0eXBlOiAnZXJyb3InIH0pO1xuICAgICAgICByZXN1bHQuYWxsb3dNb3ZlVGFsayA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICByZXN1bHQuY3VyclRETkUgPSB0cnVlO1xuICAgIHJlc3VsdC5kZXN0VERORSA9IHRydWU7XG4gICAgcmVzdWx0LmN1cnJlbnRUYWxrQ2FuQ3JlYXRlID0gdHJ1ZTtcbiAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrQ2FuQ3JlYXRlID0gdHJ1ZTtcbiAgICBjb25zdCB0YWxrVGl0bGVBcnIgPSBbZmlyc3RUYWxrLCBzZWNvbmRUYWxrXTtcbiAgICBpZiAodGFsa1RpdGxlQXJyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgdGFsa0RhdGEgPSAoXG4gICAgICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHtcbiAgICAgICAgICAgICAgICBhY3Rpb246ICdxdWVyeScsXG4gICAgICAgICAgICAgICAgcHJvcDogJ2luZm8nLFxuICAgICAgICAgICAgICAgIGludGVzdGFjdGlvbnM6ICdtb3ZlfGNyZWF0ZScsXG4gICAgICAgICAgICAgICAgdGl0bGVzOiB0YWxrVGl0bGVBcnIuam9pbignfCcpXG4gICAgICAgICAgICB9KVxuICAgICAgICApLnF1ZXJ5LnBhZ2VzO1xuXG4gICAgICAgIGZvciAoY29uc3QgWywgcGFnZURhdGFdIG9mIE9iamVjdC5lbnRyaWVzKHRhbGtEYXRhKSlcbiAgICAgICAgICAgIGlmIChwYWdlRGF0YS50aXRsZSA9PT0gZmlyc3RUYWxrKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmN1cnJURE5FID0gcGFnZURhdGEuaW52YWxpZCA9PT0gJycgfHwgcGFnZURhdGEubWlzc2luZyA9PT0gJyc7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnRUYWxrVGl0bGUgPSBwYWdlRGF0YS50aXRsZTtcbiAgICAgICAgICAgICAgICByZXN1bHQuY3VycmVudFRhbGtDYW5Nb3ZlID0gcGFnZURhdGEuYWN0aW9ucy5tb3ZlID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuY3VycmVudFRhbGtDYW5DcmVhdGUgPSBwYWdlRGF0YS5hY3Rpb25zLmNyZWF0ZSA9PT0gJyc7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnRUYWxrSXNSZWRpcmVjdCA9IHBhZ2VEYXRhLnJlZGlyZWN0ID09PSAnJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGFnZURhdGEudGl0bGUgPT09IHNlY29uZFRhbGspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdFRETkUgPSBwYWdlRGF0YS5pbnZhbGlkID09PSAnJyB8fCBwYWdlRGF0YS5taXNzaW5nID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrVGl0bGUgPSBwYWdlRGF0YS50aXRsZTtcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrQ2FuTW92ZSA9IHBhZ2VEYXRhLmFjdGlvbnMubW92ZSA9PT0gJyc7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uVGFsa0NhbkNyZWF0ZSA9IHBhZ2VEYXRhLmFjdGlvbnMuY3JlYXRlID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrSXNSZWRpcmVjdCA9IHBhZ2VEYXRhLnJlZGlyZWN0ID09PSAnJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbXcubm90aWZ5KCdGb3VuZCBwYWdlaWQgbm90IG1hdGNoaW5nIGdpdmVuIGlkcy4nLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc3VsdC5hbGxvd01vdmVUYWxrID0gcmVzdWx0LmN1cnJlbnRUYWxrQ2FuQ3JlYXRlICYmIHJlc3VsdC5jdXJyZW50VGFsa0Nhbk1vdmUgJiYgcmVzdWx0LmRlc3RpbmF0aW9uVGFsa0NhbkNyZWF0ZSAmJiByZXN1bHQuZGVzdGluYXRpb25UYWxrQ2FuTW92ZTtcbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEdpdmVuIGV4aXN0aW5nIHRpdGxlIChub3QgcHJlZml4ZWQgd2l0aCBcIi9cIiksIG9wdGlvbmFsbHkgc2VhcmNoaW5nIGZvciB0YWxrLFxuICogICBmaW5kcyBzdWJwYWdlcyAoaW5jbC4gdGhvc2UgdGhhdCBhcmUgcmVkaXJzKSBhbmQgd2hldGhlciBsaW1pdHMgYXJlIGV4Y2VlZGVkXG4gKiBBcyBvZiAyMDE2LTA4LCB1c2VzIDIgYXBpIGdldCBjYWxscyB0byBnZXQgbmVlZGVkIGRldGFpbHM6XG4gKiAgIHdoZXRoZXIgdGhlIHBhZ2UgY2FuIGJlIG1vdmVkLCB3aGV0aGVyIHRoZSBwYWdlIGlzIGEgcmVkaXJlY3RcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0U3VicGFnZXMobmFtZXNwYWNlRGF0YSwgdGl0bGUsIHRpdGxlTmFtZXNwYWNlLCBpc1RhbGspIHtcbiAgICBpZiAoIWlzVGFsayAmJiBuYW1lc3BhY2VEYXRhW3RpdGxlTmFtZXNwYWNlLnRvU3RyaW5nKCldLnN1YnBhZ2VzICE9PSAnJykgcmV0dXJuIHsgZGF0YTogW10gfTtcblxuICAgIGNvbnN0IHRpdGxlUGFnZURhdGEgPSBnZXRUYWxrUGFnZU5hbWUobmFtZXNwYWNlRGF0YSwgdGl0bGUsIHRpdGxlTmFtZXNwYWNlKTtcbiAgICBjb25zdCBzdWJwYWdlcyA9IChcbiAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7XG4gICAgICAgICAgICBhY3Rpb246ICdxdWVyeScsXG4gICAgICAgICAgICBsaXN0OiAnYWxscGFnZXMnLFxuICAgICAgICAgICAgYXBuYW1lc3BhY2U6IGlzVGFsayA/IHRpdGxlTmFtZXNwYWNlICsgMSA6IHRpdGxlTmFtZXNwYWNlLFxuICAgICAgICAgICAgYXBmcm9tOiB0aXRsZVBhZ2VEYXRhLnRpdGxlV2l0aG91dFByZWZpeCArICcvJyxcbiAgICAgICAgICAgIGFwdG86IHRpdGxlUGFnZURhdGEudGl0bGVXaXRob3V0UHJlZml4ICsgJzAnLFxuICAgICAgICAgICAgYXBsaW1pdDogMTAxXG4gICAgICAgIH0pXG4gICAgKS5xdWVyeS5hbGxwYWdlcztcblxuICAgIC8vIFR3byBxdWVyaWVzIGFyZSBuZWVkZWQgZHVlIHRvIEFQSSBsaW1pdHNcbiAgICBjb25zdCBzdWJwYWdlSWRzID0gW1tdLCBbXV07XG4gICAgZm9yIChjb25zdCBpZCBpbiBzdWJwYWdlcykgc3VicGFnZUlkc1tpZCA8IDUwID8gMCA6IDFdLnB1c2goc3VicGFnZXNbaWRdLnBhZ2VpZCk7XG5cbiAgICBpZiAoc3VicGFnZUlkc1swXS5sZW5ndGggPT09IDApIHJldHVybiB7IGRhdGE6IFtdIH07XG5cbiAgICBpZiAoc3VicGFnZUlkc1sxXS5sZW5ndGggPT09IDUxKSByZXR1cm4geyBlcnJvcjogJzEwMCsgc3VicGFnZXMsIHRvbyBtYW55IHRvIG1vdmUuJyB9O1xuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgY29uc3Qgc3VicGFnZURhdGFPbmUgPSAoXG4gICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKS5nZXQoe1xuICAgICAgICAgICAgYWN0aW9uOiAncXVlcnknLFxuICAgICAgICAgICAgcHJvcDogJ2luZm8nLFxuICAgICAgICAgICAgaW50ZXN0YWN0aW9uczogJ21vdmV8Y3JlYXRlJyxcbiAgICAgICAgICAgIHBhZ2VpZHM6IHN1YnBhZ2VJZHNbMF0uam9pbignfCcpXG4gICAgICAgIH0pXG4gICAgKS5xdWVyeS5wYWdlcztcbiAgICBmb3IgKGNvbnN0IFssIHBhZ2VEYXRhXSBvZiBPYmplY3QuZW50cmllcyhzdWJwYWdlRGF0YU9uZSkpXG4gICAgICAgIHJlc3VsdC5wdXNoKHtcbiAgICAgICAgICAgIHRpdGxlOiBwYWdlRGF0YS50aXRsZSxcbiAgICAgICAgICAgIGlzUmVkaXI6IHBhZ2VEYXRhLnJlZGlyZWN0ID09PSAnJyxcbiAgICAgICAgICAgIGNhbk1vdmU6IHBhZ2VEYXRhLmFjdGlvbnM/Lm1vdmUgPT09ICcnXG4gICAgICAgIH0pO1xuXG4gICAgaWYgKHN1YnBhZ2VJZHNbMV0ubGVuZ3RoID09PSAwKSByZXR1cm4geyBkYXRhOiByZXN1bHQgfTtcblxuICAgIGNvbnN0IHN1YnBhZ2VEYXRhVHdvID0gKFxuICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHtcbiAgICAgICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgIHByb3A6ICdpbmZvJyxcbiAgICAgICAgICAgIGludGVzdGFjdGlvbnM6ICdtb3ZlfGNyZWF0ZScsXG4gICAgICAgICAgICBwYWdlaWRzOiBzdWJwYWdlSWRzWzFdLmpvaW4oJ3wnKVxuICAgICAgICB9KVxuICAgICkucXVlcnkucGFnZXM7XG4gICAgZm9yIChjb25zdCBbLCBwYWdlRGF0YV0gb2YgT2JqZWN0LmVudHJpZXMoc3VicGFnZURhdGFUd28pKVxuICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICB0aXRsZTogcGFnZURhdGEudGl0bGUsXG4gICAgICAgICAgICBpc1JlZGlyZWN0OiBwYWdlRGF0YS5yZWRpcmVjdCA9PT0gJycsXG4gICAgICAgICAgICBjYW5Nb3ZlOiBwYWdlRGF0YS5hY3Rpb25zPy5tb3ZlID09PSAnJ1xuICAgICAgICB9KTtcblxuICAgIHJldHVybiB7IGRhdGE6IHJlc3VsdCB9O1xufVxuXG4vKipcbiAqIFByaW50cyBzdWJwYWdlIGRhdGEgZ2l2ZW4gcmV0cmlldmVkIHN1YnBhZ2UgaW5mb3JtYXRpb24gcmV0dXJuZWQgYnkgZ2V0U3VicGFnZXNcbiAqIFJldHVybnMgYSBzdWdnZXN0aW9uIHdoZXRoZXIgbW92ZXN1YnBhZ2VzIHNob3VsZCBiZSBhbGxvd2VkXG4gKi9cbmZ1bmN0aW9uIHByaW50U3VicGFnZUluZm8oYmFzZVBhZ2UsIGN1cnJlbnRTdWJwYWdlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgY29uc3QgY3VycmVudFN1YnBhZ2VzID0gW107XG4gICAgY29uc3Qgc3VicGFnZXNDYW5ub3RNb3ZlID0gW107XG4gICAgbGV0IHJlZGlyZWN0Q291bnQgPSAwO1xuICAgIGZvciAoY29uc3QgWywgcGFnZURhdGFdIG9mIE9iamVjdC5lbnRyaWVzKGN1cnJlbnRTdWJwYWdlLmRhdGEpKSB7XG4gICAgICAgIGlmICghcGFnZURhdGEuY2FuTW92ZSkgc3VicGFnZXNDYW5ub3RNb3ZlLnB1c2gocGFnZURhdGEudGl0bGUpO1xuXG4gICAgICAgIGN1cnJlbnRTdWJwYWdlcy5wdXNoKChwYWdlRGF0YS5pc1JlZGlyZWN0ID8gJyhSKSAnIDogJyAgJykgKyBwYWdlRGF0YS50aXRsZSk7XG4gICAgICAgIGlmIChwYWdlRGF0YS5pc1JlZGlyZWN0KSByZWRpcmVjdENvdW50Kys7XG4gICAgfVxuXG4gICAgaWYgKGN1cnJlbnRTdWJwYWdlcy5sZW5ndGggPiAwKSBtdy5ub3RpZnkoc3VicGFnZXNDYW5ub3RNb3ZlLmxlbmd0aCA+IDAgPyBgRGlzYWJsaW5nIG1vdmUtc3VicGFnZXMuXFxuVGhlIGZvbGxvd2luZyAke3N1YnBhZ2VzQ2Fubm90TW92ZS5sZW5ndGh9IChvZiAke2N1cnJlbnRTdWJwYWdlcy5sZW5ndGh9KSB0b3RhbCBzdWJwYWdlcyBvZiAke2Jhc2VQYWdlfSBDQU5OT1QgYmUgbW92ZWQ6XFxuXFxuJHtzdWJwYWdlc0Nhbm5vdE1vdmUuam9pbignLCAnKX1gIDogYCR7Y3VycmVudFN1YnBhZ2VzLmxlbmd0aH0gdG90YWwgc3VicGFnZXMgb2YgJHtiYXNlUGFnZX0uJHtyZWRpcmVjdENvdW50ICE9PSAwID8gYCAke3JlZGlyZWN0Q291bnR9IHJlZGlyZWN0cywgbGFiZWxlZCAoUilgIDogJyd9OiAke2N1cnJlbnRTdWJwYWdlcy5qb2luKCcsICcpfWApO1xuXG4gICAgcmVzdWx0LmFsbG93TW92ZVN1YnBhZ2VzID0gc3VicGFnZXNDYW5ub3RNb3ZlLmxlbmd0aCA9PT0gMDtcbiAgICByZXN1bHQubm9OZWVkID0gY3VycmVudFN1YnBhZ2VzLmxlbmd0aCA9PT0gMDtcbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFN3YXBzIHRoZSB0d28gcGFnZXMgKGdpdmVuIGFsbCBwcmVyZXF1aXNpdGUgY2hlY2tzKVxuICogT3B0aW9uYWxseSBtb3ZlcyB0YWxrIHBhZ2VzIGFuZCBzdWJwYWdlc1xuICovXG5mdW5jdGlvbiBzd2FwUGFnZXModGl0bGVPbmUsIHRpdGxlVHdvLCBzdW1tYXJ5LCBtb3ZlVGFsaywgbW92ZVN1YnBhZ2VzKSB7XG4gICAgY29uc3QgaW50ZXJtZWRpYXRlVGl0bGUgPSBgRHJhZnQ6TW92ZS8ke3RpdGxlT25lfWA7XG5cbiAgICBjb25zdCBtb3ZlcyA9IFtcbiAgICAgICAgeyBhY3Rpb246ICdtb3ZlJywgZnJvbTogdGl0bGVUd28sIHRvOiBpbnRlcm1lZGlhdGVUaXRsZSwgcmVhc29uOiAnW1tXUDpST1VORFJPQklOfFJvdW5kLXJvYmluIHBhZ2UgbW92ZV1dIHN0ZXAgMSAod2l0aCBbW1VzZXI6RWVqaXQ0My9zY3JpcHRzL3BhZ2Vzd2FwfHBhZ2Vzd2FwIDJdXSknLCB3YXRjaGxpc3Q6ICd1bndhdGNoJywgbm9yZWRpcmVjdDogMSB9LFxuICAgICAgICB7IGFjdGlvbjogJ21vdmUnLCBmcm9tOiB0aXRsZU9uZSwgdG86IHRpdGxlVHdvLCByZWFzb246IHN1bW1hcnksIHdhdGNobGlzdDogJ3Vud2F0Y2gnLCBub3JlZGlyZWN0OiAxIH0sXG4gICAgICAgIHsgYWN0aW9uOiAnbW92ZScsIGZyb206IGludGVybWVkaWF0ZVRpdGxlLCB0bzogdGl0bGVPbmUsIHJlYXNvbjogJ1tbV1A6Uk9VTkRST0JJTnxSb3VuZC1yb2JpbiBwYWdlIG1vdmVdXSBzdGVwIDMgKHdpdGggW1tVc2VyOkVlaml0NDMvc2NyaXB0cy9wYWdlc3dhcHxwYWdlc3dhcCAyXV0pJywgd2F0Y2hsaXN0OiAndW53YXRjaCcsIG5vcmVkaXJlY3Q6IDEgfVxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IG1vdmUgb2YgbW92ZXMpIHtcbiAgICAgICAgaWYgKG1vdmVUYWxrKSBtb3ZlLm1vdmV0YWxrID0gMTtcbiAgICAgICAgaWYgKG1vdmVTdWJwYWdlcykgbW92ZS5tb3Zlc3VicGFnZXMgPSAxO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICBsZXQgaSA9IDA7XG5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGpzZG9jL3JlcXVpcmUtanNkb2NcbiAgICAgICAgZnVuY3Rpb24gZG9Nb3ZlKCkge1xuICAgICAgICAgICAgaWYgKGkgPj0gbW92ZXMubGVuZ3RoKSByZXR1cm4gcmVzb2x2ZShyZXN1bHQpO1xuXG4gICAgICAgICAgICBuZXcgbXcuQXBpKClcbiAgICAgICAgICAgICAgICAucG9zdFdpdGhUb2tlbignY3NyZicsIG1vdmVzW2ldKVxuICAgICAgICAgICAgICAgIC5kb25lKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICAgICAgICBkb01vdmUoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5mYWlsKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0Lm1lc3NhZ2UgPSBgRmFpbGVkIG9uIG1vdmUgJHtpICsgMX0gKCR7bW92ZXNbaV0uZnJvbX0gXHUyMTkyICR7bW92ZXNbaV0udG99KWA7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZG9Nb3ZlKCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBHaXZlbiB0d28gdGl0bGVzLCBub3JtYWxpemVzLCBkb2VzIHByZXJlcXVpc2l0ZSBjaGVja3MgZm9yIHRhbGsvc3VicGFnZXMsXG4gKiBwcm9tcHRzIHVzZXIgZm9yIGNvbmZpZyBiZWZvcmUgc3dhcHBpbmcgdGhlIHRpdGxlc1xuICovXG5hc3luYyBmdW5jdGlvbiByb3VuZFJvYmluKHVzZXJQZXJtaXNzaW9ucywgY3VycmVudFRpdGxlLCBkZXN0aW5hdGlvblRpdGxlLCBzdW1tYXJ5LCBtb3ZlVGFsaywgbW92ZVN1YnBhZ2VzKSB7XG4gICAgLy8gR2VuZXJhbCBpbmZvcm1hdGlvbiBhYm91dCBhbGwgbmFtZXNwYWNlc1xuICAgIGNvbnN0IG5hbWVzcGFjZXNJbmZvcm1hdGlvbiA9IChcbiAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7XG4gICAgICAgICAgICBhY3Rpb246ICdxdWVyeScsXG4gICAgICAgICAgICBtZXRhOiAnc2l0ZWluZm8nLFxuICAgICAgICAgICAgc2lwcm9wOiAnbmFtZXNwYWNlcydcbiAgICAgICAgfSlcbiAgICApLnF1ZXJ5Lm5hbWVzcGFjZXM7XG5cbiAgICAvLyBTcGVjaWZpYyBpbmZvcm1hdGlvbiBhYm91dCBjdXJyZW50IGFuZCBkZXN0aW5hdGlvbiBwYWdlc1xuICAgIGNvbnN0IHBhZ2VzRGF0YSA9IChcbiAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7XG4gICAgICAgICAgICBhY3Rpb246ICdxdWVyeScsXG4gICAgICAgICAgICBwcm9wOiAnaW5mbycsXG4gICAgICAgICAgICBpbnByb3A6ICd0YWxraWQnLFxuICAgICAgICAgICAgaW50ZXN0YWN0aW9uczogJ21vdmV8Y3JlYXRlJyxcbiAgICAgICAgICAgIHRpdGxlczogYCR7Y3VycmVudFRpdGxlfXwke2Rlc3RpbmF0aW9uVGl0bGV9YFxuICAgICAgICB9KVxuICAgICkucXVlcnk7XG5cbiAgICAvLyBOb3JtYWxpemUgdGl0bGVzIGlmIG5lY2Vzc2FyeVxuICAgIGZvciAoY29uc3QgY2hhbmdlcyBpbiBwYWdlc0RhdGEubm9ybWFsaXplZCkge1xuICAgICAgICBpZiAoY3VycmVudFRpdGxlID09PSBwYWdlc0RhdGEubm9ybWFsaXplZFtjaGFuZ2VzXS5mcm9tKSBjdXJyZW50VGl0bGUgPSBwYWdlc0RhdGEubm9ybWFsaXplZFtjaGFuZ2VzXS50bztcbiAgICAgICAgaWYgKGRlc3RpbmF0aW9uVGl0bGUgPT09IHBhZ2VzRGF0YS5ub3JtYWxpemVkW2NoYW5nZXNdLmZyb20pIGRlc3RpbmF0aW9uVGl0bGUgPSBwYWdlc0RhdGEubm9ybWFsaXplZFtjaGFuZ2VzXS50bztcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZSBuYW1lc3BhY2VzXG4gICAgY29uc3QgdmFsaWRhdGlvbkRhdGEgPSBzd2FwVmFsaWRhdGUoY3VycmVudFRpdGxlLCBkZXN0aW5hdGlvblRpdGxlLCBwYWdlc0RhdGEucGFnZXMsIG5hbWVzcGFjZXNJbmZvcm1hdGlvbiwgdXNlclBlcm1pc3Npb25zKTtcbiAgICBpZiAoIXZhbGlkYXRpb25EYXRhLnZhbGlkKSB0aHJvdyBuZXcgRXJyb3IodmFsaWRhdGlvbkRhdGEuZXJyb3IpO1xuXG4gICAgaWYgKHZhbGlkYXRpb25EYXRhLmFkZExpbmVJbmZvICE9PSB1bmRlZmluZWQpIG13Lm5vdGlmeSh2YWxpZGF0aW9uRGF0YS5hZGRMaW5lSW5mbyk7XG5cbiAgICAvLyBTdWJwYWdlIGNoZWNrc1xuICAgIGNvbnN0IGN1cnJlbnRTdWJwYWdlcyA9IGF3YWl0IGdldFN1YnBhZ2VzKG5hbWVzcGFjZXNJbmZvcm1hdGlvbiwgdmFsaWRhdGlvbkRhdGEuY3VycmVudFRpdGxlLCB2YWxpZGF0aW9uRGF0YS5jdXJyZW50TmFtZXNwYWNlLCBmYWxzZSk7XG4gICAgaWYgKGN1cnJlbnRTdWJwYWdlcy5lcnJvciAhPT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoY3VycmVudFN1YnBhZ2VzLmVycm9yKTtcbiAgICBjb25zdCBjdXJyZW50U3VicGFnZUZsYWdzID0gcHJpbnRTdWJwYWdlSW5mbyh2YWxpZGF0aW9uRGF0YS5jdXJyZW50VGl0bGUsIGN1cnJlbnRTdWJwYWdlcyk7XG4gICAgY29uc3QgZGVzdGluYXRpb25TdWJwYWdlcyA9IGF3YWl0IGdldFN1YnBhZ2VzKG5hbWVzcGFjZXNJbmZvcm1hdGlvbiwgdmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25UaXRsZSwgdmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25OYW1lc3BhY2UsIGZhbHNlKTtcbiAgICBpZiAoZGVzdGluYXRpb25TdWJwYWdlcy5lcnJvciAhPT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoZGVzdGluYXRpb25TdWJwYWdlcy5lcnJvcik7XG4gICAgY29uc3QgZGVzdGluYXRpb25TdWJwYWdlRmxhZ3MgPSBwcmludFN1YnBhZ2VJbmZvKHZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uVGl0bGUsIGRlc3RpbmF0aW9uU3VicGFnZXMpO1xuXG4gICAgY29uc3QgdGFsa1ZhbGlkYXRpb25EYXRhID0gYXdhaXQgdGFsa1ZhbGlkYXRlKHZhbGlkYXRpb25EYXRhLmNoZWNrVGFsaywgdmFsaWRhdGlvbkRhdGEuY3VycmVudFRhbGtOYW1lLCB2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRhbGtOYW1lKTtcblxuICAgIC8vIFRPRE86IGNoZWNrIGVtcHR5IHN1YnBhZ2UgZGVzdGluYXRpb25zIG9uIGJvdGggc2lkZXMgKHN1YmosIHRhbGspIGZvciBjcmVhdGUgcHJvdGVjdGlvblxuICAgIGNvbnN0IGN1cnJlbnRUYWxrU3VicGFnZXMgPSBhd2FpdCBnZXRTdWJwYWdlcyhuYW1lc3BhY2VzSW5mb3JtYXRpb24sIHZhbGlkYXRpb25EYXRhLmN1cnJlbnRUaXRsZSwgdmFsaWRhdGlvbkRhdGEuY3VycmVudE5hbWVzcGFjZSwgdHJ1ZSk7XG4gICAgaWYgKGN1cnJlbnRUYWxrU3VicGFnZXMuZXJyb3IgIT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEVycm9yKGN1cnJlbnRUYWxrU3VicGFnZXMuZXJyb3IpO1xuICAgIGNvbnN0IGN1cnJlbnRUYWxrU3VicGFnZUZsYWdzID0gcHJpbnRTdWJwYWdlSW5mbyh2YWxpZGF0aW9uRGF0YS5jdXJyZW50VGFsa05hbWUsIGN1cnJlbnRUYWxrU3VicGFnZXMpO1xuICAgIGNvbnN0IGRlc3RpbmF0aW9uVGFsa1N1YnBhZ2VzID0gYXdhaXQgZ2V0U3VicGFnZXMobmFtZXNwYWNlc0luZm9ybWF0aW9uLCB2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRpdGxlLCB2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvbk5hbWVzcGFjZSwgdHJ1ZSk7XG4gICAgaWYgKGRlc3RpbmF0aW9uVGFsa1N1YnBhZ2VzLmVycm9yICE9PSB1bmRlZmluZWQpIHRocm93IG5ldyBFcnJvcihkZXN0aW5hdGlvblRhbGtTdWJwYWdlcy5lcnJvcik7XG4gICAgY29uc3QgZGVzdGluYXRpb25UYWxrU3VicGFnZUZsYWdzID0gcHJpbnRTdWJwYWdlSW5mbyh2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRhbGtOYW1lLCBkZXN0aW5hdGlvblRhbGtTdWJwYWdlcyk7XG5cbiAgICBjb25zdCBub1N1YnBhZ2VzID0gY3VycmVudFN1YnBhZ2VGbGFncy5ub05lZWQgJiYgZGVzdGluYXRpb25TdWJwYWdlRmxhZ3Mubm9OZWVkICYmIGN1cnJlbnRUYWxrU3VicGFnZUZsYWdzLm5vTmVlZCAmJiBkZXN0aW5hdGlvblRhbGtTdWJwYWdlRmxhZ3Mubm9OZWVkO1xuICAgIC8vIElmIG9uZSBuYW1lc3BhY2UgZGlzYWJsZXMgc3VicGFnZXMsIG90aGVyIGVuYWJsZXMgc3VicGFnZXMgKGFuZCBoYXMgc3VicGFnZXMpLCBjb25zaWRlciBhYm9ydC4gQXNzdW1lIHRhbGsgcGFnZXMgYWx3YXlzIHNhZmUgKFRPRE8gZml4KVxuICAgIGNvbnN0IHN1YnBhZ2VDb2xsaXNpb24gPSAodmFsaWRhdGlvbkRhdGEuY3VycmVudE5hbWVzcGFjZUFsbG93U3VicGFnZXMgJiYgIWRlc3RpbmF0aW9uU3VicGFnZUZsYWdzLm5vTmVlZCkgfHwgKHZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uTmFtZXNwYWNlQWxsb3dTdWJwYWdlcyAmJiAhY3VycmVudFN1YnBhZ2VGbGFncy5ub05lZWQpO1xuXG4gICAgaWYgKG1vdmVUYWxrICYmIHZhbGlkYXRpb25EYXRhLmNoZWNrVGFsayAmJiAhdGFsa1ZhbGlkYXRpb25EYXRhLmFsbG93TW92ZVRhbGspIHtcbiAgICAgICAgbW92ZVRhbGsgPSBmYWxzZTtcbiAgICAgICAgbXcubm90aWZ5KGBEaXNhbGxvd2luZyBtb3ZpbmcgdGFsay4gJHshdGFsa1ZhbGlkYXRpb25EYXRhLmN1cnJlbnRUYWxrQ2FuQ3JlYXRlID8gYCR7dmFsaWRhdGlvbkRhdGEuY3VycmVudFRhbGtOYW1lfSBpcyBjcmVhdGUtcHJvdGVjdGVkYCA6ICF0YWxrVmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25UYWxrQ2FuQ3JlYXRlID8gYCR7dmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25UYWxrTmFtZX0gaXMgY3JlYXRlLXByb3RlY3RlZGAgOiAnVGFsayBwYWdlIGlzIGltbW92YWJsZSd9YCk7XG4gICAgfVxuXG4gICAgbGV0IGZpbmFsTW92ZVN1YnBhZ2VzID0gZmFsc2U7XG4gICAgLy8gVE9ETyBmdXR1cmU6IGN1cnJUU3BGbGFncy5hbGxvd01vdmVTdWJwYWdlcyAmJiBkZXN0VFNwRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgbmVlZHMgdG8gYmUgc2VwYXJhdGUgY2hlY2suIElmIHRhbGsgc3VicGFnZXMgaW1tb3ZhYmxlLCBzaG91bGQgbm90IGFmZmVjdCBzdWJqc3BhY2VcbiAgICBpZiAoIXN1YnBhZ2VDb2xsaXNpb24gJiYgIW5vU3VicGFnZXMgJiYgdmFsaWRhdGlvbkRhdGEuYWxsb3dNb3ZlU3VicGFnZXMgJiYgY3VycmVudFN1YnBhZ2VGbGFncy5hbGxvd01vdmVTdWJwYWdlcyAmJiBkZXN0aW5hdGlvblN1YnBhZ2VGbGFncy5hbGxvd01vdmVTdWJwYWdlcyAmJiBjdXJyZW50VGFsa1N1YnBhZ2VGbGFncy5hbGxvd01vdmVTdWJwYWdlcyAmJiBkZXN0aW5hdGlvblRhbGtTdWJwYWdlRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMpIGZpbmFsTW92ZVN1YnBhZ2VzID0gbW92ZVN1YnBhZ2VzO1xuICAgIGVsc2UgaWYgKHN1YnBhZ2VDb2xsaXNpb24pIHtcbiAgICAgICAgZmluYWxNb3ZlU3VicGFnZXMgPSBmYWxzZTtcbiAgICAgICAgbXcubm90aWZ5KCdPbmUgbmFtZXNwYWNlIGRvZXMgbm90IGhhdmUgc3VicGFnZXMgZW5hYmxlZC4gRGlzYWxsb3dpbmcgbW92ZSBzdWJwYWdlcy4nKTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhgW1BhZ2Vzd2FwXSBTd2FwcGluZyBcIiR7Y3VycmVudFRpdGxlfVwiIHdpdGggXCIke2Rlc3RpbmF0aW9uVGl0bGV9XCIgd2l0aCBzdW1tYXJ5IFwiJHtzdW1tYXJ5fVwiIGFuZCBtb3ZlVGFsayAke21vdmVUYWxrfSBhbmQgbW92ZVN1YnBhZ2VzICR7ZmluYWxNb3ZlU3VicGFnZXN9YCk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzd2FwUGFnZXMoY3VycmVudFRpdGxlLCBkZXN0aW5hdGlvblRpdGxlLCBzdW1tYXJ5LCBtb3ZlVGFsaywgZmluYWxNb3ZlU3VicGFnZXMpO1xuXG4gICAgY29uc29sZS5sb2cocmVzdWx0KTtcblxuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRocm93IG5ldyBFcnJvcihyZXN1bHQuZXJyb3IpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLEdBQUcsT0FBTyxNQUFNLENBQUMsa0JBQWtCLGdCQUFnQixtQkFBbUIsbUJBQW1CLG1CQUFtQixDQUFDLEVBQUUsS0FBSyxZQUFZO0FBQzVILFFBQU0sWUFBWSxHQUFHLE9BQU8sSUFBSSxtQkFBbUI7QUFDbkQsTUFBSSxZQUFZLEtBQUssYUFBYSxPQUFRLGFBQWEsS0FBSyxhQUFhLEtBQU8sYUFBYSxNQUFNLGFBQWE7QUFBSztBQUVySCxRQUFNLGVBQWUsR0FBRyxPQUFPLElBQUksWUFBWTtBQUUvQyxRQUFNLGtCQUFrQixNQUFNLHFCQUFxQjtBQUVuRCxRQUFNLFdBQVcsTUFBTSxJQUFJLEdBQUcsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLFNBQVMsTUFBTSxRQUFRLFFBQVEsYUFBYSxDQUFDO0FBQy9GLE1BQUksU0FBUyxNQUFNLE1BQU0sRUFBRTtBQUFHO0FBRTlCLFFBQU0sT0FBTyxHQUFHLEtBQUssZUFBZSxHQUFHLE9BQU8sSUFBSSxNQUFNLE1BQU0sWUFBWSxTQUFTLGNBQWMsS0FBSyxRQUFRLGdCQUFnQjtBQUU5SCxPQUFLLGlCQUFpQixTQUFTLENBQUMsVUFBVTtBQUN0QyxVQUFNLGVBQWU7QUFFckIsUUFBSSxDQUFDLGdCQUFnQjtBQUFTLGFBQU8sR0FBRyxPQUFPLHlEQUF5RCxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBRXpILGFBQVMsYUFBYTtBQUNsQixpQkFBVyxNQUFNLE1BQU0sTUFBTSxTQUFTO0FBQUEsSUFDMUM7QUFDQSxPQUFHLGFBQWEsWUFBWSxHQUFHLEdBQUcsYUFBYTtBQUUvQyxlQUFXLE9BQU8sT0FBTztBQUN6QixlQUFX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
