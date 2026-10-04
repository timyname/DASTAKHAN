import { levels, tutorials } from '@dastakhan/content';
import { Suspense, lazy, useEffect, type CSSProperties } from 'react';
import { AppProvider, useApp } from './app/AppContext.tsx';
import { levelNumber } from './app/flow.ts';
import type { Screen } from './app/screens.ts';
import { ErrorToast, progressErrorMessage } from './components/ErrorToast.tsx';
import { t } from './i18n/index.ts';
import { GameScreen, TutorialScreen } from './screens/GameScreen.tsx';
import { GuideScreen } from './screens/GuideScreen.tsx';
import { LevelSelectScreen } from './screens/LevelSelectScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';

/** DEV-only layout preview; excluded from production bundles. */
const LayoutDemoScreen = import.meta.env.DEV ? lazy(() => import('./screens/LayoutDemoScreen.tsx')) : null;

function screenTitle(screen: Screen): string | null {
  switch (screen.name) {
    case 'levels':
      return t('levels.title');
    case 'game':
      return t('levels.level', { n: levelNumber(levels, screen.levelId) });
    case 'tutorial': {
      const tutorial = tutorials.find((tut) => tut.id === screen.tutorialId);
      return tutorial ? t(tutorial.titleKey) : t('tutorial.badge');
    }
    case 'guide':
      return t('guide.title');
    case 'settings':
      return t('settings.title');
    default:
      return null;
  }
}

function ScreenView({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'start':
      return <StartScreen />;
    case 'levels':
      return <LevelSelectScreen />;
    case 'game':
      return <GameScreen levelId={screen.levelId} />;
    case 'tutorial':
      return <TutorialScreen tutorialId={screen.tutorialId} />;
    case 'guide':
      return <GuideScreen back={screen.back} />;
    case 'settings':
      return <SettingsScreen back={screen.back} />;
    case 'layoutDemo':
      return LayoutDemoScreen ? (
        <Suspense fallback={<p className="sr-only">{t('app.loading')}</p>}>
          <LayoutDemoScreen key={screen.variant ?? ''} variant={screen.variant} />
        </Suspense>
      ) : (
        <StartScreen />
      );
  }
}

function AppShell({ cafeMode = false }: { cafeMode?: boolean }) {
  const { screen, progress, navigate } = useApp();

  useEffect(() => {
    if (cafeMode && levels[0]) navigate({ name: 'game', levelId: levels[0].id });
  }, [cafeMode, navigate]);

  useEffect(() => {
    const title = screenTitle(screen);
    document.title = title ? `${title} — ${t('app.title')}` : t('app.title');
  }, [screen]);

  // The painted background is optional: a missing file leaves the teal gradient.
  const style = { '--bg-image': `url("${import.meta.env.BASE_URL}assets/background.svg")` } as CSSProperties;

  return (
    <div className="app" style={style} data-screen={screen.name}>
      <ScreenView screen={screen} />
      {progress.lastError && (
        <ErrorToast message={progressErrorMessage(progress.lastError)} onDismiss={progress.clearError} />
      )}
    </div>
  );
}

export function App({ cafeMode = false }: { cafeMode?: boolean }) {
  return (
    <AppProvider>
      <AppShell cafeMode={cafeMode} />
    </AppProvider>
  );
}
