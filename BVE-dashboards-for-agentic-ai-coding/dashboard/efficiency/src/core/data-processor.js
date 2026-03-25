/**
 * Data processing functions for Agentic AI Coding metrics
 * Transforms repository-level data (PRs, issues, sessions) into day-level aggregates
 */

import { safeSum } from '../utils/math.js';

/**
 * Process PR sessions to extract merged-only metrics by date
 * @param {Array} prSessions - Array of PR session objects
 * @returns {Object} Map of date -> merged metrics
 */
export function processMergedPRsByDate(prSessions) {
  const mergedByDate = {};
  
  for (const pr of prSessions) {
    if (!pr.pr_merged_at) continue; // Only count merged PRs
    
    const date = (pr.pr_created_at || '').substring(0, 10);
    if (!date) continue;
    
    if (!mergedByDate[date]) {
      mergedByDate[date] = { 
        locAdded: 0, 
        locDeleted: 0, 
        sessionMinutes: 0 
      };
    }
    
    mergedByDate[date].locAdded += (pr.additions || 0);
    mergedByDate[date].locDeleted += (pr.deletions || 0);
    
    // Only count agent session minutes (not human prep time)
    if (pr.duration_type === 'agent') {
      mergedByDate[date].sessionMinutes += (pr.duration_minutes || 0);
    }
  }
  
  return mergedByDate;
}

/**
 * Count unique issues created per day
 * @param {Array} requests - Array of request objects
 * @returns {Object} Map of date -> issue count
 */
export function countIssuesByDate(requests) {
  const issuesByDate = {};
  const seenIssues = new Set();
  
  for (const req of requests) {
    if (!req.issue_number || req.is_pull_request) continue;
    if (seenIssues.has(req.issue_number)) continue; // Deduplicate
    
    seenIssues.add(req.issue_number);
    const date = (req.issue_created_at || '').substring(0, 10);
    if (!date) continue;
    
    issuesByDate[date] = (issuesByDate[date] || 0) + 1;
  }
  
  return issuesByDate;
}

/**
 * Calculate turbulence (friction signals) per day
 * Turbulence indicates rework, confusion, or quality issues
 * 
 * Signals counted:
 * 1. Repeat assignments (same issue/PR assigned multiple times)
 * 2. Closed without merge
 * 3. Sessions with zero duration
 * 4. PRs with zero changes (additions and deletions both 0)
 * 5. Review friction (changes requested, reopened, additional guidance)
 * 6. Extra copilot invocations (follow-ups beyond initial request)
 * 
 * @param {Array} prSessions - Array of PR session objects
 * @param {Array} requests - Array of request objects
 * @returns {Object} Map of date -> turbulence count
 */
export function calculateTurbulenceByDate(prSessions, requests) {
  const turbByDate = {};
  
  // 1. Repeat assignments: group requests by (date, issue_or_pr_number), count extras
  const reqGroups = {};
  for (const req of requests) {
    const date = (req.requested_at || '').substring(0, 10);
    if (!date) continue;
    
    const key = date + '|' + (req.issue_number || req.pr_number || '');
    reqGroups[key] = (reqGroups[key] || 0) + 1;
  }
  
  for (const [key, count] of Object.entries(reqGroups)) {
    if (count <= 1) continue; // Only count repeats
    const date = key.split('|')[0];
    turbByDate[date] = (turbByDate[date] || 0) + (count - 1);
  }
  
  // 2-6. PR-level signals keyed by pr_created_at date
  for (const pr of prSessions) {
    const date = (pr.pr_created_at || '').substring(0, 10);
    if (!date) continue;
    
    let turbulence = 0;
    
    // 2. Closed without merge
    if (pr.pr_state === 'closed' && !pr.pr_merged_at) turbulence++;
    
    // 3. Sessions with zero duration
    if (pr.duration_minutes == null || pr.duration_minutes === 0) turbulence++;
    
    // 4. PRs with zero changes
    if ((pr.additions || 0) === 0 && (pr.deletions || 0) === 0) turbulence++;
    
    // 5. Review friction
    turbulence += (pr.changes_requested_count || 0);
    turbulence += (pr.reopened_count || 0);
    turbulence += (pr.additional_guidance_count || 0);
    
    // 6. Extra copilot invocations (follow-ups)
    turbulence += Math.max(0, (pr.copilot_invocation_count || 1) - 1);
    
    if (turbulence > 0) {
      turbByDate[date] = (turbByDate[date] || 0) + turbulence;
    }
  }
  
  return turbByDate;
}

