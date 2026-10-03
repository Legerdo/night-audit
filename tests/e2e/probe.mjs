// Ad-hoc probe used during development: opens the dev server, starts a shift, runs a JS snippet and
// saves a screenshot. usage: node tests/e2e/probe.mjs <out.png> [js-to-eval-after-start] [waitMs]
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const [out = 'tests/e2e/out/probe.png', snippet = '', waitMs = '1500', size = '1600x900'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(URL);
try {
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
} catch (e) {
  console.log('NOT READY', e.message);
  await page.screenshot({ path: out });
  console.log(logs.join('\n'));
  await browser.close();
  process.exit(1);
}
if (snippet !== 'title') {
  await page.evaluate(() => window.__game.startNew('PROBE1'));
  await page.waitForTimeout(800);
  if (snippet && snippet !== 'none') {
    const r = await page.evaluate(snippet);
    if (r !== undefined) console.log('eval:', JSON.stringify(r)?.slice(0, 2000));
  }
}
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out });
const info = await page.evaluate(() => window.__na13f?.info?.());
console.log('info:', JSON.stringify(info));
console.log(logs.slice(-40).join('\n'));
await browser.close();
