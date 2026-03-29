# Schema Validation Framework

## Purpose

This directory contains the reusable validation utilities used to check dashboard input data.

## Key Files

- `schema-validator.js`
  Shared validation logic and per-dashboard validators
- `validate-data.js`
  CLI entry point for validating a JSON file against a validator type

## CLI Usage

```bash
node scripts/validators/validate-data.js <file> <type>
```

Supported validator types:

- `ai-assisted-efficiency`
- `agentic-ai`
- `structural-quality`

Examples:

```bash
node scripts/validators/validate-data.js data/octodemo-copilot-data.json ai-assisted-efficiency
node scripts/validators/validate-data.js data/agentic-data.json agentic-ai
node scripts/validators/validate-data.js data/pr-reviews.json structural-quality
```

## What To Reference Instead Of This File

Use the real schema and example files as the source of truth:

- AI-assisted schemas: `BVE-dashboards-for-ai-assisted-coding/data/schemas/`
- Agentic schemas: `BVE-dashboards-for-agentic-ai-coding/data/schemas/`
- Example files:
  - `BVE-dashboards-for-ai-assisted-coding/data/examples/`
  - `BVE-dashboards-for-agentic-ai-coding/data/examples/`

Use the dashboard tests for validation behavior:

- `BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/tests/`
- `BVE-dashboards-for-ai-assisted-coding/dashboard/structural/tests/`
- `BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/tests/`

## Notes

- `npm test` exercises the schema-related tests as part of the dashboard suites.
- `docs/data-collection.md` explains which outputs are expected for each dashboard.
- `dependencies/README.md` explains when schema or output-shape changes require cross-file updates.
