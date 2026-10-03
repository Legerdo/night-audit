// B1: electrical room (전기실) and document archive (문서고).
import * as THREE from 'three';
import { B1, CEIL_H, SPINE, floorY } from '../data/building';
import { BuildCtx, boxGeo, planeGeo } from './kit';
import { mats, signMat } from './materials';
import * as T from './textures';
import { addFixture, addHingedDoor, addInteract, addSign, finishFloor, newFloor, noticePlane, signText } from './common';
import { buildElevatorLanding, buildSpine, floorPlaque } from './corridor';
import { buildStairModule } from './stair';
import { makeCabinet, makeShelf } from './props';
import type { BuildEnv, FloorInstance } from './types';

export const ELEC = { x0: -12, x1: -3, z0: -6.6, z1: -1.25 };
export const ARCHIVE = { x0: -10, x1: -3, z0: 1.25, z1: 6.0 };

export function buildBasement(env: BuildEnv): FloorInstance {
  const n = B1;
  const f = newFloor(n, env.mods);
  const y0 = floorY(n);
  const ctx = new BuildCtx(f.group, y0);
  const m = mats();
  buildSpine(f, ctx, {
    wall: m.wallConcrete,
    floor: m.floorEpoxy,
    ceiling: m.ceilingConcrete,
    wainscot: null,
    ceilH: CEIL_H,
    lightColor: '#e4efe4',
    lightKind: 'tube',
    lightIntensity: 3.8,
    lightXs: [-9, -4, 3, 9],
    northOpenings: [{ x0: -6.5, x1: -5.5, y1: 2.1 }],
    southOpenings: [{ x0: -6.5, x1: -5.5, y1: 2.1 }],
    westWindow: false,
  });
  // green safety line painted along the walls
  ctx.solid(SPINE.x0, SPINE.x1, 1.0, 1.08, SPINE.z0 - 0.005, SPINE.z0 + 0.004, m.floorEpoxy, { collide: false });
  ctx.solid(SPINE.x0, SPINE.x1, 1.0, 1.08, SPINE.z1 - 0.004, SPINE.z1 + 0.005, m.floorEpoxy, { collide: false });
  // pipes along the ceiling
  for (const [z, r, mat] of [
    [-0.7, 0.07, m.pipe],
    [-0.45, 0.05, m.pipeRed],
    [0.7, 0.09, m.pipe],
  ] as const) {
    ctx.deco(new THREE.CylinderGeometry(r, r, 24, 10).rotateZ(Math.PI / 2), mat, 0, CEIL_H - 0.18, z);
  }
  buildElevatorLanding(f, ctx);
  floorPlaque(ctx, n, 'B1');
  signText(ctx, 'sign-elec', '전기실', '관계자 외 출입금지', -6.0, 2.35, SPINE.z0 + 0.012, 's', 0.7, 0.26, { bg: '#f1d34a', fg: '#1b1b1b' });
  signText(ctx, 'sign-arch', '문서고', null, -6.0, 2.35, SPINE.z1 - 0.012, 'n', 0.6, 0.2);
  // west end: machine room door (locked)
  ctx.deco(boxGeo(0.05, 2.1, 1.0), m.steelDoor, SPINE.x0 + 0.03, 1.05, 0);
  addSign(ctx, 'mech-sign', { w: 256, h: 96, bg: '#f4f4f0', fg: '#222', border: '#444', lines: [{ text: '기계실', size: 50, weight: 800 }] }, SPINE.x0 + 0.06, 1.8, 0, 'e', 0.34, 0.13);
  addInteract(f, ctx, 'mech-door', 'message', '기계실 문', SPINE.x0 + 0.2, 1.0, 0, [0.3, 2.0, 1.0], { text: '보일러와 펌프 소리. 잠겨 있다. 오늘 밤 점검 대상이 아니다.' }, 2.0);
  // B1 CCTV
  ctx.deco(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), m.glassDark, -2.6, CEIL_H - 0.01, 0.8);
  f.cctv.push({ id: 'b1', label: 'B1 복도', floor: n, pos: new THREE.Vector3(-2.7, y0 + CEIL_H - 0.15, 0.8), target: new THREE.Vector3(-11, y0 + 0.8, -0.2), fov: 64 });

  buildElectrical(f, ctx, env);
  buildArchive(f, ctx, env);
  buildStairModule(f, ctx, env, { hasUp: true, hasDown: false });
  return finishFloor(f, ctx);
}

export const BREAKERS_BASE = ['1층 로비', '2층 상가', '3층', '4층', '5층', '6층', '7층', '8층', '9층', '10층', '11층', '12층', '옥탑 기계실', '비상 조명', '승강기'];

