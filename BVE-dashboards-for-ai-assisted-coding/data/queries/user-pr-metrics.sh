#!/bin/bash
set -euo pipefail

# DEPRECATED: This script is not used in the automated pipeline.
# Per-user overlays use user_report data from copilot-user-and-enterprise-metrics.sh.
# Org-wide PR data comes from human-pr-metrics.sh.
# Kept for reference only — may be removed in a future cleanup.
#
# User-Centric PR Metrics Query (GraphQL + Adaptive Windowing)
#
# Collects pull request data for each Copilot-active user found in a
# Copilot user+enterprise metrics report. Uses author-based GitHub search
# to capture PRs across ALL repositories the user contributed to — not
# limited to a single org.
#
# Each PR retains its full owner/repo path (nameWithOwner) so downstream
# dashboards can filter by org or repo scope as needed.
#
# IMPORTANT: This script outputs JSON to stdout and progress messages to stderr.
#
# Correct usage:
#   ./user-pr-metrics.sh copilot-metrics.json > user-pr-data.json
#   DAYS=28 ./user-pr-metrics.sh copilot-metrics.json > user-pr-data.json
#   SINCE=2026-02-01 UNTIL=2026-02-28 ./user-pr-metrics.sh metrics.json > prs.json
#
# To save both JSON and logs:
#   ./user-pr-metrics.sh metrics.json 2>progress.log > user-pr-data.json
#

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage: user-pr-metrics.sh [COPILOT_REPORT_JSON]

User-Centric PR Metrics Query (GraphQL + Adaptive Windowing)

Reads a Copilot user+enterprise metrics report to extract active user logins,
then collects each user's pull requests across all repositories they contributed
to — not limited to a single org.

PRs retain the full owner/repo path (e.g. "my-org/my-repo") so downstream
dashboards can filter by org or repo scope.

Input:
  A Copilot metrics JSON file containing a user_report array.
  Pass as the first argument, or the script will prompt interactively.

Date Range:
  By default, aligns to the date range found in the Copilot report.
  Override with SINCE/UNTIL env vars, or DAYS for a rolling window.

  (no override)     created:{report_first_day}..{report_last_day}
  DAYS only:        created:{today - DAYS}..{today}
  SINCE only:       created:{SINCE}..{today}
  SINCE + UNTIL:    created:{SINCE}..{UNTIL}

  Note: Uses created: (not updated:) to match PRs to the period when the
  user was actively using Copilot. The org-scoped human-pr-metrics.sh uses
  updated: for broader capture; this script uses created: for precision.

Examples:
  ./user-pr-metrics.sh copilot-data.json                          # auto date range
  DAYS=28 ./user-pr-metrics.sh copilot-data.json                  # last 28 days
  SINCE=2026-02-01 ./user-pr-metrics.sh copilot-data.json         # Feb 1 → today
  SINCE=2026-02-01 UNTIL=2026-02-28 ./user-pr-metrics.sh data.json

Output: JSON with pull_requests (with LOC), detailed_pr_events (sample),
        and metadata about the collection run.

Environment Variables:
  GH_TOKEN       GitHub PAT (required, or use `gh auth login`)
  DAYS           Days to look back (overrides auto-detection from report)
  SINCE          Start date YYYY-MM-DD (overrides auto-detection)
  UNTIL          End date YYYY-MM-DD (overrides auto-detection)
EOF
  exit 0
fi

# ── Input file ───────────────────────────────────────────────────────────────
COPILOT_REPORT="${1:-}"
if [[ -z "$COPILOT_REPORT" ]]; then
  read -rp "Path to Copilot user+enterprise metrics JSON: " COPILOT_REPORT
fi

if [[ ! -f "$COPILOT_REPORT" ]]; then
  echo "Error: File not found: $COPILOT_REPORT" >&2
  exit 1
fi

# Validate structure — must contain user_report (enterprise mode output)
if ! jq -e '.user_report | type == "array"' "$COPILOT_REPORT" > /dev/null 2>&1; then
  echo "Error: File does not contain a user_report array." >&2
  echo "       This script requires enterprise-mode Copilot metrics output." >&2
  echo "       (Org-mode output only includes organization_report, not per-user data.)" >&2
  exit 1
fi

# ── Environment ──────────────────────────────────────────────────────────────
DAYS="${DAYS:-}"
SINCE="${SINCE:-}"
UNTIL="${UNTIL:-}"

