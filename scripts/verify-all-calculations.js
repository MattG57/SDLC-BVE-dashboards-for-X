#!/usr/bin/env node
/**
 * Verify All Calculations
 * 
 * Runs verify_math.cjs for all dashboards that have verification scripts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

const verificationScripts = [
  {
    name: 'AI Assisted Coding',
    path: 'BVE-dashboards-for-ai-assisted-coding/data/verify_math.cjs',
    dataPath: 'BVE-dashboards-for-ai-assisted-coding/data/examples/ai-assisted-coding-example.json'
  }
  // Add more as dashboards are migrated
];

async function verifyCalculations() {
  console.log('🔬 Verifying calculations across all dashboards...\n');
  console.log('='.repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (const script of verificationScripts) {
    const scriptPath = resolve(ROOT_DIR, script.path);
    const dataPath = resolve(ROOT_DIR, script.dataPath);

    console.log(`\n📊 ${script.name}`);
    console.log('-'.repeat(60));

    if (!existsSync(scriptPath)) {
      console.log('  ⚠️  Verification script not found - skipping');
      continue;
    }

    if (!existsSync(dataPath)) {
      console.log('  ⚠️  Example data not found - skipping');
      continue;
    }

    try {
      const { stdout, stderr } = await execAsync(
        `node ${scriptPath}`,
        { cwd: dirname(scriptPath) }
      );

      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.error(stderr);
      }

      console.log('  ✅ Verification passed');
      successCount++;

    } catch (error) {
      console.error('  ❌ Verification failed:', error.message);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Verification Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total: ${verificationScripts.length}`);
  console.log('='.repeat(60) + '\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

verifyCalculations().catch(error => {
  console.error('❌ Verification process failed:', error);
  process.exit(1);
});
