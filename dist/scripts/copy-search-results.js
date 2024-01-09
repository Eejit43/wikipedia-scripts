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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9jb3B5LXNlYXJjaC1yZXN1bHRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJtdy5sb2FkZXIudXNpbmcoWydtZWRpYXdpa2kudXRpbCddLCAoKSA9PiB7XG4gICAgaWYgKG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSAhPT0gJ1NwZWNpYWw6U2VhcmNoJykgcmV0dXJuO1xuXG4gICAgY29uc3QgbGluayA9IG13LnV0aWwuYWRkUG9ydGxldExpbmsobXcuY29uZmlnLmdldCgnc2tpbicpID09PSAnbWluZXJ2YScgPyAncC1uYXZpZ2F0aW9uJyA6ICdwLWNhY3Rpb25zJywgJyMnLCAnQ29weSBzZWFyY2ggcmVzdWx0IHRpdGxlcycsICdjb3B5LXNlYXJjaC1yZXN1bHRzJykhO1xuXG4gICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGNvbnN0IHRpdGxlcyA9IFsuLi5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubXctc2VhcmNoLXJlc3VsdC1oZWFkaW5nIGFbZGF0YS1zZXJwLXBvc10nKV0ubWFwKChlbGVtZW50KSA9PiBlbGVtZW50LnRleHRDb250ZW50KS5qb2luKCdcXG4nKTtcblxuICAgICAgICBpZiAoIXRpdGxlcykgcmV0dXJuIG13Lm5vdGlmeSgnTm8gc2VhcmNoIHJlc3VsdHMgdG8gY29weSEnLCB7IHR5cGU6ICdlcnJvcicgfSk7XG5cbiAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGl0bGVzKS50aGVuKFxuICAgICAgICAgICAgKCkgPT4gbXcubm90aWZ5KCdTdWNjZXNzZnVsbHkgY29waWVkIHNlYXJjaCByZXN1bHRzIHRvIGNsaXBib2FyZCEnLCB7IHR5cGU6ICdzdWNjZXNzJyB9KSxcbiAgICAgICAgICAgICgpID0+IG13Lm5vdGlmeSgnQW4gZXJyb3Igb2NjdXJyZWQgd2hlbiBjb3B5aW5nIHNlYXJjaCByZXN1bHRzIHRvIGNsaXBib2FyZCEnLCB7IHR5cGU6ICdlcnJvcicgfSksXG4gICAgICAgICk7XG4gICAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixHQUFHLE1BQU07QUFDdEMsTUFBSSxHQUFHLE9BQU8sSUFBSSxZQUFZLE1BQU07QUFBa0I7QUFFdEQsUUFBTSxPQUFPLEdBQUcsS0FBSyxlQUFlLEdBQUcsT0FBTyxJQUFJLE1BQU0sTUFBTSxZQUFZLGlCQUFpQixjQUFjLEtBQUssNkJBQTZCLHFCQUFxQjtBQUVoSyxPQUFLLGlCQUFpQixTQUFTLENBQUMsVUFBVTtBQUN0QyxVQUFNLGVBQWU7QUFFckIsVUFBTSxTQUFTLENBQUMsR0FBRyxTQUFTLGlCQUFpQiw0Q0FBNEMsQ0FBQyxFQUFFLElBQUksQ0FBQyxZQUFZLFFBQVEsV0FBVyxFQUFFLEtBQUssSUFBSTtBQUUzSSxRQUFJLENBQUM7QUFBUSxhQUFPLEdBQUcsT0FBTyw4QkFBOEIsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUU3RSxjQUFVLFVBQVUsVUFBVSxNQUFNLEVBQUU7QUFBQSxNQUNsQyxNQUFNLEdBQUcsT0FBTyxvREFBb0QsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUFBLE1BQ3ZGLE1BQU0sR0FBRyxPQUFPLCtEQUErRCxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQUEsSUFDcEc7QUFBQSxFQUNKLENBQUM7QUFDTCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
