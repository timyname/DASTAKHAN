/**
 * Public engine API (GAME_SPEC §8). Pure and deterministic: no DOM, timers, storage,
 * Date.now or Math.random. All randomness flows through GameState.rngState (mulberry32).
 */
import {
  FOOD_TYPES,
  RULES_VERSION,
  type BoardFixture,
  type FoodType,
  type GameEvent,
  type GameState,
  type GoalProgress,
  type LevelDefinition,
  type Move,
  type MoveResult,
  type RejectReason,
  type Tile,
} from './types.ts';
import { CELL_COUNT, cloneBoard, cloneLayers, cloneTile, inBounds, layersFromOverlays, type WorkBoard } from './board.ts';
import { parseBoardFixture } from './fixture.ts';
import { generateBoard } from './generate.ts';
import { findLegalMoves, hasLegalMove, legalSwapKind } from './moves.ts';
import { resolveCascade, type ResolveContext } from './resolve.ts';
import { Rng, seedToState } from './rng.ts';
import { shuffleBoard } from './shuffle.ts';

export { parseBoardFixture, formatBoardFixture } from './fixture.ts';
export { serializeState, restoreState } from './serialize.ts';

function validateLevelBasics(level: LevelDefinition): FoodType[] {
  if (!level || typeof level !== 'object') throw new Error('Level must be an object');
  if (!Array.isArray(level.allowedTypes) || level.allowedTypes.length === 0) {
    throw new Error(`Level ${String(level.id)}: allowedTypes must be a non-empty array`);
  }
  for (const type of level.allowedTypes) {
    if (!(FOOD_TYPES as readonly string[]).includes(type)) throw new Error(`Level ${level.id}: unknown food type ${type}`);
  }
  if (!Number.isSafeInteger(level.moveLimit) || level.moveLimit < 1) {
    throw new Error(`Level ${level.id}: moveLimit must be a positive integer`);
  }
  if (!Array.isArray(level.goals)) throw new Error(`Level ${level.id}: goals must be an array`);
  return level.allowedTypes.slice();
}

function initialGoals(level: LevelDefinition): GoalProgress[] {
  return level.goals.map((goal) =>
    goal.kind === 'collect'
      ? { kind: 'collect', type: goal.type, count: goal.count, done: 0 }
      : { kind: 'clearCrumbs', count: goal.count, done: 0 },
  );
}

function newState(level: LevelDefinition, seed: number, board: Tile[][], rng: Rng, nextTileId: number): GameState {
  return {
    rulesVersion: RULES_VERSION,
    levelId: level.id,
    levelVersion: level.version,
    seed: seedToState(seed),
    rngState: rng.state,
    allowedTypes: level.allowedTypes.slice(),
    board,
    layers: layersFromOverlays(level.overlays ?? []),
    moveLimit: level.moveLimit,
    movesLeft: level.moveLimit,
    score: 0,
    goals: initialGoals(level),
    status: 'playing',
    stars: 0,
    nextTileId,
    moveLog: [],
  };
}

/** New game from a level and a run seed: no ready matches, at least one legal move. */
export function createGame(level: LevelDefinition, seed: number): GameState {
  const allowedTypes = validateLevelBasics(level);
  const rng = new Rng(seedToState(seed));
  const board = generateBoard(rng, allowedTypes);
  return newState(level, seed, board, rng, CELL_COUNT + 1);
}

/**
 * New game from a fixed fixture board (tutorials, tests). Ids are 1..121 row-major; refills use `seed`.
 * Fixture matches are not auto-resolved.
 */
export function createGameFromBoard(level: LevelDefinition, board: BoardFixture, seed: number): GameState {
  validateLevelBasics(level);
  const tiles = parseBoardFixture(board);
  return newState(level, seed, tiles, new Rng(seedToState(seed)), CELL_COUNT + 1);
}

function cloneState(state: GameState): GameState {
  return {
    rulesVersion: state.rulesVersion,
    levelId: state.levelId,
    levelVersion: state.levelVersion,
    seed: state.seed,
    rngState: state.rngState,
    allowedTypes: state.allowedTypes.slice(),
    board: state.board.map((row) => row.map(cloneTile)),
    layers: cloneLayers(state.layers),
    moveLimit: state.moveLimit,
    movesLeft: state.movesLeft,
    score: state.score,
    goals: state.goals.map((goal) => ({ ...goal })),
    status: state.status,
    stars: state.stars,
    nextTileId: state.nextTileId,
    moveLog: state.moveLog.map(copyMove),
  };
}

function copyMove(move: Move): Move {
  return { from: { row: move.from.row, col: move.from.col }, to: { row: move.to.row, col: move.to.col } };
}

