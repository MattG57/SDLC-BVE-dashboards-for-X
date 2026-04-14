# Pipeline Architecture & Migration Design

This document describes the architecture for a materialized data pipeline that will replace the current inline processing in each dashboard. It covers the design principles, the materialization boundary, the shared module structure, the dataflow dashboard, and the migration plan.

---

## 1. Design Principles

### 1.1 Materialize observed data. Compute interpretations live.

Every number in the dashboard system passes through a chain of transformations. The architecture splits that chain at a clear boundary:

- **Materialized (upstream):** Collection results, flattened records, deduplicated entities, bot-filtered PRs, PR-assist classifications, joined day-level datasets, per-dev ratios. These are deterministic from the raw data. They don't change when the user adjusts config.

- **Live (downstream):** Estimation methods, structural projections, leverage geometry, economic value, integrated mode logic. These depend on `est_*` and `cfg_*` parameters. They change instantly when the user adjusts a slider or selects a method.

```
     MATERIALIZED (files, shared, cacheable)        LIVE (page logic, config-reactive)
     ──────────────────────────────────────         ─────────────────────────────────
     Collection → Flatten → Dedup → Join            Estimate → Project → Leverage → Render
                                              ▲
                                              │
                                     THE BOUNDARY

     "What happened"                          "What we think it means"
     Deterministic from raw                   Depends on est_*, cfg_*
     Same for all viewers                     Interactive, per-viewer
     Cacheable, shareable                     Instant, reconfigurable
```

### 1.2 Four artifacts serve seven dashboards

Only four materialized artifacts are needed to feed all current dashboards:

| Artifact | Built from | Key processing | Dashboards served |
|---|---|---|---|
| `ai-assisted-efficiency-days` | `copilot-metrics.json` | flattenDayTotal + flattenUserReport → dedup → join on day → per-dev ratios | AI-Asst Efficiency, AI-Asst Element, Integrated |
| `ai-assisted-structural-days` | `copilot-metrics.json` + `human-pr-metrics.json` | flatten + dedup + bot-filter + 3-day lookback PR-assist classification | AI-Asst Structural, AI-Asst Element, Integrated |
| `agentic-efficiency-days` | `coding-agent-pr-metrics.json` | flattenDevDay + dedupDevDays → aggregate to day level → per-dev ratios | Agentic Efficiency, Agentic Element, Integrated |
| `agentic-pr-sessions` | `coding-agent-pr-metrics.json` | flattenPrSession + dedupSessions | Agentic Efficiency, Agentic Element, Integrated |

Each dashboard loads 1–3 of these artifacts and applies its own config-driven calculations on top.

### 1.3 Dashboards are orchestrators, not processors

After migration, a dashboard's job is:

1. Load materialized artifacts (from pre-built files or by materializing uploaded raw data in-browser using the same shared modules)
2. Apply config-driven live calculations (estimation, projection, leverage)
3. Render visualizations

Config changes re-run step 2 only. Step 1 is cached.

### 1.4 Every box in the dataflow is profilable

Each materialized artifact carries a standard envelope with profile metadata — record counts, date ranges, dedup stats, entity lists, join coverage, warnings. This metadata is what the dataflow dashboard displays when a user clicks a box. No separate profiling logic is needed.

### 1.5 Build alongside, verify equivalence, then switch

No existing dashboard is modified until a verification test proves that the new pipeline produces identical results for every visualization. The old and new code paths coexist until equivalence is confirmed per-dashboard.

---

## 2. Current State & Gaps

### 2.1 Category A: Consistency, Explanation, and Control

Things that exist across dashboards but are inconsistent, unexplained, or not user-controllable.

**A1. Config key names and defaults diverge silently.** The same conceptual parameter has different names or defaults across dashboards. `est_hrs_per_kloc` defaults to 2 in most dashboards but 4 in Agentic Efficiency. The agentic duration multiplier is called `est_human_to_agent_ratio: 10` in Efficiency but `est_duration_factor: 2` in Element — different name and different value for the same concept.

**A2. Config panel shows fields that aren't consumed.** The Structural dashboard exposes `cfg_labor_cost_per_hour` and `cfg_workdays_per_week` in its config panel but no calculation uses them.

