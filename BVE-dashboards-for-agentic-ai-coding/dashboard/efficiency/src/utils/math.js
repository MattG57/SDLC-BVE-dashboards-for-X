/**
 * Utility functions for safe mathematical operations
 */

/**
 * Safe division that handles zero/null denominators
 * @param {number} numerator - The dividend
 * @param {number} denominator - The divisor
 * @returns {number|null} Result of division, or null if denominator is zero/falsy
 */
export function safeDiv(numerator, denominator) {
  return denominator && denominator !== 0 ? numerator / denominator : null;
}

/**
 * Calculate sum of an array of numbers, treating null/undefined as 0
 * @param {number[]} values - Array of values to sum
 * @returns {number} Sum of all values
 */
export function safeSum(values) {
  return values.reduce((sum, val) => sum + (val || 0), 0);
}

/**
 * Calculate average, returning null if no valid values
 * @param {number[]} values - Array of values to average
 * @returns {number|null} Average or null if empty
 */
export function safeAvg(values) {
  const validValues = values.filter(v => v != null);
  if (validValues.length === 0) return null;
  return safeSum(validValues) / validValues.length;
}

/**
 * Round to specified decimal places
 * @param {number} value - Value to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded value
 */
export function round(value, decimals = 2) {
  if (value == null) return null;
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
