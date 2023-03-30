/* global $, jQuery, mw, importStylesheet */

// Helper function definitions
function encodeCodePoint(c) {
    if (c === 0x20) return '_';
    if (c < 0x80) {
        return '.' + c.toString(16).toUpperCase();
    } else if (c < 0x800) {
        return '.' + (0xc0 | (c >>> 6)).toString(16).toUpperCase() + '.' + (0x80 | (c & 0x3f)).toString(16).toUpperCase();
    } else if (c < 0x10000) {
        return '.' + (0xe0 | (c >>> 12)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 6) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | (c & 0x3f)).toString(16).toUpperCase();
    } else if (c < 0x200000) {
        return '.' + (0xf0 | (c >>> 18)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 12) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 6) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | (c & 0x3f)).toString(16).toUpperCase();
    } else if (c < 0x4000000) {
        return '.' + (0xf8 | (c >>> 24)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 18) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 12) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 6) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | (c & 0x3f)).toString(16).toUpperCase();
    } else if (c < 0x80000000) {
        return '.' + (0xfc | (c >>> 30)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 24) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 18) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 12) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | ((c >>> 6) & 0x3f)).toString(16).toUpperCase() + '.' + (0x80 | (c & 0x3f)).toString(16).toUpperCase();
    }
}

function normaliseAnchor(anchor) {
    // "." is not escaped!
    return anchor.replace(/[^0-9A-Za-z_:.]/g, (m) => {
        if (m.length === 2) return encodeCodePoint(((m.charCodeAt(0) & 0x3ff) << 10) | (m.charCodeAt(1) & 0x3ff));
        else return encodeCodePoint(m.charCodeAt(0));
    });
}

function normaliseTitle(title) {
    try {
        const t = new mw.Title(title);
        return t.getPrefixedText();
    } catch (e) {
        return null;
    }
}

function el(tag, child, attr, events) {
    const node = document.createElement(tag);

    if (child) {
        if (typeof child === 'string' || typeof child.length !== 'number') child = [child];
        for (let i = 0; i < child.length; ++i) {
            let ch = child[i];
            if (ch === void null || ch === null) continue;
            else if (typeof ch !== 'object') ch = document.createTextNode(String(ch));
            node.appendChild(ch);
        }
    }

    if (attr)
        for (const key in attr) {
            if (attr[key] === void 0 || attr[key] === null) continue;
            node.setAttribute(key, String(attr[key]));
        }

    if (events)
        for (let key in events) {
            const handler = events[key];
            if (key === 'input' && window.oninput === void 0) {
                key = 'change';
            }
            node.addEventListener(key, handler, false);
        }

    return node;
}

function link(child, href, attr, ev) {
    attr = attr || {};
    ev = ev || {};
    if (typeof attr === 'string') {
        attr = { title: attr };
    }
    if (typeof href === 'string') attr.href = href;
    else {
        attr.href = 'javascript:void(null);';
        ev.click = href;
    }
    return el('a', child, attr, ev);
}

const templateGroups = {
    fromRelatedInfo: 'Related information, From',
    toRelatedInfo: 'Related information, To',
    fromPartOfSpeech: 'Parts of speech, From',
    fromEngVar: 'English variant spelling, From',
    fromOrthographicModification: 'Orthographic difference, From',
    toOrthographicModification: 'Orthographic difference, To',
    fromAlt: 'Alternative names, From',
    fromDisambiguation: 'Ambiguity, From',
    //"toDisambiguation": "Ambiguity, To",
    //"fromSpecificity": "Specificity, From",
    fromAnthroponym: 'Anthroponym, From',
    fromFiction: 'Fiction, From',
    fromWork: 'Works of art and works generally, From',
    toWork: 'Works of art and works generally, To',
    fromLocationOrInfrastructure: 'Geographic location or infrastructure, From',
    fromFormerName: 'Former names, From',
    toFormerName: 'Former names, To',
    fromSystematicName: 'Systematic name, From',
    toSystematicName: 'Systematic name, To',
    fromPostal: 'From postal information',
    fromOrganization: 'From organization',
    fromMath: 'From mathematical topic',
    fromComic: 'Comics, From',
    toComic: 'Comics, To',
    fromMiddleEarth: 'Middle-earth topic, From',
    toMiddleEarth: 'Middle-earth topic, To',
    fromMisc: 'From miscellaneous information',
    fromMeta: 'Meta information, From',
    toMeta: 'Meta information, To',
    fromProtected: 'Protection level, From',
    toNameSpace: 'Namespaces, To',
    fromPrintworthiness: 'Printworthiness'
};

