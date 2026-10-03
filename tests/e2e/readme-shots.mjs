// Captures the curated screenshots used by README.md into docs/screenshots/ (1600x900 PNG → JPEG via Python).
// Requires the dev server (debug API). usage: node tests/e2e/readme-shots.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const OUT = 'tests/e2e/out/readme';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
await page.waitForFunction(() => !document.querySelector('.menu button')?.disabled, null, { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

// camera helper: eye position + look target (world units relative to floor n)
const look = (n, px, py, pz, tx, ty, tz) =>
  ev(
    ({ n, px, py, pz, tx, ty, tz }) => {
      const g = window.__game;
      const y0 = (n - 1) * 3.2;
      const dx = tx - px, dy = ty - py, dz = tz - pz;
      g.player.teleport(px, y0 + py - 1.62, pz, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    },
    { n, px, py, pz, tx, ty, tz },
  );
const tablet = (tab, extra) =>
  ev(
    ({ tab, extra }) => {
      const g = window.__game;
      if (g.mode === 'tablet') g.close();
      g.mode = 'play';
      g.openTablet(tab);
      Object.assign(g.tablet, extra ?? {});
      g.tablet.refresh();
    },
    { tab, extra },
  );
const closeAll = () =>
  ev(() => {
    const g = window.__game;
    if (g.mode === 'tablet') g.close();
    g.screens.close();
    g.mode = 'play';
  });

await wait(800);
await shot('01_title');

await ev(() => {
  window.__game.screens.close();
  window.__game.startNew('README');
  window.__na13f.s.pickedUp.push('binder');
});
await wait(600);
// control room with CCTV monitors
await look(1, -6.2, 1.62, -2.3, -8.6, 1.2, -6.0);
await wait(3500);
await shot('02_control_room');
// residential corridor
await ev(() => window.__game.hud.show(true));
await look(3, 10.8, 1.62, 0.3, -12, 1.3, -0.1);
await wait(900);
await shot('03_corridor');
// 5F gallery family photo (anomaly forced)
await ev(() => window.__na13f.force('img_family_extra_person'));
await look(5, 2.8, 1.55, 0.35, 2.8, 1.5, -1.1);
await wait(900);
await shot('04_gallery_photo');
// tablet: report form on the current incident
await ev(() => window.__na13f.visit());
await tablet('inc');
await page.click('.inc.current .judge button.anomaly').catch(() => {});
await wait(150);
await page.click('.inc.current .cats button:nth-child(3)').catch(() => {});
await wait(300);
await shot('05_tablet_report');
// tablet: CCTV with the CCTV-only figure
await closeAll();
const f = await ev(() => window.__na13f.force('hum_cctv_only_figure').floor);
await look(1, -7.4, 1.62, -3, -7.4, 1.5, -6);
await tablet('cctv', { cctvSel: `corr-${f}` });
await wait(1500);
await shot('06_tablet_cctv');
// tablet: reference photos (Tier B) with the Tier A originals
await closeAll();
const r = await ev(() => window.__na13f.force('meta_ref_corridor'));
await tablet('ref', { refLoc: r.location });
await wait(1500);
await shot('07_tablet_reference');
// elevator car with the mirror
await closeAll();
await ev(() => {
  window.__na13f.force('hum_mirror_figure');
  window.__game.elevator.place(1);
});
await look(1, 0.35, 1.6, -3.75, 0.0, 1.4, -5.6);
await wait(1500);
await shot('08_elevator_mirror');
// 13F
await ev(() => {
  const s = window.__na13f.s;
  s.flags.f13Open = true;
  window.__game.rebuild([13]);
});
await look(13, 10.5, 1.62, 0.2, -12, 1.25, 0);
await wait(1500);
await shot('09_floor13');
// ending screen (good)
await closeAll();
await ev(() => window.__na13f.finishNow());
await wait(300);
await ev(() => window.__game.finish());
await wait(4500);
await shot('10_ending');

console.log(JSON.stringify({ errors }));
await browser.close();
