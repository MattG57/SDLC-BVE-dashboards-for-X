---
name: configure-bve-dashboards
description: >-
  Configure BVE dashboard parameters and data collection settings. Covers query-settings.json profiles
  (ORG, ENTERPRISE, DAYS, tokens) and dashboard-config.json estimation parameters (cfg_total_developers,
  cfg_pct_time_coding, est_interactions_per_hour, etc.). Use when the user says "configure", "set up",
  "query settings", "dashboard config", "add profile", "set total developers", "PAT setup", "create profile",
  or "change config". Do not use for running the pipeline (use run-bve-pipeline) or computing metrics
  (use compute-leverage-metrics).
---

# Configure BVE Dashboards

BVE dashboards use two configuration files at the repository root:

1. **`query-settings.json`** — Controls data collection (which org, how many days, which token)
2. **`dashboard-config.json`** — Controls dashboard calculations (developer count, time estimates, labor cost)

## query-settings.json

Stores named profiles used by the data collection pipeline.

### File Structure

```json
{
  "default": {
    "ORG": "your-org",
    "ENTERPRISE": "your-enterprise",
    "DAYS": "28",
    "MAX_REPOS": "",
    "GH_TOKEN_NAME": "DASHBOARD_GH_TOKEN",
    "STREAM_MODE": "true",
    "SKIP_DATA_COLLECTION": "false",
    "PIPELINE_STEP": "",
    "RUNNER_LABEL": "ubuntu-latest",
    "SETTINGS_VERSION": "1"
  }
}
```

### Configuration Keys

| Key | Description | Default |
|---|---|---|
| `ORG` | GitHub Organization name | `"octodemo"` |
| `ENTERPRISE` | GitHub Enterprise slug | `"octodemo"` |
| `DAYS` | Lookback window in days | `"30"` |
| `MAX_REPOS` | Max repositories to scan (empty = unlimited) | `""` |
| `GH_TOKEN_NAME` | Name of the GitHub token secret for CI | `"DASHBOARD_GH_TOKEN"` |
| `STREAM_MODE` | Use streaming materialization | `"true"` |
| `SKIP_DATA_COLLECTION` | Skip collection, materialize only | `"false"` |
| `PIPELINE_STEP` | Comma-separated steps to run (empty = all) | `""` |
| `RUNNER_LABEL` | GitHub Actions runner label | `"ubuntu-latest"` |
| `SETTINGS_VERSION` | Schema version marker (informational) | `"1"` |

### Adding a New Profile

Add a new top-level key to `query-settings.json`:

```json
{
  "default": { ... },
  "my-team": {
    "ORG": "my-team-org",
    "ENTERPRISE": "",
    "DAYS": "7",
    "MAX_REPOS": "20",
    "GH_TOKEN_NAME": "MY_TEAM_TOKEN",
    "STREAM_MODE": "true",
    "SKIP_DATA_COLLECTION": "false",
    "PIPELINE_STEP": "",
    "RUNNER_LABEL": "ubuntu-latest",
    "SETTINGS_VERSION": "1"
  }
}
```

### Enterprise vs Org Mode

- Set `ENTERPRISE` for enterprise-level access (covers all orgs under the enterprise)
- Set `ORG` alone for org-level access
- If both are set, enterprise-level APIs are preferred where available

## dashboard-config.json

Controls estimation parameters used by all dashboards. These values feed into leverage calculations.

### Critical Parameters

⚠️ **`cfg_total_developers` is the most important setting.** It sets the denominator for adoption rates. An incorrect value (e.g., default 100 vs actual 1100) produces wildly wrong percentages.

### CONFIG_REGISTRY Keys

The canonical registry is in `shared/core/config.js`. All keys use `cfg_` (customer-provided) or `est_` (estimation parameter) prefixes.

#### Organization-wide Parameters

