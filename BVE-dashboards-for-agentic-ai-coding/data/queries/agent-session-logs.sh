#!/bin/bash
set -euo pipefail

# Agent Session Log Compute Time
# Fetches agent session logs for completed/failed PRs and parses timestamps
# to compute active vs idle time.
#
# Input: existing coding-agent-pr-metrics JSON (via --input or stdin)
# Output: JSON with per-session compute_minutes to stdout
#
# Usage:
#   ./agent-session-logs.sh --input ../octodemo-agentic-2026-03-25.json > session-logs.json
#   cat pr-metrics.json | ./agent-session-logs.sh > session-logs.json
#
# Environment:
#   IDLE_THRESHOLD_SECS  — gap threshold for idle detection (default: 1800 = 30 min)
#   MAX_SESSIONS         — limit number of sessions to process (default: unlimited)
#   DELAY_MS             — delay between API calls in ms (default: 500)

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: $0 [--input FILE]"
  echo "Fetches agent session logs and computes active vs idle time."
  echo ""
  echo "Options:"
  echo "  --input FILE   Path to coding-agent-pr-metrics JSON (default: stdin)"
  echo ""
  echo "Environment:"
  echo "  IDLE_THRESHOLD_SECS  Gap threshold for idle detection (default: 1800 = 30 min)"
  echo "  MAX_SESSIONS         Max sessions to process (default: unlimited)"
  echo "  DELAY_MS             Delay between API calls in ms (default: 500)"
  exit 0
fi

IDLE_THRESHOLD="${IDLE_THRESHOLD_SECS:-1800}"
MAX_SESSIONS="${MAX_SESSIONS:-0}"
DELAY_SECS=$(echo "${DELAY_MS:-500}" | awk '{printf "%.3f", $1/1000}')
TMPDIR_BASE="${TMPDIR:-/tmp}/agent-session-logs-$$"
mkdir -p "$TMPDIR_BASE"

cleanup() { rm -rf "$TMPDIR_BASE"; }
trap cleanup EXIT

info() { echo "  [session-logs] $*" >&2; }
warn() { echo "  [session-logs] ⚠️  $*" >&2; }

# Parse input
INPUT_FILE=""
if [[ "${1:-}" == "--input" && -n "${2:-}" ]]; then
  INPUT_FILE="$2"
elif [[ ! -t 0 ]]; then
  INPUT_FILE="$TMPDIR_BASE/stdin.json"
  cat > "$INPUT_FILE"
else
  echo "Error: No input provided. Use --input FILE or pipe JSON to stdin." >&2
  exit 1
fi

# Extract completed/failed PR sessions (merged or closed, not open)
info "Extracting completed/failed PR sessions..."
SESSIONS_JSON=$(jq -c '[
  .pr_sessions[]
  | select(.pr_state == "closed" or .pr_merged_at != null)
  | { repo, pr_number, head_ref, pr_state,
      pr_merged_at, pr_closed_at, pr_created_at,
      duration_minutes, duration_type }
]' "$INPUT_FILE")

TOTAL=$(echo "$SESSIONS_JSON" | jq 'length')
info "Found $TOTAL completed/failed sessions to process"

if [[ "$MAX_SESSIONS" -gt 0 && "$TOTAL" -gt "$MAX_SESSIONS" ]]; then
  info "Limiting to $MAX_SESSIONS sessions (MAX_SESSIONS)"
  SESSIONS_JSON=$(echo "$SESSIONS_JSON" | jq --argjson n "$MAX_SESSIONS" '.[:$n]')
  TOTAL="$MAX_SESSIONS"
fi

PROCESSED=0
SUCCEEDED=0
FAILED=0
SKIPPED=0

