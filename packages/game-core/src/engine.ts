/**
 * TEMPORARY STUBS — replaced by the engine implementation (prompt 02).
 * Signatures are the contract; do not change them without updating all consumers.
 */
import type { BoardFixture, GameState, LevelDefinition, Move, MoveResult, Tile } from './types.ts';

/** New game from a level and a run seed: no ready matches, at least one legal move. */
export function createGame(_level: LevelDefinition, _seed: number): GameState {
  throw new Error('not implemented');
}

/** New game from a fixed fixture board (tutorials, tests). Refills use `seed`. */
export function createGameFromBoard(_level: LevelDefinition, _board: BoardFixture, _seed: number): GameState {
  throw new Error('not implemented');
}

/** Apply one player swap; returns the next stable state and ordered visual events. Input state is not mutated. */
export function applyMove(_state: GameState, _move: Move): MoveResult {
  throw new Error('not implemented');
}

/** All legal swaps in deterministic order (row, col, then right before down). */
export function getLegalMoves(_state: GameState): Move[] {
  throw new Error('not implemented');
}

/** Canonical JSON (stable key order) of a stable state. */
export function serializeState(_state: GameState): string {
  throw new Error('not implemented');
}

export function restoreState(_snapshot: string): GameState {
  throw new Error('not implemented');
}

/** Replays a move log from a seed; used by saves and later by the server. */
export function replay(_level: LevelDefinition, _seed: number, _moves: Move[]): GameState {
  throw new Error('not implemented');
}

export function parseBoardFixture(_rows: BoardFixture): Tile[][] {
  throw new Error('not implemented');
}

export function formatBoardFixture(_board: Tile[][]): BoardFixture {
  throw new Error('not implemented');
}
