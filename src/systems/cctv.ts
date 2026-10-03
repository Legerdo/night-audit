// CCTV: real render targets from fixed cameras, a degradation shader, code-rendered timestamps,
// a pose-history buffer for delayed feeds, and readback for the tablet viewer.
import * as THREE from 'three';
import { B1, floorLabel } from '../data/building';
import { makeFigure, setLayerRecursive } from '../world/figure';
import { mats } from '../world/materials';
import { monitorScreens } from '../world/lobby';
import { setScreenTexture } from '../world/screenMat';
import * as T from '../world/textures';
import type { CctvMount } from '../world/types';
import { LAYER_CCTV_ONLY } from '../world/types';
import { CAR_FLOOR_ID } from '../world/elevatorCar';
import type { World } from '../world/world';

// ---------------------------------------------------------------- post-process (shared with reference photos)

export function makePostMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      tOverlay: { value: null },
      hasOverlay: { value: 0 },
      time: { value: 0 },
      noise: { value: 0.2 },
      tint: { value: 0.75 },
      exposure: { value: 1.0 },
      mode: { value: 0 }, // 0 = CCTV, 1 = still photo
      dropout: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform sampler2D tOverlay; uniform float hasOverlay;
      uniform float time; uniform float noise; uniform float tint; uniform float exposure; uniform float mode; uniform float dropout;
      varying vec2 vUv;
      float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
      void main(){
        vec2 c = vUv - 0.5;
        vec2 uv = vUv;
        vec3 col;
        if (mode < 0.5) {
          uv = 0.5 + c * (1.0 + 0.09 * dot(c, c));
          float line = floor(uv.y * 240.0);
          float jitter = (rand(vec2(line, floor(time * 24.0))) - 0.5) * 0.004 * (0.3 + noise * 2.0);
          col = texture2D(tDiffuse, uv + vec2(jitter, 0.0)).rgb * exposure;
          col = aces(col);
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(col, vec3(l) * vec3(0.86, 1.0, 0.92), tint);
          col = pow(col, vec3(1.0 / 2.2));
          col += (rand(uv * vec2(517.0, 391.0) + fract(time)) - 0.5) * (0.07 + 0.35 * noise);
          col *= 0.93 + 0.07 * sin(uv.y * 720.0 + time * 12.0);
          col *= smoothstep(0.95, 0.35, length(c) * 1.25);
          float band = step(0.985 - noise * 0.05, rand(vec2(floor(uv.y * 40.0), floor(time * 7.0))));
          col = mix(col, vec3(rand(uv + time)), band * 0.5 * noise);
          if (dropout > 0.5) col = vec3(rand(uv * 300.0 + time) * 0.35);
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
        } else {
          col = texture2D(tDiffuse, uv).rgb * exposure;
          col = aces(col);
          col = pow(col, vec3(1.0 / 2.2));
          col *= vec3(1.03, 1.0, 0.95);
          col += (rand(uv * vec2(911.0, 677.0)) - 0.5) * 0.025;
          col *= smoothstep(1.05, 0.45, length(c) * 1.1);
        }
        if (hasOverlay > 0.5) { vec4 ov = texture2D(tOverlay, vUv); col = mix(col, ov.rgb, ov.a); }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

export class PostPass {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mat = makePostMaterial();
  constructor() {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    q.frustumCulled = false;
    this.scene.add(q);
  }
  run(renderer: THREE.WebGLRenderer, src: THREE.Texture, dst: THREE.WebGLRenderTarget, u: Partial<Record<'time' | 'noise' | 'tint' | 'exposure' | 'mode' | 'dropout', number>>, overlay: THREE.Texture | null): void {
    const un = this.mat.uniforms;
    un.tDiffuse.value = src;
    un.tOverlay.value = overlay;
    un.hasOverlay.value = overlay ? 1 : 0;
    for (const [k, v] of Object.entries(u)) un[k].value = v;
    renderer.setRenderTarget(dst);
    renderer.render(this.scene, this.cam);
  }
}

/** Read an RGBA8 render target into a 2D canvas (flipping GL's bottom-up rows). */
export function readTargetToCanvas(renderer: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget, canvas: HTMLCanvasElement): void {
  const w = rt.width;
  const h = rt.height;
  const buf = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const row = w * 4;
  for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- channels

export interface ChannelDef {
  id: string; // mount id
  ch: string; // 'CH01'
  label: string;
  floor: number; // CAR_FLOOR_ID for the car
}

export function baseChannels(): ChannelDef[] {
  const out: ChannelDef[] = [
    { id: 'b1', ch: 'CH00', label: 'B1 복도', floor: B1 },
    { id: 'lobby', ch: 'CH01', label: '1층 로비', floor: 1 },
  ];
  for (let n = 2; n <= 12; n++) out.push({ id: `corr-${n}`, ch: `CH${String(n).padStart(2, '0')}`, label: `${floorLabel(n)} 복도`, floor: n });
  out.push({ id: 'car', ch: 'CH20', label: '승강기 내부', floor: CAR_FLOOR_ID });
  return out;
}

export const CH13: ChannelDef = { id: 'corr-13', ch: 'CH13', label: '13층 복도', floor: 13 };

/** Per-channel overrides computed by the game from active anomalies and contamination. */
export interface ChannelFx {
  delaySec?: number;
  frozenStamp?: string;
  noise: number;
  dropout?: boolean;
}

interface Feed {
  raw: THREE.WebGLRenderTarget;
  out: THREE.WebGLRenderTarget;
  overlay: HTMLCanvasElement;
  overlayTex: THREE.CanvasTexture;
  channel: ChannelDef | null;
  stampKey: string;
}

function makeFeed(w: number, h: number): Feed {
  const raw = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
  const out = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
  const [overlay] = T.makeCanvas(w * 2, h * 2);
  const overlayTex = new THREE.CanvasTexture(overlay);
  return { raw, out, overlay, overlayTex, channel: null, stampKey: '' };
}

interface Pose {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export class CctvSystem {
  private renderer: THREE.WebGLRenderer;
  private world: World;
  private cam = new THREE.PerspectiveCamera(62, 4 / 3, 0.1, 60);
  private post = new PostPass();
  monitors: Feed[];
  tablet: Feed;
  /** featureless stand-in for the player, visible to CCTV cameras and mirrors only */
  body: THREE.Group;
  private history: Pose[] = [];
  private rr = 0;
  private time = 0;
  monitorChannels: (ChannelDef | null)[] = [null, null, null, null];
  tabletChannel: ChannelDef | null = null;
  fxFor: (ch: ChannelDef) => ChannelFx = () => ({ noise: 0.15 });
  stampFor: (ch: ChannelDef) => string = () => '';
  /** extra floors (e.g. 13F) whose CCTV mounts exist even when not in the base list */
  private _v = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer, world: World) {
    this.renderer = renderer;
    this.world = world;
    this.monitors = [0, 1, 2, 3].map(() => makeFeed(256, 192));
    this.tablet = makeFeed(400, 300);
    this.cam.layers.enable(LAYER_CCTV_ONLY);
    this.body = makeFigure({ coat: mats().fabricBlue, vest: true, height: 1.7 });
    setLayerRecursive(this.body, LAYER_CCTV_ONLY);
    world.scene.add(this.body);
    monitorScreens.forEach((m, i) => setScreenTexture(m, this.monitors[i].out.texture));
  }

  recordPose(t: number, x: number, y: number, z: number, yaw: number): void {
    this.history.push({ t, x, y, z, yaw });
    while (this.history.length > 2 && this.history[0].t < t - 8) this.history.shift();
    this.setBody(this.history[this.history.length - 1]);
  }

  private poseAt(t: number): Pose {
    const h = this.history;
    if (h.length === 0) return { t, x: 0, y: -100, z: 0, yaw: 0 };
    for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) return h[i];
    return h[0];
  }

  private setBody(p: Pose): void {
    this.body.position.set(p.x, p.y, p.z);
    this.body.rotation.y = p.yaw + Math.PI;
  }

  private mountFor(ch: ChannelDef): CctvMount | null {
    if (ch.floor === CAR_FLOOR_ID) {
      const m = this.world.car.inst.cctv[0];
      return { ...m, pos: m.pos.clone().setY(m.pos.y + this.world.carY), target: m.target.clone().setY(m.target.y + this.world.carY) };
    }
    const f = this.world.floors.get(ch.floor);
    return f?.cctv.find((c) => c.id === ch.id) ?? null;
  }

  private drawOverlay(feed: Feed, ch: ChannelDef, stamp: string, fx: ChannelFx): void {
    const key = `${ch.ch}|${stamp}|${fx.dropout ? 1 : 0}`;
    if (feed.stampKey === key) return;
    feed.stampKey = key;
    const c = feed.overlay;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const s = c.width / 512;
    g.font = `700 ${Math.round(26 * s)}px ${T.FONT}`;
    g.textBaseline = 'top';
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 4 * s;
    g.fillStyle = 'rgba(235,240,235,0.95)';
    g.fillText(`${ch.ch}  ${ch.label}`, 16 * s, 12 * s);
    g.font = `600 ${Math.round(24 * s)}px ${T.FONT}`;
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillText(stamp, c.width - 16 * s, c.height - 12 * s);
    g.textAlign = 'left';
    g.fillStyle = '#e03a2a';
    g.beginPath();
    g.arc(22 * s, c.height - 26 * s, 7 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(235,240,235,0.95)';
    g.fillText('REC', 36 * s, c.height - 12 * s);
    if (fx.dropout) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `800 ${Math.round(40 * s)}px ${T.FONT}`;
      g.fillText('신호 없음', c.width / 2, c.height / 2);
    }
    feed.overlayTex.needsUpdate = true;
  }

  private renderFeed(feed: Feed, ch: ChannelDef): void {
    const mount = this.mountFor(ch);
    const fx = this.fxFor(ch);
    const stamp = fx.frozenStamp ?? this.stampFor(ch);
    this.drawOverlay(feed, ch, stamp, fx);
    if (!mount) {
      this.post.run(this.renderer, feed.raw.texture, feed.out, { time: this.time, noise: 1, dropout: 1, mode: 0 }, feed.overlayTex);
      return;
    }
    const cam = this.cam;
    cam.position.copy(mount.pos);
    cam.fov = mount.fov;
    cam.aspect = feed.raw.width / feed.raw.height;
    cam.updateProjectionMatrix();
    cam.lookAt(mount.target);
    const w = this.world;
    const floor = ch.floor === CAR_FLOOR_ID ? w.floorAt(w.carY) : ch.floor;
    w.setOnlyVisible([floor]);
    w.assignLights(cam.position, [floor], true);
    w.updateFixtures();
    // player stand-in
    const live = this.history[this.history.length - 1];
    if (live) this.setBody(fx.delaySec ? this.poseAt(live.t - fx.delaySec) : live);
    const mirror = w.car.mirror;
    const mirrorVis = mirror?.visible ?? false;
    if (mirror) mirror.visible = false;
    this.renderer.setRenderTarget(feed.raw);
    this.renderer.clear();
    this.renderer.render(w.scene, cam);
    if (mirror) mirror.visible = mirrorVis;
    if (live) this.setBody(live);
    this.post.run(this.renderer, feed.raw.texture, feed.out, { time: this.time, noise: fx.noise, dropout: fx.dropout ? 1 : 0, tint: 0.75, exposure: 1.35, mode: 0 }, feed.overlayTex);
  }

  /**
   * Render a few feeds this frame (round-robin). Returns true if any render happened, in which case
   * the caller must restore visibility and lights for the main camera.
   */
  update(dt: number, monitorsActive: boolean, tabletActive: boolean): boolean {
    this.time += dt;
    const jobs: [Feed, ChannelDef][] = [];
    if (tabletActive && this.tabletChannel) jobs.push([this.tablet, this.tabletChannel]);
    if (monitorsActive) {
      for (let i = 0; i < 4; i++) {
        const ch = this.monitorChannels[i];
        if (ch) jobs.push([this.monitors[i], ch]);
      }
    }
    if (jobs.length === 0) return false;
    // tablet at ~10 fps, monitors share the rest: at most 2 renders per frame
    const budget = Math.min(2, jobs.length);
    for (let k = 0; k < budget; k++) {
      const [feed, ch] = jobs[(this.rr + k) % jobs.length];
      this.renderFeed(feed, ch);
    }
    this.rr = (this.rr + budget) % Math.max(1, jobs.length);
    this.renderer.setRenderTarget(null);
    this.world.restoreVisibility();
    return true;
  }

  readTablet(canvas: HTMLCanvasElement): void {
    readTargetToCanvas(this.renderer, this.tablet.out, canvas);
  }

  /** Immediately render one channel into the tablet feed (used when switching channels). */
  renderTabletNow(): void {
    if (!this.tabletChannel) return;
    this.renderFeed(this.tablet, this.tabletChannel);
    this.renderer.setRenderTarget(null);
    this.world.restoreVisibility();
  }

  dispose(): void {
    for (const f of [...this.monitors, this.tablet]) {
      f.raw.dispose();
      f.out.dispose();
      f.overlayTex.dispose();
    }
    this.world.scene.remove(this.body);
    void this._v;
  }
}
