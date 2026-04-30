# Configuration Examples

Common profile and command-line scenarios for the BVE data pipeline.

## Scheduled (Nightly) Scenarios

### Standard nightly — full pipeline

Collects 30 days of data, materializes artifacts, and deploys dashboards.
This is the `default` profile and requires no customization.

```json
{
  "ORG": "octodemo",
  "ENTERPRISE": "octodemo",
  "DAYS": "30",
  "STREAM_MODE": "true",
  "SETTINGS_VERSION": "1"
}
```

Workflow: runs automatically via `cron: '0 6 * * *'`.

### Nightly — shorter window for faster runs

A 14-day window reduces API calls and processing time while still
capturing recent trends.

```json
{
  "short-window": {
    "ORG": "octodemo",
    "ENTERPRISE": "octodemo",
    "DAYS": "14",
    "STREAM_MODE": "true",
    "SETTINGS_VERSION": "1"
  }
}
```

### Nightly — multi-org with separate tokens

When dashboards cover multiple organizations, create a profile per org
with its own token secret.

```json
{
  "team-alpha": {
    "ORG": "alpha-org",
    "ENTERPRISE": "acme-corp",
    "DAYS": "30",
    "GH_TOKEN_NAME": "ALPHA_DASHBOARD_TOKEN",
    "SETTINGS_VERSION": "1"
  },
  "team-beta": {
    "ORG": "beta-org",
    "ENTERPRISE": "acme-corp",
    "DAYS": "30",
    "GH_TOKEN_NAME": "BETA_DASHBOARD_TOKEN",
    "SETTINGS_VERSION": "1"
  }
}
```

Run each profile in sequence or in separate workflow jobs:

```bash
./run-query.sh --profile team-alpha
./run-query.sh --profile team-beta
```

### Nightly — deploy-only (no data collection)

Re-deploy dashboards using previously materialized data.
Useful when the data collection step ran separately or data is committed
to the repo.

```json
{
  "deploy-only": {
    "SKIP_DATA_COLLECTION": "true",
    "PIPELINE_STEP": "materialize,deploy",
    "SETTINGS_VERSION": "1"
  }
}
```

Or trigger via workflow dispatch:

```
gh workflow run pipeline-deploy.yml -f pipeline_steps=materialize,deploy
```

---

## Ad-Hoc / Testing Scenarios

### Quick test — small scope, no deploy

Collect a 7-day window for a limited set of repos to verify the pipeline
works before committing to a full run.

```bash
DAYS=7 MAX_REPOS=5 ./run-query.sh
```

This uses the default profile but overrides `DAYS` and `MAX_REPOS` via
environment variables (env always wins over profile).

### Re-materialize without collecting

Re-run materialization on existing raw data — useful after updating
materializer logic or config values.

```bash
./run-query.sh --materialize-only
```

### Force collection on a skip-by-default profile

If a profile sets `SKIP_DATA_COLLECTION: "true"` but you need a fresh
collection run, use `--collect` to override:

```bash
./run-query.sh --profile deploy-only --collect
```

### Non-streaming mode for debugging

Streaming materialization is faster but harder to debug. Fall back to
standard mode to see full error context:

```bash
./run-query.sh --no-streaming
```

### Session logs only

Fetch agent session logs without re-running the full collection:

```bash
./run-query.sh --session-logs-only
```

### Workflow dispatch — selective steps

Run specific pipeline steps from the GitHub Actions UI or CLI:

```bash
# Collect data and materialize, but skip deploy
gh workflow run pipeline-deploy.yml -f pipeline_steps=collect,materialize

# Materialize and deploy using cached data
gh workflow run pipeline-deploy.yml -f pipeline_steps=materialize,deploy

# Deploy only (skip collection and materialization uses cached artifacts)
gh workflow run pipeline-deploy.yml -f pipeline_steps=deploy
```

---

## Override Precedence

When values conflict, the highest-priority source wins:

1. **CLI flags** — `--collect`, `--materialize-only`, `--no-streaming`
2. **Environment variables** — `DAYS=7`, `MAX_REPOS=5`, etc.
3. **Workflow inputs** — `pipeline_steps`, `days`, `org`, etc.
4. **Profile values** — from `query-settings.json`

Example: a profile sets `SKIP_DATA_COLLECTION: "true"`, but passing
`--collect` on the command line forces collection to run.

## See Also

- [query-settings.md](query-settings.md) — full key reference and profile docs
- [data-collection.md](data-collection.md) — query targets and output structure
- [getting-started.md](getting-started.md) — first-run walkthrough
