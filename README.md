# skribbl.io Helper

Erster Prototyp einer Chrome-Extension fuer `skribbl.io`.

## Aktueller Stand

- Content Script wird auf `skribbl.io` geladen.
- Wortlisten werden vom Background-Service-Worker aus GitHub geladen und lokal gecached.
- Die Vorschlaege werden direkt im Bereich `#game-word` unter den Hints eingeblendet.
- Bereits sichtbare Buchstaben werden mit `_`-Platzhaltern kombiniert, zum Beispiel `a__le`.
- Die Laenge kommt aus `#game-word > div.hints > div > div.word-length`, aufgedeckte Buchstaben aus `.hint.uncover`.
- Passende Woerter werden anhand der erkannten Spielsprache aus der passenden JSON-Datei vorgeschlagen.
- Die UI ist kompakt und orientiert sich am vorhandenen Spiel-Layout statt an einem separaten Popup.

## Dateien

- `manifest.json`: Manifest V3 fuer Chrome.
- `src/background.js`: Laedt Wortlisten remote von GitHub und nutzt `chrome.storage.local` als Cache.
- `src/data/*.json`: Sprachspezifische Wortlisten als GitHub-Datenquelle, nicht mehr als `web_accessible_resources`.
- `src/content.js`: DOM-Erkennung, Pattern-Matching und Overlay-UI.
- `src/content.css`: Styling des Overlays.

## Installation

1. In Chrome `chrome://extensions` oeffnen.
2. Entwickler-Modus aktivieren.
3. `Entpackte Erweiterung laden` waehlen.
4. Diesen Ordner auswaehlen.

## Packaging

Fuer ein Store-Paket ohne mitgelieferte Wortlisten:

```sh
sh scripts/package-extension.sh
```

Das erzeugt `dist/skribblio-word-assist.zip` und laesst `src/data/` bewusst aus.

## Hinweis

Aktuell sind Sprachcodes fuer `en`, `de`, `es`, `fr` und `ko` verdrahtet, passend zu den vorhandenen Dateien in `src/data`. Beim ersten Laden braucht die Extension Netzwerkzugriff auf `raw.githubusercontent.com`. Danach nutzt sie die gecachte Liste fuer 24 Stunden; nach Ablauf wird GitHub beim naechsten Nutzen der jeweiligen Sprache erneut abgefragt. Wenn GitHub dann nicht erreichbar ist, nutzt sie die zuletzt erfolgreich geladene Liste weiter.
