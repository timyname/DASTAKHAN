/**
 * Board generation (GAME_SPEC §7): no ready matches and at least one legal move.
 * Cells are filled row-major; each cell picks uniformly among allowed types that would not
 * complete a horizontal/vertical run of 3 with tiles already on the board.
 */
import { BOARD_SIZE, RULE_LIMITS, type FoodType, type Tile } from './types.ts';
import { EngineError, assertFullBoard, emptyBoard, type WorkBoard } from './board.ts';
import { hasAnyMatch } from './match.ts';
import { hasLegalMove } from './moves.ts';
import type { Rng } from './rng.ts';

/** True if placing `type` at (row, col) would form a run of >= 3 with non-empty neighbors. */
export function completesRun(board: WorkBoard, row: number, col: number, type: FoodType): boolean {
  let h = 0;
  for (let c = col - 1; c >= 0 && board[row][c]?.base === type; c--) h++;
  for (let c = col + 1; c < BOARD_SIZE && board[row][c]?.base === type; c++) h++;
  if (h >= 2) return true;
  let v = 0;
  for (let r = row - 1; r >= 0 && board[r][col]?.base === type; r--) v++;
  for (let r = row + 1; r < BOARD_SIZE && board[r][col]?.base === type; r++) v++;
  return v >= 2;
}

/**
 * Fills every empty cell row-major with ordinary tiles (ids from `firstId`).
 * On a board with no tiles right/below, this is exactly the "two cells to the left/above" rule.
 * Returns the next free id, or null when some cell has no admissible type (attempt fails).
 */
function fillEmptyCells(board: WorkBoard, rng: Rng, allowedTypes: readonly FoodType[], firstId: number): number | null {
  let nextId = firstId;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] !== null) continue;
      const candidates = allowedTypes.filter((type) => !completesRun(board, row, col, type));
      if (candidates.length === 0) return null;
      board[row][col] = { id: nextId++, base: rng.pick(candidates), special: null };
    }
  }
  return nextId;
}

/** Starting board for createGame. Ids are 1..121 row-major. Throws after bounded attempts. */
export function generateBoard(rng: Rng, allowedTypes: readonly FoodType[]): Tile[][] {
  for (let attempt = 0; attempt < RULE_LIMITS.maxGenerationAttempts; attempt++) {
    const board = emptyBoard();
    if (fillEmptyCells(board, rng, allowedTypes, 1) === null) continue;
    if (hasAnyMatch(board) || !hasLegalMove(board)) continue;
    return assertFullBoard(board);
  }
  throw new Error(`Board generation failed after ${RULE_LIMITS.maxGenerationAttempts} attempts`);
}

/**
 * Dead-board fallback: keeps specials in place, regenerates every ordinary piece with new ids.
 * Throws EngineError after bounded attempts.
 */
export function regenerateOrdinary(
  board: Tile[][],
  rng: Rng,
  allowedTypes: readonly FoodType[],
  firstId: number,
): { board: Tile[][]; nextTileId: number } {
  for (let attempt = 0; attempt < RULE_LIMITS.maxGenerationAttempts; attempt++) {
    const work: WorkBoard = board.map((row) =>
      row.map((tile) => (tile.special !== null ? { id: tile.id, base: tile.base, special: tile.special } : null)),
    );
    const nextTileId = fillEmptyCells(work, rng, allowedTypes, firstId);
    if (nextTileId === null) continue;
    if (hasAnyMatch(work) || !hasLegalMove(work)) continue;
    return { board: assertFullBoard(work), nextTileId };
  }
  throw new EngineError(`Ordinary piece regeneration failed after ${RULE_LIMITS.maxGenerationAttempts} attempts`);
}
