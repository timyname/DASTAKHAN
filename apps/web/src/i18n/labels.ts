/** Label helpers shared by screens, the HUD and (later) the board renderer. */
import type { FoodType, Goal, GoalProgress, SpecialKind } from '@dastakhan/game-core';
import { t } from './index.ts';

export function foodLabel(type: FoodType): string {
  return t(`food.${type}`);
}

export function specialLabel(kind: SpecialKind): string {
  return t(`special.${kind}`);
}

/** Accessible label for a board piece, e.g. «Казан (Самса)» or «Золотой барашек». */
export function tileLabel(base: FoodType | null, special: SpecialKind | null): string {
  if (special === 'RAM' || base === null) return special ? specialLabel(special) : '';
  if (!special) return foodLabel(base);
  return t('tile.special', { special: specialLabel(special), food: foodLabel(base) });
}

/** Short goal label without progress: «Баурсак» / «Крошки». */
export function goalShortLabel(goal: Goal): string {
  return goal.kind === 'collect' ? foodLabel(goal.type) : t('obstacle.crumbsShort');
}

export function goalRemaining(goal: GoalProgress): number {
  return Math.max(0, goal.count - goal.done);
}

/** «Баурсак: осталось 12» / «Крошки: выполнено». */
export function goalProgressLabel(goal: GoalProgress): string {
  const label = goal.kind === 'collect' ? foodLabel(goal.type) : t('obstacle.crumbs');
  const left = goalRemaining(goal);
  return left === 0 ? t('goal.done', { label }) : t('goal.remaining', { label, n: left });
}

/** Single summary sentence for screen readers (avoids announcing every goal separately). */
export function goalsSummary(goals: GoalProgress[]): string {
  return t('goal.summary', { items: goals.map(goalProgressLabel).join('; ') });
}
