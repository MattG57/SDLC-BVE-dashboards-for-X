# Tests

This directory contains the automated tests for the AI-assisted efficiency dashboard.

## What Lives Here

- `core/`
  Unit tests for estimators, data processing, and related logic
- `integration/`
  End-to-end pipeline tests using synthetic inputs
- `fixtures/`
  Sample and synthetic inputs used by the tests
- `schemas/`
  Schema-validation tests

## How To Run

```bash
npm test
npm run test:coverage
```

Targeted runs:

```bash
npx vitest run tests/core
npx vitest run tests/integration
npx vitest run tests/schemas
```

## Intent

The suite is designed to catch:

- calculation regressions
- data-shape handling bugs
- schema validation problems
- end-to-end pipeline breakage

## Related Docs

- integration snapshot: [../docs/INTEGRATION-TESTING.md](../docs/INTEGRATION-TESTING.md)
- contributor workflow: [../../../../docs/development.md](../../../../docs/development.md)
