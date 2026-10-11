#!/usr/bin/env sh
# Renders the app icons from assets/*.svg into static/. Needs ImageMagick (`magick`).
# Run from the repo root: sh scripts/generate-icons.sh
set -eu

mkdir -p static/icons

render() {
	# $1 source svg, $2 output png, $3 size
	magick -background none -density 600 "$1" -resize "${3}x${3}" -strip "PNG24:$2"
}

render assets/icon.svg static/icons/icon-192.png 192
render assets/icon.svg static/icons/icon-512.png 512
render assets/icon-maskable.svg static/icons/icon-maskable-512.png 512
# iOS fills transparency with black, so this one is opaque and full-bleed.
render assets/icon.svg static/apple-touch-icon.png 180

# The favicon is the same artwork with rounded corners for browser tabs.
sed 's|<rect width="512" height="512" fill="#1c1c25"/>|<rect width="512" height="512" rx="112" fill="#1c1c25"/>|' \
	assets/icon.svg > static/favicon.svg

echo "Icons written to static/"
