#!/usr/bin/env node
/**
 * Dashboard Structure Validator
 * 
 * Validates that all dashboards follow the required structure
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dashboardConfig from '../build-config/dashboard-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

function validateDashboard(key, config) {
  console.log(`\n📋 Validating: ${key}`);
  const dashboardDir = resolve(ROOT_DIR, config.path);
  const issues = [];
  const warnings = [];

  // Check required directories
  for (const dir of dashboardConfig.validation.requiredFiles.filter(f => f.endsWith('/'))) {
    const dirPath = join(dashboardDir, dir);
    if (!existsSync(dirPath)) {
      issues.push(`Missing directory: ${dir}`);
    }
  }

  // Check required files
  for (const file of dashboardConfig.validation.requiredFiles.filter(f => !f.endsWith('/'))) {
    const filePath = join(dashboardDir, file);
    if (!existsSync(filePath)) {
      issues.push(`Missing file: ${file}`);
    }
  }

  // Check package.json scripts
  const pkgPath = join(dashboardDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      for (const script of dashboardConfig.validation.requiredScripts) {
        if (!pkg.scripts || !pkg.scripts[script]) {
          warnings.push(`Missing npm script: ${script}`);
        }
      }
    } catch (error) {
      issues.push(`Invalid package.json: ${error.message}`);
    }
  }

  // Check if modular source exists
  if (config.modules && config.modules.length > 0) {
    for (const module of config.modules) {
      const modulePath = join(dashboardDir, module);
      if (!existsSync(modulePath)) {
        warnings.push(`Module not yet extracted: ${module}`);
      }
    }
  }

  // Check if tests exist
  const testsDir = join(dashboardDir, 'tests');
  if (existsSync(testsDir)) {
    try {
      const hasTests = readdirSync(testsDir, { recursive: true })
        .some(file => file.endsWith('.test.js'));
      if (!hasTests) {
        warnings.push('No test files found in tests/');
      }
    } catch (error) {
      warnings.push(`Could not scan tests/: ${error.message}`);
    }
  }

  return { issues, warnings };
}

async function validateAll() {
  console.log('🔍 Validating dashboard structure...\n');
  console.log('='.repeat(60));

  let totalIssues = 0;
  let totalWarnings = 0;

  for (const [key, config] of Object.entries(dashboardConfig.dashboards)) {
    const { issues, warnings } = validateDashboard(key, config);

    if (issues.length > 0) {
      console.log('  ❌ Issues:');
      issues.forEach(issue => console.log(`     - ${issue}`));
      totalIssues += issues.length;
    }

    if (warnings.length > 0) {
      console.log('  ⚠️  Warnings:');
      warnings.forEach(warning => console.log(`     - ${warning}`));
      totalWarnings += warnings.length;
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log('  ✅ All checks passed');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Validation Summary');
  console.log('='.repeat(60));
  console.log(`❌ Issues: ${totalIssues}`);
  console.log(`⚠️  Warnings: ${totalWarnings}`);
  console.log('='.repeat(60) + '\n');

  if (totalIssues > 0) {
    console.error('⛔ Validation failed - fix issues before proceeding');
    process.exit(1);
  }

  if (totalWarnings > 0) {
    console.log('💡 Warnings found - consider addressing them\n');
  } else {
    console.log('✅ All dashboards validated successfully\n');
  }
}

validateAll().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
