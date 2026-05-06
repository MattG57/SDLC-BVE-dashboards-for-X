#!/usr/bin/env bash
# scripts/screenshot.sh — Take a headless Chrome screenshot of a dashboard
#
# Usage:
#   npm run screenshot -- http://127.0.0.1:8080/v3/ai-assisted-efficiency/
#   npm run screenshot -- http://127.0.0.1:8080/v3/ai-assisted-efficiency/ output.png
#   npm run screenshot -- http://127.0.0.1:8080/v3/ai-assisted-efficiency/ output.png 1600x1200
#
# Requirements:
#   - Google Chrome installed (macOS, Linux, or Windows)
#   - Local server running (npm run serve)
#
# The --virtual-time-budget flag gives React 5 seconds to render before capture.

set -euo pipefail

URL="${1:-}"
OUTPUT="${2:-screenshot.png}"
SIZE="${3:-1600x1200}"

if [ -z "$URL" ]; then
  echo "Usage: npm run screenshot -- <url> [output.png] [widthxheight]"
  echo ""
  echo "Examples:"
  echo "  npm run screenshot -- http://127.0.0.1:8080/v3/ai-assisted-efficiency/"
  echo "  npm run screenshot -- http://127.0.0.1:8080/dataflow/ dataflow.png 1400x1000"
  exit 1
fi

WIDTH="${SIZE%x*}"
HEIGHT="${SIZE#*x}"

# Find Chrome
CHROME=""
if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif command -v google-chrome &>/dev/null; then
  CHROME="google-chrome"
elif command -v google-chrome-stable &>/dev/null; then
  CHROME="google-chrome-stable"
elif command -v chromium-browser &>/dev/null; then
  CHROME="chromium-browser"
elif command -v chromium &>/dev/null; then
  CHROME="chromium"
elif [ -x "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" ]; then
  CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
fi

if [ -z "$CHROME" ]; then
  echo "❌ Chrome not found. Install Google Chrome to use screenshots."
  echo "   macOS: brew install --cask google-chrome"
  echo "   Linux: sudo apt install google-chrome-stable"
  exit 1
fi

echo "📸 Capturing: $URL"
echo "   Size: ${WIDTH}x${HEIGHT}"
echo "   Output: $OUTPUT"

"$CHROME" \
  --headless \
  --disable-gpu \
  --screenshot="$OUTPUT" \
  --window-size="${WIDTH},${HEIGHT}" \
  --virtual-time-budget=5000 \
  "$URL" 2>/dev/null

if [ -f "$OUTPUT" ]; then
  SIZE_KB=$(du -k "$OUTPUT" | cut -f1)
  echo "   ✅ Saved ${SIZE_KB}KB → $OUTPUT"
else
  echo "   ❌ Screenshot failed"
  exit 1
fi
