# Script → Dashboard Dependency Map

Source: `dependencies/README.md`

## Target Registry

| Query Script | Dashboard | Runner Target | Required Env | Optional Env |
|---|---|---|---|---|
| `copilot-user-and-enterprise-metrics.sh` | AI-Assisted Efficiency | `ai-assisted-efficiency` | `ENTERPRISE` or `ORG` | `DAYS` |
| `copilot-user-and-enterprise-metrics.sh` | AI-Assisted Structural | `ai-assisted-structural` | `ENTERPRISE` or `ORG` | `DAYS` |
| `human-pr-metrics.sh` | AI-Assisted Structural | `pr-review-structural` | `ORG` | `REPO`, `DAYS`, `SINCE`, `UNTIL` |
| `coding-agent-pr-metrics.sh` | Agentic Efficiency | `agentic-efficiency` | `ORG` | `REPO`, `DAYS`, `MAX_REPOS` |

## File Locations

```
Query scripts:
  BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh
  BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh
  BVE-dashboards-for-ai-assisted-coding/data/queries/org-members.sh
  BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh

Dashboard HTML (with data/ output dir):
  BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
  BVE-dashboards-for-ai-assisted-coding/dashboard/structural/index.html
  BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/index.html

Dashboard HTML (file-upload only, no data/ dir):
  BVE-dashboards-for-ai-assisted-coding/dashboard/element/index.html
  BVE-dashboards-for-agentic-ai-coding/dashboard/element/index.html
  dashboard/integrated/index.html

V2 Dashboards (auto-load from materialized artifacts):
  dashboard/v2/ai-assisted-efficiency/index.html
  dashboard/v2/ai-assisted-structural/index.html
  dashboard/v2/ai-assisted-element/index.html
  dashboard/v2/agentic-efficiency/index.html
  dashboard/v2/agentic-element/index.html
  dashboard/v2/integrated-leverage/index.html

Runner & settings:
  run-query.sh
  query-settings.json
```

## Materialized Artifacts

| Artifact | Raw Input(s) | Feeds Dashboards |
|---|---|---|
| `ai-assisted-efficiency-days` | `copilot-metrics` | V2 AI-Assisted Efficiency, Element |
| `ai-assisted-structural-days` | `copilot-metrics` + `human-pr-metrics` | V2 AI-Assisted Structural, Element |
| `agentic-efficiency-days` | `coding-agent-pr-metrics` | V2 Agentic Efficiency, Element |
| `agentic-pr-sessions` | `coding-agent-pr-metrics` | V2 Agentic Element |
| `leverage-summary` | *all of the above* | V2 Integrated Leverage |

## Output Shapes

| Script | Top-level JSON keys |
|---|---|
| `copilot-user-and-enterprise-metrics.sh` | `enterprise_report`, `user_report` |
| `human-pr-metrics.sh` | `pull_requests`, `detailed_pr_events` |
| `coding-agent-pr-metrics.sh` | `pr_sessions`, `requests`, `developer_day_summary` |
