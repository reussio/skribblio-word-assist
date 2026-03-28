const WORD_LIST_BASE_URL = "https://raw.githubusercontent.com/reussio/skribblio-word-assist/main/src/data";
const WORD_LIST_CACHE_VERSION = "1";
const WORD_LIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SUPPORTED_LANGUAGES = new Set(["en", "de", "es", "fr", "ko"]);

function getCacheKey(languageCode) {
  return `word-list:${WORD_LIST_CACHE_VERSION}:${languageCode}`;
}

function validateLanguageCode(languageCode) {
  if (!SUPPORTED_LANGUAGES.has(languageCode)) {
    throw new Error(`Unsupported language: ${languageCode}`);
  }
}

function normalizeWordList(payload) {
  if (!Array.isArray(payload)) {
    throw new Error("Word list response is not an array");
  }

  const words = payload
    .map((entry) => String(entry).trim())
    .filter(Boolean);

  if (words.length === 0) {
    throw new Error("Word list response is empty");
  }

  return words;
}

async function readCachedWordList(languageCode) {
  const cacheKey = getCacheKey(languageCode);
  const stored = await chrome.storage.local.get(cacheKey);
  const cacheEntry = stored[cacheKey];

  if (!cacheEntry || !Array.isArray(cacheEntry.words)) {
    return null;
  }

  return {
    words: cacheEntry.words,
    updatedAt: Number.isFinite(cacheEntry.updatedAt) ? cacheEntry.updatedAt : 0
  };
}

async function writeCachedWordList(languageCode, words) {
  await chrome.storage.local.set({
    [getCacheKey(languageCode)]: {
      words,
      updatedAt: Date.now()
    }
  });
}

function isCacheFresh(cacheEntry) {
  return Boolean(cacheEntry) && Date.now() - cacheEntry.updatedAt < WORD_LIST_CACHE_TTL_MS;
}

async function fetchRemoteWordList(languageCode) {
  const response = await fetch(`${WORD_LIST_BASE_URL}/${languageCode}.json`, {
    cache: "no-cache"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return normalizeWordList(await response.json());
}

async function loadWordList(languageCode) {
  validateLanguageCode(languageCode);

  const cachedWordList = await readCachedWordList(languageCode);
  if (isCacheFresh(cachedWordList)) {
    return { words: cachedWordList.words };
  }

  try {
    const words = await fetchRemoteWordList(languageCode);
    await writeCachedWordList(languageCode, words);
    return { words };
  } catch (error) {
    if (cachedWordList) {
      return { words: cachedWordList.words };
    }

    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "skribbl-helper:get-word-list") {
    return false;
  }

  loadWordList(message.languageCode)
    .then((result) => {
      sendResponse({ ok: true, ...result });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });

  return true;
});
