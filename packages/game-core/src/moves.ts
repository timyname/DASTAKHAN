/**
 * Swap classification and legal-move search (GAME_SPEC §4, §7).
 * A legal move is an ordinary match-producing swap, RAM or BESH with any adjacent piece, or two specials.
 * These functions never mutate the board.
 */
import { BOARD_SIZE, type FoodType, type Move, type Pos, type Tile } from './types.ts';
import type { WorkBoard } from './board.ts';
import { hasRunThrough } from './match.ts';

/**
 * 'match': ordinary swap resolved by match detection; 'pair': two specials (pair effect, including
 * RAM/BESH + RAM/BESH = «Большой той»); 'ramFood': RAM + ordinary food; 'besh': BESH + ordinary food,
 * LINE or BOMB (only the BESH effect is applied; the partner is hit by it).
 */
export type SwapKind = 'match' | 'pair' | 'ramFood' | 'besh';

/** Universal specials (no base): RAM and BESH. */
export function isUniversal(tile: Tile): boolean {
  return tile.special === 'RAM' || tile.special === 'BESH';
}

/** Swap kinds that are legal without forming a match, or null. */
export function specialSwapKind(a: Tile, b: Tile): Exclude<SwapKind, 'match'> | null {
  if (a.special === 'BESH' || b.special === 'BESH') {
    return isUniversal(a) && isUniversal(b) ? 'pair' : 'besh';
  }
  if (a.special !== null && b.special !== null) return 'pair';
  if ((a.special === 'RAM' && b.special === null) || (b.special === 'RAM' && a.special === null)) return 'ramFood';
  return null;
}

/** True when swapping `from` and `to` creates a run of >= 3 through either swapped cell. */
export function swapMakesMatch(board: WorkBoard, from: Pos, to: Pos): boolean {
  const baseOf = (row: number, col: number): FoodType | null => {
    if (row === from.row && col === from.col) return board[to.row][to.col]?.base ?? null;
    if (row === to.row && col === to.col) return board[from.row][from.col]?.base ?? null;
    return board[row][col]?.base ?? null;
  };
  return hasRunThrough(baseOf, from.row, from.col) || hasRunThrough(baseOf, to.row, to.col);
}

/** Kind of a swap between two in-bounds adjacent cells, or null if the swap is illegal. */
export function legalSwapKind(board: WorkBoard, from: Pos, to: Pos): SwapKind | null {
  const a = board[from.row][from.col];
  const b = board[to.row][to.col];
  if (!a || !b) return null;
  const special = specialSwapKind(a, b);
  if (special) return special;
  return swapMakesMatch(board, from, to) ? 'match' : null;
}

/** Legal swaps scanning row-major, trying right then down for each cell. */
export function findLegalMoves(board: WorkBoard, limit = Number.POSITIVE_INFINITY): Move[] {
  const moves: Move[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const from = { row, col };
      if (col + 1 < BOARD_SIZE && legalSwapKind(board, from, { row, col: col + 1 })) {
        moves.push({ from, to: { row, col: col + 1 } });
        if (moves.length >= limit) return moves;
      }
      if (row + 1 < BOARD_SIZE && legalSwapKind(board, from, { row: row + 1, col })) {
        moves.push({ from: { row, col }, to: { row: row + 1, col } });
        if (moves.length >= limit) return moves;
      }
    }
  }
  return moves;
}

export function hasLegalMove(board: WorkBoard): boolean {
  return findLegalMoves(board, 1).length > 0;
}
