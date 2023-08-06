"use strict";
(() => {
  if (mw.config.get("wgNamespaceNumber") < 0)
    return;
  if (!mw.config.get("wgIsProbablyEditable"))
    return;
  const searches = ["infobox", "speciesbox", "taxobox", "automatic taxobox", "osm location map", "motorsport season"];
  mw.loader.using(["mediawiki.util", "mediawiki.notification", "jquery.textSelection"], () => {
    const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-navigation" : "p-cactions", "#", "Align template params", "align-params");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (window.wikEd?.useWikEd)
        window.wikEd.UpdateTextarea();
      const editBox = $("#wpTextbox1");
      if (!editBox)
        return mw.notification.notify("Edit box not found, are you in edit mode?", { type: "error", autoHideSeconds: "short" });
      const text = editBox.textSelection("getContents");
      if (!text)
        return mw.notification.notify("Edit box value not found!", { type: "error", autoHideSeconds: "short" });
      let count = 0;
      function processInfobox(template2) {
        if (template2 === "")
          return mw.notification.notify("Infobox not found!", { type: "error", autoHideSeconds: "short" });
        if (open !== 0)
          return mw.notification.notify("Template was not properly closed!", { type: "error", autoHideSeconds: "short" });
        let maxLength = 0;
        const origTemplate = String(template2);
        const lines = template2.split("\n");
        const newLines = [];
        for (const line of lines) {
          const parametersInLine = splitIntoParameters(line.trim());
          for (const parameter of parametersInLine) {
            const line2 = parameter.trim();
            if (!line2.startsWith("|") || line2.split("=").length !== 2) {
              newLines.push(line2);
              continue;
            }
            let [firstPart, lastPart] = splitParameter(line2);
            firstPart = firstPart.slice(1).trim();
            if (firstPart.length > maxLength)
              maxLength = firstPart.length;
            newLines.push("| " + firstPart + "=" + lastPart);
          }
        }
        let output = "";
        maxLength += 2;
        for (let line of newLines) {
          const parts = splitParameter(line);
          if (parts.length < 2) {
            output += line += "\n";
            continue;
          }
          let firstPart = parts[0].trim();
          while (firstPart.length < maxLength)
            firstPart += " ";
          output += firstPart + " = " + parts[1].trim() + "\n";
        }
        if (output.endsWith("\n"))
          output = output.slice(0, -1);
        editBox.textSelection("setContents", editBox.textSelection("getContents").replace(origTemplate, output).replace(/\n+$/, ""));
        if (window.wikEd?.useWikEd)
          window.wikEd.UpdateFrame();
      }
      let template = "";
      let open = 0;
      for (let index = 0; index < text.length; index++) {
        let foo = false;
        for (let search of searches) {
          search = "{{" + search;
          const searchLength = search.length;
          if (text.length - index > searchLength && (text.slice(index, index + searchLength).toLowerCase() === search || text.slice(index, index + searchLength).toLowerCase() === search.replace(" ", "_"))) {
            open++;
            template += text[index];
            foo = true;
          }
        }
        if (open >= 1 && !foo) {
          template += text[index];
          if (text[index] === "{")
            open++;
          else if (text[index] === "}") {
            open--;
            if (open === 0) {
              count++;
              processInfobox(template);
              template = "";
            }
          }
        }
      }
      mw.notification.notify(`Successfully aligned ${count} templates!`, { type: "success", autoHideSeconds: "short" });
    });
  });
})();
function splitParameter(string) {
  const split = string.split("=");
  if (split.length <= 2)
    return split;
  const first = split.shift();
  return [first, split.join("=")];
}
function splitIntoParameters(string) {
  if (string.startsWith("{{") && string.endsWith("}}")) {
    if (!string.includes("|"))
      return [string];
    const results = splitIntoParameters(string.slice(2, -2));
    return ["{{" + results[0], ...splitIntoParameters(string.slice(2, -2)).slice(1), "}}"];
  }
  const parameters = [];
  let temporary = "";
  let open = 0;
  for (const char of string) {
    temporary += char;
    if (char === "{" || char === "[")
      open += 1;
    else if (char === "" || char === "]")
      open--;
    else if (char === "|" && open === 0 && temporary.trim() !== "|") {
      parameters.push(temporary.slice(0, -1).trim());
      temporary = "|";
    }
  }
  parameters.push(temporary);
  return parameters;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9hbGlnbmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG5pbnRlcmZhY2UgV2luZG93IHtcbiAgICB3aWtFZD86IHtcbiAgICAgICAgdXNlV2lrRWQ6IGJvb2xlYW47XG4gICAgICAgIFVwZGF0ZVRleHRhcmVhOiAoKSA9PiB2b2lkOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICAgICAgICBVcGRhdGVGcmFtZTogKCkgPT4gdm9pZDsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgICB9O1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzLCBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbmludGVyZmFjZSBKUXVlcnk8VEVsZW1lbnQgZXh0ZW5kcyBOb2RlID0gSFRNTEVsZW1lbnQ+IGV4dGVuZHMgSXRlcmFibGU8VEVsZW1lbnQ+IHtcbiAgICB0ZXh0U2VsZWN0aW9uKG1ldGhvZE5hbWU6ICdzZXRDb250ZW50cycsIHZhbHVlOiBzdHJpbmcpOiB2b2lkO1xufVxuXG4oKCkgPT4ge1xuICAgIGlmIChtdy5jb25maWcuZ2V0KCd3Z05hbWVzcGFjZU51bWJlcicpIDwgMCkgcmV0dXJuOyAvLyBEb24ndCBydW4gaW4gdmlydHVhbCBuYW1lc3BhY2VzXG4gICAgaWYgKCFtdy5jb25maWcuZ2V0KCd3Z0lzUHJvYmFibHlFZGl0YWJsZScpKSByZXR1cm47IC8vIERvbid0IHJ1biBpZiB1c2VyIGNhbid0IGVkaXQgcGFnZVxuXG4gICAgY29uc3Qgc2VhcmNoZXMgPSBbJ2luZm9ib3gnLCAnc3BlY2llc2JveCcsICd0YXhvYm94JywgJ2F1dG9tYXRpYyB0YXhvYm94JywgJ29zbSBsb2NhdGlvbiBtYXAnLCAnbW90b3JzcG9ydCBzZWFzb24nXTtcblxuICAgIG13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJywgJ21lZGlhd2lraS5ub3RpZmljYXRpb24nLCAnanF1ZXJ5LnRleHRTZWxlY3Rpb24nXSwgKCkgPT4ge1xuICAgICAgICBjb25zdCBsaW5rID0gbXcudXRpbC5hZGRQb3J0bGV0TGluayhtdy5jb25maWcuZ2V0KCdza2luJykgPT09ICdtaW5lcnZhJyA/ICdwLW5hdmlnYXRpb24nIDogJ3AtY2FjdGlvbnMnLCAnIycsICdBbGlnbiB0ZW1wbGF0ZSBwYXJhbXMnLCAnYWxpZ24tcGFyYW1zJyk7XG4gICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmICh3aW5kb3cud2lrRWQ/LnVzZVdpa0VkKSB3aW5kb3cud2lrRWQuVXBkYXRlVGV4dGFyZWEoKTtcblxuICAgICAgICAgICAgY29uc3QgZWRpdEJveCA9ICQoJyN3cFRleHRib3gxJyk7XG5cbiAgICAgICAgICAgIGlmICghZWRpdEJveCkgcmV0dXJuIG13Lm5vdGlmaWNhdGlvbi5ub3RpZnkoJ0VkaXQgYm94IG5vdCBmb3VuZCwgYXJlIHlvdSBpbiBlZGl0IG1vZGU/JywgeyB0eXBlOiAnZXJyb3InLCBhdXRvSGlkZVNlY29uZHM6ICdzaG9ydCcgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHRleHQgPSBlZGl0Qm94LnRleHRTZWxlY3Rpb24oJ2dldENvbnRlbnRzJyk7XG5cbiAgICAgICAgICAgIGlmICghdGV4dCkgcmV0dXJuIG13Lm5vdGlmaWNhdGlvbi5ub3RpZnkoJ0VkaXQgYm94IHZhbHVlIG5vdCBmb3VuZCEnLCB7IHR5cGU6ICdlcnJvcicsIGF1dG9IaWRlU2Vjb25kczogJ3Nob3J0JyB9KTtcblxuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBGaW5pc2hlcyBwcm9jZXNzaW5nIGFuIGluZm9ib3ggYW5kIHVwZGF0ZXMgdGhlIGVkaXQgYm94IGNvbnRlbnRzLlxuICAgICAgICAgICAgICogQHBhcmFtIHRlbXBsYXRlIFRoZSB0ZW1wbGF0ZSBzdHJpbmcgdG8gcHJvY2Vzcy5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgZnVuY3Rpb24gcHJvY2Vzc0luZm9ib3godGVtcGxhdGU6IHN0cmluZykge1xuICAgICAgICAgICAgICAgIGlmICh0ZW1wbGF0ZSA9PT0gJycpIHJldHVybiBtdy5ub3RpZmljYXRpb24ubm90aWZ5KCdJbmZvYm94IG5vdCBmb3VuZCEnLCB7IHR5cGU6ICdlcnJvcicsIGF1dG9IaWRlU2Vjb25kczogJ3Nob3J0JyB9KTtcblxuICAgICAgICAgICAgICAgIGlmIChvcGVuICE9PSAwKSByZXR1cm4gbXcubm90aWZpY2F0aW9uLm5vdGlmeSgnVGVtcGxhdGUgd2FzIG5vdCBwcm9wZXJseSBjbG9zZWQhJywgeyB0eXBlOiAnZXJyb3InLCBhdXRvSGlkZVNlY29uZHM6ICdzaG9ydCcgfSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgbWF4TGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdUZW1wbGF0ZSA9IFN0cmluZyh0ZW1wbGF0ZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSB0ZW1wbGF0ZS5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TGluZXMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJzSW5MaW5lID0gc3BsaXRJbnRvUGFyYW1ldGVycyhsaW5lLnRyaW0oKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBwYXJhbWV0ZXIgb2YgcGFyYW1ldGVyc0luTGluZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IHBhcmFtZXRlci50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnfCcpIHx8IGxpbmUuc3BsaXQoJz0nKS5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMaW5lcy5wdXNoKGxpbmUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgW2ZpcnN0UGFydCwgbGFzdFBhcnRdID0gc3BsaXRQYXJhbWV0ZXIobGluZSkgYXMgW3N0cmluZywgc3RyaW5nXTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBwcmVmZXItY29uc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0UGFydCA9IGZpcnN0UGFydC5zbGljZSgxKS50cmltKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaXJzdFBhcnQubGVuZ3RoID4gbWF4TGVuZ3RoKSBtYXhMZW5ndGggPSBmaXJzdFBhcnQubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdMaW5lcy5wdXNoKCd8ICcgKyBmaXJzdFBhcnQgKyAnPScgKyBsYXN0UGFydCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgb3V0cHV0ID0gJyc7XG5cbiAgICAgICAgICAgICAgICBtYXhMZW5ndGggKz0gMjsgLy8gdG8gaW5jbHVkZSAnfCAnXG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBsaW5lIG9mIG5ld0xpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gc3BsaXRQYXJhbWV0ZXIobGluZSkgYXMgW3N0cmluZywgc3RyaW5nXTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocGFydHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0ICs9IGxpbmUgKz0gJ1xcbic7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaXJzdFBhcnQgPSBwYXJ0c1swXS50cmltKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGZpcnN0UGFydC5sZW5ndGggPCBtYXhMZW5ndGgpIGZpcnN0UGFydCArPSAnICc7XG5cbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ICs9IGZpcnN0UGFydCArICcgPSAnICsgcGFydHNbMV0udHJpbSgpICsgJ1xcbic7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC5lbmRzV2l0aCgnXFxuJykpIG91dHB1dCA9IG91dHB1dC5zbGljZSgwLCAtMSk7XG5cbiAgICAgICAgICAgICAgICBlZGl0Qm94LnRleHRTZWxlY3Rpb24oJ3NldENvbnRlbnRzJywgZWRpdEJveC50ZXh0U2VsZWN0aW9uKCdnZXRDb250ZW50cycpLnJlcGxhY2Uob3JpZ1RlbXBsYXRlLCBvdXRwdXQpLnJlcGxhY2UoL1xcbiskLywgJycpKTtcblxuICAgICAgICAgICAgICAgIGlmICh3aW5kb3cud2lrRWQ/LnVzZVdpa0VkKSB3aW5kb3cud2lrRWQuVXBkYXRlRnJhbWUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHRlbXBsYXRlID0gJyc7XG4gICAgICAgICAgICBsZXQgb3BlbiA9IDA7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0ZXh0Lmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgICAgIGxldCBmb28gPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IHNlYXJjaCBvZiBzZWFyY2hlcykge1xuICAgICAgICAgICAgICAgICAgICBzZWFyY2ggPSAne3snICsgc2VhcmNoO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWFyY2hMZW5ndGggPSBzZWFyY2gubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHQubGVuZ3RoIC0gaW5kZXggPiBzZWFyY2hMZW5ndGggJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICh0ZXh0LnNsaWNlKGluZGV4LCBpbmRleCArIHNlYXJjaExlbmd0aCkudG9Mb3dlckNhc2UoKSA9PT0gc2VhcmNoIHx8IHRleHQuc2xpY2UoaW5kZXgsIGluZGV4ICsgc2VhcmNoTGVuZ3RoKS50b0xvd2VyQ2FzZSgpID09PSBzZWFyY2gucmVwbGFjZSgnICcsICdfJykpXG4gICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3BlbisrO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcGxhdGUgKz0gdGV4dFtpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBmb28gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG9wZW4gPj0gMSAmJiAhZm9vKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlICs9IHRleHRbaW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0W2luZGV4XSA9PT0gJ3snKSBvcGVuKys7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRleHRbaW5kZXhdID09PSAnfScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wZW4tLTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZW4gPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb2Nlc3NJbmZvYm94KHRlbXBsYXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtdy5ub3RpZmljYXRpb24ubm90aWZ5KGBTdWNjZXNzZnVsbHkgYWxpZ25lZCAke2NvdW50fSB0ZW1wbGF0ZXMhYCwgeyB0eXBlOiAnc3VjY2VzcycsIGF1dG9IaWRlU2Vjb25kczogJ3Nob3J0JyB9KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59KSgpO1xuXG4vKipcbiAqIFNwbGl0cyBhIHN0cmluZyBpbnRvIGFuIEFycmF5IGNvbnRhaW5pbmcgdGhlIGtleSBhbmQgdmFsdWUuXG4gKiBAcGFyYW0gc3RyaW5nIFRoZSBmdWxsIHN0cmluZyB0byBzcGxpdC5cbiAqL1xuZnVuY3Rpb24gc3BsaXRQYXJhbWV0ZXIoc3RyaW5nOiBzdHJpbmcpIHtcbiAgICBjb25zdCBzcGxpdCA9IHN0cmluZy5zcGxpdCgnPScpO1xuICAgIGlmIChzcGxpdC5sZW5ndGggPD0gMikgcmV0dXJuIHNwbGl0O1xuXG4gICAgY29uc3QgZmlyc3QgPSBzcGxpdC5zaGlmdCgpO1xuICAgIHJldHVybiBbZmlyc3QsIHNwbGl0LmpvaW4oJz0nKV07XG59XG5cbi8qKlxuICogU3BsaXRzIGEgdGVtcGxhdGUgaW50byBhbiBBcnJheSB3aXRoIGFsbCBwYXJhbWV0ZXJzLlxuICogQHBhcmFtIHN0cmluZyBUaGUgdGVtcGxhdGUgdG8gcHJvY2Vzcy5cbiAqL1xuZnVuY3Rpb24gc3BsaXRJbnRvUGFyYW1ldGVycyhzdHJpbmc6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBpZiAoc3RyaW5nLnN0YXJ0c1dpdGgoJ3t7JykgJiYgc3RyaW5nLmVuZHNXaXRoKCd9fScpKSB7XG4gICAgICAgIGlmICghc3RyaW5nLmluY2x1ZGVzKCd8JykpIHJldHVybiBbc3RyaW5nXTtcblxuICAgICAgICBjb25zdCByZXN1bHRzID0gc3BsaXRJbnRvUGFyYW1ldGVycyhzdHJpbmcuc2xpY2UoMiwgLTIpKTtcbiAgICAgICAgcmV0dXJuIFsne3snICsgcmVzdWx0c1swXSwgLi4uc3BsaXRJbnRvUGFyYW1ldGVycyhzdHJpbmcuc2xpY2UoMiwgLTIpKS5zbGljZSgxKSwgJ319J107XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1ldGVycyA9IFtdO1xuICAgIGxldCB0ZW1wb3JhcnkgPSAnJztcbiAgICBsZXQgb3BlbiA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGNoYXIgb2Ygc3RyaW5nKSB7XG4gICAgICAgIHRlbXBvcmFyeSArPSBjaGFyO1xuXG4gICAgICAgIGlmIChjaGFyID09PSAneycgfHwgY2hhciA9PT0gJ1snKSBvcGVuICs9IDE7XG4gICAgICAgIGVsc2UgaWYgKGNoYXIgPT09ICcnIHx8IGNoYXIgPT09ICddJykgb3Blbi0tO1xuICAgICAgICBlbHNlIGlmIChjaGFyID09PSAnfCcgJiYgb3BlbiA9PT0gMCAmJiB0ZW1wb3JhcnkudHJpbSgpICE9PSAnfCcpIHtcbiAgICAgICAgICAgIHBhcmFtZXRlcnMucHVzaCh0ZW1wb3Jhcnkuc2xpY2UoMCwgLTEpLnRyaW0oKSk7XG4gICAgICAgICAgICB0ZW1wb3JhcnkgPSAnfCc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwYXJhbWV0ZXJzLnB1c2godGVtcG9yYXJ5KTtcblxuICAgIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtDQWNDLE1BQU07QUFDSCxNQUFJLEdBQUcsT0FBTyxJQUFJLG1CQUFtQixJQUFJO0FBQUc7QUFDNUMsTUFBSSxDQUFDLEdBQUcsT0FBTyxJQUFJLHNCQUFzQjtBQUFHO0FBRTVDLFFBQU0sV0FBVyxDQUFDLFdBQVcsY0FBYyxXQUFXLHFCQUFxQixvQkFBb0IsbUJBQW1C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QUFZLEVBQUUsWUFBWSxNQUFNLFVBQVUsS0FBSyxNQUFNLE9BQU8sUUFBUSxZQUFZLEVBQUUsWUFBWSxNQUFNLE9BQU8sUUFBUSxLQUFLLEdBQUcsSUFDeEo7QUFDRTtBQUNBLHdCQUFZLEtBQUssS0FBSztBQUN0QixrQkFBTTtBQUFBLFVBQ1Y7QUFBQSxRQUNKO0FBRUEsWUFBSSxRQUFRLEtBQUssQ0FBQyxLQUFLO0FBQ25CLHNCQUFZLEtBQUssS0FBSztBQUV0QixjQUFJLEtBQUssS0FBSyxNQUFNO0FBQUs7QUFBQSxtQkFDaEIsS0FBSyxLQUFLLE1BQU0sS0FBSztBQUMxQjtBQUVBLGdCQUFJLFNBQVMsR0FBRztBQUNaO0FBQ0EsNkJBQWUsUUFBUTtBQUN2Qix5QkFBVztBQUFBLFlBQ2Y7QUFBQSxVQUNKO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFFQSxTQUFHLGFBQWEsT0FBTyx3QkFBd0IsS0FBSyxlQUFlLEVBQUUsTUFBTSxXQUFXLGlCQUFpQixRQUFRLENBQUM7QUFBQSxJQUNwSCxDQUFDO0FBQUEsRUFDTCxDQUFDO0FBQ0wsR0FBRztBQU1ILFNBQVMsZUFBZSxRQUFnQjtBQUNwQyxRQUFNLFFBQVEsT0FBTyxNQUFNLEdBQUc7QUFDOUIsTUFBSSxNQUFNLFVBQVU7QUFBRyxXQUFPO0FBRTlCLFFBQU0sUUFBUSxNQUFNLE1BQU07QUFDMUIsU0FBTyxDQUFDLE9BQU8sTUFBTSxLQUFLLEdBQUcsQ0FBQztBQUNsQztBQU1BLFNBQVMsb0JBQW9CLFFBQTBCO0FBQ25ELE1BQUksT0FBTyxXQUFXLElBQUksS0FBSyxPQUFPLFNBQVMsSUFBSSxHQUFHO0FBQ2xELFFBQUksQ0FBQyxPQUFPLFNBQVMsR0FBRztBQUFHLGFBQU8sQ0FBQyxNQUFNO0FBRXpDLFVBQU0sVUFBVSxvQkFBb0IsT0FBTyxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ3ZELFdBQU8sQ0FBQyxPQUFPLFFBQVEsQ0FBQyxHQUFHLEdBQUcsb0JBQW9CLE9BQU8sTUFBTSxHQUFHLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLElBQUk7QUFBQSxFQUN6RjtBQUVBLFFBQU0sYUFBYSxDQUFDO0FBQ3BCLE1BQUksWUFBWTtBQUNoQixNQUFJLE9BQU87QUFFWCxhQUFXLFFBQVEsUUFBUTtBQUN2QixpQkFBYTtBQUViLFFBQUksU0FBUyxPQUFPLFNBQVM7QUFBSyxjQUFRO0FBQUEsYUFDakMsU0FBUyxNQUFNLFNBQVM7QUFBSztBQUFBLGFBQzdCLFNBQVMsT0FBTyxTQUFTLEtBQUssVUFBVSxLQUFLLE1BQU0sS0FBSztBQUM3RCxpQkFBVyxLQUFLLFVBQVUsTUFBTSxHQUFHLEVBQUUsRUFBRSxLQUFLLENBQUM7QUFDN0Msa0JBQVk7QUFBQSxJQUNoQjtBQUFBLEVBQ0o7QUFFQSxhQUFXLEtBQUssU0FBUztBQUV6QixTQUFPO0FBQ1g7IiwKICAibmFtZXMiOiBbInRlbXBsYXRlIiwgImxpbmUiXQp9Cg==
