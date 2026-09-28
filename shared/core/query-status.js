/**
 * Builds query-status.json — the record of the last data collection run that
 * the data-status dashboard renders as "Last Collection Run".
 *
 * Written by scripts/collect-and-materialize.sh (via scripts/write-query-status.js)
 * to dashboard/dataflow/data/query-status.json and embedded by
 * scripts/build-pages.sh into data-status/data/data-status.json.
 */

export const QUERY_STATUS_SCHEMA_VERSION = 2;
export const QUERY_STATUS_MODES = ['collect', 'session-logs-only', 'materialize-only'];

const COMPACT_TS = /^(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})Z$/;
const WARNING_LINE = /⚠|\bwarn(ing)?\b/i;

/**
 * Normalise a timestamp to ISO-8601 (YYYY-MM-DDTHH:MM:SSZ).
 * Accepts ISO strings and the compact run-id form used in raw filenames
 * (e.g. "2026-09-28T0617Z"), which Date cannot parse.
 * @returns {string|null}
 */
export function normalizeTimestamp(ts) {
  if (!ts || typeof ts !== 'string') return null;
  const m = COMPACT_TS.exec(ts);
  const candidate = m ? `${m[1]}T${m[2]}:${m[3]}:00Z` : ts;
  const d = new Date(candidate);
  return isNaN(d.getTime()) ? null : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Extract warning lines from a collector's stderr output.
 * @param {string} text
 * @param {number} [max=10]
 * @returns {string[]}
 */
export function extractWarnings(text, max = 10) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!WARNING_LINE.test(raw)) continue;
    const line = raw.replace(/^\s*⚠\s*/, '').trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeTarget(t) {
  return {
    target: t.target,
    status: t.status,
    script: t.script ?? null,
    output_file: t.output_file ?? null,
    file_size_bytes: t.file_size_bytes ?? null,
    duration_s: t.duration_s ?? null,
    warnings: Array.isArray(t.warnings) ? t.warnings : [],
    error: t.error ?? null,
    timestamp: normalizeTimestamp(t.timestamp),
  };
}

function mergeTargets(previousTargets, newTargets) {
  const byName = new Map();
  for (const t of previousTargets || []) byName.set(t.target, normalizeTarget(t));
  for (const t of newTargets || []) byName.set(t.target, normalizeTarget(t));
  return [...byName.values()];
}

/**
 * Build the query-status document for this pipeline invocation.
 *
 * - `collect` starts a fresh record from this run's targets.
 * - `session-logs-only` keeps the previous collection record and replaces
 *   only the targets that ran (agent-session-logs).
 * - `materialize-only` keeps the previous collection record unchanged, so a
 *   deploy-only run still reports when data was last collected.
 *
 * @param {object} p
 * @param {object|null} p.previous       Previous query-status.json, if any
 * @param {string} p.mode                One of QUERY_STATUS_MODES
 * @param {string} p.runStarted          This invocation's start time
 * @param {string} p.updatedAt           Time the status is written
 * @param {string|null} p.profile
 * @param {object[]} p.targets           Target results from this invocation
 * @param {object[]} p.rawFiles          Raw file inventory
 */
export function buildQueryStatus({ previous, mode, runStarted, updatedAt, profile, targets, rawFiles }) {
  if (!QUERY_STATUS_MODES.includes(mode)) {
    throw new Error(`Unknown query-status mode: ${mode}`);
  }
  const prev = previous && typeof previous === 'object' ? previous : null;
  const prevHasRun = !!(prev && normalizeTimestamp(prev.run_started));

  let base;
  if (mode === 'collect' || !prevHasRun) {
    const collected = mode !== 'materialize-only';
    base = {
      mode,
      run_started: collected ? normalizeTimestamp(runStarted) : null,
      run_finished: collected ? normalizeTimestamp(updatedAt) : null,
      profile: profile ?? null,
      targets: mergeTargets([], targets),
    };
  } else {
    base = {
      mode: prev.mode ?? 'collect',
      run_started: normalizeTimestamp(prev.run_started),
      run_finished: normalizeTimestamp(prev.run_finished),
      profile: prev.profile ?? null,
      targets: mergeTargets(prev.targets, mode === 'session-logs-only' ? targets : []),
    };
  }

  return {
    schema_version: QUERY_STATUS_SCHEMA_VERSION,
    ...base,
    updated_at: normalizeTimestamp(updatedAt),
    last_invocation: mode,
    raw_files: Array.isArray(rawFiles) ? rawFiles : [],
  };
}
