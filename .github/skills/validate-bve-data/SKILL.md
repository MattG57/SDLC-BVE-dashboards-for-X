---
name: validate-bve-data
description: >-
  Validate BVE data quality, run tests, check schemas, and verify calculations. Covers all validation
  commands (npm test, npm run validate, npm run verify:all, npm run lint), schema validation,
  reconciliation checks, dedup profile inspection, and the 80% coverage target.
  Use when the user says "validate data", "check schema", "verify calculations", "run tests", "lint",
  "data quality", "run validation", "check coverage", or "verify data".
  Do not use for running the pipeline (use run-bve-pipeline) or troubleshooting errors
  (use troubleshoot-bve-pipeline).
---

# Validate BVE Data

## Validation Commands

### Run all tests
```bash
npm test
```
Runs Vitest across all workspaces. Tests use `happy-dom` environment.

### Run tests for a single workspace
```bash
npm test --workspace=BVE-dashboards-for-ai-assisted-coding
```

### Run a single test file
```bash
npx vitest run path/to/file.test.js
```

### Lint
```bash
npm run lint
```

### Format check
```bash
npm run format
```

### Schema validation
```bash
npm run validate
```

### Full verification (lint + format + test + validate)
```bash
npm run verify:all
```

### Build all dashboards
```bash
npm run build
```

### Data file validation
```bash
node scripts/validators/validate-data.js <file> <type>
```

## Coverage Target

The repository targets **80% test coverage**. Check coverage with:
```bash
npx vitest run --coverage
```

## What Gets Tested

### Shared module tests (`shared/tests/`)

| Test Area | What It Validates |
|---|---|
| `core/math.test.js` | `safeDiv`, `safeSum`, `mean`, `stddev`, `linearRegression`, `smooth7`, `dayOffset`, `round` |
| `core/format.test.js` | All formatters return `'—'` for null, correct formatting for valid values |
| `core/config.test.js` | `CONFIG_REGISTRY` structure, `getDefaults()`, `mergeConfig()`, `isConfigObject()` |
| `sources/copilot-metrics.test.js` | `flattenDayTotal`, `flattenUserReport`, `dedupEnterpriseDays`, `computeDayRatios` |
| `sources/agentic.test.js` | `flattenPrSession`, `flattenDevDay`, `dedupSessions`, `aggregateToDay` |
| `sources/pr-review.test.js` | `isBot`, `flattenPrRecord`, `dedupAndFilterPrs`, `classifyAssisted`, `buildCopilotUsersByDay` |
| `materializers/leverage-summary.test.js` | Full materializer: estimates, projections, config merge, null-safety |

### Dashboard workspace tests

Each dashboard workspace has tests under `tests/core/`:
- `schema-validation.test.js` — validates data schemas
- `data-processor.test.js` — tests data loading and transformation
- `error-boundaries.test.js` — tests error handling for malformed input

## Reconciliation Checks

The leverage-summary materializer includes reconciliation thresholds:

| Level | Condition | Action |
|---|---|---|
| **Match** | Values agree within rounding | No action needed |
| **Minor** | Small discrepancy (< 5%) | Logged as info |
| **Material** | Significant discrepancy (≥ 5%) | Logged as warning, investigate |

## Dedup Profile Inspection

Every data source produces a dedup profile showing data quality:

### PR data dedup profile
```json
{
  "before_dedup": 500,
  "after_dedup": 480,
  "duplicates_removed": 20,
  "dedup_key": "repository#number",
  "bots_removed": 15,
  "after_filter": 465,
  "bot_patterns": ["\[bot\]$", "-bot$", ...]
}
```

### Copilot metrics dedup profile
Enterprise and user day records are deduplicated by day key. Check for:
- High duplicate counts (indicates overlapping API responses)
- Zero records after dedup (indicates no data in the window)

## Data Quality Checklist

When validating data quality, check these common issues:

1. **Empty datasets**: Run `--dry-run` to verify config targets the right org/enterprise
2. **Wrong developer count**: Verify `cfg_total_developers` matches actual org size
3. **Missing PR data**: Check that the PAT has `repo` scope
4. **Missing Copilot data**: Check that the PAT has `copilot` scope
5. **Stale data**: Check `computed_at` timestamps in materialized artifacts
6. **Config drift**: Compare `config_used` in artifact profile against `dashboard-config.json`
7. **Schema mismatches**: Run `node scripts/validators/validate-data.js <file> <type>`

## Math Safety: safeDiv

All calculations use `safeDiv(numerator, denominator)` which returns `null` when `denominator <= 0`. This means:
- Ratios with zero denominators produce `null` (displayed as `'—'` in dashboards)
- No `NaN` or `Infinity` values should appear
- If you see `NaN` in output, there's a bug — it should be `null`

## Format Safety

All formatters in `shared/core/format.js` are null-safe:
- `null` input → returns `'—'`
- Valid input → returns formatted string
- This prevents "undefined" or "NaN" from appearing in dashboard UI

## References

- [Complete validation commands reference](references/validation-commands.md)
