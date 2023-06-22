// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Window {
    wikEd?: {
        useWikEd: boolean;
        UpdateTextarea: () => void; // eslint-disable-line @typescript-eslint/naming-convention
        UpdateFrame: () => void; // eslint-disable-line @typescript-eslint/naming-convention
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface JQuery<TElement extends Node = HTMLElement> extends Iterable<TElement> {
    textSelection(methodName: 'setContents', value: string): void;
}

(() => {
    if (mw.config.get('wgNamespaceNumber') < 0) return; // Don't run in virtual namespaces
    if (!mw.config.get('wgIsProbablyEditable')) return; // Don't run if user can't edit page

    const searches = ['infobox', 'speciesbox', 'taxobox', 'automatic taxobox', 'osm location map', 'motorsport season'];

    mw.loader.using(['mediawiki.util', 'mediawiki.notification', 'jquery.textSelection'], () => {
        const link = mw.util.addPortletLink(mw.config.get('skin') === 'minerva' ? 'p-navigation' : 'p-cactions', '#', 'Align template params', 'align-params');
        link.addEventListener('click', (event) => {
            event.preventDefault();

            function splitParam(string: string): (string | undefined)[] {
                const split = string.split('=');
                if (split.length <= 2) return split;

                const first = split.shift();
                return [first, split.join('=')];
            }

            function splitIntoParams(string: string): string[] {
                if (string.startsWith('{{') && string.endsWith('}}')) {
                    if (!string.includes('|')) return [string];

                    const results = splitIntoParams(string.slice(2, -2));
                    return ['{{' + results[0]].concat(splitIntoParams(string.slice(2, -2)).slice(1), ['}}']);
                }

                const params = [];
                let temp = '';
                let open = 0;

                for (let i = 0; i < string.length; i++) {
                    const char = string[i];
                    temp += char;

                    if (char === '{' || char === '[') open += 1;
                    else if (char === '' || char === ']') open--;
                    else if (char === '|' && open === 0 && temp.trim() !== '|') {
                        params.push(temp.slice(0, -1).trim());
                        temp = '|';
                    }
                }

                params.push(temp);

                return params;
            }

            if (window.wikEd?.useWikEd) window.wikEd.UpdateTextarea();

            const editBox = $('#wpTextbox1');

            if (!editBox) return mw.notification.notify('Edit box not found, are you in edit mode?', { type: 'error', autoHideSeconds: 'short' });

            const text = editBox.textSelection('getContents');

            if (!text) return mw.notification.notify('Edit box value not found!', { type: 'error', autoHideSeconds: 'short' });

            let count = 0;

            function processInfobox(template: string) {
                if (template === '') return mw.notification.notify('Infobox not found!', { type: 'error', autoHideSeconds: 'short' });

                if (open !== 0) return mw.notification.notify('Template was not properly closed!', { type: 'error', autoHideSeconds: 'short' });

                let maxLength = 0;

                const origTemplate = String(template);
                const lines = template.split('\n');
                const newLines = [];

                for (const line of lines) {
                    const paramsInLine = splitIntoParams(line.trim());

                    for (const param of paramsInLine) {
                        const line = param.trim();
                        if (!line.startsWith('|') || line.split('=').length !== 2) {
                            newLines.push(line);
                            continue;
                        }

                        let [firstPart, lastPart] = splitParam(line) as [string, string]; // eslint-disable-line prefer-const
                        firstPart = firstPart.slice(1).trim();

                        if (firstPart.length > maxLength) maxLength = firstPart.length;

                        newLines.push('| ' + firstPart + '=' + lastPart);
                    }
                }

                let output = '';

                maxLength += 2; // to include '| '

                for (let line of newLines) {
                    const parts = splitParam(line) as [string, string];

                    if (parts.length < 2) {
                        output += line += '\n';
                        continue;
                    }

                    let firstPart = parts[0].trim();

                    while (firstPart.length < maxLength) firstPart += ' ';

                    output += firstPart + ' = ' + parts[1].trim() + '\n';
                }

                if (output.endsWith('\n')) output = output.slice(0, -1);

                editBox.textSelection('setContents', editBox.textSelection('getContents').replace(origTemplate, output).replace(/\n+$/, ''));

                if (window.wikEd?.useWikEd) window.wikEd.UpdateFrame();
            }

            let template = '';
            let open = 0;

            for (let i = 0; i < text.length; i++) {
                let foo = false;

                for (let search of searches) {
                    search = '{{' + search;
                    const searchLength = search.length;

                    if (text.length - i > searchLength)
                        if (text.slice(i, i + searchLength).toLowerCase() === search || text.slice(i, i + searchLength).toLowerCase() === search.replace(' ', '_')) {
                            open++;
                            template += text[i];
                            foo = true;
                        }
                }

                if (open >= 1 && !foo) {
                    template += text[i];

                    if (text[i] === '{') open++;
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
