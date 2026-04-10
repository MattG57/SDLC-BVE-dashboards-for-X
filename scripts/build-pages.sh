#!/usr/bin/env bash
set -euo pipefail

# build-pages.sh — Assemble the GitHub Pages site from dashboards and collected data.
#
# The output is written to _site/ (the default path for actions/upload-pages-artifact).
# For each dashboard directory the script copies the HTML and any data/*.json files,
# then generates a data/manifest.json that the dashboard auto-load code can fetch.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_DIR="${REPO_ROOT}/_site"

rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"

# ─── Dashboard registry: site-slug → repo-relative source path ────────────────

declare -A DASHBOARDS=(
  ["ai-assisted-coding/efficiency"]="BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency"
  ["ai-assisted-coding/structural"]="BVE-dashboards-for-ai-assisted-coding/dashboard/structural"
  ["agentic-ai-coding/efficiency"]="BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency"
  ["integrated"]="dashboard/integrated"
)

for slug in "${!DASHBOARDS[@]}"; do
  src="${REPO_ROOT}/${DASHBOARDS[$slug]}"
  dest="${SITE_DIR}/${slug}"

  mkdir -p "$dest"

  # Copy dashboard HTML
  if [[ -f "$src/index.html" ]]; then
    cp "$src/index.html" "$dest/index.html"
    echo "  ✔ $slug/index.html"
  else
    echo "  ⚠ $slug — no index.html found, skipping"
    continue
  fi

  # Copy data files and generate manifest
  data_dir="$src/data"
  if [[ -d "$data_dir" ]] && ls "$data_dir"/*.json >/dev/null 2>&1; then
    mkdir -p "$dest/data"
    cp "$data_dir"/*.json "$dest/data/"

    # Build manifest.json listing the available data files
    manifest='{"files":['
    first=true
    for f in "$dest/data"/*.json; do
      fname="$(basename "$f")"
      [[ "$fname" == "manifest.json" ]] && continue
      if $first; then first=false; else manifest="$manifest,"; fi
      manifest="$manifest\"$fname\""
    done
    manifest="$manifest],\"generated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    echo "$manifest" > "$dest/data/manifest.json"

    echo "  ✔ $slug/data/ ($(find "$dest/data" -name '*.json' ! -name 'manifest.json' | wc -l) data files)"
  fi
done

# ─── Generate landing page ────────────────────────────────────────────────────

cat > "$SITE_DIR/index.html" << 'LANDING_EOF'
<!DOCTYPE html>
<html lang="en" data-color-mode="dark" data-dark-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BVE Dashboards</title>
<link rel="stylesheet" href="https://unpkg.com/@primer/css@21.3.1/dist/primer.css">
<style>
  body { background: var(--bgColor-default); }
  .landing { max-width: 720px; margin: 0 auto; padding: 48px 16px; }
  .row-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--fgColor-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 8px 8px;
  }
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }
  .app-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-decoration: none;
    padding: 12px 8px;
    border-radius: 16px;
    transition: transform 0.12s, background 0.12s;
  }
  .app-icon:hover {
    transform: scale(1.05);
    background: var(--bgColor-muted);
  }
  .app-icon .icon-tile {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    margin-bottom: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .app-icon .icon-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--fgColor-default);
    text-align: center;
    line-height: 1.3;
  }
  .app-icon.disabled { opacity: 0.35; pointer-events: none; }
  .tile-leverage  { background: linear-gradient(135deg, #1f6feb, #388bfd); }
  .tile-efficiency { background: linear-gradient(135deg, #238636, #3fb950); }
  .tile-structure  { background: linear-gradient(135deg, #8b5cf6, #a78bfa); }
  .spacer { visibility: hidden; }
</style>
</head>
<body>
<div class="landing">
  <div class="mb-6 text-center">
    <h1 class="f00 color-fg-default">📊 BVE Dashboards</h1>
    <p class="f4 color-fg-muted mt-2">Business Value Engineering dashboards for GitHub Copilot and SDLC metrics</p>
  </div>

  <!-- Row 1: Integrated -->
  <p class="row-label">Integrated</p>
  <div class="icon-grid">
    <div class="spacer"></div>
    <a class="app-icon" href="integrated/">
      <div class="icon-tile tile-leverage">⚡</div>
      <span class="icon-label">Leverage</span>
    </a>
    <div class="spacer"></div>
  </div>

  <!-- Row 2: AI Assisted Coding -->
  <p class="row-label">AI Assisted Coding</p>
  <div class="icon-grid">
    <a class="app-icon disabled" href="#">
      <div class="icon-tile tile-leverage">⚡</div>
      <span class="icon-label">Leverage</span>
    </a>
    <a class="app-icon" href="ai-assisted-coding/efficiency/">
      <div class="icon-tile tile-efficiency">📈</div>
      <span class="icon-label">Efficiency</span>
    </a>
    <a class="app-icon" href="ai-assisted-coding/structural/">
      <div class="icon-tile tile-structure">🏗️</div>
      <span class="icon-label">Structure</span>
    </a>
  </div>

  <!-- Row 3: Agentic AI Coding -->
  <p class="row-label">Agentic AI Coding</p>
  <div class="icon-grid">
    <a class="app-icon disabled" href="#">
      <div class="icon-tile tile-leverage">⚡</div>
      <span class="icon-label">Leverage</span>
    </a>
    <a class="app-icon" href="agentic-ai-coding/efficiency/">
      <div class="icon-tile tile-efficiency">📈</div>
      <span class="icon-label">Efficiency</span>
    </a>
    <a class="app-icon disabled" href="#">
      <div class="icon-tile tile-structure">🏗️</div>
      <span class="icon-label">Structure</span>
    </a>
  </div>

  <div class="mt-4 color-fg-muted f6 text-center">
    <p>Data is collected nightly via <code>run-query.sh --all</code>. Dashboards auto-load the latest available data.</p>
    <p>Manual file upload is still available as a fallback on each dashboard.</p>
  </div>
</div>
</body>
</html>
LANDING_EOF

echo ""
echo "✔ Pages site built → $SITE_DIR"
echo "  $(find "$SITE_DIR" -type f | wc -l) files total"
