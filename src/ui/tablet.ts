// Handheld facility tablet (Tier-B live systems + Tier-A archive once the binder is collected).
import { CATEGORIES, CATEGORY_HELP, CATEGORY_LABEL, anomaly } from '../data/anomalies';
import { B1, FLOOR_13, PLAYER, FORMER, RESIDENTIAL_FLOORS, floorLabel, type Resident } from '../data/building';
import { imageUrl, type ImageKey } from '../data/imageAssets';
import { LOCATIONS, LOCATION_BY_ID } from '../data/locations';
import { ARCHIVE_RECORDS, type ArchiveRecord } from '../data/records';
import { INTERCOM_ANSWERS } from '../data/story';
import type { Category, Incident, Judgment } from '../data/types';
import type { Director, ReportResult } from '../game/director';
import { fmtClock } from '../game/state';
import { BANDS, band } from '../systems/rules';
import type { ChannelDef } from '../systems/cctv';
import type { ReferenceRenderer } from '../systems/reference';
import { clear, h, lines } from './dom';
import { drawPlan } from './plan';

export type TabId = 'inc' | 'ref' | 'map' | 'dir' | 'cctv' | 'log' | 'ic' | 'photo' | 'arch';

export interface TabletHost {
  director: Director;
  refs: ReferenceRenderer;
  channels(): ChannelDef[];
  setTabletChannel(ch: ChannelDef | null): void;
  readCctv(canvas: HTMLCanvasElement): void;
  report(incId: string, j: Judgment, c: Category | null): ReportResult | null;
  takePhoto(): void;
  callUnit(unit: string): { speaker: string; text: string }[];
  playerLocId(): string | null;
  playerFloor(): number;
  inspectCanvas(src: HTMLCanvasElement | HTMLImageElement | string, title: string, sub?: string): void;
  close(): void;
  click(): void;
}

const TABS: { id: TabId; label: string; tier?: string }[] = [
  { id: 'inc', label: '신고 목록' },
  { id: 'ref', label: '기준 사진', tier: 'B' },
  { id: 'map', label: '시설도', tier: 'B' },
  { id: 'dir', label: '거주자 명부', tier: 'B' },
  { id: 'cctv', label: 'CCTV', tier: 'B' },
  { id: 'log', label: '기록 · 일지', tier: 'B' },
  { id: 'ic', label: '인터폰' },
  { id: 'photo', label: '사진' },
  { id: 'arch', label: '원본 기록철', tier: 'A' },
];

const CH_LABEL: Record<string, string> = { visual: '현장', image: '사진·게시물', audio: '소리', cctv: 'CCTV', records: '기록', reference: '기준 자료' };

export class Tablet {
  root: HTMLElement;
  private host: TabletHost;
  private body: HTMLElement;
  private nav: HTMLElement;
  private top: HTMLElement;
  tab: TabId = 'inc';
  open = false;
  private draft = new Map<string, { j: Judgment | null; c: Category | null }>();
  private lastResult: { incId: string; r: ReportResult } | null = null;
  private refLoc: string | null = null;
  private mapFloor: number | null = null;
  private dirFloor: number | null = null;
  private dirArchive = false;
  private logSub: 'maint' | 'lift' | 'staff' = 'maint';
  private archSel = 'A1';
  private cctvCanvas: HTMLCanvasElement | null = null;
  private cctvSel: string | null = null;
  private transcript: { speaker: string; text: string }[] = [];
  private cctvAcc = 0;

  constructor(parent: HTMLElement, host: TabletHost) {
    this.host = host;
    this.top = h('div', { class: 'tb-top' });
    this.nav = h('nav', { class: 'tb-nav', 'aria-label': '태블릿 메뉴' });
    this.body = h('section', { class: 'tb-body' });
    const tablet = h('div', { class: 'tablet', role: 'dialog', 'aria-label': '시설관리 태블릿' }, h('div', { class: 'screen-area' }, this.top, this.nav, this.body));
    this.root = h('div', { class: 'tablet-wrap hidden' }, tablet);
    this.root.addEventListener('mousedown', (e) => {
      if (e.target === this.root) this.host.close();
    });
    parent.append(this.root);
  }

  private get d(): Director {
    return this.host.director;
  }

  show(tab?: TabId): void {
    if (tab) this.tab = tab;
    if (this.tab === 'arch' && !this.hasBinder()) this.tab = 'inc';
    this.open = true;
    this.root.classList.remove('hidden');
    this.render();
  }

