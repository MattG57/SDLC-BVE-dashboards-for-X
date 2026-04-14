# Improvement Analysis Pattern

This document defines the analytical framework that underlies all dashboards. It describes the three lenses of improvement analysis (efficiency, structural, leverage), the 6-section narrative that any element of leverage follows, and how these combine into reusable page templates.

---

## 1. Three Analytical Lenses

Improvement can be analyzed through three lenses. Each answers a different kind of question. Each can be applied at any scope — a single workflow, an element of leverage, a group of elements, or the whole org.

### Efficiency: the "within" view

Efficiency looks at improvement **within** a workflow — how the actors doing the work are performing, how much time they spend, how productive each unit of effort is, and how that changes over time.

It asks: **Given this workflow, how well is each unit of effort converting into results?**

Key questions:
- How much time is being consumed per completion?
- What is the rate of output per active participant?
- What activity patterns drive higher or lower throughput?
- Where are the time sinks and bottlenecks within the workflow?

Efficiency analysis surfaces **driver metrics** (interactions per dev, sessions per dev, LoC per dev) and **impact estimates** (hours saved, economic value). It explains the performance of the workflow from the perspective of the participants.

Efficiency is about **intensity and productivity** of the work being done.

### Structure: the "across" view

Structure looks at improvement **across** the population — how broadly the workflow is adopted, how consistently it is used, how evenly it covers the scope it should cover, and where the structural gaps are.

It asks: **Of all the people, repos, and work that could benefit from this workflow, how much actually does?**

Key questions:
- What percentage of developers have adopted the tool/practice?
- What percentage of eligible work (PRs, repos, reviews) is covered?
- How consistent is usage over time and across teams?
- Where are the biggest structural gaps — who or what is missing?
- What would change if structural factors reached full coverage?

Structural analysis surfaces **completeness metrics** (adoption %, PRs assisted %, repo coverage %), **consistency metrics** (standard deviation, control limits, outlier days), and **prioritization metrics** (gap to full adoption, opportunity ranking). It explains the reach and evenness of the workflow.

Structure is about **coverage and distribution** of the improvement.

### Leverage: the normalized view

Leverage normalizes the relationship between dev-hours (input) and completions (output) into a single ratio that can be compared across elements, scopes, and time periods — regardless of whether the improvement mechanism is efficiency, structure, yield, or elimination.

It asks: **How many valid completions does this scope produce per dev-hour, and how would that change with improvement?**

Key properties:
- Leverage = completions / dev-hours. It is dimensionless and comparable.
- The leverage rectangle visualizes this: width = dev-hours, height = completions, slope = leverage.
- Projections show how leverage changes when structural factors or efficiency improve.
- Counterfactuals show what the leverage would be without the improvement.
- Integration aggregates multiple elements into a combined leverage view — total completions / total dev-hours.

Leverage is the **common currency** that makes different improvement types and scope levels comparable. An efficiency improvement and a structural improvement both change leverage — the rectangle just changes shape differently.

### How the three lenses relate

```
                        ┌─────────────────────────────┐
                        │        LEVERAGE              │
                        │   (normalized, comparable,   │
                        │    works at any scope)       │
                        └──────────┬──────────────────┘
                                   │
                    ┌──────────────┼──────────────────┐
                    │              │                   │
             ┌──────▼──────┐ ┌────▼─────────┐  ┌─────▼────────┐
             │  EFFICIENCY  │ │  STRUCTURE   │  │   YIELD /    │
             │  (within)    │ │  (across)    │  │   LOSSES     │
             │              │ │              │  │              │
             │  How well is │ │ How broadly  │  │ How much of  │
             │  effort      │ │ is the       │  │ the output   │
             │  converting? │ │ improvement  │  │ is valid?    │
             │              │ │ reaching?    │  │              │
             └──────────────┘ └──────────────┘  └──────────────┘
```

Efficiency and structure are the two primary analytical lenses — the "within" and "across" views. Yield/losses is a third dimension (what fraction of output actually counts). Leverage sits above all three as the normalized integration point.

**Any dashboard can apply any combination of lenses.** An element analysis page uses all three. An efficiency-focused page goes deep on the "within" view. A structural page goes deep on the "across" view. The integrated page uses leverage to combine multiple elements at the org level.

---

## 2. Leverage as a Multi-Level Normalizer

Because leverage is a ratio (completions / dev-hours), it can be computed at any scope:

| Scope | Dev-hours | Completions | Leverage meaning |
|---|---|---|---|
| **Single developer** | That dev's active hours | That dev's merged PRs | Individual productivity |
| **Single element** | All dev-hours in this workflow | All completions from this workflow | Element-level efficiency + structure |
| **Group of elements** | Sum of element dev-hours | Sum of element completions | Cross-element comparison |
| **Whole org** | Total represented capacity | Total completions | Org-wide integrated leverage |

