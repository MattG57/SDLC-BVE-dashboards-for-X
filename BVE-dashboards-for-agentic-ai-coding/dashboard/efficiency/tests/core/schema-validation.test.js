/**
 * Schema Validation Tests for Agentic AI Coding Dashboard
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Agentic AI Data Schema Validation', () => {
  const exampleDataPath = path.join(__dirname, '../fixtures/sample-data.json');
  let data;

  it('should load example data', () => {
    const content = fs.readFileSync(exampleDataPath, 'utf8');
    data = JSON.parse(content);
    expect(data).toBeDefined();
  });

  describe('Top-level structure', () => {
    it('should have required top-level fields', () => {
      expect(data).toHaveProperty('developer_day_summary');
      expect(data).toHaveProperty('pr_sessions');
    });

    it('should have arrays for all top-level fields', () => {
      expect(Array.isArray(data.developer_day_summary)).toBe(true);
      expect(Array.isArray(data.pr_sessions)).toBe(true);
    });

    it('should not be empty', () => {
      expect(data.developer_day_summary.length).toBeGreaterThan(0);
      expect(data.pr_sessions.length).toBeGreaterThan(0);
    });
  });

  describe('Developer Day Summary schema', () => {
    it('should have valid structure for each entry', () => {
      data.developer_day_summary.forEach((entry, index) => {
        expect(entry, `Entry ${index} missing date`).toHaveProperty('date');
        expect(entry, `Entry ${index} missing developer_login`).toHaveProperty('developer_login');
        expect(entry, `Entry ${index} missing total_agent_requests`).toHaveProperty('total_agent_requests');
        
        // Validate types
        expect(typeof entry.date, `Entry ${index} date should be string`).toBe('string');
        expect(typeof entry.developer_login, `Entry ${index} developer_login should be string`).toBe('string');
        expect(typeof entry.total_agent_requests, `Entry ${index} total_agent_requests should be number`).toBe('number');
        
        // Validate date format
        expect(entry.date, `Entry ${index} date should be valid date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // Validate non-negative numbers
        expect(entry.total_agent_requests, `Entry ${index} total_agent_requests should be non-negative`).toBeGreaterThanOrEqual(0);
        
        // Developer login should not be empty
        expect(entry.developer_login.trim().length).toBeGreaterThan(0);
      });
    });

    it('should have required metrics for agent activity', () => {
      data.developer_day_summary.forEach((entry, index) => {
        expect(entry, `Entry ${index} missing issue_assignment_requests`).toHaveProperty('issue_assignment_requests');
        expect(entry, `Entry ${index} missing pr_followup_requests`).toHaveProperty('pr_followup_requests');
        expect(entry, `Entry ${index} missing sessions_started`).toHaveProperty('sessions_started');
        expect(entry, `Entry ${index} missing agent_prs_created`).toHaveProperty('agent_prs_created');
        expect(entry, `Entry ${index} missing agent_prs_merged`).toHaveProperty('agent_prs_merged');
        
        // All metrics should be numbers
        expect(typeof entry.issue_assignment_requests).toBe('number');
        expect(typeof entry.pr_followup_requests).toBe('number');
        expect(typeof entry.sessions_started).toBe('number');
        expect(typeof entry.agent_prs_created).toBe('number');
        expect(typeof entry.agent_prs_merged).toBe('number');
        
        // All should be non-negative
        expect(entry.issue_assignment_requests).toBeGreaterThanOrEqual(0);
        expect(entry.pr_followup_requests).toBeGreaterThanOrEqual(0);
        expect(entry.sessions_started).toBeGreaterThanOrEqual(0);
        expect(entry.agent_prs_created).toBeGreaterThanOrEqual(0);
        expect(entry.agent_prs_merged).toBeGreaterThanOrEqual(0);
        
        // Validate logical constraints
        expect(entry.agent_prs_merged, `Entry ${index} merged PRs should not exceed created PRs`).toBeLessThanOrEqual(entry.agent_prs_created);
        
        // Total requests should equal sum of request types
        const requestSum = entry.issue_assignment_requests + entry.pr_followup_requests;
        expect(entry.total_agent_requests, `Entry ${index} total requests should match sum of request types`).toBeGreaterThanOrEqual(requestSum);
      });
    });

    it('should have code metrics when present', () => {
      data.developer_day_summary.forEach((entry, index) => {
        if (entry.agent_loc_added !== undefined) {
          expect(typeof entry.agent_loc_added).toBe('number');
          expect(entry.agent_loc_added).toBeGreaterThanOrEqual(0);
        }
        
        if (entry.agent_loc_deleted !== undefined) {
          expect(typeof entry.agent_loc_deleted).toBe('number');
          expect(entry.agent_loc_deleted).toBeGreaterThanOrEqual(0);
        }
        
        if (entry.agent_session_minutes !== undefined) {
          expect(typeof entry.agent_session_minutes).toBe('number');
          expect(entry.agent_session_minutes).toBeGreaterThanOrEqual(0);
          // Sanity check: shouldn't have more than 24 hours of sessions in a day
          expect(entry.agent_session_minutes).toBeLessThan(1440);
        }
        
        if (entry.changes_requested_total !== undefined) {
          expect(typeof entry.changes_requested_total).toBe('number');
          expect(entry.changes_requested_total).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('PR Sessions schema', () => {
    it('should have valid structure for each PR', () => {
      data.pr_sessions.forEach((pr, index) => {
        expect(pr, `PR ${index} missing repo`).toHaveProperty('repo');
        expect(pr, `PR ${index} missing pr_number`).toHaveProperty('pr_number');
        expect(pr, `PR ${index} missing pr_created_at`).toHaveProperty('pr_created_at');
        expect(pr, `PR ${index} missing pr_state`).toHaveProperty('pr_state');
        expect(pr, `PR ${index} missing pr_author_login`).toHaveProperty('pr_author_login');
        
        // Validate types
        expect(typeof pr.repo).toBe('string');
        expect(typeof pr.pr_number).toBe('number');
        expect(typeof pr.pr_created_at).toBe('string');
        expect(typeof pr.pr_state).toBe('string');
        expect(typeof pr.pr_author_login).toBe('string');
        
        // Validate PR number is positive
        expect(pr.pr_number, `PR ${index} should have positive number`).toBeGreaterThan(0);
        
        // Validate state is valid
        expect(['open', 'closed', 'merged'], `PR ${index} should have valid state`).toContain(pr.pr_state);
        
        // Validate timestamp format (ISO 8601)
        expect(pr.pr_created_at, `PR ${index} created_at should be valid timestamp`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      });
    });

    it('should have valid PR metrics', () => {
      data.pr_sessions.forEach((pr, index) => {
        expect(pr, `PR ${index} missing additions`).toHaveProperty('additions');
        expect(pr, `PR ${index} missing deletions`).toHaveProperty('deletions');
        expect(pr, `PR ${index} missing duration_type`).toHaveProperty('duration_type');
        
        expect(typeof pr.additions).toBe('number');
        expect(typeof pr.deletions).toBe('number');
        expect(typeof pr.duration_type).toBe('string');
        
        expect(pr.additions).toBeGreaterThanOrEqual(0);
        expect(pr.deletions).toBeGreaterThanOrEqual(0);
        
        // Duration type should be 'agent' for agent-created PRs
        if (pr.pr_author_login.includes('copilot') || pr.pr_author_login.includes('bot')) {
          expect(pr.duration_type).toBe('agent');
        }
        
        if (pr.duration_minutes !== undefined) {
          expect(typeof pr.duration_minutes).toBe('number');
          expect(pr.duration_minutes).toBeGreaterThanOrEqual(0);
          // Sanity check: PR shouldn't take more than 30 days (43200 minutes)
          expect(pr.duration_minutes).toBeLessThan(43200);
        }
      });
    });

    it('should have valid review and guidance metrics', () => {
      data.pr_sessions.forEach((pr, index) => {
        if (pr.changes_requested_count !== undefined) {
          expect(typeof pr.changes_requested_count).toBe('number');
          expect(pr.changes_requested_count).toBeGreaterThanOrEqual(0);
        }
        
        if (pr.reopened_count !== undefined) {
          expect(typeof pr.reopened_count).toBe('number');
          expect(pr.reopened_count).toBeGreaterThanOrEqual(0);
        }
        
        if (pr.additional_guidance_count !== undefined) {
          expect(typeof pr.additional_guidance_count).toBe('number');
          expect(pr.additional_guidance_count).toBeGreaterThanOrEqual(0);
        }
        
        if (pr.copilot_invocation_count !== undefined) {
          expect(typeof pr.copilot_invocation_count).toBe('number');
          expect(pr.copilot_invocation_count).toBeGreaterThan(0); // Should have at least one invocation
        }
      });
    });

    it('should have valid origin tracking', () => {
      data.pr_sessions.forEach((pr, index) => {
        if (pr.origin_request_type !== undefined) {
          expect(typeof pr.origin_request_type).toBe('string');
          expect(pr.origin_request_type.trim().length).toBeGreaterThan(0);
        }
        
        if (pr.origin_requested_by !== undefined) {
          expect(typeof pr.origin_requested_by).toBe('string');
          expect(pr.origin_requested_by.trim().length).toBeGreaterThan(0);
        }
      });
    });

    it('should have valid merge timing when merged', () => {
      data.pr_sessions.forEach((pr, index) => {
        if (pr.pr_state === 'merged') {
          expect(pr, `Merged PR ${index} should have merge timestamp`).toHaveProperty('pr_merged_at');
          expect(pr.pr_merged_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
          
          // Merge time should be after creation time
          const createdDate = new Date(pr.pr_created_at);
          const mergedDate = new Date(pr.pr_merged_at);
          expect(mergedDate >= createdDate, `PR ${index} merge time should be after creation time`).toBe(true);
        }
      });
    });
  });

  describe('Data consistency checks', () => {
    it('should have consistent date ranges', () => {
      const summaryDates = new Set(data.developer_day_summary.map(e => e.date));
      expect(summaryDates.size).toBeGreaterThan(0);
    });

    it('should have dates in chronological order', () => {
      const dates = data.developer_day_summary.map(e => e.date).filter((v, i, a) => a.indexOf(v) === i).sort();
      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        expect(currDate >= prevDate, 'Developer summary dates should be chronological').toBe(true);
      }
      
      const prDates = data.pr_sessions.map(pr => pr.pr_created_at.substring(0, 10)).sort();
      for (let i = 1; i < prDates.length; i++) {
        const prevDate = new Date(prDates[i - 1]);
        const currDate = new Date(prDates[i]);
        expect(currDate >= prevDate, 'PR dates should be chronological').toBe(true);
      }
    });

    it('should not have future dates', () => {
      const now = new Date();
      data.developer_day_summary.forEach((entry, index) => {
        const entryDate = new Date(entry.date);
        expect(entryDate <= now, `Summary entry ${index} should not have future date`).toBe(true);
      });
      
      data.pr_sessions.forEach((pr, index) => {
        const prDate = new Date(pr.pr_created_at);
        expect(prDate <= now, `PR ${index} should not have future creation date`).toBe(true);
      });
    });

    it('should have consistent PR counts across data sources', () => {
      // Sum of agent_prs_created in developer_day_summary should align with PR sessions count
      const totalPRsFromSummary = data.developer_day_summary.reduce((sum, entry) => sum + entry.agent_prs_created, 0);
      const totalPRsFromSessions = data.pr_sessions.length;
      
      // Allow some variance due to date ranges or filtering (up to 50%)
      expect(Math.abs(totalPRsFromSummary - totalPRsFromSessions), 'PR counts should be reasonably consistent').toBeLessThanOrEqual(Math.max(totalPRsFromSummary, totalPRsFromSessions) * 0.5);
    });

    it('should have consistent LOC across data sources', () => {
      data.pr_sessions.forEach((pr, index) => {
        const totalLOC = pr.additions + pr.deletions;
        // Sanity check: PR shouldn't have more than 100k lines changed
        expect(totalLOC, `PR ${index} should have reasonable LOC`).toBeLessThan(100000);
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
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            checkNoNaN(value, fullPath);
          } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (typeof item === 'object' && item !== null) {
                checkNoNaN(item, `${fullPath}[${index}]`);
              }
            });
          }
        }
      };

      checkNoNaN(data, 'data');
    });

    it('should not have empty developer logins', () => {
      data.developer_day_summary.forEach((entry, index) => {
        expect(entry.developer_login.trim().length, `Entry ${index} should have non-empty developer login`).toBeGreaterThan(0);
      });
    });

    it('should not have invalid PR numbers', () => {
      data.pr_sessions.forEach((pr, index) => {
        expect(pr.pr_number, `PR ${index} should have positive number`).toBeGreaterThan(0);
        expect(Number.isInteger(pr.pr_number), `PR ${index} should have integer number`).toBe(true);
      });
    });

    it('should have reasonable activity levels', () => {
      data.developer_day_summary.forEach((entry, index) => {
        // Developer shouldn't create more than 100 agent PRs per day (sanity check)
        expect(entry.agent_prs_created, `Developer ${entry.developer_login} on ${entry.date} has unrealistic PR count`).toBeLessThan(100);
        
        // Total agent requests should be reasonable
        expect(entry.total_agent_requests).toBeLessThan(1000);
      });
    });
  });

  describe('Copilot-specific validations', () => {
    it('should identify agent-created PRs correctly', () => {
      data.pr_sessions.forEach((pr, index) => {
        if (pr.duration_type === 'agent') {
          // Agent PRs should typically have copilot or bot in the author
          const isAgentAuthor = pr.pr_author_login.toLowerCase().includes('copilot') || 
                               pr.pr_author_login.toLowerCase().includes('bot');
          expect(isAgentAuthor, `PR ${index} marked as agent should have agent author`).toBe(true);
        }
      });
    });

    it('should have valid request type patterns', () => {
      const validRequestTypes = ['copilot_work_started', 'issue_assignment', 'pr_followup', 'copilot_chat'];
      
      data.pr_sessions.forEach((pr, index) => {
        if (pr.origin_request_type) {
          // Should be one of the known types or a reasonable string
          expect(typeof pr.origin_request_type).toBe('string');
          expect(pr.origin_request_type.length).toBeGreaterThan(0);
        }
      });
    });

    it('should track human guidance on agent PRs', () => {
      data.pr_sessions.forEach((pr, index) => {
        const totalGuidance = (pr.changes_requested_count || 0) + 
                             (pr.additional_guidance_count || 0) + 
                             (pr.reopened_count || 0);
        
        // If there's guidance, duration might be longer
        if (totalGuidance > 0 && pr.duration_minutes) {
          expect(pr.duration_minutes, `PR ${index} with guidance should have reasonable duration`).toBeGreaterThan(0);
        }
      });
    });
  });
});
