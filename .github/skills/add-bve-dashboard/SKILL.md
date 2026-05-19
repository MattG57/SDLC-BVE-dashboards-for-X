---
name: add-bve-dashboard
description: >-
  Guide for adding new dashboards, query scripts, data sources, or extending the BVE pipeline.
  Includes the 17-step checklist, dependency map, materializer envelope format, and change-type
  sub-checklists. Use when the user says "add dashboard", "new dashboard", "add data source",
  "new query script", "extend pipeline", "new materializer", or "add collection target".
  Do not use for running the pipeline (use run-bve-pipeline) or configuring parameters
  (use configure-bve-dashboards).
---

# Add a BVE Dashboard

The authoritative reference for all structural changes is `dependencies/README.md`. This skill summarizes the key procedures.

## 17-Step Add-Dashboard Checklist

Follow these steps when adding a new dashboard:

1. **Create the dashboard directory** under the appropriate suite:
   ```
   BVE-dashboards-for-SUITE/dashboard/DASHBOARD_TYPE/
   └── index.html
   ```

2. **Use an existing dashboard as a template** — copy the HTML structure, CDN imports (React, Babel, Primer CSS, Highcharts), and component patterns (`UploadPanel`, `App` with `data` state, `{!data && (...)}` instruction panel)

3. **Define config keys** in the `let config = {...}` initialization and add a `ConfigPanel` component

4. **Add an instruction panel** listing the query script, runner command, required env vars, and expected data shape (`{!data && (...)}` block)

5. **Wire it to a query script** — either existing or new (see "Add a New Script" below)

6. **Register a runner target** in `run-query.sh` — add a case to `get_target_config()` and add the target name to the `TARGETS` list

7. **Add schema files** under `BVE-dashboards-for-SUITE/data/schemas/` if the dashboard introduces new dataframe shapes

8. **Add example data** under `BVE-dashboards-for-SUITE/data/examples/` with realistic sample output

9. **Create tests** directory with at minimum:
   - `tests/core/schema-validation.test.js`
   - `tests/core/data-processor.test.js`
   - `tests/core/error-boundaries.test.js`
   - `tests/schemas/schema-validation.test.js`

10. **Add vitest config** — `vitest.config.js` and `package.json` with `test`, `test:watch`, `test:coverage` scripts

11. **Update root package.json** — add `build:SUITE` and `test:SUITE` npm scripts if this is a new suite

12. **Update dependencies/README.md** — add rows to dependency map, config schemas, output shapes, and API endpoints

13. **Update docs/dashboard-status.md** — add the dashboard and its readiness state

14. **Update docs/data-collection.md** if introducing a new target or collection workflow

15. **Update root README.md** only if the repo-level dashboard summary changes

16. **Verify .gitignore** — the rule `**/dashboard/*/data/` should cover the new output dir automatically

17. **Run `npm test`** to confirm all existing and new tests pass

## Add a New Query Script

### 1. Register the target in run-query.sh

Add a case to `get_target_config()`:

```bash
    my-new-target)
      query_script="BVE-dashboards-for-SUITE/data/queries/my-script.sh"
      required_vars="ORG"
      optional_vars="DAYS"
      output_dirs="BVE-dashboards-for-SUITE/dashboard/DASHBOARD_TYPE/data"
      base_filename="my-script"
      ;;
```

Add the target name to the `TARGETS` list.

### 2. Update the dashboard's instruction panel

In `index.html`, update the `{!data && (...)}` block to reference the new script and runner command.

### 3. Update dependencies/README.md

Add a row to the dependency map table and document the expected JSON output shape.

### 4. Update docs

- `docs/data-collection.md` — add the new target
- `README.md` — only if the top-level summary should mention it

### 5. Verify .gitignore coverage

The rule `**/dashboard/*/data/` covers new dashboard `data/` dirs automatically.

### 6. Update tests

Add test cases for the new data source in:
- `tests/core/data-processor.test.js`
- `tests/core/schema-validation.test.js`

## Modify an Existing Dependency

### Renaming a script
1. Rename the `.sh` file (use `git mv`)
2. Update `query_script` in matching `get_target_config()` case(s)
3. Update `base_filename` if output file name should change
4. Update the dashboard's instruction panel
5. Update UploadPanel helper text (grep for the old name)
6. Update `dependencies/README.md`
7. Update `docs/data-collection.md`

### Changing which dashboards a script feeds
1. Add/remove cases in `get_target_config()` — each case maps one target to one output dir
2. For multiple dashboards from one script, create multiple targets with same `query_script` but different `output_dirs`
3. Update the `TARGETS` list
4. Update instruction panels in affected dashboards
5. Update `dependencies/README.md`

### Adding or changing a data field
1. Update the query script's `jq` output construction
2. Update relevant `data/schemas/df-*-schema.json`
3. Update dashboard HTML's data-loading logic
4. Update example data in `data/examples/`
5. Update/add tests
6. Update the **Detailed Output Shapes** section in `dependencies/README.md`
7. Run `node scripts/validators/validate-data.js <file> <type>` to verify
8. Run `npm test`

### Adding or changing a config key (`cfg_*`/`est_*`)
1. Add key with default to dashboard's `let config = {...}` in `index.html`
2. Add a control in `ConfigPanel` if user-facing
3. Update `data/examples/sample-config.json`
4. Update the **Dashboard Config Schemas** table in `dependencies/README.md`
5. If shared across dashboards, update each dashboard
6. Add test cases
7. Run `npm test`

## Materialized Artifact Envelope Format

All materialized artifacts follow this structure:

```json
{
  "artifact": {
    "stage": "materialized",
    "name": "artifact-name",
    "version": "1.0.0",
    "computed_at": "2024-01-15T06:00:00.000Z",
    "compute_ms": 42,
    "inputs": [
      { "file": "raw/copilot-metrics-2024-01-15.json", "hash": null }
    ],
    "profile": {
      "element_count": 2,
      "date_range": { "first": "2024-01-01", "last": "2024-01-28" },
      "config_used": { ... }
    }
  },
  "elements": [ ... ]
}
```

Key fields:
- `stage` — always `"materialized"`
- `name` — matches the artifact file name
- `version` — semantic version of the materializer
- `inputs` — list of raw input files used
- `profile` — summary metadata including config and date range
- `elements` — the actual data payload (array of element objects)

## Dashboard Technology Stack

- **React 18** via CDN (no bundler)
- **Highcharts** via CDN for charts
- **Primer CSS** dark theme via CDN
- **Babel standalone** for JSX transformation in-browser
- Versions pinned in `build-config/dashboard-config.js`

## V2 Dashboard Auto-Load Pattern

V2 dashboards fetch data via:
```javascript
fetch('./data/manifest.json')
```
The manifest is generated by `scripts/build-pages.sh` during Pages deployment. Manual file upload is always available as fallback.

## References

- [Script-to-dashboard dependency map](references/dependency-map.md)
- [Artifact envelope schema](references/artifact-envelope.md)
