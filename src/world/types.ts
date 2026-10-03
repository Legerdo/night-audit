import * as THREE from 'three';
import type { AABB, Walkable } from './kit';

export type LightMode = 'on' | 'off' | 'flicker' | 'dim';

export interface LightAnchor {
  pos: THREE.Vector3;
  mat: THREE.MeshStandardMaterial | null;
  color: THREE.Color;
  intensity: number;
  distance: number;
  mode: LightMode;
  seed: number;
  baseEmissive: number;
  /** runtime multiplier used by blackouts/corrections (1 = normal) */
  gain: number;
  floor: number;
  tag?: string;
}

export type DoorKind = 'fire' | 'room' | 'unit' | 'entrance' | 'cabinet';

export interface DoorObj {
  id: string;
  kind: DoorKind;
  pivot: THREE.Object3D;
  open: number;
  target: number;
  maxAngle: number;
  collider: AABB;
  locked: boolean;
  lockedMsg: string;
  autoClose: number; // seconds, 0 = stays open
  openTimer: number;
  label: string;
  floor: number;
  /** world-space centre of doorway (for audio + auto-close checks) */
  center: THREE.Vector3;
}

export type InteractKind =
  | 'door'
  | 'unit_door'
  | 'elevator_call'
  | 'elevator_panel'
  | 'inspect'
  | 'archive_cabinet'
  | 'desk_log'
  | 'key_box'
  | 'monitors'
  | 'intercom_panel'
  | 'pickup'
  | 'breaker_panel'
  | 'entrance'
  | 'locker'
  | 'filing_cabinet'
  | 'message';

export interface Interactable {
  id: string;
  kind: InteractKind;
  object: THREE.Object3D;
  prompt: string;
  data?: Record<string, unknown>;
  floor: number;
  /** max interaction distance */
  range?: number;
}

export interface CctvMount {
  id: string;
  label: string;
  floor: number;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface LandingDoors {
  left: THREE.Object3D;
  right: THREE.Object3D;
  collider: AABB;
  indicator: THREE.Mesh;
  callLamp: THREE.MeshStandardMaterial;
}

export interface FloorInstance {
  n: number;
  group: THREE.Group;
  colliders: AABB[];
  walkables: Walkable[];
  lights: LightAnchor[];
  doors: Map<string, DoorObj>;
  interactables: Interactable[];
  named: Map<string, THREE.Object3D>;
  cctv: CctvMount[];
  landing: LandingDoors | null;
  updaters: ((dt: number, t: number) => void)[];
  mods: ReadonlySet<string>;
}

/** Game-state inputs the builder needs (never raw transient geometry). */
export interface WorldFlags {
  act: number;
  f13Open: boolean;
  unlockedDoors: ReadonlySet<string>;
  pickedUp: ReadonlySet<string>;
  /** anomaly ids the player has correctly reported (displayed on the impossible floor) */
  corrected: readonly string[];
  identityCompromised: boolean;
}

export interface BuildEnv {
  mods: ReadonlySet<string>;
  flags: WorldFlags;
  forReference: boolean;
}

export const LAYER_CCTV_ONLY = 2;
export const LAYER_MIRROR_ONLY = 3;
