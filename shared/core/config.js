/**
 * Canonical config registry for all BVE dashboards.
 *
 * This is the single source of truth for config key names, defaults,
 * types, labels, and the provenance/range/sensitivity metadata that
 * docs/estimation-parameters.md is generated from
 * (`node scripts/generate-estimation-docs.js`).
 *
 * Metadata fields:
 *   source    — 'customer' (a fact only the deployment can supply),
 *               'calibrated' (tuned against pipeline data; see calibration
 *               history in the generated doc), 'assumption' (maintainer
 *               judgement), or 'legacy' (read only by legacy dashboards).
 *   rationale — why the default is what it is.
 *   range     — [min, max] plausible band used for sensitivity and
 *               validation warnings; null when not meaningful.
 *   affects   — which outputs read the value.
 *   scaling   — how the affected estimate responds: 'linear' (output ∝ value),
 *               'inverse' (output ∝ 1/value), or null (non-proportional / n/a).
 */

export const CONFIG_REGISTRY = {
  // ─── Organization-wide parameters ───
  cfg_total_developers: {
    default: 100,
    type: 'org',
    label: 'Total Developers',
    description: 'Total number of developers in the organization.',
    unit: 'developers',
    source: 'customer',
    rationale: 'GitHub cannot measure the developer population (see docs/design-decisions.md). 100 is a placeholder; every deployment must set it.',
    range: null,
    affects: ['Adoption %', 'Full Developer Adoption projection'],
    scaling: null,
  },
  cfg_workdays_per_week: {
    default: 5,
    type: 'org',
    label: 'Workdays per Week',
    description: 'Working days per week (excludes weekends).',
    unit: 'days',
    source: 'assumption',
    rationale: 'Standard five-day work week.',
    range: [4, 6],
    affects: ['AI-assisted Manual Daily % estimate'],
    scaling: 'inverse',
  },
  cfg_labor_cost_per_hour: {
    default: null,
    type: 'org',
    label: 'Labor Cost ($/hr)',
    description: 'Fully loaded labor cost per developer hour. Used for economic value calculation.',
    unit: 'USD/hour',
    source: 'customer',
    rationale: 'Organization-specific; left unset so no dollar figure is shown until the deployment supplies one.',
    range: null,
    affects: ['Economic value ($) of hours saved'],
    scaling: 'linear',
  },
  cfg_pct_time_coding: {
    default: 0.25,
    type: 'org',
    label: '% Time Coding',
    description: 'Fraction of work time spent on coding tasks (0–1).',
    unit: 'fraction',
    source: 'assumption',
    rationale: 'Roughly two hours of hands-on coding per eight-hour day. Replace with your own time-allocation data if available.',
    range: [0.1, 0.5],
    affects: ['AI-assisted time spent (leverage denominator)', 'AI-assisted Manual Daily % estimate'],
    scaling: 'linear',
  },
  cfg_pct_time_reviewing: {
    default: 0.2,
    type: 'org',
    label: '% Time Reviewing',
    description: 'Fraction of work time spent on code review (0–1).',
    unit: 'fraction',
    source: 'assumption',
    rationale: 'Reserved for review-time estimates; not read by the current pipeline or v4 dashboards.',
    range: [0.05, 0.35],
    affects: [],
    scaling: null,
  },
  cfg_hrs_per_dev_per_day: {
    default: 8,
    type: 'org',
    label: 'Hours per Dev per Day',
    description: 'Working hours per developer per day. Multiplied by % time coding to estimate AI-assisted time spent.',
    unit: 'hours',
    source: 'assumption',
    rationale: 'Standard eight-hour workday.',
    range: [6, 10],
    affects: ['AI-assisted time spent (leverage denominator)'],
    scaling: 'linear',
  },
  cfg_window_days: {
    default: 28,
    type: 'org',
    label: 'Window Days',
    description: 'Default reporting window (days) for leverage summaries and the agentic session cutoff.',
    unit: 'days',
    source: 'assumption',
    rationale: 'Four full work weeks, matching the Copilot metrics 28-day report.',
    range: [7, 90],
    affects: ['Agentic session window', 'Leverage summary window label'],
    scaling: null,
  },

  // ─── AI-Assisted specific ───
  est_interactions_per_hour: {
    default: 30,
    type: 'ai-assisted',
    label: 'Interactions per Hour',
    description: 'Estimated Copilot interactions per hour of saved time.',
    unit: 'interactions/hour saved',
    source: 'calibrated',
    rationale: 'Raised from 20 to 30 so the Interactions, LoC and Manual % methods converge near ~0.75 hrs/dev/day (commit b90bf39).',
    range: [10, 60],
    affects: ['AI-assisted Interactions-Based hours saved'],
    scaling: 'inverse',
  },
  cfg_time_saved_pct_day: {
    default: 0.38,
    type: 'ai-assisted',
    label: 'Time Saved % / Day',
    description: 'Manual estimate of the fraction of coding time saved per active developer per day (0–1). Used only by the Manual Daily % method.',
    unit: 'fraction of coding time',
    source: 'calibrated',
    rationale: 'Raised from 0.30 to 0.38 in the same convergence calibration (commit b90bf39). 0.38 × 25% coding × 8 h ≈ 0.76 hrs/dev/day.',
    range: [0.1, 0.5],
    affects: ['AI-assisted Manual Daily % hours saved'],
    scaling: 'linear',
  },
  cfg_baseline_hours_per_dev_per_week: {
    default: 40,
    type: 'ai-assisted',
    label: 'Baseline Hrs/Dev/Week',
    description: 'Baseline working hours per developer per week. Used only by the Manual Daily % method.',
    unit: 'hours/week',
    source: 'assumption',
    rationale: 'Standard 40-hour work week.',
    range: [35, 45],
    affects: ['AI-assisted Manual Daily % hours saved'],
    scaling: 'linear',
  },

  // ─── Agentic specific ───
  est_duration_factor: {
    default: 0.2,
    type: 'agentic',
    label: 'Duration Multiplier',
    description: 'Human-equivalent hours saved per hour of merged agent session time. Higher values assume agent work is denser than human work.',
    unit: 'dev-hours per agent-hour',
    source: 'calibrated',
    rationale: 'Changed from 10 to 0.20 in commit cdcd8d1, the same change that began accumulating active minutes across all agent runs per PR. No separate rationale was recorded.',
    range: [0.1, 2],
    affects: ['Agentic Duration-Based hours saved', 'Agentic Full Merge Rate projection'],
    scaling: 'linear',
  },
  est_human_to_agent_ratio: {
    default: 10,
    type: 'legacy',
    label: 'Human-to-Agent Ratio (legacy)',
    description: 'Legacy name for the agentic duration multiplier. Superseded by est_duration_factor.',
    unit: 'ratio',
    source: 'legacy',
    rationale: 'Read only by the legacy v1 agentic efficiency and v2 agentic-element dashboards. The pipeline and v4 dashboards use est_duration_factor.',
    range: null,
    affects: ['Legacy v1/v2 agentic dashboards only'],
    scaling: null,
  },
  cfg_total_repos: {
    default: null,
    type: 'agentic',
    label: 'Total Repos',
    description: 'Total repositories in scope. Used for repo coverage structural factor.',
    unit: 'repositories',
    source: 'customer',
    rationale: 'Organization-specific. When unset, the repo-coverage projection is skipped.',
    range: null,
    affects: ['Agentic Repo Coverage projection'],
    scaling: null,
  },

  // ─── Shared across elements ───
  est_hrs_per_kloc: {
    default: 0.22,
    type: 'shared',
    label: 'Hours per KLoC',
    description: 'Estimated developer hours saved per 1,000 lines of code added. Used by LoC-based estimation in both AI-assisted and agentic elements.',
    unit: 'hours per 1,000 LoC',
    source: 'calibrated',
    rationale: 'Lowered from 1.5 to 0.22 in PR #56 as a "revised assumption"; no further rationale was recorded and no external study is cited. Check the sensitivity band before quoting LoC-based figures.',
    range: [0.1, 2],
    affects: ['AI-assisted LoC-Based hours saved', 'Agentic LoC-Based hours saved'],
    scaling: 'linear',
  },

  // ─── Structural analysis ───
  cfg_pr_assist_lookback_days: {
    default: 3,
    type: 'structural',
    label: 'PR-Assist Lookback Days',
    description: 'Number of days to look back when classifying a PR as "assisted." A PR is assisted if its author was Copilot-active on the merge day or within this many prior days.',
    unit: 'days',
    source: 'assumption',
    rationale: 'Maintainer judgement: covers a typical PR cycle, so work authored with Copilot a few days before merge still counts as assisted.',
    range: [0, 7],
    affects: ['PR-assist rate (structural analysis)'],
    scaling: null,
  },
  cfg_total_dev_loc_added_day: {
    default: null,
    type: 'structural',
    label: 'Org LoC/Day Target',
    description: 'Target total LoC added per day across the org. Used for AI-assisted LoC % calculation when PR data is unavailable.',
    unit: 'LoC/day',
    source: 'customer',
    rationale: 'Organization-specific. Not read by the current pipeline or v4 dashboards.',
    range: null,
    affects: [],
    scaling: null,
  },

  // ─── Integrated / projection ───
  cfg_projection_cap_ai: {
    default: 5,
    type: 'integrated',
    label: 'AI Projection Cap (×)',
    description: 'Maximum multiplier for AI-assisted projections in the integrated view.',
    unit: '×',
    source: 'assumption',
    rationale: 'Guardrail against very low adoption producing extreme 1/adoption projections. Not read by the current pipeline or v4 dashboards.',
    range: [1, 10],
    affects: [],
    scaling: null,
  },
  cfg_projection_cap_agentic: {
    default: 9,
    type: 'integrated',
    label: 'Agentic Projection Cap (×)',
    description: 'Maximum multiplier for agentic projections in the integrated view.',
    unit: '×',
    source: 'assumption',
    rationale: 'Guardrail against extreme projections. Not read by the current pipeline or v4 dashboards.',
    range: [1, 15],
    affects: [],
    scaling: null,
  },
};