process_session() {
  local repo="$1" pr_number="$2" head_ref="$3" pr_state="$4"
  local pr_merged_at="$5" pr_closed_at="$6" pr_created_at="$7"
  local duration_minutes="$8"
  local session_dir="$TMPDIR_BASE/session-$pr_number"
  mkdir -p "$session_dir"

  # Step 1: Find the Actions workflow run for this branch
  local owner repo_name
  owner=$(echo "$repo" | cut -d'/' -f1)
  repo_name=$(echo "$repo" | cut -d'/' -f2)

  local runs_json
  runs_json=$(gh api "repos/$repo/actions/runs?branch=$head_ref&per_page=5" \
    --jq '[.workflow_runs[] | select(.name == "Running Copilot coding agent") | {id, status, conclusion, created_at}]' \
    2>/dev/null) || {
    warn "$repo#$pr_number — failed to query Actions runs"
    return 1
  }

  local run_id
  run_id=$(echo "$runs_json" | jq -r '.[0].id // empty')
  if [[ -z "$run_id" ]]; then
    # Try alternate workflow name
    run_id=$(gh api "repos/$repo/actions/runs?branch=$head_ref&per_page=5" \
      --jq '[.workflow_runs[] | select(.name | test("copilot|Copilot"; "i")) | .id][0] // empty' \
      2>/dev/null) || true
    if [[ -z "$run_id" ]]; then
      warn "$repo#$pr_number — no agent workflow run found for branch $head_ref"
      return 2
    fi
  fi

  sleep "$DELAY_SECS"

  # Step 2: Download logs
  local log_zip="$session_dir/logs.zip"
  if ! gh api "repos/$repo/actions/runs/$run_id/logs" > "$log_zip" 2>/dev/null; then
    warn "$repo#$pr_number — failed to download logs for run $run_id"
    return 1
  fi

  # Validate zip
  if ! file "$log_zip" | grep -qiE 'Zip|zip'; then
    # Check magic bytes as fallback
    if ! xxd "$log_zip" 2>/dev/null | head -1 | grep -q '504b'; then
      warn "$repo#$pr_number — downloaded file is not a valid zip"
      return 1
    fi
  fi

  sleep "$DELAY_SECS"

  # Step 3: Extract and find copilot log
  if ! unzip -o -q "$log_zip" -d "$session_dir/logs" 2>/dev/null; then
    warn "$repo#$pr_number — failed to extract logs zip"
    return 1
  fi

  local copilot_log=""
  if [[ -f "$session_dir/logs/0_copilot.txt" ]]; then
    copilot_log="$session_dir/logs/0_copilot.txt"
  else
    copilot_log=$(find "$session_dir/logs" -name "*.txt" -type f | head -1)
  fi

  if [[ -z "$copilot_log" || ! -f "$copilot_log" ]]; then
    warn "$repo#$pr_number — no log file found in zip"
    return 1
  fi

  # Step 4: Parse timestamps and compute active/idle time
  # Extract all ISO8601 timestamps from line beginnings (strip BOM if present)
  local timestamps_file="$session_dir/timestamps.txt"
  sed 's/^\xef\xbb\xbf//' "$copilot_log" | \
    grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+Z' \
    | sort > "$timestamps_file"

  local line_count
  line_count=$(wc -l < "$copilot_log" | tr -d ' ')
  local ts_count
  ts_count=$(wc -l < "$timestamps_file" | tr -d ' ')

  if [[ "$ts_count" -lt 2 ]]; then
    warn "$repo#$pr_number — insufficient timestamps ($ts_count) in log"
    return 1
  fi

  # Compute active vs idle using awk
  local compute_result
  compute_result=$(awk -v threshold="$IDLE_THRESHOLD" '
  BEGIN {
    active_secs = 0
    idle_secs = 0
    gap_count = 0
    max_gap = 0
    idle_gaps = 0
  }
  {
    split($1, dt, "T")
    split(dt[1], d, "-")
    split(dt[2], t, ":")
    gsub(/\.[0-9]*Z$/, "", t[3])

    curr_day = (d[1] * 365 + d[2] * 30 + d[3])
    curr_time = t[1] * 3600 + t[2] * 60 + t[3]
    curr_total = curr_day * 86400 + curr_time

    if (NR == 1) {
      first_ts = $1
      prev_total = curr_total
      next
    }

    gap = curr_total - prev_total
    if (gap < 0) gap = 0

    gap_count++
    if (gap > max_gap) max_gap = gap

    if (gap <= threshold) {
      active_secs += gap
    } else {
      idle_secs += gap
      idle_gaps++
    }

    prev_total = curr_total
    last_ts = $1
  }
  END {
    total_secs = active_secs + idle_secs
    printf "%d %d %d %d %d %s %s\n", active_secs, idle_secs, total_secs, max_gap, idle_gaps, first_ts, last_ts
  }
  ' "$timestamps_file")

  local active_secs idle_secs total_secs max_gap idle_gaps first_ts last_ts
  if [[ -z "$compute_result" ]]; then
    warn "$repo#$pr_number — awk produced no output"
    return 1
  fi
  read -r active_secs idle_secs total_secs max_gap idle_gaps first_ts last_ts <<< "$compute_result"
  # Ensure numeric values are valid
  : "${active_secs:=0}" "${idle_secs:=0}" "${total_secs:=0}" "${max_gap:=0}" "${idle_gaps:=0}"

  # Count activity markers (ensure single numeric value)
  local tool_invocations copilot_responses
  tool_invocations=$(cat "$copilot_log" | grep -c 'Invoking tool:' || true)
  copilot_responses=$(cat "$copilot_log" | grep -c 'copilot:' || true)
  : "${tool_invocations:=0}"
  : "${copilot_responses:=0}"

  # Build result JSON
  local active_mins idle_mins total_mins
  active_mins=$(awk "BEGIN {printf \"%.1f\", $active_secs / 60}")
  idle_mins=$(awk "BEGIN {printf \"%.1f\", $idle_secs / 60}")
  total_mins=$(awk "BEGIN {printf \"%.1f\", $total_secs / 60}")

  jq -n \
    --arg repo "$repo" \
    --argjson pr "$pr_number" \
    --arg head_ref "$head_ref" \
    --arg pr_state "$pr_state" \
    --arg pr_merged_at "$pr_merged_at" \
    --arg pr_created_at "$pr_created_at" \
    --argjson run_id "$run_id" \
    --argjson api_duration_minutes "${duration_minutes:-null}" \
    --argjson active_minutes "$active_mins" \
    --argjson idle_minutes "$idle_mins" \
    --argjson total_log_minutes "$total_mins" \
    --argjson max_gap_seconds "$max_gap" \
    --argjson idle_gap_count "$idle_gaps" \
    --argjson log_lines "$line_count" \
    --argjson timestamped_lines "$ts_count" \
    --argjson tool_invocations "$tool_invocations" \
    --argjson copilot_responses "$copilot_responses" \
    --arg first_timestamp "$first_ts" \
    --arg last_timestamp "$last_ts" \
    --argjson idle_threshold_secs "$IDLE_THRESHOLD" \
    '{
      repo: $repo,
      pr_number: $pr,
      head_ref: $head_ref,
      pr_state: $pr_state,
      pr_merged_at: (if $pr_merged_at == "null" then null else $pr_merged_at end),
      pr_created_at: $pr_created_at,
      run_id: $run_id,
      api_duration_minutes: $api_duration_minutes,
      active_minutes: $active_minutes,
      idle_minutes: $idle_minutes,
      total_log_minutes: $total_log_minutes,
      max_gap_seconds: $max_gap_seconds,
      idle_gap_count: $idle_gap_count,
      log_lines: $log_lines,
      timestamped_lines: $timestamped_lines,
      tool_invocations: $tool_invocations,
      copilot_responses: $copilot_responses,
      first_timestamp: $first_timestamp,
      last_timestamp: $last_timestamp,
      idle_threshold_secs: $idle_threshold_secs
    }'
}

