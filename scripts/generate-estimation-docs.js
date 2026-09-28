#!/usr/bin/env node
/**
 * Regenerates docs/estimation-parameters.md from CONFIG_REGISTRY.
 *
 * Usage:
 *   node scripts/generate-estimation-docs.js          # write the doc
 *   node scripts/generate-estimation-docs.js --check  # exit 1 if the doc is stale
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { renderEstimationParametersDoc } from '../shared/core/config-docs.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DOC_PATH = resolve(ROOT, 'docs/estimation-parameters.md');

const expected = renderEstimationParametersDoc();

if (process.argv.includes('--check')) {
  const actual = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf-8') : '';
  if (actual !== expected) {
    console.error('docs/estimation-parameters.md is out of date. Run: node scripts/generate-estimation-docs.js');
    process.exit(1);
  }
  console.log('docs/estimation-parameters.md is up to date');
} else {
  writeFileSync(DOC_PATH, expected);
  console.log('Wrote docs/estimation-parameters.md');
}
