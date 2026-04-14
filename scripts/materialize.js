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
import { isCopilotMetricsSource } from '../shared/sources/copilot-metrics.js';
import { isAgenticSource } from '../shared/sources/agentic.js';
import { isPrReviewData } from '../shared/sources/pr-review.js';
import { getAllDefaults } from '../shared/core/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT, '_data');

function hashFile(filepath) {
  const content = readFileSync(filepath);
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function findDataFiles() {
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
  const sources = { copilot: null, pr: null, agentic: null };
  const fileInfo = {};

  for (const filepath of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(filepath, 'utf-8'));
    } catch (e) {
      console.warn(`  ⚠ Skipping ${basename(filepath)}: invalid JSON`);
      continue;
    }

    const info = { file: basename(filepath), hash: hashFile(filepath), metadata: data.metadata || null };

    if (isCopilotMetricsSource(data) && !sources.copilot) {
      sources.copilot = data;
      fileInfo.copilot = info;
      console.log(`  📊 Copilot metrics: ${basename(filepath)}`);
    } else if (isPrReviewData(data) && !sources.pr) {
      sources.pr = data;
      fileInfo.pr = info;
      console.log(`  📊 PR review data: ${basename(filepath)}`);
    } else if (isAgenticSource(data) && !sources.agentic) {
      sources.agentic = data;
      fileInfo.agentic = info;
      console.log(`  📊 Agentic data: ${basename(filepath)}`);
    }
  }

  return { sources, fileInfo };
}

function writeArtifact(name, artifact) {
  const filepath = join(OUTPUT_DIR, `${name}.json`);
  writeFileSync(filepath, JSON.stringify(artifact, null, 2));
  const size = readFileSync(filepath).length;
  console.log(`  ✅ ${name}.json (${(size / 1024).toFixed(1)} KB, ${artifact.data?.length ?? artifact.artifact?.profile?.record_count ?? '?'} records)`);
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

  const config = getAllDefaults();
  const artifacts = [];
  const edges = [];

  // AI-Assisted Efficiency Days
  if (sources.copilot) {
    const result = materializeAiAssistedEfficiencyDays(sources.copilot, fileInfo.copilot);
    writeArtifact('ai-assisted-efficiency-days', result);
    artifacts.push('ai-assisted-efficiency-days.json');
    edges.push({ from: fileInfo.copilot.file, to: 'ai-assisted-efficiency-days.json' });
  }

  // AI-Assisted Structural Days
  if (sources.copilot) {
    const inputFiles = [fileInfo.copilot];
    if (fileInfo.pr) inputFiles.push(fileInfo.pr);
    const result = materializeAiAssistedStructuralDays(
      sources.copilot, sources.pr || null, config, { inputFiles }
    );
    writeArtifact('ai-assisted-structural-days', result);
    artifacts.push('ai-assisted-structural-days.json');
    edges.push({ from: fileInfo.copilot.file, to: 'ai-assisted-structural-days.json' });
    if (fileInfo.pr) edges.push({ from: fileInfo.pr.file, to: 'ai-assisted-structural-days.json' });
  }

  // Agentic Efficiency Days
  if (sources.agentic) {
    const result = materializeAgenticEfficiencyDays(sources.agentic, fileInfo.agentic);
    writeArtifact('agentic-efficiency-days', result);
    artifacts.push('agentic-efficiency-days.json');
    edges.push({ from: fileInfo.agentic.file, to: 'agentic-efficiency-days.json' });
  }

  // Agentic PR Sessions
  if (sources.agentic) {
    const result = materializeAgenticPrSessions(sources.agentic, fileInfo.agentic);
    writeArtifact('agentic-pr-sessions', result);
    artifacts.push('agentic-pr-sessions.json');
    edges.push({ from: fileInfo.agentic.file, to: 'agentic-pr-sessions.json' });
  }

  // Write pipeline manifest
  const manifest = {
    materialized_at: new Date().toISOString(),
    raw_files: Object.values(fileInfo).map(f => f.file),
    artifacts,
    edges,
  };
  writeFileSync(join(OUTPUT_DIR, 'pipeline-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  ✅ pipeline-manifest.json`);

  console.log(`\n✅ Materialized ${artifacts.length} artifact(s) to _data/\n`);
}

main();
