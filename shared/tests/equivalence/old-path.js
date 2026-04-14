/**
 * Old-path reference implementations extracted from dashboard index.html files.
 *
 * These replicate the exact inline processing that current dashboards use.
 * They serve as the "golden reference" for equivalence testing — the new
 * materializer output must match these results field-by-field.
 *
 * Source: BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/index.html
 * Source: BVE-dashboards-for-ai-assisted-coding/dashboard/element/index.html
 * Source: BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/index.html
 * Source: BVE-dashboards-for-agentic-ai-coding/dashboard/element/index.html
 */

// --- AI-Assisted old path ---

function oldSafeDiv(a, b) { return b > 0 ? a / b : null; }

function oldFlattenDayTotal(dt) {
  const d = { day: dt.date || dt.day };
  for (const [key, val] of Object.entries(dt)) {
    if (key === 'date' || key === 'day') continue;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      for (const [k2, v2] of Object.entries(val)) d[key + '_' + k2] = v2;
    } else if (!Array.isArray(val)) {
      d[key] = val;
    }
  }
  return d;
}

function oldFlattenUserReport(userReport) {
  const records = [];
  for (const user of userReport) {
    if (user.day_totals) {
      for (const dt of user.day_totals)
        records.push({ ...oldFlattenDayTotal(dt), user_login: user.login || user.github_login || user.user_login });
    } else if (user.day || user.date) {
      const login = user.user_login || user.login || user.github_login;
      if (login) records.push({ ...user, day: user.day || user.date, user_login: login });
    }
  }
  return records;
}

export function oldProcessAiAssistedEfficiency(rawData) {
  const entDays = (rawData.enterprise_report?.day_totals || []).map(oldFlattenDayTotal);

  // Dedup by day
  const dayMap = {};
  for (const r of entDays) dayMap[r.day] = r;
  const enterprise = Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day));

  // Dedup user reports
  const rawUsers = Array.isArray(rawData.user_report)
    ? oldFlattenUserReport(rawData.user_report) : [];
  const userMap = {};
  for (const r of rawUsers) userMap[r.day + '|' + r.user_login] = r;
  const users = Object.values(userMap);

  // Add per-dev ratios (from computeDerived, config-independent parts only)
  const data = enterprise.map(d => {
    const dau = d.daily_active_users || 0;
    return {
      ...d,
      interactions_per_active_dev: oldSafeDiv(d.user_initiated_interaction_count, dau),
      generations_per_active_dev: oldSafeDiv(d.code_generation_activity_count, dau),
      acceptances_per_active_dev: oldSafeDiv(d.code_acceptance_activity_count, dau),
      loc10_added_per_active_dev: oldSafeDiv((d.loc_added_sum || 0) / 10, dau),
      agent_mode_per_active_dev: oldSafeDiv(d.agent_mode_interaction_count, dau),
      cli_prompts_per_active_dev: oldSafeDiv(d.cli_prompt_count, dau),
      acceptance_rate: oldSafeDiv(d.code_acceptance_activity_count, d.code_generation_activity_count),
    };
  });

  return { data, users };
}

// --- Agentic old path ---

function oldFlattenDevDay(dd) {
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

function oldComputeDerivedDays(devDays) {
  const byDay = {};
  for (const dd of devDays) {
    if (!byDay[dd.day]) byDay[dd.day] = {
      day: dd.day, total_agent_requests: 0, sessions_started: 0,
      agent_prs_created: 0, agent_prs_merged: 0, agent_loc_added: 0, agent_loc_deleted: 0,
      agent_session_minutes: 0, changes_requested_total: 0, merge_minutes_list: [], dev_set: new Set(),
    };
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
      day: d.day, active_devs: activeDevs,
      total_agent_requests: d.total_agent_requests, sessions_started: d.sessions_started,
      agent_prs_created: d.agent_prs_created, agent_prs_merged: d.agent_prs_merged,
      agent_loc_added: d.agent_loc_added, agent_loc_deleted: d.agent_loc_deleted,
      agent_session_minutes: d.agent_session_minutes, changes_requested_total: d.changes_requested_total,
      median_merge_minutes: d.merge_minutes_list.length > 0
        ? d.merge_minutes_list.sort((a, b) => a - b)[Math.floor(d.merge_minutes_list.length / 2)]
        : null,
      requests_per_dev: oldSafeDiv(d.total_agent_requests, activeDevs),
      sessions_per_dev: oldSafeDiv(d.sessions_started, activeDevs),
      prs_created_per_dev: oldSafeDiv(d.agent_prs_created, activeDevs),
      prs_merged_per_dev: oldSafeDiv(d.agent_prs_merged, activeDevs),
      loc_added_per_dev: oldSafeDiv(d.agent_loc_added / 100, activeDevs),
      session_mins_per_dev: oldSafeDiv(d.agent_session_minutes, activeDevs),
      merge_rate: oldSafeDiv(d.agent_prs_merged, d.agent_prs_created),
    };
  }).sort((a, b) => a.day.localeCompare(b.day));
}

export function oldProcessAgenticEfficiency(rawData) {
  const devDays = (rawData.developer_day_summary || []).map(oldFlattenDevDay);
  // Dedup by day|developer
  const ddMap = {};
  for (const dd of devDays) ddMap[dd.day + '|' + dd.developer] = dd;
  const deduped = Object.values(ddMap);
  const data = oldComputeDerivedDays(deduped);
  return { data, devDays: deduped };
}

function oldFlattenPrSession(pr) {
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

export function oldProcessAgenticSessions(rawData) {
  const sessions = (rawData.pr_sessions || []).map(oldFlattenPrSession);
  const seen = {};
  return sessions.filter(s => {
    const key = (s.repo || '') + '#' + (s.pr_number || '');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}
