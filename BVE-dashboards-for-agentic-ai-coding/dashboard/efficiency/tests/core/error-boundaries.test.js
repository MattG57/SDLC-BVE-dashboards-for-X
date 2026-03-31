/**
 * Error Boundary and Edge Case Tests for Agentic AI Coding Dashboard
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDurationBasedHours,
  calculateLocBasedHours,
  calculateLaborCostSaved,
  calculateHoursPerHumanDev,
  aggregateEstimates,
  calculateMergeRate,
} from '../../src/core/estimators.js';
import {
  processMergedPRsByDate,
  countIssuesByDate,
  fillDayGaps,
  processAgenticData,
} from '../../src/core/data-processor.js';

describe('Agentic AI Error Boundary Tests', () => {
  describe('Estimators - calculateDurationBasedHours', () => {
    it('should return 0 for null input', () => {
      expect(calculateDurationBasedHours(null)).toBe(0);
    });

    it('should return 0 for undefined input', () => {
      expect(calculateDurationBasedHours(undefined)).toBe(0);
    });

    it('should return 0 for zero minutes', () => {
      expect(calculateDurationBasedHours(0)).toBe(0);
    });

    it('should return 0 for negative minutes', () => {
      expect(calculateDurationBasedHours(-60)).toBe(0);
    });

    it('should calculate correctly with default ratio', () => {
      // 60 min = 1 hour, * 10 ratio = 10
      expect(calculateDurationBasedHours(60)).toBe(10);
    });

    it('should calculate correctly with custom ratio', () => {
      expect(calculateDurationBasedHours(120, 5)).toBe(10);
    });

    it('should throw for zero ratio', () => {
      expect(() => calculateDurationBasedHours(60, 0)).toThrow();
    });

    it('should throw for negative ratio', () => {
      expect(() => calculateDurationBasedHours(60, -1)).toThrow();
    });
  });

  describe('Estimators - calculateLocBasedHours', () => {
    it('should return 0 for null input', () => {
      expect(calculateLocBasedHours(null)).toBe(0);
    });

    it('should return 0 for zero LoC', () => {
      expect(calculateLocBasedHours(0)).toBe(0);
    });

    it('should return 0 for negative LoC', () => {
      expect(calculateLocBasedHours(-1000)).toBe(0);
    });

    it('should calculate correctly with default hoursPerKloc', () => {
      // 1000 LoC / 1000 * 4 = 4
      expect(calculateLocBasedHours(1000)).toBe(4);
    });

    it('should calculate correctly with custom hoursPerKloc', () => {
      expect(calculateLocBasedHours(2000, 8)).toBe(16);
    });

    it('should throw for zero hoursPerKloc', () => {
      expect(() => calculateLocBasedHours(1000, 0)).toThrow();
    });

    it('should handle very large LoC values', () => {
      const result = calculateLocBasedHours(1000000);
      expect(isFinite(result)).toBe(true);
      expect(result).toBe(4000);
    });
  });

  describe('Estimators - calculateLaborCostSaved', () => {
    it('should return 0 for null hours', () => {
      expect(calculateLaborCostSaved(null)).toBe(0);
    });

    it('should return 0 for zero hours', () => {
      expect(calculateLaborCostSaved(0)).toBe(0);
    });

    it('should return 0 for negative hours', () => {
      expect(calculateLaborCostSaved(-10)).toBe(0);
    });

    it('should calculate with default rate', () => {
      expect(calculateLaborCostSaved(10)).toBe(1500);
    });

    it('should calculate with custom rate', () => {
      expect(calculateLaborCostSaved(10, 200)).toBe(2000);
    });

    it('should throw for zero rate', () => {
      expect(() => calculateLaborCostSaved(10, 0)).toThrow();
    });

    it('should throw for negative rate', () => {
      expect(() => calculateLaborCostSaved(10, -50)).toThrow();
    });
  });

  describe('Estimators - calculateHoursPerHumanDev', () => {
    it('should return null for null devs', () => {
      expect(calculateHoursPerHumanDev(100, null)).toBeNull();
    });

    it('should return null for zero devs', () => {
      expect(calculateHoursPerHumanDev(100, 0)).toBeNull();
    });

    it('should return null for negative devs', () => {
      expect(calculateHoursPerHumanDev(100, -5)).toBeNull();
    });

    it('should calculate correctly', () => {
      expect(calculateHoursPerHumanDev(100, 10)).toBe(10);
    });

    it('should handle very large hour values', () => {
      const result = calculateHoursPerHumanDev(Number.MAX_SAFE_INTEGER, 2);
      expect(isFinite(result)).toBe(true);
    });
  });

  describe('Estimators - aggregateEstimates', () => {
    it('should handle null input', () => {
      const result = aggregateEstimates(null);
      expect(result.totalHours).toBe(0);
      expect(result.daysCount).toBe(0);
    });

    it('should handle empty array', () => {
      const result = aggregateEstimates([]);
      expect(result.totalHours).toBe(0);
      expect(result.avgOrgHoursPerDay).toBe(0);
      expect(result.avgHoursPerHumanDevPerDay).toBeNull();
      expect(result.daysCount).toBe(0);
    });

    it('should handle non-array input', () => {
      const result = aggregateEstimates('not-array');
      expect(result.totalHours).toBe(0);
    });

    it('should aggregate daily data correctly', () => {
      const data = [
        { hours: 10, humanDevs: 5 },
        { hours: 20, humanDevs: 10 },
      ];
      const result = aggregateEstimates(data);
      expect(result.totalHours).toBe(30);
      expect(result.avgOrgHoursPerDay).toBe(15);
      expect(result.daysCount).toBe(2);
    });

    it('should handle days with zero humanDevs', () => {
      const data = [
        { hours: 10, humanDevs: 5 },
        { hours: 0, humanDevs: 0 },
      ];
      const result = aggregateEstimates(data);
      expect(result.avgHoursPerHumanDevPerDay).toBe(2); // 10/5 = 2, only 1 valid day
    });

    it('should handle missing hours field', () => {
      const data = [{ humanDevs: 5 }];
      const result = aggregateEstimates(data);
      expect(result.totalHours).toBe(0);
    });
  });

  describe('Estimators - calculateMergeRate', () => {
    it('should return null for null prsCreated', () => {
      expect(calculateMergeRate(10, null)).toBeNull();
    });

    it('should return null for zero prsCreated', () => {
      expect(calculateMergeRate(10, 0)).toBeNull();
    });

    it('should return null for negative prsCreated', () => {
      expect(calculateMergeRate(10, -5)).toBeNull();
    });

    it('should return null for negative prsMerged', () => {
      expect(calculateMergeRate(-5, 10)).toBeNull();
    });

    it('should cap at 1.0 when merged exceeds created', () => {
      expect(calculateMergeRate(15, 10)).toBe(1.0);
    });

    it('should calculate normal merge rate', () => {
      expect(calculateMergeRate(7, 10)).toBe(0.7);
    });

    it('should handle zero merged', () => {
      expect(calculateMergeRate(0, 10)).toBe(0);
    });
  });

  describe('Data Processor - processMergedPRsByDate', () => {
    it('should skip non-merged PRs', () => {
      const prs = [
        { pr_created_at: '2024-01-01T00:00:00Z', pr_merged_at: null, additions: 100 },
      ];
      const result = processMergedPRsByDate(prs);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should aggregate merged PRs by date', () => {
      const prs = [
        { pr_created_at: '2024-01-01T00:00:00Z', pr_merged_at: '2024-01-02T00:00:00Z', additions: 100, deletions: 10 },
        { pr_created_at: '2024-01-01T00:00:00Z', pr_merged_at: '2024-01-03T00:00:00Z', additions: 200, deletions: 20 },
      ];
      const result = processMergedPRsByDate(prs);
      expect(result['2024-01-01'].locAdded).toBe(300);
      expect(result['2024-01-01'].locDeleted).toBe(30);
    });

    it('should only sum agent session minutes', () => {
      const prs = [
        { pr_created_at: '2024-01-01T00:00:00Z', pr_merged_at: '2024-01-02T00:00:00Z', duration_type: 'agent', duration_minutes: 30 },
        { pr_created_at: '2024-01-01T00:00:00Z', pr_merged_at: '2024-01-02T00:00:00Z', duration_type: 'human', duration_minutes: 60 },
      ];
      const result = processMergedPRsByDate(prs);
      expect(result['2024-01-01'].sessionMinutes).toBe(30);
    });

    it('should handle PRs with missing pr_created_at', () => {
      const prs = [
        { pr_merged_at: '2024-01-02T00:00:00Z', additions: 100 },
      ];
      const result = processMergedPRsByDate(prs);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle missing additions/deletions', () => {
      const prs = [
        { pr_created_at: '2024-01-01T00:00:00Z', pr_merged_at: '2024-01-02T00:00:00Z' },
      ];
      const result = processMergedPRsByDate(prs);
      expect(result['2024-01-01'].locAdded).toBe(0);
      expect(result['2024-01-01'].locDeleted).toBe(0);
    });
  });

  describe('Data Processor - countIssuesByDate', () => {
    it('should count unique issues by date', () => {
      const requests = [
        { issue_number: 1, issue_created_at: '2024-01-01T00:00:00Z' },
        { issue_number: 2, issue_created_at: '2024-01-01T00:00:00Z' },
        { issue_number: 3, issue_created_at: '2024-01-02T00:00:00Z' },
      ];
      const result = countIssuesByDate(requests);
      expect(result['2024-01-01']).toBe(2);
      expect(result['2024-01-02']).toBe(1);
    });

    it('should deduplicate issues', () => {
      const requests = [
        { issue_number: 1, issue_created_at: '2024-01-01T00:00:00Z' },
        { issue_number: 1, issue_created_at: '2024-01-01T00:00:00Z' },
      ];
      const result = countIssuesByDate(requests);
      expect(result['2024-01-01']).toBe(1);
    });

    it('should skip pull requests', () => {
      const requests = [
        { issue_number: 1, issue_created_at: '2024-01-01T00:00:00Z', is_pull_request: true },
      ];
      const result = countIssuesByDate(requests);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should skip entries without issue_number', () => {
      const requests = [
        { issue_created_at: '2024-01-01T00:00:00Z' },
      ];
      const result = countIssuesByDate(requests);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('Data Processor - fillDayGaps', () => {
    it('should return empty array for empty input', () => {
      const result = fillDayGaps([]);
      expect(result).toEqual([]);
    });

    it('should fill gaps with zero-value records', () => {
      const data = [
        { date: '2024-01-28', agentActiveDevs: 5 },
      ];
      const result = fillDayGaps(data, 3);
      expect(result).toHaveLength(3);
      expect(result[0].agentActiveDevs).toBe(0); // gap-filled
      expect(result[2].agentActiveDevs).toBe(5); // original
    });

    it('should use data-derived end date', () => {
      const data = [
        { date: '2024-01-25', agentActiveDevs: 3 },
        { date: '2024-01-28', agentActiveDevs: 5 },
      ];
      const result = fillDayGaps(data, 5);
      expect(result).toHaveLength(5);
      expect(result[result.length - 1].date).toBe('2024-01-28');
    });

    it('should preserve existing records', () => {
      const data = [
        { date: '2024-01-27', agentActiveDevs: 3 },
        { date: '2024-01-28', agentActiveDevs: 5 },
      ];
      const result = fillDayGaps(data, 2);
      expect(result[0].agentActiveDevs).toBe(3);
      expect(result[1].agentActiveDevs).toBe(5);
    });
  });

  describe('Data Processor - processAgenticData', () => {
    it('should handle empty data object', () => {
      const result = processAgenticData({});
      expect(result.days).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalPRs).toBe(0);
      expect(result.metadata.totalRequests).toBe(0);
    });

    it('should handle missing fields', () => {
      const result = processAgenticData({ developer_day_summary: [] });
      expect(result.days).toEqual([]);
      expect(result.metadata.daysWithActivity).toBe(0);
    });

    it('should process complete dataset', () => {
      const data = {
        developer_day_summary: [
          {
            date: '2024-01-28',
            total_agent_requests: 10,
            agent_prs_created: 2,
            agent_prs_merged: 1,
            agent_loc_added: 500,
            agent_loc_deleted: 50,
            agent_session_minutes: 120,
          },
        ],
        pr_sessions: [
          {
            pr_created_at: '2024-01-28T00:00:00Z',
            pr_merged_at: '2024-01-29T00:00:00Z',
            additions: 500,
            deletions: 50,
            duration_type: 'agent',
            duration_minutes: 120,
          },
        ],
        requests: [],
      };
      const result = processAgenticData(data);
      expect(result.metadata.daysWithActivity).toBe(1);
      expect(result.metadata.totalPRs).toBe(1);
    });
  });

  describe('Extreme Values', () => {
    it('should handle very large session minutes', () => {
      const result = calculateDurationBasedHours(Number.MAX_SAFE_INTEGER / 60);
      expect(isFinite(result)).toBe(true);
    });

    it('should handle very large LoC values in processMergedPRsByDate', () => {
      const prs = [
        {
          pr_created_at: '2024-01-01T00:00:00Z',
          pr_merged_at: '2024-01-02T00:00:00Z',
          additions: Number.MAX_SAFE_INTEGER / 2,
          deletions: Number.MAX_SAFE_INTEGER / 2,
        },
      ];
      const result = processMergedPRsByDate(prs);
      expect(isFinite(result['2024-01-01'].locAdded)).toBe(true);
    });
  });

  describe('Type Coercion Tests', () => {
    it('should handle string numbers in calculateDurationBasedHours', () => {
      // '60' is falsy-checked but truthy, then math coerces
      const result = calculateDurationBasedHours('60');
      expect(typeof result).toBe('number');
    });

    it('should treat NaN as zero in calculateLocBasedHours', () => {
      expect(calculateLocBasedHours(NaN)).toBe(0);
    });
  });
});
