/**
 * Formatting utilities for BVE dashboard display.
 *
 * All formatters return '—' for null/undefined values, ensuring
 * consistent display of missing data across all dashboards.
 */

/** Decimal with configurable precision. */
export function fmtDec(v, d = 1) {
  return v != null ? v.toFixed(d) : '—';
}

/** Percentage with one decimal (0.123 → "12.3%"). */
export function fmtPct(v) {
  return v != null ? (v * 100).toFixed(1) + '%' : '—';
}

/** Percentage rounded to integer (0.123 → "12%"). */
export function fmtPct0(v) {
  return v != null ? Math.round(v * 100) + '%' : '—';
}

/** Locale-formatted number (1234 → "1,234"). */
export function fmt(v) {
  return v != null ? v.toLocaleString() : '—';
}

/** Compact number (1234 → "1.2k", 1234567 → "1.2M"). */
export function fmtCompact(v) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return v.toFixed(0);
}

/** Currency with compact notation ($1234 → "$1.2k"). */
export function fmtCurrency(v) {
  if (v == null) return '—';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'k';
  return '$' + v.toFixed(0);
}
