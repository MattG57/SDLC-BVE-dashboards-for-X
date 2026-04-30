#!/usr/bin/env bash
set -euo pipefail

# run-query.sh — Entry point for the BVE data pipeline.
#
# Wraps scripts/collect-and-materialize.sh with a simpler interface.
# All data collection, materialization, and configuration is handled
# by the underlying pipeline script.
#
# Usage:
#   ./run-query.sh                           Run full pipeline (default profile)
#   ./run-query.sh --profile <name>          Use a named profile from query-settings.json
#   ./run-query.sh --materialize-only        Skip collection, re-materialize from cached data
#   ./run-query.sh --collect                 Force collection even if profile skips it
#   ./run-query.sh --session-logs-only       Fetch agent session logs only
#   ./run-query.sh --no-streaming            Use standard (non-streaming) materializer
#   ./run-query.sh --dry-run                 Show what would happen without executing
#   ./run-query.sh --help                    Show this help
#
# Configuration:
#   query-settings.json    Profiles with ORG, ENTERPRISE, DAYS, and pipeline settings
#   Environment variables  Override any profile value (env wins over profile)
#
# See docs/data-sources.md for the full pipeline execution plan.
# See docs/config-examples.md for common scenarios.
# See docs/query-settings.md for all configuration keys.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_SCRIPT="${SCRIPT_DIR}/scripts/collect-and-materialize.sh"

show_help() {
  sed -n '3,/^$/{ s/^# \?//; p }' "$0"
  echo ""
  echo "Profiles in query-settings.json:"
  local settings="${SCRIPT_DIR}/query-settings.json"
  if [[ -f "$settings" ]]; then
    jq -r 'keys[] | "  " + .' "$settings" 2>/dev/null || echo "  (parse error)"
  else
    echo "  (no query-settings.json found)"
  fi
  echo ""
  echo "Pipeline steps (via PIPELINE_STEP env or profile key):"
  echo "  collect          Collect raw data from GitHub APIs"
  echo "  session-logs     Fetch agent session logs from Actions"
  echo "  materialize      Produce artifacts from raw data"
  echo "  deploy           Build and deploy to GitHub Pages"
  echo ""
  echo "Examples:"
  echo "  ./run-query.sh                              # full pipeline, default profile"
  echo "  ./run-query.sh --profile short-window       # use a named profile"
  echo "  ./run-query.sh --materialize-only            # re-materialize cached data"
  echo "  DAYS=7 ./run-query.sh                        # override lookback window"
  echo "  PIPELINE_STEP=materialize,deploy ./run-query.sh  # skip collection"
}

# Pass --help through before delegating
for arg in "$@"; do
  if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
    show_help
    exit 0
  fi
done

# Delegate everything to the pipeline script
exec bash "$PIPELINE_SCRIPT" "$@"
