// Shared corridor spine: slab, ceiling, walls with openings, elevator hall, landing doors, fixtures, CCTV.
import * as THREE from 'three';
import { CEIL_H, CCTV_POS, HALL, LIGHT_XS, SPINE, floorLabel } from '../data/building';
import { BuildCtx, boxGeo, planeGeo } from './kit';
import { mats, signMat } from './materials';
import { addFixture, addInteract, addSign } from './common';
import type { FloorInstance, LightMode } from './types';
import * as T from './textures';

/** How far wall trims protrude from the wall face (m). Distinct depths = no coplanar faces. */
export const TRIM = { wainscot: 0.012, base: 0.02, rail: 0.025 };
/** Thickness of the elevator landing wall, built between the hall and the shaft. */
export const LANDING_WALL = 0.15;

export interface SpineStyle {
  wall: THREE.Material;
  floor: THREE.Material;
  ceiling: THREE.Material;
  wainscot: THREE.Material | null;
  ceilH: number;
  hallCeilH?: number;
  lightColor: string;
  lightKind: 'tube' | 'bulb' | 'panel';
  lightIntensity: number;
  lightModes?: Record<number, LightMode>;
  /** openings in north / south spine walls */
  northOpenings: { x0: number; x1: number; y1: number; y0?: number }[];
  southOpenings: { x0: number; x1: number; y1: number; y0?: number }[];
  westWindow: boolean;
  lightXs?: number[];
  extendWest?: number; // corridor-extension anomaly (metres)
}

export const hallIndicatorCanvas = (() => {
  const [c] = T.makeCanvas(128, 64);
  return c;
})();
export const hallIndicatorTex = new THREE.CanvasTexture(hallIndicatorCanvas);
hallIndicatorTex.colorSpace = THREE.SRGBColorSpace;

