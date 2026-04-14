/**
 * Agentic source processing — flatten, dedup, aggregate.
 *
 * Handles pr_sessions, developer_day_summary, and requests data
 * from the coding-agent-pr-metrics query script.
 */

import { safeDiv } from '../core/math.js';

/**
 * Flatten a single PR session record into a normalized shape.
 */
export function flattenPrSession(pr) {
  return {
    repo: pr.repo || '',
    pr_number: pr.pr_number,
    pr_url: pr.pr_url || '',
    pr_title: pr.pr_title || '',
    day: pr.pr_merged_at?.slice(0, 10) || pr.pr_created_at?.slice(0, 10) || '',
    created_at: pr.pr_created_at,
    closed_at: pr.pr_closed_at,
    merged_at: pr.pr_merged_at,
    state: pr.pr_state || pr.latest_status || 'unknown',
    merged: !!pr.pr_merged_at || pr.latest_status === 'Merged',
    draft: pr.pr_draft || false,
    author: pr.pr_author_login || '',
    merged_by: pr.merged_by || null,
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    changed_files: pr.changed_files || 0,
    duration_minutes: pr.duration_minutes,
    changes_requested_count: pr.changes_requested_count || 0,
    reopened_count: pr.reopened_count || 0,
    additional_guidance_count: pr.additional_guidance_count || 0,
    origin_request_type: pr.origin_request_type || null,
    origin_requested_by: pr.origin_requested_by || null,
    origin_requested_at: pr.origin_requested_at || null,
  };
}

/**
 * Flatten a single developer_day_summary record.
 */
export function flattenDevDay(dd) {
  return {
    day: dd.date || dd.day,
    developer: dd.developer || dd.user_login || '',
    issue_assignment_requests: dd.issue_assignment_requests || 0,
    pr_followup_requests: dd.pr_followup_requests || 0,
    total_agent_requests: dd.total_agent_requests || 0,
    sessions_started: dd.sessions_started || 0,
    agent_prs_created: dd.agent_prs_created || 0,
    agent_prs_merged: dd.agent_prs_merged || 0,
    agent_loc_added: dd.agent_loc_added || 0,
    agent_loc_deleted: dd.agent_loc_deleted || 0,
    agent_session_minutes: dd.agent_session_minutes || 0,
    changes_requested_total: dd.changes_requested_total || 0,
    median_merge_minutes: dd.median_merge_minutes,
  };
}

/**
 * Deduplicate PR sessions by repo#pr_number.
 * Returns { data, profile }.
 */
export function dedupSessions(sessions) {
  const before = sessions.length;
  const seen = {};
  const data = sessions.filter(s => {
    const key = (s.repo || '') + '#' + (s.pr_number || '');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  return {
    data,
    profile: {
      before,
      after: data.length,
      removed: before - data.length,
      key: 'repo#pr_number',
    },
  };
}

/**
 * Deduplicate request records by composite key.
 * Returns { data, profile }.
 */
export function dedupRequests(requests) {
  const before = requests.length;
  const seen = {};
  const data = requests.filter(r => {
    const key = [
      r.request_type || '',
      r.repo || '',
      r.issue_number || '',
      r.pr_number || '',
      r.requested_at || '',
    ].join('|');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  return {
    data,
    profile: {
      before,
      after: data.length,
      removed: before - data.length,
      key: 'request_type|repo|issue_number|pr_number|requested_at',
    },
  };
}

/**
 * Deduplicate developer-day records by day|developer. Last entry wins.
 * Returns { data, profile }.
 */
export function dedupDevDays(devDays) {
  const before = devDays.length;
  const map = {};
  for (const dd of devDays) {
    map[dd.day + '|' + dd.developer] = dd;
  }
  const data = Object.values(map);
  return {
    data,
    profile: {
      before,
      after: data.length,
      removed: before - data.length,
      key: 'day|developer',
      unique_developers: new Set(data.map(d => d.developer)).size,
    },
  };
}

/**
 * Aggregate developer-day records to day-level rows with per-dev ratios.
 * Returns sorted day-level rows.
 */
export function aggregateToDay(devDays) {
  const byDay = {};
  for (const dd of devDays) {
    if (!byDay[dd.day]) {
      byDay[dd.day] = {
        day: dd.day,
        total_agent_requests: 0, sessions_started: 0,
        agent_prs_created: 0, agent_prs_merged: 0,
        agent_loc_added: 0, agent_loc_deleted: 0,
        agent_session_minutes: 0, changes_requested_total: 0,
        merge_minutes_list: [], dev_set: new Set(),
      };
    }
    const d = byDay[dd.day];
    d.dev_set.add(dd.developer);
    d.total_agent_requests += dd.total_agent_requests;
    d.sessions_started += dd.sessions_started;
    d.agent_prs_created += dd.agent_prs_created;
    d.agent_prs_merged += dd.agent_prs_merged;
    d.agent_loc_added += dd.agent_loc_added;
    d.agent_loc_deleted += dd.agent_loc_deleted;
    d.agent_session_minutes += dd.agent_session_minutes;
    d.changes_requested_total += dd.changes_requested_total;
    if (dd.median_merge_minutes != null) d.merge_minutes_list.push(dd.median_merge_minutes);
  }

  return Object.values(byDay).map(d => {
    const activeDevs = d.dev_set.size;
    return {
      day: d.day,
      active_devs: activeDevs,
      total_agent_requests: d.total_agent_requests,
      sessions_started: d.sessions_started,
      agent_prs_created: d.agent_prs_created,
      agent_prs_merged: d.agent_prs_merged,
      agent_loc_added: d.agent_loc_added,
      agent_loc_deleted: d.agent_loc_deleted,
      agent_session_minutes: d.agent_session_minutes,
      changes_requested_total: d.changes_requested_total,
      median_merge_minutes: d.merge_minutes_list.length > 0
        ? d.merge_minutes_list.sort((a, b) => a - b)[Math.floor(d.merge_minutes_list.length / 2)]
        : null,
      requests_per_dev: safeDiv(d.total_agent_requests, activeDevs),
      sessions_per_dev: safeDiv(d.sessions_started, activeDevs),
      prs_created_per_dev: safeDiv(d.agent_prs_created, activeDevs),
      prs_merged_per_dev: safeDiv(d.agent_prs_merged, activeDevs),
      loc_added_per_dev: safeDiv(d.agent_loc_added / 100, activeDevs),
      session_mins_per_dev: safeDiv(d.agent_session_minutes, activeDevs),
      merge_rate: safeDiv(d.agent_prs_merged, d.agent_prs_created),
    };
  }).sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Detect if a parsed JSON object is an agentic source file.
 */
export function isAgenticSource(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return !!(obj.pr_sessions || obj.requests || obj.developer_day_summary);
}