function isPos(value: unknown): value is { row: number; col: number } {
  return value !== null && typeof value === 'object' && 'row' in value && 'col' in value;
}

/** Stars on victory: >= 40% moves left → 3, >= 20% → 2, else 1 (integer arithmetic). */
export function starsFor(movesLeft: number, moveLimit: number): number {
  if (movesLeft * 5 >= moveLimit * 2) return 3;
  if (movesLeft * 5 >= moveLimit) return 2;
  return 1;
}

/** Apply one player swap; returns the next stable state and ordered visual events. Input state is not mutated. */
export function applyMove(state: GameState, move: Move): MoveResult {
  const from = isPos(move?.from) ? move.from : { row: -1, col: -1 };
  const to = isPos(move?.to) ? move.to : { row: -1, col: -1 };
  const fromIn = inBounds(from.row, from.col);
  const toIn = inBounds(to.row, to.col);
  const reject = (reason: RejectReason): MoveResult => ({
    ok: false,
    reason,
    state,
    events: [
      {
        type: 'swapRejected',
        from: { row: from.row, col: from.col },
        to: { row: to.row, col: to.col },
        // -1 marks a position outside the board.
        tileA: fromIn ? state.board[from.row][from.col].id : -1,
        tileB: toIn ? state.board[to.row][to.col].id : -1,
        reason,
      },
    ],
  });

  if (!fromIn || !toIn) return reject('outOfBounds');
  if (Math.abs(from.row - to.row) + Math.abs(from.col - to.col) !== 1) return reject('notAdjacent');
  // movesLeft <= 0 while 'playing' is an inconsistent state; treat it as over rather than go negative.
  if (state.status !== 'playing' || state.movesLeft <= 0) return reject('gameOver');
  const swapKind = legalSwapKind(state.board, from, to);
  if (!swapKind) return reject('noMatch');

  try {
    const cleanMove = copyMove({ from, to });
    const next = cloneState(state);
    const board: WorkBoard = next.board;
    const a = board[from.row][from.col];
    const b = board[to.row][to.col];
    if (!a || !b) throw new Error('Swap cell is empty');
    board[from.row][from.col] = b;
    board[to.row][to.col] = a;
    next.movesLeft -= 1;
    next.moveLog.push(cleanMove);

    const rng = new Rng(next.rngState);
    const ctx: ResolveContext = {
      board,
      layers: next.layers,
      goals: next.goals,
      allowedTypes: next.allowedTypes,
      rng,
      ids: { next: next.nextTileId },
      score: next.score,
      events: [{ type: 'swap', from: { ...cleanMove.from }, to: { ...cleanMove.to }, tileA: a.id, tileB: b.id }],
    };
    resolveCascade(ctx, cleanMove, swapKind);
    next.score = ctx.score;
    const events = ctx.events;
    events.push({
      type: 'goalsUpdated',
      goals: next.goals.map((goal) => ({ ...goal })),
      score: next.score,
      movesLeft: next.movesLeft,
    });

    if (next.goals.every((goal) => goal.done >= goal.count)) {
      next.status = 'won';
      next.stars = starsFor(next.movesLeft, next.moveLimit);
      events.push({ type: 'gameWon', stars: next.stars, score: next.score, movesLeft: next.movesLeft });
    } else if (next.movesLeft <= 0) {
      next.status = 'lost';
      events.push({ type: 'gameLost', score: next.score });
    } else if (!hasLegalMove(next.board)) {
      const shuffled = shuffleBoard(next.board, rng, next.allowedTypes, ctx.ids.next);
      next.board = shuffled.board;
      ctx.ids.next = shuffled.nextTileId;
      events.push({
        type: 'shuffled',
        moves: shuffled.moves,
        regenerated: shuffled.regenerated,
        board: cloneBoard(shuffled.board) as Tile[][],
      });
    }

    next.rngState = rng.state;
    next.nextTileId = ctx.ids.next;
    return { ok: true, state: next, events };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const events: GameEvent[] = [{ type: 'technicalError', message }];
    return { ok: false, reason: 'technicalError', state, events };
  }
}

/** All legal swaps in deterministic order (row, col, then right before down). Empty when the game is over. */
export function getLegalMoves(state: GameState): Move[] {
  if (state.status !== 'playing') return [];
  return findLegalMoves(state.board);
}

/** Replays a move log from a seed; used by saves and later by the server. Throws on any rejected move. */
export function replay(level: LevelDefinition, seed: number, moves: Move[]): GameState {
  let state = createGame(level, seed);
  moves.forEach((move, index) => {
    const result = applyMove(state, move);
    if (!result.ok) {
      throw new Error(`Replay move ${index} rejected: ${result.reason}`);
    }
    state = result.state;
  });
  return state;
}
