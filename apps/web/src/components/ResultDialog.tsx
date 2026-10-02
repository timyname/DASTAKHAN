import type { GoalProgress } from '@dastakhan/game-core';
import { formatNumber, t } from '../i18n/index.ts';
import { goalRemaining, goalShortLabel } from '../i18n/labels.ts';
import { Button } from './Button.tsx';
import { GoalIcon } from './GoalIcon.tsx';
import { Icon } from './Icon.tsx';
import { Modal } from './Modal.tsx';
import { Stars } from './Stars.tsx';

export interface ResultDialogProps {
  kind: 'win' | 'lose';
  /** Stars from the engine (0 on defeat). */
  stars: number;
  score: number;
  goals: GoalProgress[];
  /** Win only; omit on the last level. */
  onNext?(): void;
  onReplay(): void;
  onExit(): void;
}

/**
 * End-of-level dialog. Win: animated stars (static under reduced motion), score,
 * goals, next level. Lose: goals left and replay — no purchases or extra moves.
 * Not dismissable with Escape; the player picks an action.
 */
export function ResultDialog({ kind, stars, score, goals, onNext, onReplay, onExit }: ResultDialogProps) {
  const win = kind === 'win';
  return (
    <Modal
      title={win ? t('result.winTitle') : t('result.loseTitle')}
      className={win ? 'ui-result ui-result--win' : 'ui-result ui-result--lose'}
      testId={win ? 'result-win' : 'result-lose'}
      actions={
        <>
          {win && onNext && (
            <Button size="lg" icon="next" block onClick={onNext} data-autofocus>
              {t('result.next')}
            </Button>
          )}
          <Button
            variant={win ? 'secondary' : 'primary'}
            size={win ? 'md' : 'lg'}
            icon="restart"
            block
            onClick={onReplay}
            data-autofocus={!win || !onNext ? true : undefined}
          >
            {win ? t('result.replay') : t('result.retry')}
          </Button>
          <Button variant="ghost" icon="levels" block onClick={onExit}>
            {t('result.exit')}
          </Button>
        </>
      }
    >
      {win ? (
        <div className="ui-result__stars">
          <Stars count={stars} size={56} animated large />
        </div>
      ) : (
        <p className="ui-modal__text">{t('result.loseText')}</p>
      )}
      <p className="ui-result__score">{t('result.score', { score: formatNumber(score) })}</p>
      <div className="ui-result__goals">
        <h3 className="ui-result__goals-title">{t('result.goals')}</h3>
        <ul className="ui-result__goal-list">
          {goals.map((goal, i) => {
            const left = goalRemaining(goal);
            return (
              <li key={i} className="ui-result__goal" data-done={left === 0}>
                <GoalIcon goal={goal} size={28} />
                <span className="ui-result__goal-name">{goalShortLabel(goal)}</span>
                <span className="ui-result__goal-state">
                  {left === 0 ? (
                    <>
                      <Icon name="check" size={18} />
                      {t('result.goalDone')}
                    </>
                  ) : (
                    t('result.goalLeft', { n: left })
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
