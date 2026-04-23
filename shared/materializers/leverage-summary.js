/**
 * Materializer: leverage-summary
 *
 * Produces standardized leverage rows from the 4 existing artifacts.
 * Each element gets one row with a common summary (`row`) and
 * element-specific modeling detail (`worksheet`).
 *
 * Consumed by: Integrated Leverage dashboard, Element dashboards.
 *
 * Input artifacts:
 *   - ai-assisted-efficiency-days  (enterprise day rows + _users)
 *   - ai-assisted-structural-days  (structural factors + _prRecords)
 *   - agentic-efficiency-days      (aggregated day rows + _devDays)
 *   - agentic-pr-sessions          (flattened PR sessions)
 */

import { safeDiv } from '../core/math.js';
import { getAllDefaults } from '../core/config.js';

/**
 * Build the AI-Assisted leverage element.
 */
function buildAiAssistedElement(effArt, strArt, config, selections) {
  if (!effArt?.data?.length) return null;

  const days = effArt.data;
  const strData = strArt?.data || [];
  const prRecords = strArt?._prRecords || [];
  const n = days.length;
  const totalDevs = config.cfg_total_developers || 100;
  const pctTimeCoding = config.cfg_pct_time_coding || 0.5;
  const hrsPerDay = config.cfg_hrs_per_dev_per_day || 8;
  const defaultWindowDays = config.cfg_window_days || 28;

  // Date range (actual data)
  const sortedDays = days.map(d => d.day).sort();
  const dateRange = {
    first: sortedDays[0],
    last: sortedDays[sortedDays.length - 1],
    days: n,
  };

  // Facts
  const avgDau = days.reduce((s, d) => s + (d.daily_active_users || 0), 0) / n;
  const totalInteractions = days.reduce((s, d) => s + (d.user_initiated_interaction_count || 0), 0);
  const totalLocAdded = days.reduce((s, d) => s + (d.loc_added_sum || 0), 0);
  const totalPRs = strData.reduce((s, d) => s + (d.total_prs || 0), 0);
  const assistedPRs = strData.reduce((s, d) => s + (d.assisted_prs || 0), 0);
  const prsAssistedPct = strArt?._periodPrsAssistedPct ?? safeDiv(assistedPRs, totalPRs);
  const locAssistedPct = strArt?._periodLocAssistedPct ?? null;
  const adoptionPct = safeDiv(avgDau, totalDevs);

  // Time spent = active dev hours in the coding context
  const timeSpentHours = days.reduce((s, d) => s + (d.daily_active_users || 0) * pctTimeCoding * hrsPerDay, 0);

  // Attempts = Completions = assisted PRs (Copilot usage within 3 days before PR opened)
  const attempts = assistedPRs;
  const attemptType = 'PRs Created';
  const completionCount = assistedPRs;
  const completionType = 'PRs Created';
  const mergedPRCount = prRecords.filter(p => p.merged).length;

  // WIP not applicable — attempt and completion are the same event
  const wipPlus = 0;
  const wipMinus = 0;
  const wipDelta = 0;

  // Yield = 100% (every assisted PR is both attempt and completion)
  const currentYield = assistedPRs > 0 ? 1.0 : null;
  // Leverage = completions per dev-hour
  const leverage = safeDiv(completionCount, timeSpentHours);

  // ── Improvement estimates ──
  const estimates = [];

  // 1. Interactions-based
  const estInteractionsPerHr = config.est_interactions_per_hour || 20;
  const interactionHrs = totalInteractions / estInteractionsPerHr;
  estimates.push({
    estimateId: 'interactions',
    name: 'Interactions-Based',
    improvementType: 'time',
    method: 'interactions',
    formula: `hours_saved = total_interactions / ${estInteractionsPerHr}`,
    inputs: { total_interactions: totalInteractions, est_interactions_per_hour: estInteractionsPerHr },
    timeSavedHours: interactionHrs,
    timeSavedPerDev: safeDiv(interactionHrs, avgDau * n),
    completionGain: null,
    yieldGain: null,
  });

  // 2. LoC-based
  const estHrsPerKloc = config.est_hrs_per_kloc || 2;
  const locHrs = (totalLocAdded / 1000) * estHrsPerKloc;
  estimates.push({
    estimateId: 'loc',
    name: 'LoC-Based',
    improvementType: 'time',
    method: 'loc',
    formula: `hours_saved = (loc_added / 1000) × ${estHrsPerKloc}`,
    inputs: { total_loc_added: totalLocAdded, est_hrs_per_kloc: estHrsPerKloc },
    timeSavedHours: locHrs,
    timeSavedPerDev: safeDiv(locHrs, avgDau * n),
    completionGain: null,
    yieldGain: null,
  });

  // 3. Manual daily % (only if configured)
  const pctDay = config.cfg_time_saved_pct_day;
  const baselineHrs = config.cfg_baseline_hours_per_dev_per_week;
  const wdays = config.cfg_workdays_per_week || 5;
  if (pctDay != null && baselineHrs != null) {
    const manualHrs = days.reduce((s, d) => s + (pctDay * baselineHrs / wdays) * (d.daily_active_users || 0), 0);
    estimates.push({
      estimateId: 'manual_daily_pct',
      name: 'Manual Daily %',
      improvementType: 'time',
      method: 'manual_daily_pct',
      formula: `hours_saved = pct × baseline_hrs / workdays × active_devs`,
      inputs: { cfg_time_saved_pct_day: pctDay, cfg_baseline_hours_per_dev_per_week: baselineHrs },
      timeSavedHours: manualHrs,
      timeSavedPerDev: safeDiv(manualHrs, avgDau * n),
      completionGain: null,
      yieldGain: null,
    });
  }

  // Default selection: use configured selection or first estimate
  const selectedEstimate = (selections?.estimateId
    ? estimates.find(e => e.estimateId === selections.estimateId)
    : null) || estimates[0];
  const timeSavedHours = selectedEstimate?.timeSavedHours || 0;

  // ── Projected improvements ──
  const projections = [];

  // 1. Adoption → 100%
  if (adoptionPct != null && adoptionPct > 0 && adoptionPct < 1) {
    const scaleFactor = 1 / adoptionPct;
    const projSaved = timeSavedHours * scaleFactor;
    projections.push({
      projectionId: 'adoption',
      name: 'Full Adoption',
      improvementType: 'time',
      structuralFactor: 'adoption',
      currentValue: adoptionPct,
      targetValue: 1.0,
      formula: `proj_saved = time_saved × (1 / adoption_pct) = ${Math.round(timeSavedHours)} × ${(scaleFactor).toFixed(2)}`,
      projTimeSavedHours: projSaved,
      projCompletionGain: null,
      projYield: currentYield,
    });
  }

  // 2. PR Assist → 100%
  if (prsAssistedPct != null && prsAssistedPct > 0 && prsAssistedPct < 1) {
    const scaleFactor = 1 / prsAssistedPct;
    const projSaved = timeSavedHours * scaleFactor;
    projections.push({
      projectionId: 'prs_assisted',
      name: 'Full PR Assist',
      improvementType: 'time',
      structuralFactor: 'prs_assisted_pct',
      currentValue: prsAssistedPct,
      targetValue: 1.0,
      formula: `proj_saved = time_saved × (1 / prs_assisted_pct) = ${Math.round(timeSavedHours)} × ${(scaleFactor).toFixed(2)}`,
      projTimeSavedHours: projSaved,
      projCompletionGain: null,
      projYield: currentYield,
    });
  }

  // 3. LoC Assist → 100%
  if (locAssistedPct != null && locAssistedPct > 0 && locAssistedPct < 1) {
    const scaleFactor = 1 / locAssistedPct;
    const projSaved = timeSavedHours * scaleFactor;
    projections.push({
      projectionId: 'loc_assisted',
      name: 'Full LoC Assist',
      improvementType: 'time',
      structuralFactor: 'loc_assisted_pct',
      currentValue: locAssistedPct,
      targetValue: 1.0,
      formula: `proj_saved = time_saved × (1 / loc_assisted_pct) = ${Math.round(timeSavedHours)} × ${(scaleFactor).toFixed(2)}`,
      projTimeSavedHours: projSaved,
      projCompletionGain: null,
      projYield: currentYield,
    });
  }

  const selectedProjection = (selections?.projectionId
    ? projections.find(p => p.projectionId === selections.projectionId)
    : null) || projections[0] || null;

  // ── Assemble ──
  return {
    elementKey: 'ai-assisted-coding',
    row: {
      area: 'AI Assisted Coding',
      attemptType,
      attempts,
      completionType,
      completionCount,
      wipPlus,
      wipMinus,
      wipDelta,
      timeSpentHours: Math.round(timeSpentHours),
      timeSavedHours: Math.round(timeSavedHours),
      currentYield,
      leverage,
      projTimeSavedHours: selectedProjection ? Math.round(selectedProjection.projTimeSavedHours) : null,
      projCompletionGain: selectedProjection?.projCompletionGain ?? null,
      projYield: selectedProjection?.projYield ?? null,
      modeNote: selectedProjection?.name || 'no projection available',
    },
    worksheet: {
      definitions: {
        attempt: 'Active developer-day (Copilot-active author on a given day)',
        failure: 'Active dev-day that does not result in a PR',
        completion: 'PR created by a Copilot-active author within the time window',
        yield: 'PRs created / active dev-days',
      },
      timeWindow: { label: `Previous ${defaultWindowDays} Days`, days: defaultWindowDays },
      dateRange,
      factSummary: {
        completionCount,
        completionType,
        attempts,
        attemptType,
        wipPlus,
        wipMinus,
        wipDelta,
        timeSpentHours: Math.round(timeSpentHours),
        timeSpentBasis: `${Math.round(avgDau)} active devs × ${n}d × ${pctTimeCoding} coding × ${hrsPerDay}h`,
        currentYield,
        leverage,
        totalDevs,
        activeDevs: Math.round(avgDau),
        adoptionPct,
        totalInteractions,
        totalLocAdded,
        totalPRs,
        mergedPRCount,
        assistedPRs,
        prsAssistedPct,
        locAssistedPct,
      },
      improvementEstimates: estimates,
      projectedImprovements: projections,
      selection: {
        selectedEstimateId: selectedEstimate?.estimateId || null,
        selectedProjectionId: selectedProjection?.projectionId || null,
        modeNote: selectedProjection?.name || 'no projection available',
      },
    },
  };
}

