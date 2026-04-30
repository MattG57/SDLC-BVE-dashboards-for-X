# SDLC BVE Dashboards for X

Business Value Engineering dashboards for measuring GitHub Copilot and SDLC impact across organizations.

## Quick Setup

```bash
git clone <repo-url>
cd SDLC-BVE-dashboards-for-X
npm install --include=dev
```

**1. Configure data collection** — edit `query-settings.json`:
```json
{ "default": { "ORG": "your-org", "ENTERPRISE": "your-enterprise", "DAYS": "28" } }
```

**2. Configure dashboard parameters** — edit `dashboard-config.json`:
```json
{ "cfg_total_developers": 500, "cfg_pct_time_coding": 0.25, "cfg_labor_cost_per_hour": 100 }
```

**3. Verify configuration**:
```bash
./run-query.sh --dry-run
```

**4. Run the pipeline**:
```bash
export GITHUB_TOKEN="ghp_..."
./run-query.sh
```

**5. Deploy to GitHub Pages** — add `DASHBOARD_GH_TOKEN` secret, enable Pages, and the nightly pipeline publishes automatically.

For the full setup guide including PAT creation, SSO authorization,
and deployment details, see [docs/getting-started.md](docs/getting-started.md).

## Dashboards

### V2 (Auto-loading from pipeline)

| Dashboard | Purpose |
|---|---|
| **Integrated Leverage** | Combined leverage across all elements |
| **AI-Assisted Efficiency** | Time and cost savings from Copilot IDE usage |
| **AI-Assisted Structural** | Adoption patterns, consistency, output correlation |
| **AI-Assisted Element** | Leverage rectangle with structural projections |
| **Agentic Efficiency** | Value from Copilot Coding Agent PRs |
| **Agentic Element** | Agent leverage with scaling projections |
| **Demo — Concepts** | Narrative walkthrough of the leverage framework |
| **Demo — Live Examples** | Live data examples from V2 dashboards |

### V1 (Manual file upload)

Legacy dashboards in each workspace's `dashboard/` directory. See
[docs/dashboard-status.md](docs/dashboard-status.md) for migration state.

## Common Commands

```bash
npm test                  # run all tests (740)
npm run build             # build all dashboards
npm run validate          # lint + format + test
./run-query.sh --dry-run  # verify pipeline config
./run-query.sh            # run full pipeline
```

## Documentation

| Doc | Purpose |
|---|---|
| [getting-started.md](docs/getting-started.md) | Customer setup guide (step by step) |
| [data-sources.md](docs/data-sources.md) | API endpoints, data filtering, execution plan |
| [data-collection.md](docs/data-collection.md) | Pipeline steps, artifacts, dashboard mapping |
| [query-settings.md](docs/query-settings.md) | Configuration keys and profiles |
| [config-examples.md](docs/config-examples.md) | Common scheduled and ad-hoc scenarios |
| [pat-setup.md](docs/pat-setup.md) | PAT creation and SSO authorization |
| [development.md](docs/development.md) | Contributor workflow |
| [BUILD-SYSTEM.md](docs/BUILD-SYSTEM.md) | Build internals |
| [dependencies/README.md](dependencies/README.md) | Dependency map and change checklists |

## License

This repository does not currently declare a license file.

## Support

Open an issue or coordinate with the repository maintainers for usage questions and data assumptions.
