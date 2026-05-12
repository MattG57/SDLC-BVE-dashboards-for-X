# AI-Assisted Coding Card Text Source

Source text for framing cards used by AI-assisted coding views.

Applies to:

- `dashboard/v4/ai-assisted-efficiency/`
- `dashboard/v3/ai-assisted-structural/`
- `dashboard/v2/ai-assisted-element/`

---

## Element / Leverage View

Use this wording for element-of-leverage pages where completion means shipped output.

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Write and ship code faster with AI assistance`
- **Body:** `Developers use GitHub Copilot to generate, complete, and iterate on code within their editor and PR workflow.`

### What Counts as a Completion

- **Kicker:** `What Counts as a Completion`
- **Title:** `A PR merged by a Copilot-active developer`
- **Body:** `Valid = PR achieved its purpose (shipped a working change). Failed/flawed = reverted PRs or PRs requiring significant rework.`

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Value-creating`
- **Body:** `Valid completions directly produce desired output -- shipped code that moves the product forward.`

---

## Efficiency View

Use this wording for efficiency pages where the task boundary is the coding task itself and the main question is how many saved dev-hours are implied relative to dev-hours invested.

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Produce code changes with AI assistance`
- **Body:** `Developers use GitHub Copilot to generate, complete, and iterate on code within their editor and pull request workflow.`

### What Counts as a Completion

- **Kicker:** `What Counts as a Completion`
- **Title:** `A PR opened by a Copilot-active developer`
- **Body:** `For this efficiency view, the coding task completes when a developer opens a pull request. Opened-but-never-merged PRs are a potential failed-attempt signal that should be tracked separately in a later enhancement.`
- **Deferred follow-up:** GitHub issue #30 tracks the later enhancement to count opened-but-not-merged PRs as failed attempts.

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Value-creating`
- **Body:** `Valid completions directly produce desired output -- shipped code that moves the product forward.`

### How Efficiency Improves

- **Kicker:** `How Efficiency Improves`
- **Title:** `Higher leverage = more value-creating output per dev-hour invested`
- **Body:** `This view gauges efficiency through the relationship between dev-hours invested, completions produced, and estimated hours saved. Shorter duration can matter, but so can better acceptance, less rework, and more useful output from the same effort.`

### Estimates and Assumptions

- **Kicker:** `Estimates and Assumptions`
- **Title pattern:** `{method label} translates activity into saved dev-hours`
- **Body when configured:** `Saved dev-hours are estimated, not measured directly. The selected method converts observed activity into hours saved, and the capacity framing uses total developers, percent time coding, and baseline work hours.`
- **Body when additional inputs are required:** `The selected estimate needs additional configuration before saved dev-hours can be calculated. The side panel controls the estimate method and the coding-capacity assumptions used for context.`

### Indicators of Progress

- **Kicker:** `Indicators of Progress`
- **Title:** `Efficiency / Activity Signals explain current performance`
- **Body pattern:** `Track per-active-dev activity and output signals such as {interactions} interactions, {acceptance_rate} acceptance, {loc_added} LoC added, and {hours_saved_per_dev_day} estimated hrs/dev/day saved to explain how much value is being created relative to dev-hours invested.`

---

## Structural View

Use this wording for pages whose purpose is to describe structural conditions, coverage, and consistency rather than saved-hour estimates.

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Expand the structural conditions for AI-assisted coding`
- **Body:** `This view examines how broadly and consistently AI-assisted coding is present across developers, pull requests, and lines of code.`

### What Counts as Progress

- **Kicker:** `What Counts as Progress`
- **Title:** `Broader and more consistent evidence of AI-assisted coding`
- **Body:** `Progress appears as higher adoption, higher PR-assisted share, higher AI-assisted LoC share, and more stable day-to-day coverage across the observed population.`

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Structural`
- **Body:** `Structural improvement does not directly create output by itself. It expands the conditions under which efficient work can occur across more developer-hours and more workflows.`

### How Structural Improvement Improves Outcomes

- **Kicker:** `How Structural Improvement Improves Outcomes`
- **Title:** `Same per-developer efficiency reaches more eligible work`
- **Body:** `Structural expansion increases the share of developer activity and pull request work that can benefit from AI assistance. It matters because an efficient practice has more room to contribute.`

### Estimates and Assumptions

- **Kicker:** `Estimates and Assumptions`
- **Title:** `Structural rates are observed from materialized usage and PR evidence`
- **Body:** `These metrics are based on observed adoption, PR classification, and LoC classification. They are structural indicators, not labor-savings estimates.`

### Indicators of Progress

- **Kicker:** `Indicators of Progress`
- **Title:** `Adoption and coverage signals explain current structural reach`
- **Body pattern:** `Track adoption %, PRs assisted %, AI-assisted LoC %, consistency over time, and PR data coverage to explain how broadly AI-assisted coding is embedded.`