**A3. Inline `index.html` logic diverges from tested `src/` modules.** The Structural dashboard's `adopted_individuals_pct` uses a 4-day lookback union in `index.html` but simple `daily_active_users / totalDevs` in `src/core/calculators.js`. Tests validate only the `src/` version.

**A4. PR-assisted lookback window is hardcoded and undocumented.** Both the AI-Assisted Element and Structural dashboards use a 3-day lookback to classify PRs as "assisted." No UI label, tooltip, or config key explains or controls this.

**A5. Duplicated utility code drifts across dashboards.** `safeDiv` is implemented 11 times with two different behaviors (`b > 0` vs `b && b !== 0`). `flattenDayTotal` exists in 9 places. `BOT_PATTERNS` is defined 5 times.

**A6. Stale files.** Structural dashboard contains `data1/`, `review.md`, `verify.js`, `index copy.html`. AI-Assisted Element contains `element.html` and `index copy.html`.

**A7. Economic value calculated inconsistently.** Both efficiency dashboards compute economic value. Element dashboards accept `cfg_labor_cost_per_hour` but don't compute it.

### 2.2 Category B: Definition, Differentiation, and Purpose

Things that need sharper conceptual grounding.

**B1. "Dev-Hours" means two fundamentally different things.** AI-Assisted: human time spent coding with Copilot (`daily_active_users × pctTimeCoding × 8hrs`). Agentic: estimated human-equivalent time the agent replaces (output of estimation method). The Integrated dashboard sums these without distinction.

**B2. "Completions" means two fundamentally different things.** AI-Assisted: merged PRs by human developers who used Copilot. Agentic: merged PRs created autonomously by the coding agent. Both are valid per-element definitions but need distinct labeling.

**B3. The two projection models are opposite — and that's correct, but unexplained.** AI-Assisted projects by shrinking dev-hours (same completions, narrower rectangle — efficiency gain). Agentic projects by scaling up both axes (more completions at same leverage — volume scaling). Neither dashboard explains why its model works this way.

**B4. Counterfactual logic differs — also correct, but unexplained.** AI-Assisted counterfactual: wider rectangle ("without AI, more hours needed"). Agentic counterfactual: origin point ("without agent, this work wouldn't exist").

**B5. Section vocabulary diverges.** Efficiency: Impact → Drivers → Confidence. Element: Definition Cards → Leverage Summary → Leverage Insights. Structural: Completeness → Consistency → Impact → Prioritized Improvements → Reconciliation. Each serves a different analytical purpose but the relationship to the BVE framework questions isn't stated.

**B6. Only Element dashboards ground views in BVE terminology.** Element dashboards display DefinitionCards for "Job to Be Done," "Workflow," "Driver." Other dashboard types don't have this framing.

**B7. Integrated dashboard introduces projection logic not present in elements.** The Integrated dashboard supports 5 modes with caps (5× for AI, 9× for agentic) that don't exist in the element dashboards.

### 2.3 Category C: Scalability

Gaps that will be needed as the framework grows.

**C1. No tests for the most complex dashboards.** Element and Integrated dashboards have zero test coverage despite containing leverage rectangle geometry and structural projection logic.

**C2. No shared code infrastructure.** Every dashboard independently implements the same utilities and components.

**C3. Integrated dashboard hardcoded for exactly 2 elements.** The BVE framework describes an arbitrary number of elements.

**C4. No historical/longitudinal view.** All dashboards show a single data window with no period-over-period comparison.

**C5. No "Aperture" or "Business Translation" views.** The Purpose doc defines these as critical top-level concepts but neither has a dashboard implementation.

**C6. BVE concepts with no dashboard measurement.** Completion yield, failed/flawed/false/missed completions, losses, unnecessary work, contingency, and job class are all defined in the BVE Terminology doc but not measured by any dashboard.

**C7. No element registration or discovery mechanism.** Adding a new element requires changes in 7+ places.

**C8. No persistent/versioned config.** Config is per-session with no history.

---

## 3. Materialized Artifact Specification

### 3.1 Standard artifact envelope

Every materialized artifact has this shape:

