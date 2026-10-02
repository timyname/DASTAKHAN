/**
 * Campaign navigation helpers (pure). They decide which screen comes next;
 * they never evaluate game rules — victory and stars come from game-core.
 */
import type { FoodType, LevelDefinition, TutorialDefinition } from '@dastakhan/game-core';
import { LEVELS_SCREEN, type Screen } from './screens.ts';

/** 1-based campaign number for display, from the level order (fallback: digits in the id). */
export function levelNumber(levels: readonly LevelDefinition[], levelId: string): number {
  const index = levels.findIndex((l) => l.id === levelId);
  if (index >= 0) return index + 1;
  const digits = /(\d+)\s*$/.exec(levelId);
  return digits ? Number(digits[1]) : 0;
}

export function nextLevelId(levels: readonly LevelDefinition[], levelId: string): string | null {
  const index = levels.findIndex((l) => l.id === levelId);
  return index >= 0 && index + 1 < levels.length ? levels[index + 1].id : null;
}

/**
 * Screen to show after the player WON `levelId` (GAME_SPEC §9): the tutorial
 * offered after that level if it exists and was not seen yet, then the level list.
 */
export function screenAfterLevelWin(
  levelId: string,
  tutorialsSeen: readonly string[],
  tutorialAfterLevel: Readonly<Record<string, TutorialDefinition['id']>>,
  tutorials: readonly TutorialDefinition[],
  after: Screen = LEVELS_SCREEN,
): Screen {
  const tutorialId = tutorialAfterLevel[levelId];
  if (!tutorialId || tutorialsSeen.includes(tutorialId)) return after;
  if (!tutorials.some((tut) => tut.id === tutorialId)) return after;
  return { name: 'tutorial', tutorialId, next: after };
}

/**
 * Dishes each level introduces (allowed types no earlier level used), keyed by level id.
 * The first level introduces none: every dish is new there.
 */
export function newDishesByLevel(levels: readonly LevelDefinition[]): Record<string, FoodType[]> {
  const seen = new Set<FoodType>();
  const result: Record<string, FoodType[]> = {};
  levels.forEach((level, index) => {
    const fresh = level.allowedTypes.filter((type) => !seen.has(type));
    if (index > 0 && fresh.length > 0) result[level.id] = fresh;
    for (const type of level.allowedTypes) seen.add(type);
  });
  return result;
}

/** The level a «Продолжить» button opens: the highest unlocked level. */
export function continueLevelId(levels: readonly LevelDefinition[], unlockedCount: number): string | null {
  if (levels.length === 0) return null;
  const index = Math.min(Math.max(unlockedCount, 1), levels.length) - 1;
  return levels[index].id;
}
