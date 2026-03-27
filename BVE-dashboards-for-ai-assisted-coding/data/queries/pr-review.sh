#!/bin/bash
set -euo pipefail

# PR Review Metrics Query (v2 — GraphQL + Adaptive Windowing)
# Collects pull request data with LOC (additions, deletions, changedFiles) inline.
# Uses GraphQL to eliminate N+1 REST calls and adaptive time-window bisection
# to overcome the 1000-result search cap.
#
# IMPORTANT: This script outputs JSON to stdout and progress messages to stderr.
# 
# Correct usage:
#   ORG="my-org" DAYS=28 ./pr-review.sh > pr-data.json
#   ORG="my-org" REPO="my-repo" DAYS=14 ./pr-review.sh > pr-data.json
#
# Incorrect (mixes stderr into JSON):
#   ./pr-review.sh > pr-data.json 2>&1
#
# To save both JSON and logs:
#   ./pr-review.sh 2>progress.log >pr-data.json
#

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage: pr-review.sh

PR Review Metrics Query (v2 — GraphQL + Adaptive Windowing)

Collects pull request data with LOC (additions, deletions, changed_files) in a
single GraphQL query per page — no separate LOC enrichment step required.
Automatically bisects the date range when any window exceeds 1000 PRs.

Date Range:
  By default, fetches PRs updated in the last 7 days.
  Use SINCE/UNTIL for an explicit date range, or DAYS for a rolling window.

  DAYS only:         updated:SINCE..TODAY  (SINCE = today − DAYS)
  SINCE only:        updated:SINCE..TODAY
  SINCE + UNTIL:     updated:SINCE..UNTIL

Examples:
  ORG=my-org ./pr-review.sh                                       # last 7 days
  ORG=my-org DAYS=28 ./pr-review.sh                               # last 28 days
  ORG=my-org SINCE=2026-02-01 ./pr-review.sh                      # Feb 1 → today
  ORG=my-org SINCE=2026-02-01 UNTIL=2026-02-28 ./pr-review.sh     # Feb only
  ORG=my-org REPO=my-repo DAYS=14 ./pr-review.sh                  # single repo

API Calls:
  - GraphQL search (type: ISSUE, is:pr) — paginated, ≤1000 per window
    Returns: number, title, state, dates, author, repo, LOC, etc.
  - Adaptive windowing: if a window has >1000 PRs, it is bisected until
    each sub-window fits within the 1000-result limit.
  - REST detail sample: reviews, comments, requested_reviewers, timeline
    for the first 5 PRs only.

Output: JSON with pull_requests (with LOC) and detailed_pr_events (sample)

Environment Variables:
  GH_TOKEN       GitHub PAT (required, or use `gh auth login`)
  ORG            GitHub Organization name (required)
  REPO           Repository name (optional, scopes to single repo)
  DAYS           Days to look back (default: 7, ignored if SINCE is set)
  SINCE          Start date YYYY-MM-DD (overrides DAYS)
  UNTIL          End date YYYY-MM-DD (default: today)

Usage Examples:
  # Correct usage (JSON to stdout, progress to stderr):
  ORG="octodemo" DAYS=28 ./pr-review.sh > octodemo-pr-data.json
  
  # Single repository:
  ORG="octodemo" REPO="my-repo" DAYS=14 ./pr-review.sh > pr-data.json
  
  # Save both JSON and progress log:
  ORG="octodemo" DAYS=28 ./pr-review.sh 2>progress.log >pr-data.json
  
  # Combined with AI assisted coding for structural dashboard:
  ENTERPRISE="octodemo" DAYS=28 ./ai-assisted-coding.sh > copilot-metrics.json
  ORG="octodemo" DAYS=28 ./pr-review.sh > pr-metrics.json
  # Upload both files to structural dashboard
EOF
  exit 0
fi

# ── Environment ──────────────────────────────────────────────────────────────
DAYS=${DAYS:-7}
ORG="${ORG:-}"
REPO="${REPO:-}"
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

