import { describe, it, expect } from 'vitest';
import {
  processMergedPRsByDate,
  countIssuesByDate,
  calculateTurbulenceByDate,
  aggregateToDayLevel,
  fillDayGaps,
} from '../../src/core/data-processor.js';

describe('Data Processor - Merged PRs', () => {
  const samplePRs = [
    {
      pr_created_at: '2024-03-23T10:00:00Z',
      pr_merged_at: '2024-03-23T14:00:00Z',
      additions: 100,
      deletions: 20,
      duration_type: 'agent',
      duration_minutes: 30
    },
    {
      pr_created_at: '2024-03-23T11:00:00Z',
      pr_merged_at: null, // Not merged
      additions: 200
    }
  ];

  it('processes only merged PRs', () => {
    const result = processMergedPRsByDate(samplePRs);
    expect(result['2024-03-23'].locAdded).toBe(100);
  });

  it('only counts agent duration', () => {
    const result = processMergedPRsByDate(samplePRs);
    expect(result['2024-03-23'].sessionMinutes).toBe(30);
  });
});

describe('Data Processor - Aggregate To Day Level', () => {
  const devDays = [
    { date: '2024-03-23', total_agent_requests: 10, sessions_started: 5, agent_prs_created: 2 },
    { date: '2024-03-23', total_agent_requests: 15, sessions_started: 8, agent_prs_created: 3 },
    { date: '2024-03-24', total_agent_requests: 20, sessions_started: 10, agent_prs_created: 4 },
  ];

  it('groups records by date', () => {
    const result = aggregateToDayLevel(devDays, [], []);
    
    expect(result).toHaveLength(2); // 2 unique dates
    expect(result[0].date).toBe('2024-03-23');
    expect(result[1].date).toBe('2024-03-24');
  });

  it('sums metrics across developers', () => {
    const result = aggregateToDayLevel(devDays, [], []);
    
    const day1 = result.find(d => d.date === '2024-03-23');
    expect(day1.totalAgentRequests).toBe(25); // 10 + 15
    expect(day1.sessionsStarted).toBe(13);     // 5 + 8
    expect(day1.agentPrsCreated).toBe(5);      // 2 + 3
  });

  it('counts human devs with activity', () => {
    const devDaysWithActivity = [
      { date: '2024-03-23', agent_session_minutes: 30 },
      { date: '2024-03-23', agent_session_minutes: 45 },
      { date: '2024-03-23', agent_session_minutes: 0 }, // No activity
    ];
    
    const result = aggregateToDayLevel(devDaysWithActivity, [], []);
    
    const day1 = result.find(d => d.date === '2024-03-23');
    expect(day1.humanDevsActive).toBe(2); // Only devs with minutes > 0
  });

  it('integrates merged PR metrics', () => {
    const prSessions = [
      {
        pr_created_at: '2024-03-23T10:00:00Z',
        pr_merged_at: '2024-03-23T14:00:00Z',
        additions: 500,
        duration_type: 'agent',
        duration_minutes: 60
      }
    ];
    
    const result = aggregateToDayLevel(devDays, prSessions, []);
    
    const day1 = result.find(d => d.date === '2024-03-23');
    expect(day1.mergedLocAdded).toBe(500);
    expect(day1.mergedSessionMinutes).toBe(60);
  });

  it('sorts results by date', () => {
    const unsorted = [
      { date: '2024-03-25', total_agent_requests: 10 },
      { date: '2024-03-23', total_agent_requests: 15 },
      { date: '2024-03-24', total_agent_requests: 20 },
    ];
    
    const result = aggregateToDayLevel(unsorted, [], []);
    
    expect(result[0].date).toBe('2024-03-23');
    expect(result[1].date).toBe('2024-03-24');
    expect(result[2].date).toBe('2024-03-25');
  });
});

describe('Data Processor - Fill Day Gaps', () => {
  it('fills missing days with zeros', () => {
    const sparse = [
      { date: '2024-03-23', agentPrsCreated: 5 },
      { date: '2024-03-25', agentPrsCreated: 10 }, // Gap on 03-24
    ];
    
    const result = fillDayGaps(sparse, 3);
    
    expect(result).toHaveLength(3);
    expect(result[1].date).toBe('2024-03-24'); // Filled day
    expect(result[1].agentPrsCreated).toBe(0);   // Zero values
  });

  it('preserves existing data', () => {
    const data = [
      { date: '2024-03-23', agentPrsCreated: 5 },
    ];
    
    const result = fillDayGaps(data, 1);
    
    expect(result[0].agentPrsCreated).toBe(5); // Not overwritten
  });

  it('handles empty input', () => {
    const result = fillDayGaps([]);
    expect(result).toEqual([]);
  });
});
