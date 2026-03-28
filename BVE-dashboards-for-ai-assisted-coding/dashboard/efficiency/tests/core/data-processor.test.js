import { describe, it, expect } from 'vitest';
import {
  flattenDayTotal,
  processEnterpriseReport,
  flattenUserRecord,
  processUserReport,
  aggregateUserRecordsByDay,
  filterByDateRange,
  filterByUser,
} from '../../src/core/data-processor.js';

describe('Data Processor - Flatten Day Total', () => {
  it('extracts top-level fields', () => {
    const input = {
      day: '2024-03-25',
      enterprise_id: 'ent-123',
      daily_active_users: 50,
      user_initiated_interaction_count: 1000,
      loc_added_sum: 500,
    };
    
    const result = flattenDayTotal(input);
    
    expect(result.day).toBe('2024-03-25');
    expect(result.enterpriseId).toBe('ent-123');
    expect(result.dailyActiveUsers).toBe(50);
    expect(result.interactions).toBe(1000);
    expect(result.locAdded).toBe(500);
  });

  it('falls back to IDE-level totals when top-level is zero', () => {
    const input = {
      day: '2024-03-25',
      daily_active_users: 10,
      loc_added_sum: 0,
      totals_by_ide: [
        { loc_added_sum: 100 },
        { loc_added_sum: 200 },
      ],
    };
    
    const result = flattenDayTotal(input);
    
    expect(result.locAdded).toBe(300);
  });

  it('extracts pull request fields', () => {
    const input = {
      day: '2024-03-25',
      pull_requests: {
        total_created: 10,
        total_reviewed: 15,
        total_created_by_copilot: 2,
      },
    };
    
    const result = flattenDayTotal(input);
    
    expect(result.prTotalCreated).toBe(10);
    expect(result.prTotalReviewed).toBe(15);
    expect(result.prCreatedByCopilot).toBe(2);
  });

  it('extracts agent mode interactions from features', () => {
    const input = {
      day: '2024-03-25',
      totals_by_feature: [
        { feature: 'code_completion', user_initiated_interaction_count: 500 },
        { feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 50 },
      ],
    };
    
    const result = flattenDayTotal(input);
    
    expect(result.agentModeInteractions).toBe(50);
  });

  it('extracts CLI prompt count from totals_by_cli', () => {
    const input = {
      day: '2024-03-25',
      totals_by_cli: {
        prompt_count: 42,
        session_count: 10,
        request_count: 15,
      },
    };

    const result = flattenDayTotal(input);

    expect(result.cliPromptCount).toBe(42);
    expect(result.cliSessionCount).toBe(10);
    expect(result.cliRequestCount).toBe(15);
  });

  it('defaults CLI prompt count to zero when totals_by_cli is absent', () => {
    const input = { day: '2024-03-25' };

    const result = flattenDayTotal(input);

    expect(result.cliPromptCount).toBe(0);
  });

  it('handles missing optional fields', () => {
    const input = {
      day: '2024-03-25',
    };
    
    const result = flattenDayTotal(input);
    
    expect(result.dailyActiveUsers).toBe(0);
    expect(result.interactions).toBe(0);
    expect(result.locAdded).toBe(0);
    expect(result.agentModeInteractions).toBe(0);
  });
});

describe('Data Processor - Process Enterprise Report', () => {
  it('processes array of day totals', () => {
    const input = {
      day_totals: [
        { day: '2024-03-25', daily_active_users: 10 },
        { day: '2024-03-26', daily_active_users: 12 },
      ],
    };
    
    const result = processEnterpriseReport(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].day).toBe('2024-03-25');
    expect(result[0].dailyActiveUsers).toBe(10);
    expect(result[1].dailyActiveUsers).toBe(12);
  });

  it('handles missing day_totals', () => {
    expect(processEnterpriseReport({})).toEqual([]);
    expect(processEnterpriseReport(null)).toEqual([]);
  });
});

