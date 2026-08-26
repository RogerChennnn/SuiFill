export default defineBackground(() => {
  const enableActionToOpenSidePanel = async () => {
    await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  };

  void enableActionToOpenSidePanel();
  browser.runtime.onInstalled.addListener(() => {
    void enableActionToOpenSidePanel();
  });
});
