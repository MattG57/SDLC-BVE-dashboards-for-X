#!/usr/bin/env node
/**
 * Build All Dashboards
 * 
 * Builds all configured dashboards in the repository
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import dashboardConfig from '../build-config/dashboard-config.js';

const execAsync = promisify(exec);

async function buildAll() {
  console.log('🚀 Building all dashboards...\n');
  
  const dashboards = Object.entries(dashboardConfig.dashboards);
  let successCount = 0;
  let failCount = 0;

  for (const [key, config] of dashboards) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Building: ${key}`);
    console.log('='.repeat(60));
    
    try {
      const { stdout, stderr } = await execAsync(
        `node scripts/build-dashboard.js ${config.path}`
      );
      
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to build ${key}:`, error.message);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Build Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📦 Total: ${dashboards.length}`);
  console.log('='.repeat(60) + '\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

buildAll().catch(error => {
  console.error('❌ Build process failed:', error);
  process.exit(1);
});