if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]]; then
  if command -v gh &> /dev/null && gh auth status &> /dev/null; then
    export GH_TOKEN=$(gh auth token)
  else
    echo "Error: GH_TOKEN or GITHUB_TOKEN environment variable is required" >&2
    exit 1
  fi
fi

# ── Extract active user logins ───────────────────────────────────────────────
echo "Extracting active users from Copilot report…" >&2

LOGINS_JSON=$(jq -r '
  [.user_report[]
   | select(
       .code_generation_activity_count > 0 or
       .user_initiated_interaction_count > 0 or
       .used_agent == true or
       .used_chat == true
     )
   | .user_login
  ] | unique
' "$COPILOT_REPORT")

USER_COUNT=$(echo "$LOGINS_JSON" | jq 'length')

if (( USER_COUNT == 0 )); then
  echo "Error: No active Copilot users found in the report." >&2
  exit 1
fi

echo "  Found $USER_COUNT active Copilot users" >&2

# ── Date range ───────────────────────────────────────────────────────────────
# Auto-detect from report unless overridden by env vars
if [[ -n "$SINCE" ]]; then
  SINCE_DATE="$SINCE"
elif [[ -n "$DAYS" ]]; then
  SINCE_DATE=$(date -u -v-${DAYS}d +"%Y-%m-%d" 2>/dev/null || date -u -d "${DAYS} days ago" +"%Y-%m-%d")
else
  SINCE_DATE=$(jq -r '[.user_report[].day] | sort | first' "$COPILOT_REPORT")
fi

if [[ -n "$UNTIL" ]]; then
  UNTIL_DATE="$UNTIL"
elif [[ -n "$DAYS" ]]; then
  UNTIL_DATE=$(date -u +"%Y-%m-%d")
else
  UNTIL_DATE=$(jq -r '[.user_report[].day] | sort | last' "$COPILOT_REPORT")
fi

if [[ -z "$SINCE_DATE" || "$SINCE_DATE" == "null" || -z "$UNTIL_DATE" || "$UNTIL_DATE" == "null" ]]; then
  echo "Error: Could not determine date range. Set SINCE/UNTIL or DAYS." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMPDIR_WORK="${SCRIPT_DIR}/tmp/user-pr-work"
rm -rf "$TMPDIR_WORK"
mkdir -p "$TMPDIR_WORK"

# ── GraphQL query (nameWithOwner for full owner/repo path) ───────────────────
read -r -d '' GRAPHQL_SEARCH << 'GRAPHQL' || true
query($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 100, after: $cursor) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        title
        state
        createdAt
        updatedAt
        closedAt
        mergedAt
        author { login }
        repository { nameWithOwner }
        comments { totalCount }
        isDraft
        url
        additions
        deletions
        changedFiles
      }
    }
  }
}
GRAPHQL

# File-based counters (survive subshell boundaries)
API_CALLS_FILE="$TMPDIR_WORK/_api_calls"
RATE_WAITS_FILE="$TMPDIR_WORK/_rate_waits"
echo "0" > "$API_CALLS_FILE"
echo "0" > "$RATE_WAITS_FILE"

inc_api_calls() {
  local c; c=$(cat "$API_CALLS_FILE"); echo $((c + 1)) > "$API_CALLS_FILE"
}
get_api_calls() { cat "$API_CALLS_FILE"; }
inc_rate_waits() {
  local c; c=$(cat "$RATE_WAITS_FILE"); echo $((c + 1)) > "$RATE_WAITS_FILE"
}
get_rate_waits() { cat "$RATE_WAITS_FILE"; }

# ── Date helpers (macOS + Linux) ─────────────────────────────────────────────
epoch_of() { date -jf "%Y-%m-%d" "$1" +%s 2>/dev/null || date -d "$1" +%s; }
date_of()  { date -r "$1" +"%Y-%m-%d" 2>/dev/null || date -d "@$1" +"%Y-%m-%d"; }

midpoint_date() {
  local s; s=$(epoch_of "$1")
  local u; u=$(epoch_of "$2")
  date_of $(( (s + u) / 2 ))
}

next_day() {
  date_of $(( $(epoch_of "$1") + 86400 ))
}

# ── GraphQL helpers ──────────────────────────────────────────────────────────

