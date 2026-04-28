#!/usr/bin/env node
/**
 * Materialize Pipeline Artifacts
 *
 * Reads raw query output files and writes 4 materialized artifacts to _data/.
 * Each artifact includes a standard envelope with profile metadata.
 *
 * Usage:
 *   node scripts/materialize.js
 *
 * Reads from:
 *   BVE-dashboards-for-{suite}/dashboard/{type}/data/*.json
 *
 * Writes to:
 *   _data/ai-assisted-efficiency-days.json
 *   _data/ai-assisted-structural-days.json
 *   _data/agentic-efficiency-days.json
 *   _data/agentic-pr-sessions.json
 *   _data/pipeline-manifest.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve, join, basename, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

import { materializeAiAssistedEfficiencyDays } from '../shared/materializers/ai-assisted-efficiency-days.js';
import { materializeAiAssistedStructuralDays } from '../shared/materializers/ai-assisted-structural-days.js';
import { materializeAgenticEfficiencyDays } from '../shared/materializers/agentic-efficiency-days.js';
import { materializeAgenticPrSessions } from '../shared/materializers/agentic-pr-sessions.js';
import { materializeLeverageSummary } from '../shared/materializers/leverage-summary.js';
import { isCopilotMetricsSource } from '../shared/sources/copilot-metrics.js';
import { isAgenticSource } from '../shared/sources/agentic.js';
import { isPrReviewData } from '../shared/sources/pr-review.js';
import { getAllDefaults } from '../shared/core/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'dashboard/dataflow/data');
const RAW_DIR = resolve(DATA_DIR, 'raw');
const OUTPUT_DIR = resolve(DATA_DIR, 'materialized');

// Timestamp for this materialization run
const RUN_TS = new Date().toISOString().slice(0, 16).replace(/:/g, '') + 'Z';

function hashFile(filepath) {
  const content = readFileSync(filepath);
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function findDataFiles() {
  // Prefer consolidated _data/raw/ directory
  if (existsSync(RAW_DIR)) {
    const rawFiles = readdirSync(RAW_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => resolve(RAW_DIR, f));
    if (rawFiles.length > 0) {
      return rawFiles;
    }
  }

  // Fallback: scan traditional per-dashboard data directories
  const dirs = [
    'BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency/data',
    'BVE-dashboards-for-ai-assisted-coding/dashboard/structural/data',
    'BVE-dashboards-for-ai-assisted-coding/dashboard/element/data',
    'BVE-dashboards-for-agentic-ai-coding/dashboard/efficiency/data',
    'BVE-dashboards-for-agentic-ai-coding/dashboard/element/data',
  ];

  const files = [];
  for (const dir of dirs) {
    const fullDir = resolve(ROOT, dir);
    if (!existsSync(fullDir)) continue;
    for (const f of readdirSync(fullDir)) {
      if (f.endsWith('.json') && f !== 'manifest.json') {
        files.push(resolve(fullDir, f));
      }
    }
  }
  return files;
}

function loadAndClassify(files) {
  const sources = { copilot: [], pr: [], agentic: [], sessionLogs: [] };
  const fileInfo = { copilot: [], pr: [], agentic: [], sessionLogs: [] };

  for (const filepath of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(filepath, 'utf-8'));
    } catch (e) {
      console.warn(`  ⚠ Skipping ${basename(filepath)}: invalid JSON`);
      continue;
    }

    const info = { file: basename(filepath), hash: hashFile(filepath), metadata: data.metadata || null };

    if (data.session_logs && data.metadata?.script === 'agent-session-logs') {
      sources.sessionLogs.push(data);
      fileInfo.sessionLogs.push(info);
      console.log(`  📊 Session logs: ${basename(filepath)} (${data.session_logs.length} sessions)`);
    } else if (isCopilotMetricsSource(data)) {
      sources.copilot.push(data);
      fileInfo.copilot.push(info);
      console.log(`  📊 Copilot metrics: ${basename(filepath)}`);
    } else if (isPrReviewData(data)) {
      sources.pr.push(data);
      fileInfo.pr.push(info);
      console.log(`  📊 PR review data: ${basename(filepath)}`);
    } else if (isAgenticSource(data)) {
      sources.agentic.push(data);
      fileInfo.agentic.push(info);
      console.log(`  📊 Agentic data: ${basename(filepath)}`);
    }
  }

  return { sources, fileInfo };
}

/**
 * Merge multiple raw files of the same source type by concatenating
 * their data arrays. Dedup is handled downstream by the materializers.
 */
