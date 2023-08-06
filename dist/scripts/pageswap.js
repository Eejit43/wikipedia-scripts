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
    mw.notify(
      subpagesCannotMove.length > 0 ? `Disabling move-subpages.
The following ${subpagesCannotMove.length} (of ${currentSubpages.length}) total subpages of ${basePage} CANNOT be moved:

${subpagesCannotMove.join(
        ", "
      )}` : `${currentSubpages.length} total subpages of ${basePage}.${redirectCount !== 0 ? ` ${redirectCount} redirects, labeled (R)` : ""}: ${currentSubpages.join(", ")}`
    );
  result.allowMoveSubpages = subpagesCannotMove.length === 0;
  result.noNeed = currentSubpages.length === 0;
  return result;
}
function swapPages(titleOne, titleTwo, summary, moveTalk, moveSubpages) {
  const intermediateTitle = `Draft:Move/${titleOne}`;
  const moves = [
    {
      action: "move",
      from: titleTwo,
      to: intermediateTitle,
      reason: "[[WP:ROUNDROBIN|Round-robin page move]] step 1 (with [[User:Eejit43/scripts/pageswap|pageswap 2]])",
      watchlist: "unwatch",
      noredirect: 1
    },
    { action: "move", from: titleOne, to: titleTwo, reason: summary, watchlist: "unwatch", noredirect: 1 },
    {
      action: "move",
      from: intermediateTitle,
      to: titleOne,
      reason: "[[WP:ROUNDROBIN|Round-robin page move]] step 3 (with [[User:Eejit43/scripts/pageswap|pageswap 2]])",
      watchlist: "unwatch",
      noredirect: 1
    }
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
    mw.notify(
      `Disallowing moving talk. ${!talkValidationData.currentTalkCanCreate ? `${validationData.currentTalkName} is create-protected` : !talkValidationData.destinationTalkCanCreate ? `${validationData.destinationTalkName} is create-protected` : "Talk page is immovable"}`
    );
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9wYWdlc3dhcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsibXcubG9hZGVyLnVzaW5nKFsnbWVkaWF3aWtpLnV0aWwnLCAnb29qcy11aS1jb3JlJywgJ29vanMtdWktd2lkZ2V0cycsICdvb2pzLXVpLXdpbmRvd3MnLCAnbWVkaWF3aWtpLndpZGdldHMnXSkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgbmFtZXNwYWNlID0gbXcuY29uZmlnLmdldCgnd2dOYW1lc3BhY2VOdW1iZXInKTtcbiAgICBpZiAobmFtZXNwYWNlIDwgMCB8fCBuYW1lc3BhY2UgPj0gMTIwIHx8IChuYW1lc3BhY2UgPj0gNiAmJiBuYW1lc3BhY2UgPD0gOSkgfHwgKG5hbWVzcGFjZSA+PSAxNCAmJiBuYW1lc3BhY2UgPD0gOTkpKSByZXR1cm47XG5cbiAgICBjb25zdCBjdXJyZW50VGl0bGUgPSBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyk7XG5cbiAgICBjb25zdCB1c2VyUGVybWlzc2lvbnMgPSBhd2FpdCBmZXRjaFVzZXJQZXJtaXNzaW9ucygpO1xuXG4gICAgY29uc3QgcGFnZUluZm8gPSBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHsgYWN0aW9uOiAncXVlcnknLCBwcm9wOiAnaW5mbycsIHRpdGxlczogY3VycmVudFRpdGxlIH0pO1xuICAgIGlmIChwYWdlSW5mby5xdWVyeS5wYWdlc1stMV0pIHJldHVybjtcblxuICAgIGNvbnN0IGxpbmsgPSBtdy51dGlsLmFkZFBvcnRsZXRMaW5rKG13LmNvbmZpZy5nZXQoJ3NraW4nKSA9PT0gJ21pbmVydmEnID8gJ3AtdGInIDogJ3AtY2FjdGlvbnMnLCAnIycsICdTd2FwJywgJ2Vlaml0LXBhZ2Vzd2FwJyk7XG5cbiAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgaWYgKCF1c2VyUGVybWlzc2lvbnMuY2FuU3dhcCkgcmV0dXJuIG13Lm5vdGlmeSgnWW91IGRvIG5vdCBoYXZlIHN1ZmZpY2llbnQgcGVybWlzc2lvbnMgdG8gc3dhcCBwYWdlcy4nLCB7IHR5cGU6ICdlcnJvcicgfSk7XG5cbiAgICAgICAgZnVuY3Rpb24gU3dhcERpYWxvZygpIHtcbiAgICAgICAgICAgIFN3YXBEaWFsb2cuc3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgICAgICBPTy5pbmhlcml0Q2xhc3MoU3dhcERpYWxvZywgT08udWkuUHJvY2Vzc0RpYWxvZyk7XG5cbiAgICAgICAgU3dhcERpYWxvZy5zdGF0aWMubmFtZSA9ICdzd2FwJztcbiAgICAgICAgU3dhcERpYWxvZy5zdGF0aWMudGl0bGUgPSAkKCc8c3Bhbj4nKS5hcHBlbmQoXG4gICAgICAgICAgICAkKCc8YT4nKVxuICAgICAgICAgICAgICAgIC5hdHRyKHsgaHJlZjogbXcudXRpbC5nZXRVcmwoJ1dQOlJPVU5EUk9CSU4nKSwgdGFyZ2V0OiAnX2JsYW5rJyB9KVxuICAgICAgICAgICAgICAgIC50ZXh0KCdTd2FwJyksXG4gICAgICAgICAgICAnIHR3byBwYWdlcycsXG4gICAgICAgICk7XG4gICAgICAgIFN3YXBEaWFsb2cuc3RhdGljLmFjdGlvbnMgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiAnc3dhcCcsXG4gICAgICAgICAgICAgICAgbGFiZWw6ICdTd2FwJyxcbiAgICAgICAgICAgICAgICBmbGFnczogWydwcmltYXJ5JywgJ3Byb2dyZXNzaXZlJ10sXG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGFjdGlvbjogJ2NhbmNlbCcsXG4gICAgICAgICAgICAgICAgbGFiZWw6ICdDYW5jZWwnLFxuICAgICAgICAgICAgICAgIGZsYWdzOiBbJ3NhZmUnLCAnY2xvc2UnXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF07XG5cbiAgICAgICAgU3dhcERpYWxvZy5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIFN3YXBEaWFsb2cuc3VwZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5wYW5lbCA9IG5ldyBPTy51aS5QYW5lbExheW91dCh7XG4gICAgICAgICAgICAgICAgcGFkZGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV4cGFuZGVkOiBmYWxzZSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQgPSBuZXcgT08udWkuRmllbGRzZXRMYXlvdXQoKTtcblxuICAgICAgICAgICAgdGhpcy5kZXN0aW5hdGlvbklucHV0ID0gbmV3IG13LndpZGdldHMuVGl0bGVJbnB1dFdpZGdldCh7XG4gICAgICAgICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgJG92ZXJsYXk6IHRoaXMuJG92ZXJsYXksXG4gICAgICAgICAgICAgICAgZXhjbHVkZUN1cnJlbnRQYWdlOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNob3dEZXNjcmlwdGlvbnM6IHRydWUsXG4gICAgICAgICAgICAgICAgc2hvd1JlZGlyZWN0VGFyZ2V0czogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXhjbHVkZUR5bmFtaWNOYW1lc3BhY2VzOiB0cnVlLCAvLyBcIlNwZWNpYWxcIiBhbmQgXCJNZWRpYVwiXG4gICAgICAgICAgICAgICAgc2hvd01pc3Npbmc6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHZhbGlkYXRlOiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSAnJyB8fCB2YWx1ZSA9PT0gbXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25JbnB1dC5vbignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCB2YWx1ZSA9IHRoaXMuZGVzdGluYXRpb25JbnB1dC5nZXRWYWx1ZSgpLnJlcGxhY2VBbGwoJ18nLCAnICcpLnJlcGxhY2UoL15cXHMrLywgJycpO1xuICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZShuZXcgUmVnRXhwKGBeKGh0dHBzPzopPy97Mn0/JHttdy5jb25maWcuZ2V0KCd3Z1NlcnZlcicpLnJlcGxhY2UoL15cXC97Mn0vLCAnJyl9L3dpa2kvYCksICcnKTtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnNwbGl0KCcjJylbMF07XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHZhbHVlLnNsaWNlKDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25JbnB1dC5zZXRWYWx1ZSh2YWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25JbnB1dC5jb25uZWN0KHRoaXMsIHsgY2hhbmdlOiAndXBkYXRlQWN0aW9uU3RhdGUnIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3RpbmF0aW9uSW5wdXRGaWVsZCA9IG5ldyBPTy51aS5GaWVsZExheW91dCh0aGlzLmRlc3RpbmF0aW9uSW5wdXQsIHsgbGFiZWw6ICdEZXN0aW5hdGlvbiBwYWdlJywgYWxpZ246ICd0b3AnIH0pO1xuXG4gICAgICAgICAgICB0aGlzLnN1bW1hcnlJbnB1dCA9IG5ldyBPTy51aS5Db21ib0JveElucHV0V2lkZ2V0KHtcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAkb3ZlcmxheTogdGhpcy4kb3ZlcmxheSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgZGF0YTogJ1BlcmZvcm1pbmcgW1tXUDpSTS9UUnxyZXF1ZXN0ZWQgdGVjaG5pY2FsIG1vdmVdXScgfSwgLy9cbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnUmVzdWx0IG9mIFtbV1A6Uk18cmVxdWVzdGVkIG1vdmVdXScgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnTW92ZSB0byBbW1dQOkNPTU1PTk5BTUV8Y29tbW9uIG5hbWVdXScgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnRml4aW5nIHR5cG8nIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgZGF0YTogJ0ZpeGluZyBjYXBpdGFsaXphdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnRml4aW5nIHBlciBbW1dQOk5DfG5hbWluZyBjb252ZW50aW9uc11dJyB9LFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5zdW1tYXJ5SW5wdXQuY29ubmVjdCh0aGlzLCB7IGNoYW5nZTogJ3VwZGF0ZUFjdGlvblN0YXRlJyB9KTtcblxuICAgICAgICAgICAgdGhpcy5zdW1tYXJ5SW5wdXRGaWVsZCA9IG5ldyBPTy51aS5GaWVsZExheW91dCh0aGlzLnN1bW1hcnlJbnB1dCwgeyBsYWJlbDogJ1N1bW1hcnknLCBhbGlnbjogJ3RvcCcgfSk7XG5cbiAgICAgICAgICAgIHRoaXMubW92ZVRhbGtDaGVja2JveCA9IG5ldyBPTy51aS5DaGVja2JveElucHV0V2lkZ2V0KHsgc2VsZWN0ZWQ6IHRydWUgfSk7XG4gICAgICAgICAgICB0aGlzLm1vdmVUYWxrQ2hlY2tib3hGaWVsZCA9IG5ldyBPTy51aS5GaWVsZExheW91dCh0aGlzLm1vdmVUYWxrQ2hlY2tib3gsIHsgbGFiZWw6ICdNb3ZlIHRhbGsgcGFnZSAoaWYgYXBwbGljYWJsZSknLCBhbGlnbjogJ2lubGluZScgfSk7XG5cbiAgICAgICAgICAgIHRoaXMubW92ZVN1YnBhZ2VzQ2hlY2tib3ggPSBuZXcgT08udWkuQ2hlY2tib3hJbnB1dFdpZGdldCh7IHNlbGVjdGVkOiB0cnVlIH0pO1xuICAgICAgICAgICAgdGhpcy5tb3ZlU3VicGFnZXNDaGVja2JveEZpZWxkID0gbmV3IE9PLnVpLkZpZWxkTGF5b3V0KHRoaXMubW92ZVN1YnBhZ2VzQ2hlY2tib3gsIHsgbGFiZWw6ICdNb3ZlIHN1YnBhZ2VzIChpZiBhcHBsaWNhYmxlKScsIGFsaWduOiAnaW5saW5lJyB9KTtcblxuICAgICAgICAgICAgdGhpcy5jb250ZW50LmFkZEl0ZW1zKFt0aGlzLmRlc3RpbmF0aW9uSW5wdXRGaWVsZCwgdGhpcy5zdW1tYXJ5SW5wdXRGaWVsZCwgdGhpcy5tb3ZlVGFsa0NoZWNrYm94RmllbGQsIHRoaXMubW92ZVN1YnBhZ2VzQ2hlY2tib3hGaWVsZF0pO1xuXG4gICAgICAgICAgICB0aGlzLnBhbmVsLiRlbGVtZW50LmFwcGVuZCh0aGlzLmNvbnRlbnQuJGVsZW1lbnQpO1xuICAgICAgICAgICAgdGhpcy4kYm9keS5hcHBlbmQodGhpcy5wYW5lbC4kZWxlbWVudCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgU3dhcERpYWxvZy5wcm90b3R5cGUudXBkYXRlQWN0aW9uU3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjb25zdCBpc1ZhbGlkID0gdGhpcy5kZXN0aW5hdGlvbklucHV0LmdldFZhbHVlKCkgIT09ICcnICYmIHRoaXMuZGVzdGluYXRpb25JbnB1dC5nZXRWYWxpZGl0eSgpICYmIHRoaXMuc3VtbWFyeUlucHV0LmdldFZhbHVlKCkgIT09ICcnO1xuICAgICAgICAgICAgdGhpcy5hY3Rpb25zLnNldEFiaWxpdGllcyh7IHN3YXA6IGlzVmFsaWQgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgU3dhcERpYWxvZy5wcm90b3R5cGUuZ2V0QWN0aW9uUHJvY2VzcyA9IGZ1bmN0aW9uIChhY3Rpb246IHN0cmluZykge1xuICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ3N3YXAnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVzdGluYXRpb24gPSB0aGlzLmRlc3RpbmF0aW9uSW5wdXQuZ2V0VmFsdWUoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3VtbWFyeSA9IHRoaXMuc3VtbWFyeUlucHV0LmdldFZhbHVlKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgbW92ZVRhbGsgPSB0aGlzLm1vdmVUYWxrQ2hlY2tib3guaXNTZWxlY3RlZCgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vdmVTdWJwYWdlcyA9IHRoaXMubW92ZVN1YnBhZ2VzQ2hlY2tib3guaXNTZWxlY3RlZCgpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBPTy51aS5Qcm9jZXNzKClcbiAgICAgICAgICAgICAgICAgICAgLm5leHQoKCkgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJvdW5kUm9iaW4odXNlclBlcm1pc3Npb25zLCBjdXJyZW50VGl0bGUsIGRlc3RpbmF0aW9uLCBzdW1tYXJ5LCBtb3ZlVGFsaywgbW92ZVN1YnBhZ2VzKS5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJC5EZWZlcnJlZCgpLnJlamVjdCh0aGlzLnNob3dFcnJvcnMoW25ldyBPTy51aS5FcnJvcihlcnJvcj8ubWVzc2FnZSB8fCAnQW4gdW5rbm93biBlcnJvciBvY2N1cnJlZC4nKV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5uZXh0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG13Lm5vdGlmeSgnTW92ZXMgY29tcGxldGUhIFJlbG9hZGluZy4uLicsIHsgdHlwZTogJ3N1Y2Nlc3MnIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZSh7IGFjdGlvbiwgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpLCAxMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2NhbmNlbCcpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBPTy51aS5Qcm9jZXNzKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZSh7IGFjdGlvbiB9KTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIFN3YXBEaWFsb2cuc3VwZXIucHJvdG90eXBlLmdldEFjdGlvblByb2Nlc3MuY2FsbCh0aGlzLCBhY3Rpb24pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IG5ldyBTd2FwRGlhbG9nKCk7XG4gICAgICAgIGNvbnN0IHdpbmRvd01hbmFnZXIgPSBuZXcgT08udWkuV2luZG93TWFuYWdlcigpO1xuICAgICAgICAkKCdib2R5JykuYXBwZW5kKHdpbmRvd01hbmFnZXIuJGVsZW1lbnQpO1xuICAgICAgICB3aW5kb3dNYW5hZ2VyLmFkZFdpbmRvd3MoW2RpYWxvZ10pO1xuICAgICAgICB3aW5kb3dNYW5hZ2VyLm9wZW5XaW5kb3coZGlhbG9nKTtcbiAgICB9KTtcbn0pO1xuXG4vLyAhISBTb21lIGNvbnRlbnQgYmVsb3cgdGhpcyBjb250YWlucyBjb2RlIG1vZGlmaWVkIGZyb20gW1tVc2VyOkFuZHkgTS4gV2FuZy9wYWdlc3dhcC5qc11dICEhXG5cbi8qKlxuICogQ2hlY2tzIGlmIHVzZXIgaGFzIHRoZSByZXF1aXJlZCBwZXJtaXNzaW9ucyB0byBwZXJmb3JtIGEgc3dhcFxuICogQHJldHVybnMge1Byb21pc2U8e2NhblN3YXA6IGJvb2xlYW4sIGFsbG93U3dhcFRlbXBsYXRlczogYm9vbGVhbn0+fVxuICovXG5mdW5jdGlvbiBmZXRjaFVzZXJQZXJtaXNzaW9ucygpIHtcbiAgICByZXR1cm4gbmV3IG13LkFwaSgpXG4gICAgICAgIC5nZXQoe1xuICAgICAgICAgICAgYWN0aW9uOiAncXVlcnknLFxuICAgICAgICAgICAgbWV0YTogJ3VzZXJpbmZvJyxcbiAgICAgICAgICAgIHVpcHJvcDogJ3JpZ2h0cycsXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICBjb25zdCByaWdodHNMaXN0ID0gZGF0YS5xdWVyeS51c2VyaW5mby5yaWdodHM7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGNhblN3YXA6IHJpZ2h0c0xpc3QuaW5jbHVkZXMoJ3N1cHByZXNzcmVkaXJlY3QnKSAmJiByaWdodHNMaXN0LmluY2x1ZGVzKCdtb3ZlLXN1YnBhZ2VzJyksIC8vIFBhZ2UgbW92ZXIgcmlnaHQgb24gdGhlIEVuZ2xpc2ggV2lraXBlZGlhXG4gICAgICAgICAgICAgICAgYWxsb3dTd2FwVGVtcGxhdGVzOiByaWdodHNMaXN0LmluY2x1ZGVzKCd0ZW1wbGF0ZWVkaXRvcicpLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG59XG5cbi8qKlxuICogR2l2ZW4gbmFtZXNwYWNlIGRhdGEsIHRpdGxlLCB0aXRsZSBuYW1lc3BhY2UsIHJldHVybnMgZXhwZWN0ZWQgdGl0bGUgb2YgcGFnZVxuICogQWxvbmcgd2l0aCB0aXRsZSB3aXRob3V0IHByZWZpeFxuICogUHJlY29uZGl0aW9uLCB0aXRsZSwgdGl0bGVOcyBpcyBhIHN1YmplY3QgcGFnZSFcbiAqL1xuZnVuY3Rpb24gZ2V0VGFsa1BhZ2VOYW1lKG5hbWVzcGFjZURhdGEsIHRpdGxlLCB0aXRsZU5hbWVzcGFjZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIGNvbnN0IHByZWZpeExlbmd0aCA9IG5hbWVzcGFjZURhdGFbdGl0bGVOYW1lc3BhY2UudG9TdHJpbmcoKV1bJyonXS5sZW5ndGggPT09IDAgPyAwIDogbmFtZXNwYWNlRGF0YVt0aXRsZU5hbWVzcGFjZS50b1N0cmluZygpXVsnKiddLmxlbmd0aCArIDE7XG4gICAgcmVzdWx0LnRpdGxlV2l0aG91dFByZWZpeCA9IHRpdGxlLnN1YnN0cmluZyhwcmVmaXhMZW5ndGgsIHRpdGxlLmxlbmd0aCk7XG4gICAgcmVzdWx0LnRhbGtUaXRsZSA9IGAke25hbWVzcGFjZURhdGFbKHRpdGxlTmFtZXNwYWNlICsgMSkudG9TdHJpbmcoKV1bJyonXX06JHtyZXN1bHQudGl0bGVXaXRob3V0UHJlZml4fWA7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBHaXZlbiB0d28gKG5vcm1hbGl6ZWQpIHRpdGxlcywgZmluZCB0aGVpciBuYW1lc3BhY2VzLCBpZiB0aGV5IGFyZSByZWRpcmVjdHMsXG4gKiBpZiBoYXZlIGEgdGFsayBwYWdlLCB3aGV0aGVyIHRoZSBjdXJyZW50IHVzZXIgY2FuIG1vdmUgdGhlIHBhZ2VzLCBzdWdnZXN0c1xuICogd2hldGhlciBtb3Zlc3VicGFnZXMgc2hvdWxkIGJlIGFsbG93ZWQsIHdoZXRoZXIgdGFsayBwYWdlcyBuZWVkIHRvIGJlIGNoZWNrZWRcbiAqL1xuZnVuY3Rpb24gc3dhcFZhbGlkYXRlKHN0YXJ0VGl0bGUsIGVuZFRpdGxlLCBwYWdlc0RhdGEsIG5hbWVzcGFjZXNEYXRhLCB1c2VyUGVybWlzc2lvbnMpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7IHZhbGlkOiB0cnVlLCBhbGxvd01vdmVTdWJwYWdlczogdHJ1ZSwgY2hlY2tUYWxrOiB0cnVlIH07XG5cbiAgICBsZXQgY291bnQgPSAwO1xuICAgIGZvciAoY29uc3QgW3BhZ2VJZCwgcGFnZURhdGFdIG9mIE9iamVjdC5lbnRyaWVzKHBhZ2VzRGF0YSkpIHtcbiAgICAgICAgY291bnQrKztcbiAgICAgICAgaWYgKHBhZ2VJZCA9PT0gJy0xJyB8fCBwYWdlRGF0YS5ucyA8IDApIHtcbiAgICAgICAgICAgIHJlc3VsdC52YWxpZCA9IGZhbHNlO1xuICAgICAgICAgICAgcmVzdWx0LmVycm9yID0gYFBhZ2UgJHtwYWdlRGF0YS50aXRsZX0gZG9lcyBub3QgZXhpc3QuYDtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRW5hYmxlIG9ubHkgaW4gTWFpbiwgVGFsaywgVXNlciwgVXNlciB0YWxrLCBXaWtpcGVkaWEsIFdpa2lwZWRpYSB0YWxrLCBIZWxwLCBIZWxwIHRhbGssIERyYWZ0LCBhbmQgRHJhZnQgdGFsa1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAocGFnZURhdGEubnMgPj0gNiAmJiBwYWdlRGF0YS5ucyA8PSA5KSB8fFxuICAgICAgICAgICAgKHBhZ2VEYXRhLm5zID49IDEwICYmIHBhZ2VEYXRhLm5zIDw9IDExICYmICF1c2VyUGVybWlzc2lvbnMuYWxsb3dTd2FwVGVtcGxhdGVzKSB8fFxuICAgICAgICAgICAgKHBhZ2VEYXRhLm5zID49IDE0ICYmIHBhZ2VEYXRhLm5zIDw9IDExNykgfHxcbiAgICAgICAgICAgIHBhZ2VEYXRhLm5zID49IDEyMFxuICAgICAgICApIHtcbiAgICAgICAgICAgIHJlc3VsdC52YWxpZCA9IGZhbHNlO1xuICAgICAgICAgICAgcmVzdWx0LmVycm9yID0gYE5hbWVzcGFjZSBvZiAke3BhZ2VEYXRhLnRpdGxlfSAoJHtwYWdlRGF0YS5uc30pIG5vdCBzdXBwb3J0ZWQuXFxuXFxuTGlrZWx5IHJlYXNvbnM6XFxuLSBOYW1lcyBvZiBwYWdlcyBpbiB0aGlzIG5hbWVzcGFjZSByZWxpZXMgb24gb3RoZXIgcGFnZXNcXG4tIE5hbWVzcGFjZSBmZWF0dXJlcyBoZWF2aWx5LXRyYW5zY2x1ZGVkIHBhZ2VzXFxuLSBOYW1lc3BhY2UgaW52b2x2ZXMgc3VicGFnZXM6IHN3YXBzIHByb2R1Y2UgbWFueSByZWRsaW5rc1xcblxcblxcbklmIHRoZSBtb3ZlIGlzIGxlZ2l0aW1hdGUsIGNvbnNpZGVyIGEgY2FyZWZ1bCBtYW51YWwgc3dhcC5gO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhcnRUaXRsZSA9PT0gcGFnZURhdGEudGl0bGUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5jdXJyZW50VGl0bGUgPSBwYWdlRGF0YS50aXRsZTtcbiAgICAgICAgICAgIHJlc3VsdC5jdXJyZW50TmFtZXNwYWNlID0gcGFnZURhdGEubnM7XG4gICAgICAgICAgICByZXN1bHQuY3VycmVudFRhbGtJZCA9IHBhZ2VEYXRhLnRhbGtpZDtcbiAgICAgICAgICAgIHJlc3VsdC5jdXJyZW50Q2FuTW92ZSA9IHBhZ2VEYXRhLmFjdGlvbnMubW92ZSA9PT0gJyc7XG4gICAgICAgICAgICByZXN1bHQuY3VycmVudElzUmVkaXJlY3QgPSBwYWdlRGF0YS5yZWRpcmVjdCA9PT0gJyc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVuZFRpdGxlID09PSBwYWdlRGF0YS50aXRsZSkge1xuICAgICAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uVGl0bGUgPSBwYWdlRGF0YS50aXRsZTtcbiAgICAgICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvbk5hbWVzcGFjZSA9IHBhZ2VEYXRhLm5zO1xuICAgICAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uVGFsa0lkID0gcGFnZURhdGEudGFsa2lkO1xuICAgICAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uQ2FuTW92ZSA9IHBhZ2VEYXRhLmFjdGlvbnMubW92ZSA9PT0gJyc7XG4gICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25Jc1JlZGlyZWN0ID0gcGFnZURhdGEucmVkaXJlY3QgPT09ICcnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFyZXN1bHQudmFsaWQpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKCFyZXN1bHQuY3VycmVudENhbk1vdmUpIHtcbiAgICAgICAgcmVzdWx0LnZhbGlkID0gZmFsc2U7XG4gICAgICAgIHJlc3VsdC5lcnJvciA9IGAke3Jlc3VsdC5jdXJyZW50VGl0bGV9IGlzIGltbW92YWJsZWA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGlmICghcmVzdWx0LmRlc3RpbmF0aW9uQ2FuTW92ZSkge1xuICAgICAgICByZXN1bHQudmFsaWQgPSBmYWxzZTtcbiAgICAgICAgcmVzdWx0LmVycm9yID0gYCR7cmVzdWx0LmRlc3RpbmF0aW9uVGl0bGV9IGlzIGltbW92YWJsZWA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGlmIChyZXN1bHQuY3VycmVudE5hbWVzcGFjZSAlIDIgIT09IHJlc3VsdC5kZXN0aW5hdGlvbk5hbWVzcGFjZSAlIDIpIHtcbiAgICAgICAgcmVzdWx0LnZhbGlkID0gZmFsc2U7XG4gICAgICAgIHJlc3VsdC5lcnJvciA9IFwiTmFtZXNwYWNlcyBkb24ndCBtYXRjaDogb25lIGlzIGEgdGFsayBwYWdlLCB0aGUgb3RoZXIgaXMgbm90XCI7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGlmIChjb3VudCAhPT0gMikge1xuICAgICAgICByZXN1bHQudmFsaWQgPSBmYWxzZTtcbiAgICAgICAgcmVzdWx0LmVycm9yID0gJ0Rlc3RpbmF0aW9uIHRpdGxlIGlzIHRoZSBzYW1lIGFzIHRoZSBjdXJyZW50IHRpdGxlJztcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgcmVzdWx0LmN1cnJlbnROYW1lc3BhY2VBbGxvd1N1YnBhZ2VzID0gbmFtZXNwYWNlc0RhdGFbcmVzdWx0LmN1cnJlbnROYW1lc3BhY2UudG9TdHJpbmcoKV0uc3VicGFnZXMgIT09ICcnO1xuICAgIHJlc3VsdC5kZXN0aW5hdGlvbk5hbWVzcGFjZUFsbG93U3VicGFnZXMgPSBuYW1lc3BhY2VzRGF0YVtyZXN1bHQuZGVzdGluYXRpb25OYW1lc3BhY2UudG9TdHJpbmcoKV0uc3VicGFnZXMgIT09ICcnO1xuXG4gICAgLy8gSWYgc2FtZSBuYW1lc3BhY2UgKHN1YnBhZ2VzIGFsbG93ZWQpLCBpZiBvbmUgaXMgc3VicGFnZSBvZiBhbm90aGVyLCBkaXNhbGxvdyBtb3Zpbmcgc3VicGFnZXNcbiAgICBpZiAocmVzdWx0LmN1cnJlbnRUaXRsZS5zdGFydHNXaXRoKHJlc3VsdC5kZXN0aW5hdGlvblRpdGxlICsgJy8nKSB8fCByZXN1bHQuZGVzdGluYXRpb25UaXRsZS5zdGFydHNXaXRoKHJlc3VsdC5jdXJyZW50VGl0bGUgKyAnLycpKSB7XG4gICAgICAgIGlmIChyZXN1bHQuY3VycmVudE5hbWVzcGFjZSAhPT0gcmVzdWx0LmRlc3RpbmF0aW9uTmFtZXNwYWNlKSB7XG4gICAgICAgICAgICByZXN1bHQudmFsaWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHJlc3VsdC5lcnJvciA9IGAke3Jlc3VsdC5jdXJyZW50VGl0bGV9IGluIG5zICR7cmVzdWx0LmN1cnJlbnROYW1lc3BhY2V9XFxuJHtyZXN1bHQuZGVzdGluYXRpb25UaXRsZX0gaW4gbnMgJHtyZXN1bHQuZGVzdGluYXRpb25OYW1lc3BhY2V9LiBEaXNhbGxvd2luZy5gO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdC5hbGxvd01vdmVTdWJwYWdlcyA9IHJlc3VsdC5jdXJyZW50TmFtZXNwYWNlQWxsb3dTdWJwYWdlcztcbiAgICAgICAgaWYgKCFyZXN1bHQuYWxsb3dNb3ZlU3VicGFnZXMpIHJlc3VsdC5hZGRMaW5lSW5mbyA9ICdPbmUgcGFnZSBpcyBhIHN1YnBhZ2UuIERpc2FsbG93aW5nIG1vdmUtc3VicGFnZXMnO1xuICAgIH1cblxuICAgIGlmIChyZXN1bHQuY3VycmVudE5hbWVzcGFjZSAlIDIgPT09IDEpIHJlc3VsdC5jaGVja1RhbGsgPSBmYWxzZTsgLy8gTm8gbmVlZCB0byBjaGVjayB0YWxrcywgYWxyZWFkeSB0YWxrIHBhZ2VzXG4gICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRUYWxrRGF0YSA9IGdldFRhbGtQYWdlTmFtZShuYW1lc3BhY2VzRGF0YSwgcmVzdWx0LmN1cnJlbnRUaXRsZSwgcmVzdWx0LmN1cnJlbnROYW1lc3BhY2UpO1xuICAgICAgICByZXN1bHQuY3VycmVudFRpdGxlV2l0aG91dFByZWZpeCA9IGN1cnJlbnRUYWxrRGF0YS50aXRsZVdpdGhvdXRQcmVmaXg7XG4gICAgICAgIHJlc3VsdC5jdXJyZW50VGFsa05hbWUgPSBjdXJyZW50VGFsa0RhdGEudGFsa1RpdGxlO1xuICAgICAgICBjb25zdCBkZXN0aW5hdGlvbkRhdGEgPSBnZXRUYWxrUGFnZU5hbWUobmFtZXNwYWNlc0RhdGEsIHJlc3VsdC5kZXN0aW5hdGlvblRpdGxlLCByZXN1bHQuZGVzdGluYXRpb25OYW1lc3BhY2UpO1xuICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UaXRsZVdpdGhvdXRQcmVmaXggPSBkZXN0aW5hdGlvbkRhdGEudGl0bGVXaXRob3V0UHJlZml4O1xuICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrTmFtZSA9IGRlc3RpbmF0aW9uRGF0YS50YWxrVGl0bGU7XG4gICAgICAgIC8vIFRPRE86IHBvc3NpYmxlIHRoYXQgcmV0LmN1cnJlbnRUYWxrSWQgaXMgdW5kZWZpbmVkLCBidXQgc3ViamVjdCBwYWdlIGhhcyB0YWxrIHN1YnBhZ2VzXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBHaXZlbiB0d28gdGFsayBwYWdlIHRpdGxlcyAobWF5IGJlIHVuZGVmaW5lZCksIHJldHJpZXZlcyB0aGVpciBwYWdlcyBmb3IgY29tcGFyaXNvblxuICogQXNzdW1lcyB0aGF0IHRhbGsgcGFnZXMgYWx3YXlzIGhhdmUgc3VicGFnZXMgZW5hYmxlZC5cbiAqIEFzc3VtZXMgdGhhdCBwYWdlcyBhcmUgbm90IGlkZW50aWNhbCAoc3ViamVjdCBwYWdlcyB3ZXJlIGFscmVhZHkgdmVyaWZpZWQpXG4gKiBBc3N1bWVzIG5hbWVzcGFjZXMgYXJlIG9rYXkgKHN1YmplY3QgcGFnZXMgYWxyZWFkeSBjaGVja2VkKVxuICogKEN1cnJlbnRseSkgYXNzdW1lcyB0aGF0IHRoZSBtYWxpY2lvdXMgY2FzZSBvZiBzdWJqZWN0IHBhZ2VzXG4gKiAgIG5vdCBkZXRlY3RlZCBhcyBzdWJwYWdlcyBhbmQgdGhlIHRhbGsgcGFnZXMgQVJFIHN1YnBhZ2VzXG4gKiAgIChpLmUuIEEgYW5kIEEvQiB2cy4gVGFsazpBIGFuZCBUYWxrOkEvQikgZG9lcyBub3QgaGFwcGVuIC8gZG9lcyBub3QgaGFuZGxlXG4gKiBSZXR1cm5zIHN0cnVjdHVyZSBpbmRpY2F0aW5nIHdoZXRoZXIgbW92ZSB0YWxrIHNob3VsZCBiZSBhbGxvd2VkXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHRhbGtWYWxpZGF0ZShjaGVja1RhbGssIGZpcnN0VGFsaywgc2Vjb25kVGFsaykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIHJlc3VsdC5hbGxvd01vdmVUYWxrID0gdHJ1ZTtcbiAgICBpZiAoIWNoZWNrVGFsaykgcmV0dXJuIHJlc3VsdDtcbiAgICBpZiAoZmlyc3RUYWxrID09PSB1bmRlZmluZWQgfHwgc2Vjb25kVGFsayA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG13Lm5vdGlmeSgnVW5hYmxlIHRvIHZhbGlkYXRlIHRhbGsuIERpc2FsbG93aW5nIG1vdmV0YWxrIHRvIGJlIHNhZmUnLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgIHJlc3VsdC5hbGxvd01vdmVUYWxrID0gZmFsc2U7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIHJlc3VsdC5jdXJyVERORSA9IHRydWU7XG4gICAgcmVzdWx0LmRlc3RURE5FID0gdHJ1ZTtcbiAgICByZXN1bHQuY3VycmVudFRhbGtDYW5DcmVhdGUgPSB0cnVlO1xuICAgIHJlc3VsdC5kZXN0aW5hdGlvblRhbGtDYW5DcmVhdGUgPSB0cnVlO1xuICAgIGNvbnN0IHRhbGtUaXRsZUFyciA9IFtmaXJzdFRhbGssIHNlY29uZFRhbGtdO1xuICAgIGlmICh0YWxrVGl0bGVBcnIubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCB0YWxrRGF0YSA9IChcbiAgICAgICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKS5nZXQoe1xuICAgICAgICAgICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgICAgICBwcm9wOiAnaW5mbycsXG4gICAgICAgICAgICAgICAgaW50ZXN0YWN0aW9uczogJ21vdmV8Y3JlYXRlJyxcbiAgICAgICAgICAgICAgICB0aXRsZXM6IHRhbGtUaXRsZUFyci5qb2luKCd8JyksXG4gICAgICAgICAgICB9KVxuICAgICAgICApLnF1ZXJ5LnBhZ2VzO1xuXG4gICAgICAgIGZvciAoY29uc3QgWywgcGFnZURhdGFdIG9mIE9iamVjdC5lbnRyaWVzKHRhbGtEYXRhKSlcbiAgICAgICAgICAgIGlmIChwYWdlRGF0YS50aXRsZSA9PT0gZmlyc3RUYWxrKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmN1cnJURE5FID0gcGFnZURhdGEuaW52YWxpZCA9PT0gJycgfHwgcGFnZURhdGEubWlzc2luZyA9PT0gJyc7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnRUYWxrVGl0bGUgPSBwYWdlRGF0YS50aXRsZTtcbiAgICAgICAgICAgICAgICByZXN1bHQuY3VycmVudFRhbGtDYW5Nb3ZlID0gcGFnZURhdGEuYWN0aW9ucy5tb3ZlID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuY3VycmVudFRhbGtDYW5DcmVhdGUgPSBwYWdlRGF0YS5hY3Rpb25zLmNyZWF0ZSA9PT0gJyc7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnRUYWxrSXNSZWRpcmVjdCA9IHBhZ2VEYXRhLnJlZGlyZWN0ID09PSAnJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGFnZURhdGEudGl0bGUgPT09IHNlY29uZFRhbGspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdFRETkUgPSBwYWdlRGF0YS5pbnZhbGlkID09PSAnJyB8fCBwYWdlRGF0YS5taXNzaW5nID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrVGl0bGUgPSBwYWdlRGF0YS50aXRsZTtcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrQ2FuTW92ZSA9IHBhZ2VEYXRhLmFjdGlvbnMubW92ZSA9PT0gJyc7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uVGFsa0NhbkNyZWF0ZSA9IHBhZ2VEYXRhLmFjdGlvbnMuY3JlYXRlID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrSXNSZWRpcmVjdCA9IHBhZ2VEYXRhLnJlZGlyZWN0ID09PSAnJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbXcubm90aWZ5KCdGb3VuZCBwYWdlaWQgbm90IG1hdGNoaW5nIGdpdmVuIGlkcy4nLCB7IHR5cGU6ICdlcnJvcicgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICAgICAgfVxuICAgIH1cblxuICAgIHJlc3VsdC5hbGxvd01vdmVUYWxrID0gcmVzdWx0LmN1cnJlbnRUYWxrQ2FuQ3JlYXRlICYmIHJlc3VsdC5jdXJyZW50VGFsa0Nhbk1vdmUgJiYgcmVzdWx0LmRlc3RpbmF0aW9uVGFsa0NhbkNyZWF0ZSAmJiByZXN1bHQuZGVzdGluYXRpb25UYWxrQ2FuTW92ZTtcbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEdpdmVuIGV4aXN0aW5nIHRpdGxlIChub3QgcHJlZml4ZWQgd2l0aCBcIi9cIiksIG9wdGlvbmFsbHkgc2VhcmNoaW5nIGZvciB0YWxrLFxuICogICBmaW5kcyBzdWJwYWdlcyAoaW5jbC4gdGhvc2UgdGhhdCBhcmUgcmVkaXJzKSBhbmQgd2hldGhlciBsaW1pdHMgYXJlIGV4Y2VlZGVkXG4gKiBBcyBvZiAyMDE2LTA4LCB1c2VzIDIgYXBpIGdldCBjYWxscyB0byBnZXQgbmVlZGVkIGRldGFpbHM6XG4gKiAgIHdoZXRoZXIgdGhlIHBhZ2UgY2FuIGJlIG1vdmVkLCB3aGV0aGVyIHRoZSBwYWdlIGlzIGEgcmVkaXJlY3RcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0U3VicGFnZXMobmFtZXNwYWNlRGF0YSwgdGl0bGUsIHRpdGxlTmFtZXNwYWNlLCBpc1RhbGspIHtcbiAgICBpZiAoIWlzVGFsayAmJiBuYW1lc3BhY2VEYXRhW3RpdGxlTmFtZXNwYWNlLnRvU3RyaW5nKCldLnN1YnBhZ2VzICE9PSAnJykgcmV0dXJuIHsgZGF0YTogW10gfTtcblxuICAgIGNvbnN0IHRpdGxlUGFnZURhdGEgPSBnZXRUYWxrUGFnZU5hbWUobmFtZXNwYWNlRGF0YSwgdGl0bGUsIHRpdGxlTmFtZXNwYWNlKTtcbiAgICBjb25zdCBzdWJwYWdlcyA9IChcbiAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7XG4gICAgICAgICAgICBhY3Rpb246ICdxdWVyeScsXG4gICAgICAgICAgICBsaXN0OiAnYWxscGFnZXMnLFxuICAgICAgICAgICAgYXBuYW1lc3BhY2U6IGlzVGFsayA/IHRpdGxlTmFtZXNwYWNlICsgMSA6IHRpdGxlTmFtZXNwYWNlLFxuICAgICAgICAgICAgYXBmcm9tOiB0aXRsZVBhZ2VEYXRhLnRpdGxlV2l0aG91dFByZWZpeCArICcvJyxcbiAgICAgICAgICAgIGFwdG86IHRpdGxlUGFnZURhdGEudGl0bGVXaXRob3V0UHJlZml4ICsgJzAnLFxuICAgICAgICAgICAgYXBsaW1pdDogMTAxLFxuICAgICAgICB9KVxuICAgICkucXVlcnkuYWxscGFnZXM7XG5cbiAgICAvLyBUd28gcXVlcmllcyBhcmUgbmVlZGVkIGR1ZSB0byBBUEkgbGltaXRzXG4gICAgY29uc3Qgc3VicGFnZUlkcyA9IFtbXSwgW11dO1xuICAgIGZvciAoY29uc3QgaWQgaW4gc3VicGFnZXMpIHN1YnBhZ2VJZHNbaWQgPCA1MCA/IDAgOiAxXS5wdXNoKHN1YnBhZ2VzW2lkXS5wYWdlaWQpO1xuXG4gICAgaWYgKHN1YnBhZ2VJZHNbMF0ubGVuZ3RoID09PSAwKSByZXR1cm4geyBkYXRhOiBbXSB9O1xuXG4gICAgaWYgKHN1YnBhZ2VJZHNbMV0ubGVuZ3RoID09PSA1MSkgcmV0dXJuIHsgZXJyb3I6ICcxMDArIHN1YnBhZ2VzLCB0b28gbWFueSB0byBtb3ZlLicgfTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IHN1YnBhZ2VEYXRhT25lID0gKFxuICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHtcbiAgICAgICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgIHByb3A6ICdpbmZvJyxcbiAgICAgICAgICAgIGludGVzdGFjdGlvbnM6ICdtb3ZlfGNyZWF0ZScsXG4gICAgICAgICAgICBwYWdlaWRzOiBzdWJwYWdlSWRzWzBdLmpvaW4oJ3wnKSxcbiAgICAgICAgfSlcbiAgICApLnF1ZXJ5LnBhZ2VzO1xuICAgIGZvciAoY29uc3QgWywgcGFnZURhdGFdIG9mIE9iamVjdC5lbnRyaWVzKHN1YnBhZ2VEYXRhT25lKSlcbiAgICAgICAgcmVzdWx0LnB1c2goe1xuICAgICAgICAgICAgdGl0bGU6IHBhZ2VEYXRhLnRpdGxlLFxuICAgICAgICAgICAgaXNSZWRpcjogcGFnZURhdGEucmVkaXJlY3QgPT09ICcnLFxuICAgICAgICAgICAgY2FuTW92ZTogcGFnZURhdGEuYWN0aW9ucz8ubW92ZSA9PT0gJycsXG4gICAgICAgIH0pO1xuXG4gICAgaWYgKHN1YnBhZ2VJZHNbMV0ubGVuZ3RoID09PSAwKSByZXR1cm4geyBkYXRhOiByZXN1bHQgfTtcblxuICAgIGNvbnN0IHN1YnBhZ2VEYXRhVHdvID0gKFxuICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHtcbiAgICAgICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgIHByb3A6ICdpbmZvJyxcbiAgICAgICAgICAgIGludGVzdGFjdGlvbnM6ICdtb3ZlfGNyZWF0ZScsXG4gICAgICAgICAgICBwYWdlaWRzOiBzdWJwYWdlSWRzWzFdLmpvaW4oJ3wnKSxcbiAgICAgICAgfSlcbiAgICApLnF1ZXJ5LnBhZ2VzO1xuICAgIGZvciAoY29uc3QgWywgcGFnZURhdGFdIG9mIE9iamVjdC5lbnRyaWVzKHN1YnBhZ2VEYXRhVHdvKSlcbiAgICAgICAgcmVzdWx0LnB1c2goe1xuICAgICAgICAgICAgdGl0bGU6IHBhZ2VEYXRhLnRpdGxlLFxuICAgICAgICAgICAgaXNSZWRpcmVjdDogcGFnZURhdGEucmVkaXJlY3QgPT09ICcnLFxuICAgICAgICAgICAgY2FuTW92ZTogcGFnZURhdGEuYWN0aW9ucz8ubW92ZSA9PT0gJycsXG4gICAgICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgZGF0YTogcmVzdWx0IH07XG59XG5cbi8qKlxuICogUHJpbnRzIHN1YnBhZ2UgZGF0YSBnaXZlbiByZXRyaWV2ZWQgc3VicGFnZSBpbmZvcm1hdGlvbiByZXR1cm5lZCBieSBnZXRTdWJwYWdlc1xuICogUmV0dXJucyBhIHN1Z2dlc3Rpb24gd2hldGhlciBtb3Zlc3VicGFnZXMgc2hvdWxkIGJlIGFsbG93ZWRcbiAqL1xuZnVuY3Rpb24gcHJpbnRTdWJwYWdlSW5mbyhiYXNlUGFnZSwgY3VycmVudFN1YnBhZ2UpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBjb25zdCBjdXJyZW50U3VicGFnZXMgPSBbXTtcbiAgICBjb25zdCBzdWJwYWdlc0Nhbm5vdE1vdmUgPSBbXTtcbiAgICBsZXQgcmVkaXJlY3RDb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBbLCBwYWdlRGF0YV0gb2YgT2JqZWN0LmVudHJpZXMoY3VycmVudFN1YnBhZ2UuZGF0YSkpIHtcbiAgICAgICAgaWYgKCFwYWdlRGF0YS5jYW5Nb3ZlKSBzdWJwYWdlc0Nhbm5vdE1vdmUucHVzaChwYWdlRGF0YS50aXRsZSk7XG5cbiAgICAgICAgY3VycmVudFN1YnBhZ2VzLnB1c2goKHBhZ2VEYXRhLmlzUmVkaXJlY3QgPyAnKFIpICcgOiAnICAnKSArIHBhZ2VEYXRhLnRpdGxlKTtcbiAgICAgICAgaWYgKHBhZ2VEYXRhLmlzUmVkaXJlY3QpIHJlZGlyZWN0Q291bnQrKztcbiAgICB9XG5cbiAgICBpZiAoY3VycmVudFN1YnBhZ2VzLmxlbmd0aCA+IDApXG4gICAgICAgIG13Lm5vdGlmeShcbiAgICAgICAgICAgIHN1YnBhZ2VzQ2Fubm90TW92ZS5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgPyBgRGlzYWJsaW5nIG1vdmUtc3VicGFnZXMuXFxuVGhlIGZvbGxvd2luZyAke3N1YnBhZ2VzQ2Fubm90TW92ZS5sZW5ndGh9IChvZiAke2N1cnJlbnRTdWJwYWdlcy5sZW5ndGh9KSB0b3RhbCBzdWJwYWdlcyBvZiAke2Jhc2VQYWdlfSBDQU5OT1QgYmUgbW92ZWQ6XFxuXFxuJHtzdWJwYWdlc0Nhbm5vdE1vdmUuam9pbihcbiAgICAgICAgICAgICAgICAgICAgICAnLCAnLFxuICAgICAgICAgICAgICAgICAgKX1gXG4gICAgICAgICAgICAgICAgOiBgJHtjdXJyZW50U3VicGFnZXMubGVuZ3RofSB0b3RhbCBzdWJwYWdlcyBvZiAke2Jhc2VQYWdlfS4ke3JlZGlyZWN0Q291bnQgIT09IDAgPyBgICR7cmVkaXJlY3RDb3VudH0gcmVkaXJlY3RzLCBsYWJlbGVkIChSKWAgOiAnJ306ICR7Y3VycmVudFN1YnBhZ2VzLmpvaW4oJywgJyl9YCxcbiAgICAgICAgKTtcblxuICAgIHJlc3VsdC5hbGxvd01vdmVTdWJwYWdlcyA9IHN1YnBhZ2VzQ2Fubm90TW92ZS5sZW5ndGggPT09IDA7XG4gICAgcmVzdWx0Lm5vTmVlZCA9IGN1cnJlbnRTdWJwYWdlcy5sZW5ndGggPT09IDA7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBTd2FwcyB0aGUgdHdvIHBhZ2VzIChnaXZlbiBhbGwgcHJlcmVxdWlzaXRlIGNoZWNrcylcbiAqIE9wdGlvbmFsbHkgbW92ZXMgdGFsayBwYWdlcyBhbmQgc3VicGFnZXNcbiAqL1xuZnVuY3Rpb24gc3dhcFBhZ2VzKHRpdGxlT25lLCB0aXRsZVR3bywgc3VtbWFyeSwgbW92ZVRhbGssIG1vdmVTdWJwYWdlcykge1xuICAgIGNvbnN0IGludGVybWVkaWF0ZVRpdGxlID0gYERyYWZ0Ok1vdmUvJHt0aXRsZU9uZX1gO1xuXG4gICAgY29uc3QgbW92ZXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGFjdGlvbjogJ21vdmUnLFxuICAgICAgICAgICAgZnJvbTogdGl0bGVUd28sXG4gICAgICAgICAgICB0bzogaW50ZXJtZWRpYXRlVGl0bGUsXG4gICAgICAgICAgICByZWFzb246ICdbW1dQOlJPVU5EUk9CSU58Um91bmQtcm9iaW4gcGFnZSBtb3ZlXV0gc3RlcCAxICh3aXRoIFtbVXNlcjpFZWppdDQzL3NjcmlwdHMvcGFnZXN3YXB8cGFnZXN3YXAgMl1dKScsXG4gICAgICAgICAgICB3YXRjaGxpc3Q6ICd1bndhdGNoJyxcbiAgICAgICAgICAgIG5vcmVkaXJlY3Q6IDEsXG4gICAgICAgIH0sXG4gICAgICAgIHsgYWN0aW9uOiAnbW92ZScsIGZyb206IHRpdGxlT25lLCB0bzogdGl0bGVUd28sIHJlYXNvbjogc3VtbWFyeSwgd2F0Y2hsaXN0OiAndW53YXRjaCcsIG5vcmVkaXJlY3Q6IDEgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgYWN0aW9uOiAnbW92ZScsXG4gICAgICAgICAgICBmcm9tOiBpbnRlcm1lZGlhdGVUaXRsZSxcbiAgICAgICAgICAgIHRvOiB0aXRsZU9uZSxcbiAgICAgICAgICAgIHJlYXNvbjogJ1tbV1A6Uk9VTkRST0JJTnxSb3VuZC1yb2JpbiBwYWdlIG1vdmVdXSBzdGVwIDMgKHdpdGggW1tVc2VyOkVlaml0NDMvc2NyaXB0cy9wYWdlc3dhcHxwYWdlc3dhcCAyXV0pJyxcbiAgICAgICAgICAgIHdhdGNobGlzdDogJ3Vud2F0Y2gnLFxuICAgICAgICAgICAgbm9yZWRpcmVjdDogMSxcbiAgICAgICAgfSxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBtb3ZlIG9mIG1vdmVzKSB7XG4gICAgICAgIGlmIChtb3ZlVGFsaykgbW92ZS5tb3ZldGFsayA9IDE7XG4gICAgICAgIGlmIChtb3ZlU3VicGFnZXMpIG1vdmUubW92ZXN1YnBhZ2VzID0gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgbGV0IGkgPSAwO1xuXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBqc2RvYy9yZXF1aXJlLWpzZG9jXG4gICAgICAgIGZ1bmN0aW9uIGRvTW92ZSgpIHtcbiAgICAgICAgICAgIGlmIChpID49IG1vdmVzLmxlbmd0aCkgcmV0dXJuIHJlc29sdmUocmVzdWx0KTtcblxuICAgICAgICAgICAgbmV3IG13LkFwaSgpXG4gICAgICAgICAgICAgICAgLnBvc3RXaXRoVG9rZW4oJ2NzcmYnLCBtb3Zlc1tpXSlcbiAgICAgICAgICAgICAgICAuZG9uZSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgICAgICAgICAgZG9Nb3ZlKCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuZmFpbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdWNjZXNzID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5tZXNzYWdlID0gYEZhaWxlZCBvbiBtb3ZlICR7aSArIDF9ICgke21vdmVzW2ldLmZyb219IFx1MjE5MiAke21vdmVzW2ldLnRvfSlgO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QocmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRvTW92ZSgpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSk7XG59XG5cbi8qKlxuICogR2l2ZW4gdHdvIHRpdGxlcywgbm9ybWFsaXplcywgZG9lcyBwcmVyZXF1aXNpdGUgY2hlY2tzIGZvciB0YWxrL3N1YnBhZ2VzLFxuICogcHJvbXB0cyB1c2VyIGZvciBjb25maWcgYmVmb3JlIHN3YXBwaW5nIHRoZSB0aXRsZXNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gcm91bmRSb2Jpbih1c2VyUGVybWlzc2lvbnMsIGN1cnJlbnRUaXRsZSwgZGVzdGluYXRpb25UaXRsZSwgc3VtbWFyeSwgbW92ZVRhbGssIG1vdmVTdWJwYWdlcykge1xuICAgIC8vIEdlbmVyYWwgaW5mb3JtYXRpb24gYWJvdXQgYWxsIG5hbWVzcGFjZXNcbiAgICBjb25zdCBuYW1lc3BhY2VzSW5mb3JtYXRpb24gPSAoXG4gICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKS5nZXQoe1xuICAgICAgICAgICAgYWN0aW9uOiAncXVlcnknLFxuICAgICAgICAgICAgbWV0YTogJ3NpdGVpbmZvJyxcbiAgICAgICAgICAgIHNpcHJvcDogJ25hbWVzcGFjZXMnLFxuICAgICAgICB9KVxuICAgICkucXVlcnkubmFtZXNwYWNlcztcblxuICAgIC8vIFNwZWNpZmljIGluZm9ybWF0aW9uIGFib3V0IGN1cnJlbnQgYW5kIGRlc3RpbmF0aW9uIHBhZ2VzXG4gICAgY29uc3QgcGFnZXNEYXRhID0gKFxuICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHtcbiAgICAgICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgIHByb3A6ICdpbmZvJyxcbiAgICAgICAgICAgIGlucHJvcDogJ3RhbGtpZCcsXG4gICAgICAgICAgICBpbnRlc3RhY3Rpb25zOiAnbW92ZXxjcmVhdGUnLFxuICAgICAgICAgICAgdGl0bGVzOiBgJHtjdXJyZW50VGl0bGV9fCR7ZGVzdGluYXRpb25UaXRsZX1gLFxuICAgICAgICB9KVxuICAgICkucXVlcnk7XG5cbiAgICAvLyBOb3JtYWxpemUgdGl0bGVzIGlmIG5lY2Vzc2FyeVxuICAgIGZvciAoY29uc3QgY2hhbmdlcyBpbiBwYWdlc0RhdGEubm9ybWFsaXplZCkge1xuICAgICAgICBpZiAoY3VycmVudFRpdGxlID09PSBwYWdlc0RhdGEubm9ybWFsaXplZFtjaGFuZ2VzXS5mcm9tKSBjdXJyZW50VGl0bGUgPSBwYWdlc0RhdGEubm9ybWFsaXplZFtjaGFuZ2VzXS50bztcbiAgICAgICAgaWYgKGRlc3RpbmF0aW9uVGl0bGUgPT09IHBhZ2VzRGF0YS5ub3JtYWxpemVkW2NoYW5nZXNdLmZyb20pIGRlc3RpbmF0aW9uVGl0bGUgPSBwYWdlc0RhdGEubm9ybWFsaXplZFtjaGFuZ2VzXS50bztcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZSBuYW1lc3BhY2VzXG4gICAgY29uc3QgdmFsaWRhdGlvbkRhdGEgPSBzd2FwVmFsaWRhdGUoY3VycmVudFRpdGxlLCBkZXN0aW5hdGlvblRpdGxlLCBwYWdlc0RhdGEucGFnZXMsIG5hbWVzcGFjZXNJbmZvcm1hdGlvbiwgdXNlclBlcm1pc3Npb25zKTtcbiAgICBpZiAoIXZhbGlkYXRpb25EYXRhLnZhbGlkKSB0aHJvdyBuZXcgRXJyb3IodmFsaWRhdGlvbkRhdGEuZXJyb3IpO1xuXG4gICAgaWYgKHZhbGlkYXRpb25EYXRhLmFkZExpbmVJbmZvICE9PSB1bmRlZmluZWQpIG13Lm5vdGlmeSh2YWxpZGF0aW9uRGF0YS5hZGRMaW5lSW5mbyk7XG5cbiAgICAvLyBTdWJwYWdlIGNoZWNrc1xuICAgIGNvbnN0IGN1cnJlbnRTdWJwYWdlcyA9IGF3YWl0IGdldFN1YnBhZ2VzKG5hbWVzcGFjZXNJbmZvcm1hdGlvbiwgdmFsaWRhdGlvbkRhdGEuY3VycmVudFRpdGxlLCB2YWxpZGF0aW9uRGF0YS5jdXJyZW50TmFtZXNwYWNlLCBmYWxzZSk7XG4gICAgaWYgKGN1cnJlbnRTdWJwYWdlcy5lcnJvciAhPT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoY3VycmVudFN1YnBhZ2VzLmVycm9yKTtcbiAgICBjb25zdCBjdXJyZW50U3VicGFnZUZsYWdzID0gcHJpbnRTdWJwYWdlSW5mbyh2YWxpZGF0aW9uRGF0YS5jdXJyZW50VGl0bGUsIGN1cnJlbnRTdWJwYWdlcyk7XG4gICAgY29uc3QgZGVzdGluYXRpb25TdWJwYWdlcyA9IGF3YWl0IGdldFN1YnBhZ2VzKG5hbWVzcGFjZXNJbmZvcm1hdGlvbiwgdmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25UaXRsZSwgdmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25OYW1lc3BhY2UsIGZhbHNlKTtcbiAgICBpZiAoZGVzdGluYXRpb25TdWJwYWdlcy5lcnJvciAhPT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoZGVzdGluYXRpb25TdWJwYWdlcy5lcnJvcik7XG4gICAgY29uc3QgZGVzdGluYXRpb25TdWJwYWdlRmxhZ3MgPSBwcmludFN1YnBhZ2VJbmZvKHZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uVGl0bGUsIGRlc3RpbmF0aW9uU3VicGFnZXMpO1xuXG4gICAgY29uc3QgdGFsa1ZhbGlkYXRpb25EYXRhID0gYXdhaXQgdGFsa1ZhbGlkYXRlKHZhbGlkYXRpb25EYXRhLmNoZWNrVGFsaywgdmFsaWRhdGlvbkRhdGEuY3VycmVudFRhbGtOYW1lLCB2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRhbGtOYW1lKTtcblxuICAgIC8vIFRPRE86IGNoZWNrIGVtcHR5IHN1YnBhZ2UgZGVzdGluYXRpb25zIG9uIGJvdGggc2lkZXMgKHN1YmosIHRhbGspIGZvciBjcmVhdGUgcHJvdGVjdGlvblxuICAgIGNvbnN0IGN1cnJlbnRUYWxrU3VicGFnZXMgPSBhd2FpdCBnZXRTdWJwYWdlcyhuYW1lc3BhY2VzSW5mb3JtYXRpb24sIHZhbGlkYXRpb25EYXRhLmN1cnJlbnRUaXRsZSwgdmFsaWRhdGlvbkRhdGEuY3VycmVudE5hbWVzcGFjZSwgdHJ1ZSk7XG4gICAgaWYgKGN1cnJlbnRUYWxrU3VicGFnZXMuZXJyb3IgIT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEVycm9yKGN1cnJlbnRUYWxrU3VicGFnZXMuZXJyb3IpO1xuICAgIGNvbnN0IGN1cnJlbnRUYWxrU3VicGFnZUZsYWdzID0gcHJpbnRTdWJwYWdlSW5mbyh2YWxpZGF0aW9uRGF0YS5jdXJyZW50VGFsa05hbWUsIGN1cnJlbnRUYWxrU3VicGFnZXMpO1xuICAgIGNvbnN0IGRlc3RpbmF0aW9uVGFsa1N1YnBhZ2VzID0gYXdhaXQgZ2V0U3VicGFnZXMobmFtZXNwYWNlc0luZm9ybWF0aW9uLCB2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRpdGxlLCB2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvbk5hbWVzcGFjZSwgdHJ1ZSk7XG4gICAgaWYgKGRlc3RpbmF0aW9uVGFsa1N1YnBhZ2VzLmVycm9yICE9PSB1bmRlZmluZWQpIHRocm93IG5ldyBFcnJvcihkZXN0aW5hdGlvblRhbGtTdWJwYWdlcy5lcnJvcik7XG4gICAgY29uc3QgZGVzdGluYXRpb25UYWxrU3VicGFnZUZsYWdzID0gcHJpbnRTdWJwYWdlSW5mbyh2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRhbGtOYW1lLCBkZXN0aW5hdGlvblRhbGtTdWJwYWdlcyk7XG5cbiAgICBjb25zdCBub1N1YnBhZ2VzID0gY3VycmVudFN1YnBhZ2VGbGFncy5ub05lZWQgJiYgZGVzdGluYXRpb25TdWJwYWdlRmxhZ3Mubm9OZWVkICYmIGN1cnJlbnRUYWxrU3VicGFnZUZsYWdzLm5vTmVlZCAmJiBkZXN0aW5hdGlvblRhbGtTdWJwYWdlRmxhZ3Mubm9OZWVkO1xuICAgIC8vIElmIG9uZSBuYW1lc3BhY2UgZGlzYWJsZXMgc3VicGFnZXMsIG90aGVyIGVuYWJsZXMgc3VicGFnZXMgKGFuZCBoYXMgc3VicGFnZXMpLCBjb25zaWRlciBhYm9ydC4gQXNzdW1lIHRhbGsgcGFnZXMgYWx3YXlzIHNhZmUgKFRPRE8gZml4KVxuICAgIGNvbnN0IHN1YnBhZ2VDb2xsaXNpb24gPSAodmFsaWRhdGlvbkRhdGEuY3VycmVudE5hbWVzcGFjZUFsbG93U3VicGFnZXMgJiYgIWRlc3RpbmF0aW9uU3VicGFnZUZsYWdzLm5vTmVlZCkgfHwgKHZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uTmFtZXNwYWNlQWxsb3dTdWJwYWdlcyAmJiAhY3VycmVudFN1YnBhZ2VGbGFncy5ub05lZWQpO1xuXG4gICAgaWYgKG1vdmVUYWxrICYmIHZhbGlkYXRpb25EYXRhLmNoZWNrVGFsayAmJiAhdGFsa1ZhbGlkYXRpb25EYXRhLmFsbG93TW92ZVRhbGspIHtcbiAgICAgICAgbW92ZVRhbGsgPSBmYWxzZTtcbiAgICAgICAgbXcubm90aWZ5KFxuICAgICAgICAgICAgYERpc2FsbG93aW5nIG1vdmluZyB0YWxrLiAke1xuICAgICAgICAgICAgICAgICF0YWxrVmFsaWRhdGlvbkRhdGEuY3VycmVudFRhbGtDYW5DcmVhdGVcbiAgICAgICAgICAgICAgICAgICAgPyBgJHt2YWxpZGF0aW9uRGF0YS5jdXJyZW50VGFsa05hbWV9IGlzIGNyZWF0ZS1wcm90ZWN0ZWRgXG4gICAgICAgICAgICAgICAgICAgIDogIXRhbGtWYWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRhbGtDYW5DcmVhdGVcbiAgICAgICAgICAgICAgICAgICAgPyBgJHt2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRhbGtOYW1lfSBpcyBjcmVhdGUtcHJvdGVjdGVkYFxuICAgICAgICAgICAgICAgICAgICA6ICdUYWxrIHBhZ2UgaXMgaW1tb3ZhYmxlJ1xuICAgICAgICAgICAgfWAsXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgbGV0IGZpbmFsTW92ZVN1YnBhZ2VzID0gZmFsc2U7XG4gICAgLy8gVE9ETyBmdXR1cmU6IGN1cnJUU3BGbGFncy5hbGxvd01vdmVTdWJwYWdlcyAmJiBkZXN0VFNwRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgbmVlZHMgdG8gYmUgc2VwYXJhdGUgY2hlY2suIElmIHRhbGsgc3VicGFnZXMgaW1tb3ZhYmxlLCBzaG91bGQgbm90IGFmZmVjdCBzdWJqc3BhY2VcbiAgICBpZiAoXG4gICAgICAgICFzdWJwYWdlQ29sbGlzaW9uICYmXG4gICAgICAgICFub1N1YnBhZ2VzICYmXG4gICAgICAgIHZhbGlkYXRpb25EYXRhLmFsbG93TW92ZVN1YnBhZ2VzICYmXG4gICAgICAgIGN1cnJlbnRTdWJwYWdlRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgJiZcbiAgICAgICAgZGVzdGluYXRpb25TdWJwYWdlRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgJiZcbiAgICAgICAgY3VycmVudFRhbGtTdWJwYWdlRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgJiZcbiAgICAgICAgZGVzdGluYXRpb25UYWxrU3VicGFnZUZsYWdzLmFsbG93TW92ZVN1YnBhZ2VzXG4gICAgKVxuICAgICAgICBmaW5hbE1vdmVTdWJwYWdlcyA9IG1vdmVTdWJwYWdlcztcbiAgICBlbHNlIGlmIChzdWJwYWdlQ29sbGlzaW9uKSB7XG4gICAgICAgIGZpbmFsTW92ZVN1YnBhZ2VzID0gZmFsc2U7XG4gICAgICAgIG13Lm5vdGlmeSgnT25lIG5hbWVzcGFjZSBkb2VzIG5vdCBoYXZlIHN1YnBhZ2VzIGVuYWJsZWQuIERpc2FsbG93aW5nIG1vdmUgc3VicGFnZXMuJyk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFtQYWdlc3dhcF0gU3dhcHBpbmcgXCIke2N1cnJlbnRUaXRsZX1cIiB3aXRoIFwiJHtkZXN0aW5hdGlvblRpdGxlfVwiIHdpdGggc3VtbWFyeSBcIiR7c3VtbWFyeX1cIiBhbmQgbW92ZVRhbGsgJHttb3ZlVGFsa30gYW5kIG1vdmVTdWJwYWdlcyAke2ZpbmFsTW92ZVN1YnBhZ2VzfWApO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc3dhcFBhZ2VzKGN1cnJlbnRUaXRsZSwgZGVzdGluYXRpb25UaXRsZSwgc3VtbWFyeSwgbW92ZVRhbGssIGZpbmFsTW92ZVN1YnBhZ2VzKTtcblxuICAgIGNvbnNvbGUubG9nKHJlc3VsdCk7XG5cbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB0aHJvdyBuZXcgRXJyb3IocmVzdWx0LmVycm9yKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGtCQUFrQixnQkFBZ0IsbUJBQW1CLG1CQUFtQixtQkFBbUIsQ0FBQyxFQUFFLEtBQUssWUFBWTtBQUM1SCxRQUFNLFlBQVksR0FBRyxPQUFPLElBQUksbUJBQW1C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
