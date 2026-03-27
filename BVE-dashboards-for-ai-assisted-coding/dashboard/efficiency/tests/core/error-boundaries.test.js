/**
 * Error Boundary and Edge Case Tests
 * Tests error handling and boundary conditions across all modules
 */

import { describe, it, expect } from 'vitest';
import { calculateEfficiencyMetrics, calculateTimeSavings, calculateCostSavings } from '../../core/estimators.js';
import { processMetricsData } from '../../core/data-processor.js';

describe('Error Boundary Tests', () => {
  describe('Estimators - Null/Undefined Handling', () => {
    it('should handle null input gracefully', () => {
      expect(() => calculateEfficiencyMetrics(null)).not.toThrow();
      const result = calculateEfficiencyMetrics(null);
      expect(result).toBeDefined();
      expect(result.avgAcceptanceRate).toBe(0);
    });

    it('should handle undefined input gracefully', () => {
      expect(() => calculateEfficiencyMetrics(undefined)).not.toThrow();
      const result = calculateEfficiencyMetrics(undefined);
      expect(result).toBeDefined();
      expect(result.avgAcceptanceRate).toBe(0);
    });

    it('should handle empty object input', () => {
      const result = calculateEfficiencyMetrics({});
      expect(result).toBeDefined();
      expect(result.avgAcceptanceRate).toBe(0);
    });

    it('should handle empty array input', () => {
      const result = calculateEfficiencyMetrics([]);
      expect(result).toBeDefined();
      expect(result.avgAcceptanceRate).toBe(0);
    });
  });

  describe('Estimators - Malformed Data Handling', () => {
    it('should handle missing breakdown arrays', () => {
      const data = {
        copilot_ide_code_completions: [
          { day: '2024-01-01', total_engaged_users: 10 }
          // No breakdown property
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
      const result = calculateEfficiencyMetrics(data);
      expect(result).toBeDefined();
    });

    it('should handle entries with null breakdown', () => {
      const data = {
        copilot_ide_code_completions: [
          { day: '2024-01-01', total_engaged_users: 10, breakdown: null }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle entries with undefined breakdown', () => {
      const data = {
        copilot_ide_code_completions: [
          { day: '2024-01-01', total_engaged_users: 10, breakdown: undefined }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle breakdown entries with missing fields', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              { language: 'javascript' }
              // Missing all numeric fields
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle breakdown entries with null values', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: null,
                acceptances_count: null,
                lines_suggested: null,
                lines_accepted: null
              }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle breakdown entries with string numbers', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: '100',
                acceptances_count: '80',
                lines_suggested: '500',
                lines_accepted: '400'
              }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
      const result = calculateEfficiencyMetrics(data);
      expect(result.avgAcceptanceRate).toBeGreaterThan(0);
    });
  });

  describe('Estimators - Division by Zero Protection', () => {
    it('should handle zero suggestions count', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 0,
                acceptances_count: 0,
                lines_suggested: 0,
                lines_accepted: 0,
                active_users: 1
              }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(isNaN(result.avgAcceptanceRate)).toBe(false);
      expect(isFinite(result.avgAcceptanceRate)).toBe(true);
    });

    it('should handle zero active users', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 100,
                acceptances_count: 80,
                lines_suggested: 500,
                lines_accepted: 400,
                active_users: 0
              }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(isNaN(result.avgAcceptanceRate)).toBe(false);
      expect(isFinite(result.avgAcceptanceRate)).toBe(true);
    });
  });

  describe('Estimators - Extreme Values', () => {
    it('should handle very large numbers', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: Number.MAX_SAFE_INTEGER,
                acceptances_count: Number.MAX_SAFE_INTEGER / 2,
                lines_suggested: Number.MAX_SAFE_INTEGER,
                lines_accepted: Number.MAX_SAFE_INTEGER / 2,
                active_users: 1000
              }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(isNaN(result.avgAcceptanceRate)).toBe(false);
      expect(isFinite(result.avgAcceptanceRate)).toBe(true);
      expect(result.avgAcceptanceRate).toBeGreaterThanOrEqual(0);
      expect(result.avgAcceptanceRate).toBeLessThanOrEqual(100);
    });

    it('should handle very small decimal numbers', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 0.001,
                acceptances_count: 0.0001,
                lines_suggested: 0.001,
                lines_accepted: 0.0001,
                active_users: 1
              }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(isNaN(result.avgAcceptanceRate)).toBe(false);
      expect(isFinite(result.avgAcceptanceRate)).toBe(true);
    });

    it('should handle negative numbers (data error)', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: -100,
                acceptances_count: -80,
                lines_suggested: 100,
                lines_accepted: 80,
                active_users: 1
              }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
      const result = calculateEfficiencyMetrics(data);
      expect(result).toBeDefined();
    });
  });

  describe('Data Processor - Error Handling', () => {
    it('should handle null data gracefully', () => {
      expect(() => processMetricsData(null)).not.toThrow();
      const result = processMetricsData(null);
      expect(result).toBeDefined();
    });

    it('should handle undefined data gracefully', () => {
      expect(() => processMetricsData(undefined)).not.toThrow();
      const result = processMetricsData(undefined);
      expect(result).toBeDefined();
    });

    it('should handle empty object', () => {
      expect(() => processMetricsData({})).not.toThrow();
      const result = processMetricsData({});
      expect(result).toBeDefined();
    });

    it('should handle partial data structures', () => {
      const data = {
        copilot_ide_code_completions: [
          { day: '2024-01-01' }
        ]
        // Missing other required fields
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });

    it('should handle mixed valid and invalid entries', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 100,
                acceptances_count: 80,
                lines_suggested: 500,
                lines_accepted: 400,
                active_users: 10
              }
            ]
          },
          {
            day: '2024-01-02',
            breakdown: null
          },
          {
            day: '2024-01-03',
            breakdown: [
              {
                language: 'python',
                suggestions_count: null,
                acceptances_count: null
              }
            ]
          }
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
      const result = processMetricsData(data);
      expect(result).toBeDefined();
    });
  });

  describe('Time Savings - Edge Cases', () => {
    it('should handle zero acceptance rate', () => {
      const result = calculateTimeSavings(0, 1000);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero lines accepted', () => {
      const result = calculateTimeSavings(50, 0);
      expect(result).toBe(0);
    });

    it('should handle 100% acceptance rate', () => {
      const result = calculateTimeSavings(100, 1000);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle acceptance rate > 100%', () => {
      const result = calculateTimeSavings(150, 1000);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
    });

    it('should handle negative acceptance rate', () => {
      expect(() => calculateTimeSavings(-10, 1000)).not.toThrow();
    });

    it('should handle negative lines accepted', () => {
      expect(() => calculateTimeSavings(50, -1000)).not.toThrow();
    });
  });

  describe('Cost Savings - Edge Cases', () => {
    it('should handle zero time savings', () => {
      const result = calculateCostSavings(0, 50);
      expect(result).toBe(0);
    });

    it('should handle zero hourly rate', () => {
      const result = calculateCostSavings(100, 0);
      expect(result).toBe(0);
    });

    it('should handle very high hourly rates', () => {
      const result = calculateCostSavings(1000, 10000);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle negative time savings', () => {
      expect(() => calculateCostSavings(-100, 50)).not.toThrow();
    });

    it('should handle negative hourly rate', () => {
      expect(() => calculateCostSavings(100, -50)).not.toThrow();
    });
  });

  describe('Type Coercion Tests', () => {
    it('should handle string numbers in calculations', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: '100',
                acceptances_count: '80',
                lines_suggested: '500',
                lines_accepted: '400',
                active_users: '10'
              }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(result.avgAcceptanceRate).toBeGreaterThan(0);
    });

    it('should handle boolean values', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: true,
                acceptances_count: false,
                lines_suggested: true,
                lines_accepted: false,
                active_users: true
              }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });
  });

  describe('Date Handling Edge Cases', () => {
    it('should handle invalid date formats', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: 'invalid-date',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 100,
                acceptances_count: 80,
                lines_suggested: 500,
                lines_accepted: 400,
                active_users: 10
              }
            ]
          }
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });

    it('should handle empty date strings', () => {
      const data = {
        copilot_ide_code_completions: [
          {
            day: '',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 100,
                acceptances_count: 80,
                lines_suggested: 500,
                lines_accepted: 400,
                active_users: 10
              }
            ]
          }
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });

    it('should handle future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 10);
      
      const data = {
        copilot_ide_code_completions: [
          {
            day: futureDate.toISOString().split('T')[0],
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 100,
                acceptances_count: 80,
                lines_suggested: 500,
                lines_accepted: 400,
                active_users: 10
              }
            ]
          }
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });
  });
});
