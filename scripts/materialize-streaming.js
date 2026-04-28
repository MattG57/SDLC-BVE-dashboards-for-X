#!/usr/bin/env node
/**
 * Materialize Pipeline Artifacts — Streaming Version
 *
 * Same output as scripts/materialize.js but uses streaming JSON parsing
 * for large copilot-metrics files. Produces identical artifacts for comparison.
 *
 * Usage:
 *   node scripts/materialize-streaming.js
 *
 * Key difference: copilot-metrics files are read via stream-json instead of
 * JSON.parse, allowing 1GB+ files to be processed within ~512MB Node.js heap.
 * Agentic and PR-review files are small (<2MB) and still use readFileSync.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { createReadStream } from 'fs';
import { resolve, join, basename, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// stream-json is CJS — use createRequire
const require = createRequire(import.meta.url);
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/stream-array.js');
const { streamValues } = require('stream-json/streamers/stream-values.js');
const { pick } = require('stream-json/filters/pick.js');
const { chain } = require('stream-chain');

import { flattenDayTotal, dedupEnterpriseDays, computeDayRatios } from '../shared/sources/copilot-metrics.js';
import { materializeAiAssistedStructuralDays } from '../shared/materializers/ai-assisted-structural-days.js';
import { materializeAgenticEfficiencyDays } from '../shared/materializers/agentic-efficiency-days.js';
import { materializeAgenticPrSessions } from '../shared/materializers/agentic-pr-sessions.js';
import { materializeLeverageSummary } from '../shared/materializers/leverage-summary.js';
import { isCopilotMetricsSource } from '../shared/sources/copilot-metrics.js';
import { isAgenticSource } from '../shared/sources/agentic.js';
import { isPrReviewData } from '../shared/sources/pr-review.js';
import { getAllDefaults } from '../shared/core/config.js';
import { safeDiv } from '../shared/core/math.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'dashboard/dataflow/data');
const RAW_DIR = resolve(DATA_DIR, 'raw');
const OUTPUT_DIR = resolve(DATA_DIR, 'materialized');

const RUN_TS = new Date().toISOString().slice(0, 16).replace(/:/g, '') + 'Z';

// Fields kept on each user record for dashboard overlays
const USER_OVERLAY_FIELDS = [
  'day', 'user_login', 'user_id',
  'user_initiated_interaction_count',
  'code_generation_activity_count', 'code_acceptance_activity_count',
  'loc_suggested_to_add_sum', 'loc_suggested_to_delete_sum',
  'loc_added_sum', 'loc_deleted_sum',
  'used_agent', 'used_chat', 'used_cli', 'used_copilot_coding_agent',
];

function hashFile(filepath) {
  const content = readFileSync(filepath);
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function findDataFiles() {
  if (!existsSync(RAW_DIR)) return [];
  return readdirSync(RAW_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => resolve(RAW_DIR, f))
    .sort();
}

// ── Streaming copilot-metrics reader ──

async function streamCopilotSection(filepath, sectionName) {
  return new Promise((resolve, reject) => {
    const pipeline = chain([
      createReadStream(filepath),
      parser(),
      pick({ filter: sectionName }),
      streamValues(),
    ]);
    let result = null;
    pipeline.on('data', ({ value }) => { result = value; });
    pipeline.on('end', () => resolve(result));
    pipeline.on('error', reject);
  });
}

async function streamCopilotUsers(filepath) {
  return new Promise((resolve, reject) => {
    const users = [];
    const seen = new Set();
    const pipeline = chain([
      createReadStream(filepath),
      parser(),
      pick({ filter: 'user_report' }),
      streamArray(),
    ]);
    pipeline.on('data', ({ value }) => {
      const login = value.user_login || value.login || value.github_login;
      const day = value.day || value.date;
      if (!login || !day) return;
      const key = day + '|' + login;
      if (seen.has(key)) return;
      seen.add(key);
      // Keep only overlay fields — discard totals_by_* nested arrays
      const slim = {};
      for (const k of USER_OVERLAY_FIELDS) {
        if (k in value) slim[k] = value[k];
      }
      slim.day = day;
      slim.user_login = login;
      users.push(slim);
    });
    pipeline.on('end', () => resolve(users));
    pipeline.on('error', reject);
  });
}

/**
 * Stream a copilot-metrics file and return pre-processed components.
 * Memory: proportional to output (~5MB) not input (can be 1GB+).
 */
async function streamCopilotMetricsFile(filepath) {
  console.log(`  📊 Streaming copilot-metrics: ${basename(filepath)}`);
  const startMs = Date.now();

  const [metadata, enterpriseReport, slimUsers] = await Promise.all([
    streamCopilotSection(filepath, 'metadata'),
    streamCopilotSection(filepath, 'enterprise_report'),
    streamCopilotUsers(filepath),
  ]);

  const elapsed = Date.now() - startMs;
  const dayTotals = enterpriseReport?.day_totals || [];
  console.log(`     → ${dayTotals.length} enterprise days, ${slimUsers.length} user-days (${elapsed}ms)`);

  return { metadata, enterpriseReport, slimUsers };
}

