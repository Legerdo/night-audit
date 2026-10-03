// Deterministic procedural textures (canvas-based). Same inputs => same pixels, every run.
import * as THREE from 'three';
import { Rng } from '../core/rng';

export const FONT = '"Pretendard Variable", "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

const cache = new Map<string, THREE.Texture>();

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement, repeat = true, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    if (!t.name) t.name = key;
    cache.set(key, t);
  }
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, count: number, colors: string[], size: [number, number]) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng.pick(colors);
    const s = size[0] + rng.next() * (size[1] - size[0]);
    ctx.fillRect(rng.next() * w, rng.next() * h, s, s);
  }
}

function mottle(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, alpha: number, blobs = 60) {
  for (let i = 0; i < blobs; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    const r = 20 + rng.next() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng.chance(0.5);
    g.addColorStop(0, dark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Painted wall (tileable-ish). */
export function paintTex(key: string, base: string, seed: number): THREE.Texture {
  return cached(`paint:${key}`, () => {
    const [c, ctx] = makeCanvas(256, 256);
    const rng = new Rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    mottle(ctx, 256, 256, rng, 0.025, 40);
    speckle(ctx, 256, 256, rng, 900, ['rgba(0,0,0,0.035)', 'rgba(255,255,255,0.04)'], [1, 2]);
    return toTexture(c);
  });
}

/** Vinyl deco tile (450mm) floor: one texture tile = 0.9m (2x2 tiles). */
export function decoTileTex(key: string, a: string, b: string, seed: number): THREE.Texture {
  return cached(`deco:${key}`, () => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = new Rng(seed);
    const half = 256;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? a : b;
        ctx.fillRect(i * half, j * half, half, half);
      }
    speckle(ctx, 512, 512, rng, 5000, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.05)', 'rgba(90,80,60,0.06)'], [1, 3]);
    mottle(ctx, 512, 512, rng, 0.03, 30);
    ctx.strokeStyle = 'rgba(40,35,30,0.35)';
    ctx.lineWidth = 2;
    for (let k = 0; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * half, 0);
      ctx.lineTo(k * half, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, k * half);
      ctx.lineTo(512, k * half);
      ctx.stroke();
    }
    return toTexture(c);
  });
}

/** Mineral fibre ceiling board (텍스), 600x300 panels: tile = 1.2m x 0.6m -> use square 1.2m. */
export function ceilingTex(key: string, base: string, seed: number): THREE.Texture {
  return cached(`ceil:${key}`, () => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = new Rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(60,55,50,${0.12 + rng.next() * 0.2})`;
      const x = rng.next() * 512;
      const y = rng.next() * 512;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + rng.next() * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(70,65,60,0.55)';
    ctx.lineWidth = 3;
    for (let k = 0; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(0, k * 128);
      ctx.lineTo(512, k * 128);
      ctx.stroke();
    }
    for (let k = 0; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 256, 0);
      ctx.lineTo(k * 256, 512);
      ctx.stroke();
    }
    return toTexture(c);
  });
}

export function terrazzoTex(key: string, base: string, chips: string[], seed: number): THREE.Texture {
  return cached(`terr:${key}`, () => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = new Rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = rng.pick(chips);
      const x = rng.next() * 512;
      const y = rng.next() * 512;
      const r = 1 + rng.next() * 3.5;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + rng.next() * 0.6), rng.next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    mottle(ctx, 512, 512, rng, 0.03, 30);
    return toTexture(c);
  });
}

export function concreteTex(key: string, base: string, seed: number): THREE.Texture {
  return cached(`conc:${key}`, () => {
    const [c, ctx] = makeCanvas(512, 512);
    const rng = new Rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    mottle(ctx, 512, 512, rng, 0.05, 90);
    speckle(ctx, 512, 512, rng, 7000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)'], [1, 2]);
    return toTexture(c);
  });
}

/** Brushed stainless (hairline). */
export function steelTex(key: string, base: string, seed: number): THREE.Texture {
  return cached(`steel:${key}`, () => {
    const [c, ctx] = makeCanvas(256, 256);
    const rng = new Rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      ctx.fillStyle = `rgba(${rng.chance(0.5) ? '255,255,255' : '0,0,0'},${rng.next() * 0.07})`;
      ctx.fillRect(0, y, 256, 1);
    }
    return toTexture(c);
  });
}

export function woodGrainTex(key: string, base: string, line: string, seed: number): THREE.Texture {
  return cached(`wood:${key}`, () => {
    const [c, ctx] = makeCanvas(256, 512);
    const rng = new Rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 512);
    ctx.strokeStyle = line;
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.08 + rng.next() * 0.15;
      ctx.lineWidth = 0.5 + rng.next() * 2;
      const x = rng.next() * 256;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + i) * 4 + (rng.next() - 0.5) * 2, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return toTexture(c);
  });
}

export function shutterTex(): THREE.Texture {
  return cached('shutter', () => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#8d9193';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) {
      const g = ctx.createLinearGradient(0, y, 0, y + 16);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.0)');
      g.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, 256, 16);
    }
    return toTexture(c);
  });
}

/** Yellowed 1990s floral wallpaper for the impossible floor. */
export function wallpaper94Tex(): THREE.Texture {
  return cached('wp94', () => {
    const [c, ctx] = makeCanvas(256, 256);
    const rng = new Rng(1994);
    ctx.fillStyle = '#cdbf96';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(140,110,70,0.18)';
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const x = i * 64 + (j % 2) * 32;
        const y = j * 64;
        for (let p = 0; p < 5; p++) {
          ctx.beginPath();
          ctx.ellipse(x + 16 + Math.cos(p * 1.256) * 7, y + 24 + Math.sin(p * 1.256) * 7, 6, 3, p * 1.256, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    mottle(ctx, 256, 256, rng, 0.06, 30);
    return toTexture(c);
  });
}

/** Korean yellow vinyl floor (장판) for apartment interiors. */
export function jangpanTex(): THREE.Texture {
  return cached('jangpan', () => {
    const [c, ctx] = makeCanvas(256, 256);
    const rng = new Rng(77);
    ctx.fillStyle = '#c9a25f';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(120,80,30,${0.05 + rng.next() * 0.08})`;
      ctx.lineWidth = 1 + rng.next() * 2;
      const y = rng.next() * 256;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + rng.next() * 10, 160, y - rng.next() * 10, 256, y);
      ctx.stroke();
    }
    mottle(ctx, 256, 256, rng, 0.05, 25);
    return toTexture(c);
  });
}

