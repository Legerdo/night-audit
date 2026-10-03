// 1204호: officially vacant unit (former staff quarters of 박정호). Power is cut; flashlight territory.
import * as THREE from 'three';
import { BuildCtx, boxGeo, planeGeo } from './kit';
import { mats, signMat } from './materials';
import * as T from './textures';
import { addFixture, addInteract, noticePlane } from './common';
import { makeCabinet } from './props';
import type { BuildEnv, FloorInstance } from './types';

export const UNIT1204 = { x0: 6.8, x1: 11.8, z0: -6.6, z1: -1.25 };

export function buildUnit1204(f: FloorInstance, ctx: BuildCtx, env: BuildEnv): void {
  const m = mats();
  const { x0, x1, z0, z1 } = UNIT1204;
  const H = 2.4;
  ctx.floor(x0, x1, z0, -1.1, m.floorJangpan, 1.0, 0);
  ctx.ceiling(x0, x1, z0, z1, m.ceiling94, H);
  ctx.wallZ(x0 - 0.075, z0, z1, H + 0.1, m.wallApt);
  ctx.wallZ(x1 + 0.075, z0, z1, H + 0.1, m.wallApt);
  ctx.wallX(z0 - 0.075, x0, x1, H + 0.1, m.wallApt, [{ x0: 8.4, x1: 10.2, y0: 0.9, y1: 2.1 }]);
  // entry tiles (현관)
  ctx.solid(8.4, 9.6, 0, 0.012, -2.2, -1.25, m.floorStair, { collide: false });
  // window + city
  ctx.deco(boxGeo(1.9, 0.06, 0.2), m.metalGray, 9.3, 0.9, z0 + 0.02);
  const glass = ctx.mesh(planeGeo(1.8, 1.2), m.glass, 9.3, 1.5, z0 - 0.01, 0);
  glass.renderOrder = 2;
  ctx.mesh(planeGeo(30, 16), m.city, 9.3, 3, z0 - 14, 0);
  // clean rectangles where furniture and frames used to be (wallpaper less faded)
  const ghost = new THREE.MeshStandardMaterial({ color: '#ece8de', roughness: 1 });
  ctx.deco(planeGeo(1.1, 1.8), ghost, x0 + 0.005, 0.95, -4.3, Math.PI / 2);
  ctx.deco(planeGeo(0.5, 0.4), ghost, x1 - 0.005, 1.6, -3.0, -Math.PI / 2);
  ctx.deco(planeGeo(0.5, 0.4), ghost, x1 - 0.005, 1.6, -4.1, -Math.PI / 2);
  // built-in closet on the west wall (contains 1994 report copy)
  const closet = makeCabinet(1.4, 2.1, 0.6, m.woodDesk);
  closet.position.set(x0 + 0.32, ctx.y0, -5.4);
  closet.rotation.y = Math.PI / 2;
  f.group.add(closet);
  ctx.collider(x0, x0 + 0.62, 0, 2.1, -6.1, -4.7);
  if (!env.flags.pickedUp.has('D3')) {
    addInteract(f, ctx, 'pickup:D3', 'pickup', '붙박이장 열어 보기', x0 + 0.7, 1.1, -5.4, [0.3, 1.8, 1.3], { record: 'D3' }, 2.0);
  } else {
    addInteract(f, ctx, 'closet-empty', 'message', '붙박이장 살펴보기', x0 + 0.7, 1.1, -5.4, [0.3, 1.8, 1.3], { text: '비어 있다. 옷걸이 하나가 아직 흔들린다.' }, 2.0);
  }
  // left-behind boxes, folded table, calendar
  for (const [x, z, r] of [
    [10.8, -5.8, 0.2],
    [11.1, -5.2, -0.1],
    [10.9, -5.5, 0.05],
  ] as const) {
    ctx.deco(boxGeo(0.5, 0.4, 0.4), m.cardboard, x, 0.2 + (z === -5.5 ? 0.4 : 0), z, r);
  }
  ctx.collider(10.5, 11.4, 0, 0.9, -6.1, -4.9);
  ctx.deco(boxGeo(0.8, 0.05, 0.5), m.woodDesk, 8.2, 0.32, -3.4, 0.3);
  for (const [dx, dz] of [
    [-0.33, -0.2],
    [0.33, -0.2],
    [-0.33, 0.2],
    [0.33, 0.2],
  ]) ctx.deco(boxGeo(0.04, 0.3, 0.04), m.woodDesk, 8.2 + dx, 0.15, -3.4 + dz, 0.3);
  ctx.mesh(planeGeo(0.3, 0.4), signMat('cal-2026-07', T.calendarTex(2026, 7, '청운약국', [31])), x1 - 0.01, 1.55, -2.2, -Math.PI / 2);
  void noticePlane;
  // light switch panel (no power)
  ctx.deco(boxGeo(0.02, 0.12, 0.08), m.whitePlastic, x0 + 0.01, 1.2, -1.6);
  addInteract(f, ctx, 'switch-1204', 'message', '전등 스위치', x0 + 0.1, 1.2, -1.6, [0.2, 0.3, 0.3], { text: '딸깍. 전기가 끊겨 있다. 손전등(F)을 써야겠다.' }, 1.6);
  // dead fixture (off)
  addFixture(f, ctx, 9.3, -3.8, H, { kind: 'panel', mode: 'off', intensity: 3 });
  void signMat;
  void T;
}
