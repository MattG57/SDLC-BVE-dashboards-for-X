/**
 * Data processing and transformation functions
 * Handles data flattening, filtering, and preparation for structural metrics
 */

/**
 * Flatten enterprise day totals from API response
 * @param {Object} dt - Day total object from enterprise report
 * @returns {Object} Flattened day record with normalized fields
 */
export function flattenDayTotal(dt) {
  let loc_suggested_to_add = dt.loc_suggested_to_add_sum || 0;
  let loc_suggested_to_delete = dt.loc_suggested_to_delete_sum || 0;
  let loc_added = dt.loc_added_sum || 0;
  let loc_deleted = dt.loc_deleted_sum || 0;

  // Aggregate from IDE totals if not at top level
  if (loc_added === 0 && Array.isArray(dt.totals_by_ide)) {
    loc_suggested_to_add = dt.totals_by_ide.reduce((s, i) => s + (i.loc_suggested_to_add_sum || 0), 0);
    loc_suggested_to_delete = dt.totals_by_ide.reduce((s, i) => s + (i.loc_suggested_to_delete_sum || 0), 0);
    loc_added = dt.totals_by_ide.reduce((s, i) => s + (i.loc_added_sum || 0), 0);
    loc_deleted = dt.totals_by_ide.reduce((s, i) => s + (i.loc_deleted_sum || 0), 0);
  }

  const pr = dt.pull_requests || {};
  const cli = dt.totals_by_cli || {};

  return {
    day: dt.day,
    enterprise_id: dt.enterprise_id,
    daily_active_users: dt.daily_active_users || 0,
    daily_active_cli_users: dt.daily_active_cli_users || 0,
    weekly_active_users: dt.weekly_active_users || 0,
    monthly_active_users: dt.monthly_active_users || 0,
    monthly_active_chat_users: dt.monthly_active_chat_users || 0,
    monthly_active_agent_users: dt.monthly_active_agent_users || 0,
    user_initiated_interaction_count: dt.user_initiated_interaction_count || 0,
    code_generation_activity_count: dt.code_generation_activity_count || 0,
    code_acceptance_activity_count: dt.code_acceptance_activity_count || 0,
    loc_suggested_to_add_sum: loc_suggested_to_add,
    loc_suggested_to_delete_sum: loc_suggested_to_delete,
    loc_added_sum: loc_added,
    loc_deleted_sum: loc_deleted,
    pr_total_reviewed: pr.total_reviewed || 0,
    pr_total_created: pr.total_created || 0,
    pr_total_created_by_copilot: pr.total_created_by_copilot || 0,
    pr_total_reviewed_by_copilot: pr.total_reviewed_by_copilot || 0,
    cli_session_count: cli.session_count || 0,
    cli_request_count: cli.request_count || 0,
    agent_mode_interaction_count: Array.isArray(dt.totals_by_feature)
      ? (dt.totals_by_feature.find(f => f.feature === 'chat_panel_agent_mode') || {}).user_initiated_interaction_count || 0
      : 0,
    // Preserve feature breakdown for View By
    totals_by_feature: dt.totals_by_feature || [],
    totals_by_ide: dt.totals_by_ide || [],
    totals_by_language: dt.totals_by_language || [],
    totals_by_model: dt.totals_by_model || [],
  };
}

/**
 * Flatten user report records
 * @param {Array} records - User report records from API
 * @returns {Array} Flattened user records
 */
export function flattenUserReport(records) {
  return records.map(u => {
    let loc_add = u.loc_added_sum || 0;
    if (loc_add === 0 && Array.isArray(u.totals_by_ide)) {
      loc_add = u.totals_by_ide.reduce((s, i) => s + (i.loc_added_sum || 0), 0);
    }
    return {
      day: u.day,
      enterprise_id: u.enterprise_id,
      user_id: u.user_id,
      user_login: u.user_login,
      user_initiated_interaction_count: u.user_initiated_interaction_count || 0,
      code_generation_activity_count: u.code_generation_activity_count || 0,
      code_acceptance_activity_count: u.code_acceptance_activity_count || 0,
      loc_suggested_to_add_sum: u.loc_suggested_to_add_sum || 0,
      loc_added_sum: loc_add,
      loc_deleted_sum: u.loc_deleted_sum || 0,
      used_agent: !!u.used_agent,
      used_chat: !!u.used_chat,
      agent_mode_interaction_count: Array.isArray(u.totals_by_feature)
        ? (u.totals_by_feature.find(f => f.feature === 'chat_panel_agent_mode') || {}).user_initiated_interaction_count || 0
        : 0,
    };
  });
}

/**
 * Bot/agent/automation patterns to exclude
 * This dashboard covers human AI-assisted coding only
 */
const BOT_PATTERNS = [
  /\[bot\]$/i,
  /-bot$/i,
  /-agent$/i,
  /^dependabot$/i,
  /^github-actions$/i,
  /^renovate$/i,
  /^od-octodemo-/i
];

/**
 * Check if a login appears to be a bot
 * @param {string} login - User login to check
 * @returns {boolean} True if login matches bot patterns
 */
export function isBot(login) {
  return BOT_PATTERNS.some(p => p.test(login));
}

/**
 * Flatten and filter PR review data
 * Accepts multiple input formats and filters out bot PRs
 * 
 * @param {Object|Array} prData - PR data in various formats
 * @returns {Object} {all, filtered} PR arrays
 */
export function flattenPrReview(prData) {
  // Accept either { pull_requests: { prs: [...] } } or { prs: [...] } or [...]
  let prs = [];
  if (Array.isArray(prData)) {
    prs = prData;
  } else if (prData?.pull_requests?.prs) {
    prs = prData.pull_requests.prs;
  } else if (prData?.prs) {
    prs = prData.prs;
  }
  
  const all = prs.map(pr => ({
    day: pr.created_at ? pr.created_at.slice(0, 10) : null,
    user: pr.user,
    repository: pr.repository,
    number: pr.number,
    state: pr.state,
    merged_at: pr.merged_at,
    additions: pr.additions || 0,
    deletions: pr.deletions || 0,
    changed_files: pr.changed_files || 0,
    loc_changed: (pr.additions || 0) + (pr.deletions || 0),
  })).filter(pr => pr.day != null);
  
  const filtered = all.filter(pr => !isBot(pr.user));
  
  return { all, filtered };
}

/**
 * Process structural metrics data from multiple sources
 * @param {Object} enterpriseData - Enterprise report with day_totals
 * @param {Object} userData - User report with user data
 * @param {Object} prData - PR review data
 * @param {Object} config - Configuration object
 * @returns {Object} Processed data ready for structural calculations
 */
export function processStructuralMetrics(enterpriseData, userData, prData, config) {
  // Flatten enterprise day totals
  const entDays = enterpriseData?.enterprise_report?.day_totals
    ? enterpriseData.enterprise_report.day_totals.map(flattenDayTotal)
    : (enterpriseData?.organization_report || []).map(flattenDayTotal);

  // Flatten user report
  const userDays = userData?.user_report
    ? flattenUserReport(userData.user_report)
    : [];

  // Flatten and filter PR data
  const prProcessed = prData ? flattenPrReview(prData) : { all: [], filtered: [] };

  return {
    entDays,
    userDays,
    prRecords: prProcessed.filtered,
    rawPrRecords: prProcessed.all,
    config
  };
}
