# Data Sources and API Reference

This document maps every GitHub API endpoint used by the BVE data
collection scripts, which level of access each requires, and what data
it provides.

## Quick Reference

| Query Script | Data Collected | Enterprise API | Org API | Repo API |
|---|---|:---:|:---:|:---:|
| `copilot-user-and-enterprise-metrics.sh` | Copilot usage metrics (daily totals, per-user) | ✅ | ✅ | — |
| `human-pr-metrics.sh` | PR review activity for non-Copilot PRs | — | — | ✅ |
| `user-pr-metrics.sh` | PR activity by Copilot-active authors | — | — | ✅ |
| `coding-agent-pr-metrics.sh` | Copilot coding agent PR sessions | — | ✅¹ | ✅ |
| `agent-session-logs.sh` | Agent compute time from Actions logs | — | — | ✅ |

¹ Uses `gh repo list {org}` for repo discovery, then repo-level APIs for PR data.

## Required PAT Scopes

| Scope | When Needed |
|---|---|
| `copilot` | Copilot metrics reports (enterprise or org level) |
| `read:enterprise` | Enterprise-level Copilot metrics |
| `read:org` | Org-level Copilot metrics, repo listing |
| `repo` | PR data, Actions logs, issue timelines |

A single PAT with all four scopes covers every query script.

---

## Copilot Usage Metrics

**Script:** `copilot-user-and-enterprise-metrics.sh`

Collects the official Copilot metrics reports — daily aggregated totals
and per-user breakdowns. This is the primary data source for the
AI-Assisted Efficiency and Structural dashboards.

### Enterprise-Level Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/enterprises/{slug}/copilot/metrics/reports/enterprise-28-day/latest` | GET | Daily aggregate totals (active users, suggestions, acceptances, lines, chat interactions) |
| `/enterprises/{slug}/copilot/metrics/reports/users-28-day/latest` | GET | Per-user daily metrics with IDE/language/model breakdowns |

Both return a `download_links` array; the script fetches the actual
report JSON via the download URL.

**Scope:** `copilot` + `read:enterprise`

### Org-Level Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/orgs/{org}/copilot/metrics/reports/enterprise-28-day/latest` | GET | Same daily aggregates, scoped to the organization |

The org-level user report is not separately available — the enterprise
user report already covers all orgs within the enterprise.

**Scope:** `copilot` + `read:org`

### When to Use Which Level

| Scenario | Use |
|---|---|
| Single org, no enterprise plan | Org-level endpoint |
| Enterprise with one org | Either works; enterprise gives broader view |
| Enterprise with multiple orgs | Enterprise-level to get cross-org metrics |
| Org within an enterprise you don't administer | Org-level endpoint |

---

## PR Metrics (Human / Non-Copilot)

**Script:** `human-pr-metrics.sh`

Collects PR data for non-Copilot-authored pull requests — used to
establish baseline review patterns and team velocity.

### Endpoints

| Endpoint | Method | Level | Description |
|---|---|---|---|
| `/graphql` (search) | POST | Repo | Search PRs by org/repo with date filter. Returns PR metadata: state, timestamps, author, additions/deletions, comments count |
| `/repos/{owner}/{repo}/pulls/{n}/reviews` | GET | Repo | Review events (approved, changes requested, commented) |
| `/repos/{owner}/{repo}/pulls/{n}/comments` | GET | Repo | Inline review comments |
| `/repos/{owner}/{repo}/pulls/{n}/requested_reviewers` | GET | Repo | Pending reviewer assignments |
| `/repos/{owner}/{repo}/issues/{n}/timeline` | GET | Repo | Full event timeline (assigned, labeled, review requested, etc.) |

**Scope:** `repo`  
**Pagination:** GraphQL uses cursor-based manual pagination; REST endpoints use `--paginate`.

---

## PR Metrics (Copilot-Active Authors)

**Script:** `user-pr-metrics.sh`

Collects PR data authored by Copilot-active users — identified from the
Copilot metrics user report. Same endpoints as human-pr-metrics but
filtered by author login.

### Endpoints

| Endpoint | Method | Level | Description |
|---|---|---|---|
| `/graphql` (search) | POST | Repo | Search PRs by `author:{login}` with date filter |
| `/repos/{owner}/{repo}/pulls/{n}/reviews` | GET | Repo | Review events |
| `/repos/{owner}/{repo}/pulls/{n}/comments` | GET | Repo | Review comments |
| `/repos/{owner}/{repo}/pulls/{n}/requested_reviewers` | GET | Repo | Pending reviewers |
| `/repos/{owner}/{repo}/issues/{n}/timeline` | GET | Repo | Event timeline |

**Scope:** `repo`  
**Input:** Takes the Copilot user report JSON as input to extract active user logins.

---

## Coding Agent PR Sessions

**Script:** `coding-agent-pr-metrics.sh`

Collects Copilot coding agent activity — discovers repos with recent
agent PRs, then gathers session details including linked issues, review
outcomes, and timeline events.

### Endpoints

