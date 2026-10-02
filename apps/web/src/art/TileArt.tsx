/**
 * Tile art components (prompt 05). Props are a contract used by the board renderer,
 * the combination guide and goal icons — keep names and required props stable.
 *
 * - Ordinary food: one sprite.
 * - LINE_H «Учпучмак»: horizontal pastry sprite + base-food badge + gold chevrons on the
 *   left/right edges pointing outward along the row (the real effect axis).
 * - LINE_V «Кумыс»: upright torsyk flask sprite + base-food badge + gold chevrons on the
 *   top/bottom edges pointing outward along the column.
 * - BOMB «Казан»: cauldron sprite + contrasting circular badge showing the base food.
 * - RAM «Золотой барашек» / BESH «Бешбармак»: universal emblems with a soft gold glow,
 *   no badge (base is null).
 * - Any image failure falls back to a playable CSS shape (colour + glyph).
 *
 * Art never intercepts pointer input: every element here has `pointer-events: none`.
 */
import { useState } from 'react';
import type { FoodType, SpecialKind } from '@dastakhan/game-core';
import {
  BESH_ART,
  CRUMBS_ART,
  FOOD_ART,
  KAZAN_ART,
  KUMYS_ART,
  RAM_ART,
  UCHPUCHMAK_ART,
  isAssetFailed,
  markAssetFailed,
  type ArtAsset,
  type FallbackStyle,
} from './manifest.ts';
import './art.css';

function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Sprite with tracked load errors and a playable fallback.            */
/* ------------------------------------------------------------------ */

interface SpriteProps {
  asset: ArtAsset & FallbackStyle;
  /** Accessible text; empty string marks the image decorative. */
  alt: string;
  className?: string;
  forceFallback?: boolean;
}

/** Render with `key={asset.id}` so the error state resets when the asset changes. */
function Sprite({ asset, alt, className, forceFallback }: SpriteProps) {
  const [broken, setBroken] = useState(() => isAssetFailed(asset.url));
  if (broken || forceFallback) {
    return <FallbackShape style={asset} alt={alt} className={className} />;
  }
  return (
    <img
      className={cx('art-sprite', className)}
      src={asset.url}
      alt={alt}
      width={asset.width}
      height={asset.height}
      draggable={false}
      decoding="async"
      onError={() => {
        markAssetFailed(asset.url);
        setBroken(true);
      }}
    />
  );
}

