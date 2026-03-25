/**
 * Integration tests for the complete data processing pipeline
 * 
 * Uses synthetic input data that matches real API structure
 * Validates end-to-end transformation and calculation flow
 */

import { describe, it, expect } from 'vitest';
import {
  processEnterpriseReport,
  processUserReport,
  aggregateUserRecordsByDay,
} from '../../src/core/data-processor.js';
import {
  calculateInteractionBasedHours,
  calculateLocBasedHours,
  calculateManualDailyPercentHours,
  aggregateEstimates,
} from '../../src/core/estimators.js';

/**
 * Synthetic input data that matches real Copilot API structure
 * This represents a known scenario with predictable outputs
 */
const SYNTHETIC_INPUT = {
  enterprise_report: {
    day_totals: [
      {
        day: '2024-03-23',
        enterprise_id: 'test-enterprise',
        daily_active_users: 10,
        user_initiated_interaction_count: 200,  // 200/20 = 10 hrs
        code_generation_activity_count: 100,
        code_acceptance_activity_count: 85,
        loc_added_sum: 1000,  // 1000/1000 * 2 = 2 hrs
        loc_deleted_sum: 200,
        pull_requests: {
          total_created: 5,
          total_reviewed: 8
        }
      },
      {
        day: '2024-03-24',
        enterprise_id: 'test-enterprise',
        daily_active_users: 10,
        user_initiated_interaction_count: 400,  // 400/20 = 20 hrs
        code_generation_activity_count: 200,
        code_acceptance_activity_count: 170,
        loc_added_sum: 2000,  // 2000/1000 * 2 = 4 hrs
        loc_deleted_sum: 400,
        pull_requests: {
          total_created: 10,
          total_reviewed: 15
        }
      },
      {
        day: '2024-03-25',
        enterprise_id: 'test-enterprise',
        daily_active_users: 10,
        user_initiated_interaction_count: 600,  // 600/20 = 30 hrs
        code_generation_activity_count: 300,
        code_acceptance_activity_count: 255,
        loc_added_sum: 3000,  // 3000/1000 * 2 = 6 hrs
        loc_deleted_sum: 600,
        pull_requests: {
          total_created: 15,
          total_reviewed: 22
        },
        totals_by_feature: [
          {
            feature: 'code_completion',
            user_initiated_interaction_count: 500
          },
          {
            feature: 'chat_panel_agent_mode',
            user_initiated_interaction_count: 100
          }
        ]
      }
    ]
  },
  user_report: [
    // Day 1
    { day: '2024-03-23', user_login: 'dev1', daily_active_users: 1, user_initiated_interaction_count: 40, loc_added_sum: 200 },
    { day: '2024-03-23', user_login: 'dev2', daily_active_users: 1, user_initiated_interaction_count: 60, loc_added_sum: 300 },
    { day: '2024-03-23', user_login: 'dev3', daily_active_users: 1, user_initiated_interaction_count: 100, loc_added_sum: 500 },
    // Day 2
    { day: '2024-03-24', user_login: 'dev1', daily_active_users: 1, user_initiated_interaction_count: 80, loc_added_sum: 400 },
    { day: '2024-03-24', user_login: 'dev2', daily_active_users: 1, user_initiated_interaction_count: 120, loc_added_sum: 600 },
    { day: '2024-03-24', user_login: 'dev3', daily_active_users: 1, user_initiated_interaction_count: 200, loc_added_sum: 1000 },
    // Day 3
    { day: '2024-03-25', user_login: 'dev1', daily_active_users: 1, user_initiated_interaction_count: 120, loc_added_sum: 600 },
    { day: '2024-03-25', user_login: 'dev2', daily_active_users: 1, user_initiated_interaction_count: 180, loc_added_sum: 900 },
    { day: '2024-03-25', user_login: 'dev3', daily_active_users: 1, user_initiated_interaction_count: 300, loc_added_sum: 1500 },
  ]
};

/**
 * Expected outputs for the synthetic input
 * These are the "known good" values we should always get
 */
