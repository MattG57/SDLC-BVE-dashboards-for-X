# Profile Configuration Examples

Common profile and command-line scenarios for the BVE data pipeline.

## Scheduled (Nightly) Scenarios

### Standard nightly — full pipeline

The `default` profile. Collects 30 days, materializes, and deploys.

```json
{
  "ORG": "octodemo",
  "ENTERPRISE": "octodemo",
  "DAYS": "30",
  "STREAM_MODE": "true",
  "SETTINGS_VERSION": "1"
}
```

### Shorter window for faster runs

A 14-day window reduces API calls while capturing recent trends.

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

### Multi-org with separate tokens

Create a profile per org with its own token secret.

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

Run each profile:
```bash
./run-query.sh --profile team-alpha
./run-query.sh --profile team-beta
```

### Deploy-only (no collection)

Re-deploy dashboards using previously materialized data.

```json
{
  "deploy-only": {
    "SKIP_DATA_COLLECTION": "true",
    "PIPELINE_STEP": "materialize,deploy",
    "SETTINGS_VERSION": "1"
  }
}
```

## Ad-Hoc Scenarios

### Quick test — small scope
```bash
DAYS=7 MAX_REPOS=5 ./run-query.sh
```

### Re-materialize without collecting
```bash
./run-query.sh --materialize-only
```

### Force collection on a skip-by-default profile
```bash
./run-query.sh --profile deploy-only --collect
```

### Non-streaming mode for debugging
```bash
./run-query.sh --no-streaming
```

### Session logs only
```bash
./run-query.sh --session-logs-only
```

### Selective workflow dispatch steps
```bash
gh workflow run pipeline-deploy.yml -f pipeline_steps=collect,materialize
gh workflow run pipeline-deploy.yml -f pipeline_steps=materialize,deploy
gh workflow run pipeline-deploy.yml -f pipeline_steps=deploy
```
