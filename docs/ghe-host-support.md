# GitHub Enterprise Host Support (`GH_HOST`)

> **Status: planned — not yet implemented.** This document defines the
> configuration contract and an implementation plan. Today the pipeline
> only works against `github.com`.

## Problem

All collectors call the `gh` CLI without a host, and several gate on an
unscoped `gh auth status`. On a GitHub Enterprise Cloud with data residency
tenant (`<subdomain>.ghe.com`) or a GitHub Enterprise Server (GHES) instance,
that check validates against `github.com` and the script exits with
`gh CLI not authenticated` even though a valid token is present.

## Configuration contract

| Setting | Where | Default | Meaning |
|---|---|---|---|
| `GH_HOST` | `query-settings.json` profile key, env var, or `vars.GH_HOST` repo variable | `github.com` | Hostname of the GitHub instance to collect from, e.g. `octo.ghe.com` or `github.example.com` |

Token handling follows the `gh` CLI's own rules (`gh help environment`):

| Host type | Example | Token variable `gh` reads |
|---|---|---|
| github.com | `github.com` | `GH_TOKEN` / `GITHUB_TOKEN` |
| GHE.com (data residency) | `octo.ghe.com` | `GH_TOKEN` / `GITHUB_TOKEN` |
| GHES | `github.example.com` | `GH_ENTERPRISE_TOKEN` / `GITHUB_ENTERPRISE_TOKEN` |

Precedence is unchanged: CLI flag > env var > workflow input/variable >
profile value > default.

## Implementation plan

1. **Resolve the host once.** In `scripts/collect-and-materialize.sh`, after
   `load_profile`, add `export GH_HOST="${GH_HOST:-github.com}"`. Because
   `gh` honours `GH_HOST` for every `gh api` call, this alone routes all
   REST and GraphQL traffic to the right instance. Child collectors inherit it.
2. **Scope every auth check to the host.** Replace the unscoped checks in
   `copilot-user-and-enterprise-metrics.sh`, `coding-agent-pr-metrics.sh`,
   `human-pr-metrics.sh`, `user-pr-metrics.sh`, `org-members.sh` and
   `agent-session-logs.sh` with:

   ```bash
   export GH_HOST="${GH_HOST:-github.com}"
   if ! gh auth status --hostname "$GH_HOST" >/dev/null 2>&1; then
     echo "Error: gh CLI not authenticated for host '$GH_HOST'." >&2
     echo "Run 'gh auth login --hostname $GH_HOST' or set GH_TOKEN (github.com/ghe.com) or GH_ENTERPRISE_TOKEN (GHES)" >&2
     exit 1
   fi
   ```

   Likewise use `gh auth token --hostname "$GH_HOST"` where scripts read the
   stored token.
3. **GHES token mapping.** When `GH_HOST` is neither `github.com` nor
   `*.ghe.com` and only `GH_TOKEN` is set, export
   `GH_ENTERPRISE_TOKEN="$GH_TOKEN"` in `collect-and-materialize.sh` so a
   single secret works for every host type.
4. **Surface it.** Print the resolved host in `./run-query.sh --dry-run` and
   record it in `query-status.json` and the artifact profile (`inputs.host`)
   so the data-status dashboard shows which instance was collected.
5. **Workflow.** Add `GH_HOST: ${{ vars.GH_HOST || 'github.com' }}` to the
   `env:` of the collect, session-log and materialize steps in
   `.github/workflows/pipeline-deploy.yml`.
6. **Docs.** Add `GH_HOST` to the key table in
   [query-settings.md](query-settings.md), and host-specific PAT notes to
   [pat-setup.md](pat-setup.md).
7. **Tests.** Add a CI check that runs `--dry-run` with
   `GH_HOST=example.ghe.com` and asserts the host is reported, plus a
   shell test that the auth-check error names the configured host.

## Known compatibility questions

- **API availability differs by product.** The Copilot usage metrics report
  endpoints (`/enterprises/{e}/copilot/metrics/reports/...`) and the Copilot
  coding agent may not exist on every GHES version. Collectors should treat
  a `404` on a non-`github.com` host as "not available on this host" and
  report it in `query-status.json`, not fail the whole run.
- **Signed download links** returned by the metrics report API are fetched
  with `curl`; they are absolute URLs and are host-agnostic.
- **Dashboard links.** The v4 dashboards contain no hard-coded
  `https://github.com` links today; any future PR/user links should be built
  from the host recorded in the artifact.

## Origin

Raised in #59 (§1.2) by a downstream deployment on a `*.ghe.com` tenant,
where every collector failed at the first auth check.
