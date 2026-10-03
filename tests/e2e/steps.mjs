// Dev probe: run a JSON list of steps against the dev server, taking screenshots.
// usage: node tests/e2e/steps.mjs <steps.json>
// step: { "eval": "js", "wait": ms, "shot": "name.png", "key": "Tab", "click": "css selector", "size": "1920x1080" }
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const file = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
const [W, H] = (cfg.size || '1600x900').split('x').map(Number);
const outDir = cfg.out || 'tests/e2e/out';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[qa]')) logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(URL + (cfg.query || ''));
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
for (const st of cfg.steps) {
  if (st.size) {
    const [w, h] = st.size.split('x').map(Number);
    await page.setViewportSize({ width: w, height: h });
  }
  if (st.eval) {
    try {
      const r = await page.evaluate(st.eval);
      if (r !== undefined && r !== null) console.log('eval:', JSON.stringify(r).slice(0, 1500));
    } catch (e) {
      console.log('eval error:', e.message);
    }
  }
  if (st.key) await page.keyboard.press(st.key);
  if (st.click) {
    try {
      await page.click(st.click, { timeout: 3000 });
    } catch (e) {
      console.log('click failed', st.click, e.message.split('\n')[0]);
    }
  }
  if (st.wait) await page.waitForTimeout(st.wait);
  if (st.shot) await page.screenshot({ path: `${outDir}/${st.shot}` });
}
console.log('info:', JSON.stringify(await page.evaluate(() => window.__na13f?.info?.())));
console.log(logs.slice(-40).join('\n'));
await browser.close();
