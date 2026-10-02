/**
 * Free dead-board shuffle (GAME_SPEC §7). Never consumes a move or changes goals/score; layers stay.
 * 1. Up to RULE_LIMITS.maxShuffleAttempts Fisher–Yates permutations of the existing tiles (ids kept);
 *    accept the first with no ready matches and at least one legal move.
 * 2. Fallback: keep specials in place and regenerate every ordinary piece (new ids).
 */
import { RULE_LIMITS, type FoodType, type Pos, type Tile } from './types.ts';
import { CELL_COUNT, cloneTile, emptyBoard, keyOf, posOf, setCell, assertFullBoard } from './board.ts';
import { regenerateOrdinary } from './generate.ts';
import { hasAnyMatch } from './match.ts';
import { hasLegalMove } from './moves.ts';
import type { Rng } from './rng.ts';

export interface ShuffleResult {
  board: Tile[][];
  /** Final position of every tile that exists after the shuffle and existed before it, row-major by destination. */
  moves: { tileId: number; from: Pos; to: Pos }[];
  regenerated: boolean;
  nextTileId: number;
}

export function shuffleBoard(
  board: Tile[][],
  rng: Rng,
  allowedTypes: readonly FoodType[],
  nextTileId: number,
): ShuffleResult {
  const entries: { tile: Tile; key: number }[] = [];
  board.forEach((line, row) => line.forEach((tile, col) => entries.push({ tile, key: keyOf(row, col) })));
  if (entries.length !== CELL_COUNT) throw new Error('shuffleBoard requires a full board');

  for (let attempt = 0; attempt < RULE_LIMITS.maxShuffleAttempts; attempt++) {
    const order = entries.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    const candidate = emptyBoard();
    order.forEach((entry, key) => setCell(candidate, key, cloneTile(entry.tile)));
    if (hasAnyMatch(candidate) || !hasLegalMove(candidate)) continue;
    return {
      board: assertFullBoard(candidate),
      moves: order.map((entry, key) => ({ tileId: entry.tile.id, from: posOf(entry.key), to: posOf(key) })),
      regenerated: false,
      nextTileId,
    };
  }

  const regen = regenerateOrdinary(board, rng, allowedTypes, nextTileId);
  const moves = entries
    .filter((entry) => entry.tile.special !== null)
    .map((entry) => ({ tileId: entry.tile.id, from: posOf(entry.key), to: posOf(entry.key) }));
  return { board: regen.board, moves, regenerated: true, nextTileId: regen.nextTileId };
}
