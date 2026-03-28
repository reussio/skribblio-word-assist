# Chrome Web Store Listing

## Name

Skribbl.io Word Assist

## Summary

Gives you potential answers on skribbl.io

## Description

Skribbl.io Word Assist is a Chrome extension that provides potential answers automatically while you are guessing on skribbl.io. It reads the visible hints from the game, interprets revealed letters and spaces, and shows matching answers in a compact panel next to the chat.

Features:

- Support for English, German, Spanish, Korean and French
- Detects revealed letters directly from the skribbl.io hint boxes
- Supports multi-word answers with spaces for better filtering
- Filter matches live by what you type into the chat input
- Click on a word to submit it directly into the chat
- Shows up to 50 matching results in a compact panel above the chat
- Updates automatically when new hints are revealed

Privacy:

- No account required
- No personal data collection by the extension itself
- All matching is done locally in the browser

## Category

Fun

## Language

English

## Store Assets

- Recommended local folder: `store-assets/`
- Suggested files:
- `store-assets/screenshot-1.png`
- `store-assets/screenshot-2.png`
- `store-assets/screenshot-3.png`
- `store-assets/icon-128.png`
- `img.png` can be used as a base reference for store imagery if needed

## Notes Before Publishing

- Add proper extension icons in 16, 32, 48, and 128 px and reference them in `manifest.json`
- Verify the final store description matches the exact supported languages and features
- Prepare screenshots from the final in-game UI
- Build the upload zip with `sh scripts/package-extension.sh` so `src/data/` is not included in the extension package
