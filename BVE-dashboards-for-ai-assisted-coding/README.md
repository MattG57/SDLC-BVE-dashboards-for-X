# BVE Dashboards for AI-Assisted Coding

This package contains the dashboards and supporting data assets for measuring GitHub Copilot IDE impact across an organization.

## Dashboards

### Efficiency Dashboard

Path: `dashboard/efficiency/`

Purpose:
- Estimate hours saved from Copilot IDE interactions
- Estimate labor-cost impact
- Compare interaction-based, LoC-based, and manual-estimate methods

Primary inputs:
- Copilot metrics JSON from `copilot-user-and-enterprise-metrics.sh`
- Optional config JSON with `cfg_*` and `est_*` overrides

Implementation details live in [dashboard/efficiency/README.md](dashboard/efficiency/README.md).

### Structural Dashboard

Path: `dashboard/structural/`

Purpose:
- Evaluate adoption spread and consistency
- Combine Copilot usage and PR-review data
- Explore whether adoption correlates with output

Primary inputs:
- Copilot metrics JSON from `copilot-user-and-enterprise-metrics.sh`
- PR review metrics JSON from `human-pr-metrics.sh`

### Element Dashboard (Leverage)

Path: `dashboard/element/`

Purpose:
- Visualize leverage as a rectangle (dev-hours × completions)
- Project improved leverage via structural factor scenarios (Adoption, % PRs Assisted, % AI-Assisted LOC)
- Developer search overlay for per-dev leverage comparison
- Daily trend panels with 7-day smoothing

Primary inputs:
- Same Copilot metrics and PR review JSON as efficiency/structural dashboards
- Optional config JSON with `cfg_*` and `est_*` overrides
- Loaded via file upload (no `run-query.sh` target needed)

## Data Assets

- Query scripts: `data/queries/`
- Schemas: `data/schemas/`
- Example files: `data/examples/`
- Verification script: `data/verify_math.cjs`

## Canonical Workflow Docs

- [../docs/getting-started.md](../docs/getting-started.md)
- [../docs/data-collection.md](../docs/data-collection.md)
- [../docs/dashboard-status.md](../docs/dashboard-status.md)

## Package Notes

- `copilot-user-and-enterprise-metrics.sh` feeds both AI-assisted dashboards.
- `human-pr-metrics.sh` provides the additional PR dataset used by the structural dashboard.
- Schema files under `data/schemas/` document expected input structures.

## License

This repository does not currently declare a license file.

## Support

Open an issue or coordinate with the repository maintainers for usage questions and data assumptions.
