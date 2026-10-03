// Shared materials. Created once, reused by every floor instance (and the reference renderer).
import * as THREE from 'three';
import * as T from './textures';

type M = THREE.MeshStandardMaterial;

function std(p: THREE.MeshStandardMaterialParameters): M {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...p });
}

let _mats: ReturnType<typeof createMaterials> | null = null;

function createMaterials() {
  return {
    wallCream: std({ map: T.paintTex('cream', '#d8d0bd', 11), roughness: 0.92 }),
    wainscot: std({ map: T.woodGrainTex('wains', '#8f7a60', '#4a3a28', 12), roughness: 0.7 }),
    baseboard: std({ color: '#4c4238', roughness: 0.6 }),
    wallGray: std({ map: T.paintTex('gray', '#b9b8b2', 13), roughness: 0.9 }),
    wallGreenLow: std({ map: T.paintTex('greenlow', '#6f8a78', 14), roughness: 0.8 }),
    wallConcrete: std({ map: T.concreteTex('b1wall', '#8e8d88', 15), roughness: 0.95 }),
    wall94: std({ map: T.wallpaper94Tex(), roughness: 0.95 }),
    wallApt: std({ map: T.paintTex('apt', '#e2ddd2', 16), roughness: 0.95 }),
    floorDeco: std({ map: T.decoTileTex('corr', '#b7ad99', '#aca28e', 21), roughness: 0.55 }),
    floorLobby: std({ map: T.terrazzoTex('lobby', '#8f8a82', ['#6d6961', '#b5b0a6', '#4f4b45', '#c9c3b6'], 22), roughness: 0.35, metalness: 0.05 }),
    floorStair: std({ map: T.terrazzoTex('stair', '#9c998f', ['#77746b', '#c3beb2', '#5a574f'], 23), roughness: 0.6 }),
    floorEpoxy: std({ map: T.paintTex('epoxy', '#56745f', 24), roughness: 0.4 }),
    floorLino: std({ map: T.decoTileTex('lino', '#8e9290', '#878b89', 25), roughness: 0.6 }),
    floor94: std({ map: T.terrazzoTex('f94', '#6f7560', ['#4f5445', '#9aa08a', '#3b3f33', '#b8b095'], 26), roughness: 0.5 }),
    floorJangpan: std({ map: T.jangpanTex(), roughness: 0.5 }),
    ceiling: std({ map: T.ceilingTex('tex', '#dcd8cf', 31), roughness: 1 }),
    ceilingConcrete: std({ map: T.concreteTex('ceilc', '#9d9c97', 32), roughness: 1 }),
    ceiling94: std({ map: T.paintTex('ceil94', '#c8bea4', 33), roughness: 1 }),
    doorWood: std({ map: T.woodGrainTex('door', '#5b4331', '#2d2017', 41), roughness: 0.55 }),
    doorGreen94: std({ map: T.paintTex('door94', '#4d6a55', 42), roughness: 0.6 }),
    doorFrame: std({ color: '#6b6258', roughness: 0.6, metalness: 0.2 }),
    fireDoor: std({ map: T.paintTex('fire', '#8a8f86', 43), roughness: 0.6, metalness: 0.2 }),
    steelDoor: std({ map: T.paintTex('steeld', '#9a9c9a', 44), roughness: 0.5, metalness: 0.3 }),
    stainless: std({ map: T.steelTex('ss', '#a9adb0', 45), roughness: 0.32, metalness: 0.85 }),
    stainlessDark: std({ map: T.steelTex('ssd', '#6f7377', 46), roughness: 0.4, metalness: 0.8 }),
    shutter: std({ map: T.shutterTex(), roughness: 0.5, metalness: 0.6 }),
    black: std({ color: '#141414', roughness: 0.6 }),
    darkPlastic: std({ color: '#2a2b2d', roughness: 0.5 }),
    whitePlastic: std({ color: '#e7e6e0', roughness: 0.5 }),
    beigePlastic: std({ color: '#cfc6b0', roughness: 0.6 }),
    red: std({ color: '#b3231e', roughness: 0.45 }),
    redDark: std({ color: '#7d1814', roughness: 0.5 }),
    brass: std({ color: '#a8894a', roughness: 0.35, metalness: 0.8 }),
    chrome: std({ color: '#d0d4d8', roughness: 0.2, metalness: 1 }),
    cardboard: std({ color: '#b08a5a', roughness: 0.9 }),
    cardboardDark: std({ color: '#96734a', roughness: 0.9 }),
    tape: std({ color: '#c9b98a', roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fb2b8', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
    glassDark: new THREE.MeshStandardMaterial({ color: '#1a2226', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false }),
    greenSign: std({ color: '#1f8a4c', emissive: new THREE.Color('#1c9a50'), emissiveIntensity: 0.9 }),
    woodDesk: std({ map: T.woodGrainTex('desk', '#8a6d4c', '#4a3825', 51), roughness: 0.6 }),
    fabricBlue: std({ color: '#3d4a5c', roughness: 1 }),
    fabricBrown: std({ color: '#6a5443', roughness: 1 }),
    fabricDark: std({ color: '#26282c', roughness: 1 }),
    skin: std({ color: '#c9a58a', roughness: 0.8 }),
    skinPale: std({ color: '#d9cfc5', roughness: 0.9 }),
    hair: std({ color: '#141212', roughness: 0.9 }),
    rubber: std({ color: '#1c1c1c', roughness: 0.9 }),
    plantGreen: std({ color: '#3f5f36', roughness: 0.9 }),
    potTerracotta: std({ color: '#9a5a3c', roughness: 0.9 }),
    paper: std({ color: '#ece7da', roughness: 0.95 }),
    binderRed: std({ color: '#8b1f1f', roughness: 0.7 }),
    binderBlue: std({ color: '#2d3f63', roughness: 0.7 }),
    binderGray: std({ color: '#6c6c68', roughness: 0.7 }),
    metalGray: std({ color: '#7e8284', roughness: 0.5, metalness: 0.5 }),
    metalBeige: std({ color: '#c4bca8', roughness: 0.55, metalness: 0.35 }),
    pipe: std({ color: '#8a8475', roughness: 0.6, metalness: 0.3 }),
    pipeRed: std({ color: '#8f2b22', roughness: 0.6, metalness: 0.2 }),
    city: new THREE.MeshBasicMaterial({ map: T.cityTex(3), fog: false }),
    street: new THREE.MeshBasicMaterial({ map: T.streetTex(), fog: false }),
    blobShadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
  };
}

export type Materials = ReturnType<typeof createMaterials>;

export function mats(): Materials {
  if (!_mats) _mats = createMaterials();
  return _mats;
}

/** Fixture panel material (cloned per fixture so each can flicker independently). */
export function fixtureMaterial(color = '#f3f6ff', intensity = 2.2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.4 });
}

const texMatCache = new Map<string, THREE.MeshStandardMaterial>();
/** Material for a text/sign texture (cached by texture key). */
export function signMat(key: string, tex: THREE.Texture, opts: { emissive?: number; transparent?: boolean; roughness?: number } = {}): THREE.MeshStandardMaterial {
  const k = `${key}|${opts.emissive ?? 0}|${opts.transparent ? 1 : 0}`;
  let m = texMatCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: opts.roughness ?? 0.7,
      transparent: !!opts.transparent,
      emissive: opts.emissive ? new THREE.Color('#ffffff') : new THREE.Color('#000000'),
      emissiveMap: opts.emissive ? tex : null,
      emissiveIntensity: opts.emissive ?? 0,
    });
    texMatCache.set(k, m);
  }
  return m;
}
