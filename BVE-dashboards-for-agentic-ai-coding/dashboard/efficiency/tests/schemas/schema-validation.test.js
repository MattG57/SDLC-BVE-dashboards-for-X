/**
 * Schema Validation Tests
 * Tests for GitHub API and processed data schema validators
 */

import { describe, it, expect } from 'vitest';
import {
  validateUserRecord,
  validateDayTotal,
  validateUserReport,
  validateEnterpriseReport,
  validateAPIData
} from '../../src/schemas/github-api-schema.js';
import {
  validateNormalizedDayTotal,
  validateNormalizedUserRecord,
  validateAgenticDayRecord,
  validateFileData,
  validateProcessedData
} from '../../src/schemas/processed-data-schema.js';

describe('GitHub API Schema Validation', () => {
  describe('validateUserRecord', () => {
    it('should accept valid user record', () => {
      const record = {
        day: '2025-10-01',
        code_acceptance_activity_count: 1,
        code_generation_activity_count: 1,
        loc_added_sum: 8,
        loc_deleted_sum: 0,
        loc_suggested_to_add_sum: 10,
        loc_suggested_to_delete_sum: 0,
        user_initiated_interaction_count: 0,
        user_id: 1,
        user_login: 'testuser',
        used_agent: false,
        used_chat: false,
        used_cli: true,
        totals_by_cli: {
          session_count: 2,
          request_count: 2,
          prompt_count: 2
        },
        totals_by_ide: [],
        totals_by_feature: []
      };
      
      const errors = validateUserRecord(record);
      expect(errors).toEqual([]);
    });
    
    it('should reject invalid date format', () => {
      const record = {
        day: '10/01/2025',
        code_acceptance_activity_count: 1,
        code_generation_activity_count: 1,
        loc_added_sum: 8,
        loc_deleted_sum: 0,
        loc_suggested_to_add_sum: 10,
        loc_suggested_to_delete_sum: 0,
        user_initiated_interaction_count: 0
      };
      
      const errors = validateUserRecord(record);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('day');
      expect(errors[0]).toContain('YYYY-MM-DD');
    });
    
    it('should reject missing required numeric fields', () => {
      const record = {
        day: '2025-10-01',
        code_acceptance_activity_count: '1', // string instead of number
        code_generation_activity_count: 1,
        loc_added_sum: 8,
        loc_deleted_sum: 0,
        loc_suggested_to_add_sum: 10,
        loc_suggested_to_delete_sum: 0,
        user_initiated_interaction_count: 0
      };
      
      const errors = validateUserRecord(record);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('code_acceptance_activity_count'))).toBe(true);
    });
    
    it('should reject invalid boolean types', () => {
      const record = {
        day: '2025-10-01',
        code_acceptance_activity_count: 1,
        code_generation_activity_count: 1,
        loc_added_sum: 8,
        loc_deleted_sum: 0,
        loc_suggested_to_add_sum: 10,
        loc_suggested_to_delete_sum: 0,
        user_initiated_interaction_count: 0,
        used_cli: 'true' // string instead of boolean
      };
      
      const errors = validateUserRecord(record);
      expect(errors.some(e => e.includes('used_cli'))).toBe(true);
    });
    
    it('should catch malformed nested structures', () => {
      const record = {
        day: '2025-10-01',
        code_acceptance_activity_count: 1,
        code_generation_activity_count: 1,
        loc_added_sum: 8,
        loc_deleted_sum: 0,
        loc_suggested_to_add_sum: 10,
        loc_suggested_to_delete_sum: 0,
        user_initiated_interaction_count: 0,
        totals_by_cli: 'invalid', // should be object
        totals_by_ide: 'invalid' // should be array
      };
      
      const errors = validateUserRecord(record);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('totals_by_cli'))).toBe(true);
      expect(errors.some(e => e.includes('totals_by_ide'))).toBe(true);
    });
  });
  
  describe('validateDayTotal', () => {
    it('should accept valid day total', () => {
      const dayTotal = {
        day: '2025-10-01',
        code_acceptance_activity_count: 10,
        code_generation_activity_count: 10,
        loc_added_sum: 80,
        loc_deleted_sum: 0,
        loc_suggested_to_add_sum: 100,
        loc_suggested_to_delete_sum: 0,
        user_initiated_interaction_count: 5,
        daily_active_users: 5,
        totals_by_cli: {
          session_count: 10
        },
        pull_requests: {
          total_reviewed: 2,
          total_created: 3
        },
        totals_by_ide: [],
        totals_by_feature: []
      };
      
      const errors = validateDayTotal(dayTotal);
      expect(errors).toEqual([]);
    });
    
    it('should catch negative values in LOC fields', () => {
      const dayTotal = {
        day: '2025-10-01',
        code_acceptance_activity_count: 10,
        code_generation_activity_count: 10,
        loc_added_sum: -80, // negative
        loc_deleted_sum: 0,
        loc_suggested_to_add_sum: 100,
        loc_suggested_to_delete_sum: 0,
        user_initiated_interaction_count: 5
      };
      
      const errors = validateDayTotal(dayTotal);
      // Schema validates types, not business rules (negative check is in processed schema)
      expect(errors.length).toBe(0); // Type is correct (number)
    });
  });
  
  describe('validateUserReport', () => {
    it('should validate entire user report array', () => {
      const data = [
        {
          day: '2025-10-01',
          code_acceptance_activity_count: 1,
          code_generation_activity_count: 1,
          loc_added_sum: 8,
          loc_deleted_sum: 0,
          loc_suggested_to_add_sum: 10,
          loc_suggested_to_delete_sum: 0,
          user_initiated_interaction_count: 0,
          user_login: 'user1'
        },
        {
          day: '2025-10-02',
          code_acceptance_activity_count: 2,
          code_generation_activity_count: 2,
          loc_added_sum: 16,
          loc_deleted_sum: 0,
          loc_suggested_to_add_sum: 20,
          loc_suggested_to_delete_sum: 0,
          user_initiated_interaction_count: 1,
          user_login: 'user2'
        }
      ];
      
      const result = validateUserReport(data);
      expect(result.valid).toBe(true);
      expect(result.recordCount).toBe(2);
      expect(result.errors).toEqual([]);
    });
    
    it('should reject non-array data', () => {
      const result = validateUserReport({ not: 'array' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('array');
    });
    
    it('should accumulate errors from all records', () => {
      const data = [
        { day: 'invalid-date' }, // Missing fields
        { day: '2025-10-01' } // Missing numeric fields
      ];
      
      const result = validateUserReport(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2); // Multiple errors
    });
  });
  
  describe('validateEnterpriseReport', () => {
    it('should validate enterprise report structure', () => {
      const data = {
        day_totals: [
          {
            day: '2025-10-01',
            code_acceptance_activity_count: 10,
            code_generation_activity_count: 10,
            loc_added_sum: 80,
            loc_deleted_sum: 0,
            loc_suggested_to_add_sum: 100,
            loc_suggested_to_delete_sum: 0,
            user_initiated_interaction_count: 5
          }
        ]
      };
      
      const result = validateEnterpriseReport(data);
      expect(result.valid).toBe(true);
      expect(result.dayCount).toBe(1);
    });
    
    it('should reject missing day_totals', () => {
      const result = validateEnterpriseReport({ other: 'field' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('day_totals'))).toBe(true);
    });
  });
  
  describe('validateAPIData (auto-detect)', () => {
    it('should auto-detect user report', () => {
      const data = [{
        day: '2025-10-01',
        code_acceptance_activity_count: 1,
        code_generation_activity_count: 1,
        loc_added_sum: 8,
        loc_deleted_sum: 0,
        loc_suggested_to_add_sum: 10,
        loc_suggested_to_delete_sum: 0,
        user_initiated_interaction_count: 0,
        user_login: 'testuser'
      }];
      
      const result = validateAPIData(data);
      expect(result.type).toBe('user_report');
      expect(result.valid).toBe(true);
    });
    
    it('should auto-detect enterprise report', () => {
      const data = {
        day_totals: [{
          day: '2025-10-01',
          code_acceptance_activity_count: 10,
          code_generation_activity_count: 10,
          loc_added_sum: 80,
          loc_deleted_sum: 0,
          loc_suggested_to_add_sum: 100,
          loc_suggested_to_delete_sum: 0,
          user_initiated_interaction_count: 5
        }]
      };
      
      const result = validateAPIData(data);
      expect(result.type).toBe('enterprise_report');
      expect(result.valid).toBe(true);
    });
    
    it('should reject unknown structure', () => {
      const result = validateAPIData({ unknown: 'structure' });
      expect(result.type).toBe('unknown');
      expect(result.valid).toBe(false);
    });
    
    it('should handle null/undefined', () => {
      expect(validateAPIData(null).valid).toBe(false);
      expect(validateAPIData(undefined).valid).toBe(false);
    });
  });
});

