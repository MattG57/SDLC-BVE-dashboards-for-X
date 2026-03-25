# Testing Strategy

## Overview

This dashboard has **three layers of testing** to ensure calculation accuracy and prevent regressions:

1. **Unit Tests** - Test individual functions in isolation
2. **Integration Tests** - Test complete data pipeline with synthetic data
3. **Verification Scripts** - Validate against real example data

## Test Layers

### 1. Unit Tests (`tests/core/`)

Test individual functions with various inputs and edge cases.

**Coverage:**
- `estimators.test.js` - All calculation methods
- `data-processor.test.js` - Data transformation logic
- `math.test.js` - Utility functions (if created)

**Example:**
```javascript
it('calculates hours with default rate', () => {
  expect(calculateInteractionBasedHours(100)).toBe(5); // 100/20
});
```

**Run:**
```bash
npm test tests/core
```

### 2. Integration Tests (`tests/integration/`)

Test the **complete pipeline** from raw API data to final calculations using synthetic data with **known, hand-calculated outputs**.

**Purpose:**
- Catch regressions in the full data flow
- Validate that changes don't break end-to-end calculations
- Test realistic API data shapes

**Synthetic Data:** `tests/fixtures/synthetic-pipeline-data.json`
- 3 days of data
- 10 active users per day
- Known interaction counts, LoC values
- Expected outputs documented inline

**What It Tests:**
- ✅ Enterprise report processing
- ✅ User report processing
- ✅ Enterprise/user reconciliation
- ✅ All three estimation methods (interactions, LoC, manual %)
- ✅ Aggregation logic
- ✅ Edge cases (zero users, missing data, IDE fallback)

**Example:**
```javascript
describe('Interactions-Based Pipeline', () => {
  it('produces known output from synthetic input', () => {
    // Given 200, 400, 600 interactions at 20/hr rate
    // Expect 10, 20, 30 hours = 60 total
    const result = pipeline(SYNTHETIC_INPUT);
    expect(result.totalHours).toBe(60);
  });
});
```

**Run:**
```bash
npm test tests/integration
```

### 3. Verification Scripts (`../../data/verify_math.cjs`)

Validate calculations against **real example data** from the API.

**Purpose:**
- Ensure calculations work with actual API responses
- Catch API schema changes
- Validate assumptions about data structure

**Run:**
```bash
cd ../../data
node verify_math.cjs
```

## Synthetic Test Data

### Why Synthetic Data?

Real API data is messy and unpredictable. Synthetic data lets us:

1. **Control inputs** - Exact values for predictable outputs
2. **Hand-calculate expected results** - We know what the answer should be
3. **Test edge cases** - Zero users, missing fields, etc.
4. **Catch regressions** - Any change that breaks expected outputs fails tests

### Synthetic Data Design

Located in `tests/fixtures/synthetic-pipeline-data.json`:

**Input Data:**
```json
{
  "enterprise_report": {
    "day_totals": [
      {
        "day": "2024-03-23",
        "daily_active_users": 10,
        "user_initiated_interaction_count": 200,  // ← Chosen for easy math
        "loc_added_sum": 1000                      // ← Round numbers
      },
      // ... 2 more days
    ]
  },
  "user_report": [ /* matching user-level data */ ]
}
```

**Expected Outputs (documented in fixture):**
```json
{
  "expected_outputs": {
    "interactions_based": {
      "total_hours": 60,                    // ← Known answer
      "avg_hours_per_dev_per_day": 2        // ← Hand-calculated
    }
  }
}
```

### How to Use

**When making changes:**

1. **Run integration tests first:**
   ```bash
   npm test tests/integration
   ```

2. **If tests fail:**
   - Did you intentionally change the calculation?
   - Update `EXPECTED_OUTPUTS` in the test
   - Document WHY the expected output changed

3. **If tests pass but verify_math.cjs fails:**
   - Your change works for synthetic data but not real data
   - Check for edge cases in real data (null values, missing fields)

## Adding New Tests

### For New Calculations

1. **Add unit test** in `tests/core/estimators.test.js`:
   ```javascript
   describe('My New Calculation', () => {
     it('handles basic case', () => {
       expect(myNewCalculation(10, 5)).toBe(50);
     });
   });
   ```

2. **Add to integration test** in `tests/integration/pipeline.test.js`:
   ```javascript
   describe('New Calculation Pipeline', () => {
     it('produces known output', () => {
       // Use SYNTHETIC_INPUT with known values
       const result = completeNewPipeline(SYNTHETIC_INPUT);
       expect(result).toBe(EXPECTED_VALUE); // Known answer
     });
   });
   ```

3. **Update synthetic data** if needed to test new scenarios

### For New Data Sources

1. **Add synthetic fixture** in `tests/fixtures/`:
   ```json
   {
     "new_data_source": { /* realistic structure */ },
     "expected_outputs": { /* known answers */ }
   }
   ```

2. **Create integration test** that uses the fixture

3. **Document expected outputs** inline with comments

## Test Coverage Goals

| Module | Target | Current |
|--------|--------|---------|
| `estimators.js` | 100% | ✅ 100% |
| `data-processor.js` | 100% | ✅ 100% |
| `utils/math.js` | 100% | ✅ 100% |
| **Overall** | **>90%** | **✅ ~100%** |

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test pipeline.test.js

# Run in watch mode
npm test -- --watch

# Run only integration tests
npm test tests/integration
```

## Troubleshooting

### Tests Pass but Dashboard Shows Wrong Values

**Cause:** Integration tests use synthetic data, dashboard uses real data

**Solution:**
1. Check `verify_math.cjs` output
2. Compare real data structure to synthetic data
3. Add edge case handling to data processor

### Expected Output Changed

**Cause:** Calculation logic was modified

**Action:**
1. Verify the change is intentional
2. Update `EXPECTED_OUTPUTS` in test
3. Document the change in git commit message
4. Update `verify_math.cjs` if needed

### Test Fails After Refactoring

**Cause:** Import paths or function signatures changed

**Solution:**
1. Update import statements
2. Check function parameters match
3. Run tests frequently during refactoring

## Best Practices

1. **Test First** - Write integration test before implementing features
2. **Known Outputs** - Always use hand-calculated expected values
3. **Document Assumptions** - Comment why expected outputs are what they are
4. **Keep Synthetic Data Simple** - Use round numbers for easy mental math
5. **Test Edge Cases** - Zero users, missing data, null values
6. **Run Tests Before Commit** - Ensure nothing broke

## Example: Adding a New Feature

**Scenario:** Add a new estimation method based on suggestion acceptance rate

**Step 1 - Create synthetic data:**
```javascript
const SYNTHETIC_INPUT = {
  enterprise_report: {
    day_totals: [{
      code_generation_activity_count: 100,  // Suggestions
      code_acceptance_activity_count: 80,   // Acceptances
      // Expected: 80% acceptance * some_factor = X hours
    }]
  }
};
```

**Step 2 - Write integration test:**
```javascript
it('calculates hours from acceptance rate', () => {
  const result = calculateAcceptanceBasedHours(
    SYNTHETIC_INPUT.enterprise_report.day_totals[0]
  );
  expect(result).toBe(8); // Hand-calculated expected value
});
```

**Step 3 - Implement the feature:**
```javascript
export function calculateAcceptanceBasedHours(dayTotal) {
  const rate = dayTotal.code_acceptance_activity_count / 
               dayTotal.code_generation_activity_count;
  return rate * 10; // 80% * 10 = 8
}
```

**Step 4 - Tests should pass!**

This workflow ensures the feature works correctly before it reaches users.
