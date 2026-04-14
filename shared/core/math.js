/**
 * Safe mathematical operations for the BVE dashboard pipeline.
 *
 * These are the canonical implementations used by all materializers,
 * calculations, and dashboards. Any change here propagates everywhere.
 */

/**
 * Safe division — returns null when denominator is zero or negative.
 * All denominators in BVE are counts (devs, PRs, hours) so negative
 * values indicate bad data and should not produce a result.
 */
export function safeDiv(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Sum an array, treating null/undefined as 0.
 */
export function safeSum(values) {
  return values.reduce((sum, val) => sum + (val || 0), 0);
}

/**
 * Mean of non-null values. Returns null if no valid values.
 */
export function mean(arr) {
  const valid = arr.filter(x => x != null);
  return valid.length > 0
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
}

/**
 * Standard deviation of non-null values. Returns null if fewer than 2 values.
 */
export function stddev(arr) {
  const valid = arr.filter(x => x != null);
  if (valid.length < 2) return null;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((s, v) => s + (v - avg) ** 2, 0) / valid.length;
  return Math.sqrt(variance);
}

/**
 * Simple linear regression on [x, y] point pairs.
 * Returns { slope, intercept, line: [[xMin, yMin], [xMax, yMax]] }
 * or null if fewer than 3 points or zero variance in x.
 */
export function linearRegression(points) {
  const n = points.length;
  if (n < 3) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const [x, y] of points) {
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const xMin = Math.min(...points.map(p => p[0]));
  const xMax = Math.max(...points.map(p => p[0]));
  return {
    slope,
    intercept,
    line: [[xMin, slope * xMin + intercept], [xMax, slope * xMax + intercept]],
  };
}

/**
 * 7-day trailing rolling average. Null values are excluded from the window.
 */
export function smooth7(arr) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - 6);
    const slice = arr.slice(start, i + 1).filter(v => v != null);
    return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

/**
 * Offset a YYYY-MM-DD date string by N days.
 */
export function dayOffset(dayStr, offset) {
  const d = new Date(dayStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/**
 * Check if a YYYY-MM-DD date string falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(dayStr) {
  const d = new Date(dayStr + 'T12:00:00Z');
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Round to specified decimal places. Returns null for null input.
 */
export function round(value, decimals = 2) {
  if (value == null) return null;
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
