# Estimation Methods — Worked Examples

Source: `shared/materializers/leverage-summary.js`

## AI-Assisted: Interactions-Based

**Scenario**: 50 active Copilot users averaging 15 interactions/day over 28 days.

```
total_interactions = 50 × 15 × 28 = 21,000
est_interactions_per_hour = 20 (example; registry default is 30)

hours_saved = 21,000 / 20 = 1,050 hours
per_dev_per_day = 1,050 / (50 × 28) = 0.75 hours/dev/day
```

**Interpretation**: Each active developer saves ~45 minutes per day through Copilot interactions.

## AI-Assisted: LoC-Based

**Scenario**: 200,000 lines of code added by Copilot-assisted developers over 28 days.

```
total_loc_added = 200,000
est_hrs_per_kloc = 2 (example; registry default is 0.22)

hours_saved = (200,000 / 1,000) × 2 = 400 hours
```

**Interpretation**: Based on the assumption that writing 1,000 lines of code manually takes 2 developer-hours.

## AI-Assisted: Manual Daily %

**Scenario**: Survey indicates developers save 15% of their coding time. 40-hour work weeks, 5 workdays.

```
cfg_time_saved_pct_day = 0.15   (share of coding time)
cfg_pct_time_coding = 0.25
cfg_baseline_hours_per_dev_per_week = 40
cfg_workdays_per_week = 5

Per day per active dev = 0.15 × 0.25 × 40 / 5 = 0.3 hours

For 50 active devs over 28 days:
hours_saved = 0.3 × 50 × 28 = 420 hours
```

## Agentic: Duration-Based (Merged)

**Scenario**: 30 merged agent PRs with total session time of 500 minutes.

```
merged_session_minutes = 500
est_duration_factor = 2 (example; registry default is 0.2)

hours_saved = (500 / 60) × 2 = 16.7 hours
```

**Interpretation**: Higher `est_duration_factor` assumes agent work is denser than human work.

## Agentic: LoC-Based (Merged)

**Scenario**: 30 merged agent PRs adding 15,000 lines of code.

```
merged_loc_added = 15,000
est_hrs_per_kloc = 2 (example; registry default is 0.22)

hours_saved = (15,000 / 1,000) × 2 = 30 hours
```

## Which Method to Choose

| Method | Best When | Limitations |
|---|---|---|
| Interactions-Based | High Copilot interaction volume | Assumes constant interaction-to-value ratio |
| LoC-Based | Code volume is a good proxy for effort | LoC ≠ effort for all code types |
| Manual Daily % | You have survey data on time savings | Relies on self-reported estimates |
| Duration-Based (Agentic) | Agent session times are representative | Requires calibrating duration_factor |
| LoC-Based (Agentic) | Merged PR code volume is meaningful | Same LoC ≠ effort caveat |

For each constant's provenance, plausible range and sensitivity, see [docs/estimation-parameters.md](../../../../docs/estimation-parameters.md).
