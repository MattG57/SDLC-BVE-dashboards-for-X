import { describe, it, expect } from 'vitest';
import {
  flattenDayTotal, flattenUserReport,
  dedupEnterpriseDays, dedupUserDays,
  computeDayRatios, computeReconciliation,
  isCopilotMetricsSource,
} from '../../sources/copilot-metrics.js';

describe('flattenDayTotal', () => {
  it('extracts day from date field', () => {
    expect(flattenDayTotal({ date: '2026-04-10' }).day).toBe('2026-04-10');
  });

  it('extracts day from day field', () => {
    expect(flattenDayTotal({ day: '2026-04-10' }).day).toBe('2026-04-10');
  });

  it('flattens nested objects with key_subkey naming', () => {
    const result = flattenDayTotal({
      date: '2026-04-10',
      copilot_ide: { users: 10, interactions: 50 },
    });
    expect(result.copilot_ide_users).toBe(10);
    expect(result.copilot_ide_interactions).toBe(50);
  });

  it('passes through scalar values', () => {
    const result = flattenDayTotal({ date: '2026-04-10', daily_active_users: 25 });
    expect(result.daily_active_users).toBe(25);
  });

  it('skips array values', () => {
    const result = flattenDayTotal({ date: '2026-04-10', editors: [{ name: 'vscode' }] });
    expect(result.editors).toBeUndefined();
  });
});

describe('flattenUserReport', () => {
  it('handles nested day_totals format', () => {
    const result = flattenUserReport([{
      login: 'alice',
      day_totals: [{ date: '2026-04-10', code_generation_activity_count: 5 }],
    }]);
    expect(result).toHaveLength(1);
    expect(result[0].user_login).toBe('alice');
    expect(result[0].day).toBe('2026-04-10');
    expect(result[0].code_generation_activity_count).toBe(5);
  });

  it('handles flat format with day field', () => {
    const result = flattenUserReport([{
      user_login: 'bob',
      day: '2026-04-10',
      code_generation_activity_count: 3,
    }]);
    expect(result).toHaveLength(1);
    expect(result[0].user_login).toBe('bob');
  });

  it('tries multiple login field names', () => {
    const result = flattenUserReport([{
      github_login: 'carol',
      day: '2026-04-10',
    }]);
    expect(result[0].user_login).toBe('carol');
  });

  it('skips records without login', () => {
    const result = flattenUserReport([{ day: '2026-04-10' }]);
    expect(result).toHaveLength(0);
  });
});

describe('dedupEnterpriseDays', () => {
  it('deduplicates by day, last wins', () => {
    const { data, profile } = dedupEnterpriseDays([
      { day: '2026-04-10', daily_active_users: 10 },
      { day: '2026-04-10', daily_active_users: 20 },
      { day: '2026-04-11', daily_active_users: 15 },
    ]);
    expect(data).toHaveLength(2);
    expect(data[0].daily_active_users).toBe(20); // last wins
    expect(profile.removed).toBe(1);
  });

  it('sorts by day', () => {
    const { data } = dedupEnterpriseDays([
      { day: '2026-04-12' },
      { day: '2026-04-10' },
      { day: '2026-04-11' },
    ]);
    expect(data.map(d => d.day)).toEqual(['2026-04-10', '2026-04-11', '2026-04-12']);
  });
});

describe('dedupUserDays', () => {
  it('deduplicates by day|user_login', () => {
    const { data, profile } = dedupUserDays([
      { day: '2026-04-10', user_login: 'alice', count: 1 },
      { day: '2026-04-10', user_login: 'alice', count: 2 },
      { day: '2026-04-10', user_login: 'bob', count: 3 },
    ]);
    expect(data).toHaveLength(2);
    expect(profile.removed).toBe(1);
    expect(profile.unique_logins).toBe(2);
  });
});

describe('computeDayRatios', () => {
  it('computes per-dev ratios', () => {
    const ratios = computeDayRatios({
      daily_active_users: 10,
      user_initiated_interaction_count: 200,
      code_generation_activity_count: 100,
      code_acceptance_activity_count: 80,
      loc_added_sum: 5000,
      agent_mode_interaction_count: 30,
      cli_prompt_count: 20,
    });
    expect(ratios.interactions_per_active_dev).toBe(20);
    expect(ratios.generations_per_active_dev).toBe(10);
    expect(ratios.acceptances_per_active_dev).toBe(8);
    expect(ratios.loc10_added_per_active_dev).toBe(50);
    expect(ratios.acceptance_rate).toBe(0.8);
  });

  it('returns null when no active users', () => {
    const ratios = computeDayRatios({
      daily_active_users: 0,
      user_initiated_interaction_count: 10,
      code_generation_activity_count: 5,
      code_acceptance_activity_count: 3,
    });
    expect(ratios.interactions_per_active_dev).toBeNull();
    expect(ratios.acceptance_rate).toBeCloseTo(0.6);
  });
});

describe('computeReconciliation', () => {
  it('produces match status when values agree', () => {
    const enterprise = [{ day: '2026-04-10', daily_active_users: 2, user_initiated_interaction_count: 10, code_generation_activity_count: 5, code_acceptance_activity_count: 3, loc_added_sum: 100, loc_deleted_sum: 20 }];
    const users = [
      { day: '2026-04-10', user_login: 'a', user_initiated_interaction_count: 5, code_generation_activity_count: 3, code_acceptance_activity_count: 2, loc_added_sum: 60, loc_deleted_sum: 10 },
      { day: '2026-04-10', user_login: 'b', user_initiated_interaction_count: 5, code_generation_activity_count: 2, code_acceptance_activity_count: 1, loc_added_sum: 40, loc_deleted_sum: 10 },
    ];
    const recon = computeReconciliation(enterprise, users);
    const interactionRecon = recon.find(r => r.label === 'interactions');
    expect(interactionRecon.status).toBe('match');
  });

  it('flags missing user data', () => {
    const enterprise = [{ day: '2026-04-10', daily_active_users: 2 }];
    const users = [];
    const recon = computeReconciliation(enterprise, users);
    expect(recon[0].status).toBe('missing_user_data');
  });
});

describe('isCopilotMetricsSource', () => {
  it('detects enterprise_report', () => {
    expect(isCopilotMetricsSource({ enterprise_report: {} })).toBe(true);
  });

  it('detects user_report', () => {
    expect(isCopilotMetricsSource({ user_report: [] })).toBe(true);
  });

  it('rejects unrelated objects', () => {
    expect(isCopilotMetricsSource({ pr_sessions: [] })).toBe(false);
  });

  it('rejects null', () => {
    expect(isCopilotMetricsSource(null)).toBe(false);
  });
});
