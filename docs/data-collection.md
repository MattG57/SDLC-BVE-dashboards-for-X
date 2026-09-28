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

1. **Create a GitHub PAT** with `copilot`, `read:org`, `repo` (and `read:enterprise` if using enterprise-level metrics) scopes — see [PAT setup](pat-setup.md) for detailed instructions including org SSO authorization.
2. **Add the PAT** as a repository secret named `DASHBOARD_GH_TOKEN`.
   Secret names must use only alphanumerics and underscores (no hyphens).
3. **Set repository variables** for the query parameters:
   - `ENTERPRISE` — GitHub Enterprise slug (if applicable)
   - `ORG` — GitHub Organization name
   - `DAYS` — Lookback window in days (default: `28`)
4. **Enable GitHub Pages** in the repository settings (Source: GitHub Actions).
5. **Enable Actions for the repo** — if your org restricts Actions to
   selected repositories, an admin must add the repo to the allowed list.

### Post-push verification

After pushing workflows to a new repo, always verify GitHub has
registered them before attempting to dispatch:

```bash
gh workflow list -R <owner>/<repo>
```

If this returns "no workflows found":
- Confirm the `.github/workflows/` files are on the default branch
- Check the org's Actions policy (see [getting-started.md](getting-started.md#actions-workflow-not-found))
- If the org belongs to an Enterprise, check the enterprise-level Actions policy — it overrides org settings

### First-run behavior

On a completely fresh repo with no prior data:
- The **agent session logs** enrichment step will be skipped because there is
  no agentic raw data yet. This is normal and will resolve after the first
  successful agentic data collection.
- The `--dry-run` flag may report some artifacts as "no raw data available"
  until the first full collection completes.

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

### Collection run status (`query-status.json`)

Every `collect-and-materialize.sh` invocation writes a run record to
`dashboard/dataflow/data/query-status.json`. It is built by
`scripts/write-query-status.js` (logic in `shared/core/query-status.js`). The
**Pipeline Status** dashboard (`dashboard/data-status/`) renders it in the
"Last Collection Run" panel.

| Field | Meaning |
|---|---|
| `schema_version` | `2` |
| `mode` | `collect`, `materialize-only` or `session-logs-only` |
| `run_started` / `run_finished` | ISO-8601 UTC timestamps for the last *collection* run |
| `profile` | `query-settings.json` profile used |
| `targets[]` | One entry per target: `target`, `status` (`success` / `failed` / `skipped`), `script`, `output_file`, `file_size_bytes`, `duration_s`, `warnings[]` (up to 10 `⚠`/warning lines from the script's stderr), `error`, `timestamp` |
| `updated_at` / `last_invocation` | When the file was last written, and by which mode |
| `raw_files[]` | Inventory of `_data/raw/` (stripped from the deployed `data-status.json` copy to keep it small) |

How each mode updates the record:

- A **`--materialize-only`** run keeps the previous collection record and
  updates only `updated_at` and `last_invocation`.
- A **`--session-logs-only`** run replaces just the `agent-session-logs`
  target.

The workflow caches the file separately (`pipeline-status-*`), so deploy-only
runs still show the last collection. It does not share the raw-data cache,
because changing that cache's paths would invalidate history.

`scripts/build-pages.sh` publishes the file in two places:

- `_site/dataflow/data/query-status.json`
- embedded as `query_run` in `_site/data-status/data/data-status.json`

`build-pages.sh` reads the legacy `_data-status/query-status.json` location
only as a fallback.

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
.github/workflows/pipeline-deploy.yml
```

For dependency mapping, expected schema details, and change-propagation checklists, see [../dependencies/README.md](../dependencies/README.md).

For the full list of GitHub API endpoints, access levels, and required scopes, see [data-sources.md](data-sources.md).
