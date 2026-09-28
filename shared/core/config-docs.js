/**
 * Renders docs/estimation-parameters.md from CONFIG_REGISTRY so the
 * reference doc cannot drift from the code. Regenerate with:
 *   node scripts/generate-estimation-docs.js
 */

import { CONFIG_REGISTRY, sensitivityBand } from './config.js';

const TYPE_ORDER = [
  ['org', 'Organization-wide'],
  ['ai-assisted', 'AI-assisted'],
  ['agentic', 'Agentic'],
  ['shared', 'Shared (AI-assisted and agentic)'],
  ['structural', 'Structural analysis'],
  ['integrated', 'Integrated / projection'],
  ['legacy', 'Legacy'],
];

const SOURCE_TEXT = {
  customer: 'Customer-supplied',
  calibrated: 'Calibrated',
  assumption: 'Assumption',
  legacy: 'Legacy',
};

// Recorded changes to the shipped estimation values (dashboard-config.json).
export const CALIBRATION_HISTORY = [
  { date: '2026-04-12', ref: '02458ed', change: 'Initial shared config: `est_hrs_per_kloc` 4, `est_duration_factor` 0.5, `est_interactions_per_hour` 20, `cfg_pct_time_coding` 0.5, `cfg_time_saved_pct_day` 0.11', reason: 'Initial values; none recorded' },
  { date: '2026-04-12', ref: 'a0796a2', change: '`cfg_pct_time_coding` 0.5 → 0.25; `cfg_time_saved_pct_day` 0.11 → 0.30', reason: 'None recorded' },
  { date: '2026-04-23', ref: 'c330d44', change: '`est_hrs_per_kloc` 4 → 1; `est_duration_factor` 0.5 → 10', reason: 'None recorded' },
  { date: '2026-05-06', ref: 'b90bf39', change: '`est_interactions_per_hour` 20 → 30; `est_hrs_per_kloc` 1 → 1.5; `cfg_time_saved_pct_day` 0.30 → 0.38', reason: 'Make the three AI-assisted methods converge near ~0.75 hrs/dev/day on octodemo data (they previously ranged 0.6–2.0)' },
  { date: '2026-05-20', ref: 'cdcd8d1', change: '`est_duration_factor` 10 → 0.20', reason: 'Shipped with the switch to accumulated active agent minutes across all runs per PR; no separate reason recorded' },
  { date: '2026-09-03', ref: '#56', change: '`est_hrs_per_kloc` 1.5 → 0.22', reason: '"Revised assumption"; none further recorded' },
  { date: '2026-09-28', ref: '#64', change: 'Registry defaults aligned with the shipped `dashboard-config.json` values', reason: 'One canonical value per key across registry, config, dashboards and docs' },
];

function fmt(v) {
  if (v == null) return '—';
  return String(v);
}

function fmtMult(x) {
  if (x >= 10) return `×${x.toFixed(0)}`;
  if (x >= 1) return `×${x.toFixed(1)}`;
  return `×${x.toFixed(2)}`;
}

function sensitivityText(key) {
  const b = sensitivityBand(key);
  if (!b) return '—';
  return `${fmtMult(b.atMin)} / ${fmtMult(b.atMax)}`;
}

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

