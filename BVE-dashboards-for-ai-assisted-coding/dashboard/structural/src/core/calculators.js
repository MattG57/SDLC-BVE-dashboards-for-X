/**
 * Core calculation functions for structural dashboard
 * Handles adoption metrics, PR assistance rates, and LoC share calculations
 */

import { safeDiv, dayOffset } from '../utils/math.js';

/**
 * Group pull requests by day and calculate assisted metrics
 * A PR is "assisted" if its author used Copilot on the PR's creation day
 * or either of the 2 prior days (3-day lookback window)
 * 
 * @param {Array} prs - Array of PR objects with {user, day, loc_changed}
 * @param {Object} copilotUsersByDay - Map of date -> Set of user logins
 * @returns {Object} {byDay, period} with total/assisted PR and LoC counts
 */
export function groupPrsByDay(prs, copilotUsersByDay) {
  function isAssisted(user, day) {
    for (let i = 0; i <= 2; i++) {
      const checkDay = dayOffset(day, -i);
      const dayUsers = copilotUsersByDay[checkDay];
      if (dayUsers && dayUsers.has(user)) return true;
    }
    return false;
  }

  const byDay = {};
  const period = { total_prs: 0, assisted_prs: 0, total_loc: 0, assisted_loc: 0 };

  for (const pr of prs) {
    const assisted = isAssisted(pr.user, pr.day);
    period.total_prs++;
    period.total_loc += pr.loc_changed;
    if (assisted) {
      period.assisted_prs++;
      period.assisted_loc += pr.loc_changed;
    }
    
    if (!byDay[pr.day]) {
      byDay[pr.day] = { total_prs: 0, assisted_prs: 0, total_loc: 0, assisted_loc: 0 };
    }
    const bucket = byDay[pr.day];
    bucket.total_prs++;
    bucket.total_loc += pr.loc_changed;
    if (assisted) {
      bucket.assisted_prs++;
      bucket.assisted_loc += pr.loc_changed;
    }
  }
  
  return { byDay, period };
}

/**
 * Calculate adoption rate
 * @param {number} activeUsers - Number of active users
 * @param {number} totalDevs - Total developer count
 * @returns {number|null} Adoption percentage (0-1) or null
 */
export function calculateAdoptionRate(activeUsers, totalDevs) {
  return safeDiv(activeUsers, totalDevs);
}

/**
 * Calculate penetration (depth of usage)
 * @param {number} activeDays - Number of days feature was active
 * @param {number} totalDays - Total days in period
 * @param {number} avgDau - Average daily active users
 * @param {number} totalDevs - Total developer count
 * @returns {number|null} Penetration rate (0-1) or null
 */
export function calculatePenetration(activeDays, totalDays, avgDau, totalDevs) {
  const adoptionRate = safeDiv(activeDays, totalDays);
  if (adoptionRate === null) return null;
  return safeDiv(avgDau * adoptionRate, totalDevs);
}

/**
 * Calculate PR assistance rate
 * @param {number} assistedPrs - Number of PRs from Copilot users
 * @param {number} totalPrs - Total number of PRs
 * @returns {number|null} Assistance rate (0-1) or null
 */
export function calculatePRAssistanceRate(assistedPrs, totalPrs) {
  return safeDiv(assistedPrs, totalPrs);
}

/**
 * Calculate LoC share (percentage of code from Copilot users)
 * @param {number} assistedLoc - Lines of code from Copilot users
 * @param {number} totalLoc - Total lines of code
 * @returns {number|null} LoC share (0-1) or null
 */
export function calculateLocShare(assistedLoc, totalLoc) {
  return safeDiv(assistedLoc, totalLoc);
}

/**
 * Calculate gap to full adoption
 * @param {number} penetrationRate - Current penetration rate (0-1)
 * @returns {number} Gap to 100% adoption (0-1)
 */
export function calculateGapToFullAdoption(penetrationRate) {
  if (penetrationRate === null) return 1;
  return 1 - Math.min(penetrationRate, 1);
}

/**
 * Build map of Copilot users by day from user report data
 * @param {Array} userDays - User report records with day, user_login, activity counts
 * @returns {Object} Map of date -> Set of active user logins
 */
