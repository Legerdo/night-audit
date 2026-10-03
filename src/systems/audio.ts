// Fully synthesised WebAudio: room tone, footsteps, elevator, doors, intercom, spatial events and stingers.
// No audio files are shipped; every sound is generated from oscillators and noise so the build stays offline and small.
import * as THREE from 'three';

export type RoomTone = 'corridor' | 'lobby' | 'b1' | 'stair' | 'car' | 'f13' | 'unit' | 'silent';
export type Surface = 'tile' | 'stone' | 'stair' | 'car' | 'epoxy' | 'old' | string;

export interface LoopHandle {
  setGain(v: number, ramp?: number): void;
  setPos(p: THREE.Vector3): void;
  stop(): void;
}

const TONE_LEVEL: Record<RoomTone, { noise: number; hum: number; lp: number; humHz: number }> = {
  corridor: { noise: 0.022, hum: 0.011, lp: 520, humHz: 120 },
  lobby: { noise: 0.028, hum: 0.008, lp: 700, humHz: 120 },
  b1: { noise: 0.05, hum: 0.02, lp: 260, humHz: 60 },
  stair: { noise: 0.016, hum: 0.0, lp: 380, humHz: 120 },
  car: { noise: 0.03, hum: 0.014, lp: 300, humHz: 100 },
  f13: { noise: 0.012, hum: 0.004, lp: 300, humHz: 60 },
  unit: { noise: 0.01, hum: 0.0, lp: 300, humHz: 60 },
  silent: { noise: 0, hum: 0, lp: 300, humHz: 60 },
};

