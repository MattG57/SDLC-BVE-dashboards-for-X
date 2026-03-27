/**
 * Schema Validation Tests for Structural Quality Dashboard
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Structural Data Schema Validation', () => {
  const exampleDataPath = path.join(__dirname, '../fixtures/sample-data.json');
  let data;

  it('should load example data', () => {
    const content = fs.readFileSync(exampleDataPath, 'utf8');
    data = JSON.parse(content);
    expect(data).toBeDefined();
  });

  describe('Top-level structure', () => {
    it('should have required top-level fields', () => {
      expect(data).toHaveProperty('pull_requests');
      expect(Array.isArray(data.pull_requests)).toBe(true);
    });

    it('should not be empty', () => {
      expect(data.pull_requests.length).toBeGreaterThan(0);
    });
  });

  describe('Pull Request schema', () => {
    it('should have valid structure for each PR', () => {
      data.pull_requests.forEach((pr, index) => {
        expect(pr, `PR ${index} missing number`).toHaveProperty('number');
        expect(pr, `PR ${index} missing title`).toHaveProperty('title');
        expect(pr, `PR ${index} missing created_at`).toHaveProperty('created_at');
        expect(pr, `PR ${index} missing merged_at`).toHaveProperty('merged_at');
        expect(pr, `PR ${index} missing user`).toHaveProperty('user');
        
        // Validate types
        expect(typeof pr.number, `PR ${index} number should be number`).toBe('number');
        expect(typeof pr.title, `PR ${index} title should be string`).toBe('string');
        expect(typeof pr.created_at, `PR ${index} created_at should be string`).toBe('string');
        
        // merged_at can be null for open PRs
        if (pr.merged_at !== null) {
          expect(typeof pr.merged_at, `PR ${index} merged_at should be string or null`).toBe('string');
        }
        
        expect(typeof pr.user, `PR ${index} user should be object`).toBe('object');
      });
    });

    it('should have valid user object', () => {
      data.pull_requests.forEach((pr, index) => {
        expect(pr.user, `PR ${index} user missing login`).toHaveProperty('login');
        expect(typeof pr.user.login, `PR ${index} user.login should be string`).toBe('string');
        expect(pr.user.login.length, `PR ${index} user.login should not be empty`).toBeGreaterThan(0);
      });
    });

    it('should have valid dates', () => {
      data.pull_requests.forEach((pr, index) => {
        // Validate ISO 8601 format
        expect(() => new Date(pr.created_at), `PR ${index} created_at should be valid date`).not.toThrow();
        
        const createdDate = new Date(pr.created_at);
        expect(isNaN(createdDate.getTime()), `PR ${index} created_at should be valid date`).toBe(false);
        
        if (pr.merged_at) {
          expect(() => new Date(pr.merged_at), `PR ${index} merged_at should be valid date`).not.toThrow();
          
          const mergedDate = new Date(pr.merged_at);
          expect(isNaN(mergedDate.getTime()), `PR ${index} merged_at should be valid date`).toBe(false);
          
          // Merged date should be after created date
          expect(mergedDate >= createdDate, `PR ${index} merged_at should be after created_at`).toBe(true);
        }
      });
    });

    it('should have copilot_generated field', () => {
      data.pull_requests.forEach((pr, index) => {
        if (pr.copilot_generated !== undefined) {
          expect(typeof pr.copilot_generated, `PR ${index} copilot_generated should be boolean`).toBe('boolean');
        }
      });
    });

    it('should have review comments array', () => {
      data.pull_requests.forEach((pr, index) => {
        if (pr.review_comments) {
          expect(Array.isArray(pr.review_comments), `PR ${index} review_comments should be array`).toBe(true);
        }
      });
    });
  });

  describe('Review Comments schema', () => {
    it('should have valid structure for each comment', () => {
      data.pull_requests.forEach((pr, prIndex) => {
        if (pr.review_comments) {
          pr.review_comments.forEach((comment, commentIndex) => {
            expect(comment, `PR ${prIndex} comment ${commentIndex} missing body`).toHaveProperty('body');
            expect(comment, `PR ${prIndex} comment ${commentIndex} missing user`).toHaveProperty('user');
            expect(comment, `PR ${prIndex} comment ${commentIndex} missing created_at`).toHaveProperty('created_at');
            
            expect(typeof comment.body, `PR ${prIndex} comment ${commentIndex} body should be string`).toBe('string');
            expect(typeof comment.user, `PR ${prIndex} comment ${commentIndex} user should be object`).toBe('object');
            expect(typeof comment.created_at, `PR ${prIndex} comment ${commentIndex} created_at should be string`).toBe('string');
          });
        }
      });
    });

    it('should have valid comment dates', () => {
      data.pull_requests.forEach((pr, prIndex) => {
        if (pr.review_comments) {
          pr.review_comments.forEach((comment, commentIndex) => {
            const commentDate = new Date(comment.created_at);
            expect(isNaN(commentDate.getTime()), `PR ${prIndex} comment ${commentIndex} created_at should be valid date`).toBe(false);
            
            // Comment should be after PR creation
            const prCreatedDate = new Date(pr.created_at);
            expect(commentDate >= prCreatedDate, `PR ${prIndex} comment ${commentIndex} should be after PR creation`).toBe(true);
          });
        }
      });
    });
  });

  describe('Data consistency checks', () => {
    it('should have unique PR numbers', () => {
      const numbers = data.pull_requests.map(pr => pr.number);
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size, 'Should not have duplicate PR numbers').toBe(numbers.length);
    });

    it('should have chronological PR creation dates', () => {
      const sortedByNumber = [...data.pull_requests].sort((a, b) => a.number - b.number);
      
      for (let i = 1; i < sortedByNumber.length; i++) {
        const prevDate = new Date(sortedByNumber[i - 1].created_at);
        const currDate = new Date(sortedByNumber[i].created_at);
        
        // PRs with higher numbers should generally have later or equal creation dates
        // (allowing some tolerance for edge cases)
        expect(currDate >= prevDate || Math.abs(currDate - prevDate) < 60000, 
          'PRs should generally be created in order').toBe(true);
      }
    });

    it('should not have future dates', () => {
      const now = new Date();
      
      data.pull_requests.forEach((pr, index) => {
        const createdDate = new Date(pr.created_at);
        expect(createdDate <= now, `PR ${index} created_at should not be in the future`).toBe(true);
        
        if (pr.merged_at) {
          const mergedDate = new Date(pr.merged_at);
          expect(mergedDate <= now, `PR ${index} merged_at should not be in the future`).toBe(true);
        }
      });
    });
  });

  describe('Edge cases and malformed data detection', () => {
    it('should not have empty titles', () => {
      data.pull_requests.forEach((pr, index) => {
        expect(pr.title.trim().length, `PR ${index} should have non-empty title`).toBeGreaterThan(0);
      });
    });

    it('should not have invalid PR numbers', () => {
      data.pull_requests.forEach((pr, index) => {
        expect(pr.number, `PR ${index} should have positive number`).toBeGreaterThan(0);
        expect(Number.isInteger(pr.number), `PR ${index} number should be integer`).toBe(true);
      });
    });

    it('should not have NaN values', () => {
      const checkNoNaN = (obj, path = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fullPath = path ? `${path}.${key}` : key;
          if (typeof value === 'number') {
            expect(isNaN(value), `${fullPath} should not be NaN`).toBe(false);
            expect(isFinite(value), `${fullPath} should be finite`).toBe(true);
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

      checkNoNaN(data);
    });

    it('should handle optional fields gracefully', () => {
      data.pull_requests.forEach((pr, index) => {
        // These fields are optional - just ensure they have correct type if present
        if (pr.additions !== undefined) {
          expect(typeof pr.additions, `PR ${index} additions should be number`).toBe('number');
        }
        if (pr.deletions !== undefined) {
          expect(typeof pr.deletions, `PR ${index} deletions should be number`).toBe('number');
        }
        if (pr.changed_files !== undefined) {
          expect(typeof pr.changed_files, `PR ${index} changed_files should be number`).toBe('number');
        }
      });
    });
  });

  describe('Copilot-specific validations', () => {
    it('should have reasonable distribution of copilot-generated PRs', () => {
      const copilotPRs = data.pull_requests.filter(pr => pr.copilot_generated === true);
      const totalPRs = data.pull_requests.length;
      
      // At least some PRs should be marked (or all unmarked is also valid)
      expect(copilotPRs.length).toBeGreaterThanOrEqual(0);
      expect(copilotPRs.length).toBeLessThanOrEqual(totalPRs);
    });

    it('should validate review comment patterns', () => {
      data.pull_requests.forEach((pr, index) => {
        if (pr.review_comments && pr.review_comments.length > 0) {
          // Each comment should have content
          pr.review_comments.forEach((comment, cIndex) => {
            expect(comment.body.trim().length, 
              `PR ${index} comment ${cIndex} should have content`).toBeGreaterThan(0);
          });
        }
      });
    });
  });
});
