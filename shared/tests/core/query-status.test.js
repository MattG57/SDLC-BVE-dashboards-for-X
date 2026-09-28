import { describe, it, expect } from 'vitest';
import {
  normalizeTimestamp,
  extractWarnings,
  buildQueryStatus,
  QUERY_STATUS_SCHEMA_VERSION,
} from '../../core/query-status.js';

const T = (target, status = 'success', extra = {}) => ({ target, status, ...extra });

describe('normalizeTimestamp', () => {
  it('converts the compact run-id form to ISO', () => {
    expect(normalizeTimestamp('2026-09-28T0617Z')).toBe('2026-09-28T06:17:00Z');
  });

  it('keeps ISO timestamps and drops milliseconds', () => {
    expect(normalizeTimestamp('2026-09-28T07:10:54Z')).toBe('2026-09-28T07:10:54Z');
    expect(normalizeTimestamp('2026-09-28T07:10:54.123Z')).toBe('2026-09-28T07:10:54Z');
  });

  it('returns null for missing or unparseable values', () => {
    expect(normalizeTimestamp(null)).toBeNull();
    expect(normalizeTimestamp('')).toBeNull();
    expect(normalizeTimestamp('not a date')).toBeNull();
    expect(normalizeTimestamp(42)).toBeNull();
  });
});

describe('extractWarnings', () => {
  it('extracts ⚠ and warning lines, strips the marker, dedups', () => {
    const text = [
      'Fetching page 1',
      '  ⚠ Possible incomplete results: search reported 15069 PRs but only 2971 were fetched',
      'Warning: rate limited, retrying',
      '  ⚠ Possible incomplete results: search reported 15069 PRs but only 2971 were fetched',
      'done',
    ].join('\n');
    expect(extractWarnings(text)).toEqual([
      'Possible incomplete results: search reported 15069 PRs but only 2971 were fetched',
      'Warning: rate limited, retrying',
    ]);
  });

  it('caps the number of warnings', () => {
    const text = Array.from({ length: 20 }, (_, i) => `⚠ w${i}`).join('\n');
    expect(extractWarnings(text, 3)).toEqual(['w0', 'w1', 'w2']);
  });

  it('returns [] for empty input', () => {
    expect(extractWarnings('')).toEqual([]);
    expect(extractWarnings(undefined)).toEqual([]);
  });
});

describe('buildQueryStatus', () => {
  const base = {
    runStarted: '2026-09-28T06:17:00Z',
    updatedAt: '2026-09-28T07:10:54Z',
    profile: 'default',
    rawFiles: [{ file: 'a.json', size_bytes: 1, metadata: null }],
  };

  it('collect mode writes a fresh record with ISO timestamps and targets', () => {
    const s = buildQueryStatus({
      ...base,
      previous: { run_started: '2026-09-27T0600Z', targets: [T('old-target')] },
      mode: 'collect',
      targets: [T('copilot-metrics', 'success', { warnings: ['x'] }), T('human-pr-metrics', 'failed', { error: 'boom' })],
    });
    expect(s.schema_version).toBe(QUERY_STATUS_SCHEMA_VERSION);
    expect(s.run_started).toBe('2026-09-28T06:17:00Z');
    expect(s.run_finished).toBe('2026-09-28T07:10:54Z');
    expect(s.last_invocation).toBe('collect');
    expect(s.targets.map(t => t.target)).toEqual(['copilot-metrics', 'human-pr-metrics']);
    expect(s.targets[0].warnings).toEqual(['x']);
    expect(s.targets[1]).toMatchObject({ status: 'failed', error: 'boom', warnings: [] });
    expect(s.raw_files).toEqual(base.rawFiles);
  });

  it('materialize-only keeps the previous collection record', () => {
    const previous = {
      mode: 'collect',
      run_started: '2026-09-28T0617Z',
      run_finished: '2026-09-28T07:10:54Z',
      profile: 'default',
      targets: [T('copilot-metrics')],
    };
    const s = buildQueryStatus({
      ...base,
      previous,
      mode: 'materialize-only',
      runStarted: '2026-09-29T01:00:00Z',
      updatedAt: '2026-09-29T01:05:00Z',
      targets: [],
    });
    expect(s.run_started).toBe('2026-09-28T06:17:00Z');
    expect(s.targets.map(t => t.target)).toEqual(['copilot-metrics']);
    expect(s.mode).toBe('collect');
    expect(s.last_invocation).toBe('materialize-only');
    expect(s.updated_at).toBe('2026-09-29T01:05:00Z');
  });

  it('materialize-only without a previous record reports no collection', () => {
    const s = buildQueryStatus({ ...base, previous: null, mode: 'materialize-only', targets: [] });
    expect(s.run_started).toBeNull();
    expect(s.run_finished).toBeNull();
    expect(s.targets).toEqual([]);
  });

  it('session-logs-only replaces only the targets that ran', () => {
    const previous = {
      run_started: '2026-09-28T06:17:00Z',
      targets: [T('copilot-metrics'), T('agent-session-logs', 'failed')],
    };
    const s = buildQueryStatus({
      ...base,
      previous,
      mode: 'session-logs-only',
      targets: [T('agent-session-logs', 'success', { duration_s: 12 })],
    });
    expect(s.run_started).toBe('2026-09-28T06:17:00Z');
    expect(s.targets).toHaveLength(2);
    expect(s.targets.find(t => t.target === 'agent-session-logs')).toMatchObject({ status: 'success', duration_s: 12 });
  });

  it('treats a previous record without a valid run_started as absent', () => {
    const s = buildQueryStatus({
      ...base,
      previous: { run_started: null, targets: [T('stale')] },
      mode: 'session-logs-only',
      targets: [T('agent-session-logs')],
    });
    expect(s.run_started).toBe('2026-09-28T06:17:00Z');
    expect(s.targets.map(t => t.target)).toEqual(['agent-session-logs']);
  });

  it('rejects unknown modes', () => {
    expect(() => buildQueryStatus({ ...base, previous: null, mode: 'bogus', targets: [] })).toThrow(/Unknown/);
  });
});
