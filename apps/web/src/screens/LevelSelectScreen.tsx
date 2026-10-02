import { levels, tutorials } from '@dastakhan/content';
import type { FoodType } from '@dastakhan/game-core';
import { useMemo } from 'react';
import { useApp } from '../app/AppContext.tsx';
import { newDishesByLevel } from '../app/flow.ts';
import { FoodIcon } from '../art/TileArt.tsx';
import { Icon } from '../components/Icon.tsx';
import { Stars } from '../components/Stars.tsx';
import { t } from '../i18n/index.ts';
import { foodLabel } from '../i18n/labels.ts';
import { ScreenFrame } from './ScreenFrame.tsx';

function newDishText(types: FoodType[]): string {
  return types.length === 1
    ? t('levels.newDish', { food: foodLabel(types[0]) })
    : t('levels.newDishes', { foods: types.map(foodLabel).join(', ') });
}

export function LevelSelectScreen() {
  const { navigate, progress } = useApp();
  const { unlockedCount, levels: records, tutorialsSeen } = progress.data;
  const totalStars = levels.reduce((sum, l) => sum + (records[l.id]?.bestStars ?? 0), 0);
  const newDishes = useMemo(() => newDishesByLevel(levels), []);
  const currentIndex = Math.min(unlockedCount, levels.length) - 1;
  const current = levels[currentIndex];
  const currentWon = current ? (records[current.id]?.bestStars ?? 0) > 0 : true;
  const currentNew = current && !currentWon ? newDishes[current.id] : undefined;

  return (
    <ScreenFrame title={t('levels.title')} onBack={() => navigate({ name: 'start' })} testId="levels-screen">
      <section className="scr-panel" aria-labelledby="levels-summary">
        {levels.length === 0 ? (
          <p className="scr-empty">{t('levels.empty')}</p>
        ) : (
          <>
            <p id="levels-summary" className="levels-summary">
              <Stars count={1} max={1} size={20} onDark />
              <span>{t('levels.starsSummary', { n: totalStars, max: levels.length * 3 })}</span>
            </p>
            {currentNew && (
              <p className="levels-new" data-testid="new-dish-callout">
                <span className="levels-new__icons" aria-hidden="true">
                  {currentNew.map((type) => (
                    <span key={type} className="levels-new__icon">
                      <FoodIcon type={type} size={26} />
                    </span>
                  ))}
                </span>
                <span>
                  {t('levels.level', { n: currentIndex + 1 })}. {newDishText(currentNew)}
                </span>
              </p>
            )}
            <ol className="levels-grid">
              {levels.map((level, index) => {
                const n = index + 1;
                const locked = index >= unlockedCount;
                const record = records[level.id];
                const won = (record?.bestStars ?? 0) > 0;
                const isCurrent = !locked && !won && index === currentIndex;
                const fresh = newDishes[level.id];
                const base = locked
                  ? t('levels.lockedAria', { n })
                  : won
                    ? t('levels.levelAria', { n, stars: record!.bestStars })
                    : t('levels.levelNewAria', { n });
                const label = fresh ? `${base}. ${newDishText(fresh)}` : base;
                return (
                  <li key={level.id}>
                    <button
                      type="button"
                      className="scr-level"
                      data-state={locked ? 'locked' : won ? 'won' : isCurrent ? 'current' : 'open'}
                      disabled={locked}
                      aria-label={label}
                      title={fresh ? newDishText(fresh) : undefined}
                      onClick={() => navigate({ name: 'game', levelId: level.id })}
                      data-testid={`level-${n}`}
                    >
                      <span className="scr-level__num" aria-hidden="true">
                        {n}
                      </span>
                      <span className="scr-level__meta" aria-hidden="true">
                        {locked ? (
                          <Icon name="lock" size={18} />
                        ) : won ? (
                          <Stars count={record!.bestStars} size={14} />
                        ) : isCurrent ? (
                          <span className="scr-level__play">{t('levels.current')}</span>
                        ) : (
                          <Stars count={0} size={14} />
                        )}
                      </span>
                      {fresh && (
                        <span className="scr-level__new" aria-hidden="true">
                          <FoodIcon type={fresh[0]} size={18} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      <section className="scr-panel" aria-labelledby="tutorials-title">
        <h2 id="tutorials-title" className="scr-panel__title">
          {t('levels.tutorials')}
        </h2>
        <p className="scr-panel__hint">{t('levels.tutorialsHint')}</p>
        {tutorials.length === 0 ? (
          <p className="scr-empty">{t('levels.tutorialsEmpty')}</p>
        ) : (
          <ul className="tutorial-list">
            {tutorials.map((tutorial) => {
              const seen = tutorialsSeen.includes(tutorial.id);
              return (
                <li key={tutorial.id}>
                  <button
                    type="button"
                    className="scr-tutorial"
                    onClick={() => navigate({ name: 'tutorial', tutorialId: tutorial.id, next: { name: 'levels' } })}
                    data-testid={tutorial.id}
                  >
                    <Icon name="book" />
                    <span className="scr-tutorial__title">{t(tutorial.titleKey)}</span>
                    {seen && (
                      <span className="scr-tutorial__seen">
                        <Icon name="check" size={16} />
                        {t('levels.tutorialSeen')}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </ScreenFrame>
  );
}
