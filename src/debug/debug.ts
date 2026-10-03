// Development-only tools (never bundled into production: imported behind import.meta.env.DEV).
// F9 toggles an overlay; window.__na13f exposes a QA API used by the automated playthrough.
import { ANOMALIES, CATEGORY_LABEL, anomaly } from '../data/anomalies';
import { LOCATIONS } from '../data/locations';
import { SLOTS } from '../data/story';
import type { Category, Judgment } from '../data/types';
import { fmtClock } from '../game/state';
import type { Game } from '../game/game';
import { defaultFloors } from '../systems/schedule';
import { locationId } from '../data/locations';
import { h, clear } from '../ui/dom';
import * as THREE from 'three';
import { floorY } from '../data/building';
import { audio } from '../systems/audio';
import { CAR_FLOOR_ID } from '../world/elevatorCar';

export function installDebug(game: Game): void {
  const panel = h('div', { class: 'debug hidden', 'data-debug': '1' });
  document.getElementById('ui')!.append(panel);
  let visible = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F9') {
      visible = !visible;
      panel.classList.toggle('hidden', !visible);
      if (visible) render();
    }
  });

  const api = {
    game,
    get s() {
      return game.director?.s;
    },
    info() {
      const s = game.director?.s;
      const p = game.player.pos;
      return {
        mode: game.mode,
        fps: Math.round(game.fps),
        frame: game.frame,
        pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        floor: game.playerFloor(),
        clock: s ? fmtClock(s.clock) : null,
        slot: s?.slot,
        contamination: s?.contamination,
        current: game.director?.current() ?? null,
        open: game.director?.openIncidents().map((i) => i.id) ?? [],
        phase: s?.phase,
        ending: s?.ending,
        stings: (window as any).__stings ?? null,
      };
    },
    teleport(loc: string) {
      game.teleportTo(loc);
    },
    look(yaw: number, pitch = 0) {
      game.player.yaw = yaw;
      game.player.pitch = pitch;
    },
    pos(x: number, y: number, z: number, yaw?: number) {
      game.player.teleport(x, y, z, yaw);
    },
    skip() {
      game.director.skipToNext();
    },
    setContamination(c: number) {
      game.director.s.contamination = c;
    },
    visit() {
      for (const inc of game.director.openIncidents()) game.director.markVisited(inc);
    },
    /** Correct answer for an open incident (QA only). */
    answerFor(id?: string): { j: Judgment; c: Category | null } | null {
      const inc = id ? game.director.findOpen(id) : game.director.current();
      if (!inc) return null;
      return inc.anomalyId ? { j: 'anomaly', c: anomaly(inc.anomalyId).category } : { j: 'normal', c: null };
    },
    report(id: string, j: Judgment, c: Category | null) {
      return game.report(id, j, c);
    },
    /** Replace the current incident's anomaly (QA of individual anomalies). */
    force(anomalyId: string, floor?: number) {
      const d = game.director;
      const s = d.s;
      if (!s.slotIssued) d.skipToNext();
      const inc = s.incidents[s.slot];
      if (!inc) return false;
      const a = anomaly(anomalyId);
      const fl = floor ?? defaultFloors(a)[0];
      const prevFloor = inc.floor;
      inc.anomalyId = anomalyId;
      inc.floor = fl;
      inc.location = locationId(a.loc, fl);
      inc.channel = a.channels[0];
      inc.text = `[QA] ${a.title}`;
      (game as any).rebuild([prevFloor, fl]);
      return inc;
    },
    openTablet(tab?: string) {
      game.openTablet(tab as any);
    },
    closeTablet() {
      game.close();
    },
    finishNow() {
      const s = game.director.s;
      while (s.slot < SLOTS.length) {
        if (!s.slotIssued) game.director.skipToNext();
        const inc = game.director.current();
        if (!inc) break;
        const ans = api.answerFor(inc.id)!;
        game.director.markVisited(inc);
        game.report(inc.id, ans.j, ans.c);
      }
      game.director.skipToNext();
      game.director.skipToNext();
    },
    get audio() {
      return audio;
    },
    get runtime() {
      return (game as any).runtime;
    },
    /** Interactables on the loaded floors near the player: id, kind, world position. */
    interactables() {
      return ((game as any).interactables() as any[]).map((i) => {
        const p = i.object.getWorldPosition(new THREE.Vector3());
        return { id: i.id, kind: i.kind, floor: i.floor, prompt: i.prompt, pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] };
      });
    },
    /** Stand `dist` metres from an interactable in direction `ang` (radians) and look at it. */
    approach(id: string, ang: number, dist = 1.3) {
      const it = ((game as any).interactables() as any[]).find((i) => i.id === id);
      if (!it) return false;
      const p = it.object.getWorldPosition(new THREE.Vector3());
      const floorY0 = it.floor === CAR_FLOOR_ID ? game.elevator.carY : floorY(it.floor);
      const x = p.x + Math.cos(ang) * dist;
      const z = p.z + Math.sin(ang) * dist;
      const eye = floorY0 + 1.62;
      const dx = p.x - x;
      const dz = p.z - z;
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(p.y - eye, Math.hypot(dx, dz));
      game.player.teleport(x, floorY0, z, yaw, pitch);
      return [x, floorY0, z];
    },
    /** Z-fighting scan: coplanar (≤ tol m apart), same-facing, overlapping triangles on the given floors. */
    zfight(floorIds: number[], tol = 0.0015, minArea = 0.0006) {
      return scanZFight(game, floorIds, tol, minArea);
    },
    focusId(): string | null {
      return (game as any).focus?.id ?? null;
    },
    screenshot(): string {
      game.renderer.render(game.world.scene, game.camera);
      return game.renderer.domElement.toDataURL('image/png');
    },
    anomalies: ANOMALIES.map((a) => a.id),
    categoryLabel: CATEGORY_LABEL,
    /**
     * Leak test: with the car at `level` and all doors shut, cast a fan of rays from the elevator hall of
     * `floor` and report how many first hit the car (it should never be visible through the landing).
     */
    carLeak(floor: number, level: number) {
      const g = game;
      g.elevator.place(level);
      const w = g.world;
      w.updateVisibility(floorY(floor), [CAR_FLOOR_ID]);
      const roots: THREE.Object3D[] = [w.car.inst.group];
      for (const n of [floor - 1, floor, floor + 1]) {
        const f = w.floors.get(n);
        if (f) roots.push(f.group);
      }
      const targets: THREE.Object3D[] = [];
      for (const r of roots) {
        r.updateMatrixWorld(true);
        r.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && o.visible && o.layers.test(g.camera.layers) && !(Array.isArray(m.material) ? false : (m.material as THREE.Material).transparent)) targets.push(o);
        });
      }
      const carSet = new Set<THREE.Object3D>();
      w.car.inst.group.traverse((o) => carSet.add(o));
      const rc = new THREE.Raycaster();
      let rays = 0;
      let leaks = 0;
      const samples: number[][] = [];
      const y0 = floorY(floor);
      for (const [ex, ez] of [[0, -1.5], [-1.2, -2.8], [1.2, -2.8], [0, -3.2], [-0.4, -3.3], [0.4, -3.3], [0, -0.5]]) {
        const eye = new THREE.Vector3(ex, y0 + 1.62, ez);
        for (let tx = -1.4; tx <= 1.4; tx += 0.1)
          for (let ty = -0.2; ty <= 3.2; ty += 0.1) {
            const dir = new THREE.Vector3(tx, y0 + ty, -3.9).sub(eye).normalize();
            rc.set(eye, dir);
            rc.far = 6;
            const hit = rc.intersectObjects(targets, false)[0];
            rays++;
            if (hit && carSet.has(hit.object)) {
              leaks++;
              if (samples.length < 5) samples.push([ex, ez, +tx.toFixed(1), +ty.toFixed(1)]);
            }
          }
      }
      return { rays, leaks, samples };
    },
  };
  (window as any).__na13f = api;

  function render(): void {
    clear(panel);
    const i = api.info();
    panel.append(h('div', null, `seed ${game.director?.s.seed ?? '-'} · ${i.clock} · slot ${i.slot} · C=${i.contamination} · fps ${i.fps}`));
    panel.append(h('div', null, `pos ${i.pos.join(', ')} · floor ${i.floor} · mode ${i.mode}`));
    const cur = i.current;
    panel.append(h('div', null, cur ? `current ${cur.id}: ${cur.anomalyId ?? 'NORMAL'} @ ${cur.location}` : 'no current incident'));
    const sel = h('select');
    for (const a of ANOMALIES) sel.append(h('option', { value: a.id }, `${a.id} (${a.loc})`));
    const loc = h('select');
    for (const l of LOCATIONS) loc.append(h('option', { value: l.id }, l.id));
    const cin = h('input', { type: 'number', value: String(i.contamination ?? 0), style: 'width:4rem' });
    panel.append(
      h('div', null, h('button', { onclick: () => (api.skip(), render()) }, 'skip→next'), h('button', { onclick: () => (api.visit(), render()) }, 'mark visited'), h('button', { onclick: () => cur && (api.teleport(cur.location), render()) }, 'tp incident')),
      h('div', null, 'force ', sel, h('button', { onclick: () => (api.force(sel.value), render()) }, 'apply')),
      h('div', null, 'tp ', loc, h('button', { onclick: () => api.teleport(loc.value) }, 'go')),
      h('div', null, 'contam ', cin, h('button', { onclick: () => (api.setContamination(Number(cin.value)), render()) }, 'set')),
      h(
        'div',
        null,
        h(
          'button',
          {
            onclick: () => {
              const a = document.createElement('a');
              a.href = api.screenshot();
              a.download = `na13f-${Date.now()}.png`;
              a.click();
            },
          },
          'screenshot',
        ),
        h('button', { onclick: () => (api.finishNow(), render()) }, 'auto-finish'),
      ),
    );
  }
  window.setInterval(() => visible && render(), 1000);
}

