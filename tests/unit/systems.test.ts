import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../../src/core/rng';
import { ANOMALIES, anomaly } from '../../src/data/anomalies';
import { OPTIONALS, SLOTS } from '../../src/data/story';
import { LOCATION_BY_ID } from '../../src/data/locations';
import { newGameState, type GameState } from '../../src/game/state';
import { Director, type DirectorHooks } from '../../src/game/director';
import { band, decideEnding, evaluate, reliability } from '../../src/systems/rules';
import { dryRun, fillTemplate, josa } from '../../src/systems/schedule';
import { deserialize, serialize } from '../../src/systems/save';

const noHooks = (): DirectorHooks => ({
  message() {},
  incident() {},
  voice() {},
  act() {},
  worldChanged() {},
  checkpoint() {},
  final() {},
  unlockEntrance() {},
});

describe('rng', () => {
  it('is reproducible per seed and differs across seeds', () => {
    const a = Rng.fromString('ABC123');
    const b = Rng.fromString('ABC123');
    const c = Rng.fromString('ZZZ999');
    const sa = Array.from({ length: 20 }, () => a.next());
    const sb = Array.from({ length: 20 }, () => b.next());
    const sc = Array.from({ length: 20 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(hashString('x')).toBe(hashString('x'));
  });

  it('shuffle/pick stay inside bounds', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('scheduler', () => {
  it('same seed gives the same shift; different seeds differ', () => {
    const a = dryRun('SEED-A', newGameState);
    const b = dryRun('SEED-A', newGameState);
    expect(a).toEqual(b);
    const seeds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
    const sigs = new Set(seeds.map((s) => dryRun(s, newGameState).map((i) => `${i.anomalyId}@${i.location}`).join('|')));
    expect(sigs.size).toBeGreaterThan(1);
  });

  it('every slot resolves to a valid incident with no repeated anomaly in a run', () => {
    for (let k = 0; k < 60; k++) {
      const run = dryRun(`R${k}`, newGameState);
      expect(run).toHaveLength(SLOTS.length);
      const used = run.filter((i) => i.anomalyId).map((i) => i.anomalyId);
      expect(new Set(used).size).toBe(used.length);
      for (const inc of run) {
        expect(LOCATION_BY_ID.has(inc.location), inc.location).toBe(true);
        expect(inc.text).not.toContain('{loc}');
        if (inc.anomalyId) {
          const a = anomaly(inc.anomalyId);
          expect(a.minAct, inc.anomalyId).toBeLessThanOrEqual(inc.act);
          expect(a.channels, inc.anomalyId).toContain(inc.channel);
        }
      }
    }
  });

  it('every anomaly is reachable (story, optional, or random across seeds)', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 400; k++) for (const i of dryRun(`X${k}`, newGameState)) if (i.anomalyId) seen.add(i.anomalyId);
    for (const o of OPTIONALS) seen.add(o.anomaly);
    const missing = ANOMALIES.filter((a) => !seen.has(a.id)).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it('Korean particles are chosen by final consonant', () => {
    expect(josa('복도', '이/가')).toBe('가');
    expect(josa('승강기 내부', '이/가')).toBe('가');
    expect(josa('1층 로비', '을/를')).toBe('를');
    expect(josa('관리실', '이/가')).toBe('이');
    expect(josa('택배보관실', '으로/로')).toBe('로');
    expect(fillTemplate('{loc}이 평소와 다릅니다.', '7층 복도')).toBe('7층 복도가 평소와 다릅니다.');
    expect(fillTemplate('{loc}을 확인', '관리실')).toBe('관리실을 확인');
  });
});

describe('rules', () => {
  it('contamination bands and reliability tiers', () => {
    expect(band(0)).toBe(0);
    expect(band(15)).toBe(1);
    expect(band(59)).toBe(3);
    expect(band(80)).toBe(5);
    expect(reliability(29).cctvReliable).toBe(true);
    expect(reliability(30).cctvReliable).toBe(false);
    expect(reliability(44).directoryReliable).toBe(true);
    expect(reliability(60).refReliable).toBe(false);
  });

  it('report evaluation', () => {
    const inc = { id: 's01', act: 1, time: 5, anomalyId: 'obj_vending_duplicate', location: 'lobby:1', floor: 1, channel: 'visual' as const, from: '', text: '' };
    expect(evaluate(inc, 'anomaly', 'OBJECT').outcome).toBe('correct');
    expect(evaluate(inc, 'anomaly', 'IMAGE').outcome).toBe('wrong_category');
    expect(evaluate(inc, 'normal', null).outcome).toBe('missed');
    const normal = { ...inc, anomalyId: null };
    expect(evaluate(normal, 'normal', null).outcome).toBe('correct_normal');
    expect(evaluate(normal, 'anomaly', 'OBJECT').outcome).toBe('false_alarm');
    // accepted alternative categories
    const alt = { ...inc, anomalyId: 'sys_numbers_swapped' };
    expect(evaluate(alt, 'anomaly', 'GEOMETRY').outcome).toBe('correct');
  });
});

function playShift(seed: string, answer: (d: Director) => { j: 'normal' | 'anomaly'; c: any }, extra?: (d: Director) => void): GameState {
  const s = newGameState(seed);
  const d = new Director(s, noHooks());
  d.begin();
  let guard = 0;
  while (s.phase === 'shift' && guard++ < 10000) {
    d.tick(1);
    const cur = d.current();
    if (cur) {
      d.markVisited(cur);
      const a = answer(d);
      d.report(cur.id, a.j, a.c);
    }
    for (const o of [...d.openIncidents()].filter((i) => i.optional)) {
      d.markVisited(o);
      d.report(o.id, 'anomaly', anomaly(o.anomalyId!).category);
    }
    extra?.(d);
  }
  while (s.clock < 360 && guard++ < 20000) d.tick(1);
  return s;
}

describe('director (full shift simulation)', () => {
  const correct = (d: Director) => {
    const cur = d.current()!;
    return cur.anomalyId ? { j: 'anomaly' as const, c: anomaly(cur.anomalyId).category } : { j: 'normal' as const, c: null };
  };

  it('all-correct shift reaches the good ending at 06:00', () => {
    const s = playShift('GOOD1', correct);
    expect(s.reports.filter((r) => r.incidentId.startsWith('s'))).toHaveLength(SLOTS.length);
    expect(s.phase).toBe('final');
    expect(s.clock).toBe(360);
    expect(s.contamination).toBe(0);
    expect(decideEnding(s)).toBe('good');
    expect(s.flags.f13Open).toBe(true);
  });

  it('answering "normal" to everything leads to the bad ending', () => {
    const s = playShift('BAD1', () => ({ j: 'normal', c: null }));
    expect(s.contamination).toBeGreaterThanOrEqual(70);
    expect(s.identityFailed).toBe(true);
    expect(decideEnding(s)).toBe('bad');
  });

  it('secret ending needs D1–D4, two optionals and 1301', () => {
    const s = playShift('SEC1', correct, (d) => {
      for (const id of ['D1', 'D2', 'D3', 'D4']) if (!d.s.pickedUp.includes(id)) d.onPickup(id);
      d.s.flags.saw1301 = true;
    });
    expect(s.unlockedDoors).toContain('unit-1301');
    expect(decideEnding(s)).toBe('secret');
  });

  it('clock never passes 05:45 while incidents remain', () => {
    const s = newGameState('CAP');
    const d = new Director(s, noHooks());
    for (let i = 0; i < 20000; i++) d.tick(1); // never report
    expect(s.clock).toBeLessThanOrEqual(345);
    expect(s.phase).toBe('shift');
  });
});

describe('save', () => {
  it('round-trips logical state', () => {
    const s = playShift('SAVE1', (d) => {
      const cur = d.current()!;
      return cur.anomalyId ? { j: 'anomaly', c: anomaly(cur.anomalyId).category } : { j: 'normal', c: null };
    });
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
  });

  it('rejects garbage and wrong versions', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize(JSON.stringify({ version: 2 }))).toBeNull();
  });

  it('a mid-shift save reproduces the same next incident after load', () => {
    const s = newGameState('MID');
    const d = new Director(s, noHooks());
    while (s.slot < 5) {
      d.tick(1);
      const cur = d.current();
      if (cur) {
        d.markVisited(cur);
        d.report(cur.id, 'normal', null);
      }
    }
    const copy = deserialize(serialize(s))!;
    const d2 = new Director(copy, noHooks());
    let a = null;
    let b = null;
    for (let i = 0; i < 2000 && !a; i++) {
      d.tick(1);
      a = d.current();
    }
    for (let i = 0; i < 2000 && !b; i++) {
      d2.tick(1);
      b = d2.current();
    }
    expect(b).toEqual(a);
  });
});
