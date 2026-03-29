# Data Collection

This is the canonical guide for generating dashboard input JSON.

## Recommended Path: `run-query.sh`

Use the top-level runner from the repository root:

```bash
./run-query.sh --list
./run-query.sh ai-assisted-efficiency
./run-query.sh agentic-efficiency myprofile
./run-query.sh --dry-run ai-assisted-structural
./run-query.sh --all
```

The runner resolves required environment variables, writes output into the matching dashboard `data/` directory, and can save settings to `query-settings.json`.

## Available Targets

| Target | Query script | Required env | Optional env | Output directory |
|---|---|---|---|---|
| `ai-assisted-efficiency` | `copilot-user-and-enterprise-metrics.sh` | `ENTERPRISE` or `ORG` | `DAYS` | `BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/data/` |
| `ai-assisted-structural` | `copilot-user-and-enterprise-metrics.sh` | `ENTERPRISE` or `ORG` | `DAYS` | `BVE-dashboards-for-ai-assisted-coding/dashboard/structural/data/` |
| `pr-review-structural` | `human-pr-metrics.sh` | `ORG` | `REPO`, `DAYS`, `SINCE`, `UNTIL` | `BVE-dashboards-for-ai-assisted-coding/dashboard/structural/data/` |
| `agentic-efficiency` | `coding-agent-pr-metrics.sh` | `ORG` | `REPO`, `DAYS`, `MAX_REPOS` | `BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/data/` |

## Direct Script Usage

Use direct script execution only when you want to bypass the runner.

### AI-Assisted Copilot Metrics

```bash
ENTERPRISE="octodemo" DAYS=28 \
  ./BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh > copilot-metrics.json

ORG="octodemo" DAYS=28 \
  ./BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh > copilot-metrics.json
```

### PR Review Metrics

```bash
ORG="octodemo" DAYS=28 \
  ./BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh > pr-review-metrics.json

ORG="octodemo" REPO="my-repo" DAYS=14 \
  ./BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh > pr-review-metrics.json
```

### Agentic PR Metrics

```bash
ORG="octodemo" DAYS=28 \
  ./BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh > agentic-metrics.json

ORG="octodemo" REPO="my-repo" DAYS=28 \
  ./BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh > agentic-metrics.json
```

## Structural Dashboard Inputs

The AI-assisted structural dashboard expects two datasets:

1. Copilot metrics from `copilot-user-and-enterprise-metrics.sh`
2. PR review metrics from `human-pr-metrics.sh`

Collect both before loading the dashboard.

## Dashboard Input Matrix

| Dashboard | Consumed files | Producing target(s) | Load rules |
|---|---|---|---|
| AI-assisted efficiency | Copilot metrics JSON | `ai-assisted-efficiency` | Can be loaded alone |
| AI-assisted structural | Copilot metrics JSON + PR review metrics JSON | `ai-assisted-structural`, `pr-review-structural` | Must be paired |
| Agentic efficiency | Agentic PR metrics JSON | `agentic-efficiency` | Can be loaded alone |

## From Collection to Dashboard

1. Run the appropriate target or targets.
2. Open the matching dashboard `index.html`.
3. Upload the generated JSON file or files.

Matching rules:

- `ai-assisted-efficiency` output goes to the AI-assisted efficiency dashboard.
- `ai-assisted-structural` output must be combined with `pr-review-structural` output in the AI-assisted structural dashboard.
- `agentic-efficiency` output goes to the agentic efficiency dashboard.

## Output Shapes

| Script | Top-level keys |
|---|---|
| `copilot-user-and-enterprise-metrics.sh` | `enterprise_report`, `user_report` |
| `human-pr-metrics.sh` | `pull_requests`, `detailed_pr_events` |
| `coding-agent-pr-metrics.sh` | `pr_sessions`, `requests`, `developer_day_summary` |

## Common Mistakes

Do not mix progress output into your JSON file.

Correct:

```bash
./script.sh > data.json
./script.sh 2>progress.log >data.json
```

Incorrect:

```bash
./script.sh > data.json 2>&1
```

## File Locations

```text
BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh
BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh
BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh
run-query.sh
query-settings.json
```

For dependency mapping, expected schema details, and change-propagation checklists, see [../dependencies/README.md](../dependencies/README.md).
