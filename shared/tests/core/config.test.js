import { describe, it, expect } from 'vitest';
import {
  CONFIG_REGISTRY, getDefaults, getAllDefaults,
  isConfigObject, mergeConfig,
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

  it('est_hrs_per_kloc has a single canonical default of 2', () => {
    expect(CONFIG_REGISTRY.est_hrs_per_kloc.default).toBe(2);
  });

  it('est_duration_factor has a single canonical default of 2', () => {
    expect(CONFIG_REGISTRY.est_duration_factor.default).toBe(2);
  });
});

describe('getDefaults', () => {
  it('returns org + shared keys for any element type', () => {
    const defaults = getDefaults('ai-assisted');
    expect(defaults.cfg_total_developers).toBe(100);
    expect(defaults.est_hrs_per_kloc).toBe(2);
    expect(defaults.cfg_workdays_per_week).toBe(5);
  });

  it('includes element-specific keys', () => {
    const aiDefaults = getDefaults('ai-assisted');
    expect(aiDefaults.est_interactions_per_hour).toBe(20);
    expect(aiDefaults).not.toHaveProperty('est_duration_factor');

    const agenticDefaults = getDefaults('agentic');
    expect(agenticDefaults.est_duration_factor).toBe(2);
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
