# AI-Assisted Coding Card Text Source

Source text for framing cards used by AI-assisted coding views.

Applies to:

- `dashboard/v4/ai-assisted-efficiency/`
- `dashboard/v3/ai-assisted-structural/`
- `dashboard/v2/ai-assisted-element/`

---

## Element of Leverage View

Use this wording for element-of-leverage pages

### Job to Be Done

- **Kicker:** `Job to Be Done`
- **Title:** `Complete a Coding Task with AI assistance`
- **Body:** `Developers use GitHub Copilot to make Coding Tasks more efficient.`

### What Counts as a Completion

- **Kicker:** `What Counts as a Completion`
- **Title:** `A PR opened by a Copilot-active developer`
- **Body:** `Valid = Developer Opened a PR for review. Failed/flawed = reverted PRs or PRs closed without merging.`

### Job Class

- **Kicker:** `Job Class`
- **Title:** `Value-creating`
- **Body:** `Valid completions represent value creation -- shipped code requires completed coding tasks.`

---

## Efficiency View

Use this wording for efficiency pages 

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
- **Body:** `Valid completions represent value creation -- shipped code requires completed coding tasks.`

### How Efficiency Improves

- **Kicker:** `How Efficiency Improves`
- **Title:** `Developers save time completing coding tasks.`
- **Body:** `Efficiency can lead to 1)fewer dev-hours invested, 2)more completions per time period, 3)the completions increase in size or difficulty, and/or 4) expanding the scope to address tech debt `

### Estimates and Assumptions

- **Kicker:** `Estimates and Assumptions`
- **Title:** `Proxy metrics are used to triangulater on saved dev-hours`
- **Body:** `The total hours allocated to the area are estimated as a flat percentage of the grand total of org dev hours. The saved hours is estimated based on 3 methods. Each of which linearly converts observed activity into hours saved. Confidence increases when the all three are calibrated and their predictions closely agree. `
- **Card hint or too-tip:** `The estimates require additional configuration before saved dev-hours can be calculated. The side panel shows the current config.`

### Indicators of Progress

- **Kicker:** `Indicators of Progress`
- **Title:** `Efficiency is implied by 4 different metric patterns`
- **Body pattern:** ` Improving Yield, or Improving Efficiency based on the following patterns:
  Increased AI activity combined with Increased Lines of Code Accepted and Increased Completions.
  Increased AI activity and combined with Increased Lines of Code Accepted and Decreased Area Total Dev hours.
  Increased AI activity and combined with Increased Lines of Code Accepted and Increased Size of Completions.

---

## Structural View

Use this wording for pages focused on structural changes that create value or reduce risk.

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
- **Body:** `Valid completions represent value creation -- shipped code requires completed coding tasks.`


### How Structural Improvement Improves Outcomes

- **Kicker:** `How Structure Can Improve`
- **Title:** `Higher number of devs getting average per-developer efficiency or higher number of completions getting the average per-completion efficiency`
- **Body:** `Adoption, Broader feature usage, and Applying AI more consistently all improve the structural factors that can otherwise limit realized benefit.`

### Estimates and Assumptions

- **Kicker:** `Estimates and Assumptions`
- **Title:** `Completeness metrics are used to highlight the opportunity and progress for different structural dimensions`
- **Body:** `Structural progress can be monitored via trends of improvable, or improving, Adoption, Assisted PRs, Assisted Lines of Code, and Consistency of Usage. `


### Indicators of Progress

- **Kicker:** `Indicators of Progress`
- **Title:** `Trends and levels of Adoption and other completeness metrics indicate progress for each structural factor`
- **Body pattern:** `Structural improvements are complete when 100% of developers are being assisted with AI, Feature usage is sufficiently broad, and a high percentage of attempts that could benefit from AI are shown to be assisted.`

