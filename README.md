# SDLC BVE Dashboards for X

Business Value Engineering dashboards for measuring GitHub Copilot and SDLC impact across organizations.

## Overview

This repository contains browser-run dashboards plus the scripts and tests needed to collect, validate, and explain their inputs.

**Last reviewed:** 2026-03-29

- Self-contained dashboard HTML files
- Modular source and tests for migrated dashboards
- Shared build and validation scripts
- Query runners for AI-assisted and agentic metrics

## Dashboards

### AI-Assisted Coding

- Efficiency dashboard: estimates time and labor-cost savings from Copilot IDE usage
- Structural dashboard: analyzes adoption patterns, consistency, and output correlation

### Agentic AI Coding

- Efficiency dashboard: estimates human-equivalent value from Copilot Coding Agent pull requests

For current readiness and migration state, see [docs/dashboard-status.md](docs/dashboard-status.md).

## Quick Start

```bash
npm install --include=dev
./run-query.sh ai-assisted-efficiency
# macOS
open BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
# Linux
xdg-open BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
# Windows
start BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
```

Use `./run-query.sh --list` to see all data-collection targets.

## Which Dashboard Should I Use?

- Use AI-assisted efficiency when you want to estimate time savings and labor-cost impact from Copilot IDE usage.
- Use AI-assisted structural when you want to understand adoption spread, consistency, and output correlation across the organization.
- Use agentic efficiency when you want to estimate human-equivalent value from Copilot Coding Agent pull requests.

For a fuller decision guide and input expectations, see [docs/getting-started.md](docs/getting-started.md) and [docs/data-collection.md](docs/data-collection.md).

## Common Commands

```bash
npm test
npm run build
npm run validate
npm run verify:all
```

## Documentation Map

- [docs/getting-started.md](docs/getting-started.md): first successful run
- [docs/data-collection.md](docs/data-collection.md): canonical query workflow
- [docs/dashboard-status.md](docs/dashboard-status.md): readiness and migration state
- [docs/development.md](docs/development.md): contributor workflow
- [docs/BUILD-SYSTEM.md](docs/BUILD-SYSTEM.md): build internals
- [dependencies/README.md](dependencies/README.md): dependency map and change-propagation checklists
- [CONTRIBUTING.md](CONTRIBUTING.md): contributor entry point

## Package Docs

- [BVE-dashboards-for-ai-assisted-coding/README.md](BVE-dashboards-for-ai-assisted-coding/README.md)
- [BVE-dashboards-for-agentic-ai-coding/README.md](BVE-dashboards-for-agentic-ai-coding/README.md)

## License

This repository does not currently declare a license file.

## Support

Open an issue or coordinate with the repository maintainers for usage questions and data assumptions.
