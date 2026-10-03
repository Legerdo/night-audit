// Shared construction helpers for all floors.
import * as THREE from 'three';
import { BuildCtx, boxGeo, planeGeo } from './kit';
import { fixtureMaterial, mats, signMat } from './materials';
import * as T from './textures';
import type { DoorKind, DoorObj, FloorInstance, InteractKind, Interactable, LightAnchor, LightMode } from './types';
import { getImage, type ImageKey } from '../data/imageAssets';

export function newFloor(n: number, mods: ReadonlySet<string>): FloorInstance {
  const group = new THREE.Group();
  group.name = `floor-${n}`;
  return {
    n,
    group,
    colliders: [],
    walkables: [],
    lights: [],
    doors: new Map(),
    interactables: [],
    named: new Map(),
    cctv: [],
    landing: null,
    updaters: [],
    mods,
  };
}

export function finishFloor(f: FloorInstance, ctx: BuildCtx): FloorInstance {
  ctx.finish();
  f.colliders.push(...ctx.colliders);
  f.walkables.push(...ctx.walkables);
  return f;
}

/** Ceiling light fixture + light anchor. */
export function addFixture(
  f: FloorInstance,
  ctx: BuildCtx,
  x: number,
  z: number,
  h: number,
  o: { along?: 'x' | 'z'; color?: string; intensity?: number; distance?: number; mode?: LightMode; seed?: number; kind?: 'tube' | 'bulb' | 'panel' } = {},
): LightAnchor {
  const m = mats();
  const color = o.color ?? '#eaf1ff';
  const kind = o.kind ?? 'tube';
  const mat = fixtureMaterial(color, kind === 'bulb' ? 3.0 : 2.4);
  if (kind === 'bulb') {
    ctx.deco(new THREE.CylinderGeometry(0.06, 0.08, 0.08, 10), m.beigePlastic, x, h - 0.04, z);
    ctx.mesh(new THREE.SphereGeometry(0.07, 12, 8), mat, x, h - 0.13, z);
  } else if (kind === 'panel') {
    ctx.deco(boxGeo(0.62, 0.05, 0.62), m.whitePlastic, x, h - 0.025, z);
    ctx.mesh(boxGeo(0.56, 0.01, 0.56), mat, x, h - 0.055, z);
  } else {
    const alongX = (o.along ?? 'x') === 'x';
    ctx.deco(boxGeo(alongX ? 1.25 : 0.3, 0.07, alongX ? 0.3 : 1.25), m.whitePlastic, x, h - 0.035, z);
    ctx.mesh(boxGeo(alongX ? 1.18 : 0.2, 0.012, alongX ? 0.2 : 1.18), mat, x, h - 0.075, z);
  }
  const a: LightAnchor = {
    pos: new THREE.Vector3(x, ctx.y0 + h - 0.3, z),
    mat,
    color: new THREE.Color(color),
    intensity: o.intensity ?? 5.2,
    distance: o.distance ?? 7.5,
    mode: o.mode ?? 'on',
    seed: o.seed ?? Math.abs(Math.round(x * 13 + z * 7 + ctx.y0)),
    baseEmissive: kind === 'bulb' ? 3.0 : 2.4,
    gain: 1,
    floor: f.n,
  };
  f.lights.push(a);
  return a;
}

/** Flat sign plane facing a direction. dir: 'n'|'s'|'e'|'w' = the direction the sign FACES. */
export function facingRot(dir: 'n' | 's' | 'e' | 'w'): number {
  switch (dir) {
    case 's':
      return 0; // faces +z
    case 'n':
      return Math.PI; // faces -z
    case 'e':
      return Math.PI / 2; // faces +x
    case 'w':
      return -Math.PI / 2; // faces -x
  }
}

export function addSign(
  ctx: BuildCtx,
  key: string,
  opts: T.SignOpts,
  x: number,
  y: number,
  z: number,
  dir: 'n' | 's' | 'e' | 'w',
  wM: number,
  hM: number,
  emissive = 0,
): THREE.Mesh {
  const tex = T.signTex(key, opts);
  const mat = signMat(key, tex, { emissive });
  const mesh = ctx.mesh(planeGeo(wM, hM), mat, x, y, z, facingRot(dir));
  return mesh;
}

