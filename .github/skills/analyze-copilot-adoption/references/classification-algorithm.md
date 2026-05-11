# Classification Algorithm Walkthrough

Source: `shared/sources/pr-review.js` — `classifyAssisted()`

## Step-by-Step Example

### Input Data

**Copilot user activity** (from `copilot-user-and-enterprise-metrics.sh`):

| Day | Active Users |
|---|---|
| 2024-01-13 | alice, bob |
| 2024-01-14 | alice, carol |
| 2024-01-15 | bob, dave |

**Merged PRs** (from `human-pr-metrics.sh`):

| PR | Author | Merge Day | Additions |
|---|---|---|---|
| #101 | alice | 2024-01-15 | 200 |
| #102 | bob | 2024-01-15 | 150 |
| #103 | eve | 2024-01-15 | 300 |
| #104 | carol | 2024-01-15 | 100 |

### Classification (lookbackDays = 3)

**PR #101 — alice, merged 2024-01-15**
- Check 2024-01-15: alice NOT in {bob, dave} → continue
- Check 2024-01-14: alice IN {alice, carol} → **ASSISTED** ✅

**PR #102 — bob, merged 2024-01-15**
- Check 2024-01-15: bob IN {bob, dave} → **ASSISTED** ✅

**PR #103 — eve, merged 2024-01-15**
- Check 2024-01-15: eve NOT in {bob, dave} → continue
- Check 2024-01-14: eve NOT in {alice, carol} → continue
- Check 2024-01-13: eve NOT in {alice, bob} → **UNASSISTED** ❌

**PR #104 — carol, merged 2024-01-15**
- Check 2024-01-15: carol NOT in {bob, dave} → continue
- Check 2024-01-14: carol IN {alice, carol} → **ASSISTED** ✅

### Result for 2024-01-15

```json
{
  "total_prs": 4,
  "assisted_prs": 3,
  "total_loc": 750,
  "assisted_loc": 450,
  "pr_assist_rate": 0.75,
  "loc_assist_rate": 0.60
}
```

## Edge Cases

### Author with no Copilot activity at all
If a PR author never appears in the Copilot user data (across all days), they are always "unassisted."

### PR merged on a day with no Copilot data
If `copilotUsersByDay` has no entry for the merge day or any lookback day, the PR is "unassisted." This can happen at the edges of the data collection window.

### Non-merged PRs
Only merged PRs are classified. Non-merged PRs are skipped entirely by the `if (!pr.day || !pr.merged) continue` guard.

### lookbackDays = 0
Setting `cfg_pr_assist_lookback_days: 0` would only check the exact merge day. The loop runs `for (let i = 0; i < lookbackDays; i++)`, so with 0 it checks no days and all PRs would be unassisted. The default (3) is recommended.

## Implementation Notes

- The `dayOffset(day, -i)` utility from `shared/core/math.js` handles date arithmetic
- The lookback window is applied to the PR's merge date (from `pr.day`), not its creation date
- LoC is computed as `additions + deletions` for each PR
- The classification is deterministic — same inputs always produce the same output
