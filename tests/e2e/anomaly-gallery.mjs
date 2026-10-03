// Visual QA: force every anomaly in turn, frame it from a fixed viewpoint (or the tablet view that
// reveals it) and save one screenshot per anomaly to tests/e2e/out/gallery/. Requires the dev server.
// usage: node tests/e2e/anomaly-gallery.mjs [id,id,...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const OUT = 'tests/e2e/out/gallery';
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null;

// viewpoint: [px, py, pz, tx, ty, tz] relative to the floor, or { tablet, ...opts }
const E = [11.3, 1.6, 0.25, -12, 1.25, -0.05];
const V = {
  obj_chair_center: E,
  obj_parcel_tower: [4.0, 1.6, 0.7, 9, 1.3, -1.1],
  obj_shoes_row: [-4, 1.5, -0.6, -11, 0.3, 1.1],
  geo_extra_door: [-2, 1.6, 0.7, -9, 1.2, -1.1],
  geo_missing_door: [-1, 1.6, -0.6, -6.5, 1.2, 1.1],
  hum_window_figure: E,
  obj_extinguisher_moved: [-3, 1.6, 0.2, -9, 0.6, 0.3],
  geo_corridor_extended: E,
  geo_window_walled: E,
  sys_numbers_swapped: [0.5, 1.6, 0.6, -5.5, 1.5, -1.1],
  obj_exit_sign_reversed: [0.2, 1.4, -0.7, -3.5, 0.9, 1.1],
  hum_door_ajar_watch: [2, 1.6, -0.5, -5, 1.2, 1.1],
  obj_prop_missing: E,
  sys_elevator_display: [0.2, 1.6, 0.85, -0.1, 1.9, -3.6],
  geo_ceiling_low: E,
  hum_cctv_only_figure: { tablet: 'cctv' },
  tmp_cctv_delay: { tablet: 'cctv' },
  tmp_cctv_timestamp: { tablet: 'cctv' },
  sys_directory_extra_unit: { tablet: 'dir' },
  meta_ref_corridor: { tablet: 'ref' },
  meta_map_corridor: { tablet: 'map' },
  img_family_extra_person: [2.8, 1.52, 0.55, 2.8, 1.52, -1.1],
  img_ceremony_gaze: [-3.1, 1.52, 0.55, -3.1, 1.52, -1.1],
  meta_ref_gallery: { tablet: 'ref' },
  img_ceremony_both: { tablet: 'ref' },
  obj_vending_duplicate: [0.2, 1.6, -0.6, 0.4, 1.1, 3.6],
  img_missing_poster_empty: [6.4, 1.6, -0.75, 6.4, 1.58, 1.1],
  tmp_lobby_clock_backward: [-1.4, 1.7, 2.2, -3.97, 2.15, 2.2],
  sys_lobby_board_13: [3.4, 1.55, 0.95, 3.4, 1.5, -1.1],
  tmp_log_future_entry: { tablet: 'log', sub: 'maint' },
  sys_personnel_two: { tablet: 'log', sub: 'staff' },
  sys_identity_record: { tablet: 'log', sub: 'staff' },
  hum_mirror_figure: [0.3, 1.6, -3.75, 0.0, 1.4, -5.6],
  img_elevator_ad_figure: [0.45, 1.5, -4.6, -1.0, 1.45, -4.6],
  sys_elevator_log_13: { tablet: 'log', sub: 'lift' },
  sys_stair_sign: [13.0, 1.6, 0.9, 13.0, 1.7, -2.5],
  sys_delivery_vacant: [10.2, 1.6, -1.6, 8.3, 0.9, -2.6],
  obj_lockers_open: [7.2, 1.6, -1.6, 9.4, 1.0, -5.6],
  obj_breaker_13: [-6.0, 1.45, -4.6, -6.0, 1.3, -6.6],
  geo_extra_shop: [8, 1.6, -0.3, -6, 1.3, 1.1],
  obj_shutter_open: [-2, 1.6, -0.5, -7, 1.2, 1.1],
  hum_resident_smile: { tablet: 'dir' },
  geo_floor_13: [11, 1.6, 0.2, -12, 1.25, 0],
  sys_cctv_13: { tablet: 'cctv', ch: 'corr-13' },
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
await page.evaluate(() => {
  window.__game.startNew('GALLERY');
  window.__na13f.s.pickedUp.push('binder');
});
await page.waitForTimeout(500);
const ids = only ?? (await page.evaluate(() => window.__na13f.anomalies));
const report = [];
for (const id of ids) {
  const v = V[id];
  if (!v) {
    report.push({ id, skipped: 'no viewpoint (audio/runtime-only)' });
    continue;
  }
  const r = await page.evaluate(
    ({ id, v }) => {
      const g = window.__game;
      const api = window.__na13f;
      if (g.mode === 'tablet') g.close();
      g.screens.close();
      if (id === 'geo_floor_13' || id === 'sys_cctv_13') {
        api.s.flags.f13Open = true;
        api.s.flags.ch13 = true;
      }
      const inc = api.force(id);
      g.hud.show(false);
      const floor = inc.location === 'elevator' ? 1 : inc.floor;
      if (Array.isArray(v)) {
        const y0 = (floor - 1) * 3.2;
        const [px, py, pz, tx, ty, tz] = v;
        const dx = tx - px, dy = ty - py, dz = tz - pz;
        const yaw = Math.atan2(-dx, -dz);
        const pitch = Math.atan2(dy, Math.hypot(dx, dz));
        if (inc.location === 'elevator') g.elevator.place(1);
        g.player.teleport(px, y0 + py - 1.62, pz, yaw, pitch);
      } else {
        g.player.teleport(-7.4, 0, -3, 0.3);
        g.mode = 'play';
        g.openTablet(v.tablet);
        const t = g.tablet;
        if (v.tablet === 'dir') t.dirFloor = floor;
        if (v.tablet === 'map') t.mapFloor = floor;
        if (v.tablet === 'ref') t.refLoc = inc.location;
        if (v.tablet === 'log') t.logSub = v.sub;
        if (v.tablet === 'cctv') t.cctvSel = v.ch ?? (inc.location === 'elevator' ? 'car' : `corr-${floor}`);
        t.refresh();
      }
      return { floor, location: inc.location };
    },
    { id, v },
  );
  // for the delayed-CCTV check, walk the player through the corridor so the delay is visible
  if (id === 'tmp_cctv_delay') {
    await page.evaluate(() => {
      const g = window.__game;
      const f = g.director.current().floor;
      g.player.teleport(4, (f - 1) * 3.2, 0, Math.PI / 2);
    });
  }
  await page.waitForTimeout(Array.isArray(v) ? 700 : 1200);
  await page.screenshot({ path: `${OUT}/${id}.png` });
  report.push({ id, ...r });
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ report, errors }, null, 2));
console.log(JSON.stringify({ shots: report.filter((r) => !r.skipped).length, skipped: report.filter((r) => r.skipped).map((r) => r.id), errors }, null, 1));
await browser.close();
