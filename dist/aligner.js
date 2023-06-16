"use strict";
(() => {
    if (mw.config.get('wgNamespaceNumber') < 0)
        return;
    if (!mw.config.get('wgIsProbablyEditable'))
        return;
    const searches = ['infobox', 'speciesbox', 'taxobox', 'automatic taxobox', 'osm location map', 'motorsport season'];
    mw.loader.using(['mediawiki.util', 'mediawiki.notification', 'jquery.textSelection'], () => {
        const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-navigation' : 'p-cactions', '#', 'Align template params', 'align-params');
        link.addEventListener('click', (event) => {
            var _a;
            event.preventDefault();
            function splitParam(string) {
                const split = string.split('=');
                if (split.length <= 2)
                    return split;
                const first = split.shift();
                return [first, split.join('=')];
            }
            function splitIntoParams(string) {
                if (string.startsWith('{{') && string.endsWith('}}')) {
                    if (!string.includes('|'))
                        return [string];
                    const results = splitIntoParams(string.slice(2, -2));
                    return ['{{' + results[0]].concat(splitIntoParams(string.slice(2, -2)).slice(1), ['}}']);
                }
                const params = [];
                let temp = '';
                let open = 0;
                for (let i = 0; i < string.length; i++) {
                    const char = string[i];
                    temp += char;
                    if (char === '{' || char === '[') {
                        open += 1;
                    }
                    else if (char === '}' || char === ']') {
                        open--;
                    }
                    else if (char === '|' && open === 0 && temp.trim() !== '|') {
                        params.push(temp.slice(0, -1).trim());
                        temp = '|';
                    }
                }
                params.push(temp);
                return params;
            }
            if ((_a = window.wikEd) === null || _a === void 0 ? void 0 : _a.useWikEd)
                window.wikEd.UpdateTextarea();
            const editBox = $('#wpTextbox1');
            if (!editBox)
                return mw.notification.notify('Edit box not found, are you in edit mode?', { type: 'error', autoHideSeconds: 'short' });
            const text = editBox.textSelection('getContents');
            if (!text)
                return mw.notification.notify('Edit box value not found!', { type: 'error', autoHideSeconds: 'short' });
            let count = 0;
            function processInfobox(template) {
                var _a;
                if (template === '')
                    return mw.notification.notify('Infobox not found!', { type: 'error', autoHideSeconds: 'short' });
                if (open !== 0)
                    return mw.notification.notify('Template was not properly closed!', { type: 'error', autoHideSeconds: 'short' });
                let maxLength = 0;
                const origTemplate = String(template);
                const lines = template.split('\n');
                const newLines = [];
                for (const lineNumber in lines) {
                    const paramsInLine = splitIntoParams(lines[lineNumber].trim());
                    for (const paramNumber in paramsInLine) {
                        const line = paramsInLine[paramNumber].trim();
                        if (!line.startsWith('|') || line.split('=').length !== 2) {
                            newLines.push(line);
                            continue;
                        }
                        let [firstPart, lastPart] = splitParam(line);
                        firstPart = firstPart.slice(1).trim();
                        if (firstPart.length > maxLength)
                            maxLength = firstPart.length;
                        newLines.push('| ' + firstPart + '=' + lastPart);
                    }
                }
                let output = '';
                maxLength += 2;
                for (const lineNumber in newLines) {
                    let line = newLines[lineNumber];
                    const parts = splitParam(line);
                    if (parts.length < 2) {
                        output += line += '\n';
                        continue;
                    }
                    let firstPart = parts[0].trim();
                    while (firstPart.length < maxLength)
                        firstPart += ' ';
                    output += firstPart + ' = ' + parts[1].trim() + '\n';
                }
                if (output.endsWith('\n'))
                    output = output.slice(0, -1);
                editBox.textSelection('setContents', editBox.textSelection('getContents').replace(origTemplate, output).replace(/\n+$/, ''));
                if ((_a = window.wikEd) === null || _a === void 0 ? void 0 : _a.useWikEd)
                    window.wikEd.UpdateFrame();
            }
            let template = '';
            let open = 0;
            for (let i = 0; i < text.length; i++) {
                let foo = false;
                for (const searchIndex in searches) {
                    const search = '{{' + searches[searchIndex];
                    const searchLength = search.length;
                    if (text.length - i > searchLength) {
                        if (text.slice(i, i + searchLength).toLowerCase() === search || text.slice(i, i + searchLength).toLowerCase() === search.replace(' ', '_')) {
                            open++;
                            template += text[i];
                            foo = true;
                        }
                    }
                }
                if (open >= 1 && !foo) {
                    template += text[i];
                    if (text[i] === '{')
                        open++;
                    else if (text[i] === '}') {
                        open--;
                        if (open === 0) {
                            count++;
                            processInfobox(template);
                            template = '';
                        }
                    }
                }
            }
            mw.notification.notify(`Successfully aligned ${count} templates!`, { type: 'success', autoHideSeconds: 'short' });
        });
    });
})();
