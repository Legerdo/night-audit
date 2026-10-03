// Residential floors 3–12 (5F hosts the photo exhibition, 12F has the enterable vacant unit 1204).
import * as THREE from 'three';
import { CEIL_H, EPS_DOOR, EXTINGUISHER_BOX, FLOOR_PROPS, HALL, HYDRANT, SPINE, UNIT_SLOTS, floorLabel, floorY, unitNumber } from '../data/building';
import { BuildCtx, boxGeo, planeGeo } from './kit';
import { mats, signMat } from './materials';
import * as T from './textures';
import {
  addFrame,
  addGuidance,
  addHingedDoor,
  addInteract,
  addParcel,
  addPlate,
  addSign,
  addUnitDoorStatic,
  blob,
  captionOpts,
  finishFloor,
  imageTexture,
  makeExtinguisher,
  makePlasticChair,
  makeShoes,
  newFloor,
  noticePlane,
  vacantNoticeOpts,
} from './common';
import { buildElevatorLanding, buildSpine, floorPlaque, hallIndicatorTex } from './corridor';
import { buildStairModule } from './stair';
import { makeSignature } from './props';
import { makeFigure, setLayerRecursive } from './figure';
import { LAYER_CCTV_ONLY, type BuildEnv, type FloorInstance } from './types';
import { buildUnit1204 } from './unit1204';

export const GALLERY_FRAMES = [
  { id: 'ceremony', x: -3.1, side: -1 as const, title: '1994. 11. 30. 준공식', sub: '관리사무소 제공', img: 'gallery_ceremony_normal' as const },
  { id: 'family', x: 2.8, side: -1 as const, title: '1998년 봄, 우리 집 거실', sub: '503호 정미경 님 제공', img: 'gallery_family_normal' as const },
  { id: 'exterior', x: -7.25, side: 1 as const, title: '1995년 청운빌딩 전경', sub: '관리사무소 제공', img: 'gallery_exterior' as const },
  { id: 'kimjang', x: -2.5, side: 1 as const, title: '2005년 입주민 김장 나눔', sub: '입주자대표회의 제공', img: 'gallery_kimjang' as const },
  { id: 'rooftop', x: 2.3, side: 1 as const, title: '2002년 6월, 옥상 응원', sub: '1108호 제공', img: 'gallery_rooftop' as const },
];
export const FRAME_W = 0.8;
export const FRAME_H = 0.6;
export const FRAME_Y = 1.55;

export function galleryImageKey(id: string, mods: ReadonlySet<string>, forReference: boolean, refMods: ReadonlySet<string>): string {
  const eff = forReference ? refMods : mods;
  if (id === 'family' && eff.has('img_family_extra_person')) return 'gallery_family_anomaly';
  if (id === 'ceremony' && (eff.has('img_ceremony_gaze') || eff.has('img_ceremony_both'))) return 'gallery_ceremony_anomaly';
  return GALLERY_FRAMES.find((g) => g.id === id)!.img;
}

