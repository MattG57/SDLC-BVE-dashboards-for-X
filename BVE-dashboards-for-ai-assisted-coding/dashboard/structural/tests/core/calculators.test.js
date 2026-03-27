import { describe, it, expect } from 'vitest';
import {
  groupPrsByDay,
  calculateAdoptionRate,
  calculatePenetration,
  calculatePRAssistanceRate,
  calculateLocShare,
  calculateGapToFullAdoption,
  computeCopilotUsers,
  computeStructuralMetrics
} from '../../src/core/calculators.js';

describe('Structural Calculators', () => {
  describe('calculateAdoptionRate', () => {
    it('should calculate adoption rate correctly', () => {
      expect(calculateAdoptionRate(25, 100)).toBe(0.25);
      expect(calculateAdoptionRate(50, 100)).toBe(0.5);
      expect(calculateAdoptionRate(100, 100)).toBe(1);
    });

    it('should return null when total devs is zero', () => {
      expect(calculateAdoptionRate(10, 0)).toBeNull();
    });

    it('should handle zero active users', () => {
      expect(calculateAdoptionRate(0, 100)).toBe(0);
    });

    it('should handle decimals', () => {
      expect(calculateAdoptionRate(33, 100)).toBe(0.33);
    });
  });

  describe('calculatePenetration', () => {
    it('should calculate penetration correctly', () => {
      // 20 active days out of 28, avg 50 DAU, 200 total devs
      // penetration = (20/28) * 50 / 200 = 0.714 * 0.25 = 0.1785
      const result = calculatePenetration(20, 28, 50, 200);
      expect(result).toBeCloseTo(0.1785, 3);
    });

    it('should return null when totalDays is zero', () => {
      expect(calculatePenetration(20, 0, 50, 200)).toBeNull();
    });

    it('should return null when totalDevs is zero', () => {
      expect(calculatePenetration(20, 28, 50, 0)).toBeNull();
    });

    it('should handle 100% penetration', () => {
      // All days active, DAU equals total devs
      const result = calculatePenetration(28, 28, 200, 200);
      expect(result).toBe(1);
    });

    it('should handle zero active days', () => {
      const result = calculatePenetration(0, 28, 50, 200);
      expect(result).toBe(0);
    });
  });

  describe('calculatePRAssistanceRate', () => {
    it('should calculate PR assistance rate correctly', () => {
      expect(calculatePRAssistanceRate(75, 100)).toBe(0.75);
      expect(calculatePRAssistanceRate(50, 100)).toBe(0.5);
    });

    it('should return null when totalPrs is zero', () => {
      expect(calculatePRAssistanceRate(10, 0)).toBeNull();
    });

    it('should handle 100% assistance', () => {
      expect(calculatePRAssistanceRate(100, 100)).toBe(1);
    });

    it('should handle zero assisted PRs', () => {
      expect(calculatePRAssistanceRate(0, 100)).toBe(0);
    });
  });

  describe('calculateLocShare', () => {
    it('should calculate LoC share correctly', () => {
      expect(calculateLocShare(7500, 10000)).toBe(0.75);
      expect(calculateLocShare(5000, 10000)).toBe(0.5);
    });

    it('should return null when totalLoc is zero', () => {
      expect(calculateLocShare(1000, 0)).toBeNull();
    });

    it('should handle 100% share', () => {
      expect(calculateLocShare(10000, 10000)).toBe(1);
    });

    it('should handle zero assisted LoC', () => {
      expect(calculateLocShare(0, 10000)).toBe(0);
    });
  });

  describe('calculateGapToFullAdoption', () => {
    it('should calculate gap correctly', () => {
      expect(calculateGapToFullAdoption(0.75)).toBe(0.25);
      expect(calculateGapToFullAdoption(0.5)).toBe(0.5);
      expect(calculateGapToFullAdoption(0.25)).toBe(0.75);
    });

    it('should return 0 gap when penetration is 100%', () => {
      expect(calculateGapToFullAdoption(1)).toBe(0);
    });

    it('should return 1 gap when penetration is 0%', () => {
      expect(calculateGapToFullAdoption(0)).toBe(1);
    });

    it('should handle penetration > 1 (capped at 1)', () => {
      expect(calculateGapToFullAdoption(1.5)).toBe(0);
    });

    it('should return 1 when penetration is null', () => {
      expect(calculateGapToFullAdoption(null)).toBe(1);
    });
  });

  describe('computeCopilotUsers', () => {
    it('should build map of active users by day', () => {
      const userDays = [
        { day: '2026-03-01', user_login: 'user1', code_generation_activity_count: 5, user_initiated_interaction_count: 10 },
        { day: '2026-03-01', user_login: 'user2', code_generation_activity_count: 3, user_initiated_interaction_count: 7 },
        { day: '2026-03-02', user_login: 'user1', code_generation_activity_count: 2, user_initiated_interaction_count: 4 },
      ];

      const result = computeCopilotUsers(userDays);

      expect(result['2026-03-01']).toBeInstanceOf(Set);
      expect(result['2026-03-01'].size).toBe(2);
      expect(result['2026-03-01'].has('user1')).toBe(true);
      expect(result['2026-03-01'].has('user2')).toBe(true);
      expect(result['2026-03-02'].size).toBe(1);
      expect(result['2026-03-02'].has('user1')).toBe(true);
    });

    it('should exclude users with zero activity', () => {
      const userDays = [
        { day: '2026-03-01', user_login: 'user1', code_generation_activity_count: 5, user_initiated_interaction_count: 0 },
        { day: '2026-03-01', user_login: 'user2', code_generation_activity_count: 0, user_initiated_interaction_count: 0 },
        { day: '2026-03-01', user_login: 'user3', code_generation_activity_count: 0, user_initiated_interaction_count: 5 },
      ];

      const result = computeCopilotUsers(userDays);

      expect(result['2026-03-01'].size).toBe(2);
      expect(result['2026-03-01'].has('user1')).toBe(true);
      expect(result['2026-03-01'].has('user2')).toBe(false);
      expect(result['2026-03-01'].has('user3')).toBe(true);
    });

    it('should handle empty input', () => {
      const result = computeCopilotUsers([]);
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('groupPrsByDay', () => {
    it('should group PRs by day with assistance detection', () => {
      const prs = [
        { user: 'user1', day: '2026-03-03', loc_changed: 100 },
        { user: 'user2', day: '2026-03-03', loc_changed: 200 },
        { user: 'user3', day: '2026-03-04', loc_changed: 150 },
      ];

      const copilotUsersByDay = {
        '2026-03-01': new Set(['user1']),
        '2026-03-02': new Set(['user1']),
        '2026-03-03': new Set(['user1', 'user2']),
      };

      const result = groupPrsByDay(prs, copilotUsersByDay);

      // user1's PR on 03-03 should be assisted (has activity on 03-01, 03-02, 03-03)
      // user2's PR on 03-03 should be assisted (has activity on 03-03)
      // user3's PR on 03-04 should NOT be assisted (no activity)

      expect(result.period.total_prs).toBe(3);
      expect(result.period.assisted_prs).toBe(2);
      expect(result.period.total_loc).toBe(450);
      expect(result.period.assisted_loc).toBe(300);

      expect(result.byDay['2026-03-03'].total_prs).toBe(2);
      expect(result.byDay['2026-03-03'].assisted_prs).toBe(2);
      expect(result.byDay['2026-03-04'].total_prs).toBe(1);
      expect(result.byDay['2026-03-04'].assisted_prs).toBe(0);
    });

    it('should use 3-day lookback for assistance detection', () => {
      const prs = [
        { user: 'user1', day: '2026-03-05', loc_changed: 100 },
      ];

      // user1 had activity 3 days ago
      const copilotUsersByDay = {
        '2026-03-02': new Set(['user1']),
      };

      const result = groupPrsByDay(prs, copilotUsersByDay);

      // Should still be considered assisted (within 3-day window)
      expect(result.period.assisted_prs).toBe(1);
    });

    it('should not count PRs outside 3-day lookback as assisted', () => {
      const prs = [
        { user: 'user1', day: '2026-03-06', loc_changed: 100 },
      ];

      // user1 had activity 4 days ago
      const copilotUsersByDay = {
        '2026-03-02': new Set(['user1']),
      };

      const result = groupPrsByDay(prs, copilotUsersByDay);

      // Should NOT be assisted (outside 3-day window)
      expect(result.period.assisted_prs).toBe(0);
    });

    it('should handle empty PR list', () => {
      const result = groupPrsByDay([], {});

      expect(result.period.total_prs).toBe(0);
      expect(result.period.assisted_prs).toBe(0);
      expect(result.period.total_loc).toBe(0);
      expect(result.period.assisted_loc).toBe(0);
      expect(Object.keys(result.byDay).length).toBe(0);
    });
  });

  describe('computeStructuralMetrics', () => {
    it('should compute structural metrics for days', () => {
      const entDays = [
        {
          day: '2026-03-01',
          daily_active_users: 50,
          loc_added_sum: 1000,
          loc_deleted_sum: 200
        }
      ];

      const userDays = [
        {
          day: '2026-03-01',
          user_login: 'user1',
          code_generation_activity_count: 10,
          user_initiated_interaction_count: 5
        }
      ];

      const prRecords = [
        { user: 'user1', day: '2026-03-01', loc_changed: 500 }
      ];

      const config = {
        cfg_total_developers: 200,
        cfg_total_dev_loc_added_day: 5000
      };

      const result = computeStructuralMetrics(entDays, userDays, config, prRecords);

      expect(result).toHaveLength(1);
      expect(result[0].adopted_individuals_pct).toBe(0.25); // 50/200
      expect(result[0].has_pr_data).toBe(true);
      expect(result[0].unique_active_users).toBe(1);
    });

    it('should handle missing PR data', () => {
      const entDays = [
        {
          day: '2026-03-01',
          daily_active_users: 50,
          loc_added_sum: 1000
        }
      ];

      const config = {
        cfg_total_developers: 200,
        cfg_total_dev_loc_added_day: 5000
      };

      const result = computeStructuralMetrics(entDays, [], config, null);

      expect(result[0].has_pr_data).toBe(false);
      expect(result[0].adopted_individuals_pct).toBe(0.25);
    });

    it('should attach period-wide PR statistics', () => {
      const entDays = [{ day: '2026-03-01', daily_active_users: 50 }];
      const userDays = [
        { day: '2026-03-01', user_login: 'user1', code_generation_activity_count: 5, user_initiated_interaction_count: 3 }
      ];
      const prRecords = [
        { user: 'user1', day: '2026-03-01', loc_changed: 500 },
        { user: 'user2', day: '2026-03-01', loc_changed: 300 }
      ];
      const config = { cfg_total_developers: 100 };

      const result = computeStructuralMetrics(entDays, userDays, config, prRecords);

      expect(result._prPeriod).toBeDefined();
      expect(result._prPeriod.total_prs).toBe(2);
      expect(result._prPeriod.assisted_prs).toBe(1); // Only user1 has Copilot activity
      expect(result._periodPrsAssistedPct).toBe(0.5);
    });
  });
});