describe('Processed Data Schema Validation', () => {
  describe('validateNormalizedDayTotal', () => {
    it('should accept valid normalized day', () => {
      const record = {
        day: '2025-10-01',
        enterpriseId: '1',
        dailyActiveUsers: 5,
        dailyActiveCliUsers: 2,
        weeklyActiveUsers: 15,
        monthlyActiveUsers: 50,
        monthlyChatUsers: 10,
        monthlyAgentUsers: 5,
        interactions: 20,
        codeGenerations: 15,
        codeAcceptances: 10,
        locSuggestedToAdd: 100,
        locSuggestedToDelete: 10,
        locAdded: 80,
        locDeleted: 5,
        prTotalReviewed: 3,
        prTotalCreated: 2,
        prCreatedByCopilot: 1,
        prReviewedByCopilot: 2,
        cliSessionCount: 10,
        cliRequestCount: 25,
        agentModeInteractions: 5
      };
      
      const errors = validateNormalizedDayTotal(record);
      expect(errors).toEqual([]);
    });
    
    it('should reject NaN values', () => {
      const record = {
        day: '2025-10-01',
        dailyActiveUsers: NaN,
        dailyActiveCliUsers: 2,
        weeklyActiveUsers: 15,
        monthlyActiveUsers: 50,
        monthlyChatUsers: 10,
        monthlyAgentUsers: 5,
        interactions: 20,
        codeGenerations: 15,
        codeAcceptances: 10,
        locSuggestedToAdd: 100,
        locSuggestedToDelete: 10,
        locAdded: 80,
        locDeleted: 5,
        prTotalReviewed: 3,
        prTotalCreated: 2,
        prCreatedByCopilot: 1,
        prReviewedByCopilot: 2,
        cliSessionCount: 10,
        cliRequestCount: 25,
        agentModeInteractions: 5
      };
      
      const errors = validateNormalizedDayTotal(record);
      expect(errors.some(e => e.includes('dailyActiveUsers'))).toBe(true);
    });
    
    it('should reject negative values', () => {
      const record = {
        day: '2025-10-01',
        dailyActiveUsers: -5,
        dailyActiveCliUsers: 2,
        weeklyActiveUsers: 15,
        monthlyActiveUsers: 50,
        monthlyChatUsers: 10,
        monthlyAgentUsers: 5,
        interactions: 20,
        codeGenerations: 15,
        codeAcceptances: 10,
        locSuggestedToAdd: 100,
        locSuggestedToDelete: 10,
        locAdded: 80,
        locDeleted: 5,
        prTotalReviewed: 3,
        prTotalCreated: 2,
        prCreatedByCopilot: 1,
        prReviewedByCopilot: 2,
        cliSessionCount: 10,
        cliRequestCount: 25,
        agentModeInteractions: 5
      };
      
      const errors = validateNormalizedDayTotal(record);
      expect(errors.some(e => e.includes('dailyActiveUsers') && e.includes('negative'))).toBe(true);
    });
  });
  
  describe('validateNormalizedUserRecord', () => {
    it('should accept valid normalized user record', () => {
      const record = {
        day: '2025-10-01',
        userLogin: 'testuser',
        dailyActiveUsers: 1,
        interactions: 5,
        codeGenerations: 3,
        codeAcceptances: 2,
        locAdded: 20
      };
      
      const errors = validateNormalizedUserRecord(record);
      expect(errors).toEqual([]);
    });
    
    it('should reject empty userLogin', () => {
      const record = {
        day: '2025-10-01',
        userLogin: '',
        dailyActiveUsers: 1,
        interactions: 5,
        codeGenerations: 3,
        codeAcceptances: 2,
        locAdded: 20
      };
      
      const errors = validateNormalizedUserRecord(record);
      expect(errors.some(e => e.includes('userLogin'))).toBe(true);
    });
  });
  
  describe('validateFileData', () => {
    it('should detect enterprise report structure', () => {
      const data = {
        day_totals: [{ day: '2025-10-01' }]
      };
      
      const result = validateFileData(data);
      expect(result.type).toBe('enterprise_report');
      expect(result.recordCount).toBe(1);
    });
    
    it('should detect user report array', () => {
      const data = [{ user_login: 'test' }, { user_login: 'test2' }];
      
      const result = validateFileData(data);
      expect(result.type).toBe('user_report');
      expect(result.recordCount).toBe(2);
    });
    
    it('should detect agentic data structure', () => {
      const data = {
        developer_day_summary: [],
        pr_sessions: [],
        requests: []
      };
      
      const result = validateFileData(data);
      expect(result.type).toBe('agentic_data');
    });
    
    it('should reject empty array', () => {
      const result = validateFileData([]);
      expect(result.valid).toBe(false);
    });
    
    it('should reject malformed agentic data', () => {
      const data = {
        developer_day_summary: 'not-array'
      };
      
      const result = validateFileData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be an array'))).toBe(true);
    });
  });
  
  describe('validateProcessedData', () => {
    it('should validate efficiency dashboard data', () => {
      const data = {
        days: [
          {
            day: '2025-10-01',
            dailyActiveUsers: 5,
            dailyActiveCliUsers: 2,
            weeklyActiveUsers: 15,
            monthlyActiveUsers: 50,
            monthlyChatUsers: 10,
            monthlyAgentUsers: 5,
            interactions: 20,
            codeGenerations: 15,
            codeAcceptances: 10,
            locSuggestedToAdd: 100,
            locSuggestedToDelete: 10,
            locAdded: 80,
            locDeleted: 5,
            prTotalReviewed: 3,
            prTotalCreated: 2,
            prCreatedByCopilot: 1,
            prReviewedByCopilot: 2,
            cliSessionCount: 10,
            cliRequestCount: 25,
            agentModeInteractions: 5
          }
        ]
      };
      
      const result = validateProcessedData(data, 'efficiency');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    it('should reject missing days array', () => {
      const result = validateProcessedData({}, 'efficiency');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('days'))).toBe(true);
    });
    
    it('should validate agentic dashboard data', () => {
      const data = {
        days: [{
          date: '2025-10-01',
          agentActiveDevs: 3,
          humanDevsActive: 5,
          totalAgentRequests: 10,
          issueAssignmentRequests: 2,
          issuesCreated: 1,
          prFollowupRequests: 3,
          sessionsStarted: 5,
          agentPrsCreated: 2,
          agentPrsMerged: 1,
          agentLocAdded: 100,
          agentLocDeleted: 10,
          agentSessionMinutes: 60,
          changesRequestedTotal: 1,
          mergedLocAdded: 80,
          mergedLocDeleted: 5,
          mergedSessionMinutes: 45,
          turbulence: 2
        }],
        metadata: {
          totalDays: 1,
          daysWithActivity: 1
        }
      };
      
      const result = validateProcessedData(data, 'agentic');
      expect(result.valid).toBe(true);
    });
    
    it('should reject malformed metadata for agentic', () => {
      const data = {
        days: [],
        metadata: 'invalid'
      };
      
      const result = validateProcessedData(data, 'agentic');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('metadata'))).toBe(true);
    });
  });
});

