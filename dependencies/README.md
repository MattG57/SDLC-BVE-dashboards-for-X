# Dashboard Dependencies & Schema Mapping

This document is the authoritative reference for how query scripts, dashboards, and data schemas relate to each other. Use it when adding, modifying, or removing a script-to-dashboard dependency.

The canonical user and contributor docs now live in:

- `docs/data-collection.md` for runtime query workflows and targets
- `docs/dashboard-status.md` for dashboard readiness and migration state
- `docs/development.md` for contributor workflow
- `README.md` for high-level repository orientation

---

## Script → Dashboard Dependency Map

Each query script produces JSON that feeds one or more dashboards. The top-level `run-query.sh` runner encodes these relationships in its registry.

| Query Script | Dashboard | Runner Target | Required Env | Optional Env |
|---|---|---|---|---|
| `copilot-user-and-enterprise-metrics.sh` | AI-Assisted Efficiency | `ai-assisted-efficiency` | `ENTERPRISE` or `ORG` | `DAYS` |
| `copilot-user-and-enterprise-metrics.sh` | AI-Assisted Structural | `ai-assisted-structural` | `ENTERPRISE` or `ORG` | `DAYS` |
| `human-pr-metrics.sh` | AI-Assisted Structural | `pr-review-structural` | `ORG` | `REPO`, `DAYS`, `SINCE`, `UNTIL` |
| `coding-agent-pr-metrics.sh` | Agentic Efficiency | `agentic-efficiency` | `ORG` | `REPO`, `DAYS`, `MAX_REPOS` |

### File Locations

```
Query scripts:
  BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh
  BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh
  BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh

Dashboard HTML (each has a data/ output dir beside it):
  BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
  BVE-dashboards-for-ai-assisted-coding/dashboard/structural/index.html
  BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/index.html

Dashboard HTML (file-upload only, no data/ dir or runner target):
  BVE-dashboards-for-ai-assisted-coding/dashboard/element/index.html
  BVE-dashboards-for-agentic-ai-coding/dashboard/element/index.html
  dashboard/integrated/index.html

Runner & settings:
  run-query.sh              ← registry lives here (get_target_config function)
  query-settings.json       ← named profiles for env vars
```

### Expected Output Shapes

| Script | Top-level JSON keys consumed by dashboard |
|---|---|
| `copilot-user-and-enterprise-metrics.sh` | `enterprise_report`, `user_report` |
| `human-pr-metrics.sh` | `pull_requests`, `detailed_pr_events` |
| `coding-agent-pr-metrics.sh` | `pr_sessions`, `requests`, `developer_day_summary` |

---

## How to Add a New Dashboard

1. Create the dashboard directory under the appropriate suite:
   ```
   BVE-dashboards-for-SUITE/dashboard/DASHBOARD_TYPE/
   └── index.html
   ```
2. Use an existing dashboard as a template — copy the HTML structure, CDN imports (React, Babel, Primer CSS, Highcharts), and component patterns (`UploadPanel`, `App` with `data` state, `{!data && (...)}` instruction panel)
3. Define the dashboard's config keys in the `let config = {...}` initialisation and add a `ConfigPanel` component
4. Add a `{!data && (...)}` instruction panel listing the query script, runner command, required env vars, and expected data shape
5. Wire it to a query script — either an existing one or a new one (see "How to Add a New Script" below)
6. Register a runner target in `run-query.sh` — add a case to `get_target_config()` and add the target name to the `TARGETS` list
7. Add schema files under `BVE-dashboards-for-SUITE/data/schemas/` if the dashboard introduces new dataframe shapes
8. Add an example data file under `BVE-dashboards-for-SUITE/data/examples/` with realistic sample output
9. Create a `tests/` directory with at minimum:
    - `tests/core/schema-validation.test.js` — validates the data schema
    - `tests/core/data-processor.test.js` — tests data loading and transformation
    - `tests/core/error-boundaries.test.js` — tests error handling for malformed input
    - `tests/schemas/schema-validation.test.js` — validates schema file structure