const EXPECTED_OUTPUTS = {
  // Enterprise report processing
  enterpriseDays: 3,
  enterpriseTotalInteractions: 1200,  // 200 + 400 + 600
  enterpriseTotalLocAdded: 6000,      // 1000 + 2000 + 3000
  
  // User report processing
  userRecords: 9,  // 3 users * 3 days
  userTotalInteractions: 1200,  // Should match enterprise
  userTotalLocAdded: 6000,      // Should match enterprise
  
  // Interactions-based estimation (default: 20 interactions per hour)
  interactionBased: {
    day1Hours: 10,   // 200 / 20
    day2Hours: 20,   // 400 / 20
    day3Hours: 30,   // 600 / 20
    totalHours: 60,  // 10 + 20 + 30
    avgOrgHoursPerDay: 20,  // 60 / 3
    avgHoursPerDevPerDay: 2,  // (10/10 + 20/10 + 30/10) / 3 = (1+2+3)/3
  },
  
  // LoC-based estimation (default: 2 hours per 1000 LoC)
  locBased: {
    day1Hours: 2,    // (1000 / 1000) * 2
    day2Hours: 4,    // (2000 / 1000) * 2
    day3Hours: 6,    // (3000 / 1000) * 2
    totalHours: 12,  // 2 + 4 + 6
    avgOrgHoursPerDay: 4,  // 12 / 3
    avgHoursPerDevPerDay: 0.4,  // (2/10 + 4/10 + 6/10) / 3 = (0.2+0.4+0.6)/3
  },
  
  // Manual daily % (default: 20% of 30 hrs/week / 5 days = 1.2 hrs/dev/day)
  manualDailyPct: {
    hoursPerDevPerDay: 1.2,
    totalHoursPerDay: 12,  // 1.2 * 10 devs
    totalHours: 36,        // 12 * 3 days
    avgOrgHoursPerDay: 12,
    avgHoursPerDevPerDay: 1.2,
  }
};

