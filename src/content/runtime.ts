import type { LanguageCode, WordListRequest, WordListResponse } from "./model";

interface BrowserRuntime {
  sendMessage(message: WordListRequest): Promise<WordListResponse>;
}

interface BrowserGlobal {
  browser?: {
    runtime?: BrowserRuntime;
  };
}

const browserRuntimeApi =
  (globalThis as typeof globalThis & BrowserGlobal).browser?.runtime ?? null;
const chromeRuntimeApi = globalThis.chrome?.runtime ?? null;

export const runtimeAvailable = Boolean(
  browserRuntimeApi?.sendMessage ?? chromeRuntimeApi?.sendMessage
);

function sendRuntimeMessage(message: WordListRequest): Promise<WordListResponse> {
  if (browserRuntimeApi?.sendMessage) {
    return browserRuntimeApi.sendMessage(message);
  }

  if (!chromeRuntimeApi?.sendMessage) {
    return Promise.reject(new Error("Extension runtime unavailable"));
  }

  return new Promise((resolve, reject) => {
    chromeRuntimeApi.sendMessage(message, (response: WordListResponse) => {
      const error = chromeRuntimeApi.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response);
    });
  });
}

export async function loadRemoteWords(languageCode: LanguageCode): Promise<string[]> {
  const response = await sendRuntimeMessage({
    type: "skribbl-helper:get-word-list",
    languageCode
  });

  if (!response.ok) {
    throw new Error(response.error || "Failed to load word list");
  }

  return Array.isArray(response.words) ? response.words : [];
}
