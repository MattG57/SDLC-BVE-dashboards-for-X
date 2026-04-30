# Query Settings Configuration

`query-settings.json` at the repository root stores named profiles of configuration values used by the data collection pipeline.

## File Structure

```json
{
  "default": { ... },
  "alt-demo": { ... }
}
```

Each top-level key is a **profile name**. The `default` profile is used when no profile is specified.

## Configuration Keys

| Key | Description | Default | Override env/flag |
|---|---|---|---|
| `ORG` | GitHub Organization name | `"octodemo"` | `ORG` env var; `--org` workflow input |
| `ENTERPRISE` | GitHub Enterprise slug | `"octodemo"` | `ENTERPRISE` env var; `--enterprise` workflow input |
| `DAYS` | Number of days to look back | `"30"` | `DAYS` env var; `--days` workflow input |
| `MAX_REPOS` | Maximum repositories to scan (empty = unlimited) | `""` | `MAX_REPOS` env var |
| `GH_TOKEN_NAME` | Name of the GitHub token secret | `"DASHBOARD_GH_TOKEN"` | `GH_TOKEN_NAME` env var |
| `STREAM_MODE` | Use streaming materialization (`"true"`/`"false"`) | `"true"` | `STREAM_MODE` env var; `--no-streaming` flag |
| `SKIP_DATA_COLLECTION` | Skip data collection, materialize only (`"true"`/`"false"`) | `"false"` | `SKIP_DATA_COLLECTION` env var; `--materialize-only` flag |
| `PIPELINE_STEP` | Comma-separated steps to run (e.g. `"collect,materialize,deploy"`; empty = all) | `""` | `PIPELINE_STEP` env var; `pipeline_steps` workflow input |
| `RUNNER_LABEL` | GitHub Actions runner label | `"ubuntu-latest"` | `RUNNER_LABEL` repo variable |
| `SETTINGS_VERSION` | Schema version marker (informational) | `"1"` | — |

## Override Precedence

Settings are resolved in the following order (highest wins):

1. **Command-line flags** (e.g. `--no-streaming`, `--materialize-only`, `--collect`)
2. **Environment variables** (e.g. `DAYS=14 ./run-query.sh ...`)
3. **Workflow inputs** (via `workflow_dispatch`)
4. **Profile values** from `query-settings.json`

This means you can set sensible defaults in a profile and override individual values per-run. For example, a profile with `SKIP_DATA_COLLECTION: "true"` can be overridden with `--collect` to force collection.

## Example Profiles

### `default` — standard nightly collection

```json
{
  "ORG": "octodemo",
  "ENTERPRISE": "octodemo",
  "DAYS": "30",
  "MAX_REPOS": "",
  "GH_TOKEN_NAME": "DASHBOARD_GH_TOKEN",
  "STREAM_MODE": "true",
  "SKIP_DATA_COLLECTION": "false",
  "PIPELINE_STEP": "",
  "RUNNER_LABEL": "ubuntu-latest",
  "SETTINGS_VERSION": "1"
}
```

### `alt-demo` — limited demo with deploy-only

```json
{
  "ORG": "acmeinc",
  "ENTERPRISE": "",
  "DAYS": "14",
  "MAX_REPOS": "10",
  "GH_TOKEN_NAME": "ACME_SPECIAL_TOKEN",
  "STREAM_MODE": "false",
  "SKIP_DATA_COLLECTION": "true",
  "PIPELINE_STEP": "deploy",
  "RUNNER_LABEL": "ubuntu-22.04",
  "SETTINGS_VERSION": "1"
}
```

## Usage

### With `run-query.sh`

```bash
# Use default profile
./run-query.sh ai-assisted-efficiency

# Use named profile
./run-query.sh ai-assisted-efficiency alt-demo

# Override a profile value
DAYS=7 ./run-query.sh ai-assisted-efficiency
```

### With `collect-and-materialize.sh`

```bash
# Use default profile
bash scripts/collect-and-materialize.sh

# Use named profile
bash scripts/collect-and-materialize.sh --profile alt-demo

# Override streaming mode from profile
bash scripts/collect-and-materialize.sh --no-streaming

# Force collection even if profile sets SKIP_DATA_COLLECTION
bash scripts/collect-and-materialize.sh --profile alt-demo --collect
```

### In CI (pipeline-deploy.yml)

The workflow reads `RUNNER_LABEL` from repository variables (`vars.RUNNER_LABEL`). Other settings are passed via workflow inputs or repository variables/secrets which take precedence over the profile.

## Adding a New Profile

Add a new top-level key to `query-settings.json`:

```json
{
  "default": { ... },
  "my-team": {
    "ORG": "my-team-org",
    "ENTERPRISE": "",
    "DAYS": "7",
    "MAX_REPOS": "20",
    "GH_TOKEN_NAME": "MY_TEAM_TOKEN",
    "STREAM_MODE": "true",
    "SKIP_DATA_COLLECTION": "false",
    "PIPELINE_STEP": "",
    "RUNNER_LABEL": "ubuntu-latest",
    "SETTINGS_VERSION": "1"
  }
}
```

Or use the interactive save feature in `run-query.sh` which will prompt to save current settings after a run.

## See Also

- [config-examples.md](config-examples.md) — common scheduled and ad-hoc scenarios
- [data-collection.md](data-collection.md) — query targets and output structure
