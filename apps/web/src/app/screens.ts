/** Screen state for the app shell (no router library). */
export type Screen =
  | { name: 'start' }
  | { name: 'levels' }
  | { name: 'game'; levelId: string }
  /** `next` is where to go when the tutorial ends or is skipped (default: levels). */
  | { name: 'tutorial'; tutorialId: string; next?: Screen }
  /** `back` returns to the previous screen (default: start). */
  | { name: 'guide'; back?: Screen }
  | { name: 'settings'; back?: Screen }
  /** DEV-only layout preview, reachable via the `#layout-demo` URL hash. */
  | { name: 'layoutDemo'; variant?: string };

export type ScreenName = Screen['name'];

export const START_SCREEN: Screen = { name: 'start' };
export const LEVELS_SCREEN: Screen = { name: 'levels' };

/** DEV-only: `#layout-demo` or `#layout-demo:win`, `:lose`, `:pause`, `:six`, `:help`. */
export function screenFromHash(hash: string, dev: boolean): Screen | null {
  if (!dev) return null;
  const match = /^#layout-demo(?::([\w,-]+))?$/.exec(hash);
  if (!match) return null;
  return { name: 'layoutDemo', variant: match[1] };
}