```json
{
  "artifact": {
    "stage": "materialized",
    "name": "ai-assisted-efficiency-days",
    "version": "1.0.0",
    "computed_at": "2026-04-14T10:05:00Z",
    "compute_ms": 45,
    "code_version": "shared/materializers/ai-assisted-efficiency-days@1.0.0",
    "inputs": [
      {
        "file": "copilot-user-and-enterprise-metrics-2026-04-14.json",
        "hash": "sha256:abc123...",
        "collected_at": "2026-04-14T10:04:00Z",
        "metadata": { "...embedded collection metadata..." }
      }
    ],
    "profile": {
      "record_count": 26,
      "date_range": { "first": "2026-03-17", "last": "2026-04-13" },
      "days_with_data": 26,
      "days_without_data": 2,
      "unique_logins": 34,
      "unique_repos": null,
      "dedup": { "before": 28, "after": 26, "removed": 2, "key": "day" },
      "filter": null,
      "warnings": []
    }
  },
  "data": [ "...day rows..." ],
  "_users": [ "...user-day rows..." ],
  "_recon": [ "...reconciliation rows..." ]
}
```

The `artifact.profile` is what the dataflow dashboard displays when a user clicks a box. The `artifact.inputs` establishes lineage back to the raw collection files.

### 3.2 Artifact data schemas

**`ai-assisted-efficiency-days`** — per-day rows with enterprise totals and per-dev ratios, plus user-day rows for developer overlay and reconciliation records.

Key fields per day row: `day`, `daily_active_users`, `user_initiated_interaction_count`, `code_generation_activity_count`, `code_acceptance_activity_count`, `loc_added_sum`, `loc_deleted_sum`, `agent_mode_interaction_count`, `cli_prompt_count`, `interactions_per_active_dev`, `generations_per_active_dev`, `acceptances_per_active_dev`, `loc10_added_per_active_dev`, `agent_mode_per_active_dev`, `cli_prompts_per_active_dev`, `acceptance_rate`.

**`ai-assisted-structural-days`** — per-day rows with structural metrics (adoption, PR-assist classification, AI-assisted LOC), plus classified PR records and period aggregates.

Key fields per day row: `day`, `daily_active_users`, `unique_active_users`, `adopted_individuals_pct`, `prs_assisted_pct`, `ai_assisted_loc_pct`, `total_prs`, `assisted_prs`, `total_loc`, `assisted_loc`, `prs_per_day`, `loc_per_day`, `has_pr_data`. Period aggregates: `_prPeriod`, `_periodPrsAssistedPct`, `_periodLocAssistedPct`.

Profile includes: PR-assist lookback window (3 days), bot filter applied, dedup stats, PR author → Copilot user match rate.

**`agentic-efficiency-days`** — per-day rows aggregated from developer-day summaries with per-dev ratios, plus raw developer-day rows for user overlay.

Key fields per day row: `day`, `active_devs`, `total_agent_requests`, `sessions_started`, `agent_prs_created`, `agent_prs_merged`, `agent_loc_added`, `agent_loc_deleted`, `agent_session_minutes`, `changes_requested_total`, `median_merge_minutes`, `requests_per_dev`, `sessions_per_dev`, `prs_created_per_dev`, `prs_merged_per_dev`, `loc_added_per_dev`, `session_mins_per_dev`, `merge_rate`.

**`agentic-pr-sessions`** — flattened, deduped PR session records.

Key fields per session: `repo`, `pr_number`, `pr_url`, `pr_title`, `day`, `created_at`, `closed_at`, `merged_at`, `state`, `merged`, `draft`, `author`, `additions`, `deletions`, `changed_files`, `duration_minutes`, `changes_requested_count`, `reopened_count`, `additional_guidance_count`, `origin_request_type`, `origin_requested_by`.

### 3.3 Cache invalidation

An artifact is current if:
1. It exists
2. All input file hashes match what was recorded
3. The code version that produced it hasn't changed

Config does not affect artifact freshness — config-dependent calculations happen downstream in live page logic.

---

## 4. Shared Module Architecture

### 4.1 Module structure

