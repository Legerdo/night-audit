// Shift director: game clock, incident issuing, acts, reports, contamination, optionals, messages and endings.
// Pure logic over GameState (no rendering) so it can be unit-tested and replayed deterministically.
import { anomaly, CATEGORY_LABEL } from '../data/anomalies';
import { FLOOR_13, RESIDENTS, floorLabel, residentByUnit, type Resident } from '../data/building';
import { LOCATION_BY_ID } from '../data/locations';
import { FUTURE_LOG, MAINT_LOG, type LogEntry } from '../data/records';
import { HQ, INCOMING_1301, INCOMING_803, MESSAGES, OPTIONALS, SLOTS, type VoiceLine } from '../data/story';
import type { Category, ElevatorLogEntry, Incident, Judgment, Outcome, ReportRecord } from '../data/types';
import { hashString } from '../core/rng';
import { currentIncident, fmtClock, openOptionals, parseClock, type GameState } from './state';
import { applyContamination, can1301Open, decideEnding, evaluate, reliability } from '../systems/rules';
import { optionalIncident, resolveSlot } from '../systems/schedule';
import type { WorldFlags } from '../world/types';

export const SHIFT_END = 360; // 06:00
export const FINAL_START = 350; // 05:50
const CLOCK_CAP = 345; // clock never passes 05:45 while incidents remain
export const RATE_OPEN = 0.06; // game minutes per real second while an incident is open
export const RATE_IDLE = 1.2; // fast-forward while waiting for the next call
const RATE_FINAL = 0.25;
export const EVIDENCE_BONUS = -2;

export interface ReportResult {
  outcome: Outcome;
  delta: number;
  title: string;
  body: string;
}

export interface DirectorHooks {
  message(from: string, text: string, important?: boolean): void;
  incident(inc: Incident): void;
  voice(lines: VoiceLine[], ring: boolean): void;
  act(act: number): void;
  worldChanged(floors: number[]): void;
  checkpoint(reason: string): void;
  final(): void;
  unlockEntrance(): void;
}

export const OUTCOME_TEXT: Record<Outcome, { title: string; body: string }> = {
  correct: { title: '보고 접수 · 정정 완료', body: '해당 항목은 기록과 일치하도록 정정되었습니다.' },
  correct_normal: { title: '보고 접수 · 이상 없음', body: '현장 상태가 기준 자료와 일치합니다.' },
  false_alarm: { title: '재확인 결과 이상 없음', body: '원격 재확인 결과 현장은 정상입니다. 불필요한 신고는 기록을 흐립니다.' },
  wrong_category: { title: '보고 접수 · 분류 불일치', body: '현상은 접수되었으나 분류가 기록과 맞지 않습니다. 정정이 불완전합니다.' },
  missed: { title: '보고 접수 · 이상 없음', body: '현장 상태가 기준 자료와 일치하는 것으로 처리되었습니다.' },
};

export class Director {
  s: GameState;
  hooks: DirectorHooks;
  private entranceAnnounced = false;

  constructor(s: GameState, hooks: DirectorHooks) {
    this.s = s;
    this.hooks = hooks;
  }

  // ------------------------------------------------------------------ derived state

  get act(): number {
    const i = Math.min(this.s.slot, SLOTS.length - 1);
    return SLOTS[i].act;
  }

  current(): Incident | null {
    return currentIncident(this.s);
  }

  openIncidents(): Incident[] {
    const out: Incident[] = [];
    const c = this.current();
    if (c) out.push(c);
    out.push(...openOptionals(this.s));
    return out;
  }

  /** anomaly id -> floor for every anomaly currently present */
  activeMap(): Map<string, number> {
    const m = new Map<string, number>();
    for (const inc of this.openIncidents()) if (inc.anomalyId) m.set(inc.anomalyId, inc.floor);
    if (this.s.flags.f13Open) m.set('geo_floor_13', FLOOR_13);
    return m;
  }

  isActive(id: string): boolean {
    return this.activeMap().has(id);
  }

  activeFloor(id: string): number | null {
    return this.activeMap().get(id) ?? null;
  }

  rel() {
    return reliability(this.s.contamination);
  }

  identityCompromised(): boolean {
    return this.s.contamination >= 80 || this.s.identityFailed;
  }

