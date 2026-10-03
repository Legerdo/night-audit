// Elevator controller: hall calls, car buttons, travel with acceleration, door cycle, indicators and log.
import * as THREE from 'three';
import { B1, FLOOR_13, HALL, floorShort, floorY } from '../data/building';
import { drawPanel, PANEL_FLOORS_BASE } from '../world/elevatorCar';
import { drawIndicator, hallIndicatorCanvas, hallIndicatorTex } from '../world/corridor';
import type { World } from '../world/world';
import { audio, type LoopHandle } from '../systems/audio';

export type CallSource = 'hall' | 'car' | 'ghost' | 'debug';

const MAX_SPEED = 2.6;
const ACCEL = 1.6;
const DOOR_TIME = 1.1;
const DWELL = 4.5;

export class Elevator {
  level = 1; // continuous storey index (y = floorY(level))
  private vel = 0;
  private target: number | null = null;
  private queue: { floor: number; src: CallSource }[] = [];
  private curSrc: CallSource = 'hall';
  private departedFrom = 1;
  doorT = 0;
  private doorWant = false;
  private dwell = 0;
  private world: World;
  private motor: LoopHandle | null = null;
  private lastIndicator = '';
  allow13 = false;
  /** floors whose hall indicator is overridden by an anomaly (drawn separately by the world) */
  onTrip: ((from: number, to: number, src: CallSource) => void) | null = null;
  onArrive: ((floor: number, src: CallSource) => void) | null = null;
  private litButtons = new Set<number>();
  private panelKey = '';

  constructor(world: World) {
    this.world = world;
    this.redrawPanel();
    this.updateIndicators(true);
  }

  get moving(): boolean {
    return this.target !== null;
  }

  get floor(): number {
    return Math.round(this.level);
  }

  get carY(): number {
    return floorY(this.level);
  }

  stops(): number[] {
    return this.allow13 ? [FLOOR_13, ...PANEL_FLOORS_BASE] : PANEL_FLOORS_BASE;
  }

  /** Request the car to a floor. Hall calls at the current floor just open the doors. */
  call(floor: number, src: CallSource): void {
    if (floor === FLOOR_13 && !this.allow13) return;
    if (!this.moving && Math.abs(this.level - floor) < 0.01) {
      this.doorWant = true;
      this.dwell = 0;
      return;
    }
    if (this.target === floor || this.queue.some((q) => q.floor === floor)) return;
    this.queue.push({ floor, src });
    if (src === 'car') this.litButtons.add(floor);
    this.redrawPanel();
  }

  setHold(open: boolean): void {
    if (open) {
      if (!this.moving) {
        this.doorWant = true;
        this.dwell = 0;
      }
    } else this.dwell = DWELL;
  }

  /** Place the car instantly (load / debug). */
  place(floor: number): void {
    this.level = floor;
    this.vel = 0;
    this.target = null;
    this.queue = [];
    this.doorT = 0;
    this.doorWant = false;
    this.world.setCarY(this.carY);
    this.applyDoors();
    this.updateIndicators(true);
  }

  private redrawPanel(): void {
    const floors = this.stops();
    const key = `${floors.join(',')}|${[...this.litButtons].join(',')}`;
    if (key === this.panelKey) return;
    this.panelKey = key;
    const car = this.world.car;
    if (!car) return;
    drawPanel(car.panelCanvas, floors, this.litButtons);
    car.panelTex.needsUpdate = true;
  }

  private updateIndicators(force = false): void {
    const label = floorShort(this.floor).replace('F', '');
    const dir = this.target === null ? 0 : this.target > this.level ? 1 : -1;
    const key = `${label}|${dir}`;
    if (!force && key === this.lastIndicator) return;
    this.lastIndicator = key;
    drawIndicator(hallIndicatorCanvas, label, dir as -1 | 0 | 1);
    hallIndicatorTex.needsUpdate = true;
    const car = this.world.car;
    if (car) {
      drawIndicator(car.indicatorCanvas, label, dir as -1 | 0 | 1);
      car.indicatorTex.needsUpdate = true;
    }
  }

