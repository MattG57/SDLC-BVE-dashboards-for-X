---
name: analyze-copilot-adoption
description: >-
  Understand Copilot adoption analysis including PR-assist classification, developer activity detection,
  structural factor computation, and bot filtering. Covers the classifyAssisted lookback window algorithm,
  buildCopilotUsersByDay, BOT_PATTERNS, PR dedup, and per-developer ratio calculations.
  Use when the user says "adoption analysis", "PR assist rate", "who's using copilot", "structural analysis",
  "developer overlay", "bot filtering", "classify assisted", or "copilot active users".
  Do not use for leverage calculations (use compute-leverage-metrics) or pipeline execution
  (use run-bve-pipeline).
---

# Analyze Copilot Adoption

Copilot adoption analysis lives in `shared/sources/pr-review.js`. It classifies PRs as "assisted" or "unassisted" by overlaying Copilot usage data onto PR merge activity.

## Core Algorithm: classifyAssisted

A PR is classified as **"assisted"** if its author was Copilot-active on the PR's merge day or within `lookbackDays` prior days.

### How It Works

```
For each merged PR:
  1. Get the PR's merge day
  2. Check if the PR author appears in copilotUsersByDay on that day
  3. If not found, check each of the previous N days (lookbackDays)
  4. If the author is found in any of those days → PR is "assisted"
  5. Otherwise → PR is "unassisted"
```

### Parameters

| Parameter | Default | Config Key | Description |
|---|---|---|---|
| `lookbackDays` | 3 | `cfg_pr_assist_lookback_days` | Days to look back from PR merge date |

### Why a Lookback Window?

Developers don't use Copilot every single day. A developer might use Copilot on Monday to write code, then open a PR on Wednesday. The 3-day lookback ensures this PR is still classified as "assisted" even though no Copilot activity is recorded on Wednesday specifically.

## Copilot Active User Detection

A developer is considered "Copilot active" on a given day if they have:
- `code_generation_activity_count > 0`, OR
- `user_initiated_interaction_count > 0`

This is implemented in `buildCopilotUsersByDay()`:

```javascript
function buildCopilotUsersByDay(userDays) {
  const map = {};
  for (const u of userDays) {
    if ((u.code_generation_activity_count || 0) > 0 ||
        (u.user_initiated_interaction_count || 0) > 0) {
      if (!map[u.day]) map[u.day] = new Set();
      map[u.day].add(u.user_login);
    }
  }
  return map;
}
```

The output is a map: `day → Set<login>` used by `classifyAssisted`.

## Bot Filtering

Before classification, PRs are filtered to remove bot accounts. The following 11 patterns are matched against PR author logins:

| Pattern | Matches |
|---|---|
| `/\[bot\]$/i` | `dependabot[bot]`, `renovate[bot]` |
| `/-bot$/i` | `my-custom-bot` |
| `/-agent$/i` | `copilot-agent` |
| `/^dependabot$/i` | `dependabot` (without [bot]) |
| `/^github-actions$/i` | `github-actions` |
| `/^renovate$/i` | `renovate` |
| `/^automation/i` | `automation-user`, `automation123` |
| `/^ci-/i` | `ci-runner`, `ci-deploy` |
| `/^service-/i` | `service-account` |
| `/^deploy-/i` | `deploy-bot` |
| `/^od-octodemo-/i` | `od-octodemo-user` |

Any PR whose author matches a bot pattern is excluded from analysis.

## PR Deduplication

PRs are deduplicated by `repository#number` composite key before analysis. The dedup profile tracks:

```json
{
  "before_dedup": 500,
  "after_dedup": 480,
  "duplicates_removed": 20,
  "dedup_key": "repository#number",
  "bots_removed": 15,
  "after_filter": 465,
  "bot_patterns": ["\\[bot\\]$", "-bot$", ...]
}
```

## PR Record Normalization

Raw PR records are normalized via `flattenPrRecord()` into a consistent shape:

| Field | Source |
|---|---|
| `number` | PR number |
| `user` | Author login (handles string and object formats) |
| `day` | Merge date or creation date (YYYY-MM-DD) |
| `additions` | Lines added (default: 0) |
| `deletions` | Lines deleted (default: 0) |
| `state` | PR state |
| `merged` | Boolean merge status |
| `repository` | Full repo name (org/repo) |
| `merged_at` | Merge timestamp |

## Output: classifyAssisted

The function returns:

### `byDay` — Per-day breakdown

```json
{
  "2024-01-15": {
    "total_prs": 10,
    "assisted_prs": 6,
    "total_loc": 5000,
    "assisted_loc": 3200
  }
}
```

### `period` — Period totals

```json
{
  "total_prs": 280,
  "assisted_prs": 168,
  "total_loc": 140000,
  "assisted_loc": 89600
}
```

### `profile` — Classification metadata

```json
{
  "lookback_days": 3,
  "total_merged_prs": 280,
  "assisted_prs": 168,
  "unassisted_prs": 112,
  "unique_pr_authors": 45,
  "unique_copilot_users": 38
}
```

## Structural Metrics Derived from Classification

| Metric | Formula | What It Tells You |
|---|---|---|
| PR Assist Rate | `assisted_prs / total_prs` | What fraction of PRs come from Copilot users |
| LoC Assist Rate | `assisted_loc / total_loc` | What fraction of code comes from Copilot users |
| Author Coverage | `unique_copilot_users / unique_pr_authors` | What fraction of PR authors use Copilot |
| Adoption % | `avg_daily_active_users / cfg_total_developers` | What fraction of all devs use Copilot daily |

## Data Format Detection

The module can detect PR data in multiple formats:
- Flat array of PR objects
- Object with `prs` array
- Object with `pull_requests.prs` nested array

Use `isPrReviewData(obj)` to detect and `extractPrArray(obj)` to extract.

## References

- [Classification algorithm walkthrough](references/classification-algorithm.md)
