import type { LanguageCode } from "./model";

export const FIXED_HINT_CHARACTERS = [".", "-", " "] as const;

export const LANGUAGE_BY_VALUE: Readonly<Record<string, LanguageCode>> = {
  "0": "en",
  "1": "de",
  "7": "fr",
  "14": "ko",
  "24": "es"
};

export const LANGUAGE_BY_LABEL: Readonly<Record<string, LanguageCode>> = {
  english: "en",
  french: "fr",
  german: "de",
  korean: "ko",
  spanish: "es"
};

export const LANGUAGE_NAMES: Readonly<Record<LanguageCode, string>> = {
  de: "German",
  en: "English",
  es: "Spanish",
  fr: "French",
  ko: "Korean"
};
