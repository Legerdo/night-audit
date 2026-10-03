// Functional checks of interaction, elevator travel, discoverable records, 1301/13F and the runtime
// (audio / behaviour) anomalies. Uses real keyboard input (E) and DOM clicks where the player would;
// teleports only to save walking time. Requires the dev server (debug API).
// usage: node tests/e2e/functional.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const FH = 3.2;
const fy = (n) => (n - 1) * FH;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const waitFor = async (fn, arg, ms = 30000) => {
  try {
    await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
    return true;
  } catch {
    return false;
  }
};

/** Walk up to an interactable (teleport), confirm the crosshair focuses it, press E. */
async function use(id, prefer = null) {
  const angs = prefer ?? [Math.PI / 2, -Math.PI / 2, 0, Math.PI, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4];
  for (const dist of [1.1, 0.8, 1.6]) {
    for (const a of angs) {
      const ok = await ev(({ id, a, dist }) => {
        const g = window.__game;
        if (g.mode !== 'play') return false;
        return window.__na13f.approach(id, a, dist);
      }, { id, a, dist });
      if (!ok) return false;
      await wait(90);
      // reject spots the player could not actually stand on (inside walls / over the shaft)
      const valid = await ev((want) => {
        const p = window.__game.player.pos;
        return Math.abs(p.x - want[0]) < 0.06 && Math.abs(p.z - want[2]) < 0.06 && Math.abs(p.y - want[1]) < 0.3;
      }, ok);
      if (!valid) continue;
      const f = await ev(() => window.__na13f.focusId());
      if (f === id) {
        await page.keyboard.press('KeyE');
        await wait(200);
        return true;
      }
    }
  }
  return false;
}
const closeOverlays = () =>
  ev(() => {
    const g = window.__game;
    if (g.mode === 'inspect' || g.mode === 'lift') {
      g.screens.close();
      g.resume();
    }
    if (g.mode === 'tablet') g.close();
  });

// ---------------------------------------------------------------- start
await ev(() => {
  localStorage.removeItem('na13f.save.v1');
  window.__game.screens.close();
  window.__game.startNew('FUNC1');
  // count positional footsteps (follow-steps anomaly) and stings
  const a = window.__na13f.audio;
  const orig = a.footstep.bind(a);
  window.__posSteps = 0;
  a.footstep = (s, p, g) => {
    if (p) window.__posSteps++;
    return orig(s, p, g);
  };
});
await wait(600);

// ---------------------------------------------------------------- control room interactions
check('E: 원본 기록철 수령 (archive cabinet)', (await use('archive')) && (await ev(() => window.__na13f.s.pickedUp.includes('binder'))));
await closeOverlays();
check('E: 마스터키 (key box)', (await use('keybox')) && (await ev(() => window.__na13f.s.pickedUp.includes('masterKey'))));
await closeOverlays();
await ev(() => localStorage.removeItem('na13f.save.v1'));
check('E: 근무 일지 → checkpoint save', (await use('desk_log')) && (await ev(() => !!localStorage.getItem('na13f.save.v1'))));
await closeOverlays();
check('E: CCTV monitors open tablet CCTV', (await use('monitors')) && (await ev(() => window.__game.mode === 'tablet' && window.__game.tablet.tab === 'cctv')));
await closeOverlays();
check('E: 택배함 inspect', (await use('locker')) && (await ev(() => window.__game.mode === 'inspect')));
await closeOverlays();
check('E: 출입문 locked during shift', (await use('entrance')) && (await ev(() => window.__game.director.s.phase === 'shift')));
await closeOverlays();