/**
 * Aggregate developer_day_summary to day-level metrics
 * Combines with PR sessions and requests for complete daily view
 * 
 * @param {Array} devDays - Developer day summary records
 * @param {Array} prSessions - PR session records
 * @param {Array} requests - Request records
 * @returns {Array} Day-level aggregated metrics, sorted by date
 */
export function aggregateToDayLevel(devDays, prSessions = [], requests = []) {
  // Group developer days by date
  const byDate = {};
  for (const r of devDays) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  }
  
  // Get merged PR metrics
  const mergedByDate = processMergedPRsByDate(prSessions);
  
  // Get issue counts
  const issuesByDate = countIssuesByDate(requests);
  
  // Get turbulence metrics
  const turbByDate = calculateTurbulenceByDate(prSessions, requests);
  
  // Build day-level records
  return Object.entries(byDate).map(([date, rows]) => ({
    date,
    agentActiveDevs: rows.length,
    humanDevsActive: rows.filter(r => (r.agent_session_minutes || 0) > 0).length || rows.length,
    totalAgentRequests: safeSum(rows.map(r => r.total_agent_requests)),
    issueAssignmentRequests: safeSum(rows.map(r => r.issue_assignment_requests)),
    issuesCreated: issuesByDate[date] || 0,
    prFollowupRequests: safeSum(rows.map(r => r.pr_followup_requests)),
    sessionsStarted: safeSum(rows.map(r => r.sessions_started)),
    agentPrsCreated: safeSum(rows.map(r => r.agent_prs_created)),
    agentPrsMerged: safeSum(rows.map(r => r.agent_prs_merged)),
    agentLocAdded: safeSum(rows.map(r => r.agent_loc_added)),
    agentLocDeleted: safeSum(rows.map(r => r.agent_loc_deleted)),
    agentSessionMinutes: safeSum(rows.map(r => r.agent_session_minutes)),
    changesRequestedTotal: safeSum(rows.map(r => r.changes_requested_total)),
    // Merged-only fields
    mergedLocAdded: mergedByDate[date]?.locAdded || 0,
    mergedLocDeleted: mergedByDate[date]?.locDeleted || 0,
    mergedSessionMinutes: mergedByDate[date]?.sessionMinutes || 0,
    turbulence: turbByDate[date] || 0,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fill missing days with zero values
 * @param {Array} dayRows - Existing day records
 * @param {number} windowDays - Total days in window (default: 28)
 * @returns {Array} Complete day records with gaps filled
 */
export function fillDayGaps(dayRows, windowDays = 28) {
  if (!dayRows.length) return dayRows;
  
  const existing = {};
  for (const r of dayRows) existing[r.date] = r;
  
  // Calculate date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const filled = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().substring(0, 10);
    
    filled.push(existing[dateStr] || {
      date: dateStr,
      agentActiveDevs: 0,
      humanDevsActive: 0,
      totalAgentRequests: 0,
      issueAssignmentRequests: 0,
      issuesCreated: 0,
      prFollowupRequests: 0,
      sessionsStarted: 0,
      agentPrsCreated: 0,
      agentPrsMerged: 0,
      agentLocAdded: 0,
      agentLocDeleted: 0,
      agentSessionMinutes: 0,
      changesRequestedTotal: 0,
      mergedLocAdded: 0,
      mergedLocDeleted: 0,
      mergedSessionMinutes: 0,
      turbulence: 0,
    });
  }
  
  return filled;
}

/**
 * Process complete agentic AI coding dataset
 * @param {Object} data - Raw data with developer_day_summary, pr_sessions, requests
 * @returns {Object} Processed data ready for dashboard
 */
export function processAgenticData(data) {
  const devDays = data.developer_day_summary || [];
  const prSessions = data.pr_sessions || [];
  const requests = data.requests || [];
  
  const aggregated = aggregateToDayLevel(devDays, prSessions, requests);
  const filled = fillDayGaps(aggregated);
  
  return {
    days: filled,
    prSessions,
    requests,
    metadata: {
      totalDays: filled.length,
      daysWithActivity: aggregated.length,
      totalPRs: prSessions.length,
      totalRequests: requests.length,
    }
  };
}
