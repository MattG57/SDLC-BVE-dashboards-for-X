#!/usr/bin/env node
/**
 * scripts/browse.js — Open a dashboard in Playwright for interactive testing
 *
 * Usage:
 *   npm run browse                                          # opens landing page
 *   npm run browse -- http://127.0.0.1:8080/v3/ai-assisted-efficiency/
 *   npm run browse -- /v3/ai-assisted-efficiency/           # auto-prepends localhost
 *   npm run browse -- /v3/ai-assisted-efficiency/ --click "Lines of Code"
 *   npm run browse -- /v3/ai-assisted-efficiency/ --screenshot shot.png
 *
 * Options:
 *   --click "text"      Click an element matching this text after page loads
 *   --screenshot file   Save screenshot after load (and after click if specified)
 *   --wait ms           Wait this many ms after load before screenshot (default: 3000)
 *   --headed            Show the browser window (default: headless)
 *   --width N           Viewport width (default: 1600)
 *   --height N          Viewport height (default: 1200)
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);

function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx === -1) return defaultVal;
  return args[idx + 1];
}
function hasFlag(flag) { return args.includes(flag); }

const BASE = 'http://127.0.0.1:8080';
let url = args.find(a => !a.startsWith('--')) || '/';
if (url.startsWith('/')) url = BASE + url;

const clickText = getArg('--click', null);
const screenshotFile = getArg('--screenshot', null);
const waitMs = parseInt(getArg('--wait', '3000'));
const headed = hasFlag('--headed');
const width = parseInt(getArg('--width', '1600'));
const height = parseInt(getArg('--height', '1200'));

async function main() {
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({ viewport: { width, height } });

  console.log(`🌐 Opening: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(waitMs);

  if (clickText) {
    console.log(`🖱️  Clicking: "${clickText}"`);
    await page.click(`text=${clickText}`);
    await page.waitForTimeout(1000);
  }

  if (screenshotFile) {
    await page.screenshot({ path: screenshotFile, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotFile}`);
  }

  if (headed) {
    console.log('Browser is open. Press Ctrl+C to close.');
    await new Promise(() => {}); // keep alive
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
