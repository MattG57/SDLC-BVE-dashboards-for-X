# Agentic Query Scripts

This directory contains the query script used by the agentic efficiency dashboard.

## Script

- `coding-agent-pr-metrics.sh`
  Feeds `agentic-efficiency`

## Canonical Docs

- Runtime usage: [../../../docs/data-collection.md](../../../docs/data-collection.md)
- Dependency mapping and change procedures: [../../../dependencies/README.md](../../../dependencies/README.md)

## Local Notes

- The script writes JSON to stdout and progress to stderr.
- Expected top-level output keys are `pr_sessions`, `requests`, and `developer_day_summary`.
- Use the top-level `run-query.sh` unless you have a reason to execute the script directly.
