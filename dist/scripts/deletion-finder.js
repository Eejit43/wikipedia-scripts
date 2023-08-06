"use strict";
mw.loader.using(["mediawiki.util"], async () => {
  if (mw.config.get("wgNamespaceNumber") !== 0)
    return;
  if (mw.config.get("wgAction") !== "view")
    return;
  if (mw.config.get("wgPageName") === "Main_Page")
    return;
  mw.util.addCSS(`
#deletion-finder-previously-deleted {
    color: #dd3333;
    display: inline-block;
    font-size: 12px;
    margin-left: 5px;
}

#deletion-finder-previously-deleted::before {
    content: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22%23dd3333%22 viewBox=%220 0 20 20%22%3E%3Ctitle%3E trash %3C/title%3E%3Cpath d=%22M17 2h-3.5l-1-1h-5l-1 1H3v2h14zM4 17a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5H4z%22/%3E%3C/svg%3E");
    display: inline-block;
    margin-right: 3px;
    transform: translateY(2px);
}

#deletion-finder-previous-afd {
    color: #3366cc;
    display: inline-block;
    font-size: 12px;
    margin-left: 5px;
}

#deletion-finder-previous-afd::before {
    content: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2215%22 height=%2215%22 fill=%22%233366cc%22 viewBox=%220 0 20 20%22%3E%3Ctitle%3E info %3C/title%3E%3Cpath d=%22M4 10a6 6 0 1 0 12 0 6 6 0 0 0-12 0m6-8a8 8 0 1 1 0 16 8 8 0 0 1 0-16m1 7v5H9V9zm0-1V6H9v2z%22/%3E%3C/svg%3E");
    display: inline-block;
    margin-right: 3px;
    transform: translateY(2px);
}
`);
  const titleElement = document.querySelector("#firstHeading");
  if (!titleElement)
    return mw.notify("Could not find title element", { type: "error" });
  const deletionResult = await new mw.Api().get({
    action: "query",
    leaction: "delete/delete",
    lelimit: "1",
    letitle: mw.config.get("wgPageName"),
    list: "logevents"
  });
  if (deletionResult.query.logevents.length > 0) {
    const link = document.createElement("a");
    link.id = "deletion-finder-previously-deleted";
    link.href = mw.util.getUrl("Special:Log/delete", { page: mw.config.get("wgPageName").replaceAll("_", " "), subtype: "delete" });
    link.target = "_blank";
    link.textContent = "Previously deleted";
    titleElement.append(link);
  }
  const afdExists = await new mw.Api().get({ action: "query", formatversion: 2, titles: `Wikipedia:Articles_for_deletion/${mw.config.get("wgPageName")}` });
  if (!afdExists.query.pages[0].missing) {
    const link = document.createElement("a");
    link.id = "deletion-finder-previous-afd";
    link.href = mw.util.getUrl("Special:AllPages", {
      from: `Articles for deletion/${mw.config.get("wgPageName").replaceAll("_", " ")}`,
      to: `Articles for deletion/${mw.config.get("wgPageName").replaceAll("_", " ")} (9z)`,
      namespace: "4"
    });
    link.target = "_blank";
    link.textContent = "Previously at AfD";
    titleElement.append(link);
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9kZWxldGlvbi1maW5kZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sIGFzeW5jICgpID0+IHtcbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dOYW1lc3BhY2VOdW1iZXInKSAhPT0gMCkgcmV0dXJuO1xuICAgIGlmIChtdy5jb25maWcuZ2V0KCd3Z0FjdGlvbicpICE9PSAndmlldycpIHJldHVybjtcbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpID09PSAnTWFpbl9QYWdlJykgcmV0dXJuO1xuXG4gICAgbXcudXRpbC5hZGRDU1MoYFxuI2RlbGV0aW9uLWZpbmRlci1wcmV2aW91c2x5LWRlbGV0ZWQge1xuICAgIGNvbG9yOiAjZGQzMzMzO1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICBmb250LXNpemU6IDEycHg7XG4gICAgbWFyZ2luLWxlZnQ6IDVweDtcbn1cblxuI2RlbGV0aW9uLWZpbmRlci1wcmV2aW91c2x5LWRlbGV0ZWQ6OmJlZm9yZSB7XG4gICAgY29udGVudDogdXJsKFwiZGF0YTppbWFnZS9zdmcreG1sLCUzQ3N2ZyB4bWxucz0lMjJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyUyMiB3aWR0aD0lMjIxMiUyMiBoZWlnaHQ9JTIyMTIlMjIgZmlsbD0lMjIlMjNkZDMzMzMlMjIgdmlld0JveD0lMjIwIDAgMjAgMjAlMjIlM0UlM0N0aXRsZSUzRSB0cmFzaCAlM0MvdGl0bGUlM0UlM0NwYXRoIGQ9JTIyTTE3IDJoLTMuNWwtMS0xaC01bC0xIDFIM3YyaDE0ek00IDE3YTIgMiAwIDAgMCAyIDJoOGEyIDIgMCAwIDAgMi0yVjVINHolMjIvJTNFJTNDL3N2ZyUzRVwiKTtcbiAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgbWFyZ2luLXJpZ2h0OiAzcHg7XG4gICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDJweCk7XG59XG5cbiNkZWxldGlvbi1maW5kZXItcHJldmlvdXMtYWZkIHtcbiAgICBjb2xvcjogIzMzNjZjYztcbiAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgZm9udC1zaXplOiAxMnB4O1xuICAgIG1hcmdpbi1sZWZ0OiA1cHg7XG59XG5cbiNkZWxldGlvbi1maW5kZXItcHJldmlvdXMtYWZkOjpiZWZvcmUge1xuICAgIGNvbnRlbnQ6IHVybChcImRhdGE6aW1hZ2Uvc3ZnK3htbCwlM0NzdmcgeG1sbnM9JTIyaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmclMjIgd2lkdGg9JTIyMTUlMjIgaGVpZ2h0PSUyMjE1JTIyIGZpbGw9JTIyJTIzMzM2NmNjJTIyIHZpZXdCb3g9JTIyMCAwIDIwIDIwJTIyJTNFJTNDdGl0bGUlM0UgaW5mbyAlM0MvdGl0bGUlM0UlM0NwYXRoIGQ9JTIyTTQgMTBhNiA2IDAgMSAwIDEyIDAgNiA2IDAgMCAwLTEyIDBtNi04YTggOCAwIDEgMSAwIDE2IDggOCAwIDAgMSAwLTE2bTEgN3Y1SDlWOXptMC0xVjZIOXYyeiUyMi8lM0UlM0Mvc3ZnJTNFXCIpO1xuICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICBtYXJnaW4tcmlnaHQ6IDNweDtcbiAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMnB4KTtcbn1cbmApO1xuICAgIGNvbnN0IHRpdGxlRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNmaXJzdEhlYWRpbmcnKTtcblxuICAgIGlmICghdGl0bGVFbGVtZW50KSByZXR1cm4gbXcubm90aWZ5KCdDb3VsZCBub3QgZmluZCB0aXRsZSBlbGVtZW50JywgeyB0eXBlOiAnZXJyb3InIH0pO1xuXG4gICAgY29uc3QgZGVsZXRpb25SZXN1bHQgPSAoYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7XG4gICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgbGVhY3Rpb246ICdkZWxldGUvZGVsZXRlJyxcbiAgICAgICAgbGVsaW1pdDogJzEnLFxuICAgICAgICBsZXRpdGxlOiBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksXG4gICAgICAgIGxpc3Q6ICdsb2dldmVudHMnLFxuICAgIH0pKSBhcyB7IHF1ZXJ5OiB7IGxvZ2V2ZW50czogW10gfSB9O1xuXG4gICAgaWYgKGRlbGV0aW9uUmVzdWx0LnF1ZXJ5LmxvZ2V2ZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGxpbmsuaWQgPSAnZGVsZXRpb24tZmluZGVyLXByZXZpb3VzbHktZGVsZXRlZCc7XG4gICAgICAgIGxpbmsuaHJlZiA9IG13LnV0aWwuZ2V0VXJsKCdTcGVjaWFsOkxvZy9kZWxldGUnLCB7IHBhZ2U6IG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKS5yZXBsYWNlQWxsKCdfJywgJyAnKSwgc3VidHlwZTogJ2RlbGV0ZScgfSk7XG4gICAgICAgIGxpbmsudGFyZ2V0ID0gJ19ibGFuayc7XG4gICAgICAgIGxpbmsudGV4dENvbnRlbnQgPSAnUHJldmlvdXNseSBkZWxldGVkJztcblxuICAgICAgICB0aXRsZUVsZW1lbnQuYXBwZW5kKGxpbmspO1xuICAgIH1cblxuICAgIGNvbnN0IGFmZEV4aXN0cyA9IChhd2FpdCBuZXcgbXcuQXBpKCkuZ2V0KHsgYWN0aW9uOiAncXVlcnknLCBmb3JtYXR2ZXJzaW9uOiAyLCB0aXRsZXM6IGBXaWtpcGVkaWE6QXJ0aWNsZXNfZm9yX2RlbGV0aW9uLyR7bXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpfWAgfSkpIGFzIHtcbiAgICAgICAgcXVlcnk6IHsgcGFnZXM6IHsgbWlzc2luZz86IHRydWUgfVtdIH07XG4gICAgfTtcblxuICAgIGlmICghYWZkRXhpc3RzLnF1ZXJ5LnBhZ2VzWzBdLm1pc3NpbmcpIHtcbiAgICAgICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgbGluay5pZCA9ICdkZWxldGlvbi1maW5kZXItcHJldmlvdXMtYWZkJztcbiAgICAgICAgbGluay5ocmVmID0gbXcudXRpbC5nZXRVcmwoJ1NwZWNpYWw6QWxsUGFnZXMnLCB7XG4gICAgICAgICAgICBmcm9tOiBgQXJ0aWNsZXMgZm9yIGRlbGV0aW9uLyR7bXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpLnJlcGxhY2VBbGwoJ18nLCAnICcpfWAsXG4gICAgICAgICAgICB0bzogYEFydGljbGVzIGZvciBkZWxldGlvbi8ke213LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKS5yZXBsYWNlQWxsKCdfJywgJyAnKX0gKDl6KWAsXG4gICAgICAgICAgICBuYW1lc3BhY2U6ICc0JyxcbiAgICAgICAgfSk7XG4gICAgICAgIGxpbmsudGFyZ2V0ID0gJ19ibGFuayc7XG4gICAgICAgIGxpbmsudGV4dENvbnRlbnQgPSAnUHJldmlvdXNseSBhdCBBZkQnO1xuXG4gICAgICAgIHRpdGxlRWxlbWVudC5hcHBlbmQobGluayk7XG4gICAgfVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsR0FBRyxPQUFPLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxZQUFZO0FBQzVDLE1BQUksR0FBRyxPQUFPLElBQUksbUJBQW1CLE1BQU07QUFBRztBQUM5QyxNQUFJLEdBQUcsT0FBTyxJQUFJLFVBQVUsTUFBTTtBQUFRO0FBQzFDLE1BQUksR0FBRyxPQUFPLElBQUksWUFBWSxNQUFNO0FBQWE7QUFFakQsS0FBRyxLQUFLLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxDQTRCbEI7QUFDRyxRQUFNLGVBQWUsU0FBUyxjQUFjLGVBQWU7QUFFM0QsTUFBSSxDQUFDO0FBQWMsV0FBTyxHQUFHLE9BQU8sZ0NBQWdDLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFckYsUUFBTSxpQkFBa0IsTUFBTSxJQUFJLEdBQUcsSUFBSSxFQUFFLElBQUk7QUFBQSxJQUMzQyxRQUFRO0FBQUEsSUFDUixVQUFVO0FBQUEsSUFDVixTQUFTO0FBQUEsSUFDVCxTQUFTLEdBQUcsT0FBTyxJQUFJLFlBQVk7QUFBQSxJQUNuQyxNQUFNO0FBQUEsRUFDVixDQUFDO0FBRUQsTUFBSSxlQUFlLE1BQU0sVUFBVSxTQUFTLEdBQUc7QUFDM0MsVUFBTSxPQUFPLFNBQVMsY0FBYyxHQUFHO0FBQ3ZDLFNBQUssS0FBSztBQUNWLFNBQUssT0FBTyxHQUFHLEtBQUssT0FBTyxzQkFBc0IsRUFBRSxNQUFNLEdBQUcsT0FBTyxJQUFJLFlBQVksRUFBRSxXQUFXLEtBQUssR0FBRyxHQUFHLFNBQVMsU0FBUyxDQUFDO0FBQzlILFNBQUssU0FBUztBQUNkLFNBQUssY0FBYztBQUVuQixpQkFBYSxPQUFPLElBQUk7QUFBQSxFQUM1QjtBQUVBLFFBQU0sWUFBYSxNQUFNLElBQUksR0FBRyxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsU0FBUyxlQUFlLEdBQUcsUUFBUSxtQ0FBbUMsR0FBRyxPQUFPLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQztBQUl6SixNQUFJLENBQUMsVUFBVSxNQUFNLE1BQU0sQ0FBQyxFQUFFLFNBQVM7QUFDbkMsVUFBTSxPQUFPLFNBQVMsY0FBYyxHQUFHO0FBQ3ZDLFNBQUssS0FBSztBQUNWLFNBQUssT0FBTyxHQUFHLEtBQUssT0FBTyxvQkFBb0I7QUFBQSxNQUMzQyxNQUFNLHlCQUF5QixHQUFHLE9BQU8sSUFBSSxZQUFZLEVBQUUsV0FBVyxLQUFLLEdBQUcsQ0FBQztBQUFBLE1BQy9FLElBQUkseUJBQXlCLEdBQUcsT0FBTyxJQUFJLFlBQVksRUFBRSxXQUFXLEtBQUssR0FBRyxDQUFDO0FBQUEsTUFDN0UsV0FBVztBQUFBLElBQ2YsQ0FBQztBQUNELFNBQUssU0FBUztBQUNkLFNBQUssY0FBYztBQUVuQixpQkFBYSxPQUFPLElBQUk7QUFBQSxFQUM1QjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
