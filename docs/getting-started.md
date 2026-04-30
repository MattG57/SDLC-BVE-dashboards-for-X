# Getting Started

Use this guide for the fastest successful path from clone to running
dashboards — locally or deployed via GitHub Pages.

## Customer Setup — Step by Step

### Step 1. Clone and install

```bash
git clone <your-fork-or-copy>
cd SDLC-BVE-dashboards-for-X
npm install --include=dev
```

### Step 2. Create a GitHub PAT

Create a Personal Access Token (classic) with these scopes:

| Scope | When Needed |
|---|---|
| `copilot` | Always — Copilot metrics |
| `read:org` | Org-level data |
| `read:enterprise` | Enterprise-level data |
| `repo` | PR metrics and Actions logs |

If your org uses SAML SSO, authorize the token for the org.
See [pat-setup.md](pat-setup.md) for detailed instructions.

### Step 3. Configure data collection

Edit `query-settings.json` in the repo root:

```json
{
  "default": {
    "ORG": "your-org",
    "ENTERPRISE": "your-enterprise-slug",
    "DAYS": "28"
  }
}
```

Set `ENTERPRISE` if you have enterprise-level access (covers all orgs).
Set `ORG` alone if you only have org-level access.
See [query-settings.md](query-settings.md) for all available keys.

### Step 4. Configure dashboard parameters

Edit `dashboard-config.json` in the repo root. These values feed into
every leverage calculation:

```json
{
  "cfg_total_developers": 500,
  "cfg_pct_time_coding": 0.25,
  "cfg_labor_cost_per_hour": 100,
  "est_hrs_per_kloc": 1,
  "est_duration_factor": 10
}
```

| Key | What It Controls | How to Determine |
|---|---|---|
| `cfg_total_developers` | Org capacity denominator | Number of developers in org |
| `cfg_pct_time_coding` | Hours per dev per day | Fraction of workday spent coding (0.25 = 2h/day) |
| `cfg_labor_cost_per_hour` | Economic value calculation | Fully loaded cost per developer hour |
| `cfg_total_repos` | Repo coverage context | Number of active repositories |
| `est_hrs_per_kloc` | Agentic time saved estimate | Estimated hours to write 1K lines manually |
| `est_duration_factor` | Agentic duration-based estimate | Wall-clock to dev-hours multiplier |
| `est_interactions_per_hour` | AI-assisted time saved estimate | Copilot interactions per coding hour |

Getting `cfg_total_developers` right is critical — it sets the
denominator for adoption rates and aperture. An incorrect value
(e.g., the default 100 vs actual 1100) will produce wildly wrong
percentages.

### Step 5. Verify with dry-run

```bash
./run-query.sh --dry-run
```

This shows:
- Resolved config (profile + env overrides)
- Which API level each script will use (Enterprise vs Org)
- Which artifacts and dashboards will have data
- No API calls are made

### Step 6. Run locally (optional)

```bash
export GITHUB_TOKEN="ghp_your_token_here"
./run-query.sh
```

This collects data, materializes artifacts, and writes everything to
`dashboard/dataflow/data/`. Open any dashboard `index.html` in your
browser to see results.

### Step 7. Deploy to GitHub Pages

Push your configured repo and set up the nightly pipeline:

1. **Add the PAT** as a repository secret named `DASHBOARD_GH_TOKEN`
2. **Set repository variables**: `ENTERPRISE`, `ORG`, `DAYS`
3. **Enable GitHub Pages** (Settings → Pages → Source: GitHub Actions)
4. **Trigger the pipeline**: `gh workflow run pipeline-deploy.yml`

The nightly workflow runs at 6 AM UTC automatically. Dashboards
auto-load the latest materialized artifacts.

See [config-examples.md](config-examples.md) for common scenarios
and [data-sources.md](data-sources.md) for the full pipeline execution plan.

---

## Prerequisites

- Node.js `>=18`
- npm `>=9`
- `gh` CLI authenticated with `gh auth login`
- GitHub access appropriate for the data you want:
  - `copilot`
  - `read:org` or `read:enterprise`

If you use a token instead of the GitHub CLI session:

```bash
export GITHUB_TOKEN="your_token_here"
```

The AI-assisted workspace also provides:

```bash
npm run dev:structural --workspace=BVE-dashboards-for-ai-assisted-coding
```

These convenience scripts detect macOS, Linux, and Windows automatically and open the matching dashboard in your default browser.

## V2 Dashboards

V2 dashboards auto-load from materialized artifacts when deployed to
GitHub Pages. No file upload needed.

| Dashboard | What It Answers |
|---|---|
| **Integrated Leverage** | What is combined leverage across all elements? |
| **AI-Assisted Efficiency** | How much time are IDE features saving? |
| **AI-Assisted Structural** | Is adoption broad, steady, and correlated with output? |
| **AI-Assisted Element** | What is AI-assisted leverage and how do structural factors affect it? |
| **Agentic Efficiency** | What value are Copilot coding agent PRs delivering? |
| **Agentic Element** | What is agentic leverage and how does it scale? |

Start with **Integrated Leverage** for the org-wide view, then drill
into element dashboards for per-area detail.

## V1 Dashboards (Legacy)

V1 dashboards load data via browser file upload. Use `run-query-legacy.sh`
to collect data into V1 dashboard directories.

## Typical Workflow

1. Install dependencies with `npm install --include=dev`.
2. Configure `query-settings.json` with your org/enterprise values.
3. Run the pipeline with `./run-query.sh`.
4. V2 dashboards auto-load from materialized artifacts when deployed.
5. For local use, open `index.html` and upload JSON files via the dashboard UI.

The AI-assisted workspace also has convenience scripts that handle cross-platform open:

```bash
cd BVE-dashboards-for-ai-assisted-coding
npm run dev:efficiency
npm run dev:structural
```

## Verify the Repo

```bash
npm test
npm run lint
npm run format
npm run validate
npm run build
```

## Troubleshooting / FAQ

### `gh` auth or token errors

If query scripts fail with GitHub authentication errors:

- run `gh auth login`
- confirm the token or CLI session has `copilot` plus `read:org` or `read:enterprise` access
- if your org uses SAML SSO, authorize the token for the org (see [PAT setup](pat-setup.md))
- run `./run-query.sh --dry-run` to verify config before a full run

### Empty or incomplete output

If a query completes but the data looks empty:

- confirm you set the right `ORG` or `ENTERPRISE` in `query-settings.json`
- increase or decrease `DAYS` to sanity-check the window
- run `./run-query.sh --dry-run` to confirm the resolved configuration

### Test tools not installed

If `npm test` fails because dev tooling is missing, install with:

```bash
npm install --include=dev
```

This repo expects dev dependencies to be present for tests and validation.

For PAT creation and org authorization, see [pat-setup.md](pat-setup.md).
For detailed collection examples, see [data-collection.md](data-collection.md).
For current readiness and migration state, see [dashboard-status.md](dashboard-status.md).
For contributor workflows, see [development.md](development.md).
