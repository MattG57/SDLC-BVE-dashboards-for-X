/**
 * Canonical config registry for all BVE dashboards.
 *
 * This is the single source of truth for config key names, defaults,
 * types, and labels. Every dashboard reads defaults from here.
 * Divergences between dashboards are eliminated — if an element needs
 * a different default, it overrides explicitly.
 */

export const CONFIG_REGISTRY = {
  // ─── Organization-wide parameters ───
  cfg_total_developers: {
    default: 100,
    type: 'org',
    label: 'Total Developers',
    description: 'Total number of developers in the organization.',
  },
  cfg_workdays_per_week: {
    default: 5,
    type: 'org',
    label: 'Workdays per Week',
    description: 'Working days per week (excludes weekends).',
  },
  cfg_labor_cost_per_hour: {
    default: null,
    type: 'org',
    label: 'Labor Cost ($/hr)',
    description: 'Fully loaded labor cost per developer hour. Used for economic value calculation.',
  },
  cfg_pct_time_coding: {
    default: 0.5,
    type: 'org',
    label: '% Time Coding',
    description: 'Fraction of work time spent on coding tasks (0–1).',
  },
  cfg_pct_time_reviewing: {
    default: 0.2,
    type: 'org',
    label: '% Time Reviewing',
    description: 'Fraction of work time spent on code review (0–1).',
  },

  // ─── AI-Assisted specific ───
  est_interactions_per_hour: {
    default: 20,
    type: 'ai-assisted',
    label: 'Interactions per Hour',
    description: 'Estimated Copilot interactions per hour of saved time.',
  },
  cfg_time_saved_pct_day: {
    default: null,
    type: 'ai-assisted',
    label: 'Time Saved % / Day',
    description: 'Manual estimate of daily time saved as a fraction (0–1). Used only by the Manual Daily % method.',
  },
  cfg_baseline_hours_per_dev_per_week: {
    default: null,
    type: 'ai-assisted',
    label: 'Baseline Hrs/Dev/Week',
    description: 'Baseline working hours per developer per week. Used only by the Manual Daily % method.',
  },

  // ─── Agentic specific ───
  est_duration_factor: {
    default: 2,
    type: 'agentic',
    label: 'Duration Multiplier',
    description: 'Multiplier applied to agent PR duration to estimate human-equivalent hours. Higher values assume agent work is denser than human work.',
  },
  cfg_total_repos: {
    default: null,
    type: 'agentic',
    label: 'Total Repos',
    description: 'Total repositories in scope. Used for repo coverage structural factor.',
  },

  // ─── Shared across elements ───
  est_hrs_per_kloc: {
    default: 2,
    type: 'shared',
    label: 'Hours per KLoC',
    description: 'Estimated developer hours per 1,000 lines of code. Used by LoC-based estimation in both AI-assisted and agentic elements.',
  },

  // ─── Structural analysis ───
  cfg_pr_assist_lookback_days: {
    default: 3,
    type: 'structural',
    label: 'PR-Assist Lookback Days',
    description: 'Number of days to look back when classifying a PR as "assisted." A PR is assisted if its author was Copilot-active on the merge day or within this many prior days.',
  },
  cfg_total_dev_loc_added_day: {
    default: null,
    type: 'structural',
    label: 'Org LoC/Day Target',
    description: 'Target total LoC added per day across the org. Used for AI-assisted LoC % calculation when PR data is unavailable.',
  },

  // ─── Integrated / projection ───
  cfg_projection_cap_ai: {
    default: 5,
    type: 'integrated',
    label: 'AI Projection Cap (×)',
    description: 'Maximum multiplier for AI-assisted projections in the integrated view.',
  },
  cfg_projection_cap_agentic: {
    default: 9,
    type: 'integrated',
    label: 'Agentic Projection Cap (×)',
    description: 'Maximum multiplier for agentic projections in the integrated view.',
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