# Count PRs matching a search query (1 API call)
count_prs() {
  local q="$1"
  inc_api_calls
  gh api graphql \
    -f query='query($q:String!){search(query:$q,type:ISSUE,first:1){issueCount}}' \
    -f q="$q" --jq '.data.search.issueCount'
}

# Fetch all PRs in a ≤1000-result window, appending compact JSON lines to outfile
fetch_window() {
  local q="$1" outfile="$2"
  local cursor="" has_next="true" page=0

  while [[ "$has_next" == "true" ]]; do
    page=$((page + 1))
    inc_api_calls

    local args=(-f query="$GRAPHQL_SEARCH" -f q="$q")
    [[ -n "$cursor" ]] && args+=(-f cursor="$cursor")

    # Call GraphQL with retry for rate limits
    local resp="" retries=0
    while true; do
      resp=$(gh api graphql "${args[@]}" 2>/dev/null) || resp=""

      local err_type
      err_type=$(echo "$resp" | jq -r '.errors[0].type // empty' 2>/dev/null) || true

      if [[ "$err_type" == "RATE_LIMITED" ]]; then
        retries=$((retries + 1))
        inc_rate_waits
        if (( retries > 3 )); then
          echo "        !! Rate limit exceeded after 3 retries" >&2
          return 1
        fi
        local wait=$((15 * retries))
        echo "        !! Rate limited, waiting ${wait}s (retry $retries/3)" >&2
        sleep "$wait"
        inc_api_calls
      elif [[ -n "$err_type" ]]; then
        echo "        !! GraphQL error: $(echo "$resp" | jq -r '.errors[0].message' 2>/dev/null)" >&2
        break
      else
        break
      fi
    done

    echo "$resp" > "$TMPDIR_WORK/_page.json"
    jq -c '.data.search.nodes[]' "$TMPDIR_WORK/_page.json" >> "$outfile" 2>/dev/null || true

    local meta
    meta=$(jq -r '"\(.data.search.nodes | length)\t\(.data.search.pageInfo.hasNextPage)\t\(.data.search.pageInfo.endCursor // "")"' \
      "$TMPDIR_WORK/_page.json" 2>/dev/null) || meta="0	false	"

    local n
    IFS=$'\t' read -r n has_next cursor <<< "$meta"
  done
}

