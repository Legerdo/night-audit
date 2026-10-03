// Canonical building baseline: 청운빌딩 (Cheongun Building), 1994 준공, 12층 주상복합.
// Everything here is authored data; the world builder derives geometry from it deterministically.

export const FLOOR_H = 3.2;
export const CEIL_H = 2.7;
export const B1 = 0;
export const TOP_FLOOR = 12;
export const FLOOR_13 = 13;

/** Corridor spine shared by every floor. */
export const SPINE = { x0: -12, x1: 12, z0: -1.1, z1: 1.1 };
/** Elevator hall (north, centre). */
export const HALL = { x0: -1.6, x1: 1.6, z0: -3.6, z1: -1.1 };
/** Elevator car interior. */
export const CAR = { x0: -1.0, x1: 1.0, z0: -5.6, z1: -3.6, h: 2.45, doorW: 1.0 };
/** Stairwell box east of the spine. */
export const STAIR = { x0: 12, x1: 18.2, z0: -2.5, z1: 2.5, landingX1: 14, midX0: 17 };

export function floorY(n: number): number {
  return (n - 1) * FLOOR_H;
}

export function floorLabel(n: number): string {
  if (n === B1) return 'B1';
  return `${n}층`;
}

export function floorShort(n: number): string {
  if (n === B1) return 'B1';
  return `${n}F`;
}

export type FloorKind = 'b1' | 'lobby' | 'shops' | 'residential' | 'f13';

export function floorKind(n: number): FloorKind {
  if (n === B1) return 'b1';
  if (n === 1) return 'lobby';
  if (n === 2) return 'shops';
  if (n === FLOOR_13) return 'f13';
  return 'residential';
}

