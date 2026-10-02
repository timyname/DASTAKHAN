/** Player settings persisted locally. Every storage access is guarded. */
import { safeGet, safeSet, type KeyValueStorage } from '../progress/storage.ts';

export interface Settings {
  sound: boolean;
  /** Stored for forward compatibility; no music files ship with the MVP (see MUSIC_AVAILABLE). */
  music: boolean;
  reducedMotion: boolean;
}

export const SETTINGS_KEY = 'dastakhan.settings';

/** No music assets exist in the MVP; the UI shows music as unavailable. */
export const MUSIC_AVAILABLE = false;

export function prefersReducedMotion(): boolean {
  try {
    return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSettings(): Settings {
  return { sound: true, music: false, reducedMotion: prefersReducedMotion() };
}

/** Keeps valid booleans from `raw`; anything else falls back to defaults. */
export function parseSettings(raw: string | null, defaults: Settings = defaultSettings()): Settings {
  if (raw === null) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (typeof parsed !== 'object' || parsed === null) return defaults;
  const p = parsed as Record<string, unknown>;
  const pick = (key: keyof Settings) => (typeof p[key] === 'boolean' ? (p[key] as boolean) : defaults[key]);
  return { sound: pick('sound'), music: pick('music'), reducedMotion: pick('reducedMotion') };
}

export function loadSettings(storage: KeyValueStorage): Settings {
  const read = safeGet(storage, SETTINGS_KEY);
  return parseSettings(read.ok ? read.value : null);
}

/** Returns false when the write failed; settings still apply for this session. */
export function saveSettings(storage: KeyValueStorage, settings: Settings): boolean {
  return safeSet(storage, SETTINGS_KEY, JSON.stringify(settings));
}

/** Mirrors settings onto <html> so CSS can react (e.g. `[data-reduced-motion="true"]`). */
export function applySettingsToDocument(settings: Settings): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  document.documentElement.dataset.sound = String(settings.sound);
}