function mergeSource(type, dataFiles) {
  if (dataFiles.length === 0) return null;
  if (dataFiles.length === 1) return dataFiles[0];

  // Deep-merge: combine the data arrays from each file
  const merged = JSON.parse(JSON.stringify(dataFiles[0]));

  for (let i = 1; i < dataFiles.length; i++) {
    const other = dataFiles[i];
    if (type === 'copilot') {
      // Concat enterprise day_totals and user_report arrays
      if (other.enterprise_report?.day_totals) {
        merged.enterprise_report = merged.enterprise_report || {};
        merged.enterprise_report.day_totals = (merged.enterprise_report.day_totals || []).concat(other.enterprise_report.day_totals);
      }
      if (other.user_report) {
        merged.user_report = (merged.user_report || []).concat(other.user_report);
      }
    } else if (type === 'pr') {
      // Concat PR arrays (supports multiple envelope shapes)
      const existingPrs = extractPrArrayFromMerged(merged);
      const newPrs = extractPrArrayFromMerged(other);
      setPrArray(merged, existingPrs.concat(newPrs));
    } else if (type === 'agentic') {
      // Concat developer_day_summary and pr_sessions
      if (other.developer_day_summary) {
        merged.developer_day_summary = (merged.developer_day_summary || []).concat(other.developer_day_summary);
      }
      if (other.pr_sessions) {
        merged.pr_sessions = (merged.pr_sessions || []).concat(other.pr_sessions);
      }
    }
  }

  // Metadata: use the most recent file's metadata but note all sources
  const allMeta = dataFiles.map(d => d.metadata).filter(Boolean);
  if (allMeta.length > 0) {
    merged.metadata = allMeta.sort((a, b) =>
      (b.collected_at || '').localeCompare(a.collected_at || '')
    )[0];
    merged.metadata._merged_from = dataFiles.length;
  }

  return merged;
}

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

