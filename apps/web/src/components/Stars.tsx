import type { CSSProperties } from 'react';
import { t } from '../i18n/index.ts';

const STAR_PATH = 'M12 2.4l2.95 6 6.6.95-4.78 4.66 1.13 6.58L12 17.5l-5.9 3.1 1.13-6.58L2.45 9.35l6.6-.95z';

export interface StarsProps {
  /** Earned stars, clamped to 0..max. */
  count: number;
  max?: number;
  /** Size of one star in CSS px. */
  size?: number;
  /** Pop-in animation (disabled automatically under reduced motion). */
  animated?: boolean;
  /** Use on dark backgrounds (lighter empty stars). */
  onDark?: boolean;
  /** Large result style (raised middle star). */
  large?: boolean;
  className?: string;
}

export function Stars({ count, max = 3, size = 20, animated, onDark, large, className }: StarsProps) {
  const filled = Math.max(0, Math.min(max, Math.floor(count)));
  const classes = ['ui-stars'];
  if (animated) classes.push('ui-stars--animated');
  if (onDark) classes.push('ui-stars--on-dark');
  if (large) classes.push('ui-stars--lg');
  if (className) classes.push(className);
  return (
    <span className={classes.join(' ')} role="img" aria-label={t('stars.aria', { n: filled, max })}>
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          className="ui-star"
          data-filled={i < filled}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          style={{ '--i': i } as CSSProperties}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}
