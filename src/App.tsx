import { useEffect, useMemo, useSyncExternalStore } from "react";
import { LANGUAGE_NAMES } from "./constants";
import type { GameController } from "./GameController";
import { SuggestionList } from "./SuggestionList";
import { findMatches } from "./word-matcher";

interface AppProps {
  controller: GameController;
}

export function App({ controller }: AppProps) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  useEffect(() => controller.start(), [controller]);

  const matches = useMemo(
    () =>
      findMatches(snapshot.words, snapshot.excludedWords, snapshot.pattern, snapshot.inputFilter),
    [snapshot.words, snapshot.excludedWords, snapshot.pattern, snapshot.inputFilter]
  );

  const countLabel = snapshot.isSolved
    ? "Solved"
    : !snapshot.runtimeAvailable
      ? "Extension error"
      : matches.total > 50
        ? "> 50 matches"
        : matches.total === 1
          ? "1 match"
          : `${matches.total} matches`;

  return (
    <div className="skribbl-helper-panel">
      <div
        className={`skribbl-helper-summary${snapshot.isSolved ? " skribbl-helper-summary--standalone" : ""}`}
      >
        <div className="skribbl-helper-summary-text">
          <span className="skribbl-helper-title">Matches</span>
          <span className="skribbl-helper-meta">
            {countLabel} · {LANGUAGE_NAMES[snapshot.activeLanguage]}
          </span>
        </div>
        <label className="skribbl-helper-toggle">
          <input
            checked={snapshot.inputFilterEnabled}
            onChange={(event) => controller.setInputFilterEnabled(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>Filter by Chat</span>
        </label>
      </div>
      {!snapshot.isSolved && (
        <div className="skribbl-helper-body">
          <ul className="skribbl-helper-list">
            <SuggestionList
              matches={matches.visible}
              onSelect={(word) => controller.selectWord(word)}
              runtimeAvailable={snapshot.runtimeAvailable}
            />
          </ul>
        </div>
      )}
    </div>
  );
}
