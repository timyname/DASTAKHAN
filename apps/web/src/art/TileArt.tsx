/**
 * TEMPORARY STUB — replaced by agent B (art). Props are the contract used by the
 * board renderer, the guide screen and goal icons.
 */
import type { FoodType, SpecialKind } from '@dastakhan/game-core';

export interface TileArtProps {
  base: FoodType | null;
  special: SpecialKind | null;
  /** Accessible label supplied by the caller from the i18n dictionary. */
  label?: string;
  className?: string;
}

/** Fills its positioned parent (100% × 100%). */
export function TileArt({ base, special, label, className }: TileArtProps) {
  return (
    <div className={className} role="img" aria-label={label} data-base={base ?? 'none'} data-special={special ?? 'none'}>
      {special === 'RAM' ? 'R' : (base ?? '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

export interface FoodIconProps {
  type: FoodType;
  /** CSS px. */
  size: number;
  label?: string;
}

export function FoodIcon({ type, size, label }: FoodIconProps) {
  return (
    <span role="img" aria-label={label} style={{ display: 'inline-block', width: size, height: size }}>
      {type.slice(0, 1).toUpperCase()}
    </span>
  );
}

export interface CrumbsArtProps {
  hp: number;
  className?: string;
}

/** Crumbs layer drawn under a tile; fills its positioned parent. Renders nothing for hp 0. */
export function CrumbsArt({ hp, className }: CrumbsArtProps) {
  if (hp <= 0) return null;
  return <div className={className} data-hp={hp} />;
}
