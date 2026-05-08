#!/usr/bin/env bash
# .devcontainer/post-create.sh — Install project dependencies after container creation
set -euo pipefail

echo "📦 Installing npm dependencies..."
npm install --include=dev

echo "🔧 Installing jq (required by data collection scripts)..."
sudo apt-get update -qq && sudo apt-get install -y -qq jq > /dev/null

echo "📓 Installing JupyterLab..."
python3 -m pip install --user --upgrade pip > /dev/null
python3 -m pip install --user jupyterlab ipykernel > /dev/null
python3 -m ipykernel install --user --name bve-dashboards --display-name "Python 3 (BVE Dashboards)" > /dev/null

echo "🎭 Installing Playwright browsers..."
npx playwright install --with-deps chromium

echo "✅ Dev container setup complete"
echo ""
echo "Available commands:"
echo "  npm run serve        — Start local dashboard server on :8080"
echo "  npm run build        — Build all dashboards"
echo "  npm run browse       — Open dashboard in headless Playwright"
echo "  npm run screenshot   — Capture dashboard screenshot (Chrome/Chromium)"
echo "  npm test             — Run tests"
echo "  npm run lint         — Lint code"
echo "  jupyter lab --ip=0.0.0.0 --no-browser --ServerApp.token='' --ServerApp.password=''"
