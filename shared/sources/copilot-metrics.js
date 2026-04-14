/**
 * Copilot metrics source processing — flatten, dedup, detect.
 *
 * Handles enterprise_report.day_totals and user_report data from
 * the copilot-user-and-enterprise-metrics query script.
 */

import { safeDiv } from '../core/math.js';

/**
 * Flatten a single enterprise day_totals entry.
 * Nested objects (e.g., copilot_ide_code_completions.editors[].models[])
 * are flattened to key_subkey format. Arrays are skipped.
 */
export function flattenDayTotal(dt) {
  const d = { day: dt.date || dt.day };
  for (const [key, val] of Object.entries(dt)) {
    if (key === 'date' || key === 'day') continue;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      for (const [k2, v2] of Object.entries(val)) {
        d[key + '_' + k2] = v2;
      }
    } else if (!Array.isArray(val)) {
      d[key] = val;
    }
  }
  return d;
}

/**
 * Flatten user_report records into per-user-per-day rows.
 * Handles both nested format (user.day_totals[]) and flat format (user.day).
 */
export function flattenUserReport(userReport) {
  const records = [];
  for (const user of userReport) {
    if (user.day_totals) {
      for (const dt of user.day_totals) {
        records.push({
          ...flattenDayTotal(dt),
          user_login: user.login || user.github_login || user.user_login,
        });
      }
    } else if (user.day || user.date) {
      const login = user.user_login || user.login || user.github_login;
      if (login) {
        records.push({ ...user, day: user.day || user.date, user_login: login });
      }
    }
  }
  return records;
}

/**
 * Deduplicate enterprise day rows by day. Last entry wins.
 * Returns { data, profile } with dedup stats.
 */
export function dedupEnterpriseDays(flatDays) {
  const before = flatDays.length;
  const dayMap = {};
  for (const r of flatDays) dayMap[r.day] = r;
  const data = Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day));
  return {
    data,
    profile: {
      before,
      after: data.length,
      removed: before - data.length,
      key: 'day',
    },
  };
}

/**
 * Deduplicate user-day rows by day|user_login. Last entry wins.
 * Returns { data, profile } with dedup stats.
 */
export function dedupUserDays(flatUsers) {
  const before = flatUsers.length;
  const userMap = {};
  for (const r of flatUsers) {
    userMap[r.day + '|' + r.user_login] = r;
  }
  const data = Object.values(userMap);
  return {
    data,
    profile: {
      before,
      after: data.length,
      removed: before - data.length,
      key: 'day|user_login',
      unique_logins: new Set(data.map(r => r.user_login)).size,
    },
  };
}

/**
 * Compute per-dev driver ratios for a day row.
 * These are the materialized derived fields that don't depend on config.
 */
export function computeDayRatios(d) {
  const dau = d.daily_active_users || 0;
  return {
    interactions_per_active_dev: safeDiv(d.user_initiated_interaction_count, dau),
    generations_per_active_dev: safeDiv(d.code_generation_activity_count, dau),
    acceptances_per_active_dev: safeDiv(d.code_acceptance_activity_count, dau),
    loc10_added_per_active_dev: safeDiv((d.loc_added_sum || 0) / 10, dau),
    agent_mode_per_active_dev: safeDiv(d.agent_mode_interaction_count, dau),
    cli_prompts_per_active_dev: safeDiv(d.cli_prompt_count, dau),
    acceptance_rate: safeDiv(d.code_acceptance_activity_count, d.code_generation_activity_count),
  };
}

/**
 * Build reconciliation records comparing enterprise vs user sums per day.
 */
export function computeReconciliation(enterpriseDays, userDays) {
  const userByDay = {};
  for (const u of userDays) {
    if (!userByDay[u.day]) {
      userByDay[u.day] = {
        active_devs: new Set(),
        interactions: 0, generations: 0, acceptances: 0,
        loc_added: 0, loc_deleted: 0,
      };
    }
    const d = userByDay[u.day];
    d.active_devs.add(u.user_login);
    d.interactions += u.user_initiated_interaction_count || 0;
    d.generations += u.code_generation_activity_count || 0;
    d.acceptances += u.code_acceptance_activity_count || 0;
    d.loc_added += u.loc_added_sum || 0;
    d.loc_deleted += u.loc_deleted_sum || 0;
  }

  const records = [];
  for (const ent of enterpriseDays) {
    const ud = userByDay[ent.day];
    if (!ud) {
      records.push({ day: ent.day, status: 'missing_user_data' });
      continue;
    }

    const metrics = [
      { label: 'active_devs', enterprise: ent.daily_active_users || 0, user_sum: ud.active_devs.size },
      { label: 'interactions', enterprise: ent.user_initiated_interaction_count || 0, user_sum: ud.interactions },
      { label: 'generations', enterprise: ent.code_generation_activity_count || 0, user_sum: ud.generations },
      { label: 'acceptances', enterprise: ent.code_acceptance_activity_count || 0, user_sum: ud.acceptances },
      { label: 'loc_added', enterprise: ent.loc_added_sum || 0, user_sum: ud.loc_added },
      { label: 'loc_deleted', enterprise: ent.loc_deleted_sum || 0, user_sum: ud.loc_deleted },
    ];

    for (const m of metrics) {
      const diff = m.user_sum - m.enterprise;
      const pct = m.enterprise > 0 ? Math.abs(diff) / m.enterprise : (diff === 0 ? 0 : 1);
      const status = pct <= 0.001 ? 'match'
        : pct <= 0.05 ? 'minor_difference'
        : 'material_difference';
      records.push({ day: ent.day, ...m, diff, pct, status });
    }
  }
  return records;
}

/**
 * Detect if a parsed JSON object is a Copilot metrics source file.
 */
export function isCopilotMetricsSource(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return !!(obj.enterprise_report || obj.user_report);
}
