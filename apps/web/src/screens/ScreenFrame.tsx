import { useEffect, useRef, type ReactNode } from 'react';
import { hasNavigated } from '../app/AppContext.tsx';
import { IconButton } from '../components/IconButton.tsx';
import { t } from '../i18n/index.ts';
import './screens.css';

export interface ScreenFrameProps {
  title: string;
  children: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  testId?: string;
  wide?: boolean;
}

/** Menu-screen frame: back button, centered heading, scrollable column. */
export function ScreenFrame({ title, children, onBack, backLabel, testId, wide }: ScreenFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new screen's heading after navigation (not on the initial page load).
  useEffect(() => {
    if (hasNavigated()) headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <main className={wide ? 'scr scr--wide' : 'scr'} data-testid={testId}>
      <header className="scr-header">
        {onBack ? (
          <IconButton icon="back" label={backLabel ?? t('common.back')} onClick={onBack} data-testid="back-button" />
        ) : (
          <span className="scr-header__spacer" />
        )}
        <h1 ref={headingRef} tabIndex={-1} className="scr-title">
          {title}
        </h1>
        <span className="scr-header__spacer" />
      </header>
      <div className="scr-body">{children}</div>
    </main>
  );
}
