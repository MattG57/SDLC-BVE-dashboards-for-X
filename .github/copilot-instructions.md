# Copilot Instructions

## Build, Test, and Lint

```bash
npm install --include=dev
npm test                                    # all workspaces
npm test --workspace=BVE-dashboards-for-ai-assisted-coding  # one workspace
npx vitest run path/to/file.test.js         # single test file
npm run build                               # all dashboards
npm run lint
npm run format
npm run validate
npm run verify:all
```

## Architecture

npm workspaces monorepo producing self-contained, browser-only HTML dashboards (React 18 + Highcharts via CDN, Primer CSS dark theme). No server required.

`run-query.sh` wraps `scripts/collect-and-materialize.sh` to collect data via `gh` CLI → raw JSON → materialized artifacts → dashboards auto-load. Collection targets are registered in `collect-and-materialize.sh`'s `register_targets()` function.

## User Context Guidance

- **Users with prior repo context or active conversation history:** build on the context they already have. Do not restart with a full repo tour unless they ask for it or the task moves into an unfamiliar area.
- **New users or sessions with no repo context:** first read `README.md`, `docs/getting-started.md`, `docs/data-collection.md`, and `dependencies/README.md` before giving architectural, setup, or deployment guidance. Use those docs to explain what the repo does, how dashboards are published, and which files/workflows are current.
- **Users setting up data collection:** walk them through PAT creation and org SSO authorization using `docs/pat-setup.md` and `docs/getting-started.md`. Make sure they know about the required scopes, `DASHBOARD_GH_TOKEN`, repo variables like `ORG`/`ENTERPRISE`/`DAYS`, and that `.github/workflows/pipeline-deploy.yml` is the current deployment workflow.
- **Users learning, debugging, or modifying the repo:** point them to the relevant docs up front. Make them aware that the repo still contains legacy or deprecated files and workflows, so they should confirm whether they are touching the active path or an older compatibility path before making changes.
- **Current-vs-legacy guidance:** prefer current dashboard and deployment paths first. Start from `dashboard/v4/` when present, treat `dashboard/v4/ai-assisted-efficiency/` as the current AI-assisted efficiency dashboard, treat `.github/workflows/pipeline-deploy.yml` as the active pipeline, and treat `.github/workflows/deploy-dashboards.yml` plus older v1/v2/v3 or manual-upload paths as legacy unless the task is explicitly about them.

## Copilot-led Onboarding Guidance

- For new-user setup and onboarding tasks, prefer a **Copilot-led workflow** over asking the user to manually type commands or edit files line by line.
- Start by ensuring the user can launch `copilot` successfully. If Copilot CLI is missing, help install or configure it first before proceeding with repo setup steps.
- After Copilot is available, guide setup in this order:
  1. read the key docs and summarize the current path
  2. guide PAT creation and org SSO authorization
  3. configure `query-settings.json`
  4. configure `dashboard-config.json`
  5. run `./run-query.sh --dry-run`
  6. run or customize local collection/materialization
  7. serve dashboards locally or prepare `pipeline-deploy.yml`
  8. troubleshoot errors and recover the flow
- Prefer doing the typing and edits through Copilot wherever possible: update config files, run validation commands, interpret failures, and propose the next safe step instead of giving the user a large block of manual instructions.
- Never ask the user to paste secrets into chat, into notebook cells, or into tracked files. For PAT setup, guide the user to create the token, authorize SSO, and then either authenticate `gh`, set `GITHUB_TOKEN` locally, or add `DASHBOARD_GH_TOKEN` in GitHub Actions outside the conversation.
- When creating onboarding notebooks or guided setup flows, make each step a concrete Copilot prompt the user can paste into an interactive `copilot` session. Prefer one prompt per phase, and keep each prompt scoped to a single objective.

## Key Conventions

- **[dependencies/README.md](dependencies/README.md) is the authoritative source** for how scripts, dashboards, and schemas relate. Defer to it for any structural or dependency decision — adding dashboards, modifying query targets, renaming scripts, or changing output shapes.
- External dependencies (React, Highcharts, Primer CSS) are CDN-loaded, not bundled. Versions are pinned in `build-config/dashboard-config.js`.
- Tests use Vitest with `happy-dom` environment. Target coverage is 80%.
- The build system intentionally supports partially migrated dashboards (monolithic fallback).

## Documentation Map

- [docs/development.md](docs/development.md) — contributor workflow and repo layout
- [docs/BUILD-SYSTEM.md](docs/BUILD-SYSTEM.md) — build internals and dual-mode behavior
- [docs/getting-started.md](docs/getting-started.md) — onboarding and first run
- [docs/data-collection.md](docs/data-collection.md) — query workflow and targets
- [docs/pat-setup.md](docs/pat-setup.md) — PAT creation, scopes, and SSO authorization
- [docs/dashboard-status.md](docs/dashboard-status.md) — readiness and migration state
- [dependencies/README.md](dependencies/README.md) — script-to-dashboard dependency map, schemas, and checklists for adding/modifying dashboards
