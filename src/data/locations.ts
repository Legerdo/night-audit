// Inspectable locations: Korean names, "on site" zones and reference-photo viewpoints.
import { B1, FLOOR_13, RESIDENTIAL_FLOORS, floorLabel } from './building';
import type { LocKind } from './types';

export interface Shot {
  id: string;
  label: string;
  pos: [number, number, number]; // x, y (above floor), z
  target: [number, number, number];
  fov: number;
}

export interface LocationDef {
  id: string;
  kind: LocKind;
  floor: number;
  name: string;
  shots: Shot[];
}

const RES_SHOTS: Shot[] = [
  { id: 'east', label: '복도 전경 (동 → 서)', pos: [11.3, 1.6, 0.25], target: [-12, 1.25, -0.05], fov: 62 },
  { id: 'west', label: '복도 전경 (서 → 동)', pos: [-11.2, 1.6, -0.25], target: [12, 1.25, 0.05], fov: 62 },
  { id: 'hall', label: '승강기 홀', pos: [0.2, 1.6, 0.85], target: [-0.1, 1.2, -3.6], fov: 70 },
];

const GALLERY_SHOTS: Shot[] = [
  ...RES_SHOTS.slice(0, 2),
  { id: 'f-ceremony', label: '액자: 1994 준공식', pos: [-3.1, 1.52, 0.55], target: [-3.1, 1.52, -1.1], fov: 42 },
  { id: 'f-family', label: '액자: 1998 가족사진', pos: [2.8, 1.52, 0.55], target: [2.8, 1.52, -1.1], fov: 42 },
  { id: 'f-exterior', label: '액자: 1995 전경', pos: [-7.25, 1.52, -0.55], target: [-7.25, 1.52, 1.1], fov: 42 },
  { id: 'f-kimjang', label: '액자: 2005 김장', pos: [-2.5, 1.45, -0.55], target: [-2.5, 1.35, 1.1], fov: 46 },
  { id: 'f-rooftop', label: '액자: 2002 옥상', pos: [2.3, 1.52, -0.55], target: [2.3, 1.52, 1.1], fov: 42 },
];

const STAIR_SHOTS: Shot[] = [
  { id: 'landing', label: '계단실 층참', pos: [12.4, 1.6, 0.6], target: [15.5, 1.9, -1.6], fov: 72 },
  { id: 'sign', label: '층 표시', pos: [13.0, 1.6, 0.9], target: [13.0, 1.7, -2.5], fov: 55 },
];

export const LOCATIONS: LocationDef[] = [
  ...RESIDENTIAL_FLOORS.map((n) => ({
    id: n === 5 ? 'gallery:5' : `res:${n}`,
    kind: (n === 5 ? 'gallery' : 'res') as LocKind,
    floor: n,
    name: n === 5 ? '5층 복도 (추억 사진전)' : `${floorLabel(n)} 복도`,
    shots: n === 5 ? GALLERY_SHOTS : RES_SHOTS,
  })),
  ...[B1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
    id: `stair:${n}`,
    kind: 'stair' as LocKind,
    floor: n,
    name: `비상계단 ${n === B1 ? 'B1' : `${n}층`}`,
    shots: STAIR_SHOTS,
  })),
  {
    id: 'lobby:1',
    kind: 'lobby',
    floor: 1,
    name: '1층 로비',
    shots: [
      { id: 'west', label: '로비 전경', pos: [-10.8, 1.6, 0.2], target: [12, 1.2, 0.6], fov: 64 },
      { id: 'bay', label: '출입구 · 자판기 · 우편함', pos: [0.2, 1.6, -0.6], target: [0.4, 1.1, 3.6], fov: 74 },
      { id: 'board', label: '층별 안내판', pos: [3.4, 1.55, 0.95], target: [3.4, 1.5, -1.1], fov: 60 },
      { id: 'poster', label: '게시판 (실종 전단)', pos: [6.4, 1.6, -0.75], target: [6.4, 1.58, 1.1], fov: 58 },
    ],
  },
  {
    id: 'control:1',
    kind: 'control',
    floor: 1,
    name: '관리실',
    shots: [{ id: 'desk', label: '관리실 책상', pos: [-4.4, 1.6, -2.0], target: [-9.5, 1.1, -6.3], fov: 70 }],
  },
  {
    id: 'parcel:1',
    kind: 'parcel',
    floor: 1,
    name: '1층 택배보관실',
    shots: [{ id: 'room', label: '택배보관실', pos: [7.2, 1.6, -1.6], target: [9.4, 1.0, -5.6], fov: 72 }],
  },
  {
    id: 'elevator',
    kind: 'elevator',
    floor: 1,
    name: '승강기 내부',
    shots: [
      { id: 'car', label: '승강기 내부', pos: [0.1, 1.6, -3.7], target: [-0.1, 1.3, -5.6], fov: 80 },
      { id: 'ad', label: '승강기 광고판', pos: [0.45, 1.5, -4.6], target: [-1.0, 1.45, -4.6], fov: 58 },
    ],
  },
  {
    id: 'b1:0',
    kind: 'b1',
    floor: B1,
    name: '지하 1층 (전기실 · 문서고)',
    shots: [
      { id: 'corr', label: 'B1 복도', pos: [11.0, 1.6, 0.2], target: [-12, 1.2, 0], fov: 62 },
      { id: 'breakers', label: '전등 차단기 패널', pos: [-6.0, 1.45, -4.6], target: [-6.0, 1.3, -6.6], fov: 60 },
    ],
  },
  {
    id: 'shops:2',
    kind: 'shops',
    floor: 2,
    name: '2층 상가 복도',
    shots: [
      { id: 'east', label: '상가 복도 (동 → 서)', pos: [11.3, 1.6, 0.25], target: [-12, 1.3, -0.05], fov: 62 },
      { id: 'west', label: '상가 복도 (서 → 동)', pos: [-11.2, 1.6, -0.25], target: [12, 1.3, 0.05], fov: 62 },
    ],
  },
  {
    id: 'f13:13',
    kind: 'f13',
    floor: FLOOR_13,
    name: '13층',
    shots: [],
  },
];

export const LOCATION_BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]));

export function locationId(kind: LocKind, floor: number): string {
  if (kind === 'elevator') return 'elevator';
  if (kind === 'gallery') return 'gallery:5';
  return `${kind}:${floor}`;
}

export function location(id: string): LocationDef {
  const l = LOCATION_BY_ID.get(id);
  if (!l) throw new Error(`unknown location ${id}`);
  return l;
}

/** Is the player (feet position) inside the location's on-site zone? */
export function inLocation(id: string, floor: number, x: number, z: number, inCar: boolean): boolean {
  const l = LOCATION_BY_ID.get(id);
  if (!l) return false;
  if (l.kind === 'elevator') return inCar;
  if (inCar) return false;
  if (floor !== l.floor) return false;
  switch (l.kind) {
    case 'res':
    case 'gallery':
    case 'shops':
    case 'f13':
      return x >= -18.5 && x <= 12 && z >= -3.6 && z <= 1.1;
    case 'stair':
      return x > 12.05;
    case 'lobby':
      return x >= -12 && x <= 12 && z >= -3.6 && z <= 3.6;
    case 'control':
      return x >= -12 && x <= -3 && z <= -1.2;
    case 'parcel':
      return x >= 6.2 && x <= 11.8 && z <= -1.2;
    case 'b1':
      return true;
  }
}
