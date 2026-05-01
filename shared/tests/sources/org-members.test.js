/**
 * Tests for org-members source processing.
 */

import { describe, it, expect } from 'vitest';
import {
  extractOrgMemberLogins,
  unionOrgMembers,
  filterUserDaysByOrgMembership,
  isOrgMembersSource,
} from '../../sources/org-members.js';

describe('extractOrgMemberLogins', () => {
  it('returns empty set for null/undefined', () => {
    expect(extractOrgMemberLogins(null).size).toBe(0);
    expect(extractOrgMemberLogins(undefined).size).toBe(0);
  });

  it('extracts from { org_members: [...] } format', () => {
    const data = {
      org_members: [
        { login: 'Alice', id: 1 },
        { login: 'Bob', id: 2 },
      ],
      metadata: { org: 'test-org' },
    };
    const logins = extractOrgMemberLogins(data);
    expect(logins.size).toBe(2);
    expect(logins.has('alice')).toBe(true);
    expect(logins.has('bob')).toBe(true);
  });

  it('extracts from { members: [...] } format', () => {
    const data = { members: [{ login: 'UserA' }, { login: 'UserB' }] };
    const logins = extractOrgMemberLogins(data);
    expect(logins.size).toBe(2);
    expect(logins.has('usera')).toBe(true);
  });

  it('extracts from bare array format', () => {
    const data = [{ login: 'dev1' }, { login: 'dev2' }, { login: 'dev3' }];
    const logins = extractOrgMemberLogins(data);
    expect(logins.size).toBe(3);
  });

  it('handles user_login field', () => {
    const data = { org_members: [{ user_login: 'foo' }] };
    const logins = extractOrgMemberLogins(data);
    expect(logins.has('foo')).toBe(true);
  });

  it('handles string entries', () => {
    const data = { members: ['alpha', 'beta'] };
    const logins = extractOrgMemberLogins(data);
    expect(logins.size).toBe(2);
    expect(logins.has('alpha')).toBe(true);
  });

  it('lowercases all logins', () => {
    const data = { org_members: [{ login: 'CamelCase' }] };
    const logins = extractOrgMemberLogins(data);
    expect(logins.has('camelcase')).toBe(true);
    expect(logins.has('CamelCase')).toBe(false);
  });

  it('skips empty login values', () => {
    const data = { org_members: [{ login: '' }, { login: 'valid' }, { id: 3 }] };
    const logins = extractOrgMemberLogins(data);
    expect(logins.size).toBe(1);
  });
});

describe('unionOrgMembers', () => {
  it('merges multiple sets', () => {
    const s1 = new Set(['alice', 'bob']);
    const s2 = new Set(['bob', 'charlie']);
    const result = unionOrgMembers([s1, s2]);
    expect(result.size).toBe(3);
    expect(result.has('alice')).toBe(true);
    expect(result.has('charlie')).toBe(true);
  });

  it('handles empty sets', () => {
    expect(unionOrgMembers([]).size).toBe(0);
    expect(unionOrgMembers([new Set()]).size).toBe(0);
  });
});

describe('filterUserDaysByOrgMembership', () => {
  const userDays = [
    { day: '2026-04-01', user_login: 'Alice', code_generation_activity_count: 10 },
    { day: '2026-04-01', user_login: 'Bob', code_generation_activity_count: 5 },
    { day: '2026-04-01', user_login: 'Charlie', code_generation_activity_count: 8 },
    { day: '2026-04-02', user_login: 'Alice', code_generation_activity_count: 12 },
    { day: '2026-04-02', user_login: 'Dave', code_generation_activity_count: 3 },
  ];

  it('returns all records when orgMemberLogins is null', () => {
    const result = filterUserDaysByOrgMembership(userDays, null);
    expect(result.data.length).toBe(5);
    expect(result.profile.removed).toBe(0);
  });

  it('returns all records when orgMemberLogins is empty set', () => {
    const result = filterUserDaysByOrgMembership(userDays, new Set());
    expect(result.data.length).toBe(5);
    expect(result.profile.removed).toBe(0);
  });

  it('filters to only org members (case-insensitive)', () => {
    const orgMembers = new Set(['alice', 'charlie']);
    const result = filterUserDaysByOrgMembership(userDays, orgMembers);
    expect(result.data.length).toBe(3); // Alice x2 + Charlie x1
    expect(result.profile.before).toBe(5);
    expect(result.profile.after).toBe(3);
    expect(result.profile.removed).toBe(2);
    expect(result.profile.org_member_count).toBe(2);
  });

  it('excludes users not in org', () => {
    const orgMembers = new Set(['alice']);
    const result = filterUserDaysByOrgMembership(userDays, orgMembers);
    const logins = new Set(result.data.map(r => r.user_login));
    expect(logins.has('Bob')).toBe(false);
    expect(logins.has('Charlie')).toBe(false);
    expect(logins.has('Dave')).toBe(false);
  });
});

describe('isOrgMembersSource', () => {
  it('detects org_members format', () => {
    expect(isOrgMembersSource({ org_members: [{ login: 'a' }] })).toBe(true);
  });

  it('detects members format', () => {
    expect(isOrgMembersSource({ members: [{ login: 'a' }] })).toBe(true);
  });

  it('detects bare array format', () => {
    expect(isOrgMembersSource([{ login: 'a' }])).toBe(true);
  });

  it('rejects non-member objects', () => {
    expect(isOrgMembersSource(null)).toBe(false);
    expect(isOrgMembersSource({})).toBe(false);
    expect(isOrgMembersSource({ enterprise_report: {} })).toBe(false);
  });

  it('rejects empty arrays', () => {
    expect(isOrgMembersSource([])).toBe(false);
  });
});
