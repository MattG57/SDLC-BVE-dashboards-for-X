#!/bin/bash
set -euo pipefail

# Agentic AI Coding Metrics Query
# Collects Copilot Coding Agent and Code Review Agent activity from repository-level APIs.
# Produces PR sessions (agent-authored PRs with lifecycle data), request events
# (issue assignments and @copilot mentions), and a developer/day summary.
#
# Unlike the enterprise Copilot metrics API, this script queries per-repo data
# to build an agentic activity dataset from issues, PRs, timelines, and comments.

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: $0"
  echo "Agentic AI Coding Metrics Query"
  echo "Collects Copilot Coding Agent and Code Review Agent activity."
  echo "Queries repository-level issues, PRs, timelines, and comments to build"
  echo "an agentic activity dataset: PR sessions, request events, and dev/day summary."
  echo ""
  echo "Modes:" >&2
  echo "  Single-repo:  Set ORG + REPO to query one repository" >&2
  echo "  Multi-repo:   Set ORG only (omit REPO) to discover and query all" >&2
  echo "                active repos in the org. Repos with no issue/PR/push" >&2
  echo "                activity in the time window are automatically skipped." >&2
  echo "" >&2
  echo "Endpoints Called (per repo):" >&2
  echo "  - /repos/{org}/{repo}/issues?state=all (issues + PRs inventory)" >&2
  echo "  - /repos/{org}/{repo}/pulls?state=all (PR inventory)" >&2
  echo "  - /repos/{org}/{repo}/issues/{n}/timeline (assignment events)" >&2
  echo "  - /repos/{org}/{repo}/issues/{n}/comments (@copilot mentions)" >&2
  echo "  - /repos/{org}/{repo}/pulls/{n} (PR detail)" >&2
  echo "  - /repos/{org}/{repo}/pulls/{n}/reviews (review events)" >&2
  echo "  - /search/issues (copilot-session label lookup)" >&2
  echo "" >&2
  echo "Multi-repo discovery:" >&2
  echo "  - /orgs/{org}/repos (list all, filter by updated_at/pushed_at)" >&2
  echo "" >&2
  echo "Output: Combined JSON with pr_sessions, requests, and developer_day_summary" >&2
  echo "" >&2
  echo "Environment Variables:" >&2
  echo "  ORG            - GitHub Organization name (required)" >&2
  echo "  REPO           - GitHub Repository name (optional; omit for all active repos)" >&2
  echo "  DAYS           - Number of days to look back (default: 28)" >&2
  echo "  MAX_REPOS      - Maximum repos to process in multi-repo mode (default: unlimited)" >&2
  exit 0
fi

DAYS=${DAYS:-28}
MAX_REPOS=${MAX_REPOS:-0}
ORG="${ORG:-}"
REPO="${REPO:-}"

if [[ -z "$ORG" ]]; then
  echo "Error: ORG environment variable is required" >&2
  exit 1
fi

# Check if gh CLI is authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh CLI not authenticated. Run 'gh auth login' or set GH_TOKEN/GITHUB_TOKEN" >&2
  exit 1
fi

SINCE_DATE=$(date -u -v-${DAYS}d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "${DAYS} days ago" +"%Y-%m-%dT%H:%M:%SZ")

# ── Helper functions ──────────────────────────────────────────────────────────

gh_api() {
  local _url="$1" _attempt _result _exit_code _retry_after
  for _attempt in 1 2 3; do
    _exit_code=0
    _result=$(gh api \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "$_url" 2>/dev/null) || _exit_code=$?
    if [[ $_exit_code -eq 0 && -n "$_result" ]]; then
      echo "$_result"
      return 0
    fi
    if [[ $_attempt -lt 3 ]]; then
      _retry_after=$(( _attempt * 5 ))
      echo "  ⚠ API error on $_url (attempt $_attempt), retrying in ${_retry_after}s..." >&2
      sleep "$_retry_after"
    fi
  done
  echo '{}'
  return 1
}

gh_api_array() {
  local _url="$1" _attempt _tmp_pages _exit_code
  for _attempt in 1 2 3; do
    _tmp_pages=$(mktemp)
    _exit_code=0
    gh api --paginate \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "$_url" > "$_tmp_pages" 2>/dev/null || _exit_code=$?
    # If we got valid JSON output, use it (even if gh exited non-zero on a later page)
    if [[ -s "$_tmp_pages" ]] && head -c1 "$_tmp_pages" | grep -q '[\[{]'; then
      # Filter to only valid JSON objects/arrays, skip HTML error pages
      jq -s 'map(if type == "array" then . else [.] end) | add // []' < "$_tmp_pages" 2>/dev/null && { rm -f "$_tmp_pages"; return 0; }
    fi
    rm -f "$_tmp_pages"
    [[ $_attempt -lt 3 ]] && { echo "  ⚠ API error on attempt $_attempt, retrying in $((_attempt * 5))s..." >&2; sleep $((_attempt * 5)); }
  done
  echo '[]'
  return 1
}

gh_api_timeline_array() {
  local _url="$1" _attempt _tmp_pages _exit_code
  for _attempt in 1 2 3; do
    _tmp_pages=$(mktemp)
    _exit_code=0
    gh api --paginate \
      -H "Accept: application/vnd.github.mockingbird-preview+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "$_url" > "$_tmp_pages" 2>/dev/null || _exit_code=$?
    if [[ -s "$_tmp_pages" ]] && head -c1 "$_tmp_pages" | grep -q '[\[{]'; then
      jq -s 'map(if type == "array" then . else [.] end) | add // []' < "$_tmp_pages" 2>/dev/null && { rm -f "$_tmp_pages"; return 0; }
    fi
    rm -f "$_tmp_pages"
    [[ $_attempt -lt 3 ]] && { echo "  ⚠ API error on attempt $_attempt, retrying in $((_attempt * 5))s..." >&2; sleep $((_attempt * 5)); }
  done
  echo '[]'
  return 1
}