10. Add a `vitest.config.js` in the dashboard directory and `package.json` with `test`, `test:watch`, and `test:coverage` scripts
11. Update root `package.json` — add `build:SUITE` and `test:SUITE` npm scripts if this is a new suite, or verify existing scripts cover the new dashboard
12. Update this file (`dependencies/README.md`) — add rows to the dependency map, config schemas, output shapes, and any new API endpoints
13. Update `docs/dashboard-status.md` — add the dashboard and its readiness state
14. Update `docs/data-collection.md` if the new dashboard introduces a new target or collection workflow
15. Update root `README.md` only if the repository-level dashboard summary or doc index changes
16. Verify `.gitignore` coverage — the rule `**/dashboard/*/data/` should cover the new output dir automatically
17. Run `npm test` to confirm all existing and new tests pass


Follow these steps when introducing a new query script or connecting an existing script to a new dashboard.

### 1. Register the target in `run-query.sh`

Add a new case to the `get_target_config()` function:

```bash
    my-new-target)
      query_script="BVE-dashboards-for-SUITE/data/queries/my-script.sh"
      required_vars="ORG"
      optional_vars="DAYS"
      output_dirs="BVE-dashboards-for-SUITE/dashboard/DASHBOARD_TYPE/data"
      base_filename="my-script"
      ;;
```

Add the target name to the `TARGETS` list at the top of the registry section.

### 2. Update the dashboard's instruction panel

In the dashboard's `index.html`, find the `{!data && (...)}` block and update it to reference the new script name and runner command.

### 3. Update this file

Add a row to the dependency map table above, document the expected output JSON shape, and add API endpoints.

### 4. Update canonical docs

- Update `docs/data-collection.md` with the new target and collection workflow
- Update `README.md` only if the top-level quick-start summary should mention the new target

### 5. Add `.gitignore` coverage

The rule `**/dashboard/*/data/` in `.gitignore` covers any new dashboard `data/` dirs automatically. No action needed unless the output dir is outside this pattern.

### 6. Update tests

If the new script changes the data shape consumed by a dashboard, update the relevant tests:
- `tests/core/data-processor.test.js` — add cases for the new data source
- `tests/core/schema-validation.test.js` — validate the new output shape
- `tests/schemas/schema-validation.test.js` — if new schema files were added
- Run `npm test` to confirm all tests pass

---

## How to Modify an Existing Dependency

### Renaming a script
1. Rename the `.sh` file (use `git mv`)
2. Update `query_script` in the matching `get_target_config()` case(s) in `run-query.sh`
3. Update `base_filename` if the output file name should change
4. Update the dashboard's `{!data && (...)}` instruction panel
5. Update old references in UploadPanel helper text (grep for the old name)
6. Update this file (`dependencies/README.md`) — dependency map, file locations, data collection scripts
7. Update `docs/data-collection.md` — target table, direct script examples, or output-shape references
8. Update `README.md` only if the repository-level summary needs to change

### Changing which dashboards a script feeds
1. Add or remove cases in `get_target_config()` — each case maps one target to one output dir
2. To feed multiple dashboards from one script, create multiple targets pointing to the same `query_script` with different `output_dirs`
3. Update the `TARGETS` list
4. Update instruction panels in affected dashboards
5. Update this file (`dependencies/README.md`) — dependency map table
6. Update `docs/data-collection.md` — target table and workflow notes

### Changing required/optional env vars
1. Update `required_vars` and/or `optional_vars` in the target's case block
2. Use `|` (pipe) to denote "one of" for required groups (e.g., `ENTERPRISE|ORG`)
3. Update the dashboard's `{!data && (...)}` instruction panel if it lists env vars
4. Update this file (`dependencies/README.md`) — dependency map table
5. Update `docs/data-collection.md` if users need different runtime inputs or commands

