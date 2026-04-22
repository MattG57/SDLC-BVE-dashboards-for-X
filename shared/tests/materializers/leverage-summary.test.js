/**
 * Tests for the leverage-summary materializer.
 *
 * Verifies row structure, estimate calculations, projection calculations,
 * config-driven selections, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { materializeLeverageSummary } from '../../materializers/leverage-summary.js';

// ── Minimal test fixtures ──

function makeAiEfficiencyArtifact(overrides = {}) {
  const days = overrides.days || [
    {
      day: '2026-04-01', enterprise_id: '1',
      daily_active_users: 50, user_initiated_interaction_count: 1000,
      code_generation_activity_count: 800, code_acceptance_activity_count: 400,
      loc_added_sum: 5000, loc_deleted_sum: 1000,
      interactions_per_active_dev: 20, acceptance_rate: 0.5,
    },
    {
      day: '2026-04-02', enterprise_id: '1',
      daily_active_users: 60, user_initiated_interaction_count: 1200,
      code_generation_activity_count: 900, code_acceptance_activity_count: 450,
      loc_added_sum: 6000, loc_deleted_sum: 1200,
      interactions_per_active_dev: 20, acceptance_rate: 0.5,
    },
  ];
  return { artifact: { name: 'ai-assisted-efficiency-days' }, data: days, _users: [] };
}

function makeAiStructuralArtifact(overrides = {}) {
  const days = overrides.days || [
    {
      day: '2026-04-01', daily_active_users: 50,
      adopted_individuals_pct: 0.5, prs_assisted_pct: 0.6, ai_assisted_loc_pct: 0.7,
      total_prs: 10, assisted_prs: 6, total_loc: 5000, assisted_loc: 3500,
      has_pr_data: true,
    },
    {
      day: '2026-04-02', daily_active_users: 60,
      adopted_individuals_pct: 0.55, prs_assisted_pct: 0.65, ai_assisted_loc_pct: 0.72,
      total_prs: 12, assisted_prs: 8, total_loc: 6000, assisted_loc: 4320,
      has_pr_data: true,
    },
  ];
  return {
    artifact: { name: 'ai-assisted-structural-days' }, data: days,
    _prRecords: [], _periodPrsAssistedPct: 0.625, _periodLocAssistedPct: 0.71,
    _copilotUsersByDay: {},
  };
}

function makeAgenticEfficiencyArtifact(overrides = {}) {
  const days = overrides.days || [
    {
      day: '2026-04-01', active_devs: 5,
      sessions_started: 20, agent_prs_created: 10, agent_prs_merged: 3,
      agent_loc_added: 5000, agent_session_minutes: 120,
      requests_per_dev: 4, sessions_per_dev: 4, merge_rate: 0.3,
    },
    {
      day: '2026-04-02', active_devs: 6,
      sessions_started: 25, agent_prs_created: 12, agent_prs_merged: 4,
      agent_loc_added: 6000, agent_session_minutes: 150,
      requests_per_dev: 4.2, sessions_per_dev: 4.2, merge_rate: 0.33,
    },
  ];
  return { artifact: { name: 'agentic-efficiency-days' }, data: days, _devDays: [] };
}

function makeAgenticSessionsArtifact(overrides = {}) {
  const sessions = overrides.sessions || [
    { repo: 'org/repo-a', pr_number: 1, day: '2026-04-01', merged: true, additions: 500, deletions: 100, duration_minutes: 30, author: 'dev1', state: 'closed' },
    { repo: 'org/repo-a', pr_number: 2, day: '2026-04-01', merged: false, additions: 200, deletions: 50, duration_minutes: 15, author: 'dev2', state: 'open' },
    { repo: 'org/repo-b', pr_number: 3, day: '2026-04-02', merged: true, additions: 800, deletions: 200, duration_minutes: 45, author: 'dev1', state: 'closed' },
    { repo: 'org/repo-b', pr_number: 4, day: '2026-04-02', merged: true, additions: 300, deletions: 80, duration_minutes: 20, author: 'dev3', state: 'closed' },
  ];
  return { artifact: { name: 'agentic-pr-sessions' }, data: sessions };
}

function allArtifacts(overrides = {}) {
  return {
    aiEfficiency: overrides.aiEfficiency || makeAiEfficiencyArtifact(),
    aiStructural: overrides.aiStructural || makeAiStructuralArtifact(),
    agenticEfficiency: overrides.agenticEfficiency || makeAgenticEfficiencyArtifact(),
    agenticSessions: overrides.agenticSessions || makeAgenticSessionsArtifact(),
  };
}

const BASE_CONFIG = { cfg_total_developers: 100, cfg_total_repos: 10 };

// ── Tests ──

describe('leverage-summary materializer', () => {
  describe('artifact envelope', () => {
    it('produces correct top-level structure', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      expect(result).toHaveProperty('artifact');
      expect(result).toHaveProperty('elements');
      expect(result.artifact.name).toBe('leverage-summary');
      expect(result.artifact.stage).toBe('materialized');
      expect(result.artifact.version).toBe('1.0.0');
    });

    it('includes profile with totals', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const p = result.artifact.profile;
      expect(p.element_count).toBe(2);
      expect(p.total_time_saved_hours).toBeGreaterThan(0);
      expect(p.total_completions).toBeGreaterThan(0);
      expect(p.integrated_yield).toBeGreaterThan(0);
    });

    it('records config_used and selections_used', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      expect(result.artifact.profile.config_used).toBeDefined();
      expect(result.artifact.profile.config_used.cfg_total_developers).toBe(100);
      expect(result.artifact.profile.selections_used).toBeDefined();
    });
  });

  describe('element structure', () => {
    it('produces two elements (AI-assisted + Agentic)', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      expect(result.elements).toHaveLength(2);
      expect(result.elements[0].elementKey).toBe('ai-assisted-coding');
      expect(result.elements[1].elementKey).toBe('agentic-ai-coding');
    });

    it('each element has row + worksheet', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      for (const e of result.elements) {
        expect(e).toHaveProperty('row');
        expect(e).toHaveProperty('worksheet');
        expect(e.worksheet).toHaveProperty('definitions');
        expect(e.worksheet).toHaveProperty('timeWindow');
        expect(e.worksheet).toHaveProperty('dateRange');
        expect(e.worksheet).toHaveProperty('factSummary');
        expect(e.worksheet).toHaveProperty('improvementEstimates');
        expect(e.worksheet).toHaveProperty('projectedImprovements');
        expect(e.worksheet).toHaveProperty('selection');
      }
    });

    it('row has all required fields', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const requiredFields = [
        'area', 'attemptType', 'attempts', 'completionType', 'completionCount',
        'wipDelta', 'timeSpentHours', 'timeSavedHours', 'currentYield',
        'projTimeSavedHours', 'projYield', 'modeNote',
      ];
      for (const e of result.elements) {
        for (const f of requiredFields) {
          expect(e.row).toHaveProperty(f);
        }
      }
    });
  });

  describe('workflow definitions and window', () => {
    it('each element has definitions with attempt/failure/completion/yield', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      for (const e of result.elements) {
        expect(e.worksheet.definitions).toHaveProperty('attempt');
        expect(e.worksheet.definitions).toHaveProperty('failure');
        expect(e.worksheet.definitions).toHaveProperty('completion');
        expect(e.worksheet.definitions).toHaveProperty('yield');
        expect(typeof e.worksheet.definitions.attempt).toBe('string');
      }
    });

    it('timeWindow is shared (default 28 days)', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      for (const e of result.elements) {
        expect(e.worksheet.timeWindow.days).toBe(28);
        expect(e.worksheet.timeWindow.label).toContain('28');
      }
    });

    it('dateRange reflects actual per-element data', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      expect(ai.worksheet.dateRange.first).toBe('2026-04-01');
      expect(ai.worksheet.dateRange.last).toBe('2026-04-02');
      expect(ai.worksheet.dateRange.days).toBe(2);
    });

    it('factSummary includes timeSpentBasis explanation', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      for (const e of result.elements) {
        expect(e.worksheet.factSummary.timeSpentBasis).toBeDefined();
        expect(typeof e.worksheet.factSummary.timeSpentBasis).toBe('string');
      }
    });
  });

  describe('attempts and WIP Delta', () => {
    it('AI-assisted: attempts = total PRs, wipDelta computed from PR states', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      expect(ai.row.attempts).toBe(22); // 10 + 12 from structural fixture
      expect(ai.row.attemptType).toBe('PRs Created');
      expect(typeof ai.row.wipDelta).toBe('number');
    });

    it('Agentic: attempts = total sessions, wipDelta from session states', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      expect(ag.row.attempts).toBe(4); // 4 sessions in fixture
      expect(ag.row.attemptType).toBe('Agent PR Sessions');
      expect(typeof ag.row.wipDelta).toBe('number');
    });

    it('wipDelta = open items - pre-window completions', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      // Fixture: 1 open session (pr_number 2), no pre-window completions
      expect(ag.row.wipDelta).toBe(1); // 1 open - 0 pre-window
    });

    it('factSummary includes attempts and wipDelta', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      for (const e of result.elements) {
        expect(e.worksheet.factSummary).toHaveProperty('attempts');
        expect(e.worksheet.factSummary).toHaveProperty('wipDelta');
        expect(e.worksheet.factSummary).toHaveProperty('attemptType');
      }
    });
  });

  describe('AI-assisted element', () => {
    it('computes interactions-based and LoC-based estimates', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const ids = ai.worksheet.improvementEstimates.map(e => e.estimateId);
      expect(ids).toContain('interactions');
      expect(ids).toContain('loc');
    });

    it('interactions estimate: total_interactions / est_interactions_per_hour', () => {
      const result = materializeLeverageSummary(allArtifacts(), { ...BASE_CONFIG, est_interactions_per_hour: 20 });
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const est = ai.worksheet.improvementEstimates.find(e => e.estimateId === 'interactions');
      // 1000 + 1200 = 2200 interactions / 20 = 110 hours
      expect(est.timeSavedHours).toBe(110);
    });

    it('loc estimate: (loc_added / 1000) * est_hrs_per_kloc', () => {
      const result = materializeLeverageSummary(allArtifacts(), { ...BASE_CONFIG, est_hrs_per_kloc: 2 });
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const est = ai.worksheet.improvementEstimates.find(e => e.estimateId === 'loc');
      // (5000 + 6000) / 1000 * 2 = 22 hours
      expect(est.timeSavedHours).toBe(22);
    });

    it('includes manual_daily_pct estimate when configured', () => {
      const cfg = { ...BASE_CONFIG, cfg_time_saved_pct_day: 0.1, cfg_baseline_hours_per_dev_per_week: 40 };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const ids = ai.worksheet.improvementEstimates.map(e => e.estimateId);
      expect(ids).toContain('manual_daily_pct');
    });

    it('omits manual_daily_pct when not configured', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const ids = ai.worksheet.improvementEstimates.map(e => e.estimateId);
      expect(ids).not.toContain('manual_daily_pct');
    });

    it('computes adoption projection when adoption < 100%', () => {
      // avgDau = 55, totalDevs = 100 → 55% adoption
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const proj = ai.worksheet.projectedImprovements.find(p => p.projectionId === 'adoption');
      expect(proj).toBeDefined();
      expect(proj.currentValue).toBeCloseTo(0.55, 1);
      expect(proj.targetValue).toBe(1.0);
      expect(proj.projTimeSavedHours).toBeGreaterThan(ai.row.timeSavedHours);
    });

    it('computes PR assist and LoC assist projections', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const projIds = ai.worksheet.projectedImprovements.map(p => p.projectionId);
      expect(projIds).toContain('prs_assisted');
      expect(projIds).toContain('loc_assisted');
    });

    it('factSummary has counts', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const facts = ai.worksheet.factSummary;
      expect(facts.totalInteractions).toBe(2200);
      expect(facts.totalPRs).toBe(22);
      expect(facts.activeDevs).toBe(55);
    });
  });

  describe('Agentic element', () => {
    it('computes duration-based and LoC-based estimates from merged sessions', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const ids = ag.worksheet.improvementEstimates.map(e => e.estimateId);
      expect(ids).toContain('duration');
      expect(ids).toContain('loc');
    });

    it('duration estimate uses merged session minutes × duration factor', () => {
      const result = materializeLeverageSummary(allArtifacts(), { ...BASE_CONFIG, est_duration_factor: 2 });
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const est = ag.worksheet.improvementEstimates.find(e => e.estimateId === 'duration');
      // merged sessions: 30 + 45 + 20 = 95 mins / 60 * 2 = 3.167 hrs
      expect(est.timeSavedHours).toBeCloseTo(95 / 60 * 2, 1);
    });

    it('completionCount = merged PRs', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      expect(ag.row.completionCount).toBe(3); // 3 merged in fixture
    });

    it('computes adoption and merge rate projections', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const projIds = ag.worksheet.projectedImprovements.map(p => p.projectionId);
      expect(projIds).toContain('adoption');
      expect(projIds).toContain('merge_rate');
    });

    it('computes repo coverage projection when cfg_total_repos set', () => {
      const result = materializeLeverageSummary(allArtifacts(), { ...BASE_CONFIG, cfg_total_repos: 10 });
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const proj = ag.worksheet.projectedImprovements.find(p => p.projectionId === 'repo_coverage');
      expect(proj).toBeDefined();
      // 2 repos active out of 10
      expect(proj.currentValue).toBeCloseTo(0.2, 1);
    });
  });

  describe('config-driven selections', () => {
    it('defaults to first estimate and first projection', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      expect(ai.worksheet.selection.selectedEstimateId).toBe('interactions');
    });

    it('selects specific estimate when configured', () => {
      const cfg = { ...BASE_CONFIG, leverage_ai_estimate: 'loc' };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      expect(ai.worksheet.selection.selectedEstimateId).toBe('loc');
      // row.timeSavedHours should reflect loc estimate
      const locEst = ai.worksheet.improvementEstimates.find(e => e.estimateId === 'loc');
      expect(ai.row.timeSavedHours).toBe(Math.round(locEst.timeSavedHours));
    });

    it('selects specific projection when configured', () => {
      const cfg = { ...BASE_CONFIG, leverage_ai_projection: 'loc_assisted' };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      expect(ai.worksheet.selection.selectedProjectionId).toBe('loc_assisted');
      expect(ai.row.modeNote).toBe('Full LoC Assist');
    });

    it('falls back to first when configured selection not found', () => {
      const cfg = { ...BASE_CONFIG, leverage_ai_estimate: 'nonexistent' };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      expect(ai.worksheet.selection.selectedEstimateId).toBe('interactions');
    });

    it('agentic selections work independently', () => {
      const cfg = { ...BASE_CONFIG, leverage_agentic_estimate: 'loc' };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      expect(ag.worksheet.selection.selectedEstimateId).toBe('loc');
    });
  });

  describe('edge cases', () => {
    it('handles missing AI-assisted artifacts gracefully', () => {
      const arts = allArtifacts();
      arts.aiEfficiency = null;
      arts.aiStructural = null;
      const result = materializeLeverageSummary(arts, BASE_CONFIG);
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].elementKey).toBe('agentic-ai-coding');
    });

    it('handles missing agentic artifacts gracefully', () => {
      const arts = allArtifacts();
      arts.agenticEfficiency = null;
      arts.agenticSessions = null;
      const result = materializeLeverageSummary(arts, BASE_CONFIG);
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].elementKey).toBe('ai-assisted-coding');
    });

    it('handles empty artifacts', () => {
      const arts = {
        aiEfficiency: { data: [], _users: [] },
        aiStructural: { data: [] },
        agenticEfficiency: { data: [], _devDays: [] },
        agenticSessions: { data: [] },
      };
      const result = materializeLeverageSummary(arts, BASE_CONFIG);
      expect(result.elements).toHaveLength(0);
      expect(result.artifact.profile.element_count).toBe(0);
    });

    it('skips adoption projection when adoption >= 100%', () => {
      // 55 avg DAU with only 50 total devs → 110% adoption
      const cfg = { ...BASE_CONFIG, cfg_total_developers: 50 };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const adoptionProj = ai.worksheet.projectedImprovements.find(p => p.projectionId === 'adoption');
      expect(adoptionProj).toBeUndefined();
    });
  });
});