if [[ -z "$ORG" ]]; then
  echo "Error: ORG environment variable is required" >&2
  exit 1
fi

# Determine date range (adaptive windowing always needs both endpoints)
if [[ -n "$SINCE" ]]; then
  SINCE_DATE="$SINCE"
else
  SINCE_DATE=$(date -u -v-${DAYS}d +"%Y-%m-%d" 2>/dev/null || date -u -d "${DAYS} days ago" +"%Y-%m-%d")
fi

if [[ -n "$UNTIL" ]]; then
  UNTIL_DATE="$UNTIL"
else
  UNTIL_DATE=$(date -u +"%Y-%m-%d")
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMPDIR_WORK="${SCRIPT_DIR}/tmp/pr-review-work"
mkdir -p "$TMPDIR_WORK"

# ── GraphQL query (returns LOC inline — no N+1) ─────────────────────────────
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
        repository { name }
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

API_CALLS=0

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
  API_CALLS=$((API_CALLS + 1))
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
    API_CALLS=$((API_CALLS + 1))

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
        if (( retries > 3 )); then
          echo "      !! Rate limit exceeded after 3 retries" >&2
          return 1
        fi
        local wait=$((15 * retries))
        echo "      !! Rate limited, waiting ${wait}s (retry $retries/3)" >&2
        sleep "$wait"
        API_CALLS=$((API_CALLS + 1))
      elif [[ -n "$err_type" ]]; then
        echo "      !! GraphQL error: $(echo "$resp" | jq -r '.errors[0].message' 2>/dev/null)" >&2
        break
      else
        break
      fi
    done

    # Write page results to temp file (avoids multiple jq passes on $resp)
    echo "$resp" > "$TMPDIR_WORK/_page.json"
    jq -c '.data.search.nodes[]' "$TMPDIR_WORK/_page.json" >> "$outfile" 2>/dev/null || true

    # Extract pagination metadata in one jq call
    local meta
    meta=$(jq -r '"\(.data.search.nodes | length)\t\(.data.search.pageInfo.hasNextPage)\t\(.data.search.pageInfo.endCursor // "")"' \
      "$TMPDIR_WORK/_page.json" 2>/dev/null) || meta="0	false	"

    local n
    IFS=$'\t' read -r n has_next cursor <<< "$meta"
    echo "      page $page: $n PRs" >&2
  done
}

