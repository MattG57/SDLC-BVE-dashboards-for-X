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

`run-query.sh` collects data via `gh` CLI → JSON → dashboards load it via file upload. Query targets are registered in `run-query.sh`'s `get_target_config()` function.

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
- [docs/dashboard-status.md](docs/dashboard-status.md) — readiness and migration state
- [dependencies/README.md](dependencies/README.md) — script-to-dashboard dependency map, schemas, and checklists for adding/modifying dashboards
