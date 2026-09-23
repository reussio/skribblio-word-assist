import {
  detectLanguage,
  getChatElements,
  getChatInputFilter,
  getHintsNode,
  getWordNode,
  hasCurrentUserGuessed,
  isGameVisible,
  isGuessPhase,
  isRoundResolved,
  type PageMount,
  readPatternFromDom,
  readRoundSignatureFromDom,
  scrollChatToBottom,
  submitGuess
} from "./game-dom";
import type { GameSnapshot, LanguageCode, WordEntry } from "./model";
import { loadPackagedWords, runtimeAvailable } from "./runtime";
import { excludeSubmittedWord, normalizeLetters, normalizePattern } from "./word-matcher";

type Listener = () => void;

export class GameController {
  private readonly listeners = new Set<Listener>();
  private readonly loadedLanguages = new Map<LanguageCode, readonly WordEntry[]>();
  private readonly mount: PageMount;
  private readonly hintsObserver: MutationObserver;
  private readonly wordObserver: MutationObserver;
  private readonly gameMountObserver: MutationObserver;
  private snapshot: GameSnapshot;
  private roundSignature = "";
  private observedHintsNode: Element | null = null;
  private observedWordNode: Element | null = null;
  private boundChatInput: HTMLInputElement | null = null;
  private boundChatForm: HTMLFormElement | null = null;
  private refreshFrame: number | null = null;
  private started = false;

  constructor(rootElement: HTMLDivElement, wrapperElement: HTMLDivElement) {
    this.mount = { chatHost: null, rootElement, wrapperElement };
    this.snapshot = {
      activeLanguage: "en",
      excludedWords: new Set(),
      inputFilter: "",
      inputFilterEnabled: true,
      isSolved: false,
      pattern: "",
      runtimeAvailable,
      visible: false,
      words: []
    };

    this.hintsObserver = new MutationObserver(this.scheduleRefresh);
    this.wordObserver = new MutationObserver(() => {
      this.syncHintsObserver();
      this.scheduleRefresh();
    });
    this.gameMountObserver = new MutationObserver((records) => {
      const hasRelevantMutation = records.some(
        (record) => !(record.target instanceof Node) || !rootElement.contains(record.target)
      );

      if (hasRelevantMutation) {
        this.syncWordObserver();
        this.syncHintsObserver();
        this.scheduleRefresh();
      }
    });
  }

