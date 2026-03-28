# skribbl.io Helper

Erster Prototyp einer Chrome-Extension fuer `skribbl.io`.

## Aktueller Stand

- Content Script wird auf `skribbl.io` geladen.
- Wortlisten werden aus `src/data/*.json` geladen.
- Die Vorschlaege werden direkt im Bereich `#game-word` unter den Hints eingeblendet.
- Bereits sichtbare Buchstaben werden mit `_`-Platzhaltern kombiniert, zum Beispiel `a__le`.
- Die Laenge kommt aus `#game-word > div.hints > div > div.word-length`, aufgedeckte Buchstaben aus `.hint.uncover`.
- Passende Woerter werden anhand der erkannten Spielsprache aus der passenden JSON-Datei vorgeschlagen.
- Die UI ist kompakt und orientiert sich am vorhandenen Spiel-Layout statt an einem separaten Popup.

## Dateien

- `manifest.json`: Manifest V3 fuer Chrome.
- `src/data/*.json`: Sprachspezifische Wortlisten.
- `src/content.js`: DOM-Erkennung, Pattern-Matching und Overlay-UI.
- `src/content.css`: Styling des Overlays.

## Installation

1. In Chrome `chrome://extensions` oeffnen.
2. Entwickler-Modus aktivieren.
3. `Entpackte Erweiterung laden` waehlen.
4. Diesen Ordner auswaehlen.

## Hinweis

Aktuell sind Sprachcodes fuer `en`, `de`, `es`, `fr` und `ko` verdrahtet, passend zu den vorhandenen Dateien in `src/data`.