export const RESIDENTIAL_FLOORS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/** Floors eligible for generic corridor anomalies (5F hosts the photo exhibition). */
export const GENERIC_CORRIDOR_FLOORS = [3, 4, 6, 7, 8, 9, 10, 11, 12];
export const ELEVATOR_STOPS = [B1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Unit door slots on residential floors. side: -1 = north wall, +1 = south wall. */
export interface UnitSlot {
  idx: number; // 1..8
  x: number;
  side: -1 | 1;
}
export const UNIT_SLOTS: UnitSlot[] = [
  { idx: 1, x: -9.5, side: -1 },
  { idx: 2, x: -5.0, side: -1 },
  { idx: 3, x: 4.6, side: -1 },
  { idx: 4, x: 9.0, side: -1 },
  { idx: 5, x: -9.5, side: 1 },
  { idx: 6, x: -5.0, side: 1 },
  { idx: 7, x: 0.0, side: 1 },
  { idx: 8, x: 4.6, side: 1 },
];
export const EPS_DOOR = { x: 9.0, side: 1 as const };
export const EXTINGUISHER_BOX = { x: -7.25, side: -1 as const };
export const HYDRANT = { x: 7.0, side: 1 as const };
export const LIGHT_XS = [-10, -6, -2, 2, 6, 10];
export const CCTV_POS = { x: 11.3, y: 2.55, z: 0.75 };

export function unitNumber(floor: number, idx: number): string {
  return `${floor}${String(idx).padStart(2, '0')}`;
}

export type UnitStatus = 'occupied' | 'moved' | 'vacant';

export interface Resident {
  unit: string;
  name: string;
  status: UnitStatus;
  since: string; // 입주일
  note?: string;
  portrait?: string; // asset key in images registry
  age?: number;
}

/** Per-floor authored details that make repeated corridors distinguishable. */
export interface FloorProps {
  signature: { kind: SignatureKind; slot: number; label: string } | null;
  parcels: number[]; // unit idx with a parcel at the door
  flickerLight: number | null; // documented known defect (index into LIGHT_XS)
  vacantTape: number[]; // units with 공실 sticker
}
export type SignatureKind = 'bicycle' | 'plants' | 'boxes' | 'umbrella' | 'stroller' | 'recycling' | 'newspapers' | 'scooter' | 'bucket' | 'shoe_cabinet';

export const FLOOR_PROPS: Record<number, FloorProps> = {
  3: { signature: { kind: 'bicycle', slot: 5, label: '자전거' }, parcels: [2], flickerLight: null, vacantTape: [4, 7] },
  4: { signature: { kind: 'plants', slot: 1, label: '화분' }, parcels: [6], flickerLight: null, vacantTape: [3, 8] },
  5: { signature: null, parcels: [], flickerLight: null, vacantTape: [2, 6] },
  6: { signature: { kind: 'boxes', slot: 6, label: '이삿짐 상자' }, parcels: [3], flickerLight: null, vacantTape: [1, 5] },
  7: { signature: { kind: 'umbrella', slot: 3, label: '우산꽂이' }, parcels: [8], flickerLight: 2, vacantTape: [6] },
  8: { signature: { kind: 'stroller', slot: 5, label: '유모차' }, parcels: [1, 7], flickerLight: null, vacantTape: [2, 4] },
  9: { signature: { kind: 'recycling', slot: 8, label: '분리수거 봉투' }, parcels: [], flickerLight: null, vacantTape: [3, 5, 6] },
  10: { signature: { kind: 'newspapers', slot: 2, label: '신문 뭉치' }, parcels: [4], flickerLight: null, vacantTape: [7, 8] },
  11: { signature: { kind: 'scooter', slot: 7, label: '킥보드' }, parcels: [3], flickerLight: null, vacantTape: [1, 2] },
  12: { signature: { kind: 'bucket', slot: 3, label: '대걸레 양동이' }, parcels: [], flickerLight: null, vacantTape: [4, 5, 8] },
};

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const GIVEN = ['민수', '영희', '지훈', '수진', '현우', '미경', '성호', '은정', '동현', '혜진', '재석', '윤아', '상철', '미란', '준호', '경숙', '태민', '선영', '병철', '다은', '영수', '정희', '광호', '소연', '진우', '말순', '대현', '보람', '승민', '옥자'];

/** Named residents with fixed identities (recurring characters). */
const NAMED: Record<string, Omit<Resident, 'unit'>> = {
  '305': { name: '김도현', status: 'occupied', since: '2021.03.02', age: 34, portrait: 'res_kimdohyun', note: '배달 기사. 야간 출입 잦음.' },
  '602': { name: '박영수', status: 'occupied', since: '1995.02.11', age: 63, portrait: 'res_parkyoungsoo', note: '입주자 대표. 재개발 반대 서명 주도.' },
  '803': { name: '이순자', status: 'occupied', since: '1994.12.20', age: 76, portrait: 'res_leesoonja', note: '최초 입주 세대. 청력 약함.' },
  '1007': { name: '최민영', status: 'moved', since: '2008.06.30', age: 45, portrait: 'res_choiminyoung', note: '2026.08.14 이주 완료. 열쇠 반납됨.' },
  '1108': { name: '오지은', status: 'occupied', since: '2024.02.26', age: 19, portrait: 'res_ohjieun', note: '재수생. 새벽 귀가.' },
  '1204': { name: '(공실)', status: 'vacant', since: '-', note: '2026.07.31 퇴거. 전 거주자: 관리직원 숙소.' },
  '503': { name: '정미경', status: 'moved', since: '1996.04.02', age: 60, note: '2026.06.30 이주 완료. 가족사진 전시 제공.' },
};

function genName(unit: string): string {
  let h = 0;
  for (const c of unit) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SURNAMES[h % SURNAMES.length] + GIVEN[(h >>> 5) % GIVEN.length];
}

function genSince(unit: string): string {
  let h = 7;
  for (const c of unit) h = (h * 17 + c.charCodeAt(0)) >>> 0;
  const y = 1995 + (h % 30);
  const m = 1 + ((h >>> 3) % 12);
  const d = 1 + ((h >>> 7) % 27);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

/** Baseline resident directory (the Tier-A original cards match this exactly). */
export function buildResidents(): Resident[] {
  const list: Resident[] = [];
  for (const f of RESIDENTIAL_FLOORS) {
    const props = FLOOR_PROPS[f];
    for (const slot of UNIT_SLOTS) {
      const unit = unitNumber(f, slot.idx);
      const named = NAMED[unit];
      if (named) {
        list.push({ unit, ...named });
        continue;
      }
      const moved = props.vacantTape.includes(slot.idx);
      list.push({
        unit,
        name: moved ? '(공실)' : genName(unit),
        status: moved ? 'moved' : 'occupied',
        since: moved ? '-' : genSince(unit),
        note: moved ? '재개발 이주 완료.' : undefined,
      });
    }
  }
  return list;
}

export const RESIDENTS: Resident[] = buildResidents();

export function residentByUnit(unit: string): Resident | undefined {
  return RESIDENTS.find((r) => r.unit === unit);
}

export function isUnitVacant(unit: string): boolean {
  const r = residentByUnit(unit);
  return !r || r.status !== 'occupied';
}

/** 2F commercial shutters. */
export const SHOPS = [
  { x: -9.0, side: -1 as const, name: '청운부동산', sub: '매매 · 전세 · 월세' },
  { x: -4.5, side: -1 as const, name: '한솔수학학원', sub: '중 · 고등부' },
  { x: 5.0, side: -1 as const, name: '새한세탁', sub: '수선 · 드라이' },
  { x: -7.0, side: 1 as const, name: '미소치과', sub: '폐업 안내' },
  { x: 0.0, side: 1 as const, name: '행복미용실', sub: '커트 · 파마' },
  { x: 6.5, side: 1 as const, name: '대성보일러', sub: '설비 · 누수' },
];

export const BUILDING = {
  name: '청운빌딩',
  address: '서울특별시 ○○구 청운로 13',
  completed: '1994.11.30',
  demolition: '2026.12.01',
  floorsOfficial: 12,
};

export const PLAYER = {
  name: '한서진',
  id: 'CW-0929',
  hired: '2026.09.29',
  contract: '임시 (야간 1회 대체 근무)',
  shift: '00:00 – 06:00',
};

export const FORMER = {
  name: '박정호',
  id: 'CW-0412',
  hired: '2019.04.12',
};
