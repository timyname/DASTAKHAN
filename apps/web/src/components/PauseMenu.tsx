import { useState } from 'react';
import { t } from '../i18n/index.ts';
import { Button } from './Button.tsx';
import { Modal } from './Modal.tsx';
import { Toggle } from './Toggle.tsx';

export interface PauseMenuProps {
  /** Also called on Escape. */
  onResume(): void;
  /** Called after the player confirms (or immediately when `confirmRestart` is false). */
  onRestart(): void;
  onGuide(): void;
  onExit(): void;
  sound: boolean;
  onSoundChange(next: boolean): void;
  reducedMotion: boolean;
  onReducedMotionChange(next: boolean): void;
  /** Ask before restarting (default true): the current game on this level is lost. */
  confirmRestart?: boolean;
}

/** Focus-trapped pause dialog: resume, restart, sound, reduced motion, guide, exit. */
export function PauseMenu({
  onResume,
  onRestart,
  onGuide,
  onExit,
  sound,
  onSoundChange,
  reducedMotion,
  onReducedMotionChange,
  confirmRestart = true,
}: PauseMenuProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <Modal
        key="confirm"
        title={t('pause.restartTitle')}
        onClose={() => setConfirming(false)}
        testId="pause-restart-confirm"
        actionsInRow
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} data-autofocus>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={onRestart}>
              {t('pause.restartConfirm')}
            </Button>
          </>
        }
      >
        <p className="ui-modal__text">{t('pause.restartText')}</p>
      </Modal>
    );
  }

  return (
    <Modal
      key="menu"
      title={t('pause.title')}
      onClose={onResume}
      testId="pause-menu"
      actions={
        <>
          <Button size="lg" icon="play" block onClick={onResume} data-autofocus>
            {t('pause.resume')}
          </Button>
          <Button variant="secondary" icon="restart" block onClick={() => (confirmRestart ? setConfirming(true) : onRestart())}>
            {t('pause.restart')}
          </Button>
          <Button variant="secondary" icon="book" block onClick={onGuide}>
            {t('pause.guide')}
          </Button>
          <Button variant="ghost" icon="levels" block onClick={onExit}>
            {t('pause.exit')}
          </Button>
        </>
      }
    >
      <Toggle label={t('settings.sound')} icon={sound ? 'soundOn' : 'soundOff'} checked={sound} onChange={onSoundChange} />
      <Toggle
        label={t('settings.reducedMotion')}
        icon="motion"
        checked={reducedMotion}
        onChange={onReducedMotionChange}
      />
    </Modal>
  );
}
