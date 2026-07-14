(function () {
  const state = {
    engine: null,
    lastFocused: null,
    status: {
      phase: "idle",
      index: 0,
      total: 0,
      message: "Focus an input or editable element on the page."
    }
  };

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (window.HumanKeyEvents.isTextControl(target) || window.HumanKeyEvents.isContentEditable(target)) {
      state.lastFocused = target;
      if (!state.engine) {
        setStatus({
          phase: "ready",
          message: "Input target captured."
        });
      }
    }
  }, true);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "typing:start") {
      sendResponse(startTyping(message.payload));
      return;
    }

    if (message?.type === "typing:pause") {
      sendResponse(togglePause());
      return;
    }

    if (message?.type === "typing:stop") {
      sendResponse(stopTyping());
      return;
    }

    if (message?.type === "typing:status") {
      sendResponse({ ok: true, status: state.status });
    }
  });

  function currentTarget() {
    const active = document.activeElement;
    if (window.HumanKeyEvents.isTextControl(active) || window.HumanKeyEvents.isContentEditable(active)) {
      return active;
    }
    if (state.lastFocused?.isConnected) {
      return state.lastFocused;
    }
    return null;
  }

  function startTyping(payload) {
    const text = String(payload?.text ?? "");
    const settings = payload?.settings ?? {};
    const target = currentTarget();

    if (!target) {
      return { ok: false, error: "No focused input, textarea, or contenteditable element found." };
    }

    if (!text.length) {
      return { ok: false, error: "Text is empty." };
    }

    if (state.engine) {
      state.engine.stop();
      state.engine = null;
    }

    state.engine = new window.HumanTypingEngine(target, text, settings, handleUpdate);
    setStatus({
      phase: "running",
      index: 0,
      total: text.length,
      message: "Typing started."
    });
    state.engine.start();
    pushBadge("RUN", "#16a34a");
    return { ok: true };
  }

  function togglePause() {
    if (!state.engine) {
      return { ok: false, error: "No active typing session." };
    }

    if (state.engine.paused) {
      state.engine.resume();
      setStatus({
        phase: "running",
        message: "Typing resumed."
      });
      pushBadge("RUN", "#16a34a");
      return { ok: true, paused: false };
    }

    state.engine.pause();
    setStatus({
      phase: "paused",
      message: "Typing paused."
    });
    pushBadge("II", "#d97706");
    return { ok: true, paused: true };
  }

  function stopTyping() {
    if (state.engine) {
      state.engine.stop();
      state.engine = null;
    }
    setStatus({
      phase: "idle",
      message: "Typing stopped."
    });
    pushBadge("", "#6b7280");
    return { ok: true };
  }

  function handleUpdate(update) {
    if (update.phase === "typing" || update.phase === "typo") {
      setStatus({
        phase: "running",
        index: update.index ?? state.status.index,
        total: update.total ?? state.status.total,
        message: update.phase === "typo" ? "Mistype inserted and corrected." : "Typing..."
      });
      return;
    }

    if (update.phase === "done") {
      state.engine = null;
      setStatus({
        phase: "done",
        index: update.index ?? state.status.total,
        total: update.total ?? state.status.total,
        message: "Typing completed."
      });
      pushBadge("OK", "#2563eb");
      return;
    }

    if (update.phase === "error") {
      state.engine = null;
      setStatus({
        phase: "error",
        message: update.error || "Typing failed."
      });
      pushBadge("ERR", "#dc2626");
    }
  }

  function setStatus(patch) {
    state.status = {
      ...state.status,
      ...patch
    };
  }

  function pushBadge(text, color) {
    chrome.runtime.sendMessage({ type: "badge:update", text, color }).catch(() => {});
  }
})();
