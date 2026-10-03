import type { ImageKey } from './imageAssets';

export type Category = 'OBJECT' | 'GEOMETRY' | 'IMAGE' | 'HUMAN' | 'TEMPORAL' | 'AUDIO' | 'SYSTEM' | 'META';
export type Channel = 'visual' | 'image' | 'audio' | 'cctv' | 'records' | 'reference';
export type LocKind = 'res' | 'gallery' | 'lobby' | 'control' | 'parcel' | 'elevator' | 'stair' | 'b1' | 'shops' | 'f13';
export type Requirement = 'cctvReliable' | 'directoryReliable' | 'refReliable';
/** How the anomaly is realised: floor-builder mod, data override, or runtime behaviour. */
export type Realisation = 'physical' | 'data' | 'runtime';

export interface AnomalyDef {
  id: string;
  category: Category;
  /** other categories accepted as a correct classification (only where genuinely ambiguous) */
  accept?: Category[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  loc: LocKind;
  /** allowed floors for res/stair anomalies (defaults applied by the scheduler) */
  floors?: number[];
  channels: Channel[];
  realisation: Realisation[];
  /** Korean short title (results screen, ledger) */
  title: string;
  baselineState: string;
  anomalyState: string;
  intendedDifference: string;
  forbiddenDifferences: string[];
  /** how a careful player can detect it (dev/QA) */
  detection: string;
  resetRule: 'on_report' | 'on_incident_end';
  minAct: number;
  maxAct?: number;
  story?: boolean;
  optional?: boolean;
  requires?: Requirement[];
  contaminationImpact: number;
  imagePair?: { normal: ImageKey; anomaly: ImageKey };
  purpose: string;
  persistent: boolean;
}

export interface Incident {
  id: string; // slot id
  act: number;
  time: number; // minutes after 00:00
  anomalyId: string | null;
  location: string; // e.g. res:7, lobby:1, elevator
  floor: number;
  channel: Channel;
  from: string;
  text: string;
  optional?: boolean;
}

export type Judgment = 'normal' | 'anomaly';
export type Outcome = 'correct' | 'correct_normal' | 'wrong_category' | 'missed' | 'false_alarm';

export interface ReportRecord {
  incidentId: string;
  judgment: Judgment;
  category: Category | null;
  outcome: Outcome;
  delta: number;
  time: number;
  evidence: boolean;
  anomalyId: string | null;
  location: string;
}

export interface PhotoMeta {
  id: string;
  time: number;
  location: string;
  incidentId: string | null;
  /** anomaly visible in frame when taken (evidence) */
  evidenceOf: string | null;
  thumb: string; // data URL (small JPEG)
}

export interface ElevatorLogEntry {
  time: number;
  from: number;
  to: number;
  note: string;
  injected?: boolean;
}
