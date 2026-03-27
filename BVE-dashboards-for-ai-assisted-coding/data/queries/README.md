# Data Collection Scripts

## Usage

These scripts output **JSON to stdout** and **progress messages to stderr**.

### AI Assisted Coding

```bash
# Enterprise metrics
ENTERPRISE="octodemo" DAYS=28 ./ai-assisted-coding.sh > octodemo-data.json

# Organization metrics
ORG="my-org" DAYS=28 ./ai-assisted-coding.sh > org-data.json

# Save logs separately
ENTERPRISE="octodemo" ./ai-assisted-coding.sh 2>progress.log >data.json
```

### Agentic AI Coding

```bash
# All repositories in org (scans 582 repos, takes 10-15 minutes)
ORG="octodemo" DAYS=28 ./agentic-ai-coding.sh > octodemo-agentic.json

# Single repository (faster)
ORG="octodemo" REPO="my-repo" DAYS=28 ./agentic-ai-coding.sh > data.json

# Save logs separately
ORG="octodemo" ./agentic-ai-coding.sh 2>progress.log >data.json
```

### PR Review Metrics

Collects pull request data for structural dashboard (PR assistance rate, LoC share).

```bash
# Organization-wide PR data (last 28 days)
ORG="octodemo" DAYS=28 ./pr-review.sh > octodemo-pr-data.json

# Single repository
ORG="octodemo" REPO="my-repo" DAYS=14 ./pr-review.sh > pr-data.json

# Date range
ORG="octodemo" SINCE=2026-02-01 UNTIL=2026-02-28 ./pr-review.sh > pr-data.json

# Save logs separately
ORG="octodemo" ./pr-review.sh 2>progress.log >pr-data.json
```

### Combined Usage (Structural Dashboard)

The structural dashboard requires **both** AI assisted coding metrics AND PR review metrics:

```bash
# Step 1: Collect Copilot metrics
ENTERPRISE="octodemo" DAYS=28 ./ai-assisted-coding.sh > copilot-metrics.json

# Step 2: Collect PR metrics
ORG="octodemo" DAYS=28 ./pr-review.sh > pr-metrics.json

# Step 3: Upload both files to structural dashboard
# The dashboard will merge them to calculate:
#   - Adoption % (from Copilot metrics)
#   - PR Assistance Rate (from PR metrics)
#   - LoC Share (from PR metrics)
```

## Common Mistakes

❌ **INCORRECT** - Mixes stderr into JSON:
```bash
./script.sh > data.json 2>&1
```

✅ **CORRECT** - Only JSON goes to file:
```bash
./script.sh > data.json
```

✅ **CORRECT** - Save both separately:
```bash
./script.sh 2>progress.log >data.json
```

## Output Format

### AI Assisted Coding
```json
{
  "enterprise_report": { ... },
  "user_report": [ ... ]
}
```

### Agentic AI Coding
```json
{
  "developer_day_summary": [ ... ],
  "pr_sessions": [ ... ],
  "requests": [ ... ]
}
```

### PR Review Metrics
```json
{
  "pull_requests": {
    "prs": [ ... ]
  },
  "detailed_pr_events": [ ... ]
}
```

## Help

All scripts have built-in help:
```bash
./ai-assisted-coding.sh --help
./agentic-ai-coding.sh --help
./pr-review.sh --help
```
