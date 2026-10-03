// Analogue wall clock whose hands follow the game clock (or run backwards when an anomaly says so).
import * as THREE from 'three';
import { mats } from './materials';
import * as T from './textures';

/** Shared game-time source written by the game loop (minutes since 00:00, fractional). */
export const gameClock = { minutes: 0 };

function faceTex(style: 'modern' | '94'): THREE.Texture {
  return T.cached(`clockface:${style}`, () => {
    const [c, ctx] = T.makeCanvas(256, 256);
    ctx.fillStyle = style === '94' ? '#efe3c3' : '#f5f5f2';
    ctx.beginPath();
    ctx.arc(128, 128, 126, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#1b1b1b';
    ctx.font = `700 30px ${T.FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(String(i), 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
    }
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r0 = i % 5 === 0 ? 112 : 117;
      ctx.lineWidth = i % 5 === 0 ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
      ctx.lineTo(128 + Math.cos(a) * 122, 128 + Math.sin(a) * 122);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export interface WallClock {
  group: THREE.Group;
  update: () => void;
}

/** Clock facing +z in local space. `backward` makes the hands run counter-clockwise from 00:00. */
export function makeWallClock(radius: number, style: 'modern' | '94', backward: () => boolean, offsetMin = 0): WallClock {
  const m = mats();
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.02, radius + 0.02, 0.05, 32).rotateX(Math.PI / 2), style === '94' ? m.woodDesk : m.darkPlastic);
  g.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), new THREE.MeshStandardMaterial({ map: faceTex(style), roughness: 0.6 }));
  face.position.z = 0.029; // 4 mm in front of the rim
  g.add(face);
  const handMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 });
  const hour = new THREE.Group();
  const hm = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.08, radius * 0.55, 0.01), handMat);
  hm.position.y = radius * 0.25;
  hour.add(hm);
  hour.position.z = 0.032;
  const min = new THREE.Group();
  const mm = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.05, radius * 0.8, 0.01), handMat);
  mm.position.y = radius * 0.38;
  min.add(mm);
  min.position.z = 0.036;
  // No second hand: game time runs faster than real time and a racing second hand would read as an anomaly.
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.05, radius * 0.05, 0.012, 12).rotateX(Math.PI / 2), handMat);
  cap.position.z = 0.04;
  g.add(hour, min, cap);
  const update = () => {
    const back = backward();
    const t = gameClock.minutes + offsetMin;
    // rotation.z > 0 is counter-clockwise when viewed from the front (+z).
    const minuteAngle = ((t % 60) / 60) * Math.PI * 2;
    const hourAngle = (((t / 60) % 12) / 12) * Math.PI * 2;
    min.rotation.z = back ? minuteAngle : -minuteAngle;
    hour.rotation.z = back ? hourAngle : -hourAngle;
  };
  update();
  return { group: g, update };
}
