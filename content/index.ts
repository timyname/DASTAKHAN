/**
 * DASTAKHAN content: the 15 campaign levels and the 4 fixed tutorials (GAME_SPEC §9, prompt 06).
 *
 * Every definition is validated with the shared `validateLevel` schema when this module
 * loads; an invalid file throws immediately with a descriptive message instead of
 * reaching the engine. JSON is imported with import attributes so the same module works
 * in Vite and in plain Node (>= 22 with type stripping).
 */
import {
  BOARD_SIZE,
  validateLevel,
  type FoodType,
  type LevelDefinition,
  type TutorialDefinition,
} from '@dastakhan/game-core';

import level01 from './levels/level-01.json' with { type: 'json' };
import level02 from './levels/level-02.json' with { type: 'json' };
import level03 from './levels/level-03.json' with { type: 'json' };
import level04 from './levels/level-04.json' with { type: 'json' };
import level05 from './levels/level-05.json' with { type: 'json' };
import level06 from './levels/level-06.json' with { type: 'json' };
import level07 from './levels/level-07.json' with { type: 'json' };
import level08 from './levels/level-08.json' with { type: 'json' };
import level09 from './levels/level-09.json' with { type: 'json' };
import level10 from './levels/level-10.json' with { type: 'json' };
import level11 from './levels/level-11.json' with { type: 'json' };
import level12 from './levels/level-12.json' with { type: 'json' };
import level13 from './levels/level-13.json' with { type: 'json' };
import level14 from './levels/level-14.json' with { type: 'json' };
import level15 from './levels/level-15.json' with { type: 'json' };

import tutorialLine from './tutorials/tutorial-line.json' with { type: 'json' };
import tutorialBomb from './tutorials/tutorial-bomb.json' with { type: 'json' };
import tutorialRam from './tutorials/tutorial-ram.json' with { type: 'json' };
import tutorialRamRam from './tutorials/tutorial-ram-ram.json' with { type: 'json' };
import tutorialBesh from './tutorials/tutorial-besh.json' with { type: 'json' };

type TutorialId = TutorialDefinition['id'];

/** Fixture food letters (BoardFixture in game-core types.ts). */
const FIXTURE_FOOD: Readonly<Record<string, FoodType>> = {
  B: 'baursak',
  K: 'kurt',
  Z: 'kazy',
  S: 'samsa',
  J: 'zhent',
  T: 'tea',
  M: 'manty',
  H: 'shelpek',
  C: 'chakchak',
  P: 'plov',
  L: 'lagman',
};

/** Valid fixture tokens: food letter + kind ('.', 'h', 'v', 'b'), "RR" for RAM or "XX" for BESH. */
const FIXTURE_TOKEN = /^(?:[BKZSJTMHCPL][.hvb]|RR|XX)$/;

function fail(source: string, problems: string[]): never {
  throw new Error(`Invalid DASTAKHAN content in ${source}:\n  - ${problems.join('\n  - ')}`);
}

