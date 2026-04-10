# Development

Use this guide for contributor workflows. It focuses on how to work in the repo; for cross-file dependency propagation, use [../dependencies/README.md](../dependencies/README.md).

## Core Commands

```bash
npm install --include=dev
npm test
npm run build
npm run lint
npm run format
npm run validate
npm run verify:all
```

## Common Scripts

### Root Workspace

```bash
npm test
npm run build
npm run lint
npm run format
npm run validate
npm run verify:all
```

### AI-Assisted Workspace

```bash
npm run dev:efficiency --workspace=BVE-dashboards-for-ai-assisted-coding
npm run dev:structural --workspace=BVE-dashboards-for-ai-assisted-coding
```

These convenience commands detect macOS, Linux, and Windows automatically and open the corresponding dashboard in your default browser.

## Repo Layout

```text
scripts/                         Central build and validation scripts
build-config/                    Shared dashboard build configuration
docs/                            Canonical user and contributor docs
dependencies/                    Dependency mapping and change checklists
dashboard/
  integrated/                    Integrated leverage dashboard (file-upload only)
BVE-dashboards-for-ai-assisted-coding/
  dashboard/efficiency/          Efficiency dashboard (query-target-backed)
  dashboard/structural/          Structural dashboard (query-target-backed)
  dashboard/element/             Element leverage dashboard (file-upload only)
BVE-dashboards-for-agentic-ai-coding/
  dashboard/efficiency/          Efficiency dashboard (query-target-backed)
  dashboard/element/             Element leverage dashboard (file-upload only)
run-query.sh                     Data collection runner
query-settings.json              Saved data collection profiles
```

## Typical Contributor Workflow

1. Make changes in the relevant dashboard package.
2. Add or update tests alongside logic changes.
3. Run `npm test`.
4. Run `npm run lint` and `npm run format` when you touch JS, JSON, or Markdown-heavy files.
5. Run `npm run validate`.
6. Run `npm run build` if the change affects build output.
7. Update canonical docs if user-facing behavior changed.

## Adding a New Dashboard

1. Create the dashboard directory under the appropriate suite.
2. Add or confirm build configuration in `build-config/dashboard-config.js`.
3. Add source, tests, schemas, and example data as needed.
4. Register any required query target in `run-query.sh`.
5. Update [dashboard-status.md](dashboard-status.md) and [data-collection.md](data-collection.md).
6. Update [../dependencies/README.md](../dependencies/README.md) if the dashboard changes script mappings, schemas, or config tables.

## Modifying a Query Workflow

If you rename a script, add a new output field, change runner targets, or alter required env vars:

1. Update the implementation in the query script and `run-query.sh`.
2. Update dashboard instruction panels or upload expectations if needed.
3. Update [data-collection.md](data-collection.md) if the runtime workflow changed.
4. Update [../dependencies/README.md](../dependencies/README.md) for the propagation checklist, dependency map, schemas, and output shapes.

## Documentation Ownership

- `README.md`: repository front door
- `CONTRIBUTING.md`: GitHub-facing contributor entry point
- `docs/getting-started.md`: onboarding
- `docs/data-collection.md`: runtime data collection workflow
- `docs/dashboard-status.md`: readiness and migration status
- `docs/development.md`: contributor workflow
- `docs/BUILD-SYSTEM.md`: build internals
- `dependencies/README.md`: dependency map and cross-file change procedures

## Build System

See [BUILD-SYSTEM.md](BUILD-SYSTEM.md) for bundling, validation, and fallback behavior.
