/**
 * Canonical JSON for stable states (GAME_SPEC §8): object keys sorted recursively, so
 * serializeState(restoreState(s)) === s for any canonical snapshot s.
 */
import {
  BOARD_SIZE,
  FOOD_TYPES,
  type FoodType,
  type GameState,
  type GameStatus,
  type GoalProgress,
  type Move,
  type SpecialKind,
  type Tile,
} from './types.ts';

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) out[key] = sortValue(source[key]);
    }
    return out;
  }
  return value;
}

/** JSON with recursively sorted object keys. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function serializeState(state: GameState): string {
  return canonicalJson(state);
}

const SPECIAL_KINDS: readonly SpecialKind[] = ['LINE_H', 'LINE_V', 'BOMB', 'RAM', 'BESH'];
const STATUSES: readonly GameStatus[] = ['playing', 'won', 'lost'];

function fail(message: string): never {
  throw new Error(`Invalid game state snapshot: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function int(value: unknown, name: string, min = Number.MIN_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) fail(`${name} must be an integer >= ${min}`);
  return value;
}

function food(value: unknown, name: string): FoodType {
  if (typeof value !== 'string' || !(FOOD_TYPES as readonly string[]).includes(value)) fail(`${name} must be a food type`);
  return value as FoodType;
}

function pos(value: unknown, name: string): { row: number; col: number } {
  if (!isObject(value)) fail(`${name} must be a position`);
  const row = int(value.row, `${name}.row`, 0);
  const col = int(value.col, `${name}.col`, 0);
  if (row >= BOARD_SIZE || col >= BOARD_SIZE) fail(`${name} out of bounds`);
  return { row, col };
}

function tile(value: unknown, name: string): Tile {
  if (!isObject(value)) fail(`${name} must be a tile`);
  const id = int(value.id, `${name}.id`, 1);
  const special = value.special;
  if (special !== null && !SPECIAL_KINDS.includes(special as SpecialKind)) fail(`${name}.special is invalid`);
  if (special === 'RAM' || special === 'BESH') {
    if (value.base !== null) fail(`${name}: ${special} must have a null base`);
    return { id, base: null, special };
  }
  return { id, base: food(value.base, `${name}.base`), special: special as SpecialKind | null };
}

function grid<T>(value: unknown, name: string, cell: (v: unknown, n: string) => T): T[][] {
  if (!Array.isArray(value) || value.length !== BOARD_SIZE) fail(`${name} must have ${BOARD_SIZE} rows`);
  return value.map((row, r) => {
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) fail(`${name}[${r}] must have ${BOARD_SIZE} cells`);
    return row.map((v, c) => cell(v, `${name}[${r}][${c}]`));
  });
}

function goal(value: unknown, name: string): GoalProgress {
  if (!isObject(value)) fail(`${name} must be a goal`);
  const count = int(value.count, `${name}.count`, 0);
  const done = int(value.done, `${name}.done`, 0);
  if (done > count) fail(`${name}.done exceeds count`);
  if (value.kind === 'collect') return { kind: 'collect', type: food(value.type, `${name}.type`), count, done };
  if (value.kind === 'clearCrumbs') return { kind: 'clearCrumbs', count, done };
  return fail(`${name}.kind is invalid`);
}

function move(value: unknown, name: string): Move {
  if (!isObject(value)) fail(`${name} must be a move`);
  return { from: pos(value.from, `${name}.from`), to: pos(value.to, `${name}.to`) };
}

/** Parses and validates a snapshot produced by serializeState. Throws on malformed input. */
export function restoreState(snapshot: string): GameState {
  let raw: unknown;
  try {
    raw = JSON.parse(snapshot);
  } catch {
    return fail('not valid JSON');
  }
  if (!isObject(raw)) fail('root must be an object');
  if (typeof raw.levelId !== 'string') fail('levelId must be a string');
  if (!Array.isArray(raw.allowedTypes) || raw.allowedTypes.length === 0) fail('allowedTypes must be a non-empty array');
  if (!Array.isArray(raw.goals)) fail('goals must be an array');
  if (!Array.isArray(raw.moveLog)) fail('moveLog must be an array');
  if (!STATUSES.includes(raw.status as GameStatus)) fail('status is invalid');
  const rngState = int(raw.rngState, 'rngState', 0);
  if (rngState > 0xffffffff) fail('rngState must be a uint32');
  const board = grid(raw.board, 'board', tile);
  const ids = new Set<number>();
  for (const row of board) {
    for (const t of row) {
      if (ids.has(t.id)) fail(`duplicate tile id ${t.id}`);
      ids.add(t.id);
    }
  }
  const layers = grid(raw.layers, 'layers', (v, n) => {
    const hp = int(v, n, 0);
    if (hp > 2) fail(`${n} must be 0, 1 or 2`);
    return hp;
  });
  const nextTileId = int(raw.nextTileId, 'nextTileId', 1);
  if ([...ids].some((id) => id >= nextTileId)) fail('nextTileId must exceed every tile id');
  const moveLimit = int(raw.moveLimit, 'moveLimit', 0);
  const movesLeft = int(raw.movesLeft, 'movesLeft', 0);
  if (movesLeft > moveLimit) fail('movesLeft exceeds moveLimit');
  const stars = int(raw.stars, 'stars', 0);
  if (stars > 3) fail('stars must be 0..3');
  return {
    rulesVersion: int(raw.rulesVersion, 'rulesVersion', 0),
    levelId: raw.levelId,
    levelVersion: int(raw.levelVersion, 'levelVersion', 0),
    seed: int(raw.seed, 'seed', 0),
    rngState,
    allowedTypes: raw.allowedTypes.map((v, i) => food(v, `allowedTypes[${i}]`)),
    board,
    layers,
    moveLimit,
    movesLeft,
    score: int(raw.score, 'score', 0),
    goals: raw.goals.map((g, i) => goal(g, `goals[${i}]`)),
    status: raw.status as GameStatus,
    stars,
    nextTileId,
    moveLog: raw.moveLog.map((m, i) => move(m, `moveLog[${i}]`)),
  };
}
