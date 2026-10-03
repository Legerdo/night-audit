// 13F: the floor that does not exist. Built only as a rooftop landing until the story opens it.
import * as THREE from 'three';
import { CEIL_H, FLOOR_13, SPINE, UNIT_SLOTS, FLOOR_PROPS, unitNumber, floorY } from '../data/building';
import { BuildCtx, boxGeo, planeGeo } from './kit';
import { mats, signMat } from './materials';
import * as T from './textures';
import {
  addFixture,
  addFrame,
  addHingedDoor,
  addInteract,
  addPlate,
  addSign,
  addUnitDoorStatic,
  finishFloor,
  imageTexture,
  makeExtinguisher,
  makePlasticChair,
  makeShoes,
  newFloor,
  noticePlane,
  addParcel,
} from './common';
import { buildElevatorLanding, buildSpine, floorPlaque } from './corridor';
import { buildStairModule } from './stair';
import { makeSignature, makeVendingMachine } from './props';
import { makeFigure } from './figure';
import { missingPosterCanvas } from './lobby';
import type { BuildEnv, FloorInstance } from './types';

export const UNIT1301 = { x0: -12, x1: -7.3, z0: -6.6, z1: -1.25 };

export function buildFloor13(env: BuildEnv): FloorInstance {
  const n = FLOOR_13;
  const f = newFloor(n, env.mods);
  const y0 = floorY(n);
  const ctx = new BuildCtx(f.group, y0);
  const m = mats();
  const open = env.flags.f13Open;

  buildStairModule(f, ctx, env, {
    hasUp: false,
    hasDown: true,
    signLabel: open ? '13F' : 'RF',
    doorLocked: !open,
    doorLockedMsg: '옥상 출입문. 잠겨 있다. "옥상 출입 금지 — 관리실 문의"',
    noCorridorSign: !open,
  });
  if (!open) {
    // rooftop door notice on the stair side
    noticePlane(ctx, 'roof-notice', { w: 360, h: 260, title: '옥상 출입 금지', titleColor: '#b01818', body: '안전사고 예방을 위해 옥상 출입을 통제합니다.\n관리실 문의', seed: 13 }, 12.09, 1.5, 0.9, 'e', 0.34);
    return finishFloor(f, ctx);
  }

  buildSpine(f, ctx, {
    wall: m.wall94,
    floor: m.floor94,
    ceiling: m.ceiling94,
    wainscot: m.doorGreen94,
    ceilH: CEIL_H - 0.1,
    lightColor: '#ffb867',
    lightKind: 'bulb',
    lightIntensity: 3.4,
    lightModes: { 1: 'dim', 4: 'off' },
    northOpenings: [{ x0: -9.98, x1: -9.02, y1: 2.1 }],
    southOpenings: [],
    westWindow: true,
  });
  // older, dimmer city beyond the window (fewer lit windows)
  const city = f.group.getObjectByName('cityBackdrop') as THREE.Mesh | undefined;
  if (city) city.material = new THREE.MeshBasicMaterial({ map: T.cityTex(1994), fog: false, color: '#b9a88c' });
  buildElevatorLanding(f, ctx, { frameMat: m.brass });
  floorPlaque(ctx, 13, '13', '94');

  for (const slot of UNIT_SLOTS) {
    const wallZ = slot.side === -1 ? SPINE.z0 : SPINE.z1;
    const num = unitNumber(13, slot.idx);
    if (slot.idx === 1) {
      build1301Door(f, ctx, env);
    } else {
      addUnitDoorStatic(ctx, slot.x, wallZ, slot.side, m.doorGreen94, '94');
      addInteract(f, ctx, `unit:${num}`, 'unit_door', '문 두드리기', slot.x, 1.1, wallZ - slot.side * 0.12, [0.95, 2.0, 0.2], { unit: num }, 2.0);
    }
    const plateNum = slot.idx === 8 && env.flags.identityCompromised ? '1308 한서진' : num;
    addPlate(ctx, plateNum, slot.x, wallZ, slot.side, '94');
  }
  // bulletin (1994)
  ctx.deco(boxGeo(0.03, 0.95, 1.5), m.woodDesk, -1.58, 1.62, -2.35);
  noticePlane(ctx, 'ban-1994', { w: 420, h: 594, paper: '#efe4c4', title: '반상회 안내', body: '11월 반상회를 아래와 같이 개최합니다.\n\n일시: 1994년 11월 2일 저녁 7시\n장소: 1301호\n\n13층 입주 가구는 빠짐없이 참석 바랍니다.', footer: '13층 반장', seed: 1994 }, -1.545, 1.62, -2.7, 'e', 0.46);
  ctx.mesh(planeGeo(0.3, 0.4), signMat('cal-1994-11', T.calendarTex(1994, 11, '청운건설 (주)', [2])), -1.545, 1.65, -1.9, Math.PI / 2);
  addInteract(f, ctx, 'board-13', 'inspect', '게시판 읽기', -1.45, 1.62, -2.35, [0.25, 1.0, 1.5], { board: 'f13' }, 2.4);

  // Tonight's corrections, kept here.
  placeCorrected(f, ctx, env);
  // 박정호's last log by 1308
  if (!env.flags.pickedUp.has('D4')) {
    ctx.deco(boxGeo(0.24, 0.02, 0.32), m.binderGray, 4.1, 0.01, 0.6, 0.4);
    addInteract(f, ctx, 'pickup:D4', 'pickup', '바닥의 근무 일지 줍기', 4.1, 0.2, 0.6, [0.5, 0.5, 0.5], { record: 'D4' }, 2.0);
  }
  // old CCTV housing (the 13F channel)
  f.cctv.push({ id: 'corr-13', label: '13층 복도', floor: 13, pos: new THREE.Vector3(11.2, y0 + 2.45, 0.75), target: new THREE.Vector3(-8, y0 + 0.9, -0.1), fov: 62 });

  build1301(f, ctx, env);
  return finishFloor(f, ctx);
}

