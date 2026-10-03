// Per-floor signature props and misc furniture, all built from primitives.
import * as THREE from 'three';
import type { SignatureKind } from '../data/building';
import { boxGeo } from './kit';
import { mats } from './materials';

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, g: THREE.Group, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}

export function makeSignature(kind: SignatureKind): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  g.name = `sig:${kind}`;
  switch (kind) {
    case 'bicycle': {
      const frameMat = new THREE.MeshStandardMaterial({ color: '#2f5b8a', roughness: 0.4, metalness: 0.5 });
      for (const x of [-0.5, 0.5]) mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 28), m.rubber, x, 0.35, 0, g);
      mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 6), frameMat, 0, 0.55, 0, g, 0, 0, Math.PI / 2);
      mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 6), frameMat, -0.2, 0.5, 0, g, 0, 0, 0.9);
      mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), frameMat, 0.3, 0.55, 0, g, 0, 0, -0.5);
      mesh(boxGeo(0.22, 0.05, 0.1), m.black, -0.12, 0.84, 0, g);
      mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), m.chrome, 0.42, 0.95, 0, g, Math.PI / 2);
      break;
    }
    case 'plants': {
      for (const [x, s] of [
        [-0.35, 1],
        [0.1, 0.8],
        [0.5, 1.2],
      ] as const) {
        mesh(new THREE.CylinderGeometry(0.16 * s, 0.12 * s, 0.3 * s, 12), m.potTerracotta, x, 0.15 * s, 0, g);
        mesh(new THREE.SphereGeometry(0.22 * s, 10, 8), m.plantGreen, x, 0.42 * s, 0, g);
        mesh(new THREE.ConeGeometry(0.12 * s, 0.4 * s, 8), m.plantGreen, x, 0.65 * s, 0, g);
      }
      break;
    }
    case 'boxes': {
      mesh(boxGeo(0.6, 0.45, 0.45), m.cardboard, 0, 0.225, 0, g);
      mesh(boxGeo(0.55, 0.4, 0.42), m.cardboardDark, 0.02, 0.65, 0.01, g, 0, 0.08);
      mesh(boxGeo(0.5, 0.35, 0.4), m.cardboard, 0.65, 0.175, 0.02, g, 0, -0.1);
      mesh(boxGeo(0.62, 0.03, 0.12), m.tape, 0, 0.455, 0, g);
      break;
    }
    case 'umbrella': {
      mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.5, 14, 1, true), m.metalGray, 0, 0.25, 0, g);
      const cols = ['#20304a', '#6b1d1d', '#2e4a2c'];
      cols.forEach((c, i) => {
        const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
        mesh(new THREE.ConeGeometry(0.05, 0.72, 8), mat, -0.04 + i * 0.04, 0.55, (i - 1) * 0.03, g, Math.PI, 0, (i - 1) * 0.08);
        mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 12, Math.PI), m.black, -0.04 + i * 0.04, 0.95, (i - 1) * 0.03, g);
      });
      break;
    }
    case 'stroller': {
      const body = new THREE.MeshStandardMaterial({ color: '#4d5f6e', roughness: 0.8 });
      mesh(boxGeo(0.45, 0.28, 0.75), body, 0, 0.55, 0, g);
      mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 0.7, -0.22, g, -0.5);
      for (const [x, z] of [
        [-0.2, -0.3],
        [0.2, -0.3],
        [-0.2, 0.3],
        [0.2, 0.3],
      ]) mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 14), m.rubber, x, 0.1, z, g, 0, Math.PI / 2);
      mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), m.chrome, 0, 0.8, 0.45, g, 0.5);
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), m.rubber, 0, 1.1, 0.62, g, 0, 0, Math.PI / 2);
      break;
    }
    case 'recycling': {
      const bag = new THREE.MeshStandardMaterial({ color: '#e6e8e8', roughness: 0.4, transparent: true, opacity: 0.92 });
      mesh(new THREE.SphereGeometry(0.28, 12, 10), bag, 0, 0.26, 0, g).scale.set(1, 0.95, 0.9);
      mesh(new THREE.SphereGeometry(0.22, 12, 10), bag, 0.45, 0.2, 0.05, g);
      mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: '#4c7ba8', roughness: 0.4 }), -0.4, 0.19, 0.02, g);
      break;
    }
    case 'newspapers': {
      for (let i = 0; i < 6; i++) mesh(boxGeo(0.42, 0.05, 0.3), m.paper, (i % 2) * 0.02, 0.025 + i * 0.05, 0, g, 0, i * 0.06);
      mesh(boxGeo(0.44, 0.02, 0.02), m.tape, 0, 0.16, 0, g);
      break;
    }
    case 'scooter': {
      const mat = new THREE.MeshStandardMaterial({ color: '#d34f7a', roughness: 0.5 });
      mesh(boxGeo(0.6, 0.04, 0.14), mat, 0, 0.1, 0, g);
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 6), m.chrome, 0.28, 0.48, 0, g);
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6), m.black, 0.28, 0.86, 0, g, Math.PI / 2);
      for (const x of [-0.26, 0.3]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), m.rubber, x, 0.06, 0, g, Math.PI / 2);
      break;
    }
    case 'bucket': {
      const blue = new THREE.MeshStandardMaterial({ color: '#2f6fa8', roughness: 0.5 });
      mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.32, 14), blue, 0, 0.16, 0, g);
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), m.woodDesk, 0.06, 0.75, 0.02, g, 0.05, 0, -0.15);
      mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.22, 8), m.fabricBrown, 0, 0.3, 0, g);
      break;
    }
    case 'shoe_cabinet': {
      mesh(boxGeo(0.8, 1.0, 0.35), m.woodDesk, 0, 0.5, 0, g);
      break;
    }
  }
  return g;
}

