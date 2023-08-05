"use strict";
if (mw.config.get("wgCanonicalSpecialPageName") === "Search")
  for (const header of document.querySelectorAll(".mw-search-result-heading")) {
    const link = header.querySelector("a")?.href;
    if (!link)
      continue;
    const links = ["edit", "history"].map((action) => {
      const url = new mw.Uri(link).extend({ action }).toString();
      const linkElement = document.createElement("a");
      linkElement.href = url;
      linkElement.textContent = action;
      return linkElement;
    });
    header.append(
      document.createTextNode(" ("),
      ...links.flatMap((link2) => [link2, document.createTextNode(" | ")]).slice(0, -1),
      document.createTextNode(")")
    );
  }
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9zZWFyY2gtbGlua3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImlmIChtdy5jb25maWcuZ2V0KCd3Z0Nhbm9uaWNhbFNwZWNpYWxQYWdlTmFtZScpID09PSAnU2VhcmNoJylcbiAgICBmb3IgKGNvbnN0IGhlYWRlciBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubXctc2VhcmNoLXJlc3VsdC1oZWFkaW5nJykpIHtcbiAgICAgICAgY29uc3QgbGluayA9IGhlYWRlci5xdWVyeVNlbGVjdG9yKCdhJyk/LmhyZWY7XG4gICAgICAgIGlmICghbGluaykgY29udGludWU7XG5cbiAgICAgICAgY29uc3QgbGlua3MgPSBbJ2VkaXQnLCAnaGlzdG9yeSddLm1hcCgoYWN0aW9uKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBuZXcgbXcuVXJpKGxpbmspLmV4dGVuZCh7IGFjdGlvbiB9KS50b1N0cmluZygpO1xuICAgICAgICAgICAgY29uc3QgbGlua0VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgICAgICBsaW5rRWxlbWVudC5ocmVmID0gdXJsO1xuICAgICAgICAgICAgbGlua0VsZW1lbnQudGV4dENvbnRlbnQgPSBhY3Rpb247XG5cbiAgICAgICAgICAgIHJldHVybiBsaW5rRWxlbWVudDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaGVhZGVyLmFwcGVuZChcbiAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgKCcpLCAvL1xuICAgICAgICAgICAgLi4ubGlua3MuZmxhdE1hcCgobGluaykgPT4gW2xpbmssIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgfCAnKV0pLnNsaWNlKDAsIC0xKSxcbiAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcpJylcbiAgICAgICAgKTtcbiAgICB9XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsSUFBSSxHQUFHLE9BQU8sSUFBSSw0QkFBNEIsTUFBTTtBQUNoRCxhQUFXLFVBQVUsU0FBUyxpQkFBaUIsMkJBQTJCLEdBQUc7QUFDekUsVUFBTSxPQUFPLE9BQU8sY0FBYyxHQUFHLEdBQUc7QUFDeEMsUUFBSSxDQUFDO0FBQU07QUFFWCxVQUFNLFFBQVEsQ0FBQyxRQUFRLFNBQVMsRUFBRSxJQUFJLENBQUMsV0FBVztBQUM5QyxZQUFNLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxTQUFTO0FBQ3pELFlBQU0sY0FBYyxTQUFTLGNBQWMsR0FBRztBQUM5QyxrQkFBWSxPQUFPO0FBQ25CLGtCQUFZLGNBQWM7QUFFMUIsYUFBTztBQUFBLElBQ1gsQ0FBQztBQUVELFdBQU87QUFBQSxNQUNILFNBQVMsZUFBZSxJQUFJO0FBQUEsTUFDNUIsR0FBRyxNQUFNLFFBQVEsQ0FBQ0EsVUFBUyxDQUFDQSxPQUFNLFNBQVMsZUFBZSxLQUFLLENBQUMsQ0FBQyxFQUFFLE1BQU0sR0FBRyxFQUFFO0FBQUEsTUFDOUUsU0FBUyxlQUFlLEdBQUc7QUFBQSxJQUMvQjtBQUFBLEVBQ0o7IiwKICAibmFtZXMiOiBbImxpbmsiXQp9Cg==
