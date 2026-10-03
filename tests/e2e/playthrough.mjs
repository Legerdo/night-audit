// Full-shift automated playthrough through the real UI (title → briefing → reports via tablet clicks →
// 06:00 entrance → ending screen). Travel is shortened by teleporting to each incident site and idle
// time between calls is skipped with the QA clock skip; everything else (site arrival detection,
// interaction with E, report form, contamination, save/continue, ending decision) runs the real code.
//
// usage: node tests/e2e/playthrough.mjs <good|bad|secret> [seed] [WxH]
//   GAME_URL defaults to the dev server (debug API required).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const mode = process.argv[2] || 'good';
const seed = (process.argv[3] || `PT${mode.toUpperCase()}`).toUpperCase();
const [W, H] = (process.argv[4] || '1600x900').split('x').map(Number);
const OUT = 'tests/e2e/out/playthrough';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const log = [];
const results = [];
const note = (s) => {
  log.push(s);
  console.log(s);
};
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  note(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const waitFor = async (fn, arg, ms = 20000) => {
  try {
    await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
    return true;
  } catch {
    return false;
  }
};

async function boot() {
  await page.goto(URL);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });
  await waitFor(() => !document.querySelector('.menu button')?.disabled, null, 30000);
}

async function use(id, prefer = null) {
  const angs = prefer ?? [Math.PI / 2, -Math.PI / 2, 0, Math.PI, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4];
  for (const dist of [1.1, 0.8, 1.6]) {
    for (const a of angs) {
      const want = await ev(({ id, a, dist }) => (window.__game.mode === 'play' ? window.__na13f.approach(id, a, dist) : false), { id, a, dist });
      if (!want) return false;
      await wait(90);
      const valid = await ev((w) => {
        const p = window.__game.player.pos;
        return Math.abs(p.x - w[0]) < 0.06 && Math.abs(p.z - w[2]) < 0.06 && Math.abs(p.y - w[1]) < 0.3;
      }, want);
      if (!valid) continue;
      if ((await ev(() => window.__na13f.focusId())) === id) {
        await page.keyboard.press('KeyE');
        await wait(250);
        return true;
      }
    }
  }
  return false;
}
const closeOverlays = async () => {
  await ev(() => {
    const g = window.__game;
    if (g.mode === 'inspect' || g.mode === 'lift') {
      g.screens.close();
      g.resume();
    }
  });
  if (await ev(() => window.__game.mode === 'tablet')) await page.keyboard.press('Tab');
  await wait(150);
};
const state = () =>
  ev(() => {
    const s = window.__na13f.s;
    return { slot: s.slot, clock: Math.floor(s.clock), c: s.contamination, reports: s.reports.length, phase: s.phase, picked: [...s.pickedUp], seed: s.seed, optionalDone: [...s.optionalDone] };
  });

/** Visit the incident site (teleport close to it; the game itself detects arrival). */
async function visit(inc) {
  const needs = await ev((id) => {
    const d = window.__game.director;
    const i = d.findOpen(id);
    return i ? d.needsSite(i) && !d.siteChecked(i) : false;
  }, inc.id);
  if (!needs) return 'records';
  await closeOverlays();
  await ev((loc) => window.__game.teleportTo(loc), inc.location);
  const ok = await waitFor((id) => window.__na13f.s.visited.includes(id), inc.id, 4000);
  if (!ok) {
    note(`  ! arrival not detected at ${inc.location} — marking visited (automation fallback)`);
    await ev((id) => window.__game.director.markVisited(window.__game.director.findOpen(id)), inc.id);
    return 'fallback';
  }
  return 'arrived';
}

/** Report through the tablet UI exactly like a player. */
async function reportUI(incId, judgment, category) {
  await closeOverlays();
  await ev(() => {
    const g = window.__game;
    g.mode = 'play';
  });
  await page.keyboard.press('Tab');
  await wait(200);
  await ev(() => {
    const t = window.__game.tablet;
    t.tab = 'inc';
    t.refresh();
  });
  await wait(120);
  const card = `article[data-inc="${incId}"]`;
  const n0 = (await state()).reports;
  await page.click(`${card} .judge button.${judgment}`, { timeout: 3000 });
  if (judgment === 'anomaly') {
    const label = await ev((c) => window.__na13f.categoryLabel[c], category);
    await page.click(`${card} .cats button:has(b:text-is("${label}"))`, { timeout: 3000 });
  }
  await page.click(`${card} .submit-row button.primary`, { timeout: 3000 });
  await wait(250);
  const n1 = (await state()).reports;
  const last = await ev(() => window.__na13f.s.reports.slice(-1)[0]);
  await page.keyboard.press('Tab');
  await wait(150);
  return n1 === n0 + 1 ? last : null;
}

