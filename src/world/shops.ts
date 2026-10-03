// 2F: shuttered commercial corridor (상가층).
import * as THREE from 'three';
import { CEIL_H, SHOPS, SPINE, floorY } from '../data/building';
import { BuildCtx, boxGeo } from './kit';
import { mats } from './materials';
import { addGuidance, addInteract, addSign, finishFloor, newFloor, noticePlane } from './common';
import { buildElevatorLanding, buildSpine, floorPlaque } from './corridor';
import { buildStairModule } from './stair';
import type { BuildEnv, FloorInstance } from './types';

const SHOP_W = 2.4;

export function buildShops(env: BuildEnv): FloorInstance {
  const n = 2;
  const mods = env.mods;
  const f = newFloor(n, mods);
  const y0 = floorY(n);
  const ctx = new BuildCtx(f.group, y0);
  const m = mats();
  buildSpine(f, ctx, {
    wall: m.wallCream,
    floor: m.floorDeco,
    ceiling: m.ceiling,
    wainscot: m.wallGray,
    ceilH: CEIL_H,
    lightColor: '#eaf1ff',
    lightKind: 'tube',
    lightIntensity: 4.8,
    lightModes: { 4: 'off' },
    northOpenings: [],
    southOpenings: [],
    westWindow: true,
  });
  buildElevatorLanding(f, ctx);
  floorPlaque(ctx, 2, '2');
  const shops = [...SHOPS];
  if (mods.has('geo_extra_shop')) shops.push({ x: -3.6, side: 1, name: '청운사진관', sub: '증명사진 · 가족사진' });
  for (const s of shops) {
    const wallZ = s.side === -1 ? SPINE.z0 : SPINE.z1;
    const out = -s.side;
    const half = mods.has('obj_shutter_open') && s.name === '미소치과';
    const shH = half ? 1.05 : 2.2;
    // shutter box + shutter curtain
    ctx.deco(boxGeo(SHOP_W + 0.1, 0.3, 0.3), m.metalGray, s.x, 2.38, wallZ + out * 0.15);
    const curtain = new THREE.Mesh(boxGeo(SHOP_W, shH, 0.04, 1), m.shutter);
    curtain.position.set(s.x, y0 + 2.2 - shH / 2 + 0.03, wallZ + out * 0.04);
    f.group.add(curtain);
    ctx.deco(boxGeo(SHOP_W + 0.12, 0.06, 0.1), m.stainlessDark, s.x, 2.2 - shH + 0.05, wallZ + out * 0.06);
    if (half) {
      // lit interior visible under the half-raised shutter
      const glow = new THREE.MeshStandardMaterial({ color: '#dfe8e6', emissive: new THREE.Color('#cfe3e0'), emissiveIntensity: 0.9 });
      ctx.solid(s.x - SHOP_W / 2, s.x + SHOP_W / 2, 0, 1.15, wallZ + (s.side === 1 ? 0.02 : -0.4), wallZ + (s.side === 1 ? 0.4 : -0.02), glow, { collide: false });
      ctx.deco(boxGeo(0.5, 0.5, 0.3), m.whitePlastic, s.x + 0.5, 0.25, wallZ + (s.side === 1 ? 0.2 : -0.2));
    }
    // sign board above the shutter
    addSign(ctx, `shop:${s.name}`, { w: 768, h: 160, bg: s.name === '미소치과' ? '#3e6f8f' : '#26344a', fg: '#ffffff', lines: [{ text: s.name, size: 84, weight: 900 }, { text: s.sub, size: 34, weight: 600, color: '#d7dde6' }] }, s.x, 2.46, wallZ + out * 0.305, s.side === -1 ? 's' : 'n', 2.0, 0.42);
    f.colliders.push({ x0: s.x - SHOP_W / 2, x1: s.x + SHOP_W / 2, y0, y1: y0 + 2.2, z0: wallZ - 0.05, z1: wallZ + 0.1 * out + 0.05, tag: 'shutter' });
    addInteract(f, ctx, `shop:${s.name}`, 'message', `${s.name} 셔터`, s.x, 1.1, wallZ + out * 0.2, [SHOP_W, 2.0, 0.3], { text: half ? '셔터가 반쯤 올라가 있다. 폐업한 치과 안에 불이 켜져 있다.' : '셔터가 내려져 있다. 영업시간이 아니다.' }, 2.4);
  }
  noticePlane(ctx, 'shop-rent', { w: 360, h: 480, title: '임대 문의', titleColor: '#b01818', body: '재개발로 인해 신규 임대는 받지 않습니다.\n기존 점포는 11월 30일까지 퇴점 바랍니다.', footer: '청운빌딩 관리사무소', seed: 23 }, -10.6, 1.65, SPINE.z1 - 0.03, 'n', 0.3);
  for (const x of [-10.5, -5.3, 3.2, 9.5]) addGuidance(ctx, x, 0.95, SPINE.z1 - 0.025, 'n', false);
  buildStairModule(f, ctx, env, { hasUp: true, hasDown: true });
  return finishFloor(f, ctx);
}
