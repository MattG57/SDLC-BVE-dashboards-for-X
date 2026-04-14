/**
 * Materializer: ai-assisted-structural-days
 *
 * Produces the structural-days artifact from Copilot metrics + PR review data.
 * This artifact feeds: AI-Assisted Structural, AI-Assisted Element, Integrated.
 *
 * Pipeline: copilot-metrics → flatten + dedup
 *           human-pr-metrics → flatten + dedup + bot-filter
 *           user-days → buildCopilotUsersByDay
 *           PRs × copilot-users → classifyAssisted (3-day lookback)
 *           enterprise × PR classification → structural day rows
 */

import {
  flattenDayTotal, flattenUserReport,
  dedupEnterpriseDays, dedupUserDays,
} from '../sources/copilot-metrics.js';

import {
  flattenPrRecord, dedupAndFilterPrs, classifyAssisted,
  buildCopilotUsersByDay, extractPrArray,
} from '../sources/pr-review.js';

import { safeDiv, dayOffset } from '../core/math.js';

/**
 * Materialize the ai-assisted-structural-days artifact.
 *
 * @param {Object} copilotData - Parsed JSON with enterprise_report and/or user_report
 * @param {Object|Array|null} prData - PR review data (array, { prs }, or { pull_requests: { prs } })
 * @param {Object} config - Must include cfg_total_developers, cfg_pr_assist_lookback_days
 * @param {Object} [options] - { inputFiles: [{ file, hash }] }
 * @returns {{ artifact, data, _prRecords, _prPeriod, _periodPrsAssistedPct, _periodLocAssistedPct }}
 */
export function materializeAiAssistedStructuralDays(copilotData, prData, config, options = {}) {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const totalDevs = config.cfg_total_developers || 100;
  const lookbackDays = config.cfg_pr_assist_lookback_days ?? 3;

  // Flatten + dedup enterprise days
  const rawEntDays = (copilotData.enterprise_report?.day_totals || []).map(flattenDayTotal);
  const entResult = dedupEnterpriseDays(rawEntDays);

  // Flatten + dedup user-day records
  const rawUserDays = Array.isArray(copilotData.user_report)
    ? flattenUserReport(copilotData.user_report)
    : [];
  const userResult = dedupUserDays(rawUserDays);

  // Build copilot-users-by-day map
  const copilotUsersByDay = buildCopilotUsersByDay(userResult.data);

  // Flatten + dedup + bot-filter PR records
  let prRecords = null;
  let prProfile = null;
  let hasPrData = false;
  if (prData) {
    const rawPrs = extractPrArray(prData).map(flattenPrRecord);
    const prResult = dedupAndFilterPrs(rawPrs);
    prRecords = prResult.data;
    prProfile = prResult.profile;
    hasPrData = prRecords.length > 0;
  }

  // Classify PRs as assisted
  const classified = hasPrData
    ? classifyAssisted(prRecords, copilotUsersByDay, { lookbackDays })
    : { byDay: {}, period: { total_prs: 0, assisted_prs: 0, total_loc: 0, assisted_loc: 0 }, profile: {} };

  // Build user-by-day lookup for adoption calculation
  const usersByDay = {};
  for (const u of userResult.data) {
    (usersByDay[u.day] = usersByDay[u.day] || []).push(u);
  }

  // Compute structural metrics per enterprise day
  const data = entResult.data.map(d => {
    const dayUsers = usersByDay[d.day] || [];
    const uniqueActiveUsers = dayUsers.length > 0
      ? new Set(dayUsers.filter(u =>
          (u.code_generation_activity_count || 0) > 0 ||
          (u.user_initiated_interaction_count || 0) > 0
        ).map(u => u.user_login)).size
      : (d.daily_active_users || 0);

    // 4-day lookback union for adopted users
    const adoptedUsers = new Set();
    for (let i = 0; i <= 3; i++) {
      const checkUsers = copilotUsersByDay[dayOffset(d.day, -i)];
      if (checkUsers) checkUsers.forEach(login => adoptedUsers.add(login));
    }
    const adoptedCount = adoptedUsers.size > 0 ? adoptedUsers.size : (d.daily_active_users || 0);

    const prDay = classified.byDay[d.day] || { total_prs: 0, assisted_prs: 0, total_loc: 0, assisted_loc: 0 };

    const adopted_individuals_pct = safeDiv(adoptedCount, totalDevs);
    const prs_assisted_pct = hasPrData
      ? (prDay.total_prs > 0 ? safeDiv(prDay.assisted_prs, prDay.total_prs) : null)
      : null;
    const ai_assisted_loc_pct = hasPrData
      ? (prDay.total_loc > 0 ? safeDiv(prDay.assisted_loc, prDay.total_loc) : null)
      : null;

    const total_prs = hasPrData ? prDay.total_prs : (d.pr_total_created || 0);
    const total_loc = hasPrData ? prDay.total_loc : ((d.loc_added_sum || 0) + (d.loc_deleted_sum || 0));

    return {
      ...d,
      adopted_individuals_pct,
      prs_assisted_pct,
      ai_assisted_loc_pct,
      prs_per_day: total_prs,
      loc_per_day: total_loc,
      total_prs,
      total_loc,
      assisted_prs: hasPrData ? prDay.assisted_prs : 0,
      assisted_loc: hasPrData ? prDay.assisted_loc : (d.loc_added_sum || 0),
      unique_active_users: uniqueActiveUsers,
      has_pr_data: hasPrData,
    };
  });

  // Period aggregates
  const periodPrsAssistedPct = hasPrData
    ? safeDiv(classified.period.assisted_prs, classified.period.total_prs)
    : null;
  const periodLocAssistedPct = hasPrData
    ? safeDiv(classified.period.assisted_loc, classified.period.total_loc)
    : null;

  // Date range
  const days = data.map(d => d.day).sort();
  const dateRange = days.length > 0
    ? { first: days[0], last: days[days.length - 1], days_with_data: days.length }
    : { first: null, last: null, days_with_data: 0 };

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;

  return {
    artifact: {
      stage: 'materialized',
      name: 'ai-assisted-structural-days',
      version: '1.0.0',
      computed_at: new Date().toISOString(),
      compute_ms: Math.round(elapsed),
      inputs: (options.inputFiles || []).map(f => ({
        file: f.file,
        hash: f.hash || null,
        metadata: f.metadata || null,
      })),
      profile: {
        record_count: data.length,
        date_range: dateRange,
        enterprise_dedup: entResult.profile,
        user_dedup: userResult.profile,
        pr_processing: prProfile,
        pr_classification: classified.profile,
        has_pr_data: hasPrData,
        period_prs_assisted_pct: periodPrsAssistedPct,
        period_loc_assisted_pct: periodLocAssistedPct,
      },
    },
    data,
    _prRecords: prRecords,
    _prPeriod: classified.period,
    _periodPrsAssistedPct: periodPrsAssistedPct,
    _periodLocAssistedPct: periodLocAssistedPct,
    _copilotUsersByDay: copilotUsersByDay,
  };
}
