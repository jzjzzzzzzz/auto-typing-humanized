const badgeDefaults = {
  idle: { text: "", color: "#6b7280" },
  ready: { text: "OK", color: "#2563eb" },
  run: { text: "RUN", color: "#16a34a" },
  pause: { text: "II", color: "#d97706" },
  stop: { text: "", color: "#6b7280" },
  error: { text: "ERR", color: "#dc2626" }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setBadgeBackgroundColor({ color: badgeDefaults.idle.color });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "badge:update") {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.action.setBadgeText({ tabId, text: message.text ?? "" });
      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: message.color ?? badgeDefaults.idle.color
      });
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "relay:active-tab") {
    relayToActiveTab(message.payload).then(sendResponse);
    return true;
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.action.setBadgeText({ tabId, text: "" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: badgeDefaults.idle.color });
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    chrome.action.setBadgeText({ tabId, text: "" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: badgeDefaults.idle.color });
  }
});

async function relayToActiveTab(payload) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { ok: false, error: "No active tab." };
    }
    return await chrome.tabs.sendMessage(tab.id, payload);
  } catch (error) {
    return { ok: false, error: error.message || "Failed to reach active tab." };
  }
}
