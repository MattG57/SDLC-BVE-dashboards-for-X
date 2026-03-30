/**
 * Error Boundary and Edge Case Tests for Structural Quality Dashboard
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAdoptionRate,
  calculatePenetration,
  calculatePRAssistanceRate,
  calculateLocShare,
  calculateGapToFullAdoption,
  groupPrsByDay,
  computeCopilotUsers,
} from '../../src/core/calculators.js';
import {
  flattenDayTotal,
  flattenUserReport,
  isBot,
  flattenPrReview,
  processStructuralMetrics,
} from '../../src/core/data-processor.js';

describe('Structural Dashboard Error Boundaries', () => {
  describe('Calculator - Null/Undefined Handling', () => {
    it('should handle null inputs in calculateAdoptionRate', () => {
      const result = calculateAdoptionRate(null, 100);
      expect(result).toBeNull();
    });

    it('should handle undefined inputs in calculateAdoptionRate', () => {
      const result = calculateAdoptionRate(undefined, 100);
      expect(result).toBeNull();
    });

    it('should handle zero totalDevs in calculateAdoptionRate', () => {
      const result = calculateAdoptionRate(10, 0);
      expect(result).toBeNull();
    });

    it('should handle negative active users', () => {
      const result = calculateAdoptionRate(-5, 100);
      expect(result).toBeNull();
    });

    it('should handle negative total devs', () => {
      const result = calculateAdoptionRate(50, -100);
      expect(result).toBeNull();
    });

    it('should cap at 1.0 when active users exceeds total', () => {
      const result = calculateAdoptionRate(150, 100);
      expect(result).toBe(1.0);
    });
  });

  describe('Calculator - calculatePenetration Edge Cases', () => {
    it('should handle zero totalDays', () => {
      const result = calculatePenetration(20, 0, 50, 200);
      expect(result).toBeNull();
    });

    it('should handle zero totalDevs', () => {
      const result = calculatePenetration(20, 28, 50, 0);
      expect(result).toBeNull();
    });

    it('should handle negative inputs', () => {
      expect(calculatePenetration(-5, 28, 50, 200)).toBeNull();
      expect(calculatePenetration(20, -28, 50, 200)).toBeNull();
      expect(calculatePenetration(20, 28, -50, 200)).toBeNull();
      expect(calculatePenetration(20, 28, 50, -200)).toBeNull();
    });

    it('should cap result at 1.0', () => {
      const result = calculatePenetration(28, 28, 500, 10);
      expect(result).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Calculator - calculatePRAssistanceRate Edge Cases', () => {
    it('should handle zero total PRs', () => {
      const result = calculatePRAssistanceRate(10, 0);
      expect(result).toBeNull();
    });

    it('should handle zero assisted PRs', () => {
      const result = calculatePRAssistanceRate(0, 100);
      expect(result).toBe(0);
    });

    it('should return valid ratio for normal inputs', () => {
      const result = calculatePRAssistanceRate(75, 100);
      expect(result).toBe(0.75);
    });
  });

  describe('Calculator - calculateLocShare Edge Cases', () => {
    it('should handle zero total LoC', () => {
      const result = calculateLocShare(100, 0);
      expect(result).toBeNull();
    });

    it('should handle zero assisted LoC', () => {
      const result = calculateLocShare(0, 1000);
      expect(result).toBe(0);
    });
  });

  describe('Calculator - calculateGapToFullAdoption Edge Cases', () => {
    it('should handle null penetration rate', () => {
      expect(calculateGapToFullAdoption(null)).toBe(1);
    });

    it('should handle zero penetration', () => {
      expect(calculateGapToFullAdoption(0)).toBe(1);
    });

    it('should handle full penetration', () => {
      expect(calculateGapToFullAdoption(1)).toBe(0);
    });

    it('should handle penetration > 1', () => {
      expect(calculateGapToFullAdoption(1.5)).toBe(0);
    });
  });

  describe('Calculator - groupPrsByDay Edge Cases', () => {
    it('should handle empty PR array', () => {
      const result = groupPrsByDay([], {});
      expect(result.period.total_prs).toBe(0);
      expect(result.period.assisted_prs).toBe(0);
    });

    it('should handle empty copilot users map', () => {
      const prs = [{ user: 'dev1', day: '2024-01-01', loc_changed: 100 }];
      const result = groupPrsByDay(prs, {});
      expect(result.period.total_prs).toBe(1);
      expect(result.period.assisted_prs).toBe(0);
    });

    it('should flag assisted PRs with 3-day lookback', () => {
      const prs = [{ user: 'dev1', day: '2024-01-03', loc_changed: 100 }];
      const copilotUsers = { '2024-01-01': new Set(['dev1']) };
      const result = groupPrsByDay(prs, copilotUsers);
      expect(result.period.assisted_prs).toBe(1);
    });
  });

  describe('Calculator - computeCopilotUsers Edge Cases', () => {
    it('should handle empty array', () => {
      const result = computeCopilotUsers([]);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should exclude users with zero activity', () => {
      const userDays = [
        { day: '2024-01-01', user_login: 'idle', code_generation_activity_count: 0, user_initiated_interaction_count: 0 },
      ];
      const result = computeCopilotUsers(userDays);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should include users with code generation activity', () => {
      const userDays = [
        { day: '2024-01-01', user_login: 'active', code_generation_activity_count: 5, user_initiated_interaction_count: 0 },
      ];
      const result = computeCopilotUsers(userDays);
      expect(result['2024-01-01'].has('active')).toBe(true);
    });
  });

  describe('Data Processor - isBot Edge Cases', () => {
    it('should treat null login as bot', () => {
      expect(isBot(null)).toBe(true);
    });

    it('should treat undefined login as bot', () => {
      expect(isBot(undefined)).toBe(true);
    });

    it('should treat empty string as bot', () => {
      expect(isBot('')).toBe(true);
    });

    it('should detect [bot] suffix', () => {
      expect(isBot('dependabot[bot]')).toBe(true);
    });

    it('should detect -bot suffix', () => {
      expect(isBot('renovate-bot')).toBe(true);
    });

    it('should not flag normal user logins', () => {
      expect(isBot('johndoe')).toBe(false);
      expect(isBot('alice-smith')).toBe(false);
    });
  });

  describe('Data Processor - flattenDayTotal Edge Cases', () => {
    it('should handle missing fields', () => {
      const result = flattenDayTotal({ day: '2024-01-01' });
      expect(result).toBeDefined();
      expect(result.day).toBe('2024-01-01');
      expect(result.daily_active_users).toBe(0);
    });

    it('should aggregate from IDE totals when top-level is zero', () => {
      const result = flattenDayTotal({
        day: '2024-01-01',
        loc_added_sum: 0,
        totals_by_ide: [
          { loc_added_sum: 100, loc_deleted_sum: 10, loc_suggested_to_add_sum: 150, loc_suggested_to_delete_sum: 20 },
        ],
      });
      expect(result.loc_added_sum).toBe(100);
    });
  });

  describe('Data Processor - flattenUserReport Edge Cases', () => {
    it('should handle empty array', () => {
      const result = flattenUserReport([]);
      expect(result).toEqual([]);
    });

    it('should handle records with missing fields', () => {
      const result = flattenUserReport([{ day: '2024-01-01', user_login: 'test' }]);
      expect(result).toHaveLength(1);
      expect(result[0].user_initiated_interaction_count).toBe(0);
    });
  });

  describe('Data Processor - flattenPrReview Edge Cases', () => {
    it('should handle empty array', () => {
      const result = flattenPrReview([]);
      expect(result.all).toEqual([]);
      expect(result.filtered).toEqual([]);
    });

    it('should handle null input', () => {
      const result = flattenPrReview(null);
      expect(result.all).toEqual([]);
    });

    it('should handle nested pull_requests.prs format', () => {
      const data = {
        pull_requests: {
          prs: [{ user: 'dev1', created_at: '2024-01-01T00:00:00Z', additions: 10, deletions: 5 }],
        },
      };
      const result = flattenPrReview(data);
      expect(result.all).toHaveLength(1);
    });

    it('should filter out bot PRs', () => {
      const prs = [
        { user: 'dev1', created_at: '2024-01-01T00:00:00Z', additions: 10 },
        { user: 'dependabot[bot]', created_at: '2024-01-01T00:00:00Z', additions: 5 },
      ];
      const result = flattenPrReview(prs);
      expect(result.all).toHaveLength(2);
      expect(result.filtered).toHaveLength(1);
    });
  });

  describe('Data Processor - processStructuralMetrics Edge Cases', () => {
    it('should handle null enterprise data', () => {
      const result = processStructuralMetrics(null, null, null, {});
      expect(result.entDays).toEqual([]);
      expect(result.userDays).toEqual([]);
    });

    it('should handle empty enterprise data', () => {
      const result = processStructuralMetrics({}, {}, null, {});
      expect(result.entDays).toEqual([]);
    });

    it('should handle missing user report', () => {
      const result = processStructuralMetrics(
        { enterprise_report: { day_totals: [{ day: '2024-01-01' }] } },
        {},
        null,
        {}
      );
      expect(result.entDays).toHaveLength(1);
      expect(result.userDays).toEqual([]);
    });
  });

  describe('Extreme Values', () => {
    it('should handle very large numbers in adoption rate', () => {
      const result = calculateAdoptionRate(Number.MAX_SAFE_INTEGER / 2, Number.MAX_SAFE_INTEGER);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
    });

    it('should handle very large PR counts', () => {
      const result = calculatePRAssistanceRate(Number.MAX_SAFE_INTEGER / 2, Number.MAX_SAFE_INTEGER);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
    });
  });

  describe('Type Coercion Tests', () => {
    it('should handle string PR numbers in flattenPrReview', () => {
      const prs = [
        { user: 'dev1', created_at: '2024-01-01T00:00:00Z', number: '123', additions: 10 },
      ];
      expect(() => flattenPrReview(prs)).not.toThrow();
    });
  });
});