The leverage rectangle works at every level:
- At the **element level**, it shows one workflow's conversion efficiency
- At the **per-dev level** (diagnostic rectangle), it compares individual developers against org average
- At the **integrated level**, it shows multiple elements as sub-rectangles within a combined rectangle

Projections also work at every level:
- Element-level: "If adoption reaches 100%, this element's leverage would be..."
- Integrated-level: "If all elements' structural factors improve, org-wide leverage would be..."

This is what makes leverage the right integration point for the dashboard system. It doesn't privilege any improvement mechanism over another. An efficiency gain and a structural gain both move the rectangle — just in different directions.

---

## 3. The 6-Section Analysis Pattern

Every element of leverage can be analyzed through a 6-section narrative that moves from definition through diagnosis to actionable projection. Each section answers one question from the BVE framework.

### Section 1: DEFINE

**Question:** What is the job to be done, what counts as a completion, and what class of job is it?

**Lens:** None — this is definitional grounding.

**Components:** 3 × DefinitionCard (job, completion, class). Static text, no data dependency.

Every element has a job, a completion, and a class. This section anchors the analysis.

### Section 2: MEASURE

**Question:** How much dev time does this element consume, how many completions does it produce, and what is the current leverage?

**Lens:** Leverage (normalized measurement).

**Components:** KPI cards (Dev-Hours, Completions, Current Leverage, Hours/Completion), estimation method selector, LeverageRectangleChart (existing rectangle only — no projections yet).

This section establishes the baseline. The leverage rectangle shows the current shape. The estimation methods let the user explore different ways to quantify dev-hours.

### Section 3: DIAGNOSE

**Question:** Why is leverage limited? What is constraining this workflow?

**Lens:** Structure (across) + Yield.

**Components:** Structural factor donuts (adoption, coverage, consistency), completion yield breakdown (valid/failed/false/missed), quality signal KPIs (merge rate, changes requested, rework).