export class AudioSys {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private toneNoise!: GainNode;
  private toneHum!: GainNode;
  private toneLP!: BiquadFilterNode;
  private humOsc!: OscillatorNode;
  private noiseBuf!: AudioBuffer;
  private volume = 0.8;
  private duck = 1;
  /** true while an AUDIO anomaly wants the world to be silent (also mutes own footsteps) */
  silence = false;
  private lastSting = -1e9;
  stingCount = 0;
  private listenerPos = new THREE.Vector3();

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    // 2 s of white noise reused everywhere
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      d[i] = (seed / 4294967296) * 2 - 1;
    }
    // room tone: looping lowpassed noise + mains hum
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    this.toneLP = ctx.createBiquadFilter();
    this.toneLP.type = 'lowpass';
    this.toneLP.frequency.value = 500;
    this.toneNoise = ctx.createGain();
    this.toneNoise.gain.value = 0;
    src.connect(this.toneLP).connect(this.toneNoise).connect(this.master);
    src.start();
    this.humOsc = ctx.createOscillator();
    this.humOsc.type = 'sine';
    this.humOsc.frequency.value = 120;
    const humOsc2 = ctx.createOscillator();
    humOsc2.type = 'sine';
    humOsc2.frequency.value = 240;
    const h2 = ctx.createGain();
    h2.gain.value = 0.35;
    this.toneHum = ctx.createGain();
    this.toneHum.gain.value = 0;
    this.humOsc.connect(this.toneHum);
    humOsc2.connect(h2).connect(this.toneHum);
    this.toneHum.connect(this.master);
    this.humOsc.start();
    humOsc2.start();
    const l = ctx.listener;
    if (l.positionX) {
      l.positionX.value = 0;
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * this.duck, this.ctx.currentTime, 0.05);
  }

  /** Temporarily lower everything (tablet open, menus). */
  setDuck(d: number): void {
    this.duck = d;
    this.setVolume(this.volume);
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setRoomTone(kind: RoomTone, level = 1): void {
    if (!this.ctx) return;
    const t = TONE_LEVEL[this.silence ? 'silent' : kind];
    const c = this.ctx.currentTime;
    this.toneNoise.gain.setTargetAtTime(t.noise * level, c, 0.4);
    this.toneHum.gain.setTargetAtTime(t.hum * level, c, 0.4);
    this.toneLP.frequency.setTargetAtTime(t.lp, c, 0.4);
    this.humOsc.frequency.setTargetAtTime(t.humHz, c, 0.4);
  }

  setListener(pos: THREE.Vector3, forward: THREE.Vector3): void {
    if (!this.ctx) return;
    this.listenerPos.copy(pos);
    const l = this.ctx.listener;
    const c = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, c, 0.02);
      l.positionY.setTargetAtTime(pos.y, c, 0.02);
      l.positionZ.setTargetAtTime(pos.z, c, 0.02);
      l.forwardX.setTargetAtTime(forward.x, c, 0.02);
      l.forwardY.setTargetAtTime(forward.y, c, 0.02);
      l.forwardZ.setTargetAtTime(forward.z, c, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      (l as any).setPosition(pos.x, pos.y, pos.z);
      (l as any).setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  private out(pos?: THREE.Vector3, refDistance = 1.5): AudioNode {
    const ctx = this.ctx!;
    if (!pos) return this.sfx;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = refDistance;
    p.rolloffFactor = 1.3;
    p.maxDistance = 60;
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
    } else (p as any).setPosition(pos.x, pos.y, pos.z);
    p.connect(this.sfx);
    return p;
  }

  private noise(dest: AudioNode, t0: number, dur: number, gain: number, filter: { type: BiquadFilterType; f: number; q?: number }, attack = 0.004, offset = 0): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bf = ctx.createBiquadFilter();
    bf.type = filter.type;
    bf.frequency.value = filter.f;
    bf.Q.value = filter.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bf).connect(g).connect(dest);
    src.start(t0, offset % 1.5);
    src.stop(t0 + dur + 0.05);
  }

  private tone(dest: AudioNode, t0: number, f: number, dur: number, gain: number, type: OscillatorType = 'sine', attack = 0.01, f1?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  footstep(surface: Surface, pos?: THREE.Vector3, gain = 1): void {
    if (!this.ctx || (this.silence && !pos)) return;
    const t = this.ctx.currentTime;
    const dest = this.out(pos, 1.2);
    const v = 0.9 + Math.random() * 0.2;
    const f: Record<string, number> = { tile: 1500, stone: 1900, stair: 900, car: 700, epoxy: 1200, old: 800 };
    const base = f[surface] ?? 1300;
    this.noise(dest, t, 0.09, 0.16 * gain * v, { type: 'bandpass', f: base * v, q: 1.4 }, 0.003, Math.random() * 1.5);
    this.noise(dest, t, 0.05, 0.12 * gain, { type: 'lowpass', f: 260 }, 0.002, Math.random() * 1.5);
    if (surface === 'stair' || surface === 'car') this.tone(dest, t, 90, 0.08, 0.05 * gain, 'sine');
  }

  play(name: string, pos?: THREE.Vector3, gain = 1): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.out(pos, name === 'slam' ? 3 : 1.5);
    switch (name) {
      case 'ding': {
        this.tone(d, t, 1318.5, 1.4, 0.16 * gain, 'sine', 0.005);
        this.tone(d, t + 0.45, 1046.5, 1.6, 0.14 * gain, 'sine', 0.005);
        break;
      }
      case 'button':
        this.tone(d, t, 1800, 0.05, 0.08 * gain, 'square', 0.002);
        break;
      case 'liftDoor':
        this.noise(d, t, 1.4, 0.07 * gain, { type: 'bandpass', f: 380, q: 0.8 }, 0.25);
        this.tone(d, t, 80, 1.2, 0.05 * gain, 'sawtooth', 0.2);
        break;
      case 'doorOpen':
        this.noise(d, t, 0.25, 0.2 * gain, { type: 'bandpass', f: 600, q: 2 }, 0.005);
        this.tone(d, t + 0.05, 220, 0.5, 0.03 * gain, 'triangle', 0.1, 180);
        break;
      case 'doorClose':
        this.noise(d, t, 0.3, 0.35 * gain, { type: 'lowpass', f: 300 }, 0.003);
        this.tone(d, t, 70, 0.3, 0.2 * gain, 'sine', 0.003);
        break;
      case 'fireDoor':
        this.noise(d, t, 0.6, 0.35 * gain, { type: 'lowpass', f: 380 }, 0.003);
        this.tone(d, t, 55, 0.6, 0.3 * gain, 'sine', 0.003);
        this.noise(d, t + 0.02, 0.2, 0.12 * gain, { type: 'bandpass', f: 2400, q: 3 }, 0.002);
        break;
      case 'slam':
        this.noise(d, t, 0.9, 1.0 * gain, { type: 'lowpass', f: 500 }, 0.002);
        this.tone(d, t, 48, 0.9, 0.7 * gain, 'sine', 0.002);
        this.noise(d, t, 0.25, 0.4 * gain, { type: 'bandpass', f: 1800, q: 2 }, 0.001);
        break;
      case 'locked':
        this.noise(d, t, 0.08, 0.25 * gain, { type: 'bandpass', f: 1400, q: 4 }, 0.002);
        this.noise(d, t + 0.1, 0.08, 0.2 * gain, { type: 'bandpass', f: 1200, q: 4 }, 0.002);
        break;
      case 'doorbell':
        this.tone(d, t, 659, 0.9, 0.12 * gain, 'triangle', 0.005);
        this.tone(d, t + 0.35, 523, 1.2, 0.12 * gain, 'triangle', 0.005);
        break;
      case 'knock':
        for (let i = 0; i < 3; i++) this.noise(d, t + i * 0.22, 0.12, 0.45 * gain, { type: 'lowpass', f: 420 }, 0.002);
        break;
      case 'ring': {
        for (let i = 0; i < 3; i++) {
          this.tone(d, t + i * 0.5, 880, 0.18, 0.1 * gain, 'square', 0.005);
          this.tone(d, t + i * 0.5 + 0.2, 740, 0.18, 0.1 * gain, 'square', 0.005);
        }
        break;
      }
      case 'tabletOpen':
        this.tone(d, t, 660, 0.12, 0.05 * gain, 'sine');
        this.tone(d, t + 0.07, 990, 0.14, 0.05 * gain, 'sine');
        break;
      case 'tabletClose':
        this.tone(d, t, 880, 0.1, 0.04 * gain, 'sine');
        this.tone(d, t + 0.06, 587, 0.14, 0.04 * gain, 'sine');
        break;
      case 'click':
        this.tone(d, t, 2400, 0.03, 0.04 * gain, 'square', 0.001);
        break;
      case 'notify':
        this.tone(d, t, 784, 0.25, 0.07 * gain, 'sine');
        this.tone(d, t + 0.14, 1175, 0.35, 0.07 * gain, 'sine');
        break;
      case 'report':
        this.tone(d, t, 523, 0.2, 0.06 * gain, 'triangle');
        this.tone(d, t + 0.1, 784, 0.3, 0.06 * gain, 'triangle');
        break;
      case 'shutter':
        this.noise(d, t, 0.06, 0.3 * gain, { type: 'highpass', f: 2500 }, 0.001);
        this.noise(d, t + 0.08, 0.08, 0.25 * gain, { type: 'highpass', f: 1800 }, 0.001);
        break;
      case 'paper':
        this.noise(d, t, 0.35, 0.12 * gain, { type: 'highpass', f: 3000 }, 0.05);
        this.noise(d, t + 0.2, 0.25, 0.09 * gain, { type: 'highpass', f: 2600 }, 0.04);
        break;
      case 'switch':
        this.noise(d, t, 0.03, 0.3 * gain, { type: 'bandpass', f: 3000, q: 3 }, 0.001);
        break;
      case 'glitch':
        this.noise(d, t, 0.25, 0.1 * gain, { type: 'bandpass', f: 4000, q: 0.5 }, 0.002);
        this.tone(d, t, 60, 0.25, 0.08 * gain, 'square', 0.002);
        break;
      case 'breath':
        this.noise(d, t, 1.6, 0.05 * gain, { type: 'bandpass', f: 700, q: 0.7 }, 0.6);
        break;
      case 'thud':
        this.noise(d, t, 0.4, 0.4 * gain, { type: 'lowpass', f: 180 }, 0.002);
        break;
      case 'arrive':
        this.tone(d, t, 110, 1.8, 0.08 * gain, 'sine', 0.4, 90);
        break;
      default:
        break;
    }
  }

  /** Horror stinger. Globally rate-limited so scares stay rare (target 3–5 per run). */
  sting(kind: 'low' | 'sharp' = 'low', force = false): boolean {
    if (!this.ctx) return false;
    const t = this.ctx.currentTime;
    if (!force && t - this.lastSting < 60) return false;
    this.lastSting = t;
    this.stingCount++;
    const d = this.sfx;
    if (kind === 'sharp') {
      for (const f of [466, 494, 523, 554]) this.tone(d, t, f, 1.6, 0.06, 'sawtooth', 0.01);
      this.noise(d, t, 0.8, 0.35, { type: 'highpass', f: 1500 }, 0.005);
      this.tone(d, t, 41, 2.2, 0.5, 'sine', 0.005);
    } else {
      this.tone(d, t, 36, 3.5, 0.55, 'sine', 0.05);
      for (const f of [110, 116.5, 155]) this.tone(d, t, f, 3.0, 0.05, 'triangle', 0.6);
      this.noise(d, t, 2.5, 0.08, { type: 'lowpass', f: 200 }, 0.4);
    }
    return true;
  }

  /** Continuous sound source (TV murmur, motor hum, static). */
  loop(kind: 'murmur' | 'motor' | 'static' | 'tv', pos?: THREE.Vector3, gain = 1): LoopHandle {
    const noop: LoopHandle = { setGain() {}, setPos() {}, stop() {} };
    if (!this.ctx) return noop;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    let panner: PannerNode | null = null;
    if (pos) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1.2;
      panner.rolloffFactor = 1.6;
      if (panner.positionX) {
        panner.positionX.value = pos.x;
        panner.positionY.value = pos.y;
        panner.positionZ.value = pos.z;
      }
      out.connect(panner).connect(this.sfx);
    } else out.connect(this.sfx);
    const nodes: AudioScheduledSourceNode[] = [];
    let timer: number | null = null;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    nodes.push(src);
    if (kind === 'motor') {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      const ng = ctx.createGain();
      ng.gain.value = 0.35;
      src.connect(lp).connect(ng).connect(out);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 52;
      const og = ctx.createGain();
      og.gain.value = 0.05;
      const olp = ctx.createBiquadFilter();
      olp.type = 'lowpass';
      olp.frequency.value = 240;
      o.connect(olp).connect(og).connect(out);
      o.start();
      nodes.push(o);
    } else if (kind === 'static') {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 0.4;
      src.connect(bp).connect(out);
    } else {
      // murmur / tv: band-limited noise with syllable-rate amplitude modulation (muffled speech through a door)
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = kind === 'tv' ? 900 : 520;
      bp.Q.value = 1.2;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = kind === 'tv' ? 1800 : 900;
      const am = ctx.createGain();
      am.gain.value = 0;
      src.connect(bp).connect(lp).connect(am).connect(out);
      const tick = () => {
        const t = ctx.currentTime;
        // a phrase of 3–9 syllables, then a pause
        let tt = t;
        const n = 3 + Math.floor(Math.random() * 7);
        for (let i = 0; i < n; i++) {
          const dur = 0.09 + Math.random() * 0.16;
          am.gain.setTargetAtTime(0.5 + Math.random() * 0.5, tt, 0.02);
          am.gain.setTargetAtTime(0.05, tt + dur, 0.03);
          bp.frequency.setTargetAtTime((kind === 'tv' ? 700 : 420) + Math.random() * 400, tt, 0.03);
          tt += dur + 0.04 + Math.random() * 0.06;
        }
        timer = window.setTimeout(tick, (tt - t) * 1000 + 250 + Math.random() * 900);
      };
      tick();
    }
    src.start();
    return {
      setGain: (v: number, ramp = 0.3) => out.gain.setTargetAtTime(v * gain, ctx.currentTime, ramp),
      setPos: (p: THREE.Vector3) => {
        if (panner?.positionX) {
          panner.positionX.value = p.x;
          panner.positionY.value = p.y;
          panner.positionZ.value = p.z;
        }
      },
      stop: () => {
        if (timer !== null) clearTimeout(timer);
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        for (const n of nodes) n.stop(ctx.currentTime + 0.5);
      },
    };
  }
}

export const audio = new AudioSys();
