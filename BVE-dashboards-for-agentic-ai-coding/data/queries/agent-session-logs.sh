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
      duration_minutes, duration_type,
      additional_guidance_count,
      origin_issue_number,
      additions, deletions, changed_files }
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

# Extract active/idle time from a timestamps file using awk.
# Prints: active_secs idle_secs total_secs max_gap idle_gaps first_ts last_ts
compute_active_idle() {
  local timestamps_file="$1"
  awk -v threshold="$IDLE_THRESHOLD" '
  BEGIN { active_secs=0; idle_secs=0; max_gap=0; idle_gaps=0 }
  {
    split($1, dt, "T"); split(dt[1], d, "-"); split(dt[2], t, ":")
    gsub(/\.[0-9]*Z$/, "", t[3])
    curr = (d[1]*365 + d[2]*30 + d[3]) * 86400 + t[1]*3600 + t[2]*60 + t[3]
    if (NR == 1) { first_ts=$1; prev=curr; next }
    gap = curr - prev; if (gap < 0) gap = 0
    if (gap > max_gap) max_gap = gap
    if (gap <= threshold) { active_secs += gap } else { idle_secs += gap; idle_gaps++ }
    prev = curr; last_ts = $1
  }
  END { printf "%d %d %d %d %d %s %s\n", active_secs, idle_secs, active_secs+idle_secs, max_gap, idle_gaps, first_ts, last_ts }
  ' "$timestamps_file"
}

# Extract prompt text from a copilot log — two patterns:
# Pattern A (legacy workflow): cat > issue_body.txt << 'EOT' heredoc
# Pattern B (native coding agent action): "Problem statement:" log line
extract_prompt_text() {
  local copilot_log="$1"
  local prompt_text

  # Pattern A: issue_body.txt heredoc
  prompt_text=$(grep -A 50 "##\[group\]Run cat > issue_body\.txt" "$copilot_log" 2>/dev/null | head -50 | \
    sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9:.]*Z //' | \
    sed $'s/\033\[[0-9;]*m//g' | \
    awk '/cat > issue_body\.txt/{found=1; next} found && /EOT|shell:|##\[/{exit} found{print}' | \
    tr -d '\r') || true

  # Pattern B: native action "Problem statement:" marker
  if [[ -z "$prompt_text" ]]; then
    prompt_text=$(grep -A 20 "Problem statement:" "$copilot_log" 2>/dev/null | head -20 | \
      sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9:.]*Z //' | \
      awk '/^Problem statement:/{found=1; next} found && /^(Using Git URL:|Executing task:|[[:space:]]*$)/{exit} found{print}' | \
      tr -d '\r') || true
  fi

  echo "$prompt_text"
}

