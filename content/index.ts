/**
 * TEMPORARY STUB — replaced by the 15 level definitions and 4 tutorials (prompt 06).
 */
import type { LevelDefinition, TutorialDefinition } from '@dastakhan/game-core';

/** Campaign levels in order (level-01 … level-15). */
export const levels: LevelDefinition[] = [];

export const tutorials: TutorialDefinition[] = [];

/** Tutorial offered after finishing the given campaign level id (GAME_SPEC §9). */
export const tutorialAfterLevel: Record<string, TutorialDefinition['id']> = {};
