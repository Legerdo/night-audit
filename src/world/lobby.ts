// 1F: lobby, maintenance control room (관리실), parcel room (택배보관실).
import * as THREE from 'three';
import { CEIL_H, HALL, SPINE, floorY } from '../data/building';
import { getImage } from '../data/imageAssets';
import { BuildCtx, boxGeo, planeGeo } from './kit';
import { mats, signMat } from './materials';
import * as T from './textures';
import { addFixture, addHingedDoor, addInteract, addSign, blob, finishFloor, newFloor, noticePlane, signText } from './common';
import { buildElevatorLanding, buildSpine, floorPlaque } from './corridor';
import { buildStairModule } from './stair';
import { makeDesk, makeMonitor, makeOfficeChair, makeVendingMachine, makeCabinet, makeShelf } from './props';
import { makeWallClock } from './clock';
import type { BuildEnv, FloorInstance } from './types';
import { makeScreenMaterial } from './screenMat';

export const CONTROL = { x0: -12, x1: -3, z0: -6.6, z1: -1.25 };
export const PARCEL = { x0: 6.2, x1: 11.8, z0: -5.6, z1: -1.25 };
export const BAY = { x0: -4, x1: 4, z0: 1.1, z1: 3.6 };

/** Screen materials for the four control-room CCTV monitors (textures assigned by the CCTV system). */
export const monitorScreens: THREE.ShaderMaterial[] = [0, 1, 2, 3].map(() => makeScreenMaterial());

export function missingPosterCanvas(empty: boolean): HTMLCanvasElement {
  const key = empty ? 'staff_parkjeongho_empty' : 'staff_parkjeongho';
  const [c, ctx] = T.makeCanvas(600, 848);
  T.drawNotice(ctx, {
    w: 600,
    h: 848,
    paper: '#f6f3ea',
    title: '사람을 찾습니다',
    titleColor: '#b01818',
    body: '박정호 (51세 · 남)\n청운빌딩 야간 관리원\n\n2026년 9월 21일 새벽 근무 중 연락이 끊겼습니다.\n키 172cm, 마른 체형, 회색 근무복 차림.\n\n보신 분은 꼭 연락 주십시오.',
    footer: '가족 010-****-0412',
    image: getImage(key),
    imageRect: [165, 130, 270, 340],
    seed: 412,
  });
  return c;
}

