import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { materializeAiAssistedEfficiencyDays } from '../../materializers/ai-assisted-efficiency-days.js';
import { materializeAgenticEfficiencyDays } from '../../materializers/agentic-efficiency-days.js';
import { materializeAgenticPrSessions } from '../../materializers/agentic-pr-sessions.js';
import { materializeAiAssistedStructuralDays } from '../../materializers/ai-assisted-structural-days.js';

import {
  oldProcessAiAssistedEfficiency,
  oldProcessAgenticEfficiency,
  oldProcessAgenticSessions,
} from './old-path.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

const aiFixture = JSON.parse(readFileSync(
  resolve(root, 'BVE-dashboards-for-ai-assisted-coding/data/examples/ai-assisted-coding-example.json'), 'utf-8'
));
const agenticFixture = JSON.parse(readFileSync(
  resolve(root, 'BVE-dashboards-for-agentic-ai-coding/data/examples/agentic-ai-coding-example.json'), 'utf-8'
));
const prFixture = JSON.parse(readFileSync(
  resolve(root, 'BVE-dashboards-for-ai-assisted-coding/data/examples/pr-review-example.json'), 'utf-8'
));

// ═══════════════════════════════════════════════════════════════════
// AI-Assisted Efficiency Days
// ═══════════════════════════════════════════════════════════════════

