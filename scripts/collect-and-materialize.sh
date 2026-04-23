#!/usr/bin/env bash
set -euo pipefail

# collect-and-materialize.sh — Unified data collection + materialization pipeline.
#
# Collects raw data from GitHub APIs, writes timestamped files to _data/raw/,
# then runs the materializer to produce artifacts in _data/materialized/.
#
# Usage:
#   ./collect-and-materialize.sh                    # uses default profile
#   ./collect-and-materialize.sh --profile myprof   # uses named profile
#   ./collect-and-materialize.sh --materialize-only # skip collection, just materialize
#
# Output structure:
#   _data/
#   ├── raw/                           ← Timestamped query output
#   │   ├── copilot-metrics-2026-04-14T2324Z.json
#   │   ├── human-pr-metrics-2026-04-14T2331Z.json
#   │   └── coding-agent-pr-metrics-2026-04-15T0049Z.json
#   ├── materialized/                  ← Artifacts (produced by materialize.js)
#   │   ├── ai-assisted-efficiency-days-2026-04-15T0050Z.json
#   │   ├── ai-assisted-structural-days-2026-04-15T0050Z.json
#   │   ├── agentic-efficiency-days-2026-04-15T0050Z.json
#   │   └── agentic-pr-sessions-2026-04-15T0050Z.json
#   ├── pipeline-manifest.json
#   └── query-status.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${REPO_ROOT}/dashboard/dataflow/data"
RAW_DIR="${DATA_DIR}/raw"
MATERIALIZED_DIR="${DATA_DIR}/materialized"
SETTINGS_FILE="${REPO_ROOT}/query-settings.json"

# Timestamp for this run
RUN_TS=$(date -u +%Y-%m-%dT%H%MZ)

# ─── Argument parsing ─────────────────────────────────────────────────────────

PROFILE="default"
MATERIALIZE_ONLY=false
SESSION_LOGS_ONLY=false
USE_STREAMING=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --materialize-only) MATERIALIZE_ONLY=true; shift ;;
    --session-logs-only) SESSION_LOGS_ONLY=true; shift ;;
    --no-streaming) USE_STREAMING=false; shift ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ─── Load profile ─────────────────────────────────────────────────────────────

load_profile() {
  if [[ ! -f "$SETTINGS_FILE" ]]; then
    echo "⚠ No query-settings.json found, using environment variables"
    return
  fi

  local profile_json
  profile_json=$(jq -r --arg p "$PROFILE" '.[$p] // empty' "$SETTINGS_FILE" 2>/dev/null)
  if [[ -z "$profile_json" ]]; then
    echo "⚠ Profile '$PROFILE' not found in query-settings.json"
    return
  fi

  # Export each key as an environment variable (only if not already set)
  while IFS='=' read -r key val; do
    if [[ -z "${!key:-}" ]]; then
      export "$key=$val"
    fi
  done < <(echo "$profile_json" | jq -r 'to_entries[] | "\(.key)=\(.value)"')

  echo "✔ Loaded profile: $PROFILE"
}

# ─── Query targets ─────────────────────────────────────────────────────────────

declare -a TARGET_NAMES=()
declare -a TARGET_SCRIPTS=()
declare -a TARGET_BASENAMES=()
declare -a TARGET_REQUIRED=()

register_targets() {
  # Target 1: Copilot user and enterprise metrics
  TARGET_NAMES+=("copilot-metrics")
  TARGET_SCRIPTS+=("BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh")
  TARGET_BASENAMES+=("copilot-metrics")
  TARGET_REQUIRED+=("ENTERPRISE|ORG")

  # Target 2: Human PR metrics
  TARGET_NAMES+=("human-pr-metrics")
  TARGET_SCRIPTS+=("BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh")
  TARGET_BASENAMES+=("human-pr-metrics")
  TARGET_REQUIRED+=("ORG")

  # Target 3: Coding agent PR metrics
  TARGET_NAMES+=("coding-agent-pr-metrics")
  TARGET_SCRIPTS+=("BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh")
  TARGET_BASENAMES+=("coding-agent-pr-metrics")
  TARGET_REQUIRED+=("ORG")
}

# ─── Run a single query target ─────────────────────────────────────────────────