export function buildLobby(env: BuildEnv): FloorInstance {
  const n = 1;
  const mods = env.mods;
  const f = newFloor(n, mods);
  const y0 = floorY(n);
  const ctx = new BuildCtx(f.group, y0);
  const m = mats();

  buildSpine(f, ctx, {
    wall: m.wallCream,
    floor: m.floorLobby,
    ceiling: m.ceiling,
    wainscot: m.wallGray,
    ceilH: CEIL_H,
    lightColor: '#eef3ff',
    lightKind: 'tube',
    lightIntensity: 5.6,
    northOpenings: [
      { x0: -5.5, x1: -4.5, y1: 2.1 },
      { x0: -10, x1: -7.5, y0: 1.0, y1: 1.8 } as { x0: number; x1: number; y1: number },
      { x0: 7.5, x1: 8.5, y1: 2.1 },
    ],
    southOpenings: [{ x0: BAY.x0, x1: BAY.x1, y1: 99 }],
    westWindow: false,
  });
  buildElevatorLanding(f, ctx);
  floorPlaque(ctx, 1, '1');

  // ---- entrance bay ----
  ctx.floor(BAY.x0, BAY.x1, SPINE.z1, BAY.z1, m.floorLobby, 0.9);
  ctx.ceiling(BAY.x0, BAY.x1, SPINE.z1, BAY.z1, m.ceiling, CEIL_H);
  ctx.wallZ(BAY.x0 - 0.075, SPINE.z1, BAY.z1, CEIL_H + 0.3, m.wallCream);
  ctx.wallZ(BAY.x1 + 0.075, SPINE.z1, BAY.z1, CEIL_H + 0.3, m.wallCream);
  ctx.wallX(BAY.z1 + 0.075, BAY.x0, BAY.x1, CEIL_H + 0.3, m.wallCream, [{ x0: -1.2, x1: 1.2, y1: 2.3 }]);
  // glass entrance doors (locked at night)
  const doorFrame = m.metalGray;
  ctx.deco(boxGeo(2.5, 0.08, 0.1), doorFrame, 0, 2.3, BAY.z1);
  for (const x of [-1.2, 0, 1.2]) ctx.deco(boxGeo(0.06, 2.3, 0.1), doorFrame, x, 1.15, BAY.z1);
  for (const x of [-0.6, 0.6]) {
    const g = ctx.mesh(planeGeo(1.1, 2.2), m.glass, x, 1.12, BAY.z1, 0);
    g.renderOrder = 2;
    ctx.deco(boxGeo(0.03, 0.4, 0.05), m.chrome, x + (x < 0 ? 0.45 : -0.45), 1.05, BAY.z1 - 0.05);
  }
  f.colliders.push({ x0: -1.2, x1: 1.2, y0: y0, y1: y0 + 2.3, z0: BAY.z1 - 0.06, z1: BAY.z1 + 0.06, tag: 'entrance' });
  addInteract(f, ctx, 'entrance', 'entrance', '출입문', 0, 1.2, BAY.z1 - 0.2, [2.3, 2.2, 0.3], {}, 2.6);
  noticePlane(ctx, 'entrance-notice', { w: 360, h: 260, title: '야간 출입 통제', titleColor: '#8b1a1a', body: '00:00 ~ 06:00 출입문 자동 잠금\n입주민은 카드키를 이용해 주세요.', seed: 9 }, 0.6, 1.5, BAY.z1 - 0.03, 'n', 0.36);
  // outside: canopy slab + street backdrop
  ctx.solid(-3, 3, -0.2, 0, BAY.z1 + 0.1, BAY.z1 + 3, m.floorStair, { collide: false });
  ctx.mesh(planeGeo(30, 12), m.street, 0, 3.5, BAY.z1 + 9, Math.PI);
  // mailboxes on bay west wall
  const mb = new THREE.Group();
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++) {
      const b = new THREE.Mesh(boxGeo(0.22, 0.2, 0.23), m.stainlessDark); // 1 cm gaps: boxes must not overlap
      b.position.set(0, 0.95 + r * 0.22, 1.5 + c * 0.24);
      mb.add(b);
    }
  mb.position.set(BAY.x0 + 0.15, y0, 0);
  f.group.add(mb);
  ctx.collider(BAY.x0, BAY.x0 + 0.32, 0, 2, 1.35, 2.95);
  // lobby clock above mailboxes
  const clock = makeWallClock(0.2, 'modern', () => mods.has('tmp_lobby_clock_backward'));
  clock.group.position.set(BAY.x0 + 0.03, y0 + 2.2, 2.2);
  clock.group.rotation.y = Math.PI / 2;
  f.group.add(clock.group);
  f.updaters.push(() => clock.update());
  // coffee vending machine(s) on bay east wall, facing -x
  const vm = makeVendingMachine();
  vm.position.set(BAY.x1 - 0.42, y0, 2.9);
  vm.rotation.y = -Math.PI / 2;
  f.group.add(vm);
  f.named.set('vending', vm);
  ctx.collider(BAY.x1 - 0.8, BAY.x1, 0, 1.8, 2.45, 3.35);
  blob(ctx, BAY.x1 - 0.42, 2.9, 0.55);
  if (mods.has('obj_vending_duplicate')) {
    const vm2 = makeVendingMachine();
    vm2.position.set(BAY.x1 - 0.42, y0, 1.95);
    vm2.rotation.y = -Math.PI / 2;
    f.group.add(vm2);
    f.named.set('vending2', vm2);
    ctx.collider(BAY.x1 - 0.8, BAY.x1, 0, 1.8, 1.5, 2.4);
    blob(ctx, BAY.x1 - 0.42, 1.95, 0.55);
  }
  addSign(ctx, 'vm-sign', { w: 256, h: 96, bg: '#f3eee2', fg: '#6b2525', lines: [{ text: '커피 300원', size: 44, weight: 800 }] }, BAY.x1 - 0.02, 2.05, 2.9, 'w', 0.4, 0.15);

  // ---- directory board (층별 안내) ----
  buildDirectoryBoard(f, ctx, mods.has('sys_lobby_board_13'));
  // ---- bulletin board with missing poster (south wall, east part) ----
  ctx.deco(boxGeo(1.5, 1.0, 0.03), m.woodDesk, 6.4, 1.6, SPINE.z1 - 0.015);
  ctx.deco(boxGeo(1.42, 0.92, 0.02), m.cardboardDark, 6.4, 1.6, SPINE.z1 - 0.03);
  const poster = T.canvasTexture(missingPosterCanvas(mods.has('img_missing_poster_empty')));
  ctx.mesh(planeGeo(0.42, 0.594), new THREE.MeshStandardMaterial({ map: poster, roughness: 0.9 }), 6.05, 1.6, SPINE.z1 - 0.045, Math.PI);
  noticePlane(ctx, 'notice-recycle', { w: 420, h: 594, title: '분리배출 안내', body: '재활용품은 매주 수요일 저녁 8시 이후 지하 1층이 아닌 1층 뒷마당에 배출해 주세요.\n\n스티로폼은 테이프를 떼고 배출합니다.', footer: '관리사무소', seed: 71 }, 6.72, 1.62, SPINE.z1 - 0.045, 'n', 0.36);
  addInteract(f, ctx, 'board-lobby', 'inspect', '게시판 읽기', 6.4, 1.6, SPINE.z1 - 0.25, [1.5, 1.0, 0.3], { board: 'lobby' }, 2.6);

  // bench + plant
  ctx.solid(-10.6, -8.8, 0, 0.45, SPINE.z1 - 0.5, SPINE.z1 - 0.05, m.fabricBrown, { uvM: 0.5 });
  ctx.solid(-10.6, -8.8, 0.45, 0.85, SPINE.z1 - 0.12, SPINE.z1 - 0.04, m.fabricBrown, { collide: false });
  ctx.deco(new THREE.CylinderGeometry(0.22, 0.18, 0.45, 12), m.potTerracotta, -11.5, 0.225, 0.6);
  ctx.deco(new THREE.SphereGeometry(0.4, 10, 8), m.plantGreen, -11.5, 0.8, 0.6);
  ctx.collider(-11.8, -11.2, 0, 1.2, 0.3, 0.9);
  // signs above doors
  signText(ctx, 'sign-control', '관리실', 'MAINTENANCE', -5.0, 2.35, SPINE.z0 + 0.012, 's', 0.6, 0.22);
  signText(ctx, 'sign-parcel', '택배보관실', null, 8.0, 2.35, SPINE.z0 + 0.012, 's', 0.7, 0.2);
  addSign(ctx, 'bldg-plaque', { w: 512, h: 256, bg: '#3b3226', fg: '#e8d9b0', border: '#a58a55', lines: [{ text: '청운빌딩', size: 96, weight: 800 }, { text: '1994. 11. 준공', size: 40, weight: 500 }] }, SPINE.x0 + 0.09, 1.7, 0, 'e', 0.9, 0.45);

  // lobby CCTV
  ctx.deco(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), m.glassDark, -3.5, CEIL_H - 0.01, 3.2);
  f.cctv.push({ id: 'lobby', label: '1층 로비', floor: 1, pos: new THREE.Vector3(-3.5, y0 + CEIL_H - 0.15, 3.2), target: new THREE.Vector3(2.5, y0 + 0.8, -1.5), fov: 72 });

  buildControlRoom(f, ctx, env);
  buildParcelRoom(f, ctx, env);
  buildStairModule(f, ctx, env, { hasUp: true, hasDown: true });
  return finishFloor(f, ctx);
}

