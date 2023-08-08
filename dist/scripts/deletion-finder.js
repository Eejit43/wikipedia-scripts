"use strict";
mw.loader.using(["mediawiki.util"], async () => {
  if (mw.config.get("wgNamespaceNumber") !== 0)
    return;
  if (mw.config.get("wgAction") !== "view")
    return;
  if (mw.config.get("wgPageName") === "Main_Page")
    return;
  mw.util.addCSS(`
.deletion-finder-link {
    display: inline-block;
    margin-left: 5px;
    font-size: 12px;
}

.deletion-finder-link::before {
    display: inline-block;
    transform: translateY(2px);
    margin-right: 3px;
}

#deletion-finder-previously-deleted {
    color: #dd3333;
}

#deletion-finder-previously-deleted::before {
    content: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22%23dd3333%22 viewBox=%220 0 20 20%22%3E%3Ctitle%3E trash %3C/title%3E%3Cpath d=%22M17 2h-3.5l-1-1h-5l-1 1H3v2h14zM4 17a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5H4z%22/%3E%3C/svg%3E");
}

#deletion-finder-previous-afd {
    color: #3366cc;
}

#deletion-finder-previous-afd::before {
    content: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2215%22 height=%2215%22 fill=%22%233366cc%22 viewBox=%220 0 20 20%22%3E%3Ctitle%3E info %3C/title%3E%3Cpath d=%22M4 10a6 6 0 1 0 12 0 6 6 0 0 0-12 0m6-8a8 8 0 1 1 0 16 8 8 0 0 1 0-16m1 7v5H9V9zm0-1V6H9v2z%22/%3E%3C/svg%3E");
}`);
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
    link.classList.add("deletion-finder-link");
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9kZWxldGlvbi1maW5kZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sIGFzeW5jICgpID0+IHtcbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dOYW1lc3BhY2VOdW1iZXInKSAhPT0gMCkgcmV0dXJuO1xuICAgIGlmIChtdy5jb25maWcuZ2V0KCd3Z0FjdGlvbicpICE9PSAndmlldycpIHJldHVybjtcbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpID09PSAnTWFpbl9QYWdlJykgcmV0dXJuO1xuXG4gICAgbXcudXRpbC5hZGRDU1MoYFxuLmRlbGV0aW9uLWZpbmRlci1saW5rIHtcbiAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgbWFyZ2luLWxlZnQ6IDVweDtcbiAgICBmb250LXNpemU6IDEycHg7XG59XG5cbi5kZWxldGlvbi1maW5kZXItbGluazo6YmVmb3JlIHtcbiAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG4gICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDJweCk7XG4gICAgbWFyZ2luLXJpZ2h0OiAzcHg7XG59XG5cbiNkZWxldGlvbi1maW5kZXItcHJldmlvdXNseS1kZWxldGVkIHtcbiAgICBjb2xvcjogI2RkMzMzMztcbn1cblxuI2RlbGV0aW9uLWZpbmRlci1wcmV2aW91c2x5LWRlbGV0ZWQ6OmJlZm9yZSB7XG4gICAgY29udGVudDogdXJsKFwiZGF0YTppbWFnZS9zdmcreG1sLCUzQ3N2ZyB4bWxucz0lMjJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyUyMiB3aWR0aD0lMjIxMiUyMiBoZWlnaHQ9JTIyMTIlMjIgZmlsbD0lMjIlMjNkZDMzMzMlMjIgdmlld0JveD0lMjIwIDAgMjAgMjAlMjIlM0UlM0N0aXRsZSUzRSB0cmFzaCAlM0MvdGl0bGUlM0UlM0NwYXRoIGQ9JTIyTTE3IDJoLTMuNWwtMS0xaC01bC0xIDFIM3YyaDE0ek00IDE3YTIgMiAwIDAgMCAyIDJoOGEyIDIgMCAwIDAgMi0yVjVINHolMjIvJTNFJTNDL3N2ZyUzRVwiKTtcbn1cblxuI2RlbGV0aW9uLWZpbmRlci1wcmV2aW91cy1hZmQge1xuICAgIGNvbG9yOiAjMzM2NmNjO1xufVxuXG4jZGVsZXRpb24tZmluZGVyLXByZXZpb3VzLWFmZDo6YmVmb3JlIHtcbiAgICBjb250ZW50OiB1cmwoXCJkYXRhOmltYWdlL3N2Zyt4bWwsJTNDc3ZnIHhtbG5zPSUyMmh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJTIyIHdpZHRoPSUyMjE1JTIyIGhlaWdodD0lMjIxNSUyMiBmaWxsPSUyMiUyMzMzNjZjYyUyMiB2aWV3Qm94PSUyMjAgMCAyMCAyMCUyMiUzRSUzQ3RpdGxlJTNFIGluZm8gJTNDL3RpdGxlJTNFJTNDcGF0aCBkPSUyMk00IDEwYTYgNiAwIDEgMCAxMiAwIDYgNiAwIDAgMC0xMiAwbTYtOGE4IDggMCAxIDEgMCAxNiA4IDggMCAwIDEgMC0xNm0xIDd2NUg5Vjl6bTAtMVY2SDl2MnolMjIvJTNFJTNDL3N2ZyUzRVwiKTtcbn1gKTtcblxuICAgIGNvbnN0IHRpdGxlRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNmaXJzdEhlYWRpbmcnKTtcblxuICAgIGlmICghdGl0bGVFbGVtZW50KSByZXR1cm4gbXcubm90aWZ5KCdDb3VsZCBub3QgZmluZCB0aXRsZSBlbGVtZW50JywgeyB0eXBlOiAnZXJyb3InIH0pO1xuXG4gICAgY29uc3QgZGVsZXRpb25SZXN1bHQgPSAoYXdhaXQgbmV3IG13LkFwaSgpLmdldCh7XG4gICAgICAgIGFjdGlvbjogJ3F1ZXJ5JyxcbiAgICAgICAgbGVhY3Rpb246ICdkZWxldGUvZGVsZXRlJyxcbiAgICAgICAgbGVsaW1pdDogJzEnLFxuICAgICAgICBsZXRpdGxlOiBtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksXG4gICAgICAgIGxpc3Q6ICdsb2dldmVudHMnLFxuICAgIH0pKSBhcyB7IHF1ZXJ5OiB7IGxvZ2V2ZW50czogW10gfSB9O1xuXG4gICAgaWYgKGRlbGV0aW9uUmVzdWx0LnF1ZXJ5LmxvZ2V2ZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGxpbmsuaWQgPSAnZGVsZXRpb24tZmluZGVyLXByZXZpb3VzbHktZGVsZXRlZCc7XG4gICAgICAgIGxpbmsuY2xhc3NMaXN0LmFkZCgnZGVsZXRpb24tZmluZGVyLWxpbmsnKTtcbiAgICAgICAgbGluay5ocmVmID0gbXcudXRpbC5nZXRVcmwoJ1NwZWNpYWw6TG9nL2RlbGV0ZScsIHsgcGFnZTogbXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpLnJlcGxhY2VBbGwoJ18nLCAnICcpLCBzdWJ0eXBlOiAnZGVsZXRlJyB9KTtcbiAgICAgICAgbGluay50YXJnZXQgPSAnX2JsYW5rJztcbiAgICAgICAgbGluay50ZXh0Q29udGVudCA9ICdQcmV2aW91c2x5IGRlbGV0ZWQnO1xuXG4gICAgICAgIHRpdGxlRWxlbWVudC5hcHBlbmQobGluayk7XG4gICAgfVxuXG4gICAgY29uc3QgYWZkRXhpc3RzID0gKGF3YWl0IG5ldyBtdy5BcGkoKS5nZXQoeyBhY3Rpb246ICdxdWVyeScsIGZvcm1hdHZlcnNpb246IDIsIHRpdGxlczogYFdpa2lwZWRpYTpBcnRpY2xlc19mb3JfZGVsZXRpb24vJHttdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyl9YCB9KSkgYXMge1xuICAgICAgICBxdWVyeTogeyBwYWdlczogeyBtaXNzaW5nPzogdHJ1ZSB9W10gfTtcbiAgICB9O1xuXG4gICAgaWYgKCFhZmRFeGlzdHMucXVlcnkucGFnZXNbMF0ubWlzc2luZykge1xuICAgICAgICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgICBsaW5rLmlkID0gJ2RlbGV0aW9uLWZpbmRlci1wcmV2aW91cy1hZmQnO1xuICAgICAgICBsaW5rLmhyZWYgPSBtdy51dGlsLmdldFVybCgnU3BlY2lhbDpBbGxQYWdlcycsIHtcbiAgICAgICAgICAgIGZyb206IGBBcnRpY2xlcyBmb3IgZGVsZXRpb24vJHttdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJykucmVwbGFjZUFsbCgnXycsICcgJyl9YCxcbiAgICAgICAgICAgIHRvOiBgQXJ0aWNsZXMgZm9yIGRlbGV0aW9uLyR7bXcuY29uZmlnLmdldCgnd2dQYWdlTmFtZScpLnJlcGxhY2VBbGwoJ18nLCAnICcpfSAoOXopYCxcbiAgICAgICAgICAgIG5hbWVzcGFjZTogJzQnLFxuICAgICAgICB9KTtcbiAgICAgICAgbGluay50YXJnZXQgPSAnX2JsYW5rJztcbiAgICAgICAgbGluay50ZXh0Q29udGVudCA9ICdQcmV2aW91c2x5IGF0IEFmRCc7XG5cbiAgICAgICAgdGl0bGVFbGVtZW50LmFwcGVuZChsaW5rKTtcbiAgICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixHQUFHLFlBQVk7QUFDNUMsTUFBSSxHQUFHLE9BQU8sSUFBSSxtQkFBbUIsTUFBTTtBQUFHO0FBQzlDLE1BQUksR0FBRyxPQUFPLElBQUksVUFBVSxNQUFNO0FBQVE7QUFDMUMsTUFBSSxHQUFHLE9BQU8sSUFBSSxZQUFZLE1BQU07QUFBYTtBQUVqRCxLQUFHLEtBQUssT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQTJCakI7QUFFRSxRQUFNLGVBQWUsU0FBUyxjQUFjLGVBQWU7QUFFM0QsTUFBSSxDQUFDO0FBQWMsV0FBTyxHQUFHLE9BQU8sZ0NBQWdDLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFckYsUUFBTSxpQkFBa0IsTUFBTSxJQUFJLEdBQUcsSUFBSSxFQUFFLElBQUk7QUFBQSxJQUMzQyxRQUFRO0FBQUEsSUFDUixVQUFVO0FBQUEsSUFDVixTQUFTO0FBQUEsSUFDVCxTQUFTLEdBQUcsT0FBTyxJQUFJLFlBQVk7QUFBQSxJQUNuQyxNQUFNO0FBQUEsRUFDVixDQUFDO0FBRUQsTUFBSSxlQUFlLE1BQU0sVUFBVSxTQUFTLEdBQUc7QUFDM0MsVUFBTSxPQUFPLFNBQVMsY0FBYyxHQUFHO0FBQ3ZDLFNBQUssS0FBSztBQUNWLFNBQUssVUFBVSxJQUFJLHNCQUFzQjtBQUN6QyxTQUFLLE9BQU8sR0FBRyxLQUFLLE9BQU8sc0JBQXNCLEVBQUUsTUFBTSxHQUFHLE9BQU8sSUFBSSxZQUFZLEVBQUUsV0FBVyxLQUFLLEdBQUcsR0FBRyxTQUFTLFNBQVMsQ0FBQztBQUM5SCxTQUFLLFNBQVM7QUFDZCxTQUFLLGNBQWM7QUFFbkIsaUJBQWEsT0FBTyxJQUFJO0FBQUEsRUFDNUI7QUFFQSxRQUFNLFlBQWEsTUFBTSxJQUFJLEdBQUcsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLFNBQVMsZUFBZSxHQUFHLFFBQVEsbUNBQW1DLEdBQUcsT0FBTyxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUM7QUFJekosTUFBSSxDQUFDLFVBQVUsTUFBTSxNQUFNLENBQUMsRUFBRSxTQUFTO0FBQ25DLFVBQU0sT0FBTyxTQUFTLGNBQWMsR0FBRztBQUN2QyxTQUFLLEtBQUs7QUFDVixTQUFLLE9BQU8sR0FBRyxLQUFLLE9BQU8sb0JBQW9CO0FBQUEsTUFDM0MsTUFBTSx5QkFBeUIsR0FBRyxPQUFPLElBQUksWUFBWSxFQUFFLFdBQVcsS0FBSyxHQUFHLENBQUM7QUFBQSxNQUMvRSxJQUFJLHlCQUF5QixHQUFHLE9BQU8sSUFBSSxZQUFZLEVBQUUsV0FBVyxLQUFLLEdBQUcsQ0FBQztBQUFBLE1BQzdFLFdBQVc7QUFBQSxJQUNmLENBQUM7QUFDRCxTQUFLLFNBQVM7QUFDZCxTQUFLLGNBQWM7QUFFbkIsaUJBQWEsT0FBTyxJQUFJO0FBQUEsRUFDNUI7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