function buildElectrical(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const { x0, x1, z0 } = ELEC;
  ctx.floor(x0, x1, z0, SPINE.z0, m.floorEpoxy, 1.0);
  ctx.ceiling(x0, x1, z0, SPINE.z0 - 0.15, m.ceilingConcrete, CEIL_H);
  ctx.wallZ(x0 - 0.075, z0, SPINE.z0 - 0.15, CEIL_H + 0.3, m.wallConcrete);
  ctx.wallZ(x1 + 0.075, z0, SPINE.z0 - 0.15, CEIL_H + 0.3, m.wallConcrete);
  ctx.wallX(z0 - 0.075, x0, x1, CEIL_H + 0.3, m.wallConcrete);
  addHingedDoor(f, ctx, { id: 'elec', kind: 'room', wallAxis: 'x', hingeAt: -6.5, width: 1.0, wallPos: SPINE.z0 - 0.075, towards: 1, swing: -1, mat: m.steelDoor, label: '전기실 문' });
  // distribution boards along the north wall
  for (let i = 0; i < 5; i++) {
    const x = -11.2 + i * 0.95;
    ctx.solid(x - 0.44, x + 0.44, 0, 2.0, z0, z0 + 0.5, m.metalGray, { uvM: 2 });
    ctx.deco(boxGeo(0.02, 1.8, 0.01), m.black, x, 1.0, z0 + 0.505);
    ctx.deco(boxGeo(0.06, 0.12, 0.03), m.chrome, x + 0.1, 1.1, z0 + 0.515);
    addSign(ctx, `db-lbl:${i}`, { w: 256, h: 96, bg: '#f4f4f0', fg: '#222', lines: [{ text: `분전반 ${i + 1}`, size: 44, weight: 800 }] }, x - 0.2, 1.75, z0 + 0.508, 's', 0.26, 0.1);
  }
  // main breaker panel (interactive) on the east part of the north wall
  ctx.solid(-6.6, -5.4, 0.6, 2.0, z0, z0 + 0.25, m.metalBeige);
  const hasExtra = env.mods.has('obj_breaker_13');
  const bTex = T.cached(`breakers:${hasExtra}`, () => {
    const [c, g] = T.makeCanvas(384, 448);
    g.fillStyle = '#e9e4d6';
    g.fillRect(0, 0, 384, 448);
    g.fillStyle = '#222';
    g.font = `800 26px ${T.FONT}`;
    g.textAlign = 'center';
    g.fillText('전등 분기 차단기', 192, 30);
    const list = hasExtra ? [...BREAKERS_BASE.slice(0, 12), '13층', ...BREAKERS_BASE.slice(12)] : BREAKERS_BASE;
    list.forEach((name, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 20 + col * 182;
      const y = 50 + row * 48;
      g.fillStyle = '#2b2b2b';
      g.fillRect(x, y, 36, 40);
      g.fillStyle = '#d8d8d8';
      g.fillRect(x + 8, y + 5, 20, 14);
      g.fillStyle = '#222';
      g.font = `600 20px ${T.FONT}`;
      g.textAlign = 'left';
      g.fillText(name, x + 44, y + 27);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  ctx.mesh(planeGeo(1.1, 1.28), signMat(`breakers:${hasExtra}`, bTex), -6.0, 1.3, z0 + 0.255, 0);
  addInteract(f, ctx, 'breakers', 'breaker_panel', '차단기 패널 보기', -6.0, 1.3, z0 + 0.55, [1.2, 1.4, 0.4], { extra: hasExtra }, 2.2);
  // transformer cage
  ctx.solid(-11.8, -9.8, 0, 1.6, -4.2, -2.6, m.metalGray);
  addSign(ctx, 'hv', { w: 384, h: 192, bg: '#f1d34a', fg: '#b01818', border: '#1b1b1b', lines: [{ text: '고압 위험', size: 76, weight: 900 }, { text: '22,900V', size: 44, weight: 700, color: '#1b1b1b' }] }, -9.79, 1.2, -3.4, 'e', 0.5, 0.25);
  // key cabinet on the east wall: holds the archive drawer key
  ctx.deco(boxGeo(0.08, 0.45, 0.4), m.metalGray, x1 - 0.04, 1.5, -2.2);
  addSign(ctx, 'keycab', { w: 256, h: 96, bg: '#e6e2d6', fg: '#222', lines: [{ text: '예비 열쇠', size: 44, weight: 800 }] }, x1 - 0.085, 1.8, -2.2, 'w', 0.24, 0.09);
  if (!env.flags.pickedUp.has('archiveKey')) {
    addInteract(f, ctx, 'pickup:archiveKey', 'pickup', '예비 열쇠함 열기', x1 - 0.3, 1.5, -2.2, [0.3, 0.5, 0.5], { record: 'archiveKey' }, 2.0);
  }
  addFixture(f, ctx, -9, -4.2, CEIL_H, { along: 'x', intensity: 3.6, color: '#e4efe4' });
  addFixture(f, ctx, -5, -4.2, CEIL_H, { along: 'x', intensity: 3.6, color: '#e4efe4' });
}

function buildArchive(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const { x0, x1, z1 } = ARCHIVE;
  ctx.floor(x0, x1, SPINE.z1, z1, m.floorLino, 0.9);
  ctx.ceiling(x0, x1, SPINE.z1 + 0.15, z1, m.ceilingConcrete, CEIL_H);
  ctx.wallZ(x0 - 0.075, SPINE.z1 + 0.15, z1, CEIL_H + 0.3, m.wallConcrete);
  ctx.wallZ(x1 + 0.075, SPINE.z1 + 0.15, z1, CEIL_H + 0.3, m.wallConcrete);
  ctx.wallX(z1 + 0.075, x0, x1, CEIL_H + 0.3, m.wallConcrete);
  addHingedDoor(f, ctx, { id: 'archive', kind: 'room', wallAxis: 'x', hingeAt: -6.5, width: 1.0, wallPos: SPINE.z1 + 0.075, towards: 1, swing: 1, mat: m.steelDoor, label: '문서고 문' });
  // shelving rows
  for (const [x, seed] of [
    [-9.2, 11],
    [-7.8, 12],
  ] as const) {
    const s = makeShelf(3.2, 2.1, 0.45, 5, true, seed);
    s.position.set(x, ctx.y0, 3.9);
    s.rotation.y = Math.PI / 2;
    f.group.add(s);
    ctx.collider(x - 0.25, x + 0.25, 0, 2.1, 2.3, 5.5);
  }
  // 1994 ledger on the east shelf (D1)
  const shelf3 = makeShelf(2.0, 2.1, 0.45, 5, true, 13);
  shelf3.position.set(-3.35, ctx.y0, 4.4);
  shelf3.rotation.y = -Math.PI / 2;
  f.group.add(shelf3);
  ctx.collider(-3.6, -3.0, 0, 2.1, 3.4, 5.4);
  if (!env.flags.pickedUp.has('D1')) {
    ctx.deco(boxGeo(0.4, 0.06, 0.3), m.binderRed, -3.5, 1.1, 3.4);
    addInteract(f, ctx, 'pickup:D1', 'pickup', '빨간 표지 장부 꺼내기', -3.5, 1.1, 3.35, [0.5, 0.35, 0.45], { record: 'D1' }, 2.0);
  }
  // locked filing cabinet (D2) against the south wall
  const fc = makeCabinet(0.6, 1.3, 0.6, m.metalGray);
  fc.position.set(-5.2, ctx.y0, z1 - 0.32);
  fc.rotation.y = Math.PI;
  f.group.add(fc);
  ctx.collider(-5.5, -4.9, 0, 1.3, z1 - 0.62, z1);
  addSign(ctx, 'fc-label', { w: 256, h: 96, bg: '#f4efe2', fg: '#8b1414', border: '#8b1414', lines: [{ text: '구조 · 인허가', size: 38, weight: 800 }] }, -5.2, 1.15, z1 - 0.63, 'n', 0.3, 0.11);
  if (!env.flags.pickedUp.has('D2')) {
    addInteract(f, ctx, 'drawer', 'filing_cabinet', '서류함 열기', -5.2, 0.9, z1 - 0.8, [0.7, 1.0, 0.4], {}, 2.0);
  }
  // desk with a lamp
  ctx.solid(-9.5, -8.2, 0.72, 0.75, 1.5, 2.1, m.woodDesk);
  ctx.deco(boxGeo(0.04, 0.72, 0.5), m.metalGray, -9.45, 0.36, 1.8);
  ctx.deco(boxGeo(0.04, 0.72, 0.5), m.metalGray, -8.25, 0.36, 1.8);
  ctx.collider(-9.5, -8.2, 0, 0.8, 1.5, 2.1);
  noticePlane(ctx, 'arch-rule', { w: 420, h: 300, title: '문서고 이용 안내', body: '보존 연한이 지난 서류는 철거 전 일괄 폐기 예정입니다.\n원본 서류는 반출하지 마십시오.', footer: '관리사무소', seed: 92 }, x0 + 0.02, 1.6, 2.0, 'e', 0.4);
  addFixture(f, ctx, -6.5, 3.6, CEIL_H, { along: 'z', intensity: 3.2, color: '#f3efe0', mode: 'on' });
  void signMat;
}
