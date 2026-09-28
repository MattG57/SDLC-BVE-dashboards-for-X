import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { renderEstimationParametersDoc, CALIBRATION_HISTORY } from '../../core/config-docs.js';
import { CONFIG_REGISTRY } from '../../core/config.js';

const repoFile = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf-8');

describe('estimation-parameters doc', () => {
  const doc = renderEstimationParametersDoc();

  it('docs/estimation-parameters.md is in sync with CONFIG_REGISTRY', () => {
    // If this fails: node scripts/generate-estimation-docs.js
    expect(repoFile('docs/estimation-parameters.md')).toBe(doc);
  });

  it('documents every registry key with its default', () => {
    for (const [key, e] of Object.entries(CONFIG_REGISTRY)) {
      expect(doc).toContain(`#### \`${key}\``);
      expect(doc).toContain(`- **Default:** ${e.default == null ? '—' : e.default}`);
    }
  });

  it('includes sensitivity multipliers for proportional constants', () => {
    expect(doc).toMatch(/`est_hrs_per_kloc` \| 0\.22 .*\| ×0\.45 \/ ×9\.1 \|/);
    expect(doc).toMatch(/`est_interactions_per_hour` \| 30 .*\| ×3\.0 \/ ×0\.50 \|/);
  });

  it('includes the calibration history', () => {
    expect(CALIBRATION_HISTORY.length).toBeGreaterThan(0);
    for (const h of CALIBRATION_HISTORY) expect(doc).toContain(`| ${h.date} | ${h.ref} |`);
  });
});

describe('shipped defaults are consistent across surfaces', () => {
  const ESTIMATION_KEYS = [
    'cfg_pct_time_coding', 'cfg_time_saved_pct_day', 'cfg_baseline_hours_per_dev_per_week',
    'est_interactions_per_hour', 'est_hrs_per_kloc', 'est_duration_factor',
  ];

  it('dashboard-config.json matches the registry for estimation constants', () => {
    const cfg = JSON.parse(repoFile('dashboard-config.json'));
    for (const key of ESTIMATION_KEYS) {
      if (key in cfg) expect(cfg[key], key).toBe(CONFIG_REGISTRY[key].default);
    }
  });

  for (const dash of ['dashboard/v4/ai-assisted-efficiency/index.html', 'dashboard/v4/agentic-efficiency/index.html']) {
    it(`${dash} DEFAULT_CONFIG and inline fallbacks match the registry`, () => {
      const html = repoFile(dash);
      const block = html.match(/const DEFAULT_CONFIG = \{([\s\S]*?)\};/)[1];
      for (const key of ESTIMATION_KEYS) {
        const m = block.match(new RegExp(`${key}:\\s*([0-9.]+)`));
        if (m) expect(Number(m[1]), `${dash} DEFAULT_CONFIG.${key}`).toBe(CONFIG_REGISTRY[key].default);
        for (const f of html.matchAll(new RegExp(`${key}\\s*(?:\\|\\||\\?\\?)\\s*([0-9.]+)`, 'g'))) {
          if (Number(f[1]) === 0) continue; // 0 = deliberate "unset" guard
          expect(Number(f[1]), `${dash} fallback for ${key}`).toBe(CONFIG_REGISTRY[key].default);
        }
      }
    });
  }
});
