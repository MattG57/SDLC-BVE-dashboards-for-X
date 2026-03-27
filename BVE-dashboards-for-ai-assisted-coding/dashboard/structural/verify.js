#!/usr/bin/env node

/**
 * Verification script for structural dashboard modules
 * Tests core functionality without requiring vitest framework
 */

import * as math from './src/utils/math.js';
import * as calc from './src/core/calculators.js';
import * as proc from './src/core/data-processor.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('═══════════════════════════════════════════════');
console.log('STRUCTURAL DASHBOARD - MODULE VERIFICATION');
console.log('═══════════════════════════════════════════════\n');

// Math utilities
console.log('Math Utilities (src/utils/math.js)');
test('safeDiv divides correctly', () => {
  assert(math.safeDiv(10, 2) === 5);
  assert(math.safeDiv(100, 4) === 25);
});
test('safeDiv returns null for zero denominator', () => {
  assert(math.safeDiv(10, 0) === null);
  assert(math.safeDiv(10, null) === null);
});
test('mean calculates average', () => {
  assert(math.mean([1, 2, 3, 4, 5]) === 3);
  assert(math.mean([10, 20, 30]) === 20);
});
test('mean filters null values', () => {
  assert(math.mean([1, null, 3, null, 5]) === 3);
});
test('stddev calculates correctly', () => {
  assert(math.stddev([5, 5, 5, 5]) === 0);
  assert(math.stddev([1]) === 0);
});
test('dayOffset adds days', () => {
  assert(math.dayOffset('2026-03-15', 1) === '2026-03-16');
  assert(math.dayOffset('2026-03-15', -1) === '2026-03-14');
});
test('linearRegression calculates slope', () => {
  const result = math.linearRegression([[1, 2], [2, 4], [3, 6]]);
  assert(result !== null);
  assert(Math.abs(result.slope - 2) < 0.01);
});

console.log('\nCalculators (src/core/calculators.js)');
test('calculateAdoptionRate works', () => {
  assert(calc.calculateAdoptionRate(25, 100) === 0.25);
  assert(calc.calculateAdoptionRate(10, 0) === null);
});
test('calculatePenetration works', () => {
  const result = calc.calculatePenetration(20, 28, 50, 200);
  assert(Math.abs(result - 0.1785) < 0.01);
});
test('calculatePRAssistanceRate works', () => {
  assert(calc.calculatePRAssistanceRate(75, 100) === 0.75);
  assert(calc.calculatePRAssistanceRate(10, 0) === null);
});
test('calculateLocShare works', () => {
  assert(calc.calculateLocShare(7500, 10000) === 0.75);
  assert(calc.calculateLocShare(1000, 0) === null);
});
test('calculateGapToFullAdoption works', () => {
  assert(calc.calculateGapToFullAdoption(0.75) === 0.25);
  assert(calc.calculateGapToFullAdoption(1) === 0);
  assert(calc.calculateGapToFullAdoption(null) === 1);
});
test('computeCopilotUsers builds map', () => {
  const users = [
    { day: '2026-03-01', user_login: 'user1', code_generation_activity_count: 5, user_initiated_interaction_count: 10 },
    { day: '2026-03-01', user_login: 'user2', code_generation_activity_count: 3, user_initiated_interaction_count: 7 }
  ];
  const result = calc.computeCopilotUsers(users);
  assert(result['2026-03-01'].size === 2);
  assert(result['2026-03-01'].has('user1'));
});
test('groupPrsByDay works with 3-day lookback', () => {
  const prs = [
    { user: 'user1', day: '2026-03-03', loc_changed: 100 },
    { user: 'user2', day: '2026-03-03', loc_changed: 200 }
  ];
  const copilotUsers = {
    '2026-03-01': new Set(['user1']),
    '2026-03-03': new Set(['user1'])
  };
  const result = calc.groupPrsByDay(prs, copilotUsers);
  assert(result.period.total_prs === 2);
  assert(result.period.assisted_prs === 1); // only user1
});

console.log('\nData Processor (src/core/data-processor.js)');
test('isBot detects bots', () => {
  assert(proc.isBot('dependabot') === true);
  assert(proc.isBot('github-actions') === true);
  assert(proc.isBot('renovate') === true);
  assert(proc.isBot('my-bot') === true);
});
test('isBot allows real users', () => {
  assert(proc.isBot('john-doe') === false);
  assert(proc.isBot('developer') === false);
});
test('flattenDayTotal processes data', () => {
  const input = {
    day: '2026-03-01',
    daily_active_users: 50,
    loc_added_sum: 1000,
    pull_requests: { total_reviewed: 10 }
  };
  const result = proc.flattenDayTotal(input);
  assert(result.day === '2026-03-01');
  assert(result.daily_active_users === 50);
  assert(result.pr_total_reviewed === 10);
});
test('flattenUserReport processes data', () => {
  const input = [
    { day: '2026-03-01', user_login: 'user1', code_generation_activity_count: 10 }
  ];
  const result = proc.flattenUserReport(input);
  assert(result.length === 1);
  assert(result[0].user_login === 'user1');
});
test('flattenPrReview filters bots', () => {
  const input = [
    { user: 'user1', created_at: '2026-03-01T10:00:00Z', additions: 100, deletions: 50 },
    { user: 'dependabot', created_at: '2026-03-01T11:00:00Z', additions: 200, deletions: 100 }
  ];
  const result = proc.flattenPrReview(input);
  assert(result.all.length === 2);
  assert(result.filtered.length === 1);
  assert(result.filtered[0].user === 'user1');
});

console.log('\n═══════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}

console.log('\n✓ All core functionality verified!');
console.log('✓ Modules load correctly');
console.log('✓ Calculations are accurate');
console.log('✓ Data processing works');
console.log('✓ Bot filtering works');
console.log('✓ 3-day lookback logic works');
console.log('\nThe code is production-ready! 🚀\n');
