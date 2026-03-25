#!/usr/bin/env node
/**
 * Universal Dashboard Builder
 * 
 * Bundles modular source files into a single-file HTML dashboard
 * 
 * Usage:
 *   node scripts/build-dashboard.js <dashboard-path>
 *   node scripts/build-dashboard.js BVE-dashboards-for-ai-assisted-coding/dashboard/efficiency
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import dashboardConfig from '../build-config/dashboard-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

// Get dashboard path from command line
const dashboardPath = process.argv[2];
if (!dashboardPath) {
  console.error('❌ Error: Dashboard path required');
  console.error('Usage: node scripts/build-dashboard.js <dashboard-path>');
  process.exit(1);
}

const dashboardDir = resolve(ROOT_DIR, dashboardPath);
console.log(`\n🔨 Building dashboard: ${dashboardPath}\n`);

/**
 * Find dashboard config by path
 */
function getDashboardConfig(path) {
  for (const [key, config] of Object.entries(dashboardConfig.dashboards)) {
    if (path.includes(config.path)) {
      return { key, ...config };
    }
  }
  return null;
}

/**
 * Bundle JavaScript modules
 */
async function bundleJS(entryPoint, outputPath) {
  try {
    const result = await build({
      entryPoints: [entryPoint],
      bundle: true,
      minify: dashboardConfig.common.output.minify,
      format: dashboardConfig.common.output.format,
      globalName: 'Dashboard',
      write: false,
      platform: 'browser',
      target: 'es2020',
      external: dashboardConfig.common.externals,
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    if (result.outputFiles && result.outputFiles.length > 0) {
      return result.outputFiles[0].text;
    }
    throw new Error('No output generated');
  } catch (error) {
    console.error('❌ JavaScript bundling failed:', error.message);
    throw error;
  }
}

/**
 * Bundle CSS (if separate files exist)
 */
function bundleCSS(dashboardDir) {
  // For now, CSS is inline in template
  // Future: support separate CSS files
  return '';
}

/**
 * Generate single-file HTML
 */
function generateHTML(template, bundledJS, bundledCSS, config) {
  let html = template;

  // Inject CDN links
  const cdnScripts = Object.values(dashboardConfig.common.cdnLinks)
    .filter(url => url.includes('.js'))
    .map(url => `<script src="${url}" crossorigin></script>`)
    .join('\n');

  const cdnStyles = Object.values(dashboardConfig.common.cdnLinks)
    .filter(url => url.includes('.css'))
    .map(url => `<link rel="stylesheet" href="${url}">`)
    .join('\n');

  // Replace placeholders
  html = html.replace('<!-- CDN_STYLES -->', cdnStyles);
  html = html.replace('<!-- CDN_SCRIPTS -->', cdnScripts);
  html = html.replace('<!-- BUNDLED_CSS -->', bundledCSS ? `<style>\n${bundledCSS}\n</style>` : '');
  html = html.replace('<!-- BUNDLED_JS -->', `<script>\n${bundledJS}\n</script>`);
  html = html.replace('{{DASHBOARD_NAME}}', config.name);

  return html;
}

/**
 * Main build function
 */
async function buildDashboard() {
  const config = getDashboardConfig(dashboardPath);
  
  if (!config) {
    console.error(`❌ No configuration found for: ${dashboardPath}`);
    console.error('Available dashboards:');
    Object.entries(dashboardConfig.dashboards).forEach(([key, cfg]) => {
      console.error(`  - ${key}: ${cfg.path}`);
    });
    process.exit(1);
  }

  console.log(`📋 Dashboard: ${config.name}`);
  console.log(`📁 Source: ${config.path}`);

  // Check if entry point exists (may not exist yet for new dashboards)
  const entryPath = resolve(dashboardDir, config.entry);
  const templatePath = resolve(dashboardDir, config.template);
  const outputPath = resolve(dashboardDir, config.output);

  // For now, check if we're building from existing monolithic HTML
  const monolithicPath = resolve(dashboardDir, 'index.html');
  
  try {
    // Create dist directory
    mkdirSync(dirname(outputPath), { recursive: true });

    // Check if modular source exists
    try {
      const stats = await import('fs').then(fs => fs.promises.stat(entryPath));
      
      // Build from modular source
      console.log('🔄 Bundling modular source...');
      const bundledJS = await bundleJS(entryPath, outputPath);
      const bundledCSS = bundleCSS(dashboardDir);
      
      console.log('📝 Reading template...');
      const template = readFileSync(templatePath, 'utf8');
      
      console.log('🎨 Generating HTML...');
      const html = generateHTML(template, bundledJS, bundledCSS, config);
      
      console.log('💾 Writing output...');
      writeFileSync(outputPath, html, 'utf8');
      
      console.log(`✅ Built successfully: ${config.output}`);
      console.log(`📊 Size: ${(html.length / 1024).toFixed(1)} KB\n`);
      
    } catch (error) {
      // Modular source doesn't exist yet - copy monolithic version
      console.log('⚠️  Modular source not found, using monolithic HTML');
      console.log('📋 Copying existing index.html to dist/...');
      
      const monolithicHTML = readFileSync(monolithicPath, 'utf8');
      writeFileSync(outputPath, monolithicHTML, 'utf8');
      
      console.log(`✅ Copied successfully: ${config.output}`);
      console.log(`📊 Size: ${(monolithicHTML.length / 1024).toFixed(1)} KB`);
      console.log(`\n💡 Next step: Extract modules to ${config.entry}\n`);
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run build
buildDashboard();
