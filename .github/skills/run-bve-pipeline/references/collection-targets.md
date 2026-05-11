# Collection Targets

The pipeline collects data from 3 query scripts plus optional agent session logs.

## Target: copilot-metrics

- **Script**: `BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh`
- **Required env**: `ENTERPRISE` or `ORG`
- **Optional env**: `DAYS`
- **API endpoints**:
  - Enterprise: `GET /enterprises/{slug}/copilot/metrics/reports/enterprise-28-day/latest`
  - Enterprise: `GET /enterprises/{slug}/copilot/metrics/reports/users-28-day/latest`
  - Org: `GET /orgs/{org}/copilot/metrics/reports/enterprise-28-day/latest`
- **Output shape**: `{ enterprise_report, user_report }`
- **Feeds**: `ai-assisted-efficiency-days`, `ai-assisted-structural-days`

## Target: human-pr-metrics

- **Script**: `BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh`
- **Required env**: `ORG`
- **Optional env**: `REPO`, `DAYS`, `SINCE`, `UNTIL`
- **API endpoints**:
  - GraphQL: `search(query: $q, type: ISSUE, first: 100, after: $cursor)` — paginated PR search
  - REST: `GET /repos/{org}/{repo}/pulls/{n}/reviews` — review submissions
  - REST: `GET /repos/{org}/{repo}/pulls/{n}/comments` — review comments
  - REST: `GET /repos/{org}/{repo}/pulls/{n}/requested_reviewers`
  - REST: `GET /repos/{org}/{repo}/issues/{n}/timeline`
- **Output shape**: `{ pull_requests, detailed_pr_events }`
- **Feeds**: `ai-assisted-structural-days`

## Target: coding-agent-pr-metrics

- **Script**: `BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh`
- **Required env**: `ORG`
- **Optional env**: `REPO`, `DAYS`, `MAX_REPOS`
- **Output shape**: `{ pr_sessions, requests, developer_day_summary }`
- **Feeds**: `agentic-efficiency-days`, `agentic-pr-sessions`

## Target: session-logs (optional)

- **Script**: `agent-session-logs.sh`
- **Required env**: `ORG`
- **Optional env**: `IDLE_THRESHOLD_SECS`, `MAX_SESSIONS`
- **Feeds**: `leverage-summary` (compute-time enrichment for agentic element)