export function addTexturedPlane(ctx: BuildCtx, tex: THREE.Texture, key: string, x: number, y: number, z: number, dir: 'n' | 's' | 'e' | 'w', wM: number, hM: number, emissive = 0): THREE.Mesh {
  return ctx.mesh(planeGeo(wM, hM), signMat(key, tex, { emissive }), x, y, z, facingRot(dir));
}

const imgTexCache = new Map<string, THREE.Texture>();
export function imageTexture(key: ImageKey): THREE.Texture {
  let t = imgTexCache.get(key);
  if (!t) {
    const img = getImage(key);
    t = img instanceof HTMLCanvasElement ? new THREE.CanvasTexture(img) : new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    imgTexCache.set(key, t);
  }
  return t;
}

export function addInteract(f: FloorInstance, ctx: BuildCtx, id: string, kind: InteractKind, prompt: string, x: number, y: number, z: number, size: [number, number, number], data?: Record<string, unknown>, range = 2.2): Interactable {
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), invisibleMat);
  proxy.position.set(x, ctx.y0 + y, z);
  proxy.visible = false;
  proxy.userData.interactId = id;
  f.group.add(proxy);
  const it: Interactable = { id, kind, object: proxy, prompt, data, floor: f.n, range };
  f.interactables.push(it);
  return it;
}
const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });

/**
 * Hinged door. Pivot at the hinge edge. Door plane lies in the wall; `wallAxis` is the axis the wall runs along.
 * openDir: +1/-1 = which side it swings into (along the wall normal).
 */
export function addHingedDoor(
  f: FloorInstance,
  ctx: BuildCtx,
  o: {
    id: string;
    kind: DoorKind;
    wallAxis: 'x' | 'z';
    hingeAt: number; // coordinate along wall axis of the hinge edge
    width: number;
    wallPos: number; // coordinate of wall plane (z for 'x' walls, x for 'z' walls)
    towards: 1 | -1; // leaf extends from hinge in + or - along wall axis
    swing: 1 | -1; // opens toward +normal or -normal
    height?: number;
    mat: THREE.Material;
    locked?: boolean;
    lockedMsg?: string;
    autoClose?: number;
    label: string;
    prompt?: string;
    thickness?: number;
    decorate?: (leaf: THREE.Group, w: number, h: number) => void;
  },
): DoorObj {
  const h = o.height ?? 2.1;
  const t = o.thickness ?? 0.05;
  const pivot = new THREE.Group();
  const leaf = new THREE.Group();
  const slab = new THREE.Mesh(boxGeo(o.width, h, t), o.mat);
  slab.position.set((o.width / 2) * o.towards, h / 2, 0);
  leaf.add(slab);
  o.decorate?.(leaf, o.width, h);
  pivot.add(leaf);
  if (o.wallAxis === 'x') {
    pivot.position.set(o.hingeAt, ctx.y0, o.wallPos);
  } else {
    pivot.position.set(o.wallPos, ctx.y0, o.hingeAt);
    pivot.rotation.y = -Math.PI / 2; // local +x now maps to world +z
  }
  f.group.add(pivot);
  const lo = Math.min(o.hingeAt, o.hingeAt + o.width * o.towards);
  const hi = Math.max(o.hingeAt, o.hingeAt + o.width * o.towards);
  const collider =
    o.wallAxis === 'x'
      ? { x0: lo, x1: hi, y0: ctx.y0, y1: ctx.y0 + h, z0: o.wallPos - 0.08, z1: o.wallPos + 0.08, tag: `door:${o.id}` }
      : { x0: o.wallPos - 0.08, x1: o.wallPos + 0.08, y0: ctx.y0, y1: ctx.y0 + h, z0: lo, z1: hi, tag: `door:${o.id}` };
  f.colliders.push(collider);
  // swing sign: rotation direction so leaf moves to the requested side.
  const maxAngle = Math.PI * 0.52 * o.swing * o.towards * (o.wallAxis === 'x' ? -1 : 1);
  const center = o.wallAxis === 'x' ? new THREE.Vector3((lo + hi) / 2, ctx.y0 + 1, o.wallPos) : new THREE.Vector3(o.wallPos, ctx.y0 + 1, (lo + hi) / 2);
  const door: DoorObj = {
    id: o.id,
    kind: o.kind,
    pivot: leaf,
    open: 0,
    target: 0,
    maxAngle,
    collider,
    locked: o.locked ?? false,
    lockedMsg: o.lockedMsg ?? '잠겨 있다.',
    autoClose: o.autoClose ?? 0,
    openTimer: 0,
    label: o.label,
    floor: f.n,
    center,
  };
  f.doors.set(o.id, door);
  const nx = o.wallAxis === 'x' ? (lo + hi) / 2 : o.wallPos;
  const nz = o.wallAxis === 'x' ? o.wallPos : (lo + hi) / 2;
  addInteract(f, ctx, `door:${o.id}`, 'door', o.prompt ?? '문 열기', nx, 1.05, nz, o.wallAxis === 'x' ? [o.width, 2.0, 0.3] : [0.3, 2.0, o.width], { door: o.id }, 2.4);
  return door;
}