### Adding or changing a data field in script output
1. Update the query script's `jq` output construction to include the new/changed field
2. Update the relevant `data/schemas/df-*-schema.json` file with the field name, type, and description
3. Update the dashboard HTML's data-loading logic if the field is consumed directly (search for existing field names in `handleProcess` or `handleData`)
4. Update the example data file in `data/examples/` to include the new field with a realistic value
5. Update or add test cases in `tests/core/data-processor.test.js` to cover the new field's processing
6. Update `tests/core/schema-validation.test.js` if the field changes validation expectations
7. Update the **Detailed Output Shapes** section in this file (`dependencies/README.md`)
8. Update the **Expected Output Shapes** table if top-level keys changed
9. Run `node scripts/validators/validate-data.js <file> <type>` to verify the example still passes schema validation
10. Run `npm test` to confirm all tests pass

### Adding or changing a config key (`cfg_*`/`est_*`)
1. Add the key with its default value to the dashboard's `let config = {...}` initialisation in `index.html`
2. If the key is user-facing, add a control for it in the `ConfigPanel` component
3. Update `data/examples/sample-config.json` with the new key and a sensible default
4. Update the **Dashboard Config Schemas** table in this file (`dependencies/README.md`) — key, type, default, description
5. If multiple dashboards share the key, update each dashboard's config table
6. Add test cases in `tests/core/estimators.test.js` or `tests/core/calculators.test.js` if the key affects calculations
7. Run `npm test` to confirm all tests pass

### Handling an API version or endpoint change
1. Update the `gh api` call in the query script (URL path, headers, `X-GitHub-Api-Version`)
2. Run the script with `--dry-run` or a small `DAYS` window to verify the response shape
3. If the response shape changed, follow the "Adding or changing a data field" checklist above (including its test steps)
4. Update the **API Endpoints per Script** table in this file (`dependencies/README.md`)
5. If the API now requires new authentication scopes or permissions, document in the script's `--help` output

---

## How to Remove a Dependency

1. Remove the case block from `get_target_config()` in `run-query.sh`
2. Remove the target name from the `TARGETS` list
3. Delete the query script file
4. Remove or update the dashboard's `{!data && (...)}` instruction panel
5. Remove the row from this file (`dependencies/README.md`) — dependency map, output shapes, API endpoints, data collection scripts
6. Update `docs/data-collection.md` — remove the target and associated workflow
7. Update `docs/dashboard-status.md` if dashboard readiness changes
8. Update `README.md` only if the top-level dashboard summary changes

---

## Schema Files

Schema files document the structure of processed dataframes used by the dashboards. They use a custom format with `_meta`, `field_categories`, and `fields` sections.

### AI-Assisted Coding

| Schema File | Purpose |
|---|---|
| `data/schemas/df-ai-assisted-coding-schema.json` | Combined schema — defines input panel file roles and dataframe references |
| `data/schemas/df-enterprise-day-ai-schema.json` | Enterprise-day grain — daily aggregate metrics (active users, interactions, LoC, PRs, CLI) |
| `data/schemas/df-user-day-ai-schema.json` | User-day grain — per-developer daily metrics (interactions, LoC, acceptance rates, feature flags) |

### Agentic AI Coding

| Schema File | Purpose |
|---|---|
| `data/schemas/df-agentic-ai-coding-schema.json` | Combined schema — defines `pr_sessions`, `requests`, `developer_day_summary` record shapes |
| `data/schemas/df-enterprise-day-agentic-schema.json` | Enterprise-day grain — daily aggregate metrics (same shape as AI-assisted, without CLI prompt counts) |
| `data/schemas/df-user-day-agentic-schema.json` | User-day grain — per-developer daily metrics (same shape as AI-assisted, without CLI prompt counts) |

---

## Example Data Files

