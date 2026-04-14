/**
 * Materializer: agentic-efficiency-days
 *
 * Produces the efficiency-days artifact from raw agentic coding metrics.
 * This artifact feeds: Agentic Efficiency, Agentic Element, Integrated.
 *
 * Pipeline: raw coding-agent-pr-metrics → flattenDevDay → dedup → aggregateToDay
 */

import {
  flattenDevDay, dedupDevDays, aggregateToDay,
} from '../sources/agentic.js';

/**
 * Materialize the agentic-efficiency-days artifact.
 *
 * @param {Object} rawData - Parsed JSON with developer_day_summary
 * @param {Object} [options] - { inputFile, inputHash }
 * @returns {{ artifact, data, _devDays }}
 */
export function materializeAgenticEfficiencyDays(rawData, options = {}) {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Flatten dev-day records
  const rawDevDays = (rawData.developer_day_summary || []).map(flattenDevDay);
  const ddResult = dedupDevDays(rawDevDays);

  // Aggregate to day level with per-dev ratios
  const data = aggregateToDay(ddResult.data);

  // Date range
  const days = data.map(d => d.day).sort();
  const dateRange = days.length > 0
    ? { first: days[0], last: days[days.length - 1], days_with_data: days.length }
    : { first: null, last: null, days_with_data: 0 };

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;

  return {
    artifact: {
      stage: 'materialized',
      name: 'agentic-efficiency-days',
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
        devday_dedup: ddResult.profile,
        aggregation: {
          devday_rows: ddResult.data.length,
          day_rows: data.length,
        },
      },
    },
    data,
    _devDays: ddResult.data,
  };
}
