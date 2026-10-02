import { useCallback, useEffect, useRef, useState } from 'react';
import { applyMove, getLegalMoves, type GameState, type Move, type Pos } from '@dastakhan/game-core';
import { playEvents, type Banner, type SfxName } from './player.ts';
import { sceneFromState, tileAt, type Scene } from './scene.ts';
import type { Timings } from './timings.ts';

export const HINT_DELAY_MS = 5000;

export interface GameSessionOptions {
  timings: Timings;
  sfx(name: SfxName): void;
  /** Called with every new stable state (after a legal move) — used for saves. */
  onStable?(state: GameState): void;
  /** Tutorial filter: return false to block a swap (plays a rejection wobble, engine untouched). */
  allowMove?(move: Move): boolean;
  /** Input locked from outside (pause menu, dialogs). */
  locked: boolean;
}

export type SessionPhase = 'idle' | 'animating';

export interface GameSession {
  state: GameState;
  scene: Scene;
  phase: SessionPhase;
  /** Score shown in the HUD; follows tilesRemoved events during animations. */
  displayScore: number;
  combo: { wave: number; multiplier: number } | null;
  /** Banner for the last big moment (cleared on the next swap). */
  banner: Banner | null;
  selected: Pos | null;
  cursor: Pos | null;
  hint: Move | null;
  technicalError: string | null;
  setSelected(pos: Pos | null): void;
  setCursor(pos: Pos): void;
  swap(move: Move): void;
  /** Replace the game (restart / restore). Cancels running animations. */
  reset(state: GameState): void;
  /** Marks user activity: hides the hint and restarts its timer. */
  activity(): void;
  dismissError(): void;
}

/** Preferred hint: a pair of universal specials, then any RAM/BESH swap, then the first legal move. */
export function pickHint(state: GameState): Move | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;
  const universal = (p: Pos) => {
    const k = state.board[p.row]?.[p.col]?.special ?? null;
    return k === 'RAM' || k === 'BESH';
  };
  return (
    moves.find((m) => universal(m.from) && universal(m.to)) ??
    moves.find((m) => universal(m.from) || universal(m.to)) ??
    moves[0]!
  );
}

/**
 * Game session controller: owns the stable engine state, the visual scene and the
 * idle/animating phase. Input is accepted only in idle; every legal move is resolved
 * by game-core and the resulting events are replayed visually.
 */
export function useGameSession(initial: GameState, options: GameSessionOptions): GameSession {
  const [state, setState] = useState(initial);
  const [scene, setSceneState] = useState(() => sceneFromState(initial));
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [displayScore, setDisplayScore] = useState(initial.score);
  const [combo, setCombo] = useState<GameSession['combo']>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [cursor, setCursorState] = useState<Pos | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [activityTick, setActivityTick] = useState(0);

  const sceneRef = useRef(scene);
  const stateRef = useRef(state);
  const phaseRef = useRef<SessionPhase>('idle');
  const generation = useRef(0);
  const opts = useRef(options);
  opts.current = options;

  const setScene = useCallback((s: Scene) => {
    sceneRef.current = s;
    setSceneState(s);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Unmount cancels any running animation.
  useEffect(() => {
    return () => {
      generation.current++;
    };
  }, []);

  const reset = useCallback(
    (next: GameState) => {
      generation.current++;
      phaseRef.current = 'idle';
      stateRef.current = next;
      setState(next);
      setScene(sceneFromState(next));
      setPhase('idle');
      setDisplayScore(next.score);
      setCombo(null);
      setBanner(null);
      setSelected(null);
      setHint(null);
      setTechnicalError(null);
    },
    [setScene],
  );

  const swap = useCallback(
    (move: Move) => {
      if (phaseRef.current !== 'idle' || opts.current.locked) return;
      const current = stateRef.current;
      if (current.status !== 'playing') return;
      setHint(null);
      setSelected(null);
      setBanner(null);
      const gen = ++generation.current;
      const skip = () => generation.current !== gen || document.hidden;
      const api = {
        getScene: () => sceneRef.current,
        setScene: (s: Scene) => {
          if (generation.current === gen) setScene(s);
        },
        timings: opts.current.timings,
        sfx: (name: SfxName) => {
          if (!skip()) opts.current.sfx(name);
        },
        onWave: (wave: number, multiplier: number) => setCombo(wave > 1 ? { wave, multiplier } : null),
        onScoreDelta: (delta: number) => setDisplayScore((s) => s + delta),
        onBanner: (b: Banner) => setBanner(b),
        skip,
      };
      phaseRef.current = 'animating';
      setPhase('animating');

      const finish = (next: GameState) => {
        if (generation.current !== gen) return;
        phaseRef.current = 'idle';
        setPhase('idle');
        setScene(sceneFromState(next));
        setDisplayScore(next.score);
        setCombo(null);
        setActivityTick((n) => n + 1);
      };

      // Tutorial-blocked swap: wobble only, the engine is not consulted.
      if (opts.current.allowMove && !opts.current.allowMove(move)) {
        const a = tileAt(sceneRef.current, move.from);
        const b = tileAt(sceneRef.current, move.to);
        void playEvents(
          a && b ? [{ type: 'swapRejected', from: move.from, to: move.to, tileA: a.id, tileB: b.id, reason: 'noMatch' }] : [],
          api,
        ).then(() => finish(current));
        return;
      }

      const result = applyMove(current, move);
      if (!result.ok && result.reason === 'technicalError') {
        const ev = result.events.find((e) => e.type === 'technicalError');
        setTechnicalError(ev && ev.type === 'technicalError' ? ev.message : 'technicalError');
        finish(current);
        return;
      }
      if (result.ok) {
        // The resulting state is stable already: persist it before the animation.
        stateRef.current = result.state;
        opts.current.onStable?.(result.state);
      }
      void playEvents(result.events, api)
        .catch(() => undefined)
        .then(() => {
          if (generation.current !== gen) return;
          if (result.ok) setState(result.state);
          finish(result.ok ? result.state : current);
        });
    },
    [setScene],
  );

  // Hint after HINT_DELAY_MS of idle time.
  useEffect(() => {
    if (phase !== 'idle' || options.locked || state.status !== 'playing') return;
    const timer = setTimeout(() => setHint(pickHint(stateRef.current)), HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, options.locked, state, activityTick]);

  const activity = useCallback(() => {
    setHint(null);
    setActivityTick((n) => n + 1);
  }, []);

  const setCursor = useCallback((pos: Pos) => setCursorState(pos), []);
  const dismissError = useCallback(() => setTechnicalError(null), []);

  return {
    state,
    scene,
    phase,
    displayScore,
    combo,
    banner,
    selected,
    cursor,
    hint,
    technicalError,
    setSelected,
    setCursor,
    swap,
    reset,
    activity,
    dismissError,
  };
}
