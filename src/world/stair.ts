// Emergency stairwell module (one per floor): landing at floor level + U-shaped flights up to the next level.
import * as THREE from 'three';
import { B1, FLOOR_H, STAIR, floorShort, floorLabel } from '../data/building';
import { BuildCtx, boxGeo } from './kit';
import { mats } from './materials';
import { addExitSign, addFixture, addHingedDoor, addSign, addInteract } from './common';
import type { BuildEnv, FloorInstance } from './types';

const STEPS = 10;
const RISE = FLOOR_H / 2 / STEPS; // 0.16
const RUN = (STAIR.midX0 - STAIR.landingX1) / STEPS; // 0.3

export function stairSignOpts(label: string): import('./textures').SignOpts {
  return { w: 512, h: 384, bg: '#d9d6cc', fg: '#16345c', lines: [{ text: label, size: 210, weight: 900 }, { text: '비상계단', size: 44, weight: 700, color: '#333' }] };
}

/**
 * Build the stair module for floor `n`.
 * `hasUp`: flights to the next level exist. `doorLabel`: sign on the stair side of the corridor door.
 */
export function buildStairModule(
  f: FloorInstance,
  ctx: BuildCtx,
  env: BuildEnv,
  o: { hasUp: boolean; hasDown: boolean; signLabel?: string; doorLocked?: boolean; doorLockedMsg?: string; doorId?: string; doorSignAt?: [number, number]; noCorridorSign?: boolean },
): void {
  const m = mats();
  const { x0, x1, z0, z1, landingX1, midX0 } = STAIR;
  const H = FLOOR_H;
  const wallMat = m.wallGray;
  const lowMat = m.wallGreenLow;
  // Outer walls, full storey height minus 1 mm: their tops must not share the plane of the storey above's
  // landing / corridor floor (that 7 cm strip used to z-fight along every landing edge).
  const HW = H - 0.001;
  ctx.wallZ(x0, z0, z1, HW, wallMat, [{ z0: -0.5, z1: 0.5, y1: 2.1 }], 0.15);
  ctx.wallZ(x1, z0, z1, HW, wallMat);
  ctx.wallX(z0, x0, x1, HW, wallMat);
  ctx.wallX(z1, x0, x1, HW, wallMat);
  // painted lower band (typical Korean stairwell two-tone paint)
  ctx.solid(x0 + 0.08, landingX1, 0, 1.1, z0 + 0.075, z0 + 0.085, lowMat, { collide: false });
  ctx.solid(x0 + 0.08, landingX1, 0, 1.1, z1 - 0.085, z1 - 0.075, lowMat, { collide: false });
  ctx.solid(x0 + 0.075, x0 + 0.085, 0, 1.1, z0 + 0.08, -0.5, lowMat, { collide: false });
  ctx.solid(x0 + 0.075, x0 + 0.085, 0, 1.1, 0.5, z1 - 0.08, lowMat, { collide: false });

  // Landing
  ctx.floor(x0, landingX1, z0, z1, m.floorStair, 1.0);
  const n = f.n;
  const label = o.signLabel ?? floorShort(n);
  const sign = addSign(ctx, `stair-sign:${label}`, stairSignOpts(label), 13.0, 1.75, z0 + 0.085, 's', 0.9, 0.675);
  sign.name = 'stairSign';
  f.named.set('stairSign', sign);
  addExitSign(ctx, x0 + 0.1, 2.3, 0, 'e');

  if (o.hasUp) {
    // Flight 1 (north half) : landing -> mid landing
    for (let i = 0; i < STEPS; i++) {
      const top = (i + 1) * RISE;
      ctx.solid(landingX1 + i * RUN, landingX1 + (i + 1) * RUN, Math.max(0, top - 0.32), top, z0 + 0.075, -0.06, m.floorStair, { collide: false, uvM: 1 });
    }
    ctx.walkables.push({ x0: landingX1, x1: midX0, z0: z0, z1: -0.05, y: ctx.y0, y1: ctx.y0 + H / 2 });
    // Mid landing
    ctx.solid(midX0, x1 - 0.075, H / 2 - 0.25, H / 2, z0 + 0.075, z1 - 0.075, m.floorStair, { collide: false });
    ctx.walkables.push({ x0: midX0, x1: x1, z0: z0, z1: z1, y: ctx.y0 + H / 2 });
    // Flight 2 (south half) : mid landing -> next landing
    for (let i = 0; i < STEPS; i++) {
      const top = H / 2 + (i + 1) * RISE;
      const xa = midX0 - (i + 1) * RUN;
      ctx.solid(xa, xa + RUN, top - 0.32, top, 0.06, z1 - 0.075, m.floorStair, { collide: false });
    }
    ctx.walkables.push({ x0: landingX1, x1: midX0, z0: 0.05, z1: z1, y: ctx.y0 + H, y1: ctx.y0 + H / 2 });
    // Divider wall between the flights (full height of this storey)
    // spans exactly this storey: dividers of stacked floors used to overlap by 0.4 m and z-fight
    ctx.solid(landingX1, midX0, 0, H - 0.001, -0.06, 0.06, m.wallGray, { tag: 'divider' });
    // handrail on divider
    const rail = new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(midX0 - landingX1, H / 2), 8);
    ctx.deco(rail.clone().rotateZ(Math.PI / 2 - Math.atan2(H / 2, midX0 - landingX1)), m.pipe, (landingX1 + midX0) / 2, H / 4 + 0.9, -0.1);
    ctx.deco(rail.rotateZ(-(Math.PI / 2 - Math.atan2(H / 2, midX0 - landingX1))), m.pipe, (landingX1 + midX0) / 2, (3 * H) / 4 + 0.9, 0.1);
    addFixture(f, ctx, x1 - 0.6, 0, H / 2 + 2.45, { kind: 'panel', intensity: 3.2, distance: 6, color: '#f1f4ff' });
  } else {
    // No flight up: block the north half and close the ceiling.
    ctx.solid(landingX1, landingX1 + 0.15, 0, H, z0, 0, m.wallGray);
    ctx.solid(landingX1, midX0, 0, H - 0.001, -0.06, 0.06, m.wallGray, { tag: 'divider' });
    ctx.ceiling(x0, landingX1 + 0.1, z0, z1, m.ceilingConcrete, 2.7);
  }
  if (!o.hasDown) {
    ctx.solid(landingX1 - 0.15, landingX1, 0, H, 0, z1, m.wallGray); // behind the landing edge, clear of the top step face
    if (!o.hasUp) ctx.solid(landingX1, x1, 0, H, z0, z1, m.wallGray, { collide: false });
  }
  addFixture(f, ctx, 13.0, 0, 2.62, { kind: 'panel', intensity: 3.2, distance: 6, color: '#f1f4ff' });

  // Fire door between corridor and stairwell (hinge at z=-0.5, swings into stairwell)
  const doorId = o.doorId ?? `stair-${n}`;
  addHingedDoor(f, ctx, {
    id: doorId,
    kind: 'fire',
    wallAxis: 'z',
    hingeAt: -0.5,
    width: 1.0,
    wallPos: x0,
    towards: 1,
    swing: 1,
    mat: m.fireDoor,
    autoClose: 5,
    locked: o.doorLocked ?? false,
    lockedMsg: o.doorLockedMsg,
    label: `${floorLabel(n)} 방화문`,
    decorate: (leaf, w) => {
      const lever = new THREE.Mesh(boxGeo(0.16, 0.03, 0.04), m.chrome);
      lever.position.set(w - 0.14, 1.0, 0.05);
      leaf.add(lever);
      const lever2 = lever.clone();
      lever2.position.z = -0.05;
      leaf.add(lever2);
      const closer = new THREE.Mesh(boxGeo(0.3, 0.06, 0.06), m.metalGray);
      closer.position.set(0.25, 2.0, 0.05);
      leaf.add(closer);
    },
  });
  // Floor code painted on the corridor side above the fire door
  if (!o.noCorridorSign) {
    const [sy, sz] = o.doorSignAt ?? [2.35, 0];
    addSign(ctx, `stair-door-sign:${label}`, { w: 256, h: 96, bg: '#f2f2ee', fg: '#1b1b1b', border: '#1f8a4c', lines: [{ text: `비상계단 ${label}`, size: 44, weight: 800 }] }, x0 - 0.085, sy, sz, 'w', 0.5, 0.19);
  }
  void env;
  void addInteract;
}

/** Floor-number code used in stair signage for a given storey index. */
export function stairLabel(n: number): string {
  return n === B1 ? 'B1' : `${n}F`;
}