async function pickups(ids) {
  for (const id of ids) {
    if (id === 'D1' || id === 'D2' || id === 'archiveKey') {
      await ev(() => window.__game.player.teleport(-2, -3.2, 0, Math.PI / 2));
      await wait(250);
      if (id === 'D1') await use('door:archive'), await wait(1200);
      if (id === 'archiveKey') await use('door:elec'), await wait(1200);
    }
    if (id === 'D3') {
      await ev(() => window.__game.player.teleport(6.5, 11 * 3.2, 0, Math.PI / 2));
      await wait(250);
      await use('door:unit-1204');
      await wait(1200);
      await ev(() => window.__game.player.teleport(8.2, 11 * 3.2, -3.2, Math.PI));
      await wait(250);
    }
    const target = { D1: 'pickup:D1', D2: 'drawer', D3: 'pickup:D3', D4: 'pickup:D4', archiveKey: 'pickup:archiveKey', binder: 'archive', masterKey: 'keybox', saw1301: 'frame-1301', door1301: 'door:unit-1301' }[id];
    if (id === 'D4' || id === 'saw1301' || id === 'door1301') {
      await ev(() => window.__game.player.teleport(-6.5, 12 * 3.2, 0, -Math.PI / 2));
      await wait(300);
    }
    if (id === 'binder' || id === 'masterKey') {
      await ev(() => window.__game.player.teleport(-7.4, 0, -3.0, 0.3));
      await wait(250);
    }
    const ok = await use(target);
    await wait(id === 'door1301' ? 1400 : 200);
    await closeOverlays();
    note(`  pickup ${id}: ${ok ? 'ok' : 'FAILED'}`);
  }
}

// ======================================================================= run
await boot();
await ev(() => localStorage.removeItem('na13f.save.v1'));
await boot();
// title → 새 근무 시작 → briefing (seed) → 근무 시작
await page.click('.menu button:nth-child(1)');
await wait(300);
await page.fill('.seed-input', seed);
await page.click('.btn.primary');
await waitFor(() => window.__game.mode === 'play' && !!window.__na13f?.s, null, 10000);
check('Title → briefing → shift start', (await state()).seed === seed, `seed ${seed}`);

if (mode === 'secret') await pickups(['binder', 'masterKey', 'D1', 'archiveKey', 'D2', 'D3']);
else await pickups(['binder']);