  private applyDoors(): void {
    const t = this.doorT;
    const e = t * t * (3 - 2 * t);
    const car = this.world.car;
    car.doorL.position.x = -0.5 * e;
    car.doorR.position.x = 0.5 * e;
    (car.doorCollider as { off?: boolean }).off = e > 0.8;
    // only the landing where the car is can open
    for (const f of this.world.floors.values()) {
      const l = f.landing;
      if (!l) continue;
      const here = !this.moving && f.n === this.floor;
      const o = here ? e : 0;
      l.left.position.x = -0.5 * o;
      l.right.position.x = 0.5 * o;
      (l.collider as { off?: boolean }).off = o > 0.8;
      l.callLamp.emissiveIntensity = this.queue.some((q) => q.floor === f.n && q.src === 'hall') || (this.target === f.n && this.curSrc === 'hall') ? 1.6 : 0;
    }
  }

  private doorwayBlocked(p: THREE.Vector3): boolean {
    // only the threshold itself (a player standing just inside the car must not hold the doors forever)
    return Math.abs(p.x) < 0.65 && p.z > HALL.z0 - 0.28 && p.z < HALL.z0 + 0.3 && Math.abs(p.y - this.carY) < 1.2;
  }

  /** Advance simulation; returns the car's vertical displacement this frame (applied to a rider). */
  update(dt: number, player: THREE.Vector3): number {
    const y0 = this.carY;
    // doors
    if (!this.moving) {
      if (this.doorWant) {
        this.doorT = Math.min(1, this.doorT + dt / DOOR_TIME);
        if (this.doorT >= 1) {
          this.dwell += dt;
          if (this.dwell >= DWELL && !this.doorwayBlocked(player)) this.doorWant = false;
        }
      } else if (this.doorT > 0) {
        if (this.doorwayBlocked(player) && this.doorT > 0.05) {
          this.doorWant = true; // safety edge: re-open
          this.dwell = DWELL - 1.5;
          audio.play('button', new THREE.Vector3(0, this.carY + 1.2, HALL.z0));
        } else this.doorT = Math.max(0, this.doorT - dt / DOOR_TIME);
      }
      // start next trip once doors are shut
      if (this.doorT === 0 && !this.doorWant && this.queue.length > 0) {
        const next = this.queue.shift()!;
        if (Math.abs(next.floor - this.level) < 0.01) {
          this.doorWant = true;
          this.dwell = 0;
          this.litButtons.delete(next.floor);
          this.redrawPanel();
        } else {
          this.target = next.floor;
          this.curSrc = next.src;
          this.departedFrom = this.floor;
          if (next.src !== 'ghost') this.onTrip?.(this.departedFrom, next.floor, next.src);
          if (!this.motor) this.motor = audio.loop('motor', new THREE.Vector3(0, this.carY + 1, -4.6), 0.9);
          this.motor.setGain(1, 0.5);
        }
      }
    }
    // travel
    if (this.target !== null) {
      const dist = this.target - this.level; // in storeys
      const dir = Math.sign(dist);
      const distM = Math.abs(dist) * 3.2;
      const brake = (this.vel * this.vel) / (2 * ACCEL);
      if (distM <= brake + 0.02) this.vel = Math.max(0.25, this.vel - ACCEL * dt);
      else this.vel = Math.min(MAX_SPEED, this.vel + ACCEL * dt);
      const step = (this.vel * dt) / 3.2;
      if (step >= Math.abs(dist)) {
        this.level = this.target;
        const arrived = this.target;
        const src = this.curSrc;
        this.target = null;
        this.vel = 0;
        this.litButtons.delete(arrived);
        this.redrawPanel();
        this.motor?.setGain(0, 0.3);
        this.doorWant = true;
        this.dwell = 0;
        audio.play('ding', new THREE.Vector3(0, floorY(arrived) + 2.2, HALL.z0 + 0.2));
        window.setTimeout(() => audio.play('liftDoor', new THREE.Vector3(0, floorY(arrived) + 1.2, HALL.z0)), 250);
        this.onArrive?.(arrived, src);
      } else this.level += dir * step;
      this.world.setCarY(this.carY);
      this.motor?.setPos(new THREE.Vector3(0, this.carY + 1, -4.6));
    }
    this.applyDoors();
    this.updateIndicators();
    return this.carY - y0;
  }

  /** Is a point inside the car volume? */
  contains(p: THREE.Vector3): boolean {
    return p.x > -1.05 && p.x < 1.05 && p.z < -3.58 && p.z > -5.65 && p.y > this.carY - 0.4 && p.y < this.carY + 2.2;
  }

  get busy(): boolean {
    return this.moving || this.queue.length > 0;
  }

  stopMotor(): void {
    this.motor?.stop();
    this.motor = null;
  }

  static label(n: number): string {
    return n === B1 ? 'B1' : String(n);
  }
}
