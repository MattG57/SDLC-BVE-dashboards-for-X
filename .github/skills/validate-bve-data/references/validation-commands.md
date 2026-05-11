# Validation Commands Reference

## Quick Reference

| Command | What It Does | When to Use |
|---|---|---|
| `npm test` | Run all tests across all workspaces | After any code change |
| `npm run lint` | Check code style | Before committing |
| `npm run format` | Check formatting | Before committing |
| `npm run validate` | Validate schemas | After schema changes |
| `npm run verify:all` | All of the above | Before PR submission |
| `npm run build` | Build all dashboards | Before deployment |

## Detailed Commands

### npm test

Runs Vitest across all workspaces:
```bash
npm test
```

Expected output:
```
✓ shared/tests/core/math.test.js (9 tests)
✓ shared/tests/core/format.test.js (6 tests)
✓ shared/tests/core/config.test.js (5 tests)
✓ shared/tests/sources/copilot-metrics.test.js (...)
✓ shared/tests/sources/pr-review.test.js (...)
✓ shared/tests/materializers/leverage-summary.test.js (...)
...
Tests passed: XX
```

### Single workspace
```bash
npm test --workspace=BVE-dashboards-for-ai-assisted-coding
npm test --workspace=BVE-dashboards-for-agentic-ai-coding
npm test --workspace=shared
```

### Single file
```bash
npx vitest run shared/tests/core/math.test.js
```

### With coverage
```bash
npx vitest run --coverage
```

Target: 80% coverage across all workspaces.

### Watch mode (development)
```bash
npx vitest watch
```

### npm run lint

Checks code style using the project's linter configuration:
```bash
npm run lint
```

### npm run format

Checks code formatting:
```bash
npm run format
```

### npm run validate

Runs schema validators:
```bash
npm run validate
```

### npm run verify:all

Runs all verification steps in sequence:
```bash
npm run verify:all
```

This is equivalent to running lint + format + test + validate.

### Data file validation

Validate a specific data file against its schema:
```bash
node scripts/validators/validate-data.js <file> <type>
```

Types:
- `ai-assisted` — for `copilot-user-and-enterprise-metrics.sh` output
- `pr-review` — for `human-pr-metrics.sh` output
- `agentic` — for `coding-agent-pr-metrics.sh` output

### npm run build

Builds all dashboards:
```bash
npm run build
```

This assembles the `_site/` directory with all dashboards and landing page.

## Test Configuration

Tests use Vitest with `happy-dom` environment. Each workspace has its own `vitest.config.js`.

Install dev dependencies before running tests:
```bash
npm install --include=dev
```
