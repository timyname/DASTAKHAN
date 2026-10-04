/**
 * Game container: connects game-core, the board renderer, input, saves, tutorials
 * and result dialogs. Rules are evaluated only by game-core; this file decides
 * what to show and where to navigate.
 */
import { getLevel, getTutorial, levels, tutorialAfterLevel, tutorials } from '@dastakhan/content';
import {
  RULES_VERSION,
  createGame,
  createGameFromBoard,
  restoreState,
  serializeState,
  type GameState,
  type LevelDefinition,
  type Move,
  type TutorialDefinition,
} from '@dastakhan/game-core';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../app/AppContext.tsx';
import { nextLevelId, screenAfterLevelWin } from '../app/flow.ts';
import { LEVELS_SCREEN, type Screen } from '../app/screens.ts';
import { Button } from '../components/Button.tsx';
import { ErrorToast } from '../components/ErrorToast.tsx';
import { GameLayout } from '../components/GameLayout.tsx';
import { GuideDialog } from '../components/GuideDialog.tsx';
import { Modal } from '../components/Modal.tsx';
import { PauseMenu } from '../components/PauseMenu.tsx';
import { ResultDialog } from '../components/ResultDialog.tsx';
import { t } from '../i18n/index.ts';
import { tileLabel } from '../i18n/labels.ts';
import { BoardView } from './BoardView.tsx';
import { NORMAL_TIMINGS, REDUCED_TIMINGS } from './timings.ts';
import { useGameSession } from './useGameSession.ts';

export interface GamePageProps {
  mode: 'level' | 'tutorial';
  /** Campaign level id (e.g. "level-01") or tutorial id (e.g. "tutorial-line"). */
  id: string;
}

/** Run seed for a new game. Randomness lives in the UI; game-core stays deterministic. */
function newSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return (Date.now() ^ 0x5f3759df) >>> 0;
  }
}

function sameMove(a: Move, b: Move): boolean {
  const eq = (p: Move['from'], q: Move['from']) => p.row === q.row && p.col === q.col;
  return (eq(a.from, b.from) && eq(a.to, b.to)) || (eq(a.from, b.to) && eq(a.to, b.from));
}

type Setup =
  | { kind: 'level'; level: LevelDefinition; initial: GameState; restored: boolean }
  | { kind: 'tutorial'; tutorial: TutorialDefinition; initial: GameState }
  | { kind: 'missing' };

