#!/usr/bin/env sh
# Run from the repository root with ImageMagick installed.
set -eu
mkdir -p static/icons
mark=src/lib/assets/facet-80.png

# Launchers choose the displayed size. Target a 36px mark on a 60px tile.
tile() {
	height=$(( ($1 * 3 + 2) / 5 ))
	magick "$mark" -resize "x$height" -background '#08080a' -gravity center \
		-extent "${1}x${1}" -alpha remove -strip "PNG24:$2"
}

tile 180 static/apple-touch-icon.png
tile 192 static/icons/icon-192.png
tile 512 static/icons/icon-512.png
cp static/icons/icon-512.png static/icons/icon-maskable-512.png

# Keep the public SVG URL and the conventional multi-resolution ICO fallback.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
magick "$mark" -resize x64 -background none -gravity center -extent 64x64 -strip "$tmp/tab.png"
magick "$tmp/tab.png" -define icon:auto-resize=64,32,16 static/favicon.ico
{
	printf '%s' '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,'
	base64 < "$tmp/tab.png" | tr -d '\n'
	printf '%s\n' '"/></svg>'
} > static/favicon.svg
