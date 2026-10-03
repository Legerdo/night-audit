// Logical game state. This (and only this) is persisted; the world is rebuilt from it deterministically.
import type { ElevatorLogEntry, Incident, PhotoMeta, ReportRecord } from '../data/types';

export type EndingId = 'good' | 'bad' | 'secret';

export interface Message {
  time: number;
  from: string;
  text: string;
}

export interface GameState {
  version: 1;
  seed: string;
  /** index into SLOTS of the current main incident (SLOTS.length once the shift's incidents are done) */
  slot: number;
  /** true once the current slot's incident has been issued to the player */
  slotIssued: boolean;
  incidents: Incident[];
  optionals: Incident[];
  optionalDone: string[];
  reports: ReportRecord[];
  contamination: number;
  clock: number;
  pickedUp: string[];
  unlockedDoors: string[];
  corrected: string[];
  flags: Record<string, boolean>;
  photos: PhotoMeta[];
  elevatorLog: ElevatorLogEntry[];
  messages: Message[];
  visited: string[];
  ending: EndingId | null;
  phase: 'shift' | 'final' | 'ended';
  identityFailed: boolean;
  playTimeSec: number;
}

export function newGameState(seed: string): GameState {
  return {
    version: 1,
    seed,
    slot: 0,
    slotIssued: false,
    incidents: [],
    optionals: [],
    optionalDone: [],
    reports: [],
    contamination: 0,
    clock: 0,
    pickedUp: [],
    unlockedDoors: [],
    corrected: [],
    flags: {},
    photos: [],
    elevatorLog: [],
    messages: [],
    visited: [],
    ending: null,
    phase: 'shift',
    identityFailed: false,
    playTimeSec: 0,
  };
}

export function currentIncident(s: GameState): Incident | null {
  if (!s.slotIssued) return null;
  const inc = s.incidents[s.slot];
  if (!inc) return null;
  if (s.reports.some((r) => r.incidentId === inc.id)) return null;
  return inc;
}

export function openOptionals(s: GameState): Incident[] {
  return s.optionals.filter((o) => !s.optionalDone.includes(o.id));
}

/** Anomalies currently present in the world (unreported). */
export function activeAnomalies(s: GameState): Incident[] {
  const out: Incident[] = [];
  const cur = currentIncident(s);
  if (cur?.anomalyId) out.push(cur);
  for (const o of openOptionals(s)) if (o.anomalyId) out.push(o);
  return out;
}

export function fmtClock(min: number): string {
  const m = Math.max(0, Math.floor(min));
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
