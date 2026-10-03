// Game: renderer + loop + mode state machine; wires world, player, elevator, director, CCTV, audio and UI.
import * as THREE from 'three';
import { Input } from '../core/input';
import { loadSettings, saveSettings, type Settings } from '../core/settings';
import { makeSeed } from '../core/rng';
import { anomaly } from '../data/anomalies';
import { B1, FLOOR_13, floorLabel, floorY, residentByUnit, isUnitVacant } from '../data/building';
import { getImage, type ImageKey } from '../data/imageAssets';
import { LOCATIONS, inLocation } from '../data/locations';
import { ARCHIVE_RECORDS } from '../data/records';
import { INTERCOM_ANSWERS, type VoiceLine } from '../data/story';
import type { Category, Incident, Judgment } from '../data/types';
import { Player } from '../player/player';
import { audio, type RoomTone } from '../systems/audio';
import { CctvSystem, baseChannels, CH13, type ChannelDef } from '../systems/cctv';
import { ReferenceRenderer } from '../systems/reference';
import { clearSave, hasSave, loadSave, writeSave } from '../systems/save';
import { Hud } from '../ui/hud';
import { Screens } from '../ui/menus';
import { Tablet, type TabId, type TabletHost } from '../ui/tablet';
import { BREAKERS_BASE } from '../world/basement';
import { gameClock } from '../world/clock';
import { missingPosterCanvas } from '../world/lobby';
import type { Interactable } from '../world/types';
import { World } from '../world/world';
import { Director, type ReportResult } from './director';
import { Elevator } from './elevator';
import { RuntimeAnomalies, type RuntimeCtx } from './runtime';
import { fmtClock, newGameState, type GameState } from './state';

type Mode = 'title' | 'play' | 'paused' | 'tablet' | 'inspect' | 'lift' | 'ending' | 'photo';

const SPAWN = { x: -7.4, z: -3.0, yaw: 0.35 };

export class Game implements TabletHost {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  input: Input;
  settings: Settings;
  world!: World;
  player: Player;
  elevator!: Elevator;
  director!: Director;
  cctv!: CctvSystem;
  refs: ReferenceRenderer;
  runtime = new RuntimeAnomalies();
  hud: Hud;
  screens: Screens;
  tablet: Tablet;
  mode: Mode = 'title';
  private raycaster = new THREE.Raycaster();
  private focus: Interactable | null = null;
  private flashlightOn = false;
  private last = performance.now();
  private photoPending = false;
  readonly ui: HTMLElement;
  private started = false;
  private pFloor = 1;
  private inCar = false;
  private _v = new THREE.Vector3();
  private _d = new THREE.Vector3();
  private settingsReturn: (() => void) | null = null;
  fps = 60;
  frame = 0;
  /** QA/debug: frames rendered since start (for automated checks) */
  onEnding: ((id: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.ui = ui;
    this.settings = loadSettings();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05 * this.settings.brightness;
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.1, 80); // near 0.1 (< player radius 0.28): 2x depth precision vs 0.05
    this.input = new Input(canvas);
    this.player = new Player(this.camera);
    this.refs = new ReferenceRenderer(this.renderer);
    this.hud = new Hud(ui);
    this.tablet = new Tablet(ui, this);
    this.screens = new Screens(ui);
    this.hud.setSubtitleScale(this.settings.subtitleScale);
    window.addEventListener('resize', () => this.resize());
    this.input.onLockChange = (locked) => {
      if (!locked && this.mode === 'play') this.pause();
    };
    canvas.addEventListener('click', () => {
      audio.unlock();
      if (this.mode === 'play' && !this.input.locked) this.input.requestLock();
    });
    this.player.onStep = (surface) => {
      if (!audio.silence) audio.footstep(surface);
      this.runtime.onPlayerStep(surface, this.rtCtx());
    };
    requestAnimationFrame(this.loop);
  }

  // ================================================================== lifecycle

  showTitle(progress?: (p: number, l: string) => void): ReturnType<Screens['title']> {
    this.mode = 'title';
    this.hud.show(false);
    this.tablet.hide();
    this.input.releaseLock();
    audio.setRoomTone('silent');
    const t = this.screens.title({
      hasSave: hasSave(),
      onNew: () => {
        audio.unlock();
        audio.play('click');
        this.screens.briefing(makeSeed(), (seed) => this.startNew(seed), () => this.showTitle().ready());
      },
      onContinue: () => {
        audio.unlock();
        const s = loadSave();
        if (s) this.startWith(s, false);
      },
      onSettings: () => this.openSettings(() => this.showTitle().ready()),
      onControls: () => this.screens.controls(() => this.showTitle().ready()),
    });
    void progress;
    return t;
  }

  startNew(seed: string): void {
    clearSave();
    this.startWith(newGameState(seed), true);
  }

