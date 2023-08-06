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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9jb3B5LXNlYXJjaC1yZXN1bHRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJtdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSAhPT0gJ1NwZWNpYWw6U2VhcmNoJykgcmV0dXJuO1xuXG4gICAgY29uc3QgbGluayA9IG13LnV0aWwuYWRkUG9ydGxldExpbmsobXcuY29uZmlnLmdldCgnc2tpbicpID09PSAnbWluZXJ2YScgPyAncC1uYXZpZ2F0aW9uJyA6ICdwLWNhY3Rpb25zJywgJyMnLCAnQ29weSBzZWFyY2ggcmVzdWx0IHRpdGxlcycsICdjb3B5LXNlYXJjaC1yZXN1bHRzJyk7XG5cbiAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgY29uc3QgdGl0bGVzID0gWy4uLmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5tdy1zZWFyY2gtcmVzdWx0LWhlYWRpbmcgYVtkYXRhLXNlcnAtcG9zXScpXS5tYXAoKGVsZW1lbnQpID0+IGVsZW1lbnQudGV4dENvbnRlbnQpLmpvaW4oJ1xcbicpO1xuXG4gICAgICAgIGlmICghdGl0bGVzKSByZXR1cm4gbXcubm90aWZ5KCdObyBzZWFyY2ggcmVzdWx0cyB0byBjb3B5IScsIHsgdHlwZTogJ2Vycm9yJyB9KTtcblxuICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0aXRsZXMpLnRoZW4oXG4gICAgICAgICAgICAoKSA9PiBtdy5ub3RpZnkoJ1N1Y2Nlc3NmdWxseSBjb3BpZWQgc2VhcmNoIHJlc3VsdHMgdG8gY2xpcGJvYXJkIScsIHsgdHlwZTogJ3N1Y2Nlc3MnIH0pLFxuICAgICAgICAgICAgKCkgPT4gbXcubm90aWZ5KCdBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGNvcHlpbmcgc2VhcmNoIHJlc3VsdHMgdG8gY2xpcGJvYXJkIScsIHsgdHlwZTogJ2Vycm9yJyB9KSxcbiAgICAgICAgKTtcbiAgICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLEdBQUcsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsTUFBTTtBQUN0QyxNQUFJLEdBQUcsT0FBTyxJQUFJLFlBQVksTUFBTTtBQUFrQjtBQUV0RCxRQUFNLE9BQU8sR0FBRyxLQUFLLGVBQWUsR0FBRyxPQUFPLElBQUksTUFBTSxNQUFNLFlBQVksaUJBQWlCLGNBQWMsS0FBSyw2QkFBNkIscUJBQXFCO0FBRWhLLE9BQUssaUJBQWlCLFNBQVMsQ0FBQyxVQUFVO0FBQ3RDLFVBQU0sZUFBZTtBQUVyQixVQUFNLFNBQVMsQ0FBQyxHQUFHLFNBQVMsaUJBQWlCLDRDQUE0QyxDQUFDLEVBQUUsSUFBSSxDQUFDLFlBQVksUUFBUSxXQUFXLEVBQUUsS0FBSyxJQUFJO0FBRTNJLFFBQUksQ0FBQztBQUFRLGFBQU8sR0FBRyxPQUFPLDhCQUE4QixFQUFFLE1BQU0sUUFBUSxDQUFDO0FBRTdFLGNBQVUsVUFBVSxVQUFVLE1BQU0sRUFBRTtBQUFBLE1BQ2xDLE1BQU0sR0FBRyxPQUFPLG9EQUFvRCxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQUEsTUFDdkYsTUFBTSxHQUFHLE9BQU8sK0RBQStELEVBQUUsTUFBTSxRQUFRLENBQUM7QUFBQSxJQUNwRztBQUFBLEVBQ0osQ0FBQztBQUNMLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