// ---------------------------------------------------------------- elevator: hall call, ride, panel
{
  await ev(() => window.__game.elevator.place(3));
  const called = await use('call-1');
  const arrived = await waitFor(() => window.__game.elevator.floor === 1 && !window.__game.elevator.moving, null, 30000);
  check('Elevator: hall call brings car from 3F to 1F', called && arrived);
  await ev(() => window.__game.player.teleport(0, 0, -4.6, 0));
  await wait(300);
  const panel = await use('car-panel', [Math.PI, (3 * Math.PI) / 4, (-3 * Math.PI) / 4]);
  const liftOpen = await ev(() => window.__game.mode === 'lift');
  let clicked = false;
  if (liftOpen) {
    await page.click('.lift .grid button[aria-label="12층"]', { timeout: 3000 }).then(() => (clicked = true)).catch(() => {});
  }
  const t0 = Date.now();
  const at12 = await waitFor(() => window.__game.elevator.floor === 12 && !window.__game.elevator.moving && Math.abs(window.__game.player.pos.y - 11 * 3.2) < 0.15, null, 60000);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const log = await ev(() => window.__na13f.s.elevatorLog.slice(-2));
  check('Elevator: car panel → ride 1F→12F carries the player', panel && liftOpen && clicked && at12, `panel=${panel} lift=${liftOpen} click=${clicked} ${secs}s, log=${JSON.stringify(log)}, el=${JSON.stringify(await ev(() => ({ f: window.__game.elevator.floor, m: window.__game.elevator.moving, y: window.__game.player.pos.y, inCar: window.__game.elevator.contains(window.__game.player.pos) })))}`);
  check('Elevator: trip logged (hall + car)', log.some((l) => l.to === 12 && l.note === '차내 버튼') && log.some((l) => l.to === 1));
}

// ---------------------------------------------------------------- 12F / 1204 / D3
await ev(() => window.__game.player.teleport(6.5, 11 * 3.2, 0, Math.PI / 2));
await wait(300);
check('E: 1204호 opens with the master key', (await use('door:unit-1204')) && (await ev(() => window.__na13f.s.unlockedDoors.includes('unit-1204'))));
await wait(1200);
await ev(() => window.__game.player.teleport(8.2, 11 * 3.2, -3.2, Math.PI));
await wait(300);
check('E: D3 pickup inside 1204', (await use('pickup:D3')) && (await ev(() => window.__na13f.s.pickedUp.includes('D3'))));
await closeOverlays();

// ---------------------------------------------------------------- B1: D1, archive key, D2
await ev(() => window.__game.player.teleport(-2, -3.2, 0, Math.PI / 2));
await wait(400);
check('E: B1 문서고 door', await use('door:archive'));
await wait(1200);
check('E: D1 pickup (문서고)', (await use('pickup:D1')) && (await ev(() => window.__na13f.s.pickedUp.includes('D1'))));
await closeOverlays();
check('E: 서류함 locked without key', (await use('drawer')) && (await ev(() => !window.__na13f.s.pickedUp.includes('D2'))));
await closeOverlays();
await ev(() => window.__game.player.teleport(-2, -3.2, 0, Math.PI / 2));
await wait(200);
check('E: B1 전기실 door', await use('door:elec'));
await wait(1200);
check('E: 서류함 열쇠 pickup (전기실)', (await use('pickup:archiveKey')) && (await ev(() => window.__na13f.s.pickedUp.includes('archiveKey'))));
await closeOverlays();
check('E: D2 from the filing cabinet', (await use('drawer')) && (await ev(() => window.__na13f.s.pickedUp.includes('D2'))));
await closeOverlays();
check('1301 unlocks after D1+D2+D3', await ev(() => window.__na13f.s.unlockedDoors.includes('unit-1301')));
await ev(() => {
  const g = window.__game;
  g.player.teleport(13, -3.2, 0.6, 0);
});
await wait(300);
check('Breaker panel lists 12 circuits normally (no 13층)', (await use('breakers')) && (await ev(() => !document.querySelector('#ui')?.innerText.includes('13층  —'))));
await closeOverlays();

