"use strict";
mw.loader.using(["mediawiki.util"], () => {
  if (mw.config.get("wgPageName") !== "Special:Search")
    return;
  const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-navigation" : "p-cactions", "#", "Copy search result titles", "copy-search-results");
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const titles = [...document.querySelectorAll(".mw-search-result-heading a[data-serp-pos]")].map((element) => element.textContent).join("\n");
    if (!titles)
      return mw.notify("No search results to copy!", { type: "error" });
    navigator.clipboard.writeText(titles).then(
      () => mw.notify("Successfully copied search results to clipboard!", { type: "success" }),
      () => mw.notify("An error occurred when copying search results to clipboard!", { type: "error" })
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9jb3B5LXNlYXJjaC1yZXN1bHRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJtdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSAhPT0gJ1NwZWNpYWw6U2VhcmNoJykgcmV0dXJuO1xuXG4gICAgY29uc3QgbGluayA9IG13LnV0aWwuYWRkUG9ydGxldExpbmsobXcuY29uZmlnLmdldCgnc2tpbicpID09PSAnbWluZXJ2YScgPyAncC1uYXZpZ2F0aW9uJyA6ICdwLWNhY3Rpb25zJywgJyMnLCAnQ29weSBzZWFyY2ggcmVzdWx0IHRpdGxlcycsICdjb3B5LXNlYXJjaC1yZXN1bHRzJyk7XG5cbiAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgY29uc3QgdGl0bGVzID0gWy4uLmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5tdy1zZWFyY2gtcmVzdWx0LWhlYWRpbmcgYVtkYXRhLXNlcnAtcG9zXScpXS5tYXAoKGVsZW1lbnQpID0+IGVsZW1lbnQudGV4dENvbnRlbnQpLmpvaW4oJ1xcbicpO1xuXG4gICAgICAgIGlmICghdGl0bGVzKSByZXR1cm4gbXcubm90aWZ5KCdObyBzZWFyY2ggcmVzdWx0cyB0byBjb3B5IScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0aXRsZXMpLnRoZW4oXG4gICAgICAgICAgICAoKSA9PiBtdy5ub3RpZnkoJ1N1Y2Nlc3NmdWxseSBjb3BpZWQgc2VhcmNoIHJlc3VsdHMgdG8gY2xpcGJvYXJkIScsIHsgdHlwZTogJ3N1Y2Nlc3MnIH0pLFxuICAgICAgICAgICAgKCkgPT4gbXcubm90aWZ5KCdBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGNvcHlpbmcgc2VhcmNoIHJlc3VsdHMgdG8gY2xpcGJvYXJkIScsIHsgdHlwZTogJ2Vycm9yJyB9KVxuICAgICAgICApO1xuICAgIH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsR0FBRyxPQUFPLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNO0FBQ3RDLE1BQUksR0FBRyxPQUFPLElBQUksWUFBWSxNQUFNO0FBQWtCO0FBRXRELFFBQU0sT0FBTyxHQUFHLEtBQUssZUFBZSxHQUFHLE9BQU8sSUFBSSxNQUFNLE1BQU0sWUFBWSxpQkFBaUIsY0FBYyxLQUFLLDZCQUE2QixxQkFBcUI7QUFFaEssT0FBSyxpQkFBaUIsU0FBUyxDQUFDLFVBQVU7QUFDdEMsVUFBTSxlQUFlO0FBRXJCLFVBQU0sU0FBUyxDQUFDLEdBQUcsU0FBUyxpQkFBaUIsNENBQTRDLENBQUMsRUFBRSxJQUFJLENBQUMsWUFBWSxRQUFRLFdBQVcsRUFBRSxLQUFLLElBQUk7QUFFM0ksUUFBSSxDQUFDO0FBQVEsYUFBTyxHQUFHLE9BQU8sOEJBQThCLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFN0UsY0FBVSxVQUFVLFVBQVUsTUFBTSxFQUFFO0FBQUEsTUFDbEMsTUFBTSxHQUFHLE9BQU8sb0RBQW9ELEVBQUUsTUFBTSxVQUFVLENBQUM7QUFBQSxNQUN2RixNQUFNLEdBQUcsT0FBTywrREFBK0QsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUFBLElBQ3BHO0FBQUEsRUFDSixDQUFDO0FBQ0wsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
