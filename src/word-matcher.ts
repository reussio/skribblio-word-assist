import type { MatchCollection, WordEntry, WordMatch } from "./model";

export function normalizeLetters(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .replace(/[^\p{L}\p{N}_ .-]/gu, "");
}

export function normalizePattern(value: string): string {
  return normalizeLetters(value).trim();
}

function scoreMatch(word: string, pattern: string): number {
  let score = 0;

  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] !== "_" && word[index] === pattern[index]) {
      score += 2;
    }
    if (pattern[index] === "_") {
      score += 1;
    }
  }

  return score;
}

export function findMatches(
  words: readonly WordEntry[],
  excludedWords: ReadonlySet<string>,
  pattern: string,
  inputFilter = ""
): MatchCollection {
  if (!pattern) {
    return { total: 0, visible: [] };
  }

  const regex = new RegExp(`^${pattern.replace(/_/g, "[\\p{L}\\p{N}]")}$`, "u");
  const matches: WordMatch[] = words
    .filter((entry) => entry.normalized.length === pattern.length)
    .filter((entry) => regex.test(entry.normalized))
    .filter((entry) => !inputFilter || entry.normalized.includes(inputFilter))
    .filter((entry) => !excludedWords.has(entry.raw))
    .map((entry) => ({
      raw: entry.raw,
      normalized: entry.normalized,
      score: scoreMatch(entry.normalized, pattern)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.raw.localeCompare(right.raw);
    });

  return {
    total: matches.length,
    visible: matches.slice(0, 50)
  };
}
