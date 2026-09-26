# Skribbl.io Word Assist

Skribbl.io Word Assist is a Chrome extension that shows matching word suggestions during guessing rounds on [skribbl.io](https://skribbl.io/).

The extension reads the current word length and revealed letters, compares them with a bundled language-specific dictionary, and displays up to 50 matching words next to the chat. Everything runs locally in the browser.

## Features

- Updates suggestions automatically as letters are revealed.
- Detects the active game language.
- Filters suggestions using the regular chat input.
- Submits a suggestion when it is clicked.
- Removes words that have already been submitted during the current round.
- Uses bundled word lists without external API requests.
- Integrates directly into the existing skribbl.io layout.

## Supported languages

- English
- German
- French
- Spanish
- Korean

## Installation

### Chrome Web Store

Install the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/pkehacnkgcbmiogdaoomiiahbeamgoim).

### Local installation

Requirements:

- Chrome 114 or newer
- [Bun](https://bun.sh/)

Clone and build the project:

```sh
git clone https://github.com/reussio/skribblio-word-assist.git
cd skribblio-word-assist
bun install
bun run build
```

Load the generated extension in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist/` directory.

After rebuilding, reload the extension from `chrome://extensions` and refresh the skribbl.io tab.

## Development

```sh
bun install
bun run check
bun run build
```

Available commands:

| Command | Description |
| --- | --- |
| `bun run check` | Run the TypeScript and Biome checks |
| `bun run typecheck` | Run TypeScript without emitting files |
| `bun run lint` | Check the repository with Biome |
| `bun run format` | Format the repository with Biome |
| `bun run build` | Build the unpacked extension in `dist/` |
| `bun run package` | Create `dist/skribblio-word-assist.zip` for release |

## Project structure

```text
src/                Extension source code
resources/icons/    Extension icons
resources/word-lists/
                    Bundled language dictionaries
scripts/            Build and packaging scripts
store-assets/       Chrome Web Store assets
manifest.json       Chrome extension manifest
vite.config.ts      Production build configuration
```

The extension is built as a Manifest V3 content script with React, TypeScript, and Vite. It does not use a popup or background service worker.

## Privacy

Skribbl.io Word Assist does not collect, store, or transmit personal data. It does not include analytics or tracking and does not contact an external service for word matching.

The extension only reads the visible game state and the local chat input required to filter and submit suggestions. All dictionaries are included in the extension package.

## Disclaimer

This is an independent, unofficial project and is not affiliated with or endorsed by skribbl.io.