run_target() {
  local idx="$1"
  local name="${TARGET_NAMES[$idx]}"
  local script="${TARGET_SCRIPTS[$idx]}"
  local basename="${TARGET_BASENAMES[$idx]}"
  local required="${TARGET_REQUIRED[$idx]}"

  echo ""
  echo "━━━ $name ━━━"

  # Check required vars
  local has_required=false
  IFS='|' read -ra req_vars <<< "$required"
  for var in "${req_vars[@]}"; do
    if [[ -n "${!var:-}" ]]; then
      has_required=true
      break
    fi
  done

  if ! $has_required; then
    echo "  ⚠ Skipping — requires one of: $required"
    return 1
  fi

  local script_path="${REPO_ROOT}/${script}"
  if [[ ! -f "$script_path" ]]; then
    echo "  ⚠ Script not found: $script"
    return 1
  fi

  # Output filename with timestamp
  local scope_name="${ENTERPRISE:-${ORG:-unknown}}"
  local output_file="${scope_name}-${basename}-${RUN_TS}.json"
  local output_path="${RAW_DIR}/${output_file}"

  echo "  Script: $script"
  echo "  Output: _data/raw/$output_file"

  # Run the query script — scripts write JSON to stdout, progress to stderr
  if bash "$script_path" > "$output_path"; then
    # Validate the output is valid JSON
    if jq -e '.' "$output_path" > /dev/null 2>&1; then
      local fsize
      fsize=$(wc -c < "$output_path" | tr -d ' ')
      echo "  ✔ Captured _data/raw/$output_file ($fsize bytes)"
      return 0
    else
      echo "  ✗ Output is not valid JSON"
      rm -f "$output_path"
      return 1
    fi
  else
    echo "  ✗ Script failed"
    rm -f "$output_path"
    return 1
  fi
}

# ─── Collect from existing raw files (no re-query) ────────────────────────────

collect_existing() {
  echo ""
  echo "Collecting existing raw data files into _data/raw/..."

  local scope_name="${ENTERPRISE:-${ORG:-unknown}}"
  local count=0

  # Map of basename → traditional directories to search
  local -a search_pairs=(
    "copilot-metrics:BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/data:copilot-user-and-enterprise-metrics"
    "human-pr-metrics:BVE-dashboards-for-ai-assisted-coding/dashboard/structural/data:human-pr-metrics"
    "coding-agent-pr-metrics:BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/data:coding-agent-pr-metrics"
  )

  for pair in "${search_pairs[@]}"; do
    local basename="${pair%%:*}"
    local rest="${pair#*:}"
    local dir="${rest%%:*}"
    local pattern="${rest#*:}"
    local full_dir="${REPO_ROOT}/${dir}"

    if [[ ! -d "$full_dir" ]]; then continue; fi

    # Find the best file (prefer one with embedded metadata)
    local best_file=""
    local best_has_meta=false
    for f in "$full_dir"/*"${pattern}"*.json; do
      [[ ! -f "$f" ]] && continue
      [[ "$(basename "$f")" == "manifest.json" ]] && continue

      if [[ -z "$best_file" ]]; then
        best_file="$f"
      fi

      # Check for embedded metadata
      if jq -e '.metadata' "$f" > /dev/null 2>&1; then
        best_file="$f"
        best_has_meta=true
        break
      fi
    done

    if [[ -n "$best_file" ]]; then
      # Extract timestamp from embedded metadata, or use file mtime
      local file_ts
      file_ts=$(jq -r '.metadata.collected_at // empty' "$best_file" 2>/dev/null | sed 's/[-:]//g' | sed 's/T\(.\{4\}\).*/T\1Z/' )
      if [[ -z "$file_ts" || "$file_ts" == "Z" ]]; then
        file_ts="$RUN_TS"
      fi

      local output_file="${scope_name}-${basename}-${file_ts}.json"
      cp "$best_file" "${RAW_DIR}/${output_file}"
      local fsize
      fsize=$(wc -c < "${RAW_DIR}/${output_file}" | tr -d ' ')
      echo "  ✔ ${basename} → _data/raw/${output_file} ($fsize bytes)${best_has_meta:+ [has metadata]}"
      count=$((count + 1))
    fi
  done

  echo "  Collected $count raw file(s)"
}

# ─── Write query status ───────────────────────────────────────────────────────