Example files are used for validation with `node scripts/validators/validate-data.js <file> <type>` and as reference for expected output shapes.

| File | Top-level Keys | Purpose |
|---|---|---|
| `BVE-dashboards-for-ai-assisted-coding/data/examples/ai-assisted-coding-example.json` | `enterprise_report`, `user_report` | Example output from `copilot-user-and-enterprise-metrics.sh` |
| `BVE-dashboards-for-ai-assisted-coding/data/examples/pr-review-example.json` | `pull_requests`, `detailed_pr_events` | Example output from `human-pr-metrics.sh` |
| `BVE-dashboards-for-ai-assisted-coding/data/examples/sample-config.json` | `cfg_*`, `est_*` keys | Example config file for AI-assisted efficiency dashboard |
| `BVE-dashboards-for-agentic-ai-coding/data/examples/agentic-ai-coding-example.json` | `pr_sessions`, `requests`, `developer_day_summary` | Example output from `coding-agent-pr-metrics.sh` |

---

## Dashboard Config Schemas

Each dashboard accepts optional config JSON files with `cfg_*` (customer-provided) and `est_*` (estimation parameter) keys. These override defaults when uploaded alongside source data.

### AI-Assisted Efficiency

| Key | Type | Default | Description |
|---|---|---|---|
| `cfg_time_saved_pct_day` | number | `null` | Daily time-saved percentage (manual mode) |
| `cfg_baseline_hours_per_dev_per_week` | number | `null` | Baseline weekly dev hours for conversion |
| `cfg_workdays_per_week` | number | `5` | Workdays per week |
| `cfg_labor_cost_per_hour` | number | `null` | Hourly labor cost for dollar savings |
| `est_interactions_per_hour` | number | `20` | Estimated Copilot interactions per hour |
| `est_hrs_per_kloc` | number | `2` | Estimated dev-hours per 1,000 LoC |

### AI-Assisted Structural

| Key | Type | Default | Description |
|---|---|---|---|
| `cfg_total_developers` | number | `null` | Total developer headcount |
| `cfg_total_dev_loc_added_day` | number | `null` | Org-wide daily LoC added |
| `cfg_workdays_per_week` | number | `5` | Workdays per week |
| `cfg_labor_cost_per_hour` | number | `null` | Hourly labor cost |

### Agentic Efficiency

| Key | Type | Default | Description |
|---|---|---|---|
| `cfg_workdays_per_week` | number | `5` | Workdays per week |
| `cfg_labor_cost_per_hour` | number | `null` | Hourly labor cost |
| `est_human_to_agent_ratio` | number | `10` | Human-equivalent time multiplier for agent work |
| `est_hrs_per_kloc` | number | `4` | Estimated dev-hours per 1,000 LoC |

---

## API Endpoints per Script

### `copilot-user-and-enterprise-metrics.sh`

| Mode | Endpoint | Purpose |
|---|---|---|
| Enterprise | `GET /enterprises/{slug}/copilot/metrics/reports/enterprise-28-day/latest` | Fetch download URL for enterprise-level daily metrics |
| Enterprise | `GET /enterprises/{slug}/copilot/metrics/reports/users-28-day/latest` | Fetch download URL for user-level daily metrics |
| Org | `GET /orgs/{org}/copilot/metrics/reports/enterprise-28-day/latest` | Fetch download URL for org-level daily metrics |

Each endpoint returns a `download_links[0]` URL; the actual CSV/JSON payload is fetched via `curl -sL`.

### `human-pr-metrics.sh`

| Type | Endpoint | Purpose |
|---|---|---|
| GraphQL | `search(query: $q, type: ISSUE, first: 1)` | Count total matching PRs |
| GraphQL | `search(query: $q, type: ISSUE, first: 100, after: $cursor)` | Paginate PR nodes with LoC inline |
| REST | `GET /repos/{org}/{repo}/pulls/{n}/reviews` | PR review submissions |
| REST | `GET /repos/{org}/{repo}/pulls/{n}/comments` | PR review comments |
| REST | `GET /repos/{org}/{repo}/pulls/{n}/requested_reviewers` | Requested reviewers |
| REST | `GET /repos/{org}/{repo}/issues/{n}/timeline` | PR timeline events |

