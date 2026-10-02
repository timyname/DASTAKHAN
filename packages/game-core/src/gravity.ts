/**
 * Gravity and refill (GAME_SPEC §1, §5). Gravity pulls tiles toward higher rows within each
 * column; layers never move. New tiles enter from the top.
 */
import { BOARD_SIZE, type FoodType, type Pos, type TileRef } from './types.ts';
import { keyOf, tileRef, type WorkBoard } from './board.ts';
import type { Rng } from './rng.ts';

export interface FallMove {
  tileId: number;
  from: Pos;
  to: Pos;
}

/**
 * Compacts every column downward in place. Returns only tiles that moved,
 * ordered by column, then from the bottom of the column upward.
 */
export function applyGravity(board: WorkBoard): FallMove[] {
  const moves: FallMove[] = [];
  for (let col = 0; col < BOARD_SIZE; col++) {
    let write = BOARD_SIZE - 1;
    for (let row = BOARD_SIZE - 1; row >= 0; row--) {
      const tile = board[row][col];
      if (!tile) continue;
      if (row !== write) {
        board[write][col] = tile;
        board[row][col] = null;
        moves.push({ tileId: tile.id, from: { row, col }, to: { row: write, col } });
      }
      write--;
    }
  }
  return moves;
}

export interface Spawned {
  tile: TileRef;
  fromRow: number;
}

/**
 * Fills empty cells (which, after gravity, are the top k rows of a column).
 * Columns 0..10, rows top-down; each new ordinary tile takes allowedTypes[floor(next() * n)]
 * and a fresh id from `ids`. `fromRow = row - k` is the virtual row above the board.
 */
export function refill(board: WorkBoard, rng: Rng, allowedTypes: readonly FoodType[], ids: { next: number }): Spawned[] {
  const spawned: Spawned[] = [];
  for (let col = 0; col < BOARD_SIZE; col++) {
    let k = 0;
    while (k < BOARD_SIZE && board[k][col] === null) k++;
    for (let row = 0; row < k; row++) {
      const tile = { id: ids.next++, base: rng.pick(allowedTypes), special: null };
      board[row][col] = tile;
      spawned.push({ tile: tileRef(tile, keyOf(row, col)), fromRow: row - k });
    }
  }
  return spawned;
}
