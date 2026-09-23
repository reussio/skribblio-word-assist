import type { LanguageCode, WordListRequest, WordListResponse } from "./content/model";

const SUPPORTED_LANGUAGES = new Set<LanguageCode>(["en", "de", "es", "fr", "ko"]);

function isWordListRequest(message: unknown): message is WordListRequest {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const request = message as Partial<WordListRequest>;
  return (
    request.type === "skribbl-helper:get-word-list" &&
    typeof request.languageCode === "string" &&
    SUPPORTED_LANGUAGES.has(request.languageCode as LanguageCode)
  );
}

function normalizeWordList(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    throw new Error("Word list response is not an array");
  }

  const words = payload.map((entry) => String(entry).trim()).filter(Boolean);
  if (words.length === 0) {
    throw new Error("Word list response is empty");
  }

  return words;
}

async function loadWordList(languageCode: LanguageCode): Promise<string[]> {
  const resourceUrl = chrome.runtime.getURL(`resources/word-lists/${languageCode}.json`);
  const response = await fetch(resourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to load ${languageCode} word list: HTTP ${response.status}`);
  }

  return normalizeWordList(await response.json());
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isWordListRequest(message)) {
    return false;
  }

  loadWordList(message.languageCode)
    .then((words) => {
      const response: WordListResponse = { ok: true, words };
      sendResponse(response);
    })
    .catch((error: unknown) => {
      const response: WordListResponse = {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
      sendResponse(response);
    });

  return true;
});
