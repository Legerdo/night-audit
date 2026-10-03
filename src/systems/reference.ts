// Reference photographs: the baseline building is rebuilt deterministically (forReference = true)
// in an isolated scene and photographed from authored viewpoints. The live tablet copy can be
// corrupted by META anomalies; the Tier-A archive original never is.
import * as THREE from 'three';
import { floorY } from '../data/building';
import { LOCATION_BY_ID, type Shot } from '../data/locations';
import { buildCar } from '../world/elevatorCar';
import { buildFloorInstance, disposeGroup } from '../world/world';
import type { WorldFlags } from '../world/types';
import { PostPass, readTargetToCanvas } from './cctv';

const W = 640;
const H = 420;

export class ReferenceRenderer {
  private renderer: THREE.WebGLRenderer;
  private cache = new Map<string, HTMLCanvasElement>();
  private post = new PostPass();
  private raw = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 });
  private out = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
  private cam = new THREE.PerspectiveCamera(62, W / H, 0.1, 80);

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
  }

  /** Baseline flags used for reference builds: 13F closed, nothing picked up, act 1. */
  static baselineFlags(): WorldFlags {
    return { act: 1, f13Open: false, unlockedDoors: new Set(), pickedUp: new Set(), corrected: [], identityCompromised: false };
  }

  key(locId: string, shotId: string, mods: ReadonlySet<string>): string {
    return `${locId}|${shotId}|${[...mods].sort().join(',')}`;
  }

  has(locId: string, shotId: string, mods: ReadonlySet<string>): boolean {
    return this.cache.has(this.key(locId, shotId, mods));
  }

  /** Render (or fetch from cache) every shot of a location with the given builder mods. */
  shots(locId: string, mods: ReadonlySet<string>): { shot: Shot; canvas: HTMLCanvasElement }[] {
    const loc = LOCATION_BY_ID.get(locId);
    if (!loc || loc.shots.length === 0) return [];
    const missing = loc.shots.filter((s) => !this.cache.has(this.key(locId, s.id, mods)));
    if (missing.length > 0) this.renderLocation(locId, missing, mods);
    return loc.shots.map((s) => ({ shot: s, canvas: this.cache.get(this.key(locId, s.id, mods))! }));
  }

  private renderLocation(locId: string, shots: Shot[], mods: ReadonlySet<string>): void {
    const loc = LOCATION_BY_ID.get(locId)!;
    const n = loc.kind === 'elevator' ? 1 : loc.floor;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050506');
    scene.fog = new THREE.Fog('#070708', 7, 32);
    scene.add(new THREE.HemisphereLight('#a7b0bb', '#1b1814', 0.5));
    const inst = buildFloorInstance(n, { mods, flags: ReferenceRenderer.baselineFlags(), forReference: true });
    scene.add(inst.group);
    for (const d of inst.doors.values()) d.pivot.rotation.y = 0;
    const lights = [...inst.lights];
    let car: ReturnType<typeof buildCar> | null = null;
    if (loc.kind === 'elevator') {
      car = buildCar({ withMirror: false });
      car.inst.group.position.y = floorY(1);
      scene.add(car.inst.group);
      for (const a of car.inst.lights) lights.push({ ...a, pos: a.pos.clone().setY(a.pos.y + floorY(1)) });
    }
    const pls: THREE.PointLight[] = [];
    for (let i = 0; i < 12; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 2);
      scene.add(l);
      pls.push(l);
    }
    const y0 = floorY(n);
    for (const s of shots) {
      const cam = this.cam;
      cam.fov = s.fov;
      cam.updateProjectionMatrix();
      cam.position.set(s.pos[0], y0 + s.pos[1], s.pos[2]);
      cam.lookAt(s.target[0], y0 + s.target[1], s.target[2]);
      // light the photo with the fixtures nearest to the viewpoint (reference photos: all fixtures working)
      const sorted = lights
        .filter((a) => a.mode !== 'off')
        .sort((a, b) => a.pos.distanceToSquared(cam.position) - b.pos.distanceToSquared(cam.position));
      pls.forEach((l, i) => {
        const a = sorted[i];
        if (!a) {
          l.intensity = 0;
          return;
        }
        l.position.copy(a.pos);
        l.color.copy(a.color);
        l.distance = a.distance;
        l.intensity = a.intensity * a.gain;
        if (a.mat) a.mat.emissiveIntensity = a.baseEmissive;
      });
      this.renderer.setRenderTarget(this.raw);
      this.renderer.clear();
      this.renderer.render(scene, cam);
      this.post.run(this.renderer, this.raw.texture, this.out, { mode: 1, exposure: 1.3, time: 0 }, null);
      const c = document.createElement('canvas');
      readTargetToCanvas(this.renderer, this.out, c);
      this.cache.set(this.key(locId, s.id, mods), c);
    }
    this.renderer.setRenderTarget(null);
    disposeGroup(inst.group);
    if (car) disposeGroup(car.inst.group);
    scene.clear();
  }

  clear(): void {
    this.cache.clear();
  }
}
