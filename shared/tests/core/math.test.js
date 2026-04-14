import { describe, it, expect } from 'vitest';
import {
  safeDiv, safeSum, mean, stddev, linearRegression,
  smooth7, dayOffset, isWeekend, round,
} from '../../core/math.js';

describe('safeDiv', () => {
  it('divides normally for positive denominator', () => {
    expect(safeDiv(10, 5)).toBe(2);
  });

  it('returns null for zero denominator', () => {
    expect(safeDiv(10, 0)).toBeNull();
  });

  it('returns null for negative denominator', () => {
    expect(safeDiv(10, -1)).toBeNull();
  });

  it('handles zero numerator', () => {
    expect(safeDiv(0, 5)).toBe(0);
  });

  it('handles fractional values', () => {
    expect(safeDiv(1, 3)).toBeCloseTo(0.3333, 4);
  });
});

describe('safeSum', () => {
  it('sums values treating null as 0', () => {
    expect(safeSum([1, 2, null, 3, undefined])).toBe(6);
  });

  it('returns 0 for empty array', () => {
    expect(safeSum([])).toBe(0);
  });
});

describe('mean', () => {
  it('computes mean of valid values', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  it('ignores null values', () => {
    expect(mean([2, null, 6])).toBe(4);
  });

  it('returns null for empty array', () => {
    expect(mean([])).toBeNull();
  });

  it('returns null for all-null array', () => {
    expect(mean([null, null])).toBeNull();
  });
});

describe('stddev', () => {
  it('computes population standard deviation', () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.0, 1);
  });

  it('returns null for fewer than 2 values', () => {
    expect(stddev([5])).toBeNull();
    expect(stddev([])).toBeNull();
  });

  it('ignores null values', () => {
    expect(stddev([2, null, 4])).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for identical values', () => {
    expect(stddev([3, 3, 3])).toBe(0);
  });
});

describe('linearRegression', () => {
  it('computes slope and intercept for simple line', () => {
    const result = linearRegression([[0, 0], [1, 2], [2, 4]]);
    expect(result.slope).toBeCloseTo(2, 5);
    expect(result.intercept).toBeCloseTo(0, 5);
  });

  it('returns null for fewer than 3 points', () => {
    expect(linearRegression([[0, 0], [1, 1]])).toBeNull();
  });

  it('returns null for vertical line (zero x variance)', () => {
    expect(linearRegression([[1, 0], [1, 1], [1, 2]])).toBeNull();
  });

  it('returns line endpoints', () => {
    const result = linearRegression([[0, 1], [2, 3], [4, 5]]);
    expect(result.line[0][0]).toBe(0);
    expect(result.line[1][0]).toBe(4);
  });
});

describe('smooth7', () => {
  it('computes trailing 7-day rolling average', () => {
    const input = [10, 20, 30, 40, 50, 60, 70];
    const result = smooth7(input);
    expect(result[0]).toBe(10);
    expect(result[6]).toBe(40); // mean of 10..70
  });

  it('handles null values in window', () => {
    const input = [10, null, 30];
    const result = smooth7(input);
    expect(result[0]).toBe(10);
    expect(result[2]).toBe(20); // mean of 10, 30 (null excluded)
  });

  it('handles all-null array', () => {
    const result = smooth7([null, null, null]);
    expect(result).toEqual([null, null, null]);
  });
});

describe('dayOffset', () => {
  it('adds positive offset', () => {
    expect(dayOffset('2026-04-10', 3)).toBe('2026-04-13');
  });

  it('subtracts with negative offset', () => {
    expect(dayOffset('2026-04-10', -2)).toBe('2026-04-08');
  });

  it('crosses month boundary', () => {
    expect(dayOffset('2026-03-30', 3)).toBe('2026-04-02');
  });

  it('handles zero offset', () => {
    expect(dayOffset('2026-04-10', 0)).toBe('2026-04-10');
  });
});

describe('isWeekend', () => {
  it('detects Saturday', () => {
    expect(isWeekend('2026-04-11')).toBe(true); // Saturday
  });

  it('detects Sunday', () => {
    expect(isWeekend('2026-04-12')).toBe(true); // Sunday
  });

  it('detects weekday', () => {
    expect(isWeekend('2026-04-13')).toBe(false); // Monday
  });
});

describe('round', () => {
  it('rounds to specified decimals', () => {
    expect(round(3.14159, 2)).toBe(3.14);
  });

  it('returns null for null input', () => {
    expect(round(null)).toBeNull();
  });

  it('defaults to 2 decimals', () => {
    expect(round(3.14159)).toBe(3.14);
  });
});
