// Korean UI layout audit (DOM-based, no screenshots needed): opens every tablet tab, the title,
// settings, pause and briefing screens at several resolutions and reports
//  - text that is clipped horizontally (scrollWidth > clientWidth on non-scrolling elements)
//  - elements that overflow the viewport
//  - visible Latin-only words that look like placeholder English
//  - computed font sizes below 12px on player-facing text
// usage: node tests/e2e/ui-audit.mjs   (dev server on :5173, or GAME_URL)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const SIZES = [
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
];
const TABS = ['inc', 'ref', 'map', 'dir', 'cctv', 'log', 'ic', 'photo', 'arch'];
// Latin tokens that are legitimate in the Korean UI (codes, units, channel ids, key names).
// NIGHT/AUDIT: the English subtitle of the logo; B/CW: tier tag and employee code; UIAUDIT: this run's seed.
const ALLOWED = /^(NIGHT|AUDIT|B|CW|UIAUDIT|CCTV|CH\d+|REC|B1|\d+F|F\d*|E|Tab|Esc|WASD|W|A|S|D|FOV|CW-\d+|EPS|TPS|A\d|D\d|FPS|UI|OK|LED|PC|ID|Shift|Space|Ctrl|Mouse|SSIM|\d+(px|%)?)$/;

const audit = (allowedSrc) => {
  const ALLOWED = new RegExp(allowedSrc);
  const out = { clipped: [], offscreen: [], english: [], small: [] };
  const vw = innerWidth;
  const vh = innerHeight;
  const root = document.getElementById('ui');
  const els = root.querySelectorAll('*');
  for (const el of els) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (el.closest('.hidden,[data-debug]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    const scrolls = /(auto|scroll)/.test(cs.overflowX + cs.overflowY);
    if (ownText && !scrolls && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && el.clientWidth > 0) {
      out.clipped.push({ tag: el.tagName, cls: el.className, text: ownText.slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth });
    }
    if (ownText && (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1) && !el.closest('[style*="overflow"],.tab-body,.scroll')) {
      // only report if no scrolling ancestor clips it
      let p = el.parentElement;
      let clippedByScroll = false;
      while (p && p !== root) {
        const pcs = getComputedStyle(p);
        if (/(auto|scroll|hidden)/.test(pcs.overflowY + pcs.overflowX)) {
          clippedByScroll = true;
          break;
        }
        p = p.parentElement;
      }
      if (!clippedByScroll) out.offscreen.push({ tag: el.tagName, cls: el.className, text: ownText.slice(0, 40), r: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0] });
    }
    if (ownText) {
      for (const w of ownText.split(/[\s·,()\[\]/:~→←+\-—|.]+/)) {
        if (/^[A-Za-z][A-Za-z0-9]*$/.test(w) && !ALLOWED.test(w)) out.english.push(w);
      }
      const fs = parseFloat(cs.fontSize);
      if (fs < 12) out.small.push({ cls: el.className, text: ownText.slice(0, 30), fs });
    }
  }
  out.english = [...new Set(out.english)];
  return out;
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
const errors = [];
for (const [W, H] of SIZES) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(`${W}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${W}: ${m.text()}`));
  await page.goto(URL);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
  results.push({ size: `${W}x${H}`, screen: 'title', ...(await page.evaluate(audit, ALLOWED.source)) });
  // settings screen from the title
  const settingsBtn = await page.$('.menu button:nth-child(3)');
  if (settingsBtn) {
    await settingsBtn.click();
    await page.waitForTimeout(250);
    results.push({ size: `${W}x${H}`, screen: 'settings', ...(await page.evaluate(audit, ALLOWED.source)) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => {
    window.__game.screens.close();
    window.__game.startNew('UIAUDIT');
    const s = window.__na13f.s;
    s.pickedUp.push('binder');
    window.__na13f.skip();
  });
  await page.waitForTimeout(400);
  for (const t of TABS) {
    await page.evaluate((t) => {
      const g = window.__game;
      if (g.mode === 'tablet') g.close();
      g.mode = 'play';
      g.openTablet(t);
    }, t);
    await page.waitForTimeout(250);
    results.push({ size: `${W}x${H}`, screen: `tablet:${t}`, ...(await page.evaluate(audit, ALLOWED.source)) });
  }
  // report form for the current incident
  await page.evaluate(() => {
    const g = window.__game;
    if (g.mode === 'tablet') g.close();
    g.mode = 'play';
    g.openTablet('inc');
  });
  const rep = await page.$('.tablet button.primary, .tablet .btn.primary');
  if (rep) {
    await rep.click().catch(() => {});
    await page.waitForTimeout(250);
    results.push({ size: `${W}x${H}`, screen: 'tablet:report', ...(await page.evaluate(audit, ALLOWED.source)) });
  }
  await page.evaluate(() => {
    const g = window.__game;
    if (g.mode === 'tablet') g.close();
    g.mode = 'play';
    g.pause();
  });
  await page.waitForTimeout(250);
  results.push({ size: `${W}x${H}`, screen: 'pause', ...(await page.evaluate(audit, ALLOWED.source)) });
  await page.close();
}
await browser.close();
const bad = results.filter((r) => r.clipped.length || r.offscreen.length || r.english.length || r.small.length);
fs.mkdirSync('tests/e2e/out', { recursive: true });
fs.writeFileSync('tests/e2e/out/ui-audit.json', JSON.stringify({ results, errors }, null, 2));
console.log(JSON.stringify({ screens: results.length, withIssues: bad.map((r) => ({ size: r.size, screen: r.screen, clipped: r.clipped.slice(0, 4), offscreen: r.offscreen.slice(0, 4), english: r.english, small: r.small.slice(0, 4) })), errors }, null, 1));
process.exit(bad.length || errors.length ? 1 : 0);
