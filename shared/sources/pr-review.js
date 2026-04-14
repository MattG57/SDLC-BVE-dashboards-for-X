/**
 * PR review source processing — flatten, dedup, bot-filter, classify.
 *
 * Handles PR data from human-pr-metrics query script and inline
 * PR arrays from various dashboard upload formats.
 */

import { dayOffset } from '../core/math.js';

/**
 * Bot login detection patterns.
 * A login matching any pattern is excluded from PR analysis.
 */
export const BOT_PATTERNS = [
  /\[bot\]$/i,
  /-bot$/i,
  /-agent$/i,
  /^dependabot$/i,
  /^github-actions$/i,
  /^renovate$/i,
  /^automation/i,
  /^ci-/i,
  /^service-/i,
  /^deploy-/i,
  /^od-octodemo-/i,
];

/**
 * Check if a login matches any bot pattern.
 */
export function isBot(login) {
  if (!login || typeof login !== 'string') return true;
  return BOT_PATTERNS.some(p => p.test(login));
}

/**
 * Flatten a single PR record into a normalized shape.
 */
export function flattenPrRecord(pr) {
  return {
    number: pr.number,
    user: typeof pr.user === 'string' ? pr.user : (pr.user?.login || pr.author || pr.user),
    day: pr.merged_at?.slice(0, 10) || pr.created_at?.slice(0, 10) || pr.day,
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    state: pr.state || 'unknown',
    merged: pr.merged || pr.state === 'merged' || !!pr.merged_at,
    repository: typeof pr.repository === 'string'
      ? pr.repository
      : (pr.repository?.nameWithOwner || pr.repo || ''),
    closed_at: pr.closed_at || null,
    merged_at: pr.merged_at || null,
  };
}

/**
 * Deduplicate PR records by repository#number. Filters out bots.
 * Returns { data, profile }.
 */
export function dedupAndFilterPrs(prs) {
  const beforeDedup = prs.length;
  const seen = {};
  const deduped = prs.filter(p => {
    const key = (p.repository || '') + '#' + (p.number || '');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  const afterDedup = deduped.length;
  const filtered = deduped.filter(p => !isBot(p.user));
  const afterFilter = filtered.length;

  return {
    data: filtered,
    profile: {
      before_dedup: beforeDedup,
      after_dedup: afterDedup,
      duplicates_removed: beforeDedup - afterDedup,
      dedup_key: 'repository#number',
      bots_removed: afterDedup - afterFilter,
      after_filter: afterFilter,
      bot_patterns: BOT_PATTERNS.map(p => p.source),
    },
  };
}

/**
 * Classify PRs as "assisted" using a lookback window.
 *
 * A PR is "assisted" if its author appears in the Copilot active user
 * set on the PR's merge/creation day or within `lookbackDays` prior days.
 *
 * @param {Object[]} prRecords - Flattened, deduped, filtered PR records
 * @param {Object} copilotUsersByDay - Map of day → Set of active Copilot logins
 * @param {Object} options - { lookbackDays: 3 }
 * @returns {{ byDay, period, profile }}
 */
export function classifyAssisted(prRecords, copilotUsersByDay, options = {}) {
  const lookbackDays = options.lookbackDays ?? 3;

  const byDay = {};
  const period = { total_prs: 0, assisted_prs: 0, total_loc: 0, assisted_loc: 0 };

  for (const pr of prRecords) {
    if (!pr.day || !pr.merged) continue;

    if (!byDay[pr.day]) {
      byDay[pr.day] = { total_prs: 0, assisted_prs: 0, total_loc: 0, assisted_loc: 0 };
    }

    const loc = (pr.additions || 0) + (pr.deletions || 0);
    byDay[pr.day].total_prs++;
    byDay[pr.day].total_loc += loc;
    period.total_prs++;
    period.total_loc += loc;

    let assisted = false;
    for (let i = 0; i < lookbackDays; i++) {
      const checkDay = dayOffset(pr.day, -i);
      const users = copilotUsersByDay[checkDay];
      if (users && users.has(pr.user)) {
        assisted = true;
        break;
      }
    }

    if (assisted) {
      byDay[pr.day].assisted_prs++;
      byDay[pr.day].assisted_loc += loc;
      period.assisted_prs++;
      period.assisted_loc += loc;
    }
  }

  const uniqueAuthors = new Set(prRecords.filter(p => p.merged).map(p => p.user)).size;
  const allCopilotUsers = new Set();
  for (const users of Object.values(copilotUsersByDay)) {
    for (const u of users) allCopilotUsers.add(u);
  }

  return {
    byDay,
    period,
    profile: {
      lookback_days: lookbackDays,
      total_merged_prs: period.total_prs,
      assisted_prs: period.assisted_prs,
      unassisted_prs: period.total_prs - period.assisted_prs,
      unique_pr_authors: uniqueAuthors,
      unique_copilot_users: allCopilotUsers.size,
    },
  };
}

/**
 * Build a copilot-users-by-day map from user-day records.
 * A user is "Copilot active" if they have code_generation > 0 or interaction > 0.
 */
export function buildCopilotUsersByDay(userDays) {
  const map = {};
  for (const u of userDays) {
    if ((u.code_generation_activity_count || 0) > 0 ||
        (u.user_initiated_interaction_count || 0) > 0) {
      if (!map[u.day]) map[u.day] = new Set();
      map[u.day].add(u.user_login);
    }
  }
  return map;
}

/**
 * Detect if a parsed JSON object is PR review data.
 */
export function isPrReviewData(obj) {
  if (Array.isArray(obj)) return true;
  if (obj && Array.isArray(obj.prs)) return true;
  if (obj && obj.pull_requests && Array.isArray(obj.pull_requests.prs)) return true;
  return false;
}

/**
 * Extract PR array from various formats.
 */
export function extractPrArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (Array.isArray(obj?.prs)) return obj.prs;
  if (Array.isArray(obj?.pull_requests?.prs)) return obj.pull_requests.prs;
  return [];
}
