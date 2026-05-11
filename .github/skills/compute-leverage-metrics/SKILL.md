---
name: compute-leverage-metrics
description: >-
  Understand and compute BVE leverage metrics including time saved estimates, yield, projections, and
  integrated leverage. Covers all formulas from the leverage-summary materializer: 3 AI-assisted
  estimation methods, 2 agentic methods, projection scale-factor patterns, and the integrated leverage
  formula. Use when the user says "calculate leverage", "compute time saved", "estimate efficiency",
  "hours saved", "projection", "ROI", "yield", "leverage formula", or "how is time saved calculated".
  Do not use for configuring parameters (use configure-bve-dashboards) or running the pipeline
  (use run-bve-pipeline).
---

# Compute Leverage Metrics

All leverage calculations live in `shared/materializers/leverage-summary.js`. The materializer produces standardized leverage rows from 4 input artifacts.

## Core Concepts

### Leverage
```
leverage = completionCount / timeSpentHours
```
Measures the rate at which the system converts invested time into completed outputs. Higher leverage means more output per hour invested.

### Yield
```
yield = windowBoundCompletions / windowBoundAttempts
```
The fraction of attempts that result in completions within the measurement window. WIP adjustments account for in-flight work:
- `windowBoundCompletions = completionCount - wipMinus`
- `windowBoundAttempts = attempts - wipPlus`

### safeDiv
All division operations use `safeDiv(numerator, denominator)` from `shared/core/math.js`. Returns `null` when denominator ≤ 0, preventing division-by-zero errors.

## AI-Assisted Element

### Time Spent
```
timeSpentHours = Σ(daily_active_users × cfg_pct_time_coding × 8) over all days
```
Represents the total developer-hours invested in coding activities.

### Estimation Method 1: Interactions-Based
```
hours_saved = total_interactions / est_interactions_per_hour
```
- `total_interactions` = sum of `user_initiated_interaction_count` across all days
- `est_interactions_per_hour` = config parameter (default: 20)
- Per-dev: `hours_saved / (avg_dau × days)`

### Estimation Method 2: LoC-Based
```
hours_saved = (total_loc_added / 1000) × est_hrs_per_kloc
```
- `total_loc_added` = sum of `loc_added_sum` across all days
- `est_hrs_per_kloc` = config parameter (default: 2)

### Estimation Method 3: Manual Daily %
Only available when both `cfg_time_saved_pct_day` and `cfg_baseline_hours_per_dev_per_week` are configured.
```
hours_saved = Σ(cfg_time_saved_pct_day × cfg_baseline_hours_per_dev_per_week / cfg_workdays_per_week × daily_active_users)
```

### Structural Factors
- **Adoption %**: `avg_daily_active_users / cfg_total_developers`
- **PR Assist %**: `assisted_prs / total_prs` (from classifyAssisted lookback window)
- **LoC Assist %**: `assisted_loc / total_loc`

## Agentic Element

### Time Spent
If session logs are available:
```
timeSpentHours = total_compute_minutes / 60  (active time from session logs)
```
Otherwise:
```
timeSpentHours = total_session_minutes / 60  (observed agent running time)
```

### Estimation Method 1: Duration-Based (Merged)
```
hours_saved = (merged_session_minutes / 60) × est_duration_factor
```
- `merged_session_minutes` = total duration of merged PR sessions
- `est_duration_factor` = config parameter (default: 2)

### Estimation Method 2: LoC-Based (Merged)
```
hours_saved = (merged_loc_added / 1000) × est_hrs_per_kloc
```
- `merged_loc_added` = total lines added in merged PRs
- `est_hrs_per_kloc` = config parameter (default: 2)

### Structural Factors
- **Adoption %**: `avg_active_devs / cfg_total_developers`
- **Merge Rate**: `total_prs_merged / total_prs_created`
- **Repo Coverage**: `active_repos / cfg_total_repos`

## Projection Scale-Factor Pattern

All projections follow the same pattern:
```
projected_time_saved = current_time_saved × (1 / structural_factor)
```

Where `structural_factor` is the current percentage (0–1) of the metric being projected.

### AI-Assisted Projections

| Projection | Factor | Formula |
|---|---|---|
| Full Adoption | `adoption_pct` | `time_saved × (1 / adoption_pct)` |
| Full PR Assist | `prs_assisted_pct` | `time_saved × (1 / prs_assisted_pct)` |
| Full LoC Assist | `loc_assisted_pct` | `time_saved × (1 / loc_assisted_pct)` |

### Agentic Projections

| Projection | Factor | Formula |
|---|---|---|
| Full Adoption | `adoption_pct` | `time_saved × (1 / adoption_pct)` |
| Full Merge Rate | `merge_rate` | `duration_factor × time_spent × (1 - yield)` |
| Full Repo Coverage | `repo_coverage` | `time_saved × (1 / repo_coverage)` |

Projections are only generated when the factor is between 0 and 1 (exclusive).

## Integrated Leverage

The integrated view combines all elements:
```
integrated_leverage = total_completions / total_time_spent
total_time_saved = Σ(element.timeSavedHours)
total_completions = Σ(element.completionCount)
total_time_spent = Σ(element.timeSpentHours)
```

## Estimate and Projection Selection

The materializer supports selecting which estimate and projection drives each element's summary row:

```javascript
config.leverage_ai_estimate      // estimateId for AI-Assisted (default: first)
config.leverage_ai_projection    // projectionId for AI-Assisted (default: first)
config.leverage_agentic_estimate // estimateId for Agentic (default: first)
config.leverage_agentic_projection // projectionId for Agentic (default: first)
```

Available estimate IDs:
- AI-Assisted: `interactions`, `loc`, `manual_daily_pct`
- Agentic: `duration`, `loc`

Available projection IDs:
- AI-Assisted: `adoption`, `prs_assisted`, `loc_assisted`
- Agentic: `adoption`, `merge_rate`, `repo_coverage`

## Dollar Savings

When `cfg_labor_cost_per_hour` is configured:
```
dollar_savings = hours_saved × cfg_labor_cost_per_hour
```

## References

- [Detailed estimation methods with worked examples](references/estimation-methods.md)
- [Projection models and scenarios](references/projection-models.md)
