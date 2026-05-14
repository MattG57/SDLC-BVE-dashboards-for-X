# Agentic AI Coding Card Text Source

Source text for framing cards used by agentic coding views.

Applies to:

- `dashboard/v4/agentic-efficiency/`
-  dashboard/v4/agentic-structural/
- `dashboard/v2/agentic-element/`

---

## Element / Leverage View

Use this wording for element-of-leverage pages.

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Asynchronous use of an Agent to design, implement, and test code changes from a structured description, like GitHub issues`
- **Body:** `Developers assign issues to Copilot, which works on the task and possibly even creates a pull requests for review and merge.`

### What Counts as a Completion

- **Kicker:** `What Counts as a Completion`
- **Title:** `An Copilot-authored PR that gets merged`
- **Body:** `Valid = PR was reviewed and was merged by a human reviewer. Failed = PR closed or abandoned without a merge.`

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Value-creating`
- **Body:** `Completed tasks represent value creation -- shipped code requires completed coding tasks.`

---

## Efficiency View

Use this wording for efficiency pages.

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Asynchronously design, implement, and test code changes from documented requirements like GitHub issues`
- **Body:** `Developers assign issues to Copilot, which works on the task and possibly even creating pull requests for Developers to review and merge.`

### What Counts as a Completion

- **Kicker:** `What Counts as a Completion`
- **Title:** `An Copilot-authored PR that gets merged`
- **Body:** `Valid = PR was reviewed and was merged by a human reviewer. Failed = PR closed or abandoned without a merge.`

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Value-creating (delegated)`
- **Body:** `Valid completions represent value creation -- shipped code requires completed coding tasks.`

### How Efficiency Improves

- **Kicker:** `How Efficiency Improves`
- **Title:** `Copilot Agent Sessions become more reliable and predictable, require fewer Human hours per Session Minute, or incur less compute costs(e.g. require fewer Tokens).`
- **Body:** `Efficiency can lead to 1)fewer dev-hours or lower costs, 2)more Copilot Authored completions over time, 3)the Copilot Authored completions increase in size or complexity, and/or 4) Completions have expanded scope to address tech debt or support new capabilities. `

### Estimates and Assumptions

- **Kicker:** `Estimates and Assumptions`
- **Title:** `Copilot Agent Session logs and statistics provide direct measures of Agent session duration, costs,and failures. Human Efficiency requires estimation.`
- **Body:** `The total hours humans allocated to the area of improvement is estimated using 2 methods. as a flat percentage of the grand total of org dev hours. The saved hours is estimated based on 2 methods. Each of which linearly converts observed activity into hours saved. Confidence increases when both are calibrated and their estimations closely agree. `
- **Card hint or too-tip:** `The estimates require additional configuration before yield or saved dev-hours can be calculated. The side panel shows the current config.`

### Indicators of Progress

- **Kicker:** `Indicators of Progress`
- **Title:** `Efficiency is implied by 4 different metric patterns`
- **Body pattern:** ` Improving Yield, or Improvement based on the following patterns:
  Increased Success/Merge Rate of Agent Session PRs.
  Increased Lines of Code Accepted per Agent Session minute.
  Increased Size of PRs and Minutes per Session.

---

## Structural View

Use this wording for pages focused on structural changes that create value or reduce risk.

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Asynchronously design, implement, and test code changes from documented requirements like GitHub issues`
- **Body:** `Developers assign issues to Copilot, which works on the task and possibly even creating pull requests for Developers to review and merge.`

### What Counts as a Completion

- **Kicker:** `What Counts as a Completion`
- **Title:** `An Copilot-authored PR that gets merged`
- **Body:** `Valid = PR was reviewed and was merged by a human reviewer. Failed = PR closed or abandoned without a merge.`

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Value-creating (delegated)`
- **Body:** `Valid completions represent value creation -- shipped code requires completed coding tasks.`

### How Structural Improvement Improves Outcomes

- **Kicker:** `How Structure Can Improve`
- **Title:** `Higher number of devs benefiting from Agents or higher Agent Session yield, and improving Session efficiency`
- **Body:** `Adoption, Yield, and Applying AI more consistently all improve the impact of Agentic AI Coding.`

### Estimates and Assumptions

- **Kicker:** `Estimates and Assumptions`
- **Title:** `Completeness metrics are used to highlight the opportunity and progress for different structural dimensions`
- **Body:** `Structural progress can be monitored via trends of improvable, or improving: Adoption, Session Yield, Session Efficiency. `

### Indicators of Progress

- **Kicker:** `Indicators of Progress`
- **Title:** `Trends and levels of Adoption and other completeness metrics indicate progress for each structural factor`
- **Body pattern:** `Structural improvements are complete when 100% of developers are using Agentic AI, Yield is improving, and Agentic AI efficiency is improving.`