  readonly getSnapshot = (): GameSnapshot => this.snapshot;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  start(): () => void {
    if (this.started) {
      return () => this.stop();
    }

    this.started = true;
    const gameRoot = document.querySelector("#game");
    if (gameRoot) {
      this.gameMountObserver.observe(gameRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    }

    this.syncWordObserver();
    this.syncHintsObserver();
    this.scheduleRefresh();
    return () => this.stop();
  }

  setInputFilterEnabled(enabled: boolean): void {
    this.setSnapshot({
      ...this.snapshot,
      inputFilter: enabled ? getChatInputFilter() : "",
      inputFilterEnabled: enabled
    });
  }

  selectWord(word: string): void {
    this.excludeWord(word);
    submitGuess(word);
  }

  private stop(): void {
    this.started = false;
    this.hintsObserver.disconnect();
    this.wordObserver.disconnect();
    this.gameMountObserver.disconnect();
    this.bindChatElements(null);

    if (this.refreshFrame !== null) {
      cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = null;
    }
  }

  private readonly scheduleRefresh = (): void => {
    if (this.refreshFrame !== null) {
      return;
    }

    this.refreshFrame = requestAnimationFrame(() => {
      this.refreshFrame = null;
      void this.refresh();
    });
  };

  private readonly handleChatInput = (): void => {
    if (this.snapshot.inputFilterEnabled) {
      this.setSnapshot({ ...this.snapshot, inputFilter: getChatInputFilter() });
    }
  };

  private readonly handleChatKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" && !event.isComposing) {
      this.excludeSubmittedChatInput();
    }
  };

  private readonly handleChatSubmit = (): void => {
    this.excludeSubmittedChatInput();
  };

  private excludeSubmittedChatInput(): void {
    if (!this.snapshot.pattern || !this.boundChatInput) {
      return;
    }

    const excludedWords = excludeSubmittedWord(
      this.snapshot.words,
      this.snapshot.excludedWords,
      this.boundChatInput.value
    );
    if (excludedWords !== this.snapshot.excludedWords) {
      this.setSnapshot({ ...this.snapshot, excludedWords });
    }
  }

  private excludeWord(word: string): void {
    const excludedWords = new Set(this.snapshot.excludedWords);
    excludedWords.add(word);
    this.setSnapshot({ ...this.snapshot, excludedWords });
  }

  private bindChatElements(elements: ReturnType<typeof getChatElements>): void {
    if (elements?.input === this.boundChatInput && elements?.form === this.boundChatForm) {
      return;
    }

    this.boundChatInput?.removeEventListener("input", this.handleChatInput);
    this.boundChatInput?.removeEventListener("keydown", this.handleChatKeyDown, true);
    this.boundChatForm?.removeEventListener("submit", this.handleChatSubmit, true);

    this.boundChatInput = elements?.input ?? null;
    this.boundChatForm = elements?.form ?? null;

    this.boundChatInput?.addEventListener("input", this.handleChatInput);
    this.boundChatInput?.addEventListener("keydown", this.handleChatKeyDown, true);
    this.boundChatForm?.addEventListener("submit", this.handleChatSubmit, true);
  }

  private syncWordObserver(): void {
    const nextWordNode = getWordNode();
    if (nextWordNode === this.observedWordNode) {
      return;
    }

    this.wordObserver.disconnect();
    this.observedWordNode = nextWordNode;
    if (!nextWordNode) {
      return;
    }

    this.wordObserver.observe(nextWordNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });
  }

  private syncHintsObserver(): void {
    const nextHintsNode = getHintsNode();
    if (nextHintsNode === this.observedHintsNode) {
      return;
    }

    this.hintsObserver.disconnect();
    this.observedHintsNode = nextHintsNode;
    if (!nextHintsNode) {
      this.mount.rootElement.hidden = true;
      return;
    }

    this.hintsObserver.observe(nextHintsNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  private async ensureWordsForLanguage(languageCode: LanguageCode): Promise<readonly WordEntry[]> {
    if (this.loadedLanguages.has(languageCode)) {
      return this.loadedLanguages.get(languageCode) ?? [];
    }

    if (!runtimeAvailable) {
      this.loadedLanguages.set(languageCode, []);
      return [];
    }

    try {
      const payload = await loadPackagedWords(languageCode);
      const words = payload
        .map((entry): WordEntry | null => {
          const raw = String(entry);
          const normalized = normalizeLetters(raw);
          return normalized ? { raw, normalized } : null;
        })
        .filter((entry): entry is WordEntry => entry !== null);

      this.loadedLanguages.set(languageCode, words);
      return words;
    } catch (error) {
      console.error("skribbl-helper: failed to load word list", languageCode, error);
      this.loadedLanguages.set(languageCode, []);
      return [];
    }
  }

  private async refresh(): Promise<void> {
    this.syncWordObserver();
    this.syncHintsObserver();
    this.bindChatElements(getChatElements());

    if (!isGameVisible()) {
      this.setSnapshot({ ...this.snapshot, pattern: "", visible: false });
      return;
    }

    const nextLanguage = detectLanguage();
    if (!nextLanguage) {
      this.updateView({ words: [] });
      return;
    }

    let words = this.snapshot.words;
    if (nextLanguage !== this.snapshot.activeLanguage || words.length === 0) {
      words = await this.ensureWordsForLanguage(nextLanguage);
    }

    if (!this.started) {
      return;
    }

    const nextRoundSignature = readRoundSignatureFromDom();
    const excludedWords =
      nextRoundSignature === this.roundSignature ? this.snapshot.excludedWords : new Set<string>();
    this.roundSignature = nextRoundSignature;

    const pattern = normalizePattern(readPatternFromDom(this.mount));
    this.updateView({
      activeLanguage: nextLanguage,
      excludedWords,
      pattern,
      words
    });
  }

  private updateView(changes: Partial<GameSnapshot>): void {
    const wordContainer = getWordNode();
    const isSolved = hasCurrentUserGuessed();
    const roundResolved = isRoundResolved(wordContainer);
    const nextSnapshot: GameSnapshot = {
      ...this.snapshot,
      ...changes,
      inputFilter: this.snapshot.inputFilterEnabled ? getChatInputFilter() : "",
      isSolved,
      visible:
        isGameVisible() &&
        Boolean(wordContainer) &&
        Boolean(wordContainer && isGuessPhase(wordContainer)) &&
        (!roundResolved || isSolved) &&
        (Boolean(changes.pattern ?? this.snapshot.pattern) || !this.snapshot.runtimeAvailable)
    };

    const wasVisible = this.snapshot.visible;
    this.setSnapshot(nextSnapshot);
    if (nextSnapshot.visible && !wasVisible) {
      requestAnimationFrame(scrollChatToBottom);
    }
  }

  private setSnapshot(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
    this.mount.rootElement.hidden = !snapshot.visible;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