  hide(): void {
    this.open = false;
    this.root.classList.add('hidden');
    this.host.setTabletChannel(null);
    this.cctvCanvas = null;
  }

  hasBinder(): boolean {
    return this.d.s.pickedUp.includes('binder');
  }

  refresh(): void {
    if (this.open) this.render();
  }

  /** Per-frame work while open (CCTV readback). */
  tick(dt: number): void {
    if (!this.open || this.tab !== 'cctv' || !this.cctvCanvas) return;
    this.cctvAcc += dt;
    if (this.cctvAcc < 0.1) return;
    this.cctvAcc = 0;
    this.host.readCctv(this.cctvCanvas);
  }

  private render(): void {
    this.renderTop();
    this.renderNav();
    clear(this.body);
    this.body.scrollTop = 0;
    if (this.tab !== 'cctv') {
      this.host.setTabletChannel(null);
      this.cctvCanvas = null;
    }
    switch (this.tab) {
      case 'inc':
        return this.renderIncidents();
      case 'ref':
        return this.renderRef();
      case 'map':
        return this.renderMap();
      case 'dir':
        return this.renderDir();
      case 'cctv':
        return this.renderCctv();
      case 'log':
        return this.renderLog();
      case 'ic':
        return this.renderIntercom();
      case 'photo':
        return this.renderPhotos();
      case 'arch':
        return this.renderArchive();
    }
  }

  private renderTop(): void {
    const s = this.d.s;
    const sync = 100 - Math.round(s.contamination);
    const b = band(s.contamination);
    const cls = b >= 4 ? 'bad' : b >= 2 ? 'warn' : '';
    clear(this.top).append(
      h('span', { class: 'brand' }, '청운빌딩 시설관리'),
      h('span', null, `${PLAYER.name} (${PLAYER.id})`),
      h('span', { class: 'dim' }, `${fmtClock(s.clock)} · 2026. 09. 30.`),
      h('span', { class: 'spacer' }),
      h('span', { class: `sync ${cls}`, title: '태블릿 기록과 원본 기록의 일치 정도' }, `기록 일치율 ${sync}% · ${BANDS[b].label}`, h('span', { class: 'meter' }, h('div', { style: `width:${sync}%` }))),
      h('button', { class: 'close', onclick: () => this.host.close(), 'aria-label': '태블릿 닫기' }, '닫기 (Tab)'),
    );
  }

  private renderNav(): void {
    clear(this.nav);
    const openCount = this.d.openIncidents().length;
    for (const t of TABS) {
      if (t.id === 'arch' && !this.hasBinder()) continue;
      if (t.id === 'arch') this.nav.append(h('div', { class: 'sep' }));
      const btn = h(
        'button',
        {
          class: this.tab === t.id ? 'on' : '',
          'aria-current': this.tab === t.id ? 'page' : undefined,
          onclick: () => {
            this.host.click();
            this.tab = t.id;
            this.render();
          },
        },
        h('span', null, t.label),
        t.id === 'inc' && openCount > 0 ? h('span', { class: 'badge' }, openCount) : t.tier ? h('span', { class: 'tier', title: t.tier === 'A' ? '원본 (변하지 않음)' : '실시간 사본 (오염될 수 있음)' }, t.tier) : null,
      );
      this.nav.append(btn);
    }
  }

  // ------------------------------------------------------------ incidents + report

