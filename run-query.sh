#!/usr/bin/env bash
set -euo pipefail

# run-query.sh — Top-level runner for BVE dashboard data queries
#
# Usage:
#   ./run-query.sh <target> [profile]              Run a specific query target
#   ./run-query.sh --all [profile]                 Run all query targets
#   ./run-query.sh --list                          List available targets
#   ./run-query.sh --dry-run <target> [profile]    Show resolved config without running
#   ./run-query.sh --help                          Show this help
#
# Settings are stored in query-settings.json at the repo root.
# After each run you will be prompted to save your settings as a named profile.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS_FILE="${SCRIPT_DIR}/query-settings.json"

# ─── Interactive detection ─────────────────────────────────────────────────────
# Non-interactive when CI is set or /dev/tty is unavailable.  In non-interactive
# mode the script never prompts — missing required variables become hard errors
# and profile-save prompts are skipped.
# ───────────────────────────────────────────────────────────────────────────────

is_interactive() {
  [[ -z "${CI:-}" ]] && [[ -e /dev/tty ]]
}

# ─── Colors (disabled when stderr is not a terminal) ──────────────────────────

if [[ -t 2 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
  BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; NC=''
fi

info()  { printf '%b %s\n' "${BLUE}ℹ${NC}"  "$*" >&2; }
ok()    { printf '%b %s\n' "${GREEN}✔${NC}"  "$*" >&2; }
warn()  { printf '%b %s\n' "${YELLOW}⚠${NC}" "$*" >&2; }
err()   { printf '%b %s\n' "${RED}✖${NC}"   "$*" >&2; }

# ─── Target Registry ──────────────────────────────────────────────────────────
# Each target maps a dashboard to its query script, env vars, and output dir.
# To override output directories, edit the output_dirs value for a target.
#
# Fields set by get_target_config:
#   query_script   — path to the shell script (relative to repo root)
#   required_vars  — space-separated; pipe-delimited groups mean "one of"
#   optional_vars  — space-separated
#   output_dirs    — space-separated output directories (beside dashboard HTML)
#   base_filename  — base name for the output JSON file
# ───────────────────────────────────────────────────────────────────────────────

TARGETS="ai-assisted-efficiency ai-assisted-structural pr-review-structural agentic-efficiency"

get_target_config() {
  case "$1" in
    ai-assisted-efficiency)
      query_script="BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh"
      required_vars="ENTERPRISE|ORG"
      optional_vars="DAYS"
      output_dirs="BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/data"
      base_filename="copilot-user-and-enterprise-metrics"
      ;;
    ai-assisted-structural)
      query_script="BVE-dashboards-for-ai-assisted-coding/data/queries/copilot-user-and-enterprise-metrics.sh"
      required_vars="ENTERPRISE|ORG"
      optional_vars="DAYS"
      output_dirs="BVE-dashboards-for-ai-assisted-coding/dashboard/structural/data"
      base_filename="copilot-user-and-enterprise-metrics"
      ;;
    pr-review-structural)
      query_script="BVE-dashboards-for-ai-assisted-coding/data/queries/human-pr-metrics.sh"
      required_vars="ORG"
      optional_vars="REPO DAYS SINCE UNTIL"
      output_dirs="BVE-dashboards-for-ai-assisted-coding/dashboard/structural/data"
      base_filename="human-pr-metrics"
      ;;
    agentic-efficiency)
      query_script="BVE-dashboards-for-agentic-ai-coding/data/queries/coding-agent-pr-metrics.sh"
      required_vars="ORG"
      optional_vars="REPO DAYS MAX_REPOS"
      output_dirs="BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/data"
      base_filename="coding-agent-pr-metrics"
      ;;
    *)
      return 1
      ;;
  esac
}

# ─── Settings Management ──────────────────────────────────────────────────────

ensure_settings_file() {
  if [[ ! -f "$SETTINGS_FILE" ]]; then
    echo '{}' > "$SETTINGS_FILE"
    info "Created $(basename "$SETTINGS_FILE")"
  fi
}

load_profile() {
  local profile="${1:-default}"
  ensure_settings_file

  if ! jq -e --arg p "$profile" 'has($p)' "$SETTINGS_FILE" >/dev/null 2>&1; then
    if [[ "$profile" != "default" ]]; then
      warn "Profile '$profile' not found in $(basename "$SETTINGS_FILE")"
    fi
    return 0
  fi

  local keys
  keys=$(jq -r --arg p "$profile" '.[$p] | keys[]' "$SETTINGS_FILE" 2>/dev/null) || return 0

  for key in $keys; do
    local val
    val=$(jq -r --arg p "$profile" --arg k "$key" '.[$p][$k]' "$SETTINGS_FILE")
    if [[ -n "$val" && "$val" != "null" ]]; then
      export "$key=$val"
    fi
  done

  ok "Loaded profile: $profile"
}

