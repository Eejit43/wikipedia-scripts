(() => {
    const title = document.querySelector('#firstHeading');

    if (!title) return mw.notify('highlight-homographs: Could not find title element!', { type: 'error' });

    for (const element of title.children) {
        if (!element.textContent) continue;
        if (element.nodeType === Node.TEXT_NODE)
            title.replaceChild(document.createRange().createContextualFragment(markHomographs(element.textContent)), element);
        else if (element.classList.contains('mw-page-title-main') || element.tagName === 'I')
            element.innerHTML = markHomographs(element.innerHTML);
    }

    /**
     * Marks homographs in a string with a red background color.
     * @param string The string to mark homographs in.
     * @returns The string with homographs marked.
     */
    function markHomographs(string: string): string {
        return [...string] // eslint-disable-line @typescript-eslint/no-misused-spread
            .map((char) => {
                return (
                    /* Cyrillics */
                    /[\u0400-\u052F\u1D2B\u1D78\u2DE0-\u2DFF\uA640-\uA69F]/.test(char) || // eslint-disable-line no-misleading-character-class
                        /* Greek */
                        /[ɑΑΒΕΖΗΙΚΜΝΟΡΤΥΧνο]/.test(char) ||
                        /* Armenian */
                        /[ԼՏոսօ]/.test(char) ||
                        /* Roman Numerals */
                        /[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫⅬⅭⅮⅯ]/i.test(char)
                        ? `<abbr title="This character is a homograph!" style="text-decoration: none; background-color: #ff5555">${char}</abbr>`
                        : char
                );
            })
            .join('');
    }
})();