  private renderIncidents(): void {
    const d = this.d;
    const s = d.s;
    const b = this.body;
    b.append(h('h3', null, '신고 목록'));
    const open = d.openIncidents();
    if (open.length === 0) {
      b.append(h('p', { class: 'dim' }, s.phase === 'final' ? '모든 신고가 처리되었습니다. 1층 출입문에서 교대를 기다리세요.' : '현재 처리할 신고가 없습니다. 다음 신고를 기다리는 중입니다.'));
    }
    const list = h('div', { class: 'inc-list' });
    for (const inc of open) list.append(this.incidentCard(inc));
    b.append(list);
    if (this.lastResult && !open.some((i) => i.id === this.lastResult!.incId)) {
      const r = this.lastResult.r;
      const good = r.outcome === 'correct' || r.outcome === 'correct_normal';
      const bad = r.outcome === 'false_alarm' || r.outcome === 'wrong_category';
      b.append(h('div', { class: `result ${good ? 'good' : bad ? 'bad' : ''}` }, h('b', null, r.title), h('div', { class: 'dim' }, r.body)));
    }
    // messages
    const msgs = s.messages.filter((m) => m.from !== '__log').slice(-8).reverse();
    if (msgs.length) {
      b.append(h('h4', null, '상황실 메시지'));
      b.append(h('div', { class: 'msg-feed' }, msgs.map((m) => h('div', { class: 'm' }, h('time', null, fmtClock(m.time)), h('b', null, m.from), m.text))));
    }
    // history
    if (s.reports.length) {
      b.append(h('h4', null, '처리 내역'));
      const rows = s.reports
        .slice()
        .reverse()
        .map((r) =>
          h(
            'tr',
            null,
            h('td', { class: 't' }, fmtClock(r.time)),
            h('td', null, d.locName(r.location)),
            h('td', null, r.judgment === 'normal' ? '정상' : `이상 · ${r.category ? CATEGORY_LABEL[r.category] : ''}`),
            h('td', null, r.evidence ? '증거 첨부' : ''),
          ),
        );
      b.append(h('table', { class: 'history' }, h('thead', null, h('tr', null, h('th', null, '시각'), h('th', null, '위치'), h('th', null, '보고'), h('th', null, ''))), h('tbody', null, rows)));
    }
  }

  private incidentCard(inc: Incident): HTMLElement {
    const d = this.d;
    const cur = d.current();
    const isCur = cur?.id === inc.id;
    const siteOk = d.siteChecked(inc);
    const needs = d.needsSite(inc);
    const card = h('article', { class: `inc ${isCur ? 'current' : ''} ${inc.optional ? 'opt' : ''}`, 'data-inc': inc.id });
    card.append(
      h('div', { class: 'meta' }, h('span', { class: 'ch' }, inc.optional ? '선택 점검' : `신고 ${inc.id.replace('s', '#')}`), h('span', null, fmtClock(inc.time)), h('span', null, d.locName(inc.location)), h('span', null, `유형: ${CH_LABEL[inc.channel]}`), h('span', null, `발신: ${inc.from}`)),
      h('div', { class: 'text' }, inc.text),
      needs ? h('div', { class: `site ${siteOk ? 'ok' : ''}` }, siteOk ? '✓ 현장 확인 완료' : `현장 확인 필요 — ${d.locName(inc.location)}(으)로 이동하세요.`) : h('div', { class: 'site ok' }, '기록 대조 신고 — 태블릿과 원본 기록으로 판단할 수 있습니다.'),
    );
    const dr = this.draft.get(inc.id) ?? { j: null, c: null };
    this.draft.set(inc.id, dr);
    const rep = h('div', { class: 'report' });
    const judge = h('div', { class: 'judge', role: 'group', 'aria-label': '판정' });
    const mk = (j: Judgment, label: string) =>
      h(
        'button',
        {
          class: `${j} ${dr.j === j ? 'on' : ''}`,
          'aria-pressed': dr.j === j ? 'true' : 'false',
          onclick: () => {
            this.host.click();
            dr.j = j;
            if (j === 'normal') dr.c = null;
            this.render();
          },
        },
        label,
      );
    judge.append(mk('normal', '정상 (이상 없음)'), mk('anomaly', '이상현상 있음'));
    rep.append(judge);
    if (dr.j === 'anomaly') {
      const cats = h('div', { class: 'cats', role: 'group', 'aria-label': '이상 분류' });
      for (const c of CATEGORIES) {
        cats.append(
          h(
            'button',
            {
              class: dr.c === c ? 'on' : '',
              'aria-pressed': dr.c === c ? 'true' : 'false',
              onclick: () => {
                this.host.click();
                dr.c = c;
                this.render();
              },
            },
            h('b', null, CATEGORY_LABEL[c]),
            h('span', null, CATEGORY_HELP[c]),
          ),
        );
      }
      rep.append(cats);
    }
    const ev = d.hasEvidence(inc);
    const can = siteOk && dr.j !== null && (dr.j === 'normal' || dr.c !== null);
    rep.append(
      h(
        'div',
        { class: 'submit-row' },
        h('span', { class: 'ev' }, ev ? '📎 이 신고의 현장 사진이 첨부됩니다.' : '현장 사진(사진 탭)을 찍으면 증거로 첨부됩니다.'),
        h(
          'button',
          {
            class: 'btn primary',
            disabled: !can,
            onclick: () => {
              if (!can) return;
              const r = this.host.report(inc.id, dr.j!, dr.c);
              if (r) {
                this.lastResult = { incId: inc.id, r };
                this.draft.delete(inc.id);
              }
              this.render();
            },
          },
          '보고 제출',
        ),
      ),
    );
    card.append(rep);
    return card;
  }

