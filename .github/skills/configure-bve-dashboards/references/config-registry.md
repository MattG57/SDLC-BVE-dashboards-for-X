# CONFIG_REGISTRY Reference

Source: `shared/core/config.js`

The CONFIG_REGISTRY is the single source of truth for config key names, defaults, types, and labels. Every dashboard reads defaults from here. The `mergeConfig()` function merges user-provided config over defaults, ignoring unknown keys.

## Key Naming Convention

- `cfg_` prefix — customer-provided values (org-specific facts)
- `est_` prefix — estimation parameters (tunable multipliers)

## Detection

A JSON object is recognized as a config file if it has any key starting with `cfg_` or `est_`.

## Full Registry

### Organization-wide (`type: 'org'`)

| Key | Default | Label | Description |
|---|---|---|---|
| `cfg_total_developers` | `100` | Total Developers | Total number of developers in the organization |
| `cfg_workdays_per_week` | `5` | Workdays per Week | Working days per week (excludes weekends) |
| `cfg_labor_cost_per_hour` | `null` | Labor Cost ($/hr) | Fully loaded labor cost per developer hour |
| `cfg_pct_time_coding` | `0.5` | % Time Coding | Fraction of work time spent on coding tasks (0–1) |
| `cfg_pct_time_reviewing` | `0.2` | % Time Reviewing | Fraction of work time spent on code review (0–1) |

### AI-Assisted (`type: 'ai-assisted'`)

| Key | Default | Label | Description |
|---|---|---|---|
| `est_interactions_per_hour` | `20` | Interactions per Hour | Estimated Copilot interactions per hour of saved time |
| `cfg_time_saved_pct_day` | `null` | Time Saved % / Day | Manual estimate of daily time saved as a fraction (0–1) |
| `cfg_baseline_hours_per_dev_per_week` | `null` | Baseline Hrs/Dev/Week | Baseline working hours per developer per week |

### Agentic (`type: 'agentic'`)

| Key | Default | Label | Description |
|---|---|---|---|
| `est_duration_factor` | `2` | Duration Multiplier | Multiplier for agent PR duration → human-equivalent hours |
| `cfg_total_repos` | `null` | Total Repos | Total repositories in scope for repo coverage |

### Shared (`type: 'shared'`)

| Key | Default | Label | Description |
|---|---|---|---|
| `est_hrs_per_kloc` | `2` | Hours per KLoC | Developer hours per 1,000 lines of code |

### Structural (`type: 'structural'`)

| Key | Default | Label | Description |
|---|---|---|---|
| `cfg_pr_assist_lookback_days` | `3` | PR-Assist Lookback Days | Days to look back when classifying PRs as "assisted" |
| `cfg_total_dev_loc_added_day` | `null` | Org LoC/Day Target | Target total LoC added per day across the org |

### Integrated (`type: 'integrated'`)

| Key | Default | Label | Description |
|---|---|---|---|
| `cfg_projection_cap_ai` | `5` | AI Projection Cap (×) | Max multiplier for AI-assisted projections |
| `cfg_projection_cap_agentic` | `9` | Agentic Projection Cap (×) | Max multiplier for agentic projections |

## Helper Functions

### `getDefaults(elementType)`
Returns config defaults for a given element type. Includes `shared` and `org` keys plus element-specific keys.

### `getAllDefaults()`
Returns all config defaults regardless of type.

### `isConfigObject(obj)`
Detects if a JSON object is a config file (has any `cfg_` or `est_` key).

### `mergeConfig(defaults, userConfig)`
Merges user config over defaults. Only known keys (present in CONFIG_REGISTRY) are accepted; unknown keys are silently ignored.
