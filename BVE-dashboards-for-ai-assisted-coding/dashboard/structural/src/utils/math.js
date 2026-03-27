/**
 * Mathematical and statistical utility functions
 * Used across structural dashboard calculations
 */

/**
 * Safe division - returns null if denominator is zero or falsy
 * @param {number} a - Numerator
 * @param {number} b - Denominator
 * @returns {number|null} Result or null if division not possible
 */
export function safeDiv(a, b) {
  // Handle NaN and Infinity
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return b && b !== 0 ? a / b : null;
}

/**
 * Calculate mean (average) of an array
 * @param {number[]} arr - Array of numbers (nulls, undefined, NaN are filtered out)
 * @returns {number|null} Mean value or null if no valid values
 */
export function mean(arr) {
  const valid = arr.filter(v => v != null && Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/**
 * Calculate standard deviation of an array
 * Uses sample standard deviation (n-1 denominator)
 * @param {number[]} arr - Array of numbers (nulls, undefined, NaN are filtered out)
 * @returns {number} Standard deviation (0 if less than 2 values)
 */
export function stddev(arr) {
  const valid = arr.filter(v => v != null && Number.isFinite(v));
  if (valid.length < 2) return 0;
  const m = mean(valid);
  return Math.sqrt(valid.reduce((s, v) => s + (v - m) ** 2, 0) / (valid.length - 1));
}

/**
 * Calculate linear regression for a set of points
 * @param {Array<[number, number]>} points - Array of [x, y] coordinate pairs
 * @returns {Object|null} Regression result with slope, intercept, and line points
 */
export function linearRegression(points) {
  const filtered = points.filter(p => p[0] != null && p[1] != null);
  if (filtered.length < 2) return null;
  
  const n = filtered.length;
  const sumX = filtered.reduce((s, p) => s + p[0], 0);
  const sumY = filtered.reduce((s, p) => s + p[1], 0);
  const sumXY = filtered.reduce((s, p) => s + p[0] * p[1], 0);
  const sumX2 = filtered.reduce((s, p) => s + p[0] * p[0], 0);
  const denom = n * sumX2 - sumX * sumX;
  
  if (Math.abs(denom) < 1e-10) return null;
  
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const xMin = Math.min(...filtered.map(p => p[0]));
  const xMax = Math.max(...filtered.map(p => p[0]));
  
  return {
    slope,
    intercept,
    line: [[xMin, slope * xMin + intercept], [xMax, slope * xMax + intercept]]
  };
}

/**
 * Add or subtract days from a date string
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {number} offset - Number of days to add (positive) or subtract (negative)
 * @returns {string} New date in YYYY-MM-DD format
 */
export function dayOffset(dateStr, offset) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
