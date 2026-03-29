# Repository Overview

This file now serves as a lightweight orientation note.

## Use These Docs First

- [README.md](README.md)
- [docs/getting-started.md](docs/getting-started.md)
- [docs/data-collection.md](docs/data-collection.md)
- [docs/dashboard-status.md](docs/dashboard-status.md)
- [docs/development.md](docs/development.md)
- [docs/BUILD-SYSTEM.md](docs/BUILD-SYSTEM.md)
- [dependencies/README.md](dependencies/README.md)

## Repo Shape

```text
scripts/                         Shared build and validation scripts
build-config/                    Shared dashboard build configuration
docs/                            Canonical user and contributor docs
dependencies/                    Dependency mapping and change checklists
BVE-dashboards-for-ai-assisted-coding/
BVE-dashboards-for-agentic-ai-coding/
run-query.sh                     Data collection runner
query-settings.json              Saved runner profiles
```

## Why This File Is Short

The repository previously repeated setup, status, and workflow details across several entry points. Those details now live in the canonical docs above so they can stay consistent.