export function computeCopilotUsers(userDays) {
  const copilotUsersByDay = {};
  for (const u of userDays) {
    if (u.code_generation_activity_count > 0 || u.user_initiated_interaction_count > 0) {
      if (!copilotUsersByDay[u.day]) {
        copilotUsersByDay[u.day] = new Set();
      }
      copilotUsersByDay[u.day].add(u.user_login);
    }
  }
  return copilotUsersByDay;
}

/**
 * Calculate structural metrics for each day
 * @param {Array} entDays - Enterprise day records
 * @param {Array} userDays - User day records  
 * @param {Object} config - Configuration with cfg_total_developers
 * @param {Array} prRecords - PR records with user, day, loc_changed
 * @returns {Array} Enhanced day records with structural metrics
 */
export function computeStructuralMetrics(entDays, userDays, config, prRecords) {
  const totalDevs = config.cfg_total_developers;

  // Group user records by day
  const usersByDay = {};
  const copilotUsersByDay = computeCopilotUsers(userDays);
  
  for (const u of userDays) {
    if (!usersByDay[u.day]) usersByDay[u.day] = [];
    usersByDay[u.day].push(u);
  }

  // Group PR data by day (with assisted flagging) + period-wide totals
  const prGrouped = prRecords ? groupPrsByDay(prRecords, copilotUsersByDay) 
    : { byDay: {}, period: { total_prs: 0, assisted_prs: 0, total_loc: 0, assisted_loc: 0 } };
  const prsByDay = prGrouped.byDay;
  const prPeriod = prGrouped.period;
  const hasPrData = !!(prRecords && prRecords.length > 0);

  // Period-wide ratios
  const periodPrsAssistedPct = calculatePRAssistanceRate(prPeriod.assisted_prs, prPeriod.total_prs);
  const periodLocAssistedPct = hasPrData && prPeriod.total_loc > 0 
    ? calculateLocShare(prPeriod.assisted_loc, prPeriod.total_loc) 
    : null;

  const days = entDays.map(d => {
    const dayUsers = usersByDay[d.day] || [];
    const uniqueActiveUsers = dayUsers.length > 0
      ? new Set(dayUsers.filter(u => u.code_generation_activity_count > 0 || u.user_initiated_interaction_count > 0).map(u => u.user_login)).size
      : d.daily_active_users;

    // PR data for this day
    const prDay = prsByDay[d.day] || { total_prs: 0, assisted_prs: 0, total_loc: 0, assisted_loc: 0 };

    // Completeness metric 1: Adopted Individuals %
    const adopted_individuals_pct = calculateAdoptionRate(d.daily_active_users, totalDevs);

    // Completeness metric 2: PRs Assisted % (daily)
    const prs_assisted_pct = hasPrData
      ? calculatePRAssistanceRate(prDay.assisted_prs, prDay.total_prs)
      : calculateAdoptionRate(uniqueActiveUsers, totalDevs);

    // Completeness metric 3: AI-Assisted LOC %
    const ai_assisted_loc_pct = hasPrData
      ? calculateLocShare(prDay.assisted_loc, prDay.total_loc)
      : safeDiv(d.loc_added_sum, config.cfg_total_dev_loc_added_day);

    // Downstream metrics for Impact section
    const total_prs = hasPrData ? prDay.total_prs : (d.pr_total_created || 0);
    const assisted_prs = hasPrData ? prDay.assisted_prs : 0;
    const total_loc = hasPrData ? prDay.total_loc : (d.loc_added_sum + d.loc_deleted_sum);
    const assisted_loc = hasPrData ? prDay.assisted_loc : d.loc_added_sum;
    const prs_per_day = total_prs;
    const loc_per_day = total_loc;

    return {
      ...d,
      adopted_individuals_pct,
      prs_assisted_pct,
      ai_assisted_loc_pct,
      prs_per_day,
      loc_per_day,
      total_prs,
      assisted_prs,
      total_loc,
      assisted_loc,
      unique_active_users: uniqueActiveUsers,
      has_pr_data: hasPrData,
    };
  });

  // Attach period-wide PR totals
  days._prPeriod = prPeriod;
  days._periodPrsAssistedPct = periodPrsAssistedPct;
  days._periodLocAssistedPct = periodLocAssistedPct;
  
  return days;
}
