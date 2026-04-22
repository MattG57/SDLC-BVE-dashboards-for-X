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
      expect(p.integrated_leverage).toBeGreaterThan(0);
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
        'wipPlus', 'wipMinus', 'wipDelta', 'timeSpentHours', 'timeSavedHours',
        'currentYield', 'leverage', 'projTimeSavedHours', 'projYield', 'modeNote',
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
    it('AI-assisted: attempts = completions = assistedPRs, yield = 100%', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      expect(ai.row.attempts).toBe(14); // 6 + 8 assisted_prs from structural fixture
      expect(ai.row.completionCount).toBe(14); // same as attempts
      expect(ai.row.attemptType).toBe('PRs Created');
      expect(ai.row.completionType).toBe('PRs Created');
      expect(ai.row.currentYield).toBe(1.0);
      expect(ai.row.wipDelta).toBe(0);
    });

    it('Agentic: attempts = total sessions, wipDelta from session states', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      expect(ag.row.attempts).toBe(4); // 4 sessions in fixture
      expect(ag.row.attemptType).toBe('Agent PR Sessions');
      expect(typeof ag.row.wipDelta).toBe('number');
    });

    it('wipDelta = wipPlus - wipMinus (agentic has both components)', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      // Fixture: 1 open session (pr_number 2), no pre-window completions
      expect(ag.row.wipPlus).toBe(1);
      expect(ag.row.wipMinus).toBe(0);
      expect(ag.row.wipDelta).toBe(1); // 1 open - 0 pre-window
    });

    it('factSummary includes wipPlus, wipMinus, wipDelta, and leverage', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      for (const e of result.elements) {
        expect(e.worksheet.factSummary).toHaveProperty('attempts');
        expect(e.worksheet.factSummary).toHaveProperty('wipPlus');
        expect(e.worksheet.factSummary).toHaveProperty('wipMinus');
        expect(e.worksheet.factSummary).toHaveProperty('wipDelta');
        expect(e.worksheet.factSummary).toHaveProperty('leverage');
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

  /* ═══════════════════════════════════════════════════════
     EXACT-VALUE CALCULATION TESTS
     Hand-computed from fixture data to verify every formula.
     ═══════════════════════════════════════════════════════ */
  describe('AI-Assisted exact calculations', () => {
    // Fixture facts:
    //   days: dau=[50,60], interactions=[1000,1200], loc_added=[5000,6000]
    //   structural: total_prs=[10,12]=22, assisted_prs=[6,8]=14
    //   _periodPrsAssistedPct=0.625, _periodLocAssistedPct=0.71
    //   config defaults: pctTimeCoding=0.5, hrsPerDay=8, totalDevs=100

    it('timeSpentHours = sum(dau × pctTimeCoding × hrsPerDay)', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      // (50×0.5×8) + (60×0.5×8) = 200 + 240 = 440
      expect(ai.row.timeSpentHours).toBe(440);
      expect(ai.worksheet.factSummary.timeSpentHours).toBe(440);
    });

    it('leverage = assistedPRs / timeSpentHours', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      // 14 / 440 = 0.031818...
      expect(ai.row.leverage).toBeCloseTo(14 / 440, 5);
    });

    it('adoption projection: projTimeSavedHours = timeSaved × (1/adoptionPct)', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const proj = ai.worksheet.projectedImprovements.find(p => p.projectionId === 'adoption');
      // adoptionPct = 55/100 = 0.55, scaleFactor = 1/0.55 ≈ 1.8182
      // timeSaved (interactions) = 110, projTimeSavedHours = 110 × 1.8182 ≈ 200
      expect(proj.currentValue).toBeCloseTo(0.55, 2);
      expect(proj.projTimeSavedHours).toBe(Math.round(110 / 0.55));
      expect(proj.projCompletionGain).toBeNull(); // time-only projection
      expect(proj.projYield).toBe(1.0); // same as current yield
    });

    it('PR assist projection: projTimeSavedHours = timeSaved × (1/prsAssistedPct)', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const proj = ai.worksheet.projectedImprovements.find(p => p.projectionId === 'prs_assisted');
      // prsAssistedPct = 0.625, scaleFactor = 1/0.625 = 1.6
      // projTimeSavedHours = 110 × 1.6 = 176
      expect(proj.currentValue).toBe(0.625);
      expect(proj.projTimeSavedHours).toBe(176);
      expect(proj.projYield).toBe(1.0);
    });

    it('LoC assist projection: projTimeSavedHours = timeSaved × (1/locAssistedPct)', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const proj = ai.worksheet.projectedImprovements.find(p => p.projectionId === 'loc_assisted');
      // locAssistedPct = 0.71, scaleFactor = 1/0.71
      // projTimeSavedHours = 110 / 0.71 ≈ 154.93 (not rounded for AI-assisted)
      expect(proj.currentValue).toBe(0.71);
      expect(proj.projTimeSavedHours).toBeCloseTo(110 / 0.71, 2);
    });

    it('LoC estimate uses configured est_hrs_per_kloc', () => {
      const result = materializeLeverageSummary(allArtifacts(), { ...BASE_CONFIG, est_hrs_per_kloc: 4 });
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const est = ai.worksheet.improvementEstimates.find(e => e.estimateId === 'loc');
      // (5000+6000)/1000 × 4 = 44
      expect(est.timeSavedHours).toBe(44);
    });

    it('manual_daily_pct estimate: pct × baseline_hrs/workdays × dau per day', () => {
      const cfg = {
        ...BASE_CONFIG,
        cfg_time_saved_pct_day: 0.1,
        cfg_baseline_hours_per_dev_per_week: 40,
        cfg_workdays_per_week: 5,
      };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      const est = ai.worksheet.improvementEstimates.find(e => e.estimateId === 'manual_daily_pct');
      // per-day hrs per dev = 0.1 × 40/5 = 0.8
      // day1: 0.8 × 50 = 40, day2: 0.8 × 60 = 48, total = 88
      expect(est.timeSavedHours).toBe(88);
    });

    it('row.timeSavedHours changes when different estimate is selected via config', () => {
      const cfg = { ...BASE_CONFIG, leverage_ai_estimate: 'loc', est_hrs_per_kloc: 2 };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const ai = result.elements.find(e => e.elementKey === 'ai-assisted-coding');
      // LoC estimate: (11000/1000)×2 = 22
      expect(ai.row.timeSavedHours).toBe(22);
    });
  });

  describe('Agentic exact calculations', () => {
    // Fixture facts:
    //   efficiency days: active_devs=[5,6], session_mins=[120,150]=270
    //   sessions: 4 total, 3 merged (s1,s3,s4), 1 open (s2)
    //     merged mins: 30+45+20=95, merged loc: 500+800+300=1600
    //   config defaults: est_duration_factor=2, est_hrs_per_kloc=2

    it('timeSpentHours = totalSessionMins / 60', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      // totalSessionMins = 120 + 150 = 270, → 270/60 = 4.5, rounded = 5
      expect(ag.worksheet.factSummary.totalSessionMinutes).toBe(270);
      expect(ag.row.timeSpentHours).toBe(Math.round(270 / 60));
    });

    it('yield = windowBoundCompletions / windowBoundAttempts', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      // attempts=4, wipPlus=1(open), completions=3, wipMinus=0
      // windowBound: (3-0)/(4-1) = 3/3 = 1.0
      expect(ag.row.currentYield).toBe(1.0);
    });

    it('leverage = completionCount / timeSpentHours (raw, not rounded)', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      // 3 / 4.5 = 0.6667
      expect(ag.row.leverage).toBeCloseTo(3 / (270 / 60), 4);
    });

    it('LoC estimate: (mergedLocAdded / 1000) × est_hrs_per_kloc', () => {
      const result = materializeLeverageSummary(allArtifacts(), { ...BASE_CONFIG, est_hrs_per_kloc: 2 });
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const est = ag.worksheet.improvementEstimates.find(e => e.estimateId === 'loc');
      // mergedLocAdded = 500+800+300 = 1600, (1600/1000)×2 = 3.2
      expect(est.timeSavedHours).toBeCloseTo(3.2, 4);
    });

    it('adoption projection: scales timeSaved and completions by 1/adoptionPct', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const proj = ag.worksheet.projectedImprovements.find(p => p.projectionId === 'adoption');
      // adoptionPct = 5.5/100 = 0.055
      const adoptionPct = 5.5 / 100;
      const timeSaved = (95 / 60) * 2; // duration estimate
      expect(proj.currentValue).toBeCloseTo(adoptionPct, 3);
      expect(proj.projTimeSavedHours).toBe(Math.round(timeSaved / adoptionPct));
      expect(proj.projCompletionGain).toBe(Math.round(3 * (1 / adoptionPct - 1)));
      expect(proj.projYield).toBe(ag.row.currentYield); // yield preserved
    });

    it('repo coverage projection: scales by 1/repoCoverage', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const proj = ag.worksheet.projectedImprovements.find(p => p.projectionId === 'repo_coverage');
      // activeRepos=2, totalRepos=10, coverage=0.2, scale=5
      expect(proj.currentValue).toBeCloseTo(0.2, 2);
      const timeSaved = (95 / 60) * 2;
      expect(proj.projTimeSavedHours).toBe(Math.round(timeSaved * 5));
      expect(proj.projCompletionGain).toBe(Math.round(3 * 4)); // 3 × (5-1)
    });

    it('duration estimate uses configured est_duration_factor', () => {
      const result = materializeLeverageSummary(allArtifacts(), { ...BASE_CONFIG, est_duration_factor: 0.5 });
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const est = ag.worksheet.improvementEstimates.find(e => e.estimateId === 'duration');
      // mergedSessionMins=95, (95/60)×0.5 = 0.7917
      expect(est.timeSavedHours).toBeCloseTo((95 / 60) * 0.5, 3);
    });
  });

  describe('Agentic WIP with pre-window completions', () => {
    // Custom fixture: a session that started before window but merged in window
    function makeSessionsWithPreWindow() {
      return makeAgenticSessionsArtifact({
        sessions: [
          // Started before window (day < '2026-04-01'), merged in window
          { repo: 'org/repo-a', pr_number: 0, day: '2026-03-20', merged: true, additions: 100, deletions: 10, duration_minutes: 10, author: 'dev0', state: 'closed' },
          // Normal in-window sessions
          { repo: 'org/repo-a', pr_number: 1, day: '2026-04-01', merged: true, additions: 500, deletions: 100, duration_minutes: 30, author: 'dev1', state: 'closed' },
          { repo: 'org/repo-a', pr_number: 2, day: '2026-04-01', merged: false, additions: 200, deletions: 50, duration_minutes: 15, author: 'dev2', state: 'open' },
          { repo: 'org/repo-b', pr_number: 3, day: '2026-04-02', merged: false, additions: 0, deletions: 0, duration_minutes: 20, author: 'dev1', state: 'closed' },
          { repo: 'org/repo-b', pr_number: 4, day: '2026-04-02', merged: true, additions: 300, deletions: 80, duration_minutes: 20, author: 'dev3', state: 'closed' },
        ],
      });
    }

    it('wipMinus counts merged sessions that started before windowStart', () => {
      const arts = allArtifacts({ agenticSessions: makeSessionsWithPreWindow() });
      const result = materializeLeverageSummary(arts, BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      // windowStart = '2026-04-01' (first efficiency day)
      // s0: day='2026-03-20' < windowStart, merged=true → wipMinus
      // s2: state='open' → wipPlus
      expect(ag.row.wipPlus).toBe(1);  // s2
      expect(ag.row.wipMinus).toBe(1); // s0
      expect(ag.row.wipDelta).toBe(0); // 1-1
    });

    it('yield subtracts WIP components from attempts and completions', () => {
      const arts = allArtifacts({ agenticSessions: makeSessionsWithPreWindow() });
      const result = materializeLeverageSummary(arts, BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      // attempts=5, completions=3 (s0,s1,s4 merged)
      // wipPlus=1, wipMinus=1
      // windowBoundAttempts = 5-1 = 4
      // windowBoundCompletions = 3-1 = 2
      // yield = 2/4 = 0.5
      expect(ag.row.attempts).toBe(5);
      expect(ag.row.completionCount).toBe(3);
      expect(ag.row.currentYield).toBeCloseTo(0.5, 4);
    });
  });

  describe('Agentic merge-rate projection with yield < 1', () => {
    // Custom fixture: sessions with closed/unmerged to produce yield < 1
    function makeSessionsWithFailures() {
      return makeAgenticSessionsArtifact({
        sessions: [
          { repo: 'org/repo-a', pr_number: 1, day: '2026-04-01', merged: true, additions: 500, deletions: 100, duration_minutes: 30, author: 'dev1', state: 'closed' },
          { repo: 'org/repo-a', pr_number: 2, day: '2026-04-01', merged: false, additions: 0, deletions: 0, duration_minutes: 15, author: 'dev2', state: 'closed' },
          { repo: 'org/repo-b', pr_number: 3, day: '2026-04-02', merged: false, additions: 0, deletions: 0, duration_minutes: 20, author: 'dev3', state: 'closed' },
          { repo: 'org/repo-b', pr_number: 4, day: '2026-04-02', merged: true, additions: 300, deletions: 80, duration_minutes: 20, author: 'dev1', state: 'closed' },
        ],
      });
    }

    it('merge-rate projection: proj_saved = durationFactor × timeSpent × (1 - yield)', () => {
      const arts = allArtifacts({ agenticSessions: makeSessionsWithFailures() });
      const cfg = { ...BASE_CONFIG, est_duration_factor: 2 };
      const result = materializeLeverageSummary(arts, cfg);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const proj = ag.worksheet.projectedImprovements.find(p => p.projectionId === 'merge_rate');

      // attempts=4, completions=2, no open sessions → wipPlus=0, wipMinus=0
      // yield = 2/4 = 0.5
      // timeSpentHours = 270/60 = 4.5 (from efficiency days)
      // proj_saved = 2 × 4.5 × (1 - 0.5) = 4.5
      expect(ag.row.currentYield).toBeCloseTo(0.5, 4);
      expect(proj).toBeDefined();
      const timeSpentHours = 270 / 60;
      const expectedProjSaved = 2 * timeSpentHours * (1 - 0.5);
      expect(proj.projTimeSavedHours).toBe(Math.round(expectedProjSaved));
    });

    it('merge-rate projection: projCompletionGain = attempts - completions', () => {
      const arts = allArtifacts({ agenticSessions: makeSessionsWithFailures() });
      const result = materializeLeverageSummary(arts, BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const proj = ag.worksheet.projectedImprovements.find(p => p.projectionId === 'merge_rate');
      // 4 - 2 = 2
      expect(proj.projCompletionGain).toBe(2);
    });

    it('merge-rate projection: projYield = 1.0', () => {
      const arts = allArtifacts({ agenticSessions: makeSessionsWithFailures() });
      const result = materializeLeverageSummary(arts, BASE_CONFIG);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const proj = ag.worksheet.projectedImprovements.find(p => p.projectionId === 'merge_rate');
      expect(proj.projYield).toBe(1.0);
    });

    it('merge-rate projection uses est_duration_factor from config', () => {
      const arts = allArtifacts({ agenticSessions: makeSessionsWithFailures() });
      const cfg = { ...BASE_CONFIG, est_duration_factor: 0.5 };
      const result = materializeLeverageSummary(arts, cfg);
      const ag = result.elements.find(e => e.elementKey === 'agentic-ai-coding');
      const proj = ag.worksheet.projectedImprovements.find(p => p.projectionId === 'merge_rate');
      // proj_saved = 0.5 × 4.5 × (1 - 0.5) = 1.125, rounded = 1
      const expected = 0.5 * (270 / 60) * 0.5;
      expect(proj.projTimeSavedHours).toBe(Math.round(expected));
    });
  });

  describe('integrated profile calculations', () => {
    it('integrated_leverage = totalCompletions / totalTimeSpent', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const p = result.artifact.profile;
      // AI: completions=14, timeSpent=440
      // Agentic: completions=3, timeSpent=round(4.5)=5
      // total: 17/445
      expect(p.total_completions).toBe(17);
      expect(p.total_time_spent_hours).toBe(445);
      expect(p.integrated_leverage).toBeCloseTo(17 / 445, 4);
    });

    it('total_time_saved_hours reflects selected estimates', () => {
      const result = materializeLeverageSummary(allArtifacts(), BASE_CONFIG);
      const p = result.artifact.profile;
      // AI: interactions estimate = 110
      // Agentic: duration estimate = round((95/60)×2) = round(3.167) = 3
      expect(p.total_time_saved_hours).toBe(110 + 3);
    });

    it('selecting different estimates changes totals', () => {
      const cfg = { ...BASE_CONFIG, leverage_ai_estimate: 'loc', est_hrs_per_kloc: 2 };
      const result = materializeLeverageSummary(allArtifacts(), cfg);
      const p = result.artifact.profile;
      // AI LoC: 22, Agentic duration: 3 → total = 25
      expect(p.total_time_saved_hours).toBe(22 + 3);
    });
  });
});
