// Runtime anomaly behaviours (things that react to the player rather than being baked into geometry)
// plus ambient contamination effects. Physical anomalies are handled by the floor builders.
import * as THREE from 'three';
import { FLOOR_H, FLOOR_PROPS, SPINE, UNIT_SLOTS, floorY } from '../data/building';
import { audio, type LoopHandle } from '../systems/audio';
import { makeFigure, setLayerRecursive } from '../world/figure';
import { mats } from '../world/materials';
import { LAYER_CCTV_ONLY } from '../world/types';
import type { World } from '../world/world';
import type { Player } from '../player/player';
import type { Elevator } from './elevator';
import type { Director } from './director';
import type { ChannelDef, ChannelFx } from '../systems/cctv';
import { CAR_FLOOR_ID } from '../world/elevatorCar';

export interface RuntimeCtx {
  world: World;
  player: Player;
  elevator: Elevator;
  director: Director;
  inCar: boolean;
  floor: number;
  onScare: (kind: string) => void;
  flash: (sec: number) => void;
}

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();

export class RuntimeAnomalies {
  private vanished = new Set<string>();
  private followQueue: { t: number; surface: string }[] = [];
  private t = 0;
  private ghostCooldown = 0;
  private murmur: LoopHandle | null = null;
  private murmurKey = '';
  private murmurMuteUntil = 0;
  private stepsAboveAcc = 0;
  private stepsAboveN = 0;
  private lastLanding: number | null = null;
  private mirrorSeen = false;
  private tvLoop: LoopHandle | null = null;
  private phantomAcc = 0;
  private ch13Figure: THREE.Group | null = null;
  seen13 = false;
  loops = 0;

  /** Reset per-instance memory when an anomaly is reported/cleared. */
  clear(id: string): void {
    for (const k of [...this.vanished]) if (k.startsWith(id)) this.vanished.delete(k);
    if (id === 'hum_mirror_figure') this.mirrorSeen = false;
  }

  onPlayerStep(surface: string, ctx: RuntimeCtx): void {
    const f = ctx.director.activeFloor('aud_follow_steps');
    if (f !== null && ctx.floor === f && !ctx.inCar && ctx.player.pos.x < 12) this.followQueue.push({ t: this.t + 0.38, surface });
  }

  onDoorbell(unit: string, ctx: RuntimeCtx): string | null {
    const f = ctx.director.activeFloor('aud_voice_vacant');
    if (f !== null && unit === this.vacantUnit(f)) {
      this.murmurMuteUntil = this.t + 7;
      return '딩동. 텔레비전 소리가 뚝 끊긴다. 문 너머에서 누군가 숨을 참는 기척이 있다.';
    }
    return null;
  }

  private vacantUnit(f: number): string {
    const idx = FLOOR_PROPS[f]?.vacantTape[0] ?? 1;
    return `${f}${String(idx).padStart(2, '0')}`;
  }

  /** CCTV per-channel effects from active anomalies and contamination. */
  cctvFx(ch: ChannelDef, d: Director, t: number): ChannelFx {
    const c = d.s.contamination;
    const rel = d.rel();
    const fx: ChannelFx = { noise: 0.12 + (c / 100) * 0.6 };
    if (!rel.cctvReliable) {
      fx.noise += 0.25;
      // deterministic dropouts: a short loss of signal every ~23 s per channel
      const phase = (t + ch.ch.charCodeAt(3) * 3.1) % 23;
      if (phase < 1.1) fx.dropout = true;
    }
    if (ch.floor === d.activeFloor('tmp_cctv_delay') && ch.id.startsWith('corr-')) fx.delaySec = 4;
    if (ch.floor === d.activeFloor('tmp_cctv_timestamp') && ch.id.startsWith('corr-')) fx.frozenStamp = '1994-11-02  01:13:00';
    if (ch.floor === CAR_FLOOR_ID) fx.noise += 0.05;
    return fx;
  }