  startWith(s: GameState, fresh: boolean): void {
    audio.unlock();
    this.screens.close();
    this.teardown();
    this.director = new Director(s, {
      message: (from, text, important) => this.message(from, text, important),
      incident: (inc) => this.onIncident(inc),
      voice: (lines, ring) => this.voice(lines, ring),
      act: (act) => this.onAct(act),
      worldChanged: (floors) => this.rebuild(floors),
      checkpoint: () => this.checkpoint(),
      final: () => audio.play('notify'),
      unlockEntrance: () => {
        audio.play('locked', new THREE.Vector3(0, floorY(1) + 1.2, 3.6));
        this.message('시스템', '06:00 — 1층 출입문 잠금이 해제되었습니다. 교대 근무자가 도착했습니다.', true);
      },
    });
    this.world = new World();
    this.world.init(this.director.worldFlags(), this.director.modsByFloor());
    this.world.onDoorAutoClose = (d) => audio.play(d.kind === 'fire' ? 'fireDoor' : 'doorClose', d.center, 0.8);
    this.elevator = new Elevator(this.world);
    this.elevator.allow13 = !!s.flags.f13Open;
    this.elevator.place(1);
    this.elevator.onTrip = (from, to, src) => {
      if (src === 'debug') return;
      this.director.s.elevatorLog.push({ time: Math.floor(this.director.s.clock), from, to, note: src === 'hall' ? `${lblFloor(to)}층 호출` : '차내 버튼' });
    };
    this.cctv = new CctvSystem(this.renderer, this.world);
    this.cctv.fxFor = (ch) => this.runtime.cctvFx(ch, this.director, this.world.time);
    this.cctv.stampFor = () => `2026-09-30  ${fmtClock(this.director.s.clock)}:${String(Math.floor((this.director.s.clock % 1) * 60)).padStart(2, '0')}`;
    const mirror = this.world.car.mirror;
    if (mirror) World.configureMirrorCamera(mirror.getReflectionCamera(this.camera));
    this.refs.clear();
    this.runtime = new RuntimeAnomalies();
    this.player.teleport(SPAWN.x, floorY(1), SPAWN.z, SPAWN.yaw);
    this.flashlightOn = false;
    this.started = true;
    this.hud.show(true);
    this.mode = 'play';
    this.input.gameplayEnabled = true;
    this.input.requestLock();
    this.applySettings();
    if (fresh) {
      this.director.begin();
      this.checkpoint();
    } else {
      this.message('시스템', `근무 일지에서 이어갑니다. (${fmtClock(s.clock)})`, true);
      this.world.car.setAd(this.director.isActive('img_elevator_ad_figure'));
    }
    this.hud.centerNote(fresh ? '관리실 · 00:00 — 첫 신고를 기다리는 중' : '관리실 · 체크포인트', 3200);
  }