save_profile() {
  local profile="$1"
  shift

  ensure_settings_file

  local json_obj="{}"
  for var in "$@"; do
    local val="${!var:-}"
    if [[ -n "$val" ]]; then
      json_obj=$(echo "$json_obj" | jq --arg k "$var" --arg v "$val" '. + {($k): $v}')
    fi
  done

  local updated
  updated=$(jq --arg p "$profile" --argjson obj "$json_obj" '. + {($p): $obj}' "$SETTINGS_FILE")
  echo "$updated" > "$SETTINGS_FILE"

  ok "Saved profile '$profile' → $(basename "$SETTINGS_FILE")"
}

prompt_save() {
  if ! is_interactive; then return 0; fi
  echo "" >&2
  local save_answer
  read -r -p "$(printf '%b' "${BLUE}ℹ${NC}") Save these settings for next time? [y/N] " save_answer </dev/tty
  if [[ "${save_answer:-}" =~ ^[Yy] ]]; then
    local profile_name
    read -r -p "$(printf '%b' "${BLUE}ℹ${NC}") Profile name [default]: " profile_name </dev/tty
    profile_name="${profile_name:-default}"
    save_profile "$profile_name" "$@"
  fi
}

# ─── Variable Resolution ──────────────────────────────────────────────────────

collect_var_names() {
  local req="$1" opt="$2"
  local names=""
  for group in $req; do
    if [[ "$group" == *"|"* ]]; then
      names="$names ${group//|/ }"
    else
      names="$names $group"
    fi
  done
  for var in $opt; do
    names="$names $var"
  done
  echo "$names"
}

resolve_vars() {
  local req="$1" opt="$2"

  for group in $req; do
    if [[ "$group" == *"|"* ]]; then
      # "One of" group — e.g. ENTERPRISE|ORG
      IFS='|' read -ra group_vars <<< "$group"

      local found=false
      for var in "${group_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
          found=true
          info "$var = ${!var}"
          break
        fi
      done

      if [[ "$found" == false ]]; then
        if ! is_interactive; then
          err "At least one of ${group//|/ or } is required (non-interactive mode — set one of these env vars before running)."
          exit 1
        fi
        echo "" >&2
        warn "One of the following is required: ${group//|/ or }"
        for var in "${group_vars[@]}"; do
          local val
          read -r -p "$(printf '%b' "${BLUE}ℹ${NC}") $var (leave empty to skip): " val </dev/tty
          if [[ -n "$val" ]]; then
            export "$var=$val"
            info "$var = $val"
            found=true
            break
          fi
        done

        if [[ "$found" == false ]]; then
          err "At least one of ${group//|/ or } is required."
          exit 1
        fi
      fi
    else
      # Simple required var
      if [[ -z "${!group:-}" ]]; then
        if ! is_interactive; then
          err "$group is required (non-interactive mode — set $group env var before running)."
          exit 1
        fi
        local val
        read -r -p "$(printf '%b' "${BLUE}ℹ${NC}") $group (required): " val </dev/tty
        if [[ -z "$val" ]]; then
          err "$group is required."
          exit 1
        fi
        export "$group=$val"
      fi
      info "$group = ${!group}"
    fi
  done

  for var in $opt; do
    if [[ -n "${!var:-}" ]]; then
      info "$var = ${!var}"
    fi
  done
}

# ─── Run a single target ──────────────────────────────────────────────────────

run_target() {
  local target="$1"
  local profile="$2"
  local dry_run="${3:-false}"
  local cache_dir="${4:-}"

  get_target_config "$target" || {
    err "Unknown target: $target"
    echo "  Available targets:" >&2
    for t in $TARGETS; do echo "    $t" >&2; done
    return 1
  }

  echo "" >&2
  printf '%b\n' "${BOLD}━━━ $target ━━━${NC}" >&2
  info "Script:  $query_script"
  info "Profile: $profile"
  echo "" >&2

  load_profile "$profile"
  resolve_vars "$required_vars" "$optional_vars"

  # Build output filename: {enterprise_or_org}-{base_filename}.json
  local org_or_ent="${ENTERPRISE:-${ORG:-unknown}}"
  local output_file="${org_or_ent}-${base_filename}.json"

  echo "" >&2
  for dir in $output_dirs; do
    info "Output → $dir/$output_file"
  done

  if [[ "$dry_run" == true ]]; then
    ok "[DRY RUN] Would execute: bash $query_script"
    return 0
  fi

  # Check cache (--all mode avoids re-running the same script with same settings)
  local cache_key
  cache_key=$(echo "${query_script}_${org_or_ent}" | tr '/' '_')
  local tmp_output=""

  if [[ -n "$cache_dir" && -f "${cache_dir}/${cache_key}" ]]; then
    ok "Using cached output (same script already ran for $org_or_ent)"
    tmp_output="${cache_dir}/${cache_key}"
  else
    tmp_output=$(mktemp)
    echo "" >&2
    info "Executing query script..."
    echo "" >&2

    if ! bash "${SCRIPT_DIR}/${query_script}" > "$tmp_output"; then
      err "Query script failed."
      rm -f "$tmp_output"
      return 1
    fi

    # Validate JSON
    if ! jq empty "$tmp_output" 2>/dev/null; then
      err "Script output is not valid JSON."
      local preview
      preview=$(head -c 200 "$tmp_output")
      err "Preview: $preview"
      rm -f "$tmp_output"
      return 1
    fi

    # Store in cache if in --all mode
    if [[ -n "$cache_dir" ]]; then
      cp "$tmp_output" "${cache_dir}/${cache_key}"
      rm -f "$tmp_output"
      tmp_output="${cache_dir}/${cache_key}"
    fi
  fi

  # Write to output directories
  local file_size
  file_size=$(wc -c < "$tmp_output" | tr -d ' ')

  for dir in $output_dirs; do
    mkdir -p "${SCRIPT_DIR}/${dir}"
    cp "$tmp_output" "${SCRIPT_DIR}/${dir}/${output_file}"
    ok "Wrote $dir/$output_file ($file_size bytes)"
  done

  # Clean up if not cached
  if [[ -z "$cache_dir" ]]; then
    rm -f "$tmp_output"
  fi
}

