const data = require('./queries/ai-assisted-coding-example.json');
const days = data.enterprise_report.day_totals;

function getLoc(d) {
  let loc = d.loc_added_sum || 0;
  if (loc === 0 && d.totals_by_ide) loc = d.totals_by_ide.reduce((s,i) => s + (i.loc_added_sum||0), 0);
  return loc;
}

console.log('=== RAW DATA PER DAY ===');
for (const d of days) {
  console.log(d.day, '| DAU:', d.daily_active_users, '| interactions:', d.user_initiated_interaction_count, '| loc_added:', getLoc(d));
}

console.log('\n=== INTERACTIONS METHOD (interact / 20 = org hrs/day) ===');
let totalInterHrs = 0;
const interPerDev = [];
for (const d of days) {
  const hrsDay = d.user_initiated_interaction_count / 20;
  const hrsPerDevDay = hrsDay / d.daily_active_users;
  totalInterHrs += hrsDay;
  interPerDev.push(hrsPerDevDay);
  console.log(d.day, '| hrs_day:', hrsDay.toFixed(1), '| hrs/dev/day:', hrsPerDevDay.toFixed(3));
}
console.log('Avg hrs/dev/day:', (interPerDev.reduce((a,b)=>a+b,0)/interPerDev.length).toFixed(3));
console.log('Total hrs:', totalInterHrs.toFixed(0));

console.log('\n=== LOC METHOD (loc/1000 * 2 = org hrs/day) ===');
let totalLocHrs = 0;
const locPerDev = [];
for (const d of days) {
  const loc = getLoc(d);
  const hrsDay = (loc / 1000) * 2;
  const hrsPerDevDay = hrsDay / d.daily_active_users;
  totalLocHrs += hrsDay;
  locPerDev.push(hrsPerDevDay);
  console.log(d.day, '| loc:', loc, '| hrs_day:', hrsDay.toFixed(1), '| hrs/dev/day:', hrsPerDevDay.toFixed(3));
}
console.log('Avg hrs/dev/day:', (locPerDev.reduce((a,b)=>a+b,0)/locPerDev.length).toFixed(3));
console.log('Total hrs:', totalLocHrs.toFixed(0));

console.log('\n=== MANUAL DAILY % (0.20 * 30 / 5 = 1.2 hrs/dev/day) ===');
let totalManualHrs = 0;
for (const d of days) {
  const hrsDay = (0.20 * 30 / 5) * d.daily_active_users / Math.max(d.daily_active_users, 1);
  totalManualHrs += hrsDay;
  console.log(d.day, '| dau:', d.daily_active_users, '| hrs_day:', hrsDay.toFixed(1), '| hrs/dev/day:', (hrsDay/d.daily_active_users).toFixed(4));
}
console.log('Avg hrs/dev/day:', (0.20 * 30 / 5).toFixed(4));
console.log('Total hrs:', totalManualHrs.toFixed(0));

console.log('\n=== MANUAL DAILY % BUG CHECK ===');
console.log('Formula: (pct * baseline / workdays) * dau / max(dau, 1)');
console.log('With pct=0.20, baseline=30, workdays=5:');
console.log('  = (0.20 * 30 / 5) * dau / dau = 1.2 always');
console.log('  Total = 1.2 * 7 days = 8.4 (NOT scaled by number of devs!)');
console.log('');
console.log('The formula divides by dau then the table column computes avg = sum(raw/dau)/N');
console.log('raw = interact/20 = ORG total, not per-dev');
console.log('est_hrs_day = raw (org total)');
console.log('est_hrs_per_dev_day = raw / dau');
console.log('');
console.log('For manual_daily_pct: raw = (pct * base / wdays) * dau / max(dau,1)');
console.log('  = 1.2 * dau / dau = 1.2 (THIS IS WRONG - should be 1.2 PER DEV, so org total = 1.2 * dau)');
console.log('Then est_hrs_per_dev_day = 1.2 / dau = tiny number');
