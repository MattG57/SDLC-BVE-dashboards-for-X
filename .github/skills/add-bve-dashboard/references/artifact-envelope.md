# Materialized Artifact Envelope Schema

All materializers produce artifacts following a standardized envelope format.

## Structure

```json
{
  "artifact": {
    "stage": "materialized",
    "name": "<artifact-name>",
    "version": "1.0.0",
    "computed_at": "<ISO 8601 timestamp>",
    "compute_ms": 42,
    "inputs": [
      {
        "file": "raw/<filename>.json",
        "hash": "<sha256 or null>"
      }
    ],
    "profile": {
      "element_count": 2,
      "total_time_saved_hours": 150,
      "total_completions": 42,
      "total_time_spent_hours": 500,
      "integrated_leverage": 0.084,
      "date_range": {
        "first": "2024-01-01",
        "last": "2024-01-28"
      },
      "config_used": {
        "cfg_total_developers": 500,
        "cfg_pct_time_coding": 0.25,
        "est_interactions_per_hour": 20
      },
      "selections_used": {
        "ai": { "estimateId": null, "projectionId": null },
        "agentic": { "estimateId": null, "projectionId": null }
      }
    }
  },
  "elements": [
    {
      "elementKey": "ai-assisted-coding",
      "row": { ... },
      "worksheet": { ... }
    }
  ]
}
```

## Field Descriptions

### `artifact` (metadata)

| Field | Type | Description |
|---|---|---|
| `stage` | string | Always `"materialized"` |
| `name` | string | Artifact name matching the output file |
| `version` | string | Semantic version of the materializer |
| `computed_at` | string | ISO 8601 timestamp of computation |
| `compute_ms` | number | Milliseconds taken to compute |
| `inputs` | array | List of raw input files with optional hash |
| `profile` | object | Summary metadata for the artifact |

### `elements` (data)

Each element has:

| Field | Type | Description |
|---|---|---|
| `elementKey` | string | Element identifier (e.g., `"ai-assisted-coding"`, `"agentic-ai-coding"`) |
| `row` | object | Summary row for the leverage table (area, attempts, completions, yield, leverage, time saved/spent, projections) |
| `worksheet` | object | Detailed modeling data (definitions, date range, fact summary, improvement estimates, projected improvements, selections) |

### `row` Fields

| Field | Description |
|---|---|
| `area` | Human-readable element name |
| `attemptType` | What counts as an attempt |
| `attempts` | Total attempts in the window |
| `completionType` | What counts as a completion |
| `completionCount` | Total completions |
| `wipPlus` / `wipMinus` / `wipDelta` | Work-in-progress adjustments |
| `timeSpentHours` | Total compute/dev hours invested |
| `timeSavedHours` | Estimated hours saved (from selected estimate) |
| `currentYield` | Window-bound completions / window-bound attempts |
| `leverage` | Completions per time-spent hour |
| `projTimeSavedHours` | Projected time saved under selected projection |
| `projCompletionGain` | Projected additional completions |
| `projYield` | Projected yield |
| `modeNote` | Name of the selected projection |
