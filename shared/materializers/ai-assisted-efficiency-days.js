/**
 * Materializer: ai-assisted-efficiency-days
 *
 * Produces the efficiency-days artifact from raw Copilot metrics.
 * This artifact feeds: AI-Assisted Efficiency, AI-Assisted Element, Integrated.
 *
 * Pipeline: raw copilot-metrics → flattenDayTotal → dedup → computeDayRatios
 *           raw copilot-metrics → flattenUserReport → dedup
 *           enterprise × users → reconciliation
 */

import {
  flattenDayTotal, flattenUserReport,
  dedupEnterpriseDays, dedupUserDays,
  computeDayRatios, computeReconciliation,
  isCopilotMetricsSource,
} from '../sources/copilot-metrics.js';

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

  // Reconciliation
  const recon = computeReconciliation(entResult.data, userResult.data);

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
      version: '1.0.0',
      computed_at: new Date().toISOString(),
      compute_ms: Math.round(elapsed),
      inputs: options.inputFile ? [{
        file: options.inputFile,
        hash: options.inputHash || null,
        metadata: rawData.metadata || null,
      }] : [],
      profile: {
        record_count: data.length,
        date_range: dateRange,
        enterprise_dedup: entResult.profile,
        user_dedup: userResult.profile,
        reconciliation_summary: summarizeRecon(recon),
      },
    },
    data,
    _users: userResult.data,
    _recon: recon,
  };
}

function summarizeRecon(recon) {
  const counts = { match: 0, minor_difference: 0, material_difference: 0, missing_user_data: 0 };
  for (const r of recon) counts[r.status] = (counts[r.status] || 0) + 1;
  return counts;
}