  // ------------------------------------------------------------ reference photos

  private defaultRefLoc(): string {
    const cur = this.d.current();
    const cands = [cur?.location, ...this.d.openIncidents().map((i) => i.location), this.host.playerLocId()];
    for (const c of cands) if (c && (LOCATION_BY_ID.get(c)?.shots.length ?? 0) > 0) return c;
    return 'lobby:1';
  }

  private locSelect(value: string, onChange: (v: string) => void): HTMLElement {
    const sel = h('select', { 'aria-label': '위치 선택' });
    for (const l of LOCATIONS) {
      if (l.shots.length === 0) continue;
      if (l.kind === 'stair' && !['stair:3', 'stair:12', 'stair:1'].includes(l.id) && l.id !== value) continue;
      const o = h('option', { value: l.id }, l.name);
      if (l.id === value) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  private renderRef(): void {
    const d = this.d;
    const loc = this.refLoc ?? this.defaultRefLoc();
    const b = this.body;
    b.append(h('h3', null, '기준 사진', h('span', { class: 'tier-tag b' }, 'B · 사본')));
    b.append(
      h(
        'div',
        { class: 'loc-select' },
        h('span', { class: 'dim' }, '위치'),
        this.locSelect(loc, (v) => {
          this.refLoc = v;
          this.render();
        }),
        h('button', { class: 'btn small', onclick: () => ((this.refLoc = null), this.render()) }, '신고 위치로'),
      ),
    );
    if (!d.rel().refReliable) b.append(h('div', { class: 'warn-banner' }, '기준 사진 동기화 오류가 보고되었습니다. 사본이 원본과 다를 수 있습니다. 원본 기록철(A2)과 대조하세요.'));
    b.append(h('p', { class: 'muted' }, '9월 1일 정기 점검 때 촬영한 원본을 스캔한 사본입니다. 현장과 다르면 이상현상일 수 있습니다.' + (this.hasBinder() ? ' 아래 줄은 붉은 도장이 찍힌 원본 인화본(A2)입니다.' : '')));
    const liveMods = d.liveRefMods(loc);
    const edited = liveMods.size > 0;
    const live = this.host.refs.shots(loc, liveMods);
    const arch = this.hasBinder() ? this.host.refs.shots(loc, new Set()) : [];
    const grid = h('div', { class: 'shots' });
    const lname = d.locName(loc);
    live.forEach(({ shot, canvas }, i) => {
      const c1 = cloneCanvas(canvas);
      c1.addEventListener('click', () => this.host.inspectCanvas(canvas, `${lname} · ${shot.label}`, '기준 사진 (사본)'));
      grid.append(
        h('figure', { class: `shot ${edited ? 'corrupt' : ''}`, style: 'margin:0' }, c1, h('figcaption', { class: 'cap' }, h('span', null, shot.label), edited ? h('span', { class: 'edited' }, `최종 수정 2026.09.30 ${fmtClock(this.d.current()?.time ?? this.d.s.clock)}`) : h('span', null, '2026.09.01 촬영'))),
      );
      const a = arch[i];
      if (a) {
        const c2 = cloneCanvas(a.canvas);
        c2.addEventListener('click', () => this.host.inspectCanvas(a.canvas, `${lname} · ${shot.label}`, '원본 인화본 (A2)'));
        grid.append(h('figure', { class: 'shot archive', style: 'margin:0' }, c2, h('span', { class: 'seal' }, '원본'), h('figcaption', { class: 'cap' }, h('span', null, `A2 · ${shot.label}`), h('span', null, '관리소장 확인'))));
      }
    });
    b.append(grid);
  }

  // ------------------------------------------------------------ map

  private floorChips(cur: number, floors: number[], on: (n: number) => void): HTMLElement {
    const row = h('div', { class: 'subtabs', style: 'flex-wrap:wrap' });
    for (const n of floors) row.append(h('button', { class: n === cur ? 'on' : '', onclick: () => on(n) }, n === B1 ? 'B1' : `${n}층`));
    return row;
  }

  private renderMap(): void {
    const d = this.d;
    const floors = [B1, 1, 2, ...RESIDENTIAL_FLOORS];
    const pf = this.host.playerFloor();
    const def = d.current()?.floor ?? pf;
    const floor = this.mapFloor ?? (floors.includes(def) ? def : 1);
    const b = this.body;
    b.append(h('h3', null, '시설도', h('span', { class: 'tier-tag b' }, 'B · 실시간')));
    b.append(this.floorChips(floor, floors, (n) => ((this.mapFloor = n), this.render())));
    const live = h('canvas', { 'aria-label': `${floorLabel(floor)} 실시간 시설도` });
    drawPlan(live, floor, { archive: false, extraUnit: d.liveMapExtra(floor) });
    const wrap = h('div', { class: 'map-wrap' }, live);
    b.append(wrap);
    if (this.hasBinder()) {
      const arch = h('canvas', { 'aria-label': `${floorLabel(floor)} 원본 도면` });
      drawPlan(arch, floor, { archive: true });
      b.append(h('h4', null, '사용승인 도면 원본 (A1)'), h('div', { class: 'map-wrap archive' }, arch));
    } else b.append(h('p', { class: 'muted' }, '원본 도면(A1)은 관리실 원본 기록 보관함의 기록철에 있습니다.'));
  }

  // ------------------------------------------------------------ directory

  private renderDir(): void {
    const d = this.d;
    const b = this.body;
    const def = d.current()?.floor;
    const floor = this.dirFloor ?? (def && RESIDENTIAL_FLOORS.includes(def) ? def : 3);
    b.append(h('h3', null, '거주자 명부', this.dirArchive ? h('span', { class: 'tier-tag a' }, 'A · 원본 입주자 카드') : h('span', { class: 'tier-tag b' }, 'B · 사본')));
    const row = this.floorChips(floor, RESIDENTIAL_FLOORS, (n) => ((this.dirFloor = n), this.render()));
    if (this.hasBinder()) {
      row.append(h('span', { style: 'flex:1' }), h('button', { class: this.dirArchive ? 'on' : '', onclick: () => ((this.dirArchive = !this.dirArchive), this.render()) }, this.dirArchive ? '사본 명부 보기' : '원본 카드 (A3) 보기'));
    }
    b.append(row);
    if (!this.dirArchive && !d.rel().directoryReliable) b.append(h('div', { class: 'warn-banner' }, '명부 동기화 불안정 — 일부 항목이 손상되었습니다. 원본 입주자 카드(A3)와 대조하세요.'));
    const entries: (Resident & { glitch?: boolean; injected?: boolean; portraitKey?: string })[] = this.dirArchive
      ? archiveEntries(floor, d)
      : d.directory().filter((r) => Math.floor(Number(r.unit) / 100) === floor);
    const grid = h('div', { class: 'dir-grid' });
    for (const r of entries) {
      const moved = r.status !== 'occupied';
      const img = r.portraitKey ? portrait(r.portraitKey as ImageKey, `${r.unit}호 ${r.name}`, (src) => this.host.inspectCanvas(src, `${r.unit}호 ${r.name}`, this.dirArchive ? '원본 입주자 카드 사진 (A3)' : '거주자 명부 사진 (사본)')) : h('div', { class: 'ph' }, '사진 없음');
      grid.append(
        h(
          'div',
          { class: `res ${moved ? 'moved' : ''} ${r.glitch ? 'glitch' : ''} ${this.dirArchive ? 'card' : ''}` },
          img,
          h('div', null, h('div', null, h('span', { class: 'unit' }, `${r.unit}호`), ' ', h('span', { class: 'name' }, r.name)), h('div', { class: 'st' }, moved ? r.note ?? '이주 완료' : `입주 ${r.since}${r.age ? ` · ${r.age}세` : ''}`), r.note && !moved ? h('div', { class: 'st' }, r.note) : null),
        ),
      );
    }
    b.append(h('div', { class: 'dir-floor' }, h('h4', null, `${floorLabel(floor)} · ${entries.length}세대`), grid));
  }

  // ------------------------------------------------------------ cctv

  private renderCctv(): void {
    const d = this.d;
    const b = this.body;
    const chans = this.host.channels();
    const cur = d.current();
    let sel = chans.find((c) => c.id === this.cctvSel);
    if (!sel && cur) sel = chans.find((c) => c.floor === cur.floor && c.id.startsWith('corr-')) ?? chans.find((c) => (cur.location === 'lobby:1' && c.id === 'lobby') || (cur.location === 'elevator' && c.id === 'car'));
    sel ??= chans.find((c) => c.id === 'lobby')!;
    b.append(h('h3', null, 'CCTV', h('span', { class: 'tier-tag b' }, 'B · 실시간')));
    if (!d.rel().cctvReliable) b.append(h('div', { class: 'warn-banner' }, '영상 전송 불안정 — 일부 채널에서 신호 손실과 지연이 발생합니다. 화면만 믿지 말고 현장을 확인하세요.'));
    const canvas = h('canvas', { width: 400, height: 300, 'aria-label': `${sel.ch} ${sel.label} 영상` });
    this.cctvCanvas = canvas;
    this.host.setTabletChannel(sel);
    const chs = h('div', { class: 'chs' });
    for (const c of chans) {
      chs.append(
        h(
          'button',
          {
            class: `${c.id === sel.id ? 'on' : ''} ${c.id === 'corr-13' ? 'new' : ''}`,
            onclick: () => {
              this.host.click();
              this.cctvSel = c.id;
              this.render();
            },
          },
          `${c.ch}  ${c.label}`,
        ),
      );
    }
    b.append(h('div', { class: 'cctv' }, h('div', { class: 'view' }, canvas), chs));
    b.append(h('p', { class: 'muted' }, '관리실 모니터: CH1 로비 · CH2 승강기 · CH3 신고 현장 · CH4 B1 복도'));
  }

  // ------------------------------------------------------------ logs

  private renderLog(): void {
    const d = this.d;
    const b = this.body;
    b.append(h('h3', null, '기록 · 일지', h('span', { class: 'tier-tag b' }, 'B · 사본')));
    const st = h('div', { class: 'subtabs' });
    for (const [id, label] of [
      ['maint', '점검 일지'],
      ['lift', '승강기 운행 기록'],
      ['staff', '근무자 · 인사 기록'],
    ] as const)
      st.append(h('button', { class: this.logSub === id ? 'on' : '', onclick: () => ((this.logSub = id), this.render()) }, label));
    b.append(st);
    if (this.logSub === 'maint') {
      b.append(h('p', { class: 'muted' }, '점검 일지에 이미 기록된 고장은 이상현상이 아닙니다. 관리실 책상의 근무 일지에서 기록을 남기면 진행 상황이 저장됩니다.'));
      const rows = d.maintLog().map((l) => h('tr', { class: l.injected ? 'inj' : '' }, h('td', { class: 't' }, `${l.date} ${l.time}`), h('td', null, l.text), h('td', { class: 't' }, l.by)));
      b.append(h('table', { class: 'log' }, h('thead', null, h('tr', null, h('th', null, '일시'), h('th', null, '내용'), h('th', null, '작성'))), h('tbody', null, rows)));
    } else if (this.logSub === 'lift') {
      b.append(h('p', { class: 'muted' }, '청운승강기(주) 원격감시 시스템. 정지층 B1 ~ 12층. 원본 설치 검사서는 원본 기록철(A5)에 있습니다.'));
      const log = d.elevatorLog();
      const rows = log.length
        ? log.map((e) => h('tr', { class: e.injected ? 'inj' : '' }, h('td', { class: 't' }, fmtClock(e.time)), h('td', null, `${lbl(e.from)} → ${lbl(e.to)}`), h('td', null, e.note)))
        : [h('tr', null, h('td', { colspan: 3, class: 'muted' }, '오늘 운행 기록 없음'))];
      b.append(h('table', { class: 'log' }, h('thead', null, h('tr', null, h('th', null, '시각'), h('th', null, '운행'), h('th', null, '비고'))), h('tbody', null, rows)));
    } else {
      b.append(h('h4', null, '금일 야간 근무자 현황'));
      const workers: [string, string, string][] = [[PLAYER.name, PLAYER.id, '근무 중 · 관리실']];
      if (d.isActive('sys_personnel_two')) workers.push([FORMER.name, FORMER.id, '근무 중 · 13층 순찰']);
      b.append(h('table', { class: 'log' }, h('tbody', null, workers.map(([n, id, st2]) => h('tr', null, h('td', null, n), h('td', { class: 't' }, id), h('td', null, st2))))));
      b.append(h('h4', null, '인사 기록'));
      const idAnom = d.isActive('sys_identity_record');
      b.append(
        h(
          'div',
          { class: 'person' },
          portrait('staff_hanseojin', PLAYER.name, (src) => this.host.inspectCanvas(src, PLAYER.name, '인사 기록 사진')),
          h(
            'dl',
            { class: 'kv' },
            h('dt', null, '성명'),
            h('dd', null, PLAYER.name),
            h('dt', null, '사번'),
            h('dd', null, PLAYER.id),
            h('dt', null, '입사일'),
            h('dd', null, idAnom ? '1994. 11. 02.' : '2026. 09. 29.'),
            h('dt', null, '고용 형태'),
            h('dd', null, idAnom ? '상주 야간 관리인 (정규)' : '임시 (야간 1회 대체 근무)'),
            h('dt', null, '근무지'),
            h('dd', null, idAnom ? '청운빌딩 (지상 13층)' : '청운빌딩 (지상 12층)'),
            h('dt', null, '주소'),
            h('dd', null, idAnom ? '청운빌딩 1308호' : '서울특별시 ○○구 (비공개)'),
            h('dt', null, '계약 종료'),
            h('dd', null, idAnom ? '없음' : '2026. 09. 30. 06:00'),
          ),
        ),
      );
      b.append(
        h(
          'div',
          { class: 'person' },
          portrait(d.isActive('img_missing_poster_empty') ? 'staff_parkjeongho_empty' : 'staff_parkjeongho', FORMER.name, (src) => this.host.inspectCanvas(src, FORMER.name, '인사 기록 사진')),
          h('dl', { class: 'kv' }, h('dt', null, '성명'), h('dd', null, FORMER.name), h('dt', null, '사번'), h('dd', null, FORMER.id), h('dt', null, '입사일'), h('dd', null, '2019. 04. 12.'), h('dt', null, '상태'), h('dd', null, d.isActive('sys_personnel_two') ? '근무 중' : '퇴사 (2026. 09. 22.)')),
        ),
      );
      if (this.hasBinder()) b.append(h('p', { class: 'muted' }, '본인 근로계약서 원본은 원본 기록철(A4)에 있습니다.'));
    }
  }

  // ------------------------------------------------------------ intercom

  private renderIntercom(): void {
    const b = this.body;
    b.append(h('h3', null, '인터폰'));
    b.append(h('p', { class: 'muted' }, '세대 번호를 눌러 호출합니다. 새벽 시간이니 꼭 필요할 때만 사용하세요.'));
    const input = h('input', { type: 'text', inputmode: 'numeric', maxlength: 4, placeholder: '예: 803', 'aria-label': '호출할 세대 번호' });
    const call = (u: string) => {
      const res = this.host.callUnit(u.trim());
      this.transcript = res;
      this.render();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if ((e as KeyboardEvent).key === 'Enter') call(input.value);
    });
    b.append(h('div', { class: 'dial' }, input, h('button', { class: 'btn', onclick: () => call(input.value) }, '호출')));
    const grid = h('div', { class: 'ic-grid' });
    const quick: [string, string][] = [
      ['HQ', '야간 상황실'],
      ['803', '이순자'],
      ['602', '박영수 (입주자 대표)'],
      ['305', '김도현'],
      ['1108', '오지은'],
      ['1007', '최민영 (이주)'],
    ];
    for (const [u, name] of quick) grid.append(h('button', { onclick: () => call(u) }, h('b', null, u === 'HQ' ? '상황실' : `${u}호`), h('span', null, name)));
    b.append(grid);
    const tr = h('div', { class: 'transcript', 'aria-live': 'polite' });
    if (this.transcript.length === 0) tr.append(h('span', { class: 'muted' }, '통화 기록 없음'));
    for (const l of this.transcript) tr.append(h('div', { class: 'l' }, h('b', null, l.speaker), l.text));
    b.append(tr);
    void INTERCOM_ANSWERS;
  }

  // ------------------------------------------------------------ photos

  private renderPhotos(): void {
    const d = this.d;
    const b = this.body;
    b.append(h('h3', null, '사진'));
    b.append(h('p', { class: 'muted' }, '태블릿 카메라로 현재 보고 있는 장면을 촬영합니다. 신고 현장에서 찍은 사진은 보고서에 증거로 첨부됩니다.'));
    b.append(h('div', { class: 'btn-row', style: 'margin:0 0 1rem' }, h('button', { class: 'btn primary', onclick: () => this.host.takePhoto() }, '📷 사진 촬영')));
    const grid = h('div', { class: 'photos' });
    const ps = d.s.photos.slice().reverse();
    if (ps.length === 0) b.append(h('p', { class: 'dim' }, '아직 찍은 사진이 없습니다.'));
    for (const p of ps) {
      const img = h('img', { src: p.thumb, alt: `${fmtClock(p.time)} ${d.locName(p.location)} 사진` });
      img.addEventListener('click', () => this.host.inspectCanvas(p.thumb, `${fmtClock(p.time)} · ${d.locName(p.location)}`, p.evidenceOf ? '신고 현장 증거 사진' : '현장 사진'));
      grid.append(h('div', { class: 'photo' }, img, h('div', { class: 'cap' }, h('span', null, `${fmtClock(p.time)} ${d.locName(p.location)}`), p.evidenceOf ? h('span', { class: 'evi' }, '증거') : null)));
    }
    b.append(grid);
  }

  // ------------------------------------------------------------ archive (Tier A)

  private renderArchive(): void {
    const d = this.d;
    const b = this.body;
    b.append(h('h3', null, '원본 기록철', h('span', { class: 'tier-tag a' }, 'A · 원본 — 바뀌지 않음')));
    const items = ARCHIVE_RECORDS.filter((r) => !r.discovered || d.s.pickedUp.includes(r.id));
    const list = h('div', { class: 'items' });
    for (const r of items) list.append(h('button', { class: this.archSel === r.id ? 'on' : '', onclick: () => ((this.archSel = r.id), this.render()) }, h('span', { class: 'id' }, r.id), r.title));
    const missing = ARCHIVE_RECORDS.filter((r) => r.discovered && !d.s.pickedUp.includes(r.id)).length;
    if (missing > 0) list.append(h('div', { class: 'muted', style: 'font-size:0.8rem;padding:0.4rem' }, `기록철 색인에 없는 문서 ${missing}건이 어딘가에 있다.`));
    const rec = items.find((r) => r.id === this.archSel) ?? items[0];
    b.append(h('div', { class: 'arch-list' }, list, h('div', null, this.paper(rec))));
  }

  private paper(r: ArchiveRecord): HTMLElement {
    const p = h('div', { class: `paper ${r.id === 'D4' ? 'handwritten' : ''}` }, h('h4', null, `${r.id}. ${r.title}`), h('div', { class: 'subt' }, r.subtitle), r.id.startsWith('A') ? h('span', { class: 'seal' }, '원본') : null, lines(r.body));
    if (r.image) {
      const img = h('img', { src: imageUrl(r.image), alt: r.title });
      img.addEventListener('click', () => this.host.inspectCanvas(imageUrl(r.image!), r.title, r.subtitle));
      p.append(img);
    }
    if (r.id === 'A2') p.append(h('div', { style: 'margin-top:0.8rem' }, h('button', { class: 'btn small', onclick: () => ((this.tab = 'ref'), this.render()) }, '기준 사진 탭에서 원본 인화본 보기')));
    if (r.id === 'A1') p.append(h('div', { style: 'margin-top:0.8rem' }, h('button', { class: 'btn small', onclick: () => ((this.tab = 'map'), this.render()) }, '시설도 탭에서 원본 도면 보기')));
    if (r.id === 'A3')
      p.append(
        h(
          'div',
          { style: 'margin-top:0.8rem' },
          h(
            'button',
            {
              class: 'btn small',
              onclick: () => {
                this.tab = 'dir';
                this.dirArchive = true;
                this.render();
              },
            },
            '명부 탭에서 원본 입주자 카드 보기',
          ),
        ),
      );
    if (r.id === 'A5') p.append(h('div', { class: 'subt', style: 'margin-top:0.6rem' }, '※ 13 버튼 없음. 정지층 13개 (B1 포함).'));
    return p;
  }
}

function lbl(n: number): string {
  return n === B1 ? 'B1' : n === FLOOR_13 ? '13' : String(n);
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

function portrait(key: ImageKey, alt: string, onClick: (src: string) => void): HTMLElement {
  const url = imageUrl(key);
  const img = h('img', { src: url, alt, loading: 'lazy' });
  img.addEventListener('click', () => onClick(url));
  img.addEventListener('error', () => img.replaceWith(h('div', { class: 'ph' }, '사진 없음')));
  return img;
}

function archiveEntries(floor: number, d: Director): (Resident & { portraitKey?: string })[] {
  const out: (Resident & { portraitKey?: string })[] = [];
  for (let i = 1; i <= 8; i++) {
    const r = d.archiveResident(`${floor}${String(i).padStart(2, '0')}`);
    if (r) out.push({ ...r, portraitKey: r.portrait });
  }
  return out;
}

export function describeIncident(inc: Incident): string {
  return inc.anomalyId ? anomaly(inc.anomalyId).title : '정상';
}
