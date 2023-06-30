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
mw.loader.using(["mediawiki.util", "oojs-ui-core", "oojs-ui-widgets", "oojs-ui-windows", "mediawiki.widgets"]).then(() => __async(this, null, function* () {
  const namespace = mw.config.get("wgNamespaceNumber");
  if (namespace < 0 || namespace >= 120 || namespace >= 6 && namespace <= 9 || namespace >= 14 && namespace <= 99)
    return;
  const currentTitle = mw.config.get("wgPageName");
  const userPermissions = yield fetchUserPermissions();
  const pageInfo = yield new mw.Api().get({ action: "query", prop: "info", titles: currentTitle });
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
            return $.Deferred().reject(this.showErrors([new OO.ui.Error((error == null ? void 0 : error.message) || "An unknown error occurred.")]));
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
}));
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
function talkValidate(checkTalk, firstTalk, secondTalk) {
  return __async(this, null, function* () {
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
      const talkData = (yield new mw.Api().get({
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
  });
}
function getSubpages(namespaceData, title, titleNamespace, isTalk) {
  return __async(this, null, function* () {
    var _a, _b;
    if (!isTalk && namespaceData[titleNamespace.toString()].subpages !== "")
      return { data: [] };
    const titlePageData = getTalkPageName(namespaceData, title, titleNamespace);
    const subpages = (yield new mw.Api().get({
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
    const subpageDataOne = (yield new mw.Api().get({
      action: "query",
      prop: "info",
      intestactions: "move|create",
      pageids: subpageIds[0].join("|")
    })).query.pages;
    for (const [, pageData] of Object.entries(subpageDataOne))
      result.push({
        title: pageData.title,
        isRedir: pageData.redirect === "",
        canMove: ((_a = pageData.actions) == null ? void 0 : _a.move) === ""
      });
    if (subpageIds[1].length === 0)
      return { data: result };
    const subpageDataTwo = (yield new mw.Api().get({
      action: "query",
      prop: "info",
      intestactions: "move|create",
      pageids: subpageIds[1].join("|")
    })).query.pages;
    for (const [, pageData] of Object.entries(subpageDataTwo))
      result.push({
        title: pageData.title,
        isRedirect: pageData.redirect === "",
        canMove: ((_b = pageData.actions) == null ? void 0 : _b.move) === ""
      });
    return { data: result };
  });
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
function roundRobin(userPermissions, currentTitle, destinationTitle, summary, moveTalk, moveSubpages) {
  return __async(this, null, function* () {
    const namespacesInformation = (yield new mw.Api().get({
      action: "query",
      meta: "siteinfo",
      siprop: "namespaces"
    })).query.namespaces;
    const pagesData = (yield new mw.Api().get({
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
    const currentSubpages = yield getSubpages(namespacesInformation, validationData.currentTitle, validationData.currentNamespace, false);
    if (currentSubpages.error !== void 0)
      throw new Error(currentSubpages.error);
    const currentSubpageFlags = printSubpageInfo(validationData.currentTitle, currentSubpages);
    const destinationSubpages = yield getSubpages(namespacesInformation, validationData.destinationTitle, validationData.destinationNamespace, false);
    if (destinationSubpages.error !== void 0)
      throw new Error(destinationSubpages.error);
    const destinationSubpageFlags = printSubpageInfo(validationData.destinationTitle, destinationSubpages);
    const talkValidationData = yield talkValidate(validationData.checkTalk, validationData.currentTalkName, validationData.destinationTalkName);
    const currentTalkSubpages = yield getSubpages(namespacesInformation, validationData.currentTitle, validationData.currentNamespace, true);
    if (currentTalkSubpages.error !== void 0)
      throw new Error(currentTalkSubpages.error);
    const currentTalkSubpageFlags = printSubpageInfo(validationData.currentTalkName, currentTalkSubpages);
    const destinationTalkSubpages = yield getSubpages(namespacesInformation, validationData.destinationTitle, validationData.destinationNamespace, true);
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
    const result = yield swapPages(currentTitle, destinationTitle, summary, moveTalk, finalMoveSubpages);
    console.log(result);
    if (!result.success)
      throw new Error(result.error);
  });
}
