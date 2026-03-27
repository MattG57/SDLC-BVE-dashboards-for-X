import { describe, it, expect } from 'vitest';
import {
  calculateDurationBasedHours,
  calculateLocBasedHours,
  calculateLaborCostSaved,
  calculateHoursPerHumanDev,
  calculateMergeRate,
  aggregateEstimates,
} from '../../src/core/estimators.js';

describe('Agentic Estimators - Duration Based', () => {
  it('calculates hours with default ratio (10x human-to-agent)', () => {
    // 60 minutes of agent time = 1 hour * 10x = 10 human-equivalent hours
    expect(calculateDurationBasedHours(60)).toBe(10);
    expect(calculateDurationBasedHours(120)).toBe(20);
    expect(calculateDurationBasedHours(30)).toBe(5);
  });

  it('calculates hours with custom ratio', () => {
    expect(calculateDurationBasedHours(60, 5)).toBe(5);   // 1 hr * 5x
    expect(calculateDurationBasedHours(120, 15)).toBe(30); // 2 hrs * 15x
  });

  it('handles zero session minutes', () => {
    expect(calculateDurationBasedHours(0)).toBe(0);
  });

  it('throws error for invalid ratio', () => {
    expect(() => calculateDurationBasedHours(60, 0)).toThrow();
    expect(() => calculateDurationBasedHours(60, -5)).toThrow();
  });
});

describe('Agentic Estimators - LoC Based', () => {
  it('calculates hours with default rate (4 hours per 1000 LoC)', () => {
    // Note: Default is 4 hrs/kloc for agentic (vs 2 for AI assisted)
    expect(calculateLocBasedHours(1000)).toBe(4);
    expect(calculateLocBasedHours(500)).toBe(2);
    expect(calculateLocBasedHours(2000)).toBe(8);
  });

  it('calculates hours with custom rate', () => {
    expect(calculateLocBasedHours(1000, 2)).toBe(2);
    expect(calculateLocBasedHours(500, 6)).toBe(3);
  });

  it('handles zero LoC', () => {
    expect(calculateLocBasedHours(0)).toBe(0);
  });

  it('throws error for invalid rate', () => {
    expect(() => calculateLocBasedHours(1000, 0)).toThrow();
    expect(() => calculateLocBasedHours(1000, -2)).toThrow();
  });
});

describe('Agentic Estimators - Labor Cost', () => {
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

describe('Agentic Estimators - Hours Per Human Dev', () => {
  it('calculates per-human-developer hours', () => {
    expect(calculateHoursPerHumanDev(100, 10)).toBe(10);
    expect(calculateHoursPerHumanDev(50, 5)).toBe(10);
  });

  it('handles zero active developers', () => {
    expect(calculateHoursPerHumanDev(100, 0)).toBe(null);
  });

  it('handles fractional results', () => {
    expect(calculateHoursPerHumanDev(100, 3)).toBeCloseTo(33.333, 2);
  });
});

describe('Agentic Estimators - Merge Rate', () => {
  it('calculates merge rate correctly', () => {
    expect(calculateMergeRate(8, 10)).toBe(0.8);  // 80% merge rate
    expect(calculateMergeRate(5, 10)).toBe(0.5);  // 50% merge rate
    expect(calculateMergeRate(10, 10)).toBe(1.0); // 100% merge rate
  });

  it('handles zero PRs merged', () => {
    expect(calculateMergeRate(0, 10)).toBe(0);
  });

  it('handles zero PRs created', () => {
    expect(calculateMergeRate(5, 0)).toBe(null);
  });

  it('handles perfect merge rate', () => {
    expect(calculateMergeRate(20, 20)).toBe(1.0);
  });

  it('caps at 1.0 when merged exceeds created', () => {
    expect(calculateMergeRate(15, 10)).toBe(1.0);
  });

  it('returns null for negative inputs', () => {
    expect(calculateMergeRate(-5, 10)).toBeNull();
    expect(calculateMergeRate(5, -10)).toBeNull();
  });
});

describe('Agentic Estimators - Aggregate', () => {
  it('aggregates daily estimates correctly', () => {
    const dailyData = [
      { hours: 10, humanDevs: 5 },
      { hours: 20, humanDevs: 10 },
      { hours: 15, humanDevs: 5 },
    ];
    
    const result = aggregateEstimates(dailyData);
    
    expect(result.totalHours).toBe(45);
    expect(result.avgOrgHoursPerDay).toBe(15);
    expect(result.daysCount).toBe(3);
    expect(result.avgHoursPerHumanDevPerDay).toBeCloseTo(2.333, 2);
  });

  it('handles days with no agent activity', () => {
    const dailyData = [
      { hours: 20, humanDevs: 10 },
      { hours: 0, humanDevs: 0 },
      { hours: 20, humanDevs: 10 },
    ];
    
    const result = aggregateEstimates(dailyData);
    
    expect(result.totalHours).toBe(40);
    expect(result.avgHoursPerHumanDevPerDay).toBe(2); // Only counts active days
  });

  it('handles empty data', () => {
    const result = aggregateEstimates([]);
    
    expect(result.totalHours).toBe(0);
    expect(result.avgOrgHoursPerDay).toBe(0);
    expect(result.avgHoursPerHumanDevPerDay).toBe(null);
    expect(result.daysCount).toBe(0);
  });
});
