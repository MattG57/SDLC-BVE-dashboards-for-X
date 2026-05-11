---
name: troubleshoot-bve-pipeline
description: >-
  Troubleshoot common BVE pipeline issues including authentication errors, empty data, materializer
  failures, dashboard loading problems, and configuration mistakes. Covers PAT scope requirements,
  stderr contamination, dry-run diagnostics, and known config divergences.
  Use when the user says "troubleshoot", "debug", "fix error", "empty data", "auth error",
  "pipeline failed", "dashboard not loading", "no data", "token error", or "permission denied".
  Do not use for running the pipeline (use run-bve-pipeline) or validating data
  (use validate-bve-data).
---

# Troubleshoot BVE Pipeline

## Quick Diagnostic

Run the diagnostic command first:
```bash
./run-query.sh --dry-run
```

This shows resolved config, which API level each script will use, and which artifacts will be produced — without making any API calls.

## Authentication & Token Errors

### Symptom: `gh` CLI auth errors or 401/403 responses

**Diagnosis:**
```bash
gh auth status
```

**Fixes:**
1. Re-authenticate: `gh auth login`
2. Check token scopes:
   - `copilot` — required for Copilot metrics
   - `read:org` — required for org-level data
   - `read:enterprise` — required for enterprise-level data
   - `repo` — required for PR metrics and Actions logs
3. If using SAML SSO, authorize the token for the org:
   - Settings → Developer settings → Personal access tokens → Configure SSO → Authorize for each org

### Symptom: Token works for some scripts but not others

Different scripts require different scopes:
| Script | Required Scopes |
|---|---|
| `copilot-user-and-enterprise-metrics.sh` | `copilot` + (`read:org` or `read:enterprise`) |
| `human-pr-metrics.sh` | `repo` + `read:org` |
| `coding-agent-pr-metrics.sh` | `repo` + `read:org` |

### Using an explicit token
```bash
export GITHUB_TOKEN="ghp_your_token_here"
./run-query.sh
```

## Empty or Missing Data

### Symptom: Pipeline completes but data files are empty or have zero records

**Diagnosis:**
1. Verify org/enterprise name in config:
   ```bash
   cat query-settings.json | jq '.default'
   ```
2. Run dry-run to check resolved values:
   ```bash
   ./run-query.sh --dry-run
   ```
3. Check the lookback window — `DAYS` may be too small or too large
4. Try a smaller scope first:
   ```bash
   DAYS=7 MAX_REPOS=5 ./run-query.sh
   ```

### Symptom: Enterprise-level data returns empty but org-level works

- Enterprise API requires `read:enterprise` scope
- Verify the enterprise slug is correct (not the display name)
- Try org-level collection instead: remove `ENTERPRISE` from config, keep `ORG`

### Symptom: PR data is empty

- Check `ORG` is set correctly
- Verify the PAT has `repo` scope
- Check if org repos are accessible with the token
- Try with a specific repo: `REPO=my-repo DAYS=7 ./run-query.sh`

## Materializer Errors

### Symptom: Streaming materializer crashes or produces corrupt output

**Fix:** Use non-streaming mode for debugging:
```bash
./run-query.sh --no-streaming
```

Streaming mode is faster but produces less helpful error messages. Non-streaming mode shows full error context.

### Symptom: Re-materialize fails because raw data is missing

Raw data is stored in `_data/raw/`. If files are missing:
```bash
ls -la _data/raw/
```

To collect fresh data:
```bash
./run-query.sh  # full pipeline
```

To re-materialize from existing data:
```bash
./run-query.sh --materialize-only
```

## Dashboard Loading Issues

### Symptom: V2 dashboard shows "Loading..." indefinitely

**Diagnosis:**
1. Check if `pipeline-manifest.json` exists:
   ```bash
   ls dashboard/dataflow/data/pipeline-manifest.json
   ```
2. Check if materialized artifacts exist:
   ```bash
   ls _data/materialized/
   ```
3. If files exist locally but not on Pages, check the build:
   ```bash
   bash scripts/build-pages.sh
   ls _site/
   ```

### Symptom: Dashboard shows data but charts are empty

- Check browser console for JavaScript errors
- Verify the artifact has actual data (not just metadata):
  ```bash
  cat _data/materialized/leverage-summary.json | jq '.elements | length'
  ```
- Check if `cfg_total_developers` is set (default of 100 may produce near-zero percentages for large orgs)

### Symptom: Dashboard works locally but not on Pages

1. Ensure GitHub Pages is enabled (Settings → Pages → Source: GitHub Actions)
2. Check that `DASHBOARD_GH_TOKEN` secret is set
3. Verify the workflow ran successfully:
   ```bash
   gh run list --workflow=pipeline-deploy.yml
   ```
4. Check workflow logs for errors:
   ```bash
   gh run view <run-id> --log
   ```

## Stdout/Stderr Contamination

### Symptom: JSON parsing fails with "Unexpected token" errors

**Cause:** Progress messages or error text mixed into the JSON output file.

**Prevention:**
```bash
# ✅ Correct — stderr goes to separate file
./script.sh 2>progress.log > data.json

# ✅ Correct — stderr goes to terminal, stdout to file
./script.sh > data.json

# ❌ Wrong — stderr mixed into JSON
./script.sh > data.json 2>&1
```

## Configuration Issues

### Symptom: Adoption percentages are wildly wrong (very high or near-zero)

**Cause:** `cfg_total_developers` doesn't match your actual developer count.

**Fix:**
```json
{
  "cfg_total_developers": 500
}
```
Use the actual number of developers in your org, not the default (100).

### Symptom: Time saved estimates seem too high or too low

**Tune these parameters:**
- `est_interactions_per_hour` — higher values = less time saved (default: 20)
- `est_hrs_per_kloc` — higher values = more time saved (default: 2)
- `est_duration_factor` — higher values = more agentic time saved (default: 2)

### Symptom: Projections show unrealistic numbers

Check projection caps:
- `cfg_projection_cap_ai` — default: 5× max multiplier
- `cfg_projection_cap_agentic` — default: 9× max multiplier

## CI/CD Issues

### Symptom: Nightly workflow fails

Check the workflow run:
```bash
gh run list --workflow=pipeline-deploy.yml --limit=5
gh run view <run-id> --log-failed
```

Common causes:
1. `DASHBOARD_GH_TOKEN` secret expired or revoked
2. Repository variables not set (`ENTERPRISE`, `ORG`, `DAYS`)
3. GitHub Pages not enabled

### Symptom: Cache issues causing stale data

The pipeline caches raw data between runs. To force fresh collection:
```bash
gh workflow run pipeline-deploy.yml -f pipeline_steps=collect,materialize,deploy
```

## References

- [Common error patterns and fixes](references/common-errors.md)
