# Design Decisions

Deliberate choices in how BVE measures and reports value, with the reasoning
behind them. Change these only with an explicit design discussion.

## Developer population (`cfg_total_developers`) is configured, not measured

**Decision.** The total developer population used as the denominator for
adoption rates, org capacity and projections is a **customer-supplied value**
(`cfg_total_developers` in `dashboard-config.json`). The pipeline does not
derive it from GitHub data.

**Why.** GitHub cannot observe the population this number describes:

- **Not all developers are in GitHub.** Engineers who work in other source
  control systems, on other GitHub instances, or who have not been onboarded
  yet are part of the organisation's development capacity but produce no
  GitHub signal.
- **Not all GitHub users are developers.** Org membership includes product
  managers, designers, support staff, contractors with read access, service
  accounts and inactive accounts. One downstream deployment reported
  ~9,800 org members against ~3,800 developers.
- **Activity-based counts measure the numerator, not the denominator.**
  Distinct PR authors or committers over a window count people who were
  *active in GitHub*. Using that as the denominator would make adoption look
  higher simply because non-adopters outside GitHub disappear from the base,
  and it would move from run to run with seasonality and window length.

The question the dashboards answer is *"what share of our development
capacity is using AI, and what is it worth?"* Only the organisation knows its
development capacity, so it supplies it.

**What the pipeline does measure** (and uses as numerators or filters):

| Value | Source | Used for |
|---|---|---|
| Copilot active users per day | Copilot usage metrics report | Adoption numerator |
| Active developers / PR authors | PR collectors, `leverage-summary`, `ai-assisted-structural-days` | Per-developer averages, structural factors |
| Org members | `org-members.sh` | Filtering bots and non-members only; **not** a developer count |

**Guidance for setting the value.**

- Use the engineering headcount that the ROI claim is about, typically the
  number of people in developer roles, whether or not they use GitHub.
- If you only want to report on GitHub users, say so explicitly when
  presenting results; the dashboards label the value "Total Developers".
- Revisit it when headcount changes materially. It directly scales
  hours-saved and dollar figures, so an out-of-date value produces a
  confidently wrong number rather than an error.
- Record where the number came from (HR system, date) alongside your
  deployment so reviewers can audit it.

**Related.** The provenance and sensitivity of the remaining `cfg_*` and
`est_*` constants is tracked in #64. See
[getting-started.md](getting-started.md#step-4-configure-dashboard-parameters)
for the full parameter list. Raised in #59 (§1.6).
