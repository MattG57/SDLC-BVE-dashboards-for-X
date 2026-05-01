/**
 * Tests for org membership filtering in the ai-assisted-structural-days materializer.
 *
 * Verifies that:
 * - Without org member data, all users are included (backward compatible)
 * - With org member data, only org members are counted in adoption/active users
 * - Profile metadata tracks filter stats
 */

import { describe, it, expect } from 'vitest';
import { materializeAiAssistedStructuralDays } from '../../materializers/ai-assisted-structural-days.js';

// ── Minimal test fixtures ──

function makeCopilotData({ users = [], entDays = [] } = {}) {
  const defaultEntDays = entDays.length > 0 ? entDays : [
    { day: '2026-04-01', daily_active_users: 50, copilot_ide_code_completions: {} },
    { day: '2026-04-02', daily_active_users: 60, copilot_ide_code_completions: {} },
  ];
  const defaultUsers = users.length > 0 ? users : [
    { day: '2026-04-01', user_login: 'alice', code_generation_activity_count: 10, user_initiated_interaction_count: 5 },
    { day: '2026-04-01', user_login: 'bob', code_generation_activity_count: 8, user_initiated_interaction_count: 3 },
    { day: '2026-04-01', user_login: 'charlie', code_generation_activity_count: 5, user_initiated_interaction_count: 2 },
    { day: '2026-04-01', user_login: 'external-user', code_generation_activity_count: 15, user_initiated_interaction_count: 10 },
    { day: '2026-04-02', user_login: 'alice', code_generation_activity_count: 12, user_initiated_interaction_count: 6 },
    { day: '2026-04-02', user_login: 'bob', code_generation_activity_count: 7, user_initiated_interaction_count: 4 },
    { day: '2026-04-02', user_login: 'external-user', code_generation_activity_count: 20, user_initiated_interaction_count: 12 },
  ];
  return {
    enterprise_report: { day_totals: defaultEntDays },
    user_report: defaultUsers,
  };
}

const defaultConfig = {
  cfg_total_developers: 100,
  cfg_pr_assist_lookback_days: 3,
};

describe('ai-assisted-structural-days org membership filter', () => {
  it('includes all users when no org member list provided', () => {
    const copilotData = makeCopilotData();
    const result = materializeAiAssistedStructuralDays(copilotData, null, defaultConfig);

    // All 4 unique users should be counted
    const day1 = result.data.find(d => d.day === '2026-04-01');
    expect(day1.unique_active_users).toBe(4); // alice, bob, charlie, external-user
  });

  it('includes all users when org member set is empty', () => {
    const copilotData = makeCopilotData();
    const result = materializeAiAssistedStructuralDays(copilotData, null, defaultConfig, {
      orgMemberLogins: new Set(),
    });

    const day1 = result.data.find(d => d.day === '2026-04-01');
    expect(day1.unique_active_users).toBe(4);
  });

  it('filters to org members only when org member set provided', () => {
    const copilotData = makeCopilotData();
    const orgMembers = new Set(['alice', 'bob', 'charlie']);
    const result = materializeAiAssistedStructuralDays(copilotData, null, defaultConfig, {
      orgMemberLogins: orgMembers,
    });

    // Day 1: alice, bob, charlie (external-user excluded)
    const day1 = result.data.find(d => d.day === '2026-04-01');
    expect(day1.unique_active_users).toBe(3);

    // Day 2: only alice and bob are org members with data
    const day2 = result.data.find(d => d.day === '2026-04-02');
    expect(day2.unique_active_users).toBe(2);
  });

  it('reports org filter stats in artifact profile', () => {
    const copilotData = makeCopilotData();
    const orgMembers = new Set(['alice', 'bob', 'charlie']);
    const result = materializeAiAssistedStructuralDays(copilotData, null, defaultConfig, {
      orgMemberLogins: orgMembers,
    });

    const filterProfile = result.artifact.profile.org_member_filter;
    expect(filterProfile).toBeDefined();
    expect(filterProfile.before).toBe(7); // total user-day records
    expect(filterProfile.after).toBe(5); // alice(2) + bob(2) + charlie(1)
    expect(filterProfile.removed).toBe(2); // external-user(2)
    expect(filterProfile.org_member_count).toBe(3);
  });

  it('no-filter profile shows zero removed', () => {
    const copilotData = makeCopilotData();
    const result = materializeAiAssistedStructuralDays(copilotData, null, defaultConfig);

    const filterProfile = result.artifact.profile.org_member_filter;
    expect(filterProfile.before).toBe(7);
    expect(filterProfile.after).toBe(7);
    expect(filterProfile.removed).toBe(0);
  });

  it('case-insensitive matching works', () => {
    const copilotData = makeCopilotData({
      users: [
        { day: '2026-04-01', user_login: 'Alice', code_generation_activity_count: 10, user_initiated_interaction_count: 5 },
        { day: '2026-04-01', user_login: 'BOB', code_generation_activity_count: 8, user_initiated_interaction_count: 3 },
      ],
      entDays: [{ day: '2026-04-01', daily_active_users: 20, copilot_ide_code_completions: {} }],
    });
    const orgMembers = new Set(['alice', 'bob']); // lowercase
    const result = materializeAiAssistedStructuralDays(copilotData, null, defaultConfig, {
      orgMemberLogins: orgMembers,
    });

    const day1 = result.data.find(d => d.day === '2026-04-01');
    expect(day1.unique_active_users).toBe(2);
  });

  it('adoption uses filtered copilotUsersByDay', () => {
    const copilotData = makeCopilotData();
    const orgMembers = new Set(['alice']); // only alice
    const result = materializeAiAssistedStructuralDays(copilotData, null, defaultConfig, {
      orgMemberLogins: orgMembers,
    });

    // adopted_individuals_pct should be based on alice only
    const day1 = result.data.find(d => d.day === '2026-04-01');
    // Alice is the only adopted user, totalDevs = 100
    expect(day1.adopted_individuals_pct).toBeCloseTo(1 / 100, 5);
  });

  it('works with PR data and org filter together', () => {
    const copilotData = makeCopilotData();
    const prData = {
      prs: [
        { number: 1, user: 'alice', created_at: '2026-04-01T10:00:00Z', additions: 100, deletions: 10, repository: 'repo1' },
        { number: 2, user: 'external-user', created_at: '2026-04-01T11:00:00Z', additions: 200, deletions: 20, repository: 'repo1' },
      ],
    };
    const orgMembers = new Set(['alice', 'bob', 'charlie']);
    const result = materializeAiAssistedStructuralDays(copilotData, prData, defaultConfig, {
      orgMemberLogins: orgMembers,
    });

    // PR data should still include all PRs (filtering is user-level, not PR-level)
    expect(result._prRecords.length).toBe(2);
    // But unique_active_users should be filtered
    const day1 = result.data.find(d => d.day === '2026-04-01');
    expect(day1.unique_active_users).toBe(3); // alice, bob, charlie (not external-user)
  });
});