// ── Non-streaming loaders (for small files) ──

function loadSmallFile(filepath) {
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

function classifyFile(filepath) {
  // Peek at first 2KB to classify without full parse
  const fd = require('fs').openSync(filepath, 'r');
  const buf = Buffer.alloc(2048);
  require('fs').readSync(fd, buf, 0, 2048, 0);
  require('fs').closeSync(fd);
  const peek = buf.toString('utf-8');
  if (peek.includes('session_logs') && peek.includes('agent-session-logs')) return 'sessionLogs';
  if (peek.includes('enterprise_report') || peek.includes('user_report')) return 'copilot';
  if (peek.includes('developer_day_summary') || peek.includes('pr_sessions')) return 'agentic';
  if (peek.includes('"prs"') || peek.includes('pull_requests')) return 'pr';
  // Fall back to full parse for classification
  const data = loadSmallFile(filepath);
  if (isCopilotMetricsSource(data)) return 'copilot';
  if (isAgenticSource(data)) return 'agentic';
  if (isPrReviewData(data)) return 'pr';
  return 'unknown';
}

// ── Artifact writer ──

function writeArtifact(name, artifact) {
  const tsName = `${name}-${RUN_TS}`;
  const filepath = join(OUTPUT_DIR, `${tsName}.json`);
  writeFileSync(filepath, JSON.stringify(artifact, null, 2));
  const size = readFileSync(filepath).length;
  const count = artifact.data?.length ?? artifact.elements?.length ?? artifact.artifact?.profile?.record_count ?? '?';
  const unit = artifact.elements ? 'elements' : 'records';
  console.log(`  ✅ ${tsName}.json (${(size / 1024).toFixed(1)} KB, ${count} ${unit})`);
  return `${tsName}.json`;
}

// ── Build AI-assisted efficiency artifact from streamed components ──

function buildEfficiencyFromStreamed(enterpriseDays, slimUsers, options = {}) {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Flatten + dedup enterprise days
  const rawEntDays = enterpriseDays.map(flattenDayTotal);
  const entResult = dedupEnterpriseDays(rawEntDays);

  // Add per-dev ratios
  const data = entResult.data.map(d => ({ ...d, ...computeDayRatios(d) }));

  // Date range
  const days = data.map(d => d.day).sort();
  const dateRange = days.length > 0
    ? { first: days[0], last: days[days.length - 1], days_with_data: days.length }
    : { first: null, last: null, days_with_data: 0 };

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;

  return {
    artifact: {
      stage: 'materialized',
      name: 'ai-assisted-efficiency-days',
      version: '1.1.0',
      computed_at: new Date().toISOString(),
      compute_ms: Math.round(elapsed),
      inputs: (options.inputFiles || []).map(f => ({
        file: f.file, hash: f.hash || null, metadata: f.metadata || null,
      })),
      profile: {
        record_count: data.length,
        detail_row_count: slimUsers.length,
        detail_label: 'user-days',
        unique_people: new Set(slimUsers.map(u => u.user_login)).size,
        people_label: 'users',
        unique_repos: null,
        date_range: dateRange,
        enterprise_dedup: entResult.profile,
        user_dedup: options.userDedupProfile || undefined,
      },
    },
    data,
    _users: slimUsers,
  };
}

// ── Merge helpers ──

function extractPrArrayFromMerged(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.prs)) return data.prs;
  if (data.pull_requests?.prs) return data.pull_requests.prs;
  return [];
}

function setPrArray(data, prs) {
  if (Array.isArray(data.prs)) { data.prs = prs; return; }
  if (data.pull_requests?.prs) { data.pull_requests.prs = prs; return; }
  data.prs = prs;
}

// ── Main ──

