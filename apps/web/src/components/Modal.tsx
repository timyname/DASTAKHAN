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
  const suppressHandleClick = useRef(false);
  const drag = useRef<{ pointerId: number; startY: number; lastY: number; time: number } | null>(null);
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
      {onClose ? (
        <button className="ui-modal__drag" aria-label={t('common.close')} onClick={() => { if (suppressHandleClick.current) { suppressHandleClick.current = false; return; } onClose(); }}
          onPointerDown={(e) => {
            if (!e.isPrimary || e.button !== 0) return;
            suppressHandleClick.current = false;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { pointerId: e.pointerId, startY: e.clientY, lastY: e.clientY, time: e.timeStamp };
            if (ref.current) { ref.current.style.animation = 'none'; ref.current.style.transition = 'none'; }
          }}
          onPointerMove={(e) => {
            if (!drag.current || drag.current.pointerId !== e.pointerId || !ref.current) return;
            drag.current.lastY = e.clientY;
            ref.current.style.transform = `translateY(${Math.max(0, e.clientY - drag.current.startY)}px)`;
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (!d || d.pointerId !== e.pointerId || !ref.current) return;
            drag.current = null;
            const distance = e.clientY - d.startY;
            const velocity = distance / Math.max(1, e.timeStamp - d.time);
            if (distance > 90 || (distance > 30 && velocity > .5)) { onClose(); return; }
            ref.current.style.transition = 'transform 240ms cubic-bezier(.2,.8,.2,1)';
            ref.current.style.transform = 'translateY(0)';
            // Do not dismiss on click synthesized after a cancelled drag.
            suppressHandleClick.current = Math.abs(distance) > 6;
          }}
          onPointerCancel={() => {
            drag.current = null;
            if (ref.current) { ref.current.style.transition = 'transform 180ms ease-out'; ref.current.style.transform = 'translateY(0)'; }
          }}>
          <span className="ui-modal__ornament" style={{ display: 'block' }} />
        </button>
      ) : <div className="ui-modal__ornament" aria-hidden="true" />}
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
