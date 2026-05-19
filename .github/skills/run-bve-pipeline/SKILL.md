---
name: run-bve-pipeline
description: >-
  Run the BVE data pipeline to collect Copilot metrics, PR data, and agentic session data from GitHub APIs,
  then materialize artifacts for dashboards. Use when the user says "run pipeline", "collect data",
  "materialize", "fetch copilot metrics", "run-query", "refresh data", or "update dashboards".
  Do not use for configuring dashboard parameters (use configure-bve-dashboards) or deploying to Pages (use deploy-bve-dashboards).
---

# Run BVE Pipeline

The single entry point for all data collection and materialization is `./run-query.sh` at the repository root. It wraps `scripts/collect-and-materialize.sh` and passes through all flags.

## Prerequisites

Before running the pipeline:

1. **Node.js >= 18** and **npm >= 9** installed
2. **GitHub CLI** authenticated: `gh auth login`
3. **GitHub PAT** (classic) with scopes:
   - `copilot` — always required
   - `read:org` — for org-level data
   - `read:enterprise` — for enterprise-level data
   - `repo` — for PR metrics and Actions logs
4. If using SAML SSO, authorize the PAT for the target org
5. Install dependencies: `npm install --include=dev`

Set the token:
```bash
export GITHUB_TOKEN="ghp_your_token_here"
```

## Basic Usage

```bash
# Full pipeline with default profile
./run-query.sh

# Use a named profile from query-settings.json
./run-query.sh --profile short-window

# Override lookback window
DAYS=7 ./run-query.sh

# Quick test with limited repos
DAYS=7 MAX_REPOS=5 ./run-query.sh
```

## CLI Flags

| Flag | Effect |
|---|---|
| `--profile <name>` | Use a named profile from `query-settings.json` |
| `--materialize-only` | Skip data collection; re-materialize from cached raw data |
| `--collect` | Force collection even if profile sets `SKIP_DATA_COLLECTION` |
| `--session-logs-only` | Fetch agent session logs only (no metrics collection) |
| `--no-streaming` | Use standard (non-streaming) materializer for debugging |
| `--dry-run` | Show resolved config and what would run — no API calls |
| `--help` | Show help with available profiles and pipeline steps |

## Environment Variable Overrides

Environment variables override profile values:

| Variable | Purpose | Example |
|---|---|---|
| `DAYS` | Lookback window in days | `DAYS=14` |
| `MAX_REPOS` | Max repositories to scan | `MAX_REPOS=10` |
| `ORG` | GitHub Organization name | `ORG=my-org` |
| `ENTERPRISE` | GitHub Enterprise slug | `ENTERPRISE=my-ent` |
| `PIPELINE_STEP` | Comma-separated steps | `PIPELINE_STEP=collect,materialize` |
| `STREAM_MODE` | Streaming materialization | `STREAM_MODE=false` |
| `SKIP_DATA_COLLECTION` | Skip collection phase | `SKIP_DATA_COLLECTION=true` |
| `GITHUB_TOKEN` | PAT for API access | — |

## Override Precedence

Settings resolve in this order (highest wins):

1. **CLI flags** — `--collect`, `--materialize-only`, `--no-streaming`
2. **Environment variables** — `DAYS=7`, `MAX_REPOS=5`
3. **Workflow inputs** — via `workflow_dispatch`
4. **Profile values** — from `query-settings.json`

## Pipeline Steps

The pipeline runs these steps in sequence:

| Step | What It Does |
|---|---|
| **collect** | Runs query scripts against GitHub APIs. Writes timestamped JSON to `_data/raw/` |
| **session-logs** | Fetches agent session logs from GitHub Actions |
| **materialize** | Produces 5 artifacts in `_data/materialized/` from raw data |

## Collection Targets

| Target | Script | Required Env | Optional Env |
|---|---|---|---|
| `copilot-metrics` | `copilot-user-and-enterprise-metrics.sh` | `ENTERPRISE` or `ORG` | `DAYS` |
| `human-pr-metrics` | `human-pr-metrics.sh` | `ORG` | `REPO`, `DAYS`, `SINCE`, `UNTIL` |
| `coding-agent-pr-metrics` | `coding-agent-pr-metrics.sh` | `ORG` | `REPO`, `DAYS`, `MAX_REPOS` |
| *(session logs)* | `agent-session-logs.sh` | `ORG` | `IDLE_THRESHOLD_SECS`, `MAX_SESSIONS` |

## Materialized Artifacts

After collection, 5 artifacts are produced in `_data/materialized/`:

| Artifact | Raw Input(s) | Feeds Dashboards |
|---|---|---|
| `ai-assisted-efficiency-days` | `copilot-metrics` | AI-Assisted Efficiency, Element |
| `ai-assisted-structural-days` | `copilot-metrics` + `human-pr-metrics` | AI-Assisted Structural, Element |
| `agentic-efficiency-days` | `coding-agent-pr-metrics` | Agentic Efficiency, Element |
| `agentic-pr-sessions` | `coding-agent-pr-metrics` | Agentic Element |
| `leverage-summary` | *all of the above* | Integrated Leverage, Demo Live |

## Output Locations

- Raw data: `_data/raw/` (timestamped JSON files)
- Materialized artifacts: `_data/materialized/`
- Pipeline manifest: `dashboard/dataflow/data/pipeline-manifest.json`

## Common Workflows

### First-time setup
```bash
npm install --include=dev
# Edit query-settings.json with your org/enterprise
./run-query.sh --dry-run      # verify config
./run-query.sh                 # run full pipeline
```

### Re-materialize after config change
```bash
./run-query.sh --materialize-only
```

### Debug materializer issues
```bash
./run-query.sh --no-streaming
```

### Verify before running
```bash
./run-query.sh --dry-run
```

## Important Notes

- **Never mix stderr into stdout** when running scripts directly:
  - ✅ `./script.sh > data.json`
  - ✅ `./script.sh 2>progress.log > data.json`
  - ❌ `./script.sh > data.json 2>&1`
- The pipeline is idempotent — re-running overwrites previous artifacts
- Raw data files are timestamped so multiple runs don't conflict
- The materializer always uses the latest raw data files

## References

- [Pipeline flags reference](references/pipeline-flags.md)
- [Collection targets detail](references/collection-targets.md)
