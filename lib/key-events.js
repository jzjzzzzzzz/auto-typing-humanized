(function () {
  function createKeyboardEvent(type, key) {
    return new KeyboardEvent(type, {
      key,
      bubbles: true,
      cancelable: true,
      composed: true
    });
  }

  function createInputEvent(type, data, inputType = "insertText") {
    return new InputEvent(type, {
      data,
      inputType,
      bubbles: true,
      cancelable: type === "beforeinput",
      composed: true
    });
  }

  function isTextControl(target) {
    return target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLInputElement && /^(text|search|url|tel|email|password)$/i.test(target.type));
  }

  function isContentEditable(target) {
    return !!target && target.isContentEditable;
  }

  function applyInsertion(target, text) {
    if (isTextControl(target)) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const next = target.value.slice(0, start) + text + target.value.slice(end);
      target.value = next;
      const caret = start + text.length;
      target.setSelectionRange(caret, caret);
      return;
    }

    if (isContentEditable(target)) {
      const selection = target.ownerDocument.getSelection();
      if (!selection) {
        target.textContent = `${target.textContent || ""}${text}`;
        return;
      }

      if (selection.rangeCount === 0 || !target.contains(selection.anchorNode)) {
        const range = target.ownerDocument.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(target.ownerDocument.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function applyBackspace(target) {
    if (isTextControl(target)) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      if (start !== end) {
        target.value = target.value.slice(0, start) + target.value.slice(end);
        target.setSelectionRange(start, start);
        return;
      }

      if (start === 0) {
        return;
      }

      target.value = target.value.slice(0, start - 1) + target.value.slice(end);
      target.setSelectionRange(start - 1, start - 1);
      return;
    }

    if (isContentEditable(target)) {
      const selection = target.ownerDocument.getSelection();
      if (!selection) {
        target.textContent = (target.textContent || "").slice(0, -1);
        return;
      }

      if (selection.rangeCount === 0 || !target.contains(selection.anchorNode)) {
        const range = target.ownerDocument.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      if (!selection.modify) {
        target.textContent = (target.textContent || "").slice(0, -1);
        return;
      }

      selection.modify("extend", "backward", "character");
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function insertCharacter(target, char) {
    target.dispatchEvent(createKeyboardEvent("keydown", char));
    target.dispatchEvent(createInputEvent("beforeinput", char, "insertText"));
    applyInsertion(target, char);
    target.dispatchEvent(createInputEvent("input", char, "insertText"));
    target.dispatchEvent(createKeyboardEvent("keyup", char));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function pressBackspace(target) {
    target.dispatchEvent(createKeyboardEvent("keydown", "Backspace"));
    target.dispatchEvent(createInputEvent("beforeinput", null, "deleteContentBackward"));
    applyBackspace(target);
    target.dispatchEvent(createInputEvent("input", null, "deleteContentBackward"));
    target.dispatchEvent(createKeyboardEvent("keyup", "Backspace"));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  window.HumanKeyEvents = {
    insertCharacter,
    pressBackspace,
    isTextControl,
    isContentEditable
  };
})();