// ---------------------------------------------------------------- 13F via elevator
{
  await ev(() => {
    const g = window.__game;
    g.director.s.flags.f13Open = true;
    g.rebuild([13, 12]);
    g.elevator.place(1);
    g.player.teleport(0, 0, -4.6, 0);
  });
  await wait(300);
  const has13 = await ev(() => window.__game.elevator.stops().includes(13));
  const stings0 = await ev(() => window.__na13f.audio.stingCount);
  await ev(() => window.__game.elevator.call(13, 'car'));
  const at13 = await waitFor(() => window.__game.elevator.floor === 13 && !window.__game.elevator.moving, null, 70000);
  await wait(1500);
  await ev(() => window.__game.player.teleport(0, 12 * 3.2, -2.2, Math.PI));
  await ev(() => window.__game.player.teleport(0, 12 * 3.2, -0.3, Math.PI / 2));
  await wait(800);
  const seen = await ev(() => window.__na13f.runtime.seen13);
  const stings1 = await ev(() => window.__na13f.audio.stingCount);
  check('13F: button appears only after the story opens it; ride 1F→13F', has13 && at13);
  check('13F: arrival shock fires once (sting)', seen && stings1 === stings0 + 1, `stings ${stings0}→${stings1}`);
  const ids13 = await ev(() => window.__na13f.interactables().filter((i) => i.floor === 13).map((i) => i.id));
  console.log('13F interactables:', ids13.join(', '));
  check('E: 1301 door opens (unlocked by records)', await use('door:unit-1301'));
  await wait(1400);
  const frameOk = await use('frame-1301');
  check('E: 1301 family photo sets saw1301', frameOk && (await ev(() => !!window.__na13f.s.flags.saw1301)));
  await closeOverlays();
  const d4 = ids13.find((i) => i.includes('D4'));
  if (d4) {
    check('E: D4 pickup on 13F', (await use(d4)) && (await ev(() => window.__na13f.s.pickedUp.includes('D4'))));
    await closeOverlays();
  } else check('E: D4 pickup on 13F', false, 'no D4 interactable found');
  await ev(() => {
    const g = window.__game;
    g.director.s.flags.f13Open = false;
    g.rebuild([13]);
  });
}

// ---------------------------------------------------------------- runtime anomalies
async function forceAt(id) {
  return ev((id) => {
    const g = window.__game;
    g.player.teleport(-7.4, 0, -3, 0.3); // neutral spot (control room) before the world changes
    const inc = window.__na13f.force(id);
    return { floor: inc.floor, loc: inc.location };
  }, id);
}

