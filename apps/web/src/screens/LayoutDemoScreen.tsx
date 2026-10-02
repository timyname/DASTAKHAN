/**
 * DEV-ONLY layout preview with fake data (no game logic). Reachable via
 * `#layout-demo`, optionally with variants: `#layout-demo:six,win`, `:lose`,
 * `:pause`, `:help`, `:tutorial`, `:low`. Loaded lazily and only when import.meta.env.DEV.
 */
import { FOOD_TYPES, type GoalProgress, type SpecialKind } from '@dastakhan/game-core';
import { useState, type ReactNode } from 'react';
import { useApp } from '../app/AppContext.tsx';
import { CrumbsArt, TileArt } from '../art/TileArt.tsx';
import { GameLayout } from '../components/GameLayout.tsx';
import { GuideDialog } from '../components/GuideDialog.tsx';
import { PauseMenu } from '../components/PauseMenu.tsx';
import { ResultDialog } from '../components/ResultDialog.tsx';
import { t } from '../i18n/index.ts';

type Overlay = 'none' | 'pause' | 'win' | 'lose' | 'help';

const DEMO_SPECIALS: Record<string, SpecialKind> = { '2,3': 'LINE_H', '5,5': 'RAM', '7,8': 'BOMB', '8,2': 'LINE_V', '9,6': 'BESH' };

function DemoBoard() {
  const cells: ReactNode[] = [];
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      const special = DEMO_SPECIALS[`${r},${c}`] ?? null;
      const base = special === 'RAM' || special === 'BESH' ? null : FOOD_TYPES[(r * 3 + c * 5 + ((r * c) % 4)) % 6];
      const hp = r >= 4 && r <= 6 && c >= 4 && c <= 6 ? (r === 5 && c === 5 ? 2 : 1) : 0;
      cells.push(
        <div key={r * 11 + c} style={{ position: 'relative', background: (r + c) % 2 ? '#fff4df' : '#f6e6c8' }}>
          <span style={{ position: 'absolute', inset: 0 }}>
            <CrumbsArt hp={hp} />
          </span>
          <span style={{ position: 'absolute', inset: '5%' }}>
            <TileArt base={base} special={special} />
          </span>
        </div>,
      );
    }
  }
  return (
    <div
      aria-label={t('hud.board')}
      role="img"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(11, 1fr)',
        gridTemplateRows: 'repeat(11, 1fr)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {cells}
    </div>
  );
}

export default function LayoutDemoScreen({ variant }: { variant?: string }) {
  const { navigate, settings, setSettings } = useApp();
  const flags = new Set((variant ?? '').split(','));
  const initial: Overlay = (['win', 'lose', 'pause', 'help'] as const).find((o) => flags.has(o)) ?? 'none';
  const [overlay, setOverlay] = useState<Overlay>(initial);

  const goals: GoalProgress[] = flags.has('six')
    ? FOOD_TYPES.slice(0, 6).map((type, i) => ({ kind: 'collect', type, count: 25, done: i === 2 ? 25 : i * 4 }))
    : [
        { kind: 'collect', type: 'baursak', count: 25, done: 9 },
        { kind: 'clearCrumbs', count: 9, done: 9 },
      ];

  const toLevels = () => navigate({ name: 'levels' });
  const close = () => setOverlay('none');

  let overlayNode: ReactNode = null;
  if (overlay === 'pause') {
    overlayNode = (
      <PauseMenu
        onResume={close}
        onRestart={close}
        onGuide={() => setOverlay('help')}
        onExit={toLevels}
        sound={settings.sound}
        onSoundChange={(sound) => setSettings({ sound })}
        reducedMotion={settings.reducedMotion}
        onReducedMotionChange={(reducedMotion) => setSettings({ reducedMotion })}
      />
    );
  } else if (overlay === 'win' || overlay === 'lose') {
    overlayNode = (
      <ResultDialog
        kind={overlay}
        stars={overlay === 'win' ? 2 : 0}
        score={12340}
        goals={goals}
        onNext={overlay === 'win' ? close : undefined}
        onReplay={close}
        onExit={toLevels}
      />
    );
  } else if (overlay === 'help') {
    overlayNode = <GuideDialog onClose={close} />;
  }

  return (
    <GameLayout
      title={flags.has('tutorial') ? t('tutorial.line.title') : t('levels.level', { n: 7 })}
      badge={flags.has('tutorial') ? t('tutorial.badge') : undefined}
      movesLeft={flags.has('low') ? 3 : 18}
      goals={goals}
      score={12340}
      board={<DemoBoard />}
      hint={flags.has('tutorial') ? t('tutorial.line.step1') : t('dev.demoHint')}
      onPause={() => setOverlay('pause')}
      onHelp={() => setOverlay('help')}
      overlay={overlayNode}
    />
  );
}
