/**
 * Special effect areas (GAME_SPEC §4). All areas clip at board edges and never wrap.
 * Every function returns unique cell keys in row-major order.
 */
import {
  BESH_TARGET_TYPES,
  BOARD_SIZE,
  FOOD_TYPES,
  type EffectKind,
  type FoodType,
  type Pos,
  type SpecialKind,
} from './types.ts';
import { CELL_COUNT, keyOf, sortKeys, type WorkBoard } from './board.ts';

/** LINE_H: the whole row. */
export function rowCells(row: number): number[] {
  return Array.from({ length: BOARD_SIZE }, (_, col) => keyOf(row, col));
}

/** LINE_V: the whole column. */
export function colCells(col: number): number[] {
  return Array.from({ length: BOARD_SIZE }, (_, row) => keyOf(row, col));
}

/** Centered square of side 2 * radius + 1 (BOMB: radius 1; BOMB+BOMB: radius 2). */
export function squareCells(center: Pos, radius: number): number[] {
  const keys: number[] = [];
  for (let row = center.row - radius; row <= center.row + radius; row++) {
    if (row < 0 || row >= BOARD_SIZE) continue;
    for (let col = center.col - radius; col <= center.col + radius; col++) {
      if (col < 0 || col >= BOARD_SIZE) continue;
      keys.push(keyOf(row, col));
    }
  }
  return keys;
}

/** LINE+LINE: one row plus one column through the center (21 cells on the full board). */
export function crossCells(center: Pos): number[] {
  return sortKeys([...rowCells(center.row), ...colCells(center.col)]);
}

/** LINE+BOMB: three adjacent rows plus three adjacent columns through the center (up to 57 cells). */
export function wideCrossCells(center: Pos): number[] {
  const keys: number[] = [];
  for (let d = -1; d <= 1; d++) {
    const row = center.row + d;
    const col = center.col + d;
    if (row >= 0 && row < BOARD_SIZE) keys.push(...rowCells(row));
    if (col >= 0 && col < BOARD_SIZE) keys.push(...colCells(col));
  }
  return sortKeys(keys);
}

/** RAM+RAM: every cell of the board. */
export function allCells(): number[] {
  return Array.from({ length: CELL_COUNT }, (_, key) => key);
}

/** Keys of every tile whose base equals `base` (ordinary pieces and LINE/BOMB of that type). */
export function cellsWithBase(board: WorkBoard, base: FoodType): number[] {
  const keys: number[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col]?.base === base) keys.push(keyOf(row, col));
    }
  }
  return keys;
}

/**
 * Base types ranked by frequency among all tiles on the board (count desc, ties by FOOD_TYPES order).
 * Only types present on the board are listed.
 */
export function rankBases(board: WorkBoard): FoodType[] {
  const counts = new Map<FoodType, number>();
  for (const row of board) {
    for (const tile of row) {
      if (tile && tile.base !== null) counts.set(tile.base, (counts.get(tile.base) ?? 0) + 1);
    }
  }
  return FOOD_TYPES.filter((type) => (counts.get(type) ?? 0) > 0)
    .map((type, order) => ({ type, order, count: counts.get(type) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map((entry) => entry.type);
}

/**
 * Most frequent base among all tiles on the board (RAM hit by another effect).
 * Ties break by FOOD_TYPES order. Null when no tile has a base.
 */
export function mostFrequentBase(board: WorkBoard): FoodType | null {
  return rankBases(board)[0] ?? null;
}

/**
 * BESH «Дастархан для всех»: every tile of the BESH_TARGET_TYPES most frequent bases (fewer if fewer
 * exist; same counting and tie-break as RAM) plus a 5×5 square centered on the BESH.
 */
export function beshEffect(board: WorkBoard, center: Pos): { targetTypes: FoodType[]; cells: number[] } {
  const targetTypes = rankBases(board).slice(0, BESH_TARGET_TYPES);
  const cells = [...squareCells(center, 2)];
  for (const type of targetTypes) cells.push(...cellsWithBase(board, type));
  return { targetTypes, cells: sortKeys(cells) };
}

/** LINE/BOMB: specials that keep a food base. */
export type BasedSpecial = 'LINE_H' | 'LINE_V' | 'BOMB';

export function isBasedSpecial(kind: SpecialKind | null): kind is BasedSpecial {
  return kind === 'LINE_H' || kind === 'LINE_V' || kind === 'BOMB';
}

/** Effect of a single (non-pair) LINE/BOMB activation. */
export function singleEffect(kind: BasedSpecial, center: Pos): { effect: EffectKind; cells: number[] } {
  switch (kind) {
    case 'LINE_H':
      return { effect: 'row', cells: rowCells(center.row) };
    case 'LINE_V':
      return { effect: 'col', cells: colCells(center.col) };
    case 'BOMB':
      return { effect: 'square3', cells: squareCells(center, 1) };
  }
}

/** Area effect of a LINE/BOMB pair (both kinds non-RAM). */
export function linePairEffect(
  a: BasedSpecial,
  b: BasedSpecial,
  center: Pos,
): { effect: EffectKind; cells: number[] } {
  const bombs = (a === 'BOMB' ? 1 : 0) + (b === 'BOMB' ? 1 : 0);
  if (bombs === 0) return { effect: 'cross', cells: crossCells(center) };
  if (bombs === 1) return { effect: 'wideCross', cells: wideCrossCells(center) };
  return { effect: 'square5', cells: squareCells(center, 2) };
}
