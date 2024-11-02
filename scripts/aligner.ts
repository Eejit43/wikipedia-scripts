(() => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page

    mw.loader.using(['mediawiki.util', 'jquery.textSelection'], () => {
        mw.util.addCSS(`
#align-parameters {
    display: none;
}

#content:has(#wpTextbox1) #align-parameters {
    display: unset;
}`);

        const link = mw.util.addPortletLink(
            mw.config.get('skin') === 'minerva' ? 'p-navigation' : 'p-cactions',
            '#',
            'Align template parameters',
            'align-parameters',
        )!;

        link.addEventListener('click', (event) => {
            event.preventDefault();

            const editBox = $('#wpTextbox1');
            if (editBox.length === 0) return mw.notify('Edit box not found!', { type: 'error', autoHideSeconds: 'short' });

            const text = editBox.textSelection('getContents');
            if (!text) return mw.notify('Edit box value not found!', { type: 'error', autoHideSeconds: 'short' });

            let count = 0;

            /**
             * Finishes processing an infobox and updates the edit box contents.
             * @param template The template string to process.
             */
            function processInfobox(template: string) {
                if (template === '') return mw.notify('Infobox not found!', { type: 'error', autoHideSeconds: 'short' });

                if (open !== 0) return mw.notify('Template was not properly closed!', { type: 'error', autoHideSeconds: 'short' });

                let maxLength = 0;

                const origTemplate = String(template);
                const lines = template.split('\n');
                const newLines = [];

                for (const line of lines) {
                    const parametersInLine = splitIntoParameters(line.trim());

                    for (const parameter of parametersInLine) {
                        const line = parameter.trim();
                        if (!line.startsWith('|') || line.split('=').length !== 2) {
                            newLines.push(line);
                            continue;
                        }

                        let [firstPart, lastPart] = splitParameter(line) as [string, string]; // eslint-disable-line prefer-const
                        firstPart = firstPart.slice(1).trim();

                        if (firstPart.length > maxLength) maxLength = firstPart.length;

                        newLines.push('| ' + firstPart + '=' + lastPart);
                    }
                }

                let output = '';

                maxLength += 2; // to include '| '

                for (let line of newLines) {
                    const parts = splitParameter(line) as [string, string];

                    if (parts.length < 2) {
                        output += line += '\n';
                        continue;
                    }

                    let firstPart = parts[0].trim();

                    while (firstPart.length < maxLength) firstPart += ' ';

                    output += firstPart + ' = ' + parts[1].trim() + '\n';
                }

                if (output.endsWith('\n')) output = output.slice(0, -1);

                editBox.textSelection(
                    'setContents',
                    editBox.textSelection('getContents').replace(origTemplate, output).replace(/\n+$/, ''),
                );

                editBox.textSelection('setSelection', { start: 0 });
            }

            let template = '';
            let open = 0;

            const searches = ['infobox', 'speciesbox', 'taxobox', 'automatic taxobox', 'osm location map', 'motorsport season'];

            for (let index = 0; index < text.length; index++) {
                let foo = false;

                for (let search of searches) {
                    search = '{{' + search;
                    const searchLength = search.length;

                    if (
                        text.length - index > searchLength &&
                        (text.slice(index, index + searchLength).toLowerCase() === search ||
                            text.slice(index, index + searchLength).toLowerCase() === search.replace(' ', '_'))
                    ) {
                        open++;
                        template += text[index];
                        foo = true;
                    }
                }

                if (open >= 1 && !foo) {
                    template += text[index];

                    if (text[index] === '{') open++;
                    else if (text[index] === '}') {
                        open--;

                        if (open === 0) {
                            count++;
                            processInfobox(template);
                            template = '';
                        }
                    }
                }
            }

            if (count === 0) mw.notify('No templates found to align!', { type: 'warn', autoHideSeconds: 'short' });
            else mw.notify(`Successfully aligned ${count} template${count > 1 ? 's' : ''}!`, { type: 'success', autoHideSeconds: 'short' });
        });
    });
})();

/**
 * Splits a string into an Array containing the key and value.
 * @param string The full string to split.
 */
function splitParameter(string: string) {
    const split = string.split('=');
    if (split.length <= 2) return split;

    const first = split.shift();
    return [first, split.join('=')];
}

/**
 * Splits a template into an Array with all parameters.
 * @param string The template to process.
 */
function splitIntoParameters(string: string): string[] {
    if (string.startsWith('{{') && string.endsWith('}}')) {
        if (!string.includes('|')) return [string];

        const results = splitIntoParameters(string.slice(2, -2));
        return ['{{' + results[0], ...splitIntoParameters(string.slice(2, -2)).slice(1), '}}'];
    }

    const parameters = [];
    let temporary = '';
    let open = 0;

    for (const char of string) {
        temporary += char;

        if (char === '{' || char === '[') open += 1;
        else if (char === '' || char === ']') open--;
        else if (char === '|' && open === 0 && temporary.trim() !== '|') {
            parameters.push(temporary.slice(0, -1).trim());
            temporary = '|';
        }
    }

    parameters.push(temporary);

    return parameters;
}
