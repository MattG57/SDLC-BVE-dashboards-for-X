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
  ["ai-assisted-coding/element"]="BVE-dashboards-for-ai-assisted-coding/dashboard/element"
  ["ai-assisted-coding/efficiency"]="BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency"
  ["ai-assisted-coding/structural"]="BVE-dashboards-for-ai-assisted-coding/dashboard/structural"
  ["agentic-ai-coding/element"]="BVE-dashboards-for-agentic-ai-coding/dashboard/element"
  ["agentic-ai-coding/efficiency"]="BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency"
  ["integrated"]="dashboard/integrated"
  ["data-status"]="dashboard/data-status"
  ["dataflow"]="dashboard/dataflow"
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

# ─── Copy shared dashboard config into every dashboard's data/ ─────────────────
CONFIG_SRC="${REPO_ROOT}/dashboard-config.json"
if [[ -f "$CONFIG_SRC" ]]; then
  for slug in "${!DASHBOARDS[@]}"; do
    dest="${SITE_DIR}/${slug}/data"
    mkdir -p "$dest"
    cp "$CONFIG_SRC" "$dest/config.json"
  done
  echo "  ✔ dashboard-config.json → all dashboards"
fi

# ─── Aggregate data for dashboards without their own data collection ───────────
# Element dashboards and integrated dashboard need data from other sources.
for slug_src in \
  "ai-assisted-coding/element:ai-assisted-coding/efficiency ai-assisted-coding/structural" \
  "agentic-ai-coding/element:agentic-ai-coding/efficiency" \
  "integrated:ai-assisted-coding/efficiency ai-assisted-coding/structural agentic-ai-coding/efficiency"; do

  target_slug="${slug_src%%:*}"
  sources="${slug_src#*:}"
  target_dest="${SITE_DIR}/${target_slug}/data"

  [[ ! -d "${SITE_DIR}/${target_slug}" ]] && continue

  mkdir -p "$target_dest"
  for data_src in $sources; do
    src_data="${SITE_DIR}/${data_src}/data"
    if [[ -d "$src_data" ]]; then
      for f in "$src_data"/*.json; do
        fname="$(basename "$f")"
        [[ "$fname" == "manifest.json" ]] && continue
        [[ -f "$target_dest/$fname" ]] && continue
        cp "$f" "$target_dest/$fname"
      done
    fi
  done

  if ls "$target_dest"/*.json >/dev/null 2>&1; then
    manifest='{"files":['
    first=true
    for f in "$target_dest"/*.json; do
      fname="$(basename "$f")"
      [[ "$fname" == "manifest.json" ]] && continue
      if $first; then first=false; else manifest="$manifest,"; fi
      manifest="$manifest\"$fname\""
    done
    manifest="$manifest],\"generated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    echo "$manifest" > "$target_dest/manifest.json"
    echo "  ✔ $target_slug/data/ ($(find "$target_dest" -name '*.json' ! -name 'manifest.json' | wc -l) data files, aggregated)"
  fi
done

# ─── Materialize pipeline artifacts for the dataflow dashboard ─────────────────
# Run the materializer which writes directly to dashboard/dataflow/data/.
# Then copy the subdirectories to _site/ (the generic loop above only copies flat *.json).
if command -v node >/dev/null 2>&1; then
  echo ""
  echo "Materializing pipeline artifacts..."
  node "${REPO_ROOT}/scripts/materialize.js" 2>/dev/null || echo "  ⚠ materialize.js skipped (no data or error)"
  DATAFLOW_SRC="${REPO_ROOT}/dashboard/dataflow/data"
  DATAFLOW_DEST="${SITE_DIR}/dataflow/data"
  for subdir in raw materialized; do
    if [[ -d "${DATAFLOW_SRC}/${subdir}" ]]; then
      mkdir -p "${DATAFLOW_DEST}/${subdir}"
      cp "${DATAFLOW_SRC}/${subdir}"/*.json "${DATAFLOW_DEST}/${subdir}/" 2>/dev/null || true
    fi
  done
  echo "  ✔ dataflow/data/{raw,materialized}/ copied to site"
fi

# ─── Generate data-status.json for the data management dashboard ──────────────

STATUS_JSON="${SITE_DIR}/data-status/data/data-status.json"
mkdir -p "$(dirname "$STATUS_JSON")"

# Start with query-status.json from run-query.sh if available
QUERY_STATUS="${REPO_ROOT}/_data-status/query-status.json"
if [[ -f "$QUERY_STATUS" ]]; then
  QUERY_INFO=$(cat "$QUERY_STATUS")
else
  QUERY_INFO='{"run_started":null,"run_finished":null,"profile":null,"targets":[]}'
fi

# Build per-dashboard inventory from manifests
DASHBOARD_INVENTORY="["
d_first=true
for slug in $(echo "${!DASHBOARDS[@]}" | tr ' ' '\n' | sort); do
  dest="${SITE_DIR}/${slug}"
  manifest_file="$dest/data/manifest.json"
  files_json="[]"
  manifest_ts="null"
  if [[ -f "$manifest_file" ]]; then
    files_json=$(jq -c '.files // []' "$manifest_file" 2>/dev/null || echo '[]')
    manifest_ts=$(jq -r '.generated // empty' "$manifest_file" 2>/dev/null || echo "null")
    [[ -n "$manifest_ts" && "$manifest_ts" != "null" ]] && manifest_ts="\"$manifest_ts\"" || manifest_ts="null"
  fi

  # Collect file sizes and embedded metadata
  file_details="[]"
  if [[ -d "$dest/data" ]]; then
    file_details="["
    fd_first=true
    for f in "$dest/data"/*.json; do
      [[ ! -f "$f" ]] && continue
      fname=$(basename "$f")
      [[ "$fname" == "manifest.json" || "$fname" == "data-status.json" ]] && continue
      fsize=$(wc -c < "$f" | tr -d ' ')
      # Extract embedded metadata block if present
      fmeta=$(jq -c '.metadata // null' "$f" 2>/dev/null || echo 'null')
      if $fd_first; then fd_first=false; else file_details="$file_details,"; fi
      file_details="$file_details{\"name\":\"$fname\",\"size_bytes\":$fsize,\"metadata\":$fmeta}"
    done
    file_details="$file_details]"
  fi

  if $d_first; then d_first=false; else DASHBOARD_INVENTORY="$DASHBOARD_INVENTORY,"; fi
  DASHBOARD_INVENTORY="$DASHBOARD_INVENTORY{\"slug\":\"$slug\",\"has_html\":$([ -f "$dest/index.html" ] && echo true || echo false),\"manifest_generated\":$manifest_ts,\"data_files\":$file_details}"
done
DASHBOARD_INVENTORY="$DASHBOARD_INVENTORY]"

# Expected targets for reference
EXPECTED_TARGETS='[
  {"target":"ai-assisted-efficiency","script":"copilot-user-and-enterprise-metrics.sh","output":"copilot-user-and-enterprise-metrics.json","dashboards":["ai-assisted-coding/efficiency"]},
  {"target":"ai-assisted-structural","script":"copilot-user-and-enterprise-metrics.sh","output":"copilot-user-and-enterprise-metrics.json","dashboards":["ai-assisted-coding/structural"]},
  {"target":"pr-review-structural","script":"human-pr-metrics.sh","output":"human-pr-metrics.json","dashboards":["ai-assisted-coding/structural"]},
  {"target":"agentic-efficiency","script":"coding-agent-pr-metrics.sh","output":"coding-agent-pr-metrics.json","dashboards":["agentic-ai-coding/efficiency"]}
]'

jq -n \
  --argjson query "$QUERY_INFO" \
  --argjson dashboards "$DASHBOARD_INVENTORY" \
  --argjson expected "$EXPECTED_TARGETS" \
  --arg build_ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{
    build_timestamp: $build_ts,
    query_run: $query,
    expected_targets: $expected,
    dashboards: $dashboards
  }' > "$STATUS_JSON"

# Generate manifest for data-status dashboard
echo "{\"files\":[\"data-status.json\"],\"generated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$(dirname "$STATUS_JSON")/manifest.json"
echo "  ✔ data-status/data/data-status.json"

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
    <h1 class="f00 color-fg-default"><svg width="42" height="42" viewBox="0 0 42 42" style="vertical-align: middle; margin-right: 4px;" aria-hidden="true"><rect x="4" y="4" width="34" height="30" rx="2" fill="none" stroke="#3fb950" stroke-width="2" stroke-dasharray="3 2"/><rect x="16" y="4" width="22" height="30" rx="2" fill="#388bfd" fill-opacity="0.3" stroke="#388bfd" stroke-width="1.5"/><line x1="4" y1="34" x2="38" y2="4" stroke="#3fb950" stroke-width="2" stroke-dasharray="4 2"/><circle cx="4" cy="34" r="2.5" fill="#3fb950"/><circle cx="38" cy="4" r="2.5" fill="#3fb950"/></svg> BVE Dashboards</h1>
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
    <a class="app-icon" href="ai-assisted-coding/element/">
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
    <a class="app-icon" href="agentic-ai-coding/element/">
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
    <p class="mt-2"><a href="data-status/" class="color-fg-accent">🔧 Data Status</a> · <a href="dataflow/" class="color-fg-accent">🔀 Dataflow</a> — view collection results, data inventory, and pipeline health.</p>
  </div>
</div>
</body>
</html>
LANDING_EOF

echo ""
echo "✔ Pages site built → $SITE_DIR"
echo "  $(find "$SITE_DIR" -type f | wc -l) files total"
