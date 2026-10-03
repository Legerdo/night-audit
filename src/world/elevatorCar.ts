// Elevator car (moves vertically through the shaft). Built in car-local Y (floor at y = 0).
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { CAR } from '../data/building';
import { getImage } from '../data/imageAssets';
import { BuildCtx, boxGeo, planeGeo } from './kit';
import { mats, signMat } from './materials';
import * as T from './textures';
import { addFixture, addInteract, newFloor } from './common';
import { drawIndicator } from './corridor';
import type { FloorInstance } from './types';
import { makeFigure, setLayerRecursive } from './figure';
import { LAYER_MIRROR_ONLY } from './types';

export const CAR_FLOOR_ID = -1;

export interface CarBuild {
  inst: FloorInstance;
  doorL: THREE.Object3D;
  doorR: THREE.Object3D;
  doorCollider: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; tag?: string };
  panelCanvas: HTMLCanvasElement;
  panelTex: THREE.CanvasTexture;
  indicatorCanvas: HTMLCanvasElement;
  indicatorTex: THREE.CanvasTexture;
  mirror: Reflector | null;
  mirrorFigure: THREE.Object3D;
  adMesh: THREE.Mesh;
  setAd: (anomaly: boolean) => void;
}

export const PANEL_FLOORS_BASE = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export function drawPanel(c: HTMLCanvasElement, floors: number[], lit: Set<number>): void {
  const g = c.getContext('2d')!;
  g.fillStyle = '#b7bcc0';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#9ea3a8';
  g.fillRect(8, 8, c.width - 16, c.height - 16);
  const cols = 2;
  const rows = Math.ceil(floors.length / cols);
  const top = 30;
  const bh = (c.height - top - 110) / rows;
  floors.forEach((fl, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = c.width * (col === 0 ? 0.32 : 0.68);
    const cy = top + row * bh + bh / 2;
    g.beginPath();
    g.arc(cx, cy, bh * 0.36, 0, Math.PI * 2);
    g.fillStyle = lit.has(fl) ? '#ffcf70' : '#e8e8e6';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = lit.has(fl) ? '#ff9a2a' : '#6d7278';
    g.stroke();
    g.fillStyle = '#222';
    g.font = `800 ${Math.round(bh * 0.36)}px ${T.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(fl === 0 ? 'B1' : String(fl), cx, cy + 1);
  });
  // open / close / bell
  const y = c.height - 70;
  g.font = `800 26px ${T.FONT}`;
  for (const [x, label] of [
    [c.width * 0.22, '열림'],
    [c.width * 0.5, '닫힘'],
  ] as const) {
    g.fillStyle = '#e8e8e6';
    g.fillRect(x - 38, y - 22, 76, 44);
    g.fillStyle = '#222';
    g.fillText(label, x, y);
  }
  g.fillStyle = '#e0c040';
  g.beginPath();
  g.arc(c.width * 0.78, y, 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#222';
  g.font = `800 18px ${T.FONT}`;
  g.fillText('비상', c.width * 0.78, y);
}

function adCanvas(anomaly: boolean): HTMLCanvasElement {
  const img = getImage(anomaly ? 'ad_elevator_anomaly' : 'ad_elevator_normal');
  const W = 600;
  const H = 800;
  const [c, g] = T.makeCanvas(W, H);
  g.drawImage(img, 0, 0, W, H);
  const grad = g.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(10,20,50,0.55)');
  grad.addColorStop(1, 'rgba(10,20,50,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, 260);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.font = `900 66px ${T.FONT}`;
  g.fillText('청운 리버파크', W / 2, 92);
  g.font = `600 28px ${T.FONT}`;
  g.fillText('청운빌딩 재건축 · 2029년 입주 예정', W / 2, 142);
  g.fillStyle = 'rgba(12,18,28,0.82)';
  g.fillRect(0, H - 92, W, 92);
  g.fillStyle = '#e9d9a8';
  g.font = `800 30px ${T.FONT}`;
  g.fillText('조합원 분양 설명회 10월 12일', W / 2, H - 52);
  g.fillStyle = '#c9ced6';
  g.font = `500 22px ${T.FONT}`;
  g.fillText('청운빌딩 재개발정비사업조합', W / 2, H - 20);
  return c;
}

export function buildCar(opts: { withMirror: boolean }): CarBuild {
  const inst = newFloor(CAR_FLOOR_ID, new Set());
  const ctx = new BuildCtx(inst.group, 0);
  const m = mats();
  const { x0, x1, z0, z1, h } = CAR;
  // floor, walls, ceiling
  ctx.floor(x0, x1, z0, z1, new THREE.MeshStandardMaterial({ map: T.terrazzoTex('carfloor', '#5d5b56', ['#3e3c38', '#7a776f'], 88), roughness: 0.6 }), 1.0);
  ctx.solid(x0 - 0.05, x0, 0, h, z0, z1, m.stainless, { uvM: 2 });
  ctx.solid(x1, x1 + 0.05, 0, h, z0, z1, m.stainless, { uvM: 2 });
  ctx.solid(x0, x1, 0, h, z0 - 0.05, z0, m.stainless, { uvM: 2 });
  // front wall with door opening
  ctx.solid(x0, -CAR.doorW / 2, 0, h, z1 - 0.04, z1, m.stainless, { uvM: 2 });
  ctx.solid(CAR.doorW / 2, x1, 0, h, z1 - 0.04, z1, m.stainless, { uvM: 2 });
  ctx.solid(-CAR.doorW / 2, CAR.doorW / 2, 2.1, h, z1 - 0.04, z1, m.stainless, { uvM: 2, collide: false });
  ctx.deco(boxGeo(x1 - x0, 0.06, z1 - z0), m.whitePlastic, 0, h + 0.03, (z0 + z1) / 2);
  const panelL = ctx.mesh(boxGeo(1.3, 0.02, 1.2), new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#f4f6ff'), emissiveIntensity: 1.6 }), 0, h - 0.01, -4.6);
  const carLight = addFixture(inst, ctx, 0, -4.6, h + 0.01, { kind: 'panel', intensity: 3.2, distance: 4.5, color: '#f4f6ff' });
  carLight.mat = panelL.material as THREE.MeshStandardMaterial;
  carLight.baseEmissive = 1.6;
  // handrail
  for (const x of [x0 + 0.06, x1 - 0.06]) ctx.deco(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8).rotateX(Math.PI / 2), m.chrome, x, 0.9, -4.6);
  ctx.deco(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8).rotateZ(Math.PI / 2), m.chrome, 0, 0.9, z0 + 0.06);
  // mirror on the back wall
  let mirror: Reflector | null = null;
  const mirrorBack = ctx.mesh(planeGeo(1.3, 1.3), m.stainlessDark, 0, 1.45, z0 + 0.005, 0);
  mirrorBack.name = 'mirrorBack';
  if (opts.withMirror) {
    mirror = new Reflector(new THREE.PlaneGeometry(1.26, 1.26), { textureWidth: 512, textureHeight: 512, color: 0xb8bcc0, multisample: 0 });
    mirror.position.set(0, 1.45, z0 + 0.012);
    inst.group.add(mirror);
  }
  const mirrorFigure = makeFigure({ coat: m.fabricDark });
  mirrorFigure.position.set(-0.55, 0, -5.25);
  mirrorFigure.rotation.y = 0.35;
  setLayerRecursive(mirrorFigure, LAYER_MIRROR_ONLY);
  mirrorFigure.visible = false;
  inst.group.add(mirrorFigure);
  // button panel on the right wall near the door (facing -x)
  const [panelCanvas] = T.makeCanvas(256, 640);
  drawPanel(panelCanvas, PANEL_FLOORS_BASE, new Set());
  const panelTex = new THREE.CanvasTexture(panelCanvas);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  ctx.mesh(planeGeo(0.24, 0.6), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.4, metalness: 0.3 }), x1 - 0.012, 1.15, -3.95, -Math.PI / 2);
  addInteract(inst, ctx, 'car-panel', 'elevator_panel', '층 버튼 누르기', x1 - 0.2, 1.15, -3.95, [0.35, 0.7, 0.4], {}, 1.8);
  // inspection certificate
  const cert = T.signTex('lift-cert', {
    w: 360,
    h: 256,
    bg: '#f2f5f8',
    fg: '#12346a',
    border: '#12346a',
    lines: [
      { text: '승강기 정기검사 합격', size: 36, weight: 900 },
      { text: '유효기간 2026.03.15 ~ 2027.03.14', size: 22, weight: 600, color: '#333' },
      { text: '정원 11명 · 적재 750kg', size: 22, weight: 600, color: '#333' },
      { text: '청운승강기(주) 검사필', size: 20, weight: 500, color: '#555' },
    ],
  });
  ctx.mesh(planeGeo(0.24, 0.17), signMat('lift-cert', cert), x1 - 0.012, 1.6, -4.3, -Math.PI / 2);
  // advert on the left wall (facing +x)
  const adTexN = new THREE.CanvasTexture(adCanvas(false));
  adTexN.colorSpace = THREE.SRGBColorSpace;
  let adTexA: THREE.CanvasTexture | null = null;
  ctx.deco(boxGeo(0.02, 0.86, 0.66), m.chrome, x0 + 0.01, 1.45, -4.6);
  const adMesh = ctx.mesh(planeGeo(0.6, 0.8), new THREE.MeshStandardMaterial({ map: adTexN, roughness: 0.35 }), x0 + 0.022, 1.45, -4.6, Math.PI / 2);
  addInteract(inst, ctx, 'car-ad', 'inspect', '광고판 보기', x0 + 0.2, 1.45, -4.6, [0.3, 0.9, 0.7], { ad: true }, 1.8);
  const setAd = (anomaly: boolean) => {
    const mat = adMesh.material as THREE.MeshStandardMaterial;
    if (anomaly) {
      if (!adTexA) {
        adTexA = new THREE.CanvasTexture(adCanvas(true));
        adTexA.colorSpace = THREE.SRGBColorSpace;
      }
      mat.map = adTexA;
    } else mat.map = adTexN;
    mat.needsUpdate = true;
  };
  // indicator above the door inside
  const [indicatorCanvas] = T.makeCanvas(128, 64);
  drawIndicator(indicatorCanvas, '1', 0);
  const indicatorTex = new THREE.CanvasTexture(indicatorCanvas);
  indicatorTex.colorSpace = THREE.SRGBColorSpace;
  ctx.deco(boxGeo(0.34, 0.18, 0.02), m.black, 0, 2.25, z1 - 0.05);
  ctx.mesh(planeGeo(0.3, 0.15), new THREE.MeshBasicMaterial({ map: indicatorTex }), 0, 2.25, z1 - 0.062, Math.PI);
  // CCTV dome in the corner
  ctx.deco(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI), m.glassDark, x1 - 0.15, h - 0.01, z0 + 0.15);
  inst.cctv.push({ id: 'car', label: '승강기 내부', floor: CAR_FLOOR_ID, pos: new THREE.Vector3(x1 - 0.2, h - 0.12, z0 + 0.2), target: new THREE.Vector3(-0.3, 0.7, z1), fov: 95 });
  // car doors (two panels sliding sideways)
  const doorL = new THREE.Group();
  const doorR = new THREE.Group();
  const dg = boxGeo(0.52, 2.1, 0.03);
  const dl = new THREE.Mesh(dg, m.stainless);
  dl.position.set(-0.25, 1.05, 0);
  doorL.add(dl);
  const dr = new THREE.Mesh(dg, m.stainless);
  dr.position.set(0.25, 1.05, 0);
  doorR.add(dr);
  doorL.position.set(0, 0, z1 - 0.06);
  doorR.position.set(0, 0, z1 - 0.064); // 4 mm offset: the leaves overlap at the seam and must not be coplanar
  inst.group.add(doorL, doorR);
  const doorCollider = { x0: -0.5, x1: 0.5, y0: 0, y1: 2.1, z0: z1 - 0.1, z1: z1 - 0.02, tag: 'cardoor' };
  ctx.finish();
  inst.colliders.push(...ctx.colliders, doorCollider);
  inst.walkables.push(...ctx.walkables);
  return { inst, doorL, doorR, doorCollider, panelCanvas, panelTex, indicatorCanvas, indicatorTex, mirror, mirrorFigure, adMesh, setAd };
}
