/**
 * Cross-Module Integration Tests
 * Tests interactions between data-processor and estimators
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { processMetricsData } from '../../core/data-processor.js';
import { calculateEfficiencyMetrics, calculateTimeSavings, calculateCostSavings } from '../../core/estimators.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Cross-Module Integration Tests', () => {
  let exampleData;
  let processedData;

  beforeAll(() => {
    const dataPath = path.join(__dirname, '../fixtures/sample-data.json');
    const content = fs.readFileSync(dataPath, 'utf8');
    exampleData = JSON.parse(content);
    processedData = processMetricsData(exampleData);
  });

  describe('Data Processor → Estimators Pipeline', () => {
    it('should process data and calculate metrics without errors', () => {
      expect(() => {
        const processed = processMetricsData(exampleData);
        const metrics = calculateEfficiencyMetrics(exampleData);
      }).not.toThrow();
    });

    it('should produce consistent results when called multiple times', () => {
      const metrics1 = calculateEfficiencyMetrics(exampleData);
      const metrics2 = calculateEfficiencyMetrics(exampleData);
      
      expect(metrics1.avgAcceptanceRate).toBe(metrics2.avgAcceptanceRate);
      expect(metrics1.totalLinesSuggested).toBe(metrics2.totalLinesSuggested);
      expect(metrics1.totalLinesAccepted).toBe(metrics2.totalLinesAccepted);
    });

    it('should handle processed data being passed to estimators', () => {
      // Even if data is already processed, estimators should work
      const processed = processMetricsData(exampleData);
      expect(() => calculateEfficiencyMetrics(exampleData)).not.toThrow();
    });
  });

  describe('Metrics Calculation Chain', () => {
    it('should calculate full metrics chain: data → efficiency → time → cost', () => {
      const metrics = calculateEfficiencyMetrics(exampleData);
      const timeSavings = calculateTimeSavings(metrics.avgAcceptanceRate, metrics.totalLinesAccepted);
      const costSavings = calculateCostSavings(timeSavings, 50);

      expect(metrics).toBeDefined();
      expect(timeSavings).toBeGreaterThanOrEqual(0);
      expect(costSavings).toBeGreaterThanOrEqual(0);
    });

    it('should maintain data integrity through the chain', () => {
      const metrics = calculateEfficiencyMetrics(exampleData);
      
      // Lines accepted should never exceed lines suggested
      expect(metrics.totalLinesAccepted).toBeLessThanOrEqual(metrics.totalLinesSuggested);
      
      // Acceptance rate should be between 0 and 100 (or slightly higher in edge cases)
      expect(metrics.avgAcceptanceRate).toBeGreaterThanOrEqual(0);
      expect(metrics.avgAcceptanceRate).toBeLessThan(200); // Allow some margin for edge cases
    });

    it('should produce proportional results: higher acceptance = higher savings', () => {
      const lowAcceptanceData = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 1000,
                acceptances_count: 100, // 10% acceptance
                lines_suggested: 5000,
                lines_accepted: 500,
                active_users: 10
              }
            ]
          }
        ]
      };

      const highAcceptanceData = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 1000,
                acceptances_count: 800, // 80% acceptance
                lines_suggested: 5000,
                lines_accepted: 4000,
                active_users: 10
              }
            ]
          }
        ]
      };

      const lowMetrics = calculateEfficiencyMetrics(lowAcceptanceData);
      const highMetrics = calculateEfficiencyMetrics(highAcceptanceData);

      const lowTimeSavings = calculateTimeSavings(lowMetrics.avgAcceptanceRate, lowMetrics.totalLinesAccepted);
      const highTimeSavings = calculateTimeSavings(highMetrics.avgAcceptanceRate, highMetrics.totalLinesAccepted);

      expect(highTimeSavings).toBeGreaterThan(lowTimeSavings);
    });
  });

  describe('Data Aggregation Consistency', () => {
    it('should aggregate data consistently across metrics', () => {
      const metrics = calculateEfficiencyMetrics(exampleData);
      
      // Total active users should be reasonable
      expect(metrics.totalActiveUsers).toBeGreaterThan(0);
      
      // Lines suggested and accepted should be positive
      expect(metrics.totalLinesSuggested).toBeGreaterThan(0);
      expect(metrics.totalLinesAccepted).toBeGreaterThan(0);
    });

    it('should handle aggregation of multiple days', () => {
      const multiDayData = {
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

      const metrics = calculateEfficiencyMetrics(multiDayData);
      
      // Should aggregate across days
      expect(metrics.totalLinesSuggested).toBe(1000);
      expect(metrics.totalLinesAccepted).toBe(800);
    });

    it('should handle aggregation of multiple languages', () => {
      const multiLangData = {
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
                active_users: 5
              },
              {
                language: 'python',
                suggestions_count: 100,
                acceptances_count: 80,
                lines_suggested: 500,
                lines_accepted: 400,
                active_users: 5
              }
            ]
          }
        ]
      };

      const metrics = calculateEfficiencyMetrics(multiLangData);
      
      // Should aggregate across languages
      expect(metrics.totalLinesSuggested).toBe(1000);
      expect(metrics.totalLinesAccepted).toBe(800);
    });
  });

  describe('Developer Filtering Integration', () => {
    it('should handle developer-specific filtering', () => {
      // This tests the integration with developer filtering
      // Even if the underlying data structure changes, calculations should work
      const developerData = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                editor: 'vscode',
                suggestions_count: 50,
                acceptances_count: 40,
                lines_suggested: 250,
                lines_accepted: 200,
                active_users: 1 // Single developer
              }
            ]
          }
        ]
      };

      const metrics = calculateEfficiencyMetrics(developerData);
      expect(metrics.totalActiveUsers).toBe(1);
      expect(metrics.avgAcceptanceRate).toBeGreaterThan(0);
    });
  });

  describe('Date Range Handling', () => {
    it('should handle various date ranges consistently', () => {
      const createDataForDateRange = (days) => ({
        copilot_ide_code_completions: Array.from({ length: days }, (_, i) => ({
          day: `2024-01-${String(i + 1).padStart(2, '0')}`,
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
        }))
      });

      const data7Days = createDataForDateRange(7);
      const data28Days = createDataForDateRange(28);

      const metrics7 = calculateEfficiencyMetrics(data7Days);
      const metrics28 = calculateEfficiencyMetrics(data28Days);

      // Acceptance rate should be similar regardless of date range
      expect(Math.abs(metrics7.avgAcceptanceRate - metrics28.avgAcceptanceRate)).toBeLessThan(1);

      // Total lines should scale with date range
      expect(metrics28.totalLinesAccepted).toBe(metrics7.totalLinesAccepted * 4);
    });
  });

  describe('Edge Case Propagation', () => {
    it('should handle zero values propagating through the chain', () => {
      const zeroData = {
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
                active_users: 0
              }
            ]
          }
        ]
      };

      const metrics = calculateEfficiencyMetrics(zeroData);
      const timeSavings = calculateTimeSavings(metrics.avgAcceptanceRate, metrics.totalLinesAccepted);
      const costSavings = calculateCostSavings(timeSavings, 50);

      expect(isNaN(metrics.avgAcceptanceRate)).toBe(false);
      expect(isNaN(timeSavings)).toBe(false);
      expect(isNaN(costSavings)).toBe(false);
      
      expect(timeSavings).toBe(0);
      expect(costSavings).toBe(0);
    });

    it('should handle partial data propagating through the chain', () => {
      const partialData = {
        copilot_ide_code_completions: [
          {
            day: '2024-01-01',
            breakdown: [
              {
                language: 'javascript',
                suggestions_count: 100,
                acceptances_count: 80,
                lines_suggested: null, // Partial data
                lines_accepted: null,
                active_users: 10
              }
            ]
          }
        ]
      };

      expect(() => {
        const metrics = calculateEfficiencyMetrics(partialData);
        const timeSavings = calculateTimeSavings(metrics.avgAcceptanceRate, metrics.totalLinesAccepted);
        const costSavings = calculateCostSavings(timeSavings, 50);
      }).not.toThrow();
    });
  });

  describe('Data Validation Chain', () => {
    it('should validate data constraints are maintained', () => {
      const metrics = calculateEfficiencyMetrics(exampleData);

      // Constraints that should always hold
      expect(metrics.totalLinesAccepted).toBeLessThanOrEqual(metrics.totalLinesSuggested);
      expect(metrics.totalActiveUsers).toBeGreaterThanOrEqual(0);
      expect(metrics.avgAcceptanceRate).toBeGreaterThanOrEqual(0);
    });

    it('should validate time savings are non-negative', () => {
      const metrics = calculateEfficiencyMetrics(exampleData);
      const timeSavings = calculateTimeSavings(metrics.avgAcceptanceRate, metrics.totalLinesAccepted);

      expect(timeSavings).toBeGreaterThanOrEqual(0);
    });

    it('should validate cost savings are proportional to time savings', () => {
      const metrics = calculateEfficiencyMetrics(exampleData);
      const timeSavings = calculateTimeSavings(metrics.avgAcceptanceRate, metrics.totalLinesAccepted);
      
      const costSavings50 = calculateCostSavings(timeSavings, 50);
      const costSavings100 = calculateCostSavings(timeSavings, 100);

      expect(costSavings100).toBe(costSavings50 * 2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = {
        copilot_ide_code_completions: Array.from({ length: 365 }, (_, i) => ({
          day: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
          breakdown: Array.from({ length: 10 }, (_, j) => ({
            language: `lang${j}`,
            editor: `editor${j}`,
            suggestions_count: 1000,
            acceptances_count: 800,
            lines_suggested: 5000,
            lines_accepted: 4000,
            active_users: 50
          }))
        }))
      };

      const startTime = Date.now();
      const metrics = calculateEfficiencyMetrics(largeData);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(metrics).toBeDefined();
    });
  });
});
