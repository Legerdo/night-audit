// World: owns the scene graph, all floor instances, the elevator car, light pool, doors and spatial queries.
import * as THREE from 'three';
import { B1, FLOOR_13, FLOOR_H, TOP_FLOOR, floorY } from '../data/building';
import type { AABB, Walkable } from './kit';
import { walkHeight } from './kit';
import { buildResidential } from './residential';
import { buildLobby } from './lobby';
import { buildBasement } from './basement';
import { buildShops } from './shops';
import { buildFloor13 } from './floor13';
import { buildCar, type CarBuild, CAR_FLOOR_ID } from './elevatorCar';
import type { BuildEnv, DoorObj, FloorInstance, Interactable, LightAnchor, WorldFlags } from './types';
import { LAYER_CCTV_ONLY, LAYER_MIRROR_ONLY } from './types';

export const ALL_FLOORS = [B1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, FLOOR_13];

export function buildFloorInstance(n: number, env: BuildEnv): FloorInstance {
  if (n === B1) return buildBasement(env);
  if (n === 1) return buildLobby(env);
  if (n === 2) return buildShops(env);
  if (n === FLOOR_13) return buildFloor13(env);
  return buildResidential(n, env);
}

/** Deterministic flicker pattern (no Math.random): same seed + time => same brightness. */
export function flickerValue(seed: number, t: number): number {
  const period = 7 + (seed % 5);
  const phase = (t + seed * 1.37) % period;
  // a short burst of stutter once per period, otherwise steady
  if (phase < 0.9) {
    const k = Math.floor(phase * 14);
    const bits = (seed * 2654435761 + k * 40503) >>> 0;
    return (bits >>> 7) % 3 === 0 ? 0.08 : 1;
  }
  return 1;
}

class LightPool {
  lights: THREE.PointLight[] = [];
  constructor(scene: THREE.Scene, count: number) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 2);
      l.position.set(0, -500, 0);
      scene.add(l);
      this.lights.push(l);
    }
  }
}

export class World {
  scene = new THREE.Scene();
  floors = new Map<number, FloorInstance>();
  car!: CarBuild;
  carY = 0;
  flags!: WorldFlags;
  modsByFloor = new Map<number, Set<string>>();
  pool: LightPool;
  hemi: THREE.HemisphereLight;
  flashlight: THREE.SpotLight;
  flashTarget = new THREE.Object3D();
  globalGain = 1;
  time = 0;
  onDoorAutoClose: ((d: DoorObj) => void) | null = null;
  /** floors forced visible (e.g. by CCTV rendering) */
  private visibleNow = new Set<number>();
  private _v = new THREE.Vector3();

  constructor() {
    this.scene.background = new THREE.Color('#050506');
    this.scene.fog = new THREE.Fog('#070708', 7, 32);
    this.hemi = new THREE.HemisphereLight('#a7b0bb', '#1b1814', 0.42);
    this.scene.add(this.hemi);
    this.pool = new LightPool(this.scene, 10);
    this.flashlight = new THREE.SpotLight('#fff3dc', 0, 16, 0.42, 0.55, 1.6);
    this.scene.add(this.flashlight, this.flashTarget);
    this.flashlight.target = this.flashTarget;
  }

  init(flags: WorldFlags, mods: Map<number, Set<string>>): void {
    this.flags = flags;
    this.modsByFloor = mods;
    for (const n of ALL_FLOORS) this.rebuildFloor(n);
    this.car = buildCar({ withMirror: true });
    this.scene.add(this.car.inst.group);
    this.setCarY(floorY(1));
  }

  env(n: number, forReference = false): BuildEnv {
    return { mods: this.modsByFloor.get(n) ?? new Set(), flags: this.flags, forReference };
  }