export function buildResidential(n: number, env: BuildEnv): FloorInstance {
  const mods = env.mods;
  const f = newFloor(n, mods);
  const y0 = floorY(n);
  const ctx = new BuildCtx(f.group, y0);
  const m = mats();
  const props = FLOOR_PROPS[n];
  const lowCeil = mods.has('geo_ceiling_low');
  const ceilH = lowCeil ? CEIL_H - 0.42 : CEIL_H;
  const extendWest = mods.has('geo_corridor_extended') ? 6 : 0;
  const has1204 = n === 12;

  // ---- spine ----
  const northOpenings: { x0: number; x1: number; y1: number }[] = [];
  if (has1204) northOpenings.push({ x0: 8.52, x1: 9.48, y1: 2.1 });
  const lightModes: Record<number, 'flicker'> = {};
  if (props.flickerLight !== null) lightModes[props.flickerLight] = 'flicker';
  buildSpine(f, ctx, {
    wall: m.wallCream,
    floor: m.floorDeco,
    ceiling: m.ceiling,
    wainscot: m.wainscot,
    ceilH,
    lightColor: '#eaf1ff',
    lightKind: 'tube',
    lightIntensity: 5.2,
    hallCeilH: CEIL_H,
    lightModes,
    northOpenings,
    southOpenings: [],
    westWindow: !mods.has('geo_window_walled'),
    extendWest,
  });
  const indicatorTex = mods.has('sys_elevator_display') ? thirteenIndicator() : hallIndicatorTex;
  buildElevatorLanding(f, ctx, { indicatorTex });
  floorPlaque(ctx, n, String(n));

  // ---- unit doors ----
  const swapped = mods.has('sys_numbers_swapped');
  for (const slot of UNIT_SLOTS) {
    if (slot.idx === 6 && mods.has('geo_missing_door')) continue;
    const wallZ = slot.side === -1 ? SPINE.z0 : SPINE.z1;
    let num = unitNumber(n, slot.idx);
    if (swapped && slot.idx === 2) num = unitNumber(n, 3);
    else if (swapped && slot.idx === 3) num = unitNumber(n, 2);
    const real = unitNumber(n, slot.idx);
    if (has1204 && slot.idx === 4) {
      buildUnit1204Door(f, ctx, env);
    } else if (slot.idx === 6 && mods.has('hum_door_ajar_watch')) {
      buildAjarDoor(f, ctx, slot.x, wallZ);
    } else {
      addUnitDoorStatic(ctx, slot.x, wallZ, slot.side, m.doorWood);
      addInteract(f, ctx, `unit:${real}`, 'unit_door', '초인종 누르기', slot.x, 1.1, wallZ - slot.side * 0.12, [0.95, 2.0, 0.2], { unit: real }, 2.0);
    }
    addPlate(ctx, num, slot.x, wallZ, slot.side);
    if (props.vacantTape.includes(slot.idx) && !(has1204 && slot.idx === 4)) {
      noticePlane(ctx, 'vacant-notice', vacantNoticeOpts(), slot.x, 1.38, wallZ - slot.side * 0.055, slot.side === -1 ? 's' : 'n', 0.3);
    }
    if (props.parcels.includes(slot.idx)) {
      addParcel(ctx, slot.x + 0.55 * (slot.side === -1 ? -1 : 1), wallZ - slot.side * 0.3, 0.2, [0.42, 0.3, 0.32], 0, `parcel-lbl:${real}`, `${real}호`);
    }
  }
  if (mods.has('geo_extra_door')) {
    // A ninth, unnumbered door between 01 and 02 on the north wall.
    addUnitDoorStatic(ctx, -7.25 + 0.0, SPINE.z0, -1, m.doorWood);
    addInteract(f, ctx, 'unit:extra', 'unit_door', '초인종 누르기', -7.25, 1.1, SPINE.z0 + 0.12, [0.95, 2.0, 0.2], { unit: 'extra' }, 2.0);
  }
  if (extendWest > 0) {
    // two additional numbered doors in the impossible extension
    for (const [i, x] of [
      [9, -15.5],
      [10, -15.5],
    ] as const) {
      const side = i === 9 ? -1 : 1;
      const wallZ = side === -1 ? SPINE.z0 : SPINE.z1;
      addUnitDoorStatic(ctx, x, wallZ, side, m.doorWood);
      addPlate(ctx, unitNumber(n, i), x, wallZ, side);
      addInteract(f, ctx, `unit:${unitNumber(n, i)}`, 'unit_door', '초인종 누르기', x, 1.1, wallZ - side * 0.12, [0.95, 2.0, 0.2], { unit: unitNumber(n, i) }, 2.0);
    }
  }

  // ---- EPS/TPS door, hydrant ----
  ctx.deco(boxGeo(0.9, 2.05, 0.04), m.steelDoor, EPS_DOOR.x, 1.025, SPINE.z1 - 0.02);
  addSign(ctx, 'eps-sign', { w: 256, h: 96, bg: '#f4f4f0', fg: '#222', border: '#666', lines: [{ text: 'EPS · TPS실', size: 40, weight: 800 }] }, EPS_DOOR.x, 1.75, SPINE.z1 - 0.045, 'n', 0.36, 0.135);
  addInteract(f, ctx, `eps-${n}`, 'message', '문 확인', EPS_DOOR.x, 1.0, SPINE.z1 - 0.12, [0.9, 2.0, 0.2], { text: '통신·전기 설비실. 관리실 열쇠로만 열린다. 지금은 필요 없다.' }, 2.0);
  // hydrant cabinet
  ctx.deco(boxGeo(0.75, 1.05, 0.12), m.red, HYDRANT.x, 1.12, SPINE.z1 - 0.06);
  addSign(ctx, 'hydrant', { w: 384, h: 512, bg: '#c92a22', fg: '#fff', lines: [{ text: '옥내', size: 80, weight: 900 }, { text: '소화전', size: 80, weight: 900 }, { text: '비상시 열어 사용', size: 34, weight: 600 }] }, HYDRANT.x, 1.18, SPINE.z1 - 0.125, 'n', 0.6, 0.8);

  // ---- extinguisher stand (north wall) ----
  const exX = EXTINGUISHER_BOX.x + (mods.has('geo_extra_door') ? -1.35 : 0);
  ctx.deco(boxGeo(0.3, 0.6, 0.22), m.redDark, exX, 0.3, SPINE.z0 + 0.12);
  addSign(ctx, 'ext-sign', { w: 256, h: 128, bg: '#c92a22', fg: '#fff', lines: [{ text: '소화기', size: 70, weight: 900 }] }, exX, 1.13, SPINE.z0 + 0.004, 's', 0.3, 0.15); // above the chair rail, clear of the wainscot
  const ext = makeExtinguisher();
  if (mods.has('obj_extinguisher_moved')) {
    // standing alone in front of 05 (south side), turned slightly
    ext.position.set(UNIT_SLOTS[4].x + 0.9, y0, SPINE.z1 - 0.35);
    ext.rotation.y = 0.9;
    blob(ctx, ext.position.x, ext.position.z, 0.13);
  } else {
    ext.position.set(exX, y0 + 0.04, SPINE.z0 + 0.16);
  }
  f.group.add(ext);
  f.named.set('extinguisher', ext);

  // ---- exit signage ----
  const reversed = mods.has('obj_exit_sign_reversed');
  for (const x of [-8, -1.2, 6.2]) addGuidance(ctx, x, 0.95, SPINE.z1 - 0.025, 'n', reversed);
  // 'n'-facing sign on the south wall: viewer looks toward +z, so screen-right is -x... handled by texture direction
  // Exit sign above the stair door (beside it when the ceiling is too low to fit it above).
  // exit sign sits above the stair-door sign (both used to share y 2.35 and z-fought)
  const exitY = lowCeil ? 2.0 : 2.53;
  const exitZ = lowCeil ? -0.8 : 0;
  ctx.mesh(planeGeo(0.42, 0.155), signMat('exit-main', T.exitSignTex(), { emissive: 1.3 }), SPINE.x1 - 0.1, exitY, exitZ, -Math.PI / 2);
  ctx.deco(boxGeo(0.05, 0.17, 0.44), m.whitePlastic, SPINE.x1 - 0.06, exitY, exitZ);

  // ---- bulletin board in the hall (west wall) ----
  buildHallBoard(f, ctx, n, n === 5);

  // ---- signature prop ----
  if (props.signature && !mods.has('obj_prop_missing')) {
    const slot = UNIT_SLOTS.find((s) => s.idx === props.signature!.slot)!;
    const g = makeSignature(props.signature.kind);
    const wallZ = slot.side === -1 ? SPINE.z0 : SPINE.z1;
    g.position.set(slot.x - 0.9 * (slot.side === -1 ? -1 : 1), y0, wallZ - slot.side * 0.32);
    g.rotation.y = slot.side === -1 ? 0 : Math.PI;
    f.group.add(g);
    f.named.set('signature', g);
    blob(ctx, g.position.x, g.position.z, 0.35);
    ctx.collider(g.position.x - 0.35, g.position.x + 0.35, 0, 1.0, g.position.z - 0.25, g.position.z + 0.25);
  }

  // ---- anomaly props ----
  if (mods.has('obj_chair_center')) {
    const chair = makePlasticChair();
    chair.position.set(-3.4, y0, 0);
    chair.rotation.y = Math.PI / 2; // faces east, toward the elevator hall and the player coming from it
    f.group.add(chair);
    blob(ctx, -3.4, 0, 0.3);
    ctx.collider(-3.65, -3.15, 0, 0.9, -0.25, 0.25);
  }
  if (mods.has('obj_parcel_tower')) {
    const slot = UNIT_SLOTS[3];
    let y = 0;
    // 9 x 0.3 m = exactly floor-to-ceiling (an 11-box stack used to pierce the ceiling and z-fight it)
    for (let i = 0; i < 9; i++) {
      addParcel(ctx, slot.x - 0.9, SPINE.z0 + 0.35, (i % 3) * 0.05 - 0.05, [0.44, 0.3, 0.34], y, i === 8 ? `tower-lbl:${n}` : undefined, i === 8 ? `${unitNumber(n, 4)}호` : undefined);
      y += 0.3;
    }
    ctx.collider(slot.x - 1.15, slot.x - 0.65, 0, 3, SPINE.z0, SPINE.z0 + 0.55);
  }
  if (mods.has('obj_shoes_row')) {
    for (let i = 0; i < 7; i++) {
      const sh = makeShoes(i);
      sh.position.set(-10.8 + i * 0.42, y0, SPINE.z1 - 0.22);
      sh.rotation.y = Math.PI; // toes pointing at the wall
      f.group.add(sh);
    }
  }
  if (mods.has('hum_window_figure')) {
    const fig = makeFigure({ coat: m.fabricDark });
    fig.position.set(SPINE.x0 - extendWest + 0.45, y0, 0.05);
    fig.rotation.y = -Math.PI / 2; // facing the window, back to the corridor
    f.group.add(fig);
    f.named.set('windowFigure', fig);
  }
  if (mods.has('hum_cctv_only_figure')) {
    const fig = makeFigure({ coat: m.fabricDark });
    fig.position.set(UNIT_SLOTS[2].x - 0.9, y0, -0.35);
    fig.rotation.y = Math.PI / 2 + 0.25; // facing the CCTV camera at the east end
    setLayerRecursive(fig, LAYER_CCTV_ONLY);
    f.group.add(fig);
    f.named.set('cctvFigure', fig);
  }

  // ---- 5F photo exhibition ----
  if (n === 5) buildGallery(f, ctx, env);

  // ---- 12F vacant unit interior ----
  if (has1204) buildUnit1204(f, ctx, env);

  // ---- stairwell ----
  buildStairModule(f, ctx, env, {
    hasUp: true,
    hasDown: true,
    doorSignAt: lowCeil ? [2.0, 0.85] : [2.28, 0],
    signLabel: mods.has('sys_stair_sign') ? `${n + 2}F` : undefined,
  });

  return finishFloor(f, ctx);
}

