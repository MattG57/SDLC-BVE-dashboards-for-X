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
  .landing { max-width: 960px; margin: 0 auto; padding: 48px 16px; }
  .card-link { text-decoration: none; display: block; transition: transform 0.1s, box-shadow 0.1s; }
  .card-link:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
</style>
</head>
<body>
<div class="landing">
  <div class="mb-6">
    <h1 class="f00 color-fg-default">📊 BVE Dashboards</h1>
    <p class="f3 color-fg-muted mt-2">Business Value Engineering dashboards for GitHub Copilot and SDLC metrics</p>
  </div>

  <div class="d-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
    <a class="card-link" href="ai-assisted-coding/efficiency/">
      <div class="Box color-shadow-medium p-4">
        <h3 class="f3 color-fg-default">AI Assisted Coding</h3>
        <p class="f5 color-fg-muted mt-1">Efficiency Dashboard</p>
        <span class="Label Label--accent mt-2">Copilot Metrics</span>
      </div>
    </a>

    <a class="card-link" href="ai-assisted-coding/structural/">
      <div class="Box color-shadow-medium p-4">
        <h3 class="f3 color-fg-default">AI Assisted Coding</h3>
        <p class="f5 color-fg-muted mt-1">Structural Dashboard</p>
        <span class="Label Label--accent mt-2">Copilot + PR Metrics</span>
      </div>
    </a>

    <a class="card-link" href="agentic-ai-coding/efficiency/">
      <div class="Box color-shadow-medium p-4">
        <h3 class="f3 color-fg-default">Agentic AI Coding</h3>
        <p class="f5 color-fg-muted mt-1">Efficiency Dashboard</p>
        <span class="Label Label--accent mt-2">Agent Metrics</span>
      </div>
    </a>

    <a class="card-link" href="integrated/">
      <div class="Box color-shadow-medium p-4">
        <h3 class="f3 color-fg-default">Integrated Leverage</h3>
        <p class="f5 color-fg-muted mt-1">Combined Dashboard</p>
        <span class="Label Label--accent mt-2">All Sources</span>
      </div>
    </a>
  </div>

  <div class="mt-6 color-fg-muted f6">
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
