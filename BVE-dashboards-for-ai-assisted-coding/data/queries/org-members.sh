#!/usr/bin/env bash
set -euo pipefail

# org-members.sh — Collect org membership via GitHub API.
#
# Fetches all members of the specified org(s) using GET /orgs/{ORG}/members.
# Supports pagination. Outputs JSON to stdout.
#
# Required env: ORG (single org name or comma-separated list)
# Required scope: read:org
#
# Output format:
# {
#   "org_members": [ { "login": "user1", "id": 123 }, ... ],
#   "metadata": { "org": "...", "collected_at": "...", "total_members": N }
# }

ORG="${ORG:?ORG environment variable must be set}"

# Use configured token name or fall back to GITHUB_TOKEN
TOKEN_VAR="${GH_TOKEN_NAME:-GITHUB_TOKEN}"
if [[ -n "${!TOKEN_VAR:-}" ]]; then
  export GH_TOKEN="${!TOKEN_VAR}"
elif [[ -n "${DASHBOARD_GH_TOKEN:-}" ]]; then
  export GH_TOKEN="$DASHBOARD_GH_TOKEN"
fi

echo "Collecting org members for: $ORG" >&2

all_members='[]'

# Support comma-separated org list for multi-org
IFS=',' read -ra ORG_LIST <<< "$ORG"

for org_name in "${ORG_LIST[@]}"; do
  org_name=$(echo "$org_name" | xargs) # trim whitespace
  echo "  Fetching members for org: $org_name" >&2

  page=1
  per_page=100
  while true; do
    response=$(gh api "/orgs/${org_name}/members?per_page=${per_page}&page=${page}" \
      --header "Accept: application/vnd.github+json" 2>/dev/null) || {
      echo "  ⚠ Failed to fetch page $page for $org_name" >&2
      break
    }

    count=$(echo "$response" | jq 'length')
    if [[ "$count" -eq 0 ]]; then
      break
    fi

    # Extract login and id
    page_members=$(echo "$response" | jq '[.[] | {login: .login, id: .id}]')
    all_members=$(echo "$all_members $page_members" | jq -s '.[0] + .[1]')

    echo "    Page $page: $count members" >&2

    if [[ "$count" -lt "$per_page" ]]; then
      break
    fi
    page=$((page + 1))
  done
done

total=$(echo "$all_members" | jq 'length')
echo "  Total members collected: $total" >&2

# Output JSON to stdout
jq -n \
  --argjson members "$all_members" \
  --arg org "$ORG" \
  --arg collected_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson total "$total" \
  '{
    org_members: $members,
    metadata: {
      org: $org,
      collected_at: $collected_at,
      total_members: $total
    }
  }'