  worldFlags(): WorldFlags {
    return {
      act: this.act,
      f13Open: !!this.s.flags.f13Open,
      unlockedDoors: new Set(this.s.unlockedDoors),
      pickedUp: new Set(this.s.pickedUp),
      corrected: this.s.corrected,
      identityCompromised: this.identityCompromised(),
    };
  }

  /** Builder mods per floor from anomalies with a physical realisation. */
  modsByFloor(): Map<number, Set<string>> {
    const out = new Map<number, Set<string>>();
    for (const [id, floor] of this.activeMap()) {
      const a = anomaly(id);
      if (!a.realisation.includes('physical')) continue;
      let set = out.get(floor);
      if (!set) out.set(floor, (set = new Set()));
      set.add(id);
    }
    return out;
  }

  /** Does reporting this incident require having been on site? */
  needsSite(inc: Incident): boolean {
    if (inc.channel === 'records') return false;
    if (inc.anomalyId && inc.optional && anomaly(inc.anomalyId).realisation.every((r) => r === 'data')) return false;
    return true;
  }

  siteChecked(inc: Incident): boolean {
    return !this.needsSite(inc) || this.s.visited.includes(inc.id);
  }

  markVisited(inc: Incident): boolean {
    if (this.s.visited.includes(inc.id)) return false;
    this.s.visited.push(inc.id);
    return true;
  }

  // ------------------------------------------------------------------ clock & issuing

  clockRate(): number {
    if (this.s.phase === 'final') return RATE_FINAL;
    if (this.s.phase === 'ended') return 0;
    return this.openIncidents().length > 0 && this.current() ? RATE_OPEN : RATE_IDLE;
  }

  tick(dt: number): void {
    const s = this.s;
    if (s.phase === 'ended') return;
    s.playTimeSec += dt;
    const allDone = s.slot >= SLOTS.length;
    let next = s.clock + this.clockRate() * dt;
    if (s.phase === 'shift') {
      if (!allDone) {
        next = Math.min(next, CLOCK_CAP);
        const slot = SLOTS[s.slot];
        // fast-forward stops exactly at the next call
        if (!s.slotIssued && next >= parseClock(slot.time) && s.clock < parseClock(slot.time)) next = parseClock(slot.time);
      } else next = Math.min(next, FINAL_START);
    } else next = Math.min(next, SHIFT_END);
    s.clock = next;
    if (s.phase === 'shift' && !allDone && !s.slotIssued && s.clock >= parseClock(SLOTS[s.slot].time)) this.issue();
    if (s.phase === 'shift' && allDone && s.clock >= FINAL_START) this.startFinal();
    if (s.phase === 'final' && s.clock >= SHIFT_END && !this.entranceAnnounced) {
      this.entranceAnnounced = true;
      this.hooks.unlockEntrance();
    }
  }

  /** Called once for a brand-new shift. */
  begin(): void {
    this.hooks.message(HQ, MESSAGES.start, true);
    this.hooks.message(HQ, MESSAGES.binder);
  }

  issue(): void {
    const s = this.s;
    const idx = s.slot;
    const slot = SLOTS[idx];
    const prevAct = idx > 0 ? SLOTS[idx - 1].act : 0;
    const inc = resolveSlot(idx, s);
    inc.time = Math.floor(s.clock);
    s.incidents[idx] = inc;
    s.slotIssued = true;
    if (slot.act !== prevAct) {
      if (slot.act === 2) this.hooks.message(HQ, MESSAGES.act2);
      if (slot.act === 3) this.hooks.message(HQ, MESSAGES.act3);
      if (slot.act === 4) this.hooks.message('시스템', MESSAGES.act4, true);
      this.hooks.act(slot.act);
    }
    if (slot.id === 's02') this.hooks.message(HQ, MESSAGES.s02hint);
    if (slot.id === 's13') this.hooks.message(HQ, MESSAGES.s13hint);
    if (slot.id === 's15') {
      s.flags.f13Open = true;
      this.hooks.voice(INCOMING_1301, true);
    }
    if (slot.id === 's16') s.flags.ch13 = true;
    this.hooks.incident(inc);
    this.hooks.worldChanged(this.floorsTouched(inc));
    if (slot.act !== prevAct && idx > 0) this.hooks.checkpoint(`${slot.act}막 시작`);
  }

