export default defineBackground(() => {
  // Opening the panel from Chrome's side-panel picker does not grant activeTab.
  // Handle the toolbar action explicitly so the same click both grants temporary
  // access to the current page and opens SuiFill's side panel.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

  browser.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    void browser.sidePanel.open({ tabId: tab.id });
  });
});
