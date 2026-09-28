import { describe, it, expect } from 'vitest';
import {
  CONFIG_REGISTRY, getDefaults, getAllDefaults,
  isConfigObject, mergeConfig, sensitivityBand, checkConfigRanges,
} from '../../core/config.js';

describe('CONFIG_REGISTRY', () => {
  it('has entries for all expected keys', () => {
    const keys = Object.keys(CONFIG_REGISTRY);
    expect(keys).toContain('cfg_total_developers');
    expect(keys).toContain('est_hrs_per_kloc');
    expect(keys).toContain('est_duration_factor');
    expect(keys).toContain('est_interactions_per_hour');
    expect(keys).toContain('cfg_pr_assist_lookback_days');
    expect(keys).toContain('cfg_projection_cap_ai');
    expect(keys).toContain('cfg_projection_cap_agentic');
  });

  it('every entry has default, type, and label', () => {
    for (const [key, entry] of Object.entries(CONFIG_REGISTRY)) {
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('label');
      expect(entry).toHaveProperty('default');
    }
  });

  it('est_hrs_per_kloc has a single canonical default of 0.22', () => {
    expect(CONFIG_REGISTRY.est_hrs_per_kloc.default).toBe(0.22);
  });

  it('est_duration_factor has a single canonical default of 0.2', () => {
    expect(CONFIG_REGISTRY.est_duration_factor.default).toBe(0.2);
  });

  it('every entry documents provenance, range, affects, and scaling', () => {
    const SOURCES = ['customer', 'calibrated', 'assumption', 'legacy'];
    for (const [key, entry] of Object.entries(CONFIG_REGISTRY)) {
      expect(SOURCES, key).toContain(entry.source);
      expect(typeof entry.rationale, key).toBe('string');
      expect(entry.rationale.length, key).toBeGreaterThan(10);
      expect(Array.isArray(entry.affects), key).toBe(true);
      expect([null, 'linear', 'inverse'], key).toContain(entry.scaling);
      if (entry.range !== null) {
        expect(entry.range, key).toHaveLength(2);
        expect(entry.range[0], key).toBeLessThan(entry.range[1]);
        if (entry.default != null) {
          expect(entry.default, key).toBeGreaterThanOrEqual(entry.range[0]);
          expect(entry.default, key).toBeLessThanOrEqual(entry.range[1]);
        }
      }
    }
  });

  it('estimation constants (est_*) are never customer-supplied', () => {
    for (const [key, entry] of Object.entries(CONFIG_REGISTRY)) {
      if (key.startsWith('est_')) expect(entry.source, key).not.toBe('customer');
    }
  });
});

describe('sensitivityBand', () => {
  it('computes linear multipliers at the range ends', () => {
    const b = sensitivityBand('est_hrs_per_kloc');
    expect(b.atMin).toBeCloseTo(0.1 / 0.22, 10);
    expect(b.atMax).toBeCloseTo(2 / 0.22, 10);
  });

  it('inverts for inverse-scaling keys', () => {
    const b = sensitivityBand('est_interactions_per_hour');
    expect(b.atMin).toBeCloseTo(3, 10);
    expect(b.atMax).toBeCloseTo(0.5, 10);
    expect(b.low).toBeCloseTo(0.5, 10);
    expect(b.high).toBeCloseTo(3, 10);
  });

  it('accepts an explicit base value', () => {
    expect(sensitivityBand('est_hrs_per_kloc', 1).atMax).toBeCloseTo(2, 10);
  });

  it('returns null for keys without range, scaling, or default', () => {
    expect(sensitivityBand('cfg_total_developers')).toBeNull();
    expect(sensitivityBand('cfg_labor_cost_per_hour')).toBeNull();
    expect(sensitivityBand('cfg_pr_assist_lookback_days')).toBeNull();
    expect(sensitivityBand('nope')).toBeNull();
  });
});

describe('checkConfigRanges', () => {
  it('passes the shipped dashboard-config.json values', async () => {
    const { readFileSync } = await import('fs');
    const cfg = JSON.parse(readFileSync(new URL('../../../dashboard-config.json', import.meta.url)));
    expect(checkConfigRanges(cfg)).toEqual([]);
  });

  it('warns on out-of-range and non-numeric values, ignores unknown/null', () => {
    const w = checkConfigRanges({
      est_hrs_per_kloc: 5,
      est_duration_factor: '0.2',
      cfg_labor_cost_per_hour: null,
      mystery_key: 1e9,
      cfg_total_developers: 1e6,
    });
    expect(w).toHaveLength(2);
    expect(w[0]).toMatch(/est_hrs_per_kloc=5 is outside/);
    expect(w[1]).toMatch(/est_duration_factor: expected a number/);
  });

  it('handles non-objects', () => {
    expect(checkConfigRanges(null)).toEqual([]);
  });
});

describe('getDefaults', () => {
  it('returns org + shared keys for any element type', () => {
    const defaults = getDefaults('ai-assisted');
    expect(defaults.cfg_total_developers).toBe(100);
    expect(defaults.est_hrs_per_kloc).toBe(0.22);
    expect(defaults.cfg_workdays_per_week).toBe(5);
  });

  it('includes element-specific keys', () => {
    const aiDefaults = getDefaults('ai-assisted');
    expect(aiDefaults.est_interactions_per_hour).toBe(30);
    expect(aiDefaults).not.toHaveProperty('est_duration_factor');

    const agenticDefaults = getDefaults('agentic');
    expect(agenticDefaults.est_duration_factor).toBe(0.2);
    expect(agenticDefaults).not.toHaveProperty('est_interactions_per_hour');
  });

  it('includes structural keys for structural type', () => {
    const structDefaults = getDefaults('structural');
    expect(structDefaults.cfg_pr_assist_lookback_days).toBe(3);
  });
});

describe('getAllDefaults', () => {
  it('returns every key in the registry', () => {
    const all = getAllDefaults();
    expect(Object.keys(all).length).toBe(Object.keys(CONFIG_REGISTRY).length);
  });
});

describe('isConfigObject', () => {
  it('detects objects with cfg_ keys', () => {
    expect(isConfigObject({ cfg_total_developers: 200 })).toBe(true);
  });

  it('detects objects with est_ keys', () => {
    expect(isConfigObject({ est_hrs_per_kloc: 4 })).toBe(true);
  });

  it('rejects arrays', () => {
    expect(isConfigObject([1, 2, 3])).toBe(false);
  });

  it('rejects null', () => {
    expect(isConfigObject(null)).toBe(false);
  });

  it('rejects objects without cfg_/est_ keys', () => {
    expect(isConfigObject({ enterprise_report: {} })).toBe(false);
  });
});

describe('mergeConfig', () => {
  it('overrides defaults with user values', () => {
    const defaults = getDefaults('ai-assisted');
    const merged = mergeConfig(defaults, { est_hrs_per_kloc: 4 });
    expect(merged.est_hrs_per_kloc).toBe(4);
  });

  it('ignores unknown keys', () => {
    const defaults = getDefaults('ai-assisted');
    const merged = mergeConfig(defaults, { unknown_key: 999 });
    expect(merged).not.toHaveProperty('unknown_key');
  });

  it('preserves defaults for unset keys', () => {
    const defaults = getDefaults('ai-assisted');
    const merged = mergeConfig(defaults, {});
    expect(merged.cfg_total_developers).toBe(100);
  });
});
