# BVE Dashboards for Agentic AI Coding

This package measures the efficiency and quality impact of GitHub Copilot Coding Agent activity.

## Dashboards

### Efficiency Dashboard

Path: `dashboard/efficiency/`

Purpose:
- Estimate human-equivalent hours saved from merged agent work
- Estimate economic value from agent output
- Track merge rate, PR details, and turbulence signals

Primary inputs:
- Agentic metrics JSON from `coding-agent-pr-metrics.sh`
- Optional config JSON with `cfg_*` and `est_*` overrides

Implementation details live in [dashboard/efficiency/README.md](dashboard/efficiency/README.md).

### Element Dashboard (Leverage)

Path: `dashboard/element/`

Purpose:
- Visualize leverage as a rectangle (dev-hours × completions) using an additive model
- Project improved leverage via structural factor scenarios (Adoption, Merge Rate, Repo Coverage)
- Duration-based and LoC-based estimation methods
- Developer search overlay for per-dev leverage comparison

Primary inputs:
- Same agentic metrics JSON as the efficiency dashboard
- Optional config JSON with `cfg_*` and `est_*` overrides
- Loaded via file upload (no `run-query.sh` target needed)

## What Makes It Different

- Measures autonomous coding sessions rather than IDE interactions
- Counts merged PR output rather than all interactive activity
- Uses duration-based and LoC-based estimation methods
- Includes turbulence signals to describe friction and quality issues

## Data Assets

- Query script: `data/queries/coding-agent-pr-metrics.sh`
- Schemas: `data/schemas/`
- Example files: `data/examples/`

## Canonical Workflow Docs

- [../docs/getting-started.md](../docs/getting-started.md)
- [../docs/data-collection.md](../docs/data-collection.md)
- [../docs/dashboard-status.md](../docs/dashboard-status.md)

## Package Notes

- Expected top-level JSON keys are `pr_sessions`, `requests`, and `developer_day_summary`.
- Config overrides use the same `cfg_*` and `est_*` pattern as the other dashboards.

## License

This repository does not currently declare a license file.
