// Geometric z-fighting scan: every floor in its baseline state, then with each physical anomaly forced.
// Reports coplanar (≤1.5 mm apart), same-facing, overlapping triangles. Requires the dev server.
// usage: node tests/e2e/zfight-scan.mjs [--anomalies]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const withAnoms = process.argv.includes('--anomalies');
const TOL = Number((process.argv.find((a) => a.startsWith('--tol=')) ?? '--tol=0.0015').slice(6));

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto(URL);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
await page.evaluate(() => {
  window.__game.screens.close();
  window.__game.startNew('ZSCAN');
  const s = window.__na13f.s;
  s.flags.f13Open = true;
  s.pickedUp.push('binder');
  window.__game.rebuild([13]);
});
await page.waitForTimeout(400);

const all = [];
const scan = async (label, floors) => {
  const r = await page.evaluate(({ f, t }) => window.__na13f.zfight(f, t), { f: floors, t: TOL });
  for (const i of r.issues) all.push({ where: label, ...i });
  return r;
};
const floors = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, -1];
for (const f of floors) {
  const r = await scan(`base:${f}`, [f]);
  console.log(`base floor ${f}: ${r.triangles} tris, ${r.issues.length} overlaps`);
}
// the moving car against the building: parked at a floor, and mid-travel between floors
for (const lvl of [0, 1, 1.5, 3, 3.37, 5, 7.5, 12, 12.5, 13]) {
  await page.evaluate((l) => window.__game.elevator.place(l), lvl);
  await page.waitForTimeout(50);
  const fl = [Math.floor(lvl), Math.ceil(lvl)].filter((v, i, a) => a.indexOf(v) === i);
  const r = await scan(`car@${lvl}`, [...fl, -1]);
  console.log(`car at level ${lvl} + floors ${fl.join(',')}: ${r.issues.length} overlaps`);
}
// see-through test: car travelling past / parked away from a floor must be invisible from its hall
let leakTotal = 0;
for (const [floor, level] of [[3, 3.5], [3, 2.5], [3, 3.2], [3, 2.8], [5, 5.1], [5, 4.9], [1, 1.5], [12, 11.5], [7, 7.97], [7, 7.03]]) {
  const r = await page.evaluate(({ floor, level }) => window.__na13f.carLeak(floor, level), { floor, level });
  leakTotal += r.leaks;
  console.log(`leak test: hall ${floor}F, car at level ${level}: ${r.leaks}/${r.rays} rays hit the car ${r.samples.length ? JSON.stringify(r.samples) : ''}`);
}
await page.evaluate(() => window.__game.elevator.place(1));
if (withAnoms) {
  const ids = await page.evaluate(() => window.__na13f.anomalies);
  for (const id of ids) {
    const inc = await page.evaluate((id) => {
      const i = window.__na13f.force(id);
      return i ? { floor: i.location === 'elevator' ? -1 : i.floor } : null;
    }, id);
    if (!inc) continue;
    const r = await scan(`${id}:${inc.floor}`, [inc.floor]);
    if (r.issues.length) console.log(`${id} @${inc.floor}: ${r.issues.length} overlaps`);
  }
}
// collapse identical material pairs across floors
const groups = new Map();
for (const i of all) {
  const k = `${i.a} ⟷ ${i.b} | n=${i.n.join(',')}`;
  const g = groups.get(k) ?? { a: i.a, b: i.b, n: i.n, gap: i.gap, count: 0, area: 0, examples: [] };
  g.count++;
  g.area += i.area;
  if (g.examples.length < 3) g.examples.push(`${i.where} ${i.at.join(',')}`);
  groups.set(k, g);
}
const out = [...groups.values()].sort((x, y) => y.area - x.area);
fs.mkdirSync('tests/e2e/out', { recursive: true });
fs.writeFileSync('tests/e2e/out/zfight.json', JSON.stringify(out, null, 2));
console.log(`\n${all.length} overlaps in ${out.length} groups`);
for (const g of out.slice(0, 60)) console.log(`${g.area.toFixed(3)}m² x${g.count} gap=${g.gap} n=${g.n.join(',')}\n   ${g.a}\n   ${g.b}\n   e.g. ${g.examples.join(' | ')}`);
await browser.close();
process.exit(out.length ? 1 : 0);