// ------------------------------------------------------------------ z-fighting scanner (dev only)

interface Tri {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  n: THREE.Vector3;
  d: number;
  src: number;
  mat: string;
  pri: number;
  matId: string;
  stat: boolean;
  noDepth: boolean;
  root: number;
}

function matLabel(m: THREE.Material, mesh: THREE.Object3D): string {
  const anyM = m as THREE.MeshStandardMaterial;
  const col = anyM.color ? `#${anyM.color.getHexString()}` : '';
  const map = anyM.map ? `tex:${anyM.map.name || anyM.map.uuid.slice(0, 4)}` : '';
  let p: THREE.Object3D | null = mesh;
  let path = '';
  while (p && !path) {
    path = p.name;
    p = p.parent;
  }
  return `${m.name || m.type}${col}${map ? '+' + map : ''}${path ? ' @' + path : ''}`;
}

function scanZFight(game: Game, floorIds: number[], tol: number, minArea: number) {
  const tris: Tri[] = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  let src = 0;
  const roots: THREE.Object3D[] = [];
  for (const n of floorIds) {
    const f = game.world.floors.get(n);
    if (f) roots.push(f.group);
  }
  if (floorIds.includes(CAR_FLOOR_ID)) roots.push(game.world.car.inst.group);
  let rootIdx = -1;
  // Solid wall/prop volumes (colliders): a face whose front side is buried in one can never be seen.
  const solids: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }[] = [];
  for (const n of floorIds) {
    const f = game.world.floors.get(n);
    if (f) solids.push(...(f.colliders as any[]).filter((c) => !c.off));
  }
  const probe = new THREE.Vector3();
  const buried = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3) => {
    probe.copy(a).add(b).add(c).divideScalar(3).addScaledVector(n, 0.004);
    for (const s of solids) if (probe.x > s.x0 && probe.x < s.x1 && probe.y > s.y0 && probe.y < s.y1 && probe.z > s.z0 && probe.z < s.z1) return true;
    return false;
  };
  for (const root of roots) {
    rootIdx++;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !o.visible) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const m0 = mats[0];
      if (!m0 || (m0 as any).visible === false || (m0 as any).colorWrite === false) return;
      if ((m0 as any).opacity === 0) return;
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position');
      if (!pos) return;
      const idx = geo.getIndex();
      const count = idx ? idx.count : pos.count;
      const double = m0.side === THREE.DoubleSide;
      const pri = m0.polygonOffset ? m0.polygonOffsetUnits * 100 + m0.polygonOffsetFactor : 0;
      const stat = !!mesh.userData.static;
      const label = matLabel(m0, mesh);
      src++;
      for (let i = 0; i < count; i += 3) {
        const i0 = idx ? idx.getX(i) : i;
        const i1 = idx ? idx.getX(i + 1) : i + 1;
        const i2 = idx ? idx.getX(i + 2) : i + 2;
        va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
        vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
        vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
        const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va));
        const area2 = n.length();
        if (area2 < 2e-6) continue;
        n.divideScalar(area2);
        // downward faces lying on a storey's floor level are buried in the slab and never visible
        if (n.y < -0.9) {
          const rel = (va.y + 3.2) / 3.2;
          if (Math.abs(rel - Math.round(rel)) * 3.2 < 0.004) continue;
        }
        if (root !== game.world.car.inst.group && buried(va, vb, vc, n)) continue;
        const t: Tri = { a: va.clone(), b: vb.clone(), c: vc.clone(), n, d: n.dot(va), src, mat: label, pri, matId: m0.uuid, stat, noDepth: m0.transparent && m0.depthWrite === false, root: rootIdx };
        tris.push(t);
        if (double) tris.push({ ...t, n: n.clone().negate(), d: -t.d });
      }
    });
  }
  // bucket by quantised normal + plane distance
  const buckets = new Map<string, Tri[]>();
  const key = (t: Tri, k: number) => `${Math.round(t.n.x * 50)},${Math.round(t.n.y * 50)},${Math.round(t.n.z * 50)}|${k}`;
  for (const t of tris) {
    const k = Math.floor(t.d / tol);
    const kk = key(t, k);
    let b = buckets.get(kk);
    if (!b) buckets.set(kk, (b = []));
    b.push(t);
  }
  let benign = 0;
  const results = new Map<string, { a: string; b: string; area: number; gap: number; at: number[]; n: number[] }>();
  // padded by tol: flat triangles have zero-thickness boxes, and two planes 1e-9 m apart would never "intersect"
  const bbox = (t: Tri) => new THREE.Box3().setFromPoints([t.a, t.b, t.c]).expandByScalar(tol);
  // 2D projection axes
  const proj = (n: THREE.Vector3) => {
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    return ax >= ay && ax >= az ? (['y', 'z'] as const) : ay >= az ? (['x', 'z'] as const) : (['x', 'y'] as const);
  };
  const inside = (u: number, v: number, t: Tri, U: 'x' | 'y', V: 'y' | 'z') => {
    const ax = t.a[U], ay = t.a[V], bx = t.b[U], by = t.b[V], cx = t.c[U], cy = t.c[V];
    const d1 = (u - bx) * (ay - by) - (ax - bx) * (v - by);
    const d2 = (u - cx) * (by - cy) - (bx - cx) * (v - cy);
    const d3 = (u - ax) * (cy - ay) - (cx - ax) * (v - ay);
    const e = 1e-7;
    return (d1 > e && d2 > e && d3 > e) || (d1 < -e && d2 < -e && d3 < -e);
  };
  for (const [kk, list] of buckets) {
    const [nk, ks] = kk.split('|');
    const next = buckets.get(`${nk}|${Number(ks) + 1}`) ?? [];
    const all = list.concat(next);
    const boxes = all.map(bbox);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const A = all[i], B = all[j];
        if (Math.abs(A.d - B.d) > tol) continue;
        // resolved: a polygon-offset tier decides the winner deterministically
        if (A.pri !== B.pri) continue;
        // two blended, non-depth-writing layers (e.g. blob shadows) never depth-fight
        if (A.noDepth && B.noDepth) continue;
        // benign: same material on batched boxes (world-space UVs → identical texels)
        if (A.matId === B.matId && A.stat && B.stat && A.root === B.root) { benign++; continue; }
        if (A.src === B.src && Math.abs(A.d - B.d) < 1e-6 && A.mat === B.mat) {
          // same mesh, same plane: normally two halves of one quad; still overlapping area counts below
        }
        const ib = boxes[i].clone().intersect(boxes[j]);
        if (ib.isEmpty()) continue;
        const [U, V] = proj(A.n);
        const du = ib.max[U] - ib.min[U];
        const dv = ib.max[V] - ib.min[V];
        if (du * dv < minArea) continue;
        const step = Math.max(0.01, Math.sqrt((du * dv) / 400));
        let hits = 0;
        for (let u = ib.min[U] + step / 2; u < ib.max[U]; u += step)
          for (let v = ib.min[V] + step / 2; v < ib.max[V]; v += step) if (inside(u, v, A, U, V as any) && inside(u, v, B, U, V as any)) hits++;
        const area = hits * step * step;
        if (area < minArea) continue;
        const pairKey = [A.mat, B.mat].sort().join(' ⟷ ') + ` @${ib.getCenter(new THREE.Vector3()).toArray().map((x) => x.toFixed(1)).join(',')}`;
        const prev = results.get(pairKey);
        if (prev) prev.area += area;
        else
          results.set(pairKey, {
            a: A.mat,
            b: B.mat,
            area,
            gap: +Math.abs(A.d - B.d).toFixed(4),
            at: ib.getCenter(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)),
            n: A.n.toArray().map((x) => +x.toFixed(2)),
          });
      }
    }
  }
  return { triangles: tris.length, benign, issues: [...results.values()].sort((x, y) => y.area - x.area).map((r) => ({ ...r, area: +r.area.toFixed(4) })) };
}
