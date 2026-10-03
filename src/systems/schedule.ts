// Deterministic, seeded incident scheduler. Same seed + same logical state => same incidents.
import { Rng } from '../core/rng';
import { ANOMALIES, anomaly } from '../data/anomalies';
import { GENERIC_CORRIDOR_FLOORS, RESIDENTIAL_FLOORS, RESIDENTS, floorLabel } from '../data/building';
import { LOCATION_BY_ID, locationId } from '../data/locations';
import { NORMAL_CHANNELS, OPTIONALS, SLOTS, TEMPLATES, type SlotDef } from '../data/story';
import type { AnomalyDef, Channel, Incident, LocKind } from '../data/types';
import { parseClock, type GameState } from '../game/state';
import { band, reliability } from './rules';

/** Korean particle selection based on the final syllable (받침). */
export function josa(word: string, pair: '이/가' | '을/를' | '은/는' | '과/와' | '으로/로'): string {
  const ch = word.charCodeAt(word.length - 1);
  const isHangul = ch >= 0xac00 && ch <= 0xd7a3;
  const jong = isHangul ? (ch - 0xac00) % 28 : 0;
  const hasFinal = isHangul ? jong !== 0 : /[013678]$/.test(word);
  const [a, b] = pair.split('/');
  if (pair === '으로/로') return hasFinal && jong !== 8 ? a : b;
  return hasFinal ? a : b;
}

export function fillTemplate(t: string, loc: string): string {
  return t
    .replace(/\{loc\}\{이\/가\}/g, loc + josa(loc, '이/가'))
    .replace(/\{loc\}\{을\/를\}/g, loc + josa(loc, '을/를'))
    .replace(/\{loc\}이/g, loc + josa(loc, '이/가'))
    .replace(/\{loc\}을/g, loc + josa(loc, '을/를'))
    .replace(/\{loc\}/g, loc);
}

export function defaultFloors(a: AnomalyDef): number[] {
  if (a.floors) return a.floors;
  if (a.loc === 'res') return GENERIC_CORRIDOR_FLOORS;
  if (a.loc === 'stair') return RESIDENTIAL_FLOORS;
  if (a.loc === 'gallery') return [5];
  if (a.loc === 'b1') return [0];
  if (a.loc === 'shops') return [2];
  if (a.loc === 'f13') return [13];
  return [1];
}

function reporterFor(floor: number, rng: Rng): string {
  const occ = RESIDENTS.filter((r) => r.unit.length >= 3 && Math.floor(Number(r.unit) / 100) === floor && r.status === 'occupied');
  if (occ.length === 0) return '원격 관제센터';
  const r = rng.pick(occ);
  return `${floorLabel(floor)} 입주민 (${r.unit}호)`;
}

function blockedLocations(s: GameState, slotIndex: number): Set<string> {
  const out = new Set<string>();
  for (const o of s.optionals) if (!s.optionalDone.includes(o.id)) out.add(o.location);
  const prev = s.incidents[slotIndex - 1];
  if (prev) out.add(prev.location);
  return out;
}

function makeIncident(slot: SlotDef, anomalyId: string | null, loc: string, floor: number, channel: Channel, from: string, text: string): Incident {
  return { id: slot.id, act: slot.act, time: parseClock(slot.time), anomalyId, location: loc, floor, channel, from, text };
}

/** Anomalies placed by authored story slots never appear in random pools (no repeats within a shift). */
const STORY_SLOT_ANOMALIES = new Set(SLOTS.filter((s) => s.kind === 'story' && s.anomaly).map((s) => s.anomaly!));

const NORMAL_KIND_WEIGHTS: [LocKind, number][] = [
  ['res', 6],
  ['lobby', 1],
  ['parcel', 1],
  ['stair', 1],
  ['shops', 1],
  ['elevator', 1],
  ['gallery', 1],
];

