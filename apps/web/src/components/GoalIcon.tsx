import type { FoodType, Goal, SpecialKind } from '@dastakhan/game-core';
import { CrumbsArt, FoodIcon, TileArt } from '../art/TileArt.tsx';
import { t } from '../i18n/index.ts';
import { tileLabel } from '../i18n/labels.ts';

/** Decorative goal icon (the caller provides the accessible text). */
export function GoalIcon({ goal, size }: { goal: Goal; size: number }) {
  if (goal.kind === 'collect') {
    return (
      <span className="ui-goal-icon" aria-hidden="true" style={{ width: size, height: size }}>
        <FoodIcon type={goal.type} size={size} />
      </span>
    );
  }
  return <CrumbsSwatch size={size} hp={2} decorative />;
}

/** A calm board-cell swatch with a crumbs layer drawn by the art module. */
export function CrumbsSwatch({ size, hp, decorative }: { size: number; hp: 1 | 2; decorative?: boolean }) {
  return (
    <span
      className="ui-crumbs-swatch"
      style={{ width: size, height: size }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : t(hp === 2 ? 'obstacle.crumbsHp2' : 'obstacle.crumbsHp1')}
    >
      <CrumbsArt hp={hp} />
    </span>
  );
}

/** A board piece drawn by the art module inside a positioned square. */
export function TileSwatch({
  base,
  special,
  size,
  decorative,
}: {
  base: FoodType | null;
  special: SpecialKind | null;
  size: number;
  decorative?: boolean;
}) {
  return (
    <span className="ui-tile-swatch" style={{ width: size, height: size }} aria-hidden={decorative ? true : undefined}>
      <TileArt base={base} special={special} label={decorative ? undefined : tileLabel(base, special)} />
    </span>
  );
}