/** Korean apartment front door detail (surface mounted on a wall, not enterable). */
export function addUnitDoorStatic(ctx: BuildCtx, x: number, wallZ: number, side: -1 | 1, mat: THREE.Material, style: 'modern' | '94' = 'modern'): void {
  const m = mats();
  const face = wallZ - side * 0.02; // side -1 (north wall) => door faces +z
  const out = -side; // outward normal direction (into corridor)
  const W = 0.96;
  const H = 2.1;
  // frame
  ctx.deco(boxGeo(0.07, H + 0.07, 0.06), m.doorFrame, x - W / 2 - 0.035, (H + 0.07) / 2, face + out * 0.01);
  ctx.deco(boxGeo(0.07, H + 0.07, 0.06), m.doorFrame, x + W / 2 + 0.035, (H + 0.07) / 2, face + out * 0.01);
  ctx.deco(boxGeo(W + 0.14, 0.07, 0.06), m.doorFrame, x, H + 0.035, face + out * 0.01);
  // leaf
  ctx.deco(boxGeo(W, H, 0.045), mat, x, H / 2, face + out * 0.005);
  const latch = x + (side === -1 ? 1 : -1) * (W / 2 - 0.12);
  const fz = face + out * 0.035;
  if (style === 'modern') {
    // digital door lock + lever
    ctx.deco(boxGeo(0.075, 0.2, 0.035), m.darkPlastic, latch, 1.2, fz);
    ctx.deco(boxGeo(0.05, 0.08, 0.01), m.stainlessDark, latch, 1.25, fz + out * 0.02);
    ctx.deco(boxGeo(0.14, 0.025, 0.05), m.chrome, latch - (side === -1 ? 0.04 : -0.04), 1.0, fz + out * 0.01);
    ctx.deco(boxGeo(0.06, 0.12, 0.03), m.chrome, latch, 1.0, fz);
  } else {
    ctx.deco(new THREE.SphereGeometry(0.035, 10, 8), m.brass, latch, 1.0, fz);
    ctx.deco(boxGeo(0.06, 0.14, 0.012), m.brass, latch, 1.0, fz - out * 0.01);
  }
  // peephole
  ctx.deco(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 8).rotateX(Math.PI / 2), m.chrome, x, 1.55, fz);
  // newspaper slot
  // 3.5 mm proud of the leaf face (it used to sit 0.5 mm off it)
  ctx.deco(boxGeo(0.26, 0.05, 0.01), style === '94' ? m.brass : m.stainlessDark, x, 0.72, fz - out * 0.009);
  // threshold stops at the frame jambs and floats 1 mm above the floor (no shared faces)
  ctx.deco(boxGeo(W - 0.004, 0.02, 0.18), m.stainlessDark, x, 0.011, wallZ - side * 0.09);
}

export function plateOpts(num: string, style: 'modern' | '94' = 'modern'): T.SignOpts {
  return style === 'modern'
    ? { w: 256, h: 128, bg: '#e8e4da', fg: '#1d2a3a', border: '#8b8578', radius: 10, lines: [{ text: `${num}호`, size: 64, weight: 800 }] }
    : { w: 256, h: 128, bg: '#b99a55', fg: '#2a1d0c', radius: 4, border: '#6b5324', lines: [{ text: num, size: 70, weight: 700 }] };
}