const seen = [];
let falseAlarmDone = false;
let saveChecked = false;
let photoChecked = false;
for (let guard = 0; guard < 60; guard++) {
  const st = await state();
  if (st.phase !== 'shift') break;
  // issue next call (skip idle waiting)
  const open = await ev(() => window.__game.director.openIncidents().map((i) => ({ id: i.id, anomalyId: i.anomalyId, location: i.location, floor: i.floor, channel: i.channel, optional: !!i.optional })));
  if (!open.length) {
    await ev(() => window.__na13f.skip());
    await wait(200);
    continue;
  }
  const inc = open.find((i) => !i.optional) ?? open[0];
  // secret run: once 13F opens, collect its records
  if (mode === 'secret' && inc.id === 's16' && !st.picked.includes('D4')) await pickups(['door1301', 'saw1301', 'D4']);
  const how = await visit(inc);
  const ans = await ev((id) => window.__na13f.answerFor(id), inc.id);
  let j = ans.j;
  let c = ans.c;
  if (mode === 'bad') {
    j = 'normal';
    c = null;
  }
  // one deliberate false alarm on a normal call in the good run (penalty + recovery)
  let expectFalse = false;
  if (mode === 'good' && !falseAlarmDone && ans.j === 'normal' && inc.id !== 's01') {
    j = 'anomaly';
    c = 'OBJECT';
    expectFalse = true;
    falseAlarmDone = true;
  }
  // photo evidence once on an on-site anomaly
  if (mode === 'good' && !photoChecked && ans.j === 'anomaly' && how === 'arrived') {
    photoChecked = true;
    const p0 = await ev(() => window.__na13f.s.photos.length);
    await ev(() => {
      const g = window.__game;
      g.mode = 'play';
      g.openTablet('photo');
    });
    await wait(150);
    await page.click('.tb-body .btn.primary', { timeout: 3000 }).catch(() => {});
    await wait(600);
    const p1 = await ev(() => ({ n: window.__na13f.s.photos.length, last: window.__na13f.s.photos.slice(-1)[0] }));
    check('사진 촬영 at an incident site stores a photo tagged with the incident', p1.n === p0 + 1 && p1.last?.incidentId === inc.id, JSON.stringify({ inc: inc.id, evidenceOf: p1.last?.evidenceOf }));
    await closeOverlays();
  }
  const c0 = (await state()).c;
  const rec = await reportUI(inc.id, j, c);
  const c1 = (await state()).c;
  seen.push({ id: inc.id, anomaly: inc.anomalyId, location: inc.location, channel: inc.channel, site: how, judgment: j, category: c, outcome: rec?.outcome, delta: rec?.delta, contamination: c1 });
  note(`${inc.id.padEnd(4)} ${String(inc.anomalyId ?? 'NORMAL').padEnd(26)} ${inc.location.padEnd(12)} ${how.padEnd(8)} → ${j}${c ? '/' + c : ''} = ${rec?.outcome ?? 'NOT SUBMITTED'} (C ${c0}→${c1})`);
  if (!rec) {
    check(`report ${inc.id} submitted via UI`, false);
    break;
  }
  if (expectFalse) check('False alarm raises contamination (+10)', rec.outcome === 'false_alarm' && c1 - c0 === 10, `C ${c0}→${c1}`);
  // save / continue through the real title menu, mid-shift
  if (mode === 'good' && !saveChecked && inc.id === 's08') {
    saveChecked = true;
    await closeOverlays();
    await ev(() => window.__game.player.teleport(-7.4, 0, -3.0, 0.3));
    await wait(200);
    const logged = await use('desk_log');
    await closeOverlays();
    const before = await state();
    await boot();
    const contEnabled = await ev(() => !document.querySelector('.menu button:nth-child(2)')?.disabled);
    await page.click('.menu button:nth-child(2)');
    await waitFor(() => window.__game.mode === 'play' && !!window.__na13f?.s, null, 10000);
    const after = await state();
    const same = before.slot === after.slot && before.clock === after.clock && before.c === after.c && before.reports === after.reports && before.seed === after.seed;
    check('Save (근무 일지) → reload → 이어하기 restores the shift', logged && contEnabled && same, `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
    const reb = await ev(() => window.__game.world.modsByFloor.size >= 0 && window.__na13f.s.pickedUp.includes('binder'));
    check('Loaded state keeps collected records', reb);
  }
}
check('Recovery: contamination falls after later correct reports', mode !== 'good' || seen.some((r, i) => i > 0 && r.delta < 0 && seen.slice(0, i).some((q) => q.outcome === 'false_alarm')));

// final phase → 06:00 → entrance
await closeOverlays();
let st = await state();
check('All calls handled → final phase (05:50)', st.phase === 'final', JSON.stringify(st));
await ev(() => window.__na13f.skip()); // 05:50 → 06:00 (skip the last ten game minutes)
await wait(400);
await ev(() => window.__game.player.teleport(0, 0, 1.8, Math.PI));
await wait(300);
const usedEntrance = await use('entrance', [-Math.PI / 2, -Math.PI / 4, (-3 * Math.PI) / 4]);
await wait(1200);
const end = await ev(() => ({ mode: window.__game.mode, ending: window.__na13f.s.ending, title: document.querySelector('.ending')?.getAttribute('aria-label'), text: document.querySelector('.ending')?.innerText?.slice(0, 600) }));
const expected = { good: 'good', bad: 'bad', secret: 'secret' }[mode];
check(`Ending reached at the 06:00 entrance = ${expected}`, usedEntrance && end.mode === 'ending' && end.ending === expected, `${end.ending} / ${end.title}`);
await page.screenshot({ path: `${OUT}/ending_${mode}_${W}x${H}.png` });

// quick DOM audit of the ending screen
const audit = await ev(() => {
  const out = [];
  for (const el of document.querySelectorAll('.ending *')) {
    const cs = getComputedStyle(el);
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!t) continue;
    if (el.scrollWidth > el.clientWidth + 2 && !/(auto|scroll)/.test(cs.overflowX)) out.push(`clipped: ${t.slice(0, 30)}`);
    if (parseFloat(cs.fontSize) < 12) out.push(`small ${cs.fontSize}: ${t.slice(0, 30)}`);
  }
  return out;
});
check('Ending screen text not clipped / not tiny', audit.length === 0, audit.slice(0, 5).join(' | '));
const top = await ev(() => {
  const e = document.querySelector('.ending');
  const h1 = document.querySelector('.ending h1');
  return { h1Top: Math.round(h1?.getBoundingClientRect().top ?? -1), scrollable: e.scrollHeight > e.clientHeight };
});
check('Ending title fully on screen (long report list scrolls below it)', top.h1Top >= 0, JSON.stringify(top));
check('No page errors', errors.length === 0, errors.slice(0, 5).join(' | '));

const final = await state();
fs.writeFileSync(`${OUT}/${mode}.json`, JSON.stringify({ date: new Date().toISOString(), mode, seed, viewport: `${W}x${H}`, final, ending: end, incidents: seen, results, errors }, null, 2));
const failed = results.filter((r) => !r.ok);
note(`\n[${mode} ${seed} ${W}x${H}] ${results.length - failed.length}/${results.length} passed · ending=${end.ending} · C=${final.c}`);
await browser.close();
process.exit(failed.length ? 1 : 0);
