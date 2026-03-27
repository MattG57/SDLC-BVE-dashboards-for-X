# Schema Validation Framework

## Overview

This directory contains schema validation tools and utilities for ensuring data quality across all BVE dashboards. The framework provides both runtime validation for data files and comprehensive test coverage for detecting schema issues.

## Architecture

### Components

1. **Schema Validator (`schema-validator.js`)**
   - Reusable validation classes for each dashboard type
   - Base `SchemaValidator` class with common validation methods
   - Specialized validators for each data schema:
     - `AIAssistedEfficiencyValidator` - AI-assisted coding efficiency data
     - `AgenticAIValidator` - Agentic AI coding data  
     - `StructuralQualityValidator` - PR review/structural quality data

2. **CLI Tool (`validate-data.js`)**
   - Command-line interface for validating data files
   - Usage: `node validate-data.js <file> <type>`
   - Returns exit code 0 on success, 1 on failure

3. **Test Files**
   - Comprehensive schema validation tests for each dashboard
   - Located in each dashboard's `tests/core/schema-validation.test.js`
   - 61 total schema validation tests across all dashboards

## Validation Capabilities

### Data Integrity Checks

- **Type Validation**: Ensures fields have correct data types (string, number, array, object)
- **Required Fields**: Validates presence of mandatory fields
- **Format Validation**: 
  - Date formats (YYYY-MM-DD, ISO8601)
  - Non-empty strings
  - Positive integers
  - Non-negative numbers
- **Range Validation**: Numeric values within expected bounds
- **Enum Validation**: Values match allowed options

### Quality Checks

- **NaN Detection**: Recursively checks for NaN values in all numeric fields
- **Infinity Detection**: Ensures all numbers are finite
- **Empty Value Detection**: Catches empty strings, zero-length arrays
- **Logical Constraints**: 
  - Acceptances ≤ generations
  - Merged PRs ≤ created PRs
  - Chronological date ordering
  - No future dates

### Cross-Field Validation

- Date consistency across related datasets
- Activity count rollups (user totals vs enterprise totals)
- PR count consistency across data sources
- Review comment counts match PR records

## Usage

### Command Line

```bash
# Validate AI-assisted coding efficiency data
node scripts/validators/validate-data.js data/octodemo-copilot-data.json ai-assisted-efficiency

# Validate agentic AI coding data
node scripts/validators/validate-data.js data/agentic-data.json agentic-ai

# Validate structural quality data
node scripts/validators/validate-data.js data/pr-reviews.json structural-quality
```

### Programmatic Use

```javascript
import { validate, validateOrThrow } from './schema-validator.js';

// Validate and get results
const results = validate(data, 'ai-assisted-efficiency');
if (!results.valid) {
  console.error('Validation errors:', results.errors);
}

// Validate and throw on error
try {
  validateOrThrow(data, 'ai-assisted-efficiency');
  // Data is valid
} catch (error) {
  console.error('Invalid data:', error.message);
}
```

### In Tests

Schema validation tests are automatically run as part of the test suite:

```bash
npm test
```

To run specific schema tests:

```bash
npx vitest run <path-to-dashboard>/tests/core/schema-validation.test.js
```

## Test Fixtures

Each dashboard maintains test fixtures with known-good example data:

- **AI-Assisted Coding (Efficiency)**: `BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/tests/fixtures/sample-data.json`
- **Agentic AI Coding**: `BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/tests/fixtures/sample-data.json`
- **Structural Quality**: `BVE-dashboards-for-ai-assisted-coding/dashboard/structural/tests/fixtures/sample-data.json`

These fixtures serve multiple purposes:
1. **Test Data**: Known-good examples for schema validation tests
2. **Documentation**: Reference examples showing expected data structure
3. **Development**: Sample data for dashboard development and testing

## Schema Definitions

### AI-Assisted Coding Efficiency Schema

```json
{
  "enterprise_report": {
    "day_totals": [
      {
        "day": "YYYY-MM-DD",
        "daily_active_users": number,
        "user_initiated_interaction_count": number,
        "code_generation_activity_count": number,
        "code_acceptance_activity_count": number,
        "loc_added_sum": number (optional),
        "loc_deleted_sum": number (optional),
        "pull_requests": {
          "total_created": number,
          "total_reviewed": number
        } (optional),
        "totals_by_feature": [ ... ] (optional)
      }
    ]
  },
  "user_report": [
    {
      "day": "YYYY-MM-DD",
      "user_login": string,
      "daily_active_users": 0 | 1,
      "user_initiated_interaction_count": number,
      "code_generation_activity_count": number,
      "code_acceptance_activity_count": number,
      "loc_added_sum": number (optional)
    }
  ]
}
```

### Agentic AI Coding Schema