export function addPlate(ctx: BuildCtx, num: string, x: number, wallZ: number, side: -1 | 1, style: 'modern' | '94' = 'modern'): void {
  const latchSide = side === -1 ? 1 : -1;
  addSign(ctx, `plate:${style}:${num}`, plateOpts(num, style), x + latchSide * 0.78, 1.62, wallZ - side * 0.012, side === -1 ? 's' : 'n', 0.24, 0.12);
}

export function vacantNoticeOpts(): T.NoticeOpts {
  return {
    w: 300,
    h: 420,
    title: '이주 완료 세대',
    titleColor: '#8b1a1a',
    body: '본 세대는 재개발 이주가 완료되었습니다.\n무단 출입 및 폐기물 투기를 금합니다.\n\n청운빌딩 재개발정비사업조합',
    seed: 5,
  };
}

/** Cardboard parcel with a code-rendered label. */
export function addParcel(ctx: BuildCtx, x: number, z: number, rot: number, size: [number, number, number], y = 0, labelKey?: string, label?: string): void {
  const m = mats();
  ctx.deco(boxGeo(size[0], size[1], size[2]), (Math.round(x * 10 + z * 10) & 1) === 0 ? m.cardboard : m.cardboardDark, x, y + size[1] / 2, z, rot);
  ctx.deco(boxGeo(size[0] + 0.004, 0.035, size[2] * 0.25), m.tape, x, y + size[1] + 0.0, z, rot); // 2 mm proud of the box sides
  if (labelKey && label) {
    const tex = T.signTex(labelKey, { w: 256, h: 160, bg: '#f4f4f0', fg: '#111', lines: [{ text: 'CJ 택배', size: 26, weight: 800 }, { text: label, size: 34, weight: 700 }], pad: 10 });
    const mat = signMat(labelKey, tex);
    const g = planeGeo(size[0] * 0.55, size[0] * 0.34).rotateX(-Math.PI / 2);
    ctx.deco(g, mat, x, y + size[1] + 0.02, z, rot);
  }
}

export function blob(ctx: BuildCtx, x: number, z: number, r: number): void {
  const g = new THREE.CircleGeometry(r, 16).rotateX(-Math.PI / 2);
  const mesh = ctx.mesh(g, mats().blobShadow, x, 0.004, z);
  mesh.renderOrder = 1;
}

/** Fire extinguisher (red cylinder, handle, hose). Returned as a group for anomalies. */
export function makeExtinguisher(): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.46, 16), m.red);
  body.position.y = 0.23;
  g.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.red);
  top.position.y = 0.46;
  g.add(top);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 8), m.black);
  valve.position.y = 0.55;
  g.add(valve);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.035), m.black);
  handle.position.set(0.04, 0.6, 0);
  g.add(handle);
  const hose = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI), m.rubber);
  hose.position.set(0.09, 0.45, 0);
  hose.rotation.z = -Math.PI / 2;
  g.add(hose);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.14, 16, 1, true, -0.8, 1.6), m.whitePlastic);
  label.position.y = 0.26;
  g.add(label);
  return g;
}

/** Plastic chair (for the corridor-chair anomaly). */
export function makePlasticChair(color = '#d8d8d2'): THREE.Group {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const g = new THREE.Group();
  const seat = new THREE.Mesh(boxGeo(0.44, 0.04, 0.42), mat);
  seat.position.y = 0.44;
  g.add(seat);
  const back = new THREE.Mesh(boxGeo(0.44, 0.42, 0.04), mat);
  back.position.set(0, 0.68, -0.2);
  back.rotation.x = -0.12;
  g.add(back);
  for (const [lx, lz] of [
    [-0.19, -0.18],
    [0.19, -0.18],
    [-0.19, 0.18],
    [0.19, 0.18],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), mat);
    leg.position.set(lx, 0.22, lz);
    g.add(leg);
  }
  return g;
}

