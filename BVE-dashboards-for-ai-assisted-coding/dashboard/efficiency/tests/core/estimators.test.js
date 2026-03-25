import { describe, it, expect } from 'vitest';
import {
  calculateInteractionBasedHours,
  calculateLocBasedHours,
  calculateManualDailyPercentHours,
  calculateLaborCostSaved,
  calculateHoursPerDev,
  aggregateEstimates,
} from '../../src/core/estimators.js';

describe('Estimators - Interaction Based', () => {
  it('calculates hours with default rate (20 interactions per hour)', () => {
    expect(calculateInteractionBasedHours(100)).toBe(5);
    expect(calculateInteractionBasedHours(40)).toBe(2);
    expect(calculateInteractionBasedHours(200)).toBe(10);
  });

  it('calculates hours with custom rate', () => {
    expect(calculateInteractionBasedHours(100, 25)).toBe(4);
    expect(calculateInteractionBasedHours(100, 50)).toBe(2);
  });

  it('handles zero interactions', () => {
    expect(calculateInteractionBasedHours(0)).toBe(0);
  });

  it('throws error for invalid rate', () => {
    expect(() => calculateInteractionBasedHours(100, 0)).toThrow();
    expect(() => calculateInteractionBasedHours(100, -5)).toThrow();
  });
});

describe('Estimators - LoC Based', () => {
  it('calculates hours with default rate (2 hours per 1000 LoC)', () => {
    expect(calculateLocBasedHours(1000)).toBe(2);
    expect(calculateLocBasedHours(500)).toBe(1);
    expect(calculateLocBasedHours(2000)).toBe(4);
  });

  it('calculates hours with custom rate', () => {
    expect(calculateLocBasedHours(1000, 4)).toBe(4);
    expect(calculateLocBasedHours(500, 4)).toBe(2);
  });

  it('handles zero LoC', () => {
    expect(calculateLocBasedHours(0)).toBe(0);
  });

  it('throws error for invalid rate', () => {
    expect(() => calculateLocBasedHours(1000, 0)).toThrow();
    expect(() => calculateLocBasedHours(1000, -2)).toThrow();
  });
});

describe('Estimators - Manual Daily Percent', () => {
  it('calculates hours with default parameters', () => {
    // 20% of 30 hrs/week / 5 days = 1.2 hrs/dev/day
    // With 10 devs = 12 hours total
    const result = calculateManualDailyPercentHours(10, 0.20, 30, 5);
    expect(result).toBe(12);
  });

  it('calculates hours per developer correctly', () => {
    // 1 dev should get 1.2 hours
    const result = calculateManualDailyPercentHours(1, 0.20, 30, 5);
    expect(result).toBe(1.2);
  });

  it('scales linearly with number of developers', () => {
    const oneDevHours = calculateManualDailyPercentHours(1, 0.20, 30, 5);
    const tenDevHours = calculateManualDailyPercentHours(10, 0.20, 30, 5);
    expect(tenDevHours).toBe(oneDevHours * 10);
  });

  it('handles different percentage values', () => {
    const result10pct = calculateManualDailyPercentHours(5, 0.10, 30, 5);
    const result20pct = calculateManualDailyPercentHours(5, 0.20, 30, 5);
    expect(result20pct).toBe(result10pct * 2);
  });

  it('handles zero active users', () => {
    expect(calculateManualDailyPercentHours(0)).toBe(0);
  });

  it('validates percentage range', () => {
    expect(() => calculateManualDailyPercentHours(5, -0.1)).toThrow();
    expect(() => calculateManualDailyPercentHours(5, 1.5)).toThrow();
  });

  it('validates positive baseline and workdays', () => {
    expect(() => calculateManualDailyPercentHours(5, 0.2, 0, 5)).toThrow();
    expect(() => calculateManualDailyPercentHours(5, 0.2, 30, 0)).toThrow();
  });
});

describe('Estimators - Labor Cost', () => {
  it('calculates cost with default rate ($150/hr)', () => {
    expect(calculateLaborCostSaved(10)).toBe(1500);
    expect(calculateLaborCostSaved(100)).toBe(15000);
  });

  it('calculates cost with custom rate', () => {
    expect(calculateLaborCostSaved(10, 200)).toBe(2000);
    expect(calculateLaborCostSaved(5, 100)).toBe(500);
  });

  it('handles zero hours', () => {
    expect(calculateLaborCostSaved(0)).toBe(0);
  });

  it('throws error for invalid cost rate', () => {
    expect(() => calculateLaborCostSaved(10, 0)).toThrow();
    expect(() => calculateLaborCostSaved(10, -50)).toThrow();
  });
});

describe('Estimators - Hours Per Dev', () => {
  it('calculates per-developer hours', () => {
    expect(calculateHoursPerDev(100, 10)).toBe(10);
    expect(calculateHoursPerDev(50, 5)).toBe(10);
  });

  it('handles zero active users', () => {
    expect(calculateHoursPerDev(100, 0)).toBe(null);
  });

  it('handles fractional results', () => {
    expect(calculateHoursPerDev(100, 3)).toBeCloseTo(33.333, 2);
  });
});

describe('Estimators - Aggregate', () => {
  it('aggregates daily estimates correctly', () => {
    const dailyData = [
      { hours: 10, activeUsers: 5 },
      { hours: 20, activeUsers: 10 },
      { hours: 15, activeUsers: 5 },
    ];
    
    const result = aggregateEstimates(dailyData);
    
    expect(result.totalHours).toBe(45);
    expect(result.avgOrgHoursPerDay).toBe(15);
    expect(result.daysCount).toBe(3);
    // Per-dev avg: (10/5 + 20/10 + 15/5) / 3 = (2 + 2 + 3) / 3 = 2.333
    expect(result.avgHoursPerDevPerDay).toBeCloseTo(2.333, 2);
  });

  it('handles days with zero active users', () => {
    const dailyData = [
      { hours: 10, activeUsers: 5 },
      { hours: 0, activeUsers: 0 },  // Should be excluded from per-dev avg
      { hours: 10, activeUsers: 5 },
    ];
    
    const result = aggregateEstimates(dailyData);
    
    expect(result.totalHours).toBe(20);
    expect(result.avgOrgHoursPerDay).toBeCloseTo(6.667, 2);
    expect(result.avgHoursPerDevPerDay).toBe(2); // Only counts 2 days with active users
  });

  it('handles empty data', () => {
    const result = aggregateEstimates([]);
    
    expect(result.totalHours).toBe(0);
    expect(result.avgOrgHoursPerDay).toBe(0);
    expect(result.avgHoursPerDevPerDay).toBe(null);
    expect(result.daysCount).toBe(0);
  });

  it('handles all days with zero users', () => {
    const dailyData = [
      { hours: 0, activeUsers: 0 },
      { hours: 0, activeUsers: 0 },
    ];
    
    const result = aggregateEstimates(dailyData);
    
    expect(result.avgHoursPerDevPerDay).toBe(null);
  });
});
