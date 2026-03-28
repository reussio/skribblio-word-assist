(() => {
  const LANGUAGE_BY_VALUE = {
    "0": "en",
    "1": "de",
    "7": "fr",
    "14": "ko",
    "24": "es"
  };

  const LANGUAGE_BY_LABEL = {
    english: "en",
    german: "de",
    french: "fr",
    korean: "ko",
    spanish: "es"
  };

  const LANGUAGE_NAMES = {
    en: "English",
    de: "German",
    es: "Spanish",
    fr: "French",
    ko: "Korean"
  };

  const runtimeApi = globalThis.chrome?.runtime ?? globalThis.browser?.runtime ?? null;
  const loadedLanguages = new Map();

  function normalizeLetters(value) {
    return value
      .normalize("NFC")
      .toLocaleLowerCase()
      .replace(/\s+/gu, " ")
      .replace(/[^\p{L}\p{N}_ ]/gu, "");
  }

  function normalizePattern(value) {
    return normalizeLetters(value).trim();
  }

  function scoreMatch(word, pattern) {
    let score = 0;

    for (let index = 0; index < pattern.length; index += 1) {
      if (pattern[index] !== "_" && word[index] === pattern[index]) {
        score += 2;
      }
      if (pattern[index] === "_") {
        score += 1;
      }
    }

    return score;
  }

  function findMatches(state, pattern) {
    if (!pattern) {
      return { total: 0, visible: [] };
    }

    const regex = new RegExp(`^${pattern.replace(/_/g, "[\\p{L}\\p{N}]")}$`, "u");
    const matches = state.words
      .filter((entry) => entry.normalized.length === pattern.length)
      .filter((entry) => regex.test(entry.normalized))
      .filter((entry) => !state.excludedWords.has(entry.raw))
      .map((entry) => ({
        raw: entry.raw,
        normalized: entry.normalized,
        score: scoreMatch(entry.normalized, pattern)
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.raw.localeCompare(right.raw);
      });

    return {
      total: matches.length,
      visible: matches.slice(0, 50)
    };
  }

  function isGameVisible() {
    const gameRoot = document.querySelector("#game");
    return Boolean(gameRoot) && window.getComputedStyle(gameRoot).display !== "none";
  }

  function getWordNode() {
    return document.querySelector("#game-word");
  }

  function getHintsNode() {
    return document.querySelector("#game-word .hints");
  }

  function isGuessPhase(wordContainer) {
    const descriptionNode = wordContainer.querySelector(".description");
    const description = (descriptionNode?.textContent || "").trim().toLowerCase();
    return description.includes("guess");
  }

  function mountIntoPage(state, root) {
    const chatContainer = document.querySelector("#game-chat");
    if (!chatContainer) {
      return;
    }

    let wrapper = state.chatWrapper;
    if (!wrapper || !wrapper.isConnected) {
      wrapper = document.createElement("div");
      wrapper.id = "skribbl-helper-chat-column";
      state.chatWrapper = wrapper;
    }

    if (!state.chatHost || !state.chatHost.isConnected) {
      const currentParent = chatContainer.parentElement;
      if (!currentParent || currentParent === wrapper) {
        return;
      }
      state.chatHost = currentParent;
    }

    const host = state.chatHost;
    if (!host || host === wrapper) {
      return;
    }

    if (wrapper.parentElement !== host) {
      host.insertBefore(wrapper, chatContainer);
    }
    if (root.parentElement !== wrapper) {
      wrapper.appendChild(root);
    }
    if (chatContainer.parentElement !== wrapper) {
      wrapper.appendChild(chatContainer);
    }
  }

  function extractPatternFromGameWord(node) {
    const hintNodes = node.querySelectorAll(".hint");
    if (hintNodes.length > 0) {
      return Array.from(hintNodes, (hintNode) => {
        const rawText = hintNode.textContent || "";
        if (/\s/u.test(rawText)) {
          return " ";
        }
        if (hintNode.classList.contains("uncover")) {
          const normalizedText = normalizeLetters(rawText).replace(/_/g, "").replace(/ /g, "");
          return normalizedText[0] || "_";
        }
        return "_";
      }).join("");
    }

    const lengthNode = node.querySelector("div.hints > div > div.word-length");
    if (lengthNode) {
      const rawLength = parseInt(lengthNode.textContent || "", 10);
      if (Number.isInteger(rawLength) && rawLength > 0) {
        return "_".repeat(rawLength);
      }
    }

    return "";
  }

  function readPatternFromDom(state, root) {
    const wordContainer = getWordNode();
    if (!wordContainer) {
      return "";
    }

    mountIntoPage(state, root);
    if (!isGuessPhase(wordContainer)) {
      return "";
    }

    const pattern = extractPatternFromGameWord(wordContainer);
    return pattern.length >= 2 ? pattern : "";
  }

  function readRoundSignatureFromDom() {
    const wordContainer = getWordNode();
    if (!wordContainer || !isGuessPhase(wordContainer)) {
      return "";
    }

    const hintNodes = wordContainer.querySelectorAll(".hint");
    if (hintNodes.length > 0) {
      return Array.from(hintNodes, (hintNode) => {
        const rawText = hintNode.textContent || "";
        return /\s/u.test(rawText) ? " " : "_";
      }).join("");
    }

    const lengthNode = wordContainer.querySelector("div.hints > div > div.word-length");
    if (!lengthNode) {
      return "";
    }

    const rawLength = parseInt(lengthNode.textContent || "", 10);
    return Number.isInteger(rawLength) && rawLength > 0 ? "_".repeat(rawLength) : "";
  }

  function hasCurrentUserGuessed() {
    if (document.querySelector(".players-list .player.guessed .player-name.me")) {
      return true;
    }

    const guessedPlayers = document.querySelectorAll(".players-list .player.guessed");
    return Array.from(guessedPlayers).some((playerNode) => {
      const playerName = playerNode.querySelector(".player-name")?.textContent || "";
      return playerName.includes("(You)");
    });
  }

  function getChatElements() {
    const form = document.querySelector("#game-chat > form");
    const input = document.querySelector("#game-chat > form > input[type=text]");
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
      return null;
    }
    return { form, input };
  }

  function scrollChatToBottom() {
    const chatContent = document.querySelector("#game-chat .chat-content");
    if (chatContent instanceof HTMLElement) {
      chatContent.scrollTop = chatContent.scrollHeight;
    }
  }

  function submitGuess(word) {
    const chatElements = getChatElements();
    if (!chatElements) {
      return;
    }

    const { form, input } = chatElements;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    input.focus();
    descriptor?.set?.call(input, word);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
    input.dispatchEvent(new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true
    }));

    if (input.value === word) {
      form.requestSubmit();
    }
  }

  function detectLanguage() {
    const gameLanguageSelect = document.querySelector("#item-settings-language");
    if (gameLanguageSelect instanceof HTMLSelectElement) {
      const codeFromValue = LANGUAGE_BY_VALUE[gameLanguageSelect.value];
      if (codeFromValue) {
        return codeFromValue;
      }

      const selectedLabel = gameLanguageSelect.selectedOptions[0]?.textContent?.trim().toLowerCase();
      if (selectedLabel && LANGUAGE_BY_LABEL[selectedLabel]) {
        return LANGUAGE_BY_LABEL[selectedLabel];
      }
      return null;
    }

    const homeLanguageSelect = document.querySelector("#home .container-name-lang select");
    if (homeLanguageSelect instanceof HTMLSelectElement) {
      const codeFromValue = LANGUAGE_BY_VALUE[homeLanguageSelect.value];
      if (codeFromValue) {
        return codeFromValue;
      }

      const selectedLabel = homeLanguageSelect.selectedOptions[0]?.textContent?.trim().toLowerCase();
      if (selectedLabel && LANGUAGE_BY_LABEL[selectedLabel]) {
        return LANGUAGE_BY_LABEL[selectedLabel];
      }
      return null;
    }

    return "en";
  }

  async function ensureWordsForLanguage(state, languageCode) {
    if (loadedLanguages.has(languageCode)) {
      state.words = loadedLanguages.get(languageCode);
      state.activeLanguage = languageCode;
      return;
    }

    if (!runtimeApi?.getURL) {
      state.runtimeAvailable = false;
      loadedLanguages.set(languageCode, []);
      state.words = [];
      state.activeLanguage = languageCode;
      return;
    }

    state.runtimeAvailable = true;
    const fileUrl = runtimeApi.getURL(`src/data/${languageCode}.json`);

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const words = Array.isArray(payload)
        ? payload
            .map((entry) => {
              const raw = String(entry);
              const normalized = normalizeLetters(raw);
              return normalized ? { raw, normalized } : null;
            })
            .filter(Boolean)
        : [];

      loadedLanguages.set(languageCode, words);
      state.words = words;
      state.activeLanguage = languageCode;
    } catch (error) {
      console.error("skribbl-helper: failed to load word list", languageCode, error);
      loadedLanguages.set(languageCode, []);
      state.words = [];
      state.activeLanguage = languageCode;
    }
  }

  globalThis.SKRIBBL_WORD_ASSIST_GAME = {
    LANGUAGE_NAMES,
    normalizePattern,
    findMatches,
    isGameVisible,
    getWordNode,
    getHintsNode,
    isGuessPhase,
    mountIntoPage,
    readPatternFromDom,
    readRoundSignatureFromDom,
    hasCurrentUserGuessed,
    submitGuess,
    scrollChatToBottom,
    detectLanguage,
    ensureWordsForLanguage
  };
})();