### `coding-agent-pr-metrics.sh`

| Type | Endpoint | Purpose |
|---|---|---|
| CLI | `gh repo list {org} --json name,updatedAt,pushedAt` | Discover active repos |
| REST | `GET /repos/{org}/{repo}/issues?state=all&since=...&per_page=100` | Fetch issues |
| REST | `GET /repos/{org}/{repo}/pulls?state=all&per_page=100` | Fetch pull requests |
| REST | `GET /repos/{org}/{repo}/issues/{n}/timeline?per_page=100` | Issue/PR timeline events |
| REST | `GET /repos/{org}/{repo}/issues/comments?since=...&per_page=100` | All issue comments |
| REST | `GET /search/issues?q=repo:{org}/{repo}+is:issue+label:copilot-session` | Find Copilot session issues |
| REST | `GET /repos/{org}/{repo}/pulls/{n}` | Individual PR detail |
| REST | `GET /repos/{org}/{repo}/pulls/{n}/reviews?per_page=100` | PR reviews |
| REST | `GET /repos/{org}/{repo}/issues/{n}/comments?per_page=100` | PR/issue comments |

---

## Detailed Output Shapes

### `copilot-user-and-enterprise-metrics.sh`

**Enterprise mode** outputs `{ enterprise_report, user_report }`:

`enterprise_report` contains:
- `copilot_ide_code_completions`, `copilot_ide_chat`, `copilot_dotcom_chat`, `copilot_dotcom_pull_requests` — feature-level aggregates
- `day_totals[]` — daily records with fields:
  - `day`, `enterprise_id`, `daily_active_users`, `daily_active_cli_users`
  - `weekly_active_users`, `monthly_active_users`, `monthly_active_chat_users`, `monthly_active_agent_users`
  - `user_initiated_interaction_count`, `code_generation_activity_count`, `code_acceptance_activity_count`
  - `loc_suggested_to_add_sum`, `loc_suggested_to_delete_sum`, `loc_added_sum`, `loc_deleted_sum`
  - `totals_by_ide[]`, `totals_by_feature[]`, `totals_by_language_feature[]`, `totals_by_language_model[]`, `totals_by_model_feature[]`
  - `totals_by_cli` — `{ session_count, request_count, token_usage }` 
  - `pull_requests` — `{ total_reviewed, total_created, total_created_by_copilot, total_reviewed_by_copilot, total_merged, median_minutes_to_merge, ... }`

`user_report[]` — per-user daily records:
- `report_start_day`, `report_end_day`, `day`, `enterprise_id`, `user_id`, `user_login`
- `user_initiated_interaction_count`, `code_generation_activity_count`, `code_acceptance_activity_count`
- `loc_suggested_to_add_sum`, `loc_suggested_to_delete_sum`, `loc_added_sum`, `loc_deleted_sum`
- `used_agent`, `used_chat`
- `totals_by_ide[]`, `totals_by_feature[]`, `totals_by_language_feature[]`, `totals_by_language_model[]`, `totals_by_model_feature[]`

**Org mode** outputs `{ organization_report }` — same shape as `enterprise_report.day_totals[]`, filtered by `SINCE_DATE`.

### `human-pr-metrics.sh`

Outputs `{ pull_requests, detailed_pr_events }`:

`pull_requests` — `{ total_count, prs[] }`:
- `prs[]`: `number`, `title`, `state`, `created_at`, `updated_at`, `closed_at`, `merged_at`, `user`, `repository`, `comments`, `draft`, `url`, `additions`, `deletions`, `changed_files`