/** Validates a campaign or tutorial level frame; throws with every schema error. */
function checkLevel(raw: unknown, source: string): LevelDefinition {
  const result = validateLevel(raw);
  if (!result.ok) fail(source, result.errors);
  return raw as LevelDefinition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inBounds(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < BOARD_SIZE;
}

/**
 * Structural check of a tutorial file. Board solvability (no starting runs, step
 * legality, expected specials, final-step win) is covered by content.test.ts and the
 * engine replay in tutorials.test.ts.
 */
function checkTutorial(raw: unknown, expectedId: TutorialId, source: string): TutorialDefinition {
  if (!isRecord(raw)) fail(source, ['tutorial must be an object']);
  const problems: string[] = [];
  if (raw.id !== expectedId) problems.push(`id must be "${expectedId}", got ${JSON.stringify(raw.id)}`);
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1) problems.push('version must be a positive integer');
  if (!Number.isInteger(raw.rulesVersion) || (raw.rulesVersion as number) < 1) {
    problems.push('rulesVersion must be a positive integer');
  }
  if (typeof raw.titleKey !== 'string' || raw.titleKey === '') problems.push('titleKey must be a non-empty string');
  if (typeof raw.doneTextKey !== 'string' || raw.doneTextKey === '') {
    problems.push('doneTextKey must be a non-empty string');
  }
  if (!Number.isInteger(raw.seed) || (raw.seed as number) < 0) problems.push('seed must be a non-negative integer');

  const levelResult = validateLevel(raw.level);
  problems.push(...levelResult.errors.map((error) => `level.${error}`));
  if (isRecord(raw.level) && raw.level.tutorialId !== expectedId) {
    problems.push(`level.tutorialId must be "${expectedId}"`);
  }

  const board = raw.board;
  if (!Array.isArray(board) || board.length !== BOARD_SIZE) {
    problems.push(`board must be an array of ${BOARD_SIZE} rows`);
  } else {
    const allowed = isRecord(raw.level) && Array.isArray(raw.level.allowedTypes) ? raw.level.allowedTypes : [];
    board.forEach((row: unknown, r) => {
      const tokens = typeof row === 'string' ? row.split(' ') : [];
      if (tokens.length !== BOARD_SIZE || tokens.some((token) => !FIXTURE_TOKEN.test(token))) {
        problems.push(`board[${r}] must contain ${BOARD_SIZE} space-separated fixture tokens`);
        return;
      }
      for (const token of tokens) {
        const food = FIXTURE_FOOD[token[0]];
        // Refills only use allowedTypes, so the fixture must not show other foods.
        if (food !== undefined && !allowed.includes(food)) {
          problems.push(`board[${r}] uses ${food}, which is not in level.allowedTypes`);
          break;
        }
      }
    });
  }

  const steps = raw.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    problems.push('steps must be a non-empty array');
  } else {
    steps.forEach((step: unknown, i) => {
      const move = isRecord(step) ? step.move : undefined;
      const from = isRecord(move) ? move.from : undefined;
      const to = isRecord(move) ? move.to : undefined;
      if (!isRecord(step) || typeof step.textKey !== 'string' || step.textKey === '') {
        problems.push(`steps[${i}].textKey must be a non-empty string`);
      }
      if (!isRecord(from) || !isRecord(to) || ![from.row, from.col, to.row, to.col].every(inBounds)) {
        problems.push(`steps[${i}].move must have in-bounds from/to positions`);
      } else if (Math.abs((from.row as number) - (to.row as number)) + Math.abs((from.col as number) - (to.col as number)) !== 1) {
        problems.push(`steps[${i}].move must swap orthogonally adjacent cells`);
      }
    });
  }

  if (problems.length > 0) fail(source, problems);
  return raw as unknown as TutorialDefinition;
}

const levelSources: [unknown, string][] = [
  [level01, 'levels/level-01.json'],
  [level02, 'levels/level-02.json'],
  [level03, 'levels/level-03.json'],
  [level04, 'levels/level-04.json'],
  [level05, 'levels/level-05.json'],
  [level06, 'levels/level-06.json'],
  [level07, 'levels/level-07.json'],
  [level08, 'levels/level-08.json'],
  [level09, 'levels/level-09.json'],
  [level10, 'levels/level-10.json'],
  [level11, 'levels/level-11.json'],
  [level12, 'levels/level-12.json'],
  [level13, 'levels/level-13.json'],
  [level14, 'levels/level-14.json'],
  [level15, 'levels/level-15.json'],
];

/** Campaign levels in order (level-01 … level-15). */
export const levels: LevelDefinition[] = levelSources.map(([raw, source], index) => {
  const level = checkLevel(raw, source);
  const expectedId = `level-${String(index + 1).padStart(2, '0')}`;
  if (level.id !== expectedId) fail(source, [`id must be "${expectedId}", got "${level.id}"`]);
  if (level.tutorialId !== undefined) fail(source, ['campaign levels must not set tutorialId']);
  return level;
});

/** The five fixed tutorials: LINE, BOMB, RAM + food, RAM + RAM, BESH. */
export const tutorials: TutorialDefinition[] = [
  checkTutorial(tutorialLine, 'tutorial-line', 'tutorials/tutorial-line.json'),
  checkTutorial(tutorialBomb, 'tutorial-bomb', 'tutorials/tutorial-bomb.json'),
  checkTutorial(tutorialRam, 'tutorial-ram', 'tutorials/tutorial-ram.json'),
  checkTutorial(tutorialRamRam, 'tutorial-ram-ram', 'tutorials/tutorial-ram-ram.json'),
  checkTutorial(tutorialBesh, 'tutorial-besh', 'tutorials/tutorial-besh.json'),
];

/** Tutorial offered after finishing the given campaign level id (GAME_SPEC §9). */
export const tutorialAfterLevel: Record<string, TutorialDefinition['id']> = {
  'level-02': 'tutorial-line',
  'level-04': 'tutorial-bomb',
  'level-07': 'tutorial-ram',
  'level-10': 'tutorial-ram-ram',
  'level-12': 'tutorial-besh',
};

/** Campaign level by id, or undefined. */
export function getLevel(id: string): LevelDefinition | undefined {
  return levels.find((level) => level.id === id);
}

/** Tutorial by id, or undefined. */
export function getTutorial(id: string): TutorialDefinition | undefined {
  return tutorials.find((tutorial) => tutorial.id === id);
}

/** Zero-based campaign position of a level id (level-01 → 0), or -1 if unknown. */
export function levelIndex(id: string): number {
  return levels.findIndex((level) => level.id === id);
}