  rebuildFloor(n: number): void {
    const old = this.floors.get(n);
    // keep door states that matter across rebuilds (open doors stay open)
    const doorStates = new Map<string, number>();
    if (old) {
      for (const [id, d] of old.doors) doorStates.set(id, d.target);
      this.scene.remove(old.group);
      disposeGroup(old.group);
    }
    const inst = buildFloorInstance(n, this.env(n));
    for (const [id, d] of inst.doors) {
      const t = doorStates.get(id);
      if (t !== undefined && !d.locked && d.kind !== 'unit') {
        d.target = t;
        d.open = t;
        d.pivot.rotation.y = d.maxAngle * t;
      } else d.pivot.rotation.y = d.maxAngle * d.open;
    }
    this.floors.set(n, inst);
    this.scene.add(inst.group);
    inst.group.visible = false;
  }

  setCarY(y: number): void {
    this.carY = y;
    this.car.inst.group.position.y = y;
  }

  /** Floor index containing a world-space feet height. */
  floorAt(y: number): number {
    const n = Math.floor((y + 0.6) / FLOOR_H) + 1;
    return Math.max(B1, Math.min(FLOOR_13, n));
  }

  updateVisibility(playerY: number, extra: number[] = []): void {
    const cur = this.floorAt(playerY);
    this.visibleNow.clear();
    for (const n of [cur - 1, cur, cur + 1, ...extra]) this.visibleNow.add(n);
    for (const [n, f] of this.floors) f.group.visible = this.visibleNow.has(n);
    this.primaryNow = cur;
    this.showBackdrops(cur);
  }

  private primaryNow = 1;

  /** The west-window city backdrops of stacked floors are coplanar: show only the primary floor's. */
  private showBackdrops(primary: number): void {
    for (const [n, f] of this.floors) {
      const city = f.named.get('city');
      if (city) city.visible = n === primary;
    }
  }

  setOnlyVisible(ns: number[]): void {
    const set = new Set(ns);
    for (const [n, f] of this.floors) f.group.visible = set.has(n);
    this.showBackdrops(ns[0]);
  }

  restoreVisibility(): void {
    for (const [n, f] of this.floors) f.group.visible = this.visibleNow.has(n);
    this.showBackdrops(this.primaryNow);
  }

  /** Active floors for collisions/interaction near a height. */
  nearFloors(y: number): FloorInstance[] {
    const cur = this.floorAt(y);
    const out: FloorInstance[] = [];
    for (const n of [cur - 1, cur, cur + 1]) {
      const f = this.floors.get(n);
      if (f) out.push(f);
    }
    return out;
  }

  collidersNear(y: number, out: AABB[]): AABB[] {
    out.length = 0;
    for (const f of this.nearFloors(y)) for (const c of f.colliders) if (!c.off) out.push(c);
    const cy = this.carY;
    for (const c of this.car.inst.colliders) {
      if (c.off) continue;
      out.push({ x0: c.x0, x1: c.x1, y0: c.y0 + cy, y1: c.y1 + cy, z0: c.z0, z1: c.z1, tag: c.tag });
    }
    return out;
  }

