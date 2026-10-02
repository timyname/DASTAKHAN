/**
 * Minimal i18n: flat dictionaries, `{name}` interpolation, Russian fallback.
 * All player-facing text goes through `t()`; game-core never sees language decisions.
 */
import { kk } from './kk.ts';
import { ru, type RuKey } from './ru.ts';

export type Locale = 'ru' | 'kk';
export type MessageKey = RuKey;
export type MessageParams = Record<string, string | number>;

const dictionaries: Record<Locale, Partial<Record<string, string>>> = { ru, kk };

let locale: Locale = 'ru';

export function getLocale(): Locale {
  return locale;
}

/** Only 'ru' is reviewed for the MVP; 'kk' falls back to Russian for every missing key. */
export function setLocale(next: Locale): void {
  locale = next;
}

export function hasKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ru, key);
}

function isDev(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/**
 * Translate `key`, replacing `{name}` placeholders with `params[name]`.
 * Unknown placeholders are left intact. A missing key returns the key itself
 * (and warns in development) so a gap is visible instead of crashing the UI.
 */
export function t(key: MessageKey | (string & {}), params?: MessageParams): string {
  const template = dictionaries[locale][key] ?? (ru as Partial<Record<string, string>>)[key];
  if (template === undefined) {
    if (isDev()) console.warn(`[i18n] Missing key: ${key}`);
    return key;
  }
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Format an integer with Russian digit grouping (e.g. 12 340). */
export function formatNumber(n: number): string {
  try {
    return new Intl.NumberFormat('ru-RU').format(n);
  } catch {
    return String(n);
  }
}
