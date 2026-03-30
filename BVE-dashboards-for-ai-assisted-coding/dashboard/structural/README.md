# AI Assisted Coding - Structural Dashboard

Measures GitHub Copilot adoption depth and usage structure from enterprise, organization, team, and repository summary data.

## Quick Start

### View Dashboard

```bash
# macOS: open index.html
# Linux: xdg-open index.html
# Windows: start index.html
```

### Run Tests

```bash
npm install --include=dev
npm test
```

## What This Dashboard Measures

The structural dashboard is focused on adoption patterns rather than time-saved estimation. It helps answer questions such as:

- how broadly Copilot is enabled and active across the organization
- how usage is distributed across teams and repositories
- where adoption depth is strong versus uneven
- whether summary-level metrics are internally consistent before they reach the UI

## Architecture

### Directory Structure

```text
structural/
├── index.html                  # Main dashboard (current build target)
├── src/
│   ├── core/
│   │   ├── calculators.js      # Adoption and structural calculations
│   │   └── data-processor.js   # Input normalization and transformations
│   ├── schemas/
│   │   ├── github-api-schema.js
│   │   └── processed-data-schema.js
│   └── utils/
│       └── math.js             # Shared numeric helpers
├── tests/
│   ├── core/                   # Calculation and processing tests
│   ├── schemas/                # Schema validation tests
│   └── fixtures/               # Sample input data
└── verify.js                   # Local verification helper
```

## Core Modules

### `calculators.js`

Pure calculation helpers for structural and adoption metrics.

### `data-processor.js`

Transforms raw GitHub Copilot summary data into the shapes expected by the dashboard.

### Schema Modules

The schema modules document and validate the expected raw and processed data contracts used by the dashboard tests.

## Data Expectations

This dashboard works with summary-style GitHub Copilot usage exports rather than per-interaction IDE telemetry. Use the canonical collection guide in [../../../docs/data-collection.md](../../../docs/data-collection.md) for the supported runner targets and output files.

## Testing

```bash
npm test
```

Coverage currently includes:

- calculation logic
- data processing
- schema validation
- error boundary behavior

## Status

For current readiness and migration status, use [../../../docs/dashboard-status.md](../../../docs/dashboard-status.md).

## Contributing

Use the canonical contributor workflow in [../../../docs/development.md](../../../docs/development.md).
