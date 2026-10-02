/**
 * Modal dialog on the native <dialog> element opened with showModal():
 * the rest of the page becomes inert (focus is trapped inside), Escape calls
 * `onClose` (or does nothing when `onClose` is omitted), focus returns to the
 * previously focused element on close. Mount it only while it should be open.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { t } from '../i18n/index.ts';
import { IconButton } from './IconButton.tsx';

export interface ModalProps {
  /** Visible title (rendered as the dialog heading and accessible name). */
  title: string;
  children: ReactNode;
  /** Action buttons rendered in the footer. */
  actions?: ReactNode;
  /** Escape / close button handler. Omit to make the dialog non-dismissable. */
  onClose?: () => void;
  /** Show a close (×) button in the header; requires `onClose`. */
  showClose?: boolean;
  wide?: boolean;
  className?: string;
  /** Lay out two actions side by side. */
  actionsInRow?: boolean;
  testId?: string;
}

export function Modal({ title, children, actions, onClose, showClose, wide, className, actionsInRow, testId }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `${useId()}-title`;
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let closingOnPurpose = false;

    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }
    const preferred = dialog.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? dialog.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'))?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Preventing the keydown stops the browser's own close request.
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current?.();
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current?.();
    };
    // Some browsers may still force-close (repeated Escape without user activation): restore it.
    const onNativeClose = () => {
      // Ignore our own close() (e.g. a StrictMode effect re-run): the close event is queued
      // asynchronously and may arrive after the dialog was shown again.
      if (closingOnPurpose || dialog.open) return;
      if (onCloseRef.current) onCloseRef.current();
      else if (dialog.isConnected) {
        try {
          dialog.showModal();
        } catch {
          /* ignore */
        }
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onNativeClose);

    return () => {
      closingOnPurpose = true;
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onNativeClose);
      if (dialog.open) dialog.close();
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  const classes = ['ui-modal'];
  if (wide) classes.push('ui-modal--wide');
  if (className) classes.push(className);
  const withClose = Boolean(showClose && onClose);

  return (
    <dialog ref={ref} className={classes.join(' ')} aria-labelledby={titleId} data-testid={testId}>
      <div className="ui-modal__ornament" aria-hidden="true" />
      <div className={withClose ? 'ui-modal__header ui-modal__header--with-close' : 'ui-modal__header'}>
        <h2 id={titleId} className="ui-modal__title">
          {title}
        </h2>
        {withClose && <IconButton icon="close" label={t('common.close')} tone="light" size={44} onClick={onClose} />}
      </div>
      <div className="ui-modal__body">{children}</div>
      {actions && <div className={actionsInRow ? 'ui-modal__actions ui-modal__actions--row' : 'ui-modal__actions'}>{actions}</div>}
    </dialog>
  );
}
