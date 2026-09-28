#!/usr/bin/env node
/**
 * Write dashboard/dataflow/data/query-status.json for the current pipeline
 * invocation. Called by scripts/collect-and-materialize.sh.
 *
 * Usage:
 *   node scripts/write-query-status.js --out <file> --mode <mode> \
 *     --run-started <ts> [--profile <name>] [--targets <ndjson>] [--raw-files <json>]
 *
 * --targets is newline-delimited JSON, one target result per line. A result may
 * include `stderr_log` (path to the collector's captured stderr); warning lines
 * are extracted from it and the path itself is not written to the output.
 */
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { buildQueryStatus, extractWarnings } from '../shared/core/query-status.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(`Unexpected argument: ${argv[i]}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function readJson(path, fallback) {
  if (!path || !existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

function readTargets(path) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      const { stderr_log, ...t } = JSON.parse(l);
      if (stderr_log && existsSync(stderr_log)) {
        t.warnings = extractWarnings(readFileSync(stderr_log, 'utf-8'));
      }
      return t;
    });
}

const args = parseArgs(process.argv.slice(2));
if (!args.out || !args.mode) {
  console.error('Usage: write-query-status.js --out <file> --mode <mode> --run-started <ts> [--profile p] [--targets f] [--raw-files f]');
  process.exit(1);
}

const status = buildQueryStatus({
  previous: readJson(args.out, null),
  mode: args.mode,
  runStarted: args['run-started'],
  updatedAt: new Date().toISOString(),
  profile: args.profile || null,
  targets: readTargets(args.targets),
  rawFiles: readJson(args['raw-files'], []),
});

const tmp = `${args.out}.tmp`;
writeFileSync(tmp, JSON.stringify(status, null, 2) + '\n');
renameSync(tmp, args.out);

const counts = status.targets.reduce((acc, t) => ((acc[t.status] = (acc[t.status] || 0) + 1), acc), {});
const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'no targets';
const warned = status.targets.filter(t => t.warnings.length).length;
console.log(`  ✔ query-status.json (${status.last_invocation}: ${summary}${warned ? `, ${warned} with warnings` : ''})`);
