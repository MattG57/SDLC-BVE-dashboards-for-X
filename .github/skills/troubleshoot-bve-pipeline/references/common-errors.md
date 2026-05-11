# Common Error Patterns

## Authentication Errors

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Token expired or invalid | Regenerate PAT, run `gh auth login` |
| `403 Forbidden` | Missing scope or SSO not authorized | Add required scopes, authorize for SSO org |
| `404 Not Found` | Wrong org/enterprise name or insufficient permissions | Verify names in `query-settings.json` |
| `gh auth` prompts for login | CLI not authenticated | Run `gh auth login` |

## Data Errors

| Error | Cause | Fix |
|---|---|---|
| Empty JSON `{}` | No data in lookback window | Increase `DAYS`, verify org has active Copilot users |
| `"enterprise_report": null` | Enterprise slug wrong or no enterprise access | Check `ENTERPRISE` value, try org-level instead |
| `jq: error (at <stdin>:0)` | Empty or malformed API response | Check API permissions, try `--dry-run` |
| `SyntaxError: Unexpected token` | Stderr mixed into JSON | Use `> data.json` without `2>&1` |

## Materializer Errors

| Error | Cause | Fix |
|---|---|---|
| `Cannot read properties of null` | Missing input artifact | Run full pipeline to collect all data |
| `ENOENT: no such file` | Raw data files missing | Run collection phase first |
| Stream errors | Streaming mode issue | Use `--no-streaming` flag |

## Dashboard Errors

| Error | Cause | Fix |
|---|---|---|
| Infinite "Loading..." | Missing manifest or artifacts | Run `bash scripts/build-pages.sh` |
| Charts empty | No data in artifacts | Check artifact `elements` array length |
| NaN in values | Should not happen (safeDiv returns null) | Report as a bug |
| `'—'` displayed | Null value (expected behavior) | Provide config value or more data |

## CI/CD Errors

| Error | Cause | Fix |
|---|---|---|
| `Error: Resource not accessible` | Pages not enabled | Enable Pages: Settings → Pages → Source: GitHub Actions |
| Secret not found | `DASHBOARD_GH_TOKEN` not set | Add secret in repo settings |
| `vars.RUNNER_LABEL` empty | Not set (uses default `ubuntu-latest`) | Optional — set if custom runner needed |