# ── Adaptive windowing ───────────────────────────────────────────────────────
# Recursively bisect the date range until every sub-window has ≤1000 results.
# Writes result count to $count_file instead of echoing (avoids subshell variable loss).
collect_user_prs() {
  local login="$1" since="$2" until="$3" outfile="$4" count_file="$5" depth="${6:-0}"

  # Quote the login to handle hyphens/special chars in GitHub search syntax
  local q="author:\"${login}\" is:pr created:${since}..${until}"
  local count
  count=$(count_prs "$q")

  if (( count == 0 )); then
    echo "0" > "$count_file"
    return
  elif (( count <= 1000 )); then
    fetch_window "$q" "$outfile"
    echo "$count" > "$count_file"
  else
    local mid nd
    mid=$(midpoint_date "$since" "$until")
    nd=$(next_day "$mid")

    if [[ "$mid" == "$since" || "$nd" > "$until" ]]; then
      echo "        !! Single-day window with $count PRs — fetching first 1000" >&2
      fetch_window "$q" "$outfile"
      echo "$count" > "$count_file"
      return
    fi

    echo "        ↳ bisecting ${since}..${mid} + ${nd}..${until} ($count PRs)" >&2
    collect_user_prs "$login" "$since" "$mid" "$outfile" "$count_file" $((depth + 1))
    local c1; c1=$(cat "$count_file")
    collect_user_prs "$login" "$nd" "$until" "$outfile" "$count_file" $((depth + 1))
    local c2; c2=$(cat "$count_file")
    echo $(( c1 + c2 )) > "$count_file"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
echo "" >&2
echo "User-Centric PR Metrics (GraphQL)" >&2
echo "  Report: $(basename "$COPILOT_REPORT")" >&2
echo "  Users:  $USER_COUNT active Copilot users" >&2
echo "  Range:  $SINCE_DATE .. $UNTIL_DATE (created:)" >&2
echo "  Work:   $TMPDIR_WORK" >&2
echo "" >&2

START_TIME=$(date +%s)

# ── Phase 1: Collect PRs per user ────────────────────────────────────────────
echo "=== Phase 1: Collect PRs per user (GraphQL + adaptive windowing) ===" >&2

> "$TMPDIR_WORK/prs_raw.ndjson"
> "$TMPDIR_WORK/user_summary.ndjson"

USERS_WITH_PRS=0
TOTAL_PR_HITS=0
USER_IDX=0
USER_ERRORS=0

while IFS= read -r login; do
  USER_IDX=$((USER_IDX + 1))

  # Per-user collection with error handling — don't let one user kill the run
  echo "0" > "$TMPDIR_WORK/_user_count"
  if collect_user_prs "$login" "$SINCE_DATE" "$UNTIL_DATE" "$TMPDIR_WORK/prs_raw.ndjson" "$TMPDIR_WORK/_user_count"; then
    user_count=$(cat "$TMPDIR_WORK/_user_count")
  else
    echo "  !! Error collecting PRs for $login — skipping" >&2
    user_count=0
    USER_ERRORS=$((USER_ERRORS + 1))
  fi
  user_count=${user_count:-0}

  TOTAL_PR_HITS=$((TOTAL_PR_HITS + user_count))
  if (( user_count > 0 )); then
    USERS_WITH_PRS=$((USERS_WITH_PRS + 1))
  fi

  # Track per-user stats for metadata
  jq -cn --arg login "$login" --argjson count "$user_count" \
    '{login: $login, pr_count: $count}' >> "$TMPDIR_WORK/user_summary.ndjson"

  printf "  [%d/%d] %-30s %4d PRs  (total: %d, API: %d)\n" \
    "$USER_IDX" "$USER_COUNT" "$login" "$user_count" "$TOTAL_PR_HITS" "$(get_api_calls)" >&2

done < <(echo "$LOGINS_JSON" | jq -r '.[]')

RAW_LINES=$(wc -l < "$TMPDIR_WORK/prs_raw.ndjson" | tr -d ' ')
echo "" >&2
echo "Raw PR lines: $RAW_LINES (before dedup)" >&2
echo "Users with PRs: $USERS_WITH_PRS / $USER_COUNT" >&2

# Deduplicate + transform to expected output format
# Uses nameWithOwner for full owner/repo path
if [[ -s "$TMPDIR_WORK/prs_raw.ndjson" ]]; then
  jq -s '
    INDEX(.[]; .url) | [.[]] |
    {
      total_count: length,
      prs: [.[] | {
        number,
        title,
        state: (.state | ascii_downcase),
        created_at: .createdAt,
        updated_at: .updatedAt,
        closed_at: .closedAt,
        merged_at: .mergedAt,
        user: (.author.login // "ghost"),
        repository: .repository.nameWithOwner,
        comments: .comments.totalCount,
        draft: .isDraft,
        url,
        additions,
        deletions,
        changed_files: .changedFiles
      }]
    }
  ' "$TMPDIR_WORK/prs_raw.ndjson" > "$TMPDIR_WORK/prs_enriched.json"
else
  echo '{"total_count":0,"prs":[]}' > "$TMPDIR_WORK/prs_enriched.json"
fi

PR_COUNT=$(jq '.total_count' "$TMPDIR_WORK/prs_enriched.json")
echo "Unique PRs (with LOC): $PR_COUNT" >&2

# ── Phase 2: Detail sample for first 5 PRs (REST) ───────────────────────────
echo "" >&2
echo "=== Phase 2: Detailed PR Events (sample, first 5) ===" >&2

# Extract owner/repo pairs from nameWithOwner (e.g. "my-org/my-repo")
jq -r '.prs[:5] | .[] | "\(.repository) \(.number)"' "$TMPDIR_WORK/prs_enriched.json" \
  > "$TMPDIR_WORK/detail_list.txt"

> "$TMPDIR_WORK/details.ndjson"

while read -r nwo pr_num; do
  [[ -z "$nwo" ]] && continue
  echo "--- $nwo PR #$pr_num ---" >&2

  # Reviews
  echo "  >> Reviews:" >&2
  REVS=$(gh api --paginate \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$nwo/pulls/$pr_num/reviews" 2>/dev/null | \
    jq -c '[.[] | {id, user: .user.login, state, submitted_at}]' 2>/dev/null) || REVS="[]"
  echo "$REVS" | jq empty 2>/dev/null || REVS="[]"

  # Review Comments
  echo "  >> Review Comments:" >&2
  COMS=$(gh api --paginate \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$nwo/pulls/$pr_num/comments" 2>/dev/null | \
    jq -c '[.[] | {id, user: .user.login, created_at, updated_at}]' 2>/dev/null) || COMS="[]"
  echo "$COMS" | jq empty 2>/dev/null || COMS="[]"

  # Review Requests
  echo "  >> Review Requests:" >&2
  REQS=$(gh api --paginate \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$nwo/pulls/$pr_num/requested_reviewers" 2>/dev/null | \
    jq -c '{users: [.users[].login], teams: [.teams[].slug]}' 2>/dev/null) || REQS="{}"
  echo "$REQS" | jq empty 2>/dev/null || REQS="{}"

  # Timeline
  echo "  >> Timeline Events:" >&2
  TIME=$(gh api --paginate \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$nwo/issues/$pr_num/timeline" 2>/dev/null | \
    jq -c '[.[] | {event, created_at, actor: (.actor.login // .user.login)}]' 2>/dev/null) || TIME="[]"
  echo "$TIME" | jq empty 2>/dev/null || TIME="[]"

  jq -cn \
    --arg pr "$pr_num" \
    --arg repo "$nwo" \
    --argjson r "$REVS" \
    --argjson c "$COMS" \
    --argjson req "$REQS" \
    --argjson t "$TIME" \
    '{ pr_number: $pr, repository: $repo, reviews: $r, comments: $c, review_requests: $req, timeline: $t }' \
    >> "$TMPDIR_WORK/details.ndjson"
done < "$TMPDIR_WORK/detail_list.txt"

if [[ -s "$TMPDIR_WORK/details.ndjson" ]]; then
  jq -s '.' "$TMPDIR_WORK/details.ndjson" > "$TMPDIR_WORK/details.json"
else
  echo '[]' > "$TMPDIR_WORK/details.json"
fi

# ── Build per-user summary for metadata ──────────────────────────────────────
if [[ -s "$TMPDIR_WORK/user_summary.ndjson" ]]; then
  jq -s '.' "$TMPDIR_WORK/user_summary.ndjson" > "$TMPDIR_WORK/user_summary.json"
else
  echo '[]' > "$TMPDIR_WORK/user_summary.json"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
FINAL_API_CALLS=$(get_api_calls)
FINAL_RATE_WAITS=$(get_rate_waits)
echo "" >&2
echo "=== Done ===" >&2
echo "  Users queried:  $USER_COUNT" >&2
echo "  Users with PRs: $USERS_WITH_PRS" >&2
echo "  User errors:    $USER_ERRORS" >&2
echo "  Unique PRs:     $PR_COUNT" >&2
echo "  API calls:      $FINAL_API_CALLS" >&2
echo "  Rate waits:     $FINAL_RATE_WAITS" >&2
echo "  Time:           ${ELAPSED}s" >&2
echo "" >&2

# ── Distinct repos for metadata ──────────────────────────────────────────────
REPO_COUNT=$(jq '[.prs[].repository] | unique | length' "$TMPDIR_WORK/prs_enriched.json")
REPOS_JSON=$(jq '[.prs[].repository] | unique' "$TMPDIR_WORK/prs_enriched.json")

# ── Final output to stdout ───────────────────────────────────────────────────
jq -n \
  --slurpfile prs "$TMPDIR_WORK/prs_enriched.json" \
  --slurpfile details "$TMPDIR_WORK/details.json" \
  --slurpfile user_summary "$TMPDIR_WORK/user_summary.json" \
  --arg source "user-pr-metrics" \
  --arg report "$(basename "$COPILOT_REPORT")" \
  --arg since "$SINCE_DATE" \
  --arg until "$UNTIL_DATE" \
  --argjson users_queried "$USER_COUNT" \
  --argjson users_with_prs "$USERS_WITH_PRS" \
  --argjson user_errors "$USER_ERRORS" \
  --argjson api_calls "$FINAL_API_CALLS" \
  --argjson elapsed "$ELAPSED" \
  --argjson repos "$REPOS_JSON" \
  '{
    metadata: {
      source: $source,
      copilot_report: $report,
      date_range: { since: $since, until: $until },
      users_queried: $users_queried,
      users_with_prs: $users_with_prs,
      user_errors: $user_errors,
      repositories: $repos,
      api_calls: $api_calls,
      elapsed_seconds: $elapsed,
      per_user: $user_summary[0]
    },
    pull_requests: $prs[0],
    detailed_pr_events: $details[0]
  }'
