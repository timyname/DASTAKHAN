/** Small inline SVG icon set for shell controls (decorative; buttons carry the label). */
import type { ReactNode } from 'react';

export type IconName =
  | 'pause'
  | 'back'
  | 'help'
  | 'soundOn'
  | 'soundOff'
  | 'settings'
  | 'lock'
  | 'check'
  | 'restart'
  | 'play'
  | 'levels'
  | 'book'
  | 'close'
  | 'motion'
  | 'home'
  | 'next';

const PATHS: Record<IconName, ReactNode> = {
  pause: (
    <>
      <rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" stroke="none" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  help: (
    <>
      <path d="M9 9.3a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.6" />
      <circle cx="11.8" cy="18.6" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  soundOn: (
    <>
      <path d="M4 9.5v5h3.6L12.5 18.5V5.5L7.6 9.5z" fill="currentColor" strokeWidth="1.6" />
      <path d="M15.8 9a4.2 4.2 0 0 1 0 6M18.4 6.6a7.6 7.6 0 0 1 0 10.8" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 9.5v5h3.6L12.5 18.5V5.5L7.6 9.5z" fill="currentColor" strokeWidth="1.6" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17.5 7H20M4 17h3M11.5 17H20" />
      <circle cx="15.2" cy="7" r="2.3" />
      <circle cx="9.2" cy="17" r="2.3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor" stroke="none" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  restart: (
    <>
      <path d="M5 12a7 7 0 1 0 2.1-5" />
      <path d="M5 4.5V9h4.5" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  levels: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10 5 7 4.6 4 5v13.5c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5z" />
      <path d="M12 6.5V20" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  motion: <path d="M3.5 12h3.5l2.2-5.5 4.6 11 2.2-5.5h4.5" />,
  home: (
    <>
      <path d="M4 11.5L12 4.5l8 7" />
      <path d="M6.5 10v9.5h11V10" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      className={className ? `ui-icon ${className}` : 'ui-icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
