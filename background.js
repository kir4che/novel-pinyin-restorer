chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addPinyinRule",
    title: "加入拼音還原規則",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "addPinyinRule") return;
  if (!tab.id) return;

  chrome.tabs.sendMessage(tab.id, {
    action: "contextMenuAddRule",
    selectedText: info.selectionText,
  });
});
