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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9hbGlnbmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzXG5pbnRlcmZhY2UgV2luZG93IHtcbiAgICB3aWtFZD86IHtcbiAgICAgICAgdXNlV2lrRWQ6IGJvb2xlYW47XG4gICAgICAgIFVwZGF0ZVRleHRhcmVhOiAoKSA9PiB2b2lkOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICAgICAgICBVcGRhdGVGcmFtZTogKCkgPT4gdm9pZDsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgICB9O1xufVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXVudXNlZC12YXJzLCBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbmludGVyZmFjZSBKUXVlcnk8VEVsZW1lbnQgZXh0ZW5kcyBOb2RlID0gSFRNTEVsZW1lbnQ+IGV4dGVuZHMgSXRlcmFibGU8VEVsZW1lbnQ+IHtcbiAgICB0ZXh0U2VsZWN0aW9uKG1ldGhvZE5hbWU6ICdzZXRDb250ZW50cycsIHZhbHVlOiBzdHJpbmcpOiB2b2lkO1xufVxuXG4oKCkgPT4ge1xuICAgIGlmIChtdy5jb25maWcuZ2V0KCd3Z05hbWVzcGFjZU51bWJlcicpIDwgMCkgcmV0dXJuOyAvLyBEb24ndCBydW4gaW4gdmlydHVhbCBuYW1lc3BhY2VzXG4gICAgaWYgKCFtdy5jb25maWcuZ2V0KCd3Z0lzUHJvYmFibHlFZGl0YWJsZScpKSByZXR1cm47IC8vIERvbid0IHJ1biBpZiB1c2VyIGNhbid0IGVkaXQgcGFnZVxuXG4gICAgY29uc3Qgc2VhcmNoZXMgPSBbJ2luZm9ib3gnLCAnc3BlY2llc2JveCcsICd0YXhvYm94JywgJ2F1dG9tYXRpYyB0YXhvYm94JywgJ29zbSBsb2NhdGlvbiBtYXAnLCAnbW90b3JzcG9ydCBzZWFzb24nXTtcblxuICAgIG13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJywgJ21lZGlhd2lraS5ub3RpZmljYXRpb24nLCAnanF1ZXJ5LnRleHRTZWxlY3Rpb24nXSwgKCkgPT4ge1xuICAgICAgICBjb25zdCBsaW5rID0gbXcudXRpbC5hZGRQb3J0bGV0TGluayhtdy5jb25maWcuZ2V0KCdza2luJykgPT09ICdtaW5lcnZhJyA/ICdwLW5hdmlnYXRpb24nIDogJ3AtY2FjdGlvbnMnLCAnIycsICdBbGlnbiB0ZW1wbGF0ZSBwYXJhbXMnLCAnYWxpZ24tcGFyYW1zJyk7XG4gICAgICAgIGxpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgIGlmICh3aW5kb3cud2lrRWQ/LnVzZVdpa0VkKSB3aW5kb3cud2lrRWQuVXBkYXRlVGV4dGFyZWEoKTtcblxuICAgICAgICAgICAgY29uc3QgZWRpdEJveCA9ICQoJyN3cFRleHRib3gxJyk7XG5cbiAgICAgICAgICAgIGlmICghZWRpdEJveCkgcmV0dXJuIG13Lm5vdGlmaWNhdGlvbi5ub3RpZnkoJ0VkaXQgYm94IG5vdCBmb3VuZCwgYXJlIHlvdSBpbiBlZGl0IG1vZGU/JywgeyB0eXBlOiAnZXJyb3InLCBhdXRvSGlkZVNlY29uZHM6ICdzaG9ydCcgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHRleHQgPSBlZGl0Qm94LnRleHRTZWxlY3Rpb24oJ2dldENvbnRlbnRzJyk7XG5cbiAgICAgICAgICAgIGlmICghdGV4dCkgcmV0dXJuIG13Lm5vdGlmaWNhdGlvbi5ub3RpZnkoJ0VkaXQgYm94IHZhbHVlIG5vdCBmb3VuZCEnLCB7IHR5cGU6ICdlcnJvcicsIGF1dG9IaWRlU2Vjb25kczogJ3Nob3J0JyB9KTtcblxuICAgICAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBGaW5pc2hlcyBwcm9jZXNzaW5nIGFuIGluZm9ib3ggYW5kIHVwZGF0ZXMgdGhlIGVkaXQgYm94IGNvbnRlbnRzLlxuICAgICAgICAgICAgICogQHBhcmFtIHRlbXBsYXRlIFRoZSB0ZW1wbGF0ZSBzdHJpbmcgdG8gcHJvY2Vzcy5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgZnVuY3Rpb24gcHJvY2Vzc0luZm9ib3godGVtcGxhdGU6IHN0cmluZykge1xuICAgICAgICAgICAgICAgIGlmICh0ZW1wbGF0ZSA9PT0gJycpIHJldHVybiBtdy5ub3RpZmljYXRpb24ubm90aWZ5KCdJbmZvYm94IG5vdCBmb3VuZCEnLCB7IHR5cGU6ICdlcnJvcicsIGF1dG9IaWRlU2Vjb25kczogJ3Nob3J0JyB9KTtcblxuICAgICAgICAgICAgICAgIGlmIChvcGVuICE9PSAwKSByZXR1cm4gbXcubm90aWZpY2F0aW9uLm5vdGlmeSgnVGVtcGxhdGUgd2FzIG5vdCBwcm9wZXJseSBjbG9zZWQhJywgeyB0eXBlOiAnZXJyb3InLCBhdXRvSGlkZVNlY29uZHM6ICdzaG9ydCcgfSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgbWF4TGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdUZW1wbGF0ZSA9IFN0cmluZyh0ZW1wbGF0ZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSB0ZW1wbGF0ZS5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TGluZXMgPSBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJzSW5MaW5lID0gc3BsaXRJbnRvUGFyYW1ldGVycyhsaW5lLnRyaW0oKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBwYXJhbWV0ZXIgb2YgcGFyYW1ldGVyc0luTGluZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IHBhcmFtZXRlci50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnfCcpIHx8IGxpbmUuc3BsaXQoJz0nKS5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdMaW5lcy5wdXNoKGxpbmUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgW2ZpcnN0UGFydCwgbGFzdFBhcnRdID0gc3BsaXRQYXJhbWV0ZXIobGluZSkgYXMgW3N0cmluZywgc3RyaW5nXTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBwcmVmZXItY29uc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0UGFydCA9IGZpcnN0UGFydC5zbGljZSgxKS50cmltKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaXJzdFBhcnQubGVuZ3RoID4gbWF4TGVuZ3RoKSBtYXhMZW5ndGggPSBmaXJzdFBhcnQubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdMaW5lcy5wdXNoKCd8ICcgKyBmaXJzdFBhcnQgKyAnPScgKyBsYXN0UGFydCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgb3V0cHV0ID0gJyc7XG5cbiAgICAgICAgICAgICAgICBtYXhMZW5ndGggKz0gMjsgLy8gdG8gaW5jbHVkZSAnfCAnXG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBsaW5lIG9mIG5ld0xpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gc3BsaXRQYXJhbWV0ZXIobGluZSkgYXMgW3N0cmluZywgc3RyaW5nXTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocGFydHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0ICs9IGxpbmUgKz0gJ1xcbic7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGxldCBmaXJzdFBhcnQgPSBwYXJ0c1swXS50cmltKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGZpcnN0UGFydC5sZW5ndGggPCBtYXhMZW5ndGgpIGZpcnN0UGFydCArPSAnICc7XG5cbiAgICAgICAgICAgICAgICAgICAgb3V0cHV0ICs9IGZpcnN0UGFydCArICcgPSAnICsgcGFydHNbMV0udHJpbSgpICsgJ1xcbic7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG91dHB1dC5lbmRzV2l0aCgnXFxuJykpIG91dHB1dCA9IG91dHB1dC5zbGljZSgwLCAtMSk7XG5cbiAgICAgICAgICAgICAgICBlZGl0Qm94LnRleHRTZWxlY3Rpb24oJ3NldENvbnRlbnRzJywgZWRpdEJveC50ZXh0U2VsZWN0aW9uKCdnZXRDb250ZW50cycpLnJlcGxhY2Uob3JpZ1RlbXBsYXRlLCBvdXRwdXQpLnJlcGxhY2UoL1xcbiskLywgJycpKTtcblxuICAgICAgICAgICAgICAgIGlmICh3aW5kb3cud2lrRWQ/LnVzZVdpa0VkKSB3aW5kb3cud2lrRWQuVXBkYXRlRnJhbWUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHRlbXBsYXRlID0gJyc7XG4gICAgICAgICAgICBsZXQgb3BlbiA9IDA7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0ZXh0Lmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgICAgIGxldCBmb28gPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IHNlYXJjaCBvZiBzZWFyY2hlcykge1xuICAgICAgICAgICAgICAgICAgICBzZWFyY2ggPSAne3snICsgc2VhcmNoO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWFyY2hMZW5ndGggPSBzZWFyY2gubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ZXh0Lmxlbmd0aCAtIGluZGV4ID4gc2VhcmNoTGVuZ3RoICYmICh0ZXh0LnNsaWNlKGluZGV4LCBpbmRleCArIHNlYXJjaExlbmd0aCkudG9Mb3dlckNhc2UoKSA9PT0gc2VhcmNoIHx8IHRleHQuc2xpY2UoaW5kZXgsIGluZGV4ICsgc2VhcmNoTGVuZ3RoKS50b0xvd2VyQ2FzZSgpID09PSBzZWFyY2gucmVwbGFjZSgnICcsICdfJykpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcGVuKys7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZSArPSB0ZXh0W2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3BlbiA+PSAxICYmICFmb28pIHtcbiAgICAgICAgICAgICAgICAgICAgdGVtcGxhdGUgKz0gdGV4dFtpbmRleF07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRleHRbaW5kZXhdID09PSAneycpIG9wZW4rKztcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodGV4dFtpbmRleF0gPT09ICd9Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3Blbi0tO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob3BlbiA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc0luZm9ib3godGVtcGxhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG13Lm5vdGlmaWNhdGlvbi5ub3RpZnkoYFN1Y2Nlc3NmdWxseSBhbGlnbmVkICR7Y291bnR9IHRlbXBsYXRlcyFgLCB7IHR5cGU6ICdzdWNjZXNzJywgYXV0b0hpZGVTZWNvbmRzOiAnc2hvcnQnIH0pO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn0pKCk7XG5cbi8qKlxuICogU3BsaXRzIGEgc3RyaW5nIGludG8gYW4gQXJyYXkgY29udGFpbmluZyB0aGUga2V5IGFuZCB2YWx1ZS5cbiAqIEBwYXJhbSBzdHJpbmcgVGhlIGZ1bGwgc3RyaW5nIHRvIHNwbGl0LlxuICovXG5mdW5jdGlvbiBzcGxpdFBhcmFtZXRlcihzdHJpbmc6IHN0cmluZykge1xuICAgIGNvbnN0IHNwbGl0ID0gc3RyaW5nLnNwbGl0KCc9Jyk7XG4gICAgaWYgKHNwbGl0Lmxlbmd0aCA8PSAyKSByZXR1cm4gc3BsaXQ7XG5cbiAgICBjb25zdCBmaXJzdCA9IHNwbGl0LnNoaWZ0KCk7XG4gICAgcmV0dXJuIFtmaXJzdCwgc3BsaXQuam9pbignPScpXTtcbn1cblxuLyoqXG4gKiBTcGxpdHMgYSB0ZW1wbGF0ZSBpbnRvIGFuIEFycmF5IHdpdGggYWxsIHBhcmFtZXRlcnMuXG4gKiBAcGFyYW0gc3RyaW5nIFRoZSB0ZW1wbGF0ZSB0byBwcm9jZXNzLlxuICovXG5mdW5jdGlvbiBzcGxpdEludG9QYXJhbWV0ZXJzKHN0cmluZzogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIGlmIChzdHJpbmcuc3RhcnRzV2l0aCgne3snKSAmJiBzdHJpbmcuZW5kc1dpdGgoJ319JykpIHtcbiAgICAgICAgaWYgKCFzdHJpbmcuaW5jbHVkZXMoJ3wnKSkgcmV0dXJuIFtzdHJpbmddO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBzcGxpdEludG9QYXJhbWV0ZXJzKHN0cmluZy5zbGljZSgyLCAtMikpO1xuICAgICAgICByZXR1cm4gWyd7eycgKyByZXN1bHRzWzBdLCAuLi5zcGxpdEludG9QYXJhbWV0ZXJzKHN0cmluZy5zbGljZSgyLCAtMikpLnNsaWNlKDEpLCAnfX0nXTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbWV0ZXJzID0gW107XG4gICAgbGV0IHRlbXBvcmFyeSA9ICcnO1xuICAgIGxldCBvcGVuID0gMDtcblxuICAgIGZvciAoY29uc3QgY2hhciBvZiBzdHJpbmcpIHtcbiAgICAgICAgdGVtcG9yYXJ5ICs9IGNoYXI7XG5cbiAgICAgICAgaWYgKGNoYXIgPT09ICd7JyB8fCBjaGFyID09PSAnWycpIG9wZW4gKz0gMTtcbiAgICAgICAgZWxzZSBpZiAoY2hhciA9PT0gJycgfHwgY2hhciA9PT0gJ10nKSBvcGVuLS07XG4gICAgICAgIGVsc2UgaWYgKGNoYXIgPT09ICd8JyAmJiBvcGVuID09PSAwICYmIHRlbXBvcmFyeS50cmltKCkgIT09ICd8Jykge1xuICAgICAgICAgICAgcGFyYW1ldGVycy5wdXNoKHRlbXBvcmFyeS5zbGljZSgwLCAtMSkudHJpbSgpKTtcbiAgICAgICAgICAgIHRlbXBvcmFyeSA9ICd8JztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBhcmFtZXRlcnMucHVzaCh0ZW1wb3JhcnkpO1xuXG4gICAgcmV0dXJuIHBhcmFtZXRlcnM7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0NBY0MsTUFBTTtBQUNILE1BQUksR0FBRyxPQUFPLElBQUksbUJBQW1CLElBQUk7QUFBRztBQUM1QyxNQUFJLENBQUMsR0FBRyxPQUFPLElBQUksc0JBQXNCO0FBQUc7QUFFNUMsUUFBTSxXQUFXLENBQUMsV0FBVyxjQUFjLFdBQVcscUJBQXFCLG9CQUFvQixtQkFBbUI7QUFFbEgsS0FBRyxPQUFPLE1BQU0sQ0FBQyxrQkFBa0IsMEJBQTBCLHNCQUFzQixHQUFHLE1BQU07QUFDeEYsVUFBTSxPQUFP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LEtBQUssR0FBRyxJQUFJO0FBQ2hNO0FBQ0Esd0JBQVksS0FBSyxLQUFLO0FBQ3RCLGtCQUFNO0FBQUEsVUFDVjtBQUFBLFFBQ0o7QUFFQSxZQUFJLFFBQVEsS0FBSyxDQUFDLEtBQUs7QUFDbkIsc0JBQVksS0FBSyxLQUFLO0FBRXRCLGNBQUksS0FBSyxLQUFLLE1BQU07QUFBSztBQUFBLG1CQUNoQixLQUFLLEtBQUssTUFBTSxLQUFLO0FBQzFCO0FBRUEsZ0JBQUksU0FBUyxHQUFHO0FBQ1o7QUFDQSw2QkFBZSxRQUFRO0FBQ3ZCLHlCQUFXO0FBQUEsWUFDZjtBQUFBLFVBQ0o7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUVBLFNBQUcsYUFBYSxPQUFPLHdCQUF3QixLQUFLLGVBQWUsRUFBRSxNQUFNLFdBQVcsaUJBQWlCLFFBQVEsQ0FBQztBQUFBLElBQ3BILENBQUM7QUFBQSxFQUNMLENBQUM7QUFDTCxHQUFHO0FBTUgsU0FBUyxlQUFlLFFBQWdCO0FBQ3BDLFFBQU0sUUFBUSxPQUFPLE1BQU0sR0FBRztBQUM5QixNQUFJLE1BQU0sVUFBVTtBQUFHLFdBQU87QUFFOUIsUUFBTSxRQUFRLE1BQU0sTUFBTTtBQUMxQixTQUFPLENBQUMsT0FBTyxNQUFNLEtBQUssR0FBRyxDQUFDO0FBQ2xDO0FBTUEsU0FBUyxvQkFBb0IsUUFBMEI7QUFDbkQsTUFBSSxPQUFPLFdBQVcsSUFBSSxLQUFLLE9BQU8sU0FBUyxJQUFJLEdBQUc7QUFDbEQsUUFBSSxDQUFDLE9BQU8sU0FBUyxHQUFHO0FBQUcsYUFBTyxDQUFDLE1BQU07QUFFekMsVUFBTSxVQUFVLG9CQUFvQixPQUFPLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDdkQsV0FBTyxDQUFDLE9BQU8sUUFBUSxDQUFDLEdBQUcsR0FBRyxvQkFBb0IsT0FBTyxNQUFNLEdBQUcsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsSUFBSTtBQUFBLEVBQ3pGO0FBRUEsUUFBTSxhQUFhLENBQUM7QUFDcEIsTUFBSSxZQUFZO0FBQ2hCLE1BQUksT0FBTztBQUVYLGFBQVcsUUFBUSxRQUFRO0FBQ3ZCLGlCQUFhO0FBRWIsUUFBSSxTQUFTLE9BQU8sU0FBUztBQUFLLGNBQVE7QUFBQSxhQUNqQyxTQUFTLE1BQU0sU0FBUztBQUFLO0FBQUEsYUFDN0IsU0FBUyxPQUFPLFNBQVMsS0FBSyxVQUFVLEtBQUssTUFBTSxLQUFLO0FBQzdELGlCQUFXLEtBQUssVUFBVSxNQUFNLEdBQUcsRUFBRSxFQUFFLEtBQUssQ0FBQztBQUM3QyxrQkFBWTtBQUFBLElBQ2hCO0FBQUEsRUFDSjtBQUVBLGFBQVcsS0FBSyxTQUFTO0FBRXpCLFNBQU87QUFDWDsiLAogICJuYW1lcyI6IFsidGVtcGxhdGUiLCAibGluZSJdCn0K
