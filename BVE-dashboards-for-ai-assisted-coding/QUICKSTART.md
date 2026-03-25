# Quick Start Guide

## View the Dashboard

```bash
# Open efficiency dashboard in browser
open dashboard/efficiency/index.html
```

Upload your data JSON file via the browser interface.

## Run Tests

```bash
# Install dependencies
cd dashboard/efficiency
npm install

# Run all tests
npm test

# Run in watch mode (for development)
npm test -- --watch

# Generate coverage report
npm run test:coverage
```

## Collect Data

```bash
# Set credentials
export GITHUB_TOKEN="your_token_here"

# For Enterprise
ENTERPRISE="my-enterprise" DAYS=28 \
  ./data/queries/ai-assisted-coding.sh > my-data.json

# For Organization  
ORG="my-org" DAYS=28 \
  ./data/queries/ai-assisted-coding.sh > my-data.json
```

## Verify Calculations

```bash
# Run verification script with example data
cd data
node verify_math.cjs
```

## File Structure

```
BVE-dashboards-for-ai-assisted-coding/
├── dashboard/
│   └── efficiency/
│       ├── index.html           # 👈 Open this in browser
│       ├── src/                 # Modular, testable code
│       │   ├── core/            # Pure business logic
│       │   └── utils/           # Helper functions
│       └── tests/               # Unit tests
├── data/
│   ├── queries/                 # Data collection scripts
│   ├── examples/                # Sample data
│   └── schemas/                 # JSON schemas
└── docs/
    └── MIGRATION-STATUS.md      # Detailed migration notes
```

## What's Different?

### Before Migration
- ✅ Single HTML file (easy to deploy)
- ❌ 1,030 lines of mixed concerns
- ❌ No tests
- ❌ Hard to validate calculations

### After Migration
- ✅ Single HTML file (still easy to deploy) 
- ✅ Modular, tested business logic
- ✅ 50+ unit tests with 100% coverage
- ✅ Easy to verify and maintain

**Best of both worlds:** Deploy the HTML, develop with modules!

## Next Steps

1. **Try the dashboard** - `open dashboard/efficiency/index.html`
2. **Run the tests** - `cd dashboard/efficiency && npm test`
3. **Read the docs** - `dashboard/efficiency/README.md`
4. **Review migration** - `docs/MIGRATION-STATUS.md`
