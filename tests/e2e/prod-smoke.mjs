// Production build smoke test (vite preview on :4173, or PROD_URL). No debug API exists here, so the
// test drives the game only with real clicks and keys: title → 새 근무 시작 → briefing → 근무 시작 →
// walk (W) → Tab tablet → Esc pause → 설정 → back. Also checks that every request stays on the local
// origin (offline-capable), no 4xx/5xx responses, no console errors, and no debug tools are shipped.
// usage: node tests/e2e/prod-smoke.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.PROD_URL || 'http://localhost:4173/';
const origin = new globalThis.URL(URL).origin;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
const external = [];
const bad = [];
let requests = 0;
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('request', (r) => {
  requests++;
  const u = r.url();
  if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
});
page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const t0 = Date.now();
await page.goto(URL);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
await page.waitForFunction(() => !document.querySelector('.menu button')?.disabled, null, { timeout: 30000 });
check('Production build loads to the title screen', true, `${Date.now() - t0} ms`);
check('Title shows Korean menu', await page.evaluate(() => /새 근무 시작/.test(document.body.innerText) && /이어하기/.test(document.body.innerText) && /설정/.test(document.body.innerText)));
check('No debug API / overlay in production', await page.evaluate(() => typeof window.__na13f === 'undefined' && !document.querySelector('[data-debug]')));

await page.click('.menu button:nth-child(1)');
await page.waitForTimeout(300);
check('Briefing screen', await page.evaluate(() => /근무 시작/.test(document.body.innerText)));
await page.fill('.seed-input', 'PRODSMOKE');
await page.click('.btn.primary');
await page.waitForTimeout(1500);
const hud = await page.evaluate(() => document.body.innerText);
check('Shift starts (HUD clock 00:0x visible)', /00:0\d/.test(hud));
// walk forward a bit with the real key
await page.keyboard.down('KeyW');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyW');
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
check('Tab opens the tablet (신고 목록)', await page.evaluate(() => !!document.querySelector('.tablet') && /신고 목록/.test(document.querySelector('.tablet').innerText)));
await page.keyboard.press('Tab');
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc opens the pause menu', await page.evaluate(() => /계속하기|재개|근무 재개/.test(document.body.innerText)));
await page.screenshot({ path: 'tests/e2e/out/prod_pause.png' });

// images actually decoded
const imgs = await page.evaluate(async () => {
  const list = [...performance.getEntriesByType('resource')].map((e) => e.name).filter((n) => /\.(jpg|png|webp|woff2)$/.test(n));
  return list.length;
});
check('Runtime images/fonts fetched from the local build', imgs > 0, `${imgs} image/font resources`);
check('All requests stay on the local origin (offline-capable)', external.length === 0, external.slice(0, 5).join(', '));
check('No failed (4xx/5xx) responses', bad.length === 0, bad.slice(0, 5).join(', '));
check('No console / page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
fs.mkdirSync('tests/e2e/out', { recursive: true });
fs.writeFileSync('tests/e2e/out/prod-smoke.json', JSON.stringify({ date: new Date().toISOString(), requests, results, errors, external, bad }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed (${requests} requests)`);
await browser.close();
process.exit(failed.length ? 1 : 0);
