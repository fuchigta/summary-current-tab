chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summary",
    title: "Webページを要約",
    contexts: ["all"]
  })
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === "summary") {
    chrome.action.openPopup()
  }
})
