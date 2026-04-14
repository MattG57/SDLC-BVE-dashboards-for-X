/**
 * Materializer: agentic-pr-sessions
 *
 * Produces the pr-sessions artifact from raw agentic coding metrics.
 * This artifact feeds: Agentic Efficiency (Confidence), Agentic Element (Leverage), Integrated.
 *
 * Pipeline: raw coding-agent-pr-metrics → flattenPrSession → dedupSessions
 */

import {
  flattenPrSession, dedupSessions,
} from '../sources/agentic.js';

/**
 * Materialize the agentic-pr-sessions artifact.
 *
 * @param {Object} rawData - Parsed JSON with pr_sessions
 * @param {Object} [options] - { inputFile, inputHash }
 * @returns {{ artifact, data }}
 */
export function materializeAgenticPrSessions(rawData, options = {}) {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Flatten PR sessions
  const rawSessions = (rawData.pr_sessions || []).map(flattenPrSession);
  const sessResult = dedupSessions(rawSessions);
  const data = sessResult.data;

  // Status breakdown
  const merged = data.filter(s => s.merged).length;
  const open = data.filter(s => !s.merged && (s.state === 'open' || s.state === 'Open')).length;
  const closedNoMerge = data.filter(s => !s.merged && (s.state === 'closed' || s.state === 'CLOSED' || s.state === 'Closed')).length;
  const withDuration = data.filter(s => s.duration_minutes != null).length;

  // Unique entities
  const uniqueRepos = new Set(data.map(s => s.repo).filter(Boolean)).size;
  const uniqueAuthors = new Set(data.map(s => s.author).filter(Boolean)).size;

  // Date range
  const dates = data.map(s => s.day).filter(Boolean).sort();
  const dateRange = dates.length > 0
    ? { first: dates[0], last: dates[dates.length - 1] }
    : { first: null, last: null };

  // LoC summary
  const totalAdditions = data.reduce((s, pr) => s + (pr.additions || 0), 0);
  const totalDeletions = data.reduce((s, pr) => s + (pr.deletions || 0), 0);

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;

  return {
    artifact: {
      stage: 'materialized',
      name: 'agentic-pr-sessions',
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
        session_dedup: sessResult.profile,
        status_breakdown: {
          merged,
          open,
          closed_no_merge: closedNoMerge,
          other: data.length - merged - open - closedNoMerge,
        },
        with_duration: withDuration,
        without_duration: data.length - withDuration,
        unique_repos: uniqueRepos,
        unique_authors: uniqueAuthors,
        loc_summary: {
          total_additions: totalAdditions,
          total_deletions: totalDeletions,
        },
      },
    },
    data,
  };
}
