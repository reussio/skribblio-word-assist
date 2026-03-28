#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repo_root="$(dirname "$script_dir")"
output_file="${1:-$repo_root/dist/skribblio-word-assist.zip}"
output_dir="$(dirname "$output_file")"

mkdir -p "$output_dir"
rm -f "$output_file"

cd "$repo_root"

zip -qr "$output_file" \
  manifest.json \
  src/background.js \
  src/content.css \
  src/content.js \
  icons
