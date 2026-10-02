import type { ReactNode } from 'react';
import { t } from '../i18n/index.ts';
import { Button } from './Button.tsx';
import { Modal } from './Modal.tsx';

export interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Style the confirm action as destructive. */
  danger?: boolean;
  onConfirm(): void;
  /** Also called on Escape. */
  onCancel(): void;
}

/** Yes/no confirmation. Focus starts on the safe (cancel) action. */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      testId="confirm-dialog"
      actionsInRow
      actions={
        <>
          <Button variant="ghost" onClick={onCancel} data-autofocus>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="ui-modal__text">{message}</p>
    </Modal>
  );
}
