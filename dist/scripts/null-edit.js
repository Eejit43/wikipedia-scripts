"use strict";
mw.loader.using(["mediawiki.util"], () => {
  if (mw.config.get("wgNamespaceNumber") < 0)
    return;
  if (!mw.config.get("wgIsProbablyEditable"))
    return;
  const link = mw.util.addPortletLink(mw.config.get("skin") === "minerva" ? "p-tb" : "p-cactions", "#", "Null edit", "null-edit");
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    mw.notify("Null editing page...", { tag: "null-edit-notification" });
    try {
      await new mw.Api().edit(mw.config.get("wgPageName"), (text) => ({ text: text.content, summary: "Null edit- if you see this, something went wrong!", minor: true }));
    } catch (error) {
      console.error(error);
      return mw.notify("An error occurred when null editing this page!", { type: "error", tag: "null-edit-notification" });
    }
    mw.notify("Successfully null edited page, reloading...", { type: "success", tag: "null-edit-notification" });
    window.location.reload();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9udWxsLWVkaXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sICgpID0+IHtcbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dOYW1lc3BhY2VOdW1iZXInKSA8IDApIHJldHVybjsgLy8gRG9uJ3QgcnVuIGluIHZpcnR1YWwgbmFtZXNwYWNlc1xuICAgIGlmICghbXcuY29uZmlnLmdldCgnd2dJc1Byb2JhYmx5RWRpdGFibGUnKSkgcmV0dXJuOyAvLyBEb24ndCBydW4gaWYgdXNlciBjYW4ndCBlZGl0IHBhZ2VcblxuICAgIGNvbnN0IGxpbmsgPSBtdy51dGlsLmFkZFBvcnRsZXRMaW5rKG13LmNvbmZpZy5nZXQoJ3NraW4nKSA9PT0gJ21pbmVydmEnID8gJ3AtdGInIDogJ3AtY2FjdGlvbnMnLCAnIycsICdOdWxsIGVkaXQnLCAnbnVsbC1lZGl0JykhO1xuXG4gICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIG13Lm5vdGlmeSgnTnVsbCBlZGl0aW5nIHBhZ2UuLi4nLCB7IHRhZzogJ251bGwtZWRpdC1ub3RpZmljYXRpb24nIH0pO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBuZXcgbXcuQXBpKCkuZWRpdChtdy5jb25maWcuZ2V0KCd3Z1BhZ2VOYW1lJyksICh0ZXh0KSA9PiAoeyB0ZXh0OiB0ZXh0LmNvbnRlbnQsIHN1bW1hcnk6ICdOdWxsIGVkaXQtIGlmIHlvdSBzZWUgdGhpcywgc29tZXRoaW5nIHdlbnQgd3JvbmchJywgbWlub3I6IHRydWUgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbXcubm90aWZ5KCdBbiBlcnJvciBvY2N1cnJlZCB3aGVuIG51bGwgZWRpdGluZyB0aGlzIHBhZ2UhJywgeyB0eXBlOiAnZXJyb3InLCB0YWc6ICdudWxsLWVkaXQtbm90aWZpY2F0aW9uJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG13Lm5vdGlmeSgnU3VjY2Vzc2Z1bGx5IG51bGwgZWRpdGVkIHBhZ2UsIHJlbG9hZGluZy4uLicsIHsgdHlwZTogJ3N1Y2Nlc3MnLCB0YWc6ICdudWxsLWVkaXQtbm90aWZpY2F0aW9uJyB9KTtcblxuICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKCk7XG4gICAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxHQUFHLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixHQUFHLE1BQU07QUFDdEMsTUFBSSxHQUFHLE9BQU8sSUFBSSxtQkFBbUIsSUFBSTtBQUFHO0FBQzVDLE1BQUksQ0FBQyxHQUFHLE9BQU8sSUFBSSxzQkFBc0I7QUFBRztBQUU1QyxRQUFNLE9BQU8sR0FBRyxLQUFLLGVBQWUsR0FBRyxPQUFPLElBQUksTUFBTSxNQUFNLFlBQVksU0FBUyxjQUFjLEtBQUssYUFBYSxXQUFXO0FBRTlILE9BQUssaUJBQWlCLFNBQVMsT0FBTyxVQUFVO0FBQzVDLFVBQU0sZUFBZTtBQUVyQixPQUFHLE9BQU8sd0JBQXdCLEVBQUUsS0FBSyx5QkFBeUIsQ0FBQztBQUVuRSxRQUFJO0FBQ0EsWUFBTSxJQUFJLEdBQUcsSUFBSSxFQUFFLEtBQUssR0FBRyxPQUFPLElBQUksWUFBWSxHQUFHLENBQUMsVUFBVSxFQUFFLE1BQU0sS0FBSyxTQUFTLFNBQVMscURBQXFELE9BQU8sS0FBSyxFQUFFO0FBQUEsSUFDdEssU0FBUyxPQUFPO0FBQ1osY0FBUSxNQUFNLEtBQUs7QUFDbkIsYUFBTyxHQUFHLE9BQU8sa0RBQWtELEVBQUUsTUFBTSxTQUFTLEtBQUsseUJBQXlCLENBQUM7QUFBQSxJQUN2SDtBQUVBLE9BQUcsT0FBTywrQ0FBK0MsRUFBRSxNQUFNLFdBQVcsS0FBSyx5QkFBeUIsQ0FBQztBQUUzRyxXQUFPLFNBQVMsT0FBTztBQUFBLEVBQzNCLENBQUM7QUFDTCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