export function renderEstimationParametersDoc(registry = CONFIG_REGISTRY) {
  const L = [];
  const push = (...lines) => L.push(...lines);

  push(
    '# Estimation parameters',
    '',
    '<!-- Generated from shared/core/config.js by `node scripts/generate-estimation-docs.js`. Do not edit by hand. -->',
    '',
    'The "hours saved" and dollar figures on the dashboards are **estimates**. Each one multiplies measured activity (interactions, lines of code, agent session time, active developers) by a configured constant. The constants are **assumptions or internal calibrations, not measurements**. This page records where each one came from, its plausible range, and how much the headline moves if it is wrong.',
    '',
    'Values are set in `dashboard-config.json`. Any key you leave out falls back to the default below. See [query-settings.md](query-settings.md#deployment-specific-values) for why each deployment owns that file.',
    '',
    '## How to read this page',
    '',
    '- **Source**',
    '  - *Customer-supplied*: a fact only your organization knows. The default is a placeholder.',
    '  - *Calibrated*: tuned against pipeline data (see [Calibration history](#calibration-history)).',
    '  - *Assumption*: maintainer judgement.',
    '  - *Legacy*: read only by legacy dashboards.',
    '- **Range**: a plausible band. `npm run validate` and the materializers warn when `dashboard-config.json` falls outside it.',
    '- **Sensitivity**: one-at-a-time. It shows the multiplier applied to the affected estimate when the key moves from its default to the low / high end of its range, with everything else held fixed.',
    '  - Every time-saved estimate is proportional to its constant, so the multiplier applies directly to that estimate\'s hours saved (and dollars).',
    '  - Example: ×0.45 / ×9.1 means the estimate could be about half, or nine times, the reported value.',
    '',
    '## Summary',
    '',
    '| Key | Default | Unit | Source | Range | Sensitivity (at min / max) | Affects |',
    '|---|---|---|---|---|---|---|',
  );

  for (const [type] of TYPE_ORDER) {
    for (const [key, e] of Object.entries(registry)) {
      if (e.type !== type) continue;
      const range = e.range ? `${e.range[0]} – ${e.range[1]}` : '—';
      const affects = e.affects.length ? e.affects.join('; ') : '*Not read by the current pipeline*';
      push(`| \`${key}\` | ${fmt(e.default)} | ${esc(e.unit || '')} | ${SOURCE_TEXT[e.source]} | ${range} | ${sensitivityText(key)} | ${esc(affects)} |`);
    }
  }

  push(
    '',
    '## Formulas',
    '',
    'Estimates computed by `shared/materializers/leverage-summary.js`. The v4 dashboards use the same formulas.',
    '',
    '| Estimate | Formula | Constants |',
    '|---|---|---|',
    '| AI-assisted: Interactions-Based *(default selection)* | `interactions ÷ est_interactions_per_hour` | `est_interactions_per_hour` |',
    '| AI-assisted: LoC-Based | `(loc_added ÷ 1000) × est_hrs_per_kloc` | `est_hrs_per_kloc` |',
    '| AI-assisted: Manual Daily % | `Σ_days cfg_time_saved_pct_day × cfg_pct_time_coding × (cfg_baseline_hours_per_dev_per_week ÷ cfg_workdays_per_week) × daily_active_users` | `cfg_time_saved_pct_day`, `cfg_pct_time_coding`, `cfg_baseline_hours_per_dev_per_week`, `cfg_workdays_per_week` |',
    '| AI-assisted: time spent (leverage denominator) | `Σ_days daily_active_users × cfg_pct_time_coding × cfg_hrs_per_dev_per_day` | `cfg_pct_time_coding`, `cfg_hrs_per_dev_per_day` |',
    '| Agentic: Duration-Based *(default selection)* | `(session_minutes ÷ 60) × est_duration_factor` | `est_duration_factor` |',
    '| Agentic: LoC-Based | `(merged_loc_added ÷ 1000) × est_hrs_per_kloc` | `est_hrs_per_kloc` |',
    '| Agentic: Full Merge Rate projection | `est_duration_factor × time_spent × (1 − yield)` | `est_duration_factor` |',
    '| Economic value | `hours_saved × cfg_labor_cost_per_hour` | `cfg_labor_cost_per_hour` |',
    '',
    'Notes on the table:',
    '',
    '- Agentic duration minutes differ by surface:',
    '  - `leverage-summary` uses sessions on **merged** PRs.',
    '  - The v4 agentic dashboard uses all `agent_session_minutes` in the window.',
    '- You can select a different estimate with `leverage_ai_estimate` or `leverage_agentic_estimate`.',
    '',
    '## Parameter details',
  );

  for (const [type, title] of TYPE_ORDER) {
    const entries = Object.entries(registry).filter(([, e]) => e.type === type);
    if (!entries.length) continue;
    push('', `### ${title}`);
    for (const [key, e] of entries) {
      push(
        '',
        `#### \`${key}\``,
        '',
        e.description,
        '',
        `- **Default:** ${fmt(e.default)}${e.unit ? ` (${e.unit})` : ''}`,
        `- **Source:** ${SOURCE_TEXT[e.source]}. ${e.rationale}`,
        `- **Range:** ${e.range ? `${e.range[0]} – ${e.range[1]}` : '—'}`,
        `- **Sensitivity:** ${sensitivityText(key)}${e.scaling ? ` (${e.scaling})` : ''}`,
        `- **Affects:** ${e.affects.length ? e.affects.join('; ') : 'Not read by the current pipeline or v4 dashboards'}`,
      );
    }
  }

  push(
    '',
    '## Calibration history',
    '',
    'Recorded changes to the shipped values, from git history.',
    '',
    '| Date | Ref | Change | Recorded reason |',
    '|---|---|---|---|',
    ...CALIBRATION_HISTORY.map(h => `| ${h.date} | ${h.ref} | ${esc(h.change)} | ${esc(h.reason)} |`),
    '',
    'Caveats about how these values were set:',
    '',
    '- The calibration in b90bf39 aimed for **agreement between methods**, not **accuracy against a measured baseline**. Three methods converging on ~0.75 hrs/dev/day shows the constants are consistent with each other, not that 0.75 is correct.',
    '- No value here is backed by a controlled study. Treat the sensitivity band as the honest error bar.',
    '',
    'When you recalibrate:',
    '',
    '- **Record** the dataset (org, date range), the target, and the method in the commit or PR, and add a row here by editing `CALIBRATION_HISTORY` in `shared/core/config-docs.js`.',
    '- **Prefer measured anchors** where you have them, such as a developer time-allocation survey for `cfg_pct_time_coding` or timed task comparisons for `est_hrs_per_kloc`.',
    '- **Update the registry** if you change a default: `default`, `rationale` and, if needed, `range` in `shared/core/config.js`. Then run `node scripts/generate-estimation-docs.js`.',
    '',
  );

  return L.join('\n');
}
