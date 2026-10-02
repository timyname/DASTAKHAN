/**
 * Local progress persistence behind an interface, so a later server-backed
 * implementation (prompt 07) can replace it without touching screens.
 *
 * Robustness rules (GAME_SPEC §8, prompt 08):
 * - never throw to the UI; every storage access is guarded;
 * - corrupted JSON or an unknown schemaVersion: copy the raw value to a backup key,
 *   recover every well-formed part, expose `lastError` so the UI can tell the player;
 * - saves hold only stable states (the caller decides when to save).
 */
import type { SavedGame } from '@dastakhan/game-core';
import { safeGet, safeRemove, safeSet, type KeyValueStorage } from './storage.ts';

export const PROGRESS_SCHEMA_VERSION = 1;
export const PROGRESS_KEY = 'dastakhan.progress';
export const PROGRESS_BACKUP_KEY = 'dastakhan.progress.backup';
export const SAVE_KEY_PREFIX = 'dastakhan.save.';
export const SAVE_BACKUP_KEY_PREFIX = 'dastakhan.save-backup.';
export const MAX_STARS = 3;

export interface LevelProgress {
  /** 0–3; 0 means played but never won. */
  bestStars: number;
  bestScore: number;
}

export interface ProgressData {
  schemaVersion: 1;
  levels: Record<string, LevelProgress>;
  /** Number of campaign levels the player may open, in campaign order. Always ≥ 1. */
  unlockedCount: number;
  tutorialsSeen: string[];
}

export type ProgressErrorKind =
  /** Progress JSON could not be parsed; defaults were used. */
  | 'corrupted'
  /** Progress has an unknown schemaVersion; compatible parts were recovered. */
  | 'unknownSchema'
  /** Progress had malformed fields that were dropped. */
  | 'recovered'
  /** localStorage is not usable; progress lives only in memory. */
  | 'storageUnavailable'
  /** A write failed (quota, blocked storage). */
  | 'writeFailed'
  /** A saved game was malformed and has been discarded (backup kept). */
  | 'saveCorrupted'
  /** A saved game was made by other rules/level versions and has been discarded (backup kept). */
  | 'saveOutdated';

export interface ProgressError {
  kind: ProgressErrorKind;
  /** Developer-facing English detail; the UI maps `kind` to a Russian message. */
  message: string;
  key?: string;
  backupKey?: string;
}

export interface SavedGameExpectation {
  rulesVersion: number;
  levelVersion: number;
}

export interface ProgressRepository {
  /** Most recent recoverable problem, or null. Never thrown. */
  readonly lastError: ProgressError | null;
  clearError(): void;
  load(): ProgressData;
  /** Merge by max; any win (stars ≥ 1) unlocks the next campaign level. */
  recordResult(levelId: string, stars: number, score: number): ProgressData;
  markTutorialSeen(tutorialId: string): ProgressData;
  /**
   * Returns the saved stable game for `levelId`, or null. With `expect`, a save made
   * for other rules/level versions is backed up, discarded and reported as `saveOutdated`.
   */
  loadSavedGame(levelId: string, expect?: SavedGameExpectation): SavedGame | null;
  /** Returns false (and sets lastError) when the save could not be written. */
  saveGame(game: SavedGame): boolean;
  clearSavedGame(levelId: string): void;
  /** Deletes progress and the saved games of all known levels. */
  reset(): ProgressData;
}