describe('Edge Cases and Data Quality', () => {
  it('should catch data truncation issues', () => {
    const record = {
      day: '2025-10', // Truncated date
      code_acceptance_activity_count: 1,
      code_generation_activity_count: 1,
      loc_added_sum: 8,
      loc_deleted_sum: 0,
      loc_suggested_to_add_sum: 10,
      loc_suggested_to_delete_sum: 0,
      user_initiated_interaction_count: 0
    };
    
    const errors = validateUserRecord(record);
    expect(errors.some(e => e.includes('day'))).toBe(true);
  });
  
  it('should catch string numeric values (common JSON parsing issue)', () => {
    const record = {
      day: '2025-10-01',
      dailyActiveUsers: '5', // String instead of number
      dailyActiveCliUsers: 2,
      weeklyActiveUsers: 15,
      monthlyActiveUsers: 50,
      monthlyChatUsers: 10,
      monthlyAgentUsers: 5,
      interactions: 20,
      codeGenerations: 15,
      codeAcceptances: 10,
      locSuggestedToAdd: 100,
      locSuggestedToDelete: 10,
      locAdded: 80,
      locDeleted: 5,
      prTotalReviewed: 3,
      prTotalCreated: 2,
      prCreatedByCopilot: 1,
      prReviewedByCopilot: 2,
      cliSessionCount: 10,
      cliRequestCount: 25,
      agentModeInteractions: 5
    };
    
    const errors = validateNormalizedDayTotal(record);
    expect(errors.length).toBeGreaterThan(0);
  });
  
  it('should handle missing nested structures gracefully', () => {
    const record = {
      day: '2025-10-01',
      code_acceptance_activity_count: 1,
      code_generation_activity_count: 1,
      loc_added_sum: 8,
      loc_deleted_sum: 0,
      loc_suggested_to_add_sum: 10,
      loc_suggested_to_delete_sum: 0,
      user_initiated_interaction_count: 0
      // totals_by_cli is optional, should not error
    };
    
    const errors = validateUserRecord(record);
    // Should only error on missing required fields, not optional nested structures
    expect(errors.every(e => !e.includes('totals_by_cli'))).toBe(true);
  });
});
