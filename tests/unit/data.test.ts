/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ANOMALIES, CATEGORIES, CATEGORY_HELP, CATEGORY_LABEL, anomaly } from '../../src/data/anomalies';
import { IMAGE_ASSETS } from '../../src/data/imageAssets';
import { LOCATIONS, LOCATION_BY_ID, inLocation, locationId } from '../../src/data/locations';
import { OPTIONALS, SLOTS, TEMPLATES } from '../../src/data/story';
import { ARCHIVE_RECORDS } from '../../src/data/records';
import { RESIDENTS, UNIT_SLOTS } from '../../src/data/building';
import { defaultFloors } from '../../src/systems/schedule';

const ROOT = path.resolve(__dirname, '../..');

describe('anomaly registry', () => {
  it('has unique ids and a count inside the design range', () => {
    const ids = ANOMALIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(35);
    expect(ids.length).toBeLessThanOrEqual(50);
  });

  it('every entry is complete and internally consistent', () => {
    for (const a of ANOMALIES) {
      expect(CATEGORIES, a.id).toContain(a.category);
      for (const c of a.accept ?? []) expect(CATEGORIES, a.id).toContain(c);
      expect(a.channels.length, a.id).toBeGreaterThan(0);
      expect(a.realisation.length, a.id).toBeGreaterThan(0);
      expect(a.title.length, a.id).toBeGreaterThan(1);
      expect(a.intendedDifference.length, a.id).toBeGreaterThan(10);
      expect(a.detection.length, a.id).toBeGreaterThan(5);
      expect(a.difficulty, a.id).toBeGreaterThanOrEqual(1);
      expect(a.difficulty, a.id).toBeLessThanOrEqual(5);
      expect(a.minAct, a.id).toBeGreaterThanOrEqual(1);
      // every allowed floor maps to a real location
      for (const f of defaultFloors(a)) expect(LOCATION_BY_ID.has(locationId(a.loc, f)), `${a.id}@${f}`).toBe(true);
    }
  });

  it('category mapping has Korean labels and help text for all 8 categories', () => {
    expect(CATEGORIES).toHaveLength(8);
    for (const c of CATEGORIES) {
      expect(CATEGORY_LABEL[c]).toMatch(/[가-힣]/);
      expect(CATEGORY_HELP[c]).toMatch(/[가-힣]/);
    }
  });

  it('image pairs reference registered, existing runtime assets', () => {
    for (const a of ANOMALIES) {
      if (!a.imagePair) continue;
      for (const k of [a.imagePair.normal, a.imagePair.anomaly]) {
        expect(IMAGE_ASSETS[k], `${a.id}:${k}`).toBeTruthy();
        expect(fs.existsSync(path.join(ROOT, 'public', IMAGE_ASSETS[k])), `${a.id}:${k}`).toBe(true);
      }
      expect(a.imagePair.normal).not.toBe(a.imagePair.anomaly);
    }
  });
});

describe('image assets', () => {
  it('every registered runtime image exists in public/', () => {
    for (const [k, p] of Object.entries(IMAGE_ASSETS)) expect(fs.existsSync(path.join(ROOT, 'public', p)), k).toBe(true);
  });

  it('pairs.json points at existing normal/anomaly files and QA outputs', () => {
    const pairs = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/pairs.json'), 'utf8')).pairs as { id: string; normal: string; anomaly: string }[];
    expect(pairs.length).toBeGreaterThanOrEqual(5);
    for (const p of pairs) {
      expect(fs.existsSync(path.join(ROOT, p.normal)), p.id).toBe(true);
      expect(fs.existsSync(path.join(ROOT, p.anomaly)), p.id).toBe(true);
      expect(fs.existsSync(path.join(ROOT, 'art/qa', p.id, 'metrics.json')), p.id).toBe(true);
    }
  });

  it('documented image manifest matches the runtime registry', () => {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/image-assets.json'), 'utf8')).assets as { key: string; runtime_path: string }[];
    const keys = new Set(doc.map((d) => d.key));
    for (const k of Object.keys(IMAGE_ASSETS)) expect(keys.has(k), k).toBe(true);
    for (const d of doc) expect(`public/${IMAGE_ASSETS[d.key as keyof typeof IMAGE_ASSETS]}`).toBe(d.runtime_path);
  });

  it('documented anomaly manifest matches the registry (regenerate with npm run docs:manifest)', () => {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/anomaly-manifest.json'), 'utf8'));
    expect(doc.count).toBe(ANOMALIES.length);
    const docIds = (doc.anomalies as { id: string; category: string; difficulty: number }[]).map((a) => `${a.id}:${a.category}:${a.difficulty}`);
    expect(docIds).toEqual(ANOMALIES.map((a) => `${a.id}:${a.category}:${a.difficulty}`));
  });
});