{
  const { floor } = await forceAt('aud_room_silence');
  await ev((f) => window.__game.player.teleport(4, (f - 1) * 3.2, 0, Math.PI / 2), floor);
  await wait(300);
  const on = await ev(() => window.__na13f.audio.silence);
  await ev(() => window.__game.player.teleport(4, 0, 0.3, Math.PI / 2));
  await wait(300);
  const off = await ev(() => window.__na13f.audio.silence);
  check('aud_room_silence: silent only on its floor', on && !off, `floor ${floor}`);
}
{
  const { floor } = await forceAt('aud_follow_steps');
  await ev((f) => {
    window.__posSteps = 0;
    window.__game.player.teleport(10, (f - 1) * 3.2, 0, Math.PI / 2);
  }, floor);
  await wait(200);
  await page.keyboard.down('KeyW');
  await wait(2600);
  await page.keyboard.up('KeyW');
  await wait(600);
  const n = await ev(() => window.__posSteps);
  const moved = await ev(() => window.__game.player.pos.x);
  check('aud_follow_steps: echo footsteps behind the walking player', n >= 2, `echoes=${n}, x=${moved.toFixed(2)}`);
}
{
  const { floor } = await forceAt('aud_elevator_uncalled');
  await ev((f) => {
    const g = window.__game;
    g.elevator.place(f === 1 ? 5 : 1);
    g.player.teleport(3, (f - 1) * 3.2, 0.3, -Math.PI / 2);
  }, floor);
  const came = await waitFor((f) => window.__game.elevator.floor === f && !window.__game.elevator.moving, floor, 60000);
  const log = await ev(() => window.__na13f.s.elevatorLog.slice(-1)[0]);
  check('aud_elevator_uncalled: car arrives with no call, not logged as player trip', came && !(log && log.to === floor && log.note === `${floor}층 호출`), `floor ${floor} ${JSON.stringify(await ev(() => ({ el: window.__game.elevator.floor, busy: window.__game.elevator.busy, cd: window.__na13f.runtime.ghostCooldown, pf: window.__game.playerFloor(), pos: window.__na13f.info().pos, act: window.__game.director.activeFloor('aud_elevator_uncalled') })))}`);
}
{
  const { floor } = await forceAt('aud_voice_vacant');
  await ev((f) => window.__game.player.teleport(0, (f - 1) * 3.2, 0, Math.PI / 2), floor);
  await wait(400);
  const key = await ev(() => window.__na13f.runtime.murmurKey);
  let muted = false;
  if (key) {
    await use(`unit:${key}`);
    muted = await ev(() => window.__na13f.runtime.murmurMuteUntil > window.__na13f.runtime.t);
  }
  check('aud_voice_vacant: TV murmur behind the vacant unit stops on doorbell', !!key && muted, `unit ${key}`);
  await closeOverlays();
}
{
  await forceAt('aud_steps_above');
  await ev(() => window.__game.player.teleport(13, 11 * 3.2, 0.6, 0));
  await wait(3500);
  const n = await ev(() => window.__na13f.runtime.stepsAboveN);
  check('aud_steps_above: footsteps above 12F in the stairwell', n >= 2, `steps=${n}`);
}
{
  const { floor } = await forceAt('geo_stair_loop');
  await ev((f) => window.__game.player.teleport(13.2, (f - 1) * 3.2, 0.6, 0), floor);
  await wait(300);
  await ev((f) => window.__game.player.teleport(13.2, (f - 2) * 3.2, 0.6, 0), floor);
  await wait(300);
  const y = await ev(() => window.__game.player.pos.y);
  const loops = await ev(() => window.__na13f.runtime.loops);
  check('geo_stair_loop: going down from F lands on F again', loops >= 1 && Math.abs(y - (floor - 1) * FH) < 0.3, `floor ${floor}, y=${y.toFixed(2)}`);
}
{
  const { floor } = await forceAt('hum_window_figure');
  await ev((f) => window.__game.player.teleport(11, (f - 1) * 3.2, 0, Math.PI / 2), floor);
  await wait(300);
  const vis0 = await ev((f) => window.__game.world.floors.get(f).named.get('windowFigure')?.visible, floor);
  await ev((f) => window.__game.player.teleport(-7, (f - 1) * 3.2, 0, Math.PI / 2), floor);
  await wait(500);
  const vis1 = await ev((f) => window.__game.world.floors.get(f).named.get('windowFigure')?.visible, floor);
  check('hum_window_figure: visible from afar, vanishes on approach', vis0 === true && vis1 === false);
}
{
  const { floor } = await forceAt('hum_door_ajar_watch');
  const s0 = await ev(() => window.__na13f.audio.stingCount);
  await ev((f) => window.__game.player.teleport(9, (f - 1) * 3.2, 0, Math.PI / 2), floor);
  await wait(300);
  const open0 = await ev((f) => window.__game.world.floors.get(f).doors.get('ajar')?.target, floor);
  const c = await ev((f) => {
    const d = window.__game.world.floors.get(f).doors.get('ajar');
    return [d.center.x, d.center.z];
  }, floor);
  await ev(({ f, c }) => window.__game.player.teleport(c[0] + 2.0, (f - 1) * 3.2, 0, Math.PI / 2), { f: floor, c });
  await wait(500);
  const open1 = await ev((f) => window.__game.world.floors.get(f).doors.get('ajar')?.target, floor);
  const s1 = await ev(() => window.__na13f.audio.stingCount);
  check('hum_door_ajar_watch: ajar door slams on approach (scare)', open0 > 0 && open1 === 0 && s1 === s0 + 1, `target ${open0}→${open1}, stings ${s0}→${s1}`);
}
{
  await forceAt('hum_mirror_figure');
  await ev(() => {
    const g = window.__game;
    g.elevator.place(1);
    g.player.teleport(0.2, 0, -3.9, 0);
  });
  await wait(1600);
  const r = await ev(() => ({ seen: window.__na13f.runtime.mirrorSeen, vis: window.__game.world.car.mirrorFigure.visible }));
  check('hum_mirror_figure: figure only in the mirror, noticed when facing it', r.seen && r.vis);
}

check('No page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
fs.mkdirSync('tests/e2e/out', { recursive: true });
fs.writeFileSync('tests/e2e/out/functional.json', JSON.stringify({ date: new Date().toISOString(), results, errors }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
