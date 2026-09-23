import type { LanguageCode, WordListRequest, WordListResponse } from "./content/model";

const WORD_LIST_BASE_URL =
  "https://raw.githubusercontent.com/reussio/skribblio-word-assist/main/src/data";
const WORD_LIST_CACHE_VERSION = "1";
const WORD_LIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SUPPORTED_LANGUAGES = new Set<LanguageCode>(["en", "de", "es", "fr", "ko"]);

interface CacheEntry {
  updatedAt: number;
  words: string[];
}

function getCacheKey(languageCode: LanguageCode): string {
  return `word-list:${WORD_LIST_CACHE_VERSION}:${languageCode}`;
}

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

async function readCachedWordList(languageCode: LanguageCode): Promise<CacheEntry | null> {
  const cacheKey = getCacheKey(languageCode);
  const stored = await chrome.storage.local.get(cacheKey);
  const cacheEntry = stored[cacheKey] as Partial<CacheEntry> | undefined;

  if (!cacheEntry || !Array.isArray(cacheEntry.words)) {
    return null;
  }

  return {
    words: cacheEntry.words,
    updatedAt: Number.isFinite(cacheEntry.updatedAt) ? (cacheEntry.updatedAt ?? 0) : 0
  };
}

async function writeCachedWordList(languageCode: LanguageCode, words: string[]): Promise<void> {
  await chrome.storage.local.set({
    [getCacheKey(languageCode)]: {
      words,
      updatedAt: Date.now()
    }
  });
}

function isCacheFresh(cacheEntry: CacheEntry): boolean {
  return Date.now() - cacheEntry.updatedAt < WORD_LIST_CACHE_TTL_MS;
}

async function fetchRemoteWordList(languageCode: LanguageCode): Promise<string[]> {
  const response = await fetch(`${WORD_LIST_BASE_URL}/${languageCode}.json`, {
    cache: "no-cache"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return normalizeWordList(await response.json());
}

async function loadWordList(languageCode: LanguageCode): Promise<string[]> {
  const cachedWordList = await readCachedWordList(languageCode);
  if (cachedWordList && isCacheFresh(cachedWordList)) {
    return cachedWordList.words;
  }

  try {
    const words = await fetchRemoteWordList(languageCode);
    await writeCachedWordList(languageCode, words);
    return words;
  } catch (error) {
    if (cachedWordList) {
      return cachedWordList.words;
    }

    throw error;
  }
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
