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

## Help

Both scripts have built-in help:
```bash
./ai-assisted-coding.sh --help
./agentic-ai-coding.sh --help
```
