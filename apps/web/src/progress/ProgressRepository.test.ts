import type { SavedGame } from '@dastakhan/game-core';
import { describe, expect, it } from 'vitest';
import {
  LocalStorageProgressRepository,
  PROGRESS_BACKUP_KEY,
  PROGRESS_KEY,
  SAVE_BACKUP_KEY_PREFIX,
  SAVE_KEY_PREFIX,
  createDefaultProgress,
} from './ProgressRepository.ts';
import { createMemoryStorage, type KeyValueStorage } from './storage.ts';

const LEVEL_IDS = Array.from({ length: 15 }, (_, i) => `level-${String(i + 1).padStart(2, '0')}`);

function repo(initial?: Record<string, string>) {
  const storage = createMemoryStorage(initial);
  return { storage, repo: new LocalStorageProgressRepository(storage, LEVEL_IDS) };
}

function savedGame(levelId: string, overrides: Partial<SavedGame> = {}): SavedGame {
  return { schemaVersion: 1, rulesVersion: 1, levelId, levelVersion: 1, seed: 42, snapshot: '{"board":[]}', ...overrides };
}

describe('LocalStorageProgressRepository', () => {
  it('starts with level 1 unlocked and nothing recorded', () => {
    const { repo: r } = repo();
    expect(r.load()).toEqual(createDefaultProgress());
    expect(r.lastError).toBeNull();
  });

  it('merges results by max for stars and score independently', () => {
    const { repo: r, storage } = repo();
    r.recordResult('level-01', 2, 900);
    r.recordResult('level-01', 3, 500);
    r.recordResult('level-01', 1, 1200);
    expect(r.load().levels['level-01']).toEqual({ bestStars: 3, bestScore: 1200 });
    // Persisted, and a fresh repository reads the same values.
    const fresh = new LocalStorageProgressRepository(storage, LEVEL_IDS);
    expect(fresh.load().levels['level-01']).toEqual({ bestStars: 3, bestScore: 1200 });
  });

  it('unlocks the next level on any win, never on a loss, and never re-locks', () => {
    const { repo: r } = repo();
    r.recordResult('level-01', 0, 300);
    expect(r.load().unlockedCount).toBe(1);
    r.recordResult('level-01', 1, 400);
    expect(r.load().unlockedCount).toBe(2);
    r.recordResult('level-02', 3, 1000);
    expect(r.load().unlockedCount).toBe(3);
    // Replaying an earlier level does not lower the unlock count.
    r.recordResult('level-01', 0, 10);
    expect(r.load().unlockedCount).toBe(3);
  });

  it('caps unlocking at the number of levels and ignores unknown level ids for unlocking', () => {
    const { repo: r } = repo();
    r.recordResult('level-15', 1, 100);
    expect(r.load().unlockedCount).toBe(15);
    r.recordResult('bonus-level', 3, 100);
    expect(r.load().unlockedCount).toBe(15);
    expect(r.load().levels['bonus-level']).toEqual({ bestStars: 3, bestScore: 100 });
  });

  it('clamps out-of-range stars and scores', () => {
    const { repo: r } = repo();
    r.recordResult('level-01', 7, -5);
    expect(r.load().levels['level-01']).toEqual({ bestStars: 3, bestScore: 0 });
    r.recordResult('level-02', Number.NaN, Number.POSITIVE_INFINITY);
    expect(r.load().levels['level-02']).toEqual({ bestStars: 0, bestScore: 0 });
  });

  it('records tutorials once', () => {
    const { repo: r } = repo();
    r.markTutorialSeen('tutorial-line');
    r.markTutorialSeen('tutorial-line');
    r.markTutorialSeen('tutorial-bomb');
    expect(r.load().tutorialsSeen).toEqual(['tutorial-line', 'tutorial-bomb']);
  });

  it('recovers from corrupted JSON: backs up the raw value, uses defaults, never throws', () => {
    const raw = '{"schemaVersion":1,"levels":{"level-01":';
    const { repo: r, storage } = repo({ [PROGRESS_KEY]: raw });
    expect(() => r.load()).not.toThrow();
    expect(r.load()).toEqual(createDefaultProgress());
    expect(r.lastError?.kind).toBe('corrupted');
    expect(r.lastError?.backupKey).toBe(PROGRESS_BACKUP_KEY);
    expect(storage.getItem(PROGRESS_BACKUP_KEY)).toBe(raw);
    // The repaired data was written back, so the next session starts clean.
    const fresh = new LocalStorageProgressRepository(storage, LEVEL_IDS);
    fresh.load();
    expect(fresh.lastError).toBeNull();
  });

  it('keeps well-formed level entries and drops malformed ones', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      levels: {
        'level-01': { bestStars: 2, bestScore: 800 },
        'level-02': { bestStars: 'three', bestScore: 10 },
        'level-03': { bestStars: 9, bestScore: 10 },
        'level-04': null,
      },
      unlockedCount: 'many',
      tutorialsSeen: ['tutorial-line', 5, 'tutorial-line'],
    });
    const { repo: r, storage } = repo({ [PROGRESS_KEY]: raw });
    const data = r.load();
    expect(data.levels).toEqual({ 'level-01': { bestStars: 2, bestScore: 800 } });
    // unlockedCount is rebuilt from wins: level-01 won → level-02 open.
    expect(data.unlockedCount).toBe(2);
    expect(data.tutorialsSeen).toEqual(['tutorial-line']);
    expect(r.lastError?.kind).toBe('recovered');
    expect(storage.getItem(PROGRESS_BACKUP_KEY)).toBe(raw);
  });

  it('handles an unknown schemaVersion by backing up and recovering compatible parts', () => {
    const raw = JSON.stringify({
      schemaVersion: 7,
      levels: { 'level-01': { bestStars: 3, bestScore: 1500 }, 'level-02': { stars: 2 } },
      unlockedCount: 2,
      somethingNew: true,
    });
    const { repo: r, storage } = repo({ [PROGRESS_KEY]: raw });
    const data = r.load();
    expect(data.schemaVersion).toBe(1);
    expect(data.levels).toEqual({ 'level-01': { bestStars: 3, bestScore: 1500 } });
    expect(data.unlockedCount).toBe(2);
    expect(r.lastError?.kind).toBe('unknownSchema');
    expect(storage.getItem(PROGRESS_BACKUP_KEY)).toBe(raw);
    expect(JSON.parse(storage.getItem(PROGRESS_KEY)!).schemaVersion).toBe(1);
  });

  it('treats non-object JSON as corrupted', () => {
    const { repo: r, storage } = repo({ [PROGRESS_KEY]: '[1,2,3]' });
    expect(r.load()).toEqual(createDefaultProgress());
    expect(r.lastError?.kind).toBe('corrupted');
    expect(storage.getItem(PROGRESS_BACKUP_KEY)).toBe('[1,2,3]');
  });

  it('round-trips a saved game and clears it', () => {
    const { repo: r } = repo();
    const game = savedGame('level-03');
    expect(r.saveGame(game)).toBe(true);
    expect(r.loadSavedGame('level-03')).toEqual(game);
    expect(r.loadSavedGame('level-04')).toBeNull();
    r.clearSavedGame('level-03');
    expect(r.loadSavedGame('level-03')).toBeNull();
    expect(r.lastError).toBeNull();
  });

  it('discards a corrupted saved game with a backup instead of throwing', () => {
    const key = SAVE_KEY_PREFIX + 'level-02';
    const { repo: r, storage } = repo({ [key]: '{oops' });
    expect(r.loadSavedGame('level-02')).toBeNull();
    expect(r.lastError?.kind).toBe('saveCorrupted');
    expect(storage.getItem(key)).toBeNull();
    expect(storage.getItem(SAVE_BACKUP_KEY_PREFIX + 'level-02')).toBe('{oops');
  });

  it('rejects a saved game stored under another level id', () => {
    const key = SAVE_KEY_PREFIX + 'level-02';
    const { repo: r } = repo({ [key]: JSON.stringify(savedGame('level-09')) });
    expect(r.loadSavedGame('level-02')).toBeNull();
    expect(r.lastError?.kind).toBe('saveCorrupted');
  });

  it('discards an outdated saved game when versions are expected', () => {
    const key = SAVE_KEY_PREFIX + 'level-05';
    const raw = JSON.stringify(savedGame('level-05', { rulesVersion: 0 }));
    const { repo: r, storage } = repo({ [key]: raw });
    expect(r.loadSavedGame('level-05', { rulesVersion: 1, levelVersion: 1 })).toBeNull();
    expect(r.lastError?.kind).toBe('saveOutdated');
    expect(storage.getItem(SAVE_BACKUP_KEY_PREFIX + 'level-05')).toBe(raw);
  });

  it('reports failed writes without throwing and keeps in-memory progress', () => {
    const base = createMemoryStorage();
    const failing: KeyValueStorage = {
      getItem: (k) => base.getItem(k),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: (k) => base.removeItem(k),
    };
    const r = new LocalStorageProgressRepository(failing, LEVEL_IDS);
    expect(() => r.recordResult('level-01', 2, 100)).not.toThrow();
    expect(r.lastError?.kind).toBe('writeFailed');
    expect(r.load().levels['level-01']).toEqual({ bestStars: 2, bestScore: 100 });
    expect(r.saveGame(savedGame('level-01'))).toBe(false);
  });

  it('survives storage that throws on read', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const r = new LocalStorageProgressRepository(throwing, LEVEL_IDS);
    expect(r.load()).toEqual(createDefaultProgress());
    expect(r.lastError?.kind).toBe('storageUnavailable');
    expect(r.loadSavedGame('level-01')).toBeNull();
    expect(() => r.reset()).not.toThrow();
  });

  it('does not lose unlocks when the level list is still empty', () => {
    const raw = JSON.stringify({ schemaVersion: 1, levels: {}, unlockedCount: 6, tutorialsSeen: [] });
    const storage = createMemoryStorage({ [PROGRESS_KEY]: raw });
    const r = new LocalStorageProgressRepository(storage, []);
    expect(r.load().unlockedCount).toBe(6);
  });

  it('reset removes progress and saved games of known levels', () => {
    const { repo: r, storage } = repo();
    r.recordResult('level-01', 3, 100);
    r.saveGame(savedGame('level-02'));
    r.reset();
    expect(r.load()).toEqual(createDefaultProgress());
    expect(storage.getItem(PROGRESS_KEY)).toBeNull();
    expect(storage.getItem(SAVE_KEY_PREFIX + 'level-02')).toBeNull();
  });

  it('reports storageUnavailable for a non-persistent fallback', () => {
    const r = new LocalStorageProgressRepository(createMemoryStorage(), LEVEL_IDS, { persistent: false });
    expect(r.lastError?.kind).toBe('storageUnavailable');
    r.clearError();
    expect(r.lastError).toBeNull();
  });
});
