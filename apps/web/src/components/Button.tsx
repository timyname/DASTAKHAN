import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  /** Stretch to the container width. */
  block?: boolean;
  icon?: IconName;
}

/** Text button; at least 48 px tall. Defaults to type="button". */
export function Button({ variant = 'primary', size = 'md', block, icon, className, children, type = 'button', ...rest }: ButtonProps) {
  const classes = ['ui-btn', `ui-btn--${variant}`];
  if (size === 'lg') classes.push('ui-btn--lg');
  if (block) classes.push('ui-btn--block');
  if (className) classes.push(className);
  return (
    <button type={type} className={classes.join(' ')} {...rest}>
      {icon && <Icon name={icon} size={22} />}
      <span>{children}</span>
    </button>
  );
}
