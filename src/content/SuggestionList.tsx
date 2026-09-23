import type { KeyboardEvent, PointerEvent } from "react";
import type { WordMatch } from "./model";

interface SuggestionListProps {
  isSolved: boolean;
  matches: readonly WordMatch[];
  onSelect: (word: string) => void;
  runtimeAvailable: boolean;
}

export function SuggestionList({
  isSolved,
  matches,
  onSelect,
  runtimeAvailable
}: SuggestionListProps) {
  if (isSolved) {
    return <li className="skribbl-helper-empty">Successfully guessed</li>;
  }

  if (!runtimeAvailable) {
    return <li className="skribbl-helper-empty">Extension runtime unavailable</li>;
  }

  if (matches.length === 0) {
    return <li className="skribbl-helper-empty">No matches</li>;
  }

  return matches.map((match) => {
    const selectWord = (event: KeyboardEvent | PointerEvent) => {
      event.preventDefault();
      onSelect(match.raw);
    };

    return (
      <li key={match.raw}>
        <button
          className="skribbl-helper-item"
          data-word={match.raw}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              selectWord(event);
            }
          }}
          onPointerDown={selectWord}
          type="button"
        >
          <span className="skribbl-helper-word">{match.raw}</span>
        </button>
      </li>
    );
  });
}