  private floorsTouched(inc: Incident): number[] {
    const out = new Set<number>([inc.floor]);
    if (inc.id === 's15') {
      out.add(FLOOR_13);
      out.add(12);
    }
    return [...out];
  }

  startFinal(): void {
    const s = this.s;
    if (s.phase !== 'shift') return;
    s.phase = 'final';
    s.clock = Math.max(s.clock, FINAL_START);
    this.hooks.message('시스템', MESSAGES.final, true);
    this.hooks.final();
    this.hooks.checkpoint('교대 직전');
  }

  /** Debug/QA: jump the clock to the next pending call. */
  skipToNext(): void {
    const s = this.s;
    if (s.slot < SLOTS.length && !s.slotIssued) {
      s.clock = Math.max(s.clock, parseClock(SLOTS[s.slot].time));
      this.issue();
    } else if (s.slot >= SLOTS.length && s.phase === 'shift') {
      s.clock = FINAL_START;
      this.startFinal();
    } else if (s.phase === 'final') {
      s.clock = SHIFT_END;
    }
  }

  // ------------------------------------------------------------------ reports

  findOpen(id: string): Incident | null {
    return this.openIncidents().find((i) => i.id === id) ?? null;
  }

  hasEvidence(inc: Incident): boolean {
    return this.s.photos.some((p) => p.incidentId === inc.id && p.evidenceOf === inc.anomalyId && p.evidenceOf !== null);
  }

  report(incId: string, judgment: Judgment, category: Category | null): ReportResult | null {
    const s = this.s;
    const inc = this.findOpen(incId);
    if (!inc) return null;
    const { outcome, delta: base } = evaluate(inc, judgment, judgment === 'anomaly' ? category : null);
    const evidence = this.hasEvidence(inc);
    const delta = base + (outcome === 'correct' && evidence ? EVIDENCE_BONUS : 0);
    s.contamination = applyContamination(s.contamination, delta);
    const rec: ReportRecord = {
      incidentId: inc.id,
      judgment,
      category: judgment === 'anomaly' ? category : null,
      outcome,
      delta,
      time: Math.floor(s.clock),
      evidence: evidence && outcome === 'correct',
      anomalyId: inc.anomalyId,
      location: inc.location,
    };
    s.reports.push(rec);
    if (outcome === 'correct' && inc.anomalyId) s.corrected.push(`${inc.anomalyId}@${inc.floor}`);
    if (inc.id === 's17' && outcome === 'missed') s.identityFailed = true;
    const touched = new Set<number>([inc.floor]);
    if (inc.optional) {
      s.optionalDone.push(inc.id);
    } else {
      s.slot += 1;
      s.slotIssued = false;
      for (const o of OPTIONALS) {
        if (o.unlockAfter === inc.id && !s.optionals.some((x) => x.id === o.id)) {
          const oi = optionalIncident(o.id, s);
          s.optionals.push(oi);
          touched.add(oi.floor);
          this.hooks.incident(oi);
        }
      }
      this.afterMain(inc, outcome);
    }
    if (s.corrected.length > 0) touched.add(FLOOR_13);
    this.hooks.worldChanged([...touched]);
    const t = OUTCOME_TEXT[outcome];
    let body = t.body;
    if (outcome === 'correct' && rec.evidence) body += ' 증거 사진이 첨부되어 기록 복원이 빨라졌습니다.';
    if (outcome === 'wrong_category' && category) body = `'${CATEGORY_LABEL[category]}'(으)로 접수됨. ${t.body}`;
    this.hooks.checkpoint('보고 제출');
    return { outcome, delta, title: t.title, body };
  }

  private afterMain(inc: Incident, outcome: Outcome): void {
    const s = this.s;
    const ok = outcome === 'correct' || outcome === 'correct_normal';
    switch (inc.id) {
      case 's01':
        if (ok) this.hooks.message(HQ, MESSAGES.s01done);
        break;
      case 's07':
        if (ok) this.hooks.message(HQ, MESSAGES.s07done);
        break;
      case 's08':
        this.hooks.voice(INCOMING_803, true);
        break;
      case 's10':
        this.hooks.message(HQ, MESSAGES.s10done);
        break;
      case 's15':
        this.hooks.message('시스템', MESSAGES.s15done);
        break;
      default:
        break;
    }
    if (can1301Open(s) && !s.unlockedDoors.includes('unit-1301')) s.unlockedDoors.push('unit-1301');
  }