  private teardown(): void {
    if (!this.started) return;
    this.cctv?.dispose();
    this.elevator?.stopMotor();
    this.world.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
    this.started = false;
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  applySettings(): void {
    const s = this.settings;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.toneMappingExposure = 1.05 * s.brightness;
    audio.setVolume(s.masterVolume);
    this.hud.setSubtitleScale(s.subtitleScale);
  }

  openSettings(back: () => void): void {
    this.settingsReturn = back;
    this.screens.settings(
      this.settings,
      (s) => {
        this.settings = s;
        saveSettings(s);
        this.applySettings();
      },
      () => this.settingsReturn?.(),
    );
  }

  // ================================================================== modes

  pause(): void {
    if (this.mode !== 'play') return;
    this.mode = 'paused';
    this.input.gameplayEnabled = false;
    audio.setDuck(0.35);
    this.hud.setPrompt(null);
    this.screens.pause({
      onResume: () => this.resume(),
      onSettings: () => this.openSettings(() => this.showPauseAgain()),
      onControls: () => this.screens.controls(() => this.showPauseAgain()),
      onTitle: () => {
        this.screens.close();
        this.teardown();
        this.showTitle().ready();
      },
      seed: this.director.s.seed,
      clock: fmtClock(this.director.s.clock),
    });
  }

  private showPauseAgain(): void {
    this.mode = 'play';
    this.pause();
  }

  resume(): void {
    this.screens.close();
    this.mode = 'play';
    this.input.gameplayEnabled = true;
    audio.setDuck(1);
    this.input.requestLock();
    window.setTimeout(() => {
      if (this.mode === 'play' && !this.input.locked) this.hud.centerNote('화면을 클릭하면 마우스 시점 조작이 다시 켜집니다.', 4000);
    }, 400);
  }

  openTablet(tab?: TabId): void {
    if (this.mode !== 'play' && this.mode !== 'photo') return;
    this.mode = 'tablet';
    this.input.gameplayEnabled = false;
    this.input.releaseLock();
    this.hud.setPrompt(null);
    audio.play('tabletOpen');
    audio.setDuck(0.7);
    this.tablet.show(tab);
  }

  close(): void {
    if (this.mode === 'tablet') {
      this.tablet.hide();
      audio.play('tabletClose');
      audio.setDuck(1);
      this.resume();
    }
  }

  private openInspect(content: Parameters<Screens['inspect']>[0]): void {
    const prev = this.mode;
    this.mode = 'inspect';
    this.input.gameplayEnabled = false;
    this.input.releaseLock();
    this.hud.setPrompt(null);
    this.screens.inspect(content, () => this.closeOverlay(prev === 'tablet' ? 'tablet' : 'play'));
  }

  private inspectReturn: 'play' | 'tablet' = 'play';

  inspectCanvas(src: HTMLCanvasElement | HTMLImageElement | string, title: string, sub?: string): void {
    // opened from the tablet: keep the tablet underneath
    this.inspectReturn = 'tablet';
    this.mode = 'inspect';
    this.screens.inspect({ image: src, title, sub, frame: false }, () => this.closeOverlay('tablet'));
  }

  private closeOverlay(to: 'play' | 'tablet'): void {
    this.screens.close();
    if (to === 'tablet' && this.tablet.open) {
      this.mode = 'tablet';
      return;
    }
    this.resume();
  }

  // ================================================================== game hooks

  private message(from: string, text: string, important = false): void {
    const s = this.director.s;
    s.messages.push({ time: Math.floor(s.clock), from, text });
    const kind = from === '시스템' ? 'system' : important ? 'important' : 'normal';
    this.hud.toast(from, text, kind, Math.max(6000, text.length * 110));
    audio.play('notify', undefined, 0.8);
    this.tablet.refresh();
  }

  private onIncident(inc: Incident): void {
    audio.play('notify');
    this.hud.toast(inc.optional ? '선택 점검' : `신고 접수 · ${inc.from}`, inc.text, 'important', 9000);
    this.tablet.refresh();
  }

  private voice(lines: VoiceLine[], ring: boolean): void {
    if (ring) audio.play('ring');
    window.setTimeout(() => this.hud.say(lines), ring ? 1600 : 0);
  }

  private onAct(act: number): void {
    const titles: Record<number, string> = { 1: '1막 · 근무 시작', 2: '2막 · 이상 징후', 3: '3막 · 정보 충돌', 4: '4막 · 13층' };
    window.setTimeout(() => this.hud.centerNote(titles[act] ?? '', 3500), 400);
  }

  private rebuild(floors: number[]): void {
    const w = this.world;
    const before = new Set(w.modsByFloor.size ? [...w.modsByFloor.values()].flatMap((s) => [...s]) : []);
    w.flags = this.director.worldFlags();
    w.modsByFloor = this.director.modsByFloor();
    this.elevator.allow13 = !!this.director.s.flags.f13Open;
    const set = new Set(floors);
    if (this.director.s.flags.f13Open) set.add(FLOOR_13);
    for (const n of set) if (w.floors.has(n)) w.rebuildFloor(n);
    const after = new Set([...w.modsByFloor.values()].flatMap((s) => [...s]));
    const active = this.director.activeMap();
    for (const id of before) if (!after.has(id)) this.runtime.clear(id);
    for (const id of ['hum_window_figure', 'hum_door_ajar_watch', 'hum_mirror_figure']) if (!active.has(id)) this.runtime.clear(id);
    w.updateVisibility(this.player.pos.y);
  }

  private checkpoint(): void {
    if (!this.director) return;
    writeSave(this.director.s);
  }

  report(incId: string, j: Judgment, c: Category | null): ReportResult | null {
    const floor = this.director.findOpen(incId)?.floor;
    const r = this.director.report(incId, j, c);
    if (!r) return null;
    audio.play('report');
    if (r.outcome === 'correct') {
      if (floor === this.pFloor) this.hud.flash(0.18);
    } else if (r.outcome !== 'correct_normal') {
      window.setTimeout(() => {
        this.hud.tear();
        audio.play('glitch');
      }, 700);
    }
    this.hud.setContamination(this.director.s.contamination);
    return r;
  }

  takePhoto(): void {
    if (this.mode !== 'tablet') return;
    this.tablet.hide();
    this.mode = 'photo';
    this.photoPending = true;
  }

  private capturePhoto(): void {
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = Math.round((320 * src.height) / src.width);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
    const thumb = c.toDataURL('image/jpeg', 0.72);
    const s = this.director.s;
    const loc = this.playerLocId() ?? `res:${this.pFloor}`;
    let evidenceOf: string | null = null;
    let incidentId: string | null = null;
    for (const inc of this.director.openIncidents()) {
      if (!inLocation(inc.location, this.pFloor, this.player.pos.x, this.player.pos.z, this.inCar)) continue;
      incidentId = inc.id;
      if (inc.anomalyId) {
        const a = anomaly(inc.anomalyId);
        const seeable = a.realisation.some((r) => r === 'physical' || r === 'runtime') && a.channels.some((ch) => ch === 'visual' || ch === 'image' || ch === 'reference');
        if (seeable) evidenceOf = inc.anomalyId;
      }
      break;
    }
    s.photos.push({ id: `p${s.photos.length + 1}`, time: Math.floor(s.clock), location: loc, incidentId, evidenceOf, thumb });
    audio.play('shutter');
    this.hud.flash(0.06);
    this.photoPending = false;
    this.mode = 'play';
    this.openTablet('photo');
  }

  callUnit(unit: string): { speaker: string; text: string }[] {
    audio.play('ring', undefined, 0.6);
    const u = unit.toUpperCase();
    if (!u) return [];
    if (u === 'HQ' || u === '0') {
      if ((this.director.act ?? 1) >= 4) return [{ speaker: '상황실', text: '(연결음이 끊기고 잡음만 들린다.)' }];
      return INTERCOM_ANSWERS.HQ;
    }
    if (u === '1301' && this.director.s.flags.f13Open) return [{ speaker: '1301호', text: '…올라와 주세요. 기다리고 있어요.' }];
    if (u.startsWith('13')) return [{ speaker: '시스템', text: '존재하지 않는 세대 번호입니다.' }];
    const vv = this.director.activeFloor('aud_voice_vacant');
    if (vv !== null && u.startsWith(String(vv)) && isUnitVacant(u)) return [{ speaker: `${u}호`, text: '(수화기 너머로 텔레비전 소리와 여러 사람의 웅성거림이 들린다. 공실이다.)' }];
    if (INTERCOM_ANSWERS[u]) return INTERCOM_ANSWERS[u];
    const r = residentByUnit(u);
    if (!r) {
      if (/^\d+09$/.test(u) && this.director.activeFloor('sys_directory_extra_unit') === Number(u.slice(0, -2))) return [{ speaker: `${u}호`, text: '(신호는 가는데 받지 않는다. 벨소리가 복도 어딘가에서 희미하게 울린다.)' }];
      return [{ speaker: '시스템', text: '등록되지 않은 세대입니다.' }];
    }
    if (r.status !== 'occupied') return [{ speaker: `${u}호`, text: '(연결음만 이어진다. 이주 완료 세대다.)' }];
    return [{ speaker: `${u}호 ${r.name}`, text: '…네? 이 시간에요? 아무 일 없어요. (통화가 끊긴다.)' }];
  }

  channels(): ChannelDef[] {
    const out = baseChannels();
    if (this.director.cctvHas13()) out.push(CH13);
    return out;
  }

  setTabletChannel(ch: ChannelDef | null): void {
    if (!this.cctv) return;
    this.cctv.tabletChannel = ch;
    if (ch) this.cctv.renderTabletNow();
  }

  readCctv(canvas: HTMLCanvasElement): void {
    this.cctv.readTablet(canvas);
  }

  playerLocId(): string | null {
    const f = this.pFloor;
    const p = this.player.pos;
    // most specific zones first (rooms inside a floor before the floor-wide zone)
    const order = ['elevator', 'control', 'parcel', 'stair', 'lobby', 'b1', 'shops', 'gallery', 'res', 'f13'];
    for (const k of order) for (const l of LOCATIONS) if (l.kind === k && inLocation(l.id, f, p.x, p.z, this.inCar)) return l.id;
    return null;
  }

  playerFloor(): number {
    return this.pFloor;
  }

  click(): void {
    audio.play('click');
  }

  // ================================================================== interaction

  private interactables(): Interactable[] {
    return this.world.interactablesNear(this.player.pos.y);
  }

  private findFocus(): Interactable | null {
    const cam = this.camera;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
    this.raycaster.far = 3.2;
    const list = this.interactables();
    const objs = list.map((i) => i.object);
    const hits = this.raycaster.intersectObjects(objs, false);
    if (!hits.length) return null;
    const hit = hits[0];
    const it = list.find((i) => i.object === hit.object)!;
    if (hit.distance > (it.range ?? 2.2)) return null;
    // occlusion by walls (ignore the door's own collider)
    const ro = this.raycaster.ray.origin;
    const rd = this.raycaster.ray.direction;
    const doorTag = it.kind === 'door' ? `door:${(it.data as { door: string }).door}` : null;
    const cols = this.world.collidersNear(this.player.pos.y, []);
    for (const c of cols) {
      if (c.tag && (c.tag === doorTag || c.tag === 'entrance' || c.tag === 'landing' || c.tag === 'cardoor' || c.tag === 'shutter')) continue;
      const t = rayBox(ro, rd, c);
      if (t !== null && t < hit.distance - 0.35) return null;
    }
    return it;
  }

  private interact(it: Interactable): void {
    const d = this.director;
    const s = d.s;
    const data = (it.data ?? {}) as Record<string, any>;
    switch (it.kind) {
      case 'door': {
        const door = this.world.door(data.door);
        if (!door) return;
        if (door.locked) {
          if (door.id === 'unit-1204' && s.pickedUp.includes('masterKey')) {
            s.unlockedDoors.push('unit-1204');
            door.locked = false;
            audio.play('locked', door.center);
            this.hud.centerNote('마스터키로 1204호 문을 열었다.');
          } else if (door.id === 'unit-1301' && s.unlockedDoors.includes('unit-1301')) {
            door.locked = false;
          } else {
            audio.play('locked', door.center);
            this.hud.centerNote(door.lockedMsg, 3200);
            return;
          }
        }
        const opening = door.target < 0.5;
        door.target = opening ? 1 : 0;
        door.openTimer = 0;
        audio.play(door.kind === 'fire' ? (opening ? 'doorOpen' : 'fireDoor') : opening ? 'doorOpen' : 'doorClose', door.center);
        return;
      }
      case 'unit_door': {
        const unit = String(data.unit);
        const is13 = it.floor === FLOOR_13;
        audio.play(is13 ? 'knock' : 'doorbell', it.object.getWorldPosition(this._v));
        const special = this.runtime.onDoorbell(unit, this.rtCtx());
        if (special) return this.hud.centerNote(special, 4200);
        if (unit === 'extra') return this.hud.centerNote('딩동. …문 너머에서 누군가 숨을 멈춘다. 번호판이 없는 문이다.', 4200);
        if (is13) return this.hud.centerNote(unit === '1308' ? '똑똑똑. 문패의 이름을 다시 읽는다.' : '똑똑똑. 대답이 없다. 문 너머가 너무 조용하다.', 3600);
        const r = residentByUnit(unit);
        if (!r) return this.hud.centerNote('딩동. 대답이 없다. 명부에 없는 세대다.', 3600);
        if (r.status !== 'occupied') return this.hud.centerNote('딩동. 공실이다. 문틈으로 찬 공기만 나온다.', 3200);
        return this.hud.centerNote(`딩동. …응답이 없다. ${r.name} 씨는 자고 있을 시간이다.`, 3200);
      }
      case 'elevator_call': {
        audio.play('button', it.object.getWorldPosition(this._v));
        this.elevator.call(Number(data.floor), 'hall');
        return;
      }
      case 'elevator_panel':
        return this.openLift();
      case 'inspect':
        return this.inspectThing(it, data);
      case 'archive_cabinet': {
        if (!s.pickedUp.includes('binder')) {
          s.pickedUp.push('binder');
          audio.play('paper');
          it.prompt = '원본 기록 보관함 (기록철 수령 완료)';
          this.message('시스템', "원본 기록철(A1~A6)을 챙겼다. 태블릿에 '원본 기록철' 탭이 생겼다.", true);
          this.checkpoint();
        } else this.hud.centerNote('원본 기록철은 이미 챙겼다. 태블릿의 원본 기록철 탭에서 볼 수 있다.');
        return;
      }
      case 'desk_log': {
        s.messages.push({ time: Math.floor(s.clock), from: '__log', text: `근무 일지 작성 — 처리 ${s.reports.length}건, 이상 ${s.reports.filter((r) => r.judgment === 'anomaly').length}건 보고.` });
        this.checkpoint();
        audio.play('paper');
        this.hud.centerNote('근무 일지를 작성했다. (진행 상황 저장됨)', 2800);
        return;
      }
      case 'key_box': {
        if (!s.pickedUp.includes('masterKey')) {
          s.pickedUp.push('masterKey');
          audio.play('switch');
          this.hud.centerNote("'1204 공실 마스터키' 꼬리표가 달린 열쇠를 챙겼다.", 3200);
        } else this.hud.centerNote('열쇠함에는 동 출입 열쇠와 예비 카드키뿐이다.');
        return;
      }
      case 'monitors':
        return this.openTablet('cctv');
      case 'intercom_panel':
        return this.openTablet('ic');
      case 'pickup': {
        const id = String(data.record);
        this.pickup(id);
        return;
      }
      case 'filing_cabinet': {
        if (!s.pickedUp.includes('archiveKey')) {
          audio.play('locked', it.object.getWorldPosition(this._v));
          this.hud.centerNote("잠겨 있다. 서랍에 '구조 · 인허가 — 전기실 예비 열쇠' 라벨이 붙어 있다.", 3600);
          return;
        }
        this.pickup('D2');
        return;
      }
      case 'breaker_panel': {
        const list = [...BREAKERS_BASE];
        if (data.extra) list.splice(list.indexOf('옥탑 기계실'), 0, '13층');
        const text = list.map((l, i) => `${String(i + 1).padStart(2, '0')}  ${l}  — ON`).join('\n');
        this.openInspect({ title: '전등 분기 차단기', text: `${text}\n\n(회로 ${list.length}개)` });
        return;
      }
      case 'entrance': {
        if (s.phase === 'final' && s.clock >= 360) return this.finish();
        if (s.phase === 'final') return this.hud.centerNote(`출입문은 06:00에 잠금이 풀린다. (현재 ${fmtClock(s.clock)})`);
        return this.hud.centerNote('야간 출입 통제 중. 출입문은 06:00까지 잠겨 있다.');
      }
      case 'locker': {
        const lines = ['보관 중인 택배', '', '03번  803호 이순자 님 — 9월 29일 도착', '07번  305호 김도현 님 — 9월 29일 도착', '09번  1108호 오지은 님 — 9월 28일 도착'];
        if (d.isActive('sys_delivery_vacant')) lines.push('12번  1204호 박정호 님 — 9월 21일 도착 · 장기 미수령');
        this.openInspect({ title: '무인 택배함', text: lines.join('\n') });
        return;
      }
      case 'message':
        return this.hud.centerNote(String(data.text ?? ''), 3600);
    }
  }

  private pickup(id: string): void {
    const d = this.director;
    if (id === 'archiveKey') {
      d.s.pickedUp.push('archiveKey');
      audio.play('switch');
      this.hud.centerNote("'문서고 서류함' 열쇠를 챙겼다.", 3000);
      this.rebuild([B1]);
      return;
    }
    d.onPickup(id);
    audio.play('paper');
    const rec = ARCHIVE_RECORDS.find((r) => r.id === id);
    const floors = { D1: B1, D2: B1, D3: 12, D4: FLOOR_13 } as Record<string, number>;
    this.rebuild([floors[id] ?? this.pFloor]);
    if (rec) {
      this.message('시스템', `'${rec.title}'을(를) 원본 기록철에 끼워 두었다.`, false);
      this.openInspect({ title: rec.title, text: `${rec.subtitle}\n\n${rec.body}` });
    }
    this.checkpoint();
  }

  private inspectThing(it: Interactable, data: Record<string, any>): void {
    const d = this.director;
    if (data.flag) d.s.flags[data.flag] = true;
    if (data.image) {
      this.openInspect({ image: getImage(data.image as ImageKey), title: data.title, sub: data.sub });
      return;
    }
    if (data.ad) {
      const map = (this.world.car.adMesh.material as THREE.MeshStandardMaterial).map;
      this.openInspect({ image: map?.image as HTMLCanvasElement, title: '승강기 광고판', sub: '청운 리버파크 분양 안내' });
      return;
    }
    switch (data.board) {
      case 'directory': {
        const rows = ['12F  주거', '11F  주거', '10F  주거', '9F  주거', '8F  주거', '7F  주거', '6F  주거', '5F  주거 · 추억 사진전', '4F  주거', '3F  주거', '2F  상가 (부동산 · 학원 · 세탁 · 미용)', '1F  로비 · 관리실 · 택배보관실', 'B1  전기실 · 문서고 · 기계실'];
        if (data.with13) rows.unshift('13F  관리사무소');
        return this.openInspect({ title: '청운빌딩 층별 안내', text: rows.join('\n') });
      }
      case 'lobby':
        return this.openInspect({ image: missingPosterCanvas(d.isActive('img_missing_poster_empty')), title: '게시판 — 사람을 찾습니다', sub: '옆에는 분리배출 안내문이 붙어 있다.' });
      case 'hall':
        return this.openInspect({ title: `${floorLabel(Number(data.floor))} 승강기 홀 게시판`, text: '이주 안내 — 청운빌딩 재개발 정비사업 이주 기간이 10월 31일 종료됩니다. 철거 예정일: 2026년 12월 1일.\n\n승강기 점검 안내 — 매월 둘째 주 화요일 10:00~12:00 정기 점검.\n\n야간 소음 자제 — 밤 10시 이후 복도 통화, 문 쾅 닫기를 삼가 주세요.' });
      case 'hall-gallery':
        return this.openInspect({ title: '추억 사진전', text: '청운빌딩 32년, 우리들의 기억.\n철거를 앞두고 입주민 여러분이 보내 주신 사진을 5층 복도에 전시합니다.\n\n기간: 9월 1일 ~ 철거 전까지. 액자는 만지지 말아 주세요.\n\n— 청운빌딩 관리사무소' });
      case 'f13':
        return this.openInspect({ title: '13층 게시판 (1994)', text: '반상회 안내 — 11월 반상회를 아래와 같이 개최합니다.\n일시: 1994년 11월 2일 저녁 7시\n장소: 1301호\n13층 입주 가구는 빠짐없이 참석 바랍니다.\n\n옆에 걸린 달력은 1994년 11월. 2일에 동그라미가 쳐져 있다.' });
    }
    this.hud.centerNote(it.prompt);
  }

  private openLift(): void {
    const prev = this.mode;
    if (prev !== 'play') return;
    this.mode = 'lift';
    this.input.gameplayEnabled = false;
    this.input.releaseLock();
    this.hud.setPrompt(null);
    const render = () => {
      const floors = this.elevator.stops();
      this.screens.liftPanel({
        floors,
        lit: [],
        display: lblFloor(this.elevator.floor),
        onPress: (n) => {
          audio.play('button');
          this.elevator.call(n, 'car');
          this.closeOverlay('play');
        },
        onOpen: () => {
          audio.play('button');
          this.elevator.setHold(true);
        },
        onClose: () => {
          audio.play('button');
          this.elevator.setHold(false);
          this.closeOverlay('play');
        },
        onDismiss: () => this.closeOverlay('play'),
      });
    };
    render();
  }

  private finish(): void {
    const id = this.director.ending();
    const s = this.director.s;
    s.ending = id;
    s.phase = 'ended';
    clearSave();
    this.mode = 'ending';
    this.input.releaseLock();
    this.hud.show(false);
    this.tablet.hide();
    audio.setRoomTone('silent');
    if (id === 'bad') audio.sting('low', true);
    else audio.play('arrive');
    this.screens.ending(
      id,
      s,
      (l) => this.director.locName(l),
      () => {
        this.teardown();
        this.showTitle().ready();
      },
      () => this.startNew(s.seed),
    );
    this.onEnding?.(id);
  }

  // ================================================================== loop

  private rtCtx(): RuntimeCtx {
    return {
      world: this.world,
      player: this.player,
      elevator: this.elevator,
      director: this.director,
      inCar: this.inCar,
      floor: this.pFloor,
      onScare: () => undefined,
      flash: (sec) => this.flashLights(sec),
    };
  }

  private flashTimer = 0;
  private flashLights(sec: number): void {
    this.flashTimer = sec;
  }

  private roomTone(): RoomTone {
    const p = this.player.pos;
    if (this.inCar) return 'car';
    if (p.x > 12.05) return 'stair';
    const f = this.pFloor;
    if (f === B1) return 'b1';
    if (f === FLOOR_13) return 'f13';
    if (f === 1) return 'lobby';
    if (f === 12 && p.z < -1.25 && p.x > 6.5) return 'unit';
    return 'corridor';
  }

  private whereText(): [string, string] {
    const p = this.player.pos;
    const f = this.pFloor;
    const fl = f === FLOOR_13 ? '13층' : floorLabel(f);
    if (this.inCar) return ['승강기', `${lblFloor(this.elevator.floor)}층 ${this.elevator.moving ? '운행 중' : '정지'}`];
    if (p.x > 12.05) return [`${fl}`, '비상계단'];
    const id = this.playerLocId();
    const name = id ? this.director.locName(id) : fl;
    return [fl, name.replace(`${fl} `, '')];
  }

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.0001, (now - this.last) / 1000));
    this.last = now;
    this.fps += (1 / dt - this.fps) * 0.05;
    if (!this.started || this.mode === 'title' || this.mode === 'ending') {
      this.input.endFrame();
      return;
    }
    this.frame++;
    this.handleKeys();
    const running = this.mode !== 'paused';
    const s = this.director.s;
    if (running) {
      const carDelta = this.elevator.update(dt, this.player.pos);
      const riding = this.elevator.contains(this.player.pos);
      this.player.frozen = this.mode !== 'play';
      this.player.update(dt, this.input, this.world, this.settings, riding ? carDelta : 0);
      this.inCar = this.elevator.contains(this.player.pos);
      this.pFloor = this.inCar ? this.elevator.floor : this.world.floorAt(this.player.pos.y);
      this.director.tick(dt);
      gameClock.minutes = s.clock;
      // on-site checks
      for (const inc of this.director.openIncidents()) {
        if (!this.director.s.visited.includes(inc.id) && inLocation(inc.location, this.pFloor, this.player.pos.x, this.player.pos.z, this.inCar)) {
          this.director.markVisited(inc);
          this.hud.centerNote(`현장 도착 — ${this.director.locName(inc.location)}`, 2200);
          this.tablet.refresh();
        }
      }
      this.runtime.update(dt, this.rtCtx());
      this.world.time += dt;
      this.world.updateDoors(dt, this.player.pos);
      this.cctv.recordPose(this.world.time, this.player.pos.x, this.player.pos.y, this.player.pos.z, this.player.yaw);
      this.tablet.tick(dt);
    }
    // visibility, lights
    const w = this.world;
    const extra: number[] = [];
    if (this.inCar) extra.push(this.elevator.floor);
    w.updateVisibility(this.player.pos.y, extra);
    // CCTV monitors when the player is in/near the control room
    const p = this.player.pos;
    const nearMonitors = this.pFloor === 1 && !this.inCar && p.x < -2.5 && p.z < 0.5;
    this.updateMonitorChannels();
    const rendered = this.cctv.update(dt, nearMonitors && running, this.mode === 'tablet' && this.tablet.tab === 'cctv');
    void rendered;
    const cur = w.floorAt(p.y);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      w.globalGain = 0.04;
    }
    // corridor: light only this storey; stairwell: neighbouring landings are visible too
    w.assignLights(this.camera.position, p.x > 12.05 ? [cur, cur - 1, cur + 1] : [cur], true);
    w.updateFixtures();
    // flashlight follows the camera
    const fl = w.flashlight;
    fl.intensity = this.flashlightOn ? 22 : 0;
    fl.position.copy(this.camera.position);
    this.camera.getWorldDirection(this._d);
    w.flashTarget.position.copy(this.camera.position).addScaledVector(this._d, 5);
    // render
    this.renderer.setRenderTarget(null);
    this.renderer.render(w.scene, this.camera);
    if (this.photoPending) this.capturePhoto();
    // audio listener + tone
    audio.setListener(this.camera.position, this._d);
    audio.setRoomTone(this.roomTone(), this.mode === 'paused' ? 0.4 : 1);
    // HUD
    const [a, b] = this.whereText();
    this.hud.setClock(fmtClock(s.clock), a, b);
    this.hud.under(this.mode !== 'play');
    this.updateTaskHud();
    if (this.mode === 'play') {
      this.focus = this.findFocus();
      this.hud.setPrompt(this.focus ? this.focus.prompt : null);
    }
    this.hud.setContamination(s.contamination);
    this.input.endFrame();
  };

  private updateMonitorChannels(): void {
    const chans = this.channels();
    const byId = (id: string) => chans.find((c) => c.id === id) ?? null;
    const cur = this.director.current();
    let site: ChannelDef | null = null;
    if (cur) {
      const l = cur.location;
      if (l === 'elevator') site = byId('car');
      else if (l.startsWith('lobby') || l.startsWith('control') || l.startsWith('parcel')) site = byId('lobby');
      else if (l.startsWith('b1')) site = byId('b1');
      else if (l.startsWith('f13')) site = byId('corr-13') ?? byId('corr-12');
      else site = byId(`corr-${cur.floor}`);
    }
    this.cctv.monitorChannels = [byId('lobby'), byId('car'), site ?? byId('corr-3'), byId('b1')];
  }

  private updateTaskHud(): void {
    const d = this.director;
    const s = d.s;
    if (s.phase === 'final') {
      this.hud.setTask('교대', s.clock >= 360 ? '1층 출입문으로 가서 교대하세요.' : '06:00에 1층 출입문 잠금이 풀립니다. 로비로 가세요.', '');
      return;
    }
    const cur = d.current();
    if (!cur) {
      const opt = d.openIncidents()[0];
      if (opt) this.hud.setTask('선택 점검', opt.text, d.siteChecked(opt) ? '현장 확인 완료 — Tab 으로 보고' : `위치: ${d.locName(opt.location)}`, d.siteChecked(opt));
      else this.hud.setTask('대기 중', '다음 신고를 기다리는 중입니다.', '');
      return;
    }
    const ok = d.siteChecked(cur);
    this.hud.setTask(`신고 ${cur.id.replace('s', '#')} · ${d.locName(cur.location)}`, cur.text, ok ? '현장 확인 완료 — Tab 으로 태블릿을 열어 보고하세요' : `현장 확인 필요 — ${d.locName(cur.location)}`, ok);
  }

  private handleKeys(): void {
    const i = this.input;
    const tab = i.consume('Tab');
    const esc = i.consume('Escape');
    const e = i.consume('KeyE');
    const f = i.consume('KeyF');
    switch (this.mode) {
      case 'play':
        if (tab) this.openTablet();
        else if (esc) this.pause();
        else if (e && this.focus) this.interact(this.focus);
        if (f) {
          this.flashlightOn = !this.flashlightOn;
          audio.play('switch');
        }
        break;
      case 'tablet':
        if (tab || esc) this.close();
        break;
      case 'inspect':
        if (esc || e || tab) {
          this.screens.close();
          if (this.inspectReturn === 'tablet' && this.tablet.open) {
            this.mode = 'tablet';
            this.inspectReturn = 'play';
          } else this.resume();
        }
        break;
      case 'lift':
        if (esc || e) this.closeOverlay('play');
        break;
      case 'paused':
        if (esc && this.screens.current === 'pause') this.resume();
        break;
    }
  }

  // ================================================================== QA / debug helpers (used by dev tools & tests)

  teleportTo(locId: string): void {
    const shots = LOCATIONS.find((l) => l.id === locId);
    if (!shots) return;
    const f = shots.kind === 'elevator' ? 1 : shots.floor;
    if (shots.kind === 'elevator') {
      this.elevator.place(1);
      this.player.teleport(0, floorY(1), -4.6, 0);
      return;
    }
    const table: Record<string, [number, number, number]> = {
      res: [8.5, 0, Math.PI / 2],
      gallery: [0, 0, Math.PI / 2],
      stair: [13, 0, -Math.PI / 2],
      lobby: [0, 0.5, Math.PI],
      control: [-7.4, -3.0, 0.35],
      parcel: [8.6, -3.0, 0],
      b1: [-2, 0, Math.PI / 2],
      shops: [8, 0, Math.PI / 2],
      f13: [8, 0, Math.PI / 2],
    };
    const [x, z, yaw] = table[shots.kind] ?? [0, 0, 0];
    this.player.teleport(x, floorY(f), z, yaw);
  }
}

function lblFloor(n: number): string {
  return n === B1 ? 'B1' : String(n);
}

/** Ray vs AABB slab test; returns entry distance or null. */
function rayBox(o: THREE.Vector3, d: THREE.Vector3, b: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const [oo, dd, lo, hi] of [
    [o.x, d.x, b.x0, b.x1],
    [o.y, d.y, b.y0, b.y1],
    [o.z, d.z, b.z0, b.z1],
  ] as const) {
    if (Math.abs(dd) < 1e-9) {
      if (oo < lo || oo > hi) return null;
    } else {
      let t1 = (lo - oo) / dd;
      let t2 = (hi - oo) / dd;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  return tmin >= 0 ? tmin : null;
}

export type { Mode };
