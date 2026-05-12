# Agentic AI Coding Card Text Source

Source text for framing cards used by agentic coding views.

Applies to:

- `dashboard/v4/agentic-efficiency/`
- `dashboard/v2/agentic-element/`

---

## Element / Leverage View

Use this wording for element-of-leverage pages where completion means merged delegated output.

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Autonomously implement code changes from issue descriptions`
- **Body:** `Developers assign issues to Copilot, which creates pull requests. Humans review and merge.`

### What Counts as a Completion

- **Kicker:** `What Counts as a Completion`
- **Title:** `A Copilot-authored PR that gets merged`
- **Body:** `Valid = PR achieved its purpose and was merged by a human reviewer. Failed = PR closed without merge.`

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Value-creating (delegated)`
- **Body:** `The agent creates code autonomously; humans guide via issue descriptions and review feedback.`

---

## Efficiency View

Use this wording for efficiency pages where the question is how much human-equivalent value the coding agent creates relative to the hours and sessions engaged.

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Produce code changes through delegated agent work`
- **Body:** `Developers delegate implementation work to the coding agent, which creates pull requests that humans review, guide, and merge.`

### What Counts as a Completion

- **Kicker:** `What Counts as a Completion`
- **Title:** `A coding-agent PR session that ends in a merged pull request`
- **Body:** `Attempts are started agent PR sessions. Completions are sessions that end in a merged PR. Closed-without-merge sessions are failed attempts.`

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Value-creating (delegated)`
- **Body:** `The coding agent contributes code autonomously, while humans shape outcomes through issue framing, guidance, review, and merge decisions.`

### How Efficiency Improves

- **Kicker:** `How Efficiency Improves`
- **Title:** `Higher leverage = more merged delegated output per estimated human dev-hour`
- **Body:** `This view gauges efficiency through the relationship between delegated attempts, merged completions, estimated human-equivalent dev-hours, and saved hours. Improvement can come from better yield, better output per session, or less human-equivalent effort per merged result.`

### Estimates and Assumptions

- **Kicker:** `Estimates and Assumptions`
- **Title pattern:** `{method label} translates merged agent activity into saved dev-hours`
- **Body:** `Saved dev-hours are estimated, not measured directly. The selected method converts merged session duration or merged LoC into estimated human-equivalent hours, and the capacity framing uses total developers and baseline work hours.`

### Indicators of Progress

- **Kicker:** `Indicators of Progress`
- **Title:** `Attempts, yield, and agent activity signals explain current performance`
- **Body pattern:** `Track attempts, completions, yield, observed agent hours, requests per active developer, and merged output per active developer to explain how much delegated value is being created relative to estimated human effort.`

