import type { ProgressError } from '../progress/ProgressRepository.ts';
import { t, type MessageKey } from '../i18n/index.ts';
import { Button } from './Button.tsx';

const MESSAGES: Record<ProgressError['kind'], MessageKey> = {
  corrupted: 'error.progressCorrupted',
  unknownSchema: 'error.progressUnknownSchema',
  recovered: 'error.progressRecovered',
  storageUnavailable: 'error.storageUnavailable',
  writeFailed: 'error.saveFailed',
  saveCorrupted: 'error.saveCorrupted',
  saveOutdated: 'error.saveOutdated',
};

export function progressErrorMessage(error: ProgressError): string {
  return t(MESSAGES[error.kind]);
}

/** Dismissable notice for recoverable storage problems (never blocks play). */
export function ErrorToast({ message, onDismiss }: { message: string; onDismiss(): void }) {
  return (
    <div className="ui-toast on-light" role="alert" data-testid="error-toast">
      <p className="ui-toast__text">{message}</p>
      <Button variant="ghost" onClick={onDismiss}>
        {t('error.dismiss')}
      </Button>
    </div>
  );
}