This section decomposes the leverage measurement into its constraints. The structural factors show the "across" gaps (who/what isn't covered). The yield signals show the "within" quality gaps (what fraction of output actually counts).

### Section 4: EXPLAIN

**Question:** What drives current performance? What are the activity patterns, distributions, and anomalies?

**Lens:** Efficiency (within) + Structure (across), at daily/per-dev granularity.

**Components:** DevSearch + smoothing toggle, driver trend charts (per-dev activity signals), per-dev distribution bar chart, structural factor daily trends, correlation scatter charts, control charts, diagnostic per-dev leverage rectangle.

This section provides the causal depth behind Section 3. While Diagnose says "adoption is 12%," Explain shows the daily trend, the per-dev variation, and the relationship between structural coverage and output volume. The "within" view (driver trends) and "across" view (structural trends, consistency) are presented side by side.

### Section 5: PROJECT

**Question:** What would improve if structural factors changed? What scenarios are plausible?

**Lens:** Leverage (projection at element level).

**Components:** Structural factor selector → projection overlay on leverage rectangle, counterfactual overlay, improvement mechanism label, scenario delta (current → projected KPIs).

This section is where the analysis becomes actionable. It shows how leverage would change under specific structural improvements, names the mechanism of change, and quantifies the delta.

Each element defines its projection model and counterfactual type:

| Projection model | Geometric effect | Improvement mechanism |
|---|---|---|
| **Shrink** | Same completions, fewer dev-hours (narrower rectangle, steeper slope) | Efficiency improvement — the workflow does the same work faster |
| **Scale** | More completions + more dev-hours at same slope (bigger rectangle) | Volume scaling — the workflow adds new capacity |
| **Yield** | Same dev-hours, more valid completions (taller rectangle, steeper slope) | Yield improvement — more output passes quality bar |

### Section 6: TRANSLATE

**Question:** What does improvement mean in hours, dollars, capacity freed, business outcomes?

**Lens:** Leverage (translation to org impact).

**Components:** Economic value KPI, capacity freed KPI, FTE equivalent, aperture contribution (% of org total), business outcome mapping.

This section bridges from element-level leverage to org-level impact.

---

## 4. Page Types

### Element Analysis Page

The primary page type. One per element of leverage. Follows the full 6-section narrative.

An element is fully defined by a configuration object — definition text, estimation methods, structural factors, driver series, projection model, counterfactual type, improvement mechanism. The page template is shared; only the configuration differs.

### Org-Level Leverage Page

The integration page. Shows leverage across all elements.

Answers the org-level questions: aperture (how much capacity is represented), allocation (how is it distributed), current shape (what's the combined leverage), room for improvement (where are the biggest gaps), and business translation (what does improvement mean).

Uses the leverage rectangle at the integrated level — multiple element sub-rectangles within a combined rectangle. Each sub-rectangle is clickable to drill into the element analysis page.

### Depth Views (Optional)

An efficiency-focused view or a structural-focused view can exist as expanded versions of specific analysis sections:

| Depth view | Sections expanded | Purpose |
|---|---|---|
| Efficiency depth | Sections 2 + 4 + 6 (Measure, Explain, Translate) | Deep-dive on driver patterns, estimation method comparison, reconciliation, economic value |
| Structural depth | Sections 3 + 4 (Diagnose, Explain) | Deep-dive on completeness, consistency, prioritized improvements, correlation analysis |

These are not separate page types with separate code. They are the same sections from the element page, rendered with more detail enabled (additional charts, tables, reconciliation panels).

### Dataflow Page

The operational/diagnostic page. Shows the data pipeline, collection history, artifact profiles, and calculation traces. Not part of the analysis pattern — it's the "meta" view of the system itself.

---

## 5. How This Applies to Current and Future Elements

### Current elements

| Element | Efficiency (within) view | Structure (across) view | Leverage view |
|---|---|---|---|
| **AI-Assisted Coding** | Hours saved per dev, interaction/suggestion/acceptance patterns, acceptance rate | Adoption %, PRs assisted %, AI-assisted LoC %, consistency, prioritization | Shrink projection: same output, less time. Counterfactual: wider rectangle. |
| **Agentic AI Coding** | Agent session duration, PRs per dev, merge rate, turbulence signals | Adoption %, merge rate %, repo coverage % | Scale projection: more output at same leverage. Counterfactual: origin. |

### Future elements (illustrative)

| Element | Efficiency (within) view | Structure (across) view | Leverage view |
|---|---|---|---|
| **PR Review** | Review time per PR, comments per review, approval latency, re-review rate | Reviewer coverage %, review-response time consistency, stale review rate | Shrink: same reviews completed faster. |
| **Onboarding** | Time-to-first-PR, mentoring hours per new dev, ramp-up trajectory | Onboarding program coverage %, consistency across teams | Yield: more new devs reaching productive contribution. |
| **CI/CD** | Build time, test time, deploy frequency, rollback rate | Pipeline coverage %, flaky test rate, environment consistency | Shrink: same deploys, less waiting. Yield: fewer failed deploys. |
| **Vulnerability Remediation** | Time-to-fix per vuln, remediation hours, re-open rate | Scanner coverage %, priority coverage %, false positive rate | Yield: more valid fixes. Elimination: fewer false positives to triage. |

Each element fills in the same 6-section template with its own efficiency metrics, structural factors, driver series, and projection model. The analytical pattern is the same; the data bindings differ.

---

## 6. Relationship to the Pipeline Architecture

The 6-section analysis pattern aligns cleanly with the materialization boundary:

| Analysis section | Data source | Materialized or live? |
|---|---|---|
| 1. Define | Element configuration object | Static (no data) |
| 2. Measure | Materialized artifact (dev-hours, completions) | Materialized base + live estimation |
| 3. Diagnose | Materialized artifact (structural factors, yield signals) | Materialized |
| 4. Explain | Materialized artifact (per-dev records, daily trends) | Materialized |
| 5. Project | Materialized structural factors + live projection model | Materialized base + live projection |
| 6. Translate | Live calculation from Sections 2 + 5 + config | Live |

Sections 1–4 are primarily driven by materialized data (observed, deterministic). Sections 5–6 are primarily driven by live calculations (config-dependent, interactive). This matches the pipeline architecture's principle: materialize observed data, compute interpretations live.

---

## 7. Element Configuration Schema

An element is fully defined by:

```javascript
{
  // Identity
  name: 'AI-Assisted Coding',
  slug: 'ai-assisted-coding',

  // Section 1: Define
  definition: {
    job: 'Produce code changes with AI assistance across the SDLC',
    completion: 'Merged pull request by a developer who used Copilot',
    class: 'value-creating',   // value-creating | risk-reducing | non-value-creating
  },

  // Section 2: Measure
  devHours: {
    label: 'Active Dev-Hours',
    formula: 'daily_active_users × cfg_pct_time_coding × 8',
    meaning: 'Human time spent coding with Copilot',
  },
  completions: {
    label: 'Completions (Merged PRs)',
    meaning: 'Merged PRs by developers who used Copilot',
  },
  estimationMethods: [ /* { key, label, descFn, calc } */ ],

  // Section 3: Diagnose
  structuralFactors: [ /* { key, label, compute, color, detail } */ ],
  yieldSignals: [ /* { key, label, compute } */ ],
  lossSignals: [ /* { key, label, compute } */ ],

  // Section 4: Explain
  driverSeries: [ /* { key, perDev, label, color, scale } */ ],

  // Section 5: Project
  projection: {
    model: 'shrink',              // shrink | scale | yield
    counterfactual: 'wider_rect', // wider_rect | origin | shorter_rect
    mechanism: 'efficiency',      // efficiency | volume | yield | elimination
    explanation: 'AI-assisted coding improves leverage by reducing the time ...',
  },

  // Artifacts consumed
  artifacts: ['ai-assisted-efficiency-days', 'ai-assisted-structural-days'],
}
```

A new element requires writing this configuration object and (if the element introduces a new data source) a new materializer. The page template, chart templates, section templates, and shared components are all reused.