/**
 * Build the Agentic leverage element.
 */
function buildAgenticElement(effArt, sessArt, config, selections, sessionLogs) {
  if (!effArt?.data?.length) return null;

  const allDays = effArt.data;
  const allSessions = sessArt?.data || [];
  const allSessionLogs = sessionLogs?.session_logs || [];
  const totalDevs = config.cfg_total_developers || 100;
  const totalRepos = config.cfg_total_repos;
  const defaultWindowDays = config.cfg_window_days || 28;

  // Filter to most recent N days to match the time window
  const sortedAllDays = allDays.map(d => d.day).sort();
  const latestDay = sortedAllDays[sortedAllDays.length - 1];
  const cutoffDate = new Date(latestDay);
  cutoffDate.setDate(cutoffDate.getDate() - defaultWindowDays);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const days = allDays.filter(d => d.day >= cutoff);
  const sessions = allSessions.filter(s => s.day >= cutoff);
  const n = days.length;

  if (n === 0) return null;

  // Date range (filtered data)
  const sortedDays = days.map(d => d.day).sort();
  const dateRange = {
    first: sortedDays[0],
    last: sortedDays[sortedDays.length - 1],
    days: n,
  };

  // Facts
  const avgActiveDevs = days.reduce((s, d) => s + (d.active_devs || 0), 0) / n;
  const totalSessions = days.reduce((s, d) => s + (d.sessions_started || 0), 0);
  const totalPRsCreated = sessions.length > 0
    ? sessions.length
    : days.reduce((s, d) => s + (d.agent_prs_created || 0), 0);
  const totalPRsMerged = sessions.length > 0
    ? sessions.filter(p => p.merged).length
    : days.reduce((s, d) => s + (d.agent_prs_merged || 0), 0);
  const mergeRate = safeDiv(totalPRsMerged, totalPRsCreated);
  const adoptionPct = safeDiv(avgActiveDevs, totalDevs);
  const activeRepos = sessions.length > 0
    ? new Set(sessions.map(p => p.repo).filter(Boolean)).size
    : null;
  const repoCoverage = totalRepos ? safeDiv(activeRepos, totalRepos) : null;

  // Merged PR metrics for estimates
  const mergedSessions = sessions.filter(p => p.merged);
  const mergedSessionMins = mergedSessions.reduce((s, p) => s + (p.duration_minutes || 0), 0);
  const mergedLocAdded = mergedSessions.reduce((s, p) => s + (p.additions || 0), 0);
  const totalSessionMins = days.reduce((s, d) => s + (d.agent_session_minutes || 0), 0);

  // Attempts, completions, WIP Delta
  const attempts = totalPRsCreated;
  const attemptType = 'Agent PR Sessions';
  const completionCount = totalPRsMerged;
  const completionType = 'PRs Merged';

  // WIP components
  const windowStart = dateRange.first;
  const wipPlus = sessions.filter(p => p.state === 'open').length;
  const wipMinus = sessions.filter(p => p.merged && p.day < windowStart).length;
  const wipDelta = wipPlus - wipMinus;

  // Time spent = compute time from session logs (preferred) or observed session duration
  // Build a lookup of compute_minutes by repo+pr_number
  const computeByPr = {};
  for (const sl of allSessionLogs) {
    computeByPr[`${sl.repo}#${sl.pr_number}`] = sl;
  }
  const hasSessionLogs = allSessionLogs.length > 0;

  // Sum compute time for sessions in window
  let computeMinutesTotal = 0;
  let computeSessionCount = 0;
  for (const s of sessions) {
    const key = `${s.repo}#${s.pr_number}`;
    const sl = computeByPr[key];
    if (sl && sl.active_minutes != null) {
      computeMinutesTotal += sl.active_minutes;
      computeSessionCount++;
    }
  }

  const timeSpentHours = hasSessionLogs && computeSessionCount > 0
    ? computeMinutesTotal / 60
    : totalSessionMins / 60;
  const timeSpentBasis = hasSessionLogs && computeSessionCount > 0
    ? `${computeMinutesTotal.toFixed(1)} compute-mins / 60 (active time from ${computeSessionCount} session logs)`
    : `${Math.round(totalSessionMins)} session-mins / 60 (observed agent running time)`;

  // Yield (window-bound) and Leverage
  const windowBoundAttempts = attempts - wipPlus;
  const windowBoundCompletions = completionCount - wipMinus;
  const currentYield = safeDiv(windowBoundCompletions, windowBoundAttempts);
  const leverage = safeDiv(completionCount, timeSpentHours);

  // ── Improvement estimates ──
  const estimates = [];

  // 1. Duration-based (merged only)
  const estDurationFactor = config.est_duration_factor || 2;
  const durationHrs = (mergedSessionMins / 60) * estDurationFactor;
  estimates.push({
    estimateId: 'duration',
    name: 'Duration-Based (Merged)',
    improvementType: 'time',
    method: 'duration',
    formula: `hours_saved = (merged_session_minutes / 60) × duration_factor(${estDurationFactor})`,
    inputs: { merged_session_minutes: mergedSessionMins, est_duration_factor: estDurationFactor },
    timeSavedHours: durationHrs,
    timeSavedPerDev: safeDiv(durationHrs, avgActiveDevs * n),
    completionGain: null,
    yieldGain: null,
  });

  // 2. LoC-based (merged only)
  const estHrsPerKloc = config.est_hrs_per_kloc || 2;
  const locHrs = (mergedLocAdded / 1000) * estHrsPerKloc;
  estimates.push({
    estimateId: 'loc',
    name: 'LoC-Based (Merged)',
    improvementType: 'time',
    method: 'loc',
    formula: `hours_saved = (merged_loc_added / 1000) × ${estHrsPerKloc}`,
    inputs: { merged_loc_added: mergedLocAdded, est_hrs_per_kloc: estHrsPerKloc },
    timeSavedHours: locHrs,
    timeSavedPerDev: safeDiv(locHrs, avgActiveDevs * n),
    completionGain: null,
    yieldGain: null,
  });

  const selectedEstimate = (selections?.estimateId
    ? estimates.find(e => e.estimateId === selections.estimateId)
    : null) || estimates[0];
  const timeSavedHours = selectedEstimate?.timeSavedHours || 0;

  // ── Projected improvements ──
  const projections = [];

  // 1. Adoption → 100%
  if (adoptionPct != null && adoptionPct > 0 && adoptionPct < 1) {
    const scaleFactor = 1 / adoptionPct;
    projections.push({
      projectionId: 'adoption',
      name: 'Full Developer Adoption',
      improvementType: 'mixed',
      structuralFactor: 'adoption',
      currentValue: adoptionPct,
      targetValue: 1.0,
      formula: `scale = 1 / adoption(${(adoptionPct*100).toFixed(1)}%) = ${scaleFactor.toFixed(1)}× → saved × ${scaleFactor.toFixed(1)}, completions × ${scaleFactor.toFixed(1)}`,
      projTimeSavedHours: Math.round(timeSavedHours * scaleFactor),
      projCompletionGain: Math.round(completionCount * (scaleFactor - 1)),
      projYield: currentYield,
    });
  }

  // 2. Merge rate → 100%
  if (mergeRate != null && mergeRate > 0 && mergeRate < 1) {
    const estDurationFactor = config.est_duration_factor || 2;
    const projTimeSaved = estDurationFactor * timeSpentHours * (1 - (currentYield || 0));
    projections.push({
      projectionId: 'merge_rate',
      name: 'Full Merge Rate',
      improvementType: 'completion',
      structuralFactor: 'merge_rate',
      currentValue: mergeRate,
      targetValue: 1.0,
      formula: `proj_saved = duration_factor(${estDurationFactor}) × time_spent(${Math.round(timeSpentHours)}h) × (1 - yield(${currentYield != null ? (currentYield*100).toFixed(1) : '0'}%))`,
      projTimeSavedHours: Math.round(projTimeSaved),
      projCompletionGain: attempts - completionCount,
      projYield: 1.0,
    });
  }

  // 3. Repo coverage → 100%
  if (repoCoverage != null && repoCoverage > 0 && repoCoverage < 1) {
    const scaleFactor = 1 / repoCoverage;
    projections.push({
      projectionId: 'repo_coverage',
      name: 'Full Repo Coverage',
      improvementType: 'mixed',
      structuralFactor: 'repo_coverage',
      currentValue: repoCoverage,
      targetValue: 1.0,
      formula: `scale = 1 / coverage(${(repoCoverage*100).toFixed(1)}%) = ${scaleFactor.toFixed(1)}× → saved × ${scaleFactor.toFixed(1)}, completions × ${scaleFactor.toFixed(1)}`,
      projTimeSavedHours: Math.round(timeSavedHours * scaleFactor),
      projCompletionGain: Math.round(completionCount * (scaleFactor - 1)),
      projYield: currentYield,
    });
  }

  const selectedProjection = (selections?.projectionId
    ? projections.find(p => p.projectionId === selections.projectionId)
    : null) || projections[0] || null;

  return {
    elementKey: 'agentic-ai-coding',
    row: {
      area: 'Agentic AI Coding',
      attemptType,
      attempts,
      completionType,
      completionCount,
      wipPlus,
      wipMinus,
      wipDelta,
      timeSpentHours: Math.round(timeSpentHours),
      timeSavedHours: Math.round(timeSavedHours),
      currentYield,
      leverage,
      projTimeSavedHours: selectedProjection ? Math.round(selectedProjection.projTimeSavedHours) : null,
      projCompletionGain: selectedProjection?.projCompletionGain ?? null,
      projYield: selectedProjection?.projYield ?? null,
      modeNote: selectedProjection?.name || 'no projection available',
    },
    worksheet: {
      definitions: {
        attempt: 'Agent PR session started (issue assignment or PR follow-up)',
        failure: 'PR closed without merge (excludes idle/open sessions)',
        completion: 'PR merged',
        yield: 'Window-bound completions / window-bound attempts',
      },
      timeWindow: { label: `Previous ${defaultWindowDays} Days`, days: defaultWindowDays },
      dateRange,
      factSummary: {
        completionCount,
        completionType,
        attempts,
        attemptType,
        wipPlus,
        wipMinus,
        wipDelta,
        timeSpentHours: Math.round(timeSpentHours),
        timeSpentBasis,
        hasSessionLogs,
        computeSessionCount: hasSessionLogs ? computeSessionCount : null,
        currentYield,
        leverage,
        totalDevs,
        activeDevs: Math.round(avgActiveDevs),
        adoptionPct,
        totalSessions,
        totalPRsCreated,
        totalPRsMerged,
        mergeRate,
        totalSessionMinutes: totalSessionMins,
        mergedSessionMinutes: mergedSessionMins,
        mergedLocAdded,
        activeRepos,
        repoCoverage,
      },
      improvementEstimates: estimates,
      projectedImprovements: projections,
      selection: {
        selectedEstimateId: selectedEstimate?.estimateId || null,
        selectedProjectionId: selectedProjection?.projectionId || null,
        modeNote: selectedProjection?.name || 'no projection available',
      },
    },
  };
}