describe('ai-assisted-efficiency-days equivalence', () => {
  const oldResult = oldProcessAiAssistedEfficiency(aiFixture);
  const newResult = materializeAiAssistedEfficiencyDays(aiFixture);

  it('produces an artifact with correct name', () => {
    expect(newResult.artifact.name).toBe('ai-assisted-efficiency-days');
  });

  it('produces same number of day rows', () => {
    expect(newResult.data.length).toBe(oldResult.data.length);
  });

  it('produces same days in same order', () => {
    expect(newResult.data.map(d => d.day)).toEqual(oldResult.data.map(d => d.day));
  });

  it('produces same daily_active_users per day', () => {
    for (let i = 0; i < oldResult.data.length; i++) {
      expect(newResult.data[i].daily_active_users).toBe(oldResult.data[i].daily_active_users);
    }
  });

  it('produces same interaction counts', () => {
    for (let i = 0; i < oldResult.data.length; i++) {
      expect(newResult.data[i].user_initiated_interaction_count)
        .toBe(oldResult.data[i].user_initiated_interaction_count);
    }
  });

  it('produces same per-dev ratios', () => {
    const ratioFields = [
      'interactions_per_active_dev', 'generations_per_active_dev',
      'acceptances_per_active_dev', 'loc10_added_per_active_dev',
      'agent_mode_per_active_dev', 'cli_prompts_per_active_dev',
      'acceptance_rate',
    ];
    for (let i = 0; i < oldResult.data.length; i++) {
      for (const field of ratioFields) {
        const oldVal = oldResult.data[i][field];
        const newVal = newResult.data[i][field];
        if (oldVal == null || Number.isNaN(oldVal)) {
          // Old path may produce NaN for undefined fields; new path produces null or 0
          expect(newVal == null || newVal === 0 || Number.isNaN(newVal)).toBe(true);
        } else {
          expect(newVal).toBeCloseTo(oldVal, 10);
        }
      }
    }
  });

  it('produces same user-day records', () => {
    expect(newResult._users.length).toBe(oldResult.users.length);
    const oldLogins = new Set(oldResult.users.map(u => u.user_login));
    const newLogins = new Set(newResult._users.map(u => u.user_login));
    expect(newLogins).toEqual(oldLogins);
  });

  it('has profile metadata', () => {
    expect(newResult.artifact.profile.record_count).toBe(newResult.data.length);
    expect(newResult.artifact.profile.date_range.first).toBeTruthy();
    expect(newResult.artifact.profile.enterprise_dedup).toBeTruthy();
    expect(newResult.artifact.profile.user_dedup).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Agentic Efficiency Days
// ═══════════════════════════════════════════════════════════════════

describe('agentic-efficiency-days equivalence', () => {
  const oldResult = oldProcessAgenticEfficiency(agenticFixture);
  const newResult = materializeAgenticEfficiencyDays(agenticFixture);

  it('produces an artifact with correct name', () => {
    expect(newResult.artifact.name).toBe('agentic-efficiency-days');
  });

  it('produces same number of day rows', () => {
    expect(newResult.data.length).toBe(oldResult.data.length);
  });

  it('produces same days in same order', () => {
    expect(newResult.data.map(d => d.day)).toEqual(oldResult.data.map(d => d.day));
  });

  it('produces same aggregate fields per day', () => {
    const fields = [
      'active_devs', 'total_agent_requests', 'sessions_started',
      'agent_prs_created', 'agent_prs_merged', 'agent_loc_added',
      'agent_loc_deleted', 'agent_session_minutes', 'changes_requested_total',
    ];
    for (let i = 0; i < oldResult.data.length; i++) {
      for (const field of fields) {
        expect(newResult.data[i][field]).toBe(oldResult.data[i][field]);
      }
    }
  });

  it('produces same per-dev ratios', () => {
    const ratioFields = [
      'requests_per_dev', 'sessions_per_dev', 'prs_created_per_dev',
      'prs_merged_per_dev', 'loc_added_per_dev', 'session_mins_per_dev',
      'merge_rate',
    ];
    for (let i = 0; i < oldResult.data.length; i++) {
      for (const field of ratioFields) {
        const oldVal = oldResult.data[i][field];
        const newVal = newResult.data[i][field];
        if (oldVal == null) {
          expect(newVal).toBeNull();
        } else {
          expect(newVal).toBeCloseTo(oldVal, 10);
        }
      }
    }
  });

  it('produces same median merge minutes', () => {
    for (let i = 0; i < oldResult.data.length; i++) {
      expect(newResult.data[i].median_merge_minutes).toBe(oldResult.data[i].median_merge_minutes);
    }
  });

  it('preserves dev-day records', () => {
    expect(newResult._devDays.length).toBe(oldResult.devDays.length);
  });

  it('has profile metadata', () => {
    expect(newResult.artifact.profile.record_count).toBe(newResult.data.length);
    expect(newResult.artifact.profile.devday_dedup).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Agentic PR Sessions
// ═══════════════════════════════════════════════════════════════════

describe('agentic-pr-sessions equivalence', () => {
  const oldResult = oldProcessAgenticSessions(agenticFixture);
  const newResult = materializeAgenticPrSessions(agenticFixture);

  it('produces an artifact with correct name', () => {
    expect(newResult.artifact.name).toBe('agentic-pr-sessions');
  });

  it('produces same number of sessions', () => {
    expect(newResult.data.length).toBe(oldResult.length);
  });

  it('produces same session fields', () => {
    const fields = [
      'repo', 'pr_number', 'day', 'state', 'merged', 'author',
      'additions', 'deletions', 'duration_minutes',
      'changes_requested_count', 'reopened_count',
    ];
    for (let i = 0; i < oldResult.length; i++) {
      for (const field of fields) {
        expect(newResult.data[i][field]).toEqual(oldResult[i][field]);
      }
    }
  });

  it('has profile with status breakdown', () => {
    expect(newResult.artifact.profile.status_breakdown).toBeTruthy();
    expect(newResult.artifact.profile.status_breakdown.merged).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// AI-Assisted Structural Days
// ═══════════════════════════════════════════════════════════════════

describe('ai-assisted-structural-days equivalence', () => {
  const config = { cfg_total_developers: 100, cfg_pr_assist_lookback_days: 3 };
  const newResult = materializeAiAssistedStructuralDays(aiFixture, prFixture, config);

  it('produces an artifact with correct name', () => {
    expect(newResult.artifact.name).toBe('ai-assisted-structural-days');
  });

  it('produces day rows from enterprise data', () => {
    expect(newResult.data.length).toBeGreaterThan(0);
  });

  it('each day has structural metrics', () => {
    for (const d of newResult.data) {
      expect(d).toHaveProperty('adopted_individuals_pct');
      expect(d).toHaveProperty('prs_assisted_pct');
      expect(d).toHaveProperty('ai_assisted_loc_pct');
      expect(d).toHaveProperty('total_prs');
      expect(d).toHaveProperty('total_loc');
      expect(d).toHaveProperty('has_pr_data');
    }
  });

  it('has PR data when PR input is provided', () => {
    expect(newResult.data.some(d => d.has_pr_data)).toBe(true);
  });

  it('computes period aggregates', () => {
    expect(newResult._prPeriod).toBeTruthy();
    expect(newResult._prPeriod.total_prs).toBeGreaterThanOrEqual(0);
  });

  it('adopted_individuals_pct is non-negative (or null)', () => {
    for (const d of newResult.data) {
      if (d.adopted_individuals_pct != null) {
        expect(d.adopted_individuals_pct).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('has profile with PR classification details', () => {
    expect(newResult.artifact.profile.has_pr_data).toBe(true);
    expect(newResult.artifact.profile.pr_classification).toBeTruthy();
    expect(newResult.artifact.profile.pr_processing).toBeTruthy();
  });

  it('works without PR data', () => {
    const noPrResult = materializeAiAssistedStructuralDays(aiFixture, null, config);
    expect(noPrResult.data.length).toBeGreaterThan(0);
    expect(noPrResult.artifact.profile.has_pr_data).toBe(false);
    for (const d of noPrResult.data) {
      expect(d.prs_assisted_pct).toBeNull();
      expect(d.ai_assisted_loc_pct).toBeNull();
    }
  });
});