// Callback functions
let currentTarget = null;

function mainCallback(aliasJSON, templateJSON) {
    const templateAliases = aliasJSON;
    const redirectTemplates = templateJSON;

    ('use strict');

    importStylesheet('User:Eejit43/scripts/capricorn.css');

    const wgNamespaceIds = mw.config.get('wgNamespaceIds');

    const contentText = document.getElementById('mw-content-text');
    const firstHeading = document.getElementById('firstHeading');
    const redirMsg = contentText.getElementsByClassName('redirectMsg')[0];
    const uiWrapper = el('div');

    function MarkupBlob(markup) {
        if (!markup) {
            this.target = '';
            this.rcatt = {};
            this.tail = '';
        } else this.parse(markup);
    }

    MarkupBlob.prototype.parse = function (markup) {
        const rdrx = /^#REDIRECT:?\s*\[\[\s*([^|{}[\]]+?)\s*]]\s*/i;
        const tprx = /^\s*{{([A-Za-z ]+)((?:\|(?:[^|{}]*|{{[^|}]*}})+)*)}}\s*/i;
        let m;

        m = rdrx.exec(markup.trim());
        markup = markup.substr(m[0].length);
        this.target = m[1];

        this.rcatt = {};
        out: while ((m = tprx.exec(markup))) {
            let alias = normaliseTitle(m[1]);
            while (templateAliases[alias]) alias = templateAliases[alias]; // hopefully there are no loops.

            if (alias === 'This is a redirect') {
                const params = m[2].split('|');
                for (let j = 0; j < params.length; ++j) {
                    if (!params[j]) continue;
                    if (params[j].indexOf('=') !== -1) break out;
                    alias = normaliseTitle('R ' + params[j]);
                    while (templateAliases[alias]) alias = templateAliases[alias]; // hopefully there are still no loops.
                    if (alias in redirectTemplates) this.rcatt[alias] = true;
                    else break out;
                }
            } else if (alias === 'Redirect category shell') {
                let mm,
                    rr = /{{(.*?)}}/g;
                while ((mm = rr.exec(m[2]))) {
                    alias = normaliseTitle(mm[1]);
                    while (templateAliases[alias]) alias = templateAliases[alias];
                    if (alias in redirectTemplates) this.rcatt[alias] = true;
                }
            } else if (alias in redirectTemplates) {
                if (m[2])
                    // TODO
                    break;
                this.rcatt[alias] = true;
            } else {
                break;
            }
            markup = markup.substr(m[0].length);
        }

        this.tail = markup;
    };

    MarkupBlob.prototype.toString = function () {
        let markup = '#REDIRECT [[' + this.target + ']]\n';
        let tail = '';
        const wrapped = [];
        for (const key in this.rcatt) {
            if (this.rcatt[key])
                if (wrapped.length < 6 && /^R\s+/.test(key)) wrapped.push('{{' + key + '}}\n');
                else tail += '{{' + key + '}}\n';
        }
        if (wrapped.length) markup += '\n{{Redirect category shell|\n' + wrapped.join('') + '}}\n';
        markup += tail + '\n';
        markup += this.tail;
        return markup;
    };

    function buildTagList(rcatt) {
        function makeCheckBox(key) {
            return el(
                'label',
                [
                    el(
                        'input',
                        null,
                        { type: 'checkbox', checked: key in rcatt ? 'checked' : null },
                        {
                            change() {
                                rcatt[key] = this.checked;
                            }
                        }
                    ),
                    ' ',
                    redirectTemplates[key].label
                ],
                { title: redirectTemplates[key].tooltip }
            );
        }

        const list = el('dl', null, { class: 'tag-list' });
        const group = {};
        for (const key in templateGroups) {
            list.appendChild(el('dt', templateGroups[key]));
            list.appendChild(el('dd', (group[key] = el('ul'))));
        }
        for (const key in redirectTemplates) {
            const label = makeCheckBox(key);
            group[redirectTemplates[key].group].appendChild(el('li', label));
        }

        const collapsibleContent = el('div', list, {
            class: 'mw-collapsible-content',
            id: 'capricorn-toggle-content'
        });
        return collapsibleContent;
    }

    //  Interface creation
    function buildEditingUI(mblob, saveCallback) {
        let statusbar;
        let needsCheck = true;
        let uiLink, uiTarget;
        mblob = mblob || new MarkupBlob();

        // Change text of status bar
        function setStatus(status) {
            while (statusbar.firstChild)
                // Remove previous statuses
                statusbar.removeChild(statusbar.firstChild);
            if (status) {
                // If status is a string, add it
                if (typeof status === 'string') statusbar.appendChild(document.createTextNode(status));
                else {
                    // Otherwise, loop through list and add statuses
                    for (let j = 0; j < status.length; ++j) {
                        if (typeof status[j] === 'string') statusbar.appendChild(document.createTextNode(status[j]));
                        else statusbar.appendChild(status[j]);
                    }
                }
            }
        }

        // Check if the target has changed??
        // Not actually sure what this does yet 21 Oct 2019
        function inputChanged() {
            try {
                mblob.target = this.value;
                const t = new mw.Title(this.value);
                const frag = t.getFragment() ? '#' + normaliseAnchor(t.getFragment()) : '';
                if (uiLink) uiLink.href = mw.util.getUrl(t.getPrefixedDb(), { redirect: 'no' }) + frag;
                setStatus();
            } catch (e) {
                setStatus('Invalid title.');
                if (uiLink) uiLink.href = 'javascript:void(0);';
            }
            needsCheck = true;
        }

        let uiStatusLine;
        let patrolLine;
        const origTarget = mblob.target;
        const ui = el(
            'form',
            [
                el(
                    'div',
                    [
                        el(
                            'ul',
                            [
                                el('li', [
                                    (uiTarget = el(
                                        'input',
                                        null,
                                        { type: 'text', class: 'redirectText', value: mblob.target },
                                        {
                                            input: inputChanged,
                                            change: inputChanged,
                                            blur(ev) {
                                                // i would not have to write this, if it were not for jQuery. seriously.
                                                if (mblob.target === this.value) return;
                                                inputChanged.call(this, ev);
                                            }
                                        }
                                    ))
                                ])
                            ],
                            { class: 'redirectText' }
                        ),
                        mblob.target ? el('span', link(mblob.target, mw.util.getUrl(mblob.target)), { class: 'capricorn-link' }) : null,
                        el(
                            'input',
                            null,
                            { type: 'button', class: 'capricorn-toggle', id: 'capricorn-toggle-button', value: 'Hide rcat list' },
                            {
                                click() {
                                    $('#capricorn-toggle-content').toggle();
                                    const buttonText = $('#capricorn-toggle-button')[0].value;
                                    if (buttonText === 'Hide rcat list') {
                                        $('#capricorn-toggle-button')[0].value = 'Show rcat list';
                                    } else {
                                        $('#capricorn-toggle-button')[0].value = 'Hide rcat list';
                                    }
                                }
                            }
                        )
                    ].filter(Boolean),
                    { class: 'redirectMsg' }
                ),
                buildTagList(mblob.rcatt),
                (uiStatusLine = el('p', [
                    (patrolLine = el('span', [], {})),
                    (statusbar = el('span', [], {
                        class: 'status-line'
                    })),
                    el('span', [link(['Statistics for this page'], 'https://tools.wmflabs.org/pageviews?project=en.wikipedia.org&pages=' + encodeURIComponent(mw.config.get('wgPageName'))), ' • ', link(['WP:TMR'], mw.util.getUrl('Wikipedia:Template messages/Redirect pages')), ' • ', link(['About Capricorn'], mw.util.getUrl('User:Wugapodes/Capricorn'))], {
                        style: 'float: right;'
                    })
                ]))
            ],
            { action: 'javascript:void(0)', class: 'kephir-sagittarius-editor' },
            {
                submit(ev) {
                    ev.preventDefault();
                    if (uiStatusLine.childNodes[1].childNodes[0]) {
                        const patrolVal = uiStatusLine.childNodes[1].childNodes[0].childNodes[0].checked;
                        if (patrolVal) {
                            api.get(
                                {
                                    action: 'query',
                                    format: 'json',
                                    prop: 'revisions',
                                    meta: 'tokens',
                                    titles: mw.config.get('wgPageName'),
                                    rvprop: 'ids',
                                    rvslots: '',
                                    rvlimit: '1',
                                    rvdir: 'newer',
                                    type: 'patrol'
                                },
                                {
                                    success(result) {
                                        //console.log(mw.config.get('wgPageName'))
                                        const patrolToken = result.query.tokens.patroltoken;
                                        const revIDpart = result.query.pages;
                                        let revID = null;
                                        for (const page in revIDpart) {
                                            revID = revIDpart[page].revisions[0].revid;
                                        }
                                        //console.log(revID)
                                        api.post(
                                            {
                                                action: 'patrol',
                                                revid: revID,
                                                token: patrolToken
                                            },
                                            {
                                                success(result) {
                                                    if (result.error) {
                                                        console.log(result.error);
                                                        setStatus(['API error: "', result.error.info, '" [code: ', el('code', [result.error.code]), ']']);
                                                        console.log(result.error);
                                                        return;
                                                    }
                                                }
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    }
                    ui.doCheck(saveCallback);
                }
            }
        );
        ui.statusLine = uiStatusLine;
        ui.patrolLine = patrolLine;
        ui.origTarget = origTarget;

        const sectCache = {};
        const $uiTarget = jQuery(uiTarget);
        $uiTarget.suggestions({
            submitOnClick: false,
            delay: 500,
            fetch(query) {
                $uiTarget.suggestions('suggestions', []);
                if (query.indexOf('#') !== -1) {
                    const title = query.substr(0, query.indexOf('#'));
                    const sect = query.substr(query.indexOf('#') + 1);

                    if (sectCache[title]) {
                        const normSect = normaliseAnchor(sect);
                        $uiTarget.suggestions(
                            'suggestions',
                            sectCache[title].filter((item) => {
                                const norm = normaliseAnchor(item.anchor);
                                return norm.substr(0, normSect.length) === normSect;
                            })
                        );
                        return;
                    }

                    api.get({
                        action: 'parse',
                        page: title,
                        prop: 'sections|properties',
                        redirects: '1'
                    }).then((result) => {
                        if (result.parse.redirects && result.parse.redirects.length) {
                            // XXX
                            return;
                        }

                        const disambig = false; // XXX

                        const normSect = normaliseAnchor(sect);
                        sectCache[title] = result.parse.sections.map((item) => {
                            return {
                                anchor: item.anchor,
                                title: title + '#' + decodeURIComponent(item.anchor.replace(/_/g, ' ').replace(/\.([0-9A-Fa-f][0-9A-Fa-f])/g, '%')), // XXX: hack
                                disambig,
                                toString() {
                                    return this.title;
                                }
                            };
                        });

                        $uiTarget.suggestions(
                            'suggestions',
                            sectCache[title].filter((item) => {
                                const norm = normaliseAnchor(item.anchor);
                                return norm.substr(0, normSect.length) === normSect;
                            })
                        );
                    });
                    return;
                }

                api.get({
                    action: 'query',
                    generator: 'allpages',
                    gapprefix: query,
                    gaplimit: 16,
                    prop: 'info|pageprops'
                }).then((result) => {
                    const pglist = [];
                    for (const pgid in result.query.pages) {
                        const page = result.query.pages[pgid];
                        pglist.push({
                            title: page.title,
                            pageid: page.pageid,
                            disambig: page.pageprops && 'disambiguation' in page.pageprops,
                            redirect: 'redirect' in page,
                            toString() {
                                return this.title;
                            }
                        });
                    }
                    $uiTarget.suggestions('suggestions', pglist);
                });
            },
            result: {
                render(item) {
                    const elm = this[0];
                    elm.appendChild(el('span', [item.title], { style: item.redirect ? 'font-style: italic' : '' }));
                    if (item.disambig) elm.appendChild(el('small', [' (disambiguation page)']));
                    if (item.redirect) elm.appendChild(el('small', [' (redirect)']));
                },

                select($textbox) {
                    const item = this.data('text');
                    const textbox = $textbox[0];

                    textbox.value = item.title;
                    if (item.redirect) {
                        api.get({ action: 'query', pageids: item.pageid, redirects: '1' }).then((result) => {
                            const redir = result.query.redirects.pop();
                            textbox.value = redir.to + (redir.tofragment ? '#' + redir.tofragment : '');
                        });
                    }

                    return true;
                }
            }
        });

        ui.doCheck = function (callback) {
            if (!/^\s*[^|{}[\]]+\s*$/.test(mblob.target)) {
                setStatus(['Error: the target page name is invalid.']);
                return;
            }

            if (needsCheck) {
                let oldTarget = mblob.target;
                let normTarget;
                try {
                    normTarget = new mw.Title(oldTarget);
                } catch (e) {
                    setStatus(['"', oldTarget, '" is not a valid page name. Try again to proceed anyway.']);
                    return;
                }

                setStatus(['Checking target validity...']);
                needsCheck = false;

                api.get(
                    {
                        action: 'parse',
                        page: (oldTarget = mblob.target),
                        prop: 'sections',
                        redirects: '1'
                    },
                    {
                        success(result) {
                            if (result.error) {
                                if (result.error.code === 'missingtitle') {
                                    setStatus(['Error: The target page "', link([normTarget.getPrefixedText()], mw.util.getUrl(normTarget.getPrefixedText(), { class: 'new' })), '" does not exist. Try again to proceed anyway.']);
                                } else {
                                    setStatus(['API error: "', result.error.info, '" [code: ', el('code', [result.error.code]), ']']);
                                }
                                return;
                            }

                            if (result.parse.redirects && result.parse.redirects[0]) {
                                const newTarget = result.parse.redirects[0].to + (result.parse.redirects[0].tofragment ? '#' + result.parse.redirects[0].tofragment : '');
                                setStatus([
                                    'Error: The target page "',
                                    link([normTarget.getPrefixedText()], mw.util.getUrl(normTarget.getPrefixedText(), { redirect: 'no' })),
                                    '" is already a redirect to "',
                                    link([newTarget], mw.util.getUrl(newTarget, { redirect: 'no' })),
                                    '". Try again to proceed anyway, or ',
                                    link(['retarget this redirect to point there directly'], () => {
                                        uiTarget.value = mblob.target = newTarget + (!result.parse.redirects[0].tofragment && normTarget.fragment ? '#' + normTarget.fragment : '');
                                        needsCheck = true;
                                    }),
                                    '.'
                                ]);
                                return;
                            }

                            if (normTarget.fragment) {
                                // we have a section link
                                const sect = normaliseAnchor(normTarget.fragment);
                                let isValidSect = false;

                                const sectList = result.parse.sections;
                                for (let j = 0; j < sectList.length; ++j) {
                                    if (sectList[j].anchor === sect) isValidSect = true;
                                }

                                if (!isValidSect) {
                                    setStatus(['Error: The target page "', link([normTarget.getPrefixedText()], mw.util.getUrl(normTarget.getPrefixedText(), { redirect: 'no' })), '" does not have a a section called "', normTarget.fragment, '". Try again to proceed anyway.']);

                                    return;
                                }
                            }

                            callback(setStatus);
                        }
                    }
                );

                return;
            }

            callback(setStatus);
        };

        return ui;
    }

    function setSummary(current, original) {
        let summary;
        if (original === current) {
            summary = 'Modifying [[WP:RCAT|redirect categories]] using [[User:Wugapodes/Capricorn|Capricorn ♑]]';
        } else {
            summary = `Redirecting to [[${current}]] ([[User:Wugapodes/Capricorn|♑]])`;
        }
        return summary;
    }

    if (mw.config.get('wgAction') === 'view' && mw.config.get('wgArticleId') === 0) {
        // nonexistent page.
        uiWrapper.appendChild(
            el(
                'div',
                [
                    link(['Create a redirect'], () => {
                        while (uiWrapper.hasChildNodes()) uiWrapper.removeChild(uiWrapper.firstChild);
                        const mblob = new MarkupBlob();
                        const ui = buildEditingUI(mblob, (setStatus) => {
                            setStatus(['Saving...']);
                            const summary = setSummary(mblob.target, ui.origTarget);
                            api.post(
                                {
                                    action: 'edit',
                                    title: mw.config.get('wgPageName'),
                                    createonly: 1,
                                    summary,
                                    text: mblob.toString(),
                                    token: mw.user.tokens.get('csrfToken')
                                },
                                {
                                    success(result) {
                                        if (result.error) {
                                            setStatus(['API error: "', result.error.info, '" [code: ', el('code', [result.error.code]), ']']);
                                            return;
                                        }
                                        setStatus(['Saved. Reloading page...']);
                                        if (/redirect=no/.test(location.href))
                                            // XXX
                                            location.reload();
                                        else location.search = location.search ? location.search + '&redirect=no' : '?redirect=no';
                                    }
                                }
                            );
                        });
                        ui.statusLine.insertBefore(el('input', null, { type: 'submit', value: 'Save' }), ui.statusLine.firstChild);
                        uiWrapper.appendChild(ui);
                    }),
                    ' from this page with Capricorn'
                ],
                { class: 'kephir-sagittarius-invite' }
            )
        );
        contentText.parentNode.insertBefore(uiWrapper, contentText);
    } else if (mw.config.get('wgAction') === 'view' && mw.config.get('wgIsRedirect') && redirMsg) {
        // start editor immediately
        uiWrapper.appendChild(el('div', ['Loading page source…'], { class: 'kephir-sagittarius-loading' }));
        contentText.insertBefore(uiWrapper, contentText.firstChild);
        api.get(
            {
                action: 'query',
                prop: 'revisions',
                rvprop: 'timestamp|content',
                pageids: mw.config.get('wgArticleId'),
                rvstartid: mw.config.get('wgRevisionId'),
                rvlimit: 1,
                rvdir: 'older'
            },
            {
                success(result) {
                    if (result.error) {
                        uiWrapper.appendChild(el('div', ['API error: "', result.error.info, '" [code: ', el('code', [result.error.code]), ']. Reload to try again.'], { class: 'kephir-sagittarius-error' }));
                        return;
                    }
                    while (uiWrapper.hasChildNodes()) uiWrapper.removeChild(uiWrapper.firstChild);
                    const page = result.query.pages[mw.config.get('wgArticleId')];
                    let mblob;
                    try {
                        mblob = new MarkupBlob(page.revisions[0]['*']);
                    } catch (e) {
                        uiWrapper.appendChild(el('div', ['Error: unable to parse page. Edit the source manually.'], { class: 'kephir-sagittarius-error' }));
                        return;
                    }
                    redirMsg.parentNode.removeChild(redirMsg);
                    const ui = buildEditingUI(mblob, (setStatus) => {
                        setStatus(['Saving...']);
                        const summary = setSummary(mblob.target, ui.origTarget);
                        api.post(
                            {
                                action: 'edit',
                                title: mw.config.get('wgPageName'),
                                basetimestamp: page.revisions[0].timestamp,
                                summary,
                                text: mblob.toString(),
                                token: mw.user.tokens.get('csrfToken')
                            },
                            {
                                success(result) {
                                    if (result.error) {
                                        setStatus(['API error: "', result.error.info, '" [code: ', el('code', [result.error.code]), ']']);
                                        return;
                                    }
                                    setStatus(['Saved. Reloading page...']);
                                    if (/redirect=no/.test(location.href))
                                        // XXX
                                        location.reload();
                                    else location.search = location.search ? location.search + '&redirect=no' : '?redirect=no';
                                }
                            }
                        );
                    });
                    const userName = mw.user.getName();
                    api.get(
                        {
                            action: 'query',
                            format: 'json',
                            list: 'users',
                            usprop: 'groups',
                            ususers: userName
                        },
                        {
                            success(result) {
                                const { groups } = result.query.users[0];
                                if (groups.includes('patroller')) {
                                    ui.patrolLine.insertBefore(el('label', [el('input', [], { class: 'checkbox', type: 'checkbox', id: 'patrol', value: 'patrol' }), 'Mark as patrolled?']), null);
                                }
                            }
                        }
                    );
                    ui.statusLine.insertBefore(el('input', null, { type: 'submit', value: 'Save' }), ui.statusLine.firstChild);
                    uiWrapper.appendChild(ui);
                }
            }
        );
    } else if (mw.config.get('wgPageContentModel') === 'wikitext' && (mw.config.get('wgAction') === 'edit' || mw.config.get('wgAction') === 'submit')) {
        if (mw.util.getParamValue('section')) return;
        const editform = document.getElementById('editform');

        if (!editform || !editform.wpTextbox1 || editform.wpTextbox1.readOnly) return;

        const uiPivot = document.getElementsByClassName('wikiEditor-ui')[0];

        let ui, mblob;
        firstHeading.appendChild(document.createTextNode(' '));
        firstHeading.appendChild(
            link(
                ['♑'],
                () => {
                    if (ui && ui.parentNode) ui.parentNode.removeChild(ui);

                    try {
                        mblob = new MarkupBlob(editform.wpTextbox1.value);
                    } catch (e) {
                        alert('Error: unable to parse page. This page is probably not a redirect.');
                        return;
                    }

                    currentTarget = mblob.target;

                    ui = buildEditingUI(mblob, () => {
                        editform.wpSummary.value = 'Redirecting to [[' + mblob.target + ']] ([[User:Wugapodes/Capricorn|♑]])';
                        editform.wpTextbox1.value = mblob.toString();
                        mblob = null;
                        ui.style.display = 'none';
                        uiPivot.style.display = '';
                    });
                    ui.style.display = 'none';
                    ui.statusLine.insertBefore(
                        el(
                            'input',
                            null,
                            { type: 'button', value: 'Cancel' },
                            {
                                click() {
                                    mblob = null;
                                    ui.style.display = 'none';
                                    uiPivot.style.display = '';
                                }
                            }
                        ),
                        ui.statusLine.firstChild
                    );
                    ui.statusLine.insertBefore(el('input', null, { type: 'submit', value: 'Check' }), ui.statusLine.firstChild);
                    uiPivot.parentNode.insertBefore(ui, uiPivot);
                    uiPivot.style.display = 'none';
                    ui.style.display = '';
                },
                { class: 'kephir-sagittarius-editlink', title: 'Edit this redirect with Capricorn' }
            )
        );

        let submitButton;
        const inputs = editform.getElementsByTagName('input');
        for (let i = 0; i < inputs.length; ++i) {
            inputs[i].addEventListener(
                'click',
                () => {
                    submitButton = this;
                },
                false
            );
        }

        editform.addEventListener(
            'submit',
            (ev) => {
                if (submitButton !== editform.wpSave) return;
                if (mblob) {
                    ev.preventDefault();
                    ev.stopImmediatePropagation();
                    ui.doCheck((setStatus) => {
                        setStatus(['Proceeding with saving...']);
                        const summary = setSummary(currentTarget, ui.origTarget);
                        editform.wpTextbox1.value = mblob.toString();
                        editform.wpSummary.value = summary;
                        mblob = null;
                        editform.submit();
                    });
                }
            },
            false
        );
    }

    if (!window.kephirSagittariusFollowCategoryRedirects)
        if (mw.config.get('wgAction') === 'view' && mw.config.get('wgNamespaceNumber') === wgNamespaceIds.category) {
            const pagesList = document.getElementById('mw-pages').getElementsByClassName('mw-redirect');
            for (let i = 0; i < pagesList.length; ++i) {
                pagesList[i].href += '?redirect=no';
            }
        }
}

function abortConditions() {
    if (window.location.href.includes('&diff=')) throw 'Capricorn does not run when viewing page diffs. Please revert before editing redirect.';

    if (mw.config.get('wgNamespaceNumber') < 0) throw 'Page is in a virtual namespace. Capricorn aborts.';
}

function Capricorn() {
    $.getJSON('https://en.wikipedia.org/w/index.php?title=User:Wugapodes/Capricorn/RedirectAliases.json&action=raw&ctype=application/json', (aliasJSON) => {
        $.getJSON('https://en.wikipedia.org/w/index.php?title=User:Wugapodes/Capricorn/RedirectTemplates.json&action=raw&ctype=application/json', (templateJSON) => {
            mw.loader.using(['jquery.suggestions', 'mediawiki.api', 'mediawiki.Title', 'mediawiki.action.view.redirectPage'], () => {
                mainCallback(aliasJSON, templateJSON);
            });
        });
    });
}

const api = new mw.Api();

api.get(
    {
        action: 'query',
        format: 'json',
        prop: 'info',
        formatversion: 2,
        titles: mw.config.get('wgPageName')
    },
    {
        success(result) {
            try {
                abortConditions();
            } catch (abortMessage) {
                console.info(abortMessage); // eslint-disable-line no-console
                return;
            }
            if (result.query.pages[0].redirect || result.query.pages[0].missing) {
                Capricorn();
            } else {
                console.debug('Page is not a redirect and exists.'); // eslint-disable-line no-console
                return;
            }
        }
    }
);
