# Pipeline Flags Reference

Complete reference for `./run-query.sh` and `scripts/collect-and-materialize.sh` flags.

## run-query.sh

The top-level entry point. All flags are passed through to `collect-and-materialize.sh`.

```
Usage:
  ./run-query.sh                           Run full pipeline (default profile)
  ./run-query.sh --profile <name>          Use a named profile from query-settings.json
  ./run-query.sh --materialize-only        Skip collection, re-materialize from cached data
  ./run-query.sh --collect                 Force collection even if profile skips it
  ./run-query.sh --session-logs-only       Fetch agent session logs only
  ./run-query.sh --no-streaming            Use standard (non-streaming) materializer
  ./run-query.sh --dry-run                 Show what would happen without executing
  ./run-query.sh --help                    Show this help
```

## Flag Details

### `--profile <name>`
Select a named profile from `query-settings.json`. Each profile stores ORG, ENTERPRISE, DAYS, and pipeline settings. The `default` profile is used when no profile is specified.

### `--materialize-only`
Skips the collection phase entirely. Re-materializes artifacts from existing raw data in `_data/raw/`. Useful after changing materializer logic or config values.

### `--collect`
Forces data collection even if the profile sets `SKIP_DATA_COLLECTION: "true"`. Overrides the profile setting at the CLI flag level (highest precedence).

### `--session-logs-only`
Only fetches agent session logs from GitHub Actions. Does not collect Copilot metrics or PR data. Useful for updating session-log-dependent artifacts without a full re-collection.

### `--no-streaming`
Uses the standard (non-streaming) materializer. Streaming mode is faster but harder to debug. Use this flag when diagnosing materializer errors to get full error context.

### `--dry-run`
Shows the resolved configuration (after merging profile + env + flags) and what the pipeline would do, without making any API calls or producing output.

### `--help`
Displays usage information, lists available profiles from `query-settings.json`, and shows pipeline step names.

## Pipeline Steps via PIPELINE_STEP

The `PIPELINE_STEP` environment variable (or profile key) accepts comma-separated step names:

| Step | Description |
|---|---|
| `collect` | Run all query scripts to fetch data from GitHub APIs |
| `session-logs` | Fetch agent session logs from GitHub Actions |
| `materialize` | Produce artifacts from raw data |
| `deploy` | Build and deploy to GitHub Pages |

Examples:
```bash
PIPELINE_STEP=collect,materialize ./run-query.sh
PIPELINE_STEP=materialize,deploy ./run-query.sh
PIPELINE_STEP=deploy ./run-query.sh
```