# Process each session
info "Processing sessions (idle threshold: ${IDLE_THRESHOLD}s = $((IDLE_THRESHOLD / 60))min)..."
RESULTS_FILE="$TMPDIR_BASE/results.json"
echo '[]' > "$RESULTS_FILE"
PROCESSED=0
SUCCEEDED=0
FAILED=0
SKIPPED=0

while IFS= read -r session; do
  PROCESSED=$((PROCESSED + 1))
  repo=$(echo "$session" | jq -r '.repo')
  pr_number=$(echo "$session" | jq -r '.pr_number')
  head_ref=$(echo "$session" | jq -r '.head_ref')
  pr_state=$(echo "$session" | jq -r '.pr_state')
  pr_merged_at=$(echo "$session" | jq -r '.pr_merged_at // "null"')
  pr_closed_at=$(echo "$session" | jq -r '.pr_closed_at // "null"')
  pr_created_at=$(echo "$session" | jq -r '.pr_created_at // "null"')
  duration_minutes=$(echo "$session" | jq '.duration_minutes // null')

  info "[$PROCESSED/$TOTAL] $repo#$pr_number ($head_ref)..."

  result=$(process_session "$repo" "$pr_number" "$head_ref" "$pr_state" \
    "$pr_merged_at" "$pr_closed_at" "$pr_created_at" "$duration_minutes" 2>&2) || {
    status=$?
    if [[ $status -eq 2 ]]; then
      SKIPPED=$((SKIPPED + 1))
    else
      FAILED=$((FAILED + 1))
    fi
    continue
  }

  SUCCEEDED=$((SUCCEEDED + 1))
  jq --argjson r "$result" '. += [$r]' "$RESULTS_FILE" > "$RESULTS_FILE.tmp" && mv "$RESULTS_FILE.tmp" "$RESULTS_FILE"
done < <(echo "$SESSIONS_JSON" | jq -c '.[]')

info "Done: $SUCCEEDED succeeded, $FAILED failed, $SKIPPED skipped (no agent run found)"

# Output final JSON
RESULTS=$(cat "$RESULTS_FILE")
jq -n \
  --argjson sessions "$RESULTS" \
  --argjson total "$TOTAL" \
  --argjson succeeded "$SUCCEEDED" \
  --argjson failed "$FAILED" \
  --argjson skipped "$SKIPPED" \
  --argjson idle_threshold "$IDLE_THRESHOLD" \
  '{
    metadata: {
      script: "agent-session-logs",
      collected_at: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
      idle_threshold_secs: $idle_threshold,
      total_sessions: $total,
      succeeded: $succeeded,
      failed: $failed,
      skipped: $skipped
    },
    session_logs: $sessions
  }'
