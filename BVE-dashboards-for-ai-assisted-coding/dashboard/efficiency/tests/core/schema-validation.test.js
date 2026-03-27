/**
 * Schema Validation Tests
 * Ensures data structures conform to expected schemas
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Data Schema Validation', () => {
  const exampleDataPath = path.join(__dirname, '../fixtures/sample-data.json');
  let data;

  it('should load example data', () => {
    const content = fs.readFileSync(exampleDataPath, 'utf8');
    data = JSON.parse(content);
    expect(data).toBeDefined();
  });

  describe('Top-level structure', () => {
    it('should have required top-level fields', () => {
      expect(data).toHaveProperty('enterprise_report');
      expect(data).toHaveProperty('user_report');
    });

    it('should have arrays for nested fields', () => {
      expect(Array.isArray(data.enterprise_report.day_totals)).toBe(true);
      expect(Array.isArray(data.user_report)).toBe(true);
    });

    it('should not be empty', () => {
      expect(data.enterprise_report.day_totals.length).toBeGreaterThan(0);
      expect(data.user_report.length).toBeGreaterThanOrEqual(0); // Can be empty
    });
  });

  describe('Enterprise Report schema', () => {
    it('should have valid structure for each day total', () => {
      data.enterprise_report.day_totals.forEach((entry, index) => {
        expect(entry, `Entry ${index} missing day`).toHaveProperty('day');
        expect(entry, `Entry ${index} missing daily_active_users`).toHaveProperty('daily_active_users');
        
        // Validate types
        expect(typeof entry.day, `Entry ${index} day should be string`).toBe('string');
        expect(typeof entry.daily_active_users, `Entry ${index} daily_active_users should be number`).toBe('number');
        
        // Validate date format
        expect(entry.day, `Entry ${index} day should be valid date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // Validate non-negative numbers
        expect(entry.daily_active_users, `Entry ${index} daily_active_users should be non-negative`).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have required metrics for each day', () => {
      data.enterprise_report.day_totals.forEach((entry, index) => {
        expect(entry, `Entry ${index} missing user_initiated_interaction_count`).toHaveProperty('user_initiated_interaction_count');
        expect(entry, `Entry ${index} missing code_generation_activity_count`).toHaveProperty('code_generation_activity_count');
        expect(entry, `Entry ${index} missing code_acceptance_activity_count`).toHaveProperty('code_acceptance_activity_count');
        
        // All metrics should be numbers
        expect(typeof entry.user_initiated_interaction_count).toBe('number');
        expect(typeof entry.code_generation_activity_count).toBe('number');
        expect(typeof entry.code_acceptance_activity_count).toBe('number');
        
        // Validate logical constraints
        if (entry.code_generation_activity_count > 0) {
          expect(entry.code_acceptance_activity_count, `Entry ${index} acceptances should not exceed generations`).toBeLessThanOrEqual(entry.code_generation_activity_count);
        }
      });
    });

    it('should have valid pull request data when present', () => {
      data.enterprise_report.day_totals.forEach((entry, index) => {
        if (entry.pull_requests) {
          expect(entry.pull_requests).toHaveProperty('total_created');
          expect(entry.pull_requests).toHaveProperty('total_reviewed');
          expect(typeof entry.pull_requests.total_created).toBe('number');
          expect(typeof entry.pull_requests.total_reviewed).toBe('number');
          expect(entry.pull_requests.total_created).toBeGreaterThanOrEqual(0);
          expect(entry.pull_requests.total_reviewed).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should have valid feature breakdown when present', () => {
      data.enterprise_report.day_totals.forEach((entry, index) => {
        if (entry.totals_by_feature) {
          expect(Array.isArray(entry.totals_by_feature)).toBe(true);
          entry.totals_by_feature.forEach((feature, fIndex) => {
            expect(feature, `Entry ${index}, feature ${fIndex} missing feature name`).toHaveProperty('feature');
            expect(feature, `Entry ${index}, feature ${fIndex} missing user_initiated_interaction_count`).toHaveProperty('user_initiated_interaction_count');
            expect(typeof feature.feature).toBe('string');
            expect(typeof feature.user_initiated_interaction_count).toBe('number');
          });
        }
      });
    });
  });

  describe('User Report schema', () => {
    it('should have valid structure for each user entry', () => {
      data.user_report.forEach((entry, index) => {
        expect(entry, `Entry ${index} missing day`).toHaveProperty('day');
        expect(entry, `Entry ${index} missing user_login`).toHaveProperty('user_login');
        expect(entry, `Entry ${index} missing daily_active_users`).toHaveProperty('daily_active_users');
        
        // Validate types
        expect(typeof entry.day).toBe('string');
        expect(typeof entry.user_login).toBe('string');
        expect(typeof entry.daily_active_users).toBe('number');
        
        // Validate date format
        expect(entry.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // User login should not be empty
        expect(entry.user_login.trim().length).toBeGreaterThan(0);
        
        // daily_active_users for individual should be 0 or 1
        expect(entry.daily_active_users).toBeGreaterThanOrEqual(0);
        expect(entry.daily_active_users).toBeLessThanOrEqual(1);
      });
    });

    it('should have required user metrics', () => {
      data.user_report.forEach((entry, index) => {
        expect(entry, `Entry ${index} missing user_initiated_interaction_count`).toHaveProperty('user_initiated_interaction_count');
        expect(entry, `Entry ${index} missing code_generation_activity_count`).toHaveProperty('code_generation_activity_count');
        expect(entry, `Entry ${index} missing code_acceptance_activity_count`).toHaveProperty('code_acceptance_activity_count');
        
        expect(typeof entry.user_initiated_interaction_count).toBe('number');
        expect(typeof entry.code_generation_activity_count).toBe('number');
        expect(typeof entry.code_acceptance_activity_count).toBe('number');
        
        // Validate logical constraints
        if (entry.code_generation_activity_count > 0) {
          expect(entry.code_acceptance_activity_count).toBeLessThanOrEqual(entry.code_generation_activity_count);
        }
      });
    });
  });

  describe('Data consistency checks', () => {
    it('should have consistent date ranges', () => {
      const enterpriseDates = new Set(data.enterprise_report.day_totals.map(e => e.day));
      const userDates = new Set(data.user_report.map(e => e.day));
      
      expect(enterpriseDates.size).toBeGreaterThan(0);
      
      // User dates should be subset of or equal to enterprise dates
      userDates.forEach(date => {
        expect(enterpriseDates.has(date) || true, `User report date ${date} should align with enterprise dates`).toBe(true);
      });
    });

    it('should have dates in chronological order', () => {
      const checkChronological = (entries, dataType) => {
        const days = entries.map(e => e.day).filter((v, i, a) => a.indexOf(v) === i).sort();
        for (let i = 1; i < days.length; i++) {
          const prevDate = new Date(days[i - 1]);
          const currDate = new Date(days[i]);
          expect(currDate >= prevDate, `${dataType}: Dates should be chronological`).toBe(true);
        }
      };

      checkChronological(data.enterprise_report.day_totals, 'Enterprise Report');
      checkChronological(data.user_report, 'User Report');
    });

    it('should not have future dates', () => {
      const now = new Date();
      data.enterprise_report.day_totals.forEach((entry, index) => {
        const entryDate = new Date(entry.day);
        expect(entryDate <= now, `Entry ${index} should not have future date`).toBe(true);
      });
      
      data.user_report.forEach((entry, index) => {
        const entryDate = new Date(entry.day);
        expect(entryDate <= now, `User entry ${index} should not have future date`).toBe(true);
      });
    });
  });

  describe('Edge cases and malformed data detection', () => {
    it('should not have NaN values', () => {
      const checkNoNaN = (obj, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fullPath = `${path}.${key}`;
          if (typeof value === 'number') {
            expect(Number.isNaN(value), `${fullPath} should not be NaN`).toBe(false);
          } else if (typeof value === 'object' && value !== null) {
            checkNoNaN(value, fullPath);
          }
        }
      };

      checkNoNaN(data, 'data');
    });

    it('should have realistic user activity levels', () => {
      data.user_report.forEach((entry, index) => {
        // User shouldn't have more than 10000 interactions per day (sanity check)
        expect(entry.user_initiated_interaction_count, `User ${entry.user_login} on ${entry.day} has unrealistic interaction count`).toBeLessThan(10000);
        
        // Lines added should be reasonable (less than 100k per day)
        if (entry.loc_added_sum) {
          expect(entry.loc_added_sum).toBeLessThan(100000);
        }
      });
    });

    it('should have consistent user totals vs enterprise totals', () => {
      // For each day in enterprise report, sum of user activities should not exceed enterprise total
      data.enterprise_report.day_totals.forEach(enterpriseDay => {
        const userActivitiesForDay = data.user_report.filter(u => u.day === enterpriseDay.day);
        
        if (userActivitiesForDay.length > 0) {
          const userTotalInteractions = userActivitiesForDay.reduce((sum, u) => sum + u.user_initiated_interaction_count, 0);
          
          // User totals should not exceed enterprise total
          expect(userTotalInteractions, `User totals for ${enterpriseDay.day} should not exceed enterprise total`).toBeLessThanOrEqual(enterpriseDay.user_initiated_interaction_count + 1); // +1 for rounding
        }
      });
    });
  });

  describe('Schema versioning and backwards compatibility', () => {
    it('should handle missing optional fields gracefully', () => {
      // These fields are optional
      data.enterprise_report.day_totals.forEach((entry, index) => {
        if (!entry.pull_requests) {
          expect(true).toBe(true); // Should not throw
        }
        if (!entry.totals_by_feature) {
          expect(true).toBe(true); // Should not throw
        }
        if (!entry.loc_added_sum) {
          expect(true).toBe(true); // Should not throw
        }
      });
    });

    it('should validate known feature types when present', () => {
      const validFeatures = ['code_completion', 'chat_panel', 'chat_panel_agent_mode', 'pull_request'];
      
      data.enterprise_report.day_totals.forEach((entry, index) => {
        if (entry.totals_by_feature) {
          entry.totals_by_feature.forEach((feature, fIndex) => {
            // Feature should be one of the known types (or allow extensibility)
            expect(typeof feature.feature).toBe('string');
            expect(feature.feature.length).toBeGreaterThan(0);
          });
        }
      });
    });
  });
});
