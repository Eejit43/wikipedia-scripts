"use strict";
(function() {
  if (mw.config.get("wgPageName") !== "Wikipedia:Articles_for_creation/Redirects_and_categories")
    return;
  const redirectPageName = mw.config.get("wgPageName").replace(/_/g, " ");
  const redirectSubmissions = [];
  let redirectSections = [];
  const summaryAdvert = " ([[User:Eejit43/scripts/AFCRHS|AFCRHS 2]])";
  let numTotal = 0;
  let ajaxNumber = 0;
  const submissions = [];
  const needsUpdate = [];
  const redirectDeclineReasons = {
    exists: "The title you suggested already exists on Wikipedia",
    blank: "We cannot accept empty submissions",
    "no-target": " A redirect cannot be created unless the target is an existing article. Either you have not specified the target, or the target does not exist",
    unlikely: "The title you suggested seems unlikely. Could you provide a source showing that it is a commonly used alternate name?",
    "not-redirect": "This request is not a redirect request",
    custom: ""
  };
  const categoryDeclineReasons = {
    exists: "The category you suggested already exists on Wikipedia",
    blank: "We cannot accept empty submissions",
    unlikely: "It seems unlikely that there are enough pages to support this category",
    "not-category": "This request is not a category request",
    custom: ""
  };
  async function redirectInit() {
    let pageText = await getPageText(redirectPageName);
    pageText = cleanupLinks(pageText);
    const sectionRegex = /==.*?==/;
    pageText = pageText.substring(pageText.search(sectionRegex));
    redirectSections = pageText.match(/^==.*?==$((\r?\n?)(?!==[^=]).*)*/gim);
    for (let i = 0; i < redirectSections.length; i++) {
      const closed = /(\{\{\s*afc(?!\s+comment)|This is an archived discussion)/i.test(redirectSections[i]);
      if (!closed) {
        const header = redirectSections[i].match(sectionRegex)[0];
        if (header.search(/Redirect request/i) !== -1) {
          const wikilinkRegex = /\[\[(\s*[^=]*?)*?\]\]/g;
          const links = header.match(wikilinkRegex);
          if (!links)
            continue;
          for (let l = 0; l < links.length; l++) {
            links[l] = links[l].replace(/[[\]]/g, "");
            if (links[l].charAt(0) === ":")
              links[l] = links[l].substring(1);
          }
          const regex = /Target of redirect:\s*\[\[([^[\]]*)\]\]/i;
          regex.test(redirectSections[i]);
          const to = $.trim(RegExp.$1);
          const reasonRe = /Reason:[ \t]*?(.+)/i;
          const reasonMatch = reasonRe.exec(redirectSections[i]);
          const reason = reasonMatch && reasonMatch[1].trim() ? reasonMatch[1] : null;
          const sourceRe = /Source.*?:[ \t]*?(.+)/i;
          const sourceMatch = sourceRe.exec(redirectSections[i]);
          const source = sourceMatch && sourceMatch[1].trim() ? sourceMatch[1] : null;
          const submission = {
            type: "redirect",
            from: [],
            section: i,
            to,
            title: to,
            reason,
            source
          };
          for (let j = 0; j < links.length; j++) {
            const sub = {
              type: "redirect",
              to,
              id: numTotal,
              title: links[j],
              action: ""
            };
            submission.from.push(sub);
            submissions.push(sub);
            numTotal++;
          }
          redirectSubmissions.push(submission);
        } else if (header.search(/Category request/i) !== -1) {
          let categoryName = /\[\[[^[\]]+\]\]/.exec(header);
          if (!categoryName)
            continue;
          categoryName = categoryName[0];
          categoryName = categoryName.replace(/[[\]]/g, "");
          categoryName = categoryName.replace(/Category\s*:\s*/gi, "Category:");
          if (categoryName.charAt(0) === ":")
            categoryName = categoryName.substring(1);
          let requestText = redirectSections[i].substring(header.length);
          const parentHeadingIndex = requestText.indexOf("Parent category/categories");
          if (parentHeadingIndex >= 0) {
            requestText = requestText.substring(parentHeadingIndex);
          }
          const parentCategories = [];
          let parentCategoryMatch = null;
          const parentCategoriesRegex = /\[\[\s*:\s*(Category:[^\][]*)\]\]/gi;
          do {
            parentCategoryMatch = parentCategoriesRegex.exec(requestText);
            if (parentCategoryMatch) {
              parentCategories.push(parentCategoryMatch[1]);
            }
          } while (parentCategoryMatch);
          const submission = {
            type: "category",
            title: categoryName,
            section: i,
            id: numTotal,
            action: "",
            parents: parentCategories.join(",")
          };
          numTotal++;
          redirectSubmissions.push(submission);
          submissions.push(submission);
        }
      }
    }
    const $form = $("<h3>Reviewing AfC redirect requests</h3>");
    displayMessage($form);
    const $messageDiv = $form.parent();
    let redirectEmpty = 1;
    const ACTIONS = [
      { label: "Accept", value: "accept" },
      { label: "Decline", value: "decline" },
      { label: "Comment", value: "comment" },
      { label: "None", selected: true, value: "none" }
    ];
    for (let k = 0; k < redirectSubmissions.length; k++) {
      let submissionName;
      if (redirectSubmissions[k].to !== void 0)
        submissionName = redirectSubmissions[k].to.replace(/\s/g, "");
      else
        submissionName = "";
      const $thisSubList = $("<ul>");
      const $thisSubListElement = $("<li>");
      if (redirectSubmissions[k].type === "redirect") {
        $thisSubListElement.append("Redirect(s) to ");
        if (!submissionName) {
          for (let i = redirectSubmissions[k].from.length - 1; i >= 0; i--) {
            needsUpdate.push({
              id: redirectSubmissions[k].from[i].id,
              reason: "no-target"
            });
          }
        } else if (!redirectSubmissions[k].to) {
          for (let i = redirectSubmissions[k].from.length - 1; i >= 0; i--) {
            needsUpdate.push({
              id: redirectSubmissions[k].from[i].id,
              reason: "not-redirect"
            });
          }
        }
        if (redirectSubmissions[k] === "" || redirectSubmissions[k] === " ") {
          $thisSubListElement.append("Empty submission #" + redirectEmpty);
          redirectEmpty++;
        } else if (submissionName.length > 0) {
          $thisSubListElement.append(
            $("<a>").attr("href", mw.config.get("wgArticlePath").replace("$1", encodeURIComponent(redirectSubmissions[k].to))).attr("target", "_blank").text(redirectSubmissions[k].to)
          );
        } else {
          $thisSubListElement.append("<b>no target given</b>: ");
        }
        const $fromList = $("<ul>").appendTo($thisSubListElement);
        for (let l = 0; l < redirectSubmissions[k].from.length; l++) {
          const from = redirectSubmissions[k].from[l];
          let toArticle = from.title;
          if (toArticle.replace(/\s*/gi, "").length === 0)
            toArticle = "<b>no title specified</b>, check the request details";
          const reasonAndSource = $("<ul>");
          if (redirectSubmissions[k].reason)
            reasonAndSource.append("<li>Reason: " + redirectSubmissions[k].reason + "</li>");
          if (redirectSubmissions[k].source)
            reasonAndSource.append("<li>Source: " + redirectSubmissions[k].source + "</li>");
          const googleSearchUrl = 'http://www.google.com/search?q="' + encodeURIComponent(toArticle) + '"+-wikipedia.org';
          $fromList.append(
            $("<li>").append(
              "From: " + toArticle + " (<small><a href='" + googleSearchUrl + `'" target="_blank">Google</a> <b>&middot;</b> <a href="https://en.wikipedia.org/wiki/Special:WhatLinksHere/` + encodeURIComponent(toArticle) + '" target="_blank">what links here</a>)</small><br/>'
            ).append(reasonAndSource).append(
              $("<label>").attr("for", "afcHelper_redirect_action_" + from.id).text("Action: ")
            ).append(generateSelectObject("afcHelper_redirect_action_" + from.id, ACTIONS, redirectMakeActionChange(from.id))).append($("<div>").attr("id", "afcHelper_redirect_extra_" + from.id))
          );
        }
      } else {
        const subId = redirectSubmissions[k].id;
        $thisSubListElement.append("Category submission: ").append(
          $("<a>").attr("href", "/wiki/" + redirectSubmissions[k].title).attr("title", redirectSubmissions[k].title).text(redirectSubmissions[k].title)
        ).append("<br />").append(
          $("<label>").attr("for", "afcHelper_redirect_action_" + subId).text("Action: ")
        ).append(generateSelectObject("afcHelper_redirect_action_" + subId, ACTIONS, redirectMakeActionChange(subId))).append($("<div>").attr("id", "afcHelper_redirect_extra_" + subId));
      }
      $thisSubList.append($thisSubListElement);
      $messageDiv.append($thisSubList);
    }
    $messageDiv.append($("<button>").attr("id", "afcHelper_redirect_done_button").attr("name", "afcHelper_redirect_done_button").text("Done").click(redirectPerformActions));
    for (let y = 0; y < needsUpdate.length; y++) {
      $("#afcHelper_redirect_action_" + needsUpdate[y].id).attr("value", "decline");
      redirectOnActionChange(needsUpdate[y].id);
      $("#afcHelper_redirect_decline_" + needsUpdate[y].id).attr("value", needsUpdate[y].reason);
    }
  }
  function redirectMakeActionChange(id) {
    return function() {
      redirectOnActionChange(id);
    };
  }
  function redirectOnActionChange(id) {
    const $extra = $("#afcHelper_redirect_extra_" + id);
    const selectValue = $("#afcHelper_redirect_action_" + id).val();
    $extra.html("");
    if (selectValue === "accept") {
      if (submissions[id].type === "redirect") {
        $extra.append('<label for="afcHelper_redirect_from_' + id + '">From: </label>');
        $extra.append(
          $("<input>").attr("type", "text").attr("name", "afcHelper_redirect_from_" + id).attr("id", "afcHelper_redirect_from_" + id).attr("value", submissions[id].title)
        );
        $extra.html(
          $extra.html() + '&nbsp;<br /><label for="afcHelper_redirect_to_' + id + '">To: </label><input type="text" name="afcHelper_redirect_to_' + id + '" id="afcHelper_redirect_to_' + id + '" value="' + submissions[id].to + '" />'
        );
        $extra.html(
          $extra.html() + '<br /><label for="afcHelper_redirect_append_' + id + '">Template to append: (<a href="https://en.wikipedia.org/wiki/Wikipedia:TMR" target="_blank">Help</a>)</label>'
        );
        $extra.html(
          $extra.html() + generateSelect("afcHelper_redirect_append_" + id, [
            { label: "None", selected: true, value: "none" },
            { labelAndValue: "Frequently used", disabled: true },
            { labelAndValue: "R from alternative language" },
            { labelAndValue: "R from alternative name" },
            { labelAndValue: "R from modification" },
            { labelAndValue: "R to section" },
            { labelAndValue: "R from diacritic" },
            { labelAndValue: "R to diacritic" },
            { labelAndValue: "From \u2013 abbreviation, capitalisation, and grammar", disabled: true },
            { labelAndValue: "R from acronym" },
            { labelAndValue: "R from initialism" },
            { labelAndValue: "R from CamelCase" },
            { labelAndValue: "R from miscapitalisation" },
            { labelAndValue: "R from other capitalisation" },
            { labelAndValue: "R from modification" },
            { labelAndValue: "R from plural" },
            { label: "From parts of speach", value: "From parts of speach", disabled: true },
            { labelAndValue: "R from adjective" },
            { labelAndValue: "R from adverb" },
            { labelAndValue: "R from common noun" },
            { labelAndValue: "R from gerund" },
            { labelAndValue: "R from proper noun" },
            { labelAndValue: "R from verb" },
            { labelAndValue: "From \u2013 spelling", disabled: true },
            { labelAndValue: "R from alternative spelling" },
            { labelAndValue: "R from misspelling" },
            { labelAndValue: "R from American English" },
            { labelAndValue: "R from British English" },
            { labelAndValue: "R from ASCII-only" },
            { labelAndValue: "R from diacritic" },
            { labelAndValue: "R from ligature" },
            { labelAndValue: "R from stylization" },
            { labelAndValue: "R from alternative transliteration" },
            { labelAndValue: "R from Wade\u2013Giles romanization" },
            { labelAndValue: "From alternative names, general", disabled: true },
            { labelAndValue: "R from alternative language" },
            { labelAndValue: "R from alternative name" },
            { labelAndValue: "R from former name" },
            { labelAndValue: "R from historic name" },
            { labelAndValue: "R from incomplete name" },
            { labelAndValue: "R from incorrect name" },
            { labelAndValue: "R from letter\u2013word combination" },
            { labelAndValue: "R from long name" },
            { labelAndValue: "R from portmanteau" },
            { labelAndValue: "R from predecessor company name" },
            { labelAndValue: "R from short name" },
            { labelAndValue: "R from sort name" },
            { labelAndValue: "R from less specific name" },
            { labelAndValue: "R from more specific name" },
            { labelAndValue: "R from antonym" },
            { labelAndValue: "R from eponym" },
            { labelAndValue: "R from synonym" },
            { labelAndValue: "R from Roman numerals" },
            { labelAndValue: "From alternative names, geography", disabled: true },
            { labelAndValue: "R from Canadian settlement name" },
            { labelAndValue: "R from name and country" },
            { labelAndValue: "R from city and state" },
            { labelAndValue: "R from city and province" },
            { labelAndValue: "R from more specific geographic name" },
            { labelAndValue: "R from postal abbreviation" },
            { labelAndValue: "R from postal code" },
            { labelAndValue: "R from US postal abbreviation" },
            { labelAndValue: "From alternative names, organisms", disabled: true },
            { labelAndValue: "R from scientific abbreviation" },
            { labelAndValue: "R from scientific name" },
            { labelAndValue: "R from alternative scientific name" },
            { labelAndValue: "R from monotypic taxon" },
            { labelAndValue: "From alternative names, people", disabled: true },
            { labelAndValue: "R from birth name" },
            { labelAndValue: "R from given name" },
            { labelAndValue: "R from married name" },
            { labelAndValue: "R from name with title" },
            { labelAndValue: "R from non-neutral name" },
            { labelAndValue: "R from personal name" },
            { labelAndValue: "R from pseudonym" },
            { labelAndValue: "R from relative" },
            { labelAndValue: "R from spouse" },
            { labelAndValue: "R from surname" },
            { labelAndValue: "From alternative names, technical", disabled: true },
            { labelAndValue: "R from Bluebook abbreviation" },
            { labelAndValue: "R from brand name" },
            { labelAndValue: "R from drug trade name" },
            { labelAndValue: "R from file name" },
            { labelAndValue: "R from Java package name" },
            { labelAndValue: "R from MathSciNet abbreviation" },
            { labelAndValue: "R from molecular formula" },
            { labelAndValue: "R from NLM abbreviation" },
            { labelAndValue: "R from product name" },
            { labelAndValue: "R from slogan" },
            { labelAndValue: "R from symbol" },
            { labelAndValue: "R from systematic abbreviations" },
            { labelAndValue: "R from technical name" },
            { labelAndValue: "R from trademark" },
            { labelAndValue: "From \u2013 navigation", disabled: true },
            { labelAndValue: "R from file metadata link" },
            { labelAndValue: "R mentioned in hatnote" },
            { labelAndValue: "R from shortcut" },
            { labelAndValue: "R from template shortcut" },
            { labelAndValue: "From disambiguations", disabled: true },
            { labelAndValue: "R from ambiguous term" },
            { labelAndValue: "R from incomplete disambiguation" },
            { labelAndValue: "R from incorrect disambiguation" },
            { labelAndValue: "R from other disambiguation" },
            { labelAndValue: "R from predictable disambiguation" },
            { labelAndValue: "R from unnecessary disambiguation" },
            { labelAndValue: "From mergers, duplicates, and moves", disabled: true },
            { labelAndValue: "R from duplicated article" },
            { labelAndValue: "R with history" },
            { labelAndValue: "R from merge" },
            { labelAndValue: "R from move" },
            { labelAndValue: "R with old history" },
            { labelAndValue: "From fiction", disabled: true },
            { labelAndValue: "R from fictional character" },
            { labelAndValue: "R from fictional element" },
            { labelAndValue: "R from fictional location" },
            { labelAndValue: "From related info", disabled: true },
            { labelAndValue: "R from album" },
            { labelAndValue: "R from animal" },
            { labelAndValue: "R from book" },
            { labelAndValue: "R from catchphrase" },
            { labelAndValue: "R from domain name" },
            { labelAndValue: "R from top-level domain" },
            { labelAndValue: "R from film" },
            { labelAndValue: "R from gender" },
            { labelAndValue: "R from legislation" },
            { labelAndValue: "R from list topic" },
            { labelAndValue: "R from member" },
            { labelAndValue: "R from person" },
            { labelAndValue: "R from phrase" },
            { labelAndValue: "R from quotation" },
            { labelAndValue: "R from related word" },
            { labelAndValue: "R from school" },
            { labelAndValue: "R from song" },
            { labelAndValue: "R from subtopic" },
            { labelAndValue: "R from team" },
            { labelAndValue: "R from work" },
            { labelAndValue: "R from writer" },
            { labelAndValue: "R from Unicode" },
            { labelAndValue: "To \u2013 grammar, punctuation, and spelling", disabled: true },
            { labelAndValue: "R to acronym" },
            { labelAndValue: "R to initialism" },
            { labelAndValue: "R to ASCII-only title" },
            { labelAndValue: "R to diacritic" },
            { labelAndValue: "R to ligature" },
            { labelAndValue: "R to plural" },
            { labelAndValue: "To alternative names", disabled: true },
            { labelAndValue: "R to former name" },
            { labelAndValue: "R to historic name" },
            { labelAndValue: "R to joint biography" },
            { labelAndValue: "R to name with title" },
            { labelAndValue: "R to monotypic taxon" },
            { labelAndValue: "R to scientific name" },
            { labelAndValue: "R to systematic name" },
            { labelAndValue: "R to technical name" },
            { labelAndValue: "To \u2013 navigation and disambiguation", disabled: true },
            { labelAndValue: "R to anchor" },
            { labelAndValue: "R to anthroponymy page" },
            { labelAndValue: "R to disambiguation page" },
            { labelAndValue: "R to list entry" },
            { labelAndValue: "R to section" },
            { labelAndValue: "To miscellaneous", disabled: true },
            { labelAndValue: "R to decade" },
            { labelAndValue: "R to related topic" },
            { labelAndValue: "R to subpage" },
            { labelAndValue: "R to subtopic" },
            { labelAndValue: "R to TV episode list entry" },
            { label: "Custom - prompt me", value: "custom" }
          ])
        );
      } else {
        $extra.html(
          '<label for="afcHelper_redirect_name_' + id + '">Category name: </label><input type="text" size="100" name="afcHelper_redirect_name_' + id + '" id="afcHelper_redirect_name_' + id + '" value="' + submissions[id].title + '" />'
        );
        $extra.html(
          $extra.html() + '<br /><label for="afcHelper_redirect_parents_' + id + '">Parent categories (comma-separated):</label><input type="text" size="100" id="afcHelper_redirect_parents_' + id + '" name="afcHelper_redirect_parents_' + id + '" value="' + submissions[id].parents + '" />'
        );
        $extra.append("<br />");
        $extra.append($("<input>", { type: "checkbox", name: "afcHelper_redirect_container_" + id, id: "afcHelper_redirect_container_" + id }));
        $extra.append(
          '<label for="afcHelper_redirect_container_' + id + '">This is a <a href="/wiki/Wikipedia:Container_category" title="Wikipedia:Container category">container category</a></label>'
        );
        $extra.html($extra.html() + '<br /><input type="checkbox" name="afcHelper_redirect_container_' + id + '"');
      }
      $extra.html(
        $extra.html() + '<br /><label for="afcHelper_redirect_comment_' + id + '">Comment:</label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>'
      );
    } else if (selectValue === "decline") {
      if (submissions[id].type === "redirect") {
        $extra.html(
          '<label for="afcHelper_redirect_decline_' + id + '">Reason for decline: </label>' + generateSelect("afcHelper_redirect_decline_" + id, [
            {
              label: "Already exists",
              value: "exists"
            },
            {
              label: "Blank request",
              value: "blank"
            },
            {
              label: "No valid target specified",
              value: "no-target"
            },
            {
              label: "Unlikely search term",
              value: "unlikely"
            },
            {
              label: "Not a redirect request",
              value: "not-redirect"
            },
            {
              label: "Custom - reason below",
              selected: true,
              value: "custom"
            }
          ])
        );
      } else {
        $extra.html(
          '<label for="afcHelper_redirect_decline_' + id + '">Reason for decline: </label>' + generateSelect("afcHelper_redirect_decline_" + id, [
            {
              label: "Already exists",
              value: "exists"
            },
            {
              label: "Blank request",
              value: "blank"
            },
            {
              label: "Unlikely category",
              value: "unlikely"
            },
            {
              label: "Not a category request",
              value: "not-category"
            },
            {
              label: "Custom - reason below",
              selected: true,
              value: "custom"
            }
          ])
        );
      }
      $extra.html(
        $extra.html() + '<br/><label for="afcHelper_redirect_comment_' + id + '">Comment: </label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>'
      );
    } else if (selectValue === "none") {
      $extra.html("");
    } else {
      $extra.html(
        $extra.html() + '<label for="afcHelper_redirect_comment_' + id + '">Comment: </label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>'
      );
    }
  }
  async function redirectPerformActions() {
    for (let i = 0; i < submissions.length; i++) {
      const action = $("#afcHelper_redirect_action_" + i).val();
      submissions[i].action = action;
      if (action === "none")
        continue;
      if (action === "accept") {
        if (submissions[i].type === "redirect") {
          submissions[i].title = $("#afcHelper_redirect_from_" + i).val();
          submissions[i].to = $("#afcHelper_redirect_to_" + i).val();
          submissions[i].append = $("#afcHelper_redirect_append_" + i).val();
          if (submissions[i].append === "custom") {
            submissions[i].append = prompt("Please enter the template to append to " + submissions[i].title + ". Do not include the curly brackets.");
          }
          if (submissions[i].append === "none" || submissions[i].append === null)
            submissions[i].append = "";
          else
            submissions[i].append = "{{" + submissions[i].append + "}}";
        } else {
          submissions[i].title = $("#afcHelper_redirect_name_" + i).val();
          submissions[i].parents = $("#afcHelper_redirect_parents_" + i).val();
          submissions[i].container = $("#afcHelper_redirect_container_" + i).is(":checked");
        }
      } else if (action === "decline") {
        submissions[i].reason = $("#afcHelper_redirect_decline_" + i).val();
      }
      submissions[i].comment = $("#afcHelper_redirect_comment_" + i).val();
    }
    displayMessage('<ul id="afcHelper_status"></ul><ul id="afcHelper_finish"></ul>');
    const addStatus = function(status) {
      $("#afcHelper_status").append(status);
    };
    $("#afcHelper_finish").html(
      $("#afcHelper_finish").html() + '<span id="afcHelper_finished_wrapper"><span id="afcHelper_finished_main" style="display:none"><li id="afcHelper_done"><b>Done (<a href="' + mw.config.get("wgArticlePath").replace("$1", encodeURI(redirectPageName)) + '?action=purge" title="' + redirectPageName + '">Reload page</a>)</b></li></span></span>'
    );
    let pageText = await getPageText(redirectPageName, addStatus);
    let totalAccept = 0;
    let totalDecline = 0;
    let totalComment = 0;
    addStatus("<li>Processing " + redirectSubmissions.length + " submission" + (redirectSubmissions.length === 1 ? "" : "s") + "...</li>");
    for (let i = 0; i < redirectSubmissions.length; i++) {
      const sub = redirectSubmissions[i];
      if (pageText.indexOf(redirectSections[sub.section]) === -1) {
        addStatus("<li>Skipping " + sub.title + ": Cannot find section. Perhaps it was modified in the mean time?</li>");
        continue;
      }
      let text = redirectSections[sub.section];
      const startIndex = pageText.indexOf(redirectSections[sub.section]);
      const endIndex = startIndex + text.length;
      if (sub.type === "category") {
        if (sub.action === "accept") {
          let categoryText = "<!--Created by WP:AFC -->";
          if (sub.container) {
            categoryText += "\n{{Container category}}";
          }
          if (sub.parents !== "") {
            categoryText = sub.parents.split(",").map((cat) => {
              return "[[" + cat + "]]";
            }).join("\n");
          }
          editPage(sub.title, categoryText, "Created via [[WP:AFC|Articles for Creation]]", true);
          const talkText = "{{subst:WPAFC/article|class=Cat}}";
          const talkTitle = new mw.Title(sub.title).getTalkPage().toText();
          editPage(talkTitle, talkText, "Placing WPAFC project banner", true);
          const header = text.match(/==[^=]*==/)[0];
          text = header + "\n{{AfC-c|a}}\n" + text.substring(header.length);
          if (sub.comment !== "")
            text += "\n*{{subst:afc category|accept|2=" + sub.comment + "}} ~~~~\n";
          else
            text += "\n*{{subst:afc category}} ~~~~\n";
          text += "{{AfC-c|b}}\n";
          totalAccept++;
        } else if (sub.action === "decline") {
          const header = text.match(/==[^=]*==/)[0];
          let reason = categoryDeclineReasons[sub.reason];
          if (reason === "")
            reason = sub.comment;
          else if (sub.comment !== "")
            reason = reason + ": " + sub.comment;
          if (reason === "") {
            $("afcHelper_status").html($("#afcHelper_status").html() + "<li>Skipping " + sub.title + ": No decline reason specified.</li>");
            continue;
          }
          text = header + "\n{{AfC-c|d}}\n" + text.substring(header.length);
          if (sub.comment === "")
            text += "\n*{{subst:afc category|" + sub.reason + "}} ~~~~\n";
          else
            text += "\n*{{subst:afc category|decline|2=" + reason + "}} ~~~~\n";
          text += "{{AfC-c|b}}\n";
          totalDecline++;
        } else if (sub.action === "comment") {
          if (sub.comment !== "")
            text += "\n\n{{afc comment|1=" + sub.comment + " ~~~~}}\n";
          totalComment++;
        }
      } else {
        let acceptComment = "";
        let declineComment = "";
        let otherComment = "";
        let acceptCount = 0, declineCount = 0, commentCount = 0, hasComment = false;
        for (let j = 0; j < sub.from.length; j++) {
          const redirect = sub.from[j];
          if (redirect.action === "accept") {
            const redirectText = `#REDIRECT [[${redirect.to}]]${redirect.append ? `

{{Redirect category shell|
${redirect.append}
}}` : ""}`;
            editPage(redirect.title, redirectText, "Redirected page to [[" + redirect.to + "]] via [[WP:AFC|Articles for Creation]]", true);
            const mwTitle = new mw.Title(redirect.title);
            if (!mwTitle.isTalkPage()) {
              const mwTalkTitle = mwTitle.getTalkPage().toText();
              const talkText = "{{subst:WPAFC/redirect}}";
              editPage(mwTalkTitle, talkText, "Placing WPAFC project banner", true);
            }
            acceptComment += redirect.title + " &rarr; " + redirect.to;
            if (redirect.comment !== "") {
              acceptComment += ": " + redirect.comment;
              hasComment = true;
            } else {
              acceptComment += ". ";
            }
            acceptCount++;
          } else if (redirect.action === "decline") {
            let reason2 = redirectDeclineReasons[redirect.reason];
            if (reason2 === "")
              reason2 = redirect.comment;
            else if (redirect.comment !== "")
              reason2 = reason2 + ": " + redirect.comment;
            if (reason2 === "") {
              $("#afcHelper_status").html($("#afcHelper_status").html() + "<li>Skipping " + redirect.title + ": No decline reason specified.</li>");
              continue;
            }
            declineComment += redirect.reason === "blank" || redirect.reason === "not-redirect" ? reason2 + ". " : redirect.title + " &rarr; " + redirect.to + ": " + reason2 + ". ";
            declineCount++;
          } else if (redirect.action === "comment") {
            otherComment += redirect.title + ": " + redirect.comment + ". ";
            commentCount++;
          }
        }
        let reason = "";
        if (acceptCount > 0)
          reason += "\n*{{subst:afc redirect|accept|2=" + acceptComment + " Thank you for your contributions to Wikipedia!}} ~~~~";
        if (declineCount > 0)
          reason += "\n*{{subst:afc redirect|decline|2=" + declineComment + "}} ~~~~";
        if (commentCount > 0)
          reason += "\n*{{afc comment|1=" + otherComment + "~~~~}}";
        reason += "\n";
        if (!hasComment && acceptCount === sub.from.length) {
          if (acceptCount > 1)
            reason = "\n*{{subst:afc redirect|all}} ~~~~\n";
          else
            reason = "\n*{{subst:afc redirect}} ~~~~\n";
        }
        if (acceptCount + declineCount + commentCount > 0) {
          if (acceptCount + declineCount === sub.from.length) {
            const header = text.match(/==[^=]*==/)[0];
            if (acceptCount > 0 && declineCount > 0)
              text = header + "\n{{AfC-c|p}}" + text.substring(header.length);
            else if (acceptCount > 0)
              text = header + "\n{{AfC-c|a}}" + text.substring(header.length);
            else
              text = header + "\n{{AfC-c|d}}" + text.substring(header.length);
            text += reason;
            text += "{{AfC-c|b}}\n";
          } else
            text += reason + "\n";
        }
        totalAccept += acceptCount;
        totalDecline += declineCount;
        totalComment += commentCount;
      }
      pageText = pageText.substring(0, startIndex) + text + pageText.substring(endIndex);
    }
    let summary = "Updating submission status:";
    if (totalAccept > 0)
      summary += " accepting " + totalAccept + " request" + (totalAccept > 1 ? "s" : "");
    if (totalDecline > 0) {
      if (totalAccept > 0)
        summary += ",";
      summary += " declining " + totalDecline + " request" + (totalDecline > 1 ? "s" : "");
    }
    if (totalComment > 0) {
      if (totalAccept > 0 || totalDecline > 0)
        summary += ",";
      summary += " commenting on " + totalComment + " request" + (totalComment > 1 ? "s" : "");
    }
    editPage(redirectPageName, pageText, summary, false);
    $(document).ajaxStop(() => {
      $("#afcHelper_finished_main").css("display", "");
    });
  }
  async function getPageText(title, addStatus) {
    addStatus = typeof addStatus !== "undefined" ? addStatus : function() {
    };
    addStatus(
      '<li id="afcHelper_get' + jqEscape(title) + '">Getting <a href="' + mw.config.get("wgArticlePath").replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></li>"
    );
    const response = await new mw.Api().get({ action: "query", prop: "revisions", rvprop: "content", format: "json", indexpageids: true, titles: title });
    const pageId = response.query.pageids[0];
    if (pageId === "-1") {
      addStatus('The page <a class="new" href="' + mw.config.get("wgArticlePath").replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a> does not exist");
      return "";
    }
    const newText = response.query.pages[pageId].revisions[0]["*"];
    addStatus('<li id="afcHelper_get' + jqEscape(title) + '">Got <a href="' + mw.config.get("wgArticlePath").replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></li>");
    return newText;
  }
  function cleanupLinks(text) {
    const wikilinkRegex = /(\[){1,2}(?:https?:)?\/\/(en.wikipedia.org\/wiki|enwp.org)\/([^\s|\][]+)(\s|\|)?((?:\[\[[^[\]]*\]\]|[^\][])*)(\]){1,2}/gi;
    const tempText = text;
    let match;
    while (match = wikilinkRegex.exec(tempText)) {
      const pageName = decodeURI(match[3].replace(/_/g, " "));
      let displayname = decodeURI(match[5].replace(/_/g, " "));
      if (pageName === displayname)
        displayname = "";
      const replaceText = "[[" + pageName + (displayname ? "|" + displayname : "") + "]]";
      text = text.replace(match[0], replaceText);
    }
    return text;
  }
  function generateSelect(title, options) {
    return generateSelectObject(title, options).prop("outerHTML");
  }
  function generateSelectObject(title, options, onchange) {
    const $select = $("<select>").attr("name", title).attr("id", title);
    if (onchange !== null) {
      $select.change(onchange);
    }
    options.forEach((option) => {
      if (option.labelAndValue) {
        option.value = option.labelAndValue;
        option.label = option.labelAndValue;
      }
      const $option = $("<option>").appendTo($select).val(option.value).text(option.label);
      if (option.selected)
        $option.attr("selected", "selected");
      if (option.disabled)
        $option.attr("disabled", "disabled");
    });
    return $select;
  }
  function displayMessage(message, className) {
    if (!arguments.length || message === "" || message === null) {
      $("#display-message").empty().hide();
      return true;
    } else {
      let $messageDiv = $("#display-message");
      if (!$messageDiv.length) {
        $messageDiv = $('<div id="display-message" style="margin:1em;padding:0.5em 2.5%;border:solid 1px #ddd;background-color:#fcfcfc;font-size: 0.8em"></div>');
        if (mw.util.$content.length) {
          mw.util.$content.prepend($messageDiv);
        } else {
          return false;
        }
      }
      if (className)
        $messageDiv.prop("class", "display-message-" + className);
      if (typeof message === "object") {
        $messageDiv.empty();
        $messageDiv.append(message);
      } else
        $messageDiv.html(message);
      $messageDiv[0].scrollIntoView();
      return true;
    }
  }
  function jqEscape(expression) {
    return expression.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~ ]/g, "");
  }
  function editPage(title, newText, summary, createOnly, noPatrol) {
    const wgArticlePath = mw.config.get("wgArticlePath");
    summary += summaryAdvert;
    $("#afcHelper_finished_wrapper").html('<span id="afcHelper_AJAX_finished_' + ajaxNumber + '" style="display:none">' + $("#afcHelper_finished_wrapper").html() + "</span>");
    const functionId = ajaxNumber;
    ajaxNumber++;
    $("#afcHelper_status").html(
      $("#afcHelper_status").html() + '<li id="afcHelper_edit' + jqEscape(title) + '">Editing <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></li>"
    );
    const request = {
      action: "edit",
      title,
      text: newText,
      summary
    };
    if (createOnly)
      request.createonly = true;
    const api = new mw.Api();
    api.postWithEditToken(request).done((data) => {
      if (data && data.edit && data.edit.result && data.edit.result === "Success") {
        $("#afcHelper_edit" + jqEscape(title)).html('Saved <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a>");
      } else {
        $("#afcHelper_edit" + jqEscape(title)).html(
          '<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span>. Error info: " + JSON.stringify(data)
        );
        console.error("Edit failed on %s (%s). Error info: %s", wgArticlePath.replace("$1", encodeURI(title)), title, JSON.stringify(data));
      }
    }).fail((error) => {
      if (createOnly && error === "articleexists")
        $("#afcHelper_edit" + jqEscape(title)).html(
          '<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span>. Error info: The article already exists!"
        );
      else
        $("#afcHelper_edit" + jqEscape(title)).html(
          '<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span>. Error info: " + error
        );
    }).always(() => {
      $("#afcHelper_AJAX_finished_" + functionId).css("display", "");
    });
    if (!noPatrol) {
      if ($(".patrollink").length) {
        const patrolHref = $(".patrollink a").attr("href");
        const rcId = mw.util.getParamValue("rcid", patrolHref);
        if (rcId) {
          $("#afcHelper_status").html(
            $("#afcHelper_status").html() + '<li id="afcHelper_patrol' + jqEscape(title) + '">Marking <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + " as patrolled</a></li>"
          );
          const patrolRequest = {
            action: "patrol",
            format: "json",
            rcid: rcId
          };
          api.postWithToken("patrol", patrolRequest).done((data) => {
            if (data) {
              $("#afcHelper_patrol" + jqEscape(title)).html(
                'Marked <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a> as patrolled"
              );
            } else {
              $("#afcHelper_patrol" + jqEscape(title)).html(
                '<span class="afcHelper_notice"><b>Patrolling failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span> with an unknown error"
              );
              console.error("Patrolling failed on %s (%s) with an unknown error.", wgArticlePath.replace("$1", encodeURI(title)), title);
            }
          }).fail((error) => {
            $("#afcHelper_patrol" + jqEscape(title)).html(
              '<span class="afcHelper_notice"><b>Patrolling failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span>. Error info: " + error
            );
          });
        }
      }
    }
  }
  mw.loader.using(["mediawiki.api", "mediawiki.util"], () => {
    mw.util.addCSS(`
#display-message * {
    margin: revert;
    border: revert;
    background: revert;
    padding: revert;
}`);
    const redirectPortletLink = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", "Review AFC/RC", "ca-afcrhs", "Review", "a");
    $(redirectPortletLink).click((event) => {
      event.preventDefault();
      redirectSubmissions.length = 0;
      redirectSections.length = 0;
      numTotal = 0;
      submissions.length = 0;
      needsUpdate.length = 0;
      redirectInit();
    });
  });
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9BRkNSSFMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIihmdW5jdGlvbiAoKSB7XG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSAhPT0gJ1dpa2lwZWRpYTpBcnRpY2xlc19mb3JfY3JlYXRpb24vUmVkaXJlY3RzX2FuZF9jYXRlZ29yaWVzJykgcmV0dXJuO1xuXG4gICAgY29uc3QgcmVkaXJlY3RQYWdlTmFtZSA9IG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKS5yZXBsYWNlKC9fL2csICcgJyk7XG4gICAgY29uc3QgcmVkaXJlY3RTdWJtaXNzaW9ucyA9IFtdO1xuICAgIGxldCByZWRpcmVjdFNlY3Rpb25zID0gW107XG4gICAgY29uc3Qgc3VtbWFyeUFkdmVydCA9ICcgKFtbVXNlcjpFZWppdDQzL3NjcmlwdHMvQUZDUkhTfEFGQ1JIUyAyXV0pJztcbiAgICBsZXQgbnVtVG90YWwgPSAwO1xuICAgIGxldCBhamF4TnVtYmVyID0gMDtcbiAgICBjb25zdCBzdWJtaXNzaW9ucyA9IFtdO1xuICAgIGNvbnN0IG5lZWRzVXBkYXRlID0gW107XG4gICAgY29uc3QgcmVkaXJlY3REZWNsaW5lUmVhc29ucyA9IHtcbiAgICAgICAgZXhpc3RzOiAnVGhlIHRpdGxlIHlvdSBzdWdnZXN0ZWQgYWxyZWFkeSBleGlzdHMgb24gV2lraXBlZGlhJyxcbiAgICAgICAgYmxhbms6ICdXZSBjYW5ub3QgYWNjZXB0IGVtcHR5IHN1Ym1pc3Npb25zJyxcbiAgICAgICAgJ25vLXRhcmdldCc6ICcgQSByZWRpcmVjdCBjYW5ub3QgYmUgY3JlYXRlZCB1bmxlc3MgdGhlIHRhcmdldCBpcyBhbiBleGlzdGluZyBhcnRpY2xlLiBFaXRoZXIgeW91IGhhdmUgbm90IHNwZWNpZmllZCB0aGUgdGFyZ2V0LCBvciB0aGUgdGFyZ2V0IGRvZXMgbm90IGV4aXN0JyxcbiAgICAgICAgdW5saWtlbHk6ICdUaGUgdGl0bGUgeW91IHN1Z2dlc3RlZCBzZWVtcyB1bmxpa2VseS4gQ291bGQgeW91IHByb3ZpZGUgYSBzb3VyY2Ugc2hvd2luZyB0aGF0IGl0IGlzIGEgY29tbW9ubHkgdXNlZCBhbHRlcm5hdGUgbmFtZT8nLFxuICAgICAgICAnbm90LXJlZGlyZWN0JzogJ1RoaXMgcmVxdWVzdCBpcyBub3QgYSByZWRpcmVjdCByZXF1ZXN0JyxcbiAgICAgICAgY3VzdG9tOiAnJyxcbiAgICB9O1xuICAgIGNvbnN0IGNhdGVnb3J5RGVjbGluZVJlYXNvbnMgPSB7XG4gICAgICAgIGV4aXN0czogJ1RoZSBjYXRlZ29yeSB5b3Ugc3VnZ2VzdGVkIGFscmVhZHkgZXhpc3RzIG9uIFdpa2lwZWRpYScsXG4gICAgICAgIGJsYW5rOiAnV2UgY2Fubm90IGFjY2VwdCBlbXB0eSBzdWJtaXNzaW9ucycsXG4gICAgICAgIHVubGlrZWx5OiAnSXQgc2VlbXMgdW5saWtlbHkgdGhhdCB0aGVyZSBhcmUgZW5vdWdoIHBhZ2VzIHRvIHN1cHBvcnQgdGhpcyBjYXRlZ29yeScsXG4gICAgICAgICdub3QtY2F0ZWdvcnknOiAnVGhpcyByZXF1ZXN0IGlzIG5vdCBhIGNhdGVnb3J5IHJlcXVlc3QnLFxuICAgICAgICBjdXN0b206ICcnLFxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyB0aGUgcmVkaXJlY3QgaGFuZGxlclxuICAgICAqL1xuICAgIGFzeW5jIGZ1bmN0aW9uIHJlZGlyZWN0SW5pdCgpIHtcbiAgICAgICAgbGV0IHBhZ2VUZXh0ID0gYXdhaXQgZ2V0UGFnZVRleHQocmVkaXJlY3RQYWdlTmFtZSk7XG4gICAgICAgIC8vIENsZWFudXAgdGhlIHdpa2lwZWRpYSBsaW5rcyBmb3IgcHJldmVudGluZyBzdHVmZiBsaWtlIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93L2luZGV4LnBocD9kaWZmPTU3NjI0NDA2NyZvbGRpZD01NzYyMjE0MzdcbiAgICAgICAgcGFnZVRleHQgPSBjbGVhbnVwTGlua3MocGFnZVRleHQpO1xuXG4gICAgICAgIC8vIEZpcnN0LCBzdHJpcCBvdXQgdGhlIHBhcnRzIGJlZm9yZSB0aGUgZmlyc3Qgc2VjdGlvblxuICAgICAgICBjb25zdCBzZWN0aW9uUmVnZXggPSAvPT0uKj89PS87XG4gICAgICAgIHBhZ2VUZXh0ID0gcGFnZVRleHQuc3Vic3RyaW5nKHBhZ2VUZXh0LnNlYXJjaChzZWN0aW9uUmVnZXgpKTtcbiAgICAgICAgLy8gVGhlbiBzcGxpdCBpdCBpbnRvIHRoZSByZXN0IG9mIHRoZSBzZWN0aW9uc1xuICAgICAgICByZWRpcmVjdFNlY3Rpb25zID0gcGFnZVRleHQubWF0Y2goL149PS4qPz09JCgoXFxyP1xcbj8pKD8hPT1bXj1dKS4qKSovZ2ltKTtcblxuICAgICAgICAvLyBQYXJzZSB0aGUgc2VjdGlvbnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWRpcmVjdFNlY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjbG9zZWQgPSAvKFxce1xce1xccyphZmMoPyFcXHMrY29tbWVudCl8VGhpcyBpcyBhbiBhcmNoaXZlZCBkaXNjdXNzaW9uKS9pLnRlc3QocmVkaXJlY3RTZWN0aW9uc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWNsb3NlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IHJlZGlyZWN0U2VjdGlvbnNbaV0ubWF0Y2goc2VjdGlvblJlZ2V4KVswXTtcbiAgICAgICAgICAgICAgICBpZiAoaGVhZGVyLnNlYXJjaCgvUmVkaXJlY3QgcmVxdWVzdC9pKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgd2lraWxpbmtSZWdleCA9IC9cXFtcXFsoXFxzKltePV0qPykqP1xcXVxcXS9nO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaW5rcyA9IGhlYWRlci5tYXRjaCh3aWtpbGlua1JlZ2V4KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsaW5rcykgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGwgPSAwOyBsIDwgbGlua3MubGVuZ3RoOyBsKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmtzW2xdID0gbGlua3NbbF0ucmVwbGFjZSgvW1tcXF1dL2csICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaW5rc1tsXS5jaGFyQXQoMCkgPT09ICc6JykgbGlua3NbbF0gPSBsaW5rc1tsXS5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVnZXggPSAvVGFyZ2V0IG9mIHJlZGlyZWN0OlxccypcXFtcXFsoW15bXFxdXSopXFxdXFxdL2k7XG4gICAgICAgICAgICAgICAgICAgIHJlZ2V4LnRlc3QocmVkaXJlY3RTZWN0aW9uc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvID0gJC50cmltKFJlZ0V4cC4kMSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVhc29uUmUgPSAvUmVhc29uOlsgXFx0XSo/KC4rKS9pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWFzb25NYXRjaCA9IHJlYXNvblJlLmV4ZWMocmVkaXJlY3RTZWN0aW9uc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlYXNvbiA9IHJlYXNvbk1hdGNoICYmIHJlYXNvbk1hdGNoWzFdLnRyaW0oKSA/IHJlYXNvbk1hdGNoWzFdIDogbnVsbDtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VSZSA9IC9Tb3VyY2UuKj86WyBcXHRdKj8oLispL2k7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZU1hdGNoID0gc291cmNlUmUuZXhlYyhyZWRpcmVjdFNlY3Rpb25zW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc291cmNlID0gc291cmNlTWF0Y2ggJiYgc291cmNlTWF0Y2hbMV0udHJpbSgpID8gc291cmNlTWF0Y2hbMV0gOiBudWxsO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1Ym1pc3Npb24gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmVkaXJlY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZnJvbTogW10sXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWN0aW9uOiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdG8sXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogdG8sXG4gICAgICAgICAgICAgICAgICAgICAgICByZWFzb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGlua3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmVkaXJlY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBudW1Ub3RhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogbGlua3Nbal0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJtaXNzaW9uLmZyb20ucHVzaChzdWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnMucHVzaChzdWIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbnVtVG90YWwrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZWRpcmVjdFN1Ym1pc3Npb25zLnB1c2goc3VibWlzc2lvbik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChoZWFkZXIuc2VhcmNoKC9DYXRlZ29yeSByZXF1ZXN0L2kpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIGEgd2lraWxpbmsgaW4gdGhlIGhlYWRlciwgYW5kIGFzc3VtZSBpdCdzIHRoZSBjYXRlZ29yeSB0byBjcmVhdGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNhdGVnb3J5TmFtZSA9IC9cXFtcXFtbXltcXF1dK1xcXVxcXS8uZXhlYyhoZWFkZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNhdGVnb3J5TmFtZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGNhdGVnb3J5TmFtZSA9IGNhdGVnb3J5TmFtZVswXTtcbiAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnlOYW1lID0gY2F0ZWdvcnlOYW1lLnJlcGxhY2UoL1tbXFxdXS9nLCAnJyk7XG4gICAgICAgICAgICAgICAgICAgIGNhdGVnb3J5TmFtZSA9IGNhdGVnb3J5TmFtZS5yZXBsYWNlKC9DYXRlZ29yeVxccyo6XFxzKi9naSwgJ0NhdGVnb3J5OicpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2F0ZWdvcnlOYW1lLmNoYXJBdCgwKSA9PT0gJzonKSBjYXRlZ29yeU5hbWUgPSBjYXRlZ29yeU5hbWUuc3Vic3RyaW5nKDEpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIHBhcmVudCBjYXRlZ29yaWVzXG4gICAgICAgICAgICAgICAgICAgIGxldCByZXF1ZXN0VGV4dCA9IHJlZGlyZWN0U2VjdGlvbnNbaV0uc3Vic3RyaW5nKGhlYWRlci5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIG9ubHkgd2FudCBjYXRlZ29yaWVzIGxpc3RlZCB1bmRlciB0aGUgXCJQYXJlbnQgY2F0ZWdvcnkvY2F0ZWdvcmllc1wiIGhlYWRpbmcsXG4gICAgICAgICAgICAgICAgICAgIC8vICpOT1QqIGFueSBjYXRlZ29yaWVzIGxpc3RlZCB1bmRlciBcIkV4YW1wbGUgcGFnZXMgd2hpY2ggYmVsb25nIHRvIHRoaXMgY2F0ZWdvcnlcIi5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50SGVhZGluZ0luZGV4ID0gcmVxdWVzdFRleHQuaW5kZXhPZignUGFyZW50IGNhdGVnb3J5L2NhdGVnb3JpZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudEhlYWRpbmdJbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0VGV4dCA9IHJlcXVlc3RUZXh0LnN1YnN0cmluZyhwYXJlbnRIZWFkaW5nSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50Q2F0ZWdvcmllcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFyZW50Q2F0ZWdvcnlNYXRjaCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudENhdGVnb3JpZXNSZWdleCA9IC9cXFtcXFtcXHMqOlxccyooQ2F0ZWdvcnk6W15cXF1bXSopXFxdXFxdL2dpO1xuICAgICAgICAgICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRDYXRlZ29yeU1hdGNoID0gcGFyZW50Q2F0ZWdvcmllc1JlZ2V4LmV4ZWMocmVxdWVzdFRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudENhdGVnb3J5TWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRDYXRlZ29yaWVzLnB1c2gocGFyZW50Q2F0ZWdvcnlNYXRjaFsxXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKHBhcmVudENhdGVnb3J5TWF0Y2gpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1Ym1pc3Npb24gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnY2F0ZWdvcnknLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IGNhdGVnb3J5TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlY3Rpb246IGksXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogbnVtVG90YWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50czogcGFyZW50Q2F0ZWdvcmllcy5qb2luKCcsJyksXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIG51bVRvdGFsKys7XG4gICAgICAgICAgICAgICAgICAgIHJlZGlyZWN0U3VibWlzc2lvbnMucHVzaChzdWJtaXNzaW9uKTtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnMucHVzaChzdWJtaXNzaW9uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IC8vIEVuZCBpZiAhY2xvc2VkXG4gICAgICAgIH0gLy8gRW5kIGxvb3Agb3ZlciBzZWN0aW9uc1xuXG4gICAgICAgIC8vIEJ1aWxkIHRoZSBmb3JtXG4gICAgICAgIGNvbnN0ICRmb3JtID0gJCgnPGgzPlJldmlld2luZyBBZkMgcmVkaXJlY3QgcmVxdWVzdHM8L2gzPicpO1xuICAgICAgICBkaXNwbGF5TWVzc2FnZSgkZm9ybSk7XG4gICAgICAgIGNvbnN0ICRtZXNzYWdlRGl2ID0gJGZvcm0ucGFyZW50KCk7XG4gICAgICAgIC8vIExheW91dCB0aGUgdGV4dFxuICAgICAgICBsZXQgcmVkaXJlY3RFbXB0eSA9IDE7XG4gICAgICAgIGNvbnN0IEFDVElPTlMgPSBbXG4gICAgICAgICAgICB7IGxhYmVsOiAnQWNjZXB0JywgdmFsdWU6ICdhY2NlcHQnIH0sXG4gICAgICAgICAgICB7IGxhYmVsOiAnRGVjbGluZScsIHZhbHVlOiAnZGVjbGluZScgfSxcbiAgICAgICAgICAgIHsgbGFiZWw6ICdDb21tZW50JywgdmFsdWU6ICdjb21tZW50JyB9LFxuICAgICAgICAgICAgeyBsYWJlbDogJ05vbmUnLCBzZWxlY3RlZDogdHJ1ZSwgdmFsdWU6ICdub25lJyB9LFxuICAgICAgICBdO1xuICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IHJlZGlyZWN0U3VibWlzc2lvbnMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgIGxldCBzdWJtaXNzaW9uTmFtZTtcbiAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnRvICE9PSB1bmRlZmluZWQpIHN1Ym1pc3Npb25OYW1lID0gcmVkaXJlY3RTdWJtaXNzaW9uc1trXS50by5yZXBsYWNlKC9cXHMvZywgJycpO1xuICAgICAgICAgICAgZWxzZSBzdWJtaXNzaW9uTmFtZSA9ICcnO1xuICAgICAgICAgICAgY29uc3QgJHRoaXNTdWJMaXN0ID0gJCgnPHVsPicpO1xuICAgICAgICAgICAgY29uc3QgJHRoaXNTdWJMaXN0RWxlbWVudCA9ICQoJzxsaT4nKTtcbiAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnR5cGUgPT09ICdyZWRpcmVjdCcpIHtcbiAgICAgICAgICAgICAgICAkdGhpc1N1Ykxpc3RFbGVtZW50LmFwcGVuZCgnUmVkaXJlY3QocykgdG8gJyk7XG4gICAgICAgICAgICAgICAgaWYgKCFzdWJtaXNzaW9uTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5mcm9tLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZWVkc1VwZGF0ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5mcm9tW2ldLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ25vLXRhcmdldCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIXJlZGlyZWN0U3VibWlzc2lvbnNba10udG8pIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IHJlZGlyZWN0U3VibWlzc2lvbnNba10uZnJvbS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmVlZHNVcGRhdGUucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IHJlZGlyZWN0U3VibWlzc2lvbnNba10uZnJvbVtpXS5pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWFzb246ICdub3QtcmVkaXJlY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlZGlyZWN0U3VibWlzc2lvbnNba10gPT09ICcnIHx8IHJlZGlyZWN0U3VibWlzc2lvbnNba10gPT09ICcgJykge1xuICAgICAgICAgICAgICAgICAgICAkdGhpc1N1Ykxpc3RFbGVtZW50LmFwcGVuZCgnRW1wdHkgc3VibWlzc2lvbiAjJyArIHJlZGlyZWN0RW1wdHkpO1xuICAgICAgICAgICAgICAgICAgICByZWRpcmVjdEVtcHR5Kys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdWJtaXNzaW9uTmFtZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICR0aGlzU3ViTGlzdEVsZW1lbnQuYXBwZW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAgJCgnPGE+JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignaHJlZicsIG13LmNvbmZpZy5nZXQoJ3dnQXJ0aWNsZVBhdGgnKS5yZXBsYWNlKCckMScsIGVuY29kZVVSSUNvbXBvbmVudChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnRvKSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RhcmdldCcsICdfYmxhbmsnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50ZXh0KHJlZGlyZWN0U3VibWlzc2lvbnNba10udG8pLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICR0aGlzU3ViTGlzdEVsZW1lbnQuYXBwZW5kKCc8Yj5ubyB0YXJnZXQgZ2l2ZW48L2I+OiAnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgJGZyb21MaXN0ID0gJCgnPHVsPicpLmFwcGVuZFRvKCR0aGlzU3ViTGlzdEVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGwgPSAwOyBsIDwgcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5mcm9tLmxlbmd0aDsgbCsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZyb20gPSByZWRpcmVjdFN1Ym1pc3Npb25zW2tdLmZyb21bbF07XG4gICAgICAgICAgICAgICAgICAgIGxldCB0b0FydGljbGUgPSBmcm9tLnRpdGxlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodG9BcnRpY2xlLnJlcGxhY2UoL1xccyovZ2ksICcnKS5sZW5ndGggPT09IDApIHRvQXJ0aWNsZSA9ICc8Yj5ubyB0aXRsZSBzcGVjaWZpZWQ8L2I+LCBjaGVjayB0aGUgcmVxdWVzdCBkZXRhaWxzJztcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWFzb25BbmRTb3VyY2UgPSAkKCc8dWw+Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnJlYXNvbikgcmVhc29uQW5kU291cmNlLmFwcGVuZCgnPGxpPlJlYXNvbjogJyArIHJlZGlyZWN0U3VibWlzc2lvbnNba10ucmVhc29uICsgJzwvbGk+Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnNvdXJjZSkgcmVhc29uQW5kU291cmNlLmFwcGVuZCgnPGxpPlNvdXJjZTogJyArIHJlZGlyZWN0U3VibWlzc2lvbnNba10uc291cmNlICsgJzwvbGk+Jyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ29vZ2xlU2VhcmNoVXJsID0gJ2h0dHA6Ly93d3cuZ29vZ2xlLmNvbS9zZWFyY2g/cT1cIicgKyBlbmNvZGVVUklDb21wb25lbnQodG9BcnRpY2xlKSArICdcIistd2lraXBlZGlhLm9yZyc7XG4gICAgICAgICAgICAgICAgICAgICRmcm9tTGlzdC5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAkKCc8bGk+JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnRnJvbTogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b0FydGljbGUgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIgKDxzbWFsbD48YSBocmVmPSdcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnb29nbGVTZWFyY2hVcmwgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1xcJ1wiIHRhcmdldD1cIl9ibGFua1wiPkdvb2dsZTwvYT4gPGI+Jm1pZGRvdDs8L2I+IDxhIGhyZWY9XCJodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9TcGVjaWFsOldoYXRMaW5rc0hlcmUvJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmNvZGVVUklDb21wb25lbnQodG9BcnRpY2xlKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXCIgdGFyZ2V0PVwiX2JsYW5rXCI+d2hhdCBsaW5rcyBoZXJlPC9hPik8L3NtYWxsPjxici8+JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChyZWFzb25BbmRTb3VyY2UpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnPGxhYmVsPicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZm9yJywgJ2FmY0hlbHBlcl9yZWRpcmVjdF9hY3Rpb25fJyArIGZyb20uaWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGV4dCgnQWN0aW9uOiAnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChnZW5lcmF0ZVNlbGVjdE9iamVjdCgnYWZjSGVscGVyX3JlZGlyZWN0X2FjdGlvbl8nICsgZnJvbS5pZCwgQUNUSU9OUywgcmVkaXJlY3RNYWtlQWN0aW9uQ2hhbmdlKGZyb20uaWQpKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCQoJzxkaXY+JykuYXR0cignaWQnLCAnYWZjSGVscGVyX3JlZGlyZWN0X2V4dHJhXycgKyBmcm9tLmlkKSksXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWJJZCA9IHJlZGlyZWN0U3VibWlzc2lvbnNba10uaWQ7XG4gICAgICAgICAgICAgICAgJHRoaXNTdWJMaXN0RWxlbWVudFxuICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCdDYXRlZ29yeSBzdWJtaXNzaW9uOiAnKVxuICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAgJCgnPGE+JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignaHJlZicsICcvd2lraS8nICsgcmVkaXJlY3RTdWJtaXNzaW9uc1trXS50aXRsZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGl0bGUnLCByZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnRpdGxlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50ZXh0KHJlZGlyZWN0U3VibWlzc2lvbnNba10udGl0bGUpLFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoJzxiciAvPicpXG4gICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAkKCc8bGFiZWw+JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZm9yJywgJ2FmY0hlbHBlcl9yZWRpcmVjdF9hY3Rpb25fJyArIHN1YklkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50ZXh0KCdBY3Rpb246ICcpLFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoZ2VuZXJhdGVTZWxlY3RPYmplY3QoJ2FmY0hlbHBlcl9yZWRpcmVjdF9hY3Rpb25fJyArIHN1YklkLCBBQ1RJT05TLCByZWRpcmVjdE1ha2VBY3Rpb25DaGFuZ2Uoc3ViSWQpKSlcbiAgICAgICAgICAgICAgICAgICAgLmFwcGVuZCgkKCc8ZGl2PicpLmF0dHIoJ2lkJywgJ2FmY0hlbHBlcl9yZWRpcmVjdF9leHRyYV8nICsgc3ViSWQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICR0aGlzU3ViTGlzdC5hcHBlbmQoJHRoaXNTdWJMaXN0RWxlbWVudCk7XG4gICAgICAgICAgICAkbWVzc2FnZURpdi5hcHBlbmQoJHRoaXNTdWJMaXN0KTtcbiAgICAgICAgfSAvLyBFbmQgbG9vcCBvdmVyIHNlY3Rpb25zXG4gICAgICAgICRtZXNzYWdlRGl2LmFwcGVuZCgkKCc8YnV0dG9uPicpLmF0dHIoJ2lkJywgJ2FmY0hlbHBlcl9yZWRpcmVjdF9kb25lX2J1dHRvbicpLmF0dHIoJ25hbWUnLCAnYWZjSGVscGVyX3JlZGlyZWN0X2RvbmVfYnV0dG9uJykudGV4dCgnRG9uZScpLmNsaWNrKHJlZGlyZWN0UGVyZm9ybUFjdGlvbnMpKTtcbiAgICAgICAgZm9yIChsZXQgeSA9IDA7IHkgPCBuZWVkc1VwZGF0ZS5sZW5ndGg7IHkrKykge1xuICAgICAgICAgICAgJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9hY3Rpb25fJyArIG5lZWRzVXBkYXRlW3ldLmlkKS5hdHRyKCd2YWx1ZScsICdkZWNsaW5lJyk7XG4gICAgICAgICAgICByZWRpcmVjdE9uQWN0aW9uQ2hhbmdlKG5lZWRzVXBkYXRlW3ldLmlkKTtcbiAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfcmVkaXJlY3RfZGVjbGluZV8nICsgbmVlZHNVcGRhdGVbeV0uaWQpLmF0dHIoJ3ZhbHVlJywgbmVlZHNVcGRhdGVbeV0ucmVhc29uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFsaWFzIG9mIHJlZGlyZWN0T25BY3Rpb25DaGFuZ2VcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgdGhlIHJlcXVlc3QgaWRcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IHRoZSBmdW5jdGlvblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlZGlyZWN0TWFrZUFjdGlvbkNoYW5nZShpZCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmVkaXJlY3RPbkFjdGlvbkNoYW5nZShpZCk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGVyZm9ybSBhY3Rpb25zIG9uIGNoYW5nZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCB0aGUgcmVxdWVzdCBpZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlZGlyZWN0T25BY3Rpb25DaGFuZ2UoaWQpIHtcbiAgICAgICAgY29uc3QgJGV4dHJhID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9leHRyYV8nICsgaWQpO1xuICAgICAgICBjb25zdCBzZWxlY3RWYWx1ZSA9ICQoJyNhZmNIZWxwZXJfcmVkaXJlY3RfYWN0aW9uXycgKyBpZCkudmFsKCk7XG4gICAgICAgICRleHRyYS5odG1sKCcnKTsgLy8gQmxhbmsgaXQgZmlyc3RcbiAgICAgICAgaWYgKHNlbGVjdFZhbHVlID09PSAnYWNjZXB0Jykge1xuICAgICAgICAgICAgaWYgKHN1Ym1pc3Npb25zW2lkXS50eXBlID09PSAncmVkaXJlY3QnKSB7XG4gICAgICAgICAgICAgICAgJGV4dHJhLmFwcGVuZCgnPGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9mcm9tXycgKyBpZCArICdcIj5Gcm9tOiA8L2xhYmVsPicpO1xuICAgICAgICAgICAgICAgICRleHRyYS5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgICQoJzxpbnB1dD4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3R5cGUnLCAndGV4dCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignbmFtZScsICdhZmNIZWxwZXJfcmVkaXJlY3RfZnJvbV8nICsgaWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignaWQnLCAnYWZjSGVscGVyX3JlZGlyZWN0X2Zyb21fJyArIGlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3ZhbHVlJywgc3VibWlzc2lvbnNbaWRdLnRpdGxlKSxcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgJGV4dHJhLmh0bWwoXG4gICAgICAgICAgICAgICAgICAgICRleHRyYS5odG1sKCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJyZuYnNwOzxiciAvPjxsYWJlbCBmb3I9XCJhZmNIZWxwZXJfcmVkaXJlY3RfdG9fJyArXG4gICAgICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCI+VG86IDwvbGFiZWw+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgbmFtZT1cImFmY0hlbHBlcl9yZWRpcmVjdF90b18nICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdcIiBpZD1cImFmY0hlbHBlcl9yZWRpcmVjdF90b18nICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdcIiB2YWx1ZT1cIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaWRdLnRvICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdcIiAvPicsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbChcbiAgICAgICAgICAgICAgICAgICAgJGV4dHJhLmh0bWwoKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAnPGJyIC8+PGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9hcHBlbmRfJyArXG4gICAgICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCI+VGVtcGxhdGUgdG8gYXBwZW5kOiAoPGEgaHJlZj1cImh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1dpa2lwZWRpYTpUTVJcIiB0YXJnZXQ9XCJfYmxhbmtcIj5IZWxwPC9hPik8L2xhYmVsPicsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbChcbiAgICAgICAgICAgICAgICAgICAgJGV4dHJhLmh0bWwoKSArXG4gICAgICAgICAgICAgICAgICAgICAgICBnZW5lcmF0ZVNlbGVjdCgnYWZjSGVscGVyX3JlZGlyZWN0X2FwcGVuZF8nICsgaWQsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsOiAnTm9uZScsIHNlbGVjdGVkOiB0cnVlLCB2YWx1ZTogJ25vbmUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJlcXVlbnRseSB1c2VkJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYWx0ZXJuYXRpdmUgbGFuZ3VhZ2UnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGFsdGVybmF0aXZlIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG1vZGlmaWNhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIHNlY3Rpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGRpYWNyaXRpYycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIGRpYWNyaXRpYycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdGcm9tIFx1MjAxMyBhYmJyZXZpYXRpb24sIGNhcGl0YWxpc2F0aW9uLCBhbmQgZ3JhbW1hcicsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGFjcm9ueW0nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGluaXRpYWxpc20nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIENhbWVsQ2FzZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbWlzY2FwaXRhbGlzYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG90aGVyIGNhcGl0YWxpc2F0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBtb2RpZmljYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHBsdXJhbCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsOiAnRnJvbSBwYXJ0cyBvZiBzcGVhY2gnLCB2YWx1ZTogJ0Zyb20gcGFydHMgb2Ygc3BlYWNoJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYWRqZWN0aXZlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhZHZlcmInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGNvbW1vbiBub3VuJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBnZXJ1bmQnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHByb3BlciBub3VuJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSB2ZXJiJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gXHUyMDEzIHNwZWxsaW5nJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYWx0ZXJuYXRpdmUgc3BlbGxpbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG1pc3NwZWxsaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBBbWVyaWNhbiBFbmdsaXNoJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBCcml0aXNoIEVuZ2xpc2gnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIEFTQ0lJLW9ubHknIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGRpYWNyaXRpYycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbGlnYXR1cmUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHN0eWxpemF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhbHRlcm5hdGl2ZSB0cmFuc2xpdGVyYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIFdhZGVcdTIwMTNHaWxlcyByb21hbml6YXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSBhbHRlcm5hdGl2ZSBuYW1lcywgZ2VuZXJhbCcsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGFsdGVybmF0aXZlIGxhbmd1YWdlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhbHRlcm5hdGl2ZSBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBmb3JtZXIgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gaGlzdG9yaWMgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gaW5jb21wbGV0ZSBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBpbmNvcnJlY3QgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbGV0dGVyXHUyMDEzd29yZCBjb21iaW5hdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbG9uZyBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBwb3J0bWFudGVhdScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcHJlZGVjZXNzb3IgY29tcGFueSBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzaG9ydCBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzb3J0IG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGxlc3Mgc3BlY2lmaWMgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbW9yZSBzcGVjaWZpYyBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhbnRvbnltJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBlcG9ueW0nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHN5bm9ueW0nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIFJvbWFuIG51bWVyYWxzJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gYWx0ZXJuYXRpdmUgbmFtZXMsIGdlb2dyYXBoeScsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIENhbmFkaWFuIHNldHRsZW1lbnQgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbmFtZSBhbmQgY291bnRyeScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gY2l0eSBhbmQgc3RhdGUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGNpdHkgYW5kIHByb3ZpbmNlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBtb3JlIHNwZWNpZmljIGdlb2dyYXBoaWMgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcG9zdGFsIGFiYnJldmlhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcG9zdGFsIGNvZGUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIFVTIHBvc3RhbCBhYmJyZXZpYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSBhbHRlcm5hdGl2ZSBuYW1lcywgb3JnYW5pc21zJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc2NpZW50aWZpYyBhYmJyZXZpYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHNjaWVudGlmaWMgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYWx0ZXJuYXRpdmUgc2NpZW50aWZpYyBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBtb25vdHlwaWMgdGF4b24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSBhbHRlcm5hdGl2ZSBuYW1lcywgcGVvcGxlJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYmlydGggbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZ2l2ZW4gbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbWFycmllZCBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBuYW1lIHdpdGggdGl0bGUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG5vbi1uZXV0cmFsIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHBlcnNvbmFsIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHBzZXVkb255bScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcmVsYXRpdmUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHNwb3VzZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc3VybmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdGcm9tIGFsdGVybmF0aXZlIG5hbWVzLCB0ZWNobmljYWwnLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBCbHVlYm9vayBhYmJyZXZpYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGJyYW5kIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGRydWcgdHJhZGUgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZmlsZSBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBKYXZhIHBhY2thZ2UgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gTWF0aFNjaU5ldCBhYmJyZXZpYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG1vbGVjdWxhciBmb3JtdWxhJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBOTE0gYWJicmV2aWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBwcm9kdWN0IG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHNsb2dhbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc3ltYm9sJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzeXN0ZW1hdGljIGFiYnJldmlhdGlvbnMnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHRlY2huaWNhbCBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSB0cmFkZW1hcmsnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSBcdTIwMTMgbmF2aWdhdGlvbicsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGZpbGUgbWV0YWRhdGEgbGluaycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIG1lbnRpb25lZCBpbiBoYXRub3RlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzaG9ydGN1dCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gdGVtcGxhdGUgc2hvcnRjdXQnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSBkaXNhbWJpZ3VhdGlvbnMnLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhbWJpZ3VvdXMgdGVybScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gaW5jb21wbGV0ZSBkaXNhbWJpZ3VhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gaW5jb3JyZWN0IGRpc2FtYmlndWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBvdGhlciBkaXNhbWJpZ3VhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcHJlZGljdGFibGUgZGlzYW1iaWd1YXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHVubmVjZXNzYXJ5IGRpc2FtYmlndWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gbWVyZ2VycywgZHVwbGljYXRlcywgYW5kIG1vdmVzJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZHVwbGljYXRlZCBhcnRpY2xlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1Igd2l0aCBoaXN0b3J5JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBtZXJnZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbW92ZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHdpdGggb2xkIGhpc3RvcnknIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSBmaWN0aW9uJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZmljdGlvbmFsIGNoYXJhY3RlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZmljdGlvbmFsIGVsZW1lbnQnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGZpY3Rpb25hbCBsb2NhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdGcm9tIHJlbGF0ZWQgaW5mbycsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGFsYnVtJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhbmltYWwnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGJvb2snIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGNhdGNocGhyYXNlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBkb21haW4gbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gdG9wLWxldmVsIGRvbWFpbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZmlsbScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZ2VuZGVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBsZWdpc2xhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbGlzdCB0b3BpYycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbWVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBwZXJzb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHBocmFzZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcXVvdGF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSByZWxhdGVkIHdvcmQnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHNjaG9vbCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc29uZycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc3VidG9waWMnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHRlYW0nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHdvcmsnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHdyaXRlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gVW5pY29kZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdUbyBcdTIwMTMgZ3JhbW1hciwgcHVuY3R1YXRpb24sIGFuZCBzcGVsbGluZycsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBhY3JvbnltJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gaW5pdGlhbGlzbScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIEFTQ0lJLW9ubHkgdGl0bGUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBkaWFjcml0aWMnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBsaWdhdHVyZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIHBsdXJhbCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdUbyBhbHRlcm5hdGl2ZSBuYW1lcycsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBmb3JtZXIgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIGhpc3RvcmljIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBqb2ludCBiaW9ncmFwaHknIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBuYW1lIHdpdGggdGl0bGUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBtb25vdHlwaWMgdGF4b24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBzY2llbnRpZmljIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBzeXN0ZW1hdGljIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byB0ZWNobmljYWwgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdUbyBcdTIwMTMgbmF2aWdhdGlvbiBhbmQgZGlzYW1iaWd1YXRpb24nLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gYW5jaG9yJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gYW50aHJvcG9ueW15IHBhZ2UnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBkaXNhbWJpZ3VhdGlvbiBwYWdlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gbGlzdCBlbnRyeScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIHNlY3Rpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnVG8gbWlzY2VsbGFuZW91cycsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBkZWNhZGUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byByZWxhdGVkIHRvcGljJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gc3VicGFnZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIHN1YnRvcGljJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gVFYgZXBpc29kZSBsaXN0IGVudHJ5JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdDdXN0b20gLSBwcm9tcHQgbWUnLCB2YWx1ZTogJ2N1c3RvbScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE5vdyBjYXRlZ29yaWVzXG4gICAgICAgICAgICAgICAgJGV4dHJhLmh0bWwoXG4gICAgICAgICAgICAgICAgICAgICc8bGFiZWwgZm9yPVwiYWZjSGVscGVyX3JlZGlyZWN0X25hbWVfJyArXG4gICAgICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCI+Q2F0ZWdvcnkgbmFtZTogPC9sYWJlbD48aW5wdXQgdHlwZT1cInRleHRcIiBzaXplPVwiMTAwXCIgbmFtZT1cImFmY0hlbHBlcl9yZWRpcmVjdF9uYW1lXycgK1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1wiIGlkPVwiYWZjSGVscGVyX3JlZGlyZWN0X25hbWVfJyArXG4gICAgICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCIgdmFsdWU9XCInICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Ym1pc3Npb25zW2lkXS50aXRsZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCIgLz4nLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgJGV4dHJhLmh0bWwoXG4gICAgICAgICAgICAgICAgICAgICRleHRyYS5odG1sKCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJzxiciAvPjxsYWJlbCBmb3I9XCJhZmNIZWxwZXJfcmVkaXJlY3RfcGFyZW50c18nICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdcIj5QYXJlbnQgY2F0ZWdvcmllcyAoY29tbWEtc2VwYXJhdGVkKTo8L2xhYmVsPjxpbnB1dCB0eXBlPVwidGV4dFwiIHNpemU9XCIxMDBcIiBpZD1cImFmY0hlbHBlcl9yZWRpcmVjdF9wYXJlbnRzXycgK1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1wiIG5hbWU9XCJhZmNIZWxwZXJfcmVkaXJlY3RfcGFyZW50c18nICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdcIiB2YWx1ZT1cIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaWRdLnBhcmVudHMgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1wiIC8+JyxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICRleHRyYS5hcHBlbmQoJzxiciAvPicpO1xuICAgICAgICAgICAgICAgICRleHRyYS5hcHBlbmQoJCgnPGlucHV0PicsIHsgdHlwZTogJ2NoZWNrYm94JywgbmFtZTogJ2FmY0hlbHBlcl9yZWRpcmVjdF9jb250YWluZXJfJyArIGlkLCBpZDogJ2FmY0hlbHBlcl9yZWRpcmVjdF9jb250YWluZXJfJyArIGlkIH0pKTtcbiAgICAgICAgICAgICAgICAkZXh0cmEuYXBwZW5kKFxuICAgICAgICAgICAgICAgICAgICAnPGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb250YWluZXJfJyArIGlkICsgJ1wiPlRoaXMgaXMgYSA8YSBocmVmPVwiL3dpa2kvV2lraXBlZGlhOkNvbnRhaW5lcl9jYXRlZ29yeVwiIHRpdGxlPVwiV2lraXBlZGlhOkNvbnRhaW5lciBjYXRlZ29yeVwiPmNvbnRhaW5lciBjYXRlZ29yeTwvYT48L2xhYmVsPicsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbCgkZXh0cmEuaHRtbCgpICsgJzxiciAvPjxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBuYW1lPVwiYWZjSGVscGVyX3JlZGlyZWN0X2NvbnRhaW5lcl8nICsgaWQgKyAnXCInKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICRleHRyYS5odG1sKFxuICAgICAgICAgICAgICAgICRleHRyYS5odG1sKCkgK1xuICAgICAgICAgICAgICAgICAgICAnPGJyIC8+PGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb21tZW50XycgK1xuICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICdcIj5Db21tZW50OjwvbGFiZWw+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgc2l6ZT1cIjEwMFwiIGlkPVwiYWZjSGVscGVyX3JlZGlyZWN0X2NvbW1lbnRfJyArXG4gICAgICAgICAgICAgICAgICAgIGlkICtcbiAgICAgICAgICAgICAgICAgICAgJ1wiIG5hbWU9XCJhZmNIZWxwZXJfcmVkaXJlY3RfY29tbWVudF8nICtcbiAgICAgICAgICAgICAgICAgICAgaWQgK1xuICAgICAgICAgICAgICAgICAgICAnXCIvPicsXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdFZhbHVlID09PSAnZGVjbGluZScpIHtcbiAgICAgICAgICAgIGlmIChzdWJtaXNzaW9uc1tpZF0udHlwZSA9PT0gJ3JlZGlyZWN0Jykge1xuICAgICAgICAgICAgICAgICRleHRyYS5odG1sKFxuICAgICAgICAgICAgICAgICAgICAnPGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9kZWNsaW5lXycgK1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1wiPlJlYXNvbiBmb3IgZGVjbGluZTogPC9sYWJlbD4nICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdlbmVyYXRlU2VsZWN0KCdhZmNIZWxwZXJfcmVkaXJlY3RfZGVjbGluZV8nICsgaWQsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnQWxyZWFkeSBleGlzdHMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ2V4aXN0cycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnQmxhbmsgcmVxdWVzdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiAnYmxhbmsnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ05vIHZhbGlkIHRhcmdldCBzcGVjaWZpZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ25vLXRhcmdldCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnVW5saWtlbHkgc2VhcmNoIHRlcm0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ3VubGlrZWx5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdOb3QgYSByZWRpcmVjdCByZXF1ZXN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6ICdub3QtcmVkaXJlY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ0N1c3RvbSAtIHJlYXNvbiBiZWxvdycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ2N1c3RvbScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE5vdyBjYXRlZ29yaWVzXG4gICAgICAgICAgICAgICAgJGV4dHJhLmh0bWwoXG4gICAgICAgICAgICAgICAgICAgICc8bGFiZWwgZm9yPVwiYWZjSGVscGVyX3JlZGlyZWN0X2RlY2xpbmVfJyArXG4gICAgICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICAgICAnXCI+UmVhc29uIGZvciBkZWNsaW5lOiA8L2xhYmVsPicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVTZWxlY3QoJ2FmY0hlbHBlcl9yZWRpcmVjdF9kZWNsaW5lXycgKyBpZCwgW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdBbHJlYWR5IGV4aXN0cycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiAnZXhpc3RzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdCbGFuayByZXF1ZXN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6ICdibGFuaycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnVW5saWtlbHkgY2F0ZWdvcnknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ3VubGlrZWx5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdOb3QgYSBjYXRlZ29yeSByZXF1ZXN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6ICdub3QtY2F0ZWdvcnknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ0N1c3RvbSAtIHJlYXNvbiBiZWxvdycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ2N1c3RvbScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAkZXh0cmEuaHRtbChcbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbCgpICtcbiAgICAgICAgICAgICAgICAgICAgJzxici8+PGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb21tZW50XycgK1xuICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICdcIj5Db21tZW50OiA8L2xhYmVsPjxpbnB1dCB0eXBlPVwidGV4dFwiIHNpemU9XCIxMDBcIiBpZD1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb21tZW50XycgK1xuICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICdcIiBuYW1lPVwiYWZjSGVscGVyX3JlZGlyZWN0X2NvbW1lbnRfJyArXG4gICAgICAgICAgICAgICAgICAgIGlkICtcbiAgICAgICAgICAgICAgICAgICAgJ1wiLz4nLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChzZWxlY3RWYWx1ZSA9PT0gJ25vbmUnKSB7XG4gICAgICAgICAgICAvLyBGb3IgY2F0ZWdvcmllcyBhbmQgcmVkaXJlY3RzXG4gICAgICAgICAgICAkZXh0cmEuaHRtbCgnJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkZXh0cmEuaHRtbChcbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbCgpICtcbiAgICAgICAgICAgICAgICAgICAgJzxsYWJlbCBmb3I9XCJhZmNIZWxwZXJfcmVkaXJlY3RfY29tbWVudF8nICtcbiAgICAgICAgICAgICAgICAgICAgaWQgK1xuICAgICAgICAgICAgICAgICAgICAnXCI+Q29tbWVudDogPC9sYWJlbD48aW5wdXQgdHlwZT1cInRleHRcIiBzaXplPVwiMTAwXCIgaWQ9XCJhZmNIZWxwZXJfcmVkaXJlY3RfY29tbWVudF8nICtcbiAgICAgICAgICAgICAgICAgICAgaWQgK1xuICAgICAgICAgICAgICAgICAgICAnXCIgbmFtZT1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb21tZW50XycgK1xuICAgICAgICAgICAgICAgICAgICBpZCArXG4gICAgICAgICAgICAgICAgICAgICdcIi8+JyxcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQZXJmb3JtIHRoZSByZWRpcmVjdCBhY3Rpb25zIHNwZWNpZmllZCBieSB0aGUgdXNlclxuICAgICAqL1xuICAgIGFzeW5jIGZ1bmN0aW9uIHJlZGlyZWN0UGVyZm9ybUFjdGlvbnMoKSB7XG4gICAgICAgIC8vIExvYWQgYWxsIG9mIHRoZSBkYXRhXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3VibWlzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGFjdGlvbiA9ICQoJyNhZmNIZWxwZXJfcmVkaXJlY3RfYWN0aW9uXycgKyBpKS52YWwoKTtcbiAgICAgICAgICAgIHN1Ym1pc3Npb25zW2ldLmFjdGlvbiA9IGFjdGlvbjtcbiAgICAgICAgICAgIGlmIChhY3Rpb24gPT09ICdub25lJykgY29udGludWU7XG4gICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnYWNjZXB0Jykge1xuICAgICAgICAgICAgICAgIGlmIChzdWJtaXNzaW9uc1tpXS50eXBlID09PSAncmVkaXJlY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Ym1pc3Npb25zW2ldLnRpdGxlID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9mcm9tXycgKyBpKS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0udG8gPSAkKCcjYWZjSGVscGVyX3JlZGlyZWN0X3RvXycgKyBpKS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0uYXBwZW5kID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9hcHBlbmRfJyArIGkpLnZhbCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3VibWlzc2lvbnNbaV0uYXBwZW5kID09PSAnY3VzdG9tJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0uYXBwZW5kID0gcHJvbXB0KCdQbGVhc2UgZW50ZXIgdGhlIHRlbXBsYXRlIHRvIGFwcGVuZCB0byAnICsgc3VibWlzc2lvbnNbaV0udGl0bGUgKyAnLiBEbyBub3QgaW5jbHVkZSB0aGUgY3VybHkgYnJhY2tldHMuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Ym1pc3Npb25zW2ldLmFwcGVuZCA9PT0gJ25vbmUnIHx8IHN1Ym1pc3Npb25zW2ldLmFwcGVuZCA9PT0gbnVsbCkgc3VibWlzc2lvbnNbaV0uYXBwZW5kID0gJyc7XG4gICAgICAgICAgICAgICAgICAgIGVsc2Ugc3VibWlzc2lvbnNbaV0uYXBwZW5kID0gJ3t7JyArIHN1Ym1pc3Npb25zW2ldLmFwcGVuZCArICd9fSc7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0udGl0bGUgPSAkKCcjYWZjSGVscGVyX3JlZGlyZWN0X25hbWVfJyArIGkpLnZhbCgpO1xuICAgICAgICAgICAgICAgICAgICBzdWJtaXNzaW9uc1tpXS5wYXJlbnRzID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9wYXJlbnRzXycgKyBpKS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0uY29udGFpbmVyID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9jb250YWluZXJfJyArIGkpLmlzKCc6Y2hlY2tlZCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0aW9uID09PSAnZGVjbGluZScpIHtcbiAgICAgICAgICAgICAgICBzdWJtaXNzaW9uc1tpXS5yZWFzb24gPSAkKCcjYWZjSGVscGVyX3JlZGlyZWN0X2RlY2xpbmVfJyArIGkpLnZhbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0uY29tbWVudCA9ICQoJyNhZmNIZWxwZXJfcmVkaXJlY3RfY29tbWVudF8nICsgaSkudmFsKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRGF0YSBsb2FkZWQuIFNob3cgcHJvZ3Jlc3Mgc2NyZWVuIGFuZCBnZXQgV1A6QUZDL1JDIHBhZ2UgdGV4dFxuICAgICAgICBkaXNwbGF5TWVzc2FnZSgnPHVsIGlkPVwiYWZjSGVscGVyX3N0YXR1c1wiPjwvdWw+PHVsIGlkPVwiYWZjSGVscGVyX2ZpbmlzaFwiPjwvdWw+Jyk7XG4gICAgICAgIGNvbnN0IGFkZFN0YXR1cyA9IGZ1bmN0aW9uIChzdGF0dXMpIHtcbiAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuYXBwZW5kKHN0YXR1cyk7XG4gICAgICAgIH07XG4gICAgICAgICQoJyNhZmNIZWxwZXJfZmluaXNoJykuaHRtbChcbiAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfZmluaXNoJykuaHRtbCgpICtcbiAgICAgICAgICAgICAgICAnPHNwYW4gaWQ9XCJhZmNIZWxwZXJfZmluaXNoZWRfd3JhcHBlclwiPjxzcGFuIGlkPVwiYWZjSGVscGVyX2ZpbmlzaGVkX21haW5cIiBzdHlsZT1cImRpc3BsYXk6bm9uZVwiPjxsaSBpZD1cImFmY0hlbHBlcl9kb25lXCI+PGI+RG9uZSAoPGEgaHJlZj1cIicgK1xuICAgICAgICAgICAgICAgIG13LmNvbmZpZy5nZXQoJ3dnQXJ0aWNsZVBhdGgnKS5yZXBsYWNlKCckMScsIGVuY29kZVVSSShyZWRpcmVjdFBhZ2VOYW1lKSkgK1xuICAgICAgICAgICAgICAgICc/YWN0aW9uPXB1cmdlXCIgdGl0bGU9XCInICtcbiAgICAgICAgICAgICAgICByZWRpcmVjdFBhZ2VOYW1lICtcbiAgICAgICAgICAgICAgICAnXCI+UmVsb2FkIHBhZ2U8L2E+KTwvYj48L2xpPjwvc3Bhbj48L3NwYW4+JyxcbiAgICAgICAgKTtcbiAgICAgICAgbGV0IHBhZ2VUZXh0ID0gYXdhaXQgZ2V0UGFnZVRleHQocmVkaXJlY3RQYWdlTmFtZSwgYWRkU3RhdHVzKTtcbiAgICAgICAgbGV0IHRvdGFsQWNjZXB0ID0gMDtcbiAgICAgICAgbGV0IHRvdGFsRGVjbGluZSA9IDA7XG4gICAgICAgIGxldCB0b3RhbENvbW1lbnQgPSAwO1xuICAgICAgICAvLyBUcmF2ZXJzZSB0aGUgc3VibWlzc2lvbnMgYW5kIGxvY2F0ZSB0aGUgcmVsZXZhbnQgc2VjdGlvbnNcbiAgICAgICAgYWRkU3RhdHVzKCc8bGk+UHJvY2Vzc2luZyAnICsgcmVkaXJlY3RTdWJtaXNzaW9ucy5sZW5ndGggKyAnIHN1Ym1pc3Npb24nICsgKHJlZGlyZWN0U3VibWlzc2lvbnMubGVuZ3RoID09PSAxID8gJycgOiAncycpICsgJy4uLjwvbGk+Jyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVkaXJlY3RTdWJtaXNzaW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc3ViID0gcmVkaXJlY3RTdWJtaXNzaW9uc1tpXTtcbiAgICAgICAgICAgIGlmIChwYWdlVGV4dC5pbmRleE9mKHJlZGlyZWN0U2VjdGlvbnNbc3ViLnNlY3Rpb25dKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBTb21lb25lIGhhcyBtb2RpZmllZCB0aGUgc2VjdGlvbiBpbiB0aGUgbWVhbiB0aW1lLCBza2lwXG4gICAgICAgICAgICAgICAgYWRkU3RhdHVzKCc8bGk+U2tpcHBpbmcgJyArIHN1Yi50aXRsZSArICc6IENhbm5vdCBmaW5kIHNlY3Rpb24uIFBlcmhhcHMgaXQgd2FzIG1vZGlmaWVkIGluIHRoZSBtZWFuIHRpbWU/PC9saT4nKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCB0ZXh0ID0gcmVkaXJlY3RTZWN0aW9uc1tzdWIuc2VjdGlvbl07XG4gICAgICAgICAgICBjb25zdCBzdGFydEluZGV4ID0gcGFnZVRleHQuaW5kZXhPZihyZWRpcmVjdFNlY3Rpb25zW3N1Yi5zZWN0aW9uXSk7XG4gICAgICAgICAgICBjb25zdCBlbmRJbmRleCA9IHN0YXJ0SW5kZXggKyB0ZXh0Lmxlbmd0aDtcblxuICAgICAgICAgICAgLy8gRmlyc3QgZGVhbCB3aXRoIGNhdGVnb3JpZXNcbiAgICAgICAgICAgIGlmIChzdWIudHlwZSA9PT0gJ2NhdGVnb3J5Jykge1xuICAgICAgICAgICAgICAgIGlmIChzdWIuYWN0aW9uID09PSAnYWNjZXB0Jykge1xuICAgICAgICAgICAgICAgICAgICBsZXQgY2F0ZWdvcnlUZXh0ID0gJzwhLS1DcmVhdGVkIGJ5IFdQOkFGQyAtLT4nO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViLmNvbnRhaW5lcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnlUZXh0ICs9ICdcXG57e0NvbnRhaW5lciBjYXRlZ29yeX19JztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViLnBhcmVudHMgIT09ICcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeVRleHQgPSBzdWIucGFyZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zcGxpdCgnLCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoY2F0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnW1snICsgY2F0ICsgJ11dJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCdcXG4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlZGl0UGFnZShzdWIudGl0bGUsIGNhdGVnb3J5VGV4dCwgJ0NyZWF0ZWQgdmlhIFtbV1A6QUZDfEFydGljbGVzIGZvciBDcmVhdGlvbl1dJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhbGtUZXh0ID0gJ3t7c3Vic3Q6V1BBRkMvYXJ0aWNsZXxjbGFzcz1DYXR9fSc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhbGtUaXRsZSA9IG5ldyBtdy5UaXRsZShzdWIudGl0bGUpLmdldFRhbGtQYWdlKCkudG9UZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIGVkaXRQYWdlKHRhbGtUaXRsZSwgdGFsa1RleHQsICdQbGFjaW5nIFdQQUZDIHByb2plY3QgYmFubmVyJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IHRleHQubWF0Y2goLz09W149XSo9PS8pWzBdO1xuICAgICAgICAgICAgICAgICAgICB0ZXh0ID0gaGVhZGVyICsgJ1xcbnt7QWZDLWN8YX19XFxuJyArIHRleHQuc3Vic3RyaW5nKGhlYWRlci5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViLmNvbW1lbnQgIT09ICcnKSB0ZXh0ICs9ICdcXG4qe3tzdWJzdDphZmMgY2F0ZWdvcnl8YWNjZXB0fDI9JyArIHN1Yi5jb21tZW50ICsgJ319IH5+fn5cXG4nO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIHRleHQgKz0gJ1xcbip7e3N1YnN0OmFmYyBjYXRlZ29yeX19IH5+fn5cXG4nO1xuICAgICAgICAgICAgICAgICAgICB0ZXh0ICs9ICd7e0FmQy1jfGJ9fVxcbic7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsQWNjZXB0Kys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdWIuYWN0aW9uID09PSAnZGVjbGluZScpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyID0gdGV4dC5tYXRjaCgvPT1bXj1dKj09LylbMF07XG4gICAgICAgICAgICAgICAgICAgIGxldCByZWFzb24gPSBjYXRlZ29yeURlY2xpbmVSZWFzb25zW3N1Yi5yZWFzb25dO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSAnJykgcmVhc29uID0gc3ViLmNvbW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHN1Yi5jb21tZW50ICE9PSAnJykgcmVhc29uID0gcmVhc29uICsgJzogJyArIHN1Yi5jb21tZW50O1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSAnJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgJCgnYWZjSGVscGVyX3N0YXR1cycpLmh0bWwoJCgnI2FmY0hlbHBlcl9zdGF0dXMnKS5odG1sKCkgKyAnPGxpPlNraXBwaW5nICcgKyBzdWIudGl0bGUgKyAnOiBObyBkZWNsaW5lIHJlYXNvbiBzcGVjaWZpZWQuPC9saT4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRleHQgPSBoZWFkZXIgKyAnXFxue3tBZkMtY3xkfX1cXG4nICsgdGV4dC5zdWJzdHJpbmcoaGVhZGVyLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWIuY29tbWVudCA9PT0gJycpIHRleHQgKz0gJ1xcbip7e3N1YnN0OmFmYyBjYXRlZ29yeXwnICsgc3ViLnJlYXNvbiArICd9fSB+fn5+XFxuJztcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB0ZXh0ICs9ICdcXG4qe3tzdWJzdDphZmMgY2F0ZWdvcnl8ZGVjbGluZXwyPScgKyByZWFzb24gKyAnfX0gfn5+flxcbic7XG4gICAgICAgICAgICAgICAgICAgIHRleHQgKz0gJ3t7QWZDLWN8Yn19XFxuJztcbiAgICAgICAgICAgICAgICAgICAgdG90YWxEZWNsaW5lKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdWIuYWN0aW9uID09PSAnY29tbWVudCcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Yi5jb21tZW50ICE9PSAnJykgdGV4dCArPSAnXFxuXFxue3thZmMgY29tbWVudHwxPScgKyBzdWIuY29tbWVudCArICcgfn5+fn19XFxuJztcbiAgICAgICAgICAgICAgICAgICAgdG90YWxDb21tZW50Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBIYW5kbGUgcmVkaXJlY3RzXG4gICAgICAgICAgICAgICAgbGV0IGFjY2VwdENvbW1lbnQgPSAnJztcbiAgICAgICAgICAgICAgICBsZXQgZGVjbGluZUNvbW1lbnQgPSAnJztcbiAgICAgICAgICAgICAgICBsZXQgb3RoZXJDb21tZW50ID0gJyc7XG4gICAgICAgICAgICAgICAgbGV0IGFjY2VwdENvdW50ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgZGVjbGluZUNvdW50ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgY29tbWVudENvdW50ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgaGFzQ29tbWVudCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc3ViLmZyb20ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVkaXJlY3QgPSBzdWIuZnJvbVtqXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZGlyZWN0LmFjdGlvbiA9PT0gJ2FjY2VwdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlZGlyZWN0VGV4dCA9IGAjUkVESVJFQ1QgW1ske3JlZGlyZWN0LnRvfV1dJHtyZWRpcmVjdC5hcHBlbmQgPyBgXFxuXFxue3tSZWRpcmVjdCBjYXRlZ29yeSBzaGVsbHxcXG4ke3JlZGlyZWN0LmFwcGVuZH1cXG59fWAgOiAnJ31gO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWRpdFBhZ2UocmVkaXJlY3QudGl0bGUsIHJlZGlyZWN0VGV4dCwgJ1JlZGlyZWN0ZWQgcGFnZSB0byBbWycgKyByZWRpcmVjdC50byArICddXSB2aWEgW1tXUDpBRkN8QXJ0aWNsZXMgZm9yIENyZWF0aW9uXV0nLCB0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdUaXRsZSA9IG5ldyBtdy5UaXRsZShyZWRpcmVjdC50aXRsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW13VGl0bGUuaXNUYWxrUGFnZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbXdUYWxrVGl0bGUgPSBtd1RpdGxlLmdldFRhbGtQYWdlKCkudG9UZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFsa1RleHQgPSAne3tzdWJzdDpXUEFGQy9yZWRpcmVjdH19JztcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVkaXRQYWdlKG13VGFsa1RpdGxlLCB0YWxrVGV4dCwgJ1BsYWNpbmcgV1BBRkMgcHJvamVjdCBiYW5uZXInLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2VwdENvbW1lbnQgKz0gcmVkaXJlY3QudGl0bGUgKyAnICZyYXJyOyAnICsgcmVkaXJlY3QudG87XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVkaXJlY3QuY29tbWVudCAhPT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDb21tZW50ICs9ICc6ICcgKyByZWRpcmVjdC5jb21tZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhc0NvbW1lbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDb21tZW50ICs9ICcuICc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlZGlyZWN0LmFjdGlvbiA9PT0gJ2RlY2xpbmUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgcmVhc29uID0gcmVkaXJlY3REZWNsaW5lUmVhc29uc1tyZWRpcmVjdC5yZWFzb25dO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gJycpIHJlYXNvbiA9IHJlZGlyZWN0LmNvbW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChyZWRpcmVjdC5jb21tZW50ICE9PSAnJykgcmVhc29uID0gcmVhc29uICsgJzogJyArIHJlZGlyZWN0LmNvbW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSAnJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuaHRtbCgkKCcjYWZjSGVscGVyX3N0YXR1cycpLmh0bWwoKSArICc8bGk+U2tpcHBpbmcgJyArIHJlZGlyZWN0LnRpdGxlICsgJzogTm8gZGVjbGluZSByZWFzb24gc3BlY2lmaWVkLjwvbGk+Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNsaW5lQ29tbWVudCArPSByZWRpcmVjdC5yZWFzb24gPT09ICdibGFuaycgfHwgcmVkaXJlY3QucmVhc29uID09PSAnbm90LXJlZGlyZWN0JyA/IHJlYXNvbiArICcuICcgOiByZWRpcmVjdC50aXRsZSArICcgJnJhcnI7ICcgKyByZWRpcmVjdC50byArICc6ICcgKyByZWFzb24gKyAnLiAnO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVjbGluZUNvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVkaXJlY3QuYWN0aW9uID09PSAnY29tbWVudCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG90aGVyQ29tbWVudCArPSByZWRpcmVjdC50aXRsZSArICc6ICcgKyByZWRpcmVjdC5jb21tZW50ICsgJy4gJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbW1lbnRDb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCByZWFzb24gPSAnJztcblxuICAgICAgICAgICAgICAgIGlmIChhY2NlcHRDb3VudCA+IDApIHJlYXNvbiArPSAnXFxuKnt7c3Vic3Q6YWZjIHJlZGlyZWN0fGFjY2VwdHwyPScgKyBhY2NlcHRDb21tZW50ICsgJyBUaGFuayB5b3UgZm9yIHlvdXIgY29udHJpYnV0aW9ucyB0byBXaWtpcGVkaWEhfX0gfn5+fic7XG4gICAgICAgICAgICAgICAgaWYgKGRlY2xpbmVDb3VudCA+IDApIHJlYXNvbiArPSAnXFxuKnt7c3Vic3Q6YWZjIHJlZGlyZWN0fGRlY2xpbmV8Mj0nICsgZGVjbGluZUNvbW1lbnQgKyAnfX0gfn5+fic7XG4gICAgICAgICAgICAgICAgaWYgKGNvbW1lbnRDb3VudCA+IDApIHJlYXNvbiArPSAnXFxuKnt7YWZjIGNvbW1lbnR8MT0nICsgb3RoZXJDb21tZW50ICsgJ35+fn59fSc7XG4gICAgICAgICAgICAgICAgcmVhc29uICs9ICdcXG4nO1xuICAgICAgICAgICAgICAgIGlmICghaGFzQ29tbWVudCAmJiBhY2NlcHRDb3VudCA9PT0gc3ViLmZyb20ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhY2NlcHRDb3VudCA+IDEpIHJlYXNvbiA9ICdcXG4qe3tzdWJzdDphZmMgcmVkaXJlY3R8YWxsfX0gfn5+flxcbic7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgcmVhc29uID0gJ1xcbip7e3N1YnN0OmFmYyByZWRpcmVjdH19IH5+fn5cXG4nO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q291bnQgKyBkZWNsaW5lQ291bnQgKyBjb21tZW50Q291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhY2NlcHRDb3VudCArIGRlY2xpbmVDb3VudCA9PT0gc3ViLmZyb20ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBFdmVyeSByZXF1ZXN0IGhhbmRsZWQsIGNsb3NlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXIgPSB0ZXh0Lm1hdGNoKC89PVtePV0qPT0vKVswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhY2NlcHRDb3VudCA+IDAgJiYgZGVjbGluZUNvdW50ID4gMCkgdGV4dCA9IGhlYWRlciArICdcXG57e0FmQy1jfHB9fScgKyB0ZXh0LnN1YnN0cmluZyhoZWFkZXIubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGFjY2VwdENvdW50ID4gMCkgdGV4dCA9IGhlYWRlciArICdcXG57e0FmQy1jfGF9fScgKyB0ZXh0LnN1YnN0cmluZyhoZWFkZXIubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgdGV4dCA9IGhlYWRlciArICdcXG57e0FmQy1jfGR9fScgKyB0ZXh0LnN1YnN0cmluZyhoZWFkZXIubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHQgKz0gcmVhc29uO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGV4dCArPSAne3tBZkMtY3xifX1cXG4nO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgdGV4dCArPSByZWFzb24gKyAnXFxuJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdG90YWxBY2NlcHQgKz0gYWNjZXB0Q291bnQ7XG4gICAgICAgICAgICAgICAgdG90YWxEZWNsaW5lICs9IGRlY2xpbmVDb3VudDtcbiAgICAgICAgICAgICAgICB0b3RhbENvbW1lbnQgKz0gY29tbWVudENvdW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGFnZVRleHQgPSBwYWdlVGV4dC5zdWJzdHJpbmcoMCwgc3RhcnRJbmRleCkgKyB0ZXh0ICsgcGFnZVRleHQuc3Vic3RyaW5nKGVuZEluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdW1tYXJ5ID0gJ1VwZGF0aW5nIHN1Ym1pc3Npb24gc3RhdHVzOic7XG4gICAgICAgIGlmICh0b3RhbEFjY2VwdCA+IDApIHN1bW1hcnkgKz0gJyBhY2NlcHRpbmcgJyArIHRvdGFsQWNjZXB0ICsgJyByZXF1ZXN0JyArICh0b3RhbEFjY2VwdCA+IDEgPyAncycgOiAnJyk7XG4gICAgICAgIGlmICh0b3RhbERlY2xpbmUgPiAwKSB7XG4gICAgICAgICAgICBpZiAodG90YWxBY2NlcHQgPiAwKSBzdW1tYXJ5ICs9ICcsJztcbiAgICAgICAgICAgIHN1bW1hcnkgKz0gJyBkZWNsaW5pbmcgJyArIHRvdGFsRGVjbGluZSArICcgcmVxdWVzdCcgKyAodG90YWxEZWNsaW5lID4gMSA/ICdzJyA6ICcnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodG90YWxDb21tZW50ID4gMCkge1xuICAgICAgICAgICAgaWYgKHRvdGFsQWNjZXB0ID4gMCB8fCB0b3RhbERlY2xpbmUgPiAwKSBzdW1tYXJ5ICs9ICcsJztcbiAgICAgICAgICAgIHN1bW1hcnkgKz0gJyBjb21tZW50aW5nIG9uICcgKyB0b3RhbENvbW1lbnQgKyAnIHJlcXVlc3QnICsgKHRvdGFsQ29tbWVudCA+IDEgPyAncycgOiAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICBlZGl0UGFnZShyZWRpcmVjdFBhZ2VOYW1lLCBwYWdlVGV4dCwgc3VtbWFyeSwgZmFsc2UpO1xuXG4gICAgICAgIC8vIERpc3BsYXkgdGhlIFwiRG9uZVwiIHRleHQgb25seSBhZnRlciBhbGwgYWpheCByZXF1ZXN0cyBhcmUgY29tcGxldGVkXG4gICAgICAgICQoZG9jdW1lbnQpLmFqYXhTdG9wKCgpID0+IHtcbiAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfZmluaXNoZWRfbWFpbicpLmNzcygnZGlzcGxheScsICcnKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdGV4dCBvZiBhIHBhZ2VcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGl0bGUgdGhlIHRpdGxlIG9mIHRoZSBwYWdlIHRvIGdldFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGFkZFN0YXR1cyBhIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSBIVE1MIHN0cmluZyB0byByZXBvcnQgc3RhdHVzXG4gICAgICogQHJldHVybnMge3N0cmluZ30gdGhlIHRleHQgb2YgdGhlIHBhZ2VcbiAgICAgKi9cbiAgICBhc3luYyBmdW5jdGlvbiBnZXRQYWdlVGV4dCh0aXRsZSwgYWRkU3RhdHVzKSB7XG4gICAgICAgIGFkZFN0YXR1cyA9IHR5cGVvZiBhZGRTdGF0dXMgIT09ICd1bmRlZmluZWQnID8gYWRkU3RhdHVzIDogZnVuY3Rpb24gKCkge307IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWVtcHR5LWZ1bmN0aW9uXG4gICAgICAgIGFkZFN0YXR1cyhcbiAgICAgICAgICAgICc8bGkgaWQ9XCJhZmNIZWxwZXJfZ2V0JyArIGpxRXNjYXBlKHRpdGxlKSArICdcIj5HZXR0aW5nIDxhIGhyZWY9XCInICsgbXcuY29uZmlnLmdldCgnd2dBcnRpY2xlUGF0aCcpLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgKyAnXCIgdGl0bGU9XCInICsgdGl0bGUgKyAnXCI+JyArIHRpdGxlICsgJzwvYT48L2xpPicsXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gY29uc3QgcmVxdWVzdCA9IHtcbiAgICAgICAgLy8gICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgLy8gICAgIHByb3A6ICdyZXZpc2lvbnMnLFxuICAgICAgICAvLyAgICAgcnZwcm9wOiAnY29udGVudCcsXG4gICAgICAgIC8vICAgICBmb3JtYXQ6ICdqc29uJyxcbiAgICAgICAgLy8gICAgIGluZGV4cGFnZWlkczogdHJ1ZSxcbiAgICAgICAgLy8gICAgIHRpdGxlczogdGl0bGUsXG4gICAgICAgIC8vIH07XG5cbiAgICAgICAgLy8gY29uc3QgcmVzcG9uc2UgPSBKU09OLnBhcnNlKFxuICAgICAgICAvLyAgICAgJC5hamF4KHtcbiAgICAgICAgLy8gICAgICAgICB1cmw6IG13LnV0aWwud2lraVNjcmlwdCgnYXBpJyksXG4gICAgICAgIC8vICAgICAgICAgZGF0YTogcmVxdWVzdCxcbiAgICAgICAgLy8gICAgICAgICBhc3luYzogZmFsc2UsXG4gICAgICAgIC8vICAgICB9KS5yZXNwb25zZVRleHQsXG4gICAgICAgIC8vICk7XG5cbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHsgYWN0aW9uOiAncXVlcnknLCBwcm9wOiAncmV2aXNpb25zJywgcnZwcm9wOiAnY29udGVudCcsIGZvcm1hdDogJ2pzb24nLCBpbmRleHBhZ2VpZHM6IHRydWUsIHRpdGxlczogdGl0bGUgfSk7XG5cbiAgICAgICAgY29uc3QgcGFnZUlkID0gcmVzcG9uc2UucXVlcnkucGFnZWlkc1swXTtcbiAgICAgICAgaWYgKHBhZ2VJZCA9PT0gJy0xJykge1xuICAgICAgICAgICAgYWRkU3RhdHVzKCdUaGUgcGFnZSA8YSBjbGFzcz1cIm5ld1wiIGhyZWY9XCInICsgbXcuY29uZmlnLmdldCgnd2dBcnRpY2xlUGF0aCcpLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgKyAnXCIgdGl0bGU9XCInICsgdGl0bGUgKyAnXCI+JyArIHRpdGxlICsgJzwvYT4gZG9lcyBub3QgZXhpc3QnKTtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuZXdUZXh0ID0gcmVzcG9uc2UucXVlcnkucGFnZXNbcGFnZUlkXS5yZXZpc2lvbnNbMF1bJyonXTtcbiAgICAgICAgYWRkU3RhdHVzKCc8bGkgaWQ9XCJhZmNIZWxwZXJfZ2V0JyArIGpxRXNjYXBlKHRpdGxlKSArICdcIj5Hb3QgPGEgaHJlZj1cIicgKyBtdy5jb25maWcuZ2V0KCd3Z0FydGljbGVQYXRoJykucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSArICdcIiB0aXRsZT1cIicgKyB0aXRsZSArICdcIj4nICsgdGl0bGUgKyAnPC9hPjwvbGk+Jyk7XG4gICAgICAgIHJldHVybiBuZXdUZXh0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFucyB1cCB0aGUgbGlua3MgaW4gYSBwYWdlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgdGhlIHBhZ2UgY29udGVudFxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBwYWdlIGNvbnRlbnQgd2l0aCB0aGUgbGlua3MgY2xlYW5lZCB1cFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNsZWFudXBMaW5rcyh0ZXh0KSB7XG4gICAgICAgIC8vIENvbnZlcnQgZXh0ZXJuYWwgbGlua3MgdG8gV2lraXBlZGlhIGFydGljbGVzIHRvIHByb3BlciB3aWtpbGlua3NcbiAgICAgICAgY29uc3Qgd2lraWxpbmtSZWdleCA9IC8oXFxbKXsxLDJ9KD86aHR0cHM/Oik/XFwvXFwvKGVuLndpa2lwZWRpYS5vcmdcXC93aWtpfGVud3Aub3JnKVxcLyhbXlxcc3xcXF1bXSspKFxcc3xcXHwpPygoPzpcXFtcXFtbXltcXF1dKlxcXVxcXXxbXlxcXVtdKSopKFxcXSl7MSwyfS9naTtcbiAgICAgICAgY29uc3QgdGVtcFRleHQgPSB0ZXh0O1xuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSB3aWtpbGlua1JlZ2V4LmV4ZWModGVtcFRleHQpKSkge1xuICAgICAgICAgICAgY29uc3QgcGFnZU5hbWUgPSBkZWNvZGVVUkkobWF0Y2hbM10ucmVwbGFjZSgvXy9nLCAnICcpKTtcbiAgICAgICAgICAgIGxldCBkaXNwbGF5bmFtZSA9IGRlY29kZVVSSShtYXRjaFs1XS5yZXBsYWNlKC9fL2csICcgJykpO1xuICAgICAgICAgICAgaWYgKHBhZ2VOYW1lID09PSBkaXNwbGF5bmFtZSkgZGlzcGxheW5hbWUgPSAnJztcbiAgICAgICAgICAgIGNvbnN0IHJlcGxhY2VUZXh0ID0gJ1tbJyArIHBhZ2VOYW1lICsgKGRpc3BsYXluYW1lID8gJ3wnICsgZGlzcGxheW5hbWUgOiAnJykgKyAnXV0nO1xuICAgICAgICAgICAgdGV4dCA9IHRleHQucmVwbGFjZShtYXRjaFswXSwgcmVwbGFjZVRleHQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0ZXh0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlcyB0aGUgc2VsZWN0IGVsZW1lbnQgb3V0ZXIgSFRNTCBmb3IgYSByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIHRoZSBwYWdlIHRpdGxlXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gb3B0aW9ucyB0aGUgc2VsZWN0IGVsZW1lbnQgb3B0aW9uc1xuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBzZWxlY3QgZWxlbWVudCBvdXRlciBIVE1MXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVTZWxlY3QodGl0bGUsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlU2VsZWN0T2JqZWN0KHRpdGxlLCBvcHRpb25zKS5wcm9wKCdvdXRlckhUTUwnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgYSBzZWxlY3QgZWxlbWVudCBmb3IgYSByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIHRoZSBwYWdlIHRpdGxlXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gb3B0aW9ucyB0aGUgc2VsZWN0IGVsZW1lbnQgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uY2hhbmdlIHRoZSBvbmNoYW5nZSBmdW5jdGlvblxuICAgICAqIEByZXR1cm5zIHsqfSB0aGUgc2VsZWN0IGpRdWVyeSBlbGVtZW50XG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVTZWxlY3RPYmplY3QodGl0bGUsIG9wdGlvbnMsIG9uY2hhbmdlKSB7XG4gICAgICAgIGNvbnN0ICRzZWxlY3QgPSAkKCc8c2VsZWN0PicpLmF0dHIoJ25hbWUnLCB0aXRsZSkuYXR0cignaWQnLCB0aXRsZSk7XG4gICAgICAgIGlmIChvbmNoYW5nZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgJHNlbGVjdC5jaGFuZ2Uob25jaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICAgIG9wdGlvbnMuZm9yRWFjaCgob3B0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAob3B0aW9uLmxhYmVsQW5kVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBvcHRpb24udmFsdWUgPSBvcHRpb24ubGFiZWxBbmRWYWx1ZTtcbiAgICAgICAgICAgICAgICBvcHRpb24ubGFiZWwgPSBvcHRpb24ubGFiZWxBbmRWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0ICRvcHRpb24gPSAkKCc8b3B0aW9uPicpLmFwcGVuZFRvKCRzZWxlY3QpLnZhbChvcHRpb24udmFsdWUpLnRleHQob3B0aW9uLmxhYmVsKTtcbiAgICAgICAgICAgIGlmIChvcHRpb24uc2VsZWN0ZWQpICRvcHRpb24uYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcbiAgICAgICAgICAgIGlmIChvcHRpb24uZGlzYWJsZWQpICRvcHRpb24uYXR0cignZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiAkc2VsZWN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBvbGQgbXcudXRpbC5qc01lc3NhZ2UgZnVuY3Rpb24gYmVmb3JlIGh0dHBzOi8vZ2Vycml0Lndpa2ltZWRpYS5vcmcvci8jL2MvMTc2MDUvLCB3aGljaFxuICAgICAqIGludHJvZHVjZWQgdGhlIHNpbGx5IGF1dG8taGlkZSBmdW5jdGlvbi4gQWxzbyB3aXRoIHRoZSBvcmlnaW5hbCBzdHlsZXMuXG4gICAgICogQWRkIGEgbGl0dGxlIGJveCBhdCB0aGUgdG9wIG9mIHRoZSBzY3JlZW4gdG8gaW5mb3JtIHRoZSB1c2VyIG9mXG4gICAgICogc29tZXRoaW5nLCByZXBsYWNpbmcgYW55IHByZXZpb3VzIG1lc3NhZ2UuXG4gICAgICogQ2FsbGluZyB3aXRoIG5vIGFyZ3VtZW50cywgd2l0aCBhbiBlbXB0eSBzdHJpbmcgb3IgbnVsbCB3aWxsIGhpZGUgdGhlIG1lc3NhZ2VcbiAgICAgKiBUYWtlbiBmcm9tIFtbVXNlcjpUaW1vdGhldXMgQ2FuZW5zL2Rpc3BsYXltZXNzYWdlLmpzXV1cbiAgICAgKiBAcGFyYW0geyp9IG1lc3NhZ2UgVGhlIERPTS1lbGVtZW50LCBqUXVlcnkgb2JqZWN0IG9yIEhUTUwtc3RyaW5nIHRvIGJlIHB1dCBpbnNpZGUgdGhlIG1lc3NhZ2UgYm94LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjbGFzc05hbWUgVXNlZCBpbiBhZGRpbmcgYSBjbGFzczsgc2hvdWxkIGJlIGRpZmZlcmVudCBmb3IgZWFjaCBjYWxsIHRvIGFsbG93IENTUy9KUyB0byBoaWRlIGRpZmZlcmVudCBib3hlcy4gbnVsbCA9IG5vIGNsYXNzIHVzZWQuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgb24gc3VjY2VzcywgZmFsc2Ugb24gZmFpbHVyZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBkaXNwbGF5TWVzc2FnZShtZXNzYWdlLCBjbGFzc05hbWUpIHtcbiAgICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoIHx8IG1lc3NhZ2UgPT09ICcnIHx8IG1lc3NhZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgICQoJyNkaXNwbGF5LW1lc3NhZ2UnKS5lbXB0eSgpLmhpZGUoKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBFbXB0eWluZyBhbmQgaGlkaW5nIG1lc3NhZ2UgaXMgaW50ZW5kZWQgYmVoYXZpb3VyLCByZXR1cm4gdHJ1ZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gV2Ugc3BlY2lhbC1jYXNlIHNraW4gc3RydWN0dXJlcyBwcm92aWRlZCBieSB0aGUgc29mdHdhcmUuIFNraW5zIHRoYXRcbiAgICAgICAgICAgIC8vIGNob29zZSB0byBhYmFuZG9uIG9yIHNpZ25pZmljYW50bHkgbW9kaWZ5IG91ciBmb3JtYXR0aW5nIGNhbiBqdXN0IGRlZmluZVxuICAgICAgICAgICAgLy8gYW4gbXctanMtbWVzc2FnZSBkaXYgdG8gc3RhcnQgd2l0aC5cbiAgICAgICAgICAgIGxldCAkbWVzc2FnZURpdiA9ICQoJyNkaXNwbGF5LW1lc3NhZ2UnKTtcbiAgICAgICAgICAgIGlmICghJG1lc3NhZ2VEaXYubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgJG1lc3NhZ2VEaXYgPSAkKCc8ZGl2IGlkPVwiZGlzcGxheS1tZXNzYWdlXCIgc3R5bGU9XCJtYXJnaW46MWVtO3BhZGRpbmc6MC41ZW0gMi41JTtib3JkZXI6c29saWQgMXB4ICNkZGQ7YmFja2dyb3VuZC1jb2xvcjojZmNmY2ZjO2ZvbnQtc2l6ZTogMC44ZW1cIj48L2Rpdj4nKTtcbiAgICAgICAgICAgICAgICBpZiAobXcudXRpbC4kY29udGVudC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbXcudXRpbC4kY29udGVudC5wcmVwZW5kKCRtZXNzYWdlRGl2KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNsYXNzTmFtZSkgJG1lc3NhZ2VEaXYucHJvcCgnY2xhc3MnLCAnZGlzcGxheS1tZXNzYWdlLScgKyBjbGFzc05hbWUpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBtZXNzYWdlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICRtZXNzYWdlRGl2LmVtcHR5KCk7XG4gICAgICAgICAgICAgICAgJG1lc3NhZ2VEaXYuYXBwZW5kKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSBlbHNlICRtZXNzYWdlRGl2Lmh0bWwobWVzc2FnZSk7XG4gICAgICAgICAgICAkbWVzc2FnZURpdlswXS5zY3JvbGxJbnRvVmlldygpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFc2NhcGVzIGEgc3RyaW5nIGZvciB1c2UgaW4galF1ZXJ5IHNlbGVjdG9yc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBleHByZXNzaW9uIHRoZSBleHByZXNzaW9uIHRvIGVzY2FwZVxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBlc2NhcGVkIGV4cHJlc3Npb25cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBqcUVzY2FwZShleHByZXNzaW9uKSB7XG4gICAgICAgIHJldHVybiBleHByZXNzaW9uLnJlcGxhY2UoL1shXCIjJCUmJygpKissLi86Ozw9Pj9AW1xcXFxcXF1eYHt8fX4gXS9nLCAnJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWRpdHMgYSBnaXZlbiBwYWdlLCBhbmQgdXBkYXRlcyB0aGUgVUlcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGl0bGUgdGhlIHBhZ2UgdGl0bGUgdG8gZWRpdFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuZXdUZXh0IHRoZSBuZXcgdGV4dCB0byBpbnNlcnRcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3VtbWFyeSB0aGUgZWRpdCBzdW1tYXJ5XG4gICAgICogQHBhcmFtIHtib29sZWFufSBjcmVhdGVPbmx5IHdoZXRoZXIgdG8gb25seSBjcmVhdGUgdGhlIHBhZ2UgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbm9QYXRyb2wgd2hldGhlciB0byBub3QgbWFyayB0aGUgZWRpdCBhcyBwYXRyb2xsZWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBlZGl0UGFnZSh0aXRsZSwgbmV3VGV4dCwgc3VtbWFyeSwgY3JlYXRlT25seSwgbm9QYXRyb2wpIHtcbiAgICAgICAgY29uc3Qgd2dBcnRpY2xlUGF0aCA9IG13LmNvbmZpZy5nZXQoJ3dnQXJ0aWNsZVBhdGgnKTtcbiAgICAgICAgc3VtbWFyeSArPSBzdW1tYXJ5QWR2ZXJ0O1xuICAgICAgICAkKCcjYWZjSGVscGVyX2ZpbmlzaGVkX3dyYXBwZXInKS5odG1sKCc8c3BhbiBpZD1cImFmY0hlbHBlcl9BSkFYX2ZpbmlzaGVkXycgKyBhamF4TnVtYmVyICsgJ1wiIHN0eWxlPVwiZGlzcGxheTpub25lXCI+JyArICQoJyNhZmNIZWxwZXJfZmluaXNoZWRfd3JhcHBlcicpLmh0bWwoKSArICc8L3NwYW4+Jyk7XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uSWQgPSBhamF4TnVtYmVyO1xuICAgICAgICBhamF4TnVtYmVyKys7XG4gICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuaHRtbChcbiAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuaHRtbCgpICtcbiAgICAgICAgICAgICAgICAnPGxpIGlkPVwiYWZjSGVscGVyX2VkaXQnICtcbiAgICAgICAgICAgICAgICBqcUVzY2FwZSh0aXRsZSkgK1xuICAgICAgICAgICAgICAgICdcIj5FZGl0aW5nIDxhIGhyZWY9XCInICtcbiAgICAgICAgICAgICAgICB3Z0FydGljbGVQYXRoLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgK1xuICAgICAgICAgICAgICAgICdcIiB0aXRsZT1cIicgK1xuICAgICAgICAgICAgICAgIHRpdGxlICtcbiAgICAgICAgICAgICAgICAnXCI+JyArXG4gICAgICAgICAgICAgICAgdGl0bGUgK1xuICAgICAgICAgICAgICAgICc8L2E+PC9saT4nLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0ge1xuICAgICAgICAgICAgYWN0aW9uOiAnZWRpdCcsXG4gICAgICAgICAgICB0aXRsZSxcbiAgICAgICAgICAgIHRleHQ6IG5ld1RleHQsXG4gICAgICAgICAgICBzdW1tYXJ5LFxuICAgICAgICB9O1xuICAgICAgICBpZiAoY3JlYXRlT25seSkgcmVxdWVzdC5jcmVhdGVvbmx5ID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBhcGkgPSBuZXcgbXcuQXBpKCk7XG4gICAgICAgIGFwaS5wb3N0V2l0aEVkaXRUb2tlbihyZXF1ZXN0KVxuICAgICAgICAgICAgLmRvbmUoKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YSAmJiBkYXRhLmVkaXQgJiYgZGF0YS5lZGl0LnJlc3VsdCAmJiBkYXRhLmVkaXQucmVzdWx0ID09PSAnU3VjY2VzcycpIHtcbiAgICAgICAgICAgICAgICAgICAgJCgnI2FmY0hlbHBlcl9lZGl0JyArIGpxRXNjYXBlKHRpdGxlKSkuaHRtbCgnU2F2ZWQgPGEgaHJlZj1cIicgKyB3Z0FydGljbGVQYXRoLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgKyAnXCIgdGl0bGU9XCInICsgdGl0bGUgKyAnXCI+JyArIHRpdGxlICsgJzwvYT4nKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAkKCcjYWZjSGVscGVyX2VkaXQnICsganFFc2NhcGUodGl0bGUpKS5odG1sKFxuICAgICAgICAgICAgICAgICAgICAgICAgJzxzcGFuIGNsYXNzPVwiYWZjSGVscGVyX25vdGljZVwiPjxiPkVkaXQgZmFpbGVkIG9uIDxhIGhyZWY9XCInICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3Z0FydGljbGVQYXRoLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdcIiB0aXRsZT1cIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXCI+JyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGUgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICc8L2E+PC9iPjwvc3Bhbj4uIEVycm9yIGluZm86ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGRhdGEpLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFZGl0IGZhaWxlZCBvbiAlcyAoJXMpLiBFcnJvciBpbmZvOiAlcycsIHdnQXJ0aWNsZVBhdGgucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSwgdGl0bGUsIEpTT04uc3RyaW5naWZ5KGRhdGEpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmZhaWwoKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGNyZWF0ZU9ubHkgJiYgZXJyb3IgPT09ICdhcnRpY2xlZXhpc3RzJylcbiAgICAgICAgICAgICAgICAgICAgJCgnI2FmY0hlbHBlcl9lZGl0JyArIGpxRXNjYXBlKHRpdGxlKSkuaHRtbChcbiAgICAgICAgICAgICAgICAgICAgICAgICc8c3BhbiBjbGFzcz1cImFmY0hlbHBlcl9ub3RpY2VcIj48Yj5FZGl0IGZhaWxlZCBvbiA8YSBocmVmPVwiJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2dBcnRpY2xlUGF0aC5yZXBsYWNlKCckMScsIGVuY29kZVVSSSh0aXRsZSkpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXCIgdGl0bGU9XCInICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1wiPicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPC9hPjwvYj48L3NwYW4+LiBFcnJvciBpbmZvOiBUaGUgYXJ0aWNsZSBhbHJlYWR5IGV4aXN0cyEnLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgJCgnI2FmY0hlbHBlcl9lZGl0JyArIGpxRXNjYXBlKHRpdGxlKSkuaHRtbChcbiAgICAgICAgICAgICAgICAgICAgICAgICc8c3BhbiBjbGFzcz1cImFmY0hlbHBlcl9ub3RpY2VcIj48Yj5FZGl0IGZhaWxlZCBvbiA8YSBocmVmPVwiJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2dBcnRpY2xlUGF0aC5yZXBsYWNlKCckMScsIGVuY29kZVVSSSh0aXRsZSkpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnXCIgdGl0bGU9XCInICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1wiPicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPC9hPjwvYj48L3NwYW4+LiBFcnJvciBpbmZvOiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcixcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuYWx3YXlzKCgpID0+IHtcbiAgICAgICAgICAgICAgICAkKCcjYWZjSGVscGVyX0FKQVhfZmluaXNoZWRfJyArIGZ1bmN0aW9uSWQpLmNzcygnZGlzcGxheScsICcnKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIGlmICghbm9QYXRyb2wpIHtcbiAgICAgICAgICAgIC8qIFdlIHBhdHJvbCBieSBkZWZhdWx0ICovXG4gICAgICAgICAgICBpZiAoJCgnLnBhdHJvbGxpbmsnKS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IHRoZSByY2lkIHRva2VuIGZyb20gdGhlIFwiTWFyayBwYWdlIGFzIHBhdHJvbGxlZFwiIGxpbmsgb24gcGFnZVxuICAgICAgICAgICAgICAgIGNvbnN0IHBhdHJvbEhyZWYgPSAkKCcucGF0cm9sbGluayBhJykuYXR0cignaHJlZicpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJjSWQgPSBtdy51dGlsLmdldFBhcmFtVmFsdWUoJ3JjaWQnLCBwYXRyb2xIcmVmKTtcblxuICAgICAgICAgICAgICAgIGlmIChyY0lkKSB7XG4gICAgICAgICAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuaHRtbChcbiAgICAgICAgICAgICAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuaHRtbCgpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPGxpIGlkPVwiYWZjSGVscGVyX3BhdHJvbCcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpxRXNjYXBlKHRpdGxlKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1wiPk1hcmtpbmcgPGEgaHJlZj1cIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdnQXJ0aWNsZVBhdGgucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1wiIHRpdGxlPVwiJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGUgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdcIj4nICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJyBhcyBwYXRyb2xsZWQ8L2E+PC9saT4nLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXRyb2xSZXF1ZXN0ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiAncGF0cm9sJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvcm1hdDogJ2pzb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmNpZDogcmNJZCxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgYXBpLnBvc3RXaXRoVG9rZW4oJ3BhdHJvbCcsIHBhdHJvbFJlcXVlc3QpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZG9uZSgoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfcGF0cm9sJyArIGpxRXNjYXBlKHRpdGxlKSkuaHRtbChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdNYXJrZWQgPGEgaHJlZj1cIicgKyB3Z0FydGljbGVQYXRoLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgKyAnXCIgdGl0bGU9XCInICsgdGl0bGUgKyAnXCI+JyArIHRpdGxlICsgJzwvYT4gYXMgcGF0cm9sbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjYWZjSGVscGVyX3BhdHJvbCcgKyBqcUVzY2FwZSh0aXRsZSkpLmh0bWwoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPHNwYW4gY2xhc3M9XCJhZmNIZWxwZXJfbm90aWNlXCI+PGI+UGF0cm9sbGluZyBmYWlsZWQgb24gPGEgaHJlZj1cIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdnQXJ0aWNsZVBhdGgucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1wiIHRpdGxlPVwiJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGUgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdcIj4nICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJzwvYT48L2I+PC9zcGFuPiB3aXRoIGFuIHVua25vd24gZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQYXRyb2xsaW5nIGZhaWxlZCBvbiAlcyAoJXMpIHdpdGggYW4gdW5rbm93biBlcnJvci4nLCB3Z0FydGljbGVQYXRoLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSksIHRpdGxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZhaWwoKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJCgnI2FmY0hlbHBlcl9wYXRyb2wnICsganFFc2NhcGUodGl0bGUpKS5odG1sKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPHNwYW4gY2xhc3M9XCJhZmNIZWxwZXJfbm90aWNlXCI+PGI+UGF0cm9sbGluZyBmYWlsZWQgb24gPGEgaHJlZj1cIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2dBcnRpY2xlUGF0aC5yZXBsYWNlKCckMScsIGVuY29kZVVSSSh0aXRsZSkpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdcIiB0aXRsZT1cIicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGUgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1wiPicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGUgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJzwvYT48L2I+PC9zcGFuPi4gRXJyb3IgaW5mbzogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbXcubG9hZGVyLnVzaW5nKFsnbWVkaWF3aWtpLmFwaScsICdtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgICAgIG13LnV0aWwuYWRkQ1NTKGBcbiNkaXNwbGF5LW1lc3NhZ2UgKiB7XG4gICAgbWFyZ2luOiByZXZlcnQ7XG4gICAgYm9yZGVyOiByZXZlcnQ7XG4gICAgYmFja2dyb3VuZDogcmV2ZXJ0O1xuICAgIHBhZGRpbmc6IHJldmVydDtcbn1gKTtcblxuICAgICAgICBjb25zdCByZWRpcmVjdFBvcnRsZXRMaW5rID0gbXcudXRpbC5hZGRQb3J0bGV0TGluayhtdy5jb25maWcuZ2V0KCdza2luJykgPT09ICdtaW5lcnZhJyA/ICdwLXRiJyA6ICdwLWNhY3Rpb25zJywgJyMnLCAnUmV2aWV3IEFGQy9SQycsICdjYS1hZmNyaHMnLCAnUmV2aWV3JywgJ2EnKTtcbiAgICAgICAgJChyZWRpcmVjdFBvcnRsZXRMaW5rKS5jbGljaygoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAvLyBDbGVhciB2YXJpYWJsZXMgZm9yIHRoZSBjYXNlIHNvbWVib2R5IGlzIGNsaWNraW5nIG9uIFwicmV2aWV3XCIgbXVsdGlwbGUgdGltZXNcbiAgICAgICAgICAgIHJlZGlyZWN0U3VibWlzc2lvbnMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIHJlZGlyZWN0U2VjdGlvbnMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIG51bVRvdGFsID0gMDtcbiAgICAgICAgICAgIHN1Ym1pc3Npb25zLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICBuZWVkc1VwZGF0ZS5sZW5ndGggPSAwO1xuICAgICAgICAgICAgcmVkaXJlY3RJbml0KCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufSkoKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Q0FBQyxXQUFZO0FBQ1QsTUFBSSxHQUFHLE9BQU8sSUFBSSxZQUFZLE1BQU07QUFBNEQ7QUFFaEcsUUFBTSxtQkFBbUIsR0FBRyxPQUFPLElBQUksWUFBWSxFQUFFLFFBQVEsTUFBTSxHQUFHO0FBQ3RFLFFBQU0sc0JBQXNCLENBQUM7QUFDN0IsTUFBSSxtQkFBbUIsQ0FBQztBQUN4QixRQUFNLGdCQUFnQjtBQUN0QixNQUFJLFdBQVc7QUFDZixNQUFJLGFBQWE7QUFDakIsUUFBTSxjQUFjLENBQUM7QUFDckIsUUFBTSxjQUFjLENBQUM7QUFDckIsUUFBTSx5QkFBeUI7QUFBQSxJQUMzQixRQUFRO0FBQUEsSUFDUixPQUFPO0FBQUEsSUFDUCxhQUFhO0FBQUEsSUFDYixVQUFVO0FBQUEsSUFDVixnQkFBZ0I7QUFBQSxJQUNoQixRQUFRO0FBQUEsRUFDWjtBQUNBLFFBQU0seUJBQXlCO0FBQUEsSUFDM0IsUUFBUTtBQUFBLElBQ1IsT0FBTztBQUFBLElBQ1AsVUFBVTtBQUFBLElBQ1YsZ0JBQWdCO0FBQUEsSUFDaEIsUUFBUTtBQUFBLEVBQ1o7QUFLQSxpQkFBZSxlQUFlO0FBQzFCLFFBQUksV0FBVyxNQUFNLFlBQVksZ0JBQWdCO0FBRWpELGVBQVcsYUFBYSxRQUFRO0FBR2hDLFVBQU0sZUFBZTtBQUNyQixlQUFXLFNBQVMsVUFBVSxTQUFTLE9BQU8sWUFBWSxD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
