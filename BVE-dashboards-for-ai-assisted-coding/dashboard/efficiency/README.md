# AI Assisted Coding - Efficiency Dashboard

Estimates time and cost savings from GitHub Copilot IDE features (code completion, chat, inline suggestions).

## Quick Start

### View Dashboard

```bash
open index.html
```

### Run Tests

```bash
npm install
npm test
```

### Verify Calculations

```bash
npm run verify
```

## Architecture

### Directory Structure

```
efficiency/
├── index.html              # Main dashboard (original monolithic version)
├── src/                    # Modular source (for testing/development)
│   ├── core/               # Pure business logic
│   │   ├── estimators.js   # Time savings calculations
│   │   └── data-processor.js  # Data transformation
│   ├── components/         # React components (future)
│   ├── config/             # Configuration & constants
│   └── utils/              # Helper functions
│       └── math.js         # Safe math operations
├── tests/                  # Vitest tests
│   ├── core/               # Core logic tests
│   └── fixtures/           # Test data
└── dist/                   # Built artifacts (future)
```

## Estimation Methods

### 1. Interactions-Based (Default)

**Formula:** `interactions / interactions_per_hour`

**Default Rate:** 20 interactions per hour saved

**Rationale:** Each developer interaction (code suggestion, chat query, etc.) represents a fraction of time that would have been spent on manual coding, searching documentation, or debugging.

**Example:**
- 1,000 interactions / 20 = 50 hours saved

### 2. LoC-Based

**Formula:** `(loc_added / 1000) × hours_per_kloc`

**Default Rate:** 2 hours per 1,000 lines of code

**Rationale:** Industry estimates for manual coding productivity, adjusted for Copilot-assisted scenarios.

**Example:**
- 5,000 LoC / 1,000 × 2 = 10 hours saved

### 3. Manual Daily Percentage

**Formula:** `(pct × baseline_hours / workdays) × active_users`

**Default:** 20% of 30 hours/week / 5 days = 1.2 hours per developer per day

**Rationale:** Conservative percentage-based estimate of time saved, scaled by organization size.

**Example:**
- 20% × 30 hrs/week / 5 days × 50 devs = 60 hours saved per day

## Core Modules

### `estimators.js`

Pure functions for calculating time and cost savings:

```javascript
import { 
  calculateInteractionBasedHours,
  calculateLocBasedHours,
  calculateManualDailyPercentHours,
  calculateLaborCostSaved,
  aggregateEstimates
} from './src/core/estimators.js';

// Calculate daily hours saved
const hours = calculateInteractionBasedHours(1000, 20);  // 50 hours

// Calculate cost
const cost = calculateLaborCostSaved(50, 150);  // $7,500
```

**All functions are:**
- ✅ Pure (no side effects)
- ✅ Fully tested
- ✅ Type-safe (via JSDoc)
- ✅ Documented with examples

### `data-processor.js`

Transforms raw API responses into normalized structures:

```javascript
import {
  processEnterpriseReport,
  processUserReport,
  aggregateUserRecordsByDay,
  filterByDateRange
} from './src/core/data-processor.js';

// Normalize enterprise data
const dailyMetrics = processEnterpriseReport(rawData.enterprise_report);

// Normalize user data
const userMetrics = processUserReport(rawData.user_report);

// Aggregate by day
const aggregated = aggregateUserRecordsByDay(userMetrics);
```

### `utils/math.js`

Safe mathematical operations:

```javascript
import { safeDiv, safeSum, safeAvg, round } from './src/utils/math.js';

// Safe division (returns null for divide-by-zero)
const avg = safeDiv(100, 0);  // null

// Safe sum (treats null/undefined as 0)
const total = safeSum([10, null, 20, undefined]);  // 30
```

## Testing

### Run All Tests

```bash
npm test
```

### Run with Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm test -- --watch
```

### Test Structure

```
tests/
├── core/
│   ├── estimators.test.js        # 100% coverage of calculation logic
│   └── data-processor.test.js    # Data transformation tests
└── fixtures/
    └── sample-data.json           # Minimal test data
```

### Example Test

```javascript
import { calculateInteractionBasedHours } from '../../src/core/estimators.js';

describe('Interaction-based estimation', () => {
  it('calculates hours with default rate', () => {
    expect(calculateInteractionBasedHours(100)).toBe(5);
  });
  
  it('throws error for invalid rate', () => {
    expect(() => calculateInteractionBasedHours(100, 0)).toThrow();
  });
});
```

## Verification

The `verify_math.cjs` script runs example data through all estimation methods:

```bash
cd ../../data
node verify_math.cjs
```

**Output includes:**
- Raw data per day
- Calculated hours per method
- Per-developer averages
- Total hours saved
- Method comparison

## Data Format

### Input: Copilot Metrics JSON

```json
{
  "enterprise_report": {
    "day_totals": [
      {
        "day": "2024-03-25",
        "daily_active_users": 50,
        "user_initiated_interaction_count": 1000,
        "loc_added_sum": 1500
      }
    ]
  },
  "user_report": [
    {
      "day": "2024-03-25",
      "user_login": "developer1",
      "user_initiated_interaction_count": 45,
      "loc_added_sum": 80
    }
  ]
}
```

### Configuration (Optional)

```json
{
  "est_interactions_per_hour": 20,
  "est_hrs_per_kloc": 2,
  "cfg_labor_cost_per_hour": 150,
  "cfg_baseline_hrs_per_dev_per_week": 30,
  "cfg_workdays_per_week": 5
}
```

## Future Enhancements

- [ ] Extract React components to separate files
- [ ] Build script to bundle into single HTML
- [ ] Component-level testing
- [ ] Storybook for component development
- [ ] Visual regression testing
- [ ] TypeScript migration
- [ ] Build-time schema validation

## Contributing

When adding new features:

1. **Start with tests** - Write tests for new calculation logic first
2. **Keep functions pure** - No side effects in core modules
3. **Update documentation** - JSDoc comments for all public functions
4. **Run verification** - Ensure calculations match expected results

## Known Issues

See `../../data/verify_math.cjs` for notes on the manual daily % calculation bug (divides by DAU twice, making per-dev estimates too small).
