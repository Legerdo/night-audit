// Pure game rules: contamination bands, reliability tiers, report evaluation, ending decision.
import { anomaly } from '../data/anomalies';
import type { Category, Incident, Judgment, Outcome } from '../data/types';
import type { EndingId, GameState } from '../game/state';

export const CONTAMINATION_MAX = 100;
export const BAD_ENDING_THRESHOLD = 70;

export const BANDS = [
  { min: 0, id: 'none', label: '안정' },
  { min: 15, id: 'low', label: '경미' },
  { min: 30, id: 'medium', label: '주의' },
  { min: 45, id: 'high', label: '경고' },
  { min: 60, id: 'veryhigh', label: '위험' },
  { min: 80, id: 'critical', label: '심각' },
] as const;

export function band(c: number): number {
  let b = 0;
  BANDS.forEach((x, i) => {
    if (c >= x.min) b = i;
  });
  return b;
}

/** Which Tier-B systems are still trustworthy at a contamination level. Tier A never degrades. */
export function reliability(c: number) {
  return {
    audioStable: c < 15,
    cctvReliable: c < 30,
    directoryReliable: c < 45,
    refReliable: c < 60,
    identityStable: c < 80,
  };
}

export function isCorrectCategory(inc: Incident, cat: Category | null): boolean {
  if (!inc.anomalyId || !cat) return false;
  const a = anomaly(inc.anomalyId);
  return a.category === cat || (a.accept ?? []).includes(cat);
}

export function evaluate(inc: Incident, judgment: Judgment, cat: Category | null): { outcome: Outcome; delta: number } {
  if (!inc.anomalyId) {
    return judgment === 'normal' ? { outcome: 'correct_normal', delta: -2 } : { outcome: 'false_alarm', delta: 10 };
  }
  const a = anomaly(inc.anomalyId);
  if (judgment === 'normal') return { outcome: 'missed', delta: a.contaminationImpact };
  if (isCorrectCategory(inc, cat)) return { outcome: 'correct', delta: -3 };
  return { outcome: 'wrong_category', delta: 5 };
}

export function applyContamination(c: number, delta: number): number {
  return Math.max(0, Math.min(CONTAMINATION_MAX, c + delta));
}

export const SECRET_RECORDS = ['D1', 'D2', 'D3', 'D4'];

export function optionalCorrectCount(s: GameState): number {
  return s.reports.filter((r) => r.incidentId.startsWith('o') && r.outcome === 'correct').length;
}

export function evidenceCount(s: GameState): number {
  return s.reports.filter((r) => r.evidence).length;
}

export function secretConditions(s: GameState) {
  return {
    records: SECRET_RECORDS.every((id) => s.pickedUp.includes(id)),
    optionals: optionalCorrectCount(s) >= 2,
    saw1301: !!s.flags.saw1301,
  };
}

export function decideEnding(s: GameState): EndingId {
  if (s.identityFailed || s.contamination >= BAD_ENDING_THRESHOLD) return 'bad';
  const sc = secretConditions(s);
  if (sc.records && sc.optionals && sc.saw1301) return 'secret';
  return 'good';
}

/** 1301 opens once the player holds enough of the original record to find it. */
export function can1301Open(s: GameState): boolean {
  return ['D1', 'D2', 'D3'].every((id) => s.pickedUp.includes(id));
}
