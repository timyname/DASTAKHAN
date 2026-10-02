import { t } from '../i18n/index.ts';
import { Button } from './Button.tsx';
import { GuideContent } from './GuideContent.tsx';
import { Modal } from './Modal.tsx';

/** The combination guide as an in-game dialog (keeps the current game mounted). */
export function GuideDialog({ onClose }: { onClose(): void }) {
  return (
    <Modal
      title={t('guide.title')}
      onClose={onClose}
      showClose
      wide
      testId="guide-dialog"
      actions={
        <Button block onClick={onClose}>
          {t('common.ok')}
        </Button>
      }
    >
      <GuideContent headingLevel={3} />
    </Modal>
  );
}
