import { levels } from '@dastakhan/content';
import { FOOD_TYPES } from '@dastakhan/game-core';
import { useEffect, useRef } from 'react';
import { hasNavigated, useApp } from '../app/AppContext.tsx';
import { continueLevelId, levelNumber } from '../app/flow.ts';
import { FoodIcon } from '../art/TileArt.tsx';
import { Button } from '../components/Button.tsx';
import { t } from '../i18n/index.ts';
import './screens.css';

export function StartScreen() {
  const { navigate, progress } = useApp();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { unlockedCount, levels: records } = progress.data;
  const hasProgress = unlockedCount > 1 || Object.keys(records).length > 0;
  const targetId = continueLevelId(levels, unlockedCount);

  useEffect(() => {
    if (hasNavigated()) headingRef.current?.focus({ preventScroll: true });
  }, []);

  const play = () => {
    if (targetId) navigate({ name: 'game', levelId: targetId });
    else navigate({ name: 'levels' });
  };

  return (
    <main className="scr scr-start" data-testid="start-screen">
      <div className="start-hero">
        <div className="start-ornament" aria-hidden="true" />
        <h1 ref={headingRef} tabIndex={-1} className="start-title">
          {t('app.title')}
        </h1>
        <p className="start-tagline">{t('app.tagline')}</p>
        <div className="start-foods" aria-hidden="true">
          {FOOD_TYPES.map((type) => (
            <span key={type} className="start-food">
              <FoodIcon type={type} size={30} />
            </span>
          ))}
        </div>
        <div className="start-ornament start-ornament--bottom" aria-hidden="true" />
      </div>

      <nav className="start-menu" aria-label={t('app.title')}>
        <Button size="lg" icon="play" block onClick={play} data-testid="play-button">
          {hasProgress && targetId ? (
            <span className="start-play">
              {t('start.continue')}
              <small>{t('start.continueLevel', { n: levelNumber(levels, targetId) })}</small>
            </span>
          ) : (
            t('start.play')
          )}
        </Button>
        <Button variant="secondary" icon="levels" block onClick={() => navigate({ name: 'levels' })}>
          {t('start.levels')}
        </Button>
        <Button variant="secondary" icon="book" block onClick={() => navigate({ name: 'guide', back: { name: 'start' } })}>
          {t('start.guide')}
        </Button>
        <Button variant="ghost" icon="settings" block onClick={() => navigate({ name: 'settings', back: { name: 'start' } })}>
          {t('start.settings')}
        </Button>
      </nav>

      <p className="start-note">{t('app.localNote')}</p>
    </main>
  );
}