# ── Adaptive windowing ───────────────────────────────────────────────────────
# Recursively bisect the date range until every sub-window has ≤1000 results.
collect_prs() {
  local since="$1" until="$2" outfile="$3" depth="${4:-0}"
  local pad=""; for ((i=0; i<depth; i++)); do pad+="  "; done

  local q="org:$ORG${REPO:+ repo:$ORG/$REPO} is:pr updated:${since}..${until}"
  local count
  count=$(count_prs "$q")

  echo "  ${pad}${since}..${until}: ${count} PRs" >&2

  if (( count == 0 )); then
    return
  elif (( count <= 1000 )); then
    fetch_window "$q" "$outfile"
  else
    local mid nd
    mid=$(midpoint_date "$since" "$until")
    nd=$(next_day "$mid")

    # Guard: can't bisect a single day
    if [[ "$mid" == "$since" || "$nd" > "$until" ]]; then
      echo "  ${pad}!! Single-day window with $count PRs — fetching first 1000" >&2
      fetch_window "$q" "$outfile"
      return
    fi

    echo "  ${pad}↳ bisecting → ${since}..${mid}  +  ${nd}..${until}" >&2
    collect_prs "$since" "$mid" "$outfile" $((depth + 1))
    collect_prs "$nd" "$until" "$outfile" $((depth + 1))
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
echo "PR Review Metrics (v2 — GraphQL)" >&2
echo "  Org:   $ORG${REPO:+/$REPO}" >&2
echo "  Range: $SINCE_DATE .. $UNTIL_DATE" >&2
echo "  Work:  $TMPDIR_WORK" >&2
echo "" >&2

START_TIME=$(date +%s)

# Phase 1 — Collect all PRs with adaptive windowing
echo "=== Phase 1: Collect PRs (GraphQL + adaptive windowing) ===" >&2
> "$TMPDIR_WORK/prs_raw.ndjson"
collect_prs "$SINCE_DATE" "$UNTIL_DATE" "$TMPDIR_WORK/prs_raw.ndjson"

RAW_LINES=$(wc -l < "$TMPDIR_WORK/prs_raw.ndjson" | tr -d ' ')
echo "" >&2
echo "Raw PR lines: $RAW_LINES (before dedup)" >&2

# Deduplicate (overlapping window boundaries) + transform to expected output format
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
        repository: .repository.name,
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

# Phase 2 — Detail sample for first 5 PRs (REST — only 5 PRs, not worth GraphQL)
echo "" >&2
echo "=== Phase 2: Detailed PR Events (sample, first 5) ===" >&2

jq -r '.prs[:5] | .[] | "\(.repository) \(.number)"' "$TMPDIR_WORK/prs_enriched.json" \
  > "$TMPDIR_WORK/detail_list.txt"

> "$TMPDIR_WORK/details.ndjson"

while read -r repo pr_num; do
  echo "--- $repo PR #$pr_num ---" >&2

  # Reviews
  echo "  >> Reviews:" >&2
  REVS=$(gh api --paginate \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$ORG/$repo/pulls/$pr_num/reviews" 2>/dev/null | \
    jq -c '[.[] | {id, user: .user.login, state, submitted_at}]' 2>/dev/null) || REVS="[]"
  echo "$REVS" | jq empty 2>/dev/null || REVS="[]"

  # Review Comments
  echo "  >> Review Comments:" >&2
  COMS=$(gh api --paginate \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$ORG/$repo/pulls/$pr_num/comments" 2>/dev/null | \
    jq -c '[.[] | {id, user: .user.login, created_at, updated_at}]' 2>/dev/null) || COMS="[]"
  echo "$COMS" | jq empty 2>/dev/null || COMS="[]"

  # Review Requests
  echo "  >> Review Requests:" >&2
  REQS=$(gh api --paginate \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$ORG/$repo/pulls/$pr_num/requested_reviewers" 2>/dev/null | \
    jq -c '{users: [.users[].login], teams: [.teams[].slug]}' 2>/dev/null) || REQS="{}"
  echo "$REQS" | jq empty 2>/dev/null || REQS="{}"

  # Timeline
  echo "  >> Timeline Events:" >&2
  TIME=$(gh api --paginate \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$ORG/$repo/issues/$pr_num/timeline" 2>/dev/null | \
    jq -c '[.[] | {event, created_at, actor: (.actor.login // .user.login)}]' 2>/dev/null) || TIME="[]"
  echo "$TIME" | jq empty 2>/dev/null || TIME="[]"

  jq -cn \
    --arg pr "$pr_num" \
    --argjson r "$REVS" \
    --argjson c "$COMS" \
    --argjson req "$REQS" \
    --argjson t "$TIME" \
    '{ pr_number: $pr, reviews: $r, comments: $c, review_requests: $req, timeline: $t }' \
    >> "$TMPDIR_WORK/details.ndjson"
done < "$TMPDIR_WORK/detail_list.txt"

if [[ -s "$TMPDIR_WORK/details.ndjson" ]]; then
  jq -s '.' "$TMPDIR_WORK/details.ndjson" > "$TMPDIR_WORK/details.json"
else
  echo '[]' > "$TMPDIR_WORK/details.json"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo "" >&2
echo "=== Done ===" >&2
echo "  PRs:       $PR_COUNT" >&2
echo "  API calls: $API_CALLS" >&2
echo "  Time:      ${ELAPSED}s" >&2
echo "" >&2

# Final output to stdout
jq -n \
  --slurpfile prs "$TMPDIR_WORK/prs_enriched.json" \
  --slurpfile details "$TMPDIR_WORK/details.json" \
  '{ pull_requests: $prs[0], detailed_pr_events: $details[0] }'
