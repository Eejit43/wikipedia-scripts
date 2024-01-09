"use strict";
mw.loader.using(["mediawiki.util", "oojs-ui-core", "oojs-ui-widgets", "oojs-ui-windows", "mediawiki.widgets"], async () => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9wYWdlc3dhcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsibXcubG9hZGVyLnVzaW5nKFsnbWVkaWF3aWtpLnV0aWwnLCAnb29qcy11aS1jb3JlJywgJ29vanMtdWktd2lkZ2V0cycsICdvb2pzLXVpLXdpbmRvd3MnLCAnbWVkaWF3aWtpLndpZGdldHMnXSwgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9IG13LmNvbmZpZy5nZXQoJ3dnTmFtZXNwYWNlTnVtYmVyJyk7XG4gICAgaWYgKG5hbWVzcGFjZSA8IDAgfHwgbmFtZXNwYWNlID49IDEyMCB8fCAobmFtZXNwYWNlID49IDYgJiYgbmFtZXNwYWNlIDw9IDkpIHx8IChuYW1lc3BhY2UgPj0gMTQgJiYgbmFtZXNwYWNlIDw9IDk5KSkgcmV0dXJuO1xuXG4gICAgY29uc3QgY3VycmVudFRpdGxlID0gbXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpO1xuXG4gICAgY29uc3QgdXNlclBlcm1pc3Npb25zID0gYXdhaXQgZmV0Y2hVc2VyUGVybWlzc2lvbnMoKTtcblxuICAgIGNvbnN0IHBhZ2VJbmZvID0gKGF3YWl0IG5ldyBtdy5BcGkoKS5nZXQoeyBhY3Rpb246ICdxdWVyeScsIHByb3A6ICdpbmZvJywgdGl0bGVzOiBjdXJyZW50VGl0bGUgfSkpIGFzIHsgcXVlcnk6IHsgcGFnZXM6IFJlY29yZDxudW1iZXIsIHVua25vd24+IH0gfTtcbiAgICBpZiAocGFnZUluZm8ucXVlcnkucGFnZXNbLTFdKSByZXR1cm47XG5cbiAgICBjb25zdCBsaW5rID0gbXcudXRpbC5hZGRQb3J0bGV0TGluayhtdy5jb25maWcuZ2V0KCdza2luJykgPT09ICdtaW5lcnZhJyA/ICdwLXRiJyA6ICdwLWNhY3Rpb25zJywgJyMnLCAnU3dhcCcsICdlZWppdC1wYWdlc3dhcCcpITtcblxuICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBpZiAoIXVzZXJQZXJtaXNzaW9ucy5jYW5Td2FwKSByZXR1cm4gbXcubm90aWZ5KCdZb3UgZG8gbm90IGhhdmUgc3VmZmljaWVudCBwZXJtaXNzaW9ucyB0byBzd2FwIHBhZ2VzLicsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICBmdW5jdGlvbiBTd2FwRGlhbG9nKCkge1xuICAgICAgICAgICAgU3dhcERpYWxvZy5zdXBlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgICAgIE9PLmluaGVyaXRDbGFzcyhTd2FwRGlhbG9nLCBPTy51aS5Qcm9jZXNzRGlhbG9nKTtcblxuICAgICAgICBTd2FwRGlhbG9nLnN0YXRpYy5uYW1lID0gJ3N3YXAnO1xuICAgICAgICBTd2FwRGlhbG9nLnN0YXRpYy50aXRsZSA9ICQoJzxzcGFuPicpLmFwcGVuZChcbiAgICAgICAgICAgICQoJzxhPicpXG4gICAgICAgICAgICAgICAgLmF0dHIoeyBocmVmOiBtdy51dGlsLmdldFVybCgnV1A6Uk9VTkRST0JJTicpLCB0YXJnZXQ6ICdfYmxhbmsnIH0pXG4gICAgICAgICAgICAgICAgLnRleHQoJ1N3YXAnKSxcbiAgICAgICAgICAgICcgdHdvIHBhZ2VzJyxcbiAgICAgICAgKTtcbiAgICAgICAgU3dhcERpYWxvZy5zdGF0aWMuYWN0aW9ucyA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBhY3Rpb246ICdzd2FwJyxcbiAgICAgICAgICAgICAgICBsYWJlbDogJ1N3YXAnLFxuICAgICAgICAgICAgICAgIGZsYWdzOiBbJ3ByaW1hcnknLCAncHJvZ3Jlc3NpdmUnXSxcbiAgICAgICAgICAgICAgICBkaXNhYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiAnY2FuY2VsJyxcbiAgICAgICAgICAgICAgICBsYWJlbDogJ0NhbmNlbCcsXG4gICAgICAgICAgICAgICAgZmxhZ3M6IFsnc2FmZScsICdjbG9zZSddLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXTtcblxuICAgICAgICBTd2FwRGlhbG9nLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgU3dhcERpYWxvZy5zdXBlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLnBhbmVsID0gbmV3IE9PLnVpLlBhbmVsTGF5b3V0KHtcbiAgICAgICAgICAgICAgICBwYWRkZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgZXhwYW5kZWQ6IGZhbHNlLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuY29udGVudCA9IG5ldyBPTy51aS5GaWVsZHNldExheW91dCgpO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3RpbmF0aW9uSW5wdXQgPSBuZXcgbXcud2lkZ2V0cy5UaXRsZUlucHV0V2lkZ2V0KHtcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAkb3ZlcmxheTogdGhpcy4kb3ZlcmxheSxcbiAgICAgICAgICAgICAgICBleGNsdWRlQ3VycmVudFBhZ2U6IHRydWUsXG4gICAgICAgICAgICAgICAgc2hvd0Rlc2NyaXB0aW9uczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzaG93UmVkaXJlY3RUYXJnZXRzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBleGNsdWRlRHluYW1pY05hbWVzcGFjZXM6IHRydWUsIC8vIFwiU3BlY2lhbFwiIGFuZCBcIk1lZGlhXCJcbiAgICAgICAgICAgICAgICBzaG93TWlzc2luZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgdmFsaWRhdGU6ICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT09ICcnIHx8IHZhbHVlID09PSBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5kZXN0aW5hdGlvbklucHV0Lm9uKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gdGhpcy5kZXN0aW5hdGlvbklucHV0LmdldFZhbHVlKCkucmVwbGFjZUFsbCgnXycsICcgJykucmVwbGFjZSgvXlxccysvLCAnJyk7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKG5ldyBSZWdFeHAoYF4oaHR0cHM/Oik/L3syfT8ke213LmNvbmZpZy5nZXQoJ3dnU2VydmVyJykucmVwbGFjZSgvXlxcL3syfS8sICcnKX0vd2lraS9gKSwgJycpO1xuICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUuc3BsaXQoJyMnKVswXTtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgdmFsdWUuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5kZXN0aW5hdGlvbklucHV0LnNldFZhbHVlKHZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5kZXN0aW5hdGlvbklucHV0LmNvbm5lY3QodGhpcywgeyBjaGFuZ2U6ICd1cGRhdGVBY3Rpb25TdGF0ZScgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZGVzdGluYXRpb25JbnB1dEZpZWxkID0gbmV3IE9PLnVpLkZpZWxkTGF5b3V0KHRoaXMuZGVzdGluYXRpb25JbnB1dCwgeyBsYWJlbDogJ0Rlc3RpbmF0aW9uIHBhZ2UnLCBhbGlnbjogJ3RvcCcgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuc3VtbWFyeUlucHV0ID0gbmV3IE9PLnVpLkNvbWJvQm94SW5wdXRXaWRnZXQoe1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICRvdmVybGF5OiB0aGlzLiRvdmVybGF5LFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnUGVyZm9ybWluZyBbW1dQOlJNL1RSfHJlcXVlc3RlZCB0ZWNobmljYWwgbW92ZV1dJyB9LCAvL1xuICAgICAgICAgICAgICAgICAgICB7IGRhdGE6ICdSZXN1bHQgb2YgW1tXUDpSTXxyZXF1ZXN0ZWQgbW92ZV1dJyB9LFxuICAgICAgICAgICAgICAgICAgICB7IGRhdGE6ICdNb3ZlIHRvIFtbV1A6Q09NTU9OTkFNRXxjb21tb24gbmFtZV1dJyB9LFxuICAgICAgICAgICAgICAgICAgICB7IGRhdGE6ICdGaXhpbmcgdHlwbycgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkYXRhOiAnRml4aW5nIGNhcGl0YWxpemF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICB7IGRhdGE6ICdGaXhpbmcgcGVyIFtbV1A6TkN8bmFtaW5nIGNvbnZlbnRpb25zXV0nIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLnN1bW1hcnlJbnB1dC5jb25uZWN0KHRoaXMsIHsgY2hhbmdlOiAndXBkYXRlQWN0aW9uU3RhdGUnIH0pO1xuXG4gICAgICAgICAgICB0aGlzLnN1bW1hcnlJbnB1dEZpZWxkID0gbmV3IE9PLnVpLkZpZWxkTGF5b3V0KHRoaXMuc3VtbWFyeUlucHV0LCB7IGxhYmVsOiAnU3VtbWFyeScsIGFsaWduOiAndG9wJyB9KTtcblxuICAgICAgICAgICAgdGhpcy5tb3ZlVGFsa0NoZWNrYm94ID0gbmV3IE9PLnVpLkNoZWNrYm94SW5wdXRXaWRnZXQoeyBzZWxlY3RlZDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIHRoaXMubW92ZVRhbGtDaGVja2JveEZpZWxkID0gbmV3IE9PLnVpLkZpZWxkTGF5b3V0KHRoaXMubW92ZVRhbGtDaGVja2JveCwgeyBsYWJlbDogJ01vdmUgdGFsayBwYWdlIChpZiBhcHBsaWNhYmxlKScsIGFsaWduOiAnaW5saW5lJyB9KTtcblxuICAgICAgICAgICAgdGhpcy5tb3ZlU3VicGFnZXNDaGVja2JveCA9IG5ldyBPTy51aS5DaGVja2JveElucHV0V2lkZ2V0KHsgc2VsZWN0ZWQ6IHRydWUgfSk7XG4gICAgICAgICAgICB0aGlzLm1vdmVTdWJwYWdlc0NoZWNrYm94RmllbGQgPSBuZXcgT08udWkuRmllbGRMYXlvdXQodGhpcy5tb3ZlU3VicGFnZXNDaGVja2JveCwgeyBsYWJlbDogJ01vdmUgc3VicGFnZXMgKGlmIGFwcGxpY2FibGUpJywgYWxpZ246ICdpbmxpbmUnIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnQuYWRkSXRlbXMoW3RoaXMuZGVzdGluYXRpb25JbnB1dEZpZWxkLCB0aGlzLnN1bW1hcnlJbnB1dEZpZWxkLCB0aGlzLm1vdmVUYWxrQ2hlY2tib3hGaWVsZCwgdGhpcy5tb3ZlU3VicGFnZXNDaGVja2JveEZpZWxkXSk7XG5cbiAgICAgICAgICAgIHRoaXMucGFuZWwuJGVsZW1lbnQuYXBwZW5kKHRoaXMuY29udGVudC4kZWxlbWVudCk7XG4gICAgICAgICAgICB0aGlzLiRib2R5LmFwcGVuZCh0aGlzLnBhbmVsLiRlbGVtZW50KTtcbiAgICAgICAgfTtcblxuICAgICAgICBTd2FwRGlhbG9nLnByb3RvdHlwZS51cGRhdGVBY3Rpb25TdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbnN0IGlzVmFsaWQgPSB0aGlzLmRlc3RpbmF0aW9uSW5wdXQuZ2V0VmFsdWUoKSAhPT0gJycgJiYgdGhpcy5kZXN0aW5hdGlvbklucHV0LmdldFZhbGlkaXR5KCkgJiYgdGhpcy5zdW1tYXJ5SW5wdXQuZ2V0VmFsdWUoKSAhPT0gJyc7XG4gICAgICAgICAgICB0aGlzLmFjdGlvbnMuc2V0QWJpbGl0aWVzKHsgc3dhcDogaXNWYWxpZCB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBTd2FwRGlhbG9nLnByb3RvdHlwZS5nZXRBY3Rpb25Qcm9jZXNzID0gZnVuY3Rpb24gKGFjdGlvbjogc3RyaW5nKSB7XG4gICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnc3dhcCcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXN0aW5hdGlvbiA9IHRoaXMuZGVzdGluYXRpb25JbnB1dC5nZXRWYWx1ZSgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzdW1tYXJ5ID0gdGhpcy5zdW1tYXJ5SW5wdXQuZ2V0VmFsdWUoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBtb3ZlVGFsayA9IHRoaXMubW92ZVRhbGtDaGVja2JveC5pc1NlbGVjdGVkKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgbW92ZVN1YnBhZ2VzID0gdGhpcy5tb3ZlU3VicGFnZXNDaGVja2JveC5pc1NlbGVjdGVkKCk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE9PLnVpLlByb2Nlc3MoKVxuICAgICAgICAgICAgICAgICAgICAubmV4dCgoKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgcm91bmRSb2Jpbih1c2VyUGVybWlzc2lvbnMsIGN1cnJlbnRUaXRsZSwgZGVzdGluYXRpb24sIHN1bW1hcnksIG1vdmVUYWxrLCBtb3ZlU3VicGFnZXMpLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAkLkRlZmVycmVkKCkucmVqZWN0KHRoaXMuc2hvd0Vycm9ycyhbbmV3IE9PLnVpLkVycm9yKGVycm9yPy5tZXNzYWdlIHx8ICdBbiB1bmtub3duIGVycm9yIG9jY3VycmVkLicpXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgLm5leHQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbXcubm90aWZ5KCdNb3ZlcyBjb21wbGV0ZSEgUmVsb2FkaW5nLi4uJywgeyB0eXBlOiAnc3VjY2VzcycgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb3NlKHsgYWN0aW9uLCBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCksIDEwMDApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0aW9uID09PSAnY2FuY2VsJylcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE9PLnVpLlByb2Nlc3MoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsb3NlKHsgYWN0aW9uIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gU3dhcERpYWxvZy5zdXBlci5wcm90b3R5cGUuZ2V0QWN0aW9uUHJvY2Vzcy5jYWxsKHRoaXMsIGFjdGlvbik7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZGlhbG9nID0gbmV3IFN3YXBEaWFsb2coKTtcbiAgICAgICAgY29uc3Qgd2luZG93TWFuYWdlciA9IG5ldyBPTy51aS5XaW5kb3dNYW5hZ2VyKCk7XG4gICAgICAgICQoJ2JvZHknKS5hcHBlbmQod2luZG93TWFuYWdlci4kZWxlbWVudCk7XG4gICAgICAgIHdpbmRvd01hbmFnZXIuYWRkV2luZG93cyhbZGlhbG9nXSk7XG4gICAgICAgIHdpbmRvd01hbmFnZXIub3BlbldpbmRvdyhkaWFsb2cpO1xuICAgIH0pO1xufSk7XG5cbi8vICEhIFNvbWUgY29udGVudCBiZWxvdyB0aGlzIGNvbnRhaW5zIGNvZGUgbW9kaWZpZWQgZnJvbSBbW1VzZXI6QW5keSBNLiBXYW5nL3BhZ2Vzd2FwLmpzXV0gISFcblxuLyoqXG4gKiBDaGVja3MgaWYgdXNlciBoYXMgdGhlIHJlcXVpcmVkIHBlcm1pc3Npb25zIHRvIHBlcmZvcm0gYSBzd2FwXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx7Y2FuU3dhcDogYm9vbGVhbiwgYWxsb3dTd2FwVGVtcGxhdGVzOiBib29sZWFufT59XG4gKi9cbmZ1bmN0aW9uIGZldGNoVXNlclBlcm1pc3Npb25zKCkge1xuICAgIHJldHVybiBuZXcgbXcuQXBpKClcbiAgICAgICAgLmdldCh7XG4gICAgICAgICAgICBhY3Rpb246ICdxdWVyeScsXG4gICAgICAgICAgICBtZXRhOiAndXNlcmluZm8nLFxuICAgICAgICAgICAgdWlwcm9wOiAncmlnaHRzJyxcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJpZ2h0c0xpc3QgPSBkYXRhLnF1ZXJ5LnVzZXJpbmZvLnJpZ2h0cztcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgY2FuU3dhcDogcmlnaHRzTGlzdC5pbmNsdWRlcygnc3VwcHJlc3NyZWRpcmVjdCcpICYmIHJpZ2h0c0xpc3QuaW5jbHVkZXMoJ21vdmUtc3VicGFnZXMnKSwgLy8gUGFnZSBtb3ZlciByaWdodCBvbiB0aGUgRW5nbGlzaCBXaWtpcGVkaWFcbiAgICAgICAgICAgICAgICBhbGxvd1N3YXBUZW1wbGF0ZXM6IHJpZ2h0c0xpc3QuaW5jbHVkZXMoJ3RlbXBsYXRlZWRpdG9yJyksXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbn1cblxuLyoqXG4gKiBHaXZlbiBuYW1lc3BhY2UgZGF0YSwgdGl0bGUsIHRpdGxlIG5hbWVzcGFjZSwgcmV0dXJucyBleHBlY3RlZCB0aXRsZSBvZiBwYWdlXG4gKiBBbG9uZyB3aXRoIHRpdGxlIHdpdGhvdXQgcHJlZml4XG4gKiBQcmVjb25kaXRpb24sIHRpdGxlLCB0aXRsZU5zIGlzIGEgc3ViamVjdCBwYWdlIVxuICovXG5mdW5jdGlvbiBnZXRUYWxrUGFnZU5hbWUobmFtZXNwYWNlRGF0YSwgdGl0bGUsIHRpdGxlTmFtZXNwYWNlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgY29uc3QgcHJlZml4TGVuZ3RoID0gbmFtZXNwYWNlRGF0YVt0aXRsZU5hbWVzcGFjZS50b1N0cmluZygpXVsnKiddLmxlbmd0aCA9PT0gMCA/IDAgOiBuYW1lc3BhY2VEYXRhW3RpdGxlTmFtZXNwYWNlLnRvU3RyaW5nKCldWycqJ10ubGVuZ3RoICsgMTtcbiAgICByZXN1bHQudGl0bGVXaXRob3V0UHJlZml4ID0gdGl0bGUuc3Vic3RyaW5nKHByZWZpeExlbmd0aCwgdGl0bGUubGVuZ3RoKTtcbiAgICByZXN1bHQudGFsa1RpdGxlID0gYCR7bmFtZXNwYWNlRGF0YVsodGl0bGVOYW1lc3BhY2UgKyAxKS50b1N0cmluZygpXVsnKiddfToke3Jlc3VsdC50aXRsZVdpdGhvdXRQcmVmaXh9YDtcbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEdpdmVuIHR3byAobm9ybWFsaXplZCkgdGl0bGVzLCBmaW5kIHRoZWlyIG5hbWVzcGFjZXMsIGlmIHRoZXkgYXJlIHJlZGlyZWN0cyxcbiAqIGlmIGhhdmUgYSB0YWxrIHBhZ2UsIHdoZXRoZXIgdGhlIGN1cnJlbnQgdXNlciBjYW4gbW92ZSB0aGUgcGFnZXMsIHN1Z2dlc3RzXG4gKiB3aGV0aGVyIG1vdmVzdWJwYWdlcyBzaG91bGQgYmUgYWxsb3dlZCwgd2hldGhlciB0YWxrIHBhZ2VzIG5lZWQgdG8gYmUgY2hlY2tlZFxuICovXG5mdW5jdGlvbiBzd2FwVmFsaWRhdGUoc3RhcnRUaXRsZSwgZW5kVGl0bGUsIHBhZ2VzRGF0YSwgbmFtZXNwYWNlc0RhdGEsIHVzZXJQZXJtaXNzaW9ucykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHsgdmFsaWQ6IHRydWUsIGFsbG93TW92ZVN1YnBhZ2VzOiB0cnVlLCBjaGVja1RhbGs6IHRydWUgfTtcblxuICAgIGxldCBjb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBbcGFnZUlkLCBwYWdlRGF0YV0gb2YgT2JqZWN0LmVudHJpZXMocGFnZXNEYXRhKSkge1xuICAgICAgICBjb3VudCsrO1xuICAgICAgICBpZiAocGFnZUlkID09PSAnLTEnIHx8IHBhZ2VEYXRhLm5zIDwgMCkge1xuICAgICAgICAgICAgcmVzdWx0LnZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgICByZXN1bHQuZXJyb3IgPSBgUGFnZSAke3BhZ2VEYXRhLnRpdGxlfSBkb2VzIG5vdCBleGlzdC5gO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICAvLyBFbmFibGUgb25seSBpbiBNYWluLCBUYWxrLCBVc2VyLCBVc2VyIHRhbGssIFdpa2lwZWRpYSwgV2lraXBlZGlhIHRhbGssIEhlbHAsIEhlbHAgdGFsaywgRHJhZnQsIGFuZCBEcmFmdCB0YWxrXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIChwYWdlRGF0YS5ucyA+PSA2ICYmIHBhZ2VEYXRhLm5zIDw9IDkpIHx8XG4gICAgICAgICAgICAocGFnZURhdGEubnMgPj0gMTAgJiYgcGFnZURhdGEubnMgPD0gMTEgJiYgIXVzZXJQZXJtaXNzaW9ucy5hbGxvd1N3YXBUZW1wbGF0ZXMpIHx8XG4gICAgICAgICAgICAocGFnZURhdGEubnMgPj0gMTQgJiYgcGFnZURhdGEubnMgPD0gMTE3KSB8fFxuICAgICAgICAgICAgcGFnZURhdGEubnMgPj0gMTIwXG4gICAgICAgICkge1xuICAgICAgICAgICAgcmVzdWx0LnZhbGlkID0gZmFsc2U7XG4gICAgICAgICAgICByZXN1bHQuZXJyb3IgPSBgTmFtZXNwYWNlIG9mICR7cGFnZURhdGEudGl0bGV9ICgke3BhZ2VEYXRhLm5zfSkgbm90IHN1cHBvcnRlZC5cXG5cXG5MaWtlbHkgcmVhc29uczpcXG4tIE5hbWVzIG9mIHBhZ2VzIGluIHRoaXMgbmFtZXNwYWNlIHJlbGllcyBvbiBvdGhlciBwYWdlc1xcbi0gTmFtZXNwYWNlIGZlYXR1cmVzIGhlYXZpbHktdHJhbnNjbHVkZWQgcGFnZXNcXG4tIE5hbWVzcGFjZSBpbnZvbHZlcyBzdWJwYWdlczogc3dhcHMgcHJvZHVjZSBtYW55IHJlZGxpbmtzXFxuXFxuXFxuSWYgdGhlIG1vdmUgaXMgbGVnaXRpbWF0ZSwgY29uc2lkZXIgYSBjYXJlZnVsIG1hbnVhbCBzd2FwLmA7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGFydFRpdGxlID09PSBwYWdlRGF0YS50aXRsZSkge1xuICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnRUaXRsZSA9IHBhZ2VEYXRhLnRpdGxlO1xuICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnROYW1lc3BhY2UgPSBwYWdlRGF0YS5ucztcbiAgICAgICAgICAgIHJlc3VsdC5jdXJyZW50VGFsa0lkID0gcGFnZURhdGEudGFsa2lkO1xuICAgICAgICAgICAgcmVzdWx0LmN1cnJlbnRDYW5Nb3ZlID0gcGFnZURhdGEuYWN0aW9ucy5tb3ZlID09PSAnJztcbiAgICAgICAgICAgIHJlc3VsdC5jdXJyZW50SXNSZWRpcmVjdCA9IHBhZ2VEYXRhLnJlZGlyZWN0ID09PSAnJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoZW5kVGl0bGUgPT09IHBhZ2VEYXRhLnRpdGxlKSB7XG4gICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UaXRsZSA9IHBhZ2VEYXRhLnRpdGxlO1xuICAgICAgICAgICAgcmVzdWx0LmRlc3RpbmF0aW9uTmFtZXNwYWNlID0gcGFnZURhdGEubnM7XG4gICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrSWQgPSBwYWdlRGF0YS50YWxraWQ7XG4gICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25DYW5Nb3ZlID0gcGFnZURhdGEuYWN0aW9ucy5tb3ZlID09PSAnJztcbiAgICAgICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvbklzUmVkaXJlY3QgPSBwYWdlRGF0YS5yZWRpcmVjdCA9PT0gJyc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXJlc3VsdC52YWxpZCkgcmV0dXJuIHJlc3VsdDtcbiAgICBpZiAoIXJlc3VsdC5jdXJyZW50Q2FuTW92ZSkge1xuICAgICAgICByZXN1bHQudmFsaWQgPSBmYWxzZTtcbiAgICAgICAgcmVzdWx0LmVycm9yID0gYCR7cmVzdWx0LmN1cnJlbnRUaXRsZX0gaXMgaW1tb3ZhYmxlYDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgaWYgKCFyZXN1bHQuZGVzdGluYXRpb25DYW5Nb3ZlKSB7XG4gICAgICAgIHJlc3VsdC52YWxpZCA9IGZhbHNlO1xuICAgICAgICByZXN1bHQuZXJyb3IgPSBgJHtyZXN1bHQuZGVzdGluYXRpb25UaXRsZX0gaXMgaW1tb3ZhYmxlYDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgaWYgKHJlc3VsdC5jdXJyZW50TmFtZXNwYWNlICUgMiAhPT0gcmVzdWx0LmRlc3RpbmF0aW9uTmFtZXNwYWNlICUgMikge1xuICAgICAgICByZXN1bHQudmFsaWQgPSBmYWxzZTtcbiAgICAgICAgcmVzdWx0LmVycm9yID0gXCJOYW1lc3BhY2VzIGRvbid0IG1hdGNoOiBvbmUgaXMgYSB0YWxrIHBhZ2UsIHRoZSBvdGhlciBpcyBub3RcIjtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgaWYgKGNvdW50ICE9PSAyKSB7XG4gICAgICAgIHJlc3VsdC52YWxpZCA9IGZhbHNlO1xuICAgICAgICByZXN1bHQuZXJyb3IgPSAnRGVzdGluYXRpb24gdGl0bGUgaXMgdGhlIHNhbWUgYXMgdGhlIGN1cnJlbnQgdGl0bGUnO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICByZXN1bHQuY3VycmVudE5hbWVzcGFjZUFsbG93U3VicGFnZXMgPSBuYW1lc3BhY2VzRGF0YVtyZXN1bHQuY3VycmVudE5hbWVzcGFjZS50b1N0cmluZygpXS5zdWJwYWdlcyAhPT0gJyc7XG4gICAgcmVzdWx0LmRlc3RpbmF0aW9uTmFtZXNwYWNlQWxsb3dTdWJwYWdlcyA9IG5hbWVzcGFjZXNEYXRhW3Jlc3VsdC5kZXN0aW5hdGlvbk5hbWVzcGFjZS50b1N0cmluZygpXS5zdWJwYWdlcyAhPT0gJyc7XG5cbiAgICAvLyBJZiBzYW1lIG5hbWVzcGFjZSAoc3VicGFnZXMgYWxsb3dlZCksIGlmIG9uZSBpcyBzdWJwYWdlIG9mIGFub3RoZXIsIGRpc2FsbG93IG1vdmluZyBzdWJwYWdlc1xuICAgIGlmIChyZXN1bHQuY3VycmVudFRpdGxlLnN0YXJ0c1dpdGgocmVzdWx0LmRlc3RpbmF0aW9uVGl0bGUgKyAnLycpIHx8IHJlc3VsdC5kZXN0aW5hdGlvblRpdGxlLnN0YXJ0c1dpdGgocmVzdWx0LmN1cnJlbnRUaXRsZSArICcvJykpIHtcbiAgICAgICAgaWYgKHJlc3VsdC5jdXJyZW50TmFtZXNwYWNlICE9PSByZXN1bHQuZGVzdGluYXRpb25OYW1lc3BhY2UpIHtcbiAgICAgICAgICAgIHJlc3VsdC52YWxpZCA9IGZhbHNlO1xuICAgICAgICAgICAgcmVzdWx0LmVycm9yID0gYCR7cmVzdWx0LmN1cnJlbnRUaXRsZX0gaW4gbnMgJHtyZXN1bHQuY3VycmVudE5hbWVzcGFjZX1cXG4ke3Jlc3VsdC5kZXN0aW5hdGlvblRpdGxlfSBpbiBucyAke3Jlc3VsdC5kZXN0aW5hdGlvbk5hbWVzcGFjZX0uIERpc2FsbG93aW5nLmA7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0LmFsbG93TW92ZVN1YnBhZ2VzID0gcmVzdWx0LmN1cnJlbnROYW1lc3BhY2VBbGxvd1N1YnBhZ2VzO1xuICAgICAgICBpZiAoIXJlc3VsdC5hbGxvd01vdmVTdWJwYWdlcykgcmVzdWx0LmFkZExpbmVJbmZvID0gJ09uZSBwYWdlIGlzIGEgc3VicGFnZS4gRGlzYWxsb3dpbmcgbW92ZS1zdWJwYWdlcyc7XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdC5jdXJyZW50TmFtZXNwYWNlICUgMiA9PT0gMSkgcmVzdWx0LmNoZWNrVGFsayA9IGZhbHNlOyAvLyBObyBuZWVkIHRvIGNoZWNrIHRhbGtzLCBhbHJlYWR5IHRhbGsgcGFnZXNcbiAgICBlbHNlIHtcbiAgICAgICAgY29uc3QgY3VycmVudFRhbGtEYXRhID0gZ2V0VGFsa1BhZ2VOYW1lKG5hbWVzcGFjZXNEYXRhLCByZXN1bHQuY3VycmVudFRpdGxlLCByZXN1bHQuY3VycmVudE5hbWVzcGFjZSk7XG4gICAgICAgIHJlc3VsdC5jdXJyZW50VGl0bGVXaXRob3V0UHJlZml4ID0gY3VycmVudFRhbGtEYXRhLnRpdGxlV2l0aG91dFByZWZpeDtcbiAgICAgICAgcmVzdWx0LmN1cnJlbnRUYWxrTmFtZSA9IGN1cnJlbnRUYWxrRGF0YS50YWxrVGl0bGU7XG4gICAgICAgIGNvbnN0IGRlc3RpbmF0aW9uRGF0YSA9IGdldFRhbGtQYWdlTmFtZShuYW1lc3BhY2VzRGF0YSwgcmVzdWx0LmRlc3RpbmF0aW9uVGl0bGUsIHJlc3VsdC5kZXN0aW5hdGlvbk5hbWVzcGFjZSk7XG4gICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvblRpdGxlV2l0aG91dFByZWZpeCA9IGRlc3RpbmF0aW9uRGF0YS50aXRsZVdpdGhvdXRQcmVmaXg7XG4gICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvblRhbGtOYW1lID0gZGVzdGluYXRpb25EYXRhLnRhbGtUaXRsZTtcbiAgICAgICAgLy8gVE9ETzogcG9zc2libGUgdGhhdCByZXQuY3VycmVudFRhbGtJZCBpcyB1bmRlZmluZWQsIGJ1dCBzdWJqZWN0IHBhZ2UgaGFzIHRhbGsgc3VicGFnZXNcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEdpdmVuIHR3byB0YWxrIHBhZ2UgdGl0bGVzIChtYXkgYmUgdW5kZWZpbmVkKSwgcmV0cmlldmVzIHRoZWlyIHBhZ2VzIGZvciBjb21wYXJpc29uXG4gKiBBc3N1bWVzIHRoYXQgdGFsayBwYWdlcyBhbHdheXMgaGF2ZSBzdWJwYWdlcyBlbmFibGVkLlxuICogQXNzdW1lcyB0aGF0IHBhZ2VzIGFyZSBub3QgaWRlbnRpY2FsIChzdWJqZWN0IHBhZ2VzIHdlcmUgYWxyZWFkeSB2ZXJpZmllZClcbiAqIEFzc3VtZXMgbmFtZXNwYWNlcyBhcmUgb2theSAoc3ViamVjdCBwYWdlcyBhbHJlYWR5IGNoZWNrZWQpXG4gKiAoQ3VycmVudGx5KSBhc3N1bWVzIHRoYXQgdGhlIG1hbGljaW91cyBjYXNlIG9mIHN1YmplY3QgcGFnZXNcbiAqICAgbm90IGRldGVjdGVkIGFzIHN1YnBhZ2VzIGFuZCB0aGUgdGFsayBwYWdlcyBBUkUgc3VicGFnZXNcbiAqICAgKGkuZS4gQSBhbmQgQS9CIHZzLiBUYWxrOkEgYW5kIFRhbGs6QS9CKSBkb2VzIG5vdCBoYXBwZW4gLyBkb2VzIG5vdCBoYW5kbGVcbiAqIFJldHVybnMgc3RydWN0dXJlIGluZGljYXRpbmcgd2hldGhlciBtb3ZlIHRhbGsgc2hvdWxkIGJlIGFsbG93ZWRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gdGFsa1ZhbGlkYXRlKGNoZWNrVGFsaywgZmlyc3RUYWxrLCBzZWNvbmRUYWxrKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgcmVzdWx0LmFsbG93TW92ZVRhbGsgPSB0cnVlO1xuICAgIGlmICghY2hlY2tUYWxrKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmIChmaXJzdFRhbGsgPT09IHVuZGVmaW5lZCB8fCBzZWNvbmRUYWxrID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbXcubm90aWZ5KCdVbmFibGUgdG8gdmFsaWRhdGUgdGFsay4gRGlzYWxsb3dpbmcgbW92ZXRhbGsgdG8gYmUgc2FmZScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcbiAgICAgICAgcmVzdWx0LmFsbG93TW92ZVRhbGsgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgcmVzdWx0LmN1cnJURE5FID0gdHJ1ZTtcbiAgICByZXN1bHQuZGVzdFRETkUgPSB0cnVlO1xuICAgIHJlc3VsdC5jdXJyZW50VGFsa0NhbkNyZWF0ZSA9IHRydWU7XG4gICAgcmVzdWx0LmRlc3RpbmF0aW9uVGFsa0NhbkNyZWF0ZSA9IHRydWU7XG4gICAgY29uc3QgdGFsa1RpdGxlQXJyID0gW2ZpcnN0VGFsaywgc2Vjb25kVGFsa107XG4gICAgaWYgKHRhbGtUaXRsZUFyci5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHRhbGtEYXRhID0gKFxuICAgICAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiAncXVlcnknLFxuICAgICAgICAgICAgICAgIHByb3A6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICBpbnRlc3RhY3Rpb25zOiAnbW92ZXxjcmVhdGUnLFxuICAgICAgICAgICAgICAgIHRpdGxlczogdGFsa1RpdGxlQXJyLmpvaW4oJ3wnKSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICkucXVlcnkucGFnZXM7XG5cbiAgICAgICAgZm9yIChjb25zdCBbLCBwYWdlRGF0YV0gb2YgT2JqZWN0LmVudHJpZXModGFsa0RhdGEpKVxuICAgICAgICAgICAgaWYgKHBhZ2VEYXRhLnRpdGxlID09PSBmaXJzdFRhbGspIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuY3VyclRETkUgPSBwYWdlRGF0YS5pbnZhbGlkID09PSAnJyB8fCBwYWdlRGF0YS5taXNzaW5nID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuY3VycmVudFRhbGtUaXRsZSA9IHBhZ2VEYXRhLnRpdGxlO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5jdXJyZW50VGFsa0Nhbk1vdmUgPSBwYWdlRGF0YS5hY3Rpb25zLm1vdmUgPT09ICcnO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5jdXJyZW50VGFsa0NhbkNyZWF0ZSA9IHBhZ2VEYXRhLmFjdGlvbnMuY3JlYXRlID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuY3VycmVudFRhbGtJc1JlZGlyZWN0ID0gcGFnZURhdGEucmVkaXJlY3QgPT09ICcnO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwYWdlRGF0YS50aXRsZSA9PT0gc2Vjb25kVGFsaykge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5kZXN0VERORSA9IHBhZ2VEYXRhLmludmFsaWQgPT09ICcnIHx8IHBhZ2VEYXRhLm1pc3NpbmcgPT09ICcnO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvblRhbGtUaXRsZSA9IHBhZ2VEYXRhLnRpdGxlO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvblRhbGtDYW5Nb3ZlID0gcGFnZURhdGEuYWN0aW9ucy5tb3ZlID09PSAnJztcbiAgICAgICAgICAgICAgICByZXN1bHQuZGVzdGluYXRpb25UYWxrQ2FuQ3JlYXRlID0gcGFnZURhdGEuYWN0aW9ucy5jcmVhdGUgPT09ICcnO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5kZXN0aW5hdGlvblRhbGtJc1JlZGlyZWN0ID0gcGFnZURhdGEucmVkaXJlY3QgPT09ICcnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtdy5ub3RpZnkoJ0ZvdW5kIHBhZ2VpZCBub3QgbWF0Y2hpbmcgZ2l2ZW4gaWRzLicsIHsgdHlwZTogJ2Vycm9yJyB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVzdWx0LmFsbG93TW92ZVRhbGsgPSByZXN1bHQuY3VycmVudFRhbGtDYW5DcmVhdGUgJiYgcmVzdWx0LmN1cnJlbnRUYWxrQ2FuTW92ZSAmJiByZXN1bHQuZGVzdGluYXRpb25UYWxrQ2FuQ3JlYXRlICYmIHJlc3VsdC5kZXN0aW5hdGlvblRhbGtDYW5Nb3ZlO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogR2l2ZW4gZXhpc3RpbmcgdGl0bGUgKG5vdCBwcmVmaXhlZCB3aXRoIFwiL1wiKSwgb3B0aW9uYWxseSBzZWFyY2hpbmcgZm9yIHRhbGssXG4gKiAgIGZpbmRzIHN1YnBhZ2VzIChpbmNsLiB0aG9zZSB0aGF0IGFyZSByZWRpcnMpIGFuZCB3aGV0aGVyIGxpbWl0cyBhcmUgZXhjZWVkZWRcbiAqIEFzIG9mIDIwMTYtMDgsIHVzZXMgMiBhcGkgZ2V0IGNhbGxzIHRvIGdldCBuZWVkZWQgZGV0YWlsczpcbiAqICAgd2hldGhlciB0aGUgcGFnZSBjYW4gYmUgbW92ZWQsIHdoZXRoZXIgdGhlIHBhZ2UgaXMgYSByZWRpcmVjdFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRTdWJwYWdlcyhuYW1lc3BhY2VEYXRhLCB0aXRsZSwgdGl0bGVOYW1lc3BhY2UsIGlzVGFsaykge1xuICAgIGlmICghaXNUYWxrICYmIG5hbWVzcGFjZURhdGFbdGl0bGVOYW1lc3BhY2UudG9TdHJpbmcoKV0uc3VicGFnZXMgIT09ICcnKSByZXR1cm4geyBkYXRhOiBbXSB9O1xuXG4gICAgY29uc3QgdGl0bGVQYWdlRGF0YSA9IGdldFRhbGtQYWdlTmFtZShuYW1lc3BhY2VEYXRhLCB0aXRsZSwgdGl0bGVOYW1lc3BhY2UpO1xuICAgIGNvbnN0IHN1YnBhZ2VzID0gKFxuICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHtcbiAgICAgICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgIGxpc3Q6ICdhbGxwYWdlcycsXG4gICAgICAgICAgICBhcG5hbWVzcGFjZTogaXNUYWxrID8gdGl0bGVOYW1lc3BhY2UgKyAxIDogdGl0bGVOYW1lc3BhY2UsXG4gICAgICAgICAgICBhcGZyb206IHRpdGxlUGFnZURhdGEudGl0bGVXaXRob3V0UHJlZml4ICsgJy8nLFxuICAgICAgICAgICAgYXB0bzogdGl0bGVQYWdlRGF0YS50aXRsZVdpdGhvdXRQcmVmaXggKyAnMCcsXG4gICAgICAgICAgICBhcGxpbWl0OiAxMDEsXG4gICAgICAgIH0pXG4gICAgKS5xdWVyeS5hbGxwYWdlcztcblxuICAgIC8vIFR3byBxdWVyaWVzIGFyZSBuZWVkZWQgZHVlIHRvIEFQSSBsaW1pdHNcbiAgICBjb25zdCBzdWJwYWdlSWRzID0gW1tdLCBbXV07XG4gICAgZm9yIChjb25zdCBpZCBpbiBzdWJwYWdlcykgc3VicGFnZUlkc1tpZCA8IDUwID8gMCA6IDFdLnB1c2goc3VicGFnZXNbaWRdLnBhZ2VpZCk7XG5cbiAgICBpZiAoc3VicGFnZUlkc1swXS5sZW5ndGggPT09IDApIHJldHVybiB7IGRhdGE6IFtdIH07XG5cbiAgICBpZiAoc3VicGFnZUlkc1sxXS5sZW5ndGggPT09IDUxKSByZXR1cm4geyBlcnJvcjogJzEwMCsgc3VicGFnZXMsIHRvbyBtYW55IHRvIG1vdmUuJyB9O1xuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgY29uc3Qgc3VicGFnZURhdGFPbmUgPSAoXG4gICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKS5nZXQoe1xuICAgICAgICAgICAgYWN0aW9uOiAncXVlcnknLFxuICAgICAgICAgICAgcHJvcDogJ2luZm8nLFxuICAgICAgICAgICAgaW50ZXN0YWN0aW9uczogJ21vdmV8Y3JlYXRlJyxcbiAgICAgICAgICAgIHBhZ2VpZHM6IHN1YnBhZ2VJZHNbMF0uam9pbignfCcpLFxuICAgICAgICB9KVxuICAgICkucXVlcnkucGFnZXM7XG4gICAgZm9yIChjb25zdCBbLCBwYWdlRGF0YV0gb2YgT2JqZWN0LmVudHJpZXMoc3VicGFnZURhdGFPbmUpKVxuICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICB0aXRsZTogcGFnZURhdGEudGl0bGUsXG4gICAgICAgICAgICBpc1JlZGlyOiBwYWdlRGF0YS5yZWRpcmVjdCA9PT0gJycsXG4gICAgICAgICAgICBjYW5Nb3ZlOiBwYWdlRGF0YS5hY3Rpb25zPy5tb3ZlID09PSAnJyxcbiAgICAgICAgfSk7XG5cbiAgICBpZiAoc3VicGFnZUlkc1sxXS5sZW5ndGggPT09IDApIHJldHVybiB7IGRhdGE6IHJlc3VsdCB9O1xuXG4gICAgY29uc3Qgc3VicGFnZURhdGFUd28gPSAoXG4gICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKS5nZXQoe1xuICAgICAgICAgICAgYWN0aW9uOiAncXVlcnknLFxuICAgICAgICAgICAgcHJvcDogJ2luZm8nLFxuICAgICAgICAgICAgaW50ZXN0YWN0aW9uczogJ21vdmV8Y3JlYXRlJyxcbiAgICAgICAgICAgIHBhZ2VpZHM6IHN1YnBhZ2VJZHNbMV0uam9pbignfCcpLFxuICAgICAgICB9KVxuICAgICkucXVlcnkucGFnZXM7XG4gICAgZm9yIChjb25zdCBbLCBwYWdlRGF0YV0gb2YgT2JqZWN0LmVudHJpZXMoc3VicGFnZURhdGFUd28pKVxuICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICB0aXRsZTogcGFnZURhdGEudGl0bGUsXG4gICAgICAgICAgICBpc1JlZGlyZWN0OiBwYWdlRGF0YS5yZWRpcmVjdCA9PT0gJycsXG4gICAgICAgICAgICBjYW5Nb3ZlOiBwYWdlRGF0YS5hY3Rpb25zPy5tb3ZlID09PSAnJyxcbiAgICAgICAgfSk7XG5cbiAgICByZXR1cm4geyBkYXRhOiByZXN1bHQgfTtcbn1cblxuLyoqXG4gKiBQcmludHMgc3VicGFnZSBkYXRhIGdpdmVuIHJldHJpZXZlZCBzdWJwYWdlIGluZm9ybWF0aW9uIHJldHVybmVkIGJ5IGdldFN1YnBhZ2VzXG4gKiBSZXR1cm5zIGEgc3VnZ2VzdGlvbiB3aGV0aGVyIG1vdmVzdWJwYWdlcyBzaG91bGQgYmUgYWxsb3dlZFxuICovXG5mdW5jdGlvbiBwcmludFN1YnBhZ2VJbmZvKGJhc2VQYWdlLCBjdXJyZW50U3VicGFnZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIGNvbnN0IGN1cnJlbnRTdWJwYWdlcyA9IFtdO1xuICAgIGNvbnN0IHN1YnBhZ2VzQ2Fubm90TW92ZSA9IFtdO1xuICAgIGxldCByZWRpcmVjdENvdW50ID0gMDtcbiAgICBmb3IgKGNvbnN0IFssIHBhZ2VEYXRhXSBvZiBPYmplY3QuZW50cmllcyhjdXJyZW50U3VicGFnZS5kYXRhKSkge1xuICAgICAgICBpZiAoIXBhZ2VEYXRhLmNhbk1vdmUpIHN1YnBhZ2VzQ2Fubm90TW92ZS5wdXNoKHBhZ2VEYXRhLnRpdGxlKTtcblxuICAgICAgICBjdXJyZW50U3VicGFnZXMucHVzaCgocGFnZURhdGEuaXNSZWRpcmVjdCA/ICcoUikgJyA6ICcgICcpICsgcGFnZURhdGEudGl0bGUpO1xuICAgICAgICBpZiAocGFnZURhdGEuaXNSZWRpcmVjdCkgcmVkaXJlY3RDb3VudCsrO1xuICAgIH1cblxuICAgIGlmIChjdXJyZW50U3VicGFnZXMubGVuZ3RoID4gMClcbiAgICAgICAgbXcubm90aWZ5KFxuICAgICAgICAgICAgc3VicGFnZXNDYW5ub3RNb3ZlLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICA/IGBEaXNhYmxpbmcgbW92ZS1zdWJwYWdlcy5cXG5UaGUgZm9sbG93aW5nICR7c3VicGFnZXNDYW5ub3RNb3ZlLmxlbmd0aH0gKG9mICR7Y3VycmVudFN1YnBhZ2VzLmxlbmd0aH0pIHRvdGFsIHN1YnBhZ2VzIG9mICR7YmFzZVBhZ2V9IENBTk5PVCBiZSBtb3ZlZDpcXG5cXG4ke3N1YnBhZ2VzQ2Fubm90TW92ZS5qb2luKFxuICAgICAgICAgICAgICAgICAgICAgICcsICcsXG4gICAgICAgICAgICAgICAgICApfWBcbiAgICAgICAgICAgICAgICA6IGAke2N1cnJlbnRTdWJwYWdlcy5sZW5ndGh9IHRvdGFsIHN1YnBhZ2VzIG9mICR7YmFzZVBhZ2V9LiR7cmVkaXJlY3RDb3VudCAhPT0gMCA/IGAgJHtyZWRpcmVjdENvdW50fSByZWRpcmVjdHMsIGxhYmVsZWQgKFIpYCA6ICcnfTogJHtjdXJyZW50U3VicGFnZXMuam9pbignLCAnKX1gLFxuICAgICAgICApO1xuXG4gICAgcmVzdWx0LmFsbG93TW92ZVN1YnBhZ2VzID0gc3VicGFnZXNDYW5ub3RNb3ZlLmxlbmd0aCA9PT0gMDtcbiAgICByZXN1bHQubm9OZWVkID0gY3VycmVudFN1YnBhZ2VzLmxlbmd0aCA9PT0gMDtcbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFN3YXBzIHRoZSB0d28gcGFnZXMgKGdpdmVuIGFsbCBwcmVyZXF1aXNpdGUgY2hlY2tzKVxuICogT3B0aW9uYWxseSBtb3ZlcyB0YWxrIHBhZ2VzIGFuZCBzdWJwYWdlc1xuICovXG5mdW5jdGlvbiBzd2FwUGFnZXModGl0bGVPbmUsIHRpdGxlVHdvLCBzdW1tYXJ5LCBtb3ZlVGFsaywgbW92ZVN1YnBhZ2VzKSB7XG4gICAgY29uc3QgaW50ZXJtZWRpYXRlVGl0bGUgPSBgRHJhZnQ6TW92ZS8ke3RpdGxlT25lfWA7XG5cbiAgICBjb25zdCBtb3ZlcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgYWN0aW9uOiAnbW92ZScsXG4gICAgICAgICAgICBmcm9tOiB0aXRsZVR3byxcbiAgICAgICAgICAgIHRvOiBpbnRlcm1lZGlhdGVUaXRsZSxcbiAgICAgICAgICAgIHJlYXNvbjogJ1tbV1A6Uk9VTkRST0JJTnxSb3VuZC1yb2JpbiBwYWdlIG1vdmVdXSBzdGVwIDEgKHdpdGggW1tVc2VyOkVlaml0NDMvc2NyaXB0cy9wYWdlc3dhcHxwYWdlc3dhcCAyXV0pJyxcbiAgICAgICAgICAgIHdhdGNobGlzdDogJ3Vud2F0Y2gnLFxuICAgICAgICAgICAgbm9yZWRpcmVjdDogMSxcbiAgICAgICAgfSxcbiAgICAgICAgeyBhY3Rpb246ICdtb3ZlJywgZnJvbTogdGl0bGVPbmUsIHRvOiB0aXRsZVR3bywgcmVhc29uOiBzdW1tYXJ5LCB3YXRjaGxpc3Q6ICd1bndhdGNoJywgbm9yZWRpcmVjdDogMSB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBhY3Rpb246ICdtb3ZlJyxcbiAgICAgICAgICAgIGZyb206IGludGVybWVkaWF0ZVRpdGxlLFxuICAgICAgICAgICAgdG86IHRpdGxlT25lLFxuICAgICAgICAgICAgcmVhc29uOiAnW1tXUDpST1VORFJPQklOfFJvdW5kLXJvYmluIHBhZ2UgbW92ZV1dIHN0ZXAgMyAod2l0aCBbW1VzZXI6RWVqaXQ0My9zY3JpcHRzL3BhZ2Vzd2FwfHBhZ2Vzd2FwIDJdXSknLFxuICAgICAgICAgICAgd2F0Y2hsaXN0OiAndW53YXRjaCcsXG4gICAgICAgICAgICBub3JlZGlyZWN0OiAxLFxuICAgICAgICB9LFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IG1vdmUgb2YgbW92ZXMpIHtcbiAgICAgICAgaWYgKG1vdmVUYWxrKSBtb3ZlLm1vdmV0YWxrID0gMTtcbiAgICAgICAgaWYgKG1vdmVTdWJwYWdlcykgbW92ZS5tb3Zlc3VicGFnZXMgPSAxO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICBsZXQgaSA9IDA7XG5cbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGpzZG9jL3JlcXVpcmUtanNkb2NcbiAgICAgICAgZnVuY3Rpb24gZG9Nb3ZlKCkge1xuICAgICAgICAgICAgaWYgKGkgPj0gbW92ZXMubGVuZ3RoKSByZXR1cm4gcmVzb2x2ZShyZXN1bHQpO1xuXG4gICAgICAgICAgICBuZXcgbXcuQXBpKClcbiAgICAgICAgICAgICAgICAucG9zdFdpdGhUb2tlbignY3NyZicsIG1vdmVzW2ldKVxuICAgICAgICAgICAgICAgIC5kb25lKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICAgICAgICBkb01vdmUoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5mYWlsKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN1Y2Nlc3MgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0Lm1lc3NhZ2UgPSBgRmFpbGVkIG9uIG1vdmUgJHtpICsgMX0gKCR7bW92ZXNbaV0uZnJvbX0gXHUyMTkyICR7bW92ZXNbaV0udG99KWA7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZG9Nb3ZlKCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBHaXZlbiB0d28gdGl0bGVzLCBub3JtYWxpemVzLCBkb2VzIHByZXJlcXVpc2l0ZSBjaGVja3MgZm9yIHRhbGsvc3VicGFnZXMsXG4gKiBwcm9tcHRzIHVzZXIgZm9yIGNvbmZpZyBiZWZvcmUgc3dhcHBpbmcgdGhlIHRpdGxlc1xuICovXG5hc3luYyBmdW5jdGlvbiByb3VuZFJvYmluKHVzZXJQZXJtaXNzaW9ucywgY3VycmVudFRpdGxlLCBkZXN0aW5hdGlvblRpdGxlLCBzdW1tYXJ5LCBtb3ZlVGFsaywgbW92ZVN1YnBhZ2VzKSB7XG4gICAgLy8gR2VuZXJhbCBpbmZvcm1hdGlvbiBhYm91dCBhbGwgbmFtZXNwYWNlc1xuICAgIGNvbnN0IG5hbWVzcGFjZXNJbmZvcm1hdGlvbiA9IChcbiAgICAgICAgYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7XG4gICAgICAgICAgICBhY3Rpb246ICdxdWVyeScsXG4gICAgICAgICAgICBtZXRhOiAnc2l0ZWluZm8nLFxuICAgICAgICAgICAgc2lwcm9wOiAnbmFtZXNwYWNlcycsXG4gICAgICAgIH0pXG4gICAgKS5xdWVyeS5uYW1lc3BhY2VzO1xuXG4gICAgLy8gU3BlY2lmaWMgaW5mb3JtYXRpb24gYWJvdXQgY3VycmVudCBhbmQgZGVzdGluYXRpb24gcGFnZXNcbiAgICBjb25zdCBwYWdlc0RhdGEgPSAoXG4gICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKS5nZXQoe1xuICAgICAgICAgICAgYWN0aW9uOiAncXVlcnknLFxuICAgICAgICAgICAgcHJvcDogJ2luZm8nLFxuICAgICAgICAgICAgaW5wcm9wOiAndGFsa2lkJyxcbiAgICAgICAgICAgIGludGVzdGFjdGlvbnM6ICdtb3ZlfGNyZWF0ZScsXG4gICAgICAgICAgICB0aXRsZXM6IGAke2N1cnJlbnRUaXRsZX18JHtkZXN0aW5hdGlvblRpdGxlfWAsXG4gICAgICAgIH0pXG4gICAgKS5xdWVyeTtcblxuICAgIC8vIE5vcm1hbGl6ZSB0aXRsZXMgaWYgbmVjZXNzYXJ5XG4gICAgZm9yIChjb25zdCBjaGFuZ2VzIGluIHBhZ2VzRGF0YS5ub3JtYWxpemVkKSB7XG4gICAgICAgIGlmIChjdXJyZW50VGl0bGUgPT09IHBhZ2VzRGF0YS5ub3JtYWxpemVkW2NoYW5nZXNdLmZyb20pIGN1cnJlbnRUaXRsZSA9IHBhZ2VzRGF0YS5ub3JtYWxpemVkW2NoYW5nZXNdLnRvO1xuICAgICAgICBpZiAoZGVzdGluYXRpb25UaXRsZSA9PT0gcGFnZXNEYXRhLm5vcm1hbGl6ZWRbY2hhbmdlc10uZnJvbSkgZGVzdGluYXRpb25UaXRsZSA9IHBhZ2VzRGF0YS5ub3JtYWxpemVkW2NoYW5nZXNdLnRvO1xuICAgIH1cblxuICAgIC8vIFZhbGlkYXRlIG5hbWVzcGFjZXNcbiAgICBjb25zdCB2YWxpZGF0aW9uRGF0YSA9IHN3YXBWYWxpZGF0ZShjdXJyZW50VGl0bGUsIGRlc3RpbmF0aW9uVGl0bGUsIHBhZ2VzRGF0YS5wYWdlcywgbmFtZXNwYWNlc0luZm9ybWF0aW9uLCB1c2VyUGVybWlzc2lvbnMpO1xuICAgIGlmICghdmFsaWRhdGlvbkRhdGEudmFsaWQpIHRocm93IG5ldyBFcnJvcih2YWxpZGF0aW9uRGF0YS5lcnJvcik7XG5cbiAgICBpZiAodmFsaWRhdGlvbkRhdGEuYWRkTGluZUluZm8gIT09IHVuZGVmaW5lZCkgbXcubm90aWZ5KHZhbGlkYXRpb25EYXRhLmFkZExpbmVJbmZvKTtcblxuICAgIC8vIFN1YnBhZ2UgY2hlY2tzXG4gICAgY29uc3QgY3VycmVudFN1YnBhZ2VzID0gYXdhaXQgZ2V0U3VicGFnZXMobmFtZXNwYWNlc0luZm9ybWF0aW9uLCB2YWxpZGF0aW9uRGF0YS5jdXJyZW50VGl0bGUsIHZhbGlkYXRpb25EYXRhLmN1cnJlbnROYW1lc3BhY2UsIGZhbHNlKTtcbiAgICBpZiAoY3VycmVudFN1YnBhZ2VzLmVycm9yICE9PSB1bmRlZmluZWQpIHRocm93IG5ldyBFcnJvcihjdXJyZW50U3VicGFnZXMuZXJyb3IpO1xuICAgIGNvbnN0IGN1cnJlbnRTdWJwYWdlRmxhZ3MgPSBwcmludFN1YnBhZ2VJbmZvKHZhbGlkYXRpb25EYXRhLmN1cnJlbnRUaXRsZSwgY3VycmVudFN1YnBhZ2VzKTtcbiAgICBjb25zdCBkZXN0aW5hdGlvblN1YnBhZ2VzID0gYXdhaXQgZ2V0U3VicGFnZXMobmFtZXNwYWNlc0luZm9ybWF0aW9uLCB2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvblRpdGxlLCB2YWxpZGF0aW9uRGF0YS5kZXN0aW5hdGlvbk5hbWVzcGFjZSwgZmFsc2UpO1xuICAgIGlmIChkZXN0aW5hdGlvblN1YnBhZ2VzLmVycm9yICE9PSB1bmRlZmluZWQpIHRocm93IG5ldyBFcnJvcihkZXN0aW5hdGlvblN1YnBhZ2VzLmVycm9yKTtcbiAgICBjb25zdCBkZXN0aW5hdGlvblN1YnBhZ2VGbGFncyA9IHByaW50U3VicGFnZUluZm8odmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25UaXRsZSwgZGVzdGluYXRpb25TdWJwYWdlcyk7XG5cbiAgICBjb25zdCB0YWxrVmFsaWRhdGlvbkRhdGEgPSBhd2FpdCB0YWxrVmFsaWRhdGUodmFsaWRhdGlvbkRhdGEuY2hlY2tUYWxrLCB2YWxpZGF0aW9uRGF0YS5jdXJyZW50VGFsa05hbWUsIHZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uVGFsa05hbWUpO1xuXG4gICAgLy8gVE9ETzogY2hlY2sgZW1wdHkgc3VicGFnZSBkZXN0aW5hdGlvbnMgb24gYm90aCBzaWRlcyAoc3ViaiwgdGFsaykgZm9yIGNyZWF0ZSBwcm90ZWN0aW9uXG4gICAgY29uc3QgY3VycmVudFRhbGtTdWJwYWdlcyA9IGF3YWl0IGdldFN1YnBhZ2VzKG5hbWVzcGFjZXNJbmZvcm1hdGlvbiwgdmFsaWRhdGlvbkRhdGEuY3VycmVudFRpdGxlLCB2YWxpZGF0aW9uRGF0YS5jdXJyZW50TmFtZXNwYWNlLCB0cnVlKTtcbiAgICBpZiAoY3VycmVudFRhbGtTdWJwYWdlcy5lcnJvciAhPT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoY3VycmVudFRhbGtTdWJwYWdlcy5lcnJvcik7XG4gICAgY29uc3QgY3VycmVudFRhbGtTdWJwYWdlRmxhZ3MgPSBwcmludFN1YnBhZ2VJbmZvKHZhbGlkYXRpb25EYXRhLmN1cnJlbnRUYWxrTmFtZSwgY3VycmVudFRhbGtTdWJwYWdlcyk7XG4gICAgY29uc3QgZGVzdGluYXRpb25UYWxrU3VicGFnZXMgPSBhd2FpdCBnZXRTdWJwYWdlcyhuYW1lc3BhY2VzSW5mb3JtYXRpb24sIHZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uVGl0bGUsIHZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uTmFtZXNwYWNlLCB0cnVlKTtcbiAgICBpZiAoZGVzdGluYXRpb25UYWxrU3VicGFnZXMuZXJyb3IgIT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEVycm9yKGRlc3RpbmF0aW9uVGFsa1N1YnBhZ2VzLmVycm9yKTtcbiAgICBjb25zdCBkZXN0aW5hdGlvblRhbGtTdWJwYWdlRmxhZ3MgPSBwcmludFN1YnBhZ2VJbmZvKHZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uVGFsa05hbWUsIGRlc3RpbmF0aW9uVGFsa1N1YnBhZ2VzKTtcblxuICAgIGNvbnN0IG5vU3VicGFnZXMgPSBjdXJyZW50U3VicGFnZUZsYWdzLm5vTmVlZCAmJiBkZXN0aW5hdGlvblN1YnBhZ2VGbGFncy5ub05lZWQgJiYgY3VycmVudFRhbGtTdWJwYWdlRmxhZ3Mubm9OZWVkICYmIGRlc3RpbmF0aW9uVGFsa1N1YnBhZ2VGbGFncy5ub05lZWQ7XG4gICAgLy8gSWYgb25lIG5hbWVzcGFjZSBkaXNhYmxlcyBzdWJwYWdlcywgb3RoZXIgZW5hYmxlcyBzdWJwYWdlcyAoYW5kIGhhcyBzdWJwYWdlcyksIGNvbnNpZGVyIGFib3J0LiBBc3N1bWUgdGFsayBwYWdlcyBhbHdheXMgc2FmZSAoVE9ETyBmaXgpXG4gICAgY29uc3Qgc3VicGFnZUNvbGxpc2lvbiA9ICh2YWxpZGF0aW9uRGF0YS5jdXJyZW50TmFtZXNwYWNlQWxsb3dTdWJwYWdlcyAmJiAhZGVzdGluYXRpb25TdWJwYWdlRmxhZ3Mubm9OZWVkKSB8fCAodmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25OYW1lc3BhY2VBbGxvd1N1YnBhZ2VzICYmICFjdXJyZW50U3VicGFnZUZsYWdzLm5vTmVlZCk7XG5cbiAgICBpZiAobW92ZVRhbGsgJiYgdmFsaWRhdGlvbkRhdGEuY2hlY2tUYWxrICYmICF0YWxrVmFsaWRhdGlvbkRhdGEuYWxsb3dNb3ZlVGFsaykge1xuICAgICAgICBtb3ZlVGFsayA9IGZhbHNlO1xuICAgICAgICBtdy5ub3RpZnkoXG4gICAgICAgICAgICBgRGlzYWxsb3dpbmcgbW92aW5nIHRhbGsuICR7XG4gICAgICAgICAgICAgICAgIXRhbGtWYWxpZGF0aW9uRGF0YS5jdXJyZW50VGFsa0NhbkNyZWF0ZVxuICAgICAgICAgICAgICAgICAgICA/IGAke3ZhbGlkYXRpb25EYXRhLmN1cnJlbnRUYWxrTmFtZX0gaXMgY3JlYXRlLXByb3RlY3RlZGBcbiAgICAgICAgICAgICAgICAgICAgOiAhdGFsa1ZhbGlkYXRpb25EYXRhLmRlc3RpbmF0aW9uVGFsa0NhbkNyZWF0ZVxuICAgICAgICAgICAgICAgICAgICAgID8gYCR7dmFsaWRhdGlvbkRhdGEuZGVzdGluYXRpb25UYWxrTmFtZX0gaXMgY3JlYXRlLXByb3RlY3RlZGBcbiAgICAgICAgICAgICAgICAgICAgICA6ICdUYWxrIHBhZ2UgaXMgaW1tb3ZhYmxlJ1xuICAgICAgICAgICAgfWAsXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgbGV0IGZpbmFsTW92ZVN1YnBhZ2VzID0gZmFsc2U7XG4gICAgLy8gVE9ETyBmdXR1cmU6IGN1cnJUU3BGbGFncy5hbGxvd01vdmVTdWJwYWdlcyAmJiBkZXN0VFNwRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgbmVlZHMgdG8gYmUgc2VwYXJhdGUgY2hlY2suIElmIHRhbGsgc3VicGFnZXMgaW1tb3ZhYmxlLCBzaG91bGQgbm90IGFmZmVjdCBzdWJqc3BhY2VcbiAgICBpZiAoXG4gICAgICAgICFzdWJwYWdlQ29sbGlzaW9uICYmXG4gICAgICAgICFub1N1YnBhZ2VzICYmXG4gICAgICAgIHZhbGlkYXRpb25EYXRhLmFsbG93TW92ZVN1YnBhZ2VzICYmXG4gICAgICAgIGN1cnJlbnRTdWJwYWdlRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgJiZcbiAgICAgICAgZGVzdGluYXRpb25TdWJwYWdlRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgJiZcbiAgICAgICAgY3VycmVudFRhbGtTdWJwYWdlRmxhZ3MuYWxsb3dNb3ZlU3VicGFnZXMgJiZcbiAgICAgICAgZGVzdGluYXRpb25UYWxrU3VicGFnZUZsYWdzLmFsbG93TW92ZVN1YnBhZ2VzXG4gICAgKVxuICAgICAgICBmaW5hbE1vdmVTdWJwYWdlcyA9IG1vdmVTdWJwYWdlcztcbiAgICBlbHNlIGlmIChzdWJwYWdlQ29sbGlzaW9uKSB7XG4gICAgICAgIGZpbmFsTW92ZVN1YnBhZ2VzID0gZmFsc2U7XG4gICAgICAgIG13Lm5vdGlmeSgnT25lIG5hbWVzcGFjZSBkb2VzIG5vdCBoYXZlIHN1YnBhZ2VzIGVuYWJsZWQuIERpc2FsbG93aW5nIG1vdmUgc3VicGFnZXMuJyk7XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFtQYWdlc3dhcF0gU3dhcHBpbmcgXCIke2N1cnJlbnRUaXRsZX1cIiB3aXRoIFwiJHtkZXN0aW5hdGlvblRpdGxlfVwiIHdpdGggc3VtbWFyeSBcIiR7c3VtbWFyeX1cIiBhbmQgbW92ZVRhbGsgJHttb3ZlVGFsa30gYW5kIG1vdmVTdWJwYWdlcyAke2ZpbmFsTW92ZVN1YnBhZ2VzfWApO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc3dhcFBhZ2VzKGN1cnJlbnRUaXRsZSwgZGVzdGluYXRpb25UaXRsZSwgc3VtbWFyeSwgbW92ZVRhbGssIGZpbmFsTW92ZVN1YnBhZ2VzKTtcblxuICAgIGNvbnNvbGUubG9nKHJlc3VsdCk7XG5cbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB0aHJvdyBuZXcgRXJyb3IocmVzdWx0LmVycm9yKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGtCQUFrQixnQkFBZ0IsbUJBQW1CLG1CQUFtQixtQkFBbUIsR0FBRyxZ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