write_status() {
  local status_file="${DATA_DIR}/query-status.json"
  local run_finished
  run_finished=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # List raw files with metadata
  local files_json="["
  local first=true
  for f in "${RAW_DIR}"/*.json; do
    [[ ! -f "$f" ]] && continue
    local fname
    fname=$(basename "$f")
    local fsize
    fsize=$(wc -c < "$f" | tr -d ' ')
    local fmeta
    fmeta=$(jq -c '.metadata // null' "$f" 2>/dev/null || echo 'null')

    if $first; then first=false; else files_json="${files_json},"; fi
    files_json="${files_json}{\"file\":\"${fname}\",\"size_bytes\":${fsize},\"metadata\":${fmeta}}"
  done
  files_json="${files_json}]"

  jq -n \
    --arg started "$RUN_TS" \
    --arg finished "$run_finished" \
    --arg profile "$PROFILE" \
    --argjson files "$files_json" \
    '{
      run_started: $started,
      run_finished: $finished,
      profile: $profile,
      raw_files: $files
    }' > "$status_file"

  echo "  ✔ query-status.json"
}

# ─── Session logs collection ──────────────────────────────────────────────────

run_session_logs() {
  local agentic_raw
  agentic_raw=$(ls "$RAW_DIR"/*coding-agent-pr-metrics*.json 2>/dev/null | head -1)
  if [[ -z "$agentic_raw" || ! -f "$agentic_raw" ]]; then
    echo ""
    echo "  ⚠ No agentic data found — skipping session logs"
    return 0
  fi

  echo ""
  echo "━━━ agent-session-logs ━━━"
  local scope_name="${ENTERPRISE:-${ORG:-unknown}}"
  local sl_output="${RAW_DIR}/${scope_name}-agent-session-logs-${RUN_TS}.json"
  local sl_script="${REPO_ROOT}/BVE-dashboards-for-agentic-ai-coding/data/queries/agent-session-logs.sh"
  if [[ ! -f "$sl_script" ]]; then
    echo "  ⚠ Script not found: $sl_script"
    return 0
  fi

  echo "  Input: $(basename "$agentic_raw")"
  echo "  Output: _data/raw/$(basename "$sl_output")"
  if bash "$sl_script" --input "$agentic_raw" > "$sl_output" 2>"${sl_output}.log"; then
    if jq -e '.' "$sl_output" > /dev/null 2>&1; then
      local sl_count
      sl_count=$(jq '.metadata.succeeded // 0' "$sl_output")
      echo "  ✔ Session logs: $sl_count sessions processed"
    else
      echo "  ✗ Output is not valid JSON"
      rm -f "$sl_output"
    fi
  else
    echo "  ✗ Script failed (see ${sl_output}.log)"
    rm -f "$sl_output"
  fi
}

# ─── Main ──────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo "🔧 BVE Data Pipeline"
  echo "   Profile: $PROFILE"
  echo "   Run:     $RUN_TS"
  echo ""

  # Create directories
  mkdir -p "$RAW_DIR" "$MATERIALIZED_DIR"

  # Register query targets
  register_targets

  if $MATERIALIZE_ONLY; then
    echo "Skipping collection (--materialize-only)"

    # If _data/raw/ is empty, collect from existing dashboard data dirs
    if ! ls "$RAW_DIR"/*.json > /dev/null 2>&1; then
      load_profile
      collect_existing
    fi
  elif $SESSION_LOGS_ONLY; then
    echo "Session logs only (--session-logs-only)"

    # If _data/raw/ is empty, collect from existing dashboard data dirs
    if ! ls "$RAW_DIR"/*.json > /dev/null 2>&1; then
      load_profile
      collect_existing
    fi

    # Run session logs collection
    run_session_logs
  else
    # Load profile and run collection
    load_profile

    echo ""
    echo "Running data collection..."
    local targets_run=0
    for idx in "${!TARGET_NAMES[@]}"; do
      if run_target "$idx"; then
        targets_run=$((targets_run + 1))
      fi
    done

    # If no targets ran (missing env vars), fall back to collecting existing files
    if [[ $targets_run -eq 0 ]]; then
      echo ""
      echo "No query targets ran — collecting existing data files..."
      collect_existing
    fi

    # Post-collection: fetch agent session logs unless skipped
    if [[ "${SKIP_SESSION_LOGS:-false}" != "true" ]]; then
      run_session_logs
    else
      echo ""
      echo "Skipping session logs (SKIP_SESSION_LOGS=true)"
    fi
  fi

  # Write query status
  echo ""
  echo "Writing status..."
  write_status

  # Materialize
  echo ""
  if [[ "$USE_STREAMING" == "true" ]]; then
    echo "Materializing pipeline artifacts (streaming)..."
    node "${REPO_ROOT}/scripts/materialize-streaming.js"
  else
    echo "Materializing pipeline artifacts (standard)..."
    node "${REPO_ROOT}/scripts/materialize.js"
  fi

  echo ""
  echo "✅ Pipeline complete"
  echo "   Raw files:  $(ls "$RAW_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')"
  echo "   Artifacts:  $(ls "$MATERIALIZED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')"
  echo "   Manifest:   _data/pipeline-manifest.json"
  echo ""
}

main
