/**
 * Data processing functions to normalize and transform raw API responses
 */

import { safeSum } from '../utils/math.js';

/**
 * Flatten enterprise day total into normalized structure
 * @param {Object} dayTotal - Raw day_total object from API
 * @returns {Object} Normalized daily metrics
 */
export function flattenDayTotal(dayTotal) {
  let locSuggestedToAdd = dayTotal.loc_suggested_to_add_sum || 0;
  let locSuggestedToDelete = dayTotal.loc_suggested_to_delete_sum || 0;
  let locAdded = dayTotal.loc_added_sum || 0;
  let locDeleted = dayTotal.loc_deleted_sum || 0;

  // Fallback to IDE-level totals if top-level is missing
  if (locAdded === 0 && Array.isArray(dayTotal.totals_by_ide)) {
    locSuggestedToAdd = safeSum(
      dayTotal.totals_by_ide.map(i => i.loc_suggested_to_add_sum)
    );
    locSuggestedToDelete = safeSum(
      dayTotal.totals_by_ide.map(i => i.loc_suggested_to_delete_sum)
    );
    locAdded = safeSum(dayTotal.totals_by_ide.map(i => i.loc_added_sum));
    locDeleted = safeSum(dayTotal.totals_by_ide.map(i => i.loc_deleted_sum));
  }

  const pullRequests = dayTotal.pull_requests || {};
  const cli = dayTotal.totals_by_cli || {};

  // Extract agent mode interactions from feature breakdown
  const agentModeInteractions = Array.isArray(dayTotal.totals_by_feature)
    ? (dayTotal.totals_by_feature.find(f => f.feature === 'chat_panel_agent_mode') || {})
        .user_initiated_interaction_count || 0
    : 0;

  return {
    day: dayTotal.day,
    enterpriseId: dayTotal.enterprise_id,
    dailyActiveUsers: dayTotal.daily_active_users || 0,
    dailyActiveCliUsers: dayTotal.daily_active_cli_users || 0,
    weeklyActiveUsers: dayTotal.weekly_active_users || 0,
    monthlyActiveUsers: dayTotal.monthly_active_users || 0,
    monthlyChatUsers: dayTotal.monthly_active_chat_users || 0,
    monthlyAgentUsers: dayTotal.monthly_active_agent_users || 0,
    interactions: dayTotal.user_initiated_interaction_count || 0,
    codeGenerations: dayTotal.code_generation_activity_count || 0,
    codeAcceptances: dayTotal.code_acceptance_activity_count || 0,
    locSuggestedToAdd,
    locSuggestedToDelete,
    locAdded,
    locDeleted,
    prTotalReviewed: pullRequests.total_reviewed || 0,
    prTotalCreated: pullRequests.total_created || 0,
    prCreatedByCopilot: pullRequests.total_created_by_copilot || 0,
    prReviewedByCopilot: pullRequests.total_reviewed_by_copilot || 0,
    cliSessionCount: cli.session_count || 0,
    cliRequestCount: cli.request_count || 0,
    agentModeInteractions,
  };
}

/**
 * Process enterprise report into array of normalized day records
 * @param {Object} enterpriseReport - Raw enterprise_report from API
 * @returns {Array} Array of normalized daily metrics
 */
export function processEnterpriseReport(enterpriseReport) {
  if (!enterpriseReport || !Array.isArray(enterpriseReport.day_totals)) {
    return [];
  }
  return enterpriseReport.day_totals.map(flattenDayTotal);
}

/**
 * Flatten user day record into normalized structure
 * @param {Object} userRecord - Raw user record from API
 * @returns {Object} Normalized user day metrics
 */
export function flattenUserRecord(userRecord) {
  let locAdded = userRecord.loc_added_sum || 0;
  
  // Fallback to IDE-level totals
  if (locAdded === 0 && Array.isArray(userRecord.totals_by_ide)) {
    locAdded = safeSum(userRecord.totals_by_ide.map(i => i.loc_added_sum));
  }

  return {
    day: userRecord.day,
    userLogin: userRecord.user_login,
    dailyActiveUsers: userRecord.daily_active_users || 0,
    interactions: userRecord.user_initiated_interaction_count || 0,
    codeGenerations: userRecord.code_generation_activity_count || 0,
    codeAcceptances: userRecord.code_acceptance_activity_count || 0,
    locAdded,
  };
}

/**
 * Process user report into array of normalized records
 * @param {Array} userReport - Raw user_report array from API
 * @returns {Array} Array of normalized user day records
 */
export function processUserReport(userReport) {
  if (!Array.isArray(userReport)) {
    return [];
  }
  return userReport.map(flattenUserRecord);
}

/**
 * Group user records by day and aggregate
 * @param {Array} userRecords - Normalized user records
 * @returns {Object} Map of date -> aggregated metrics
 */
export function aggregateUserRecordsByDay(userRecords) {
  const byDay = {};
  
  userRecords.forEach(record => {
    if (!byDay[record.day]) {
      byDay[record.day] = {
        day: record.day,
        activeUsers: 0,
        interactions: 0,
        codeGenerations: 0,
        codeAcceptances: 0,
        locAdded: 0,
        users: [],
      };
    }
    
    const dayData = byDay[record.day];
    dayData.activeUsers += record.dailyActiveUsers;
    dayData.interactions += record.interactions;
    dayData.codeGenerations += record.codeGenerations;
    dayData.codeAcceptances += record.codeAcceptances;
    dayData.locAdded += record.locAdded;
    dayData.users.push(record.userLogin);
  });
  
  return byDay;
}

/**
 * Filter data by date range
 * @param {Array} records - Array of records with 'day' field
 * @param {string} startDate - ISO date string (inclusive)
 * @param {string} endDate - ISO date string (inclusive)
 * @returns {Array} Filtered records
 */
export function filterByDateRange(records, startDate, endDate) {
  if (!startDate && !endDate) return records;
  
  return records.filter(record => {
    const date = record.day;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });
}

/**
 * Filter records by specific user
 * @param {Array} userRecords - User records
 * @param {string} userLogin - GitHub login to filter by
 * @returns {Array} Records for specified user
 */
export function filterByUser(userRecords, userLogin) {
  if (!userLogin) return userRecords;
  return userRecords.filter(record => record.userLogin === userLogin);
}
