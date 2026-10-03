// In-world HUD: crosshair, interaction prompt, clock, current task, toasts, subtitles and screen effects.
import { h, clear } from './dom';
import type { VoiceLine } from '../data/story';

export class Hud {
  root: HTMLElement;
  private cross: HTMLElement;
  private prompt: HTMLElement;
  private time: HTMLElement;
  private where: HTMLElement;
  private task: HTMLElement;
  private toasts: HTMLElement;
  private sub: HTMLElement;
  private note: HTMLElement;
  private hint: HTMLElement;
  private subQueue: VoiceLine[] = [];
  private subTimer: number | null = null;
  fx: HTMLElement;
  private flashEl: HTMLElement;
  private tearEl: HTMLElement;
  private grainEl: HTMLElement;
  private noteTimer: number | null = null;

  constructor(parent: HTMLElement) {
    this.fx = h('div', { id: 'fx', class: 'passive' });
    this.grainEl = h('div', { class: 'grain' });
    this.flashEl = h('div', { class: 'flash' });
    this.tearEl = h('div', { class: 'tear' });
    this.fx.append(this.grainEl, h('div', { class: 'vignette' }), this.tearEl, this.flashEl);
    this.grainEl.style.backgroundImage = `url(${grainDataUrl()})`;
    this.cross = h('div', { class: 'crosshair' });
    this.prompt = h('div', { class: 'prompt hidden', role: 'status' });
    this.time = h('div', { class: 'time' }, '00:00');
    this.where = h('div', { class: 'where' });
    this.task = h('div', { class: 'hud-task hidden', 'aria-live': 'polite' });
    this.toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.sub = h('div', { class: 'subtitle hidden', 'aria-live': 'assertive' });
    this.note = h('div', { class: 'center-note hidden' });
    this.hint = h('div', { class: 'hud-hint' }, 'Tab 태블릿 · F 손전등 · E 상호작용 · Esc 일시정지');
    this.root = h('div', { class: 'hud passive hidden' }, this.cross, this.prompt, h('div', { class: 'hud-clock' }, this.time, this.where), this.task, this.toasts, this.sub, this.note, this.hint);
    parent.append(this.fx, this.root);
  }

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  /** Dim world-HUD elements while a full-screen UI (tablet) is open. */
  under(v: boolean): void {
    this.root.classList.toggle('under', v);
  }

  setPrompt(text: string | null, key = 'E'): void {
    if (!text) {
      this.prompt.classList.add('hidden');
      this.cross.classList.remove('active');
      return;
    }
    clear(this.prompt).append(h('span', { class: 'key' }, key), text);
    this.prompt.classList.remove('hidden');
    this.cross.classList.add('active');
  }

  setClock(t: string, where: string, sub: string): void {
    if (this.time.textContent !== t) this.time.textContent = t;
    const w = `${where}\n${sub}`;
    if (this.where.dataset.v !== w) {
      this.where.dataset.v = w;
      clear(this.where).append(h('div', null, where), h('div', null, sub));
    }
  }

  setTask(label: string | null, text = '', site = '', siteOk = false): void {
    if (!label) {
      this.task.classList.add('hidden');
      return;
    }
    const key = `${label}|${text}|${site}|${siteOk}`;
    if (this.task.dataset.k === key) return;
    this.task.dataset.k = key;
    clear(this.task).append(h('div', { class: 'label' }, label), h('div', null, text));
    if (site) this.task.append(h('div', { class: `site${siteOk ? ' ok' : ''}` }, site));
    this.task.classList.remove('hidden');
  }

  toast(from: string, text: string, kind: 'normal' | 'important' | 'system' = 'normal', ms = 7000): void {
    const t = h('div', { class: `toast ${kind === 'normal' ? '' : kind}` }, h('div', { class: 'from' }, from), text);
    this.toasts.prepend(t);
    while (this.toasts.children.length > 4) this.toasts.lastElementChild?.remove();
    window.setTimeout(() => {
      t.classList.add('out');
      window.setTimeout(() => t.remove(), 450);
    }, ms);
  }

  centerNote(text: string, ms = 2600): void {
    this.note.textContent = text;
    this.note.classList.remove('hidden');
    if (this.noteTimer !== null) clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => this.note.classList.add('hidden'), ms);
  }

  say(lines: VoiceLine[]): void {
    this.subQueue.push(...lines);
    if (this.subTimer === null) this.nextSub();
  }

  get speaking(): boolean {
    return this.subTimer !== null;
  }

  private nextSub(): void {
    const l = this.subQueue.shift();
    if (!l) {
      this.sub.classList.add('hidden');
      this.subTimer = null;
      return;
    }
    clear(this.sub).append(h('span', { class: 'speaker' }, l.speaker), l.text);
    this.sub.classList.remove('hidden');
    const ms = Math.max(2600, l.text.length * 95);
    this.subTimer = window.setTimeout(() => this.nextSub(), ms);
  }

  setSubtitleScale(s: number): void {
    document.documentElement.style.setProperty('--sub-scale', String(s));
  }

  flash(sec: number): void {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '0.92';
    window.setTimeout(() => {
      this.flashEl.style.transition = 'opacity 0.35s ease-out';
      this.flashEl.style.opacity = '0';
    }, sec * 1000);
  }

  tear(): void {
    this.tearEl.classList.remove('on');
    void this.tearEl.offsetWidth;
    this.tearEl.classList.add('on');
  }

  setContamination(c: number): void {
    this.grainEl.style.opacity = String(0.06 + (c / 100) * 0.16);
  }
}

function grainDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  let s = 99;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = s >>> 24;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}
