/**
 * Core estimation functions for calculating time savings from Copilot usage
 * All functions are pure - no side effects, fully testable
 */

/**
 * Calculate hours saved based on interaction count
 * @param {number} interactions - Total user-initiated interactions
 * @param {number} interactionsPerHour - Estimated interactions per hour of work saved (default: 20)
 * @returns {number} Estimated hours saved
 */
export function calculateInteractionBasedHours(interactions, interactionsPerHour = 20) {
  if (!interactions || interactions <= 0) return 0;
  if (!interactionsPerHour || interactionsPerHour <= 0) {
    throw new Error('interactionsPerHour must be positive');
  }
  return interactions / interactionsPerHour;
}

/**
 * Calculate hours saved based on lines of code added
 * @param {number} locAdded - Lines of code added via Copilot
 * @param {number} hoursPerKloc - Estimated hours to manually write 1000 lines (default: 2)
 * @returns {number} Estimated hours saved
 */
export function calculateLocBasedHours(locAdded, hoursPerKloc = 2) {
  if (!locAdded || locAdded <= 0) return 0;
  if (!hoursPerKloc || hoursPerKloc <= 0) {
    throw new Error('hoursPerKloc must be positive');
  }
  return (locAdded / 1000) * hoursPerKloc;
}

/**
 * Calculate hours saved based on manual percentage estimate
 * @param {number} activeUsers - Number of active developers
 * @param {number} percentOfBaseline - Percentage of baseline hours saved (e.g., 0.20 for 20%)
 * @param {number} baselineHoursPerWeek - Baseline developer hours per week (default: 30)
 * @param {number} workdaysPerWeek - Work days per week (default: 5)
 * @returns {number} Estimated hours saved for the day
 */
export function calculateManualDailyPercentHours(
  activeUsers,
  percentOfBaseline = 0.20,
  baselineHoursPerWeek = 30,
  workdaysPerWeek = 5
) {
  if (!activeUsers || activeUsers <= 0) return 0;
  if (percentOfBaseline < 0 || percentOfBaseline > 1) {
    throw new Error('percentOfBaseline must be between 0 and 1');
  }
  if (baselineHoursPerWeek <= 0 || workdaysPerWeek <= 0) {
    throw new Error('baseline and workdays must be positive');
  }
  
  // Hours saved per developer per day
  const hoursPerDevPerDay = (percentOfBaseline * baselineHoursPerWeek) / workdaysPerWeek;
  
  // Total org hours for the day
  return hoursPerDevPerDay * activeUsers;
}

/**
 * Calculate labor cost saved
 * @param {number} hoursSaved - Total hours saved
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
 * Calculate hours saved per developer per day
 * @param {number} totalHours - Total organization hours saved
 * @param {number} activeUsers - Number of active developers
 * @returns {number|null} Hours per developer, or null if no active users
 */
export function calculateHoursPerDev(totalHours, activeUsers) {
  if (!activeUsers || activeUsers <= 0) return null;
  return totalHours / activeUsers;
}

/**
 * Aggregate daily estimates into summary statistics
 * @param {Array<{hours: number, activeUsers: number}>} dailyData - Array of daily estimates
 * @returns {Object} Summary with totals and averages
 */
export function aggregateEstimates(dailyData) {
  if (!Array.isArray(dailyData) || dailyData.length === 0) {
    return {
      totalHours: 0,
      avgOrgHoursPerDay: 0,
      avgHoursPerDevPerDay: null,
      daysCount: 0,
    };
  }

  const totalHours = dailyData.reduce((sum, day) => sum + (day.hours || 0), 0);
  const avgOrgHoursPerDay = totalHours / dailyData.length;
  
  // Calculate per-dev average across days where we have active users
  const perDevDaily = dailyData
    .filter(day => day.activeUsers > 0)
    .map(day => day.hours / day.activeUsers);
  
  const avgHoursPerDevPerDay = perDevDaily.length > 0
    ? perDevDaily.reduce((sum, val) => sum + val, 0) / perDevDaily.length
    : null;

  return {
    totalHours,
    avgOrgHoursPerDay,
    avgHoursPerDevPerDay,
    daysCount: dailyData.length,
  };
}
