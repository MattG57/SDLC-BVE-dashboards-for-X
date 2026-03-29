# Getting Started

Use this guide for the fastest successful path from clone to dashboard.

**Last reviewed:** 2026-03-29

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

## Fastest Start

```bash
npm install --include=dev
./run-query.sh --list
./run-query.sh ai-assisted-efficiency
# macOS
open BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
# Linux
xdg-open BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
# Windows
start BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
```

The first `run-query.sh` run prompts for the required variables and can save them in `query-settings.json` as a reusable profile.

## Choose a Dashboard

### AI-Assisted Efficiency

Use this when you want to estimate Copilot IDE impact on developer time and labor cost.

- Dashboard: `BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html`
- Target: `ai-assisted-efficiency`
- Input: Copilot metrics JSON
- Best for: productivity and cost-savings conversations tied to IDE usage

### AI-Assisted Structural

Use this when you want to understand adoption patterns, usage consistency, and output correlation.

- Dashboard: `BVE-dashboards-for-ai-assisted-coding/dashboard/structural/index.html`
- Targets:
  - `ai-assisted-structural`
  - `pr-review-structural`
- Input: Copilot metrics JSON plus PR review metrics JSON
- Best for: organizational rollout, adoption, and behavior-pattern analysis

### Agentic Efficiency

Use this when you want to estimate human-equivalent value from Copilot Coding Agent pull requests.

- Dashboard: `BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/index.html`
- Target: `agentic-efficiency`
- Input: coding-agent PR metrics JSON
- Best for: autonomous-agent throughput, PR outcomes, and turbulence analysis

## Decision Guide

Choose AI-assisted efficiency if your core question is, "How much developer time or cost are IDE features saving?"

Choose AI-assisted structural if your core question is, "Is adoption broad, steady, and correlated with output?" This dashboard requires two input files.

Choose agentic efficiency if your core question is, "What value are we getting from Copilot Coding Agent PRs?" This dashboard is about merged agent work rather than IDE interactions.

## Typical Workflow

1. Install dependencies with `npm install --include=dev`.
2. Collect the dashboard input data with `./run-query.sh <target>`.
3. Open the relevant `index.html` file directly in your browser.
4. Upload the generated JSON file through the dashboard UI.

## Verify the Repo

```bash
npm test
npm run validate
npm run build
```

## Troubleshooting / FAQ

### `gh` auth or token errors

If query scripts fail with GitHub authentication errors:

- run `gh auth login`
- confirm the token or CLI session has `copilot` plus `read:org` or `read:enterprise` access
- retry with a small target first, such as `./run-query.sh --dry-run ai-assisted-efficiency`

### Empty or incomplete output

If a query completes but the data looks empty:

- confirm you targeted the right `ORG` or `ENTERPRISE`
- increase or decrease `DAYS` to sanity-check the window
- use `./run-query.sh --dry-run <target>` to confirm the resolved configuration

### Test tools not installed

If `npm test` fails because dev tooling is missing, install with:

```bash
npm install --include=dev
```

This repo expects dev dependencies to be present for tests and validation.

For detailed collection examples, see [data-collection.md](data-collection.md).
For current readiness and migration state, see [dashboard-status.md](dashboard-status.md).
For contributor workflows, see [development.md](development.md).