  update(dt: number, ctx: RuntimeCtx): void {
    this.t += dt;
    const { world, player, director: d } = ctx;
    const p = player.pos;
    const onCorr = !ctx.inCar && p.x <= 12.05 && p.x >= SPINE.x0 - 7;

    // --- silence
    const silF = d.activeFloor('aud_room_silence');
    audio.silence = silF !== null && ctx.floor === silF && !ctx.inCar && p.x < 12.05;

    // --- follow steps
    while (this.followQueue.length && this.followQueue[0].t <= this.t) {
      const s = this.followQueue.shift()!;
      player.forward(_f);
      _v.set(p.x - _f.x * 3.2, p.y + 0.1, p.z - _f.z * 3.2);
      audio.footstep(s.surface, _v, 0.9);
    }

    // --- window figure: vanishes (with a light cut) when approached
    const winF = d.activeFloor('hum_window_figure');
    if (winF !== null) {
      const fl = world.floors.get(winF);
      const fig = fl?.named.get('windowFigure');
      const key = `hum_window_figure@${winF}`;
      if (fig) {
        if (this.vanished.has(key)) fig.visible = false;
        else if (ctx.floor === winF && onCorr && p.x - fig.position.x < 7) {
          this.vanished.add(key);
          ctx.flash(0.35);
          window.setTimeout(() => (fig.visible = false), 120);
          audio.play('breath', _v.set(fig.position.x, fig.position.y + 1.5, fig.position.z), 1.2);
          ctx.onScare('window');
        }
      }
    }

    // --- ajar door: slams shut when approached
    const ajF = d.activeFloor('hum_door_ajar_watch');
    if (ajF !== null) {
      const fl = world.floors.get(ajF);
      const door = fl?.doors.get('ajar');
      const fig = fl?.named.get('ajarFigure');
      const key = `hum_door_ajar_watch@${ajF}`;
      if (door && fig) {
        if (this.vanished.has(key)) {
          door.target = 0;
          fig.visible = false;
        } else if (ctx.floor === ajF && onCorr && Math.hypot(p.x - door.center.x, p.z - door.center.z) < 3.1) {
          this.vanished.add(key);
          door.target = 0;
          door.open = 0.02;
          fig.visible = false;
          audio.play('slam', door.center, 1.2);
          if (audio.sting('sharp', true)) ctx.onScare('slam');
          player.shake = 0.8;
        }
      }
    }

    // --- uncalled elevator
    this.ghostCooldown = Math.max(0, this.ghostCooldown - dt);
    const ghF = d.activeFloor('aud_elevator_uncalled');
    if (ghF !== null && ctx.floor === ghF && onCorr && Math.abs(p.x) < 7 && !ctx.elevator.busy && ctx.elevator.floor !== ghF && this.ghostCooldown === 0) {
      this.ghostCooldown = 75;
      ctx.elevator.call(ghF, 'ghost');
    }

    // --- voices behind a vacant door
    const vvF = d.activeFloor('aud_voice_vacant');
    const want = vvF !== null && ctx.floor === vvF && !ctx.inCar ? this.vacantUnit(vvF) : '';
    if (want !== this.murmurKey) {
      this.murmur?.stop();
      this.murmur = null;
      this.murmurKey = want;
      if (want) {
        const idx = Number(want.slice(-2));
        const slot = UNIT_SLOTS.find((s) => s.idx === idx)!;
        const wallZ = slot.side === -1 ? SPINE.z0 - 0.4 : SPINE.z1 + 0.4;
        this.murmur = audio.loop('tv', new THREE.Vector3(slot.x, floorY(vvF!) + 1.3, wallZ), 0.5);
      }
    }
    this.murmur?.setGain(this.t < this.murmurMuteUntil ? 0 : 1, 0.15);

    // --- mirror figure (visible only in the mirror)
    const mirrorOn = d.isActive('hum_mirror_figure');
    world.car.mirrorFigure.visible = mirrorOn;
    if (mirrorOn && ctx.inCar && !this.mirrorSeen) {
      player.forward(_f);
      if (_f.z < -0.75) {
        this.mirrorSeen = true;
        window.setTimeout(() => {
          if (audio.sting('low')) ctx.onScare('mirror');
        }, 900);
      }
    }
    // --- elevator advert
    world.car.setAd(d.isActive('img_elevator_ad_figure'));

    // --- stair loop: walking down from F lands on F again
    const loopF = d.activeFloor('geo_stair_loop');
    if (p.x > 12.05 && p.x < 14 && !ctx.inCar) {
      const n = world.floorAt(p.y);
      if (Math.abs(p.y - floorY(n)) < 0.25) {
        if (loopF !== null && n === loopF - 1 && this.lastLanding === loopF) {
          player.shiftY(FLOOR_H);
          this.loops++;
        } else this.lastLanding = n;
      }
    } else if (p.x < 12) this.lastLanding = null;

    // --- footsteps above the top floor
    if (d.isActive('aud_steps_above') && ctx.floor === 12 && p.x > 12.05) {
      this.stepsAboveAcc += dt;
      if (this.stepsAboveAcc > 0.95) {
        this.stepsAboveAcc = 0;
        this.stepsAboveN++;
        if (this.stepsAboveN % 14 < 9) audio.footstep('stair', _v.set(15.2 + Math.sin(this.stepsAboveN * 0.7), floorY(13) + 0.2, 0.8), 1.4);
      }
    }

    // --- 13F: CCTV-only figure by 1308 while the new channel is live
    const want13 = d.isActive('sys_cctv_13') && !!d.s.flags.f13Open;
    const f13 = world.floors.get(13);
    if (want13 && f13) {
      if (!this.ch13Figure || this.ch13Figure.parent !== f13.group) {
        this.ch13Figure = makeFigure({ coat: mats().fabricBlue, vest: true });
        this.ch13Figure.position.set(4.6 + 0.9, floorY(13), 0.55);
        this.ch13Figure.rotation.y = Math.PI / 2;
        setLayerRecursive(this.ch13Figure, LAYER_CCTV_ONLY);
        f13.group.add(this.ch13Figure);
      }
    } else if (this.ch13Figure) {
      this.ch13Figure.parent?.remove(this.ch13Figure);
      this.ch13Figure = null;
    }
    // TV static from 1301 while on 13F
    const on13 = ctx.floor === 13 && !!d.s.flags.f13Open && p.x < 12.05;
    if (on13 && !this.tvLoop) this.tvLoop = audio.loop('static', new THREE.Vector3(-8.26, floorY(13) + 0.8, -3.25), 0.5);
    if (this.tvLoop) this.tvLoop.setGain(on13 ? 1 : 0, 0.5);
    if (on13 && !this.seen13) {
      this.seen13 = true;
      ctx.flash(0.2);
      if (audio.sting('low', true)) ctx.onScare('13f');
    }

    // --- contamination ambience (Tier C perception gets noisy)
    const c = d.s.contamination;
    world.globalGain = c >= 60 ? 0.82 + 0.06 * Math.sin(this.t * 0.7) : 1;
    if (!d.rel().audioStable) {
      this.phantomAcc += dt;
      if (this.phantomAcc > 150 - Math.min(90, c)) {
        this.phantomAcc = 0;
        player.forward(_f);
        audio.play('knock', _v.set(p.x - _f.x * 6, p.y + 1.2, p.z - _f.z * 6), 0.5);
      }
    }
  }
}
