import type { LanguageCode } from "./model";

interface BrowserRuntime {
  getURL(path: string): string;
}

interface BrowserGlobal {
  browser?: {
    runtime?: BrowserRuntime;
  };
}

const browserRuntimeApi =
  (globalThis as typeof globalThis & BrowserGlobal).browser?.runtime ?? null;
const chromeRuntimeApi = globalThis.chrome?.runtime ?? null;
const runtimeApi = browserRuntimeApi ?? chromeRuntimeApi;

export const runtimeAvailable = Boolean(runtimeApi?.getURL);

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

export async function loadPackagedWords(languageCode: LanguageCode): Promise<string[]> {
  if (!runtimeApi?.getURL) {
    throw new Error("Extension runtime unavailable");
  }

  const resourceUrl = runtimeApi.getURL(`resources/word-lists/${languageCode}.json`);
  const response = await fetch(resourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to load ${languageCode} word list: HTTP ${response.status}`);
  }

  return normalizeWordList(await response.json());
}