describe('Data Processor - Flatten User Record', () => {
  it('extracts user record fields', () => {
    const input = {
      day: '2024-03-25',
      user_login: 'developer1',
      daily_active_users: 1,
      user_initiated_interaction_count: 50,
      loc_added_sum: 100,
    };
    
    const result = flattenUserRecord(input);
    
    expect(result.day).toBe('2024-03-25');
    expect(result.userLogin).toBe('developer1');
    expect(result.interactions).toBe(50);
    expect(result.locAdded).toBe(100);
  });

  it('extracts CLI prompt count from user totals_by_cli', () => {
    const input = {
      day: '2024-03-25',
      user_login: 'developer1',
      totals_by_cli: {
        prompt_count: 5,
        session_count: 2,
        request_count: 3,
      },
    };

    const result = flattenUserRecord(input);

    expect(result.cliPromptCount).toBe(5);
  });

  it('defaults CLI prompt count to zero when user totals_by_cli is absent', () => {
    const input = {
      day: '2024-03-25',
      user_login: 'developer1',
    };

    const result = flattenUserRecord(input);

    expect(result.cliPromptCount).toBe(0);
  });

  it('falls back to IDE-level LoC', () => {
    const input = {
      day: '2024-03-25',
      user_login: 'developer1',
      loc_added_sum: 0,
      totals_by_ide: [
        { loc_added_sum: 30 },
        { loc_added_sum: 70 },
      ],
    };
    
    const result = flattenUserRecord(input);
    
    expect(result.locAdded).toBe(100);
  });
});

describe('Data Processor - Aggregate User Records By Day', () => {
  it('groups records by day', () => {
    const records = [
      { day: '2024-03-25', userLogin: 'dev1', dailyActiveUsers: 1, interactions: 10, locAdded: 50 },
      { day: '2024-03-25', userLogin: 'dev2', dailyActiveUsers: 1, interactions: 20, locAdded: 30 },
      { day: '2024-03-26', userLogin: 'dev1', dailyActiveUsers: 1, interactions: 15, locAdded: 40 },
    ];
    
    const result = aggregateUserRecordsByDay(records);
    
    expect(result['2024-03-25'].activeUsers).toBe(2);
    expect(result['2024-03-25'].interactions).toBe(30);
    expect(result['2024-03-25'].locAdded).toBe(80);
    expect(result['2024-03-25'].users).toEqual(['dev1', 'dev2']);
    
    expect(result['2024-03-26'].activeUsers).toBe(1);
    expect(result['2024-03-26'].interactions).toBe(15);
  });

  it('handles empty array', () => {
    const result = aggregateUserRecordsByDay([]);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('Data Processor - Filter By Date Range', () => {
  const records = [
    { day: '2024-03-23' },
    { day: '2024-03-24' },
    { day: '2024-03-25' },
    { day: '2024-03-26' },
  ];

  it('filters by start date', () => {
    const result = filterByDateRange(records, '2024-03-25', null);
    expect(result).toHaveLength(2);
    expect(result[0].day).toBe('2024-03-25');
  });

  it('filters by end date', () => {
    const result = filterByDateRange(records, null, '2024-03-24');
    expect(result).toHaveLength(2);
    expect(result[1].day).toBe('2024-03-24');
  });

  it('filters by both dates', () => {
    const result = filterByDateRange(records, '2024-03-24', '2024-03-25');
    expect(result).toHaveLength(2);
    expect(result[0].day).toBe('2024-03-24');
    expect(result[1].day).toBe('2024-03-25');
  });

  it('returns all records when no dates specified', () => {
    const result = filterByDateRange(records, null, null);
    expect(result).toHaveLength(4);
  });
});

describe('Data Processor - Filter By User', () => {
  const records = [
    { userLogin: 'dev1', interactions: 10 },
    { userLogin: 'dev2', interactions: 20 },
    { userLogin: 'dev1', interactions: 15 },
  ];

  it('filters by user login', () => {
    const result = filterByUser(records, 'dev1');
    expect(result).toHaveLength(2);
    expect(result[0].userLogin).toBe('dev1');
    expect(result[1].userLogin).toBe('dev1');
  });

  it('returns all records when no user specified', () => {
    const result = filterByUser(records, null);
    expect(result).toHaveLength(3);
  });

  it('returns empty array when user not found', () => {
    const result = filterByUser(records, 'dev3');
    expect(result).toHaveLength(0);
  });
});