/** Night cityscape seen through corridor end windows. */
export function cityTex(seed: number): THREE.Texture {
  return cached(`city:${seed}`, () => {
    const [c, ctx] = makeCanvas(1024, 512);
    const rng = new Rng(seed);
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#07090d');
    sky.addColorStop(0.6, '#141820');
    sky.addColorStop(1, '#1d1f24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 512);
    let x = 0;
    while (x < 1024) {
      const w = 60 + rng.next() * 120;
      const h = 150 + rng.next() * 260;
      const shade = 12 + Math.floor(rng.next() * 14);
      ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
      ctx.fillRect(x, 512 - h, w, h);
      for (let wy = 512 - h + 10; wy < 500; wy += 14)
        for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          if (rng.chance(0.13)) {
            ctx.fillStyle = rng.chance(0.7) ? 'rgba(255,214,150,0.75)' : 'rgba(190,220,255,0.6)';
            ctx.fillRect(wx, wy, 6, 7);
          }
        }
      x += w + rng.next() * 12;
    }
    // A distant red aircraft beacon on the tallest tower.
    ctx.fillStyle = 'rgba(255,60,50,0.9)';
    ctx.fillRect(700, 120, 4, 4);
    return toTexture(c, false);
  });
}

export function streetTex(): THREE.Texture {
  return cached('street', () => {
    const [c, ctx] = makeCanvas(1024, 512);
    const rng = new Rng(4);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#050608');
    g.addColorStop(1, '#101114');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    // street lamp glow
    const lg = ctx.createRadialGradient(760, 150, 4, 760, 150, 220);
    lg.addColorStop(0, 'rgba(255,190,110,0.85)');
    lg.addColorStop(0.2, 'rgba(255,170,90,0.25)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(755, 150, 8, 362);
    // parked cars silhouettes
    ctx.fillStyle = '#16171a';
    for (const cx of [120, 420]) {
      ctx.beginPath();
      ctx.roundRect(cx, 380, 230, 70, 18);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(cx + 40, 340, 140, 55, 16);
      ctx.fill();
    }
    // wet asphalt reflections
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(255,180,100,${rng.next() * 0.05})`;
      ctx.fillRect(600 + rng.next() * 320, 440 + rng.next() * 70, 2 + rng.next() * 6, 1);
    }
    return toTexture(c, false);
  });
}

// ----- Text-bearing textures (Korean text always rendered by code) -----

export interface SignOpts {
  w: number;
  h: number;
  bg: string;
  fg: string;
  lines: { text: string; size: number; weight?: number; color?: string; dy?: number }[];
  border?: string;
  radius?: number;
  pad?: number;
}

export function signTex(key: string, o: SignOpts): THREE.Texture {
  return cached(`sign:${key}`, () => {
    const [c, ctx] = makeCanvas(o.w, o.h);
    drawSign(ctx, o);
    const t = toTexture(c, false);
    t.anisotropy = 8;
    return t;
  });
}

export function drawSign(ctx: CanvasRenderingContext2D, o: SignOpts): void {
  ctx.fillStyle = o.bg;
  if (o.radius) {
    ctx.beginPath();
    ctx.roundRect(0, 0, o.w, o.h, o.radius);
    ctx.fill();
  } else ctx.fillRect(0, 0, o.w, o.h);
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = Math.max(2, o.w * 0.012);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, o.w - ctx.lineWidth * 2, o.h - ctx.lineWidth * 2);
  }
  const total = o.lines.reduce((s, l) => s + l.size * 1.25, 0);
  let y = (o.h - total) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const l of o.lines) {
    ctx.fillStyle = l.color ?? o.fg;
    ctx.font = `${l.weight ?? 700} ${l.size}px ${FONT}`;
    fitText(ctx, l.text, o.w / 2, y + (l.dy ?? 0), o.w - (o.pad ?? 16) * 2);
    y += l.size * 1.25;
  }
}

/** Draw centred text, horizontally squeezing only if it would overflow. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number): void {
  const w = ctx.measureText(text).width;
  if (w <= maxW) {
    ctx.fillText(text, cx, y);
    return;
  }
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(maxW / w, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Word-wrap Korean text (breaks at spaces, then by character if needed). */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxW) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      if (ctx.measureText(word).width <= maxW) {
        line = word;
      } else {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxW) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      }
    }
    out.push(line);
  }
  return out;
}

/** Paper notice with title + body, rendered deterministically. */
export interface NoticeOpts {
  w: number;
  h: number;
  paper?: string;
  title: string;
  titleColor?: string;
  body: string;
  footer?: string;
  seed?: number;
  stamp?: string;
  headerBand?: string;
  image?: HTMLImageElement | HTMLCanvasElement | null;
  imageRect?: [number, number, number, number];
}

export function drawNotice(ctx: CanvasRenderingContext2D, o: NoticeOpts): void {
  const rng = new Rng(o.seed ?? 1);
  ctx.fillStyle = o.paper ?? '#f1ede2';
  ctx.fillRect(0, 0, o.w, o.h);
  mottle(ctx, o.w, o.h, rng, 0.03, 20);
  let y = o.h * 0.06;
  if (o.headerBand) {
    ctx.fillStyle = o.headerBand;
    ctx.fillRect(0, 0, o.w, o.h * 0.14);
    y = o.h * 0.025;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = o.titleColor ?? '#1b1b1b';
  const ts = Math.round(o.w * 0.085);
  ctx.font = `800 ${ts}px ${FONT}`;
  fitText(ctx, o.title, o.w / 2, y + (o.headerBand ? o.h * 0.035 : 0), o.w * 0.9);
  y += ts * 1.6 + (o.headerBand ? o.h * 0.05 : 0);
  if (o.image && o.imageRect) {
    const [ix, iy, iw, ih] = o.imageRect;
    ctx.drawImage(o.image, ix, iy, iw, ih);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(ix, iy, iw, ih);
    y = iy + ih + o.h * 0.03;
  }
  const bs = Math.round(o.w * 0.045);
  ctx.font = `500 ${bs}px ${FONT}`;
  ctx.fillStyle = '#262626';
  ctx.textAlign = 'left';
  const lines = wrapLines(ctx, o.body, o.w * 0.86);
  for (const l of lines) {
    ctx.fillText(l, o.w * 0.07, y);
    y += bs * 1.5;
  }
  if (o.footer) {
    ctx.font = `600 ${Math.round(bs * 0.9)}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#3a3a3a';
    ctx.fillText(o.footer, o.w * 0.93, o.h - bs * 2.2);
  }
  if (o.stamp) {
    ctx.save();
    ctx.translate(o.w * 0.8, o.h * 0.82);
    ctx.rotate(-0.18);
    ctx.strokeStyle = 'rgba(200,30,30,0.75)';
    ctx.fillStyle = 'rgba(200,30,30,0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, o.w * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `800 ${Math.round(o.w * 0.04)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.stamp, 0, 0);
    ctx.restore();
  }
  // tape corners
  ctx.fillStyle = 'rgba(235,230,200,0.55)';
  ctx.fillRect(-10, -4, o.w * 0.14, o.h * 0.03);
  ctx.fillRect(o.w * 0.88, -4, o.w * 0.14, o.h * 0.03);
}

export function noticeTex(key: string, o: NoticeOpts): THREE.Texture {
  return cached(`notice:${key}`, () => {
    const [c, ctx] = makeCanvas(o.w, o.h);
    drawNotice(ctx, o);
    return toTexture(c, false);
  });
}

/** Running-man pictogram drawn with paths (no emoji/glyph dependency). */
export function drawRunner(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, mirror = false): void {
  ctx.save();
  ctx.translate(x, y);
  if (mirror) ctx.scale(-1, 1);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(8, -34, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(4, -24);
  ctx.lineTo(-2, 0); // torso
  ctx.moveTo(-2, 0);
  ctx.lineTo(10, 14);
  ctx.lineTo(8, 30); // front leg
  ctx.moveTo(-2, 0);
  ctx.lineTo(-12, 14);
  ctx.lineTo(-26, 18); // back leg
  ctx.moveTo(3, -20);
  ctx.lineTo(16, -12);
  ctx.lineTo(24, -18); // front arm
  ctx.moveTo(3, -20);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-18, -2); // back arm
  ctx.stroke();
  ctx.restore();
}

export function drawArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, right: boolean, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (!right) ctx.scale(-1, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-len / 2, -len * 0.12);
  ctx.lineTo(len * 0.12, -len * 0.12);
  ctx.lineTo(len * 0.12, -len * 0.3);
  ctx.lineTo(len / 2, 0);
  ctx.lineTo(len * 0.12, len * 0.3);
  ctx.lineTo(len * 0.12, len * 0.12);
  ctx.lineTo(-len / 2, len * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function exitSignTex(): THREE.Texture {
  return cached('exit-sign', () => {
    const [c, ctx] = makeCanvas(512, 190);
    ctx.fillStyle = '#12924a';
    ctx.fillRect(0, 0, 512, 190);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(22, 22, 150, 146);
    drawRunner(ctx, 97, 100, 2.2, '#12924a');
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 88px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('비상구', 340, 100);
    return toTexture(c, false);
  });
}

export function guidanceTex(arrowRight: boolean): THREE.Texture {
  return cached(`guidance:${arrowRight}`, () => {
    const [c, ctx] = makeCanvas(256, 96);
    ctx.fillStyle = '#f0f7f1';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#12924a';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 90);
    drawRunner(ctx, arrowRight ? 70 : 186, 52, 1.1, '#12924a', !arrowRight);
    drawArrow(ctx, arrowRight ? 175 : 81, 48, 110, arrowRight, '#12924a');
    return toTexture(c, false);
  });
}

/** Wall calendar page drawn on a grid (dates computed, not typed). */
export function calendarTex(year: number, month: number, footer: string, circled: number[] = []): THREE.Texture {
  return cached(`cal:${year}-${month}:${circled.join(',')}`, () => {
    const W = 360;
    const H = 480;
    const [c, ctx] = makeCanvas(W, H);
    ctx.fillStyle = '#f3efe4';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#b3342a';
    ctx.fillRect(0, 0, W, 70);
    ctx.fillStyle = '#fff';
    ctx.font = `800 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${year}년 ${month}월`, W / 2, 36);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const cw = (W - 20) / 7;
    ctx.font = `700 22px ${FONT}`;
    days.forEach((d, i) => {
      ctx.fillStyle = i === 0 ? '#b3342a' : '#333';
      ctx.fillText(d, 10 + cw * i + cw / 2, 96);
    });
    const first = new Date(year, month - 1, 1).getDay();
    const count = new Date(year, month, 0).getDate();
    ctx.font = `600 26px ${FONT}`;
    for (let d = 1; d <= count; d++) {
      const idx = first + d - 1;
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      const x = 10 + cw * col + cw / 2;
      const y = 136 + row * 48;
      ctx.fillStyle = col === 0 ? '#b3342a' : '#222';
      ctx.fillText(String(d), x, y);
      if (circled.includes(d)) {
        ctx.strokeStyle = 'rgba(200,20,20,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y, 20, 17, 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#555';
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(footer, W / 2, H - 26);
    return toTexture(c, false);
  });
}

export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  return toTexture(c, false);
}
