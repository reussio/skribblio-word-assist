# skribbl.io Helper

Chrome-Extension fuer `skribbl.io`, gebaut mit React, TypeScript und Vite.

## Aktueller Stand

- Content Script wird auf `skribbl.io` geladen.
- Wortlisten werden direkt aus dem Extension-Paket geladen.
- Die Vorschlaege werden direkt im Bereich `#game-word` unter den Hints eingeblendet.
- Bereits sichtbare Buchstaben werden mit `_`-Platzhaltern kombiniert, zum Beispiel `a__le`.
- Die Laenge kommt aus `#game-word > div.hints > div > div.word-length`, aufgedeckte Buchstaben aus `.hint.uncover`.
- Passende Woerter werden anhand der erkannten Spielsprache aus der passenden JSON-Datei vorgeschlagen.
- Die UI ist kompakt und orientiert sich am vorhandenen Spiel-Layout statt an einem separaten Popup.

## Dateien

- `manifest.json`: Manifest V3 fuer Chrome und Vorlage fuer den Build.
- `src/background.ts`: Laedt die mitgelieferten Wortlisten fuer das Content-Script.
- `src/content/`: React-UI, DOM-Erkennung, Pattern-Matching und Browser-Kommunikation.
- `resources/icons/`: Extension-Icons in allen benoetigten Groessen.
- `resources/word-lists/`: Mitgelieferte sprachspezifische Wortlisten.
- `vite.config.ts`: Erzeugt getrennte Bundles fuer Background- und Content-Script.

## Entwicklung

```sh
npm install
npm run check
npm run build
```

Der Build liegt anschliessend in `dist/`.

## Installation

1. In Chrome `chrome://extensions` oeffnen.
2. Entwickler-Modus aktivieren.
3. `Entpackte Erweiterung laden` waehlen.
4. Den erzeugten Ordner `dist/` auswaehlen.

## Packaging

Fuer ein vollstaendiges Store-Paket:

```sh
npm run package
```

Das erzeugt `dist/skribblio-word-assist.zip` inklusive Icons und Wortlisten.

## Hinweis

Aktuell sind Sprachcodes fuer `en`, `de`, `es`, `fr` und `ko` verdrahtet, passend zu den vorhandenen Dateien in `resources/word-lists`. Die Extension benoetigt fuer die Wortlisten keinen Netzwerkzugriff; Aktualisierungen werden mit einer neuen Extension-Version ausgeliefert.
