/**
 * App-wide state: current screen, settings, sound effects and local progress.
 * Screens and the game container read it through `useApp()`.
 */
import { levels } from '@dastakhan/content';
import type { SavedGame } from '@dastakhan/game-core';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createSfx, type Sfx } from '../audio/sfx.ts';
import {
  LocalStorageProgressRepository,
  type ProgressData,
  type ProgressError,
  type ProgressRepository,
  type SavedGameExpectation,
} from '../progress/ProgressRepository.ts';
import { getBrowserStorage } from '../progress/storage.ts';
import { applySettingsToDocument, loadSettings, saveSettings, type Settings } from '../settings/settings.ts';
import { START_SCREEN, screenFromHash, type Screen } from './screens.ts';

/** Progress facade: repository calls that also refresh React state. */
export interface ProgressApi {
  /** Current snapshot (re-rendered on every change). */
  data: ProgressData;
  /** Last recoverable storage problem for the UI to explain, or null. */
  lastError: ProgressError | null;
  clearError(): void;
  recordResult(levelId: string, stars: number, score: number): ProgressData;
  markTutorialSeen(tutorialId: string): ProgressData;
  loadSavedGame(levelId: string, expect?: SavedGameExpectation): SavedGame | null;
  /** False when the save could not be written (lastError explains why). */
  saveGame(game: SavedGame): boolean;
  clearSavedGame(levelId: string): void;
  reset(): ProgressData;
  /** Underlying repository (for a later server-backed implementation). */
  repository: ProgressRepository;
}

export interface AppContextValue {
  screen: Screen;
  navigate(screen: Screen): void;
  settings: Settings;
  setSettings(patch: Partial<Settings>): void;
  sfx: Sfx;
  progress: ProgressApi;
}

const AppContext = createContext<AppContextValue | null>(null);

let navigatedOnce = false;

/** True after the first in-app navigation; screens move focus to their heading only then. */
export function hasNavigated(): boolean {
  return navigatedOnce;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp() must be used inside <AppProvider>.');
  return value;
}

function initialScreen(): Screen {
  if (typeof location !== 'undefined') {
    const fromHash = screenFromHash(location.hash, import.meta.env.DEV);
    if (fromHash) return fromHash;
  }
  return START_SCREEN;
}

/** Button-like controls of the shell that play the 'click' sound. The board is excluded. */
const CLICK_SFX_SELECTOR = '.ui-btn, .ui-icon-btn, .ui-toggle, .scr-level, .scr-tutorial, [data-sfx="click"]';

export function AppProvider({ children }: { children: ReactNode }) {
  const [{ storage, persistent }] = useState(getBrowserStorage);
  const [repository] = useState(
    () => new LocalStorageProgressRepository(storage, levels.map((l) => l.id), { persistent }),
  );
  const [progressData, setProgressData] = useState<ProgressData>(() => repository.load());
  const [progressError, setProgressError] = useState<ProgressError | null>(() => repository.lastError);
  const [settings, setSettingsState] = useState<Settings>(() => {
    const loaded = loadSettings(storage);
    applySettingsToDocument(loaded);
    return loaded;
  });
  const [sfx] = useState(createSfx);
  const [screen, setScreen] = useState<Screen>(initialScreen);

  /* ------------------------------------------------------------ settings */
  useEffect(() => {
    applySettingsToDocument(settings);
    sfx.setEnabled(settings.sound);
  }, [settings, sfx]);

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(storage, next);
        return next;
      });
    },
    [storage],
  );

  /* --------------------------------------------------------------- audio */
  useEffect(() => {
    // Unlock audio only on events that actually grant user activation (not Escape, not a
    // touch pointerdown), so the browser never refuses to start the AudioContext.
    const unlock = () => {
      const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
      if (activation && !activation.isActive) return;
      sfx.unlock();
    };
    const gestureEvents = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target.closest(CLICK_SFX_SELECTOR) : null;
      if (target && !(target as HTMLButtonElement).disabled) sfx.play('click');
    };
    for (const type of gestureEvents) window.addEventListener(type, unlock, true);
    document.addEventListener('click', onClick);
    return () => {
      for (const type of gestureEvents) window.removeEventListener(type, unlock, true);
      document.removeEventListener('click', onClick);
    };
  }, [sfx]);

  /* ---------------------------------------------------------- navigation */
  const navigate = useCallback((next: Screen) => {
    navigatedOnce = true;
    setScreen(next);
    if (typeof window !== 'undefined') {
      if (next.name !== 'layoutDemo' && location.hash.startsWith('#layout-demo')) {
        history.replaceState(null, '', location.pathname + location.search);
      }
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onHash = () => {
      const fromHash = screenFromHash(location.hash, true);
      if (fromHash) setScreen(fromHash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /* ------------------------------------------------------------ progress */
  const progress = useMemo<ProgressApi>(() => {
    const sync = () => {
      setProgressData(repository.load());
      setProgressError(repository.lastError);
    };
    // Reads may happen while another component renders (e.g. a lazy useState initializer);
    // defer the error-state update so the provider is never updated during that render.
    const syncErrorLater = () => queueMicrotask(() => setProgressError(repository.lastError));
    return {
      data: progressData,
      lastError: progressError,
      repository,
      clearError() {
        repository.clearError();
        setProgressError(null);
      },
      recordResult(levelId, stars, score) {
        const data = repository.recordResult(levelId, stars, score);
        sync();
        return data;
      },
      markTutorialSeen(tutorialId) {
        const data = repository.markTutorialSeen(tutorialId);
        sync();
        return data;
      },
      loadSavedGame(levelId, expect) {
        const game = repository.loadSavedGame(levelId, expect);
        syncErrorLater();
        return game;
      },
      saveGame(game) {
        const ok = repository.saveGame(game);
        if (!ok) syncErrorLater();
        return ok;
      },
      clearSavedGame(levelId) {
        repository.clearSavedGame(levelId);
      },
      reset() {
        const data = repository.reset();
        sync();
        return data;
      },
    };
  }, [progressData, progressError, repository]);

  const value = useMemo<AppContextValue>(
    () => ({ screen, navigate, settings, setSettings, sfx, progress }),
    [screen, navigate, settings, setSettings, sfx, progress],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