  /** Called after picking up a discoverable record. */
  onPickup(id: string): void {
    const s = this.s;
    if (!s.pickedUp.includes(id)) s.pickedUp.push(id);
    if (can1301Open(s) && !s.unlockedDoors.includes('unit-1301')) {
      s.unlockedDoors.push('unit-1301');
      if (s.flags.f13Open) this.hooks.message('인터폰', '1301호 쪽에서 문고리가 돌아가는 소리가 난다.');
      this.hooks.worldChanged([FLOOR_13]);
    }
  }

  ending() {
    return decideEnding(this.s);
  }

  // ------------------------------------------------------------------ Tier-B live data views (can lie)

  directory(): (Resident & { glitch?: boolean; injected?: boolean; portraitKey?: string })[] {
    const s = this.s;
    const out: (Resident & { glitch?: boolean; injected?: boolean; portraitKey?: string })[] = RESIDENTS.map((r) => ({ ...r, portraitKey: r.portrait }));
    const extra = this.activeFloor('sys_directory_extra_unit');
    if (extra !== null) {
      const unit = `${extra}09`;
      const idx = out.findIndex((r) => r.unit === `${extra}08`);
      out.splice(idx + 1, 0, { unit, name: '오명수', status: 'occupied', since: '1994.11.02', note: '(입주 기록 확인됨)', injected: true });
    }
    if (this.isActive('hum_resident_smile')) {
      const r = out.find((x) => x.unit === '803');
      if (r) r.portraitKey = 'res_leesoonja_smile';
    }
    if (!this.rel().directoryReliable) {
      // Sync corruption: obvious garbling (never plausible fake data) on a seeded subset.
      for (const r of out) {
        const h = hashString(`${s.seed}|dir|${r.unit}`);
        if (h % 9 === 0) {
          r.name = r.name.replace(/[가-힣]/g, (_c: string) => '■');
          r.glitch = true;
        }
      }
    }
    return out;
  }

  archiveResident(unit: string): Resident | undefined {
    return residentByUnit(unit);
  }

  maintLog(): LogEntry[] {
    const list = [...this.ownLogs(), ...MAINT_LOG];
    if (this.isActive('tmp_log_future_entry')) list.unshift(FUTURE_LOG);
    return list;
  }

  private ownLogs(): LogEntry[] {
    return this.s.messages
      .filter((m) => m.from === '__log')
      .map((m) => ({ date: '09.30', time: fmtClock(m.time), text: m.text, by: '한서진' }))
      .reverse();
  }

  elevatorLog(): ElevatorLogEntry[] {
    const list = [...this.s.elevatorLog];
    if (this.isActive('sys_elevator_log_13')) {
      list.push({ time: 73, from: 12, to: 13, note: '호출: 1301', injected: true });
      list.push({ time: 74, from: 13, to: 1, note: '차내 버튼', injected: true });
      list.push({ time: 158, from: 1, to: 13, note: '차내 버튼', injected: true });
    }
    return list.sort((a, b) => a.time - b.time);
  }

  cctvHas13(): boolean {
    return this.isActive('sys_cctv_13') || !!this.s.flags.ch13;
  }

  /** Live reference-photo builder mods for a location (META corruption). */
  liveRefMods(locId: string): Set<string> {
    const m = new Set<string>();
    const f = this.activeFloor('meta_ref_corridor');
    if (f !== null && locId === `res:${f}`) m.add('obj_extinguisher_moved');
    if (locId === 'gallery:5') {
      if (this.isActive('meta_ref_gallery')) m.add('img_family_extra_person');
      if (this.isActive('img_ceremony_both')) m.add('img_ceremony_gaze');
    }
    return m;
  }

  liveMapExtra(floor: number): boolean {
    return this.activeFloor('meta_map_corridor') === floor;
  }

  locName(id: string): string {
    return LOCATION_BY_ID.get(id)?.name ?? id;
  }

  floorName(n: number): string {
    return floorLabel(n);
  }
}