describe('Integration Tests - Complete Pipeline', () => {
  describe('Data Processing Pipeline', () => {
    it('processes enterprise report correctly', () => {
      const result = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      
      expect(result).toHaveLength(EXPECTED_OUTPUTS.enterpriseDays);
      
      const totalInteractions = result.reduce((sum, day) => sum + day.interactions, 0);
      expect(totalInteractions).toBe(EXPECTED_OUTPUTS.enterpriseTotalInteractions);
      
      const totalLocAdded = result.reduce((sum, day) => sum + day.locAdded, 0);
      expect(totalLocAdded).toBe(EXPECTED_OUTPUTS.enterpriseTotalLocAdded);
    });

    it('processes user report correctly', () => {
      const result = processUserReport(SYNTHETIC_INPUT.user_report);
      
      expect(result).toHaveLength(EXPECTED_OUTPUTS.userRecords);
      
      const totalInteractions = result.reduce((sum, rec) => sum + rec.interactions, 0);
      expect(totalInteractions).toBe(EXPECTED_OUTPUTS.userTotalInteractions);
      
      const totalLocAdded = result.reduce((sum, rec) => sum + rec.locAdded, 0);
      expect(totalLocAdded).toBe(EXPECTED_OUTPUTS.userTotalLocAdded);
    });

    it('reconciles enterprise and user reports', () => {
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      const userData = processUserReport(SYNTHETIC_INPUT.user_report);
      const userByDay = aggregateUserRecordsByDay(userData);
      
      // For each day, enterprise and user totals should match
      enterpriseData.forEach(day => {
        const userDay = userByDay[day.day];
        expect(userDay).toBeDefined();
        expect(userDay.interactions).toBe(day.interactions);
        expect(userDay.locAdded).toBe(day.locAdded);
      });
    });
  });

  describe('Interactions-Based Estimation Pipeline', () => {
    it('calculates daily hours correctly', () => {
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      
      const dailyHours = enterpriseData.map(day => 
        calculateInteractionBasedHours(day.interactions, 20)
      );
      
      expect(dailyHours[0]).toBe(EXPECTED_OUTPUTS.interactionBased.day1Hours);
      expect(dailyHours[1]).toBe(EXPECTED_OUTPUTS.interactionBased.day2Hours);
      expect(dailyHours[2]).toBe(EXPECTED_OUTPUTS.interactionBased.day3Hours);
    });

    it('aggregates to correct totals', () => {
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      
      const dailyData = enterpriseData.map(day => ({
        hours: calculateInteractionBasedHours(day.interactions, 20),
        activeUsers: day.dailyActiveUsers
      }));
      
      const aggregated = aggregateEstimates(dailyData);
      
      expect(aggregated.totalHours).toBe(EXPECTED_OUTPUTS.interactionBased.totalHours);
      expect(aggregated.avgOrgHoursPerDay).toBe(EXPECTED_OUTPUTS.interactionBased.avgOrgHoursPerDay);
      expect(aggregated.avgHoursPerDevPerDay).toBe(EXPECTED_OUTPUTS.interactionBased.avgHoursPerDevPerDay);
    });
  });

  describe('LoC-Based Estimation Pipeline', () => {
    it('calculates daily hours correctly', () => {
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      
      const dailyHours = enterpriseData.map(day => 
        calculateLocBasedHours(day.locAdded, 2)
      );
      
      expect(dailyHours[0]).toBe(EXPECTED_OUTPUTS.locBased.day1Hours);
      expect(dailyHours[1]).toBe(EXPECTED_OUTPUTS.locBased.day2Hours);
      expect(dailyHours[2]).toBe(EXPECTED_OUTPUTS.locBased.day3Hours);
    });

    it('aggregates to correct totals', () => {
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      
      const dailyData = enterpriseData.map(day => ({
        hours: calculateLocBasedHours(day.locAdded, 2),
        activeUsers: day.dailyActiveUsers
      }));
      
      const aggregated = aggregateEstimates(dailyData);
      
      expect(aggregated.totalHours).toBe(EXPECTED_OUTPUTS.locBased.totalHours);
      expect(aggregated.avgOrgHoursPerDay).toBe(EXPECTED_OUTPUTS.locBased.avgOrgHoursPerDay);
      expect(aggregated.avgHoursPerDevPerDay).toBeCloseTo(EXPECTED_OUTPUTS.locBased.avgHoursPerDevPerDay, 2);
    });
  });

  describe('Manual Daily % Estimation Pipeline', () => {
    it('calculates consistent hours per developer per day', () => {
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      
      // Manual daily % should give same hrs/dev/day regardless of active users
      const dailyHours = enterpriseData.map(day => 
        calculateManualDailyPercentHours(day.dailyActiveUsers, 0.20, 30, 5)
      );
      
      // Each day should be 1.2 hrs/dev/day * 10 devs = 12 hrs org total
      expect(dailyHours[0]).toBe(EXPECTED_OUTPUTS.manualDailyPct.totalHoursPerDay);
      expect(dailyHours[1]).toBe(EXPECTED_OUTPUTS.manualDailyPct.totalHoursPerDay);
      expect(dailyHours[2]).toBe(EXPECTED_OUTPUTS.manualDailyPct.totalHoursPerDay);
    });

    it('aggregates to correct totals', () => {
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      
      const dailyData = enterpriseData.map(day => ({
        hours: calculateManualDailyPercentHours(day.dailyActiveUsers, 0.20, 30, 5),
        activeUsers: day.dailyActiveUsers
      }));
      
      const aggregated = aggregateEstimates(dailyData);
      
      expect(aggregated.totalHours).toBe(EXPECTED_OUTPUTS.manualDailyPct.totalHours);
      expect(aggregated.avgOrgHoursPerDay).toBe(EXPECTED_OUTPUTS.manualDailyPct.avgOrgHoursPerDay);
      expect(aggregated.avgHoursPerDevPerDay).toBe(EXPECTED_OUTPUTS.manualDailyPct.avgHoursPerDevPerDay);
    });
  });

  describe('Edge Cases with Real-World Data Shapes', () => {
    it('handles missing IDE-level data by falling back to top-level', () => {
      const input = {
        enterprise_report: {
          day_totals: [{
            day: '2024-03-23',
            daily_active_users: 5,
            loc_added_sum: 0,  // Missing at top level
            totals_by_ide: [
              { loc_added_sum: 100 },
              { loc_added_sum: 200 }
            ]
          }]
        }
      };
      
      const result = processEnterpriseReport(input.enterprise_report);
      expect(result[0].locAdded).toBe(300);  // Falls back to IDE sum
    });

    it('handles days with zero active users', () => {
      const input = {
        enterprise_report: {
          day_totals: [
            { day: '2024-03-23', daily_active_users: 10, user_initiated_interaction_count: 200 },
            { day: '2024-03-24', daily_active_users: 0, user_initiated_interaction_count: 0 },  // Weekend
            { day: '2024-03-25', daily_active_users: 10, user_initiated_interaction_count: 200 }
          ]
        }
      };
      
      const enterpriseData = processEnterpriseReport(input.enterprise_report);
      const dailyData = enterpriseData.map(day => ({
        hours: calculateInteractionBasedHours(day.interactions, 20),
        activeUsers: day.dailyActiveUsers
      }));
      
      const aggregated = aggregateEstimates(dailyData);
      
      // Should exclude zero-user day from per-dev average
      expect(aggregated.avgHoursPerDevPerDay).toBe(1);  // (10 + 10) / 2 days with users
    });

    it('extracts agent mode interactions from feature breakdown', () => {
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      const day3 = enterpriseData[2];  // Only day 3 has feature breakdown
      
      expect(day3.agentModeInteractions).toBe(100);
    });
  });

  describe('Regression Tests - Known Issues', () => {
    it('validates that enterprise and user totals match', () => {
      // This catches the reconciliation issues noted in verify_math.cjs
      const enterpriseData = processEnterpriseReport(SYNTHETIC_INPUT.enterprise_report);
      const userData = processUserReport(SYNTHETIC_INPUT.user_report);
      const userByDay = aggregateUserRecordsByDay(userData);
      
      let mismatches = 0;
      enterpriseData.forEach(day => {
        const userDay = userByDay[day.day];
        if (day.interactions !== userDay.interactions) {
          mismatches++;
        }
      });
      
      expect(mismatches).toBe(0);  // No mismatches in our synthetic data
    });
  });
});
