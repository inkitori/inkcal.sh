#!/usr/bin/env bash
# macify-icon.sh — convert a square image into a macOS-style app icon
# (1024x1024, squircle mask, ~10% transparent padding).
#
# usage:
#   ./scripts/macify-icon.sh <input> [output]
#
# defaults output to build/icon.png if omitted.
# requires: imagemagick (`brew install imagemagick`).

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <input> [output]" >&2
  exit 1
fi

input="$1"
output="${2:-build/icon.png}"

if ! command -v magick >/dev/null 2>&1; then
  echo "error: imagemagick not found. install with: brew install imagemagick" >&2
  exit 1
fi

if [[ ! -f "$input" ]]; then
  echo "error: input file not found: $input" >&2
  exit 1
fi

mkdir -p "$(dirname "$output")"
tmp="$(mktemp -t macify-icon.XXXXXX).png"
trap 'rm -f "$tmp"' EXIT

# resize to the 824 icon body, mask with a squircle (radius scaled from
# Apple's 1024-canvas template: ~150 for 824), then center on a 1024
# transparent canvas to leave the standard ~100px padding.
magick "$input" -resize 824x824^ -gravity center -extent 824x824 \
  \( +clone -alpha extract -fill black -colorize 100 \
     -fill white -draw "roundrectangle 0,0 823,823 150,150" \) \
  -alpha off -compose CopyOpacity -composite \
  "$tmp"

magick -size 1024x1024 xc:none "$tmp" -gravity center -composite "$output"

echo "wrote $output"
