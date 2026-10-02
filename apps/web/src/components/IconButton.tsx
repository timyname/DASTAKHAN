import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { Icon, type IconName } from './Icon.tsx';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Accessible name (also shown as a tooltip). Russian, from the dictionary. */
  label: string;
  tone?: 'dark' | 'light' | 'gold';
  /** Visual size in CSS px; never below the 44 px touch target. */
  size?: number;
}

/** Round icon-only button with a ≥ 44×44 CSS px target. */
export function IconButton({ icon, label, tone = 'dark', size = 48, className, style, type = 'button', ...rest }: IconButtonProps) {
  const classes = ['ui-icon-btn'];
  if (tone !== 'dark') classes.push(`ui-icon-btn--${tone}`);
  if (className) classes.push(className);
  const finalSize = Math.max(44, size);
  return (
    <button
      type={type}
      className={classes.join(' ')}
      aria-label={label}
      title={label}
      style={{ '--ib-size': `${finalSize}px`, ...style } as CSSProperties}
      {...rest}
    >
      <Icon name={icon} size={Math.round(finalSize * 0.5)} />
    </button>
  );
}
