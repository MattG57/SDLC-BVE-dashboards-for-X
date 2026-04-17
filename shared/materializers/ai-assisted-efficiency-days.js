/**
 * Materializer: ai-assisted-efficiency-days
 *
 * Produces the efficiency-days artifact from raw Copilot metrics.
 * This artifact feeds: AI-Assisted Efficiency, AI-Assisted Element, Integrated.
 *
 * Pipeline: raw copilot-metrics → flattenDayTotal → dedup → computeDayRatios
 *           raw copilot-metrics → flattenUserReport → dedup → slimUserRecord
 */

import {
  flattenDayTotal, flattenUserReport,
  dedupEnterpriseDays, dedupUserDays,
  computeDayRatios,
  isCopilotMetricsSource,
} from '../sources/copilot-metrics.js';

// Fields kept on each user record for dashboard overlays.
// Drops totals_by_ide/feature/language_*/model_* (30MB of nested arrays).
const USER_OVERLAY_FIELDS = [
  'day', 'user_login', 'user_id',
  'user_initiated_interaction_count',
  'code_generation_activity_count', 'code_acceptance_activity_count',
  'loc_suggested_to_add_sum', 'loc_suggested_to_delete_sum',
  'loc_added_sum', 'loc_deleted_sum',
  'used_agent', 'used_chat', 'used_cli', 'used_copilot_coding_agent',
];

function slimUserRecord(u) {
  const slim = {};
  for (const k of USER_OVERLAY_FIELDS) {
    if (k in u) slim[k] = u[k];
  }
  return slim;
}

/**
 * Materialize the ai-assisted-efficiency-days artifact.
 *
 * @param {Object} rawData - Parsed JSON with enterprise_report and/or user_report
 * @param {Object} [options] - { inputFile, inputHash }
 * @returns {{ artifact, data, _users, _recon }}
 */
export function materializeAiAssistedEfficiencyDays(rawData, options = {}) {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Flatten enterprise day totals
  const rawEntDays = (rawData.enterprise_report?.day_totals || []).map(flattenDayTotal);
  const entResult = dedupEnterpriseDays(rawEntDays);

  // Flatten user-day records
  const rawUserDays = Array.isArray(rawData.user_report)
    ? flattenUserReport(rawData.user_report)
    : [];
  const userResult = dedupUserDays(rawUserDays);

  // Add per-dev ratios to each enterprise day
  const data = entResult.data.map(d => ({
    ...d,
    ...computeDayRatios(d),
  }));

  // Slim user records for overlay (drops ~30MB of nested totals_by_* arrays)
  const slimUsers = userResult.data.map(slimUserRecord);

  // Date range
  const days = data.map(d => d.day).sort();
  const dateRange = days.length > 0
    ? { first: days[0], last: days[days.length - 1], days_with_data: days.length }
    : { first: null, last: null, days_with_data: 0 };

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;

  return {
    artifact: {
      stage: 'materialized',
      name: 'ai-assisted-efficiency-days',
      version: '1.1.0',
      computed_at: new Date().toISOString(),
      compute_ms: Math.round(elapsed),
      inputs: (options.inputFiles || (options.inputFile ? [{
        file: options.inputFile,
        hash: options.inputHash || null,
        metadata: rawData.metadata || null,
      }] : [])).map(f => ({
        file: f.file,
        hash: f.hash || null,
        metadata: f.metadata || rawData.metadata || null,
      })),
      profile: {
        record_count: data.length,
        detail_row_count: slimUsers.length,
        detail_label: 'user-days',
        unique_people: userResult.profile.unique_logins || 0,
        people_label: 'users',
        unique_repos: null,
        date_range: dateRange,
        enterprise_dedup: entResult.profile,
        user_dedup: userResult.profile,
      },
    },
    data,
    _users: slimUsers,
  };
}
