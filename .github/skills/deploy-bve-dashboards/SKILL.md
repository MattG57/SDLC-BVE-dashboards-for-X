---
name: deploy-bve-dashboards
description: >-
  Deploy BVE dashboards to GitHub Pages via the CI/CD pipeline. Covers local builds, GitHub Actions
  workflow dispatch, required setup (secrets, variables, Pages), the build-pages.sh assembly process,
  and the nightly cron schedule. Use when the user says "deploy", "publish dashboards", "GitHub Pages",
  "trigger workflow", "build dashboards", "nightly pipeline", "build pages", or "deploy to pages".
  Do not use for running the data pipeline (use run-bve-pipeline) or troubleshooting deployment
  failures (use troubleshoot-bve-pipeline).
---

# Deploy BVE Dashboards

## Deployment Architecture

The deployment pipeline:
1. **Collect** — Query scripts fetch data from GitHub APIs → `_data/raw/`
2. **Materialize** — Produce artifacts from raw data → `_data/materialized/`
3. **Build** — `scripts/build-pages.sh` assembles `_site/` with all dashboards and data
4. **Deploy** — Upload to GitHub Pages via `actions/deploy-pages@v4`

## Local Build

Build the site locally without deploying:

```bash
npm run build
```

Or run the build script directly:

```bash
bash scripts/build-pages.sh
ls _site/
```

The build assembles:
- All V2 dashboards from `dashboard/v2/*/index.html`
- V1 dashboards from workspace `dashboard/` directories
- Materialized artifacts and pipeline manifest
- Landing page with dashboard index
- Data status page

## GitHub Pages Setup

### Required Setup

1. **Create a GitHub PAT** (classic) with scopes:
   - `copilot` — Copilot metrics
   - `read:org` — org-level data
   - `read:enterprise` — enterprise-level data (if applicable)
   - `repo` — PR metrics and Actions logs

2. **Add PAT as repository secret**:
   - Name: `DASHBOARD_GH_TOKEN`
   - Settings → Secrets and variables → Actions → New repository secret

3. **Set repository variables**:
   - `ENTERPRISE` — GitHub Enterprise slug (if applicable)
   - `ORG` — GitHub Organization name
   - `DAYS` — Lookback window (default: `28`)
   - Optional: `RUNNER_LABEL` — custom runner label

4. **Enable GitHub Pages**:
   - Settings → Pages → Source: **GitHub Actions**

## Workflow: pipeline-deploy.yml

The primary deployment workflow. Runs nightly at 6 AM UTC.

### Automatic (nightly)

The workflow triggers automatically:
```yaml
schedule:
  - cron: '0 6 * * *'  # Daily at 6 AM UTC
```

### Manual trigger via CLI

```bash
# Full pipeline (collect + materialize + deploy)
gh workflow run pipeline-deploy.yml

# Specify org and days
gh workflow run pipeline-deploy.yml \
  -f org=my-org \
  -f enterprise=my-enterprise \
  -f days=14

# Skip data collection (deploy only)
gh workflow run pipeline-deploy.yml \
  -f skip_data_collection=true

# Selective steps
gh workflow run pipeline-deploy.yml \
  -f pipeline_steps=collect,materialize

gh workflow run pipeline-deploy.yml \
  -f pipeline_steps=materialize,deploy

gh workflow run pipeline-deploy.yml \
  -f pipeline_steps=deploy
```

### Workflow Inputs

| Input | Description | Default |
|---|---|---|
| `skip_data_collection` | Deploy pages only (skip collection) | `false` |
| `pipeline_steps` | Comma-separated steps to run | `""` (all) |
| `enterprise` | Override ENTERPRISE variable | — |
| `org` | Override ORG variable | — |
| `days` | Override DAYS variable | `28` |

### Workflow Permissions

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

### Caching

The workflow caches raw data between runs:
- Cache key: `pipeline-data-{run_id}`
- Restore keys: `pipeline-data-` (falls back to latest)
- Cached paths: `_data/raw/*.json`

## Workflow: deploy-dashboards.yml

Legacy deployment workflow. Also runs nightly at 6 AM UTC. Uses `./run-query.sh --all` for data collection.

## Monitoring Deployments

### Check workflow status
```bash
gh run list --workflow=pipeline-deploy.yml --limit=5
```

### View specific run
```bash
gh run view <run-id>
```

### Check failed run logs
```bash
gh run view <run-id> --log-failed
```

### View Pages URL
```bash
gh api repos/{owner}/{repo}/pages --jq '.html_url'
```

## V2 Dashboard Auto-Load

After deployment, V2 dashboards automatically:
1. Fetch `pipeline-manifest.json` on page load
2. Load materialized artifacts listed in the manifest
3. Render charts with the latest data

No manual file upload needed for deployed dashboards. File upload is always available as fallback.

## Build Script Details

`scripts/build-pages.sh` assembles the `_site/` directory:

| Source | Destination | Content |
|---|---|---|
| `dashboard/v2/*/` | `_site/dashboard/v2/*/` | V2 dashboards |
| `dashboard/dataflow/` | `_site/dashboard/dataflow/` | Dataflow dashboard |
| `dashboard/integrated/` | `_site/dashboard/integrated/` | Integrated dashboard |
| `_data/materialized/` | `_site/dashboard/dataflow/data/materialized/` | Artifacts |
| Generated | `_site/dashboard/dataflow/data/pipeline-manifest.json` | Manifest |
| Generated | `_site/index.html` | Landing page |
| `dashboard/data-status/` | `_site/dashboard/data-status/` | Data status page |

## Common Deployment Scenarios

### First deployment
```bash
# 1. Set up secrets and variables (see Required Setup above)
# 2. Enable Pages
# 3. Trigger first run
gh workflow run pipeline-deploy.yml
```

### Re-deploy with existing data
```bash
gh workflow run pipeline-deploy.yml -f skip_data_collection=true
```

### Deploy after config change
```bash
gh workflow run pipeline-deploy.yml -f pipeline_steps=materialize,deploy
```

### Force fresh data collection
```bash
gh workflow run pipeline-deploy.yml -f pipeline_steps=collect,materialize,deploy
```

## References

- [CI/CD setup guide](references/ci-cd-setup.md)
