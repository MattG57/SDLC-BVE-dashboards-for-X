/**
 * Error Boundary and Edge Case Tests for Agentic AI Coding Dashboard
 */

import { describe, it, expect } from 'vitest';
import { calculateEfficiencyMetrics, calculateTimeSavings, calculateCostSavings } from '../../core/estimators.js';
import { processMetricsData } from '../../core/data-processor.js';

describe('Agentic AI Error Boundary Tests', () => {
  describe('Estimators - Null/Undefined Handling', () => {
    it('should handle null input gracefully', () => {
      expect(() => calculateEfficiencyMetrics(null)).not.toThrow();
      const result = calculateEfficiencyMetrics(null);
      expect(result).toBeDefined();
    });

    it('should handle undefined input gracefully', () => {
      expect(() => calculateEfficiencyMetrics(undefined)).not.toThrow();
      const result = calculateEfficiencyMetrics(undefined);
      expect(result).toBeDefined();
    });

    it('should handle empty object input', () => {
      const result = calculateEfficiencyMetrics({});
      expect(result).toBeDefined();
    });

    it('should handle missing dotcom_chat data', () => {
      const data = {
        copilot_ide_chat: [],
        copilot_dotcom_pull_requests: []
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle missing ide_chat data', () => {
      const data = {
        copilot_dotcom_chat: [],
        copilot_dotcom_pull_requests: []
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });
  });

  describe('Chat Data - Malformed Input Handling', () => {
    it('should handle null breakdown in dotcom chat', () => {
      const data = {
        copilot_dotcom_chat: [
          { day: '2024-01-01', total_engaged_users: 10, breakdown: null }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle undefined breakdown in IDE chat', () => {
      const data = {
        copilot_ide_chat: [
          { day: '2024-01-01', total_engaged_users: 10, breakdown: undefined }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle empty breakdown arrays', () => {
      const data = {
        copilot_dotcom_chat: [
          { day: '2024-01-01', total_engaged_users: 10, breakdown: [] }
        ],
        copilot_ide_chat: [
          { day: '2024-01-01', total_engaged_users: 10, breakdown: [] }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle breakdown with missing total_chats', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10 }
              // Missing total_chats
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle breakdown with null total_chats', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: null }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle breakdown with string numbers', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: '10', total_chats: '50' }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });
  });

  describe('Division by Zero Protection', () => {
    it('should handle zero total engaged users', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            total_engaged_users: 0,
            breakdown: [
              { total_engaged_users: 0, total_chats: 0 }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(isNaN(result.avgChatsPerUser || 0)).toBe(false);
      expect(isFinite(result.avgChatsPerUser || 0)).toBe(true);
    });

    it('should handle zero total chats', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 0 }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(isNaN(result.avgChatsPerUser || 0)).toBe(false);
    });

    it('should handle empty data arrays', () => {
      const data = {
        copilot_dotcom_chat: [],
        copilot_ide_chat: [],
        copilot_dotcom_pull_requests: []
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(result).toBeDefined();
      expect(isNaN(result.totalEngagedUsers || 0)).toBe(false);
    });
  });

  describe('Extreme Values Handling', () => {
    it('should handle very large chat counts', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { 
                total_engaged_users: 10000, 
                total_chats: Number.MAX_SAFE_INTEGER 
              }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(isNaN(result.totalChats || 0)).toBe(false);
      expect(isFinite(result.totalChats || 0)).toBe(true);
    });

    it('should handle very small decimal values', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 0.001, total_chats: 0.001 }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle negative values (data error)', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: -10, total_chats: -50 }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle very long date ranges', () => {
      const data = {
        copilot_dotcom_chat: Array.from({ length: 1000 }, (_, i) => ({
          day: `2024-01-${String((i % 30) + 1).padStart(2, '0')}`,
          breakdown: [
            { total_engaged_users: 10, total_chats: 50 }
          ]
        }))
      };
      
      const startTime = Date.now();
      const result = calculateEfficiencyMetrics(data);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(2000); // Should be reasonably fast
    });
  });

  describe('Data Processor - Error Handling', () => {
    it('should handle null data gracefully', () => {
      expect(() => processMetricsData(null)).not.toThrow();
    });

    it('should handle undefined data gracefully', () => {
      expect(() => processMetricsData(undefined)).not.toThrow();
    });

    it('should handle empty object', () => {
      expect(() => processMetricsData({})).not.toThrow();
    });

    it('should handle partial data structures', () => {
      const data = {
        copilot_dotcom_chat: [
          { day: '2024-01-01' }
          // Missing breakdown
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });

    it('should handle mixed valid and invalid entries', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50 }
            ]
          },
          {
            day: '2024-01-02',
            breakdown: null
          },
          {
            day: '2024-01-03',
            breakdown: [
              { total_engaged_users: null, total_chats: null }
            ]
          }
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });
  });

  describe('Model Field Handling', () => {
    it('should handle missing model field', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50 }
              // No model field
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle null model field', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50, model: null }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle empty model string', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50, model: '' }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle non-string model values', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50, model: 123 }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });
  });

  describe('Editor Field Handling', () => {
    it('should handle missing editor field', () => {
      const data = {
        copilot_ide_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50 }
              // No editor field
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle null editor field', () => {
      const data = {
        copilot_ide_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50, editor: null }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle empty editor string', () => {
      const data = {
        copilot_ide_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50, editor: '' }
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
        copilot_dotcom_chat: [
          {
            day: 'invalid-date',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50 }
            ]
          }
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });

    it('should handle empty date strings', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '',
            breakdown: [
              { total_engaged_users: 10, total_chats: 50 }
            ]
          }
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });

    it('should handle missing day field', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            breakdown: [
              { total_engaged_users: 10, total_chats: 50 }
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
        copilot_dotcom_chat: [
          {
            day: futureDate.toISOString().split('T')[0],
            breakdown: [
              { total_engaged_users: 10, total_chats: 50 }
            ]
          }
        ]
      };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });
  });

  describe('Type Coercion Tests', () => {
    it('should handle boolean values', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: true, total_chats: false }
            ]
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });

    it('should handle string numbers', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: [
              { total_engaged_users: '10', total_chats: '50' }
            ]
          }
        ]
      };
      
      const result = calculateEfficiencyMetrics(data);
      expect(result).toBeDefined();
    });

    it('should handle arrays where objects expected', () => {
      const data = {
        copilot_dotcom_chat: [
          {
            day: '2024-01-01',
            breakdown: 'not-an-array'
          }
        ]
      };
      
      expect(() => calculateEfficiencyMetrics(data)).not.toThrow();
    });
  });

  describe('Time and Cost Savings Edge Cases', () => {
    it('should handle zero chat sessions', () => {
      const result = calculateTimeSavings(0, 0);
      expect(result).toBe(0);
    });

    it('should handle very high chat volumes', () => {
      const result = calculateTimeSavings(10000, 50000);
      expect(isNaN(result)).toBe(false);
      expect(isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle negative values (data error)', () => {
      expect(() => calculateTimeSavings(-10, -50)).not.toThrow();
    });

    it('should handle cost savings with zero time', () => {
      const result = calculateCostSavings(0, 50);
      expect(result).toBe(0);
    });

    it('should handle cost savings with zero rate', () => {
      const result = calculateCostSavings(100, 0);
      expect(result).toBe(0);
    });
  });

  describe('Array and Object Edge Cases', () => {
    it('should handle non-array passed where array expected', () => {
      expect(() => processMetricsData('not an object')).not.toThrow();
      expect(() => processMetricsData(123)).not.toThrow();
      expect(() => processMetricsData(true)).not.toThrow();
    });

    it('should handle sparse arrays', () => {
      const data = {
        copilot_dotcom_chat: new Array(10)
      };
      data.copilot_dotcom_chat[0] = { day: '2024-01-01', breakdown: [] };
      data.copilot_dotcom_chat[5] = { day: '2024-01-02', breakdown: [] };
      
      expect(() => processMetricsData(data)).not.toThrow();
    });

    it('should handle circular references', () => {
      const data = {
        copilot_dotcom_chat: [
          { day: '2024-01-01', breakdown: [] }
        ]
      };
      data.copilot_dotcom_chat[0].self = data.copilot_dotcom_chat[0];
      
      expect(() => processMetricsData(data)).not.toThrow();
    });
  });
});