export function makeVendingMachine(): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: '#8a2530', roughness: 0.4, metalness: 0.2 });
  mesh(boxGeo(0.9, 1.8, 0.75), shell, 0, 0.9, 0, g);
  const panel = new THREE.MeshStandardMaterial({ color: '#e8ddc8', emissive: new THREE.Color('#fff1cf'), emissiveIntensity: 0.55, roughness: 0.3 });
  mesh(boxGeo(0.6, 0.62, 0.02), panel, -0.08, 1.28, 0.38, g);
  // cup menu tiles
  const tile = new THREE.MeshStandardMaterial({ color: '#6b4a2e', emissive: new THREE.Color('#3a2412'), emissiveIntensity: 0.4 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) mesh(boxGeo(0.15, 0.2, 0.01), tile, -0.26 + c * 0.18, 1.4 - r * 0.26, 0.395, g);
  mesh(boxGeo(0.2, 0.25, 0.05), m.black, -0.08, 0.55, 0.36, g);
  mesh(boxGeo(0.12, 0.3, 0.03), m.stainlessDark, 0.3, 1.1, 0.385, g);
  const btn = new THREE.MeshStandardMaterial({ color: '#f0f0f0', emissive: new THREE.Color('#ffae3b'), emissiveIntensity: 0.8 });
  for (let i = 0; i < 4; i++) mesh(boxGeo(0.05, 0.03, 0.02), btn, 0.3, 1.18 - i * 0.07, 0.4, g);
  return g;
}

export function makeDesk(w = 1.6, d = 0.7): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  mesh(boxGeo(w, 0.04, d), m.woodDesk, 0, 0.74, 0, g);
  mesh(boxGeo(0.45, 0.7, d - 0.04), m.metalBeige, w / 2 - 0.25, 0.36, 0, g);
  mesh(boxGeo(0.04, 0.72, d - 0.04), m.metalBeige, -w / 2 + 0.03, 0.36, 0, g);
  mesh(boxGeo(w - 0.06, 0.5, 0.02), m.metalBeige, 0, 0.45, -d / 2 + 0.02, g);
  return g;
}

export function makeOfficeChair(): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  mesh(boxGeo(0.48, 0.08, 0.46), m.fabricBlue, 0, 0.48, 0, g);
  mesh(boxGeo(0.46, 0.55, 0.07), m.fabricBlue, 0, 0.82, -0.22, g, -0.08);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 8), m.chrome, 0, 0.26, 0, g);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    mesh(boxGeo(0.3, 0.03, 0.04), m.black, Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15, g, 0, -a);
  }
  return g;
}

export function makeMonitor(screenMat: THREE.Material, w = 0.5, h = 0.38): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  mesh(boxGeo(w + 0.06, h + 0.06, 0.08), m.darkPlastic, 0, h / 2 + 0.2, 0, g);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
  screen.position.set(0, h / 2 + 0.2, 0.044); // 4 mm in front of the bezel
  screen.name = 'screen';
  g.add(screen);
  mesh(boxGeo(0.08, 0.16, 0.08), m.darkPlastic, 0, 0.1, -0.02, g);
  mesh(boxGeo(0.28, 0.02, 0.2), m.darkPlastic, 0, 0.01, -0.02, g);
  return g;
}

export function makeShelf(w: number, h: number, d: number, levels: number, withBinders: boolean, seed: number): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  for (const x of [-w / 2, w / 2]) mesh(boxGeo(0.03, h, d), m.metalGray, x, h / 2, 0, g);
  for (let i = 0; i < levels; i++) {
    const y = 0.05 + (i * (h - 0.1)) / (levels - 1);
    mesh(boxGeo(w, 0.02, d), m.metalGray, 0, y, 0, g);
    if (withBinders && i < levels - 1) {
      let x = -w / 2 + 0.06;
      let k = seed + i * 7;
      while (x < w / 2 - 0.08) {
        k = (k * 1103515245 + 12345) & 0x7fffffff;
        const bw = 0.06 + (k % 5) * 0.012;
        const bh = 0.26 + (k % 3) * 0.03;
        const mat = [m.binderBlue, m.binderGray, m.binderRed, m.paper, m.cardboard][k % 5];
        mesh(boxGeo(bw, bh, d * 0.8), mat, x + bw / 2, y + 0.01 + bh / 2, 0, g);
        x += bw + 0.008;
      }
    }
  }
  return g;
}

export function makeCabinet(w: number, h: number, d: number, mat: THREE.Material): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  mesh(boxGeo(w, h, d), mat, 0, h / 2, 0, g);
  mesh(boxGeo(0.01, h - 0.08, 0.005), m.black, 0, h / 2, d / 2 + 0.003, g);
  for (const s of [-1, 1]) mesh(boxGeo(0.02, 0.14, 0.03), m.chrome, s * 0.06, h * 0.55, d / 2 + 0.015, g);
  return g;
}
