const elements = {
  text: document.getElementById("target-text"),
  wpm: document.getElementById("wpm"),
  typo: document.getElementById("typo-rate"),
  wpmValue: document.getElementById("wpm-value"),
  typoValue: document.getElementById("typo-value"),
  start: document.getElementById("start"),
  pause: document.getElementById("pause"),
  stop: document.getElementById("stop"),
  phase: document.getElementById("phase"),
  progressBar: document.getElementById("progress-bar"),
  progressText: document.getElementById("progress-text"),
  message: document.getElementById("message")
};

let pollTimer = null;

init().catch((error) => {
  renderStatus({
    phase: "error",
    index: 0,
    total: 0,
    message: error.message || "Failed to initialize popup."
  });
});

async function init() {
  bindEvents();
  await restoreSettings();
  await refreshStatus();
  startPolling();
}

function bindEvents() {
  elements.wpm.addEventListener("input", () => {
    elements.wpmValue.textContent = `${elements.wpm.value} WPM`;
    persistSettings();
  });

  elements.typo.addEventListener("input", () => {
    elements.typoValue.textContent = `${elements.typo.value}%`;
    persistSettings();
  });

  elements.text.addEventListener("input", persistSettings);
  elements.start.addEventListener("click", startTyping);
  elements.pause.addEventListener("click", pauseTyping);
  elements.stop.addEventListener("click", stopTyping);
}

async function restoreSettings() {
  const defaults = {
    targetText: "",
    wpm: 55,
    typoRate: 3
  };
  const stored = await chrome.storage.local.get(defaults);
  elements.text.value = stored.targetText;
  elements.wpm.value = stored.wpm;
  elements.typo.value = stored.typoRate;
  elements.wpmValue.textContent = `${stored.wpm} WPM`;
  elements.typoValue.textContent = `${stored.typoRate}%`;
}

async function persistSettings() {
  await chrome.storage.local.set({
    targetText: elements.text.value,
    wpm: Number(elements.wpm.value),
    typoRate: Number(elements.typo.value)
  });
}

async function startTyping() {
  const response = await sendToActiveTab({
    type: "typing:start",
    payload: {
      text: elements.text.value,
      settings: {
        wpm: Number(elements.wpm.value),
        typoRate: Number(elements.typo.value) / 100
      }
    }
  });

  if (!response?.ok) {
    renderStatus({
      phase: "error",
      index: 0,
      total: 0,
      message: response?.error || "Failed to start typing."
    });
    return;
  }

  await refreshStatus();
}

async function pauseTyping() {
  const response = await sendToActiveTab({ type: "typing:pause" });
  if (!response?.ok) {
    renderStatus({
      phase: "error",
      index: 0,
      total: 0,
      message: response?.error || "Failed to toggle pause."
    });
    return;
  }
  await refreshStatus();
}

async function stopTyping() {
  const response = await sendToActiveTab({ type: "typing:stop" });
  if (!response?.ok) {
    renderStatus({
      phase: "error",
      index: 0,
      total: 0,
      message: response?.error || "Failed to stop typing."
    });
    return;
  }
  await refreshStatus();
}

async function refreshStatus() {
  const response = await sendToActiveTab({ type: "typing:status" });
  if (!response?.ok) {
    renderStatus({
      phase: "idle",
      index: 0,
      total: 0,
      message: "Open a page and focus an editable field."
    });
    return;
  }

  renderStatus(response.status);
}

function renderStatus(status) {
  const phase = status?.phase || "idle";
  const index = Number(status?.index || 0);
  const total = Number(status?.total || 0);
  const progress = total > 0 ? Math.min(100, Math.round(index / total * 100)) : 0;

  elements.phase.textContent = phase;
  elements.progressBar.style.width = `${progress}%`;
  elements.progressText.textContent = `${index} / ${total}`;
  elements.message.textContent = status?.message || "";

  const active = phase === "running";
  const paused = phase === "paused";
  elements.start.disabled = active;
  elements.pause.disabled = !(active || paused);
  elements.pause.textContent = paused ? "Resume" : "Pause";
  elements.stop.disabled = !(active || paused);
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    refreshStatus().catch(() => {});
  }, 350);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function sendToActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { ok: false, error: "No active tab." };
    }
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    try {
      return await chrome.runtime.sendMessage({
        type: "relay:active-tab",
        payload: message
      });
    } catch {
      return { ok: false, error: error.message || "Unable to contact content script." };
    }
  }
}