async function main() {
  console.log('\n🔧 Materializing pipeline artifacts (streaming)...\n');
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const dataFiles = findDataFiles();
  if (dataFiles.length === 0) {
    console.log('  ⚠ No data files found.');
    process.exit(0);
  }
  console.log(`  Found ${dataFiles.length} data file(s)\n`);

  // Classify files
  const classified = { copilot: [], pr: [], agentic: [], sessionLogs: [] };
  const fileInfo = { copilot: [], pr: [], agentic: [], sessionLogs: [] };

  for (const fp of dataFiles) {
    const type = classifyFile(fp);
    const info = { file: basename(fp), hash: hashFile(fp) };
    if (type === 'sessionLogs') {
      classified.sessionLogs.push(fp);
      fileInfo.sessionLogs.push(info);
      console.log(`  📊 Session logs: ${basename(fp)}`);
    } else if (type === 'copilot') {
      classified.copilot.push(fp);
      fileInfo.copilot.push(info);
    } else if (type === 'pr') {
      classified.pr.push(fp);
      fileInfo.pr.push(info);
      console.log(`  📊 PR review data: ${basename(fp)}`);
    } else if (type === 'agentic') {
      classified.agentic.push(fp);
      fileInfo.agentic.push(info);
      console.log(`  📊 Agentic data: ${basename(fp)}`);
    } else {
      console.log(`  ⚠ Unknown: ${basename(fp)}`);
    }
  }

  // ── Stream copilot-metrics files ──
  const allEntDays = [];
  const allSlimUsers = [];
  const allMetadata = [];

  for (const fp of classified.copilot) {
    const { metadata, enterpriseReport, slimUsers } = await streamCopilotMetricsFile(fp);
    if (enterpriseReport?.day_totals) allEntDays.push(...enterpriseReport.day_totals);
    allSlimUsers.push(...slimUsers);
    if (metadata) {
      allMetadata.push(metadata);
      const idx = fileInfo.copilot.findIndex(f => f.file === basename(fp));
      if (idx >= 0) fileInfo.copilot[idx].metadata = metadata;
    }
  }
  if (classified.copilot.length > 1) console.log(`  🔗 Merged ${classified.copilot.length} copilot-metrics files`);

  // ── Load small files normally ──
  const prDataFiles = classified.pr.map(fp => loadSmallFile(fp));
  let mergedPr = null;
  if (prDataFiles.length === 1) {
    mergedPr = prDataFiles[0];
  } else if (prDataFiles.length > 1) {
    mergedPr = JSON.parse(JSON.stringify(prDataFiles[0]));
    for (let i = 1; i < prDataFiles.length; i++) {
      const existingPrs = extractPrArrayFromMerged(mergedPr);
      const newPrs = extractPrArrayFromMerged(prDataFiles[i]);
      setPrArray(mergedPr, existingPrs.concat(newPrs));
    }
    console.log(`  🔗 Merged ${prDataFiles.length} pr-review files`);
  }

  const agenticDataFiles = classified.agentic.map(fp => loadSmallFile(fp));
  let mergedAgentic = null;
  if (agenticDataFiles.length === 1) {
    mergedAgentic = agenticDataFiles[0];
  } else if (agenticDataFiles.length > 1) {
    mergedAgentic = JSON.parse(JSON.stringify(agenticDataFiles[0]));
    for (let i = 1; i < agenticDataFiles.length; i++) {
      const other = agenticDataFiles[i];
      if (other.developer_day_summary) mergedAgentic.developer_day_summary = (mergedAgentic.developer_day_summary || []).concat(other.developer_day_summary);
      if (other.pr_sessions) mergedAgentic.pr_sessions = (mergedAgentic.pr_sessions || []).concat(other.pr_sessions);
    }
    console.log(`  🔗 Merged ${agenticDataFiles.length} agentic files`);
  }

  // ── Produce artifacts ──
  const config = getAllDefaults();

  // Merge dashboard-config.json overrides into config
  const configPath = join(ROOT, 'dashboard-config.json');
  if (existsSync(configPath)) {
    try {
      const orgConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      Object.assign(config, orgConfig);
    } catch(e) { /* ignore parse errors */ }
  }

  const artifactFiles = [];
  const artifactMap = {};
  const edges = [];

  // AI-Assisted Efficiency Days (from streamed data)
  if (allEntDays.length > 0) {
    // Dedup slim users across files
    const userDedup = new Map();
    const totalUsersBefore = allSlimUsers.length;
    for (const u of allSlimUsers) {
      const key = u.day + '|' + u.user_login;
      if (!userDedup.has(key)) userDedup.set(key, u);
    }
    const dedupedUsers = [...userDedup.values()];

    const result = buildEfficiencyFromStreamed(allEntDays, dedupedUsers, {
      inputFiles: fileInfo.copilot,
      userDedupProfile: {
        before: totalUsersBefore,
        after: dedupedUsers.length,
        removed: totalUsersBefore - dedupedUsers.length,
        key: 'day|user_login',
        unique_logins: new Set(dedupedUsers.map(u => u.user_login)).size,
      },
    });
    const fname = writeArtifact('ai-assisted-efficiency-days', result);
    artifactFiles.push(fname);
    artifactMap['ai-assisted-efficiency-days'] = fname;
    fileInfo.copilot.forEach(f => edges.push({ from: f.file, to: fname }));
  }

  // AI-Assisted Structural Days (needs full copilot data for structural computation)
  if (allEntDays.length > 0) {
    // Reconstruct minimal copilot data envelope for the structural materializer
    const copilotEnvelope = {
      enterprise_report: { day_totals: allEntDays },
      user_report: allSlimUsers, // slim users suffice for buildCopilotUsersByDay
      metadata: allMetadata[0] || null,
    };
    const inputFiles = [...fileInfo.copilot, ...fileInfo.pr];
    const result = materializeAiAssistedStructuralDays(
      copilotEnvelope, mergedPr || null, config, { inputFiles }
    );
    const fname = writeArtifact('ai-assisted-structural-days', result);
    artifactFiles.push(fname);
    artifactMap['ai-assisted-structural-days'] = fname;
    fileInfo.copilot.forEach(f => edges.push({ from: f.file, to: fname }));
    fileInfo.pr.forEach(f => edges.push({ from: f.file, to: fname }));
  }

  // Agentic Efficiency Days
  if (mergedAgentic) {
    const result = materializeAgenticEfficiencyDays(mergedAgentic, { inputFiles: fileInfo.agentic });
    const fname = writeArtifact('agentic-efficiency-days', result);
    artifactFiles.push(fname);
    artifactMap['agentic-efficiency-days'] = fname;
    fileInfo.agentic.forEach(f => edges.push({ from: f.file, to: fname }));
  }

  // Agentic PR Sessions
  if (mergedAgentic) {
    const result = materializeAgenticPrSessions(mergedAgentic, { inputFiles: fileInfo.agentic });
    const fname = writeArtifact('agentic-pr-sessions', result);
    artifactFiles.push(fname);
    artifactMap['agentic-pr-sessions'] = fname;
    fileInfo.agentic.forEach(f => edges.push({ from: f.file, to: fname }));
  }

  // Load and merge session logs if available
  let mergedSessionLogs = null;
  if (classified.sessionLogs.length > 0) {
    const allSessions = [];
    for (const fp of classified.sessionLogs) {
      const sl = loadSmallFile(fp);
      if (sl?.session_logs) allSessions.push(...sl.session_logs);
    }
    mergedSessionLogs = { session_logs: allSessions };
    console.log(`  📋 Session logs: ${allSessions.length} sessions with compute time`);
  }

  // Leverage Summary
  const leverageInputArtifacts = {};
  if (artifactMap['ai-assisted-efficiency-days']) {
    leverageInputArtifacts.aiEfficiency = JSON.parse(readFileSync(join(OUTPUT_DIR, artifactMap['ai-assisted-efficiency-days']), 'utf-8'));
  }
  if (artifactMap['ai-assisted-structural-days']) {
    leverageInputArtifacts.aiStructural = JSON.parse(readFileSync(join(OUTPUT_DIR, artifactMap['ai-assisted-structural-days']), 'utf-8'));
  }
  if (artifactMap['agentic-efficiency-days']) {
    leverageInputArtifacts.agenticEfficiency = JSON.parse(readFileSync(join(OUTPUT_DIR, artifactMap['agentic-efficiency-days']), 'utf-8'));
  }
  if (artifactMap['agentic-pr-sessions']) {
    leverageInputArtifacts.agenticSessions = JSON.parse(readFileSync(join(OUTPUT_DIR, artifactMap['agentic-pr-sessions']), 'utf-8'));
  }
  if (mergedSessionLogs) {
    leverageInputArtifacts.sessionLogs = mergedSessionLogs;
  }

  if (Object.keys(leverageInputArtifacts).length > 0) {
    const leverageResult = materializeLeverageSummary(leverageInputArtifacts, config, {
      inputFiles: Object.entries(artifactMap).map(([name, file]) => ({ file, artifact: name })),
    });
    const fname = writeArtifact('leverage-summary', leverageResult);
    artifactFiles.push(fname);
    artifactMap['leverage-summary'] = fname;
    for (const [, artFile] of Object.entries(artifactMap)) {
      if (artFile !== fname) edges.push({ from: artFile, to: fname });
    }
  }

  // ── Manifest ──
  const allRawFiles = [...new Set([
    ...fileInfo.copilot.map(f => f.file),
    ...fileInfo.pr.map(f => f.file),
    ...fileInfo.agentic.map(f => f.file),
    ...fileInfo.sessionLogs.map(f => f.file),
  ])];

  const manifest = {
    materialized_at: new Date().toISOString(),
    run_timestamp: RUN_TS,
    raw_dir: 'raw',
    materialized_dir: 'materialized',
    raw_files: allRawFiles,
    artifacts: artifactFiles,
    artifact_map: artifactMap,
    edges,
    streaming: true,
  };
  writeFileSync(join(DATA_DIR, 'pipeline-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  ✅ pipeline-manifest.json`);

  const mem = process.memoryUsage();
  console.log(`\n✅ Materialized ${artifactFiles.length} artifact(s) from ${allRawFiles.length} raw file(s)`);
  console.log(`   Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB, RSS: ${(mem.rss / 1024 / 1024).toFixed(1)} MB\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
