import { FIXED_HINT_CHARACTERS, LANGUAGE_BY_LABEL, LANGUAGE_BY_VALUE } from "./constants";
import type { LanguageCode } from "./model";
import { normalizeLetters, normalizePattern } from "./word-matcher";

export interface PageMount {
  chatHost: Element | null;
  rootElement: HTMLDivElement;
  wrapperElement: HTMLDivElement;
}

interface ChatElements {
  form: HTMLFormElement;
  input: HTMLInputElement;
}

function getFixedHintCharacter(rawText: string): string | null {
  return FIXED_HINT_CHARACTERS.find((character) => rawText.includes(character)) ?? null;
}

export function isGameVisible(): boolean {
  const gameRoot = document.querySelector("#game");
  return gameRoot !== null && window.getComputedStyle(gameRoot).display !== "none";
}

export function getWordNode(): Element | null {
  return document.querySelector("#game-word");
}

export function getHintsNode(): Element | null {
  return document.querySelector("#game-word .hints");
}

export function isGuessPhase(wordContainer: Element): boolean {
  const descriptionNode = wordContainer.querySelector(".description");
  const description = (descriptionNode?.textContent ?? "").trim().toLowerCase();
  return description.includes("guess");
}

export function mountIntoPage(mount: PageMount): void {
  const chatContainer = document.querySelector("#game-chat");
  if (!chatContainer) {
    return;
  }

  if (!mount.chatHost?.isConnected) {
    const currentParent = chatContainer.parentElement;
    if (!currentParent || currentParent === mount.wrapperElement) {
      return;
    }
    mount.chatHost = currentParent;
  }

  if (!mount.chatHost || mount.chatHost === mount.wrapperElement) {
    return;
  }

  if (mount.wrapperElement.parentElement !== mount.chatHost) {
    mount.chatHost.insertBefore(mount.wrapperElement, chatContainer);
  }
  if (mount.rootElement.parentElement !== mount.wrapperElement) {
    mount.wrapperElement.appendChild(mount.rootElement);
  }
  if (chatContainer.parentElement !== mount.wrapperElement) {
    mount.wrapperElement.appendChild(chatContainer);
  }
}

function extractPatternFromGameWord(node: Element): string {
  const hintNodes = node.querySelectorAll(".hint");
  if (hintNodes.length > 0) {
    return Array.from(hintNodes, (hintNode) => {
      const rawText = hintNode.textContent ?? "";
      const fixedCharacter = getFixedHintCharacter(rawText);
      if (fixedCharacter) {
        return fixedCharacter;
      }
      if (hintNode.classList.contains("uncover")) {
        const normalizedText = normalizeLetters(rawText).replace(/_/g, "").replace(/ /g, "");
        return normalizedText[0] ?? "_";
      }
      return "_";
    }).join("");
  }

  const lengthNode = node.querySelector("div.hints > div > div.word-length");
  if (lengthNode) {
    const rawLength = Number.parseInt(lengthNode.textContent ?? "", 10);
    if (Number.isInteger(rawLength) && rawLength > 0) {
      return "_".repeat(rawLength);
    }
  }

  return "";
}

export function readPatternFromDom(mount: PageMount): string {
  const wordContainer = getWordNode();
  if (!wordContainer) {
    return "";
  }

  mountIntoPage(mount);
  if (!isGuessPhase(wordContainer)) {
    return "";
  }

  const pattern = extractPatternFromGameWord(wordContainer);
  return pattern.length >= 2 ? pattern : "";
}

export function readRoundSignatureFromDom(): string {
  const wordContainer = getWordNode();
  if (!wordContainer || !isGuessPhase(wordContainer)) {
    return "";
  }

  const hintNodes = wordContainer.querySelectorAll(".hint");
  if (hintNodes.length > 0) {
    return Array.from(hintNodes, (hintNode) => {
      const rawText = hintNode.textContent ?? "";
      return getFixedHintCharacter(rawText) ?? "_";
    }).join("");
  }

  const lengthNode = wordContainer.querySelector("div.hints > div > div.word-length");
  if (!lengthNode) {
    return "";
  }

  const rawLength = Number.parseInt(lengthNode.textContent ?? "", 10);
  return Number.isInteger(rawLength) && rawLength > 0 ? "_".repeat(rawLength) : "";
}

export function hasCurrentUserGuessed(): boolean {
  if (document.querySelector(".players-list .player.guessed .player-name.me")) {
    return true;
  }

  const guessedPlayers = document.querySelectorAll(".players-list .player.guessed");
  return Array.from(guessedPlayers).some((playerNode) => {
    const playerName = playerNode.querySelector(".player-name")?.textContent ?? "";
    return playerName.includes("(You)");
  });
}

function getChatElements(): ChatElements | null {
  const form = document.querySelector("#game-chat > form");
  const input = document.querySelector("#game-chat > form > input[type=text]");
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
    return null;
  }
  return { form, input };
}

export function getChatInput(): HTMLInputElement | null {
  return getChatElements()?.input ?? null;
}

export function getChatInputFilter(): string {
  return normalizePattern(getChatElements()?.input.value ?? "");
}

export function scrollChatToBottom(): void {
  const chatContent = document.querySelector("#game-chat .chat-content");
  if (chatContent instanceof HTMLElement) {
    chatContent.scrollTop = chatContent.scrollHeight;
  }
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
}

export function submitGuess(word: string): void {
  const chatElements = getChatElements();
  if (!chatElements) {
    return;
  }

  const { form, input } = chatElements;
  input.focus();
  setNativeInputValue(input, word);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true
    })
  );
  input.dispatchEvent(
    new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true
    })
  );

  if (input.value === word) {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  }
}

function getLanguageFromSelect(select: HTMLSelectElement): LanguageCode | null {
  const codeFromValue = LANGUAGE_BY_VALUE[select.value];
  if (codeFromValue) {
    return codeFromValue;
  }

  const selectedLabel = select.selectedOptions[0]?.textContent?.trim().toLowerCase();
  return selectedLabel ? (LANGUAGE_BY_LABEL[selectedLabel] ?? null) : null;
}

export function detectLanguage(): LanguageCode | null {
  const gameLanguageSelect = document.querySelector("#item-settings-language");
  if (gameLanguageSelect instanceof HTMLSelectElement) {
    return getLanguageFromSelect(gameLanguageSelect);
  }

  const homeLanguageSelect = document.querySelector("#home .container-name-lang select");
  if (homeLanguageSelect instanceof HTMLSelectElement) {
    return getLanguageFromSelect(homeLanguageSelect);
  }

  return "en";
}