# Temp files for streaming builds (cleaned up at exit)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

TMP_REQUESTS="$TMP_DIR/requests.jsonl"
TMP_PR_SESSIONS="$TMP_DIR/pr_sessions.jsonl"
: > "$TMP_REQUESTS"
: > "$TMP_PR_SESSIONS"

# ── Repo Discovery ───────────────────────────────────────────────────────────

if [[ -n "$REPO" ]]; then
  REPO_LIST=("$REPO")
  echo "Single-repo mode: $ORG/$REPO (last $DAYS days since $SINCE_DATE)" >&2
  echo "" >&2
else
  echo "=== Discovering Active Repositories ===" >&2
  echo "Org: $ORG | Window: last $DAYS days (since $SINCE_DATE)" >&2

  # Use 'gh repo list' for discovery — it handles massive orgs (1000s of repos)
  # more reliably than 'gh api --paginate /orgs/.../repos' which can 502 mid-stream.
  REPO_JSON=$(gh repo list "$ORG" --limit 99999 --json name,updatedAt,pushedAt 2>/dev/null) || {
    echo "Error: Could not list repos for org $ORG" >&2
    exit 1
  }
  TOTAL_REPO_COUNT=$(echo "$REPO_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  echo "  Total repos in org: $TOTAL_REPO_COUNT" >&2

  # Keep only repos with issue/PR/push activity within the time window.
  # updatedAt covers issue and PR metadata changes; pushedAt covers git pushes.
  ACTIVE_REPO_CSV=$(echo "$REPO_JSON" | python3 -c "
import sys, json
from datetime import datetime, timezone
repos = json.load(sys.stdin)
since = '$SINCE_DATE'
for r in repos:
    u = r.get('updatedAt','') or ''
    p = r.get('pushedAt','') or ''
    if u >= since or p >= since:
        print(r['name'])
")

  REPO_LIST=()
  while IFS= read -r rn; do
    [[ -n "$rn" ]] && REPO_LIST+=("$rn")
  done <<< "$ACTIVE_REPO_CSV"

  if [[ ${#REPO_LIST[@]} -eq 0 ]]; then
    echo "  No repos with activity in the last $DAYS days. Nothing to collect." >&2
    echo '{"pr_sessions":[],"requests":[],"developer_day_summary":[]}'
    exit 0
  fi

  SKIPPED=$((TOTAL_REPO_COUNT - ${#REPO_LIST[@]}))
  echo "  Active repos: ${#REPO_LIST[@]}  |  Skipped (no recent activity): $SKIPPED" >&2

  # Apply MAX_REPOS cap if set
  if [[ "$MAX_REPOS" -gt 0 && ${#REPO_LIST[@]} -gt "$MAX_REPOS" ]]; then
    echo "  Capping to MAX_REPOS=$MAX_REPOS" >&2
    REPO_LIST=("${REPO_LIST[@]:0:$MAX_REPOS}")
  fi

  printf '    • %s\n' "${REPO_LIST[@]}" >&2
  echo "" >&2
fi

# ── Per-Repo Collection ──────────────────────────────────────────────────────
# Appends request events and PR session records to the shared temp files.

collect_repo_data() {
  local REPO="$1"

  # Disable errexit inside the function so one API error doesn't kill the whole run.
  # The || handler in the main loop catches failures and continues to the next repo.
  set +e

  echo "── $ORG/$REPO ──" >&2

  # Step 1: Pull repo inventories (write to temp files to avoid ARG_MAX)
  local TMP_ALL_ISSUES="$TMP_DIR/issues_${REPO}.json"
  local TMP_ALL_PULLS="$TMP_DIR/pulls_${REPO}.json"
  local TMP_ISSUES_ONLY="$TMP_DIR/issues_only_${REPO}.json"

  gh_api_array "/repos/${ORG}/${REPO}/issues?state=all&since=$SINCE_DATE&per_page=100" > "$TMP_ALL_ISSUES" 2>/dev/null || {
    echo "  ⚠ Could not list issues — skipping repo" >&2
    set -e; return 1
  }
  gh_api_array "/repos/${ORG}/${REPO}/pulls?state=all&per_page=100" > "$TMP_ALL_PULLS" 2>/dev/null || {
    echo "  ⚠ Could not list PRs — skipping repo" >&2
    set -e; return 1
  }

# Filter pulls by date (updated since SINCE_DATE)
jq --arg since "$SINCE_DATE" '[.[] | select(.updated_at >= $since)]' "$TMP_ALL_PULLS" > "$TMP_ALL_PULLS.tmp" && mv "$TMP_ALL_PULLS.tmp" "$TMP_ALL_PULLS"

# Separate issues (not PRs)
jq '[.[] | select(type == "object" and (has("pull_request") | not))]' "$TMP_ALL_ISSUES" > "$TMP_ISSUES_ONLY"

# Pre-filter issues: only scan issues that likely have Copilot activity.
jq --arg since "$SINCE_DATE" '
  [ .[] | select(
      (.created_at >= $since) or
      (any(.assignees[]?; .login // "" | ascii_downcase | test("copilot")))
  )]' "$TMP_ISSUES_ONLY" > "$TMP_ISSUES_ONLY.tmp" && mv "$TMP_ISSUES_ONLY.tmp" "$TMP_ISSUES_ONLY"

  local n_issues n_prs
  n_issues=$(jq 'length' "$TMP_ISSUES_ONLY")
  n_prs=$(jq 'length' "$TMP_ALL_PULLS")
  echo "  Issues: $n_issues, PRs: $n_prs" >&2

  if [[ "$n_issues" -eq 0 && "$n_prs" -eq 0 ]]; then
    echo "  (no activity — skipping)" >&2
    rm -f "$TMP_ALL_ISSUES" "$TMP_ALL_PULLS" "$TMP_ISSUES_ONLY"
    set -e; return 0
  fi

  # Step 2: Build request-event dataset

  # A. Copilot assignments — only issues whose assignees include "copilot"
  local n_copilot_assigned
  n_copilot_assigned=$(jq '[.[] | select(any(.assignees[]?; .login // "" | ascii_downcase | test("copilot")))] | length' "$TMP_ISSUES_ONLY")

  if [[ "$n_copilot_assigned" -gt 0 ]]; then
    echo "  Copilot-assigned issues: $n_copilot_assigned" >&2
    jq -c '.[] | select(any(.assignees[]?; .login // "" | ascii_downcase | test("copilot")))' "$TMP_ISSUES_ONLY" | while read -r issue_row; do
      issue_number=$(jq -r '.number' <<<"$issue_row")
      issue_title=$(jq -r '.title // ""' <<<"$issue_row")
      issue_state=$(jq -r '.state // ""' <<<"$issue_row")
      issue_id=$(jq -r '.id // empty' <<<"$issue_row")
      issue_node_id=$(jq -r '.node_id // empty' <<<"$issue_row")
      issue_url=$(jq -r '.html_url // empty' <<<"$issue_row")
      issue_created_at=$(jq -r '.created_at // empty' <<<"$issue_row")

      timeline_json=$(gh_api_timeline_array "/repos/${ORG}/${REPO}/issues/${issue_number}/timeline?per_page=100" 2>/dev/null || echo '[]')

      # Skip if timeline fetch failed
      if [[ -z "$timeline_json" || "$timeline_json" == "null" ]]; then
        continue
      fi

      jq -c \
        --arg repo "$ORG/$REPO" \
        --arg issue_title "$issue_title" \
        --arg issue_state "$issue_state" \
        --arg issue_url "$issue_url" \
        --arg issue_id "$issue_id" \
        --arg issue_node_id "$issue_node_id" \
        --arg issue_created_at "$issue_created_at" \
        --argjson issue_number "$issue_number" '
        .[]
        | select(.event == "assigned")
        | select((.assignee.login // "" | ascii_downcase) | test("copilot"))
        | select((.actor.login // "" | ascii_downcase) | test("\\[bot\\]$|^copilot$|^github-actions$") | not)
        | {
            repo: $repo,
            request_event_id: ("issue-assignment:" + $repo + ":" + (.created_at // "") + ":" + (.assignee.login // "copilot") + ":" + (.actor.login // "unknown")),
            request_type: "issue_assignment",
            requested_at: (.created_at // null),
            requested_by_login: (.actor.login // null),
            issue_number: $issue_number,
            issue_id: (if $issue_id == "" then null else ($issue_id | tonumber) end),
            issue_node_id: (if $issue_node_id == "" then null else $issue_node_id end),
            issue_title: $issue_title,
            issue_state: $issue_state,
            issue_created_at: (if $issue_created_at == "" then null else $issue_created_at end),
            issue_url: $issue_url,
            is_pull_request: false,
            pr_number: null,
            comment_id: null,
            comment_body_excerpt: null,
            copilot_target_mode: "assignee",
            linked_pr_number: null
          }
      ' <<<"$timeline_json" >> "$TMP_REQUESTS" 2>/dev/null || true
    done
  fi

  # B. @copilot comment mentions — single repo-wide call covers issues AND PRs
  #    /repos/{owner}/{repo}/issues/comments covers both issue and PR comments.
  #    Write to temp file to avoid ARG_MAX on repos with many comments.
  local TMP_ALL_COMMENTS="$TMP_DIR/all_comments_${REPO}.json"
  local TMP_ITEM_LOOKUP="$TMP_DIR/item_lookup_${REPO}.json"
  gh_api_array "/repos/${ORG}/${REPO}/issues/comments?since=$SINCE_DATE&per_page=100" > "$TMP_ALL_COMMENTS" 2>/dev/null || echo '[]' > "$TMP_ALL_COMMENTS"
  # Build a lookup of issue/PR metadata by number for enrichment
  jq -n \
    --slurpfile issues "$TMP_ISSUES_ONLY" \
    --slurpfile pulls "$TMP_ALL_PULLS" '
    [(($issues[0] // [])[] | {key: (.number | tostring), value: {title: .title, state: .state, id: .id, node_id: .node_id, url: .html_url, created_at: .created_at, is_pr: false}}),
     (($pulls[0]  // [])[] | {key: (.number | tostring), value: {title: .title, state: .state, id: .id, node_id: .node_id, url: .html_url, created_at: .created_at, is_pr: true}})]
    | from_entries
  ' > "$TMP_ITEM_LOOKUP"
  # Filter comments for @copilot mentions and emit request events
  jq -c \
    --arg repo "$ORG/$REPO" \
    --slurpfile lookup "$TMP_ITEM_LOOKUP" '
    .[]
    | select((.body // "" | ascii_downcase) | contains("@copilot"))
    | select((.user.login // "" | ascii_downcase) | test("\\[bot\\]$|^copilot$|^github-actions$") | not)
    | (.issue_url // "" | split("/") | last) as $item_num
    | ($lookup[0][$item_num] // null) as $item
    | select($item != null)
    | {
        repo: $repo,
        request_event_id: ("comment-mention:" + $repo + ":" + (.id | tostring)),
        request_type: "comment_mention",
        requested_at: (.created_at // null),
        requested_by_login: (.user.login // null),
        issue_number: ($item_num | tonumber),
        issue_id: (if $item.is_pr then null else $item.id end),
        issue_node_id: (if $item.is_pr then null else $item.node_id end),
        issue_title: ($item.title // ""),
        issue_state: ($item.state // ""),
        issue_created_at: ($item.created_at // null),
        issue_url: ($item.url // ""),
        is_pull_request: $item.is_pr,
        pr_number: (if $item.is_pr then ($item_num | tonumber) else null end),
        comment_id: (.id // null),
        comment_body_excerpt: (
          (.body // "")
          | gsub("\r|\n"; " ")
          | if length > 180 then .[0:177] + "..." else . end
        ),
        copilot_target_mode: "@mention",
        linked_pr_number: (if $item.is_pr then ($item_num | tonumber) else null end)
      }
  ' "$TMP_ALL_COMMENTS" >> "$TMP_REQUESTS" 2>/dev/null || true
  local n_copilot_comments
  n_copilot_comments=$(jq '[.[] | select((.body // "" | ascii_downcase) | contains("@copilot"))] | length' "$TMP_ALL_COMMENTS" 2>/dev/null || echo 0)
  [[ "$n_copilot_comments" -gt 0 ]] && echo "  @copilot comment mentions: $n_copilot_comments" >&2
  rm -f "$TMP_ALL_COMMENTS" "$TMP_ITEM_LOOKUP"

# Step 3: Build PR sessions dataset

SESSION_ISSUES=$(gh_api "/search/issues?q=repo:${ORG}/${REPO}+is:issue+label:copilot-session&per_page=100" 2>/dev/null || echo '{"items":[]}')

# Find Copilot-authored PRs, or PRs with "copilot" in title by non-bot authors
jq -c '.[]
  | select(
      ((.user.login // "" | ascii_downcase) | test("copilot"))
      or
      (
        ((.title // "" | ascii_downcase) | test("copilot"))
        and
        ((.user.login // "" | ascii_downcase) | test("\\[bot\\]$") | not)
      )
    )' "$TMP_ALL_PULLS" | while read -r pr_row; do

  pr_number=$(jq -r '.number' <<<"$pr_row")
  pr_json=$(gh_api "/repos/${ORG}/${REPO}/pulls/${pr_number}" 2>/dev/null || echo '{}')

  # Skip if API returned empty or invalid JSON
  if [[ -z "$pr_json" || "$pr_json" == "{}" || "$pr_json" == "null" ]]; then
    echo "    ⚠ Skipping PR #${pr_number} (API error)" >&2
    continue
  fi
  if ! jq -e '.number' <<<"$pr_json" >/dev/null 2>&1; then
    echo "    ⚠ Skipping PR #${pr_number} (invalid response)" >&2
    continue
  fi

  pr_reviews=$(gh_api_array "/repos/${ORG}/${REPO}/pulls/${pr_number}/reviews?per_page=100" 2>/dev/null || echo '[]')
  pr_issue_comments=$(gh_api_array "/repos/${ORG}/${REPO}/issues/${pr_number}/comments?per_page=100" 2>/dev/null || echo '[]')
  pr_timeline=$(gh_api_timeline_array "/repos/${ORG}/${REPO}/issues/${pr_number}/timeline?per_page=100" 2>/dev/null || echo '[]')

  pr_title=$(jq -r '.title // ""' <<<"$pr_json")
  pr_created_at=$(jq -r '.created_at // ""' <<<"$pr_json")
  pr_closed_at=$(jq -r '.closed_at // ""' <<<"$pr_json")
  pr_merged_at=$(jq -r '.merged_at // ""' <<<"$pr_json")
  pr_state=$(jq -r '.state // ""' <<<"$pr_json")
  pr_draft=$(jq -r '.draft // false' <<<"$pr_json")
  pr_author_login=$(jq -r '.user.login // ""' <<<"$pr_json")
  pr_id=$(jq -r '.id // empty' <<<"$pr_json")
  pr_node_id=$(jq -r '.node_id // empty' <<<"$pr_json")
  pr_url=$(jq -r '.html_url // empty' <<<"$pr_json")
  merged_by=$(jq -r '.merged_by.login // empty' <<<"$pr_json")
  base_ref=$(jq -r '.base.ref // empty' <<<"$pr_json")
  head_ref=$(jq -r '.head.ref // empty' <<<"$pr_json")
  additions=$(jq -r '.additions // 0' <<<"$pr_json")
  deletions=$(jq -r '.deletions // 0' <<<"$pr_json")
  changed_files=$(jq -r '.changed_files // 0' <<<"$pr_json")

  additional_guidance_count=$(jq '
    map(select((.body // "" | ascii_downcase) | contains("@copilot")))
    | length
  ' <<<"$pr_issue_comments")

  changes_requested_count=$(jq '
    map(select((.state // "") == "CHANGES_REQUESTED"))
    | length
  ' <<<"$pr_reviews")

  reopened_count=$(jq '
    map(select((.event // "") == "reopened"))
    | length
  ' <<<"$pr_timeline")

  # Determine latest status
  latest_status="In PR review"
  if [[ -n "$pr_merged_at" && "$pr_merged_at" != "null" ]]; then
    latest_status="Merged"
  elif [[ "$pr_state" == "closed" ]]; then
    latest_status="Closed without merge"
  elif [[ "$pr_state" == "open" ]]; then
    latest_status="In PR review"
  fi

  # Find origin request: match this PR back to the issue/human that spawned it.
  # Strategy (in priority order):
  #   1. copilot_work_started timeline event (most reliable — actor is the human requester)
  #   2. Parse PR body for "Fixes #N" / "Resolves #N" / "Closes #N" references
  #   3. Cross-referenced issues in the PR timeline
  #   4. Fallback: earliest @copilot comment on the PR

  origin_issue_number=""
  origin_requested_by=""
  origin_requested_at=""
  origin_request_type=""
  copilot_work_finished_at=""
  copilot_invocation_count=0
  copilot_work_minutes=""
  session_issue_number=""

  # 1. copilot_work_started / copilot_work_finished timeline events
  copilot_start_row=$(jq -c '
    [.[] | select((.event // "") == "copilot_work_started")] | .[0] // empty
  ' <<<"$pr_timeline" 2>/dev/null || true)

  if [[ -n "$copilot_start_row" && "$copilot_start_row" != "null" ]]; then
    origin_requested_by=$(jq -r '.actor.login // empty' <<<"$copilot_start_row")
    origin_requested_at=$(jq -r '.created_at // empty' <<<"$copilot_start_row")
    origin_request_type="copilot_work_started"

    copilot_work_finished_at=$(jq -r '
      [.[] | select((.event // "") == "copilot_work_finished")] | .[-1].created_at // empty
    ' <<<"$pr_timeline" 2>/dev/null || true)

    # Count all copilot_work_started events and sum individual work segments
    copilot_invocation_count=$(jq '
      [.[] | select((.event // "") == "copilot_work_started")] | length
    ' <<<"$pr_timeline" 2>/dev/null || echo 0)

    # Sum paired start→finish durations (handles multi-round sessions)
    if command -v python3 >/dev/null 2>&1; then
      copilot_work_minutes=$(jq -r '
        [ .[] | select((.event // "") | test("^copilot_work_(started|finished)$")) | {event: .event, ts: .created_at} ]
        | map(.event + "|" + .ts) | join("\n")
      ' <<<"$pr_timeline" 2>/dev/null | python3 -c "
import sys
from datetime import datetime, timezone
def p(s):
    if s.endswith('Z'): return datetime.strptime(s,'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(s)
total = 0
last_start = None
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    event, ts = line.split('|', 1)
    if event == 'copilot_work_started':
        last_start = p(ts)
    elif event == 'copilot_work_finished' and last_start:
        total += max(0, (p(ts) - last_start).total_seconds())
        last_start = None
print(max(0, int(total // 60)))
" 2>/dev/null || true)
    fi
  fi

  # 2. Parse PR body for issue references
  if [[ -z "$origin_request_type" ]]; then
    pr_body=$(jq -r '.body // ""' <<<"$pr_json")
    if [[ -n "$pr_body" && "$pr_body" != "null" ]]; then
      origin_issue_number=$(echo "$pr_body" | grep -oiE '(fix(es|ed)?|resolv(es|ed)?|clos(es|ed)?)\s+#[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
      if [[ -z "$origin_issue_number" ]]; then
        origin_issue_number=$(echo "$pr_body" | grep -oiE '(issue|for|from)\s+#[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
      fi
    fi
  fi

  # 3. Fallback: cross-referenced issue in PR timeline
  if [[ -z "$origin_request_type" && -z "$origin_issue_number" ]]; then
    origin_issue_number=$(jq -r '
      [
        .[]
        | select((.event // "") == "cross-referenced")
        | select(.source.issue.pull_request.url? == null)
        | .source.issue.number
      ][0] // empty
    ' <<<"$pr_timeline")
  fi

  # If we found an origin issue (from body or cross-ref), look up who assigned Copilot
  if [[ -z "$origin_request_type" && -n "$origin_issue_number" ]]; then
    origin_issue_timeline=$(gh_api_timeline_array "/repos/${ORG}/${REPO}/issues/${origin_issue_number}/timeline?per_page=100")

    assign_row=$(jq -c '
      map(select(.event == "assigned"))
      | map(select((.assignee.login // "" | ascii_downcase) | test("copilot")))
      | .[0] // empty
    ' <<<"$origin_issue_timeline")

    if [[ -n "$assign_row" && "$assign_row" != "null" ]]; then
      origin_requested_by=$(jq -r '.actor.login // empty' <<<"$assign_row")
      origin_requested_at=$(jq -r '.created_at // empty' <<<"$assign_row")
      origin_request_type="issue_assignment"
    else
      origin_issue_json=$(gh_api "/repos/${ORG}/${REPO}/issues/${origin_issue_number}" 2>/dev/null || echo '{}')
      origin_requested_by=$(jq -r '.user.login // empty' <<<"$origin_issue_json")
      origin_requested_at=$(jq -r '.created_at // empty' <<<"$origin_issue_json")
      origin_request_type="issue_reference"
    fi
  fi

  # 4. Fallback: earliest @copilot comment on the PR
  if [[ -z "$origin_request_type" || "$origin_request_type" == "null" ]]; then
    first_comment_row=$(jq -c '
      map(select((.body // "" | ascii_downcase) | contains("@copilot")))
      | sort_by(.created_at)
      | .[0] // empty
    ' <<<"$pr_issue_comments")

    if [[ -n "$first_comment_row" && "$first_comment_row" != "null" ]]; then
      origin_requested_by=$(jq -r '.user.login // empty' <<<"$first_comment_row")
      origin_requested_at=$(jq -r '.created_at // empty' <<<"$first_comment_row")
      origin_request_type="comment_mention"
    fi
  fi

  # Find session-summary issue by PR number mention
  session_issue_number=$(jq -r --arg prn "$pr_number" '
    if has("items") then
      [
        .items[]
        | select(
            ((.title // "" | ascii_downcase) | contains("copilot session summary"))
            or
            ((.labels // []) | map(.name // "" | ascii_downcase) | index("copilot-session"))
          )
        | select(
            ((.body // "") | test("(^|[^0-9])" + $prn + "([^0-9]|$)"))
            or
            ((.title // "") | test("(^|[^0-9])" + $prn + "([^0-9]|$)"))
          )
        | .number
      ][0] // empty
    else
      empty
    end
  ' <<<"$SESSION_ISSUES" 2>/dev/null || true)

  # Compute duration in minutes
  # Best case: sum of individual copilot_work_started→finished segments
  # Fallback 1: origin_requested_at → copilot_work_finished_at (span)
  # Fallback 2: origin_requested_at → PR merge/close/creation (lifecycle)
  duration_minutes=""
  duration_type=""
  if [[ -n "$copilot_work_finished_at" && "$copilot_work_finished_at" != "null" && -n "$origin_requested_at" && "$origin_requested_at" != "null" ]]; then
    duration_type="agent"
    # Prefer summed work segments over full span
    if [[ -n "$copilot_work_minutes" && "$copilot_work_minutes" =~ ^[0-9]+$ && "$copilot_work_minutes" -gt 0 ]]; then
      duration_minutes="$copilot_work_minutes"
    else
      # Fallback: full span
      if command -v python3 >/dev/null 2>&1; then
        duration_minutes=$(python3 -c "
from datetime import datetime, timezone
def p(s):
    if s.endswith('Z'): return datetime.strptime(s,'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(s)
try: print(max(0, int((p('$copilot_work_finished_at') - p('$origin_requested_at')).total_seconds() // 60)))
except: print('')
" 2>/dev/null || true)
      fi
    fi
  elif [[ -n "$origin_requested_at" && "$origin_requested_at" != "null" ]]; then
    # Fallback: origin → PR merge/close/creation
    duration_type="lifecycle"
    end_ts="$pr_created_at"
    if [[ -n "$pr_merged_at" && "$pr_merged_at" != "null" ]]; then
      end_ts="$pr_merged_at"
    elif [[ -n "$pr_closed_at" && "$pr_closed_at" != "null" ]]; then
      end_ts="$pr_closed_at"
    fi
    if command -v python3 >/dev/null 2>&1; then
      duration_minutes=$(python3 -c "
from datetime import datetime, timezone
def p(s):
    if s.endswith('Z'): return datetime.strptime(s,'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(s)
try: print(max(0, int((p('$end_ts') - p('$origin_requested_at')).total_seconds() // 60)))
except: print('')
" 2>/dev/null || true)
    fi
  fi

  jq -n \
    --arg repo "$ORG/$REPO" \
    --argjson pr_number "$pr_number" \
    --arg pr_id "$pr_id" \
    --arg pr_node_id "$pr_node_id" \
    --arg pr_url "$pr_url" \
    --arg pr_title "$pr_title" \
    --arg pr_created_at "$pr_created_at" \
    --arg pr_closed_at "$pr_closed_at" \
    --arg pr_merged_at "$pr_merged_at" \
    --arg pr_state "$pr_state" \
    --argjson pr_draft "$pr_draft" \
    --arg pr_author_login "$pr_author_login" \
    --arg merged_by "$merged_by" \
    --arg base_ref "$base_ref" \
    --arg head_ref "$head_ref" \
    --argjson additions "$additions" \
    --argjson deletions "$deletions" \
    --argjson changed_files "$changed_files" \
    --arg latest_status "$latest_status" \
    --argjson changes_requested_count "$changes_requested_count" \
    --argjson reopened_count "$reopened_count" \
    --argjson additional_guidance_count "$additional_guidance_count" \
    --argjson copilot_invocation_count "${copilot_invocation_count:-0}" \
    --arg session_issue_number "${session_issue_number:-}" \
    --arg origin_request_type "${origin_request_type:-}" \
    --arg origin_issue_number "${origin_issue_number:-}" \
    --arg origin_requested_by "${origin_requested_by:-}" \
    --arg origin_requested_at "${origin_requested_at:-}" \
    --arg duration_minutes "${duration_minutes:-}" \
    --arg duration_type "${duration_type:-}" '
      {
        repo: $repo,
        pr_number: $pr_number,
        pr_id: (if $pr_id == "" then null else ($pr_id | tonumber) end),
        pr_node_id: (if $pr_node_id == "" then null else $pr_node_id end),
        pr_url: $pr_url,
        pr_title: $pr_title,
        pr_created_at: $pr_created_at,
        pr_closed_at: (if $pr_closed_at == "" or $pr_closed_at == "null" then null else $pr_closed_at end),
        pr_merged_at: (if $pr_merged_at == "" or $pr_merged_at == "null" then null else $pr_merged_at end),
        pr_state: $pr_state,
        pr_draft: $pr_draft,
        pr_author_login: $pr_author_login,
        merged_by: (if $merged_by == "" then null else $merged_by end),
        base_ref: (if $base_ref == "" then null else $base_ref end),
        head_ref: (if $head_ref == "" then null else $head_ref end),
        additions: $additions,
        deletions: $deletions,
        changed_files: $changed_files,
        latest_status: $latest_status,
        changes_requested_count: $changes_requested_count,
        reopened_count: $reopened_count,
        additional_guidance_count: $additional_guidance_count,
        copilot_invocation_count: $copilot_invocation_count,
        session_issue_number: (if $session_issue_number == "" then null else ($session_issue_number | tonumber) end),
        origin_request_type: (if $origin_request_type == "" then null else $origin_request_type end),
        origin_issue_number: (if $origin_issue_number == "" then null else ($origin_issue_number | tonumber) end),
        origin_requested_by: (if $origin_requested_by == "" then null else $origin_requested_by end),
        origin_requested_at: (if $origin_requested_at == "" then null else $origin_requested_at end),
        duration_minutes: (if $duration_minutes == "" then null else ($duration_minutes | tonumber) end),
        duration_type: (if $duration_type == "" then null else $duration_type end)
      }
  ' >> "$TMP_PR_SESSIONS"

  # Emit a request record from copilot_work_started when no issue assignment or
  # @copilot comment already created one for this PR (avoids double-counting)
  if [[ "$origin_request_type" == "copilot_work_started" && -n "$origin_requested_by" ]]; then
    # Check if an existing request already covers this PR
    # Match by: same repo + same developer + (matching issue_number OR pr_number)
    local already_has_request="false"
    if [[ -s "$TMP_REQUESTS" ]]; then
      # Look for any request from same user in same repo that references this PR's origin issue or the PR itself
      local dedup_match
      if [[ -n "$origin_issue_number" ]]; then
        dedup_match=$(grep -c "\"issue_number\":${origin_issue_number}," "$TMP_REQUESTS" 2>/dev/null || true)
      else
        dedup_match=$(grep -c "\"pr_number\":${pr_number}," "$TMP_REQUESTS" 2>/dev/null || true)
      fi
      # Also check: same repo + same user in requests from Steps 2A/2B (issue assignment or @copilot comment)
      # that don't have a linked_pr yet — these are the ones that spawned this PR
      if [[ "${dedup_match:-0}" == "0" || -z "$dedup_match" ]]; then
        dedup_match=$(grep "${ORG}/${REPO}" "$TMP_REQUESTS" 2>/dev/null | grep -c "\"requested_by_login\":\"${origin_requested_by}\"" 2>/dev/null || true)
      fi
      [[ "${dedup_match:-0}" != "0" && -n "$dedup_match" ]] && already_has_request="true"
    fi

    if [[ "$already_has_request" == "false" ]]; then
      jq -n \
        --arg repo "$ORG/$REPO" \
        --arg requested_at "${origin_requested_at:-$pr_created_at}" \
        --arg requested_by "$origin_requested_by" \
        --argjson pr_number "$pr_number" \
        --arg pr_title "$pr_title" \
        --arg pr_url "$pr_url" '{
          repo: $repo,
          request_event_id: ("copilot-work-started:" + $repo + ":" + $requested_at + ":" + $requested_by),
          request_type: "copilot_work_started",
          requested_at: $requested_at,
          requested_by_login: $requested_by,
          issue_number: null,
          issue_id: null,
          issue_node_id: null,
          issue_title: null,
          issue_state: null,
          issue_url: null,
          is_pull_request: true,
          pr_number: $pr_number,
          comment_id: null,
          comment_body_excerpt: null,
          copilot_target_mode: "agent_session",
          linked_pr_number: $pr_number
        }' >> "$TMP_REQUESTS"
    fi
  fi

done

  # Cleanup per-repo temp files
  rm -f "$TMP_ALL_ISSUES" "$TMP_ALL_PULLS" "$TMP_ISSUES_ONLY"
  echo "" >&2
  set -e
}

# ── Main Loop: collect data for each repo ────────────────────────────────────

for _repo_name in "${REPO_LIST[@]}"; do
  collect_repo_data "$_repo_name" || {
    echo "  ⚠ Skipped $ORG/$_repo_name (API error or permission denied)" >&2
  }
done

# ── Aggregate from temp files ────────────────────────────────────────────────

TMP_REQUESTS_JSON="$TMP_DIR/requests.json"
TMP_PR_SESSIONS_JSON="$TMP_DIR/pr_sessions.json"

# jq -s on an empty file gives null; default to []
if [[ -s "$TMP_REQUESTS" ]]; then
  jq -s '.' "$TMP_REQUESTS" > "$TMP_REQUESTS_JSON"
else
  echo '[]' > "$TMP_REQUESTS_JSON"
fi
if [[ -s "$TMP_PR_SESSIONS" ]]; then
  jq -s '.' "$TMP_PR_SESSIONS" > "$TMP_PR_SESSIONS_JSON"
else
  echo '[]' > "$TMP_PR_SESSIONS_JSON"
fi

echo "=== Totals ===" >&2
echo "  Request events: $(jq 'length' "$TMP_REQUESTS_JSON")" >&2
echo "  PR sessions: $(jq 'length' "$TMP_PR_SESSIONS_JSON")" >&2
echo "" >&2

# ── Step 4: Link requests to PRs ─────────────────────────────────────────────

echo "=== Linking Requests to PRs ===" >&2
TMP_LINKED_REQUESTS="$TMP_DIR/linked_requests.json"
jq --slurpfile prs "$TMP_PR_SESSIONS_JSON" '
  map(
    . as $req
    | .linked_pr_number =
      (
        if .request_type == "comment_mention" and .is_pull_request == true and .pr_number != null then
          .pr_number
        elif .issue_number != null then
          (
            [
              $prs[0][]
              | select((.origin_issue_number // -1 | tostring) == ($req.issue_number | tostring) and .repo == $req.repo)
              | .pr_number
            ][0] // .linked_pr_number
          )
        else
          .linked_pr_number
        end
      )
  )
' "$TMP_REQUESTS_JSON" > "$TMP_LINKED_REQUESTS" 2>/dev/null || {
  echo "  ⚠ Request linking failed — using unlinked requests" >&2
  cp "$TMP_REQUESTS_JSON" "$TMP_LINKED_REQUESTS"
}
echo "" >&2

# ── Step 5: Build developer/day summary ──────────────────────────────────────
# Merges request events and PR session lifecycle data into one record per dev/day.

echo "=== Developer/Day Summary ===" >&2
TMP_DEV_DAY="$TMP_DIR/dev_day_summary.json"
jq -n \
  --slurpfile reqs "$TMP_LINKED_REQUESTS" \
  --slurpfile prs "$TMP_PR_SESSIONS_JSON" '

# Safely unwrap slurpfile arrays (slurpfile wraps all values in an outer array)
(if ($reqs | length) > 0 and ($reqs[0] | type) == "array" then $reqs[0] else [] end) as $req_arr |
(if ($prs  | length) > 0 and ($prs[0]  | type) == "array" then $prs[0]  else [] end) as $pr_arr  |

# Request-side rollup: group by date|developer
(
  [ $req_arr[] | select(type == "object" and .requested_at != null)
    | select((.requested_by_login // "" | ascii_downcase) | test("\\[bot\\]$|^copilot$|^github-actions$") | not)
  ] |
  if length == 0 then {}
  else
    group_by((.requested_at[0:10]) + "|" + ((.requested_by_login // "unknown")))
    | map({
        _key: (.[0].requested_at[0:10] + "|" + (.[0].requested_by_login // "unknown")),
        issue_assignment_requests: ([.[] | select(.request_type == "issue_assignment")] | length),
        pr_followup_requests: ([.[] | select(.request_type == "comment_mention" and .is_pull_request == true)] | length),
        total_agent_requests: length
      })
    | map({key: ._key, value: .}) | from_entries
  end
) as $req_idx |

# PR-session-side rollup: group by date|developer
# Use origin_requested_by/at when available; fall back to pr_created_at/pr_author_login
(
  [ $pr_arr[] | select(type == "object")
    | . + {
        _dev: (if (.origin_requested_by // "") != "" then .origin_requested_by else .pr_author_login end),
        _date: (if (.origin_requested_at // "") != "" then .origin_requested_at else .pr_created_at end)
      }
    | select(._dev != null and ._dev != "" and ._date != null and ._date != "")
    | select((._dev | ascii_downcase) | test("\\[bot\\]$|^copilot$|^github-actions$") | not)
  ] |
  if length == 0 then {}
  else
    group_by((._date[0:10]) + "|" + ._dev)
    | map({
        _key: (.[0]._date[0:10] + "|" + .[0]._dev),
        sessions_started: length,
        agent_prs_created: length,
        agent_prs_merged: ([.[] | select(.pr_merged_at != null and .pr_merged_at != "" and .pr_merged_at != "null")] | length),
        agent_loc_added: (([.[].additions] | add) // 0),
        agent_loc_deleted: (([.[].deletions] | add) // 0),
        agent_session_minutes: (([.[] | select(.duration_minutes != null and .duration_minutes > 0 and .duration_type == "agent") | .duration_minutes] | add) // 0),
        changes_requested_total: (([.[].changes_requested_count] | add) // 0),
        median_merge_minutes: (
          [.[] | select(.pr_merged_at != null and .pr_merged_at != "" and .pr_merged_at != "null" and .duration_minutes != null and .duration_minutes > 0) | .duration_minutes] | sort
          | if length == 0 then null
            elif length % 2 == 1 then .[(length - 1) / 2]
            else (.[length / 2 - 1] + .[length / 2]) / 2
            end
        )
      })
    | map({key: ._key, value: .}) | from_entries
  end
) as $pr_idx |

# Full outer join on date|developer
([ ($req_idx // {} | keys[]), ($pr_idx // {} | keys[]) ] | unique) as $all_keys |

[$all_keys[] as $k |
  (($req_idx // {})[$k] // {}) as $r |
  (($pr_idx // {})[$k] // {}) as $p |
  ($k | split("|")) as $parts |
  {
    date: $parts[0],
    developer: ($parts[1] // "unknown"),
    issue_assignment_requests: ($r.issue_assignment_requests // 0),
    pr_followup_requests: ($r.pr_followup_requests // 0),
    total_agent_requests: ($r.total_agent_requests // 0),
    sessions_started: ([($r.total_agent_requests // 0), ($p.agent_prs_created // 0)] | max),
    agent_prs_created: ($p.agent_prs_created // 0),
    agent_prs_merged: ($p.agent_prs_merged // 0),
    agent_loc_added: ($p.agent_loc_added // 0),
    agent_loc_deleted: ($p.agent_loc_deleted // 0),
    agent_session_minutes: ($p.agent_session_minutes // 0),
    changes_requested_total: ($p.changes_requested_total // 0),
    median_merge_minutes: ($p.median_merge_minutes // null)
  }
] | sort_by(.date, .developer)
' > "$TMP_DEV_DAY" 2>/dev/null || {
  echo "  ⚠ Developer/day summary failed — using empty array" >&2
  echo '[]' > "$TMP_DEV_DAY"
}
echo "  Summary rows: $(jq 'length' "$TMP_DEV_DAY" 2>/dev/null || echo 0)" >&2
echo "" >&2

# ── Output: combined JSON to stdout ──────────────────────────────────────────

jq -n \
  --slurpfile pr_sessions "$TMP_PR_SESSIONS_JSON" \
  --slurpfile requests "$TMP_LINKED_REQUESTS" \
  --slurpfile dev_day "$TMP_DEV_DAY" \
  '{
    pr_sessions: ($pr_sessions[0] // []),
    requests: ($requests[0] // []),
    developer_day_summary: ($dev_day[0] // [])
  }'