# ─── Help & List ───────────────────────────────────────────────────────────────

show_help() {
  cat >&2 <<'EOF'
run-query.sh — Top-level runner for BVE dashboard data queries

Usage:
  ./run-query.sh <target> [profile]              Run a query target
  ./run-query.sh --all [profile]                 Run all query targets
  ./run-query.sh --list                          List available targets
  ./run-query.sh --dry-run <target> [profile]    Show resolved config only
  ./run-query.sh --help                          Show this help

Targets:
  ai-assisted-efficiency    Copilot usage metrics  → efficiency dashboard
  ai-assisted-structural    Copilot usage metrics  → structural dashboard
  pr-review-structural      PR review data         → structural dashboard
  agentic-efficiency        Agentic coding metrics → efficiency dashboard

Arguments:
  target    Dashboard target name (see above)
  profile   Named profile from query-settings.json (default: "default")

Settings:
  Profiles are stored in query-settings.json at the repo root.
  After each run you are prompted to save settings as a named profile.

Examples:
  ./run-query.sh ai-assisted-efficiency                  # default profile
  ./run-query.sh agentic-efficiency myorg                # named profile
  ./run-query.sh --all                                   # all targets
  ./run-query.sh --dry-run pr-review-structural myorg    # preview config
EOF
}

show_list() {
  echo "" >&2
  info "Available targets:"
  echo "" >&2
  printf '  %-26s %-18s %s\n' "TARGET" "REQUIRED VARS" "OUTPUT DIR" >&2
  printf '  %-26s %-18s %s\n' "──────────────────────────" "──────────────────" "──────────" >&2
  for t in $TARGETS; do
    get_target_config "$t"
    printf '  %-26s %-18s %s\n' "$t" "${required_vars//|/ or }" "$output_dirs" >&2
  done
  echo "" >&2
}

# ─── Main ──────────────────────────────────────────────────────────────────────

main() {
  if [[ $# -eq 0 ]]; then
    show_help
    exit 1
  fi

  local dry_run=false
  local run_all=false
  local target=""
  local profile="default"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help|-h)   show_help; exit 0 ;;
      --list|-l)   show_list; exit 0 ;;
      --dry-run)   dry_run=true; shift ;;
      --all)       run_all=true; shift ;;
      -*)          err "Unknown option: $1"; show_help; exit 1 ;;
      *)
        if [[ -z "$target" && "$run_all" == false ]]; then
          target="$1"
        else
          profile="$1"
        fi
        shift
        ;;
    esac
  done

  # Check dependencies
  for cmd in jq gh; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      err "Required command not found: $cmd"
      exit 1
    fi
  done

  if [[ "$run_all" == true ]]; then
    info "Running all targets with profile: $profile"

    _CACHE_DIR=$(mktemp -d)
    trap 'rm -rf "$_CACHE_DIR"' EXIT

    local failed=0
    for t in $TARGETS; do
      if ! run_target "$t" "$profile" "$dry_run" "$_CACHE_DIR"; then
        warn "Target '$t' failed — continuing"
        failed=$((failed + 1))
      fi
    done

    echo "" >&2
    if [[ $failed -eq 0 ]]; then
      ok "All targets completed successfully"
    else
      warn "$failed target(s) failed"
    fi

    if [[ "$dry_run" == false && $failed -lt $(echo "$TARGETS" | wc -w | tr -d ' ') ]]; then
      local all_var_names=""
      for t in $TARGETS; do
        get_target_config "$t"
        all_var_names="$all_var_names $(collect_var_names "$required_vars" "$optional_vars")"
      done
      # Deduplicate
      all_var_names=$(echo "$all_var_names" | tr ' ' '\n' | sort -u | tr '\n' ' ')
      prompt_save $all_var_names
    fi
  else
    if [[ -z "$target" ]]; then
      err "No target specified."
      show_help
      exit 1
    fi

    if ! run_target "$target" "$profile" "$dry_run"; then
      exit 1
    fi

    if [[ "$dry_run" == false ]]; then
      get_target_config "$target"
      local var_names
      var_names=$(collect_var_names "$required_vars" "$optional_vars")
      prompt_save $var_names
    fi
  fi
}

main "$@"