export function drawIndicator(c: HTMLCanvasElement, text: string, dir: -1 | 0 | 1): void {
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#ff5a2a';
  ctx.font = `700 ${Math.round(c.height * 0.72)}px ${T.FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width * 0.6, c.height * 0.54);
  if (dir !== 0) {
    ctx.beginPath();
    const x = c.width * 0.18;
    const y = c.height * 0.5;
    const s = c.height * 0.25;
    ctx.moveTo(x, y - s * dir);
    ctx.lineTo(x - s, y + s * dir);
    ctx.lineTo(x + s, y + s * dir);
    ctx.closePath();
    ctx.fill();
  }
}

export function buildSpine(f: FloorInstance, ctx: BuildCtx, s: SpineStyle): void {
  const m = mats();
  const west = SPINE.x0 - (s.extendWest ?? 0);
  const { x1, z0, z1 } = SPINE;
  const h = s.ceilH;
  // floor + ceiling
  ctx.floor(west, x1, z0, z1, s.floor, 0.9);
  ctx.floor(HALL.x0, HALL.x1, HALL.z0, z0, s.floor, 0.9);
  const hallH = s.hallCeilH ?? h;
  ctx.ceiling(west, x1, z0, z1, s.ceiling, h);
  ctx.ceiling(HALL.x0, HALL.x1, HALL.z0 + LANDING_WALL, z0, s.ceiling, hallH); // ends at the landing wall face
  if (hallH > h) {
    // soffit where the lowered corridor ceiling meets the taller hall
    ctx.solid(HALL.x0, HALL.x1, h - 0.002, hallH + 0.05, z0 - 0.02, z0 + 0.02, s.wall, { collide: false }); // 2 mm below the ceiling plane
  }
  // north wall (with hall opening)
  const north = [{ x0: HALL.x0, x1: HALL.x1, y1: 99 }, ...s.northOpenings];
  ctx.wallX(z0 - 0.075, west, x1, CEIL_H + 0.3, s.wall, north.map((o) => ({ ...o, y1: Math.min(o.y1, CEIL_H + 0.3) })));
  ctx.wallX(z1 + 0.075, west, x1, CEIL_H + 0.3, s.wall, s.southOpenings);
  // west end wall with optional window
  if (s.westWindow) {
    ctx.wallZ(west - 0.075, z0, z1, CEIL_H + 0.3, s.wall, [{ z0: -0.7, z1: 0.7, y0: 0.9, y1: 2.1 }]);
    // window frame + glass + night city beyond
    ctx.deco(boxGeo(0.08, 1.24, 1.5), m.metalGray, west - 0.03, 1.5, 0);
    const glass = ctx.mesh(planeGeo(1.4, 1.2), m.glass, west - 0.02, 1.5, 0, Math.PI / 2);
    glass.renderOrder = 2;
    ctx.deco(boxGeo(0.04, 1.2, 0.04), m.metalGray, west - 0.02, 1.5, 0);
    ctx.deco(boxGeo(0.22, 0.04, 1.5), m.metalGray, west + 0.03, 0.9, 0);
    const city = ctx.mesh(planeGeo(40, 20), m.city, west - 18, 1.5 - ctx.y0 * 0.15 + 2, 0, Math.PI / 2);
    city.name = 'cityBackdrop';
    f.named.set('city', city); // only the current storey's backdrop is shown (stacked ones are coplanar)
  } else {
    ctx.wallZ(west - 0.075, z0, z1, CEIL_H + 0.3, s.wall);
  }
  // East end: closed by the stairwell module's west wall (x 11.925–12.075, same door opening).
  // A second corridor wall here used to overlap it and z-fought at the door jambs and lintel.
  // hall walls
  ctx.wallZ(HALL.x0 - 0.075, HALL.z0, z0, CEIL_H + 0.3, s.wall);
  ctx.wallZ(HALL.x1 + 0.075, HALL.z0, z0, CEIL_H + 0.3, s.wall);
  // Hall back wall sits IN FRONT of the shaft (z -3.6..-3.45). The car's front face is at z -3.6, so the car
  // never shares a plane with the wall or pokes through it while travelling between floors.
  ctx.wallX(HALL.z0 + LANDING_WALL / 2, HALL.x0, HALL.x1, CEIL_H + 0.3, s.wall, [{ x0: -0.5, x1: 0.5, y1: 2.1 }], LANDING_WALL);
  // wainscot + baseboard
  if (s.wainscot) {
    const segsN = segmentsExcluding(west, x1, north);
    // Trims sit IN FRONT of the wall face (never flush with it) so they cannot z-fight the paint:
    // wall face → wainscot +12 mm → baseboard +20 mm → chair rail +25 mm. They start 1 mm off the wall.
    for (const [a, b] of segsN) ctx.solid(a + 0.003, b - 0.003, 0, 1.0, z0 + 0.001, z0 + TRIM.wainscot, s.wainscot, { collide: false, uvM: 1.2 });
    for (const [a, b] of segmentsExcluding(west, x1, s.southOpenings)) ctx.solid(a + 0.003, b - 0.003, 0, 1.0, z1 - TRIM.wainscot, z1 - 0.001, s.wainscot, { collide: false, uvM: 1.2 });
    // chair rail on top of the wainscot, interrupted by openings (hall, lobby bay, service windows)
    for (const [a, b] of segmentsExcluding(west, x1, north)) ctx.solid(a, b, 0.995, 1.04, z0 + 0.002, z0 + TRIM.rail, m.baseboard, { collide: false });
    for (const [a, b] of segmentsExcluding(west, x1, s.southOpenings)) ctx.solid(a, b, 0.995, 1.04, z1 - TRIM.rail, z1 - 0.002, m.baseboard, { collide: false });
  }
  for (const [a, b] of segmentsExcluding(west, x1, north)) ctx.solid(a, b, 0.001, 0.09, z0 + 0.002, z0 + TRIM.base, m.baseboard, { collide: false });
  for (const [a, b] of segmentsExcluding(west, x1, s.southOpenings)) ctx.solid(a, b, 0.001, 0.09, z1 - TRIM.base, z1 - 0.002, m.baseboard, { collide: false });

  // lights
  const xs = s.lightXs ?? LIGHT_XS;
  const extra = s.extendWest ? [west + 2] : [];
  [...extra, ...xs].forEach((x, i) => {
    const idx = i - extra.length;
    const a = addFixture(f, ctx, x, 0, h, { color: s.lightColor, kind: s.lightKind, intensity: s.lightIntensity, mode: s.lightModes?.[idx] ?? 'on', seed: 100 + i });
    a.tag = idx >= 0 ? `spine:${idx}` : 'spine:ext';
  });
  addFixture(f, ctx, 0, -2.35, hallH, { color: s.lightColor, kind: s.lightKind === 'tube' ? 'panel' : s.lightKind, intensity: s.lightIntensity * 0.8 });

  // CCTV dome at the east end, looking west
  const dome = ctx.mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.glassDark, CCTV_POS.x, h - 0.01, CCTV_POS.z);
  dome.rotation.x = Math.PI;
  ctx.deco(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), m.whitePlastic, CCTV_POS.x, h - 0.015, CCTV_POS.z);
  f.cctv.push({
    id: `corr-${f.n}`,
    label: `${floorLabel(f.n)} 복도`,
    floor: f.n,
    pos: new THREE.Vector3(CCTV_POS.x - 0.1, ctx.y0 + h - 0.15, CCTV_POS.z),
    target: new THREE.Vector3(-8, ctx.y0 + 0.9, -0.1),
    fov: 62,
  });
}

function segmentsExcluding(a: number, b: number, ops: { x0: number; x1: number }[]): [number, number][] {
  const sorted = ops.slice().sort((p, q) => p.x0 - q.x0);
  const out: [number, number][] = [];
  let cur = a;
  for (const o of sorted) {
    if (o.x0 > cur) out.push([cur, o.x0]);
    cur = Math.max(cur, o.x1);
  }
  if (cur < b) out.push([cur, b]);
  return out;
}

/** Elevator landing doors, frame, call button, indicator. */
export function buildElevatorLanding(f: FloorInstance, ctx: BuildCtx, o: { indicatorTex?: THREE.Texture; frameMat?: THREE.Material } = {}): void {
  const m = mats();
  const z = HALL.z0 + LANDING_WALL; // hall-side face of the landing wall
  const frame = o.frameMat ?? m.stainless;
  // Frame lines the opening 5 mm proud of the wall caps (x ±0.5, lintel y 2.1) so no face is coplanar.
  ctx.deco(boxGeo(0.1, 2.2, 0.08), frame, -0.545, 1.1, z + 0.02);
  ctx.deco(boxGeo(0.1, 2.2, 0.08), frame, 0.545, 1.1, z + 0.02);
  ctx.deco(boxGeo(1.2, 0.12, 0.08), frame, 0, 2.155, z + 0.02);
  const left = new THREE.Group();
  const right = new THREE.Group();
  const panelGeo = boxGeo(0.52, 2.1, 0.035);
  const lp = new THREE.Mesh(panelGeo, m.stainless);
  lp.position.set(-0.25, 1.05, 0);
  left.add(lp);
  const rp = new THREE.Mesh(panelGeo, m.stainless);
  rp.position.set(0.25, 1.05, 0);
  right.add(rp);
  // Leaves run inside the landing wall and slide into its pockets when opening (never in front of it).
  // They overlap 2 cm at the seam, so the right leaf sits 4 mm further out to avoid a coplanar overlap.
  const zLeaf = z - LANDING_WALL / 2;
  left.position.set(0, ctx.y0, zLeaf);
  right.position.set(0, ctx.y0, zLeaf + 0.004);
  f.group.add(left, right);
  const collider = { x0: -0.5, x1: 0.5, y0: ctx.y0, y1: ctx.y0 + 2.1, z0: z - LANDING_WALL, z1: z + 0.01, tag: 'landing' };
  f.colliders.push(collider);
  // indicator
  const ind = ctx.mesh(planeGeo(0.3, 0.15), new THREE.MeshBasicMaterial({ map: o.indicatorTex ?? hallIndicatorTex }), 0, 2.42, z + 0.02); // in front of its 15 mm-deep housing
  ctx.deco(boxGeo(0.36, 0.2, 0.03), m.black, 0, 2.42, z + 0.0);
  // call button panel (right of door)
  ctx.deco(boxGeo(0.12, 0.26, 0.02), m.stainless, 0.85, 1.12, z + 0.01);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#dddddd', emissive: new THREE.Color('#ff7a2a'), emissiveIntensity: 0, roughness: 0.3 });
  ctx.mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16).rotateX(Math.PI / 2), lampMat, 0.85, 1.17, z + 0.025);
  ctx.mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16).rotateX(Math.PI / 2), m.whitePlastic, 0.85, 1.06, z + 0.025);
  addInteract(f, ctx, `call-${f.n}`, 'elevator_call', '승강기 호출', 0.85, 1.12, z + 0.1, [0.25, 0.35, 0.2], { floor: f.n }, 2.0);
  f.landing = { left, right, collider, indicator: ind, callLamp: lampMat };
  // floor number plaque inside the hall (east wall)
  void signMat;
}

export function floorPlaque(ctx: BuildCtx, n: number, label: string, style: 'modern' | '94' = 'modern'): THREE.Mesh {
  const opts: T.SignOpts =
    style === 'modern'
      ? { w: 384, h: 384, bg: '#2f3d52', fg: '#ffffff', radius: 16, lines: [{ text: label, size: 190, weight: 900 }, { text: '층', size: 70, weight: 700, color: '#cfd8e6' }] }
      : { w: 384, h: 384, bg: '#6e5a3a', fg: '#f4e7c4', radius: 6, lines: [{ text: label, size: 190, weight: 800 }, { text: '층', size: 70, weight: 600 }] };
  return addSign(ctx, `plaque:${style}:${label}:${n}`, opts, HALL.x1 - 0.005, 1.65, -2.35, 'w', 0.45, 0.45);
}