export function makeShoes(style: number): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  const mat = style % 3 === 0 ? m.black : style % 3 === 1 ? m.fabricBrown : m.whitePlastic;
  for (const s of [-1, 1]) {
    const shoe = new THREE.Mesh(boxGeo(0.1, 0.08, 0.27), mat);
    shoe.position.set(s * 0.065, 0.04, 0);
    g.add(shoe);
  }
  return g;
}

/** Framed photograph (photo exhibition / interiors). Returns the photo mesh for texture swaps. */
export function addFrame(ctx: BuildCtx, x: number, y: number, wallZ: number, side: -1 | 1, w: number, h: number, tex: THREE.Texture, key: string): THREE.Mesh {
  const m = mats();
  const out = -side;
  // Layers from the wall out, every face on its own plane (the photo used to be flush with the mat):
  //   frame  wall+1 mm .. wall+31 mm
  //   mat    wall+6 mm .. wall+34 mm   (3 mm proud of the frame)
  //   photo  wall+37 mm                (3 mm proud of the mat)
  ctx.deco(boxGeo(w + 0.14, h + 0.14, 0.03), m.black, x, y, wallZ + out * 0.016);
  ctx.deco(boxGeo(w + 0.08, h + 0.08, 0.028), m.paper, x, y, wallZ + out * 0.02);
  const photo = ctx.mesh(planeGeo(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), x, y, wallZ + out * 0.037, side === -1 ? 0 : Math.PI);
  photo.name = key;
  return photo;
}

export function captionOpts(title: string, sub: string): T.SignOpts {
  return { w: 512, h: 128, bg: '#efeadf', fg: '#222', border: '#bdb5a3', lines: [{ text: title, size: 38, weight: 800 }, { text: sub, size: 28, weight: 500, color: '#555' }] };
}

export function addExitSign(ctx: BuildCtx, x: number, y: number, z: number, dir: 'n' | 's' | 'e' | 'w'): THREE.Mesh {
  const m = mats();
  const rot = facingRot(dir);
  const back = ctx.mesh(boxGeo(0.44, 0.17, 0.05), m.whitePlastic, x, y, z, rot);
  back.name = 'exitBox';
  const tex = T.exitSignTex();
  const mesh = ctx.mesh(planeGeo(0.42, 0.155), signMat('exit-main', tex, { emissive: 1.3 }), x + Math.sin(rot) * 0.03, y, z + Math.cos(rot) * 0.03, rot);
  return mesh;
}

/** Low guidance light (통로 유도등) with an arrow. */
export function addGuidance(ctx: BuildCtx, x: number, y: number, z: number, dir: 'n' | 's' | 'e' | 'w', arrowRight: boolean): THREE.Mesh {
  const m = mats();
  const rot = facingRot(dir);
  ctx.deco(boxGeo(0.36, 0.14, 0.04), m.whitePlastic, x, y, z, rot);
  const tex = T.guidanceTex(arrowRight);
  return ctx.mesh(planeGeo(0.34, 0.12), signMat(`guid-${arrowRight}`, tex, { emissive: 1.0 }), x + Math.sin(rot) * 0.022, y, z + Math.cos(rot) * 0.022, rot);
}

export function signText(ctx: BuildCtx, key: string, text: string, sub: string | null, x: number, y: number, z: number, dir: 'n' | 's' | 'e' | 'w', w: number, h: number, colors: { bg: string; fg: string; border?: string } = { bg: '#2e3b4e', fg: '#f3f3f3' }): THREE.Mesh {
  const lines = sub ? [{ text, size: 60, weight: 800 }, { text: sub, size: 30, weight: 500 }] : [{ text, size: 66, weight: 800 }];
  return addSign(ctx, key, { w: 512, h: Math.round((512 * h) / w), bg: colors.bg, fg: colors.fg, border: colors.border, lines, radius: 8 }, x, y, z, dir, w, h);
}

export function noticePlane(ctx: BuildCtx, key: string, o: T.NoticeOpts, x: number, y: number, z: number, dir: 'n' | 's' | 'e' | 'w', wM: number): THREE.Mesh {
  const tex = T.noticeTex(key, o);
  return ctx.mesh(planeGeo(wM, (wM * o.h) / o.w), signMat(key, tex), x, y, z, facingRot(dir));
}