/**
 * Get default config values for a given element type.
 * Includes 'shared' and 'org' keys plus element-specific keys.
 */
export function getDefaults(elementType) {
  return Object.fromEntries(
    Object.entries(CONFIG_REGISTRY)
      .filter(([_, v]) => v.type === 'shared' || v.type === 'org' || v.type === elementType)
      .map(([k, v]) => [k, v.default])
  );
}

/**
 * Get all config defaults (all types).
 */
export function getAllDefaults() {
  return Object.fromEntries(
    Object.entries(CONFIG_REGISTRY).map(([k, v]) => [k, v.default])
  );
}

/**
 * Detect if an object is a config file (has cfg_ or est_ keys).
 */
export function isConfigObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Object.keys(obj).some(k => k.startsWith('cfg_') || k.startsWith('est_'));
}

/**
 * Merge user config over defaults, ignoring unknown keys.
 */
export function mergeConfig(defaults, userConfig) {
  const merged = { ...defaults };
  for (const [key, value] of Object.entries(userConfig)) {
    if (key in CONFIG_REGISTRY) {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * Multiplier applied to the affected estimate when a key moves from its
 * default to each end of its plausible range (one-at-a-time sensitivity).
 * Returns null when the key has no range, no default, or no proportional
 * relationship to an output.
 */
export function sensitivityBand(key, base = CONFIG_REGISTRY[key]?.default) {
  const entry = CONFIG_REGISTRY[key];
  if (!entry || !entry.range || !entry.scaling || base == null || base === 0) return null;
  const [min, max] = entry.range;
  const factor = (v) => (entry.scaling === 'inverse' ? base / v : v / base);
  const lo = factor(min);
  const hi = factor(max);
  return { atMin: lo, atMax: hi, low: Math.min(lo, hi), high: Math.max(lo, hi) };
}

/**
 * Warn about configured values that are non-numeric or fall outside the
 * registry's plausible range. Unknown keys and null values are ignored.
 * @returns {string[]} human-readable warnings
 */
export function checkConfigRanges(config) {
  const warnings = [];
  if (!config || typeof config !== 'object') return warnings;
  for (const [key, value] of Object.entries(config)) {
    const entry = CONFIG_REGISTRY[key];
    if (!entry || value == null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      warnings.push(`${key}: expected a number, got ${JSON.stringify(value)}`);
      continue;
    }
    if (!entry.range) continue;
    const [min, max] = entry.range;
    if (value < min || value > max) {
      warnings.push(`${key}=${value} is outside the plausible range [${min}, ${max}] (default ${entry.default}); see docs/estimation-parameters.md`);
    }
  }
  return warnings;
}