describe('story data', () => {
  it('slots reference existing anomalies and locations', () => {
    const ids = new Set<string>();
    for (const s of SLOTS) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      expect(s.time).toMatch(/^\d\d:\d\d$/);
      if (s.kind === 'story') {
        if (!s.normal) {
          const a = anomaly(s.anomaly!);
          expect(a.minAct, s.id).toBeLessThanOrEqual(s.act);
        }
        if (s.location && !s.location.includes('?')) expect(LOCATION_BY_ID.has(s.location), s.id).toBe(true);
      } else expect(s.pool).toBeTruthy();
    }
    // slot times are monotonic
    const mins = SLOTS.map((s) => Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)));
    for (let i = 1; i < mins.length; i++) expect(mins[i]).toBeGreaterThan(mins[i - 1]);
  });

  it('optionals reference optional anomalies and unlock after real slots', () => {
    for (const o of OPTIONALS) {
      expect(anomaly(o.anomaly).optional, o.id).toBe(true);
      expect(SLOTS.some((s) => s.id === o.unlockAfter)).toBe(true);
      expect(LOCATION_BY_ID.has(o.location)).toBe(true);
    }
  });

  it('every complaint channel has Korean templates with a location slot', () => {
    for (const [ch, list] of Object.entries(TEMPLATES)) {
      expect(list.length, ch).toBeGreaterThan(0);
      for (const t of list) expect(t, ch).toContain('{loc}');
    }
  });

  it('archive records: six Tier-A originals and four discoverable documents', () => {
    expect(ARCHIVE_RECORDS.filter((r) => r.id.startsWith('A'))).toHaveLength(6);
    expect(ARCHIVE_RECORDS.filter((r) => r.discovered).map((r) => r.id)).toEqual(['D1', 'D2', 'D3', 'D4']);
  });
});

describe('locations', () => {
  it('ids are unique and kinds are consistent with ids', () => {
    const ids = LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LOCATIONS) {
      if (l.id !== 'elevator') expect(l.id.split(':')[0]).toBe(l.kind);
      expect(l.name).toMatch(/[가-힣]/);
      for (const s of l.shots) {
        expect(s.fov).toBeGreaterThan(20);
        expect(s.fov).toBeLessThan(110);
      }
    }
  });

  it('on-site zones behave', () => {
    expect(inLocation('res:7', 7, 0, 0, false)).toBe(true);
    expect(inLocation('res:7', 6, 0, 0, false)).toBe(false);
    expect(inLocation('elevator', 3, 0, -4.5, true)).toBe(true);
    expect(inLocation('res:7', 7, 0, -4.5, true)).toBe(false);
    expect(inLocation('control:1', 1, -7, -4, false)).toBe(true);
    expect(inLocation('stair:5', 5, 13, 0, false)).toBe(true);
    expect(inLocation('stair:5', 5, 5, 0, false)).toBe(false);
  });

  it('residents: 8 units per residential floor, named characters present', () => {
    expect(RESIDENTS).toHaveLength(10 * UNIT_SLOTS.length);
    for (const u of ['305', '602', '803', '1007', '1108', '1204']) expect(RESIDENTS.some((r) => r.unit === u)).toBe(true);
  });
});