function FallbackShape({ style, alt, className }: { style: FallbackStyle; alt: string; className?: string }) {
  return (
    <span
      className={cx('art-fallback', `art-fallback--${style.fallbackShape}`, className)}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <span className="art-fallback__shape" style={{ background: style.fallbackColor }} />
      <svg className="art-fallback__glyph" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <text x="50" y="53" textAnchor="middle" dominantBaseline="middle" fontSize="50" fontWeight="700" fill={style.fallbackInk}>
          {style.fallbackGlyph}
        </text>
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Code-drawn overlays.                                                */
/* ------------------------------------------------------------------ */

/** Bold chevron pointing right, tip at (98, 50) in a 100×100 box. */
const CHEVRON = 'M98 50L85 35H76L89 50L76 65H85Z';
const CHEVRON_HI = 'M91.5 46L84.5 38';

/**
 * Two outward chevrons on the tile edges along the effect axis: left/right for a row
 * (LINE_H), top/bottom for a column (LINE_V). `offset` shifts them across the axis
 * (in % of the tile) so they line up with the badge centre.
 */
function Chevrons({ axis, offset }: { axis: 'h' | 'v'; offset: number }) {
  const shift = axis === 'h' ? `translate(0 ${offset})` : `translate(${offset} 0) rotate(90 50 50)`;
  const one = (mirror: boolean) => (
    <g transform={mirror ? 'matrix(-1 0 0 1 100 0)' : undefined}>
      <path d={CHEVRON} fill="none" stroke="#2E1A03" strokeWidth="6" strokeLinejoin="round" opacity="0.92" />
      <path d={CHEVRON} fill="#F4C247" />
      <path d={CHEVRON_HI} stroke="#FFF6CF" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
  return (
    <svg
      className={cx('art-overlay', 'art-chevrons', `art-chevrons--${axis}`)}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <g transform={shift}>
        {one(false)}
        {one(true)}
      </g>
    </svg>
  );
}

type BadgeVariant = 'bomb' | 'line-h' | 'line-v';

function FoodBadge({ base, variant, forceFallback }: { base: FoodType; variant: BadgeVariant; forceFallback?: boolean }) {
  return (
    <span className={cx('art-badge', `art-badge--${variant}`)} aria-hidden="true">
      <svg className="art-badge__disc" viewBox="0 0 100 100" focusable="false">
        <circle cx="50" cy="50" r="48" fill="#0B2A27" />
        <circle cx="50" cy="50" r="44" fill="#E6B65A" />
        <circle cx="50" cy="50" r="39" fill="#FFF8EA" />
        <path d="M22 42A30 30 0 0 1 58 13" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      </svg>
      <span className="art-badge__food">
        <Sprite key={base} asset={FOOD_ART[base]} alt="" forceFallback={forceFallback} />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Public components (contract).                                       */
/* ------------------------------------------------------------------ */

export interface TileArtProps {
  base: FoodType | null;
  special: SpecialKind | null;
  /** Accessible label supplied by the caller from the i18n dictionary. */
  label?: string;
  className?: string;
  /** Dev/test only: render the CSS fallback as if every sprite failed to load. */
  forceFallback?: boolean;
}

/** Fills its positioned parent (100% × 100%). */
export function TileArt({ base, special, label, className, forceFallback }: TileArtProps) {
  const common = {
    'data-base': base ?? 'none',
    'data-special': special ?? 'none',
  };

  if (special === 'RAM' || special === 'BESH') {
    const asset = special === 'RAM' ? RAM_ART : BESH_ART;
    return (
      <div className={cx('art-tile', special === 'RAM' ? 'art-tile--ram' : 'art-tile--besh', className)} {...common}>
        <span className="art-glow" aria-hidden="true" />
        <Sprite key={asset.id} asset={asset} alt={label ?? ''} forceFallback={forceFallback} />
      </div>
    );
  }

  if (special === 'BOMB') {
    return (
      <div
        className={cx('art-tile', 'art-tile--bomb', className)}
        role={label ? 'img' : undefined}
        aria-label={label}
        {...common}
      >
        <Sprite key="kazan" asset={KAZAN_ART} alt="" forceFallback={forceFallback} />
        {base && <FoodBadge base={base} variant="bomb" forceFallback={forceFallback} />}
      </div>
    );
  }

  if (special === 'LINE_H' || special === 'LINE_V') {
    const horizontal = special === 'LINE_H';
    const asset = horizontal ? UCHPUCHMAK_ART : KUMYS_ART;
    return (
      <div
        className={cx('art-tile', 'art-tile--line', horizontal ? 'art-tile--line-h' : 'art-tile--line-v', className)}
        role={label ? 'img' : undefined}
        aria-label={label}
        {...common}
      >
        <Sprite key={asset.id} asset={asset} alt="" forceFallback={forceFallback} />
        {base && <FoodBadge base={base} variant={horizontal ? 'line-h' : 'line-v'} forceFallback={forceFallback} />}
        <Chevrons axis={horizontal ? 'h' : 'v'} offset={horizontal ? 6 : 0} />
      </div>
    );
  }

  return (
    <div className={cx('art-tile', className)} {...common}>
      {base && <Sprite key={base} asset={FOOD_ART[base]} alt={label ?? ''} forceFallback={forceFallback} />}
    </div>
  );
}

export interface FoodIconProps {
  type: FoodType;
  /** CSS px. */
  size: number;
  label?: string;
}

/** Inline food icon for goals, HUD and the guide. */
export function FoodIcon({ type, size, label }: FoodIconProps) {
  return (
    <span className="art-icon" style={{ width: size, height: size }}>
      <Sprite key={type} asset={FOOD_ART[type]} alt={label ?? ''} />
    </span>
  );
}

export interface CrumbsArtProps {
  hp: number;
  className?: string;
}

/** Crumbs layer drawn under a tile; fills its positioned parent. Renders nothing for hp ≤ 0. */
export function CrumbsArt({ hp, className }: CrumbsArtProps) {
  if (hp <= 0) return null;
  const level = hp >= 2 ? 2 : 1;
  return (
    <div className={cx('art-crumbs', `art-crumbs--hp${level}`, className)} data-hp={hp} aria-hidden="true">
      <CrumbsSprite key={level} asset={CRUMBS_ART[level]} />
    </div>
  );
}

/** Crumbs fallback is a soft CSS speckle pattern (still shows the layer is present). */
function CrumbsSprite({ asset }: { asset: ArtAsset }) {
  const [broken, setBroken] = useState(() => isAssetFailed(asset.url));
  if (broken) return <span className="art-crumbs__fallback" />;
  return (
    <img
      className="art-sprite"
      src={asset.url}
      alt=""
      width={asset.width}
      height={asset.height}
      draggable={false}
      decoding="async"
      onError={() => {
        markAssetFailed(asset.url);
        setBroken(true);
      }}
    />
  );
}
