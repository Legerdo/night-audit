// Title, briefing, pause, settings, controls, inspect overlay, elevator panel and ending screens.
import { BUILDING, FLOOR_13, PLAYER } from '../data/building';
import { imageUrl } from '../data/imageAssets';
import { ENDINGS, EVIDENCE_LINES } from '../data/records';
import { SLOTS } from '../data/story';
import { CATEGORY_LABEL } from '../data/anomalies';
import type { Settings } from '../core/settings';
import type { GameState, EndingId } from '../game/state';
import { fmtClock } from '../game/state';
import { evidenceCount, optionalCorrectCount, secretConditions } from '../systems/rules';
import { clear, h, lines } from './dom';

export class Screens {
  root: HTMLElement;
  private layer: HTMLElement;
  current: string | null = null;
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.layer = h('div', { class: 'screens' });
    this.root = this.layer;
    parent.append(this.layer);
  }

  close(): void {
    clear(this.layer);
    this.current = null;
  }

  private mount(id: string, el: HTMLElement): HTMLElement {
    clear(this.layer).append(el);
    this.current = id;
    const first = el.querySelector<HTMLElement>('button:not([disabled]), input, select');
    first?.focus({ preventScroll: true });
    return el;
  }

  // ------------------------------------------------------------ title

  title(o: { hasSave: boolean; onNew: () => void; onContinue: () => void; onSettings: () => void; onControls: () => void; progress?: number }): { setProgress: (p: number, label: string) => void; ready: () => void } {
    const bar = h('div');
    const label = h('div', { class: 'muted', style: 'font-size:0.8rem' }, '불러오는 중…');
    const loading = h('div', { class: 'loading' }, label, h('div', { class: 'bar' }, bar));
    const newBtn = h('button', { onclick: o.onNew, disabled: true }, '새 근무 시작', h('span', { class: 'sub' }, '2026년 9월 30일 00:00 — 06:00, 1회 대체 근무'));
    const contBtn = h('button', { onclick: o.onContinue, disabled: true }, '이어하기', h('span', { class: 'sub' }, o.hasSave ? '마지막 근무 일지(체크포인트)부터' : '저장된 근무 기록이 없습니다'));
    const el = h(
      'div',
      { class: 'title' },
      h('div', { class: 'art', style: `background-image:url(${imageUrl('keyart_title')})` }),
      h('div', { class: 'shade' }),
      h(
        'div',
        { class: 'content' },
        h('div', { class: 'kicker' }, `${BUILDING.name} · 철거 D-62`),
        h('h1', null, h('span', { class: 'num' }, '13'), '층: 야간점검'),
        h('div', { class: 'en' }, '13F: NIGHT AUDIT'),
        h('p', { class: 'blurb' }, '철거를 앞둔 12층짜리 주상복합, 하룻밤 대체 근무. 신고가 들어오면 현장을 확인하고 기준 자료와 비교해 보고하면 된다. 이 건물에 13층은 없다.'),
        h('nav', { class: 'menu', 'aria-label': '메인 메뉴' }, newBtn, contBtn, h('button', { onclick: o.onSettings }, '설정'), h('button', { onclick: o.onControls }, '조작법')),
      ),
      loading,
      h('div', { class: 'foot' }, '헤드폰 사용을 권장합니다 · 이 게임에는 갑작스러운 소리와 어두운 장면이 있습니다.'),
    );
    this.mount('title', el);
    return {
      setProgress: (p: number, t: string) => {
        bar.style.width = `${Math.round(p * 100)}%`;
        label.textContent = t;
      },
      ready: () => {
        loading.classList.add('hidden');
        newBtn.disabled = false;
        contBtn.disabled = !o.hasSave;
        newBtn.focus({ preventScroll: true });
      },
    };
  }

  briefing(seed: string, onStart: (seed: string) => void, onBack: () => void): void {
    const input = h('input', { class: 'seed-input', value: seed, maxlength: 12, 'aria-label': '근무 시드' });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    const el = h(
      'div',
      { class: 'screen opaque' },
      h(
        'div',
        { class: 'card brief' },
        h('h2', null, '근무 배정'),
        h(
          'div',
          { class: 'doc' },
          h('span', { class: 'seal' }, '원본'),
          h('h3', null, '야간 대체 근무 지시서'),
          h('dl', { class: 'kv' }, h('dt', null, '근무자'), h('dd', null, `${PLAYER.name} (${PLAYER.id})`), h('dt', null, '근무지'), h('dd', null, `${BUILDING.name} — ${BUILDING.address}`), h('dt', null, '근무 시간'), h('dd', null, '2026. 09. 30. 00:00 ~ 06:00'), h('dt', null, '계약'), h('dd', null, PLAYER.contract)),
          h('p', { style: 'color:#333;margin:0.9rem 0 0' }, '전임 야간 관리원 박정호 씨가 9월 21일 이후 연락이 끊겨 임시로 배치합니다. 입주민 민원은 태블릿으로 전달됩니다. 신고마다 현장을 직접 확인하고, 기준 사진·시설도·명부와 비교해 정상 또는 이상 여부를 보고하십시오.'),
          h('p', { style: 'color:#333;margin:0.6rem 0 0' }, '관리실 원본 기록 보관함의 붉은 도장이 찍힌 원본은 수정되지 않습니다. 판단이 어려우면 원본을 보십시오.'),
        ),
        h('div', { class: 'btn-row', style: 'align-items:center' }, h('label', { class: 'dim' }, '근무 시드 ', input), h('span', { style: 'flex:1' }), h('button', { class: 'btn', onclick: onBack }, '뒤로'), h('button', { class: 'btn primary', onclick: () => onStart(input.value.trim().toUpperCase() || seed) }, '근무 시작')),
      ),
    );
    this.mount('briefing', el);
  }

  // ------------------------------------------------------------ settings / controls / pause

  settings(s: Settings, onChange: (s: Settings) => void, onBack: () => void): void {
    const cur = { ...s };
    const range = (key: keyof Settings, label: string, min: number, max: number, step: number, fmt: (v: number) => string) => {
      const val = h('span', { class: 'val' }, fmt(cur[key] as number));
      const inp = h('input', { type: 'range', min, max, step, value: String(cur[key]), id: `set-${key}` });
      inp.addEventListener('input', () => {
        (cur as any)[key] = Number(inp.value);
        val.textContent = fmt(Number(inp.value));
        onChange({ ...cur });
      });
      return h('div', { class: 'field' }, h('label', { for: `set-${key}` }, label), inp, val);
    };
    const check = (key: keyof Settings, label: string) => {
      const inp = h('input', { type: 'checkbox', id: `set-${key}` });
      inp.checked = !!cur[key];
      inp.addEventListener('change', () => {
        (cur as any)[key] = inp.checked;
        onChange({ ...cur });
      });
      return h('label', { class: 'check', for: `set-${key}` }, inp, label);
    };
    const el = h(
      'div',
      { class: 'screen' },
      h(
        'div',
        { class: 'card', style: 'width:min(40rem,92vw)' },
        h('h2', null, '설정'),
        range('masterVolume', '전체 음량', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`),
        range('mouseSensitivity', '마우스 감도', 0.2, 2, 0.05, (v) => v.toFixed(2)),
        range('fov', '시야각', 60, 90, 1, (v) => `${v}°`),
        range('brightness', '밝기', 0.8, 1.3, 0.05, (v) => `${Math.round(v * 100)}%`),
        range('subtitleScale', '자막 크기', 0.9, 1.4, 0.05, (v) => `${Math.round(v * 100)}%`),
        check('invertY', '마우스 상하 반전'),
        check('headBob', '걸을 때 화면 흔들림'),
        check('reduceMotion', '움직임 줄이기 (흔들림·진동 효과 끔)'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: onBack }, '확인')),
      ),
    );
    this.mount('settings', el);
  }

  controls(onBack: () => void): void {
    const rows: [string, string][] = [
      ['W A S D', '이동'],
      ['Shift', '빠르게 걷기'],
      ['마우스', '둘러보기'],
      ['E', '상호작용 (문, 버튼, 액자, 서류)'],
      ['Tab', '태블릿 열기 / 닫기'],
      ['F', '손전등 켜기 / 끄기'],
      ['Esc', '일시정지 · 창 닫기'],
    ];
    const el = h(
      'div',
      { class: 'screen' },
      h(
        'div',
        { class: 'card', style: 'width:min(36rem,92vw)' },
        h('h2', null, '조작법'),
        h('div', { class: 'controls-grid' }, rows.map(([k, v]) => [h('span', { class: 'k' }, k), h('span', null, v)])),
        h('p', null, '신고가 들어오면 태블릿의 신고 목록을 확인하고 현장으로 가세요. 현장을 기준 사진·시설도·명부·CCTV와 비교한 뒤 보고서를 제출합니다. 이상현상이면 분류까지 골라야 합니다.'),
        h('p', null, '태블릿의 실시간 자료(B)는 오염될 수 있습니다. 관리실에서 챙기는 붉은 도장의 원본 기록철(A)은 바뀌지 않습니다.'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: onBack }, '확인')),
      ),
    );
    this.mount('controls', el);
  }

  pause(o: { onResume: () => void; onSettings: () => void; onControls: () => void; onTitle: () => void; seed: string; clock: string }): void {
    const el = h(
      'div',
      { class: 'screen' },
      h(
        'div',
        { class: 'card', style: 'width:min(26rem,92vw)' },
        h('h2', null, '일시정지'),
        h('p', { style: 'margin-top:-0.4rem' }, `${o.clock} · 시드 ${o.seed}`),
        h('nav', { class: 'menu' }, h('button', { onclick: o.onResume }, '계속하기'), h('button', { onclick: o.onSettings }, '설정'), h('button', { onclick: o.onControls }, '조작법'), h('button', { onclick: o.onTitle }, '타이틀로', h('span', { class: 'sub' }, '마지막 체크포인트 이후 진행은 저장되지 않습니다'))),
      ),
    );
    this.mount('pause', el);
  }

  // ------------------------------------------------------------ inspect

  inspect(content: { image?: HTMLImageElement | HTMLCanvasElement | string; text?: string; title?: string; sub?: string; frame?: boolean }, onClose: () => void): void {
    let media: HTMLElement | null = null;
    if (content.image) {
      let node: HTMLElement;
      if (typeof content.image === 'string') node = h('img', { src: content.image, alt: content.title ?? '' });
      else if (content.image instanceof HTMLCanvasElement) {
        const c = document.createElement('canvas');
        c.width = content.image.width;
        c.height = content.image.height;
        c.getContext('2d')!.drawImage(content.image, 0, 0);
        node = c;
      } else node = h('img', { src: content.image.src, alt: content.title ?? '' });
      media = content.frame === false ? h('div', { class: 'frame', style: 'background:#111;box-shadow:none;padding:0.4rem' }, node) : h('div', { class: 'frame' }, node);
    }
    const el = h(
      'div',
      { class: 'inspect', role: 'dialog', 'aria-label': content.title ?? '살펴보기', onmousedown: () => onClose() },
      media,
      content.text ? h('div', { class: 'card plain' }, content.title ? h('h2', null, content.title) : null, lines(content.text, 'dim')) : null,
      !content.text && (content.title || content.sub) ? h('div', { class: 'cap' }, h('b', null, content.title ?? ''), content.sub ? h('span', null, content.sub) : null) : null,
      h('div', { class: 'close-hint' }, 'E · Esc · 클릭으로 닫기'),
    );
    this.mount('inspect', el);
  }

  // ------------------------------------------------------------ elevator panel

  liftPanel(o: { floors: number[]; lit: number[]; display: string; onPress: (n: number) => void; onOpen: () => void; onClose: () => void; onDismiss: () => void }): void {
    const grid = h('div', { class: 'grid' });
    for (const n of o.floors) {
      grid.append(
        h(
          'button',
          {
            class: `${o.lit.includes(n) ? 'lit' : ''} ${n === FLOOR_13 ? 'old' : ''}`,
            'aria-label': n === 0 ? '지하 1층' : `${n}층`,
            onclick: () => o.onPress(n),
          },
          n === 0 ? 'B1' : String(n),
        ),
      );
    }
    const el = h(
      'div',
      { class: 'screen', onmousedown: (e: Event) => e.target === e.currentTarget && o.onDismiss() },
      h('div', { class: 'lift', role: 'dialog', 'aria-label': '승강기 버튼' }, h('div', { class: 'disp' }, o.display), grid, h('div', { class: 'row' }, h('button', { onclick: o.onOpen }, '◀▶ 열림'), h('button', { onclick: o.onClose }, '▶◀ 닫힘')), h('div', { class: 'hint' }, 'E · Esc 로 닫기')),
    );
    this.mount('lift', el);
  }

  // ------------------------------------------------------------ ending

  ending(id: EndingId, s: GameState, locName: (id: string) => string, onTitle: () => void, onRetry: () => void): void {
    const e = ENDINGS[id];
    const ev = evidenceCount(s);
    const paras = e.paragraphs.map((p) => p.replace('{evidence}', ev >= 3 ? EVIDENCE_LINES.many.replace('{n}', String(ev)) : EVIDENCE_LINES.few));
    const sc = secretConditions(s);
    const stats = h('div', { class: 'stats' });
    const correct = s.reports.filter((r) => r.outcome === 'correct' || r.outcome === 'correct_normal').length;
    stats.append(
      h('div', null, `처리한 신고 ${s.reports.length}건 · 정확한 판단 ${correct}건 · 증거 첨부 ${ev}건 · 최종 기록 일치율 ${100 - Math.round(s.contamination)}% · 시드 ${s.seed} · 플레이 ${Math.round(s.playTimeSec / 60)}분`),
      h('div', { style: 'margin-top:0.4rem' }, `원본 기록 D1–D4: ${['D1', 'D2', 'D3', 'D4'].filter((x) => s.pickedUp.includes(x)).length}/4 · 선택 점검 정답 ${optionalCorrectCount(s)}/3 · 1301호 ${sc.saw1301 ? '확인' : '미확인'}`),
    );
    const OUT: Record<string, string> = { correct: '정확', correct_normal: '정확 (정상)', wrong_category: '분류 불일치', missed: '놓침', false_alarm: '오신고' };
    const rows = s.reports.map((r) =>
      h(
        'tr',
        null,
        h('td', null, fmtClock(r.time)),
        h('td', null, r.incidentId.startsWith('o') ? '선택' : `#${r.incidentId.slice(1)}`),
        h('td', null, locName(r.location)),
        h('td', null, r.judgment === 'normal' ? '정상' : `이상 · ${r.category ? CATEGORY_LABEL[r.category] : ''}`),
        h('td', { class: `o-${r.outcome}` }, OUT[r.outcome]),
      ),
    );
    stats.append(h('table', null, h('thead', null, h('tr', null, h('th', null, '시각'), h('th', null, '신고'), h('th', null, '위치'), h('th', null, '보고'), h('th', null, '결과'))), h('tbody', null, rows)));
    const el = h(
      'div',
      { class: 'ending', role: 'dialog', 'aria-label': `엔딩: ${e.title}` },
      h(
        'div',
        { class: 'inner' },
        h('div', { class: 'sub' }, e.subtitle),
        h('h1', null, e.title),
        paras.map((p, i) => h('p', { style: `animation-delay:${0.6 + i * 1.6}s` }, p)),
        stats,
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: onTitle }, '타이틀로'), h('button', { class: 'btn', onclick: onRetry }, '같은 시드로 다시 근무')),
      ),
    );
    this.mount('ending', el);
    void SLOTS;
  }
}
