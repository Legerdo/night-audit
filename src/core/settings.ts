// Player settings, persisted separately from game saves.
export interface Settings {
  mouseSensitivity: number; // 0.2 .. 2.0
  invertY: boolean;
  fov: number; // 60 .. 90
  headBob: boolean;
  reduceMotion: boolean;
  masterVolume: number; // 0 .. 1
  subtitleScale: number; // 0.9 .. 1.4
  brightness: number; // 0.8 .. 1.3
}

const KEY = 'na13f.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  mouseSensitivity: 1.0,
  invertY: false,
  fov: 72,
  headBob: true,
  reduceMotion: false,
  masterVolume: 0.8,
  subtitleScale: 1.0,
  brightness: 1.0,
};

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

export function sanitizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  return {
    mouseSensitivity: clamp(Number(s.mouseSensitivity) || 1, 0.2, 2),
    invertY: !!s.invertY,
    fov: clamp(Number(s.fov) || 72, 60, 90),
    headBob: s.headBob !== false,
    reduceMotion: !!s.reduceMotion,
    masterVolume: clamp(Number(s.masterVolume), 0, 1),
    subtitleScale: clamp(Number(s.subtitleScale) || 1, 0.9, 1.4),
    brightness: clamp(Number(s.brightness) || 1, 0.8, 1.3),
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings stay in memory */
  }
}
