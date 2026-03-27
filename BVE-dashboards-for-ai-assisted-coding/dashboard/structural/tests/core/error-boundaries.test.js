/**
 * Error Boundary and Edge Case Tests for Structural Quality Dashboard
 */

import { describe, it, expect } from 'vitest';
import { 
  calculateReviewThoroughness, 
  calculateDefectReductionMetrics,
  calculateCodeQualityScore 
} from '../../core/calculators.js';
import { processStructuralData } from '../../core/data-processor.js';

describe('Structural Dashboard Error Boundaries', () => {
  describe('Calculator - Null/Undefined Handling', () => {
    it('should handle null input in review thoroughness', () => {
      expect(() => calculateReviewThoroughness(null)).not.toThrow();
      const result = calculateReviewThoroughness(null);
      expect(result).toBeDefined();
    });

    it('should handle undefined input in review thoroughness', () => {
      expect(() => calculateReviewThoroughness(undefined)).not.toThrow();
      const result = calculateReviewThoroughness(undefined);
      expect(result).toBeDefined();
    });

    it('should handle empty array input', () => {
      const result = calculateReviewThoroughness([]);
      expect(result).toBeDefined();
      expect(result.avgCommentsPerPR).toBe(0);
    });

    it('should handle null input in defect reduction metrics', () => {
      expect(() => calculateDefectReductionMetrics(null)).not.toThrow();
    });

    it('should handle null input in code quality score', () => {
      expect(() => calculateCodeQualityScore(null)).not.toThrow();
    });
  });

  describe('Calculator - Malformed Data Handling', () => {
    it('should handle PRs with missing review_comments', () => {
      const data = [
        { number: 1, title: 'Test PR', created_at: '2024-01-01' }
        // No review_comments property
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle PRs with null review_comments', () => {
      const data = [
        { number: 1, title: 'Test PR', review_comments: null }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle PRs with undefined review_comments', () => {
      const data = [
        { number: 1, title: 'Test PR', review_comments: undefined }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle PRs with empty review_comments array', () => {
      const data = [
        { number: 1, title: 'Test PR', review_comments: [] }
      ];
      
      const result = calculateReviewThoroughness(data);
      expect(result.avgCommentsPerPR).toBe(0);
    });

    it('should handle review comments with missing body', () => {
      const data = [
        {
          number: 1,
          title: 'Test PR',
          review_comments: [
            { user: { login: 'dev1' } }
            // No body property
          ]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle review comments with null body', () => {
      const data = [
        {
          number: 1,
          title: 'Test PR',
          review_comments: [
            { body: null, user: { login: 'dev1' } }
          ]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle review comments with empty body', () => {
      const data = [
        {
          number: 1,
          title: 'Test PR',
          review_comments: [
            { body: '', user: { login: 'dev1' } }
          ]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });
  });

  describe('Calculator - Division by Zero Protection', () => {
    it('should handle zero PRs when calculating averages', () => {
      const result = calculateReviewThoroughness([]);
      
      expect(isNaN(result.avgCommentsPerPR)).toBe(false);
      expect(isFinite(result.avgCommentsPerPR)).toBe(true);
      expect(result.avgCommentsPerPR).toBe(0);
    });

    it('should handle zero copilot PRs', () => {
      const data = [
        { 
          number: 1, 
          copilot_generated: false, 
          review_comments: [{ body: 'comment' }] 
        }
      ];
      
      expect(() => calculateDefectReductionMetrics(data)).not.toThrow();
    });

    it('should handle zero non-copilot PRs', () => {
      const data = [
        { 
          number: 1, 
          copilot_generated: true, 
          review_comments: [{ body: 'comment' }] 
        }
      ];
      
      expect(() => calculateDefectReductionMetrics(data)).not.toThrow();
    });
  });

  describe('Calculator - Extreme Values', () => {
    it('should handle very large number of review comments', () => {
      const data = [
        {
          number: 1,
          review_comments: Array.from({ length: 10000 }, (_, i) => ({
            body: `Comment ${i}`,
            user: { login: 'dev1' }
          }))
        }
      ];
      
      const result = calculateReviewThoroughness(data);
      expect(isNaN(result.avgCommentsPerPR)).toBe(false);
      expect(isFinite(result.avgCommentsPerPR)).toBe(true);
      expect(result.avgCommentsPerPR).toBe(10000);
    });

    it('should handle very large PR numbers', () => {
      const data = [
        {
          number: Number.MAX_SAFE_INTEGER,
          review_comments: [{ body: 'comment' }]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle very long comment bodies', () => {
      const data = [
        {
          number: 1,
          review_comments: [
            { body: 'x'.repeat(100000), user: { login: 'dev1' } }
          ]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle negative PR numbers (malformed data)', () => {
      const data = [
        { number: -1, review_comments: [] }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });
  });

  describe('Data Processor - Error Handling', () => {
    it('should handle null data gracefully', () => {
      expect(() => processStructuralData(null)).not.toThrow();
    });

    it('should handle undefined data gracefully', () => {
      expect(() => processStructuralData(undefined)).not.toThrow();
    });

    it('should handle empty object', () => {
      expect(() => processStructuralData({})).not.toThrow();
    });

    it('should handle missing pull_requests array', () => {
      const data = { other_field: 'value' };
      expect(() => processStructuralData(data)).not.toThrow();
    });

    it('should handle null pull_requests array', () => {
      const data = { pull_requests: null };
      expect(() => processStructuralData(data)).not.toThrow();
    });

    it('should handle mixed valid and invalid PRs', () => {
      const data = {
        pull_requests: [
          {
            number: 1,
            title: 'Valid PR',
            created_at: '2024-01-01',
            review_comments: [{ body: 'comment' }]
          },
          {
            number: 2,
            // Missing title
            created_at: '2024-01-02',
            review_comments: null
          },
          null, // Null PR
          {
            number: 3,
            title: 'Another valid PR',
            created_at: '2024-01-03'
          }
        ]
      };
      
      expect(() => processStructuralData(data)).not.toThrow();
    });
  });

  describe('Date Handling Edge Cases', () => {
    it('should handle invalid date formats', () => {
      const data = [
        {
          number: 1,
          created_at: 'invalid-date',
          review_comments: []
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle missing created_at', () => {
      const data = [
        {
          number: 1,
          review_comments: []
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle null created_at', () => {
      const data = [
        {
          number: 1,
          created_at: null,
          review_comments: []
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 10);
      
      const data = [
        {
          number: 1,
          created_at: futureDate.toISOString(),
          review_comments: []
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle merged_at before created_at (data error)', () => {
      const data = [
        {
          number: 1,
          created_at: '2024-01-02',
          merged_at: '2024-01-01', // Before created
          review_comments: []
        }
      ];
      
      expect(() => processStructuralData(data)).not.toThrow();
    });
  });

  describe('Type Coercion Tests', () => {
    it('should handle string PR numbers', () => {
      const data = [
        {
          number: '123',
          review_comments: []
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle boolean values in unexpected places', () => {
      const data = [
        {
          number: true,
          review_comments: false
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle numeric strings in dates', () => {
      const data = [
        {
          number: 1,
          created_at: '1704067200000', // Timestamp as string
          review_comments: []
        }
      ];
      
      expect(() => processStructuralData(data)).not.toThrow();
    });
  });

  describe('Copilot-Generated Flag Edge Cases', () => {
    it('should handle missing copilot_generated flag', () => {
      const data = [
        {
          number: 1,
          review_comments: []
        }
      ];
      
      expect(() => calculateDefectReductionMetrics(data)).not.toThrow();
    });

    it('should handle null copilot_generated flag', () => {
      const data = [
        {
          number: 1,
          copilot_generated: null,
          review_comments: []
        }
      ];
      
      expect(() => calculateDefectReductionMetrics(data)).not.toThrow();
    });

    it('should handle string copilot_generated flag', () => {
      const data = [
        {
          number: 1,
          copilot_generated: 'true',
          review_comments: []
        }
      ];
      
      expect(() => calculateDefectReductionMetrics(data)).not.toThrow();
    });

    it('should handle numeric copilot_generated flag', () => {
      const data = [
        {
          number: 1,
          copilot_generated: 1,
          review_comments: []
        }
      ];
      
      expect(() => calculateDefectReductionMetrics(data)).not.toThrow();
    });
  });

  describe('User Object Edge Cases', () => {
    it('should handle missing user object', () => {
      const data = [
        {
          number: 1,
          review_comments: [
            { body: 'comment' }
            // No user object
          ]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle null user object', () => {
      const data = [
        {
          number: 1,
          review_comments: [
            { body: 'comment', user: null }
          ]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle missing login in user object', () => {
      const data = [
        {
          number: 1,
          review_comments: [
            { body: 'comment', user: {} }
          ]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle empty login string', () => {
      const data = [
        {
          number: 1,
          review_comments: [
            { body: 'comment', user: { login: '' } }
          ]
        }
      ];
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });
  });

  describe('Array and Object Edge Cases', () => {
    it('should handle non-array passed where array expected', () => {
      expect(() => calculateReviewThoroughness('not an array')).not.toThrow();
      expect(() => calculateReviewThoroughness(123)).not.toThrow();
      expect(() => calculateReviewThoroughness(true)).not.toThrow();
    });

    it('should handle sparse arrays', () => {
      const data = new Array(10);
      data[0] = { number: 1, review_comments: [] };
      data[5] = { number: 2, review_comments: [] };
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });

    it('should handle circular references', () => {
      const data = [
        { number: 1, review_comments: [] }
      ];
      data[0].self = data[0]; // Circular reference
      
      expect(() => calculateReviewThoroughness(data)).not.toThrow();
    });
  });
});