| Endpoint | Method | Level | Description |
|---|---|---|---|
| `gh repo list {org}` | CLI | Org | Discovers repositories with recent pushes/updates |
| `/repos/{owner}/{repo}/pulls?state=all` | GET | Repo | Lists all PRs to find agent-authored ones |
| `/repos/{owner}/{repo}/issues?state=all&since=...` | GET | Repo | Issue inventory for cross-referencing |
| `/repos/{owner}/{repo}/issues/{n}/timeline` | GET | Repo | Assignment and copilot-work events |
| `/repos/{owner}/{repo}/issues/comments?since=...` | GET | Repo | Comment search for @copilot mentions |
| `/search/issues?q=repo:...+label:copilot-session` | GET | Repo | Session summary issues |
| `/repos/{owner}/{repo}/pulls/{n}` | GET | Repo | Individual PR details |
| `/repos/{owner}/{repo}/pulls/{n}/reviews` | GET | Repo | Review outcomes |
| `/repos/{owner}/{repo}/issues/{n}/comments` | GET | Repo | PR discussion comments |

**Scope:** `repo` + `read:org` (for repo discovery)

---

## Agent Session Logs (Compute Time)

**Script:** `agent-session-logs.sh`

Fetches GitHub Actions workflow logs for Copilot coding agent runs to
calculate actual compute time (vs wall-clock duration).

### Endpoints

| Endpoint | Method | Level | Description |
|---|---|---|---|
| `/repos/{owner}/{repo}/actions/runs?branch={head_ref}` | GET | Repo | Find the Actions run for an agent session by branch |
| `/repos/{owner}/{repo}/actions/runs/{run_id}/logs` | GET | Repo | Download workflow log ZIP containing timestamped `0_copilot.txt` |

**Scope:** `repo` (or `actions:read` if using fine-grained tokens)  
**Input:** Takes existing PR sessions data (repo, head_ref, pr_state) to know which runs to fetch.

---

## Data Filtering Between Scripts

Some scripts use the output of earlier scripts to filter their own
queries. The pipeline runs all collection scripts in sequence; each
run accumulates raw files that are merged and deduplicated during
materialization.

### Agent PRs → Session Logs

The session logs script depends on agent PR data to know which
Actions workflow runs to fetch:

```
coding-agent-pr-metrics.sh
  outputs pr_sessions[] with { repo, head_ref, pr_state, pr_merged_at }
           │
           │  --input flag (pipeline passes the raw output directly)
           ▼
agent-session-logs.sh
  filters: pr_state == "closed" or pr_merged_at != null
  queries: gh api "repos/{repo}/actions/runs?branch={head_ref}"
  parses:  log timestamps → active_minutes, idle_minutes
```

### Copilot Users → User PR Metrics (manual only)

`user-pr-metrics.sh` takes a copilot report as input, extracts active
user logins, and queries their PRs via `author:{login}`. This script
is **not part of the automated pipeline** — the pipeline collects
org-wide PR data via `human-pr-metrics.sh` instead. Run it manually
when user-level PR attribution is needed.

### Accumulation and Deduplication

Each pipeline run writes timestamped raw files to `_data/raw/`. Over
multiple runs, these files accumulate. The materializer handles this
by **merging all files of the same type** and then **deduplicating**
overlapping records.

**Merge step** — files classified as the same source type (copilot, PR,
agentic) are concatenated:
- Enterprise day records: merged across files
- User-day records: merged across files
- PR records: merged across files
- Agent sessions + developer day summaries: merged across files

**Dedup step** — each materializer removes duplicate records using a
natural key:

| Data Type | Dedup Key | Strategy |
|---|---|---|
| Enterprise days | `day` | Last entry wins per day |
| User days | `day` + `user_login` | Last entry wins per day+user |
| PR records | PR URL or number | Last entry wins, bots filtered out |
| Agent sessions | session identifier | Merged by session |

This means the pipeline is **idempotent** — running it multiple times
with overlapping date ranges produces the same result. Newer data
overwrites older data for the same key.

**Materialization dependencies:**

```
Raw files                          Materializer                    Artifact
─────────                          ────────────                    ────────
copilot-metrics ──────────────────▶ ai-assisted-efficiency-days
copilot-metrics + human-pr-metrics ▶ ai-assisted-structural-days
coding-agent-pr-metrics ──────────▶ agentic-efficiency-days
coding-agent-pr-metrics ──────────▶ agentic-pr-sessions

All 4 artifacts + session-logs ───▶ leverage-summary
```

The `leverage-summary` materializer reads the 4 previously-written
artifact files plus merged session logs to produce a single integrated
row per element.

---

## Pipeline Execution Plan

### Entry Point

`./run-query.sh` is the single entry point for the data pipeline. It
delegates to `scripts/collect-and-materialize.sh` which handles
collection, materialization, and status tracking.

```bash
./run-query.sh                           # full pipeline, default profile
./run-query.sh --profile short-window    # use a named profile
./run-query.sh --materialize-only        # re-materialize cached data
./run-query.sh --session-logs-only       # fetch agent session logs only
DAYS=7 ./run-query.sh                    # override lookback window
```

