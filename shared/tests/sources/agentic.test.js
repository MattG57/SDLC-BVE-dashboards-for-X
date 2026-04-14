import { describe, it, expect } from 'vitest';
import {
  flattenPrSession, flattenDevDay,
  dedupSessions, dedupRequests, dedupDevDays,
  aggregateToDay, isAgenticSource,
} from '../../sources/agentic.js';

describe('flattenPrSession', () => {
  it('normalizes a PR session', () => {
    const session = flattenPrSession({
      repo: 'org/repo',
      pr_number: 42,
      pr_created_at: '2026-04-08T10:00:00Z',
      pr_merged_at: '2026-04-10T12:00:00Z',
      pr_state: 'merged',
      pr_author_login: 'alice',
      additions: 100,
      deletions: 20,
      duration_minutes: 45,
      changes_requested_count: 1,
    });
    expect(session.repo).toBe('org/repo');
    expect(session.pr_number).toBe(42);
    expect(session.day).toBe('2026-04-10');
    expect(session.merged).toBe(true);
    expect(session.author).toBe('alice');
    expect(session.duration_minutes).toBe(45);
  });

  it('detects merged from latest_status', () => {
    const session = flattenPrSession({ pr_number: 1, latest_status: 'Merged', pr_created_at: '2026-04-10T00:00:00Z' });
    expect(session.merged).toBe(true);
  });

  it('defaults numeric fields to 0', () => {
    const session = flattenPrSession({ pr_number: 1, pr_created_at: '2026-04-10T00:00:00Z' });
    expect(session.additions).toBe(0);
    expect(session.deletions).toBe(0);
    expect(session.changes_requested_count).toBe(0);
  });
});

describe('flattenDevDay', () => {
  it('normalizes a developer day record', () => {
    const dd = flattenDevDay({
      date: '2026-04-10',
      developer: 'alice',
      total_agent_requests: 5,
      sessions_started: 3,
      agent_prs_created: 2,
      agent_prs_merged: 1,
      agent_loc_added: 500,
      agent_session_minutes: 120,
    });
    expect(dd.day).toBe('2026-04-10');
    expect(dd.developer).toBe('alice');
    expect(dd.total_agent_requests).toBe(5);
    expect(dd.agent_loc_added).toBe(500);
  });

  it('handles day field name', () => {
    const dd = flattenDevDay({ day: '2026-04-10', developer: 'bob' });
    expect(dd.day).toBe('2026-04-10');
  });

  it('defaults missing fields to 0', () => {
    const dd = flattenDevDay({ date: '2026-04-10', developer: 'carol' });
    expect(dd.total_agent_requests).toBe(0);
    expect(dd.agent_prs_merged).toBe(0);
  });
});

describe('dedupSessions', () => {
  it('deduplicates by repo#pr_number', () => {
    const { data, profile } = dedupSessions([
      { repo: 'org/repo', pr_number: 1 },
      { repo: 'org/repo', pr_number: 1 },
      { repo: 'org/repo', pr_number: 2 },
    ]);
    expect(data).toHaveLength(2);
    expect(profile.removed).toBe(1);
  });
});

describe('dedupRequests', () => {
  it('deduplicates by composite key', () => {
    const { data, profile } = dedupRequests([
      { request_type: 'issue', repo: 'r', issue_number: 1, pr_number: '', requested_at: '2026-04-10' },
      { request_type: 'issue', repo: 'r', issue_number: 1, pr_number: '', requested_at: '2026-04-10' },
      { request_type: 'pr', repo: 'r', issue_number: '', pr_number: 5, requested_at: '2026-04-10' },
    ]);
    expect(data).toHaveLength(2);
    expect(profile.removed).toBe(1);
  });
});

