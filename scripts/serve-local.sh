#!/usr/bin/env bash
# scripts/serve-local.sh — Start a local HTTP server for dashboard development
#
# Usage:
#   npm run serve              # serves on port 8080
#   npm run serve -- 3000      # serves on port 3000
#
# Dashboards are then available at:
#   http://127.0.0.1:8080/v3/ai-assisted-efficiency/
#   http://127.0.0.1:8080/v2/ai-assisted-structural/
#   http://127.0.0.1:8080/dataflow/
#   http://127.0.0.1:8080/data-status/
#   etc.

set -euo pipefail

PORT="${1:-8080}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVE_DIR="${REPO_ROOT}/dashboard"

if ! [ -d "$SERVE_DIR" ]; then
  echo "❌ Dashboard directory not found: $SERVE_DIR"
  exit 1
fi

# Make dashboard-config.json available to all dashboards via data/config.json
CONFIG_SRC="${REPO_ROOT}/dashboard-config.json"
CONFIG_DST="${SERVE_DIR}/data/config.json"
if [ -f "$CONFIG_SRC" ]; then
  mkdir -p "$(dirname "$CONFIG_DST")"
  rm -f "$CONFIG_DST"
  ln -s "$CONFIG_SRC" "$CONFIG_DST"
  echo "🔗 Refreshed dashboard-config.json → data/config.json"
fi

echo "🌐 Serving dashboards from: $SERVE_DIR"
echo "   http://127.0.0.1:${PORT}/"
echo ""
echo "   Available dashboards:"
for d in "$SERVE_DIR"/v3/*/index.html "$SERVE_DIR"/v2/*/index.html "$SERVE_DIR"/dataflow/index.html "$SERVE_DIR"/data-status/index.html; do
  if [ -f "$d" ]; then
    path="${d#$SERVE_DIR/}"
    path="${path%/index.html}/"
    echo "   → http://127.0.0.1:${PORT}/${path}"
  fi
done
echo ""
echo "   Press Ctrl+C to stop"
echo ""

cd "$SERVE_DIR"
python3 -m http.server "$PORT" --bind 127.0.0.1
