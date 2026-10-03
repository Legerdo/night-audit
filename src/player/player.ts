// First-person controller: mouse look, WASD, circle-vs-AABB collision, walkable surfaces, head bob.
import * as THREE from 'three';
import type { Input } from '../core/input';
import type { Settings } from '../core/settings';
import type { AABB } from '../world/kit';
import type { World } from '../world/world';

export const EYE = 1.62;
const RADIUS = 0.28;

export class Player {
  camera: THREE.PerspectiveCamera;
  pos = new THREE.Vector3(); // feet
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  frozen = false;
  /** additive camera offset for shakes (reduced-motion aware) */
  shake = 0;
  private bobPhase = 0;
  private bobAmt = 0;
  private stepAcc = 0;
  private cols: AABB[] = [];
  onStep: ((surface: string) => void) | null = null;
  moving = false;
  lookSmoothing = 0;
  private smoothY = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  teleport(x: number, y: number, z: number, yaw?: number, pitch = 0): void {
    this.pos.set(x, y, z);
    this.smoothY = y;
    if (yaw !== undefined) this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0, 0);
    this.applyCamera(0, null);
  }

  /** Seamless vertical relocation (stair loop): keeps camera smoothing continuous. */
  shiftY(dy: number): void {
    this.pos.y += dy;
    this.smoothY += dy;
  }

  update(dt: number, input: Input, world: World, settings: Settings, carDeltaY: number): void {
    // look
    if (input.locked && !this.frozen) {
      const s = 0.0021 * settings.mouseSensitivity;
      this.yaw -= input.mouseDX * s;
      this.pitch -= input.mouseDY * s * (settings.invertY ? -1 : 1);
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
    // move
    const f = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const r = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = this.frozen ? 0 : run ? 3.5 : 2.2;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    let wx = fx * f + rx * r;
    let wz = fz * f + rz * r;
    const len = Math.hypot(wx, wz);
    if (len > 0) {
      wx /= len;
      wz /= len;
    }
    const accel = 14;
    this.vel.x += (wx * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wz * speed - this.vel.z) * Math.min(1, accel * dt);
    if (this.frozen) this.vel.set(0, 0, 0);

    // riding the elevator
    this.pos.y += carDeltaY;
    this.smoothY += carDeltaY;

    const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.12));
    for (let i = 0; i < steps; i++) {
      this.pos.x += (this.vel.x * dt) / steps;
      this.pos.z += (this.vel.z * dt) / steps;
      this.collide(world);
    }
    // ground
    const g = world.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (g !== null) {
      if (g < this.pos.y - 0.9) this.pos.y -= Math.min(this.pos.y - g, 9.8 * dt);
      else this.pos.y = g;
    }
    // smooth vertical camera motion on stairs
    this.smoothY += (this.pos.y - this.smoothY) * Math.min(1, 14 * dt);
    if (Math.abs(this.pos.y - this.smoothY) > 1) this.smoothY = this.pos.y;

    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.moving = hs > 0.3;
    // head bob + footsteps
    const target = this.moving && settings.headBob && !settings.reduceMotion ? 1 : 0;
    this.bobAmt += (target - this.bobAmt) * Math.min(1, 6 * dt);
    if (this.moving) {
      this.bobPhase += dt * hs * 3.3;
      this.stepAcc += hs * dt;
      const stride = run ? 0.85 : 0.7;
      if (this.stepAcc >= stride) {
        this.stepAcc -= stride;
        this.onStep?.(this.surfaceAt(world));
      }
    }
    this.applyCamera(dt, settings);
  }

  surfaceAt(world: World): string {
    const n = world.floorAt(this.pos.y);
    if (this.pos.x > 12) return 'stair';
    if (Math.abs(this.pos.x) < 1 && this.pos.z < -3.6) return 'car';
    if (n === 0) return 'epoxy';
    if (n === 13) return 'old';
    if (n === 1) return 'stone';
    return 'tile';
  }

  private collide(world: World): void {
    const cols = world.collidersNear(this.pos.y, this.cols);
    const y0 = this.pos.y + 0.3;
    const y1 = this.pos.y + 1.75;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const c of cols) {
        if (c.y1 <= y0 || c.y0 >= y1) continue;
        const cx = Math.max(c.x0, Math.min(this.pos.x, c.x1));
        const cz = Math.max(c.z0, Math.min(this.pos.z, c.z1));
        const dx = this.pos.x - cx;
        const dz = this.pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = RADIUS - d;
          this.pos.x += (dx / d) * push;
          this.pos.z += (dz / d) * push;
        } else {
          // centre inside the box: push out along the shallowest axis
          const l = this.pos.x - c.x0;
          const rr = c.x1 - this.pos.x;
          const b = this.pos.z - c.z0;
          const t = c.z1 - this.pos.z;
          const m = Math.min(l, rr, b, t);
          if (m === l) this.pos.x = c.x0 - RADIUS;
          else if (m === rr) this.pos.x = c.x1 + RADIUS;
          else if (m === b) this.pos.z = c.z0 - RADIUS;
          else this.pos.z = c.z1 + RADIUS;
        }
        pushed = true;
      }
      if (!pushed) break;
    }
  }

  applyCamera(dt: number, settings: Settings | null): void {
    const bob = Math.sin(this.bobPhase * 2) * 0.03 * this.bobAmt;
    const sway = Math.cos(this.bobPhase) * 0.018 * this.bobAmt;
    const shake = settings?.reduceMotion ? 0 : this.shake;
    this.camera.position.set(
      this.pos.x + Math.cos(this.yaw) * sway + (Math.random() - 0.5) * shake * 0.04,
      this.smoothY + EYE + bob + (Math.random() - 0.5) * shake * 0.04,
      this.pos.z - Math.sin(this.yaw) * sway,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);
  }

  forward(out: THREE.Vector3): THREE.Vector3 {
    return this.camera.getWorldDirection(out);
  }
}
