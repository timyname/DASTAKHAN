/**
 * Presentational gameplay layout (no game logic). Mobile: compact HUD, goals row,
 * a square board slot sized to min(available width, available height), hint + help.
 * Desktop ≥ 900 px and short landscape: board with a side panel for goals/help.
 */
import type { GoalProgress } from '@dastakhan/game-core';
import { useId, type ReactNode, type Ref } from 'react';
import { formatNumber, t } from '../i18n/index.ts';
import { goalProgressLabel, goalRemaining, goalShortLabel, goalsSummary } from '../i18n/labels.ts';
import { GoalIcon } from './GoalIcon.tsx';
import { Icon } from './Icon.tsx';
import { IconButton } from './IconButton.tsx';
import './GameLayout.css';

export interface GameLayoutProps {
  /** Level title, e.g. «Уровень 3» or a tutorial title. */
  title: string;
  movesLeft: number;
  goals: GoalProgress[];
  score: number;
  /** The board renderer; it fills the square slot (100% × 100%). */
  board: ReactNode;
  /** Short hint / combo label shown below the board (e.g. «Каскад ×3», tutorial step text). */
  hint?: ReactNode;
  onPause(): void;
  onHelp(): void;
  /** Dialogs or overlays (PauseMenu, ResultDialog, …). */
  overlay?: ReactNode;
  /** Optional small badge above the title, e.g. «Обучение». */
  badge?: string;
  /** Optional ref to the square board slot element. */
  boardSlotRef?: Ref<HTMLDivElement>;
}

export function GameLayout({ title, movesLeft, goals, score, board, hint, onPause, onHelp, overlay, badge, boardSlotRef }: GameLayoutProps) {
  const goalsTitleId = useId();
  return (
    <div className="gl" data-testid="game-layout">
      <header className="gl-hud">
        <IconButton icon="pause" label={t('hud.pause')} onClick={onPause} className="gl-pause" data-testid="pause-button" />
        <div className="gl-titles">
          {badge && <span className="gl-badge">{badge}</span>}
          <h1 className="gl-title">{title}</h1>
          <p className="gl-score" data-testid="score">
            {t('hud.score')}: <b>{formatNumber(score)}</b>
          </p>
        </div>
        <p className="gl-moves" data-low={movesLeft <= 3} data-testid="moves-left">
          <span className="sr-only">{t('hud.movesAria', { n: movesLeft })}</span>
          <span className="gl-moves__label" aria-hidden="true">
            {t('hud.moves')}
          </span>
          <span className="gl-moves__value" aria-hidden="true">
            {movesLeft}
          </span>
        </p>
      </header>

      <section className="gl-goals" aria-labelledby={goalsTitleId} data-testid="goals">
        <h2 id={goalsTitleId} className="gl-panel-title">
          {t('hud.goals')}
        </h2>
        <ul className="gl-goal-list">
          {goals.map((goal, i) => {
            const left = goalRemaining(goal);
            const done = left === 0;
            return (
              <li key={i} className="gl-goal" data-done={done}>
                <span className="gl-goal__icon">
                  <GoalIcon goal={goal} size={28} />
                </span>
                <span className="gl-goal__name" aria-hidden="true">
                  {goalShortLabel(goal)}
                </span>
                <span className="gl-goal__count" aria-hidden="true">
                  {done ? <Icon name="check" size={18} /> : left}
                </span>
                <span className="sr-only">{goalProgressLabel(goal)}</span>
              </li>
            );
          })}
        </ul>
        <p className="sr-only" aria-live="polite">
          {goalsSummary(goals)}
        </p>
      </section>

      <div className="gl-board-area">
        <div className="gl-board-slot" data-testid="board-slot" ref={boardSlotRef}>
          {board}
        </div>
      </div>

      <footer className="gl-footer">
        <div className="gl-hint" aria-live="polite" data-testid="hint">
          {hint}
        </div>
        <IconButton icon="help" label={t('hud.help')} tone="gold" onClick={onHelp} data-testid="help-button" />
      </footer>

      {overlay && <div className="gl-overlay">{overlay}</div>}
    </div>
  );
}
