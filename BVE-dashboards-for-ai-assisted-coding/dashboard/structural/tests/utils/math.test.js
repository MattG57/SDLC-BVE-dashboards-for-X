import { describe, it, expect } from 'vitest';
import { safeDiv, mean, stddev, linearRegression, dayOffset } from '../../src/utils/math.js';

describe('Math Utilities', () => {
  describe('safeDiv', () => {
    it('should divide two positive numbers correctly', () => {
      expect(safeDiv(10, 2)).toBe(5);
      expect(safeDiv(100, 4)).toBe(25);
    });

    it('should handle division resulting in fractions', () => {
      expect(safeDiv(1, 3)).toBeCloseTo(0.333, 2);
      expect(safeDiv(7, 2)).toBe(3.5);
    });

    it('should return null when denominator is zero', () => {
      expect(safeDiv(10, 0)).toBeNull();
      expect(safeDiv(0, 0)).toBeNull();
    });

    it('should return null when denominator is null or undefined', () => {
      expect(safeDiv(10, null)).toBeNull();
      expect(safeDiv(10, undefined)).toBeNull();
    });

    it('should handle negative numbers', () => {
      expect(safeDiv(-10, 2)).toBe(-5);
      expect(safeDiv(10, -2)).toBe(-5);
      expect(safeDiv(-10, -2)).toBe(5);
    });

    it('should handle zero numerator', () => {
      expect(safeDiv(0, 5)).toBe(0);
    });

    it('should return null for NaN inputs', () => {
      expect(safeDiv(NaN, 5)).toBeNull();
      expect(safeDiv(5, NaN)).toBeNull();
      expect(safeDiv(NaN, NaN)).toBeNull();
    });

    it('should return null for Infinity inputs', () => {
      expect(safeDiv(Infinity, 5)).toBeNull();
      expect(safeDiv(5, Infinity)).toBeNull();
      expect(safeDiv(Infinity, Infinity)).toBeNull();
      expect(safeDiv(-Infinity, 5)).toBeNull();
    });

    it('should handle very large numbers', () => {
      const large = Number.MAX_SAFE_INTEGER;
      expect(safeDiv(large, 2)).toBe(large / 2);
    });
  });

  describe('mean', () => {
    it('should calculate average of positive numbers', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([10, 20, 30])).toBe(20);
    });

    it('should handle single value', () => {
      expect(mean([42])).toBe(42);
    });

    it('should filter out null values', () => {
      expect(mean([1, null, 3, null, 5])).toBe(3);
      expect(mean([10, null, 20, null, 30])).toBe(20);
    });

    it('should return null for empty array', () => {
      expect(mean([])).toBeNull();
    });

    it('should return null for array of all nulls', () => {
      expect(mean([null, null, null])).toBeNull();
    });

    it('should handle negative numbers', () => {
      expect(mean([-5, -10, -15])).toBe(-10);
      expect(mean([-2, 0, 2])).toBe(0);
    });

    it('should handle decimals', () => {
      expect(mean([1.5, 2.5, 3.5])).toBeCloseTo(2.5, 5);
    });

    it('should filter out NaN values', () => {
      expect(mean([1, NaN, 3])).toBe(2);
      expect(mean([10, NaN, 20, NaN, 30])).toBe(20);
    });

    it('should filter out undefined values', () => {
      expect(mean([1, undefined, 3])).toBe(2);
      expect(mean([10, undefined, 20])).toBe(15);
    });

    it('should filter out Infinity', () => {
      expect(mean([1, Infinity, 3])).toBe(2);
      expect(mean([1, -Infinity, 3])).toBe(2);
    });

    it('should return null for array with only NaN', () => {
      expect(mean([NaN, NaN])).toBeNull();
    });

    it('should handle mixed null, undefined, and NaN', () => {
      expect(mean([1, null, NaN, undefined, 3, 5])).toBe(3);
    });
  });

  describe('stddev', () => {
    it('should calculate standard deviation for simple values', () => {
      expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 0);
    });

    it('should return 0 for less than 2 values', () => {
      expect(stddev([])).toBe(0);
      expect(stddev([5])).toBe(0);
    });

    it('should filter out null values', () => {
      const result = stddev([2, null, 4, null, 6]);
      expect(result).toBeCloseTo(2, 0);
    });

    it('should return 0 when only 1 valid value after filtering nulls', () => {
      expect(stddev([5, null, null])).toBe(0);
    });

    it('should handle negative numbers', () => {
      const result = stddev([-3, -1, 1, 3]);
      expect(result).toBeGreaterThan(0);
    });

    it('should be 0 for identical values', () => {
      expect(stddev([5, 5, 5, 5])).toBe(0);
    });

    it('should filter out NaN values', () => {
      const result = stddev([2, NaN, 4, NaN, 6]);
      expect(result).toBeCloseTo(2, 0);
    });

    it('should filter out undefined values', () => {
      const result = stddev([2, undefined, 4, undefined, 6]);
      expect(result).toBeCloseTo(2, 0);
    });

    it('should filter out Infinity', () => {
      const result = stddev([2, Infinity, 4, -Infinity, 6]);
      expect(result).toBeCloseTo(2, 0);
    });

    it('should handle mixed null, undefined, and NaN', () => {
      const result = stddev([2, null, NaN, undefined, 4, 6]);
      expect(result).toBeCloseTo(2, 0);
    });
  });

  describe('linearRegression', () => {
    it('should calculate regression for perfect linear relationship', () => {
      const points = [[1, 2], [2, 4], [3, 6], [4, 8]];
      const result = linearRegression(points);
      
      expect(result).not.toBeNull();
      expect(result.slope).toBeCloseTo(2, 5);
      expect(result.intercept).toBeCloseTo(0, 5);
      expect(result.line).toHaveLength(2);
      expect(result.line[0][0]).toBe(1); // xMin
      expect(result.line[1][0]).toBe(4); // xMax
    });

    it('should handle negative slope', () => {
      const points = [[1, 10], [2, 8], [3, 6], [4, 4]];
      const result = linearRegression(points);
      
      expect(result).not.toBeNull();
      expect(result.slope).toBeCloseTo(-2, 5);
    });

    it('should return null for less than 2 points', () => {
      expect(linearRegression([])).toBeNull();
      expect(linearRegression([[1, 2]])).toBeNull();
    });

    it('should filter out points with null values', () => {
      const points = [[1, 2], [null, 4], [3, null], [4, 8]];
      const result = linearRegression(points);
      
      expect(result).not.toBeNull();
      // Should calculate from [1,2] and [4,8] only
      expect(result.slope).toBeCloseTo(2, 1);
    });

    it('should return null when denominator is near zero (vertical line)', () => {
      // All x values the same would cause division by zero
      const points = [[2, 1], [2, 2], [2, 3]];
      const result = linearRegression(points);
      
      expect(result).toBeNull();
    });

    it('should handle decimal points', () => {
      const points = [[1.5, 3.0], [2.5, 5.0], [3.5, 7.0]];
      const result = linearRegression(points);
      
      expect(result).not.toBeNull();
      expect(result.slope).toBeCloseTo(2, 5);
    });

    it('should handle horizontal line (zero slope)', () => {
      const points = [[1, 5], [2, 5], [3, 5]];
      const result = linearRegression(points);
      
      expect(result).not.toBeNull();
      expect(result.slope).toBeCloseTo(0, 5);
      expect(result.intercept).toBeCloseTo(5, 5);
    });
  });

  describe('dayOffset', () => {
    it('should add days correctly', () => {
      expect(dayOffset('2026-03-15', 1)).toBe('2026-03-16');
      expect(dayOffset('2026-03-15', 5)).toBe('2026-03-20');
    });

    it('should subtract days correctly', () => {
      expect(dayOffset('2026-03-15', -1)).toBe('2026-03-14');
      expect(dayOffset('2026-03-15', -5)).toBe('2026-03-10');
    });

    it('should handle month boundaries', () => {
      expect(dayOffset('2026-03-31', 1)).toBe('2026-04-01');
      expect(dayOffset('2026-04-01', -1)).toBe('2026-03-31');
    });

    it('should handle year boundaries', () => {
      expect(dayOffset('2026-12-31', 1)).toBe('2027-01-01');
      expect(dayOffset('2026-01-01', -1)).toBe('2025-12-31');
    });

    it('should handle leap years', () => {
      expect(dayOffset('2024-02-28', 1)).toBe('2024-02-29');
      expect(dayOffset('2024-02-29', 1)).toBe('2024-03-01');
      expect(dayOffset('2024-03-01', -1)).toBe('2024-02-29');
    });

    it('should return same date when offset is 0', () => {
      expect(dayOffset('2026-03-15', 0)).toBe('2026-03-15');
    });

    it('should handle large offsets', () => {
      expect(dayOffset('2026-01-01', 365)).toBe('2027-01-01');
      expect(dayOffset('2026-12-31', -365)).toBe('2025-12-31');
    });
  });
});
