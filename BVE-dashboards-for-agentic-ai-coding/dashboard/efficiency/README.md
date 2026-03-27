# Agentic AI Coding - Efficiency Dashboard

Estimates human-equivalent time saved by **GitHub Copilot Coding Agent** - the autonomous agent that creates pull requests.

## Quick Start

### View Dashboard

```bash
open index.html
```

### Run Tests

```bash
npm install --include=dev
npm test
```

## Architecture

### Directory Structure

```
efficiency/
├── index.html              # Main dashboard (monolithic version)
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

### 1. Duration-Based (Default)

**Formula:** `(merged_session_minutes / 60) × human_to_agent_ratio`

**Default Ratio:** 10× human-to-agent (agent works 10× faster)

**Only Counts:** MERGED PRs (unsuccessful PRs don't save time)

**Rationale:** The agent completes in minutes what would take a human hours. We measure actual agent time and multiply by the productivity multiplier.

**Example:**
- Agent session: 60 minutes (merged PR)
- × 10 human-equivalent ratio
- = 10 hours saved

### 2. LoC-Based (Merged)

**Formula:** `(merged_loc_added / 1000) × hours_per_kloc`

**Default Rate:** 4 hours per 1,000 lines

**Higher than AI Assisted (2 hrs/kloc)** because agent generates more complete, complex code

**Example:**
- 2,000 merged LoC
- / 1,000 × 4
- = 8 hours saved

## Core Modules

### `estimators.js`

Pure functions for calculating time and cost savings:

```javascript
import { 
  calculateDurationBasedHours,
  calculateLocBasedHours,
  calculateLaborCostSaved,
  aggregateEstimates
} from './src/core/estimators.js';

// Calculate from agent session duration
const hours = calculateDurationBasedHours(120, 10);  // 120 min × 10x = 20 hours

// Calculate from merged LoC
const hours = calculateLocBasedHours(2000, 4);  // 2000 LoC / 1000 × 4 = 8 hours

// Calculate cost
const cost = calculateLaborCostSaved(20, 150);  // $3,000
```

### `data-processor.js`

Transforms repository-level data into day-level aggregates:

```javascript
import {
  aggregateToDayLevel,
  processMergedPRsByDate,
  calculateTurbulenceByDate,
  fillDayGaps
} from './src/core/data-processor.js';

// Aggregate to daily metrics
const days = aggregateToDayLevel(devDays, prSessions, requests);

// Get merged PR metrics
const mergedMetrics = processMergedPRsByDate(prSessions);

// Calculate turbulence
const turbulence = calculateTurbulenceByDate(prSessions, requests);
```

## Key Differences from AI Assisted Coding

| Aspect | AI Assisted | Agentic |
|--------|-------------|---------|
| **What's Measured** | IDE interactions | Autonomous agent sessions |
| **Counting Method** | All activity | Only MERGED PRs |
| **Time Calculation** | Interactions / rate | Duration × multiplier |
| **LoC Rate** | 2 hrs/kloc | 4 hrs/kloc |
| **Key Metric** | Interactions | Merged PRs |
| **Quality Signal** | Acceptance rate | Merge rate, turbulence |

## Turbulence Metrics

**Turbulence** measures friction and quality issues in agent sessions:

### Signals Counted (per PR)
1. **Repeat Assignments** - Same issue assigned multiple times (rework)
2. **Closed Without Merge** - PR abandoned (wasted effort)
3. **Zero Duration** - Failed/aborted sessions
4. **Zero Changes** - PR with no code (confusion)
5. **Review Friction** - Changes requested, reopens, guidance needed
6. **Extra Invocations** - Follow-up requests (agent needed help)

### Interpretation

**Low Turbulence (<3 per PR):**
- ✅ Agent understands requirements
- ✅ Code quality is good
- ✅ Minimal rework needed

**High Turbulence (>5 per PR):**
- ⚠️ Requirements unclear
- ⚠️ Code quality issues
- ⚠️ Frequent rework/guidance needed

## Data Format

### Input: Agentic AI Coding JSON

```json
{
  "developer_day_summary": [
    {
      "date": "2024-03-25",
      "developer_login": "user1",
      "total_agent_requests": 5,
      "sessions_started": 3,
      "agent_prs_created": 2,
      "agent_prs_merged": 1,
      "agent_session_minutes": 120
    }
  ],
  "pr_sessions": [
    {
      "pr_number": 123,
      "pr_created_at": "2024-03-25T10:00:00Z",
      "pr_merged_at": "2024-03-25T14:00:00Z",
      "duration_type": "agent",
      "duration_minutes": 60,
      "additions": 500,
      "deletions": 50
    }
  ],
  "requests": [
    {
      "requested_at": "2024-03-25T09:00:00Z",
      "issue_number": 456,
      "pr_number": 123
    }
  ]
}
```

### Configuration (Optional)

```json
{
  "est_human_to_agent_ratio": 10,
  "est_hrs_per_kloc": 4,
  "cfg_labor_cost_per_hour": 150
}
```

## Testing

### Run Tests

```bash
npm test
```

### Test Coverage

```
tests/
├── core/
│   ├── estimators.test.js        # Duration, LoC, merge rate
│   └── data-processor.test.js    # Aggregation, turbulence
└── fixtures/
    └── synthetic-data.json        # Test data with known outputs
```

**Coverage:** ~40+ tests validating:
- Both estimation methods
- Merged PR processing
- Turbulence calculation (all 6 signals)
- Data aggregation logic
- Edge cases (zero activity, missing data)

## Verification

Run verification against example data:

```bash
cd ../../data
# (Verification script to be created)
```

## Quality Metrics

### Merge Rate
- **>70%** - Excellent (most agent PRs are useful)
- **50-70%** - Good (some iteration needed)
- **<50%** - Concerning (high rejection rate)

### Turbulence per PR
- **<3** - Excellent (smooth process)
- **3-5** - Good (some friction)
- **>5** - Concerning (significant rework)

### Session Duration
- **Consistent** - Agent is predictable
- **High variance** - Complexity varies or agent struggling

## Future Enhancements

- [ ] Extract React components
- [ ] Build script integration
- [ ] Integration tests with synthetic data
- [ ] Verification script
- [ ] Quality trend analysis
- [ ] Anomaly detection for turbulence spikes

## Contributing

When adding features:
1. **Start with tests** - Write tests first
2. **Keep functions pure** - No side effects
3. **Update documentation** - JSDoc + README
4. **Validate calculations** - Run verification

## Known Differences

This dashboard focuses on **autonomous agent productivity**, not developer IDE usage:
- Counts only merged PRs (not all activity)
- Measures agent session time (not human interactions)
- Tracks turbulence/friction (agent-specific quality signal)
- Uses higher LoC rate (4 vs 2) due to code complexity
