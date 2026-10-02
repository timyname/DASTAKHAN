import { useState } from 'react';
import { useApp } from '../app/AppContext.tsx';
import type { Screen } from '../app/screens.ts';
import { Button } from '../components/Button.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Toggle } from '../components/Toggle.tsx';
import { t } from '../i18n/index.ts';
import { MUSIC_AVAILABLE } from '../settings/settings.ts';
import { ScreenFrame } from './ScreenFrame.tsx';

export function SettingsScreen({ back }: { back?: Screen }) {
  const { navigate, settings, setSettings, progress } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  return (
    <ScreenFrame title={t('settings.title')} onBack={() => navigate(back ?? { name: 'start' })} testId="settings-screen">
      <section className="scr-panel scr-panel--light on-light">
        <div className="settings-list">
          <Toggle
            label={t('settings.sound')}
            description={t('settings.soundHint')}
            icon={settings.sound ? 'soundOn' : 'soundOff'}
            checked={settings.sound}
            onChange={(sound) => setSettings({ sound })}
          />
          <Toggle
            label={t('settings.music')}
            description={t('settings.musicUnavailable')}
            icon="soundOff"
            checked={MUSIC_AVAILABLE && settings.music}
            disabled={!MUSIC_AVAILABLE}
            onChange={(music) => setSettings({ music })}
          />
          <Toggle
            label={t('settings.reducedMotion')}
            description={t('settings.reducedMotionHint')}
            icon="motion"
            checked={settings.reducedMotion}
            onChange={(reducedMotion) => setSettings({ reducedMotion })}
          />
        </div>
      </section>

      <section className="scr-panel scr-panel--light on-light" aria-labelledby="settings-progress">
        <h2 id="settings-progress" className="scr-panel__title">
          {t('settings.progress')}
        </h2>
        <p className="scr-panel__hint">{t('settings.progressNote')}</p>
        <Button variant="danger" icon="restart" onClick={() => setConfirming(true)} data-testid="reset-progress">
          {t('settings.resetProgress')}
        </Button>
        {resetDone && (
          <p className="settings-status" role="status">
            {t('settings.resetDone')}
          </p>
        )}
      </section>

      {confirming && (
        <ConfirmDialog
          title={t('settings.resetTitle')}
          message={t('settings.resetText')}
          confirmLabel={t('settings.resetConfirm')}
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            progress.reset();
            setConfirming(false);
            setResetDone(true);
          }}
        />
      )}
    </ScreenFrame>
  );
}
