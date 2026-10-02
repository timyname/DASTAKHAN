/**
 * Typed art manifest (prompts 04/05). Single source of truth for sprite URLs,
 * accessible label keys, intrinsic sizes, transparency, provenance and the
 * playable fallbacks used when an image cannot be loaded.
 *
 * All current files are hand-authored SVG fallbacks: no image-generation tool was
 * available, so raster generation was NOT performed. A raster set generated from the
 * prompt 04 prompts can replace these files 1:1 by keeping the asset IDs and
 * updating `file`/`format` here (see docs/ASSET_SPEC.md).
 */
import { FOOD_TYPES, type FoodType, type SpecialKind } from '@dastakhan/game-core';

export const ASSET_PROVENANCE = 'SVG fallback (hand-authored); raster generation not performed' as const;

export type AssetFormat = 'svg' | 'png' | 'webp';

/** Coarse playable fallback silhouette rendered with CSS when a sprite fails. */
export type FallbackShape =
  | 'diamond'
  | 'circle'
  | 'oval'
  | 'triangle'
  | 'rounded'
  | 'bowl'
  | 'drop'
  | 'disc'
  | 'mound'
  | 'dome'
  | 'deep-bowl'
  | 'wide-triangle'
  | 'flask'
  | 'platter';

export interface ArtAsset {
  /** Stable asset ID; equals the file stem (e.g. `food-baursak`). Never rename. */
  readonly id: string;
  /** Path relative to `apps/web/public/`. */
  readonly file: string;
  /** Runtime URL honouring Vite's `base` (`./` in this project). */
  readonly url: string;
  readonly format: AssetFormat;
  /** Intrinsic size in px (SVG viewBox / width / height). */
  readonly width: number;
  readonly height: number;
  /** True when the background is transparent (real alpha), false for opaque art. */
  readonly transparent: boolean;
  readonly provenance: string;
}

export interface FallbackStyle {
  /** Fill of the CSS fallback shape. */
  readonly fallbackColor: string;
  /** Glyph colour drawn on top of the fallback shape. */
  readonly fallbackInk: string;
  /** Single glyph (no words) shown inside the fallback shape. */
  readonly fallbackGlyph: string;
  readonly fallbackShape: FallbackShape;
}

export interface FoodArt extends ArtAsset, FallbackStyle {
  readonly kind: 'food';
  readonly type: FoodType;
  readonly labelKey: `food.${FoodType}`;
}

export interface SpecialSpriteArt extends ArtAsset, FallbackStyle {
  readonly kind: 'special';
}

export interface CrumbsArtAsset extends ArtAsset {
  readonly kind: 'obstacle';
  readonly hp: 1 | 2;
  readonly labelKey: 'obstacle.crumbs';
}

/** How each special family is composed from sprites plus code-drawn overlays. */
export interface SpecialComposition {
  readonly labelKey: `special.${SpecialKind}`;
  /** Special sprite ID drawn as the tile body. */
  readonly sprite: 'special-uchpuchmak' | 'special-kumys' | 'special-kazan' | 'special-ram' | 'special-besh';
  /** Code-drawn layers on top of the sprite. */
  readonly overlays: readonly ('food-badge' | 'chevrons-horizontal' | 'chevrons-vertical' | 'gold-glow')[];
}

function assetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${file}`;
}

function sprite(id: string, transparent = true): ArtAsset {
  const file = `assets/sprites/${id}.svg`;
  return {
    id,
    file,
    url: assetUrl(file),
    format: 'svg',
    width: 256,
    height: 256,
    transparent,
    provenance: ASSET_PROVENANCE,
  };
}

const FOOD_FALLBACKS: Readonly<Record<FoodType, FallbackStyle>> = {
  baursak: { fallbackColor: '#F2B544', fallbackInk: '#5A2E0A', fallbackGlyph: '◆', fallbackShape: 'diamond' },
  kurt: { fallbackColor: '#F4EFE4', fallbackInk: '#4C5A64', fallbackGlyph: '∴', fallbackShape: 'circle' },
  kazy: { fallbackColor: '#8E2536', fallbackInk: '#FFF1DC', fallbackGlyph: '◎', fallbackShape: 'oval' },
  samsa: { fallbackColor: '#D9822C', fallbackInk: '#4A1F06', fallbackGlyph: '▲', fallbackShape: 'triangle' },
  zhent: { fallbackColor: '#C99645', fallbackInk: '#3E260A', fallbackGlyph: '≡', fallbackShape: 'rounded' },
  tea: { fallbackColor: '#24A79D', fallbackInk: '#FFF4DF', fallbackGlyph: '◡', fallbackShape: 'bowl' },
  manty: { fallbackColor: '#F3E6CC', fallbackInk: '#7E5A32', fallbackGlyph: '✿', fallbackShape: 'drop' },
  shelpek: { fallbackColor: '#EFCB7E', fallbackInk: '#8E4716', fallbackGlyph: '◌', fallbackShape: 'disc' },
  chakchak: { fallbackColor: '#C9701A', fallbackInk: '#FFE8A8', fallbackGlyph: '⠿', fallbackShape: 'mound' },
  plov: { fallbackColor: '#EDBE52', fallbackInk: '#C2410C', fallbackGlyph: '◓', fallbackShape: 'dome' },
  lagman: { fallbackColor: '#B75C46', fallbackInk: '#FBE5A4', fallbackGlyph: '≋', fallbackShape: 'deep-bowl' },
};

export const FOOD_ART: Readonly<Record<FoodType, FoodArt>> = Object.fromEntries(
  FOOD_TYPES.map((type) => [
    type,
    { ...sprite(`food-${type}`), ...FOOD_FALLBACKS[type], kind: 'food', type, labelKey: `food.${type}` } satisfies FoodArt,
  ]),
) as Record<FoodType, FoodArt>;

/** «Учпучмак» pastry used by LINE_H (row); base food badge + horizontal chevrons in code. */
export const UCHPUCHMAK_ART: SpecialSpriteArt = {
  ...sprite('special-uchpuchmak'),
  kind: 'special',
  fallbackColor: '#E9A443',
  fallbackInk: '#5E2C0A',
  fallbackGlyph: '',
  fallbackShape: 'wide-triangle',
};

/** «Кумыс» leather torsyk flask used by LINE_V (column); base food badge + vertical chevrons in code. */
export const KUMYS_ART: SpecialSpriteArt = {
  ...sprite('special-kumys'),
  kind: 'special',
  fallbackColor: '#8A5530',
  fallbackInk: '#FFF4DF',
  fallbackGlyph: '',
  fallbackShape: 'flask',
};

/** «Казан» cauldron used by BOMB; the base food is drawn as a programmatic badge. */
export const KAZAN_ART: SpecialSpriteArt = {
  ...sprite('special-kazan'),
  kind: 'special',
  fallbackColor: '#1F5F57',
  fallbackInk: '#F4C85C',
  fallbackGlyph: '✹',
  fallbackShape: 'circle',
};

/** «Золотой барашек» emblem used by RAM (no base type, no badge). */
export const RAM_ART: SpecialSpriteArt = {
  ...sprite('special-ram'),
  kind: 'special',
  fallbackColor: '#E6B65A',
  fallbackInk: '#5A3A08',
  fallbackGlyph: '♈',
  fallbackShape: 'circle',
};

/** «Бешбармак» festive platter used by BESH (universal: no base type, no badge). */
export const BESH_ART: SpecialSpriteArt = {
  ...sprite('special-besh'),
  kind: 'special',
  fallbackColor: '#F6E9CF',
  fallbackInk: '#8A4428',
  fallbackGlyph: '✺',
  fallbackShape: 'platter',
};

export const SPECIAL_LABEL_KEYS: Readonly<Record<SpecialKind, `special.${SpecialKind}`>> = {
  LINE_H: 'special.LINE_H',
  LINE_V: 'special.LINE_V',
  BOMB: 'special.BOMB',
  RAM: 'special.RAM',
  BESH: 'special.BESH',
};

export const SPECIAL_COMPOSITION: Readonly<Record<SpecialKind, SpecialComposition>> = {
  LINE_H: { labelKey: 'special.LINE_H', sprite: 'special-uchpuchmak', overlays: ['food-badge', 'chevrons-horizontal'] },
  LINE_V: { labelKey: 'special.LINE_V', sprite: 'special-kumys', overlays: ['food-badge', 'chevrons-vertical'] },
  BOMB: { labelKey: 'special.BOMB', sprite: 'special-kazan', overlays: ['food-badge'] },
  RAM: { labelKey: 'special.RAM', sprite: 'special-ram', overlays: ['gold-glow'] },
  BESH: { labelKey: 'special.BESH', sprite: 'special-besh', overlays: ['gold-glow'] },
};

/** «Крошки на скатерти» under-tile layers; HP2 is visibly denser than HP1. */
export const CRUMBS_ART: Readonly<Record<1 | 2, CrumbsArtAsset>> = {
  1: { ...sprite('obstacle-crumbs-hp1'), kind: 'obstacle', hp: 1, labelKey: 'obstacle.crumbs' },
  2: { ...sprite('obstacle-crumbs-hp2'), kind: 'obstacle', hp: 2, labelKey: 'obstacle.crumbs' },
};

/** Opaque 9:16 gameplay background (dark teal textile, ornament near edges only). */
export const BACKGROUND_ART: ArtAsset = {
  id: 'background',
  file: 'assets/background.svg',
  url: assetUrl('assets/background.svg'),
  format: 'svg',
  width: 1080,
  height: 1920,
  transparent: false,
  provenance: ASSET_PROVENANCE,
};

/** Every 256×256 sprite used on the board. */
export const SPRITE_ASSETS: readonly ArtAsset[] = [
  ...FOOD_TYPES.map((type) => FOOD_ART[type]),
  UCHPUCHMAK_ART,
  KUMYS_ART,
  KAZAN_ART,
  RAM_ART,
  BESH_ART,
  CRUMBS_ART[1],
  CRUMBS_ART[2],
];

export const ALL_ASSETS: readonly ArtAsset[] = [...SPRITE_ASSETS, BACKGROUND_ART];

/* ------------------------------------------------------------------ */
/* Load-failure registry shared by preloadAssets() and the components. */
/* ------------------------------------------------------------------ */

const failedUrls = new Set<string>();

/** True when this URL already failed to load (components then render the fallback directly). */
export function isAssetFailed(url: string): boolean {
  return failedUrls.has(url);
}

export function markAssetFailed(url: string): void {
  failedUrls.add(url);
}

export interface PreloadOptions {
  /** Also preload the background (default true). */
  includeBackground?: boolean;
  /** Per-asset timeout; a timed-out asset is reported as failed (default 10000 ms). */
  timeoutMs?: number;
}

/**
 * Loads every sprite (and the background) through `Image`. Never rejects: resolves
 * with the IDs of assets that failed or timed out so the UI can report them while
 * the board keeps using playable CSS fallbacks.
 */
export function preloadAssets(options: PreloadOptions = {}): Promise<{ failed: string[] }> {
  const { includeBackground = true, timeoutMs = 10000 } = options;
  const assets = includeBackground ? ALL_ASSETS : SPRITE_ASSETS;
  if (typeof Image === 'undefined') {
    return Promise.resolve({ failed: assets.map((a) => a.id) });
  }
  const loadOne = (asset: ArtAsset) =>
    new Promise<string | null>((resolve) => {
      let settled = false;
      const img = new Image();
      const finish = (ok: boolean, definitive: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok && definitive) markAssetFailed(asset.url);
        resolve(ok ? null : asset.id);
      };
      const timer = setTimeout(() => finish(false, false), timeoutMs);
      img.onload = () => finish(true, true);
      img.onerror = () => finish(false, true);
      img.decoding = 'async';
      img.src = asset.url;
    });
  return Promise.all(assets.map(loadOne)).then(
    (results) => ({ failed: results.filter((id): id is string => id !== null) }),
    () => ({ failed: assets.map((a) => a.id) }),
  );
}
