# Data Collection

This is the canonical guide for generating dashboard input JSON.

## Running the Pipeline

Use `run-query.sh` from the repository root. It wraps
`scripts/collect-and-materialize.sh` and passes through all flags.

```bash
./run-query.sh                             # full pipeline, default profile
./run-query.sh --profile short-window      # use a named profile
./run-query.sh --materialize-only          # re-materialize from cached data
./run-query.sh --session-logs-only         # fetch agent session logs only
./run-query.sh --no-streaming              # use standard materializer
./run-query.sh --collect                   # force collection when profile skips it
DAYS=7 ./run-query.sh                      # override lookback window
```

Settings are stored in `query-settings.json` as named profiles. CLI
flags override profile values, and environment variables override both.

For configuration keys, profiles, and override precedence, see
[query-settings.md](query-settings.md). For common scenarios, see
[config-examples.md](config-examples.md).

## What Gets Collected

The pipeline collects raw data from three query scripts, plus optional
agent session logs:

| Collection Target | Query Script | Required Env | Optional Env |
|---|---|---|---|
| `copilot-metrics` | `copilot-user-and-enterprise-metrics.sh` | `ENTERPRISE` or `ORG` | `DAYS` |
| `human-pr-metrics` | `human-pr-metrics.sh` | `ORG` | `REPO`, `DAYS`, `SINCE`, `UNTIL` |
| `coding-agent-pr-metrics` | `coding-agent-pr-metrics.sh` | `ORG` | `REPO`, `DAYS`, `MAX_REPOS` |
| *(session logs)* | `agent-session-logs.sh` | `ORG` | `IDLE_THRESHOLD_SECS`, `MAX_SESSIONS` |

Raw output is written to `_data/raw/` as timestamped JSON files.

## What Gets Materialized

After collection, the materializer produces 5 artifacts in
`_data/materialized/`:

| Artifact | Raw Input(s) | Feeds Dashboards |
|---|---|---|
| `ai-assisted-efficiency-days` | `copilot-metrics` | V2 AI-Assisted Efficiency, Element |
| `ai-assisted-structural-days` | `copilot-metrics` + `human-pr-metrics` | V2 AI-Assisted Structural, Element |
| `agentic-efficiency-days` | `coding-agent-pr-metrics` | V2 Agentic Efficiency, Element |
| `agentic-pr-sessions` | `coding-agent-pr-metrics` | V2 Agentic Element |
| `leverage-summary` | *all of the above* | V2 Integrated Leverage, Demo Live |

## Direct Script Usage

Use direct script execution only when you want to bypass the pipeline.

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
```

### Agentic PR Metrics

```bash
ORG="octodemo" DAYS=28 \
  ./BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh > agentic-metrics.json
```

## Automated Nightly Pipeline

The GitHub Actions workflow `.github/workflows/pipeline-deploy.yml` runs
the full pipeline on a nightly schedule (6 AM UTC) and deploys dashboards
to GitHub Pages.

### Setup

1. **Create a GitHub PAT** with `copilot`, `read:org` (and `read:enterprise` if using enterprise-level metrics) scopes — see [PAT setup](pat-setup.md) for detailed instructions including org SSO authorization.
2. **Add the PAT** as a repository secret named `DASHBOARD_GH_TOKEN`.
3. **Set repository variables** for the query parameters:
   - `ENTERPRISE` — GitHub Enterprise slug (if applicable)
   - `ORG` — GitHub Organization name
   - `DAYS` — Lookback window in days (default: `28`)
4. **Enable GitHub Pages** in the repository settings (Source: GitHub Actions).

### How it works

| Step | Description |
|---|---|
| **Collect** | Runs all query scripts with env vars from secrets/variables. Writes timestamped JSON to `_data/raw/`. |
| **Materialize** | Produces 5 artifacts in `_data/materialized/` from the raw data. |
| **Deploy** | `scripts/build-pages.sh` assembles `_site/` with dashboards, artifacts, and landing page. Deploys to Pages. |
| **Auto-load** | V2 dashboards fetch `pipeline-manifest.json` on load and render from materialized artifacts. Manual file upload remains as fallback. |

### Manual trigger

The workflow supports `workflow_dispatch` with inputs for `pipeline_steps`,
`enterprise`, `org`, and `days`. See [config-examples.md](config-examples.md)
for selective step examples.

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

For the full list of GitHub API endpoints, access levels, and required scopes, see [data-sources.md](data-sources.md).