```
shared/
├── core/                              Framework-level (all dashboards)
│   ├── math.js                           safeDiv, mean, stddev, linearRegression, smooth7, dayOffset
│   ├── format.js                         fmtDec, fmtPct, fmtPct0, fmt, fmtCompact, fmtCurrency
│   ├── config.js                         CONFIG_REGISTRY, getDefaults, validation
│   └── theme.js                          Highcharts dark theme, color palette
│
├── sources/                           Per-data-source processing
│   ├── copilot-metrics.js                flattenDayTotal, flattenUserReport, dedup
│   ├── pr-review.js                      flattenPrRecord, BOT_PATTERNS, isBot, dedup, classifyAssisted
│   └── agentic.js                        flattenPrSession, flattenDevDay, dedupSessions, dedupRequests
│
├── materializers/                     Artifact builders (one per artifact)
│   ├── ai-assisted-efficiency-days.js
│   ├── ai-assisted-structural-days.js
│   ├── agentic-efficiency-days.js
│   └── agentic-pr-sessions.js
│
├── calculations/                      Live calculations (config-dependent)
│   ├── ai-assisted/
│   │   ├── estimators.js                 interactions-based, LoC-based, manual daily %
│   │   └── structural.js                 factor computation, projection (shrink model)
│   ├── agentic/
│   │   ├── estimators.js                 duration-based, LoC-based
│   │   └── structural.js                 factor computation, projection (scale model)
│   └── leverage.js                       rectangle geometry, counterfactual, integrated aggregation
│
└── components/                        Shared React components
    ├── Chart.js                          Highcharts wrapper
    ├── KpiCard.js                        KPI display (with hero variant)
    ├── DefinitionCard.js                 BVE terminology card
    ├── UploadPanel.js                    File upload with pluggable detectors
    ├── DevSearch.js                      Developer search/overlay
    ├── ConfigPanel.js                    Config editor with pluggable fields
    ├── SourceSummary.js                  Data load status banner
    ├── SectionHeader.js                  Section title + description
    ├── Panel.js                          Collapsible section
    └── DataCoveragePanel.js              Lineage summary panel
```

### 4.2 Config registry

A single source of truth for config defaults, resolving the current divergences:

```javascript
export const CONFIG_REGISTRY = {
  cfg_total_developers:           { default: 100,  type: 'org',        label: 'Total Developers' },
  cfg_workdays_per_week:          { default: 5,    type: 'org',        label: 'Workdays per Week' },
  cfg_labor_cost_per_hour:        { default: null,  type: 'org',        label: 'Labor Cost ($/hr)' },
  cfg_pct_time_coding:            { default: 0.5,  type: 'org',        label: '% Time Coding' },
  est_interactions_per_hour:      { default: 20,   type: 'ai-assisted', label: 'Interactions per Hour' },
  est_hrs_per_kloc:               { default: 2,    type: 'shared',     label: 'Hours per KLoC' },
  cfg_time_saved_pct_day:         { default: null,  type: 'ai-assisted', label: 'Time Saved % / Day' },
  cfg_baseline_hours_per_dev_per_week: { default: null, type: 'ai-assisted', label: 'Baseline Hrs/Dev/Week' },
  est_duration_factor:            { default: 2,    type: 'agentic',   label: 'Duration Multiplier' },
  cfg_total_repos:                { default: null,  type: 'agentic',   label: 'Total Repos' },
  cfg_pr_assist_lookback_days:    { default: 3,    type: 'structural', label: 'PR-Assist Lookback Days' },
};
```

### 4.3 Calculation trace pattern

Live calculation functions return `{ result, trace }` to support the dataflow drill-down:

```javascript
export function durationBasedHours(prSessions, config) {
  const multiplier = config.est_duration_factor || 2;
  const withDuration = prSessions.filter(pr => pr.duration_minutes != null);
  const totalMinutes = withDuration.reduce((s, pr) => s + pr.duration_minutes, 0);
  const result = totalMinutes * multiplier / 60;

  return {
    result,
    trace: {
      method: 'duration',
      label: 'Duration-Based',
      formula: 'sum(duration_minutes) × est_duration_factor / 60',
      inputs: {
        prs_with_duration: withDuration.length,
        total_minutes: totalMinutes,
        est_duration_factor: multiplier,
      },
      result,
    },
  };
}
```

---

## 5. Dataflow Dashboard

### 5.1 Two-layer interaction model

**Layer 1 — The Map:** A box-and-line diagram showing the full pipeline. Queries → JSON files → materialized artifacts → dashboards → sections/overlays. Each box shows summary info (name, size, date, status). Lines carry annotations (record counts, data flow).

**Layer 2 — The Territory:** Clicking any box opens a contextual profile/reconciliation panel:

| Box type | Drill-down shows |
|---|---|
| **Query script** | Parameters used, date range, repo scope, API pagination, completeness |
| **Raw JSON file** | Record counts, date range, unique entities, status breakdown |
| **Materialized artifact** | Profile from artifact header (dedup stats, join coverage, filter counts, warnings) |
| **Dashboard** | Artifacts loaded, config applied, processing pipeline |
| **Section/overlay** | Formula, actual input values, config keys, result, alternative method comparison |

### 5.2 Visual vocabulary

- **Solid-border boxes** = materialized artifacts and files (profilable, cacheable)
- **Dashed-border boxes** = live calculations (config-reactive, traceable)
- **Green/yellow/red borders** = collection status (success/partial/failed)
- **Lines** carry record counts and data-flow annotations

### 5.3 Collections history

Above the flow diagram, a timeline of query runs showing timestamp, profile, target results, and date window. Selecting a historical run shows that run's parameters and scope.

---

## 6. Migration Plan

### 6.1 Phase 1: Build the Pipeline (No Dashboard Changes)

Everything in this phase is additive. No existing file is modified.

**Step 1.1 — Extract shared modules.** Create `shared/` by extracting functions from existing `src/` directories and `index.html` files. The source of truth for each function is the `index.html` version (what users actually see), validated against the `src/` version where both exist. Resolve divergences (e.g., `safeDiv` behavior: adopt `b > 0`, rejecting negative denominators).

**Step 1.2 — Build the materializer script.** `scripts/materialize.js` reads raw JSON files, calls shared modules, writes 4 artifact files to `_data/` with standard envelopes, writes `_data/pipeline-manifest.json`.

**Step 1.3 — Write equivalence tests.** For each artifact, load the same fixture data, process through the old path (copy of current inline processing) and the new path (shared modules), assert outputs match field-by-field. This is the critical risk-reduction step.

**Step 1.4 — Build the dataflow dashboard.** `dashboard/dataflow/index.html` reads the pipeline manifest and renders the box-and-line flow with clickable artifact profiles. Start simple: CSS grid + SVG lines, inline expand for profiles.

**Phase 1 produces:** shared modules with tests, materializer script, 4 artifact files, equivalence tests, dataflow dashboard. Zero existing files modified. `npm test` still passes.

### 6.2 Phase 2: Migrate Dashboards (One at a Time)

Migration order, least risk first:

| Order | Dashboard | Rationale |
|---|---|---|
| 1 | AI-Assisted Efficiency | Most mature `src/` and tests. Simplest data needs (1 artifact). |
| 2 | Agentic Efficiency | Same section structure. Also has `src/` and tests. Uses 2 artifacts. |
| 3 | AI-Assisted Structural | More complex joins. Has `src/` but inline diverges. Migration fixes the divergence. |
| 4 | AI-Assisted Element | Complex leverage logic. No current tests — migration creates them. |
| 5 | Agentic Element | Same pattern as #4. |
| 6 | Integrated | Depends on all artifacts. Last because it consumes everything. |

**Per-dashboard migration pattern (4 sub-steps):**

**Sub-step A — Add artifact loader alongside existing code.** The dashboard tries to load from a materialized artifact first, falls back to existing raw-file processing. Old path remains untouched.

**Sub-step B — Move live calculations to shared modules.** Replace inline estimation/projection/leverage code with imports from `shared/calculations/`. Functions return `{ result, trace }` for dataflow drill-down.

**Sub-step C — Write visual equivalence tests.** For each chart/KPI, verify that artifact + shared calculation produces the same values as the old inline code with the same config.

**Sub-step D — Remove old inline processing.** Once equivalence is verified, remove the inline flatten/dedup/derive code. The upload path uses the shared materializer in-browser, producing the same artifact shape. Add the Data Coverage panel showing the artifact profile.

**Partial migration is a valid stable state.** The system works with a mix of migrated and unmigrated dashboards. Each dashboard can be shipped independently after its sub-step D.

### 6.3 Phase 3: Enhance the Dataflow Dashboard

Once dashboards emit trace objects from live calculations:

**Step 3.1 — Dashboards export lineage.** Each migrated dashboard writes or holds a lineage record: artifacts loaded, config applied, per-section calculation traces.

**Step 3.2 — Dataflow page gains section drill-down.** Section/overlay boxes in the flow diagram link to the trace data. Clicking shows formula, inputs, config, result.

**Step 3.3 — Visual distinction.** Solid boxes for materialized artifacts, dashed boxes for live calculations. The materialization boundary is visually explicit.