/**
 * Materialize the leverage-summary artifact.
 *
 * @param {Object} artifacts - { aiEfficiency, aiStructural, agenticEfficiency, agenticSessions }
 * @param {Object} [config] - Config overrides (merged with defaults). May include leverage selections:
 *   - leverage_ai_estimate: estimateId to select for AI-Assisted (default: first)
 *   - leverage_ai_projection: projectionId to select for AI-Assisted (default: first)
 *   - leverage_agentic_estimate: estimateId for Agentic (default: first)
 *   - leverage_agentic_projection: projectionId for Agentic (default: first)
 * @param {Object} [options] - { inputFiles }
 * @returns {{ artifact, elements }}
 */
export function materializeLeverageSummary(artifacts, config = {}, options = {}) {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const defaults = getAllDefaults();
  const mergedConfig = { ...defaults, cfg_hrs_per_dev_per_day: 8, ...config };

  // Leverage selections (which estimate/projection drives each element's row)
  const selections = {
    ai: {
      estimateId: mergedConfig.leverage_ai_estimate || null,
      projectionId: mergedConfig.leverage_ai_projection || null,
    },
    agentic: {
      estimateId: mergedConfig.leverage_agentic_estimate || null,
      projectionId: mergedConfig.leverage_agentic_projection || null,
    },
  };

  const elements = [];

  const aiElement = buildAiAssistedElement(
    artifacts.aiEfficiency,
    artifacts.aiStructural,
    mergedConfig,
    selections.ai,
  );
  if (aiElement) elements.push(aiElement);

  const agElement = buildAgenticElement(
    artifacts.agenticEfficiency,
    artifacts.agenticSessions,
    mergedConfig,
    selections.agentic,
    artifacts.sessionLogs,
  );
  if (agElement) elements.push(agElement);

  // Compute integrated totals for the profile
  const totalTimeSaved = elements.reduce((s, e) => s + (e.row.timeSavedHours || 0), 0);
  const totalCompletions = elements.reduce((s, e) => s + (e.row.completionCount || 0), 0);
  const totalTimeSpent = elements.reduce((s, e) => s + (e.row.timeSpentHours || 0), 0);

  // Window from all elements
  const allDays = elements.flatMap(e => [e.worksheet.factSummary.windowFirst, e.worksheet.factSummary.windowLast]).filter(Boolean).sort();
  const window = allDays.length > 0
    ? { first: allDays[0], last: allDays[allDays.length - 1] }
    : { first: null, last: null };

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;

  return {
    artifact: {
      stage: 'materialized',
      name: 'leverage-summary',
      version: '1.0.0',
      computed_at: new Date().toISOString(),
      compute_ms: Math.round(elapsed),
      inputs: (options.inputFiles || []).map(f => ({
        file: f.file,
        hash: f.hash || null,
      })),
      profile: {
        element_count: elements.length,
        total_time_saved_hours: Math.round(totalTimeSaved),
        total_completions: totalCompletions,
        total_time_spent_hours: Math.round(totalTimeSpent),
        integrated_leverage: safeDiv(totalCompletions, totalTimeSpent),
        date_range: window,
        config_used: {
          cfg_total_developers: mergedConfig.cfg_total_developers,
          cfg_pct_time_coding: mergedConfig.cfg_pct_time_coding,
          cfg_hrs_per_dev_per_day: mergedConfig.cfg_hrs_per_dev_per_day,
          cfg_labor_cost_per_hour: mergedConfig.cfg_labor_cost_per_hour,
          cfg_total_repos: mergedConfig.cfg_total_repos,
          est_interactions_per_hour: mergedConfig.est_interactions_per_hour,
          est_hrs_per_kloc: mergedConfig.est_hrs_per_kloc,
          est_duration_factor: mergedConfig.est_duration_factor,
        },
        selections_used: selections,
      },
    },
    elements,
  };
}
