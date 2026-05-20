# Agentic Session Data Collection & Developer Time Modeling

## Overview

This document describes how agentic coding session data is collected from GitHub Actions logs and how developer time spent per session is estimated. The methodology covers data collection, the session model, field definitions, and the developer time estimation formula.

---

## 1. What Is an Agentic Session?

An **agentic session** corresponds to a single PR created by GitHub Copilot coding agent. A session begins when a developer submits a task prompt and ends when the PR is merged, closed, or abandoned.

A session may involve **multiple workflow runs**:
- The **initial run** is named `"Running Copilot coding agent"` or `"Running Copilot cloud agent"`
- Each developer intervention (an `@copilot` comment on the PR) triggers a follow-on run named `"Addressing comment on PR #N"`

The session record **aggregates all runs** for a PR into a single record.

---

## 2. Data Collection

### Script

`BVE-dashboards-for-agentic-ai-coding/data/queries/agent-session-logs.sh`

### Inputs

- **coding-agent-pr-metrics JSON** — produced by the main pipeline, contains one record per closed/merged Copilot PR with PR metadata, diff stats, and guidance counts.

### Process (per session)

1. **Find all workflow runs** for the PR's branch (`per_page=20`), matching:
   - `"Running Copilot coding agent"` / `"Running Copilot cloud agent"` (initial run)
   - `"Addressing comment on PR #N"` (re-invocation runs)
   - Fallback: any workflow name matching `copilot|Copilot|Addressing comment`

2. **Download and extract** the zip log for each run from the GitHub Actions API.

3. **Parse log timestamps** — extract all ISO8601 timestamps from line beginnings of `0_copilot.txt`, sort them, and compute compute time using an awk-based gap analysis.

4. **Extract prompt** from the first run's log using two patterns:
   - **Pattern A (legacy workflow)**: `##[group]Run cat > issue_body.txt << 'EOT'` heredoc block
   - **Pattern B (native coding agent action)**: `Problem statement:` log line

5. **Aggregate across all runs**: sum compute time, tool invocations, copilot responses; take min/max timestamps; collect all run IDs.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `IDLE_THRESHOLD_SECS` | 1800 | Gap threshold for idle detection within a run (rarely triggered) |
| `MAX_SESSIONS` | unlimited | Limit sessions processed (useful for testing) |
| `DELAY_MS` | 500 | Delay between API calls in milliseconds |

---

## 3. Session Model

### Sessions vs Runs

```
Session (one PR lifecycle)
├── Run 1 — compute_minutes   ← agent working on initial task
│   gap                       ← developer reviewing, writing @copilot comment
├── Run 2 — compute_minutes   ← agent addressing feedback
│   gap                       ← developer reviewing again
└── Run N — compute_minutes
```

| Concept | Definition |
|---------|-----------|
| **compute_minutes** | Sum of `total_log_minutes` across all runs (first→last timestamp per run) |
| **idle_minutes** (between runs) | `wall_clock_minutes − compute_minutes` |
| **wall_clock_minutes** | Time from `first_timestamp` of earliest run to `last_timestamp` of latest run |

> **Note:** The `active_minutes`/`idle_minutes` fields within a single run (using `IDLE_THRESHOLD_SECS`) are not meaningful for workflow runs — the longest observed in-run gap is ~8 minutes, well below the 30-minute threshold. All log time within a run is effectively compute time.

---

## 4. Session Record Fields

| Field | Type | Description |
|-------|------|-------------|
| `repo` | string | `owner/repo` |
| `pr_number` | int | PR number |
| `head_ref` | string | Branch name |
| `pr_state` | string | `open` / `closed` |
| `pr_merged_at` | string\|null | Merge timestamp (null if not merged) |
| `pr_created_at` | string | PR creation timestamp |
| `run_ids` | array | All workflow run IDs found for this session |
| `invocation_count` | int | Number of runs found in the API |
| `runs_processed` | int | Number of runs whose logs were successfully downloaded and parsed |
| `api_duration_minutes` | float | Duration estimate from PR metrics source data |
| `active_minutes` | float | Sum of compute time across all runs |
| `total_log_minutes` | float | Same as `active_minutes` (alias) |
| `idle_minutes` | float | In-run idle time (sum across runs; effectively always 0) |
| `max_gap_seconds` | int | Largest timestamp gap observed across all run logs |
| `idle_gap_count` | int | Number of gaps exceeding `IDLE_THRESHOLD_SECS` |
| `log_lines` | int | Total log lines across all runs |
| `timestamped_lines` | int | Lines with parseable ISO8601 timestamps |
| `tool_invocations` | int | Count of `Invoking tool:` lines across all runs |
| `copilot_responses` | int | Count of `copilot:` lines across all runs |
| `developer_interventions` | int | `@copilot` comment count from PR metadata (`additional_guidance_count`) |
| `prompt_chars` | int\|null | Character count of the original task prompt (null if not extractable) |
| `additions` | int | Lines added in the PR diff |
| `deletions` | int | Lines deleted in the PR diff |
| `changed_files` | int | Number of files changed in the PR |
| `first_timestamp` | string | Earliest log timestamp across all runs |
| `last_timestamp` | string | Latest log timestamp across all runs |
| `idle_threshold_secs` | int | Threshold used for in-run idle detection |