process_session() {
  local repo="$1" pr_number="$2" head_ref="$3" pr_state="$4"
  local pr_merged_at="$5" pr_closed_at="$6" pr_created_at="$7"
  local duration_minutes="$8" additional_guidance_count="$9" origin_issue_number="${10}"
  local additions="${11}" deletions="${12}" changed_files="${13}"
  local session_dir="$TMPDIR_BASE/session-$pr_number"
  mkdir -p "$session_dir"

  # Step 1: Find ALL workflow runs for this branch (newest first)
  local all_run_ids
  all_run_ids=$(gh api "repos/$repo/actions/runs?branch=$head_ref&per_page=20" \
    --jq '[.workflow_runs[] | select(
      .name == "Running Copilot coding agent" or
      .name == "Running Copilot cloud agent" or
      (.name | test("^Addressing comment on PR"; "i"))
    ) | .id]' \
    2>/dev/null) || {
    warn "$repo#$pr_number — failed to query Actions runs"
    return 1
  }

  if [[ $(echo "$all_run_ids" | jq 'length') -eq 0 ]]; then
    # Broader fallback
    all_run_ids=$(gh api "repos/$repo/actions/runs?branch=$head_ref&per_page=20" \
      --jq '[.workflow_runs[] | select(.name | test("copilot|Copilot|Addressing comment"; "i")) | .id]' \
      2>/dev/null) || true
    if [[ -z "$all_run_ids" || $(echo "$all_run_ids" | jq 'length') -eq 0 ]]; then
      warn "$repo#$pr_number — no agent workflow run found for branch $head_ref"
      return 2
    fi
  fi

  local invocation_count
  invocation_count=$(echo "$all_run_ids" | jq 'length')

  # Accumulators across all runs
  local total_active_secs=0 total_idle_secs=0 total_idle_gaps=0 overall_max_gap=0
  local total_tool_invocations=0 total_copilot_responses=0
  local total_log_lines=0 total_ts_lines=0
  local overall_first_ts="" overall_last_ts=""
  local prompt_chars="null"
  local run_ids_arr="[]"
  local runs_processed=0

  # Process each run (API returns newest-first; reverse to process oldest first for prompt extraction)
  local ordered_run_ids
  ordered_run_ids=$(echo "$all_run_ids" | jq -r 'reverse | .[]')

  while IFS= read -r run_id; do
    local run_dir="$session_dir/run-$run_id"
    mkdir -p "$run_dir"
    run_ids_arr=$(echo "$run_ids_arr" | jq --argjson id "$run_id" '. += [$id]')

    sleep "$DELAY_SECS"

    # Download logs
    local log_zip="$run_dir/logs.zip"
    if ! gh api "repos/$repo/actions/runs/$run_id/logs" > "$log_zip" 2>/dev/null; then
      warn "$repo#$pr_number run $run_id — failed to download logs (skipping run)"
      continue
    fi

    # Validate zip
    if ! file "$log_zip" | grep -qiE 'Zip|zip'; then
      if ! xxd "$log_zip" 2>/dev/null | head -1 | grep -q '504b'; then
        warn "$repo#$pr_number run $run_id — not a valid zip (skipping run)"
        continue
      fi
    fi

    sleep "$DELAY_SECS"

    # Extract and find copilot log
    if ! unzip -o -q "$log_zip" -d "$run_dir/logs" 2>/dev/null; then
      warn "$repo#$pr_number run $run_id — failed to extract zip (skipping run)"
      continue
    fi

    local copilot_log=""
    if [[ -f "$run_dir/logs/0_copilot.txt" ]]; then
      copilot_log="$run_dir/logs/0_copilot.txt"
    else
      copilot_log=$(find "$run_dir/logs" -name "*.txt" -type f | head -1)
    fi
    [[ -z "$copilot_log" || ! -f "$copilot_log" ]] && continue

    # Parse timestamps
    local timestamps_file="$run_dir/timestamps.txt"
    sed 's/^\xef\xbb\xbf//' "$copilot_log" | \
      grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+Z' \
      | sort > "$timestamps_file"

    local line_count ts_count
    line_count=$(wc -l < "$copilot_log" | tr -d ' ')
    ts_count=$(wc -l < "$timestamps_file" | tr -d ' ')
    total_log_lines=$((total_log_lines + line_count))
    total_ts_lines=$((total_ts_lines + ts_count))

    if [[ "$ts_count" -lt 2 ]]; then
      warn "$repo#$pr_number run $run_id — insufficient timestamps ($ts_count), skipping run"
      continue
    fi

    local compute_result
    compute_result=$(compute_active_idle "$timestamps_file")
    [[ -z "$compute_result" ]] && continue

    local active_secs idle_secs total_secs max_gap idle_gaps first_ts last_ts
    read -r active_secs idle_secs total_secs max_gap idle_gaps first_ts last_ts <<< "$compute_result"
    : "${active_secs:=0}" "${idle_secs:=0}" "${max_gap:=0}" "${idle_gaps:=0}"

    total_active_secs=$((total_active_secs + active_secs))
    total_idle_secs=$((total_idle_secs + idle_secs))
    total_idle_gaps=$((total_idle_gaps + idle_gaps))
    [[ "$max_gap" -gt "$overall_max_gap" ]] && overall_max_gap=$max_gap

    if [[ -z "$overall_first_ts" || "$first_ts" < "$overall_first_ts" ]]; then
      overall_first_ts="$first_ts"
    fi
    if [[ -z "$overall_last_ts" || "$last_ts" > "$overall_last_ts" ]]; then
      overall_last_ts="$last_ts"
    fi

    local tool_inv cop_resp
    tool_inv=$(grep -c 'Invoking tool:' "$copilot_log" || true)
    cop_resp=$(grep -c 'copilot:' "$copilot_log" || true)
    : "${tool_inv:=0}" "${cop_resp:=0}"
    total_tool_invocations=$((total_tool_invocations + tool_inv))
    total_copilot_responses=$((total_copilot_responses + cop_resp))

    # Extract prompt from first run that has it (oldest first due to reversed order)
    if [[ "$prompt_chars" == "null" ]]; then
      local prompt_text
      prompt_text=$(extract_prompt_text "$copilot_log")
      if [[ -n "$prompt_text" ]]; then
        prompt_chars=$(echo -n "$prompt_text" | wc -c | tr -d ' ')
      fi
    fi

    runs_processed=$((runs_processed + 1))
  done <<< "$ordered_run_ids"

  if [[ "$runs_processed" -eq 0 ]]; then
    warn "$repo#$pr_number — no runs could be processed"
    return 1
  fi

  # Build combined output
  local active_mins idle_mins total_mins
  active_mins=$(awk "BEGIN {printf \"%.1f\", $total_active_secs / 60}")
  idle_mins=$(awk "BEGIN {printf \"%.1f\", $total_idle_secs / 60}")
  total_mins=$(awk "BEGIN {printf \"%.1f\", ($total_active_secs + $total_idle_secs) / 60}")

  jq -n \
    --arg repo "$repo" \
    --argjson pr "$pr_number" \
    --arg head_ref "$head_ref" \
    --arg pr_state "$pr_state" \
    --arg pr_merged_at "$pr_merged_at" \
    --arg pr_created_at "$pr_created_at" \
    --argjson run_ids "$run_ids_arr" \
    --argjson invocation_count "$invocation_count" \
    --argjson runs_processed "$runs_processed" \
    --argjson api_duration_minutes "${duration_minutes:-null}" \
    --argjson active_minutes "$active_mins" \
    --argjson idle_minutes "$idle_mins" \
    --argjson total_log_minutes "$total_mins" \
    --argjson max_gap_seconds "$overall_max_gap" \
    --argjson idle_gap_count "$total_idle_gaps" \
    --argjson log_lines "$total_log_lines" \
    --argjson timestamped_lines "$total_ts_lines" \
    --argjson tool_invocations "$total_tool_invocations" \
    --argjson copilot_responses "$total_copilot_responses" \
    --arg first_timestamp "$overall_first_ts" \
    --arg last_timestamp "$overall_last_ts" \
    --argjson idle_threshold_secs "$IDLE_THRESHOLD" \
    --argjson developer_interventions "${additional_guidance_count:-0}" \
    --argjson prompt_chars "$prompt_chars" \
    --argjson additions "${additions:-null}" \
    --argjson deletions "${deletions:-null}" \
    --argjson changed_files "${changed_files:-null}" \
    '{
      repo: $repo,
      pr_number: $pr,
      head_ref: $head_ref,
      pr_state: $pr_state,
      pr_merged_at: (if $pr_merged_at == "null" then null else $pr_merged_at end),
      pr_created_at: $pr_created_at,
      run_ids: $run_ids,
      invocation_count: $invocation_count,
      runs_processed: $runs_processed,
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
      developer_interventions: $developer_interventions,
      prompt_chars: $prompt_chars,
      additions: $additions,
      deletions: $deletions,
      changed_files: $changed_files,
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
  additional_guidance_count=$(echo "$session" | jq '.additional_guidance_count // 0')
  origin_issue_number=$(echo "$session" | jq -r '.origin_issue_number // "null"')
  additions=$(echo "$session" | jq '.additions // null')
  deletions=$(echo "$session" | jq '.deletions // null')
  changed_files=$(echo "$session" | jq '.changed_files // null')

  info "[$PROCESSED/$TOTAL] $repo#$pr_number ($head_ref)..."

  result=$(process_session "$repo" "$pr_number" "$head_ref" "$pr_state" \
    "$pr_merged_at" "$pr_closed_at" "$pr_created_at" "$duration_minutes" \
    "$additional_guidance_count" "$origin_issue_number" \
    "$additions" "$deletions" "$changed_files" 2>&2) || {
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
