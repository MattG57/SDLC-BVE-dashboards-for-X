import { describe, it, expect } from 'vitest';
import {
  flattenDayTotal,
  flattenUserReport,
  isBot,
  flattenPrReview,
  processStructuralMetrics
} from '../../src/core/data-processor.js';

describe('Data Processor', () => {
  describe('isBot', () => {
    it('should detect bot patterns', () => {
      expect(isBot('dependabot')).toBe(true);
      expect(isBot('github-actions')).toBe(true);
      expect(isBot('renovate')).toBe(true);
      expect(isBot('my-bot')).toBe(true);
      expect(isBot('copilot[bot]')).toBe(true);
      expect(isBot('my-agent')).toBe(true);
      expect(isBot('od-octodemo-user')).toBe(true);
    });

    it('should not flag regular users', () => {
      expect(isBot('john-doe')).toBe(false);
      expect(isBot('user123')).toBe(false);
      expect(isBot('developer')).toBe(false);
    });

    it('should be case insensitive for [bot] pattern', () => {
      expect(isBot('MyBot[BOT]')).toBe(true);
      expect(isBot('test[Bot]')).toBe(true);
    });
  });

  describe('flattenDayTotal', () => {
    it('should flatten day total with all fields', () => {
      const input = {
        day: '2026-03-01',
        enterprise_id: '123',
        daily_active_users: 50,
        user_initiated_interaction_count: 100,
        loc_added_sum: 1000,
        pull_requests: {
          total_reviewed: 10,
          total_created: 5
        },
        totals_by_cli: {
          session_count: 20
        }
      };

      const result = flattenDayTotal(input);

      expect(result.day).toBe('2026-03-01');
      expect(result.enterprise_id).toBe('123');
      expect(result.daily_active_users).toBe(50);
      expect(result.user_initiated_interaction_count).toBe(100);
      expect(result.loc_added_sum).toBe(1000);
      expect(result.pr_total_reviewed).toBe(10);
      expect(result.pr_total_created).toBe(5);
      expect(result.cli_session_count).toBe(20);
    });

    it('should aggregate from totals_by_ide when top level is zero', () => {
      const input = {
        day: '2026-03-01',
        loc_added_sum: 0,
        totals_by_ide: [
          { loc_added_sum: 100, loc_suggested_to_add_sum: 200 },
          { loc_added_sum: 150, loc_suggested_to_add_sum: 300 }
        ]
      };

      const result = flattenDayTotal(input);

      expect(result.loc_added_sum).toBe(250);
      expect(result.loc_suggested_to_add_sum).toBe(500);
    });

    it('should extract agent mode interaction count from features', () => {
      const input = {
        day: '2026-03-01',
        totals_by_feature: [
          { feature: 'code_completion', user_initiated_interaction_count: 50 },
          { feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 25 }
        ]
      };

      const result = flattenDayTotal(input);

      expect(result.agent_mode_interaction_count).toBe(25);
    });

    it('should handle missing optional fields gracefully', () => {
      const input = {
        day: '2026-03-01'
      };

      const result = flattenDayTotal(input);

      expect(result.daily_active_users).toBe(0);
      expect(result.user_initiated_interaction_count).toBe(0);
      expect(result.pr_total_reviewed).toBe(0);
      expect(result.cli_session_count).toBe(0);
    });

    it('should preserve feature breakdowns', () => {
      const input = {
        day: '2026-03-01',
        totals_by_feature: [{ feature: 'test' }],
        totals_by_ide: [{ ide: 'vscode' }],
        totals_by_language: [{ language: 'javascript' }]
      };

      const result = flattenDayTotal(input);

      expect(result.totals_by_feature).toHaveLength(1);
      expect(result.totals_by_ide).toHaveLength(1);
      expect(result.totals_by_language).toHaveLength(1);
    });
  });

  describe('flattenUserReport', () => {
    it('should flatten user report records', () => {
      const input = [
        {
          day: '2026-03-01',
          user_id: '123',
          user_login: 'user1',
          user_initiated_interaction_count: 10,
          code_generation_activity_count: 5,
          loc_added_sum: 100,
          used_agent: true,
          used_chat: false
        }
      ];

      const result = flattenUserReport(input);

      expect(result).toHaveLength(1);
      expect(result[0].day).toBe('2026-03-01');
      expect(result[0].user_login).toBe('user1');
      expect(result[0].user_initiated_interaction_count).toBe(10);
      expect(result[0].used_agent).toBe(true);
      expect(result[0].used_chat).toBe(false);
    });

    it('should aggregate loc_added from IDE totals when zero', () => {
      const input = [
        {
          day: '2026-03-01',
          user_login: 'user1',
          loc_added_sum: 0,
          totals_by_ide: [
            { loc_added_sum: 50 },
            { loc_added_sum: 75 }
          ]
        }
      ];

      const result = flattenUserReport(input);

      expect(result[0].loc_added_sum).toBe(125);
    });

    it('should extract agent mode interactions from features', () => {
      const input = [
        {
          day: '2026-03-01',
          user_login: 'user1',
          totals_by_feature: [
            { feature: 'chat_panel_agent_mode', user_initiated_interaction_count: 15 }
          ]
        }
      ];

      const result = flattenUserReport(input);

      expect(result[0].agent_mode_interaction_count).toBe(15);
    });

    it('should handle missing optional fields', () => {
      const input = [
        {
          day: '2026-03-01',
          user_login: 'user1'
        }
      ];

      const result = flattenUserReport(input);

      expect(result[0].user_initiated_interaction_count).toBe(0);
      expect(result[0].code_generation_activity_count).toBe(0);
      expect(result[0].used_agent).toBe(false);
      expect(result[0].used_chat).toBe(false);
    });
  });

  describe('flattenPrReview', () => {
    it('should flatten PR data from pull_requests.prs structure', () => {
      const input = {
        pull_requests: {
          prs: [
            {
              user: 'user1',
              created_at: '2026-03-01T10:00:00Z',
              additions: 100,
              deletions: 50,
              state: 'merged'
            }
          ]
        }
      };

      const result = flattenPrReview(input);

      expect(result.all).toHaveLength(1);
      expect(result.all[0].day).toBe('2026-03-01');
      expect(result.all[0].user).toBe('user1');
      expect(result.all[0].loc_changed).toBe(150);
      expect(result.filtered).toHaveLength(1);
    });

    it('should accept array input directly', () => {
      const input = [
        {
          user: 'user1',
          created_at: '2026-03-01T10:00:00Z',
          additions: 100,
          deletions: 50
        }
      ];

      const result = flattenPrReview(input);

      expect(result.all).toHaveLength(1);
      expect(result.filtered).toHaveLength(1);
    });

    it('should filter out bot PRs', () => {
      const input = [
        {
          user: 'user1',
          created_at: '2026-03-01T10:00:00Z',
          additions: 100,
          deletions: 50
        },
        {
          user: 'dependabot',
          created_at: '2026-03-01T11:00:00Z',
          additions: 200,
          deletions: 100
        },
        {
          user: 'github-actions',
          created_at: '2026-03-01T12:00:00Z',
          additions: 150,
          deletions: 75
        }
      ];

      const result = flattenPrReview(input);

      expect(result.all).toHaveLength(3);
      expect(result.filtered).toHaveLength(1);
      expect(result.filtered[0].user).toBe('user1');
    });

    it('should filter out PRs with no creation date', () => {
      const input = [
        {
          user: 'user1',
          created_at: '2026-03-01T10:00:00Z',
          additions: 100,
          deletions: 50
        },
        {
          user: 'user2',
          created_at: null,
          additions: 100,
          deletions: 50
        }
      ];

      const result = flattenPrReview(input);

      expect(result.all).toHaveLength(1);
    });

    it('should calculate loc_changed correctly', () => {
      const input = [
        {
          user: 'user1',
          created_at: '2026-03-01T10:00:00Z',
          additions: 250,
          deletions: 150
        }
      ];

      const result = flattenPrReview(input);

      expect(result.all[0].loc_changed).toBe(400);
    });

    it('should handle missing additions/deletions', () => {
      const input = [
        {
          user: 'user1',
          created_at: '2026-03-01T10:00:00Z'
        }
      ];

      const result = flattenPrReview(input);

      expect(result.all[0].additions).toBe(0);
      expect(result.all[0].deletions).toBe(0);
      expect(result.all[0].loc_changed).toBe(0);
    });
  });

  describe('processStructuralMetrics', () => {
    it('should process all data sources', () => {
      const enterpriseData = {
        enterprise_report: {
          day_totals: [
            {
              day: '2026-03-01',
              daily_active_users: 50,
              loc_added_sum: 1000
            }
          ]
        }
      };

      const userData = {
        user_report: [
          {
            day: '2026-03-01',
            user_login: 'user1',
            code_generation_activity_count: 10
          }
        ]
      };

      const prData = [
        {
          user: 'user1',
          created_at: '2026-03-01T10:00:00Z',
          additions: 100,
          deletions: 50
        }
      ];

      const config = { cfg_total_developers: 200 };

      const result = processStructuralMetrics(enterpriseData, userData, prData, config);

      expect(result.entDays).toHaveLength(1);
      expect(result.userDays).toHaveLength(1);
      expect(result.prRecords).toHaveLength(1);
      expect(result.config).toBe(config);
    });

    it('should handle organization_report format', () => {
      const enterpriseData = {
        organization_report: [
          {
            day: '2026-03-01',
            daily_active_users: 30
          }
        ]
      };

      const result = processStructuralMetrics(enterpriseData, {}, null, {});

      expect(result.entDays).toHaveLength(1);
      expect(result.entDays[0].daily_active_users).toBe(30);
    });

    it('should filter bots from PR data', () => {
      const prData = [
        { user: 'user1', created_at: '2026-03-01T10:00:00Z', additions: 100, deletions: 50 },
        { user: 'dependabot', created_at: '2026-03-01T11:00:00Z', additions: 200, deletions: 100 }
      ];

      const result = processStructuralMetrics({}, {}, prData, {});

      expect(result.rawPrRecords).toHaveLength(2);
      expect(result.prRecords).toHaveLength(1);
      expect(result.prRecords[0].user).toBe('user1');
    });

    it('should handle missing data gracefully', () => {
      const result = processStructuralMetrics({}, {}, null, {});

      expect(result.entDays).toEqual([]);
      expect(result.userDays).toEqual([]);
      expect(result.prRecords).toEqual([]);
      expect(result.rawPrRecords).toEqual([]);
    });
  });
});
