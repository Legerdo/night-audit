// Checkpoint save/load (localStorage). Only logical state is stored; the world is reconstructed from it.
import type { GameState } from '../game/state';

const KEY = 'na13f.save.v1';

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameState | null {
  try {
    const s = JSON.parse(json) as GameState;
    if (!s || s.version !== 1 || typeof s.seed !== 'string' || !Array.isArray(s.incidents) || typeof s.slot !== 'number') return null;
    // tolerate missing optional fields from older checkpoints
    s.optionals ??= [];
    s.optionalDone ??= [];
    s.flags ??= {};
    s.photos ??= [];
    s.elevatorLog ??= [];
    s.messages ??= [];
    s.visited ??= [];
    s.corrected ??= [];
    s.pickedUp ??= [];
    s.unlockedDoors ??= [];
    s.playTimeSec ??= 0;
    return s;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const s = deserialize(raw);
    return !!s && s.phase !== 'ended';
  } catch {
    return false;
  }
}

export function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function writeSave(s: GameState): boolean {
  try {
    // keep the save small: cap stored photo thumbnails
    const copy: GameState = { ...s, photos: s.photos.slice(-24) };
    localStorage.setItem(KEY, serialize(copy));
    return true;
  } catch {
    try {
      localStorage.setItem(KEY, serialize({ ...s, photos: s.photos.slice(-6) }));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
