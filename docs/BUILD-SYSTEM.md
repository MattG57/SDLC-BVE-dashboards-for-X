# Build System

This document describes how the repository builds dashboard output. It is intentionally narrower than the general contributor docs in [development.md](development.md).

## Purpose

The build system exists to give all dashboards a shared way to:

- validate dashboard structure
- build deployable single-file HTML output
- keep external dependency versions consistent
- support gradual migration from monolithic HTML to modular source

## Key Files

```text
scripts/build-dashboard.js          Build one configured dashboard
scripts/build-all.js                Build every configured dashboard
scripts/validate-structure.js       Validate dashboard layout and scripts
scripts/verify-all-calculations.js  Run verification scripts
build-config/dashboard-config.js    Shared build and validation config
package.json                        Root build/test/validate entry points
```

## Commands

### Build everything

```bash
npm run build
```

### Build a specific dashboard

```bash
npm run build:ai-assisted
npm run build:agentic
```

You can also invoke the builder directly:

```bash
node scripts/build-dashboard.js BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency
```

### Validate structure

```bash
npm run validate
```

### Run verification scripts

```bash
npm run verify:all
```

## How Build Resolution Works

The builder reads [../build-config/dashboard-config.js](../build-config/dashboard-config.js) and looks up the dashboard by path.

Each dashboard config defines:

- `path`
- `name`
- `entry`
- `template`
- `output`
- `dataSchema`
- `exampleData`
- `modules`

The common config defines:

- external libraries loaded by CDN
- CDN URLs
- output format and minification settings
- validation requirements

## Build Behavior

### When modular entry files exist

If the configured entry file exists, the builder uses the modular source path:

1. read dashboard config
2. bundle application code from `src/`
3. use the configured template
4. write output to `dist/index.html`

### When modular entry files do not exist

If the configured entry file does not exist yet, the builder falls back to the preserved monolithic dashboard:

- copies `index.html` into `dist/`
- warns that modularization is still pending
- keeps the dashboard deployable while migration continues

This fallback behavior is the main reason the build system can support partially migrated dashboards.

## Output Contract

Build output is written to `dist/index.html`.

The intended result is:

- a single-file HTML artifact
- browser-openable without a server
- consistent external dependency versions across dashboards

## External Dependencies

The build config currently treats these libraries as external and loads them from CDNs rather than bundling them:

- React 18
- React DOM 18
- Highcharts 11.4.8
- Highcharts Accessibility module
- Primer CSS 21.3.1

These versions are defined centrally in [../build-config/dashboard-config.js](../build-config/dashboard-config.js).

## Validation Scope

`npm run validate` checks structural expectations defined in the shared config, including:

- required files and directories
- required package scripts
- dashboard layout consistency

`npm run verify:all` is separate from the HTML build itself. It runs calculation-verification scripts so we can confirm metric logic independently of bundling.

## Adding or Updating Build Wiring

When a dashboard needs build wiring:

1. add or update its entry in [../build-config/dashboard-config.js](../build-config/dashboard-config.js)
2. confirm the root `package.json` exposes the needed build command
3. run `npm run validate`
4. run the relevant `npm run build:*` command

If the change also affects query targets, schemas, or dependency mapping, continue in [../dependencies/README.md](../dependencies/README.md).

## What This Doc Does Not Cover

- onboarding and first-run instructions
- dashboard readiness or migration status
- query workflow details
- full change-propagation checklists

Those live in:

- [getting-started.md](getting-started.md)
- [dashboard-status.md](dashboard-status.md)
- [data-collection.md](data-collection.md)
- [../dependencies/README.md](../dependencies/README.md)