function thirteenIndicator(): THREE.Texture {
  return T.cached('indicator-13', () => {
    const [c] = T.makeCanvas(128, 64);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#ff5a2a';
    ctx.font = `700 46px ${T.FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('13', 77, 35);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

function buildAjarDoor(f: FloorInstance, ctx: BuildCtx, x: number, wallZ: number): void {
  const m = mats();
  // dark gap behind the door: a black box inside the wall recess
  ctx.solid(x - 0.48, x + 0.48, 0, 2.1, wallZ + 0.02, wallZ + 0.3, m.black, { collide: false });
  // frame
  ctx.deco(boxGeo(0.07, 2.17, 0.06), m.doorFrame, x - 0.51, 1.085, wallZ - 0.01);
  ctx.deco(boxGeo(0.07, 2.17, 0.06), m.doorFrame, x + 0.51, 1.085, wallZ - 0.01);
  ctx.deco(boxGeo(1.1, 0.07, 0.06), m.doorFrame, x, 2.13, wallZ - 0.01);
  const door = addHingedDoor(f, ctx, {
    id: 'ajar',
    kind: 'unit',
    wallAxis: 'x',
    hingeAt: x + 0.48,
    width: 0.96,
    wallPos: wallZ + 0.01,
    towards: -1,
    swing: 1,
    mat: m.doorWood,
    locked: true,
    lockedMsg: '안에서 잠겼다.',
    label: '06호 현관문',
  });
  door.open = door.target = 0.16;
  // silhouette in the gap
  const fig = makeFigure({ coat: m.fabricDark });
  fig.position.set(x - 0.2, ctx.y0, wallZ + 0.45);
  fig.rotation.y = Math.PI;
  f.group.add(fig);
  f.named.set('ajarFigure', fig);
}

function buildUnit1204Door(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const x = 9.0;
  const wallZ = SPINE.z0;
  ctx.deco(boxGeo(0.07, 2.17, 0.06), m.doorFrame, x - 0.51, 1.085, wallZ + 0.01);
  ctx.deco(boxGeo(0.07, 2.17, 0.06), m.doorFrame, x + 0.51, 1.085, wallZ + 0.01);
  ctx.deco(boxGeo(1.1, 0.07, 0.06), m.doorFrame, x, 2.13, wallZ + 0.01);
  const unlocked = env.flags.unlockedDoors.has('unit-1204');
  addHingedDoor(f, ctx, {
    id: 'unit-1204',
    kind: 'unit',
    wallAxis: 'x',
    hingeAt: x - 0.48,
    width: 0.96,
    wallPos: wallZ - 0.02,
    towards: 1,
    swing: -1,
    mat: m.doorWood,
    locked: !unlocked,
    lockedMsg: '공실이다. 도어락 전원이 꺼져 있다. 관리실 마스터키가 필요하다.',
    label: '1204호 현관문',
    decorate: (leaf, w) => {
      const lock = new THREE.Mesh(boxGeo(0.075, 0.2, 0.035), m.darkPlastic);
      lock.position.set(w - 0.12, 1.2, 0.04);
      leaf.add(lock);
      const lever = new THREE.Mesh(boxGeo(0.14, 0.025, 0.05), m.chrome);
      lever.position.set(w - 0.16, 1.0, 0.045);
      leaf.add(lever);
      const tape = new THREE.Mesh(planeGeo(0.3, 0.42), signMat('vacant-notice', T.noticeTex('vacant-notice', vacantNoticeOpts())));
      tape.position.set(w / 2, 1.38, 0.028);
      leaf.add(tape);
    },
  });
}

function buildHallBoard(f: FloorInstance, ctx: BuildCtx, n: number, gallery: boolean): void {
  const m = mats();
  const x = HALL.x0 + 0.02;
  ctx.deco(boxGeo(0.03, 0.95, 1.5), m.woodDesk, x, 1.62, -2.35);
  ctx.deco(boxGeo(0.02, 0.87, 1.42), m.cardboardDark, x + 0.02, 1.62, -2.35);
  if (gallery) {
    noticePlane(ctx, 'gallery-poster', {
      w: 420,
      h: 594,
      title: '추억 사진전',
      titleColor: '#6b2f1a',
      headerBand: '#e9d8b4',
      body: '청운빌딩 32년, 우리들의 기억\n\n철거를 앞두고 입주민 여러분이 보내 주신 사진을 5층 복도에 전시합니다.\n\n기간: 9월 1일 ~ 철거 전까지\n액자는 만지지 말아 주세요.',
      footer: '청운빌딩 관리사무소',
      seed: 55,
    }, x + 0.035, 1.62, -2.72, 'e', 0.5);
  } else {
    noticePlane(ctx, 'notice-move', {
      w: 420,
      h: 594,
      title: '이주 안내',
      titleColor: '#8b1a1a',
      body: '청운빌딩 재개발 정비사업 이주 기간이 10월 31일 종료됩니다.\n\n미이주 세대는 조합 사무실로 연락 바랍니다.\n\n철거 예정일: 2026년 12월 1일',
      footer: '재개발정비사업조합',
      stamp: '조합',
      seed: 50 + n,
    }, x + 0.035, 1.62, -2.72, 'e', 0.46);
  }
  noticePlane(ctx, 'notice-elev', {
    w: 420,
    h: 594,
    title: '승강기 점검 안내',
    body: '매월 둘째 주 화요일 10:00 ~ 12:00 정기 점검이 있습니다.\n\n점검 중에는 비상계단을 이용해 주십시오.\n\n승강기 이상 시 관리실 (내선 0)',
    footer: '청운빌딩 관리사무소',
    seed: 60,
  }, x + 0.035, 1.66, -2.2, 'e', 0.4);
  noticePlane(ctx, 'notice-noise', {
    w: 420,
    h: 420,
    title: '야간 소음 자제',
    body: '밤 10시 이후 복도 통화, 문 쾅 닫기, 택배 상자 끌기를 삼가 주세요.',
    footer: '입주자대표회의',
    seed: 61,
  }, x + 0.035, 1.72, -1.78, 'e', 0.34);
  addInteract(f, ctx, `board-${n}`, 'inspect', '게시판 읽기', x + 0.15, 1.62, -2.35, [0.25, 1.0, 1.5], { board: gallery ? 'hall-gallery' : 'hall', floor: n }, 2.4);
}

function buildGallery(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  for (const fr of GALLERY_FRAMES) {
    const key = galleryImageKey(fr.id, env.mods, false, env.mods);
    const wallZ = fr.side === -1 ? SPINE.z0 : SPINE.z1;
    const photo = addFrame(ctx, fr.x, FRAME_Y, wallZ, fr.side, FRAME_W, FRAME_H, imageTexture(key as any), `frame:${fr.id}`);
    f.named.set(`frame:${fr.id}`, photo);
    const title = fr.title;
    addSign(ctx, `caption:${fr.id}:${title}`, captionOpts(title, fr.sub), fr.x, FRAME_Y - 0.5, wallZ - fr.side * 0.02, fr.side === -1 ? 's' : 'n', 0.42, 0.105);
    addInteract(f, ctx, `frame:${fr.id}`, 'inspect', '액자 살펴보기', fr.x, FRAME_Y - 0.1, wallZ - fr.side * 0.15, [1.0, 1.1, 0.25], { frame: fr.id, image: key, title, sub: fr.sub }, 2.6);
  }
  void floorLabel;
}

export function galleryFrame(id: string) {
  return GALLERY_FRAMES.find((g) => g.id === id)!;
}
