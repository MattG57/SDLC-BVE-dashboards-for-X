# SDLC BVE Dashboards for X — Copilot Setup and Config Prompts

This is a **manual reference** for using this repo with GitHub Copilot during setup and configuration.

The command and prompt blocks below are examples to run in a terminal or reuse in a Copilot session.

## Current paths to prefer

- Use `.github/workflows/pipeline-deploy.yml` as the current pipeline workflow.
- Treat `.github/workflows/deploy-dashboards.yml` as legacy.
- Prefer current V4 dashboards when they exist, especially:
  - `dashboard/v4/ai-assisted-efficiency/`
  - `dashboard/v4/agentic-efficiency/`
- Treat older manual-upload and older-version dashboards as legacy unless you are intentionally working there.

## Source-of-truth docs

- `README.md`
- `docs/getting-started.md`
- `docs/pat-setup.md`
- `docs/data-collection.md`
- `docs/dashboard-status.md`
- `dependencies/README.md`

## Authentication and environment notes

Start with **Copilot authentication** before using repo-specific prompts.

```bash
copilot login
```

- If you prefer token auth, use `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN` with a token that supports Copilot access.
- For Copilot CLI token auth, prefer a **fine-grained PAT** with the **Copilot Requests** permission.
- Classic PATs (`ghp_...`) are not supported by Copilot CLI.
- If JupyterLab or another tool was already running before auth was set up, restart it so the process inherits the same environment.

Useful manual checks:

```bash
which copilot
copilot --version
gh auth status
env | grep -E '^(COPILOT_GITHUB_TOKEN|GH_TOKEN|GITHUB_TOKEN)='
copilot -p "Reply with exactly: copilot-auth-ok" --allow-all
```

## Security note

Do **not** put secret PAT values into notebooks or tracked files. Let Copilot explain the setup, but create and store secrets outside the repo.

## Suggested Copilot workflow

1. Authenticate Copilot.
2. Ask Copilot to orient itself to the repo using the core docs.
3. Ask Copilot to explain PAT setup and SSO authorization.
4. Use Copilot to update `query-settings.json`.
5. Use Copilot to update `dashboard-config.json`.
6. Run `./run-query.sh --dry-run` and let Copilot interpret the result.
7. Run local collection or materialization.
8. Serve dashboards locally.
9. Prepare or trigger GitHub Pages deployment.
10. Use Copilot to troubleshoot environment, auth, config, or pipeline issues.

## Prompt reference

### Orient Copilot to the repo

```text
Read README.md, docs/getting-started.md, docs/pat-setup.md, docs/data-collection.md, docs/dashboard-status.md, and dependencies/README.md. Summarize the current setup path for a brand-new user of this repo, including the current workflow, the dashboards to prefer first, and what paths should be treated as legacy.
```

### PAT setup and SSO

```text
Use docs/pat-setup.md and docs/getting-started.md to guide a new user through creating the correct GitHub Personal Access Token for this repo. Explain the required scopes, explain SSO authorization, and explain the safest next step for using the token locally or in GitHub Actions without asking the user to paste the secret into chat or into files.
```

### Configure query settings

```text
Update query-settings.json for this repository using ORG='your-org', ENTERPRISE='your-enterprise-slug-or-empty', and DAYS='28'. Keep the change minimal, explain the final effective configuration, and do not modify unrelated files.
```

### Configure dashboard assumptions

```text
Update dashboard-config.json for this repository using cfg_total_developers=500, cfg_pct_time_coding=0.25, cfg_labor_cost_per_hour=100, est_hrs_per_kloc=1, and est_duration_factor=10. Explain what each of these values affects in the dashboards, keep the change minimal, and do not modify unrelated files.
```

### Validate with dry run

```text
Run ./run-query.sh --dry-run, interpret the output, and fix any safe configuration problems you find in this repository. Do not ask for secrets in chat. If something is blocked by missing external setup, explain the exact next manual step.
```

### Local pipeline and materialization

```text
Check whether local authentication is ready for this repo, then run the safest next command to execute the local pipeline. If authentication or PAT setup is incomplete, explain the exact external step that is still required before retrying.
```

```text
Run ./run-query.sh --materialize-only for this repository, explain what artifacts were refreshed, and report any issues clearly.
```

## More prompt reference

### Serve dashboards locally

```text
Serve the dashboards locally for this repository, tell me which local URL to open, and point me to the best current dashboards to inspect first. Prefer V4 dashboards where available and explain which legacy paths I can ignore for now.
```

### Prepare deployment

```text
Help me prepare GitHub Pages deployment for this repository using .github/workflows/pipeline-deploy.yml. Check what still needs to be configured for DASHBOARD_GH_TOKEN, ORG or ENTERPRISE variables, DAYS, and Pages settings. Then give me the smallest safe next steps and the command to trigger the workflow.
```

### Trigger deployment

```text
Trigger the current pipeline deploy workflow for this repository with data collection skipped, then report the workflow run link and current status.
```

### Troubleshoot setup problems

```text
Diagnose my setup problem for this repository. Check the environment, authentication state, config files, dry-run output, current workflow path, and devcontainer or Jupyter setup. Fix what you can directly, explain what is blocked, and tell me the exact next action if manual intervention is required.
```

## Quick context to give Copilot

- This is an npm workspaces monorepo that produces self-contained browser dashboards.
- Data collection flows through `run-query.sh` and `scripts/collect-and-materialize.sh`.
- `dependencies/README.md` is the authoritative dependency and structure map.
- Prefer current V4 dashboards and the pipeline deployment path first.
- Treat older v1/v2/v3 or manual-upload paths as legacy unless the task is explicitly about them.