> The legacy `run-query-legacy.sh` preserves the old per-target interface
> for v1 dashboards. It is no longer the recommended entry point.

### Pipeline Steps

The pipeline runs all steps in sequence. Use `PIPELINE_STEP` or
`--materialize-only` / `--collect` flags to run a subset.

**Step 1 — Collect** (raw data from APIs)

All query scripts run each time data is collected:

| Query Script | Raw Output File | Required Env |
|---|---|---|
| `copilot-user-and-enterprise-metrics.sh` | `copilot-metrics-{timestamp}.json` | `ENTERPRISE` or `ORG` |
| `human-pr-metrics.sh` | `human-pr-metrics-{timestamp}.json` | `ORG` |
| `coding-agent-pr-metrics.sh` | `coding-agent-pr-metrics-{timestamp}.json` | `ORG` |
| `agent-session-logs.sh` | `agent-session-logs-{timestamp}.json` | *(uses agent PR output)* |

**Step 2 — Materialize** (raw → artifacts)

| Raw Input(s) | Materializer | Artifact | What It Contains |
|---|---|---|---|
| `copilot-metrics` | `ai-assisted-efficiency-days` | `ai-assisted-efficiency-days-{ts}.json` | Daily per-user Copilot usage: suggestions, acceptances, chat, lines |
| `copilot-metrics` + `human-pr-metrics` | `ai-assisted-structural-days` | `ai-assisted-structural-days-{ts}.json` | Adoption, PR merge rates, review patterns, structural metrics |
| `coding-agent-pr-metrics` | `agentic-efficiency-days` | `agentic-efficiency-days-{ts}.json` | Agent session duration, lines changed, review cycles |
| `coding-agent-pr-metrics` | `agentic-pr-sessions` | `agentic-pr-sessions-{ts}.json` | Per-session detail: PR state, linked issues, timeline |
| *all of the above* | `leverage-summary` | `leverage-summary-{ts}.json` | One row per element with leverage, yield, estimates, projections |

**Step 3 — Deploy** (artifacts → GitHub Pages)

The `build-pages.sh` script copies artifacts into the `_site/` directory
and generates the landing page. GitHub Actions deploys to Pages.

### Which Dashboards Use Which Artifacts

| Dashboard | Artifact(s) Loaded | What Breaks If Missing |
|---|---|---|
| **V2 AI-Assisted Efficiency** | `ai-assisted-efficiency-days` | No data shown |
| **V2 AI-Assisted Structural** | `ai-assisted-structural-days` | No data shown |
| **V2 AI-Assisted Element** | `ai-assisted-efficiency-days` + `ai-assisted-structural-days` | Leverage calculations fail |
| **V2 Agentic Efficiency** | `agentic-efficiency-days` | No data shown |
| **V2 Agentic Element** | `agentic-efficiency-days` + `agentic-pr-sessions` | Leverage calculations fail |
| **V2 Integrated Leverage** | `leverage-summary` | No data shown |
| **Demo — Leverage in Practice** | `leverage-summary` | Shows "run the pipeline first" |
| **V1 dashboards** | Load from v1 `data/` dirs via file upload | N/A (manual upload) |

### End-to-End: API → Dashboard

```
  copilot-user-and-enterprise-metrics.sh
  ├─ Enterprise API: /enterprises/{slug}/copilot/metrics/...
  └─ Org API:        /orgs/{org}/copilot/metrics/...
       │
       ▼ raw: copilot-metrics-{ts}.json
       ├──▶ ai-assisted-efficiency-days ──▶ V2 AI-Assisted Efficiency
       ├──▶ ai-assisted-structural-days ──▶ V2 AI-Assisted Structural
       │       (+ human-pr-metrics)
       └──▶ leverage-summary ─────────────▶ V2 Integrated Leverage
                                            Demo Live page

  human-pr-metrics.sh
  └─ Repo API: GraphQL search + /pulls/{n}/reviews, comments, timeline
       │
       ▼ raw: human-pr-metrics-{ts}.json
       └──▶ ai-assisted-structural-days ──▶ V2 AI-Assisted Structural
            (combined with copilot-metrics)

  coding-agent-pr-metrics.sh
  └─ Repo API: /repos/{owner}/{repo}/pulls, issues, timeline
       │
       ▼ raw: coding-agent-pr-metrics-{ts}.json
       ├──▶ agentic-efficiency-days ──────▶ V2 Agentic Efficiency
       ├──▶ agentic-pr-sessions ──────────▶ V2 Agentic Element
       └──▶ leverage-summary ─────────────▶ V2 Integrated Leverage
                                            Demo Live page

  agent-session-logs.sh
  └─ Repo API: /repos/{owner}/{repo}/actions/runs + logs
       │
       ▼ raw: agent-session-logs-{ts}.json
       └──▶ leverage-summary (compute time) ──▶ V2 Integrated Leverage
```

## See Also

- [data-collection.md](data-collection.md) — query targets, output directories, CI setup
- [pat-setup.md](pat-setup.md) — token creation and SSO authorization
- [config-examples.md](config-examples.md) — common pipeline scenarios
- [query-settings.md](query-settings.md) — configuration keys and profiles
