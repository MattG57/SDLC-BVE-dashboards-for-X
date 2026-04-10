Step proposal: Add Leverage Insights (detailed view) that mirrors Leverage Summary and replaces Efficiency + Improvement Opportunities

1) Intent (what this step accomplishes)

• Keep the page Leverage-first, but add a second module that answers:
“What changed day-to-day, and how does an individual compare to the average?”
• Replace the current Efficiency and Improvement Opportunities sections with a single, coherent Leverage Insights section.

───

2) Page layout (new structure)

A) Leverage Summary (existing)

• KPI tiles (period aggregates)
• Estimate method selector + structural projection selector
• Central Leverage Rectangle (org/period shapes: existing / counterfactual / projected)

B) Leverage Insights (new, detailed; collapsed by default or below summary)

Header row:

• Title: Leverage Insights
• Subtitle: “Daily trends + developer overlay. (Trends are signals; estimates are aggregate.)”
• Developer search box (same interaction model as Efficiency dashboard)
  • Selecting a developer overlays dashed series on all charts
  • Clear button resets to org-only

Replicated central graphic:

• A second Leverage Rectangle, but in “diagnostic mode”:
  • Default shows the same org/period shapes as Summary (for continuity)
  • Adds a developer point (scatter marker) computed for the selected dev over the same period window
  • Tooltip: dev’s completions, dev-hour proxy, leverage, and % coverage (adoption/PR assisted/AI-LOC)
Note: this is not “hours saved per dev/day.” It’s leverage as a point from measurable/defensible components.
───

3) What Leverage Insights displays (daily trend panels)

Panel set (each is a daily time series with org average + optional dev overlay)

Efficiency/Activity signals (not “hours saved” at day/dev level)

1. Interactions / active dev
2. Suggestions / active dev
3. Accepts / active dev
4. AI-LOC added / active dev (or LOC/10 per dev as in existing dashboards)

Structural factors
5) Adoption % (daily active / eligible, and/or rolling-28 adopter rate if you want both)
6) % PRs Assisted (daily or rolling)
7) % AI-Assisted LOC

Completions + “incompletions”
8) Completion-attempts (daily)
9) Valid completions (daily) — or “Completions (merged PRs)” until validity exists
10) Incompletions (daily) as a stacked breakdown (pick initial proxies):

• Abandoned attempts (PRs closed w/o merge)
• Reopened PRs
• Reverts within N days (if available)
• “High churn” PRs (e.g., changes-requested count above threshold)

Each chart supports:

• 7-day smoothing toggle
• hover tooltip showing org vs dev values
• click-to-drill (optional later): open PR list for that day

───

4) Metric definitions (so it’s implementable)

Developer overlay mechanics (consistent across charts)

• Org line: “per active dev” or “% of total” depending on metric
• Dev line: dev’s daily value (or null if no data that day)
• Period window: same as Summary (e.g., last 28 days)

Developer leverage point on rectangle

Compute a dev’s point for the window:

• X = dev-hour proxy for window (baseline hours × active days, or other chosen proxy)
• Y = completions (merged PRs) for window (or valid completions when modeled)
• Leverage = Y / X
• Optional color/size encodes coverage (adoption consistency, % PR assisted, etc.)

───

5) What this replaces (explicitly)

• Remove/demote existing Efficiency section: its job becomes the efficiency signal trend panels + developer overlay.
• Remove/demote existing Improvement Opportunities section: its job becomes:
  • either a small “Next best lever” card near Summary, or
  • a drilldown off the Insights trends (not a long table on the page).

───

6) Acceptance criteria (tight)

• Leverage Insights renders with no developer selected (org daily trends).
• Selecting a developer:
  • overlays dashed series on all Insight charts
  • adds a developer point on the replicated leverage rectangle

No chart claims “hours saved per dev/day” as a measured quantity; anything in hours is labeled aggregate/attribution if shown.

───


For “incompletions,” the  V1 proxy is 

• (A) PRs closed without merge  maybe add  reopened PRs later (easy, GitHub-native)
