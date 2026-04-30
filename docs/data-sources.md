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

## Data Flow Summary

```
Enterprise/Org APIs          Repo APIs                  Actions APIs
─────────────────           ──────────                  ────────────
Copilot metrics ─┐     ┌─── PR search (GraphQL)        Agent run logs
  (daily totals)  │     │    PR reviews                     │
  (per-user)      │     │    PR comments                    │
                  ▼     ▼    PR timelines                   ▼
              ┌───────────────────────────────────────────────┐
              │           Raw JSON files (_data/raw/)         │
              └──────────────────┬────────────────────────────┘
                                 │ materialize
                                 ▼
              ┌───────────────────────────────────────────────┐
              │   Materialized artifacts (_data/materialized/) │
              │   • ai-assisted-efficiency-days                │
              │   • ai-assisted-structural-days                │
              │   • agentic-efficiency-days                    │
              │   • agentic-pr-sessions                        │
              │   • leverage-summary                           │
              └──────────────────┬────────────────────────────┘
                                 │ deploy
                                 ▼
              ┌───────────────────────────────────────────────┐
              │          GitHub Pages dashboards               │
              └───────────────────────────────────────────────┘
```

## See Also

- [data-collection.md](data-collection.md) — query targets, output directories, CI setup
- [pat-setup.md](pat-setup.md) — token creation and SSO authorization
- [config-examples.md](config-examples.md) — common pipeline scenarios
- [query-settings.md](query-settings.md) — configuration keys and profiles
