(function () {
  const LETTER_HAND = {
    a: "left",
    b: "left",
    c: "left",
    d: "left",
    e: "left",
    f: "left",
    g: "left",
    h: "right",
    i: "right",
    j: "right",
    k: "right",
    l: "right",
    m: "right",
    n: "right",
    o: "right",
    p: "right",
    q: "left",
    r: "left",
    s: "left",
    t: "left",
    u: "right",
    v: "left",
    w: "left",
    x: "left",
    y: "right",
    z: "left"
  };

  const NEIGHBOR_KEYS = {
    a: ["q", "w", "s", "z"],
    b: ["v", "g", "h", "n"],
    c: ["x", "d", "f", "v"],
    d: ["s", "e", "r", "f", "c", "x"],
    e: ["w", "s", "d", "r"],
    f: ["d", "r", "t", "g", "v", "c"],
    g: ["f", "t", "y", "h", "b", "v"],
    h: ["g", "y", "u", "j", "n", "b"],
    i: ["u", "j", "k", "o"],
    j: ["h", "u", "i", "k", "m", "n"],
    k: ["j", "i", "o", "l", "m"],
    l: ["k", "o", "p"],
    m: ["n", "j", "k"],
    n: ["b", "h", "j", "m"],
    o: ["i", "k", "l", "p"],
    p: ["o", "l"],
    q: ["w", "a"],
    r: ["e", "d", "f", "t"],
    s: ["a", "w", "e", "d", "x", "z"],
    t: ["r", "f", "g", "y"],
    u: ["y", "h", "j", "i"],
    v: ["c", "f", "g", "b"],
    w: ["q", "a", "s", "e"],
    x: ["z", "s", "d", "c"],
    y: ["t", "g", "h", "u"],
    z: ["a", "s", "x"]
  };

  const PUNCTUATION_PAUSE = {
    ",": [90, 210],
    ".": [220, 560],
    "!": [220, 580],
    "?": [240, 620],
    ";": [130, 260],
    ":": [140, 280],
    "\n": [260, 720]
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function chance(probability) {
    return Math.random() < probability;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function sampleNormal(mean, standardDeviation) {
    let u = 0;
    let v = 0;
    while (u === 0) {
      u = Math.random();
    }
    while (v === 0) {
      v = Math.random();
    }
    const gaussian = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + gaussian * standardDeviation;
  }

  function sampleLogNormal(mean, shape) {
    const safeMean = Math.max(1, mean);
    const varianceFactor = Math.max(0.08, shape);
    const mu = Math.log(safeMean) - 0.5 * varianceFactor * varianceFactor;
    return Math.exp(sampleNormal(mu, varianceFactor));
  }

  function createTypingProfile(settings) {
    const wpm = clamp(Number(settings.wpm) || 55, 20, 180);
    const typoRate = clamp(Number(settings.typoRate) || 0.03, 0, 0.25);
    const targetIki = 60000 / (wpm * 5);
    const cadenceBias = rand(0.92, 1.12);
    const sessionDrift = rand(-0.06, 0.12);

    return {
      wpm,
      typoRate,
      targetIki,
      cadenceBias,
      sessionDrift,
      shape: clamp(0.28 + (70 / wpm) * 0.04, 0.24, 0.48),
      burstRemaining: randInt(4, 11),
      typoCooldown: randInt(3, 9),
      fatigue: rand(0.01, 0.05),
      charsTyped: 0
    };
  }

  function charClass(char) {
    if (!char) {
      return "other";
    }
    if (/\s/.test(char)) {
      return "space";
    }
    if (/[A-Za-z]/.test(char)) {
      return "letter";
    }
    if (/\d/.test(char)) {
      return "digit";
    }
    if (/[,.!?;:]/.test(char)) {
      return "punctuation";
    }
    return "other";
  }

  function getHand(char) {
    return LETTER_HAND[char.toLowerCase()] || null;
  }

  function shouldMakeTypo(profile, context) {
    const char = context.currentChar;
    if (charClass(char) !== "letter") {
      profile.typoCooldown = Math.max(0, profile.typoCooldown - 1);
      return false;
    }

    if (context.wordLength < 4) {
      profile.typoCooldown = Math.max(0, profile.typoCooldown - 1);
      return false;
    }

    const cooldownFactor = profile.typoCooldown > 0 ? 0.22 : 1;
    const lengthFactor = clamp(1 + (context.wordLength - 4) * 0.04, 1, 1.35);
    const jitter = rand(0.65, 1.45);
    const probability = clamp(profile.typoRate * lengthFactor * jitter * cooldownFactor, 0, 0.22);
    profile.typoCooldown = Math.max(0, profile.typoCooldown - 1);
    return chance(probability);
  }

  function buildTypo(char) {
    const lower = char.toLowerCase();
    const nearby = NEIGHBOR_KEYS[lower];
    if (!nearby?.length) {
      return null;
    }

    const typo = pick(nearby);
    return char === lower ? typo : typo.toUpperCase();
  }

  function registerTypo(profile) {
    profile.typoCooldown = randInt(4, 12);
    profile.fatigue = clamp(profile.fatigue + rand(0.01, 0.03), 0, 0.22);
    profile.burstRemaining = Math.max(profile.burstRemaining, 2);
  }

  function nextDelay(profile, context) {
    const { currentChar, previousChar, wordLength, atWordStart, atSentenceEnd, recentMistakes } = context;
    const currentClass = charClass(currentChar);
    const previousClass = charClass(previousChar);

    let delay = sampleLogNormal(profile.targetIki * profile.cadenceBias * (1 + profile.sessionDrift), profile.shape);
    delay *= rand(0.92, 1.12);

    if (currentClass === "space") {
      delay += rand(18, 70);
    } else if (currentClass === "punctuation") {
      const bounds = PUNCTUATION_PAUSE[currentChar] || [100, 220];
      delay += rand(bounds[0], bounds[1]);
    }

    if (atWordStart && currentClass !== "space") {
      delay += rand(35, 140);
    }

    if (atSentenceEnd) {
      delay += rand(180, 560);
    }

    if (currentClass === "letter" && previousClass === "letter") {
      const currentHand = getHand(currentChar);
      const previousHand = getHand(previousChar);
      if (currentHand && previousHand) {
        if (currentHand === previousHand) {
          delay += rand(8, 28);
        } else {
          delay -= rand(6, 18);
        }
      }
    }

    if (currentClass === "letter" && previousChar && previousChar.toLowerCase() === currentChar.toLowerCase()) {
      delay += rand(10, 34);
    }

    if (wordLength >= 8) {
      delay += rand(10, 38);
    } else if (wordLength >= 5) {
      delay += rand(4, 18);
    }

    if (recentMistakes > 0) {
      delay *= rand(1.06, 1.18);
    }

    profile.charsTyped += 1;
    profile.fatigue = clamp(profile.fatigue + rand(0.002, 0.007), 0, 0.18);
    delay *= 1 + profile.fatigue;

    profile.burstRemaining -= 1;
    if (profile.burstRemaining <= 0) {
      delay += rand(180, 920);
      profile.burstRemaining = randInt(5, 14);
      profile.fatigue = Math.max(0.015, profile.fatigue - rand(0.02, 0.05));
    }

    if (profile.charsTyped > 0 && profile.charsTyped % randInt(20, 44) === 0) {
      delay += rand(90, 320);
    }

    return Math.round(clamp(delay, 60, 2200));
  }

  window.HumanTypingModel = {
    clamp,
    rand,
    randInt,
    chance,
    pick,
    createTypingProfile,
    shouldMakeTypo,
    buildTypo,
    registerTypo,
    nextDelay,
    charClass,
    getHand
  };
})();
