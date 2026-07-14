(function () {
  class TypingEngine {
    constructor(target, text, settings, onUpdate) {
      this.target = target;
      this.text = text;
      this.settings = settings;
      this.onUpdate = onUpdate;
      this.model = window.HumanTypingModel.createTypingProfile(settings);
      this.index = 0;
      this.running = false;
      this.paused = false;
      this.lastTypoAt = -1;
      this.recentMistakes = 0;
      this.streak = 0;
      this.timer = null;
    }

    start() {
      if (this.running) {
        return;
      }
      this.running = true;
      this.paused = false;
      this.tick();
    }

    pause() {
      this.paused = true;
      this.clearTimer();
    }

    resume() {
      if (!this.running) {
        return;
      }
      this.paused = false;
      this.tick();
    }

    stop() {
      this.running = false;
      this.paused = false;
      this.clearTimer();
    }

    clearTimer() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }

    async tick() {
      if (!this.running || this.paused) {
        return;
      }

      if (!this.target?.isConnected) {
        this.stop();
        this.onUpdate({ phase: "error", error: "Focused input no longer exists." });
        return;
      }

      if (this.index >= this.text.length) {
        this.stop();
        this.onUpdate({ phase: "done", index: this.index, total: this.text.length });
        return;
      }

      this.target.focus();

      const currentChar = this.text[this.index];
      const previousChar = this.index > 0 ? this.text[this.index - 1] : "";
      const wordLength = this.currentWordLength(this.index);
      const context = {
        index: this.index,
        currentChar,
        previousChar,
        wordLength,
        atWordStart: this.isWordStart(this.index),
        atSentenceEnd: this.isSentenceEnd(this.index - 1),
        recentMistakes: this.recentMistakes,
        lastTypoAt: this.lastTypoAt,
        streak: this.streak
      };

      if (window.HumanTypingModel.shouldMakeTypo(this.model, context)) {
        const wrongChar = window.HumanTypingModel.buildTypo(currentChar);
        if (wrongChar) {
          window.HumanKeyEvents.insertCharacter(this.target, wrongChar);
          this.onUpdate({ phase: "typo", index: this.index, total: this.text.length, char: wrongChar });
          window.HumanTypingModel.registerTypo(this.model);
          await this.sleep(window.HumanTypingModel.randInt(70, 220));
          window.HumanKeyEvents.pressBackspace(this.target);
          await this.sleep(window.HumanTypingModel.randInt(80, 260));
          this.lastTypoAt = this.index;
          this.recentMistakes = Math.min(this.recentMistakes + 1, 4);
        }
      }

      window.HumanKeyEvents.insertCharacter(this.target, currentChar);
      this.index += 1;
      this.streak += 1;
      this.recentMistakes = Math.max(0, this.recentMistakes - 0.35);

      this.onUpdate({ phase: "typing", index: this.index, total: this.text.length, char: currentChar });

      const delay = window.HumanTypingModel.nextDelay(this.model, {
        index: this.index,
        currentChar,
        previousChar,
        wordLength,
        atWordStart: this.isWordStart(this.index),
        atSentenceEnd: this.isSentenceEnd(this.index - 1),
        recentMistakes: this.recentMistakes,
        streak: this.streak
      });

      this.timer = setTimeout(() => this.tick(), delay);
    }

    isWordStart(index) {
      if (index <= 0) {
        return true;
      }
      return /\s/.test(this.text[index - 1]);
    }

    isSentenceEnd(index) {
      if (index < 0) {
        return false;
      }
      return /[.!?]/.test(this.text[index]);
    }

    currentWordLength(index) {
      let length = 0;
      for (let i = index - 1; i >= 0; i -= 1) {
        const ch = this.text[i];
        if (/\s/.test(ch)) {
          break;
        }
        if (!/[A-Za-z0-9']/.test(ch)) {
          break;
        }
        length += 1;
      }
      return length;
    }

    sleep(ms) {
      return new Promise((resolve) => {
        this.timer = setTimeout(resolve, ms);
      });
    }
  }

  window.HumanTypingEngine = TypingEngine;
})();
