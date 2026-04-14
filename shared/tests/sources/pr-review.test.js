import { describe, it, expect } from 'vitest';
import {
  isBot, BOT_PATTERNS, flattenPrRecord, dedupAndFilterPrs,
  classifyAssisted, buildCopilotUsersByDay,
  isPrReviewData, extractPrArray,
} from '../../sources/pr-review.js';

describe('isBot', () => {
  it('detects [bot] suffix', () => {
    expect(isBot('dependabot[bot]')).toBe(true);
  });

  it('detects -bot suffix', () => {
    expect(isBot('my-bot')).toBe(true);
  });

  it('detects known bots', () => {
    expect(isBot('dependabot')).toBe(true);
    expect(isBot('github-actions')).toBe(true);
    expect(isBot('renovate')).toBe(true);
  });

  it('rejects normal logins', () => {
    expect(isBot('alice')).toBe(false);
    expect(isBot('bob-smith')).toBe(false);
  });

  it('treats null/undefined as bot', () => {
    expect(isBot(null)).toBe(true);
    expect(isBot(undefined)).toBe(true);
  });

  it('detects od-octodemo- prefix', () => {
    expect(isBot('od-octodemo-test')).toBe(true);
  });
});

describe('flattenPrRecord', () => {
  it('normalizes a PR record', () => {
    const pr = flattenPrRecord({
      number: 42,
      user: { login: 'alice' },
      merged_at: '2026-04-10T12:00:00Z',
      additions: 100,
      deletions: 20,
      state: 'merged',
      repository: { nameWithOwner: 'org/repo' },
    });
    expect(pr.number).toBe(42);
    expect(pr.user).toBe('alice');
    expect(pr.day).toBe('2026-04-10');
    expect(pr.merged).toBe(true);
    expect(pr.repository).toBe('org/repo');
  });

  it('handles string user field', () => {
    const pr = flattenPrRecord({ number: 1, user: 'bob', created_at: '2026-04-10T00:00:00Z' });
    expect(pr.user).toBe('bob');
  });

  it('defaults additions/deletions to 0', () => {
    const pr = flattenPrRecord({ number: 1, created_at: '2026-04-10T00:00:00Z' });
    expect(pr.additions).toBe(0);
    expect(pr.deletions).toBe(0);
  });
});

describe('dedupAndFilterPrs', () => {
  it('removes duplicates by repository#number', () => {
    const { data, profile } = dedupAndFilterPrs([
      { repository: 'org/repo', number: 1, user: 'alice' },
      { repository: 'org/repo', number: 1, user: 'alice' },
      { repository: 'org/repo', number: 2, user: 'bob' },
    ]);
    expect(data).toHaveLength(2);
    expect(profile.duplicates_removed).toBe(1);
  });

  it('filters out bots', () => {
    const { data, profile } = dedupAndFilterPrs([
      { repository: 'org/repo', number: 1, user: 'alice' },
      { repository: 'org/repo', number: 2, user: 'dependabot[bot]' },
    ]);
    expect(data).toHaveLength(1);
    expect(profile.bots_removed).toBe(1);
  });
});

describe('classifyAssisted', () => {
  const copilotUsers = {
    '2026-04-10': new Set(['alice']),
    '2026-04-11': new Set(['alice', 'bob']),
  };

  it('classifies PR as assisted when author was active on merge day', () => {
    const prs = [{ day: '2026-04-10', user: 'alice', merged: true, additions: 50, deletions: 10 }];
    const { period, profile } = classifyAssisted(prs, copilotUsers);
    expect(period.assisted_prs).toBe(1);
    expect(profile.assisted_prs).toBe(1);
  });

  it('classifies PR as assisted via lookback', () => {
    const prs = [{ day: '2026-04-12', user: 'alice', merged: true, additions: 50, deletions: 10 }];
    const { period } = classifyAssisted(prs, copilotUsers, { lookbackDays: 3 });
    expect(period.assisted_prs).toBe(1);
  });

  it('does not classify beyond lookback window', () => {
    const prs = [{ day: '2026-04-15', user: 'alice', merged: true, additions: 50, deletions: 10 }];
    const { period } = classifyAssisted(prs, copilotUsers, { lookbackDays: 3 });
    expect(period.assisted_prs).toBe(0);
  });

  it('skips unmerged PRs', () => {
    const prs = [{ day: '2026-04-10', user: 'alice', merged: false, additions: 50, deletions: 10 }];
    const { period } = classifyAssisted(prs, copilotUsers);
    expect(period.total_prs).toBe(0);
  });

  it('tracks LOC for assisted vs unassisted', () => {
    const prs = [
      { day: '2026-04-10', user: 'alice', merged: true, additions: 100, deletions: 20 },
      { day: '2026-04-10', user: 'carol', merged: true, additions: 50, deletions: 5 },
    ];
    const { period } = classifyAssisted(prs, copilotUsers);
    expect(period.assisted_loc).toBe(120);
    expect(period.total_loc).toBe(175);
  });
});

describe('buildCopilotUsersByDay', () => {
  it('builds day → user set from user-day records', () => {
    const users = [
      { day: '2026-04-10', user_login: 'alice', code_generation_activity_count: 5, user_initiated_interaction_count: 0 },
      { day: '2026-04-10', user_login: 'bob', code_generation_activity_count: 0, user_initiated_interaction_count: 0 },
    ];
    const map = buildCopilotUsersByDay(users);
    expect(map['2026-04-10'].has('alice')).toBe(true);
    expect(map['2026-04-10'].has('bob')).toBe(false);
  });
});

describe('isPrReviewData', () => {
  it('detects arrays', () => {
    expect(isPrReviewData([{ number: 1 }])).toBe(true);
  });

  it('detects { prs: [...] }', () => {
    expect(isPrReviewData({ prs: [{ number: 1 }] })).toBe(true);
  });

  it('detects { pull_requests: { prs: [...] } }', () => {
    expect(isPrReviewData({ pull_requests: { prs: [{ number: 1 }] } })).toBe(true);
  });

  it('rejects non-PR objects', () => {
    expect(isPrReviewData({ enterprise_report: {} })).toBe(false);
  });
});

describe('extractPrArray', () => {
  it('extracts from flat array', () => {
    expect(extractPrArray([1, 2])).toEqual([1, 2]);
  });

  it('extracts from { prs }', () => {
    expect(extractPrArray({ prs: [1, 2] })).toEqual([1, 2]);
  });

  it('extracts from { pull_requests: { prs } }', () => {
    expect(extractPrArray({ pull_requests: { prs: [1, 2] } })).toEqual([1, 2]);
  });

  it('returns empty for unknown shape', () => {
    expect(extractPrArray({ foo: 'bar' })).toEqual([]);
  });
});
