# BVE Dashboards for AI Assisted Coding

Comprehensive business value engineering (BVE) dashboards for measuring GitHub Copilot impact across an organization.

## Overview

This package contains two complementary dashboards:

1. **Efficiency Dashboard** (`dashboard/efficiency/`) - Estimates time and cost savings from Copilot IDE features
2. **Structural Dashboard** (`dashboard/structural/`) - Assesses organizational adoption patterns and correlations

## Quick Start

### View Dashboards

Open the HTML files directly in your browser:

```bash
# Efficiency Dashboard
open dashboard/efficiency/index.html

# Structural Dashboard (when migrated)
open dashboard/structural/index.html
```

### Collect Data

```bash
# Set your GitHub credentials
export GITHUB_TOKEN="your_token_here"

# For Enterprise
ENTERPRISE="my-enterprise" DAYS=28 ./data/queries/ai-assisted-coding.sh > my-data.json

# For Organization
ORG="my-org" DAYS=28 ./data/queries/ai-assisted-coding.sh > my-data.json
```

Then upload `my-data.json` to the dashboard via the browser interface.

## Structure

```
BVE-dashboards-for-ai-assisted-coding/
├── dashboard/
│   ├── efficiency/          # Time/cost savings dashboard
│   │   └── index.html       # Self-contained HTML (React + Highcharts)
│   └── structural/          # Adoption & correlation dashboard
│       └── index.html       # (To be migrated)
├── data/
│   ├── queries/             # Data collection scripts
│   │   └── ai-assisted-coding.sh
│   ├── schemas/             # JSON schema definitions
│   │   ├── df-ai-assisted-coding-schema.json
│   │   ├── df-enterprise-day-ai-schema.json
│   │   └── df-user-day-ai-schema.json
│   ├── examples/            # Sample data for testing
│   │   ├── ai-assisted-coding-example.json
│   │   └── sample-config.json
│   └── verify_math.cjs      # Calculation verification script
├── docs/                    # Documentation
└── README.md
```

## Efficiency Dashboard

### Purpose

Translate Copilot telemetry into **hours saved** and **labor cost avoided** using three estimation methods:

1. **Interactions-Based**: `interactions / est_interactions_per_hour` (default: 20)
2. **LoC-Based**: `(loc_added / 1000) × est_hrs_per_kloc` (default: 2)
3. **Manual Daily %**: Configured % of baseline developer hours

### Key Metrics

**Impact Section:**
- Total hours saved across the organization
- Average org hours saved per day
- Average hours saved per developer per day
- Total labor cost saved

**Drivers Section:**
- Active developers per day
- Total interactions, suggestions, acceptances
- Lines of code added via Copilot
- Feature usage breakdown (completion, chat, agent mode, CLI)

**Confidence Section:**
- Estimation method comparison
- Data coverage metrics
- Enterprise vs user report reconciliation

### Data Sources

- **Copilot Metrics JSON** (required): Output from `ai-assisted-coding.sh`
- **Config JSON** (optional): Custom estimation constants

## Structural Dashboard

### Purpose

Assess whether the **structural conditions** for AI-assisted coding exist:
- Is adoption spreading across the organization?
- Is usage consistent or volatile?
- Does higher adoption correlate with more output?

*(Full documentation pending migration)*

## Data Collection

### Prerequisites

- `gh` CLI authenticated (`gh auth login`)
- Appropriate GitHub permissions:
  - `copilot` scope
  - `read:org` or `read:enterprise`

### Query Script

```bash
./data/queries/ai-assisted-coding.sh
```

**Environment Variables:**
- `ENTERPRISE` or `ORG` (required): Target organization
- `DAYS` (optional): Lookback period (default: 7)
- `GITHUB_TOKEN` (optional): If not using `gh` CLI

**Output Format:**
```json
{
  "enterprise_report": {
    "day_totals": [...],
    "totals_by_ide": [...],
    "totals_by_language": [...]
  },
  "user_report": [
    {
      "day": "2024-03-25",
      "user_login": "developer1",
      "daily_active_users": 1,
      ...
    }
  ]
}
```

## Verification

Verify calculation accuracy:

```bash
cd data
node verify_math.cjs
```

This runs the example data through all three estimation methods and outputs:
- Raw data per day
- Calculated hours per method
- Per-developer averages
- Total hours saved

## Development

### Testing (Coming Soon)

```bash
npm install
npm test
```

### Build (Coming Soon)

```bash
npm run build
```

This will bundle modular source files into single-file HTML dashboards.

## Configuration

Estimation constants can be customized via the dashboard UI or by uploading a config file:

```json
{
  "est_interactions_per_hour": 20,
  "est_hrs_per_kloc": 2,
  "cfg_labor_cost_per_hour": 150,
  "cfg_baseline_hrs_per_dev_per_week": 30,
  "cfg_workdays_per_week": 5
}
```

## Schema Validation

JSON schemas are provided for data validation:

- `df-ai-assisted-coding-schema.json` - Overall structure
- `df-enterprise-day-ai-schema.json` - Enterprise daily totals
- `df-user-day-ai-schema.json` - User activity records

## License

*(Add license information)*

## Support

*(Add support/contact information)*