export function GamePage({ mode, id }: GamePageProps) {
  const { progress } = useApp();
  // Resolve content and the initial state after mount: loading a save may report
  // storage problems to the app state, which must not happen during render.
  const [setup, setSetup] = useState<Setup | null>(null);
  useEffect(() => {
    setSetup(resolveSetup(mode, id, progress));
    // Only once per mounted page; the screen remounts GamePage for another level.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!setup) return null;
  if (setup.kind === 'missing') return <MissingContent mode={mode} />;
  return <GameRun setup={setup} />;
}

function resolveSetup(mode: GamePageProps['mode'], id: string, progress: ReturnType<typeof useApp>['progress']): Setup {
  if (mode === 'tutorial') {
    const tutorial = getTutorial(id);
    if (!tutorial) return { kind: 'missing' };
    return { kind: 'tutorial', tutorial, initial: createGameFromBoard(tutorial.level, tutorial.board, tutorial.seed) };
  }
  const level = getLevel(id);
  if (!level) return { kind: 'missing' };
  const saved = progress.loadSavedGame(level.id, { rulesVersion: RULES_VERSION, levelVersion: level.version });
  if (saved) {
    try {
      const state = restoreState(saved.snapshot);
      if (state.levelId === level.id && state.status === 'playing') return { kind: 'level', level, initial: state, restored: true };
    } catch {
      /* fall through to a fresh game */
    }
    progress.clearSavedGame(level.id);
  }
  return { kind: 'level', level, initial: createGame(level, newSeed()), restored: false };
}

function MissingContent({ mode }: { mode: GamePageProps['mode'] }) {
  const { navigate } = useApp();
  return (
    <Modal
      title={t('error.title')}
      testId="content-missing"
      actions={
        <Button block onClick={() => navigate(LEVELS_SCREEN)}>
          {t('result.exit')}
        </Button>
      }
    >
      <p className="ui-modal__text">{mode === 'tutorial' ? t('error.tutorialNotFound') : t('error.levelNotFound')}</p>
    </Modal>
  );
}

function GameRun({ setup }: { setup: Exclude<Setup, { kind: 'missing' }> }) {
  const { screen, navigate, settings, setSettings, sfx, progress } = useApp();
  const [paused, setPaused] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const isTutorial = setup.kind === 'tutorial';
  const tutorial = setup.kind === 'tutorial' ? setup.tutorial : null;
  const level = setup.kind === 'level' ? setup.level : setup.tutorial.level;

  const saveStable = useCallback(
    (state: GameState) => {
      if (setup.kind !== 'level') return;
      if (state.status === 'playing') {
        progress.saveGame({
          schemaVersion: 1,
          rulesVersion: state.rulesVersion,
          levelId: state.levelId,
          levelVersion: state.levelVersion,
          seed: state.seed,
          snapshot: serializeState(state),
        });
      } else {
        progress.clearSavedGame(state.levelId);
      }
    },
    [setup.kind, progress],
  );

  // Tutorial: the current step is the number of moves already made.
  const stepIndexRef = useRef(0);
  const allowMove = useMemo(() => {
    if (!tutorial) return undefined;
    return (move: Move) => {
      const step = tutorial.steps[stepIndexRef.current];
      return !!step && sameMove(step.move, move);
    };
  }, [tutorial]);

  const session = useGameSession(setup.initial, {
    timings: settings.reducedMotion ? REDUCED_TIMINGS : NORMAL_TIMINGS,
    sfx: (name) => sfx.play(name),
    onStable: saveStable,
    allowMove,
    locked: paused || guideOpen,
  });

  const { state, phase } = session;
  const stepIndex = state.moveLog.length;
  stepIndexRef.current = stepIndex;
  const tutorialStep = tutorial && phase === 'idle' ? tutorial.steps[stepIndex] ?? null : null;
  const tutorialDone = !!tutorial && phase === 'idle' && stepIndex >= tutorial.steps.length;
  const finished = !isTutorial && phase === 'idle' && state.status !== 'playing';

  // Record results exactly once per finished game.
  const recorded = useRef<GameState | null>(null);
  useEffect(() => {
    if (!finished || recorded.current === state) return;
    recorded.current = state;
    if (state.status === 'won') {
      progress.recordResult(state.levelId, state.stars, state.score);
      sfx.play('win');
      // Demo presentation hook only; production rewards require server verification.
      window.dispatchEvent(new CustomEvent('dastakhan:game-won', { detail: { levelId: state.levelId, score: state.score, movesLeft: state.movesLeft } }));
    } else {
      sfx.play('lose');
    }
    progress.clearSavedGame(state.levelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, state]);

  // Escape opens the pause menu (the board consumes Escape while a piece is selected).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !paused && !guideOpen && !finished && !tutorialDone) setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, guideOpen, finished, tutorialDone]);

  const restart = useCallback(() => {
    setPaused(false);
    if (setup.kind === 'level') {
      progress.clearSavedGame(setup.level.id);
      session.reset(createGame(setup.level, newSeed()));
    } else {
      session.reset(createGameFromBoard(setup.tutorial.level, setup.tutorial.board, setup.tutorial.seed));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, session.reset, progress]);

  const leaveTutorial = useCallback(() => {
    if (!tutorial) return;
    progress.markTutorialSeen(tutorial.id);
    const next: Screen = screen.name === 'tutorial' && screen.next ? screen.next : LEVELS_SCREEN;
    navigate(next);
  }, [tutorial, progress, screen, navigate]);

  const afterWin = useCallback(
    (target: Screen) =>
      navigate(screenAfterLevelWin(state.levelId, progress.data.tutorialsSeen, tutorialAfterLevel, tutorials, target)),
    [navigate, state.levelId, progress.data.tutorialsSeen],
  );

  const exit = useCallback(() => {
    if (isTutorial) leaveTutorial();
    else if (state.status === 'won') afterWin(LEVELS_SCREEN);
    else navigate(LEVELS_SCREEN);
  }, [isTutorial, leaveTutorial, state.status, afterWin, navigate]);

  const title = tutorial ? t(tutorial.titleKey) : t('levels.level', { n: levels.findIndex((l) => l.id === level.id) + 1 });

  let hint: ReactNode = null;
  if (tutorial && tutorialStep) {
    hint = (
      <span className="gp-tutorial-hint">
        <span className="gp-step">{t('tutorial.step', { n: stepIndex + 1, total: tutorial.steps.length })}</span>{' '}
        {t(tutorialStep.textKey)}{' '}
        <Button variant="ghost" onClick={leaveTutorial} data-testid="tutorial-skip">
          {t('tutorial.skip')}
        </Button>
      </span>
    );
  } else if (session.banner) {
    hint = <strong data-testid="banner">{t(`combo.${session.banner}`)}</strong>;
  } else if (session.combo) {
    hint = <strong data-testid="combo">{t('combo.cascade', { n: session.combo.multiplier })}</strong>;
  } else if (session.hint) {
    hint = <span data-testid="hint-text">{t('hint.text')}</span>;
  }

  const next = setup.kind === 'level' ? nextLevelId(levels, setup.level.id) : null;

  let overlay: ReactNode = null;
  if (tutorialDone && tutorial) {
    overlay = (
      <Modal
        title={t(tutorial.titleKey)}
        testId="tutorial-done"
        actions={
          <Button size="lg" block onClick={leaveTutorial} data-autofocus>
            {t('tutorial.finish')}
          </Button>
        }
      >
        <p className="ui-modal__text">{t(tutorial.doneTextKey)}</p>
      </Modal>
    );
  } else if (finished) {
    overlay = (
      <ResultDialog
        kind={state.status === 'won' ? 'win' : 'lose'}
        stars={state.stars}
        score={state.score}
        goals={state.goals}
        onNext={state.status === 'won' && next ? () => afterWin({ name: 'game', levelId: next }) : undefined}
        onReplay={restart}
        onExit={exit}
      />
    );
  } else if (guideOpen) {
    overlay = <GuideDialog onClose={() => setGuideOpen(false)} />;
  } else if (paused) {
    overlay = (
      <PauseMenu
        onResume={() => setPaused(false)}
        onRestart={restart}
        onGuide={() => {
          setPaused(false);
          setGuideOpen(true);
        }}
        onExit={exit}
        sound={settings.sound}
        onSoundChange={(sound) => setSettings({ sound })}
        reducedMotion={settings.reducedMotion}
        onReducedMotionChange={(reducedMotion) => setSettings({ reducedMotion })}
      />
    );
  }

  const interactive = phase === 'idle' && !paused && !guideOpen && state.status === 'playing' && !tutorialDone;

  return (
    <>
      <GameLayout
        title={title}
        badge={tutorial ? t('tutorial.badge') : undefined}
        movesLeft={state.movesLeft}
        goals={state.goals}
        score={session.displayScore}
        hint={hint}
        onPause={() => setPaused(true)}
        onHelp={() => setGuideOpen(true)}
        overlay={overlay}
        board={
          <BoardView
            scene={session.scene}
            interactive={interactive}
            selected={session.selected}
            cursor={session.cursor}
            hint={session.hint}
            guide={tutorialStep ? tutorialStep.move : null}
            reducedMotion={settings.reducedMotion}
            ariaLabel={t('hud.board')}
            labelFor={tileLabel}
            onSelect={session.setSelected}
            onSwap={session.swap}
            onCursor={session.setCursor}
            onActivity={session.activity}
          />
        }
      />
      {session.technicalError && <ErrorToast message={t('error.technical')} onDismiss={session.dismissError} />}
    </>
  );
}