| Key | Type | Default | Description |
|---|---|---|---|
| `cfg_total_developers` | number | `100` | Total developers in the organization |
| `cfg_workdays_per_week` | number | `5` | Working days per week |
| `cfg_labor_cost_per_hour` | number | `null` | Fully loaded labor cost per developer hour |
| `cfg_pct_time_coding` | number | `0.5` | Fraction of work time spent coding (0–1) |
| `cfg_pct_time_reviewing` | number | `0.2` | Fraction of work time on code review (0–1) |

#### AI-Assisted Parameters

| Key | Type | Default | Description |
|---|---|---|---|
| `est_interactions_per_hour` | number | `20` | Copilot interactions per hour of saved time |
| `cfg_time_saved_pct_day` | number | `null` | Manual daily time saved fraction (0–1) |
| `cfg_baseline_hours_per_dev_per_week` | number | `null` | Baseline working hours per dev per week |

#### Agentic Parameters

| Key | Type | Default | Description |
|---|---|---|---|
| `est_duration_factor` | number | `2` | Multiplier for agent PR duration → human-equivalent hours |
| `cfg_total_repos` | number | `null` | Total repositories in scope (for repo coverage) |

#### Shared Parameters

| Key | Type | Default | Description |
|---|---|---|---|
| `est_hrs_per_kloc` | number | `2` | Developer hours per 1,000 lines of code |

#### Structural Analysis

| Key | Type | Default | Description |
|---|---|---|---|
| `cfg_pr_assist_lookback_days` | number | `3` | Days to look back when classifying PRs as "assisted" |
| `cfg_total_dev_loc_added_day` | number | `null` | Org-wide daily LoC target |

#### Integrated / Projection

| Key | Type | Default | Description |
|---|---|---|---|
| `cfg_projection_cap_ai` | number | `5` | Max multiplier for AI-assisted projections |
| `cfg_projection_cap_agentic` | number | `9` | Max multiplier for agentic projections |

### Example dashboard-config.json

```json
{
  "cfg_total_developers": 500,
  "cfg_pct_time_coding": 0.25,
  "cfg_labor_cost_per_hour": 100,
  "cfg_total_repos": 200,
  "est_hrs_per_kloc": 1,
  "est_duration_factor": 10,
  "est_interactions_per_hour": 25
}
```

## Override Precedence

Settings resolve in this order (highest wins):

1. **CLI flags** — `--collect`, `--materialize-only`, `--no-streaming`
2. **Environment variables** — `DAYS=14 ./run-query.sh`
3. **Workflow inputs** — via `workflow_dispatch`
4. **Profile values** — from `query-settings.json`

## PAT Setup

### Required Scopes

| Scope | When Needed |
|---|---|
| `copilot` | Always — Copilot metrics |
| `read:org` | Org-level data |
| `read:enterprise` | Enterprise-level data |
| `repo` | PR metrics and Actions logs |

### SAML SSO

If your org uses SAML SSO, you must authorize the PAT for the organization after creation. Go to Settings → Developer settings → Personal access tokens → click "Configure SSO" → Authorize for each target org.

## How Config Values Affect Formulas

| Config Key | Used In |
|---|---|
| `cfg_total_developers` | Adoption % = avg_daily_active / total_developers |
| `cfg_pct_time_coding` | Time spent = active_devs × pct_time_coding × 8 hours |
| `est_interactions_per_hour` | AI-Assisted hours saved = total_interactions / est_interactions_per_hour |
| `est_hrs_per_kloc` | LoC hours saved = (loc_added / 1000) × est_hrs_per_kloc |
| `est_duration_factor` | Agentic hours saved = (merged_session_minutes / 60) × est_duration_factor |
| `cfg_labor_cost_per_hour` | Dollar savings = hours_saved × labor_cost_per_hour |
| `cfg_total_repos` | Repo coverage = active_repos / total_repos |
| `cfg_pr_assist_lookback_days` | PR is "assisted" if author was Copilot-active within N prior days |

## References

- [Full CONFIG_REGISTRY reference](references/config-registry.md)
- [Profile configuration examples](references/profile-examples.md)
