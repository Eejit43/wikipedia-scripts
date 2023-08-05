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
  function redirectInit() {
    let pageText = getPageText(redirectPageName);
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
            $("<li>").append("From: " + toArticle + " (<small><a href='" + googleSearchUrl + `'" target="_blank">Google</a> <b>&middot;</b> <a href="https://en.wikipedia.org/wiki/Special:WhatLinksHere/` + encodeURIComponent(toArticle) + '" target="_blank">what links here</a>)</small><br/>').append(reasonAndSource).append(
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
        $extra.html($extra.html() + '&nbsp;<br /><label for="afcHelper_redirect_to_' + id + '">To: </label><input type="text" name="afcHelper_redirect_to_' + id + '" id="afcHelper_redirect_to_' + id + '" value="' + submissions[id].to + '" />');
        $extra.html($extra.html() + '<br /><label for="afcHelper_redirect_append_' + id + '">Template to append: (<a href="https://en.wikipedia.org/wiki/Wikipedia:TMR" target="_blank">Help</a>)</label>');
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
        $extra.html('<label for="afcHelper_redirect_name_' + id + '">Category name: </label><input type="text" size="100" name="afcHelper_redirect_name_' + id + '" id="afcHelper_redirect_name_' + id + '" value="' + submissions[id].title + '" />');
        $extra.html($extra.html() + '<br /><label for="afcHelper_redirect_parents_' + id + '">Parent categories (comma-separated):</label><input type="text" size="100" id="afcHelper_redirect_parents_' + id + '" name="afcHelper_redirect_parents_' + id + '" value="' + submissions[id].parents + '" />');
        $extra.append("<br />");
        $extra.append($("<input>", { type: "checkbox", name: "afcHelper_redirect_container_" + id, id: "afcHelper_redirect_container_" + id }));
        $extra.append('<label for="afcHelper_redirect_container_' + id + '">This is a <a href="/wiki/Wikipedia:Container_category" title="Wikipedia:Container category">container category</a></label>');
        $extra.html($extra.html() + '<br /><input type="checkbox" name="afcHelper_redirect_container_' + id + '"');
      }
      $extra.html($extra.html() + '<br /><label for="afcHelper_redirect_comment_' + id + '">Comment:</label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>');
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
      $extra.html($extra.html() + '<br/><label for="afcHelper_redirect_comment_' + id + '">Comment: </label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>');
    } else if (selectValue === "none") {
      $extra.html("");
    } else {
      $extra.html($extra.html() + '<label for="afcHelper_redirect_comment_' + id + '">Comment: </label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>');
    }
  }
  function redirectPerformActions() {
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
    $("#afcHelper_finish").html($("#afcHelper_finish").html() + '<span id="afcHelper_finished_wrapper"><span id="afcHelper_finished_main" style="display:none"><li id="afcHelper_done"><b>Done (<a href="' + mw.config.get("wgArticlePath").replace("$1", encodeURI(redirectPageName)) + '?action=purge" title="' + redirectPageName + '">Reload page</a>)</b></li></span></span>');
    let pageText = getPageText(redirectPageName, addStatus);
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
  function getPageText(title, addStatus) {
    addStatus = typeof addStatus !== "undefined" ? addStatus : function() {
    };
    addStatus('<li id="afcHelper_get' + jqEscape(title) + '">Getting <a href="' + mw.config.get("wgArticlePath").replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></li>");
    const request = {
      action: "query",
      prop: "revisions",
      rvprop: "content",
      format: "json",
      indexpageids: true,
      titles: title
    };
    const response = JSON.parse(
      $.ajax({
        url: mw.util.wikiScript("api"),
        data: request,
        async: false
      }).responseText
    );
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
    $("#afcHelper_status").html($("#afcHelper_status").html() + '<li id="afcHelper_edit' + jqEscape(title) + '">Editing <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></li>");
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
        $("#afcHelper_edit" + jqEscape(title)).html('<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span>. Error info: " + JSON.stringify(data));
        console.error("Edit failed on %s (%s). Error info: %s", wgArticlePath.replace("$1", encodeURI(title)), title, JSON.stringify(data));
      }
    }).fail((error) => {
      if (createOnly && error === "articleexists")
        $("#afcHelper_edit" + jqEscape(title)).html('<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span>. Error info: The article already exists!");
      else
        $("#afcHelper_edit" + jqEscape(title)).html('<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span>. Error info: " + error);
    }).always(() => {
      $("#afcHelper_AJAX_finished_" + functionId).css("display", "");
    });
    if (!noPatrol) {
      if ($(".patrollink").length) {
        const patrolHref = $(".patrollink a").attr("href");
        const rcId = mw.util.getParamValue("rcid", patrolHref);
        if (rcId) {
          $("#afcHelper_status").html($("#afcHelper_status").html() + '<li id="afcHelper_patrol' + jqEscape(title) + '">Marking <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + " as patrolled</a></li>");
          const patrolRequest = {
            action: "patrol",
            format: "json",
            rcid: rcId
          };
          api.postWithToken("patrol", patrolRequest).done((data) => {
            if (data) {
              $("#afcHelper_patrol" + jqEscape(title)).html('Marked <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a> as patrolled");
            } else {
              $("#afcHelper_patrol" + jqEscape(title)).html('<span class="afcHelper_notice"><b>Patrolling failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span> with an unknown error");
              console.error("Patrolling failed on %s (%s) with an unknown error.", wgArticlePath.replace("$1", encodeURI(title)), title);
            }
          }).fail((error) => {
            $("#afcHelper_patrol" + jqEscape(title)).html('<span class="afcHelper_notice"><b>Patrolling failed on <a href="' + wgArticlePath.replace("$1", encodeURI(title)) + '" title="' + title + '">' + title + "</a></b></span>. Error info: " + error);
          });
        }
      }
    }
  }
  mw.loader.using(["mediawiki.api", "mediawiki.util"], () => {
    mw.util.addCSS(`
#display-message * {
    padding: revert;
    margin: revert;
    border: revert;
    background: revert;
}
`);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9BRkNSSFMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIihmdW5jdGlvbiAoKSB7XG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSAhPT0gJ1dpa2lwZWRpYTpBcnRpY2xlc19mb3JfY3JlYXRpb24vUmVkaXJlY3RzX2FuZF9jYXRlZ29yaWVzJykgcmV0dXJuO1xuXG4gICAgY29uc3QgcmVkaXJlY3RQYWdlTmFtZSA9IG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKS5yZXBsYWNlKC9fL2csICcgJyk7XG4gICAgY29uc3QgcmVkaXJlY3RTdWJtaXNzaW9ucyA9IFtdO1xuICAgIGxldCByZWRpcmVjdFNlY3Rpb25zID0gW107XG4gICAgY29uc3Qgc3VtbWFyeUFkdmVydCA9ICcgKFtbVXNlcjpFZWppdDQzL3NjcmlwdHMvQUZDUkhTfEFGQ1JIUyAyXV0pJztcbiAgICBsZXQgbnVtVG90YWwgPSAwO1xuICAgIGxldCBhamF4TnVtYmVyID0gMDtcbiAgICBjb25zdCBzdWJtaXNzaW9ucyA9IFtdO1xuICAgIGNvbnN0IG5lZWRzVXBkYXRlID0gW107XG4gICAgY29uc3QgcmVkaXJlY3REZWNsaW5lUmVhc29ucyA9IHtcbiAgICAgICAgZXhpc3RzOiAnVGhlIHRpdGxlIHlvdSBzdWdnZXN0ZWQgYWxyZWFkeSBleGlzdHMgb24gV2lraXBlZGlhJyxcbiAgICAgICAgYmxhbms6ICdXZSBjYW5ub3QgYWNjZXB0IGVtcHR5IHN1Ym1pc3Npb25zJyxcbiAgICAgICAgJ25vLXRhcmdldCc6ICcgQSByZWRpcmVjdCBjYW5ub3QgYmUgY3JlYXRlZCB1bmxlc3MgdGhlIHRhcmdldCBpcyBhbiBleGlzdGluZyBhcnRpY2xlLiBFaXRoZXIgeW91IGhhdmUgbm90IHNwZWNpZmllZCB0aGUgdGFyZ2V0LCBvciB0aGUgdGFyZ2V0IGRvZXMgbm90IGV4aXN0JyxcbiAgICAgICAgdW5saWtlbHk6ICdUaGUgdGl0bGUgeW91IHN1Z2dlc3RlZCBzZWVtcyB1bmxpa2VseS4gQ291bGQgeW91IHByb3ZpZGUgYSBzb3VyY2Ugc2hvd2luZyB0aGF0IGl0IGlzIGEgY29tbW9ubHkgdXNlZCBhbHRlcm5hdGUgbmFtZT8nLFxuICAgICAgICAnbm90LXJlZGlyZWN0JzogJ1RoaXMgcmVxdWVzdCBpcyBub3QgYSByZWRpcmVjdCByZXF1ZXN0JyxcbiAgICAgICAgY3VzdG9tOiAnJ1xuICAgIH07XG4gICAgY29uc3QgY2F0ZWdvcnlEZWNsaW5lUmVhc29ucyA9IHtcbiAgICAgICAgZXhpc3RzOiAnVGhlIGNhdGVnb3J5IHlvdSBzdWdnZXN0ZWQgYWxyZWFkeSBleGlzdHMgb24gV2lraXBlZGlhJyxcbiAgICAgICAgYmxhbms6ICdXZSBjYW5ub3QgYWNjZXB0IGVtcHR5IHN1Ym1pc3Npb25zJyxcbiAgICAgICAgdW5saWtlbHk6ICdJdCBzZWVtcyB1bmxpa2VseSB0aGF0IHRoZXJlIGFyZSBlbm91Z2ggcGFnZXMgdG8gc3VwcG9ydCB0aGlzIGNhdGVnb3J5JyxcbiAgICAgICAgJ25vdC1jYXRlZ29yeSc6ICdUaGlzIHJlcXVlc3QgaXMgbm90IGEgY2F0ZWdvcnkgcmVxdWVzdCcsXG4gICAgICAgIGN1c3RvbTogJydcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgdGhlIHJlZGlyZWN0IGhhbmRsZXJcbiAgICAgKi9cbiAgICBmdW5jdGlvbiByZWRpcmVjdEluaXQoKSB7XG4gICAgICAgIGxldCBwYWdlVGV4dCA9IGdldFBhZ2VUZXh0KHJlZGlyZWN0UGFnZU5hbWUpO1xuICAgICAgICAvLyBDbGVhbnVwIHRoZSB3aWtpcGVkaWEgbGlua3MgZm9yIHByZXZlbnRpbmcgc3R1ZmYgbGlrZSBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvdy9pbmRleC5waHA/ZGlmZj01NzYyNDQwNjcmb2xkaWQ9NTc2MjIxNDM3XG4gICAgICAgIHBhZ2VUZXh0ID0gY2xlYW51cExpbmtzKHBhZ2VUZXh0KTtcblxuICAgICAgICAvLyBGaXJzdCwgc3RyaXAgb3V0IHRoZSBwYXJ0cyBiZWZvcmUgdGhlIGZpcnN0IHNlY3Rpb25cbiAgICAgICAgY29uc3Qgc2VjdGlvblJlZ2V4ID0gLz09Lio/PT0vO1xuICAgICAgICBwYWdlVGV4dCA9IHBhZ2VUZXh0LnN1YnN0cmluZyhwYWdlVGV4dC5zZWFyY2goc2VjdGlvblJlZ2V4KSk7XG4gICAgICAgIC8vIFRoZW4gc3BsaXQgaXQgaW50byB0aGUgcmVzdCBvZiB0aGUgc2VjdGlvbnNcbiAgICAgICAgcmVkaXJlY3RTZWN0aW9ucyA9IHBhZ2VUZXh0Lm1hdGNoKC9ePT0uKj89PSQoKFxccj9cXG4/KSg/IT09W149XSkuKikqL2dpbSk7XG5cbiAgICAgICAgLy8gUGFyc2UgdGhlIHNlY3Rpb25zXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVkaXJlY3RTZWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY2xvc2VkID0gLyhcXHtcXHtcXHMqYWZjKD8hXFxzK2NvbW1lbnQpfFRoaXMgaXMgYW4gYXJjaGl2ZWQgZGlzY3Vzc2lvbikvaS50ZXN0KHJlZGlyZWN0U2VjdGlvbnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFjbG9zZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXIgPSByZWRpcmVjdFNlY3Rpb25zW2ldLm1hdGNoKHNlY3Rpb25SZWdleClbMF07XG4gICAgICAgICAgICAgICAgaWYgKGhlYWRlci5zZWFyY2goL1JlZGlyZWN0IHJlcXVlc3QvaSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHdpa2lsaW5rUmVnZXggPSAvXFxbXFxbKFxccypbXj1dKj8pKj9cXF1cXF0vZztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlua3MgPSBoZWFkZXIubWF0Y2god2lraWxpbmtSZWdleCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbGlua3MpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBsID0gMDsgbCA8IGxpbmtzLmxlbmd0aDsgbCsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5rc1tsXSA9IGxpbmtzW2xdLnJlcGxhY2UoL1tbXFxdXS9nLCAnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlua3NbbF0uY2hhckF0KDApID09PSAnOicpIGxpbmtzW2xdID0gbGlua3NbbF0uc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlZ2V4ID0gL1RhcmdldCBvZiByZWRpcmVjdDpcXHMqXFxbXFxbKFteW1xcXV0qKVxcXVxcXS9pO1xuICAgICAgICAgICAgICAgICAgICByZWdleC50ZXN0KHJlZGlyZWN0U2VjdGlvbnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0byA9ICQudHJpbShSZWdFeHAuJDEpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlYXNvblJlID0gL1JlYXNvbjpbIFxcdF0qPyguKykvaTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVhc29uTWF0Y2ggPSByZWFzb25SZS5leGVjKHJlZGlyZWN0U2VjdGlvbnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWFzb24gPSByZWFzb25NYXRjaCAmJiByZWFzb25NYXRjaFsxXS50cmltKCkgPyByZWFzb25NYXRjaFsxXSA6IG51bGw7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc291cmNlUmUgPSAvU291cmNlLio/OlsgXFx0XSo/KC4rKS9pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VNYXRjaCA9IHNvdXJjZVJlLmV4ZWMocmVkaXJlY3RTZWN0aW9uc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZSA9IHNvdXJjZU1hdGNoICYmIHNvdXJjZU1hdGNoWzFdLnRyaW0oKSA/IHNvdXJjZU1hdGNoWzFdIDogbnVsbDtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJtaXNzaW9uID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3JlZGlyZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyb206IFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VjdGlvbjogaSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IHRvLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVhc29uLFxuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGlua3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAncmVkaXJlY3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBudW1Ub3RhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogbGlua3Nbal0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiAnJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Ym1pc3Npb24uZnJvbS5wdXNoKHN1Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJtaXNzaW9ucy5wdXNoKHN1Yik7XG4gICAgICAgICAgICAgICAgICAgICAgICBudW1Ub3RhbCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlZGlyZWN0U3VibWlzc2lvbnMucHVzaChzdWJtaXNzaW9uKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGhlYWRlci5zZWFyY2goL0NhdGVnb3J5IHJlcXVlc3QvaSkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgYSB3aWtpbGluayBpbiB0aGUgaGVhZGVyLCBhbmQgYXNzdW1lIGl0J3MgdGhlIGNhdGVnb3J5IHRvIGNyZWF0ZVxuICAgICAgICAgICAgICAgICAgICBsZXQgY2F0ZWdvcnlOYW1lID0gL1xcW1xcW1teW1xcXV0rXFxdXFxdLy5leGVjKGhlYWRlcik7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY2F0ZWdvcnlOYW1lKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnlOYW1lID0gY2F0ZWdvcnlOYW1lWzBdO1xuICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeU5hbWUgPSBjYXRlZ29yeU5hbWUucmVwbGFjZSgvW1tcXF1dL2csICcnKTtcbiAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnlOYW1lID0gY2F0ZWdvcnlOYW1lLnJlcGxhY2UoL0NhdGVnb3J5XFxzKjpcXHMqL2dpLCAnQ2F0ZWdvcnk6Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYXRlZ29yeU5hbWUuY2hhckF0KDApID09PSAnOicpIGNhdGVnb3J5TmFtZSA9IGNhdGVnb3J5TmFtZS5zdWJzdHJpbmcoMSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmlndXJlIG91dCB0aGUgcGFyZW50IGNhdGVnb3JpZXNcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlcXVlc3RUZXh0ID0gcmVkaXJlY3RTZWN0aW9uc1tpXS5zdWJzdHJpbmcoaGVhZGVyLmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gV2Ugb25seSB3YW50IGNhdGVnb3JpZXMgbGlzdGVkIHVuZGVyIHRoZSBcIlBhcmVudCBjYXRlZ29yeS9jYXRlZ29yaWVzXCIgaGVhZGluZyxcbiAgICAgICAgICAgICAgICAgICAgLy8gKk5PVCogYW55IGNhdGVnb3JpZXMgbGlzdGVkIHVuZGVyIFwiRXhhbXBsZSBwYWdlcyB3aGljaCBiZWxvbmcgdG8gdGhpcyBjYXRlZ29yeVwiLlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnRIZWFkaW5nSW5kZXggPSByZXF1ZXN0VGV4dC5pbmRleE9mKCdQYXJlbnQgY2F0ZWdvcnkvY2F0ZWdvcmllcycpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50SGVhZGluZ0luZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RUZXh0ID0gcmVxdWVzdFRleHQuc3Vic3RyaW5nKHBhcmVudEhlYWRpbmdJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnRDYXRlZ29yaWVzID0gW107XG4gICAgICAgICAgICAgICAgICAgIGxldCBwYXJlbnRDYXRlZ29yeU1hdGNoID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50Q2F0ZWdvcmllc1JlZ2V4ID0gL1xcW1xcW1xccyo6XFxzKihDYXRlZ29yeTpbXlxcXVtdKilcXF1cXF0vZ2k7XG4gICAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudENhdGVnb3J5TWF0Y2ggPSBwYXJlbnRDYXRlZ29yaWVzUmVnZXguZXhlYyhyZXF1ZXN0VGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50Q2F0ZWdvcnlNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudENhdGVnb3JpZXMucHVzaChwYXJlbnRDYXRlZ29yeU1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSB3aGlsZSAocGFyZW50Q2F0ZWdvcnlNYXRjaCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VibWlzc2lvbiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdjYXRlZ29yeScsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogY2F0ZWdvcnlOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VjdGlvbjogaSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBudW1Ub3RhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRzOiBwYXJlbnRDYXRlZ29yaWVzLmpvaW4oJywnKVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBudW1Ub3RhbCsrO1xuICAgICAgICAgICAgICAgICAgICByZWRpcmVjdFN1Ym1pc3Npb25zLnB1c2goc3VibWlzc2lvbik7XG4gICAgICAgICAgICAgICAgICAgIHN1Ym1pc3Npb25zLnB1c2goc3VibWlzc2lvbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSAvLyBFbmQgaWYgIWNsb3NlZFxuICAgICAgICB9IC8vIEVuZCBsb29wIG92ZXIgc2VjdGlvbnNcblxuICAgICAgICAvLyBCdWlsZCB0aGUgZm9ybVxuICAgICAgICBjb25zdCAkZm9ybSA9ICQoJzxoMz5SZXZpZXdpbmcgQWZDIHJlZGlyZWN0IHJlcXVlc3RzPC9oMz4nKTtcbiAgICAgICAgZGlzcGxheU1lc3NhZ2UoJGZvcm0pO1xuICAgICAgICBjb25zdCAkbWVzc2FnZURpdiA9ICRmb3JtLnBhcmVudCgpO1xuICAgICAgICAvLyBMYXlvdXQgdGhlIHRleHRcbiAgICAgICAgbGV0IHJlZGlyZWN0RW1wdHkgPSAxO1xuICAgICAgICBjb25zdCBBQ1RJT05TID0gW1xuICAgICAgICAgICAgeyBsYWJlbDogJ0FjY2VwdCcsIHZhbHVlOiAnYWNjZXB0JyB9LFxuICAgICAgICAgICAgeyBsYWJlbDogJ0RlY2xpbmUnLCB2YWx1ZTogJ2RlY2xpbmUnIH0sXG4gICAgICAgICAgICB7IGxhYmVsOiAnQ29tbWVudCcsIHZhbHVlOiAnY29tbWVudCcgfSxcbiAgICAgICAgICAgIHsgbGFiZWw6ICdOb25lJywgc2VsZWN0ZWQ6IHRydWUsIHZhbHVlOiAnbm9uZScgfVxuICAgICAgICBdO1xuICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IHJlZGlyZWN0U3VibWlzc2lvbnMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgIGxldCBzdWJtaXNzaW9uTmFtZTtcbiAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnRvICE9PSB1bmRlZmluZWQpIHN1Ym1pc3Npb25OYW1lID0gcmVkaXJlY3RTdWJtaXNzaW9uc1trXS50by5yZXBsYWNlKC9cXHMvZywgJycpO1xuICAgICAgICAgICAgZWxzZSBzdWJtaXNzaW9uTmFtZSA9ICcnO1xuICAgICAgICAgICAgY29uc3QgJHRoaXNTdWJMaXN0ID0gJCgnPHVsPicpO1xuICAgICAgICAgICAgY29uc3QgJHRoaXNTdWJMaXN0RWxlbWVudCA9ICQoJzxsaT4nKTtcbiAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnR5cGUgPT09ICdyZWRpcmVjdCcpIHtcbiAgICAgICAgICAgICAgICAkdGhpc1N1Ykxpc3RFbGVtZW50LmFwcGVuZCgnUmVkaXJlY3QocykgdG8gJyk7XG4gICAgICAgICAgICAgICAgaWYgKCFzdWJtaXNzaW9uTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5mcm9tLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZWVkc1VwZGF0ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5mcm9tW2ldLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ25vLXRhcmdldCdcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICghcmVkaXJlY3RTdWJtaXNzaW9uc1trXS50bykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5mcm9tLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZWVkc1VwZGF0ZS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5mcm9tW2ldLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYXNvbjogJ25vdC1yZWRpcmVjdCdcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdID09PSAnJyB8fCByZWRpcmVjdFN1Ym1pc3Npb25zW2tdID09PSAnICcpIHtcbiAgICAgICAgICAgICAgICAgICAgJHRoaXNTdWJMaXN0RWxlbWVudC5hcHBlbmQoJ0VtcHR5IHN1Ym1pc3Npb24gIycgKyByZWRpcmVjdEVtcHR5KTtcbiAgICAgICAgICAgICAgICAgICAgcmVkaXJlY3RFbXB0eSsrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3VibWlzc2lvbk5hbWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAkdGhpc1N1Ykxpc3RFbGVtZW50LmFwcGVuZChcbiAgICAgICAgICAgICAgICAgICAgICAgICQoJzxhPicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2hyZWYnLCBtdy5jb25maWcuZ2V0KCd3Z0FydGljbGVQYXRoJykucmVwbGFjZSgnJDEnLCBlbmNvZGVVUklDb21wb25lbnQocmVkaXJlY3RTdWJtaXNzaW9uc1trXS50bykpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0YXJnZXQnLCAnX2JsYW5rJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGV4dChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnRvKVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICR0aGlzU3ViTGlzdEVsZW1lbnQuYXBwZW5kKCc8Yj5ubyB0YXJnZXQgZ2l2ZW48L2I+OiAnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgJGZyb21MaXN0ID0gJCgnPHVsPicpLmFwcGVuZFRvKCR0aGlzU3ViTGlzdEVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGwgPSAwOyBsIDwgcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5mcm9tLmxlbmd0aDsgbCsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZyb20gPSByZWRpcmVjdFN1Ym1pc3Npb25zW2tdLmZyb21bbF07XG4gICAgICAgICAgICAgICAgICAgIGxldCB0b0FydGljbGUgPSBmcm9tLnRpdGxlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodG9BcnRpY2xlLnJlcGxhY2UoL1xccyovZ2ksICcnKS5sZW5ndGggPT09IDApIHRvQXJ0aWNsZSA9ICc8Yj5ubyB0aXRsZSBzcGVjaWZpZWQ8L2I+LCBjaGVjayB0aGUgcmVxdWVzdCBkZXRhaWxzJztcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWFzb25BbmRTb3VyY2UgPSAkKCc8dWw+Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnJlYXNvbikgcmVhc29uQW5kU291cmNlLmFwcGVuZCgnPGxpPlJlYXNvbjogJyArIHJlZGlyZWN0U3VibWlzc2lvbnNba10ucmVhc29uICsgJzwvbGk+Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnNvdXJjZSkgcmVhc29uQW5kU291cmNlLmFwcGVuZCgnPGxpPlNvdXJjZTogJyArIHJlZGlyZWN0U3VibWlzc2lvbnNba10uc291cmNlICsgJzwvbGk+Jyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ29vZ2xlU2VhcmNoVXJsID0gJ2h0dHA6Ly93d3cuZ29vZ2xlLmNvbS9zZWFyY2g/cT1cIicgKyBlbmNvZGVVUklDb21wb25lbnQodG9BcnRpY2xlKSArICdcIistd2lraXBlZGlhLm9yZyc7XG4gICAgICAgICAgICAgICAgICAgICRmcm9tTGlzdC5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAkKCc8bGk+JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCdGcm9tOiAnICsgdG9BcnRpY2xlICsgXCIgKDxzbWFsbD48YSBocmVmPSdcIiArIGdvb2dsZVNlYXJjaFVybCArICdcXCdcIiB0YXJnZXQ9XCJfYmxhbmtcIj5Hb29nbGU8L2E+IDxiPiZtaWRkb3Q7PC9iPiA8YSBocmVmPVwiaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvU3BlY2lhbDpXaGF0TGlua3NIZXJlLycgKyBlbmNvZGVVUklDb21wb25lbnQodG9BcnRpY2xlKSArICdcIiB0YXJnZXQ9XCJfYmxhbmtcIj53aGF0IGxpbmtzIGhlcmU8L2E+KTwvc21hbGw+PGJyLz4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmQocmVhc29uQW5kU291cmNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICQoJzxsYWJlbD4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2ZvcicsICdhZmNIZWxwZXJfcmVkaXJlY3RfYWN0aW9uXycgKyBmcm9tLmlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRleHQoJ0FjdGlvbjogJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZChnZW5lcmF0ZVNlbGVjdE9iamVjdCgnYWZjSGVscGVyX3JlZGlyZWN0X2FjdGlvbl8nICsgZnJvbS5pZCwgQUNUSU9OUywgcmVkaXJlY3RNYWtlQWN0aW9uQ2hhbmdlKGZyb20uaWQpKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCQoJzxkaXY+JykuYXR0cignaWQnLCAnYWZjSGVscGVyX3JlZGlyZWN0X2V4dHJhXycgKyBmcm9tLmlkKSlcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1YklkID0gcmVkaXJlY3RTdWJtaXNzaW9uc1trXS5pZDtcbiAgICAgICAgICAgICAgICAkdGhpc1N1Ykxpc3RFbGVtZW50XG4gICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoJ0NhdGVnb3J5IHN1Ym1pc3Npb246ICcpXG4gICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAkKCc8YT4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdocmVmJywgJy93aWtpLycgKyByZWRpcmVjdFN1Ym1pc3Npb25zW2tdLnRpdGxlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0aXRsZScsIHJlZGlyZWN0U3VibWlzc2lvbnNba10udGl0bGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRleHQocmVkaXJlY3RTdWJtaXNzaW9uc1trXS50aXRsZSlcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCc8YnIgLz4nKVxuICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAgJCgnPGxhYmVsPicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2ZvcicsICdhZmNIZWxwZXJfcmVkaXJlY3RfYWN0aW9uXycgKyBzdWJJZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGV4dCgnQWN0aW9uOiAnKVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoZ2VuZXJhdGVTZWxlY3RPYmplY3QoJ2FmY0hlbHBlcl9yZWRpcmVjdF9hY3Rpb25fJyArIHN1YklkLCBBQ1RJT05TLCByZWRpcmVjdE1ha2VBY3Rpb25DaGFuZ2Uoc3ViSWQpKSlcbiAgICAgICAgICAgICAgICAgICAgLmFwcGVuZCgkKCc8ZGl2PicpLmF0dHIoJ2lkJywgJ2FmY0hlbHBlcl9yZWRpcmVjdF9leHRyYV8nICsgc3ViSWQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICR0aGlzU3ViTGlzdC5hcHBlbmQoJHRoaXNTdWJMaXN0RWxlbWVudCk7XG4gICAgICAgICAgICAkbWVzc2FnZURpdi5hcHBlbmQoJHRoaXNTdWJMaXN0KTtcbiAgICAgICAgfSAvLyBFbmQgbG9vcCBvdmVyIHNlY3Rpb25zXG4gICAgICAgICRtZXNzYWdlRGl2LmFwcGVuZCgkKCc8YnV0dG9uPicpLmF0dHIoJ2lkJywgJ2FmY0hlbHBlcl9yZWRpcmVjdF9kb25lX2J1dHRvbicpLmF0dHIoJ25hbWUnLCAnYWZjSGVscGVyX3JlZGlyZWN0X2RvbmVfYnV0dG9uJykudGV4dCgnRG9uZScpLmNsaWNrKHJlZGlyZWN0UGVyZm9ybUFjdGlvbnMpKTtcbiAgICAgICAgZm9yIChsZXQgeSA9IDA7IHkgPCBuZWVkc1VwZGF0ZS5sZW5ndGg7IHkrKykge1xuICAgICAgICAgICAgJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9hY3Rpb25fJyArIG5lZWRzVXBkYXRlW3ldLmlkKS5hdHRyKCd2YWx1ZScsICdkZWNsaW5lJyk7XG4gICAgICAgICAgICByZWRpcmVjdE9uQWN0aW9uQ2hhbmdlKG5lZWRzVXBkYXRlW3ldLmlkKTtcbiAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfcmVkaXJlY3RfZGVjbGluZV8nICsgbmVlZHNVcGRhdGVbeV0uaWQpLmF0dHIoJ3ZhbHVlJywgbmVlZHNVcGRhdGVbeV0ucmVhc29uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFsaWFzIG9mIHJlZGlyZWN0T25BY3Rpb25DaGFuZ2VcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgdGhlIHJlcXVlc3QgaWRcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IHRoZSBmdW5jdGlvblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlZGlyZWN0TWFrZUFjdGlvbkNoYW5nZShpZCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmVkaXJlY3RPbkFjdGlvbkNoYW5nZShpZCk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGVyZm9ybSBhY3Rpb25zIG9uIGNoYW5nZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCB0aGUgcmVxdWVzdCBpZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlZGlyZWN0T25BY3Rpb25DaGFuZ2UoaWQpIHtcbiAgICAgICAgY29uc3QgJGV4dHJhID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9leHRyYV8nICsgaWQpO1xuICAgICAgICBjb25zdCBzZWxlY3RWYWx1ZSA9ICQoJyNhZmNIZWxwZXJfcmVkaXJlY3RfYWN0aW9uXycgKyBpZCkudmFsKCk7XG4gICAgICAgICRleHRyYS5odG1sKCcnKTsgLy8gQmxhbmsgaXQgZmlyc3RcbiAgICAgICAgaWYgKHNlbGVjdFZhbHVlID09PSAnYWNjZXB0Jykge1xuICAgICAgICAgICAgaWYgKHN1Ym1pc3Npb25zW2lkXS50eXBlID09PSAncmVkaXJlY3QnKSB7XG4gICAgICAgICAgICAgICAgJGV4dHJhLmFwcGVuZCgnPGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9mcm9tXycgKyBpZCArICdcIj5Gcm9tOiA8L2xhYmVsPicpO1xuICAgICAgICAgICAgICAgICRleHRyYS5hcHBlbmQoXG4gICAgICAgICAgICAgICAgICAgICQoJzxpbnB1dD4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3R5cGUnLCAndGV4dCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignbmFtZScsICdhZmNIZWxwZXJfcmVkaXJlY3RfZnJvbV8nICsgaWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignaWQnLCAnYWZjSGVscGVyX3JlZGlyZWN0X2Zyb21fJyArIGlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3ZhbHVlJywgc3VibWlzc2lvbnNbaWRdLnRpdGxlKVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbCgkZXh0cmEuaHRtbCgpICsgJyZuYnNwOzxiciAvPjxsYWJlbCBmb3I9XCJhZmNIZWxwZXJfcmVkaXJlY3RfdG9fJyArIGlkICsgJ1wiPlRvOiA8L2xhYmVsPjxpbnB1dCB0eXBlPVwidGV4dFwiIG5hbWU9XCJhZmNIZWxwZXJfcmVkaXJlY3RfdG9fJyArIGlkICsgJ1wiIGlkPVwiYWZjSGVscGVyX3JlZGlyZWN0X3RvXycgKyBpZCArICdcIiB2YWx1ZT1cIicgKyBzdWJtaXNzaW9uc1tpZF0udG8gKyAnXCIgLz4nKTtcbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbCgkZXh0cmEuaHRtbCgpICsgJzxiciAvPjxsYWJlbCBmb3I9XCJhZmNIZWxwZXJfcmVkaXJlY3RfYXBwZW5kXycgKyBpZCArICdcIj5UZW1wbGF0ZSB0byBhcHBlbmQ6ICg8YSBocmVmPVwiaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvV2lraXBlZGlhOlRNUlwiIHRhcmdldD1cIl9ibGFua1wiPkhlbHA8L2E+KTwvbGFiZWw+Jyk7XG4gICAgICAgICAgICAgICAgJGV4dHJhLmh0bWwoXG4gICAgICAgICAgICAgICAgICAgICRleHRyYS5odG1sKCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVTZWxlY3QoJ2FmY0hlbHBlcl9yZWRpcmVjdF9hcHBlbmRfJyArIGlkLCBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbDogJ05vbmUnLCBzZWxlY3RlZDogdHJ1ZSwgdmFsdWU6ICdub25lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0ZyZXF1ZW50bHkgdXNlZCcsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGFsdGVybmF0aXZlIGxhbmd1YWdlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhbHRlcm5hdGl2ZSBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBtb2RpZmljYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBzZWN0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBkaWFjcml0aWMnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBkaWFjcml0aWMnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSBcdTIwMTMgYWJicmV2aWF0aW9uLCBjYXBpdGFsaXNhdGlvbiwgYW5kIGdyYW1tYXInLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhY3JvbnltJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBpbml0aWFsaXNtJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBDYW1lbENhc2UnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG1pc2NhcGl0YWxpc2F0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBvdGhlciBjYXBpdGFsaXNhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbW9kaWZpY2F0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBwbHVyYWwnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbDogJ0Zyb20gcGFydHMgb2Ygc3BlYWNoJywgdmFsdWU6ICdGcm9tIHBhcnRzIG9mIHNwZWFjaCcsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGFkamVjdGl2ZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYWR2ZXJiJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBjb21tb24gbm91bicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZ2VydW5kJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBwcm9wZXIgbm91bicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gdmVyYicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdGcm9tIFx1MjAxMyBzcGVsbGluZycsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGFsdGVybmF0aXZlIHNwZWxsaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBtaXNzcGVsbGluZycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gQW1lcmljYW4gRW5nbGlzaCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gQnJpdGlzaCBFbmdsaXNoJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBBU0NJSS1vbmx5JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBkaWFjcml0aWMnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGxpZ2F0dXJlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzdHlsaXphdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYWx0ZXJuYXRpdmUgdHJhbnNsaXRlcmF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBXYWRlXHUyMDEzR2lsZXMgcm9tYW5pemF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gYWx0ZXJuYXRpdmUgbmFtZXMsIGdlbmVyYWwnLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhbHRlcm5hdGl2ZSBsYW5ndWFnZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYWx0ZXJuYXRpdmUgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZm9ybWVyIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGhpc3RvcmljIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGluY29tcGxldGUgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gaW5jb3JyZWN0IG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGxldHRlclx1MjAxM3dvcmQgY29tYmluYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGxvbmcgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcG9ydG1hbnRlYXUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHByZWRlY2Vzc29yIGNvbXBhbnkgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc2hvcnQgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc29ydCBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBsZXNzIHNwZWNpZmljIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG1vcmUgc3BlY2lmaWMgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYW50b255bScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZXBvbnltJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzeW5vbnltJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBSb21hbiBudW1lcmFscycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdGcm9tIGFsdGVybmF0aXZlIG5hbWVzLCBnZW9ncmFwaHknLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBDYW5hZGlhbiBzZXR0bGVtZW50IG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG5hbWUgYW5kIGNvdW50cnknIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGNpdHkgYW5kIHN0YXRlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBjaXR5IGFuZCBwcm92aW5jZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbW9yZSBzcGVjaWZpYyBnZW9ncmFwaGljIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHBvc3RhbCBhYmJyZXZpYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHBvc3RhbCBjb2RlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBVUyBwb3N0YWwgYWJicmV2aWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gYWx0ZXJuYXRpdmUgbmFtZXMsIG9yZ2FuaXNtcycsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHNjaWVudGlmaWMgYWJicmV2aWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzY2llbnRpZmljIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGFsdGVybmF0aXZlIHNjaWVudGlmaWMgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbW9ub3R5cGljIHRheG9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gYWx0ZXJuYXRpdmUgbmFtZXMsIHBlb3BsZScsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGJpcnRoIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGdpdmVuIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG1hcnJpZWQgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbmFtZSB3aXRoIHRpdGxlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBub24tbmV1dHJhbCBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBwZXJzb25hbCBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBwc2V1ZG9ueW0nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHJlbGF0aXZlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzcG91c2UnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHN1cm5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSBhbHRlcm5hdGl2ZSBuYW1lcywgdGVjaG5pY2FsJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gQmx1ZWJvb2sgYWJicmV2aWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBicmFuZCBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBkcnVnIHRyYWRlIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGZpbGUgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gSmF2YSBwYWNrYWdlIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIE1hdGhTY2lOZXQgYWJicmV2aWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBtb2xlY3VsYXIgZm9ybXVsYScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gTkxNIGFiYnJldmlhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcHJvZHVjdCBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzbG9nYW4nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHN5bWJvbCcgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc3lzdGVtYXRpYyBhYmJyZXZpYXRpb25zJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSB0ZWNobmljYWwgbmFtZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gdHJhZGVtYXJrJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gXHUyMDEzIG5hdmlnYXRpb24nLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBmaWxlIG1ldGFkYXRhIGxpbmsnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBtZW50aW9uZWQgaW4gaGF0bm90ZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gc2hvcnRjdXQnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHRlbXBsYXRlIHNob3J0Y3V0JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gZGlzYW1iaWd1YXRpb25zJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYW1iaWd1b3VzIHRlcm0nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGluY29tcGxldGUgZGlzYW1iaWd1YXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGluY29ycmVjdCBkaXNhbWJpZ3VhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gb3RoZXIgZGlzYW1iaWd1YXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHByZWRpY3RhYmxlIGRpc2FtYmlndWF0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSB1bm5lY2Vzc2FyeSBkaXNhbWJpZ3VhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdGcm9tIG1lcmdlcnMsIGR1cGxpY2F0ZXMsIGFuZCBtb3ZlcycsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGR1cGxpY2F0ZWQgYXJ0aWNsZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHdpdGggaGlzdG9yeScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbWVyZ2UnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG1vdmUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB3aXRoIG9sZCBoaXN0b3J5JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ0Zyb20gZmljdGlvbicsIGRpc2FibGVkOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGZpY3Rpb25hbCBjaGFyYWN0ZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGZpY3Rpb25hbCBlbGVtZW50JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBmaWN0aW9uYWwgbG9jYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnRnJvbSByZWxhdGVkIGluZm8nLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBhbGJ1bScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gYW5pbWFsJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBib29rJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBjYXRjaHBocmFzZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gZG9tYWluIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHRvcC1sZXZlbCBkb21haW4nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGZpbG0nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGdlbmRlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gbGVnaXNsYXRpb24nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIGxpc3QgdG9waWMnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIG1lbWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcGVyc29uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBwaHJhc2UnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHF1b3RhdGlvbicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIGZyb20gcmVsYXRlZCB3b3JkJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSBzY2hvb2wnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHNvbmcnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIHN1YnRvcGljJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSB0ZWFtJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSB3b3JrJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgZnJvbSB3cml0ZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiBmcm9tIFVuaWNvZGUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnVG8gXHUyMDEzIGdyYW1tYXIsIHB1bmN0dWF0aW9uLCBhbmQgc3BlbGxpbmcnLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gYWNyb255bScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIGluaXRpYWxpc20nIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBBU0NJSS1vbmx5IHRpdGxlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gZGlhY3JpdGljJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gbGlnYXR1cmUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBwbHVyYWwnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnVG8gYWx0ZXJuYXRpdmUgbmFtZXMnLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gZm9ybWVyIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBoaXN0b3JpYyBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gam9pbnQgYmlvZ3JhcGh5JyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gbmFtZSB3aXRoIHRpdGxlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gbW9ub3R5cGljIHRheG9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gc2NpZW50aWZpYyBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gc3lzdGVtYXRpYyBuYW1lJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gdGVjaG5pY2FsIG5hbWUnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnVG8gXHUyMDEzIG5hdmlnYXRpb24gYW5kIGRpc2FtYmlndWF0aW9uJywgZGlzYWJsZWQ6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIGFuY2hvcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIGFudGhyb3BvbnlteSBwYWdlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gZGlzYW1iaWd1YXRpb24gcGFnZScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIGxpc3QgZW50cnknIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBzZWN0aW9uJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1RvIG1pc2NlbGxhbmVvdXMnLCBkaXNhYmxlZDogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gZGVjYWRlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGFiZWxBbmRWYWx1ZTogJ1IgdG8gcmVsYXRlZCB0b3BpYycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIHN1YnBhZ2UnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsYWJlbEFuZFZhbHVlOiAnUiB0byBzdWJ0b3BpYycgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsQW5kVmFsdWU6ICdSIHRvIFRWIGVwaXNvZGUgbGlzdCBlbnRyeScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxhYmVsOiAnQ3VzdG9tIC0gcHJvbXB0IG1lJywgdmFsdWU6ICdjdXN0b20nIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTm93IGNhdGVnb3JpZXNcbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbCgnPGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9uYW1lXycgKyBpZCArICdcIj5DYXRlZ29yeSBuYW1lOiA8L2xhYmVsPjxpbnB1dCB0eXBlPVwidGV4dFwiIHNpemU9XCIxMDBcIiBuYW1lPVwiYWZjSGVscGVyX3JlZGlyZWN0X25hbWVfJyArIGlkICsgJ1wiIGlkPVwiYWZjSGVscGVyX3JlZGlyZWN0X25hbWVfJyArIGlkICsgJ1wiIHZhbHVlPVwiJyArIHN1Ym1pc3Npb25zW2lkXS50aXRsZSArICdcIiAvPicpO1xuICAgICAgICAgICAgICAgICRleHRyYS5odG1sKCRleHRyYS5odG1sKCkgKyAnPGJyIC8+PGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9wYXJlbnRzXycgKyBpZCArICdcIj5QYXJlbnQgY2F0ZWdvcmllcyAoY29tbWEtc2VwYXJhdGVkKTo8L2xhYmVsPjxpbnB1dCB0eXBlPVwidGV4dFwiIHNpemU9XCIxMDBcIiBpZD1cImFmY0hlbHBlcl9yZWRpcmVjdF9wYXJlbnRzXycgKyBpZCArICdcIiBuYW1lPVwiYWZjSGVscGVyX3JlZGlyZWN0X3BhcmVudHNfJyArIGlkICsgJ1wiIHZhbHVlPVwiJyArIHN1Ym1pc3Npb25zW2lkXS5wYXJlbnRzICsgJ1wiIC8+Jyk7XG4gICAgICAgICAgICAgICAgJGV4dHJhLmFwcGVuZCgnPGJyIC8+Jyk7XG4gICAgICAgICAgICAgICAgJGV4dHJhLmFwcGVuZCgkKCc8aW5wdXQ+JywgeyB0eXBlOiAnY2hlY2tib3gnLCBuYW1lOiAnYWZjSGVscGVyX3JlZGlyZWN0X2NvbnRhaW5lcl8nICsgaWQsIGlkOiAnYWZjSGVscGVyX3JlZGlyZWN0X2NvbnRhaW5lcl8nICsgaWQgfSkpO1xuICAgICAgICAgICAgICAgICRleHRyYS5hcHBlbmQoJzxsYWJlbCBmb3I9XCJhZmNIZWxwZXJfcmVkaXJlY3RfY29udGFpbmVyXycgKyBpZCArICdcIj5UaGlzIGlzIGEgPGEgaHJlZj1cIi93aWtpL1dpa2lwZWRpYTpDb250YWluZXJfY2F0ZWdvcnlcIiB0aXRsZT1cIldpa2lwZWRpYTpDb250YWluZXIgY2F0ZWdvcnlcIj5jb250YWluZXIgY2F0ZWdvcnk8L2E+PC9sYWJlbD4nKTtcbiAgICAgICAgICAgICAgICAkZXh0cmEuaHRtbCgkZXh0cmEuaHRtbCgpICsgJzxiciAvPjxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBuYW1lPVwiYWZjSGVscGVyX3JlZGlyZWN0X2NvbnRhaW5lcl8nICsgaWQgKyAnXCInKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICRleHRyYS5odG1sKCRleHRyYS5odG1sKCkgKyAnPGJyIC8+PGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb21tZW50XycgKyBpZCArICdcIj5Db21tZW50OjwvbGFiZWw+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgc2l6ZT1cIjEwMFwiIGlkPVwiYWZjSGVscGVyX3JlZGlyZWN0X2NvbW1lbnRfJyArIGlkICsgJ1wiIG5hbWU9XCJhZmNIZWxwZXJfcmVkaXJlY3RfY29tbWVudF8nICsgaWQgKyAnXCIvPicpO1xuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdFZhbHVlID09PSAnZGVjbGluZScpIHtcbiAgICAgICAgICAgIGlmIChzdWJtaXNzaW9uc1tpZF0udHlwZSA9PT0gJ3JlZGlyZWN0Jykge1xuICAgICAgICAgICAgICAgICRleHRyYS5odG1sKFxuICAgICAgICAgICAgICAgICAgICAnPGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9kZWNsaW5lXycgK1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1wiPlJlYXNvbiBmb3IgZGVjbGluZTogPC9sYWJlbD4nICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdlbmVyYXRlU2VsZWN0KCdhZmNIZWxwZXJfcmVkaXJlY3RfZGVjbGluZV8nICsgaWQsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnQWxyZWFkeSBleGlzdHMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ2V4aXN0cydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdCbGFuayByZXF1ZXN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6ICdibGFuaydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdObyB2YWxpZCB0YXJnZXQgc3BlY2lmaWVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6ICduby10YXJnZXQnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnVW5saWtlbHkgc2VhcmNoIHRlcm0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ3VubGlrZWx5J1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ05vdCBhIHJlZGlyZWN0IHJlcXVlc3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ25vdC1yZWRpcmVjdCdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdDdXN0b20gLSByZWFzb24gYmVsb3cnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6ICdjdXN0b20nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBOb3cgY2F0ZWdvcmllc1xuICAgICAgICAgICAgICAgICRleHRyYS5odG1sKFxuICAgICAgICAgICAgICAgICAgICAnPGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9kZWNsaW5lXycgK1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1wiPlJlYXNvbiBmb3IgZGVjbGluZTogPC9sYWJlbD4nICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdlbmVyYXRlU2VsZWN0KCdhZmNIZWxwZXJfcmVkaXJlY3RfZGVjbGluZV8nICsgaWQsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnQWxyZWFkeSBleGlzdHMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ2V4aXN0cydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdCbGFuayByZXF1ZXN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6ICdibGFuaydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICdVbmxpa2VseSBjYXRlZ29yeScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiAndW5saWtlbHknXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnTm90IGEgY2F0ZWdvcnkgcmVxdWVzdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiAnbm90LWNhdGVnb3J5J1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ0N1c3RvbSAtIHJlYXNvbiBiZWxvdycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogJ2N1c3RvbSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAkZXh0cmEuaHRtbCgkZXh0cmEuaHRtbCgpICsgJzxici8+PGxhYmVsIGZvcj1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb21tZW50XycgKyBpZCArICdcIj5Db21tZW50OiA8L2xhYmVsPjxpbnB1dCB0eXBlPVwidGV4dFwiIHNpemU9XCIxMDBcIiBpZD1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb21tZW50XycgKyBpZCArICdcIiBuYW1lPVwiYWZjSGVscGVyX3JlZGlyZWN0X2NvbW1lbnRfJyArIGlkICsgJ1wiLz4nKTtcbiAgICAgICAgfSBlbHNlIGlmIChzZWxlY3RWYWx1ZSA9PT0gJ25vbmUnKSB7XG4gICAgICAgICAgICAvLyBGb3IgY2F0ZWdvcmllcyBhbmQgcmVkaXJlY3RzXG4gICAgICAgICAgICAkZXh0cmEuaHRtbCgnJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkZXh0cmEuaHRtbCgkZXh0cmEuaHRtbCgpICsgJzxsYWJlbCBmb3I9XCJhZmNIZWxwZXJfcmVkaXJlY3RfY29tbWVudF8nICsgaWQgKyAnXCI+Q29tbWVudDogPC9sYWJlbD48aW5wdXQgdHlwZT1cInRleHRcIiBzaXplPVwiMTAwXCIgaWQ9XCJhZmNIZWxwZXJfcmVkaXJlY3RfY29tbWVudF8nICsgaWQgKyAnXCIgbmFtZT1cImFmY0hlbHBlcl9yZWRpcmVjdF9jb21tZW50XycgKyBpZCArICdcIi8+Jyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQZXJmb3JtIHRoZSByZWRpcmVjdCBhY3Rpb25zIHNwZWNpZmllZCBieSB0aGUgdXNlclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJlZGlyZWN0UGVyZm9ybUFjdGlvbnMoKSB7XG4gICAgICAgIC8vIExvYWQgYWxsIG9mIHRoZSBkYXRhXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3VibWlzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGFjdGlvbiA9ICQoJyNhZmNIZWxwZXJfcmVkaXJlY3RfYWN0aW9uXycgKyBpKS52YWwoKTtcbiAgICAgICAgICAgIHN1Ym1pc3Npb25zW2ldLmFjdGlvbiA9IGFjdGlvbjtcbiAgICAgICAgICAgIGlmIChhY3Rpb24gPT09ICdub25lJykgY29udGludWU7XG4gICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnYWNjZXB0Jykge1xuICAgICAgICAgICAgICAgIGlmIChzdWJtaXNzaW9uc1tpXS50eXBlID09PSAncmVkaXJlY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Ym1pc3Npb25zW2ldLnRpdGxlID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9mcm9tXycgKyBpKS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0udG8gPSAkKCcjYWZjSGVscGVyX3JlZGlyZWN0X3RvXycgKyBpKS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0uYXBwZW5kID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9hcHBlbmRfJyArIGkpLnZhbCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3VibWlzc2lvbnNbaV0uYXBwZW5kID09PSAnY3VzdG9tJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0uYXBwZW5kID0gcHJvbXB0KCdQbGVhc2UgZW50ZXIgdGhlIHRlbXBsYXRlIHRvIGFwcGVuZCB0byAnICsgc3VibWlzc2lvbnNbaV0udGl0bGUgKyAnLiBEbyBub3QgaW5jbHVkZSB0aGUgY3VybHkgYnJhY2tldHMuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Ym1pc3Npb25zW2ldLmFwcGVuZCA9PT0gJ25vbmUnIHx8IHN1Ym1pc3Npb25zW2ldLmFwcGVuZCA9PT0gbnVsbCkgc3VibWlzc2lvbnNbaV0uYXBwZW5kID0gJyc7XG4gICAgICAgICAgICAgICAgICAgIGVsc2Ugc3VibWlzc2lvbnNbaV0uYXBwZW5kID0gJ3t7JyArIHN1Ym1pc3Npb25zW2ldLmFwcGVuZCArICd9fSc7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0udGl0bGUgPSAkKCcjYWZjSGVscGVyX3JlZGlyZWN0X25hbWVfJyArIGkpLnZhbCgpO1xuICAgICAgICAgICAgICAgICAgICBzdWJtaXNzaW9uc1tpXS5wYXJlbnRzID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9wYXJlbnRzXycgKyBpKS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0uY29udGFpbmVyID0gJCgnI2FmY0hlbHBlcl9yZWRpcmVjdF9jb250YWluZXJfJyArIGkpLmlzKCc6Y2hlY2tlZCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0aW9uID09PSAnZGVjbGluZScpIHtcbiAgICAgICAgICAgICAgICBzdWJtaXNzaW9uc1tpXS5yZWFzb24gPSAkKCcjYWZjSGVscGVyX3JlZGlyZWN0X2RlY2xpbmVfJyArIGkpLnZhbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3VibWlzc2lvbnNbaV0uY29tbWVudCA9ICQoJyNhZmNIZWxwZXJfcmVkaXJlY3RfY29tbWVudF8nICsgaSkudmFsKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRGF0YSBsb2FkZWQuIFNob3cgcHJvZ3Jlc3Mgc2NyZWVuIGFuZCBnZXQgV1A6QUZDL1JDIHBhZ2UgdGV4dFxuICAgICAgICBkaXNwbGF5TWVzc2FnZSgnPHVsIGlkPVwiYWZjSGVscGVyX3N0YXR1c1wiPjwvdWw+PHVsIGlkPVwiYWZjSGVscGVyX2ZpbmlzaFwiPjwvdWw+Jyk7XG4gICAgICAgIGNvbnN0IGFkZFN0YXR1cyA9IGZ1bmN0aW9uIChzdGF0dXMpIHtcbiAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuYXBwZW5kKHN0YXR1cyk7XG4gICAgICAgIH07XG4gICAgICAgICQoJyNhZmNIZWxwZXJfZmluaXNoJykuaHRtbCgkKCcjYWZjSGVscGVyX2ZpbmlzaCcpLmh0bWwoKSArICc8c3BhbiBpZD1cImFmY0hlbHBlcl9maW5pc2hlZF93cmFwcGVyXCI+PHNwYW4gaWQ9XCJhZmNIZWxwZXJfZmluaXNoZWRfbWFpblwiIHN0eWxlPVwiZGlzcGxheTpub25lXCI+PGxpIGlkPVwiYWZjSGVscGVyX2RvbmVcIj48Yj5Eb25lICg8YSBocmVmPVwiJyArIG13LmNvbmZpZy5nZXQoJ3dnQXJ0aWNsZVBhdGgnKS5yZXBsYWNlKCckMScsIGVuY29kZVVSSShyZWRpcmVjdFBhZ2VOYW1lKSkgKyAnP2FjdGlvbj1wdXJnZVwiIHRpdGxlPVwiJyArIHJlZGlyZWN0UGFnZU5hbWUgKyAnXCI+UmVsb2FkIHBhZ2U8L2E+KTwvYj48L2xpPjwvc3Bhbj48L3NwYW4+Jyk7XG4gICAgICAgIGxldCBwYWdlVGV4dCA9IGdldFBhZ2VUZXh0KHJlZGlyZWN0UGFnZU5hbWUsIGFkZFN0YXR1cyk7XG4gICAgICAgIGxldCB0b3RhbEFjY2VwdCA9IDA7XG4gICAgICAgIGxldCB0b3RhbERlY2xpbmUgPSAwO1xuICAgICAgICBsZXQgdG90YWxDb21tZW50ID0gMDtcbiAgICAgICAgLy8gVHJhdmVyc2UgdGhlIHN1Ym1pc3Npb25zIGFuZCBsb2NhdGUgdGhlIHJlbGV2YW50IHNlY3Rpb25zXG4gICAgICAgIGFkZFN0YXR1cygnPGxpPlByb2Nlc3NpbmcgJyArIHJlZGlyZWN0U3VibWlzc2lvbnMubGVuZ3RoICsgJyBzdWJtaXNzaW9uJyArIChyZWRpcmVjdFN1Ym1pc3Npb25zLmxlbmd0aCA9PT0gMSA/ICcnIDogJ3MnKSArICcuLi48L2xpPicpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlZGlyZWN0U3VibWlzc2lvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHN1YiA9IHJlZGlyZWN0U3VibWlzc2lvbnNbaV07XG4gICAgICAgICAgICBpZiAocGFnZVRleHQuaW5kZXhPZihyZWRpcmVjdFNlY3Rpb25zW3N1Yi5zZWN0aW9uXSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgLy8gU29tZW9uZSBoYXMgbW9kaWZpZWQgdGhlIHNlY3Rpb24gaW4gdGhlIG1lYW4gdGltZSwgc2tpcFxuICAgICAgICAgICAgICAgIGFkZFN0YXR1cygnPGxpPlNraXBwaW5nICcgKyBzdWIudGl0bGUgKyAnOiBDYW5ub3QgZmluZCBzZWN0aW9uLiBQZXJoYXBzIGl0IHdhcyBtb2RpZmllZCBpbiB0aGUgbWVhbiB0aW1lPzwvbGk+Jyk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgdGV4dCA9IHJlZGlyZWN0U2VjdGlvbnNbc3ViLnNlY3Rpb25dO1xuICAgICAgICAgICAgY29uc3Qgc3RhcnRJbmRleCA9IHBhZ2VUZXh0LmluZGV4T2YocmVkaXJlY3RTZWN0aW9uc1tzdWIuc2VjdGlvbl0pO1xuICAgICAgICAgICAgY29uc3QgZW5kSW5kZXggPSBzdGFydEluZGV4ICsgdGV4dC5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIEZpcnN0IGRlYWwgd2l0aCBjYXRlZ29yaWVzXG4gICAgICAgICAgICBpZiAoc3ViLnR5cGUgPT09ICdjYXRlZ29yeScpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3ViLmFjdGlvbiA9PT0gJ2FjY2VwdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNhdGVnb3J5VGV4dCA9ICc8IS0tQ3JlYXRlZCBieSBXUDpBRkMgLS0+JztcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Yi5jb250YWluZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGVnb3J5VGV4dCArPSAnXFxue3tDb250YWluZXIgY2F0ZWdvcnl9fSc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Yi5wYXJlbnRzICE9PSAnJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnlUZXh0ID0gc3ViLnBhcmVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJywnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKGNhdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ1tbJyArIGNhdCArICddXSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuam9pbignXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWRpdFBhZ2Uoc3ViLnRpdGxlLCBjYXRlZ29yeVRleHQsICdDcmVhdGVkIHZpYSBbW1dQOkFGQ3xBcnRpY2xlcyBmb3IgQ3JlYXRpb25dXScsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YWxrVGV4dCA9ICd7e3N1YnN0OldQQUZDL2FydGljbGV8Y2xhc3M9Q2F0fX0nO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YWxrVGl0bGUgPSBuZXcgbXcuVGl0bGUoc3ViLnRpdGxlKS5nZXRUYWxrUGFnZSgpLnRvVGV4dCgpO1xuICAgICAgICAgICAgICAgICAgICBlZGl0UGFnZSh0YWxrVGl0bGUsIHRhbGtUZXh0LCAnUGxhY2luZyBXUEFGQyBwcm9qZWN0IGJhbm5lcicsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXIgPSB0ZXh0Lm1hdGNoKC89PVtePV0qPT0vKVswXTtcbiAgICAgICAgICAgICAgICAgICAgdGV4dCA9IGhlYWRlciArICdcXG57e0FmQy1jfGF9fVxcbicgKyB0ZXh0LnN1YnN0cmluZyhoZWFkZXIubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Yi5jb21tZW50ICE9PSAnJykgdGV4dCArPSAnXFxuKnt7c3Vic3Q6YWZjIGNhdGVnb3J5fGFjY2VwdHwyPScgKyBzdWIuY29tbWVudCArICd9fSB+fn5+XFxuJztcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB0ZXh0ICs9ICdcXG4qe3tzdWJzdDphZmMgY2F0ZWdvcnl9fSB+fn5+XFxuJztcbiAgICAgICAgICAgICAgICAgICAgdGV4dCArPSAne3tBZkMtY3xifX1cXG4nO1xuICAgICAgICAgICAgICAgICAgICB0b3RhbEFjY2VwdCsrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3ViLmFjdGlvbiA9PT0gJ2RlY2xpbmUnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IHRleHQubWF0Y2goLz09W149XSo9PS8pWzBdO1xuICAgICAgICAgICAgICAgICAgICBsZXQgcmVhc29uID0gY2F0ZWdvcnlEZWNsaW5lUmVhc29uc1tzdWIucmVhc29uXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gJycpIHJlYXNvbiA9IHN1Yi5jb21tZW50O1xuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChzdWIuY29tbWVudCAhPT0gJycpIHJlYXNvbiA9IHJlYXNvbiArICc6ICcgKyBzdWIuY29tbWVudDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICQoJ2FmY0hlbHBlcl9zdGF0dXMnKS5odG1sKCQoJyNhZmNIZWxwZXJfc3RhdHVzJykuaHRtbCgpICsgJzxsaT5Ta2lwcGluZyAnICsgc3ViLnRpdGxlICsgJzogTm8gZGVjbGluZSByZWFzb24gc3BlY2lmaWVkLjwvbGk+Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0ZXh0ID0gaGVhZGVyICsgJ1xcbnt7QWZDLWN8ZH19XFxuJyArIHRleHQuc3Vic3RyaW5nKGhlYWRlci5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViLmNvbW1lbnQgPT09ICcnKSB0ZXh0ICs9ICdcXG4qe3tzdWJzdDphZmMgY2F0ZWdvcnl8JyArIHN1Yi5yZWFzb24gKyAnfX0gfn5+flxcbic7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgdGV4dCArPSAnXFxuKnt7c3Vic3Q6YWZjIGNhdGVnb3J5fGRlY2xpbmV8Mj0nICsgcmVhc29uICsgJ319IH5+fn5cXG4nO1xuICAgICAgICAgICAgICAgICAgICB0ZXh0ICs9ICd7e0FmQy1jfGJ9fVxcbic7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsRGVjbGluZSsrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3ViLmFjdGlvbiA9PT0gJ2NvbW1lbnQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWIuY29tbWVudCAhPT0gJycpIHRleHQgKz0gJ1xcblxcbnt7YWZjIGNvbW1lbnR8MT0nICsgc3ViLmNvbW1lbnQgKyAnIH5+fn59fVxcbic7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsQ29tbWVudCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIHJlZGlyZWN0c1xuICAgICAgICAgICAgICAgIGxldCBhY2NlcHRDb21tZW50ID0gJyc7XG4gICAgICAgICAgICAgICAgbGV0IGRlY2xpbmVDb21tZW50ID0gJyc7XG4gICAgICAgICAgICAgICAgbGV0IG90aGVyQ29tbWVudCA9ICcnO1xuICAgICAgICAgICAgICAgIGxldCBhY2NlcHRDb3VudCA9IDAsXG4gICAgICAgICAgICAgICAgICAgIGRlY2xpbmVDb3VudCA9IDAsXG4gICAgICAgICAgICAgICAgICAgIGNvbW1lbnRDb3VudCA9IDAsXG4gICAgICAgICAgICAgICAgICAgIGhhc0NvbW1lbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHN1Yi5mcm9tLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlZGlyZWN0ID0gc3ViLmZyb21bal07XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWRpcmVjdC5hY3Rpb24gPT09ICdhY2NlcHQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWRpcmVjdFRleHQgPSBgI1JFRElSRUNUIFtbJHtyZWRpcmVjdC50b31dXSR7cmVkaXJlY3QuYXBwZW5kID8gYFxcblxcbnt7UmVkaXJlY3QgY2F0ZWdvcnkgc2hlbGx8XFxuJHtyZWRpcmVjdC5hcHBlbmR9XFxufX1gIDogJyd9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkaXRQYWdlKHJlZGlyZWN0LnRpdGxlLCByZWRpcmVjdFRleHQsICdSZWRpcmVjdGVkIHBhZ2UgdG8gW1snICsgcmVkaXJlY3QudG8gKyAnXV0gdmlhIFtbV1A6QUZDfEFydGljbGVzIGZvciBDcmVhdGlvbl1dJywgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG13VGl0bGUgPSBuZXcgbXcuVGl0bGUocmVkaXJlY3QudGl0bGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtd1RpdGxlLmlzVGFsa1BhZ2UoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG13VGFsa1RpdGxlID0gbXdUaXRsZS5nZXRUYWxrUGFnZSgpLnRvVGV4dCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhbGtUZXh0ID0gJ3t7c3Vic3Q6V1BBRkMvcmVkaXJlY3R9fSc7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlZGl0UGFnZShtd1RhbGtUaXRsZSwgdGFsa1RleHQsICdQbGFjaW5nIFdQQUZDIHByb2plY3QgYmFubmVyJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NlcHRDb21tZW50ICs9IHJlZGlyZWN0LnRpdGxlICsgJyAmcmFycjsgJyArIHJlZGlyZWN0LnRvO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlZGlyZWN0LmNvbW1lbnQgIT09ICcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q29tbWVudCArPSAnOiAnICsgcmVkaXJlY3QuY29tbWVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNDb21tZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q29tbWVudCArPSAnLiAnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0Q291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChyZWRpcmVjdC5hY3Rpb24gPT09ICdkZWNsaW5lJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlYXNvbiA9IHJlZGlyZWN0RGVjbGluZVJlYXNvbnNbcmVkaXJlY3QucmVhc29uXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWFzb24gPT09ICcnKSByZWFzb24gPSByZWRpcmVjdC5jb21tZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAocmVkaXJlY3QuY29tbWVudCAhPT0gJycpIHJlYXNvbiA9IHJlYXNvbiArICc6ICcgKyByZWRpcmVjdC5jb21tZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjYWZjSGVscGVyX3N0YXR1cycpLmh0bWwoJCgnI2FmY0hlbHBlcl9zdGF0dXMnKS5odG1sKCkgKyAnPGxpPlNraXBwaW5nICcgKyByZWRpcmVjdC50aXRsZSArICc6IE5vIGRlY2xpbmUgcmVhc29uIHNwZWNpZmllZC48L2xpPicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGVjbGluZUNvbW1lbnQgKz0gcmVkaXJlY3QucmVhc29uID09PSAnYmxhbmsnIHx8IHJlZGlyZWN0LnJlYXNvbiA9PT0gJ25vdC1yZWRpcmVjdCcgPyByZWFzb24gKyAnLiAnIDogcmVkaXJlY3QudGl0bGUgKyAnICZyYXJyOyAnICsgcmVkaXJlY3QudG8gKyAnOiAnICsgcmVhc29uICsgJy4gJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY2xpbmVDb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlZGlyZWN0LmFjdGlvbiA9PT0gJ2NvbW1lbnQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdGhlckNvbW1lbnQgKz0gcmVkaXJlY3QudGl0bGUgKyAnOiAnICsgcmVkaXJlY3QuY29tbWVudCArICcuICc7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21tZW50Q291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsZXQgcmVhc29uID0gJyc7XG5cbiAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q291bnQgPiAwKSByZWFzb24gKz0gJ1xcbip7e3N1YnN0OmFmYyByZWRpcmVjdHxhY2NlcHR8Mj0nICsgYWNjZXB0Q29tbWVudCArICcgVGhhbmsgeW91IGZvciB5b3VyIGNvbnRyaWJ1dGlvbnMgdG8gV2lraXBlZGlhIX19IH5+fn4nO1xuICAgICAgICAgICAgICAgIGlmIChkZWNsaW5lQ291bnQgPiAwKSByZWFzb24gKz0gJ1xcbip7e3N1YnN0OmFmYyByZWRpcmVjdHxkZWNsaW5lfDI9JyArIGRlY2xpbmVDb21tZW50ICsgJ319IH5+fn4nO1xuICAgICAgICAgICAgICAgIGlmIChjb21tZW50Q291bnQgPiAwKSByZWFzb24gKz0gJ1xcbip7e2FmYyBjb21tZW50fDE9JyArIG90aGVyQ29tbWVudCArICd+fn5+fX0nO1xuICAgICAgICAgICAgICAgIHJlYXNvbiArPSAnXFxuJztcbiAgICAgICAgICAgICAgICBpZiAoIWhhc0NvbW1lbnQgJiYgYWNjZXB0Q291bnQgPT09IHN1Yi5mcm9tLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q291bnQgPiAxKSByZWFzb24gPSAnXFxuKnt7c3Vic3Q6YWZjIHJlZGlyZWN0fGFsbH19IH5+fn5cXG4nO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIHJlYXNvbiA9ICdcXG4qe3tzdWJzdDphZmMgcmVkaXJlY3R9fSB+fn5+XFxuJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGFjY2VwdENvdW50ICsgZGVjbGluZUNvdW50ICsgY29tbWVudENvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q291bnQgKyBkZWNsaW5lQ291bnQgPT09IHN1Yi5mcm9tLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXZlcnkgcmVxdWVzdCBoYW5kbGVkLCBjbG9zZVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyID0gdGV4dC5tYXRjaCgvPT1bXj1dKj09LylbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYWNjZXB0Q291bnQgPiAwICYmIGRlY2xpbmVDb3VudCA+IDApIHRleHQgPSBoZWFkZXIgKyAnXFxue3tBZkMtY3xwfX0nICsgdGV4dC5zdWJzdHJpbmcoaGVhZGVyLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChhY2NlcHRDb3VudCA+IDApIHRleHQgPSBoZWFkZXIgKyAnXFxue3tBZkMtY3xhfX0nICsgdGV4dC5zdWJzdHJpbmcoaGVhZGVyLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHRleHQgPSBoZWFkZXIgKyAnXFxue3tBZkMtY3xkfX0nICsgdGV4dC5zdWJzdHJpbmcoaGVhZGVyLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0ICs9IHJlYXNvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHQgKz0gJ3t7QWZDLWN8Yn19XFxuJztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHRleHQgKz0gcmVhc29uICsgJ1xcbic7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRvdGFsQWNjZXB0ICs9IGFjY2VwdENvdW50O1xuICAgICAgICAgICAgICAgIHRvdGFsRGVjbGluZSArPSBkZWNsaW5lQ291bnQ7XG4gICAgICAgICAgICAgICAgdG90YWxDb21tZW50ICs9IGNvbW1lbnRDb3VudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhZ2VUZXh0ID0gcGFnZVRleHQuc3Vic3RyaW5nKDAsIHN0YXJ0SW5kZXgpICsgdGV4dCArIHBhZ2VUZXh0LnN1YnN0cmluZyhlbmRJbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3VtbWFyeSA9ICdVcGRhdGluZyBzdWJtaXNzaW9uIHN0YXR1czonO1xuICAgICAgICBpZiAodG90YWxBY2NlcHQgPiAwKSBzdW1tYXJ5ICs9ICcgYWNjZXB0aW5nICcgKyB0b3RhbEFjY2VwdCArICcgcmVxdWVzdCcgKyAodG90YWxBY2NlcHQgPiAxID8gJ3MnIDogJycpO1xuICAgICAgICBpZiAodG90YWxEZWNsaW5lID4gMCkge1xuICAgICAgICAgICAgaWYgKHRvdGFsQWNjZXB0ID4gMCkgc3VtbWFyeSArPSAnLCc7XG4gICAgICAgICAgICBzdW1tYXJ5ICs9ICcgZGVjbGluaW5nICcgKyB0b3RhbERlY2xpbmUgKyAnIHJlcXVlc3QnICsgKHRvdGFsRGVjbGluZSA+IDEgPyAncycgOiAnJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRvdGFsQ29tbWVudCA+IDApIHtcbiAgICAgICAgICAgIGlmICh0b3RhbEFjY2VwdCA+IDAgfHwgdG90YWxEZWNsaW5lID4gMCkgc3VtbWFyeSArPSAnLCc7XG4gICAgICAgICAgICBzdW1tYXJ5ICs9ICcgY29tbWVudGluZyBvbiAnICsgdG90YWxDb21tZW50ICsgJyByZXF1ZXN0JyArICh0b3RhbENvbW1lbnQgPiAxID8gJ3MnIDogJycpO1xuICAgICAgICB9XG5cbiAgICAgICAgZWRpdFBhZ2UocmVkaXJlY3RQYWdlTmFtZSwgcGFnZVRleHQsIHN1bW1hcnksIGZhbHNlKTtcblxuICAgICAgICAvLyBEaXNwbGF5IHRoZSBcIkRvbmVcIiB0ZXh0IG9ubHkgYWZ0ZXIgYWxsIGFqYXggcmVxdWVzdHMgYXJlIGNvbXBsZXRlZFxuICAgICAgICAkKGRvY3VtZW50KS5hamF4U3RvcCgoKSA9PiB7XG4gICAgICAgICAgICAkKCcjYWZjSGVscGVyX2ZpbmlzaGVkX21haW4nKS5jc3MoJ2Rpc3BsYXknLCAnJyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHRleHQgb2YgYSBwYWdlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIHRoZSB0aXRsZSBvZiB0aGUgcGFnZSB0byBnZXRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBhZGRTdGF0dXMgYSBmdW5jdGlvbiB0aGF0IHRha2VzIGEgSFRNTCBzdHJpbmcgdG8gcmVwb3J0IHN0YXR1c1xuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSB0ZXh0IG9mIHRoZSBwYWdlXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0UGFnZVRleHQodGl0bGUsIGFkZFN0YXR1cykge1xuICAgICAgICBhZGRTdGF0dXMgPSB0eXBlb2YgYWRkU3RhdHVzICE9PSAndW5kZWZpbmVkJyA/IGFkZFN0YXR1cyA6IGZ1bmN0aW9uICgpIHt9OyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1lbXB0eS1mdW5jdGlvblxuICAgICAgICBhZGRTdGF0dXMoJzxsaSBpZD1cImFmY0hlbHBlcl9nZXQnICsganFFc2NhcGUodGl0bGUpICsgJ1wiPkdldHRpbmcgPGEgaHJlZj1cIicgKyBtdy5jb25maWcuZ2V0KCd3Z0FydGljbGVQYXRoJykucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSArICdcIiB0aXRsZT1cIicgKyB0aXRsZSArICdcIj4nICsgdGl0bGUgKyAnPC9hPjwvbGk+Jyk7XG5cbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHtcbiAgICAgICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgICAgIHByb3A6ICdyZXZpc2lvbnMnLFxuICAgICAgICAgICAgcnZwcm9wOiAnY29udGVudCcsXG4gICAgICAgICAgICBmb3JtYXQ6ICdqc29uJyxcbiAgICAgICAgICAgIGluZGV4cGFnZWlkczogdHJ1ZSxcbiAgICAgICAgICAgIHRpdGxlczogdGl0bGVcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCByZXNwb25zZSA9IEpTT04ucGFyc2UoXG4gICAgICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgICAgIHVybDogbXcudXRpbC53aWtpU2NyaXB0KCdhcGknKSxcbiAgICAgICAgICAgICAgICBkYXRhOiByZXF1ZXN0LFxuICAgICAgICAgICAgICAgIGFzeW5jOiBmYWxzZVxuICAgICAgICAgICAgfSkucmVzcG9uc2VUZXh0XG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgcGFnZUlkID0gcmVzcG9uc2UucXVlcnkucGFnZWlkc1swXTtcbiAgICAgICAgaWYgKHBhZ2VJZCA9PT0gJy0xJykge1xuICAgICAgICAgICAgYWRkU3RhdHVzKCdUaGUgcGFnZSA8YSBjbGFzcz1cIm5ld1wiIGhyZWY9XCInICsgbXcuY29uZmlnLmdldCgnd2dBcnRpY2xlUGF0aCcpLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgKyAnXCIgdGl0bGU9XCInICsgdGl0bGUgKyAnXCI+JyArIHRpdGxlICsgJzwvYT4gZG9lcyBub3QgZXhpc3QnKTtcbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuZXdUZXh0ID0gcmVzcG9uc2UucXVlcnkucGFnZXNbcGFnZUlkXS5yZXZpc2lvbnNbMF1bJyonXTtcbiAgICAgICAgYWRkU3RhdHVzKCc8bGkgaWQ9XCJhZmNIZWxwZXJfZ2V0JyArIGpxRXNjYXBlKHRpdGxlKSArICdcIj5Hb3QgPGEgaHJlZj1cIicgKyBtdy5jb25maWcuZ2V0KCd3Z0FydGljbGVQYXRoJykucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSArICdcIiB0aXRsZT1cIicgKyB0aXRsZSArICdcIj4nICsgdGl0bGUgKyAnPC9hPjwvbGk+Jyk7XG4gICAgICAgIHJldHVybiBuZXdUZXh0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFucyB1cCB0aGUgbGlua3MgaW4gYSBwYWdlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgdGhlIHBhZ2UgY29udGVudFxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBwYWdlIGNvbnRlbnQgd2l0aCB0aGUgbGlua3MgY2xlYW5lZCB1cFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNsZWFudXBMaW5rcyh0ZXh0KSB7XG4gICAgICAgIC8vIENvbnZlcnQgZXh0ZXJuYWwgbGlua3MgdG8gV2lraXBlZGlhIGFydGljbGVzIHRvIHByb3BlciB3aWtpbGlua3NcbiAgICAgICAgY29uc3Qgd2lraWxpbmtSZWdleCA9IC8oXFxbKXsxLDJ9KD86aHR0cHM/Oik/XFwvXFwvKGVuLndpa2lwZWRpYS5vcmdcXC93aWtpfGVud3Aub3JnKVxcLyhbXlxcc3xcXF1bXSspKFxcc3xcXHwpPygoPzpcXFtcXFtbXltcXF1dKlxcXVxcXXxbXlxcXVtdKSopKFxcXSl7MSwyfS9naTtcbiAgICAgICAgY29uc3QgdGVtcFRleHQgPSB0ZXh0O1xuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSB3aWtpbGlua1JlZ2V4LmV4ZWModGVtcFRleHQpKSkge1xuICAgICAgICAgICAgY29uc3QgcGFnZU5hbWUgPSBkZWNvZGVVUkkobWF0Y2hbM10ucmVwbGFjZSgvXy9nLCAnICcpKTtcbiAgICAgICAgICAgIGxldCBkaXNwbGF5bmFtZSA9IGRlY29kZVVSSShtYXRjaFs1XS5yZXBsYWNlKC9fL2csICcgJykpO1xuICAgICAgICAgICAgaWYgKHBhZ2VOYW1lID09PSBkaXNwbGF5bmFtZSkgZGlzcGxheW5hbWUgPSAnJztcbiAgICAgICAgICAgIGNvbnN0IHJlcGxhY2VUZXh0ID0gJ1tbJyArIHBhZ2VOYW1lICsgKGRpc3BsYXluYW1lID8gJ3wnICsgZGlzcGxheW5hbWUgOiAnJykgKyAnXV0nO1xuICAgICAgICAgICAgdGV4dCA9IHRleHQucmVwbGFjZShtYXRjaFswXSwgcmVwbGFjZVRleHQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0ZXh0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlcyB0aGUgc2VsZWN0IGVsZW1lbnQgb3V0ZXIgSFRNTCBmb3IgYSByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIHRoZSBwYWdlIHRpdGxlXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gb3B0aW9ucyB0aGUgc2VsZWN0IGVsZW1lbnQgb3B0aW9uc1xuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBzZWxlY3QgZWxlbWVudCBvdXRlciBIVE1MXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVTZWxlY3QodGl0bGUsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlU2VsZWN0T2JqZWN0KHRpdGxlLCBvcHRpb25zKS5wcm9wKCdvdXRlckhUTUwnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgYSBzZWxlY3QgZWxlbWVudCBmb3IgYSByZXF1ZXN0XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRpdGxlIHRoZSBwYWdlIHRpdGxlXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gb3B0aW9ucyB0aGUgc2VsZWN0IGVsZW1lbnQgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uY2hhbmdlIHRoZSBvbmNoYW5nZSBmdW5jdGlvblxuICAgICAqIEByZXR1cm5zIHsqfSB0aGUgc2VsZWN0IGpRdWVyeSBlbGVtZW50XG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2VuZXJhdGVTZWxlY3RPYmplY3QodGl0bGUsIG9wdGlvbnMsIG9uY2hhbmdlKSB7XG4gICAgICAgIGNvbnN0ICRzZWxlY3QgPSAkKCc8c2VsZWN0PicpLmF0dHIoJ25hbWUnLCB0aXRsZSkuYXR0cignaWQnLCB0aXRsZSk7XG4gICAgICAgIGlmIChvbmNoYW5nZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgJHNlbGVjdC5jaGFuZ2Uob25jaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICAgIG9wdGlvbnMuZm9yRWFjaCgob3B0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAob3B0aW9uLmxhYmVsQW5kVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBvcHRpb24udmFsdWUgPSBvcHRpb24ubGFiZWxBbmRWYWx1ZTtcbiAgICAgICAgICAgICAgICBvcHRpb24ubGFiZWwgPSBvcHRpb24ubGFiZWxBbmRWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0ICRvcHRpb24gPSAkKCc8b3B0aW9uPicpLmFwcGVuZFRvKCRzZWxlY3QpLnZhbChvcHRpb24udmFsdWUpLnRleHQob3B0aW9uLmxhYmVsKTtcbiAgICAgICAgICAgIGlmIChvcHRpb24uc2VsZWN0ZWQpICRvcHRpb24uYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcbiAgICAgICAgICAgIGlmIChvcHRpb24uZGlzYWJsZWQpICRvcHRpb24uYXR0cignZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiAkc2VsZWN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBvbGQgbXcudXRpbC5qc01lc3NhZ2UgZnVuY3Rpb24gYmVmb3JlIGh0dHBzOi8vZ2Vycml0Lndpa2ltZWRpYS5vcmcvci8jL2MvMTc2MDUvLCB3aGljaFxuICAgICAqIGludHJvZHVjZWQgdGhlIHNpbGx5IGF1dG8taGlkZSBmdW5jdGlvbi4gQWxzbyB3aXRoIHRoZSBvcmlnaW5hbCBzdHlsZXMuXG4gICAgICogQWRkIGEgbGl0dGxlIGJveCBhdCB0aGUgdG9wIG9mIHRoZSBzY3JlZW4gdG8gaW5mb3JtIHRoZSB1c2VyIG9mXG4gICAgICogc29tZXRoaW5nLCByZXBsYWNpbmcgYW55IHByZXZpb3VzIG1lc3NhZ2UuXG4gICAgICogQ2FsbGluZyB3aXRoIG5vIGFyZ3VtZW50cywgd2l0aCBhbiBlbXB0eSBzdHJpbmcgb3IgbnVsbCB3aWxsIGhpZGUgdGhlIG1lc3NhZ2VcbiAgICAgKiBUYWtlbiBmcm9tIFtbVXNlcjpUaW1vdGhldXMgQ2FuZW5zL2Rpc3BsYXltZXNzYWdlLmpzXV1cbiAgICAgKiBAcGFyYW0geyp9IG1lc3NhZ2UgVGhlIERPTS1lbGVtZW50LCBqUXVlcnkgb2JqZWN0IG9yIEhUTUwtc3RyaW5nIHRvIGJlIHB1dCBpbnNpZGUgdGhlIG1lc3NhZ2UgYm94LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjbGFzc05hbWUgVXNlZCBpbiBhZGRpbmcgYSBjbGFzczsgc2hvdWxkIGJlIGRpZmZlcmVudCBmb3IgZWFjaCBjYWxsIHRvIGFsbG93IENTUy9KUyB0byBoaWRlIGRpZmZlcmVudCBib3hlcy4gbnVsbCA9IG5vIGNsYXNzIHVzZWQuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgb24gc3VjY2VzcywgZmFsc2Ugb24gZmFpbHVyZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBkaXNwbGF5TWVzc2FnZShtZXNzYWdlLCBjbGFzc05hbWUpIHtcbiAgICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoIHx8IG1lc3NhZ2UgPT09ICcnIHx8IG1lc3NhZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgICQoJyNkaXNwbGF5LW1lc3NhZ2UnKS5lbXB0eSgpLmhpZGUoKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBFbXB0eWluZyBhbmQgaGlkaW5nIG1lc3NhZ2UgaXMgaW50ZW5kZWQgYmVoYXZpb3VyLCByZXR1cm4gdHJ1ZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gV2Ugc3BlY2lhbC1jYXNlIHNraW4gc3RydWN0dXJlcyBwcm92aWRlZCBieSB0aGUgc29mdHdhcmUuIFNraW5zIHRoYXRcbiAgICAgICAgICAgIC8vIGNob29zZSB0byBhYmFuZG9uIG9yIHNpZ25pZmljYW50bHkgbW9kaWZ5IG91ciBmb3JtYXR0aW5nIGNhbiBqdXN0IGRlZmluZVxuICAgICAgICAgICAgLy8gYW4gbXctanMtbWVzc2FnZSBkaXYgdG8gc3RhcnQgd2l0aC5cbiAgICAgICAgICAgIGxldCAkbWVzc2FnZURpdiA9ICQoJyNkaXNwbGF5LW1lc3NhZ2UnKTtcbiAgICAgICAgICAgIGlmICghJG1lc3NhZ2VEaXYubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgJG1lc3NhZ2VEaXYgPSAkKCc8ZGl2IGlkPVwiZGlzcGxheS1tZXNzYWdlXCIgc3R5bGU9XCJtYXJnaW46MWVtO3BhZGRpbmc6MC41ZW0gMi41JTtib3JkZXI6c29saWQgMXB4ICNkZGQ7YmFja2dyb3VuZC1jb2xvcjojZmNmY2ZjO2ZvbnQtc2l6ZTogMC44ZW1cIj48L2Rpdj4nKTtcbiAgICAgICAgICAgICAgICBpZiAobXcudXRpbC4kY29udGVudC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbXcudXRpbC4kY29udGVudC5wcmVwZW5kKCRtZXNzYWdlRGl2KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNsYXNzTmFtZSkgJG1lc3NhZ2VEaXYucHJvcCgnY2xhc3MnLCAnZGlzcGxheS1tZXNzYWdlLScgKyBjbGFzc05hbWUpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBtZXNzYWdlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICRtZXNzYWdlRGl2LmVtcHR5KCk7XG4gICAgICAgICAgICAgICAgJG1lc3NhZ2VEaXYuYXBwZW5kKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSBlbHNlICRtZXNzYWdlRGl2Lmh0bWwobWVzc2FnZSk7XG4gICAgICAgICAgICAkbWVzc2FnZURpdlswXS5zY3JvbGxJbnRvVmlldygpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFc2NhcGVzIGEgc3RyaW5nIGZvciB1c2UgaW4galF1ZXJ5IHNlbGVjdG9yc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBleHByZXNzaW9uIHRoZSBleHByZXNzaW9uIHRvIGVzY2FwZVxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBlc2NhcGVkIGV4cHJlc3Npb25cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBqcUVzY2FwZShleHByZXNzaW9uKSB7XG4gICAgICAgIHJldHVybiBleHByZXNzaW9uLnJlcGxhY2UoL1shXCIjJCUmJygpKissLi86Ozw9Pj9AW1xcXFxcXF1eYHt8fX4gXS9nLCAnJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWRpdHMgYSBnaXZlbiBwYWdlLCBhbmQgdXBkYXRlcyB0aGUgVUlcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGl0bGUgdGhlIHBhZ2UgdGl0bGUgdG8gZWRpdFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuZXdUZXh0IHRoZSBuZXcgdGV4dCB0byBpbnNlcnRcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3VtbWFyeSB0aGUgZWRpdCBzdW1tYXJ5XG4gICAgICogQHBhcmFtIHtib29sZWFufSBjcmVhdGVPbmx5IHdoZXRoZXIgdG8gb25seSBjcmVhdGUgdGhlIHBhZ2UgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbm9QYXRyb2wgd2hldGhlciB0byBub3QgbWFyayB0aGUgZWRpdCBhcyBwYXRyb2xsZWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBlZGl0UGFnZSh0aXRsZSwgbmV3VGV4dCwgc3VtbWFyeSwgY3JlYXRlT25seSwgbm9QYXRyb2wpIHtcbiAgICAgICAgY29uc3Qgd2dBcnRpY2xlUGF0aCA9IG13LmNvbmZpZy5nZXQoJ3dnQXJ0aWNsZVBhdGgnKTtcbiAgICAgICAgc3VtbWFyeSArPSBzdW1tYXJ5QWR2ZXJ0O1xuICAgICAgICAkKCcjYWZjSGVscGVyX2ZpbmlzaGVkX3dyYXBwZXInKS5odG1sKCc8c3BhbiBpZD1cImFmY0hlbHBlcl9BSkFYX2ZpbmlzaGVkXycgKyBhamF4TnVtYmVyICsgJ1wiIHN0eWxlPVwiZGlzcGxheTpub25lXCI+JyArICQoJyNhZmNIZWxwZXJfZmluaXNoZWRfd3JhcHBlcicpLmh0bWwoKSArICc8L3NwYW4+Jyk7XG4gICAgICAgIGNvbnN0IGZ1bmN0aW9uSWQgPSBhamF4TnVtYmVyO1xuICAgICAgICBhamF4TnVtYmVyKys7XG4gICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuaHRtbCgkKCcjYWZjSGVscGVyX3N0YXR1cycpLmh0bWwoKSArICc8bGkgaWQ9XCJhZmNIZWxwZXJfZWRpdCcgKyBqcUVzY2FwZSh0aXRsZSkgKyAnXCI+RWRpdGluZyA8YSBocmVmPVwiJyArIHdnQXJ0aWNsZVBhdGgucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSArICdcIiB0aXRsZT1cIicgKyB0aXRsZSArICdcIj4nICsgdGl0bGUgKyAnPC9hPjwvbGk+Jyk7XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSB7XG4gICAgICAgICAgICBhY3Rpb246ICdlZGl0JyxcbiAgICAgICAgICAgIHRpdGxlLFxuICAgICAgICAgICAgdGV4dDogbmV3VGV4dCxcbiAgICAgICAgICAgIHN1bW1hcnlcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGNyZWF0ZU9ubHkpIHJlcXVlc3QuY3JlYXRlb25seSA9IHRydWU7XG5cbiAgICAgICAgY29uc3QgYXBpID0gbmV3IG13LkFwaSgpO1xuICAgICAgICBhcGkucG9zdFdpdGhFZGl0VG9rZW4ocmVxdWVzdClcbiAgICAgICAgICAgIC5kb25lKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5lZGl0ICYmIGRhdGEuZWRpdC5yZXN1bHQgJiYgZGF0YS5lZGl0LnJlc3VsdCA9PT0gJ1N1Y2Nlc3MnKSB7XG4gICAgICAgICAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfZWRpdCcgKyBqcUVzY2FwZSh0aXRsZSkpLmh0bWwoJ1NhdmVkIDxhIGhyZWY9XCInICsgd2dBcnRpY2xlUGF0aC5yZXBsYWNlKCckMScsIGVuY29kZVVSSSh0aXRsZSkpICsgJ1wiIHRpdGxlPVwiJyArIHRpdGxlICsgJ1wiPicgKyB0aXRsZSArICc8L2E+Jyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgJCgnI2FmY0hlbHBlcl9lZGl0JyArIGpxRXNjYXBlKHRpdGxlKSkuaHRtbCgnPHNwYW4gY2xhc3M9XCJhZmNIZWxwZXJfbm90aWNlXCI+PGI+RWRpdCBmYWlsZWQgb24gPGEgaHJlZj1cIicgKyB3Z0FydGljbGVQYXRoLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgKyAnXCIgdGl0bGU9XCInICsgdGl0bGUgKyAnXCI+JyArIHRpdGxlICsgJzwvYT48L2I+PC9zcGFuPi4gRXJyb3IgaW5mbzogJyArIEpTT04uc3RyaW5naWZ5KGRhdGEpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRWRpdCBmYWlsZWQgb24gJXMgKCVzKS4gRXJyb3IgaW5mbzogJXMnLCB3Z0FydGljbGVQYXRoLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSksIHRpdGxlLCBKU09OLnN0cmluZ2lmeShkYXRhKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5mYWlsKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjcmVhdGVPbmx5ICYmIGVycm9yID09PSAnYXJ0aWNsZWV4aXN0cycpICQoJyNhZmNIZWxwZXJfZWRpdCcgKyBqcUVzY2FwZSh0aXRsZSkpLmh0bWwoJzxzcGFuIGNsYXNzPVwiYWZjSGVscGVyX25vdGljZVwiPjxiPkVkaXQgZmFpbGVkIG9uIDxhIGhyZWY9XCInICsgd2dBcnRpY2xlUGF0aC5yZXBsYWNlKCckMScsIGVuY29kZVVSSSh0aXRsZSkpICsgJ1wiIHRpdGxlPVwiJyArIHRpdGxlICsgJ1wiPicgKyB0aXRsZSArICc8L2E+PC9iPjwvc3Bhbj4uIEVycm9yIGluZm86IFRoZSBhcnRpY2xlIGFscmVhZHkgZXhpc3RzIScpO1xuICAgICAgICAgICAgICAgIGVsc2UgJCgnI2FmY0hlbHBlcl9lZGl0JyArIGpxRXNjYXBlKHRpdGxlKSkuaHRtbCgnPHNwYW4gY2xhc3M9XCJhZmNIZWxwZXJfbm90aWNlXCI+PGI+RWRpdCBmYWlsZWQgb24gPGEgaHJlZj1cIicgKyB3Z0FydGljbGVQYXRoLnJlcGxhY2UoJyQxJywgZW5jb2RlVVJJKHRpdGxlKSkgKyAnXCIgdGl0bGU9XCInICsgdGl0bGUgKyAnXCI+JyArIHRpdGxlICsgJzwvYT48L2I+PC9zcGFuPi4gRXJyb3IgaW5mbzogJyArIGVycm9yKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuYWx3YXlzKCgpID0+IHtcbiAgICAgICAgICAgICAgICAkKCcjYWZjSGVscGVyX0FKQVhfZmluaXNoZWRfJyArIGZ1bmN0aW9uSWQpLmNzcygnZGlzcGxheScsICcnKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIGlmICghbm9QYXRyb2wpIHtcbiAgICAgICAgICAgIC8qIFdlIHBhdHJvbCBieSBkZWZhdWx0ICovXG4gICAgICAgICAgICBpZiAoJCgnLnBhdHJvbGxpbmsnKS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IHRoZSByY2lkIHRva2VuIGZyb20gdGhlIFwiTWFyayBwYWdlIGFzIHBhdHJvbGxlZFwiIGxpbmsgb24gcGFnZVxuICAgICAgICAgICAgICAgIGNvbnN0IHBhdHJvbEhyZWYgPSAkKCcucGF0cm9sbGluayBhJykuYXR0cignaHJlZicpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJjSWQgPSBtdy51dGlsLmdldFBhcmFtVmFsdWUoJ3JjaWQnLCBwYXRyb2xIcmVmKTtcblxuICAgICAgICAgICAgICAgIGlmIChyY0lkKSB7XG4gICAgICAgICAgICAgICAgICAgICQoJyNhZmNIZWxwZXJfc3RhdHVzJykuaHRtbCgkKCcjYWZjSGVscGVyX3N0YXR1cycpLmh0bWwoKSArICc8bGkgaWQ9XCJhZmNIZWxwZXJfcGF0cm9sJyArIGpxRXNjYXBlKHRpdGxlKSArICdcIj5NYXJraW5nIDxhIGhyZWY9XCInICsgd2dBcnRpY2xlUGF0aC5yZXBsYWNlKCckMScsIGVuY29kZVVSSSh0aXRsZSkpICsgJ1wiIHRpdGxlPVwiJyArIHRpdGxlICsgJ1wiPicgKyB0aXRsZSArICcgYXMgcGF0cm9sbGVkPC9hPjwvbGk+Jyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhdHJvbFJlcXVlc3QgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246ICdwYXRyb2wnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9ybWF0OiAnanNvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICByY2lkOiByY0lkXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGFwaS5wb3N0V2l0aFRva2VuKCdwYXRyb2wnLCBwYXRyb2xSZXF1ZXN0KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRvbmUoKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjYWZjSGVscGVyX3BhdHJvbCcgKyBqcUVzY2FwZSh0aXRsZSkpLmh0bWwoJ01hcmtlZCA8YSBocmVmPVwiJyArIHdnQXJ0aWNsZVBhdGgucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSArICdcIiB0aXRsZT1cIicgKyB0aXRsZSArICdcIj4nICsgdGl0bGUgKyAnPC9hPiBhcyBwYXRyb2xsZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjYWZjSGVscGVyX3BhdHJvbCcgKyBqcUVzY2FwZSh0aXRsZSkpLmh0bWwoJzxzcGFuIGNsYXNzPVwiYWZjSGVscGVyX25vdGljZVwiPjxiPlBhdHJvbGxpbmcgZmFpbGVkIG9uIDxhIGhyZWY9XCInICsgd2dBcnRpY2xlUGF0aC5yZXBsYWNlKCckMScsIGVuY29kZVVSSSh0aXRsZSkpICsgJ1wiIHRpdGxlPVwiJyArIHRpdGxlICsgJ1wiPicgKyB0aXRsZSArICc8L2E+PC9iPjwvc3Bhbj4gd2l0aCBhbiB1bmtub3duIGVycm9yJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1BhdHJvbGxpbmcgZmFpbGVkIG9uICVzICglcykgd2l0aCBhbiB1bmtub3duIGVycm9yLicsIHdnQXJ0aWNsZVBhdGgucmVwbGFjZSgnJDEnLCBlbmNvZGVVUkkodGl0bGUpKSwgdGl0bGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmFpbCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkKCcjYWZjSGVscGVyX3BhdHJvbCcgKyBqcUVzY2FwZSh0aXRsZSkpLmh0bWwoJzxzcGFuIGNsYXNzPVwiYWZjSGVscGVyX25vdGljZVwiPjxiPlBhdHJvbGxpbmcgZmFpbGVkIG9uIDxhIGhyZWY9XCInICsgd2dBcnRpY2xlUGF0aC5yZXBsYWNlKCckMScsIGVuY29kZVVSSSh0aXRsZSkpICsgJ1wiIHRpdGxlPVwiJyArIHRpdGxlICsgJ1wiPicgKyB0aXRsZSArICc8L2E+PC9iPjwvc3Bhbj4uIEVycm9yIGluZm86ICcgKyBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kuYXBpJywgJ21lZGlhd2lraS51dGlsJ10sICgpID0+IHtcbiAgICAgICAgbXcudXRpbC5hZGRDU1MoYFxuI2Rpc3BsYXktbWVzc2FnZSAqIHtcbiAgICBwYWRkaW5nOiByZXZlcnQ7XG4gICAgbWFyZ2luOiByZXZlcnQ7XG4gICAgYm9yZGVyOiByZXZlcnQ7XG4gICAgYmFja2dyb3VuZDogcmV2ZXJ0O1xufVxuYCk7XG4gICAgICAgIGNvbnN0IHJlZGlyZWN0UG9ydGxldExpbmsgPSBtdy51dGlsLmFkZFBvcnRsZXRMaW5rKG13LmNvbmZpZy5nZXQoJ3NraW4nKSA9PT0gJ21pbmVydmEnID8gJ3AtdGInIDogJ3AtY2FjdGlvbnMnLCAnIycsICdSZXZpZXcgQUZDL1JDJywgJ2NhLWFmY3JocycsICdSZXZpZXcnLCAnYScpO1xuICAgICAgICAkKHJlZGlyZWN0UG9ydGxldExpbmspLmNsaWNrKChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIC8vIENsZWFyIHZhcmlhYmxlcyBmb3IgdGhlIGNhc2Ugc29tZWJvZHkgaXMgY2xpY2tpbmcgb24gXCJyZXZpZXdcIiBtdWx0aXBsZSB0aW1lc1xuICAgICAgICAgICAgcmVkaXJlY3RTdWJtaXNzaW9ucy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgcmVkaXJlY3RTZWN0aW9ucy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgbnVtVG90YWwgPSAwO1xuICAgICAgICAgICAgc3VibWlzc2lvbnMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIG5lZWRzVXBkYXRlLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICByZWRpcmVjdEluaXQoKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59KSgpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtDQUFDLFdBQVk7QUFDVCxNQUFJLEdBQUcsT0FBTyxJQUFJLFlBQVksTUFBTTtBQUE0RDtBQUVoRyxRQUFNLG1CQUFtQixHQUFHLE9BQU8sSUFBSSxZQUFZLEVBQUUsUUFBUSxNQUFNLEdBQUc7QUFDdEUsUUFBTSxzQkFBc0IsQ0FBQztBQUM3QixNQUFJLG1CQUFtQixDQUFDO0FBQ3hCLFFBQU0sZ0JBQWdCO0FBQ3RCLE1BQUksV0FBVztBQUNmLE1BQUksYUFBYTtBQUNqQixRQUFNLGNBQWMsQ0FBQztBQUNyQixRQUFN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
