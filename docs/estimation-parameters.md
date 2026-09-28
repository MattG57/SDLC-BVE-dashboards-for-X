# Estimation parameters

<!-- Generated from shared/core/config.js by `node scripts/generate-estimation-docs.js`. Do not edit by hand. -->

The "hours saved" and dollar figures on the dashboards are **estimates**. Each one multiplies measured activity (interactions, lines of code, agent session time, active developers) by a configured constant. The constants are **assumptions or internal calibrations, not measurements**. This page records where each one came from, its plausible range, and how much the headline moves if it is wrong.

Values are set in `dashboard-config.json`. Any key you leave out falls back to the default below. See [query-settings.md](query-settings.md#deployment-specific-values) for why each deployment owns that file.

## How to read this page

- **Source**
  - *Customer-supplied*: a fact only your organization knows. The default is a placeholder.
  - *Calibrated*: tuned against pipeline data (see [Calibration history](#calibration-history)).
  - *Assumption*: maintainer judgement.
  - *Legacy*: read only by legacy dashboards.
- **Range**: a plausible band. `npm run validate` and the materializers warn when `dashboard-config.json` falls outside it.
- **Sensitivity**: one-at-a-time. It shows the multiplier applied to the affected estimate when the key moves from its default to the low / high end of its range, with everything else held fixed.
  - Every time-saved estimate is proportional to its constant, so the multiplier applies directly to that estimate's hours saved (and dollars).
  - Example: ×0.45 / ×9.1 means the estimate could be about half, or nine times, the reported value.

## Summary

| Key | Default | Unit | Source | Range | Sensitivity (at min / max) | Affects |
|---|---|---|---|---|---|---|
| `cfg_total_developers` | 100 | developers | Customer-supplied | — | — | Adoption %; Full Developer Adoption projection |
| `cfg_workdays_per_week` | 5 | days | Assumption | 4 – 6 | ×1.3 / ×0.83 | AI-assisted Manual Daily % estimate |
| `cfg_labor_cost_per_hour` | — | USD/hour | Customer-supplied | — | — | Economic value ($) of hours saved |
| `cfg_pct_time_coding` | 0.25 | fraction | Assumption | 0.1 – 0.5 | ×0.40 / ×2.0 | AI-assisted time spent (leverage denominator); AI-assisted Manual Daily % estimate |
| `cfg_pct_time_reviewing` | 0.2 | fraction | Assumption | 0.05 – 0.35 | — | *Not read by the current pipeline* |
| `cfg_hrs_per_dev_per_day` | 8 | hours | Assumption | 6 – 10 | ×0.75 / ×1.3 | AI-assisted time spent (leverage denominator) |
| `cfg_window_days` | 28 | days | Assumption | 7 – 90 | — | Agentic session window; Leverage summary window label |
| `est_interactions_per_hour` | 30 | interactions/hour saved | Calibrated | 10 – 60 | ×3.0 / ×0.50 | AI-assisted Interactions-Based hours saved |
| `cfg_time_saved_pct_day` | 0.38 | fraction of coding time | Calibrated | 0.1 – 0.5 | ×0.26 / ×1.3 | AI-assisted Manual Daily % hours saved |
| `cfg_baseline_hours_per_dev_per_week` | 40 | hours/week | Assumption | 35 – 45 | ×0.88 / ×1.1 | AI-assisted Manual Daily % hours saved |
| `est_duration_factor` | 0.2 | dev-hours per agent-hour | Calibrated | 0.1 – 2 | ×0.50 / ×10 | Agentic Duration-Based hours saved; Agentic Full Merge Rate projection |
| `cfg_total_repos` | — | repositories | Customer-supplied | — | — | Agentic Repo Coverage projection |
| `est_hrs_per_kloc` | 0.22 | hours per 1,000 LoC | Calibrated | 0.1 – 2 | ×0.45 / ×9.1 | AI-assisted LoC-Based hours saved; Agentic LoC-Based hours saved |
| `cfg_pr_assist_lookback_days` | 3 | days | Assumption | 0 – 7 | — | PR-assist rate (structural analysis) |
| `cfg_total_dev_loc_added_day` | — | LoC/day | Customer-supplied | — | — | *Not read by the current pipeline* |
| `cfg_projection_cap_ai` | 5 | × | Assumption | 1 – 10 | — | *Not read by the current pipeline* |
| `cfg_projection_cap_agentic` | 9 | × | Assumption | 1 – 15 | — | *Not read by the current pipeline* |
| `est_human_to_agent_ratio` | 10 | ratio | Legacy | — | — | Legacy v1/v2 agentic dashboards only |

## Formulas

Estimates computed by `shared/materializers/leverage-summary.js`. The v4 dashboards use the same formulas.

| Estimate | Formula | Constants |
|---|---|---|
| AI-assisted: Interactions-Based *(default selection)* | `interactions ÷ est_interactions_per_hour` | `est_interactions_per_hour` |
| AI-assisted: LoC-Based | `(loc_added ÷ 1000) × est_hrs_per_kloc` | `est_hrs_per_kloc` |
| AI-assisted: Manual Daily % | `Σ_days cfg_time_saved_pct_day × cfg_pct_time_coding × (cfg_baseline_hours_per_dev_per_week ÷ cfg_workdays_per_week) × daily_active_users` | `cfg_time_saved_pct_day`, `cfg_pct_time_coding`, `cfg_baseline_hours_per_dev_per_week`, `cfg_workdays_per_week` |
| AI-assisted: time spent (leverage denominator) | `Σ_days daily_active_users × cfg_pct_time_coding × cfg_hrs_per_dev_per_day` | `cfg_pct_time_coding`, `cfg_hrs_per_dev_per_day` |
| Agentic: Duration-Based *(default selection)* | `(session_minutes ÷ 60) × est_duration_factor` | `est_duration_factor` |
| Agentic: LoC-Based | `(merged_loc_added ÷ 1000) × est_hrs_per_kloc` | `est_hrs_per_kloc` |
| Agentic: Full Merge Rate projection | `est_duration_factor × time_spent × (1 − yield)` | `est_duration_factor` |
| Economic value | `hours_saved × cfg_labor_cost_per_hour` | `cfg_labor_cost_per_hour` |

Notes on the table:

- Agentic duration minutes differ by surface:
  - `leverage-summary` uses sessions on **merged** PRs.
  - The v4 agentic dashboard uses all `agent_session_minutes` in the window.
- You can select a different estimate with `leverage_ai_estimate` or `leverage_agentic_estimate`.

## Parameter details

### Organization-wide

#### `cfg_total_developers`

Total number of developers in the organization.

- **Default:** 100 (developers)
- **Source:** Customer-supplied. GitHub cannot measure the developer population (see docs/design-decisions.md). 100 is a placeholder; every deployment must set it.
- **Range:** —
- **Sensitivity:** —
- **Affects:** Adoption %; Full Developer Adoption projection

#### `cfg_workdays_per_week`

Working days per week (excludes weekends).

- **Default:** 5 (days)
- **Source:** Assumption. Standard five-day work week.
- **Range:** 4 – 6
- **Sensitivity:** ×1.3 / ×0.83 (inverse)
- **Affects:** AI-assisted Manual Daily % estimate

#### `cfg_labor_cost_per_hour`

Fully loaded labor cost per developer hour. Used for economic value calculation.

- **Default:** — (USD/hour)
- **Source:** Customer-supplied. Organization-specific; left unset so no dollar figure is shown until the deployment supplies one.
- **Range:** —
- **Sensitivity:** — (linear)
- **Affects:** Economic value ($) of hours saved

#### `cfg_pct_time_coding`

Fraction of work time spent on coding tasks (0–1).

- **Default:** 0.25 (fraction)
- **Source:** Assumption. Roughly two hours of hands-on coding per eight-hour day. Replace with your own time-allocation data if available.
- **Range:** 0.1 – 0.5
- **Sensitivity:** ×0.40 / ×2.0 (linear)
- **Affects:** AI-assisted time spent (leverage denominator); AI-assisted Manual Daily % estimate

#### `cfg_pct_time_reviewing`

Fraction of work time spent on code review (0–1).

- **Default:** 0.2 (fraction)
- **Source:** Assumption. Reserved for review-time estimates; not read by the current pipeline or v4 dashboards.
- **Range:** 0.05 – 0.35
- **Sensitivity:** —
- **Affects:** Not read by the current pipeline or v4 dashboards

#### `cfg_hrs_per_dev_per_day`

Working hours per developer per day. Multiplied by % time coding to estimate AI-assisted time spent.

- **Default:** 8 (hours)
- **Source:** Assumption. Standard eight-hour workday.
- **Range:** 6 – 10
- **Sensitivity:** ×0.75 / ×1.3 (linear)
- **Affects:** AI-assisted time spent (leverage denominator)

#### `cfg_window_days`

Default reporting window (days) for leverage summaries and the agentic session cutoff.

- **Default:** 28 (days)
- **Source:** Assumption. Four full work weeks, matching the Copilot metrics 28-day report.
- **Range:** 7 – 90
- **Sensitivity:** —
- **Affects:** Agentic session window; Leverage summary window label

### AI-assisted

#### `est_interactions_per_hour`

Estimated Copilot interactions per hour of saved time.

- **Default:** 30 (interactions/hour saved)
- **Source:** Calibrated. Raised from 20 to 30 so the Interactions, LoC and Manual % methods converge near ~0.75 hrs/dev/day (commit b90bf39).
- **Range:** 10 – 60
- **Sensitivity:** ×3.0 / ×0.50 (inverse)
- **Affects:** AI-assisted Interactions-Based hours saved

#### `cfg_time_saved_pct_day`

Manual estimate of the fraction of coding time saved per active developer per day (0–1). Used only by the Manual Daily % method.

- **Default:** 0.38 (fraction of coding time)
- **Source:** Calibrated. Raised from 0.30 to 0.38 in the same convergence calibration (commit b90bf39). 0.38 × 25% coding × 8 h ≈ 0.76 hrs/dev/day.
- **Range:** 0.1 – 0.5
- **Sensitivity:** ×0.26 / ×1.3 (linear)
- **Affects:** AI-assisted Manual Daily % hours saved

#### `cfg_baseline_hours_per_dev_per_week`

Baseline working hours per developer per week. Used only by the Manual Daily % method.

- **Default:** 40 (hours/week)
- **Source:** Assumption. Standard 40-hour work week.
- **Range:** 35 – 45
- **Sensitivity:** ×0.88 / ×1.1 (linear)
- **Affects:** AI-assisted Manual Daily % hours saved

### Agentic

#### `est_duration_factor`

Human-equivalent hours saved per hour of merged agent session time. Higher values assume agent work is denser than human work.

- **Default:** 0.2 (dev-hours per agent-hour)
- **Source:** Calibrated. Changed from 10 to 0.20 in commit cdcd8d1, the same change that began accumulating active minutes across all agent runs per PR. No separate rationale was recorded.
- **Range:** 0.1 – 2
- **Sensitivity:** ×0.50 / ×10 (linear)
- **Affects:** Agentic Duration-Based hours saved; Agentic Full Merge Rate projection

#### `cfg_total_repos`

Total repositories in scope. Used for repo coverage structural factor.

- **Default:** — (repositories)
- **Source:** Customer-supplied. Organization-specific. When unset, the repo-coverage projection is skipped.
- **Range:** —
- **Sensitivity:** —
- **Affects:** Agentic Repo Coverage projection

### Shared (AI-assisted and agentic)

#### `est_hrs_per_kloc`

Estimated developer hours saved per 1,000 lines of code added. Used by LoC-based estimation in both AI-assisted and agentic elements.

- **Default:** 0.22 (hours per 1,000 LoC)
- **Source:** Calibrated. Lowered from 1.5 to 0.22 in PR #56 as a "revised assumption"; no further rationale was recorded and no external study is cited. Check the sensitivity band before quoting LoC-based figures.
- **Range:** 0.1 – 2
- **Sensitivity:** ×0.45 / ×9.1 (linear)
- **Affects:** AI-assisted LoC-Based hours saved; Agentic LoC-Based hours saved

### Structural analysis

#### `cfg_pr_assist_lookback_days`

Number of days to look back when classifying a PR as "assisted." A PR is assisted if its author was Copilot-active on the merge day or within this many prior days.

- **Default:** 3 (days)
- **Source:** Assumption. Maintainer judgement: covers a typical PR cycle, so work authored with Copilot a few days before merge still counts as assisted.
- **Range:** 0 – 7
- **Sensitivity:** —
- **Affects:** PR-assist rate (structural analysis)

#### `cfg_total_dev_loc_added_day`

Target total LoC added per day across the org. Used for AI-assisted LoC % calculation when PR data is unavailable.

- **Default:** — (LoC/day)
- **Source:** Customer-supplied. Organization-specific. Not read by the current pipeline or v4 dashboards.
- **Range:** —
- **Sensitivity:** —
- **Affects:** Not read by the current pipeline or v4 dashboards

### Integrated / projection

#### `cfg_projection_cap_ai`

Maximum multiplier for AI-assisted projections in the integrated view.

- **Default:** 5 (×)
- **Source:** Assumption. Guardrail against very low adoption producing extreme 1/adoption projections. Not read by the current pipeline or v4 dashboards.
- **Range:** 1 – 10
- **Sensitivity:** —
- **Affects:** Not read by the current pipeline or v4 dashboards

#### `cfg_projection_cap_agentic`

Maximum multiplier for agentic projections in the integrated view.

- **Default:** 9 (×)
- **Source:** Assumption. Guardrail against extreme projections. Not read by the current pipeline or v4 dashboards.
- **Range:** 1 – 15
- **Sensitivity:** —
- **Affects:** Not read by the current pipeline or v4 dashboards

### Legacy

#### `est_human_to_agent_ratio`

Legacy name for the agentic duration multiplier. Superseded by est_duration_factor.

- **Default:** 10 (ratio)
- **Source:** Legacy. Read only by the legacy v1 agentic efficiency and v2 agentic-element dashboards. The pipeline and v4 dashboards use est_duration_factor.
- **Range:** —
- **Sensitivity:** —
- **Affects:** Legacy v1/v2 agentic dashboards only

## Calibration history

Recorded changes to the shipped values, from git history.

| Date | Ref | Change | Recorded reason |
|---|---|---|---|
| 2026-04-12 | 02458ed | Initial shared config: `est_hrs_per_kloc` 4, `est_duration_factor` 0.5, `est_interactions_per_hour` 20, `cfg_pct_time_coding` 0.5, `cfg_time_saved_pct_day` 0.11 | Initial values; none recorded |
| 2026-04-12 | a0796a2 | `cfg_pct_time_coding` 0.5 → 0.25; `cfg_time_saved_pct_day` 0.11 → 0.30 | None recorded |
| 2026-04-23 | c330d44 | `est_hrs_per_kloc` 4 → 1; `est_duration_factor` 0.5 → 10 | None recorded |
| 2026-05-06 | b90bf39 | `est_interactions_per_hour` 20 → 30; `est_hrs_per_kloc` 1 → 1.5; `cfg_time_saved_pct_day` 0.30 → 0.38 | Make the three AI-assisted methods converge near ~0.75 hrs/dev/day on octodemo data (they previously ranged 0.6–2.0) |
| 2026-05-20 | cdcd8d1 | `est_duration_factor` 10 → 0.20 | Shipped with the switch to accumulated active agent minutes across all runs per PR; no separate reason recorded |
| 2026-09-03 | #56 | `est_hrs_per_kloc` 1.5 → 0.22 | "Revised assumption"; none further recorded |
| 2026-09-28 | #64 | Registry defaults aligned with the shipped `dashboard-config.json` values | One canonical value per key across registry, config, dashboards and docs |

Caveats about how these values were set:

- The calibration in b90bf39 aimed for **agreement between methods**, not **accuracy against a measured baseline**. Three methods converging on ~0.75 hrs/dev/day shows the constants are consistent with each other, not that 0.75 is correct.
- No value here is backed by a controlled study. Treat the sensitivity band as the honest error bar.

When you recalibrate:

- **Record** the dataset (org, date range), the target, and the method in the commit or PR, and add a row here by editing `CALIBRATION_HISTORY` in `shared/core/config-docs.js`.
- **Prefer measured anchors** where you have them, such as a developer time-allocation survey for `cfg_pct_time_coding` or timed task comparisons for `est_hrs_per_kloc`.
- **Update the registry** if you change a default: `default`, `rationale` and, if needed, `range` in `shared/core/config.js`. Then run `node scripts/generate-estimation-docs.js`.