function main() {
  console.log('\n🔧 Materializing pipeline artifacts...\n');

  // Ensure output directory
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Find and classify data files
  const dataFiles = findDataFiles();
  if (dataFiles.length === 0) {
    console.log('  ⚠ No data files found. Run ./run-query.sh first.');
    process.exit(0);
  }
  console.log(`  Found ${dataFiles.length} data file(s)\n`);

  const { sources, fileInfo } = loadAndClassify(dataFiles);
  console.log();

  // Merge multiple files of the same source type
  const mergedCopilot = mergeSource('copilot', sources.copilot);
  const mergedPr = mergeSource('pr', sources.pr);
  const mergedAgentic = mergeSource('agentic', sources.agentic);

  if (mergedCopilot && sources.copilot.length > 1) console.log(`  🔗 Merged ${sources.copilot.length} copilot-metrics files`);
  if (mergedPr && sources.pr.length > 1) console.log(`  🔗 Merged ${sources.pr.length} pr-review files`);
  if (mergedAgentic && sources.agentic.length > 1) console.log(`  🔗 Merged ${sources.agentic.length} agentic files`);

  const config = getAllDefaults();

  // Merge dashboard-config.json overrides into config (same as leverage-summary)
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

  // AI-Assisted Efficiency Days
  if (mergedCopilot) {
    const result = materializeAiAssistedEfficiencyDays(mergedCopilot, {
      inputFiles: fileInfo.copilot,
    });
    const fname = writeArtifact('ai-assisted-efficiency-days', result);
    artifactFiles.push(fname);
    artifactMap['ai-assisted-efficiency-days'] = fname;
    fileInfo.copilot.forEach(f => edges.push({ from: f.file, to: fname }));
  }

  // AI-Assisted Structural Days
  if (mergedCopilot) {
    const inputFiles = [...fileInfo.copilot, ...fileInfo.pr];
    const result = materializeAiAssistedStructuralDays(
      mergedCopilot, mergedPr || null, config, { inputFiles }
    );
    const fname = writeArtifact('ai-assisted-structural-days', result);
    artifactFiles.push(fname);
    artifactMap['ai-assisted-structural-days'] = fname;
    fileInfo.copilot.forEach(f => edges.push({ from: f.file, to: fname }));
    fileInfo.pr.forEach(f => edges.push({ from: f.file, to: fname }));
  }

  // Agentic Efficiency Days
  if (mergedAgentic) {
    const result = materializeAgenticEfficiencyDays(mergedAgentic, {
      inputFiles: fileInfo.agentic,
    });
    const fname = writeArtifact('agentic-efficiency-days', result);
    artifactFiles.push(fname);
    artifactMap['agentic-efficiency-days'] = fname;
    fileInfo.agentic.forEach(f => edges.push({ from: f.file, to: fname }));
  }

  // Agentic PR Sessions
  if (mergedAgentic) {
    const result = materializeAgenticPrSessions(mergedAgentic, {
      inputFiles: fileInfo.agentic,
    });
    const fname = writeArtifact('agentic-pr-sessions', result);
    artifactFiles.push(fname);
    artifactMap['agentic-pr-sessions'] = fname;
    fileInfo.agentic.forEach(f => edges.push({ from: f.file, to: fname }));
  }

  // Merge session logs if available
  const mergedSessionLogs = sources.sessionLogs.length > 0
    ? sources.sessionLogs.reduce((acc, sl) => {
        acc.session_logs = (acc.session_logs || []).concat(sl.session_logs || []);
        return acc;
      }, { session_logs: [] })
    : null;
  if (mergedSessionLogs) {
    console.log(`  📋 Session logs: ${mergedSessionLogs.session_logs.length} sessions with compute time`);
  }

  // Leverage Summary — reads from the 4 artifacts above + session logs
  const leverageInputArtifacts = {};
  if (artifactMap['ai-assisted-efficiency-days']) {
    leverageInputArtifacts.aiEfficiency = JSON.parse(
      readFileSync(join(OUTPUT_DIR, artifactMap['ai-assisted-efficiency-days']), 'utf-8')
    );
  }
  if (artifactMap['ai-assisted-structural-days']) {
    leverageInputArtifacts.aiStructural = JSON.parse(
      readFileSync(join(OUTPUT_DIR, artifactMap['ai-assisted-structural-days']), 'utf-8')
    );
  }
  if (artifactMap['agentic-efficiency-days']) {
    leverageInputArtifacts.agenticEfficiency = JSON.parse(
      readFileSync(join(OUTPUT_DIR, artifactMap['agentic-efficiency-days']), 'utf-8')
    );
  }
  if (artifactMap['agentic-pr-sessions']) {
    leverageInputArtifacts.agenticSessions = JSON.parse(
      readFileSync(join(OUTPUT_DIR, artifactMap['agentic-pr-sessions']), 'utf-8')
    );
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
    // Edges: each upstream artifact → leverage-summary
    for (const [, artFile] of Object.entries(artifactMap)) {
      if (artFile !== fname) edges.push({ from: artFile, to: fname });
    }
  }

  // Collect all unique raw files for the manifest
  const allRawFiles = [...new Set([
    ...fileInfo.copilot.map(f => f.file),
    ...fileInfo.pr.map(f => f.file),
    ...fileInfo.agentic.map(f => f.file),
    ...fileInfo.sessionLogs.map(f => f.file),
  ])];

  // Write pipeline manifest
  const manifest = {
    materialized_at: new Date().toISOString(),
    run_timestamp: RUN_TS,
    raw_dir: 'raw',
    materialized_dir: 'materialized',
    raw_files: allRawFiles,
    artifacts: artifactFiles,
    artifact_map: artifactMap,
    edges,
  };
  writeFileSync(join(DATA_DIR, 'pipeline-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  ✅ pipeline-manifest.json`);

  console.log(`\n✅ Materialized ${artifactFiles.length} artifact(s) from ${allRawFiles.length} raw file(s) to _data/materialized/\n`);
}

main();