function buildDirectoryBoard(f: FloorInstance, ctx: BuildCtx, with13: boolean): void {
  const m = mats();
  const rows: [string, string][] = [
    ['12F', '주거'],
    ['11F', '주거'],
    ['10F', '주거'],
    ['9F', '주거'],
    ['8F', '주거'],
    ['7F', '주거'],
    ['6F', '주거'],
    ['5F', '주거 · 추억 사진전'],
    ['4F', '주거'],
    ['3F', '주거'],
    ['2F', '상가 (부동산 · 학원 · 세탁 · 미용)'],
    ['1F', '로비 · 관리실 · 택배보관실'],
    ['B1', '전기실 · 문서고 · 기계실'],
  ];
  if (with13) rows.unshift(['13F', '관리사무소']);
  const key = `dirboard:${with13}`;
  const tex = T.cached(key, () => {
    const W = 512;
    const H = 760;
    const [c, ctx2] = T.makeCanvas(W, H);
    ctx2.fillStyle = '#1e2430';
    ctx2.fillRect(0, 0, W, H);
    ctx2.fillStyle = '#d9c78f';
    ctx2.font = `800 44px ${T.FONT}`;
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText('청운빌딩 층별 안내', W / 2, 44);
    const top = 96;
    const rh = (H - top - 20) / 14;
    rows.forEach(([fl, desc], i) => {
      const y = top + i * rh + rh / 2;
      ctx2.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0)';
      ctx2.fillRect(16, y - rh / 2, W - 32, rh);
      ctx2.fillStyle = '#f2f2f2';
      ctx2.font = `800 30px ${T.FONT}`;
      ctx2.textAlign = 'left';
      ctx2.fillText(fl, 34, y);
      ctx2.font = `500 26px ${T.FONT}`;
      ctx2.fillStyle = '#cfd3da';
      ctx2.fillText(desc, 120, y);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
  ctx.deco(boxGeo(0.84, 1.24, 0.03), m.metalGray, 3.4, 1.55, SPINE.z0 + 0.015);
  ctx.mesh(planeGeo(0.8, 1.19), signMat(key, tex, { emissive: 0.15 }), 3.4, 1.55, SPINE.z0 + 0.034, 0);
  addInteract(f, ctx, 'dirboard', 'inspect', '층별 안내 읽기', 3.4, 1.55, SPINE.z0 + 0.25, [0.9, 1.3, 0.3], { board: 'directory', with13 }, 2.6);
}

function buildControlRoom(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const { x0, x1, z0, z1 } = CONTROL;
  ctx.floor(x0, x1, z0, SPINE.z0, m.floorLino, 0.9);
  ctx.ceiling(x0, x1, z0, z1, m.ceiling, CEIL_H);
  // side walls stop at the back of the corridor wall (SPINE.z0 - 0.15) instead of poking through its face
  ctx.wallZ(x0 - 0.075, z0, SPINE.z0 - 0.15, CEIL_H + 0.3, m.wallCream);
  ctx.wallZ(x1 + 0.075, z0, SPINE.z0 - 0.15, CEIL_H + 0.3, m.wallCream);
  ctx.wallX(z0 - 0.075, x0, x1, CEIL_H + 0.3, m.wallCream);
  ctx.solid(x0, x1, 0, 1.0, z0 + 0.001, z0 + 0.012, m.wallGray, { collide: false });
  // service window glass
  const g = ctx.mesh(planeGeo(2.5, 0.8), m.glass, -8.75, 1.4, SPINE.z0 - 0.075, 0);
  g.renderOrder = 2;
  // counter is wider than the service window and 5 mm above its sill: no shared faces with the wall
  ctx.solid(-10.03, -7.47, 0.955, 1.005, SPINE.z0 - 0.35, SPINE.z0 + 0.15, m.woodDesk);
  // door
  addHingedDoor(f, ctx, { id: 'control', kind: 'room', wallAxis: 'x', hingeAt: -5.5, width: 1.0, wallPos: SPINE.z0 - 0.075, towards: 1, swing: -1, mat: m.steelDoor, autoClose: 0, label: '관리실 문' });

  // desk with 4 CCTV monitors against the north wall
  const desk = makeDesk(4.2, 0.8);
  desk.position.set(-8.4, ctx.y0, z0 + 0.45);
  f.group.add(desk);
  ctx.collider(-10.5, -6.3, 0, 0.8, z0, z0 + 0.86);
  const mxs = [-9.85, -9.05, -8.25, -7.45];
  mxs.forEach((x, i) => {
    const mon = makeMonitor(monitorScreens[i], 0.66, 0.44);
    mon.position.set(x, ctx.y0 + 0.76, z0 + 0.3);
    mon.scale.setScalar(1);
    f.group.add(mon);
  });
  addInteract(f, ctx, 'monitors', 'monitors', 'CCTV 모니터 보기', -8.65, 1.25, z0 + 0.6, [3.2, 0.7, 0.4], {}, 2.4);
  // label strip under monitors
  addSign(ctx, 'mon-labels', { w: 1024, h: 64, bg: '#1b1d20', fg: '#c9ced6', lines: [{ text: 'CH1 로비      CH2 승강기      CH3 신고 현장      CH4 B1 복도', size: 30, weight: 600 }] }, -8.65, 0.8, z0 + 0.86, 's', 3.0, 0.19);
  // log book
  ctx.deco(boxGeo(0.34, 0.03, 0.26), m.binderBlue, -6.9, 0.775, z0 + 0.5, 0.15);
  ctx.deco(boxGeo(0.3, 0.005, 0.22), m.paper, -6.9, 0.793, z0 + 0.5, 0.15);
  addInteract(f, ctx, 'desk_log', 'desk_log', '근무 일지 작성 (저장)', -6.9, 0.85, z0 + 0.5, [0.45, 0.25, 0.4], {}, 2.0);
  // intercom panel
  ctx.deco(boxGeo(0.3, 0.2, 0.14), m.beigePlastic, -10.25, 0.86, z0 + 0.55);
  ctx.deco(boxGeo(0.06, 0.24, 0.07), m.darkPlastic, -10.4, 0.98, z0 + 0.55);
  addInteract(f, ctx, 'intercom', 'intercom_panel', '인터폰', -10.25, 0.9, z0 + 0.55, [0.4, 0.3, 0.3], {}, 2.0);
  const chair = makeOfficeChair();
  chair.position.set(-8.4, ctx.y0, z0 + 1.35);
  chair.rotation.y = Math.PI;
  f.group.add(chair);
  // wall clock
  const clock = makeWallClock(0.2, 'modern', () => false);
  clock.group.position.set(-8.65, ctx.y0 + 2.25, z0 + 0.03);
  f.group.add(clock.group);
  f.updaters.push(() => clock.update());

  // archive cabinet (Tier A) against the west wall
  const cab = makeCabinet(0.9, 1.8, 0.5, m.metalBeige);
  cab.position.set(x0 + 0.27, ctx.y0, -3.4);
  cab.rotation.y = Math.PI / 2;
  f.group.add(cab);
  ctx.collider(x0, x0 + 0.55, 0, 1.8, -3.9, -2.9);
  addSign(ctx, 'archive-label', { w: 512, h: 160, bg: '#f4efe2', fg: '#8b1414', border: '#8b1414', lines: [{ text: '원본 기록 보관함', size: 58, weight: 900 }, { text: '본사 날인 원본 · 반출 금지', size: 30, weight: 600, color: '#333' }] }, x0 + 0.53, 1.55, -3.4, 'e', 0.56, 0.175);
  addInteract(f, ctx, 'archive', 'archive_cabinet', env.flags.pickedUp.has('binder') ? '원본 기록 보관함 (기록철 수령 완료)' : '원본 기록철 꺼내기', x0 + 0.7, 1.1, -3.4, [0.4, 1.6, 1.0], {}, 2.2);

  // rules board on the west wall
  noticePlane(ctx, 'rules', {
    w: 420,
    h: 594,
    title: '야간 근무 수칙',
    body: '1. 신고가 들어오면 반드시 현장을 직접 확인한다.\n2. 현장이 기준 사진과 다르면 이상현상으로 신고한다.\n3. 점검 일지에 적힌 고장은 이상현상이 아니다.\n4. 붉은 도장이 찍힌 원본 기록은 바뀌지 않는다.\n5. 판단이 어려우면 원본을 본다.',
    footer: '청운빌딩 시설관리팀',
    stamp: '원본',
    seed: 81,
  }, x0 + 0.02, 1.55, -5.2, 'e', 0.5);
  // handwritten addition (Tier D: someone's note, not official)
  noticePlane(ctx, 'rules-note', { w: 300, h: 200, paper: '#fff6a8', title: '', body: '건물은 12층이다.\n12층 위로는 올라가지 말 것.', seed: 82 }, x0 + 0.025, 1.08, -5.0, 'e', 0.24);
  // key box on the east wall
  ctx.deco(boxGeo(0.08, 0.6, 0.5), m.metalGray, x1 - 0.04, 1.5, -5.2);
  addSign(ctx, 'keybox', { w: 256, h: 96, bg: '#e6e2d6', fg: '#222', lines: [{ text: '열쇠함', size: 48, weight: 800 }] }, x1 - 0.085, 1.88, -5.2, 'w', 0.26, 0.1);
  addInteract(f, ctx, 'keybox', 'key_box', '열쇠함 열기', x1 - 0.3, 1.5, -5.2, [0.35, 0.7, 0.6], {}, 2.0);
  // cot + water dispenser
  ctx.solid(-11.9, -10.1, 0, 0.42, -2.2, -1.35, m.fabricBlue, { uvM: 0.5 });
  ctx.deco(boxGeo(0.34, 1.05, 0.34), m.whitePlastic, -3.35, 0.525, -2.0);
  ctx.deco(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 14), new THREE.MeshStandardMaterial({ color: '#8fb6d6', transparent: true, opacity: 0.6, roughness: 0.1 }), -3.35, 1.25, -2.0);
  ctx.collider(-3.55, -3.15, 0, 1.4, -2.2, -1.8);
  // lights
  addFixture(f, ctx, -9.5, -4.0, CEIL_H, { along: 'z', intensity: 5, color: '#eef3ff' });
  addFixture(f, ctx, -5.5, -4.0, CEIL_H, { along: 'z', intensity: 5, color: '#eef3ff' });
  void HALL;
  void signMat;
}

function buildParcelRoom(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const { x0, x1, z0 } = PARCEL;
  ctx.floor(x0, x1, z0, SPINE.z0, m.floorLino, 0.9);
  ctx.ceiling(x0, x1, z0, SPINE.z0 - 0.15, m.ceiling, CEIL_H);
  ctx.wallZ(x0 - 0.075, z0, SPINE.z0 - 0.15, CEIL_H + 0.3, m.wallGray);
  ctx.wallZ(x1 + 0.075, z0, SPINE.z0 - 0.15, CEIL_H + 0.3, m.wallGray);
  ctx.wallX(z0 - 0.075, x0, x1, CEIL_H + 0.3, m.wallGray);
  addHingedDoor(f, ctx, { id: 'parcel', kind: 'room', wallAxis: 'x', hingeAt: 7.5, width: 1.0, wallPos: SPINE.z0 - 0.075, towards: 1, swing: -1, mat: m.steelDoor, autoClose: 0, label: '택배보관실 문' });
  // locker bank on the north wall: 5 columns x 5 rows, LCD in the middle column
  const open = env.mods.has('obj_lockers_open');
  const cols = 5;
  const rows = 5;
  const lw = 0.5;
  const lh = 0.36;
  const bx = 7.3;
  let num = 1;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = bx + c * (lw + 0.02) + lw / 2;
      const y = 0.25 + r * (lh + 0.02) + lh / 2;
      if (c === 2 && (r === 2 || r === 3)) continue; // LCD slot
      ctx.solid(x - lw / 2, x + lw / 2, y - lh / 2, y + lh / 2, z0, z0 + 0.45, m.metalBeige, { collide: false });
      const doorG = new THREE.Group();
      const dm = new THREE.Mesh(boxGeo(lw - 0.02, lh - 0.02, 0.02), m.stainless);
      dm.position.set((lw - 0.02) / 2, 0, 0);
      doorG.add(dm);
      doorG.position.set(x - lw / 2 + 0.01, ctx.y0 + y, z0 + 0.46);
      if (open) doorG.rotation.y = -1.25 - ((num * 37) % 5) * 0.06;
      f.group.add(doorG);
      const lbl = T.signTex(`locker-num:${num}`, { w: 96, h: 64, bg: '#f2f2ee', fg: '#222', lines: [{ text: String(num), size: 40, weight: 800 }] });
      const lm = new THREE.Mesh(planeGeo(0.08, 0.055), signMat(`locker-num:${num}`, lbl));
      lm.position.set(0.06, lh / 2 - 0.06, 0.012);
      dm.add(lm);
      lm.position.x = -(lw - 0.02) / 2 + 0.07;
      num++;
    }
  }
  ctx.collider(bx, bx + cols * (lw + 0.02), 0, 2.2, z0, z0 + 0.5);
  // LCD panel
  const lcdX = bx + 2 * (lw + 0.02) + lw / 2;
  // occupies exactly the two skipped slots (rows 2-3); 2 mm narrower so its sides never share a plane with the lockers
  const lcdY = 0.25 + 2 * (lh + 0.02) + (lh * 2 + 0.02) / 2;
  ctx.deco(boxGeo(lw - 0.004, lh * 2 + 0.02, 0.44), m.darkPlastic, lcdX, lcdY, z0 + 0.222);
  const lcd = T.signTex('lcd', { w: 256, h: 320, bg: '#0d2a3c', fg: '#bfe6ff', lines: [{ text: '무인 택배함', size: 34, weight: 800 }, { text: '화면을 누르세요', size: 24, weight: 500 }] });
  ctx.mesh(planeGeo(lw - 0.08, lh * 2 - 0.08), signMat('lcd', lcd, { emissive: 0.8 }), lcdX, lcdY, z0 + 0.447, 0);
  addInteract(f, ctx, 'locker', 'locker', '택배함 화면 보기', lcdX, 1.2, z0 + 0.7, [0.6, 0.8, 0.4], {}, 2.0);
  // shelves with parcels on the east wall
  const shelf = makeShelf(2.2, 1.9, 0.5, 4, false, 3);
  shelf.position.set(x1 - 0.3, ctx.y0, -3.2);
  shelf.rotation.y = -Math.PI / 2;
  f.group.add(shelf);
  ctx.collider(x1 - 0.55, x1, 0, 1.9, -4.3, -2.1);
  const boxes: [number, number, number][] = [
    [0.05, -3.9, 0.4],
    [0.05, -3.4, 0.3],
    [0.05, -2.6, 0.35],
    [0.64, -3.7, 0.3],
    [0.64, -2.9, 0.4],
    [1.24, -3.3, 0.28],
  ];
  for (const [yy, zz, s] of boxes) {
    ctx.deco(boxGeo(0.4, s, 0.36), m.cardboard, x1 - 0.3, yy + 0.02 + s / 2, zz);
  }
  if (env.mods.has('sys_delivery_vacant')) {
    // the parcel addressed to the vacant unit sits alone on the table
    ctx.deco(boxGeo(0.36, 0.22, 0.3), m.cardboardDark, 8.3, 0.86, -2.4, 0.3);
    const lbl = T.signTex('lbl-1204', { w: 256, h: 160, bg: '#f4f4f0', fg: '#111', lines: [{ text: 'CJ 택배', size: 26, weight: 800 }, { text: '1204호 박정호 님', size: 30, weight: 700 }] });
    ctx.deco(planeGeo(0.2, 0.125).rotateX(-Math.PI / 2), signMat('lbl-1204', lbl), 8.3, 0.975, -2.4, 0.3);
  }
  // table
  ctx.solid(7.6, 9.0, 0.72, 0.75, -2.8, -2.0, m.woodDesk);
  for (const [xx, zz] of [
    [7.65, -2.75],
    [8.95, -2.75],
    [7.65, -2.05],
    [8.95, -2.05],
  ]) ctx.deco(boxGeo(0.04, 0.72, 0.04), m.metalGray, xx, 0.36, zz);
  noticePlane(ctx, 'parcel-rule', { w: 420, h: 300, title: '택배 보관 안내', body: '보관함 문자 알림을 받으신 세대만 수령 가능합니다.\n장기 미수령 택배는 7일 후 반송됩니다.', footer: '관리사무소', seed: 91 }, x0 + 0.02, 1.6, -3.0, 'e', 0.42);
  addFixture(f, ctx, 9.0, -3.4, CEIL_H, { along: 'x', intensity: 4.6 });
}