`detailed_pr_events[]` — enriched data for a sample of PRs:
- `pr_number`, `reviews`, `comments`, `review_requests`, `timeline`

### `coding-agent-pr-metrics.sh`

Outputs `{ pr_sessions, requests, developer_day_summary }`:

`pr_sessions[]`:
- `repo`, `pr_number`, `pr_title`, `pr_created_at`, `pr_closed_at`, `pr_merged_at`, `pr_state`, `pr_draft`, `pr_author_login`, `merged_by`
- `additions`, `deletions`, `changed_files`, `duration_minutes`
- `changes_requested_count`, `reopened_count`, `additional_guidance_count`
- `session_issue_number`, `origin_request_type`, `origin_issue_number`, `origin_requested_by`, `origin_requested_at`

`requests[]`:
- `repo`, `request_type`, `requested_at`, `requested_by_login`
- `issue_number`, `issue_title`, `issue_state`, `is_pull_request`, `pr_number`
- `comment_id`, `comment_body_excerpt`, `copilot_target_mode`, `linked_pr_number`

`developer_day_summary[]`:
- `date`, `developer`
- `issue_assignment_requests`, `pr_followup_requests`, `total_agent_requests`
- `sessions_started`, `agent_prs_created`, `agent_prs_merged`
- `agent_loc_added`, `agent_loc_deleted`, `agent_session_minutes`
- `changes_requested_total`, `median_merge_minutes`

---

## Data Collection Scripts

### Copilot User & Enterprise Metrics
- **Script**: `BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh`
- **Runner target(s)**: `ai-assisted-efficiency`, `ai-assisted-structural`
- **API Used**: GitHub Copilot Metrics API (Enterprise 28-day reports, User 28-day reports)
- **Output**: JSON with `enterprise_report` and `user_report` (enterprise mode) or `organization_report` (org mode)
- **Dependencies**: `gh`, `jq`, `curl`

### Human PR Metrics
- **Script**: `BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh`
- **Runner target**: `pr-review-structural`
- **APIs Used**: GitHub GraphQL (PR search with LoC), REST (reviews, comments, requested reviewers, timeline)
- **Output**: JSON with `pull_requests` and `detailed_pr_events`
- **Dependencies**: `gh`, `jq`

### Coding Agent PR Metrics
- **Script**: `BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh`
- **Runner target**: `agentic-efficiency`
- **APIs Used**: GitHub REST (repo discovery, issues, pulls, timeline, reviews, search)
- **Output**: JSON with `pr_sessions`, `requests`, and `developer_day_summary`
- **Dependencies**: `gh`, `jq`, `python3`

---

## Schema Validation Points

Each dashboard validates data at multiple stages:

1. **File Load Validation**: JSON parsing and top-level key detection (`enterprise_report`, `pr_sessions`, etc.)
2. **Config Detection**: Files with `cfg_*` or `est_*` keys are treated as config overrides
3. **Post-Processing Validation**: Data transformation and metric derivation
4. **Render Validation**: Data structure checks before rendering to UI

## Common Schema Elements

All dashboards share common patterns for:
- Date/time formatting (ISO 8601)
- User identification (`user_login` / `login` strings)
- Numeric metrics (non-negative integers)
- LoC tracking (`additions`, `deletions`, `loc_added_sum`, `loc_deleted_sum`)
- Config overrides via `cfg_*` / `est_*` keys in separate JSON files

## Testing Strategy

Each schema has corresponding test files:
- `schema.test.js`: Validates schema structure
- `{module}.test.js`: Tests data processing logic
- Example data files for validation in `data/examples/`
- Config validation via `node scripts/validators/validate-data.js <file> <type>` and dashboard-level schema tests

For detailed API schema examples, refer to:
- [GitHub Copilot Metrics API Documentation](https://docs.github.com/en/copilot/reference/copilot-usage-metrics)
- [GitHub Pull Requests API Documentation](https://docs.github.com/en/rest/pulls)
