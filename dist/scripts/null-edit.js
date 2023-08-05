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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NyaXB0cy9udWxsLWVkaXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIm13LmxvYWRlci51c2luZyhbJ21lZGlhd2lraS51dGlsJ10sICgpID0+IHtcbiAgICBpZiAobXcuY29uZmlnLmdldCgnd2dOYW1lc3BhY2VOdW1iZXInKSA8IDApIHJldHVybjsgLy8gRG9uJ3QgcnVuIGluIHZpcnR1YWwgbmFtZXNwYWNlc1xuICAgIGlmICghbXcuY29uZmlnLmdldCgnd2dJc1Byb2JhYmx5RWRpdGFibGUnKSkgcmV0dXJuOyAvLyBEb24ndCBydW4gaWYgdXNlciBjYW4ndCBlZGl0IHBhZ2VcblxuICAgIGNvbnN0IGxpbmsgPSBtdy51dGlsLmFkZFBvcnRsZXRMaW5rKG13LmNvbmZpZy5nZXQoJ3NraW4nKSA9PT0gJ21pbmVydmEnID8gJ3AtdGInIDogJ3AtY2FjdGlvbnMnLCAnIycsICdOdWxsIGVkaXQnLCAnbnVsbC1lZGl0Jyk7XG5cbiAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgbXcubm90aWZ5KCdOdWxsIGVkaXRpbmcgcGFnZS4uLicsIHsgdGFnOiAnbnVsbC1lZGl0LW5vdGlmaWNhdGlvbicgfSk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IG5ldyBtdy5BcGkoKS5lZGl0KG13LmNvbmZpZy5nZXQoJ3dnUGFnZU5hbWUnKSwgKHRleHQpID0+ICh7IHRleHQ6IHRleHQuY29udGVudCwgc3VtbWFyeTogJ051bGwgZWRpdC0gaWYgeW91IHNlZSB0aGlzLCBzb21ldGhpbmcgd2VudCB3cm9uZyEnLCBtaW5vcjogdHJ1ZSB9KSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBtdy5ub3RpZnkoJ0FuIGVycm9yIG9jY3VycmVkIHdoZW4gbnVsbCBlZGl0aW5nIHRoaXMgcGFnZSEnLCB7IHR5cGU6ICdlcnJvcicsIHRhZzogJ251bGwtZWRpdC1ub3RpZmljYXRpb24nIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbXcubm90aWZ5KCdTdWNjZXNzZnVsbHkgbnVsbCBlZGl0ZWQgcGFnZSwgcmVsb2FkaW5nLi4uJywgeyB0eXBlOiAnc3VjY2VzcycsIHRhZzogJ251bGwtZWRpdC1ub3RpZmljYXRpb24nIH0pO1xuXG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLEdBQUcsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsTUFBTTtBQUN0QyxNQUFJLEdBQUcsT0FBTyxJQUFJLG1CQUFtQixJQUFJO0FBQUc7QUFDNUMsTUFBSSxDQUFDLEdBQUcsT0FBTyxJQUFJLHNCQUFzQjtBQUFHO0FBRTVDLFFBQU0sT0FBTyxHQUFHLEtBQUssZUFBZSxHQUFHLE9BQU8sSUFBSSxNQUFNLE1BQU0sWUFBWSxTQUFTLGNBQWMsS0FBSyxhQUFhLFdBQVc7QUFFOUgsT0FBSyxpQkFBaUIsU0FBUyxPQUFPLFVBQVU7QUFDNUMsVUFBTSxlQUFlO0FBRXJCLE9BQUcsT0FBTyx3QkFBd0IsRUFBRSxLQUFLLHlCQUF5QixDQUFDO0FBRW5FLFFBQUk7QUFDQSxZQUFNLElBQUksR0FBRyxJQUFJLEVBQUUsS0FBSyxHQUFHLE9BQU8sSUFBSSxZQUFZLEdBQUcsQ0FBQyxVQUFVLEVBQUUsTUFBTSxLQUFLLFNBQVMsU0FBUyxxREFBcUQsT0FBTyxLQUFLLEVBQUU7QUFBQSxJQUN0SyxTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0sS0FBSztBQUNuQixhQUFPLEdBQUcsT0FBTyxrREFBa0QsRUFBRSxNQUFNLFNBQVMsS0FBSyx5QkFBeUIsQ0FBQztBQUFBLElBQ3ZIO0FBRUEsT0FBRyxPQUFPLCtDQUErQyxFQUFFLE1BQU0sV0FBVyxLQUFLLHlCQUF5QixDQUFDO0FBRTNHLFdBQU8sU0FBUyxPQUFPO0FBQUEsRUFDM0IsQ0FBQztBQUNMLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
