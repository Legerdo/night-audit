// Modular building kit: world-scaled UV boxes, static batching, colliders and walkable surfaces.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface AABB {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  tag?: string;
  /** temporarily disabled (open door etc.) */
  off?: boolean;
}

/** Flat or ramped walkable rectangle. Ramps interpolate along X. */
export interface Walkable {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
  /** if set, surface height goes from y at x0 to y1 at x1 */
  y1?: number;
  tag?: string;
}

export function walkHeight(w: Walkable, x: number): number {
  if (w.y1 === undefined) return w.y;
  const t = (x - w.x0) / (w.x1 - w.x0);
  return w.y + (w.y1 - w.y) * Math.min(1, Math.max(0, t));
}

/** Box geometry whose UVs tile at `uvM` metres per texture repeat. */
export function boxGeo(w: number, h: number, d: number, uvM = 1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * (dims[f][0] / uvM), uv.getY(i) * (dims[f][1] / uvM));
    }
  }
  uv.needsUpdate = true;
  g.userData.worldUV = uvM;
  return g;
}

export function planeGeo(w: number, h: number, uvM = 0): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  if (uvM > 0) {
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / uvM), uv.getY(i) * (h / uvM));
    uv.needsUpdate = true;
  }
  return g;
}

/** Collects static meshes and merges them per material to keep draw calls low. */
export class Batcher {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  /** World height treated as v = 0 for world-space UVs (the storey's floor level). */
  uvOriginY = 0;

  add(geo: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const uvM = geo.userData.worldUV as number | undefined;
    if (uvM) worldSpaceUV(g, uvM, this.uvOriginY);
    // keep attributes consistent for merge
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    }
    let list = this.buckets.get(mat);
    if (!list) {
      list = [];
      this.buckets.set(mat, list);
    }
    list.push(g);
    geo.dispose();
  }

  build(parent: THREE.Object3D): void {
    for (const [mat, list] of this.buckets) {
      if (list.length === 0) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.userData.static = true;
      parent.add(mesh);
    }
    this.buckets.clear();
  }
}

/**
 * Re-map UVs of axis-aligned faces from world position (metres / uvM). Two boxes of the same
 * material whose faces happen to be coplanar then sample identical texels at every point, so any
 * residual depth fight between them is invisible, and textures run seamlessly across wall segments.
 * Faces that are not axis-aligned keep their box-local UVs.
 */
function worldSpaceUV(g: THREE.BufferGeometry, uvM: number, originY: number): void {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  if (!pos || !nor || !uv) return;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i) - originY;
    const z = pos.getZ(i);
    if (nx > 0.999) uv.setXY(i, z / uvM, y / uvM);
    else if (nz > 0.999) uv.setXY(i, x / uvM, y / uvM);
    else if (ny > 0.999) uv.setXY(i, x / uvM, z / uvM);
  }
  uv.needsUpdate = true;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

export function matrixAt(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  return _m.clone().compose(_p, _q, _s);
}

/** Builder context shared by room builders. */
export class BuildCtx {
  batch = new Batcher();
  colliders: AABB[] = [];
  walkables: Walkable[] = [];
  root: THREE.Group;
  y0: number;

  constructor(root: THREE.Group, y0: number) {
    this.root = root;
    this.y0 = y0;
    this.batch.uvOriginY = y0;
  }

  /** Static axis-aligned box given min/max corners (y relative to floor). */
  solid(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material, opts: { collide?: boolean; uvM?: number; tag?: string } = {}): void {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    if (w <= 0.0001 || h <= 0.0001 || d <= 0.0001) return;
    this.batch.add(boxGeo(w, h, d, opts.uvM ?? 1), mat, matrixAt((x0 + x1) / 2, this.y0 + (y0 + y1) / 2, (z0 + z1) / 2));
    if (opts.collide !== false) this.colliders.push({ x0, x1, y0: this.y0 + y0, y1: this.y0 + y1, z0, z1, tag: opts.tag });
  }

  collider(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tag?: string): AABB {
    const c = { x0, x1, y0: this.y0 + y0, y1: this.y0 + y1, z0, z1, tag };
    this.colliders.push(c);
    return c;
  }

  floor(x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, uvM = 0.9, y = 0, thickness = 0.2): void {
    this.batch.add(boxGeo(x1 - x0, thickness, z1 - z0, uvM), mat, matrixAt((x0 + x1) / 2, this.y0 + y - thickness / 2, (z0 + z1) / 2));
    this.walkables.push({ x0, x1, z0, z1, y: this.y0 + y });
  }

  ceiling(x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, h: number, uvM = 1.2): void {
    this.batch.add(boxGeo(x1 - x0, 0.05, z1 - z0, uvM), mat, matrixAt((x0 + x1) / 2, this.y0 + h + 0.025, (z0 + z1) / 2));
  }

  /** Wall running along X at depth z (thickness t), with openings [x0,x1,yTop]. */
  wallX(z: number, x0: number, x1: number, h: number, mat: THREE.Material, openings: { x0: number; x1: number; y1: number; y0?: number }[] = [], t = 0.15, uvM = 1): void {
    const ops = openings.slice().sort((a, b) => a.x0 - b.x0);
    let cur = x0;
    for (const o of ops) {
      if (o.x0 > cur) this.solid(cur, o.x0, 0, h, z - t / 2, z + t / 2, mat, { uvM });
      if (o.y1 < h) this.solid(o.x0, o.x1, o.y1, h, z - t / 2, z + t / 2, mat, { uvM });
      if (o.y0 && o.y0 > 0) this.solid(o.x0, o.x1, 0, o.y0, z - t / 2, z + t / 2, mat, { uvM });
      cur = o.x1;
    }
    if (cur < x1) this.solid(cur, x1, 0, h, z - t / 2, z + t / 2, mat, { uvM });
  }

  /** Wall running along Z at x. */
  wallZ(x: number, z0: number, z1: number, h: number, mat: THREE.Material, openings: { z0: number; z1: number; y1: number; y0?: number }[] = [], t = 0.15, uvM = 1): void {
    const ops = openings.slice().sort((a, b) => a.z0 - b.z0);
    let cur = z0;
    for (const o of ops) {
      if (o.z0 > cur) this.solid(x - t / 2, x + t / 2, 0, h, cur, o.z0, mat, { uvM });
      if (o.y1 < h) this.solid(x - t / 2, x + t / 2, o.y1, h, o.z0, o.z1, mat, { uvM });
      if (o.y0 && o.y0 > 0) this.solid(x - t / 2, x + t / 2, 0, o.y0, o.z0, o.z1, mat, { uvM });
      cur = o.z1;
    }
    if (cur < z1) this.solid(x - t / 2, x + t / 2, 0, h, cur, z1, mat, { uvM });
  }

  /** Non-colliding static decoration mesh. */
  deco(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0, rx = 0): void {
    this.batch.add(geo, mat, matrixAt(x, this.y0 + y, z, ry, rx));
  }

  /** Separate (non-batched) mesh, returned for dynamic control. */
  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, this.y0 + y, z);
    m.rotation.y = ry;
    (parent ?? this.root).add(m);
    return m;
  }

  finish(): void {
    this.batch.build(this.root);
  }
}
