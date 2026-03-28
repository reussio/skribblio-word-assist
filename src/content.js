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
  const browserRuntimeApi = globalThis.browser?.runtime ?? null;
  const chromeRuntimeApi = globalThis.chrome?.runtime ?? null;
  const loadedLanguages = new Map();

  const state = {
    autoPattern: "",
    activeLanguage: "en",
    runtimeAvailable: Boolean(runtimeApi?.sendMessage),
    words: [],
    roundSignature: "",
    excludedWords: new Set(),
    inputFilterEnabled: true,
    boundChatInput: null,
    panelVisible: false,
    refreshScheduled: false,
    observedHintsNode: null,
    observedWordNode: null,
    chatWrapper: null,
    chatHost: null
  };

  const root = document.createElement("div");
  root.id = "skribbl-helper-root";
  root.innerHTML = `
    <div class="skribbl-helper-panel">
      <div class="skribbl-helper-summary">
        <div class="skribbl-helper-summary-text">
          <span class="skribbl-helper-title" data-role="title">Matches</span>
          <span class="skribbl-helper-meta" data-role="match-count">0 matches</span>
        </div>
        <label class="skribbl-helper-toggle">
          <input type="checkbox" data-role="input-filter-toggle">
          <span>Filter by Chat</span>
        </label>
      </div>
      <div class="skribbl-helper-body">
        <ul class="skribbl-helper-list" data-role="suggestions"></ul>
      </div>
    </div>
  `;

  const titleLabel = root.querySelector('[data-role="title"]');
  const matchCountLabel = root.querySelector('[data-role="match-count"]');
  const inputFilterToggle = root.querySelector('[data-role="input-filter-toggle"]');
  const suggestionsList = root.querySelector('[data-role="suggestions"]');

  function normalizeLetters(value) {
    return value
      .normalize("NFC")
      .toLocaleLowerCase()
      .replace(/\s+/gu, " ")
      .replace(/[^\p{L}\p{N}_ \-]/gu, "");
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

  function findMatches(pattern, inputFilter = "") {
    if (!pattern) {
      return { total: 0, visible: [] };
    }

    const regex = new RegExp(`^${pattern.replace(/_/g, "[\\p{L}\\p{N}]")}$`, "u");
    const matches = state.words
      .filter((entry) => entry.normalized.length === pattern.length)
      .filter((entry) => regex.test(entry.normalized))
      .filter((entry) => !inputFilter || entry.normalized.includes(inputFilter))
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

  function mountIntoPage() {
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
        if (rawText.includes("-")) {
          return "-";
        }
        if (hintNode.classList.contains("uncover")) {
          const normalizedText = normalizeLetters(rawText)
            .replace(/_/g, "")
            .replace(/ /g, "");
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

  function readPatternFromDom() {
    const wordContainer = getWordNode();
    if (!wordContainer) {
      return "";
    }

    mountIntoPage();
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
        if (/\s/u.test(rawText)) {
          return " ";
        }
        if (rawText.includes("-")) {
          return "-";
        }
        return "_";
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

  function renderSuggestions(matches) {
    suggestionsList.textContent = "";

    if (!state.runtimeAvailable) {
      const empty = document.createElement("li");
      empty.className = "skribbl-helper-empty";
      empty.textContent = "Extension runtime unavailable";
      suggestionsList.appendChild(empty);
      return;
    }

    if (matches.length === 0) {
      const empty = document.createElement("li");
      empty.className = "skribbl-helper-empty";
      empty.textContent = "No matches";
      suggestionsList.appendChild(empty);
      return;
    }

    matches.forEach((match) => {
      const item = document.createElement("li");
      item.className = "skribbl-helper-item";
      item.dataset.word = match.raw;
      item.setAttribute("role", "button");
      item.tabIndex = 0;

      const triggerSelection = (event) => {
        event.preventDefault();
        handleWordSelection(match.raw);
      };

      item.addEventListener("pointerdown", triggerSelection);
      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        handleWordSelection(match.raw);
      });

      const label = document.createElement("span");
      label.className = "skribbl-helper-word";
      label.textContent = match.raw;

      item.appendChild(label);
      suggestionsList.appendChild(item);
    });
  }

  function sendRuntimeMessage(message) {
    if (browserRuntimeApi?.sendMessage) {
      return browserRuntimeApi.sendMessage(message);
    }

    if (!chromeRuntimeApi?.sendMessage) {
      return Promise.reject(new Error("Extension runtime unavailable"));
    }

    return new Promise((resolve, reject) => {
      chromeRuntimeApi.sendMessage(message, (response) => {
        const error = chromeRuntimeApi.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(response);
      });
    });
  }

  async function loadRemoteWords(languageCode) {
    const response = await sendRuntimeMessage({
      type: "skribbl-helper:get-word-list",
      languageCode
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Failed to load word list");
    }

    return Array.isArray(response.words) ? response.words : [];
  }

  function renderGuessedState() {
    suggestionsList.textContent = "";
    const item = document.createElement("li");
    item.className = "skribbl-helper-empty";
    item.textContent = "Successfully guessed";
    suggestionsList.appendChild(item);
  }

  function getChatElements() {
    const form = document.querySelector("#game-chat > form");
    const input = document.querySelector("#game-chat > form > input[type=text]");
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
      return null;
    }
    return { form, input };
  }

  function getChatInputFilter() {
    const chatElements = getChatElements();
    if (!chatElements) {
      return "";
    }

    return normalizePattern(chatElements.input.value || "");
  }

  function bindChatInputListener() {
    const chatElements = getChatElements();
    if (!chatElements) {
      return;
    }

    if (state.boundChatInput === chatElements.input) {
      return;
    }

    chatElements.input.addEventListener("input", () => {
      if (state.inputFilterEnabled) {
        render();
      }
    });

    state.boundChatInput = chatElements.input;
  }

  function scrollChatToBottom() {
    const chatContent = document.querySelector("#game-chat .chat-content");
    if (chatContent instanceof HTMLElement) {
      chatContent.scrollTop = chatContent.scrollHeight;
    }
  }

  function setNativeInputValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(input, value);
  }

  function submitGuess(word) {
    const chatElements = getChatElements();
    if (!chatElements) {
      return;
    }

    const { form, input } = chatElements;
    input.focus();
    setNativeInputValue(input, word);
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
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    }
  }

  function render() {
    const pattern = state.autoPattern;
    const isSolved = hasCurrentUserGuessed();
    const inputFilter = state.inputFilterEnabled ? getChatInputFilter() : "";
    const matches = findMatches(pattern, inputFilter);
    const wordContainer = getWordNode();
    const shouldShowRuntimeError = !state.runtimeAvailable;
    const shouldShow =
      isGameVisible() &&
      Boolean(wordContainer) &&
      isGuessPhase(wordContainer) &&
      (pattern.length > 0 || shouldShowRuntimeError);

    const visibilityChanged = state.panelVisible !== shouldShow;
    state.panelVisible = shouldShow;
    root.hidden = !shouldShow;

    const countLabel = isSolved
      ? "Solved"
      : !state.runtimeAvailable
        ? "Extension error"
        : matches.total > 50
          ? "> 50 matches"
          : matches.total === 1
            ? "1 match"
            : `${matches.total} matches`;

    const languageLabel = LANGUAGE_NAMES[state.activeLanguage] || state.activeLanguage.toUpperCase();
    titleLabel.textContent = isSolved ? "Guessed" : "Matches";
    matchCountLabel.textContent = `${countLabel} · ${languageLabel}`;
    inputFilterToggle.checked = state.inputFilterEnabled;

    if (isSolved) {
      renderGuessedState();
    } else {
      renderSuggestions(matches.visible);
    }

    if (shouldShow && visibilityChanged) {
      requestAnimationFrame(() => {
        scrollChatToBottom();
      });
    }
  }

  function handleWordSelection(word) {
    state.excludedWords.add(word);
    render();
    submitGuess(word);
  }

  inputFilterToggle.addEventListener("change", () => {
    state.inputFilterEnabled = inputFilterToggle.checked;
    render();
  });

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

  async function ensureWordsForLanguage(languageCode) {
    if (loadedLanguages.has(languageCode)) {
      state.words = loadedLanguages.get(languageCode);
      state.activeLanguage = languageCode;
      return;
    }

    if (!runtimeApi?.sendMessage) {
      state.runtimeAvailable = false;
      loadedLanguages.set(languageCode, []);
      state.words = [];
      state.activeLanguage = languageCode;
      return;
    }

    state.runtimeAvailable = true;

    try {
      const payload = await loadRemoteWords(languageCode);
      const words = payload
        .map((entry) => {
          const raw = String(entry);
          const normalized = normalizeLetters(raw);
          return normalized ? { raw, normalized } : null;
        })
        .filter(Boolean);

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

  async function refreshAutoPattern() {
    syncWordObserver();
    syncHintsObserver();
    bindChatInputListener();

    if (!isGameVisible()) {
      root.hidden = true;
      if (state.autoPattern) {
        state.autoPattern = "";
      }
      return;
    }

    const nextLanguage = detectLanguage();
    if (!nextLanguage) {
      state.words = [];
      render();
      return;
    }

    if (nextLanguage !== state.activeLanguage || state.words.length === 0) {
      await ensureWordsForLanguage(nextLanguage);
    }

    const nextRoundSignature = readRoundSignatureFromDom();
    if (nextRoundSignature !== state.roundSignature) {
      state.roundSignature = nextRoundSignature;
      state.excludedWords.clear();
    }

    const nextPattern = normalizePattern(readPatternFromDom());
    if (nextPattern && nextPattern !== state.autoPattern) {
      state.autoPattern = nextPattern;
      render();
      return;
    }

    if (!nextPattern && state.autoPattern) {
      state.autoPattern = "";
      render();
      return;
    }

    render();
  }

  function scheduleRefresh() {
    if (state.refreshScheduled) {
      return;
    }

    state.refreshScheduled = true;
    window.requestAnimationFrame(() => {
      state.refreshScheduled = false;
      void refreshAutoPattern();
    });
  }

  const hintsObserver = new MutationObserver(() => {
    scheduleRefresh();
  });

  const wordObserver = new MutationObserver(() => {
    syncHintsObserver();
    scheduleRefresh();
  });

  function syncWordObserver() {
    const nextWordNode = getWordNode();
    if (nextWordNode === state.observedWordNode) {
      return;
    }

    wordObserver.disconnect();
    state.observedWordNode = nextWordNode;
    if (!nextWordNode) {
      return;
    }

    wordObserver.observe(nextWordNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });
  }

  function syncHintsObserver() {
    const nextHintsNode = getHintsNode();
    if (nextHintsNode === state.observedHintsNode) {
      return;
    }

    hintsObserver.disconnect();
    state.observedHintsNode = nextHintsNode;
    if (!nextHintsNode) {
      root.hidden = true;
      return;
    }

    hintsObserver.observe(nextHintsNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  const gameMountObserver = new MutationObserver((records) => {
    const hasRelevantMutation = records.some((record) => {
      const target = record.target;
      return !(target instanceof Node) || !root.contains(target);
    });

    if (!hasRelevantMutation) {
      return;
    }

    syncWordObserver();
    syncHintsObserver();
    scheduleRefresh();
  });

  const gameRoot = document.querySelector("#game");
  if (gameRoot) {
    gameMountObserver.observe(gameRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }

  syncWordObserver();
  syncHintsObserver();
  scheduleRefresh();
  render();
})();