export function createDefaultProgress(): ProgressData {
  return { schemaVersion: PROGRESS_SCHEMA_VERSION, levels: {}, unlockedCount: 1, tutorialsSeen: [] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isLevelProgress(v: unknown): v is LevelProgress {
  return (
    isRecord(v) &&
    Number.isInteger(v.bestStars) &&
    (v.bestStars as number) >= 0 &&
    (v.bestStars as number) <= MAX_STARS &&
    typeof v.bestScore === 'number' &&
    Number.isFinite(v.bestScore) &&
    v.bestScore >= 0
  );
}

/** Minimum unlockedCount implied by recorded wins (wins unlock the following level). */
function unlockedFromWins(levels: Record<string, LevelProgress>, levelIds: string[]): number {
  let unlocked = 1;
  levelIds.forEach((id, index) => {
    if ((levels[id]?.bestStars ?? 0) >= 1) unlocked = Math.max(unlocked, index + 2);
  });
  return unlocked;
}

function clampUnlocked(n: number, levelIds: string[]): number {
  const atLeastOne = Math.max(1, Math.floor(n));
  // With an empty level list (content not loaded yet) keep the stored value rather than losing unlocks.
  return levelIds.length > 0 ? Math.min(atLeastOne, levelIds.length) : atLeastOne;
}

export interface SanitizeResult {
  data: ProgressData;
  /** Names of dropped or repaired fields; empty when the input was fully valid. */
  issues: string[];
}

/**
 * Recover every well-formed part of an arbitrary parsed value.
 * Pure; exported for tests. Does not judge schemaVersion (the caller does).
 */
export function sanitizeProgress(raw: unknown, levelIds: string[]): SanitizeResult {
  const issues: string[] = [];
  const data = createDefaultProgress();
  if (!isRecord(raw)) {
    issues.push('root');
    return { data, issues };
  }

  if (isRecord(raw.levels)) {
    for (const [id, entry] of Object.entries(raw.levels)) {
      if (id && isLevelProgress(entry)) {
        data.levels[id] = { bestStars: entry.bestStars, bestScore: Math.floor(entry.bestScore) };
      } else {
        issues.push(`levels.${id}`);
      }
    }
  } else if (raw.levels !== undefined) {
    issues.push('levels');
  }

  let stored = 1;
  if (Number.isInteger(raw.unlockedCount) && (raw.unlockedCount as number) >= 1) {
    stored = raw.unlockedCount as number;
  } else if (raw.unlockedCount !== undefined) {
    issues.push('unlockedCount');
  }
  data.unlockedCount = clampUnlocked(Math.max(stored, unlockedFromWins(data.levels, levelIds)), levelIds);

  if (Array.isArray(raw.tutorialsSeen)) {
    const seen = new Set<string>();
    for (const id of raw.tutorialsSeen) {
      if (typeof id === 'string' && id.length > 0) seen.add(id);
      else issues.push('tutorialsSeen[]');
    }
    data.tutorialsSeen = [...seen];
  } else if (raw.tutorialsSeen !== undefined) {
    issues.push('tutorialsSeen');
  }

  return { data, issues };
}

export function isSavedGame(v: unknown): v is SavedGame {
  return (
    isRecord(v) &&
    v.schemaVersion === 1 &&
    typeof v.levelId === 'string' &&
    v.levelId.length > 0 &&
    Number.isInteger(v.rulesVersion) &&
    Number.isInteger(v.levelVersion) &&
    typeof v.seed === 'number' &&
    Number.isFinite(v.seed) &&
    typeof v.snapshot === 'string' &&
    v.snapshot.length > 0
  );
}

function cloneProgress(d: ProgressData): ProgressData {
  return { ...d, levels: { ...d.levels }, tutorialsSeen: [...d.tutorialsSeen] };
}

export interface LocalStorageProgressOptions {
  /** Pass false when `storage` is an in-memory fallback; reports `storageUnavailable`. */
  persistent?: boolean;
}

export class LocalStorageProgressRepository implements ProgressRepository {
  private readonly storage: KeyValueStorage;
  private readonly levelIds: string[];
  private cache: ProgressData | null = null;
  private error: ProgressError | null = null;

  constructor(storage: KeyValueStorage, levelIds: string[], options: LocalStorageProgressOptions = {}) {
    this.storage = storage;
    this.levelIds = [...levelIds];
    if (options.persistent === false) {
      this.error = { kind: 'storageUnavailable', message: 'localStorage is unavailable; using memory only.' };
    }
  }

  get lastError(): ProgressError | null {
    return this.error;
  }

  clearError(): void {
    this.error = null;
  }

  load(): ProgressData {
    if (this.cache) return cloneProgress(this.cache);
    this.cache = this.readProgress();
    return cloneProgress(this.cache);
  }

  recordResult(levelId: string, stars: number, score: number): ProgressData {
    const data = this.load();
    const safeStars = Number.isFinite(stars) ? Math.min(MAX_STARS, Math.max(0, Math.floor(stars))) : 0;
    const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
    const prev = data.levels[levelId];
    data.levels[levelId] = {
      bestStars: Math.max(prev?.bestStars ?? 0, safeStars),
      bestScore: Math.max(prev?.bestScore ?? 0, safeScore),
    };
    if (safeStars >= 1) {
      const index = this.levelIds.indexOf(levelId);
      if (index >= 0) data.unlockedCount = clampUnlocked(Math.max(data.unlockedCount, index + 2), this.levelIds);
    }
    return this.commit(data);
  }

  markTutorialSeen(tutorialId: string): ProgressData {
    const data = this.load();
    if (!tutorialId || data.tutorialsSeen.includes(tutorialId)) return data;
    data.tutorialsSeen.push(tutorialId);
    return this.commit(data);
  }

  loadSavedGame(levelId: string, expect?: SavedGameExpectation): SavedGame | null {
    const key = SAVE_KEY_PREFIX + levelId;
    const read = safeGet(this.storage, key);
    if (!read.ok) {
      this.error = { kind: 'storageUnavailable', message: `Could not read ${key}.`, key };
      return null;
    }
    if (read.value === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(read.value);
    } catch {
      return this.discardSave(levelId, read.value, 'saveCorrupted', 'Saved game is not valid JSON.');
    }
    if (!isSavedGame(parsed) || parsed.levelId !== levelId) {
      return this.discardSave(levelId, read.value, 'saveCorrupted', 'Saved game has an invalid shape.');
    }
    if (expect && (parsed.rulesVersion !== expect.rulesVersion || parsed.levelVersion !== expect.levelVersion)) {
      return this.discardSave(
        levelId,
        read.value,
        'saveOutdated',
        `Saved game uses rules v${parsed.rulesVersion}/level v${parsed.levelVersion}; expected v${expect.rulesVersion}/v${expect.levelVersion}.`,
      );
    }
    return parsed;
  }

  saveGame(game: SavedGame): boolean {
    if (!isSavedGame(game)) {
      this.error = { kind: 'writeFailed', message: 'Refused to write a malformed saved game.' };
      return false;
    }
    const key = SAVE_KEY_PREFIX + game.levelId;
    let json: string;
    try {
      json = JSON.stringify(game);
    } catch {
      this.error = { kind: 'writeFailed', message: 'Saved game could not be serialized.', key };
      return false;
    }
    if (!safeSet(this.storage, key, json)) {
      this.error = { kind: 'writeFailed', message: `Could not write ${key} (quota or blocked storage).`, key };
      return false;
    }
    return true;
  }

  clearSavedGame(levelId: string): void {
    safeRemove(this.storage, SAVE_KEY_PREFIX + levelId);
  }

  reset(): ProgressData {
    safeRemove(this.storage, PROGRESS_KEY);
    for (const id of this.levelIds) safeRemove(this.storage, SAVE_KEY_PREFIX + id);
    this.cache = createDefaultProgress();
    return cloneProgress(this.cache);
  }

  /* ---------------------------------------------------------------- internals */

  private commit(data: ProgressData): ProgressData {
    this.cache = cloneProgress(data);
    this.write(this.cache);
    return cloneProgress(this.cache);
  }

  private write(data: ProgressData): void {
    if (!safeSet(this.storage, PROGRESS_KEY, JSON.stringify(data))) {
      this.error = { kind: 'writeFailed', message: `Could not write ${PROGRESS_KEY} (quota or blocked storage).`, key: PROGRESS_KEY };
    }
  }

  private backup(backupKey: string, raw: string): string | undefined {
    return safeSet(this.storage, backupKey, raw) ? backupKey : undefined;
  }

  private readProgress(): ProgressData {
    const read = safeGet(this.storage, PROGRESS_KEY);
    if (!read.ok) {
      this.error = { kind: 'storageUnavailable', message: `Could not read ${PROGRESS_KEY}.`, key: PROGRESS_KEY };
      return createDefaultProgress();
    }
    const raw = read.value;
    if (raw === null) return createDefaultProgress();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.recover(raw, createDefaultProgress(), 'corrupted', 'Progress is not valid JSON.');
    }
    if (!isRecord(parsed)) {
      return this.recover(raw, createDefaultProgress(), 'corrupted', 'Progress is not an object.');
    }

    const { data, issues } = sanitizeProgress(parsed, this.levelIds);
    if (parsed.schemaVersion !== PROGRESS_SCHEMA_VERSION) {
      return this.recover(raw, data, 'unknownSchema', `Unknown progress schemaVersion: ${String(parsed.schemaVersion)}.`);
    }
    if (issues.length > 0) {
      return this.recover(raw, data, 'recovered', `Dropped malformed progress fields: ${issues.join(', ')}.`);
    }
    return data;
  }

  /** Back up the raw value, persist the recovered data and report the problem. */
  private recover(raw: string, data: ProgressData, kind: ProgressErrorKind, message: string): ProgressData {
    const backupKey = this.backup(PROGRESS_BACKUP_KEY, raw);
    this.error = { kind, message, key: PROGRESS_KEY, backupKey };
    this.write(data);
    // A failed write must not hide the original problem.
    if (this.error.kind === 'writeFailed') this.error = { kind, message, key: PROGRESS_KEY, backupKey };
    return data;
  }

  private discardSave(levelId: string, raw: string, kind: 'saveCorrupted' | 'saveOutdated', message: string): null {
    const key = SAVE_KEY_PREFIX + levelId;
    const backupKey = this.backup(SAVE_BACKUP_KEY_PREFIX + levelId, raw);
    safeRemove(this.storage, key);
    this.error = { kind, message, key, backupKey };
    return null;
  }
}