describe('dedupDevDays', () => {
  it('deduplicates by day|developer, last wins', () => {
    const { data, profile } = dedupDevDays([
      { day: '2026-04-10', developer: 'alice', total_agent_requests: 1 },
      { day: '2026-04-10', developer: 'alice', total_agent_requests: 5 },
      { day: '2026-04-10', developer: 'bob', total_agent_requests: 3 },
    ]);
    expect(data).toHaveLength(2);
    expect(profile.removed).toBe(1);
    expect(profile.unique_developers).toBe(2);
  });
});

describe('aggregateToDay', () => {
  it('aggregates dev-day records to day level', () => {
    const days = aggregateToDay([
      { day: '2026-04-10', developer: 'alice', total_agent_requests: 3, sessions_started: 2, agent_prs_created: 1, agent_prs_merged: 1, agent_loc_added: 200, agent_loc_deleted: 10, agent_session_minutes: 60, changes_requested_total: 0, median_merge_minutes: 30 },
      { day: '2026-04-10', developer: 'bob', total_agent_requests: 2, sessions_started: 1, agent_prs_created: 1, agent_prs_merged: 0, agent_loc_added: 100, agent_loc_deleted: 5, agent_session_minutes: 30, changes_requested_total: 1, median_merge_minutes: null },
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].active_devs).toBe(2);
    expect(days[0].total_agent_requests).toBe(5);
    expect(days[0].agent_prs_created).toBe(2);
    expect(days[0].agent_prs_merged).toBe(1);
    expect(days[0].merge_rate).toBe(0.5);
    expect(days[0].requests_per_dev).toBe(2.5);
  });

  it('sorts by day', () => {
    const days = aggregateToDay([
      { day: '2026-04-12', developer: 'a', total_agent_requests: 1, sessions_started: 0, agent_prs_created: 0, agent_prs_merged: 0, agent_loc_added: 0, agent_loc_deleted: 0, agent_session_minutes: 0, changes_requested_total: 0 },
      { day: '2026-04-10', developer: 'a', total_agent_requests: 1, sessions_started: 0, agent_prs_created: 0, agent_prs_merged: 0, agent_loc_added: 0, agent_loc_deleted: 0, agent_session_minutes: 0, changes_requested_total: 0 },
    ]);
    expect(days[0].day).toBe('2026-04-10');
    expect(days[1].day).toBe('2026-04-12');
  });

  it('computes median merge minutes', () => {
    const days = aggregateToDay([
      { day: '2026-04-10', developer: 'a', total_agent_requests: 0, sessions_started: 0, agent_prs_created: 0, agent_prs_merged: 0, agent_loc_added: 0, agent_loc_deleted: 0, agent_session_minutes: 0, changes_requested_total: 0, median_merge_minutes: 10 },
      { day: '2026-04-10', developer: 'b', total_agent_requests: 0, sessions_started: 0, agent_prs_created: 0, agent_prs_merged: 0, agent_loc_added: 0, agent_loc_deleted: 0, agent_session_minutes: 0, changes_requested_total: 0, median_merge_minutes: 30 },
      { day: '2026-04-10', developer: 'c', total_agent_requests: 0, sessions_started: 0, agent_prs_created: 0, agent_prs_merged: 0, agent_loc_added: 0, agent_loc_deleted: 0, agent_session_minutes: 0, changes_requested_total: 0, median_merge_minutes: 20 },
    ]);
    expect(days[0].median_merge_minutes).toBe(20);
  });
});

describe('isAgenticSource', () => {
  it('detects pr_sessions', () => {
    expect(isAgenticSource({ pr_sessions: [] })).toBe(true);
  });

  it('detects developer_day_summary', () => {
    expect(isAgenticSource({ developer_day_summary: [] })).toBe(true);
  });

  it('detects requests', () => {
    expect(isAgenticSource({ requests: [] })).toBe(true);
  });

  it('rejects unrelated objects', () => {
    expect(isAgenticSource({ enterprise_report: {} })).toBe(false);
  });

  it('rejects null', () => {
    expect(isAgenticSource(null)).toBe(false);
  });
});