---

## 7. Visualization Inventory

### 7.1 Summary

109 visualizations across 7 dashboards (29 KPI cards, 43 charts, 11 tables, 9 donuts, 17 controls), all fed by 4 materialized artifacts plus live config-driven calculations.

### 7.2 Config-dependent calculations (live, not materialized)

**Estimation methods:**

| Method | Element | Formula | Config keys |
|---|---|---|---|
| Interactions-Based | AI-Assisted | `interactions / est_interactions_per_hour` | `est_interactions_per_hour` |
| LoC-Based | AI-Assisted | `(loc_added / 1000) × est_hrs_per_kloc` | `est_hrs_per_kloc` |
| Manual Daily % | AI-Assisted | `(pct × coding_time × baseline / workdays) × DAU` | `cfg_time_saved_pct_day`, `cfg_baseline_hours_per_dev_per_week`, `cfg_workdays_per_week`, `cfg_pct_time_coding` |
| Duration-Based | Agentic | `sum(duration_min) × est_duration_factor / 60` | `est_duration_factor` |
| LoC-Based | Agentic | `sum(merged_loc / 1000) × est_hrs_per_kloc` | `est_hrs_per_kloc` |

**Leverage geometry:**

| Calculation | Element | Formula | Config keys |
|---|---|---|---|
| Active Dev-Hours | AI-Assisted | `sum(DAU × cfg_pct_time_coding × 8)` | `cfg_pct_time_coding` |
| Est. Human Dev-Hours | Agentic | Selected estimation method output | `est_duration_factor` or `est_hrs_per_kloc` |
| Current Leverage | Both | `completions / dev-hours` | via dev-hours config |

**Structural projections:**

| Factor | Element | Projection model |
|---|---|---|
| Adoption, % PRs Assisted, % AI-Assisted LOC | AI-Assisted | **Shrink:** same completions, fewer dev-hours. `improved_hrs = max(dev_hrs - potential, 0)` |
| Adoption, Merge Rate, Repo Coverage | Agentic | **Scale:** more completions and dev-hours at same leverage. `projected = current × (1/factor)` |

The two models are correct for their respective elements: AI-Assisted makes human devs faster (efficiency gain), Agentic adds autonomous capacity (volume scaling). Both should be documented and explained in the dashboard UI.

### 7.3 Cross-dashboard artifact sharing

```
ai-assisted-efficiency-days ──┬── AI-Assisted Efficiency (all sections)
                              ├── AI-Assisted Element (estimates, insights trends)
                              └── Integrated (AI element dev-hours)

ai-assisted-structural-days ──┬── AI-Assisted Structural (all sections)
                              ├── AI-Assisted Element (factor donuts, completions, insights trends)
                              └── Integrated (AI element structural factors)

agentic-efficiency-days ──────┬── Agentic Efficiency (all sections)
                              ├── Agentic Element (factor donuts, insights trends)
                              └── Integrated (Agentic element adoption)

agentic-pr-sessions ──────────┬── Agentic Efficiency (Confidence section)
                              ├── Agentic Element (leverage rectangle, completions)
                              └── Integrated (Agentic element dev-hours, completions)
```

---

## 8. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Shared module has different behavior than inline code | Equivalence tests compare field-by-field against current output |
| Dashboard breaks during migration | Sub-step A adds artifact path alongside — old path remains until Sub-step D |
| Upload stops working | Upload path uses same shared materializer; tested separately |
| Build pipeline produces wrong artifacts | Artifact tests against fixture data; `npm run verify:all` extended |
| Dataflow dashboard shows wrong profiles | Profile data comes from artifact headers written by tested materializers |
| Migration takes too long | Each dashboard is independent; partial migration is a stable state |
| New element added during migration | New elements use shared modules from the start |

---

## 9. Definition of Done

The migration is complete when:

1. All 7 dashboards load from materialized artifacts (4 files)
2. All live calculations use shared modules with trace returns
3. The dataflow dashboard shows the full pipeline with clickable drill-down
4. `npm test` covers shared modules, materializers, equivalence, and visual equivalence
5. Upload path uses shared materializer in-browser
6. Old inline processing code is removed from all `index.html` files
7. Stale files cleaned up
8. Config defaults are canonical (single source in `shared/core/config.js`)
9. `dependencies/README.md` and `docs/` updated to reflect new architecture
