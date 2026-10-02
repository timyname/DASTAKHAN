import { useId } from 'react';
import { t } from '../i18n/index.ts';
import { Icon, type IconName } from './Icon.tsx';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange(next: boolean): void;
  description?: string;
  disabled?: boolean;
  icon?: IconName;
}

/** Accessible switch (button role="switch"), full-width row, ≥ 56 px tall. */
export function Toggle({ label, checked, onChange, description, disabled, icon }: ToggleProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-desc` : undefined}
      className="ui-toggle"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      {icon && <Icon name={icon} className="ui-toggle__icon" />}
      <span className="ui-toggle__text">
        <span id={`${id}-label`} className="ui-toggle__label">
          {label}
        </span>
        {description && (
          <span id={`${id}-desc`} className="ui-toggle__desc">
            {description}
          </span>
        )}
      </span>
      <span className="ui-toggle__state" aria-hidden="true">
        {checked ? t('common.on') : t('common.off')}
      </span>
      <span className="ui-toggle__track" aria-hidden="true">
        <span className="ui-toggle__thumb" />
      </span>
    </button>
  );
}
