/**
 * Org-members source processing — parse and extract org member logins.
 *
 * Handles the raw org-members JSON file produced by the org-members.sh
 * collection script. Used at materialization time to filter enterprise
 * user metrics to only org members.
 */

/**
 * Extract a Set of lowercase login strings from org-members raw data.
 *
 * Accepts multiple formats:
 *   - { members: [{ login }, ...] }
 *   - { org_members: [{ login }, ...] }
 *   - [{ login }, ...]   (bare array)
 *
 * @param {Object|Array|null} rawData - Parsed org-members JSON
 * @returns {Set<string>} Set of lowercase logins
 */
export function extractOrgMemberLogins(rawData) {
  if (!rawData) return new Set();

  let members = [];
  if (Array.isArray(rawData)) {
    members = rawData;
  } else if (Array.isArray(rawData.members)) {
    members = rawData.members;
  } else if (Array.isArray(rawData.org_members)) {
    members = rawData.org_members;
  }

  const logins = new Set();
  for (const m of members) {
    const login = m.login || m.user_login || m;
    if (typeof login === 'string' && login.length > 0) {
      logins.add(login.toLowerCase());
    }
  }
  return logins;
}

/**
 * Merge member login sets from multiple orgs into a single union.
 *
 * @param {Array<Set<string>>} sets - Array of login Sets
 * @returns {Set<string>} Union of all logins
 */
export function unionOrgMembers(sets) {
  const merged = new Set();
  for (const s of sets) {
    for (const login of s) {
      merged.add(login);
    }
  }
  return merged;
}

/**
 * Filter user-day records to only include users in the org member set.
 * Comparison is case-insensitive.
 *
 * @param {Array} userDays - Flattened user-day records (with user_login)
 * @param {Set<string>} orgMemberLogins - Set of lowercase org member logins
 * @returns {{ data: Array, profile: { before: number, after: number, removed: number } }}
 */
export function filterUserDaysByOrgMembership(userDays, orgMemberLogins) {
  if (!orgMemberLogins || orgMemberLogins.size === 0) {
    return { data: userDays, profile: { before: userDays.length, after: userDays.length, removed: 0, org_member_count: 0 } };
  }
  const before = userDays.length;
  const filtered = userDays.filter(u =>
    u.user_login && orgMemberLogins.has(u.user_login.toLowerCase())
  );
  return {
    data: filtered,
    profile: {
      before,
      after: filtered.length,
      removed: before - filtered.length,
      org_member_count: orgMemberLogins.size,
    },
  };
}

/**
 * Detect if a parsed JSON object is an org-members source file.
 */
export function isOrgMembersSource(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.length > 0 && obj[0]?.login != null;
  return !!(obj.members || obj.org_members);
}
