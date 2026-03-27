/**
 * Core estimation functions for Agentic AI Coding
 * Calculates human-equivalent time saved by Copilot Coding Agent
 * 
 * Key difference from AI Assisted Coding:
 * - Focuses on autonomous agent sessions (not individual developer IDE usage)
 * - Only counts MERGED PRs (not all activity)
 * - Uses different estimation ratios
 */

/**
 * Calculate hours saved based on agent session duration (merged PRs only)
 * @param {number} mergedSessionMinutes - Total minutes spent in agent sessions for merged PRs
 * @param {number} humanToAgentRatio - Human equivalent time multiplier (default: 10)
 * @returns {number} Estimated human-equivalent hours saved
 */
export function calculateDurationBasedHours(mergedSessionMinutes, humanToAgentRatio = 10) {
  if (!mergedSessionMinutes || mergedSessionMinutes <= 0) return 0;
  if (!humanToAgentRatio || humanToAgentRatio <= 0) {
    throw new Error('humanToAgentRatio must be positive');
  }
  
  // Convert minutes to hours and apply human equivalent multiplier
  return (mergedSessionMinutes / 60) * humanToAgentRatio;
}

/**
 * Calculate hours saved based on lines of code in merged PRs
 * @param {number} mergedLocAdded - Lines of code added in merged PRs
 * @param {number} hoursPerKloc - Estimated hours to manually write 1000 lines (default: 4)
 * @returns {number} Estimated human-equivalent hours saved
 */
export function calculateLocBasedHours(mergedLocAdded, hoursPerKloc = 4) {
  if (!mergedLocAdded || mergedLocAdded <= 0) return 0;
  if (!hoursPerKloc || hoursPerKloc <= 0) {
    throw new Error('hoursPerKloc must be positive');
  }
  
  return (mergedLocAdded / 1000) * hoursPerKloc;
}

/**
 * Calculate labor cost saved
 * @param {number} hoursSaved - Total human-equivalent hours saved
 * @param {number} laborCostPerHour - Hourly labor cost (default: 150)
 * @returns {number} Total cost saved
 */
export function calculateLaborCostSaved(hoursSaved, laborCostPerHour = 150) {
  if (!hoursSaved || hoursSaved <= 0) return 0;
  if (laborCostPerHour <= 0) {
    throw new Error('laborCostPerHour must be positive');
  }
  
  return hoursSaved * laborCostPerHour;
}

/**
 * Calculate hours saved per human developer per day
 * @param {number} totalHours - Total organization hours saved
 * @param {number} humanDevs - Number of human developers with agent activity
 * @returns {number|null} Hours per developer, or null if no active developers
 */
export function calculateHoursPerHumanDev(totalHours, humanDevs) {
  if (!humanDevs || humanDevs <= 0) return null;
  return totalHours / humanDevs;
}

/**
 * Aggregate daily estimates into summary statistics
 * @param {Array<{hours: number, humanDevs: number}>} dailyData - Array of daily estimates
 * @returns {Object} Summary with totals and averages
 */
export function aggregateEstimates(dailyData) {
  if (!Array.isArray(dailyData) || dailyData.length === 0) {
    return {
      totalHours: 0,
      avgOrgHoursPerDay: 0,
      avgHoursPerHumanDevPerDay: null,
      daysCount: 0,
    };
  }

  const totalHours = dailyData.reduce((sum, day) => sum + (day.hours || 0), 0);
  const avgOrgHoursPerDay = totalHours / dailyData.length;
  
  // Calculate per-human-dev average across days where we have active developers
  const perDevDaily = dailyData
    .filter(day => day.humanDevs > 0)
    .map(day => day.hours / day.humanDevs);
  
  const avgHoursPerHumanDevPerDay = perDevDaily.length > 0
    ? perDevDaily.reduce((sum, val) => sum + val, 0) / perDevDaily.length
    : null;

  return {
    totalHours,
    avgOrgHoursPerDay,
    avgHoursPerHumanDevPerDay,
    daysCount: dailyData.length,
  };
}

/**
 * Calculate PR merge rate
 * @param {number} prsMerged - Number of PRs merged
 * @param {number} prsCreated - Number of PRs created
 * @returns {number|null} Merge rate (0-1), or null if no PRs created
 */
export function calculateMergeRate(prsMerged, prsCreated) {
  if (!prsCreated || prsCreated <= 0) return null;
  
  // Validate non-negative inputs
  if (prsMerged < 0 || prsCreated < 0) {
    console.warn('Negative PR counts:', { prsMerged, prsCreated });
    return null;
  }
  
  // Cap at 1.0 if merged exceeds created (data quality issue)
  if (prsMerged > prsCreated) {
    console.warn('Merged PRs exceeds created PRs:', { prsMerged, prsCreated });
    return 1.0;
  }
  
  return prsMerged / prsCreated;
}