function build1301Door(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const x = -9.5;
  const wallZ = SPINE.z0;
  ctx.deco(boxGeo(0.07, 2.17, 0.06), m.doorFrame, x - 0.51, 1.085, wallZ + 0.01);
  ctx.deco(boxGeo(0.07, 2.17, 0.06), m.doorFrame, x + 0.51, 1.085, wallZ + 0.01);
  ctx.deco(boxGeo(1.1, 0.07, 0.06), m.doorFrame, x, 2.13, wallZ + 0.01);
  addHingedDoor(f, ctx, {
    id: 'unit-1301',
    kind: 'unit',
    wallAxis: 'x',
    hingeAt: x - 0.48,
    width: 0.96,
    wallPos: wallZ - 0.02,
    towards: 1,
    swing: -1,
    mat: m.doorGreen94,
    locked: !env.flags.unlockedDoors.has('unit-1301'),
    lockedMsg: '문고리가 차갑다. 안에서 텔레비전 소리가 난다. 열리지 않는다.',
    label: '1301호 현관문',
    decorate: (leaf, w) => {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), m.brass);
      knob.position.set(w - 0.12, 1.0, 0.05);
      leaf.add(knob);
    },
  });
}

function build1301(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const { x0, x1, z0 } = UNIT1301;
  const H = 2.4;
  ctx.floor(x0, x1, z0, SPINE.z0, m.floorJangpan, 1.0);
  ctx.ceiling(x0, x1, z0, SPINE.z0 - 0.15, m.ceiling94, H);
  ctx.wallZ(x0 - 0.075, z0, SPINE.z0 - 0.15, H + 0.2, m.wall94);
  ctx.wallZ(x1 + 0.075, z0, SPINE.z0 - 0.15, H + 0.2, m.wall94);
  ctx.wallX(z0 - 0.075, x0, x1, H + 0.2, m.wall94);
  // sofa + low table + CRT with static
  ctx.solid(-11.9, -9.9, 0, 0.42, -6.5, -5.8, m.fabricBrown, { uvM: 0.5 });
  ctx.solid(-11.9, -9.9, 0.42, 0.85, -6.55, -6.35, m.fabricBrown, { collide: false });
  ctx.solid(-11.4, -10.4, 0.3, 0.34, -5.2, -4.6, m.woodDesk);
  const tvStatic = T.makeCanvas(128, 96);
  const staticTex = new THREE.CanvasTexture(tvStatic[0]);
  staticTex.colorSpace = THREE.SRGBColorSpace;
  ctx.solid(-8.4, -7.5, 0, 0.55, -3.6, -2.9, m.woodDesk);
  ctx.deco(boxGeo(0.6, 0.5, 0.5), m.darkPlastic, -7.95, 0.8, -3.25);
  const screen = ctx.mesh(planeGeo(0.44, 0.34), new THREE.MeshBasicMaterial({ map: staticTex }), -8.26, 0.82, -3.25, -Math.PI / 2);
  screen.name = 'tvStatic';
  let acc = 0;
  f.updaters.push((dt) => {
    acc += dt;
    if (acc < 0.06) return;
    acc = 0;
    const g = tvStatic[1];
    const img = g.createImageData(128, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 200;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    staticTex.needsUpdate = true;
  });
  // family photo of 1301 on the wall
  addFrame(ctx, -10.9, 1.55, z0, -1, 0.56, 0.42, imageTexture('archive_1301_family'), 'frame:1301');
  addInteract(f, ctx, 'frame-1301', 'inspect', '벽에 걸린 사진 보기', -10.9, 1.5, z0 + 0.3, [0.8, 0.8, 0.3], { image: 'archive_1301_family', title: '1301호 거실의 가족사진', sub: '뒷면: 1994. 10. 입주 기념', flag: 'saw1301' }, 2.4);
  ctx.mesh(planeGeo(0.3, 0.4), signMat('cal-1994-11', T.calendarTex(1994, 11, '청운건설 (주)', [2])), x1 - 0.005, 1.6, -4.4, -Math.PI / 2);
  // guard's cap on a hook
  ctx.deco(new THREE.CylinderGeometry(0.11, 0.12, 0.08, 14), m.fabricBlue, x1 - 0.1, 1.72, -2.2);
  ctx.deco(boxGeo(0.14, 0.01, 0.1), m.black, x1 - 0.15, 1.69, -2.2);
  addFixture(f, ctx, -9.6, -4.0, H, { kind: 'bulb', color: '#ffb35c', intensity: 2.2, distance: 5 });
  void env;
}

/** Physical souvenirs of anomalies the player corrected tonight. */
function placeCorrected(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const y0 = ctx.y0;
  let k = 0;
  const spots: [number, number, number][] = [
    [-6.2, 0.55, Math.PI],
    [-3.2, -0.55, 0],
    [-0.8, 0.6, Math.PI],
    [2.2, -0.6, 0],
    [3.4, 0.6, Math.PI],
    [6.0, -0.6, 0],
    [7.6, 0.55, Math.PI],
    [-7.9, -0.6, 0],
    [9.8, 0.6, Math.PI],
    [-11.0, 0.5, Math.PI],
  ];
  const next = () => spots[k++ % spots.length];
  const wallItems: [number, -1 | 1][] = [
    [-7.25, -1],
    [-2.6, 1],
    [2.8, -1],
    [-7.2, 1],
    [6.8, -1],
  ];
  let w = 0;
  for (const entry of env.flags.corrected) {
    const [id, floorStr] = entry.split('@');
    const fl = Number(floorStr);
    switch (id) {
      case 'obj_vending_duplicate': {
        const [x, z] = next();
        const vm = makeVendingMachine();
        vm.position.set(x, y0, z > 0 ? SPINE.z1 - 0.42 : SPINE.z0 + 0.42);
        vm.rotation.y = z > 0 ? Math.PI : 0;
        f.group.add(vm);
        ctx.collider(x - 0.5, x + 0.5, 0, 1.8, vm.position.z - 0.4, vm.position.z + 0.4);
        break;
      }
      case 'obj_chair_center': {
        const [x] = next();
        const ch = makePlasticChair();
        ch.position.set(x, y0, 0);
        ch.rotation.y = Math.PI / 2;
        f.group.add(ch);
        break;
      }
      case 'obj_parcel_tower': {
        const [x, z] = next();
        for (let i = 0; i < 6; i++) addParcel(ctx, x, z, i * 0.07, [0.44, 0.3, 0.34], i * 0.3);
        break;
      }
      case 'obj_shoes_row': {
        const [x, z] = next();
        for (let i = 0; i < 4; i++) {
          const s = makeShoes(i);
          s.position.set(x - 0.6 + i * 0.4, y0, z);
          f.group.add(s);
        }
        break;
      }
      case 'obj_extinguisher_moved': {
        const [x, z] = next();
        const e = makeExtinguisher();
        e.position.set(x, y0, z);
        f.group.add(e);
        break;
      }
      case 'obj_prop_missing': {
        const sig = FLOOR_PROPS[fl]?.signature;
        if (!sig) break;
        const [x, z] = next();
        const g = makeSignature(sig.kind);
        g.position.set(x, y0, z);
        f.group.add(g);
        break;
      }
      case 'hum_window_figure':
      case 'hum_cctv_only_figure':
      case 'hum_door_ajar_watch':
      case 'hum_mirror_figure': {
        const [x, z] = next();
        const fig = makeFigure({ coat: m.fabricDark });
        fig.position.set(x, y0, z * 0.6);
        fig.rotation.y = Math.PI / 2; // all of them face the elevator
        f.group.add(fig);
        break;
      }
      case 'img_family_extra_person':
      case 'img_ceremony_gaze':
      case 'img_ceremony_both':
      case 'img_missing_poster_empty': {
        const [wx, side] = wallItems[w++ % wallItems.length];
        const wallZ = side === -1 ? SPINE.z0 : SPINE.z1;
        if (id === 'img_missing_poster_empty') {
          const tex = T.canvasTexture(missingPosterCanvas(true));
          ctx.mesh(planeGeo(0.42, 0.594), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), wx, 1.6, wallZ - side * 0.02, side === -1 ? 0 : Math.PI);
        } else {
          const key = id === 'img_family_extra_person' ? 'gallery_family_anomaly' : 'gallery_ceremony_anomaly';
          addFrame(ctx, wx, 1.55, wallZ, side, 0.8, 0.6, imageTexture(key), `c13:${id}`);
        }
        break;
      }
      case 'geo_extra_door': {
        const [wx, side] = wallItems[w++ % wallItems.length];
        addUnitDoorStatic(ctx, wx, side === -1 ? SPINE.z0 : SPINE.z1, side, m.doorWood);
        break;
      }
      default:
        break;
    }
  }
  // The corrections ledger: every correction tonight, typed out on a sheet by the hall.
  const lines = env.flags.corrected.length ? `오늘 밤 정정된 항목 ${env.flags.corrected.length}건.\n모두 이 층에 보관함.` : '정정된 항목 없음.';
  noticePlane(ctx, `ledger13:${env.flags.corrected.length}`, { w: 360, h: 300, paper: '#efe4c4', title: '보관 목록', body: lines, footer: '13층 관리', seed: 131 }, 1.545, 1.5, -2.6, 'w', 0.34);
  void boxGeo;
  void addSign;
}
