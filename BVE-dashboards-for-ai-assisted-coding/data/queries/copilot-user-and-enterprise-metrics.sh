#!/bin/bash
set -euo pipefail

# AI Assisted Coding Metrics Query
# Collects Copilot usage metrics including active users, feature usage, code generation & acceptance
#
# IMPORTANT: This script outputs JSON to stdout and progress messages to stderr.
# 
# Correct usage:
#   ENTERPRISE="my-enterprise" DAYS=28 ./ai-assisted-coding.sh > data.json
#   ORG="my-org" DAYS=28 ./ai-assisted-coding.sh > data.json
#
# Incorrect (mixes stderr into JSON):
#   ./ai-assisted-coding.sh > data.json 2>&1
#
# To save both JSON and logs:
#   ./ai-assisted-coding.sh 2>progress.log >data.json
#

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: $0"
  echo "AI Assisted Coding Metrics Query"
  echo "Collects Copilot usage metrics including active users, feature usage, code generation & acceptance."
  echo ""
  echo "Endpoints Called:" >&2
  echo "  - /enterprises/{slug}/copilot/metrics/reports/enterprise-28-day/latest" >&2
  echo "  - /enterprises/{slug}/copilot/metrics/reports/users-28-day/latest" >&2
  echo "  - /orgs/{org}/copilot/metrics/reports/enterprise-28-day/latest" >&2
  echo "" >&2
  echo "Output: Multiple JSON sections (enterprise metrics, user metrics)" >&2
  echo "" >&2
  echo "Environment Variables:" >&2
  echo "  GH_TOKEN       - GitHub Personal Access Token (required)" >&2
  echo "  ENTERPRISE     - GitHub Enterprise name (required if ORG is not set)" >&2
  echo "  ORG            - GitHub Organization name (required if ENTERPRISE is not set)" >&2
  echo "  DAYS           - Number of days to look back (default: 7)" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  # Correct usage (JSON to stdout, progress to stderr):" >&2
  echo "  ENTERPRISE=\"octodemo\" DAYS=28 ./ai-assisted-coding.sh > octodemo-data.json" >&2
  echo "  ORG=\"my-org\" DAYS=28 ./ai-assisted-coding.sh > org-data.json" >&2
  echo "" >&2
  echo "  # Save both JSON and progress log:" >&2
  echo "  ENTERPRISE=\"octodemo\" ./ai-assisted-coding.sh 2>progress.log >data.json" >&2
  exit 0
fi

DAYS=${DAYS:-7}
ENTERPRISE="${ENTERPRISE:-}"
ORG="${ORG:-}"

# Check if gh CLI is authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh CLI not authenticated. Run 'gh auth login' or set GH_TOKEN/GITHUB_TOKEN" >&2
  exit 1
fi

SINCE_DATE=$(date -u -v-${DAYS}d +"%Y-%m-%d" 2>/dev/null || date -u -d "${DAYS} days ago" +"%Y-%m-%d")

# Use temp files for all large payloads to avoid ARG_MAX limits
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -n "$ENTERPRISE" ]]; then
  echo "Fetching Copilot enterprise metrics for: $ENTERPRISE (28-day report)" >&2
  ENTERPRISE_URL=$(gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/enterprises/$ENTERPRISE/copilot/metrics/reports/enterprise-28-day/latest" | jq -r '.download_links[0]')

  curl -sL "$ENTERPRISE_URL" > "$TMP_DIR/enterprise_report.json"

  echo "" >&2
  echo "Fetching Copilot user metrics for: $ENTERPRISE (28-day report)" >&2
  USER_URL=$(gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/enterprises/$ENTERPRISE/copilot/metrics/reports/users-28-day/latest" | jq -r '.download_links[0]')

  curl -sL "$USER_URL" | jq -s '.' > "$TMP_DIR/user_report.json"

  jq -n \
    --slurpfile er "$TMP_DIR/enterprise_report.json" \
    --slurpfile ur "$TMP_DIR/user_report.json" \
    '{ enterprise_report: $er[0], user_report: $ur[0] }'

elif [[ -n "$ORG" ]]; then
  echo "Fetching Copilot metrics for organization: $ORG (last $DAYS days since $SINCE_DATE)" >&2
  ORG_URL=$(gh api \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/orgs/$ORG/copilot/metrics/reports/enterprise-28-day/latest" | jq -r '.download_links[0]')

  curl -sL "$ORG_URL" | jq --arg since "$SINCE_DATE" '[.[] | select(.day >= $since)]' > "$TMP_DIR/org_report.json"

  jq -n \
    --slurpfile or "$TMP_DIR/org_report.json" \
    '{ organization_report: $or[0] }'

else
  echo "Error: Either ENTERPRISE or ORG environment variable is required" >&2
  exit 1
fi