---

## 5. Known Data Limitations

### Run history availability
GitHub Actions log retention means older runs may not be available. For PRs with multiple invocations, `runs_processed` may be less than `invocation_count` (the count from the metrics source). The field `copilot_invocation_count` in the source metrics is a more complete invocation count recorded at collection time.

### interventions ≠ runs − 1
`developer_interventions` counts explicit `@copilot` PR comments. Some re-invocation runs are triggered by other mechanisms (automated workflows, label triggers) without a `@copilot` comment, so `runs_processed` can exceed `developer_interventions + 1`.

### prompt_chars availability
Prompt text is only extractable from the log when:
- The legacy workflow writes a `cat > issue_body.txt << 'EOT'` heredoc (Pattern A)
- The native coding agent action logs a `Problem statement:` line (Pattern B)

In the octodemo dataset (74 sessions), 19/74 (26%) had extractable prompts.

---

## 6. Developer Time Estimation Formula

### Formula

```
dev_time_estimate = time_to_prompt
                  + compute_time
                  + time_to_intervene
                  + time_to_review        ← merged PRs only
```

### Constants

| Component | Formula | Constants | Notes |
|-----------|---------|-----------|-------|
| **time_to_prompt** | `changed_files × rate` | **1 min/file** if additions=0 OR deletions=0 | Specifying a pure-add/delete task |
| | | **3 min/file** if both additions>0 AND deletions>0 | Specifying a mixed-change task |
| **compute_time** | `active_minutes` | — | Directly measured from logs |
| **time_to_intervene** | `developer_interventions × 15` | **15 min/intervention** | Review output + write correction comment |
| **time_to_review** | `changed_files × rate` | **5 min/file** if additions=0 OR deletions=0 | Pure add/delete = quick scan |
| | | **15 min/file** if both additions>0 AND deletions>0 | Mixed changes = careful review |
| | | **0** if PR was not merged | Unmerged PRs: developer did not complete a review |

### Rationale

- **`time_to_prompt`**: Effort to scope and specify the task scales with the number of files affected, not character count (which is often unavailable). Mixed-change tasks require more precise specification.
- **`compute_time`**: The only directly measured component. Includes all re-invocation runs.
- **`time_to_intervene`**: Each intervention represents a full read-evaluate-write cycle. 15 minutes is conservative for a developer reading a multi-file diff and composing a targeted correction.
- **`time_to_review`**: Only counted for merged PRs — if the PR wasn't merged, the developer either rejected it quickly or never completed a full review. Review time scales with files because per-file review effort is more stable than per-line (auto-generated files inflate line counts without adding proportional review burden).

### Results on octodemo dataset (74 sessions, April 2026)

| Metric | All sessions | Merged (47) | Not merged (27) |
|--------|-------------|-------------|-----------------|
| Min | 0.6 min | — | — |
| Median | 24 min | 32 min | 15 min |
| Avg | 68 min | 89 min | 32 min |
| Max | 555 min | — | — |
| **Total** | **84 hrs** | — | — |

**Component share of average (all sessions):**

| Component | Avg (min) | Share |
|-----------|-----------|-------|
| time_to_prompt | 14.5 | 21% |
| compute_time | 9.3 | 14% |
| time_to_intervene | 2.6 | 4% |
| time_to_review | 41.8 | 61% |

---

## 7. Key Findings (octodemo, April 2026)

- **94% of sessions had zero developer interventions** — most agentic sessions are fire-and-forget
- **Unmerged sessions have ~50% more compute time** (11.8 vs 7.9 min avg) and ~60% more copilot responses (33.9 vs 21.1) — complexity and ambiguity correlate with failure to merge
- **Active compute ≈ 8% of wall-clock PR duration** — the 30-min idle threshold in the original PR-lifecycle estimate was masking vast amounts of developer wait/think time between runs
- **Sessions with interventions that merged** show the collaborative pattern: short initial prompt → multiple guided rounds → successful outcome (e.g., PR#4: 100 prompt chars, 6 interventions, 4 runs, 25.7 compute min → merged)
- **Diff size outlier problem**: auto-generated PRs can have thousands of line additions across few files. Using `changed_files` as the review proxy is more stable than line counts for estimating actual developer review effort.

---

## 8. Future Work

- **Wire `active_minutes` into `agentic-efficiency-days` artifact** — currently the materialized artifact uses `agent_session_minutes` (wall-clock PR duration). Replacing with per-session `active_minutes` would significantly improve the accuracy of compute time estimates in the dashboard.
- **Register `agent-session-logs.sh` in `collect-and-materialize.sh`** so session enrichment runs automatically in the pipeline.
- **Increase `prompt_chars` coverage** — only 26% of sessions have extractable prompts. Investigating additional log patterns or sourcing from the GitHub issue/comment API could improve coverage.
- **Per-invocation logging** — currently logs are aggregated per PR. Storing per-run records would enable analysis of how session complexity evolves across re-invocations.
