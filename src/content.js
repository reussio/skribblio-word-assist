(() => {
  const game = globalThis.SKRIBBL_WORD_ASSIST_GAME;

  const state = {
    autoPattern: "",
    activeLanguage: "en",
    runtimeAvailable: Boolean(globalThis.chrome?.runtime?.getURL ?? globalThis.browser?.runtime?.getURL),
    words: [],
    roundSignature: "",
    excludedWords: new Set(),
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
        <span class="skribbl-helper-title" data-role="title">Matches</span>
        <span class="skribbl-helper-meta" data-role="match-count">0 matches</span>
      </div>
      <div class="skribbl-helper-body">
        <ul class="skribbl-helper-list" data-role="suggestions"></ul>
      </div>
    </div>
  `;

  const titleLabel = root.querySelector('[data-role="title"]');
  const matchCountLabel = root.querySelector('[data-role="match-count"]');
  const suggestionsList = root.querySelector('[data-role="suggestions"]');

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

      const label = document.createElement("span");
      label.className = "skribbl-helper-word";
      label.textContent = match.raw;

      item.appendChild(label);
      suggestionsList.appendChild(item);
    });
  }

  function renderGuessedState() {
    suggestionsList.textContent = "";
    const item = document.createElement("li");
    item.className = "skribbl-helper-empty";
    item.textContent = "Successfully guessed";
    suggestionsList.appendChild(item);
  }

  function render() {
    const pattern = state.autoPattern;
    const isSolved = game.hasCurrentUserGuessed();
    const matches = game.findMatches(state, pattern);
    const wordContainer = game.getWordNode();
    const shouldShowRuntimeError = !state.runtimeAvailable;
    const shouldShow =
      game.isGameVisible() &&
      Boolean(wordContainer) &&
      game.isGuessPhase(wordContainer) &&
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

    const languageLabel = game.LANGUAGE_NAMES[state.activeLanguage] || state.activeLanguage.toUpperCase();
    titleLabel.textContent = isSolved ? "Guessed" : "Matches";
    matchCountLabel.textContent = `${countLabel} · ${languageLabel}`;

    if (isSolved) {
      renderGuessedState();
    } else {
      renderSuggestions(matches.visible);
    }

    if (shouldShow && visibilityChanged) {
      requestAnimationFrame(() => {
        game.scrollChatToBottom();
      });
    }
  }

  function handleWordSelection(word) {
    state.excludedWords.add(word);
    game.submitGuess(word);
    render();
  }

  suggestionsList.addEventListener("click", (event) => {
    const item = event.target.closest(".skribbl-helper-item");
    if (item instanceof HTMLElement && item.dataset.word) {
      handleWordSelection(item.dataset.word);
    }
  });

  suggestionsList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const item = event.target.closest(".skribbl-helper-item");
    if (!(item instanceof HTMLElement) || !item.dataset.word) {
      return;
    }

    event.preventDefault();
    handleWordSelection(item.dataset.word);
  });

  async function refreshAutoPattern() {
    syncWordObserver();
    syncHintsObserver();

    if (!game.isGameVisible()) {
      root.hidden = true;
      if (state.autoPattern) {
        state.autoPattern = "";
      }
      return;
    }

    const nextLanguage = game.detectLanguage();
    if (!nextLanguage) {
      state.words = [];
      render();
      return;
    }

    if (nextLanguage !== state.activeLanguage || state.words.length === 0) {
      await game.ensureWordsForLanguage(state, nextLanguage);
    }

    const nextRoundSignature = game.readRoundSignatureFromDom();
    if (nextRoundSignature !== state.roundSignature) {
      state.roundSignature = nextRoundSignature;
      state.excludedWords.clear();
    }

    const nextPattern = game.normalizePattern(game.readPatternFromDom(state, root));
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
    const nextWordNode = game.getWordNode();
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
    const nextHintsNode = game.getHintsNode();
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

  const gameMountObserver = new MutationObserver(() => {
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
