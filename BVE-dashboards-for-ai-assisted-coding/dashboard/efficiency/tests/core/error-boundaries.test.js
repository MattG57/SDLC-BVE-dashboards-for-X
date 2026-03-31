/**
 * Error Boundary and Edge Case Tests
 * Tests error handling and boundary conditions across all modules
 */

import { describe, it, expect } from 'vitest';
import {
  calculateInteractionBasedHours,
  calculateLocBasedHours,
  calculateManualDailyPercentHours,
  calculateLaborCostSaved,
  calculateHoursPerDev,
  aggregateEstimates,
} from '../../src/core/estimators.js';
import {
  flattenDayTotal,
  processEnterpriseReport,
  flattenUserRecord,
  processUserReport,
  aggregateUserRecordsByDay,
  filterByDateRange,
  filterByUser,
} from '../../src/core/data-processor.js';

describe('Error Boundary Tests', () => {
  describe('Estimators - Null/Undefined Handling', () => {
    it('should handle null input gracefully', () => {
      expect(calculateInteractionBasedHours(null)).toBe(0);
      expect(calculateLocBasedHours(null)).toBe(0);
      expect(calculateLaborCostSaved(null)).toBe(0);
    });

    it('should handle undefined input gracefully', () => {
      expect(calculateInteractionBasedHours(undefined)).toBe(0);
      expect(calculateLocBasedHours(undefined)).toBe(0);
      expect(calculateLaborCostSaved(undefined)).toBe(0);
    });

    it('should handle empty object input to aggregateEstimates', () => {
      const result = aggregateEstimates({});
      expect(result).toBeDefined();
      expect(result.totalHours).toBe(0);
    });

    it('should handle empty array input to aggregateEstimates', () => {
      const result = aggregateEstimates([]);
      expect(result).toBeDefined();
      expect(result.totalHours).toBe(0);
    });
  });

  describe('Estimators - Division by Zero Protection', () => {
    it('should throw for zero interactionsPerHour', () => {
      expect(() => calculateInteractionBasedHours(100, 0)).toThrow();
    });

    it('should throw for zero hoursPerKloc', () => {
      expect(() => calculateLocBasedHours(1000, 0)).toThrow();
    });

    it('should handle zero active users in calculateHoursPerDev', () => {
      const result = calculateHoursPerDev(100, 0);
      expect(result).toBeNull();
    });

    it('should handle zero active users in calculateManualDailyPercentHours', () => {
      expect(calculateManualDailyPercentHours(0)).toBe(0);
    });
  });

  describe('Estimators - Extreme Values', () => {
    it('should handle very large interactions', () => {
      const result = calculateInteractionBasedHours(Number.MAX_SAFE_INTEGER);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle very large LoC', () => {
      const result = calculateLocBasedHours(Number.MAX_SAFE_INTEGER);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle very small decimal numbers', () => {
      const result = calculateInteractionBasedHours(0.001);
      expect(isNaN(result)).toBe(false);
    });

    it('should handle negative numbers (data error)', () => {
      expect(calculateInteractionBasedHours(-100)).toBe(0);
      expect(calculateLocBasedHours(-500)).toBe(0);
      expect(calculateLaborCostSaved(-100)).toBe(0);
    });
  });

  describe('Estimators - Invalid Rate Parameters', () => {
    it('should throw for negative interactionsPerHour', () => {
      expect(() => calculateInteractionBasedHours(100, -5)).toThrow();
    });

    it('should throw for negative hoursPerKloc', () => {
      expect(() => calculateLocBasedHours(1000, -2)).toThrow();
    });

    it('should throw for percentOfBaseline out of range', () => {
      expect(() => calculateManualDailyPercentHours(10, -0.1)).toThrow();
      expect(() => calculateManualDailyPercentHours(10, 1.5)).toThrow();
    });

    it('should throw for negative baseline or workdays', () => {
      expect(() => calculateManualDailyPercentHours(10, 0.2, -30)).toThrow();
      expect(() => calculateManualDailyPercentHours(10, 0.2, 30, -5)).toThrow();
    });
  });

  describe('Data Processor - Error Handling', () => {
    it('should handle null enterprise report', () => {
      const result = processEnterpriseReport(null);
      expect(result).toEqual([]);
    });

    it('should handle undefined enterprise report', () => {
      const result = processEnterpriseReport(undefined);
      expect(result).toEqual([]);
    });

    it('should handle empty object enterprise report', () => {
      const result = processEnterpriseReport({});
      expect(result).toEqual([]);
    });

    it('should handle null user report', () => {
      const result = processUserReport(null);
      expect(result).toEqual([]);
    });

    it('should handle undefined user report', () => {
      const result = processUserReport(undefined);
      expect(result).toEqual([]);
    });

    it('should handle empty array user report', () => {
      const result = processUserReport([]);
      expect(result).toEqual([]);
    });
  });

  describe('Data Processor - flattenDayTotal Edge Cases', () => {
    it('should handle object with missing fields', () => {
      const result = flattenDayTotal({ day: '2024-01-01' });
      expect(result).toBeDefined();
      expect(result.day).toBe('2024-01-01');
      expect(result.interactions).toBe(0);
    });

    it('should handle null breakdown arrays', () => {
      const result = flattenDayTotal({
        day: '2024-01-01',
        totals_by_ide: null,
        totals_by_feature: null,
      });
      expect(result).toBeDefined();
    });

    it('should fall back to IDE-level totals when top-level is zero', () => {
      const result = flattenDayTotal({
        day: '2024-01-01',
        loc_added_sum: 0,
        totals_by_ide: [
          { loc_added_sum: 100, loc_deleted_sum: 20, loc_suggested_to_add_sum: 150, loc_suggested_to_delete_sum: 30 },
          { loc_added_sum: 200, loc_deleted_sum: 40, loc_suggested_to_add_sum: 250, loc_suggested_to_delete_sum: 50 },
        ],
      });
      expect(result.locAdded).toBe(300);
      expect(result.locDeleted).toBe(60);
    });

    it('should extract agent mode interactions from feature breakdown', () => {
      const result = flattenDayTotal({
        day: '2024-01-01',
        totals_by_feature: [
          { feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 42 },
        ],
      });
      expect(result.agentModeInteractions).toBe(42);
    });
  });

  describe('Data Processor - flattenUserRecord Edge Cases', () => {
    it('should handle missing fields', () => {
      const result = flattenUserRecord({ day: '2024-01-01', user_login: 'testuser' });
      expect(result.day).toBe('2024-01-01');
      expect(result.userLogin).toBe('testuser');
      expect(result.interactions).toBe(0);
    });

    it('should fall back to IDE-level loc_added', () => {
      const result = flattenUserRecord({
        day: '2024-01-01',
        user_login: 'testuser',
        loc_added_sum: 0,
        totals_by_ide: [
          { loc_added_sum: 50 },
          { loc_added_sum: 75 },
        ],
      });
      expect(result.locAdded).toBe(125);
    });
  });

  describe('Data Processor - filterByDateRange Edge Cases', () => {
    it('should return all records when no dates specified', () => {
      const records = [{ day: '2024-01-01' }, { day: '2024-01-15' }];
      const result = filterByDateRange(records, null, null);
      expect(result).toHaveLength(2);
    });

    it('should filter correctly with only startDate', () => {
      const records = [{ day: '2024-01-01' }, { day: '2024-01-15' }];
      const result = filterByDateRange(records, '2024-01-10', null);
      expect(result).toHaveLength(1);
      expect(result[0].day).toBe('2024-01-15');
    });

    it('should filter correctly with only endDate', () => {
      const records = [{ day: '2024-01-01' }, { day: '2024-01-15' }];
      const result = filterByDateRange(records, null, '2024-01-10');
      expect(result).toHaveLength(1);
      expect(result[0].day).toBe('2024-01-01');
    });
  });

  describe('Data Processor - filterByUser Edge Cases', () => {
    it('should return all records when no user specified', () => {
      const records = [
        { userLogin: 'user1' },
        { userLogin: 'user2' },
      ];
      const result = filterByUser(records, '');
      expect(result).toHaveLength(2);
    });

    it('should return empty array when user not found', () => {
      const records = [{ userLogin: 'user1' }];
      const result = filterByUser(records, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('Data Processor - aggregateUserRecordsByDay Edge Cases', () => {
    it('should handle records for multiple days', () => {
      const records = [
        { day: '2024-01-01', dailyActiveUsers: 1, interactions: 10, codeGenerations: 5, codeAcceptances: 3, locAdded: 100, userLogin: 'user1' },
        { day: '2024-01-01', dailyActiveUsers: 1, interactions: 20, codeGenerations: 8, codeAcceptances: 6, locAdded: 200, userLogin: 'user2' },
        { day: '2024-01-02', dailyActiveUsers: 1, interactions: 15, codeGenerations: 7, codeAcceptances: 4, locAdded: 150, userLogin: 'user1' },
      ];
      const result = aggregateUserRecordsByDay(records);
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['2024-01-01'].interactions).toBe(30);
      expect(result['2024-01-01'].users).toHaveLength(2);
    });
  });

  describe('Cost Savings - Edge Cases', () => {
    it('should handle zero time savings', () => {
      expect(calculateLaborCostSaved(0, 50)).toBe(0);
    });

    it('should handle very high hourly rates', () => {
      const result = calculateLaborCostSaved(1000, 10000);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should throw for negative hourly rate', () => {
      expect(() => calculateLaborCostSaved(100, -50)).toThrow();
    });
  });

  describe('Type Coercion Tests', () => {
    it('should handle string numbers in interactions', () => {
      // String coerces to NaN via division, so function returns 0 due to !interactions check
      const result = calculateInteractionBasedHours('100');
      expect(isNaN(result)).toBe(false);
    });

    it('should handle boolean values', () => {
      // true coerces to 1
      expect(() => calculateInteractionBasedHours(true)).not.toThrow();
    });
  });

  describe('aggregateEstimates - Edge Cases', () => {
    it('should handle daily data with missing hours', () => {
      const result = aggregateEstimates([
        { activeUsers: 10 },
        { hours: 5, activeUsers: 10 },
      ]);
      expect(result.totalHours).toBe(5);
    });

    it('should handle daily data with zero active users', () => {
      const result = aggregateEstimates([
        { hours: 10, activeUsers: 0 },
      ]);
      expect(result.totalHours).toBe(10);
      expect(result.avgHoursPerDevPerDay).toBeNull();
    });

    it('should handle large dataset', () => {
      const data = Array.from({ length: 365 }, (_, i) => ({
        hours: 100,
        activeUsers: 50,
      }));
      const startTime = Date.now();
      const result = aggregateEstimates(data);
      expect(Date.now() - startTime).toBeLessThan(1000);
      expect(result.totalHours).toBe(36500);
    });
  });
});
