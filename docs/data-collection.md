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
| AI-assisted element | Copilot metrics JSON + optional PR review + config | File upload (no target) | Same data as efficiency/structural |
| Agentic element | Agentic PR metrics JSON + optional config | File upload (no target) | Same data as agentic efficiency |
| Integrated leverage | AI-assisted + agentic JSON + optional config | File upload (no target) | Auto-detects file types |

> **Note:** The element and integrated dashboards do not have `run-query.sh` targets. They load data via browser file upload using the same JSON files produced by the existing targets.

## From Collection to Dashboard

1. Run the appropriate target or targets.
2. Open the matching dashboard `index.html`.
3. Upload the generated JSON file or files.

Matching rules:

- `ai-assisted-efficiency` output goes to the AI-assisted efficiency dashboard.
- `ai-assisted-structural` output must be combined with `pr-review-structural` output in the AI-assisted structural dashboard.
- `agentic-efficiency` output goes to the agentic efficiency dashboard.

## Automated Nightly Collection & Publishing

A GitHub Actions workflow (`.github/workflows/deploy-dashboards.yml`) runs `run-query.sh --all` on a nightly schedule and publishes every dashboard to GitHub Pages.

### Setup

1. **Create a GitHub PAT** with `copilot`, `read:org` (and `read:enterprise` if using enterprise-level metrics) scopes.
2. **Add the PAT** as a repository secret named `DASHBOARD_GH_TOKEN`.
3. **Set repository variables** for the query parameters:
   - `ENTERPRISE` — GitHub Enterprise slug (if applicable)
   - `ORG` — GitHub Organization name
   - `DAYS` — Lookback window in days (default: `28`)
4. **Enable GitHub Pages** in the repository settings (Source: GitHub Actions).

### How it works

| Step | Description |
|---|---|
| **Collect** | The workflow runs `./run-query.sh --all` with env vars from secrets/variables. In CI mode the script skips interactive prompts and fails fast on missing variables. |
| **Build** | `scripts/build-pages.sh` assembles the `_site/` directory: each dashboard's HTML, its `data/*.json` files, and a `data/manifest.json` listing available data files. A landing page links to all dashboards. |
| **Deploy** | The site is uploaded and deployed to GitHub Pages via `actions/upload-pages-artifact` and `actions/deploy-pages`. |
| **Auto-load** | When served from Pages, each dashboard fetches `./data/manifest.json` on load and automatically processes the listed data files. Manual file upload remains as a fallback. |

### Manual trigger

The workflow also supports `workflow_dispatch` with optional overrides for `enterprise`, `org`, and `days`.

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
scripts/build-pages.sh
.github/workflows/deploy-dashboards.yml
```

For dependency mapping, expected schema details, and change-propagation checklists, see [../dependencies/README.md](../dependencies/README.md).
