/**
 * Cross-Module Integration Tests
 * Tests interactions between data-processor and estimators
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  processEnterpriseReport,
  processUserReport,
  aggregateUserRecordsByDay,
  filterByDateRange,
} from '../../src/core/data-processor.js';
import {
  calculateInteractionBasedHours,
  calculateLocBasedHours,
  calculateLaborCostSaved,
  calculateHoursPerDev,
  aggregateEstimates,
} from '../../src/core/estimators.js';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Cross-Module Integration Tests', () => {
  let exampleData;

  beforeAll(() => {
    const dataPath = path.join(__dirname, '../fixtures/sample-data.json');
    if (!fs.existsSync(dataPath)) {
      console.warn('Fixture data not found, skipping integration tests');
      return;
    }
    const content = fs.readFileSync(dataPath, 'utf8');
    exampleData = JSON.parse(content);
  });

  describe('Data Processor → Estimators Pipeline', () => {
    it('should process enterprise report and calculate hours without errors', () => {
      if (!exampleData) return;
      expect(() => {
        const processed = processEnterpriseReport(exampleData.enterprise_report);
        const totalInteractions = processed.reduce((sum, d) => sum + d.interactions, 0);
        calculateInteractionBasedHours(totalInteractions);
      }).not.toThrow();
    });

    it('should produce consistent results when called multiple times', () => {
      if (!exampleData) return;
      const processed1 = processEnterpriseReport(exampleData.enterprise_report);
      const processed2 = processEnterpriseReport(exampleData.enterprise_report);

      const interactions1 = processed1.reduce((sum, d) => sum + d.interactions, 0);
      const interactions2 = processed2.reduce((sum, d) => sum + d.interactions, 0);
      expect(interactions1).toBe(interactions2);
    });
  });

  describe('Metrics Calculation Chain', () => {
    it('should calculate full chain: data → hours → cost', () => {
      if (!exampleData) return;
      const processed = processEnterpriseReport(exampleData.enterprise_report);
      const totalInteractions = processed.reduce((sum, d) => sum + d.interactions, 0);
      const totalLoc = processed.reduce((sum, d) => sum + d.locAdded, 0);

      const interactionHours = calculateInteractionBasedHours(totalInteractions);
      const locHours = calculateLocBasedHours(totalLoc);
      const costSaved = calculateLaborCostSaved(interactionHours);

      expect(interactionHours).toBeGreaterThanOrEqual(0);
      expect(locHours).toBeGreaterThanOrEqual(0);
      expect(costSaved).toBeGreaterThanOrEqual(0);
    });

    it('should produce proportional results: more interactions = more savings', () => {
      const lowHours = calculateInteractionBasedHours(100);
      const highHours = calculateInteractionBasedHours(1000);
      expect(highHours).toBeGreaterThan(lowHours);

      const lowCost = calculateLaborCostSaved(lowHours);
      const highCost = calculateLaborCostSaved(highHours);
      expect(highCost).toBeGreaterThan(lowCost);
    });
  });

  describe('Data Aggregation Consistency', () => {
    it('should aggregate user records by day consistently', () => {
      const userRecords = [
        { day: '2024-01-01', dailyActiveUsers: 1, interactions: 10, codeGenerations: 5, codeAcceptances: 3, locAdded: 100, userLogin: 'user1' },
        { day: '2024-01-01', dailyActiveUsers: 1, interactions: 20, codeGenerations: 8, codeAcceptances: 6, locAdded: 200, userLogin: 'user2' },
        { day: '2024-01-02', dailyActiveUsers: 1, interactions: 15, codeGenerations: 7, codeAcceptances: 4, locAdded: 150, userLogin: 'user1' },
      ];

      const byDay = aggregateUserRecordsByDay(userRecords);
      expect(byDay['2024-01-01'].interactions).toBe(30);
      expect(byDay['2024-01-01'].locAdded).toBe(300);
      expect(byDay['2024-01-02'].interactions).toBe(15);
    });

    it('should handle aggregation of multiple days through estimators', () => {
      const dailyData = [
        { hours: 10, activeUsers: 5 },
        { hours: 20, activeUsers: 10 },
      ];

      const result = aggregateEstimates(dailyData);
      expect(result.totalHours).toBe(30);
      expect(result.daysCount).toBe(2);
      expect(result.avgOrgHoursPerDay).toBe(15);
    });
  });

  describe('Date Range Handling', () => {
    it('should handle various date ranges consistently', () => {
      if (!exampleData) return;
      const processed = processEnterpriseReport(exampleData.enterprise_report);

      if (processed.length >= 2) {
        const allDates = processed.map(d => d.day).sort();
        const midDate = allDates[Math.floor(allDates.length / 2)];

        const filtered = filterByDateRange(processed, midDate, allDates[allDates.length - 1]);
        expect(filtered.length).toBeLessThanOrEqual(processed.length);
        expect(filtered.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Case Propagation', () => {
    it('should handle zero values propagating through the chain', () => {
      const hours = calculateInteractionBasedHours(0);
      const cost = calculateLaborCostSaved(hours);

      expect(hours).toBe(0);
      expect(cost).toBe(0);
    });

    it('should handle per-dev calculation with zero users', () => {
      const hoursPerDev = calculateHoursPerDev(100, 0);
      expect(hoursPerDev).toBeNull();
    });
  });

  describe('Data Validation Chain', () => {
    it('should validate cost savings are proportional to time savings', () => {
      const hours = calculateInteractionBasedHours(200);
      const costAt50 = calculateLaborCostSaved(hours, 50);
      const costAt100 = calculateLaborCostSaved(hours, 100);

      expect(costAt100).toBe(costAt50 * 2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', () => {
      const largeDailyData = Array.from({ length: 365 }, () => ({
        hours: 100,
        activeUsers: 50,
      }));

      const startTime = Date.now();
      const result = aggregateEstimates(largeDailyData);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result).toBeDefined();
      expect(result.totalHours).toBe(36500);
    });
  });
});