  /** Highest walkable surface under (x,z) not above feet + step. */
  groundAt(x: number, z: number, feetY: number, step = 0.5): number | null {
    let best: number | null = null;
    const consider = (w: Walkable, dy: number) => {
      if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) return;
      const h = walkHeight(w, x) + dy;
      if (h <= feetY + step && (best === null || h > best)) best = h;
    };
    for (const f of this.nearFloors(feetY)) for (const w of f.walkables) consider(w, 0);
    for (const w of this.car.inst.walkables) consider(w, this.carY);
    return best;
  }

  interactablesNear(y: number): Interactable[] {
    const out: Interactable[] = [];
    for (const f of this.nearFloors(y)) out.push(...f.interactables);
    out.push(...this.car.inst.interactables);
    return out;
  }

  door(id: string): DoorObj | undefined {
    for (const f of this.floors.values()) {
      const d = f.doors.get(id);
      if (d) return d;
    }
    return undefined;
  }

  allLights(): LightAnchor[] {
    const out: LightAnchor[] = [];
    for (const f of this.floors.values()) out.push(...f.lights);
    return out;
  }

  lightValue(a: LightAnchor): number {
    let v = 1;
    if (a.mode === 'off') v = 0;
    else if (a.mode === 'dim') v = 0.35;
    else if (a.mode === 'flicker') v = flickerValue(a.seed, this.time);
    return v * a.gain * this.globalGain;
  }

  /** Assign the pooled point lights to the anchors nearest `pos` on the given floors. */
  assignLights(pos: THREE.Vector3, floors: number[], includeCar: boolean): void {
    const cands: { a: LightAnchor; d: number; y: number }[] = [];
    for (const n of floors) {
      const f = this.floors.get(n);
      if (!f) continue;
      // vertical distance is weighted heavily: a fixture one storey up lights nothing we can see
      for (const a of f.lights) {
        const dy = (a.pos.y - pos.y) * 3;
        cands.push({ a, d: (a.pos.x - pos.x) ** 2 + (a.pos.z - pos.z) ** 2 + dy * dy, y: 0 });
      }
    }
    if (includeCar) {
      for (const a of this.car.inst.lights) {
        this._v.copy(a.pos);
        this._v.y += this.carY;
        const dy = (this._v.y - pos.y) * 3;
        cands.push({ a, d: (this._v.x - pos.x) ** 2 + (this._v.z - pos.z) ** 2 + dy * dy, y: this.carY });
      }
    }
    cands.sort((p, q) => p.d - q.d);
    const lights = this.pool.lights;
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const c = cands[i];
      if (!c) {
        l.intensity = 0;
        continue;
      }
      l.position.copy(c.a.pos);
      l.position.y += c.y;
      l.color.copy(c.a.color);
      l.distance = c.a.distance;
      l.intensity = c.a.intensity * this.lightValue(c.a);
    }
  }

  /** Emissive fixture glow follows light modes for every fixture on visible floors. */
  updateFixtures(): void {
    for (const f of this.floors.values()) {
      if (!f.group.visible) continue;
      for (const a of f.lights) if (a.mat) a.mat.emissiveIntensity = a.baseEmissive * this.lightValue(a);
    }
    for (const a of this.car.inst.lights) if (a.mat) a.mat.emissiveIntensity = a.baseEmissive * this.lightValue(a);
  }

  updateDoors(dt: number, playerPos: THREE.Vector3): void {
    for (const f of this.floors.values()) {
      if (!f.group.visible) continue;
      for (const d of f.doors.values()) {
        if (d.target > 0 && d.autoClose > 0) {
          d.openTimer += dt;
          const near = Math.hypot(playerPos.x - d.center.x, playerPos.z - d.center.z) < 1.3 && Math.abs(playerPos.y - (d.center.y - 1)) < 1.5;
          if (d.openTimer > d.autoClose && !near) {
            d.target = 0;
            d.openTimer = 0;
            this.onDoorAutoClose?.(d);
          }
        }
        if (Math.abs(d.open - d.target) > 0.0005) {
          const speed = d.kind === 'fire' ? 1.3 : 1.6;
          const dir = Math.sign(d.target - d.open);
          d.open = Math.max(0, Math.min(1, d.open + dir * speed * dt));
          if ((dir > 0 && d.open > d.target) || (dir < 0 && d.open < d.target)) d.open = d.target;
          // eased hinge motion for weight
          const e = d.open * d.open * (3 - 2 * d.open);
          d.pivot.rotation.y = d.maxAngle * e;
        }
        d.collider.off = d.open > 0.35;
      }
      for (const u of f.updaters) u(dt, this.time);
    }
  }

  /** Enable CCTV/mirror-only layers on special cameras. */
  static configureCctvCamera(cam: THREE.Camera): void {
    cam.layers.enable(LAYER_CCTV_ONLY);
  }
  static configureMirrorCamera(cam: THREE.Camera): void {
    cam.layers.enable(LAYER_CCTV_ONLY);
    cam.layers.enable(LAYER_MIRROR_ONLY);
  }

  allCctv() {
    const out = [];
    for (const f of this.floors.values()) out.push(...f.cctv);
    return out;
  }

  isTop(n: number): boolean {
    return n === TOP_FLOOR;
  }

  carFloorId(): number {
    return CAR_FLOOR_ID;
  }
}

export function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      // shared materials are owned by materials.ts; only dispose per-instance ones
      const mat = mesh.material as THREE.Material & { userData?: { owned?: boolean } };
      if (mat && (mat as any).userData?.owned) mat.dispose();
    }
  });
}
