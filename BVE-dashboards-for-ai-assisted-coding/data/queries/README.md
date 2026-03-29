# AI-Assisted Query Scripts

This directory contains the query scripts used by the AI-assisted dashboards.

## Scripts

- `copilot-user-and-enterprise-metrics.sh`
  Feeds `ai-assisted-efficiency` and `ai-assisted-structural`
- `human-pr-metrics.sh`
  Feeds `pr-review-structural`

## Canonical Docs

- Runtime usage: [../../../docs/data-collection.md](../../../docs/data-collection.md)
- Dependency mapping and change procedures: [../../../dependencies/README.md](../../../dependencies/README.md)

## Local Notes

- Scripts write JSON to stdout and progress to stderr.
- The structural dashboard requires outputs from both scripts in this directory.
- Use the top-level `run-query.sh` unless you have a reason to execute scripts directly.
