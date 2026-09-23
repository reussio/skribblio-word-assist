export type LanguageCode = "de" | "en" | "es" | "fr" | "ko";

export interface WordEntry {
  normalized: string;
  raw: string;
}

export interface WordMatch extends WordEntry {
  score: number;
}

export interface MatchCollection {
  total: number;
  visible: WordMatch[];
}

export interface GameSnapshot {
  activeLanguage: LanguageCode;
  excludedWords: ReadonlySet<string>;
  inputFilter: string;
  inputFilterEnabled: boolean;
  isSolved: boolean;
  pattern: string;
  runtimeAvailable: boolean;
  visible: boolean;
  words: readonly WordEntry[];
}