export function resolveSlot(slotIndex: number, s: GameState): Incident {
  const slot = SLOTS[slotIndex];
  const c = s.contamination;
  const rng = Rng.fromString(`${s.seed}|${slot.id}|b${band(c)}`);
  const blocked = blockedLocations(s, slotIndex);
  const prev = s.incidents[slotIndex - 1];

  if (slot.kind === 'story') {
    let loc = slot.location!;
    let floor = LOCATION_BY_ID.get(loc)?.floor ?? 1;
    if (loc.includes('?')) {
      const a = anomaly(slot.anomaly!);
      const floors = defaultFloors(a).filter((f) => !blocked.has(locationId(a.loc, f)) && f !== prev?.floor);
      floor = rng.pick(floors.length ? floors : defaultFloors(a));
      loc = locationId(a.loc, floor);
    }
    const name = LOCATION_BY_ID.get(loc)!.name;
    return makeIncident(slot, slot.normal ? null : slot.anomaly!, loc, floor, slot.channel ?? 'visual', slot.from ?? '원격 관제센터', fillTemplate(slot.text ?? '', name));
  }

  const pool = slot.pool!;
  const rel = reliability(c);
  const used = new Set<string>();
  for (const inc of [...s.incidents, ...s.optionals]) if (inc.anomalyId) used.add(inc.anomalyId);
  const prevCat = prev?.anomalyId ? anomaly(prev.anomalyId).category : null;
  const prevNormal = prev ? prev.anomalyId === null : false;

  const wantNormal = !prevNormal && rng.chance(pool.normalChance);
  if (!wantNormal) {
    const base = ANOMALIES.filter(
      (a) =>
        !a.story &&
        !a.optional &&
        !STORY_SLOT_ANOMALIES.has(a.id) &&
        a.minAct <= slot.act &&
        (a.maxAct === undefined || slot.act <= a.maxAct) &&
        (!pool.kinds || pool.kinds.includes(a.loc)) &&
        !used.has(a.id) &&
        (a.requires ?? []).every((r) => rel[r]),
    );
    const tiers = [
      base.filter((a) => a.difficulty >= pool.minD && a.difficulty <= pool.maxD && a.category !== prevCat),
      base.filter((a) => a.difficulty >= pool.minD && a.difficulty <= pool.maxD),
      base.filter((a) => a.difficulty >= pool.minD - 1 && a.difficulty <= pool.maxD + 1),
    ];
    for (const tier of tiers) {
      const order = rng.shuffle(tier);
      for (const a of order) {
        const floors = defaultFloors(a).filter((f) => !blocked.has(locationId(a.loc, f)) && !(a.loc === 'res' && f === prev?.floor));
        if (floors.length === 0) continue;
        const floor = rng.pick(floors);
        const loc = locationId(a.loc, floor);
        const channel = rng.pick(a.channels);
        const name = LOCATION_BY_ID.get(loc)!.name;
        const from = a.loc === 'res' || a.loc === 'stair' ? reporterFor(floor, rng) : channel === 'cctv' ? '원격 관제센터' : '입주민 전화';
        return makeIncident(slot, a.id, loc, floor, channel, from, fillTemplate(rng.pick(TEMPLATES[channel]), name));
      }
    }
  }
  // Normal incident (false alarm): location chosen from a weighted pool.
  const kinds = NORMAL_KIND_WEIGHTS.filter(([k]) => !pool.kinds || pool.kinds.includes(k));
  const bag: LocKind[] = [];
  for (const [k, w] of kinds) for (let i = 0; i < w; i++) bag.push(k);
  for (let attempt = 0; attempt < 20; attempt++) {
    const kind = rng.pick(bag);
    const floors = kind === 'res' ? GENERIC_CORRIDOR_FLOORS : kind === 'stair' ? RESIDENTIAL_FLOORS : [kind === 'gallery' ? 5 : kind === 'shops' ? 2 : 1];
    const floor = rng.pick(floors);
    const loc = locationId(kind, floor);
    if (blocked.has(loc) || (kind === 'res' && floor === prev?.floor)) continue;
    const channel: Channel = rng.pick(NORMAL_CHANNELS[kind] ?? (['visual'] as Channel[]));
    const name = LOCATION_BY_ID.get(loc)!.name;
    const from = kind === 'res' || kind === 'stair' ? reporterFor(floor, rng) : '원격 관제센터';
    return makeIncident(slot, null, loc, floor, channel, from, fillTemplate(rng.pick(TEMPLATES[channel]), name));
  }
  return makeIncident(slot, null, 'res:3', 3, 'visual', '원격 관제센터', fillTemplate(TEMPLATES.visual[0], '3층 복도'));
}

export function optionalIncident(id: string, s: GameState): Incident {
  const o = OPTIONALS.find((x) => x.id === id)!;
  const loc = LOCATION_BY_ID.get(o.location)!;
  return { id: o.id, act: 3, time: Math.floor(s.clock), anomalyId: o.anomaly, location: o.location, floor: loc.floor, channel: 'reference', from: o.from, text: o.text, optional: true };
}

/** Full deterministic dry-run used by tests/QA: resolve every slot answering correctly. */
export function dryRun(seed: string, stateFactory: (seed: string) => GameState): Incident[] {
  const s = stateFactory(seed);
  const out: Incident[] = [];
  for (let i = 0; i < SLOTS.length; i++) {
    const inc = resolveSlot(i, s);
    s.incidents[i] = inc;
    out.push(inc);
    for (const o of OPTIONALS) if (o.unlockAfter === SLOTS[i].id) s.optionals.push(optionalIncident(o.id, s));
  }
  return out;
}
