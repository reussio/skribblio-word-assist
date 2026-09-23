#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repo_root="$(dirname "$script_dir")"
output_file="${1:-$repo_root/dist/skribblio-word-assist.zip}"
case "$output_file" in
  /*) ;;
  *) output_file="$repo_root/$output_file" ;;
esac
output_dir="$(dirname "$output_file")"

cd "$repo_root"
npm run build

mkdir -p "$output_dir"
rm -f "$output_file"

cd "$repo_root/dist"
zip -qr "$output_file" \
  manifest.json \
  background.js \
  content.css \
  content.js \
  resources