```json
{
  "developer_day_summary": [
    {
      "date": "YYYY-MM-DD",
      "developer_login": string,
      "total_agent_requests": number,
      "issue_assignment_requests": number,
      "pr_followup_requests": number,
      "sessions_started": number,
      "agent_prs_created": number,
      "agent_prs_merged": number,
      "agent_loc_added": number (optional),
      "agent_loc_deleted": number (optional),
      "agent_session_minutes": number (optional),
      "changes_requested_total": number (optional)
    }
  ],
  "pr_sessions": [
    {
      "repo": string,
      "pr_number": integer > 0,
      "pr_created_at": "ISO8601 timestamp",
      "pr_merged_at": "ISO8601 timestamp" (optional),
      "pr_state": "open" | "closed" | "merged",
      "pr_author_login": string,
      "additions": number,
      "deletions": number,
      "duration_type": string,
      "duration_minutes": number (optional),
      "changes_requested_count": number (optional),
      "reopened_count": number (optional),
      "additional_guidance_count": number (optional),
      "copilot_invocation_count": number (optional),
      "origin_request_type": string (optional),
      "origin_requested_by": string (optional)
    }
  ]
}
```

### Structural Quality Schema

```json
{
  "organization": string,
  "date_range": {
    "start": "ISO8601 timestamp",
    "end": "ISO8601 timestamp"
  },
  "pull_requests": [
    {
      "number": integer > 0,
      "title": string (non-empty),
      "html_url": string,
      "state": "open" | "closed",
      "created_at": "ISO8601 timestamp",
      "updated_at": "ISO8601 timestamp",
      "merged_at": "ISO8601 timestamp" | null,
      "user": {
        "login": string,
        "id": number,
        "type": string
      },
      "additions": number (optional),
      "deletions": number (optional),
      "changed_files": number (optional),
      "copilot_generated": boolean,
      "review_comments": [
        {
          "id": number,
          "body": string,
          "created_at": "ISO8601 timestamp",
          "user": {
            "login": string,
            "id": number,
            "type": string
          }
        }
      ]
    }
  ],
  "metadata": {
    "total_prs": number,
    "copilot_generated_count": number,
    "total_review_comments": number
  } (optional)
}
```

## False Positive/Negative Prevention

The schema validation framework addresses common test quality issues:

### False Positive Prevention

1. **Strict Type Checking**: Prevents accepting wrong types that might "work" in JavaScript
2. **Logical Constraint Validation**: Catches impossible scenarios (e.g., more acceptances than generations)
3. **Cross-Field Consistency**: Ensures related fields are coherent
4. **Format Validation**: Rejects malformed dates, negative counts, etc.

### False Negative Prevention

1. **Recursive NaN/Infinity Checks**: Finds data quality issues anywhere in the structure
2. **Optional Field Handling**: Tests don't fail when optional fields are missing
3. **Flexible Ranges**: Allows reasonable variance in aggregate totals
4. **Array Traversal**: Validates all elements, not just samples

## Integration with Dashboards

Each dashboard can optionally integrate runtime validation:

```javascript
// In data loading code
import { validateOrThrow } from '../../scripts/validators/schema-validator.js';

async function loadData(file) {
  const response = await fetch(file);
  const data = await response.json();
  
  // Validate data before processing
  validateOrThrow(data, 'ai-assisted-efficiency');
  
  return data;
}
```

This provides early detection of data issues before they cause rendering problems.

## Adding New Validators

To add validation for a new dashboard type:

1. **Create Validator Class** in `schema-validator.js`:
   ```javascript
   class MyDashboardValidator extends SchemaValidator {
     constructor() {
       super('MyDashboard');
     }
     
     validate(data) {
       this.errors = [];
       this.warnings = [];
       
       // Add validation logic
       this.validateRequired(data, ['required_field']);
       // ...
       
       return this.getResults();
     }
   }
   ```

2. **Register Validator** in `getValidator()` function
3. **Create Test File** at `<dashboard>/tests/core/schema-validation.test.js`
4. **Create Test Fixture** at `<dashboard>/tests/fixtures/sample-data.json`
5. **Update Documentation** in this README

## Performance Considerations

- Schema validation adds minimal overhead (~1-5ms per file)
- Validation is optional - can be disabled in production if needed
- Tests run in parallel for faster CI/CD
- Fixture files are small (<10KB each) for fast loading

## Maintenance

### Updating Schemas

When data structures change:

1. Update the appropriate validator class
2. Update or add test cases
3. Update fixture files to match new schema
4. Update schema documentation in this README
5. Run tests to ensure backward compatibility if needed

### Test Coverage Goals

- 100% of required fields validated
- All optional fields have type checks when present
- Logical constraints between related fields
- Edge cases (empty arrays, null values, boundary conditions)
- Data consistency across related datasets

## Current Status

- ✅ 61 schema validation tests across 3 dashboards
- ✅ 100% test pass rate
- ✅ All three dashboard types fully validated
- ✅ CLI tool for manual validation
- ✅ Comprehensive error reporting
- ✅ Test fixtures for all schemas

## Future Enhancements

1. **JSON Schema**: Consider migrating to JSON Schema for standardization
2. **Auto-generation**: Generate validators from schema definitions
3. **Performance Profiling**: Add metrics for validation performance
4. **Browser Integration**: Runtime validation in dashboard pages
5. **Schema Versioning**: Support multiple schema versions
6. **Custom Validators**: Plugin system for domain-specific rules
