// Human figure built from primitives. Deliberately featureless: reads as "a person" at corridor
// distances and in CCTV, without uncanny detailed faces that could drift or look accidental.
import * as THREE from 'three';
import { mats } from './materials';

export interface FigureOpts {
  coat?: THREE.Material;
  pants?: THREE.Material;
  skin?: THREE.Material;
  height?: number;
  hunch?: number;
  vest?: boolean; // maintenance vest with reflective stripes (player avatar / former manager)
}

export function makeFigure(o: FigureOpts = {}): THREE.Group {
  const m = mats();
  const g = new THREE.Group();
  const coat = o.coat ?? m.fabricDark;
  const pants = o.pants ?? m.fabricDark;
  const skin = o.skin ?? m.skinPale;
  const H = o.height ?? 1.72;
  const s = H / 1.72;

  const legGeo = new THREE.CapsuleGeometry(0.075 * s, 0.72 * s, 4, 8);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, pants);
    leg.position.set(0.1 * side * s, 0.45 * s, 0);
    g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.07 * s, 0.26 * s), m.black);
    shoe.position.set(0.1 * side * s, 0.035, 0.04 * s);
    g.add(shoe);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19 * s, 0.42 * s, 4, 10), coat);
  torso.position.set(0, 1.12 * s, 0);
  torso.scale.set(1, 1, 0.62);
  torso.rotation.x = o.hunch ?? 0.05;
  g.add(torso);
  if (o.vest) {
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#c9c9b8', emissive: new THREE.Color('#5a5a50'), emissiveIntensity: 0.4, roughness: 0.3 });
    for (const y of [1.02, 1.2]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.035, 14, 1, true), stripeMat);
      st.position.set(0, y * s, 0);
      st.scale.set(1, 1, 0.64);
      g.add(st);
    }
  }
  const armGeo = new THREE.CapsuleGeometry(0.06 * s, 0.58 * s, 4, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, coat);
    arm.position.set(0.25 * side * s, 1.08 * s, 0.01);
    arm.rotation.z = 0.06 * side;
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 8, 6), skin);
    hand.position.set(0.27 * side * s, 0.72 * s, 0.02);
    g.add(hand);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.055 * s, 0.1 * s, 8), skin);
  neck.position.set(0, 1.44 * s, 0.01);
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105 * s, 16, 12), skin);
  head.position.set(0, 1.56 * s, 0.02);
  head.scale.set(0.92, 1.08, 1);
  head.name = 'head';
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair);
  hair.position.set(0, 1.575 * s, 0.005);
  hair.scale.set(0.95, 1.05, 1.02);
  g.add(hair);
  // eye sockets: two dark dimples (subtle, readable only close up)
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#1a1512' });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 6, 4), eyeMat);
    eye.position.set(0.034 * side * s, 1.57 * s, 0.117 * s);
    g.add(eye);
  }
  g.userData.figure = true;
  return g;
}

export function setLayerRecursive(o: THREE.Object3D, layer: number): void {
  o.traverse((c) => c.layers.set(layer));
}
