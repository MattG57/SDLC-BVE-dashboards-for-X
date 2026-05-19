# CI/CD Setup Guide

## Complete Setup Checklist

### 1. Create a PAT

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ `copilot`
   - ✅ `read:org`
   - ✅ `read:enterprise` (if using enterprise-level metrics)
   - ✅ `repo`
4. Generate and copy the token

### 2. Configure SSO (if applicable)

If your organization uses SAML SSO:
1. Go to Settings → Developer settings → Personal access tokens
2. Find your token → Click "Configure SSO"
3. Click "Authorize" next to each target organization

### 3. Add Repository Secret

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `DASHBOARD_GH_TOKEN`
4. Value: paste your PAT
5. Click "Add secret"

### 4. Set Repository Variables

1. Go to your repository → Settings → Secrets and variables → Actions → Variables tab
2. Add these variables:

| Variable | Value | Required |
|---|---|---|
| `ENTERPRISE` | Your enterprise slug | If using enterprise APIs |
| `ORG` | Your organization name | Always |
| `DAYS` | Lookback window (e.g., `28`) | Recommended |
| `RUNNER_LABEL` | Custom runner label | Optional (default: `ubuntu-latest`) |

### 5. Enable GitHub Pages

1. Go to your repository → Settings → Pages
2. Source: **GitHub Actions**
3. Save

### 6. Trigger First Run

```bash
gh workflow run pipeline-deploy.yml
```

Or use the GitHub Actions UI: Actions tab → "Pipeline Collect & Deploy" → "Run workflow"

### 7. Verify Deployment

```bash
# Check workflow completed
gh run list --workflow=pipeline-deploy.yml --limit=1

# Get Pages URL
gh api repos/{owner}/{repo}/pages --jq '.html_url'
```

## Workflow Files

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| Pipeline Collect & Deploy | `.github/workflows/pipeline-deploy.yml` | Nightly 6 AM UTC + manual | Primary pipeline (collect, materialize, deploy) |
| Collect Data & Deploy | `.github/workflows/deploy-dashboards.yml` | Nightly 6 AM UTC + manual | Legacy workflow |

Both workflows use the same `pages-deploy` concurrency group to prevent conflicts.

## Token Rotation

When rotating PATs:
1. Create new PAT with same scopes
2. Authorize for SSO if applicable
3. Update the `DASHBOARD_GH_TOKEN` secret
4. Trigger a manual workflow run to verify
5. Delete the old PAT

## Custom Runner

To use a custom GitHub Actions runner:
1. Set up the runner in your org
2. Add a repository variable: `RUNNER_LABEL` = your runner's label
3. The workflow uses: `runs-on: ${{ vars.RUNNER_LABEL || 'ubuntu-latest' }}`
