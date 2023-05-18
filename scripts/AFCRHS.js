/* global mw, $ */

(function () {
    if (mw.config.get('wgPageName') !== 'Wikipedia:Articles_for_creation/Redirects_and_categories') return;

    const redirectPageName = mw.config.get('wgPageName').replace(/_/g, ' ');
    const redirectSubmissions = [];
    let redirectSections = [];
    const summaryAdvert = ' ([[User:Eejit43/scripts/AFCRHS|AFCRHS 2]])';
    let numTotal = 0;
    let ajaxNumber = 0;
    const submissions = [];
    const needsUpdate = [];
    const redirectDeclineReasons = {
        exists: 'The title you suggested already exists on Wikipedia',
        blank: 'We cannot accept empty submissions',
        'no-target': ' A redirect cannot be created unless the target is an existing article. Either you have not specified the target, or the target does not exist',
        unlikely: 'The title you suggested seems unlikely. Could you provide a source showing that it is a commonly used alternate name?',
        'not-redirect': 'This request is not a redirect request',
        custom: ''
    };
    const categoryDeclineReasons = {
        exists: 'The category you suggested already exists on Wikipedia',
        blank: 'We cannot accept empty submissions',
        unlikely: 'It seems unlikely that there are enough pages to support this category',
        'not-category': 'This request is not a category request',
        custom: ''
    };

    function redirectInit() {
        let pageText = getPageText(redirectPageName);
        // Cleanup the wikipedia links for preventing stuff like https://en.wikipedia.org/w/index.php?diff=576244067&oldid=576221437
        pageText = cleanupLinks(pageText);

        // First, strip out the parts before the first section
        const sectionRegex = /==.*?==/;
        pageText = pageText.substring(pageText.search(sectionRegex));
        // Then split it into the rest of the sections
        redirectSections = pageText.match(/^==.*?==$((\r?\n?)(?!==[^=]).*)*/gim);

        // Parse the sections
        for (let i = 0; i < redirectSections.length; i++) {
            const closed = /(\{\{\s*afc(?!\s+comment)|This is an archived discussion)/i.test(redirectSections[i]);
            if (!closed) {
                const header = redirectSections[i].match(sectionRegex)[0];
                if (header.search(/Redirect request/i) !== -1) {
                    const wikilinkRegex = /\[\[(\s*[^=]*?)*?\]\]/g;
                    const links = header.match(wikilinkRegex);
                    if (!links) continue;
                    for (let l = 0; l < links.length; l++) {
                        links[l] = links[l].replace(/[[\]]/g, '');
                        if (links[l].charAt(0) === ':') links[l] = links[l].substring(1);
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
                        type: 'redirect',
                        from: [],
                        section: i,
                        to,
                        title: to,
                        reason,
                        source
                    };
                    for (let j = 0; j < links.length; j++) {
                        const sub = {
                            type: 'redirect',
                            to,
                            id: numTotal,
                            title: links[j],
                            action: ''
                        };
                        submission.from.push(sub);
                        submissions.push(sub);
                        numTotal++;
                    }
                    redirectSubmissions.push(submission);
                } else if (header.search(/Category request/i) !== -1) {
                    // Find a wikilink in the header, and assume it's the category to create
                    let categoryName = /\[\[[^[\]]+\]\]/.exec(header);
                    if (!categoryName) continue;
                    categoryName = categoryName[0];
                    categoryName = categoryName.replace(/[[\]]/g, '');
                    categoryName = categoryName.replace(/Category\s*:\s*/gi, 'Category:');
                    if (categoryName.charAt(0) === ':') categoryName = categoryName.substring(1);

                    // Figure out the parent categories
                    let requestText = redirectSections[i].substring(header.length);

                    // We only want categories listed under the "Parent category/categories" heading,
                    // *NOT* any categories listed under "Example pages which belong to this category".
                    const parentHeadingIndex = requestText.indexOf('Parent category/categories');
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
                        type: 'category',
                        title: categoryName,
                        section: i,
                        id: numTotal,
                        action: '',
                        parents: parentCategories.join(',')
                    };
                    numTotal++;
                    redirectSubmissions.push(submission);
                    submissions.push(submission);
                }
            } // End if !closed
        } // End loop over sections

        // Build the form
        const $form = $('<h3>Reviewing AfC redirect requests</h3>');
        displayMessage($form);
        const $messageDiv = $form.parent();
        // Layout the text
        let redirectEmpty = 1;
        const ACTIONS = [
            { label: 'Accept', value: 'accept' },
            { label: 'Decline', value: 'decline' },
            { label: 'Comment', value: 'comment' },
            { label: 'None', selected: true, value: 'none' }
        ];
        for (let k = 0; k < redirectSubmissions.length; k++) {
            let submissionName;
            if (redirectSubmissions[k].to !== undefined) submissionName = redirectSubmissions[k].to.replace(/\s/g, '');
            else submissionName = '';
            const $thisSubList = $('<ul>');
            const $thisSubListElement = $('<li>');
            if (redirectSubmissions[k].type === 'redirect') {
                $thisSubListElement.append('Redirect(s) to ');
                if (!submissionName) {
                    for (let i = redirectSubmissions[k].from.length - 1; i >= 0; i--) {
                        needsUpdate.push({
                            id: redirectSubmissions[k].from[i].id,
                            reason: 'no-target'
                        });
                    }
                } else if (!redirectSubmissions[k].to) {
                    for (let i = redirectSubmissions[k].from.length - 1; i >= 0; i--) {
                        needsUpdate.push({
                            id: redirectSubmissions[k].from[i].id,
                            reason: 'not-redirect'
                        });
                    }
                }
                if (redirectSubmissions[k] === '' || redirectSubmissions[k] === ' ') {
                    $thisSubListElement.append('Empty submission #' + redirectEmpty);
                    redirectEmpty++;
                } else if (submissionName.length > 0) {
                    $thisSubListElement.append(
                        $('<a>')
                            .attr('href', mw.config.get('wgArticlePath').replace('$1', encodeURIComponent(redirectSubmissions[k].to)))
                            .attr('target', '_blank')
                            .text(redirectSubmissions[k].to)
                    );
                } else {
                    $thisSubListElement.append('<b>no target given</b>: ');
                }
                const $fromList = $('<ul>').appendTo($thisSubListElement);
                for (let l = 0; l < redirectSubmissions[k].from.length; l++) {
                    const from = redirectSubmissions[k].from[l];
                    let toArticle = from.title;
                    if (toArticle.replace(/\s*/gi, '').length === 0) toArticle = '<b>no title specified</b>, check the request details';

                    const reasonAndSource = $('<ul>');
                    if (redirectSubmissions[k].reason) reasonAndSource.append('<li>Reason: ' + redirectSubmissions[k].reason + '</li>');
                    if (redirectSubmissions[k].source) reasonAndSource.append('<li>Source: ' + redirectSubmissions[k].source + '</li>');

                    const googleSearchUrl = 'http://www.google.com/search?q="' + encodeURIComponent(toArticle) + '"+-wikipedia.org';
                    $fromList.append(
                        $('<li>')
                            .append('From: ' + toArticle + " (<small><a href='" + googleSearchUrl + '\'" target="_blank">Google</a> <b>&middot;</b> <a href="https://en.wikipedia.org/wiki/Special:WhatLinksHere/' + encodeURIComponent(toArticle) + '" target="_blank">what links here</a>)</small><br/>')
                            .append(reasonAndSource)
                            .append(
                                $('<label>')
                                    .attr('for', 'afcHelper_redirect_action_' + from.id)
                                    .text('Action: ')
                            )
                            .append(generateSelectObject('afcHelper_redirect_action_' + from.id, ACTIONS, redirectMakeActionChange(from.id)))
                            .append($('<div>').attr('id', 'afcHelper_redirect_extra_' + from.id))
                    );
                }
            } else {
                const subId = redirectSubmissions[k].id;
                $thisSubListElement
                    .append('Category submission: ')
                    .append(
                        $('<a>')
                            .attr('href', '/wiki/' + redirectSubmissions[k].title)
                            .attr('title', redirectSubmissions[k].title)
                            .text(redirectSubmissions[k].title)
                    )
                    .append('<br />')
                    .append(
                        $('<label>')
                            .attr('for', 'afcHelper_redirect_action_' + subId)
                            .text('Action: ')
                    )
                    .append(generateSelectObject('afcHelper_redirect_action_' + subId, ACTIONS, redirectMakeActionChange(subId)))
                    .append($('<div>').attr('id', 'afcHelper_redirect_extra_' + subId));
            }
            $thisSubList.append($thisSubListElement);
            $messageDiv.append($thisSubList);
        } // End loop over sections
        $messageDiv.append($('<button>').attr('id', 'afcHelper_redirect_done_button').attr('name', 'afcHelper_redirect_done_button').text('Done').click(redirectPerformActions));
        for (let y = 0; y < needsUpdate.length; y++) {
            $('#afcHelper_redirect_action_' + needsUpdate[y].id).attr('value', 'decline');
            redirectOnActionChange(needsUpdate[y].id);
            $('#afcHelper_redirect_decline_' + needsUpdate[y].id).attr('value', needsUpdate[y].reason);
        }
    }

    function redirectMakeActionChange(id) {
        return function () {
            redirectOnActionChange(id);
        };
    }

    function redirectOnActionChange(id) {
        const $extra = $('#afcHelper_redirect_extra_' + id);
        const selectValue = $('#afcHelper_redirect_action_' + id).val();
        $extra.html(''); // Blank it first
        if (selectValue === 'accept') {
            if (submissions[id].type === 'redirect') {
                $extra.append('<label for="afcHelper_redirect_from_' + id + '">From: </label>');
                $extra.append(
                    $('<input>')
                        .attr('type', 'text')
                        .attr('name', 'afcHelper_redirect_from_' + id)
                        .attr('id', 'afcHelper_redirect_from_' + id)
                        .attr('value', submissions[id].title)
                );

                $extra.html($extra.html() + '&nbsp;<br /><label for="afcHelper_redirect_to_' + id + '">To: </label><input type="text" name="afcHelper_redirect_to_' + id + '" id="afcHelper_redirect_to_' + id + '" value="' + submissions[id].to + '" />');
                $extra.html($extra.html() + '<br /><label for="afcHelper_redirect_append_' + id + '">Template to append: (<a href="https://en.wikipedia.org/wiki/Wikipedia:TMR" target="_blank">Help</a>)</label>');
                $extra.html(
                    $extra.html() +
                        generateSelect('afcHelper_redirect_append_' + id, [
                            { label: 'None', selected: true, value: 'none' },
                            { labelAndValue: 'Frequently used', disabled: true },
                            { labelAndValue: 'R from alternative language' },
                            { labelAndValue: 'R from alternative name' },
                            { labelAndValue: 'R from modification' },
                            { labelAndValue: 'R to section' },
                            { labelAndValue: 'R from diacritic' },
                            { labelAndValue: 'R to diacritic' },
                            { labelAndValue: 'From – abbreviation, capitalisation, and grammar', disabled: true },
                            { labelAndValue: 'R from acronym' },
                            { labelAndValue: 'R from initialism' },
                            { labelAndValue: 'R from CamelCase' },
                            { labelAndValue: 'R from miscapitalisation' },
                            { labelAndValue: 'R from other capitalisation' },
                            { labelAndValue: 'R from modification' },
                            { labelAndValue: 'R from plural' },
                            { label: 'From parts of speach', value: 'From parts of speach', disabled: true },
                            { labelAndValue: 'R from adjective' },
                            { labelAndValue: 'R from adverb' },
                            { labelAndValue: 'R from common noun' },
                            { labelAndValue: 'R from gerund' },
                            { labelAndValue: 'R from proper noun' },
                            { labelAndValue: 'R from verb' },
                            { labelAndValue: 'From – spelling', disabled: true },
                            { labelAndValue: 'R from alternative spelling' },
                            { labelAndValue: 'R from misspelling' },
                            { labelAndValue: 'R from American English' },
                            { labelAndValue: 'R from British English' },
                            { labelAndValue: 'R from ASCII-only' },
                            { labelAndValue: 'R from diacritic' },
                            { labelAndValue: 'R from ligature' },
                            { labelAndValue: 'R from stylization' },
                            { labelAndValue: 'R from alternative transliteration' },
                            { labelAndValue: 'R from Wade–Giles romanization' },
                            { labelAndValue: 'From alternative names, general', disabled: true },
                            { labelAndValue: 'R from alternative language' },
                            { labelAndValue: 'R from alternative name' },
                            { labelAndValue: 'R from former name' },
                            { labelAndValue: 'R from historic name' },
                            { labelAndValue: 'R from incomplete name' },
                            { labelAndValue: 'R from incorrect name' },
                            { labelAndValue: 'R from letter–word combination' },
                            { labelAndValue: 'R from long name' },
                            { labelAndValue: 'R from portmanteau' },
                            { labelAndValue: 'R from predecessor company name' },
                            { labelAndValue: 'R from short name' },
                            { labelAndValue: 'R from sort name' },
                            { labelAndValue: 'R from less specific name' },
                            { labelAndValue: 'R from more specific name' },
                            { labelAndValue: 'R from antonym' },
                            { labelAndValue: 'R from eponym' },
                            { labelAndValue: 'R from synonym' },
                            { labelAndValue: 'R from Roman numerals' },
                            { labelAndValue: 'From alternative names, geography', disabled: true },
                            { labelAndValue: 'R from Canadian settlement name' },
                            { labelAndValue: 'R from name and country' },
                            { labelAndValue: 'R from city and state' },
                            { labelAndValue: 'R from city and province' },
                            { labelAndValue: 'R from more specific geographic name' },
                            { labelAndValue: 'R from postal abbreviation' },
                            { labelAndValue: 'R from postal code' },
                            { labelAndValue: 'R from US postal abbreviation' },
                            { labelAndValue: 'From alternative names, organisms', disabled: true },
                            { labelAndValue: 'R from scientific abbreviation' },
                            { labelAndValue: 'R from scientific name' },
                            { labelAndValue: 'R from alternative scientific name' },
                            { labelAndValue: 'R from monotypic taxon' },
                            { labelAndValue: 'From alternative names, people', disabled: true },
                            { labelAndValue: 'R from birth name' },
                            { labelAndValue: 'R from given name' },
                            { labelAndValue: 'R from married name' },
                            { labelAndValue: 'R from name with title' },
                            { labelAndValue: 'R from non-neutral name' },
                            { labelAndValue: 'R from personal name' },
                            { labelAndValue: 'R from pseudonym' },
                            { labelAndValue: 'R from relative' },
                            { labelAndValue: 'R from spouse' },
                            { labelAndValue: 'R from surname' },
                            { labelAndValue: 'From alternative names, technical', disabled: true },
                            { labelAndValue: 'R from Bluebook abbreviation' },
                            { labelAndValue: 'R from brand name' },
                            { labelAndValue: 'R from drug trade name' },
                            { labelAndValue: 'R from file name' },
                            { labelAndValue: 'R from Java package name' },
                            { labelAndValue: 'R from MathSciNet abbreviation' },
                            { labelAndValue: 'R from molecular formula' },
                            { labelAndValue: 'R from NLM abbreviation' },
                            { labelAndValue: 'R from product name' },
                            { labelAndValue: 'R from slogan' },
                            { labelAndValue: 'R from symbol' },
                            { labelAndValue: 'R from systematic abbreviations' },
                            { labelAndValue: 'R from technical name' },
                            { labelAndValue: 'R from trademark' },
                            { labelAndValue: 'From – navigation', disabled: true },
                            { labelAndValue: 'R from file metadata link' },
                            { labelAndValue: 'R mentioned in hatnote' },
                            { labelAndValue: 'R from shortcut' },
                            { labelAndValue: 'R from template shortcut' },
                            { labelAndValue: 'From disambiguations', disabled: true },
                            { labelAndValue: 'R from ambiguous term' },
                            { labelAndValue: 'R from incomplete disambiguation' },
                            { labelAndValue: 'R from incorrect disambiguation' },
                            { labelAndValue: 'R from other disambiguation' },
                            { labelAndValue: 'R from predictable disambiguation' },
                            { labelAndValue: 'R from unnecessary disambiguation' },
                            { labelAndValue: 'From mergers, duplicates, and moves', disabled: true },
                            { labelAndValue: 'R from duplicated article' },
                            { labelAndValue: 'R with history' },
                            { labelAndValue: 'R from merge' },
                            { labelAndValue: 'R from move' },
                            { labelAndValue: 'R with old history' },
                            { labelAndValue: 'From fiction', disabled: true },
                            { labelAndValue: 'R from fictional character' },
                            { labelAndValue: 'R from fictional element' },
                            { labelAndValue: 'R from fictional location' },
                            { labelAndValue: 'From related info', disabled: true },
                            { labelAndValue: 'R from album' },
                            { labelAndValue: 'R from animal' },
                            { labelAndValue: 'R from book' },
                            { labelAndValue: 'R from catchphrase' },
                            { labelAndValue: 'R from domain name' },
                            { labelAndValue: 'R from top-level domain' },
                            { labelAndValue: 'R from film' },
                            { labelAndValue: 'R from gender' },
                            { labelAndValue: 'R from legislation' },
                            { labelAndValue: 'R from list topic' },
                            { labelAndValue: 'R from member' },
                            { labelAndValue: 'R from person' },
                            { labelAndValue: 'R from phrase' },
                            { labelAndValue: 'R from quotation' },
                            { labelAndValue: 'R from related word' },
                            { labelAndValue: 'R from school' },
                            { labelAndValue: 'R from song' },
                            { labelAndValue: 'R from subtopic' },
                            { labelAndValue: 'R from team' },
                            { labelAndValue: 'R from work' },
                            { labelAndValue: 'R from writer' },
                            { labelAndValue: 'R from Unicode' },
                            { labelAndValue: 'To – grammar, punctuation, and spelling', disabled: true },
                            { labelAndValue: 'R to acronym' },
                            { labelAndValue: 'R to initialism' },
                            { labelAndValue: 'R to ASCII-only title' },
                            { labelAndValue: 'R to diacritic' },
                            { labelAndValue: 'R to ligature' },
                            { labelAndValue: 'R to plural' },
                            { labelAndValue: 'To alternative names', disabled: true },
                            { labelAndValue: 'R to former name' },
                            { labelAndValue: 'R to historic name' },
                            { labelAndValue: 'R to joint biography' },
                            { labelAndValue: 'R to name with title' },
                            { labelAndValue: 'R to monotypic taxon' },
                            { labelAndValue: 'R to scientific name' },
                            { labelAndValue: 'R to systematic name' },
                            { labelAndValue: 'R to technical name' },
                            { labelAndValue: 'To – navigation and disambiguation', disabled: true },
                            { labelAndValue: 'R to anchor' },
                            { labelAndValue: 'R to anthroponymy page' },
                            { labelAndValue: 'R to disambiguation page' },
                            { labelAndValue: 'R to list entry' },
                            { labelAndValue: 'R to section' },
                            { labelAndValue: 'To miscellaneous', disabled: true },
                            { labelAndValue: 'R to decade' },
                            { labelAndValue: 'R to related topic' },
                            { labelAndValue: 'R to subpage' },
                            { labelAndValue: 'R to subtopic' },
                            { labelAndValue: 'R to TV episode list entry' },
                            { label: 'Custom - prompt me', value: 'custom' }
                        ])
                );
            } else {
                // Now categories
                $extra.html('<label for="afcHelper_redirect_name_' + id + '">Category name: </label><input type="text" size="100" name="afcHelper_redirect_name_' + id + '" id="afcHelper_redirect_name_' + id + '" value="' + submissions[id].title + '" />');
                $extra.html($extra.html() + '<br /><label for="afcHelper_redirect_parents_' + id + '">Parent categories (comma-separated):</label><input type="text" size="100" id="afcHelper_redirect_parents_' + id + '" name="afcHelper_redirect_parents_' + id + '" value="' + submissions[id].parents + '" />');
                $extra.append('<br />');
                $extra.append($('<input>', { type: 'checkbox', name: 'afcHelper_redirect_container_' + id, id: 'afcHelper_redirect_container_' + id }));
                $extra.append('<label for="afcHelper_redirect_container_' + id + '">This is a <a href="/wiki/Wikipedia:Container_category" title="Wikipedia:Container category">container category</a></label>');
                $extra.html($extra.html() + '<br /><input type="checkbox" name="afcHelper_redirect_container_' + id + '"');
            }
            $extra.html($extra.html() + '<br /><label for="afcHelper_redirect_comment_' + id + '">Comment:</label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>');
        } else if (selectValue === 'decline') {
            if (submissions[id].type === 'redirect') {
                $extra.html(
                    '<label for="afcHelper_redirect_decline_' +
                        id +
                        '">Reason for decline: </label>' +
                        generateSelect('afcHelper_redirect_decline_' + id, [
                            {
                                label: 'Already exists',
                                value: 'exists'
                            },
                            {
                                label: 'Blank request',
                                value: 'blank'
                            },
                            {
                                label: 'No valid target specified',
                                value: 'no-target'
                            },
                            {
                                label: 'Unlikely search term',
                                value: 'unlikely'
                            },
                            {
                                label: 'Not a redirect request',
                                value: 'not-redirect'
                            },
                            {
                                label: 'Custom - reason below',
                                selected: true,
                                value: 'custom'
                            }
                        ])
                );
            } else {
                // Now categories
                $extra.html(
                    '<label for="afcHelper_redirect_decline_' +
                        id +
                        '">Reason for decline: </label>' +
                        generateSelect('afcHelper_redirect_decline_' + id, [
                            {
                                label: 'Already exists',
                                value: 'exists'
                            },
                            {
                                label: 'Blank request',
                                value: 'blank'
                            },
                            {
                                label: 'Unlikely category',
                                value: 'unlikely'
                            },
                            {
                                label: 'Not a category request',
                                value: 'not-category'
                            },
                            {
                                label: 'Custom - reason below',
                                selected: true,
                                value: 'custom'
                            }
                        ])
                );
            }
            $extra.html($extra.html() + '<br/><label for="afcHelper_redirect_comment_' + id + '">Comment: </label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>');
        } else if (selectValue === 'none') {
            // For categories and redirects
            $extra.html('');
        } else {
            $extra.html($extra.html() + '<label for="afcHelper_redirect_comment_' + id + '">Comment: </label><input type="text" size="100" id="afcHelper_redirect_comment_' + id + '" name="afcHelper_redirect_comment_' + id + '"/>');
        }
    }

    function redirectPerformActions() {
        // Load all of the data
        for (let i = 0; i < submissions.length; i++) {
            const action = $('#afcHelper_redirect_action_' + i).val();
            submissions[i].action = action;
            if (action === 'none') continue;
            if (action === 'accept') {
                if (submissions[i].type === 'redirect') {
                    submissions[i].title = $('#afcHelper_redirect_from_' + i).val();
                    submissions[i].to = $('#afcHelper_redirect_to_' + i).val();
                    submissions[i].append = $('#afcHelper_redirect_append_' + i).val();
                    if (submissions[i].append === 'custom') {
                        submissions[i].append = prompt('Please enter the template to append to ' + submissions[i].title + '. Do not include the curly brackets.');
                    }
                    if (submissions[i].append === 'none' || submissions[i].append === null) submissions[i].append = '';
                    else submissions[i].append = '{{' + submissions[i].append + '}}';
                } else {
                    submissions[i].title = $('#afcHelper_redirect_name_' + i).val();
                    submissions[i].parents = $('#afcHelper_redirect_parents_' + i).val();
                    submissions[i].container = $('#afcHelper_redirect_container_' + i).is(':checked');
                }
            } else if (action === 'decline') {
                submissions[i].reason = $('#afcHelper_redirect_decline_' + i).val();
            }
            submissions[i].comment = $('#afcHelper_redirect_comment_' + i).val();
        }
        // Data loaded. Show progress screen and get WP:AFC/RC page text
        displayMessage('<ul id="afcHelper_status"></ul><ul id="afcHelper_finish"></ul>');
        const addStatus = function (status) {
            $('#afcHelper_status').append(status);
        };
        $('#afcHelper_finish').html($('#afcHelper_finish').html() + '<span id="afcHelper_finished_wrapper"><span id="afcHelper_finished_main" style="display:none"><li id="afcHelper_done"><b>Done (<a href="' + mw.config.get('wgArticlePath').replace('$1', encodeURI(redirectPageName)) + '?action=purge" title="' + redirectPageName + '">Reload page</a>)</b></li></span></span>');
        let pageText = getPageText(redirectPageName, addStatus);
        let totalAccept = 0;
        let totalDecline = 0;
        let totalComment = 0;
        // Traverse the submissions and locate the relevant sections
        addStatus('<li>Processing ' + redirectSubmissions.length + ' submission' + (redirectSubmissions.length === 1 ? '' : 's') + '...</li>');
        for (let i = 0; i < redirectSubmissions.length; i++) {
            const sub = redirectSubmissions[i];
            if (pageText.indexOf(redirectSections[sub.section]) === -1) {
                // Someone has modified the section in the mean time, skip
                addStatus('<li>Skipping ' + sub.title + ': Cannot find section. Perhaps it was modified in the mean time?</li>');
                continue;
            }
            let text = redirectSections[sub.section];
            const startIndex = pageText.indexOf(redirectSections[sub.section]);
            const endIndex = startIndex + text.length;

            // First deal with categories
            if (sub.type === 'category') {
                if (sub.action === 'accept') {
                    let categoryText = '<!--Created by WP:AFC -->';
                    if (sub.container) {
                        categoryText += '\n{{Container category}}';
                    }
                    if (sub.parents !== '') {
                        categoryText = sub.parents
                            .split(',')
                            .map((cat) => {
                                return '[[' + cat + ']]';
                            })
                            .join('\n');
                    }
                    editPage(sub.title, categoryText, 'Created via [[WP:AFC|Articles for Creation]]', true);
                    const talkText = '{{subst:WPAFC/article|class=Cat}}';
                    const talkTitle = new mw.Title(sub.title).getTalkPage().toText();
                    editPage(talkTitle, talkText, 'Placing WPAFC project banner', true);
                    const header = text.match(/==[^=]*==/)[0];
                    text = header + '\n{{AfC-c|a}}\n' + text.substring(header.length);
                    if (sub.comment !== '') text += '\n*{{subst:afc category|accept|2=' + sub.comment + '}} ~~~~\n';
                    else text += '\n*{{subst:afc category}} ~~~~\n';
                    text += '{{AfC-c|b}}\n';
                    totalAccept++;
                } else if (sub.action === 'decline') {
                    const header = text.match(/==[^=]*==/)[0];
                    let reason = categoryDeclineReasons[sub.reason];
                    if (reason === '') reason = sub.comment;
                    else if (sub.comment !== '') reason = reason + ': ' + sub.comment;
                    if (reason === '') {
                        $('afcHelper_status').html($('#afcHelper_status').html() + '<li>Skipping ' + sub.title + ': No decline reason specified.</li>');
                        continue;
                    }
                    text = header + '\n{{AfC-c|d}}\n' + text.substring(header.length);
                    if (sub.comment === '') text += '\n*{{subst:afc category|' + sub.reason + '}} ~~~~\n';
                    else text += '\n*{{subst:afc category|decline|2=' + reason + '}} ~~~~\n';
                    text += '{{AfC-c|b}}\n';
                    totalDecline++;
                } else if (sub.action === 'comment') {
                    if (sub.comment !== '') text += '\n\n{{afc comment|1=' + sub.comment + ' ~~~~}}\n';
                    totalComment++;
                }
            } else {
                // Handle redirects
                let acceptComment = '';
                let declineComment = '';
                let otherComment = '';
                let acceptCount = 0,
                    declineCount = 0,
                    commentCount = 0,
                    hasComment = false;
                for (let j = 0; j < sub.from.length; j++) {
                    const redirect = sub.from[j];
                    if (redirect.action === 'accept') {
                        const redirectText = `#REDIRECT [[${redirect.to}]]${redirect.append ? `\n\n{{Redirect category shell|\n${redirect.append}\n}}` : ''}`;
                        editPage(redirect.title, redirectText, 'Redirected page to [[' + redirect.to + ']] via [[WP:AFC|Articles for Creation]]', true);

                        const mwTitle = new mw.Title(redirect.title);
                        if (!mwTitle.isTalkPage()) {
                            const mwTalkTitle = mwTitle.getTalkPage().toText();
                            const talkText = '{{subst:WPAFC/redirect}}';

                            editPage(mwTalkTitle, talkText, 'Placing WPAFC project banner', true);
                        }
                        acceptComment += redirect.title + ' &rarr; ' + redirect.to;
                        if (redirect.comment !== '') {
                            acceptComment += ': ' + redirect.comment;
                            hasComment = true;
                        } else {
                            acceptComment += '. ';
                        }
                        acceptCount++;
                    } else if (redirect.action === 'decline') {
                        let reason = redirectDeclineReasons[redirect.reason];
                        if (reason === '') reason = redirect.comment;
                        else if (redirect.comment !== '') reason = reason + ': ' + redirect.comment;
                        if (reason === '') {
                            $('#afcHelper_status').html($('#afcHelper_status').html() + '<li>Skipping ' + redirect.title + ': No decline reason specified.</li>');
                            continue;
                        }
                        declineComment += redirect.reason === 'blank' || redirect.reason === 'not-redirect' ? reason + '. ' : redirect.title + ' &rarr; ' + redirect.to + ': ' + reason + '. ';
                        declineCount++;
                    } else if (redirect.action === 'comment') {
                        otherComment += redirect.title + ': ' + redirect.comment + '. ';
                        commentCount++;
                    }
                }
                let reason = '';

                if (acceptCount > 0) reason += '\n*{{subst:afc redirect|accept|2=' + acceptComment + ' Thank you for your contributions to Wikipedia!}} ~~~~';
                if (declineCount > 0) reason += '\n*{{subst:afc redirect|decline|2=' + declineComment + '}} ~~~~';
                if (commentCount > 0) reason += '\n*{{afc comment|1=' + otherComment + '~~~~}}';
                reason += '\n';
                if (!hasComment && acceptCount === sub.from.length) {
                    if (acceptCount > 1) reason = '\n*{{subst:afc redirect|all}} ~~~~\n';
                    else reason = '\n*{{subst:afc redirect}} ~~~~\n';
                }
                if (acceptCount + declineCount + commentCount > 0) {
                    if (acceptCount + declineCount === sub.from.length) {
                        // Every request handled, close
                        const header = text.match(/==[^=]*==/)[0];
                        if (acceptCount > 0 && declineCount > 0) text = header + '\n{{AfC-c|p}}' + text.substring(header.length);
                        else if (acceptCount > 0) text = header + '\n{{AfC-c|a}}' + text.substring(header.length);
                        else text = header + '\n{{AfC-c|d}}' + text.substring(header.length);
                        text += reason;
                        text += '{{AfC-c|b}}\n';
                    } else text += reason + '\n';
                }
                totalAccept += acceptCount;
                totalDecline += declineCount;
                totalComment += commentCount;
            }
            pageText = pageText.substring(0, startIndex) + text + pageText.substring(endIndex);
        }

        let summary = 'Updating submission status:';
        if (totalAccept > 0) summary += ' accepting ' + totalAccept + ' request' + (totalAccept > 1 ? 's' : '');
        if (totalDecline > 0) {
            if (totalAccept > 0) summary += ',';
            summary += ' declining ' + totalDecline + ' request' + (totalDecline > 1 ? 's' : '');
        }
        if (totalComment > 0) {
            if (totalAccept > 0 || totalDecline > 0) summary += ',';
            summary += ' commenting on ' + totalComment + ' request' + (totalComment > 1 ? 's' : '');
        }

        editPage(redirectPageName, pageText, summary, false);

        // Display the "Done" text only after all ajax requests are completed
        $(document).ajaxStop(() => {
            $('#afcHelper_finished_main').css('display', '');
        });
    }

    /**
     * Gets the text of a page.
     * @param {string} title The title of the page to get.
     * @param {Function} addStatus A function that takes a HTML string to report status.
     */
    function getPageText(title, addStatus) {
        addStatus = typeof addStatus !== 'undefined' ? addStatus : function () {}; // eslint-disable-line no-empty-function
        addStatus('<li id="afcHelper_get' + jqEscape(title) + '">Getting <a href="' + mw.config.get('wgArticlePath').replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a></li>');

        const request = {
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            indexpageids: true,
            titles: title
        };

        const response = JSON.parse(
            $.ajax({
                url: mw.util.wikiScript('api'),
                data: request,
                async: false
            }).responseText
        );

        const pageId = response.query.pageids[0];
        if (pageId === '-1') {
            addStatus('The page <a class="new" href="' + mw.config.get('wgArticlePath').replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a> does not exist');
            return '';
        }
        const newText = response.query.pages[pageId].revisions[0]['*'];
        addStatus('<li id="afcHelper_get' + jqEscape(title) + '">Got <a href="' + mw.config.get('wgArticlePath').replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a></li>');
        return newText;
    }

    function cleanupLinks(text) {
        // Convert external links to Wikipedia articles to proper wikilinks
        const wikilinkRegex = /(\[){1,2}(?:https?:)?\/\/(en.wikipedia.org\/wiki|enwp.org)\/([^\s|\][]+)(\s|\|)?((?:\[\[[^[\]]*\]\]|[^\][])*)(\]){1,2}/gi;
        const tempText = text;
        let match;
        while ((match = wikilinkRegex.exec(tempText))) {
            const pageName = decodeURI(match[3].replace(/_/g, ' '));
            let displayname = decodeURI(match[5].replace(/_/g, ' '));
            if (pageName === displayname) displayname = '';
            const replaceText = '[[' + pageName + (displayname ? '|' + displayname : '') + ']]';
            text = text.replace(match[0], replaceText);
        }
        return text;
    }

    function generateSelect(title, options) {
        return generateSelectObject(title, options).prop('outerHTML');
    }

    function generateSelectObject(title, options, onchange) {
        const $select = $('<select>').attr('name', title).attr('id', title);
        if (onchange !== null) {
            $select.change(onchange);
        }
        options.forEach((option) => {
            if (option.labelAndValue) {
                option.value = option.labelAndValue;
                option.label = option.labelAndValue;
            }
            const $option = $('<option>').appendTo($select).val(option.value).text(option.label);
            if (option.selected) $option.attr('selected', 'selected');
            if (option.disabled) $option.attr('disabled', 'disabled');
        });
        return $select;
    }

    /**
     * The old mw.util.jsMessage function before https://gerrit.wikimedia.org/r/#/c/17605/, which
     * introduced the silly auto-hide function. Also with the original styles.
     * Add a little box at the top of the screen to inform the user of
     * something, replacing any previous message.
     * Calling with no arguments, with an empty string or null will hide the message
     * Taken from [[User:Timotheus Canens/displaymessage.js]]
     * @param {*} message The DOM-element, jQuery object or HTML-string to be put inside the message box.
     * @param {string} className Used in adding a class; should be different for each call
     * to allow CSS/JS to hide different boxes. null = no class used.
     * @returns {boolean} True on success, false on failure.
     */
    function displayMessage(message, className) {
        if (!arguments.length || message === '' || message === null) {
            $('#display-message').empty().hide();
            return true; // Emptying and hiding message is intended behaviour, return true
        } else {
            // We special-case skin structures provided by the software. Skins that
            // choose to abandon or significantly modify our formatting can just define
            // an mw-js-message div to start with.
            let $messageDiv = $('#display-message');
            if (!$messageDiv.length) {
                $messageDiv = $('<div id="display-message" style="margin:1em;padding:0.5em 2.5%;border:solid 1px #ddd;background-color:#fcfcfc;font-size: 0.8em"></div>');
                if (mw.util.$content.length) {
                    mw.util.$content.prepend($messageDiv);
                } else {
                    return false;
                }
            }
            if (className) $messageDiv.prop('class', 'display-message-' + className);
            if (typeof message === 'object') {
                $messageDiv.empty();
                $messageDiv.append(message);
            } else $messageDiv.html(message);
            $messageDiv[0].scrollIntoView();
            return true;
        }
    }

    function jqEscape(expression) {
        return expression.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~ ]/g, '');
    }

    function editPage(title, newText, summary, createOnly, noPatrol) {
        const wgArticlePath = mw.config.get('wgArticlePath');
        summary += summaryAdvert;
        $('#afcHelper_finished_wrapper').html('<span id="afcHelper_AJAX_finished_' + ajaxNumber + '" style="display:none">' + $('#afcHelper_finished_wrapper').html() + '</span>');
        const functionId = ajaxNumber;
        ajaxNumber++;
        $('#afcHelper_status').html($('#afcHelper_status').html() + '<li id="afcHelper_edit' + jqEscape(title) + '">Editing <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a></li>');
        const request = {
            action: 'edit',
            title,
            text: newText,
            summary
        };
        if (createOnly) request.createonly = true;

        const api = new mw.Api();
        api.postWithEditToken(request)
            .done((data) => {
                if (data && data.edit && data.edit.result && data.edit.result === 'Success') {
                    $('#afcHelper_edit' + jqEscape(title)).html('Saved <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a>');
                } else {
                    $('#afcHelper_edit' + jqEscape(title)).html('<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a></b></span>. Error info: ' + JSON.stringify(data));
                    console.error('Edit failed on %s (%s). Error info: %s', wgArticlePath.replace('$1', encodeURI(title)), title, JSON.stringify(data)); // eslint-disable-line no-console
                }
            })
            .fail((error) => {
                if (createOnly && error === 'articleexists') $('#afcHelper_edit' + jqEscape(title)).html('<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a></b></span>. Error info: The article already exists!');
                else $('#afcHelper_edit' + jqEscape(title)).html('<span class="afcHelper_notice"><b>Edit failed on <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a></b></span>. Error info: ' + error);
            })
            .always(() => {
                $('#afcHelper_AJAX_finished_' + functionId).css('display', '');
            });

        if (!noPatrol) {
            /* We patrol by default */
            if ($('.patrollink').length) {
                // Extract the rcid token from the "Mark page as patrolled" link on page
                const patrolHref = $('.patrollink a').attr('href');
                const rcId = mw.util.getParamValue('rcid', patrolHref);

                if (rcId) {
                    $('#afcHelper_status').html($('#afcHelper_status').html() + '<li id="afcHelper_patrol' + jqEscape(title) + '">Marking <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + ' as patrolled</a></li>');
                    const patrolRequest = {
                        action: 'patrol',
                        rcid: rcId
                    };
                    api.postWithToken('patrol', patrolRequest)
                        .done((data) => {
                            if (data) {
                                $('#afcHelper_patrol' + jqEscape(title)).html('Marked <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a> as patrolled');
                            } else {
                                $('#afcHelper_patrol' + jqEscape(title)).html('<span class="afcHelper_notice"><b>Patrolling failed on <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a></b></span> with an unknown error');
                                console.error('Patrolling failed on %s (%s) with an unknown error.', wgArticlePath.replace('$1', encodeURI(title)), title); // eslint-disable-line no-console
                            }
                        })
                        .fail((error) => {
                            $('#afcHelper_patrol' + jqEscape(title)).html('<span class="afcHelper_notice"><b>Patrolling failed on <a href="' + wgArticlePath.replace('$1', encodeURI(title)) + '" title="' + title + '">' + title + '</a></b></span>. Error info: ' + error);
                        });
                }
            }
        }
    }

    mw.loader.using(['mediawiki.api', 'mediawiki.util'], () => {
        const redirectPortletLink = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-tb' : 'p-cactions', '#', 'Review AFC/RC', 'ca-afcrhs', 'Review', 'a');
        $(redirectPortletLink).click((event) => {
            event.preventDefault();
            // Clear variables for the case somebody is clicking on "review" multiple times
            redirectSubmissions.length = 0;
            redirectSections.length = 0;
            numTotal = 0;
            submissions.length = 0;
            needsUpdate.length = 0;
            redirectInit();
        });
    });
})();
