/**
 * Test play of the edited level: a real game-core game rendered with the shared
 * BoardView + useGameSession (read-only reuse). No saves, no progress, no sound.
 */
import type { FoodType, GameState, SpecialKind } from '@dastakhan/game-core';
import { FoodIcon } from '../art/TileArt.tsx';
import { BoardView } from '../game/BoardView.tsx';
import { NORMAL_TIMINGS } from '../game/timings.ts';
import { useGameSession } from '../game/useGameSession.ts';

const noop = () => undefined;

function labelFor(base: FoodType | null, special: SpecialKind | null): string {
  if (!special) return base ?? '';
  return base ? `${special} (${base})` : special;
}

export interface TestPlayProps {
  /** Fresh state from createGame(level, seed); remount (key) to restart. */
  initial: GameState;
  seed: number;
}

export function TestPlay({ initial, seed }: TestPlayProps) {
  const session = useGameSession(initial, { timings: NORMAL_TIMINGS, sfx: noop, locked: false });
  const { state } = session;
  const interactive = session.phase === 'idle' && state.status === 'playing';

  let status = 'playing';
  if (session.phase === 'animating') status = 'resolving…';
  else if (state.status === 'won') status = `won — ${state.stars} star${state.stars === 1 ? '' : 's'}`;
  else if (state.status === 'lost') status = 'lost';

  return (
    <div className="ed-play" data-testid="test-play">
      <dl className="ed-hud">
        <div>
          <dt>Seed</dt>
          <dd>{seed}</dd>
        </div>
        <div>
          <dt>Moves left</dt>
          <dd data-testid="play-moves">
            {state.movesLeft} / {state.moveLimit}
          </dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{session.displayScore}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd data-testid="play-status" data-status={state.status}>
            {status}
          </dd>
        </div>
      </dl>
      <ul className="ed-play-goals">
        {state.goals.map((goal, i) => (
          <li key={i} className={goal.done >= goal.count ? 'is-done' : undefined}>
            {goal.kind === 'collect' ? <FoodIcon type={goal.type} size={22} label={goal.type} /> : <span className="ed-crumb-dot" aria-hidden="true" />}
            <span>
              {goal.kind === 'collect' ? goal.type : 'crumbs'} {goal.done}/{goal.count}
            </span>
          </li>
        ))}
      </ul>
      <div className="ed-board">
        <BoardView
          scene={session.scene}
          interactive={interactive}
          selected={session.selected}
          cursor={session.cursor}
          hint={session.hint}
          guide={null}
          reducedMotion={false}
          ariaLabel="Test play board"
          labelFor={labelFor}
          onSelect={session.setSelected}
          onSwap={session.swap}
          onCursor={session.setCursor}
          onActivity={session.activity}
        />
      </div>
      <p className="ed-play-note" aria-live="polite">
        {session.banner ? `Banner: ${session.banner}` : session.combo ? `Cascade ×${session.combo.multiplier}` : ' '}
      </p>
      {session.technicalError && (
        <p className="ed-error" role="alert">
          Technical error: {session.technicalError}{' '}
          <button type="button" className="ed-btn ed-btn-small" onClick={session.dismissError}>
            Dismiss
          </button>
        </p>
      )}
    </div>
  );
}
