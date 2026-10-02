/**
 * Board primitives shared by every engine module.
 * Cells are addressed either as Pos {row, col} or as a numeric key row * BOARD_SIZE + col.
 * Sorting keys numerically yields row-major order.
 */
import { BOARD_SIZE, type Overlay, type Pos, type Tile, type TileRef } from './types.ts';

/** A cell of a working board; null only transiently during resolution or generation. */
export type Cell = Tile | null;
export type WorkBoard = Cell[][];

export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Internal invariant failure; surfaced to callers as a technicalError. */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

export function inBounds(row: number, col: number): boolean {
  return (
    Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
  );
}

export function keyOf(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function keyOfPos(pos: Pos): number {
  return pos.row * BOARD_SIZE + pos.col;
}

export function rowOf(key: number): number {
  return Math.floor(key / BOARD_SIZE);
}

export function colOf(key: number): number {
  return key % BOARD_SIZE;
}

export function posOf(key: number): Pos {
  return { row: rowOf(key), col: colOf(key) };
}

/** Unique keys in row-major order. */
export function sortKeys(keys: Iterable<number>): number[] {
  return [...new Set(keys)].sort((a, b) => a - b);
}

/** Unique positions in row-major order. */
export function keysToPositions(keys: Iterable<number>): Pos[] {
  return sortKeys(keys).map(posOf);
}

export function cellAt(board: WorkBoard, key: number): Cell {
  return board[rowOf(key)][colOf(key)];
}

/** Tile at key; throws if the cell is empty (internal invariant). */
export function tileAt(board: WorkBoard, key: number): Tile {
  const tile = board[rowOf(key)][colOf(key)];
  if (!tile) throw new EngineError(`Empty cell at (${rowOf(key)}, ${colOf(key)})`);
  return tile;
}

export function setCell(board: WorkBoard, key: number, cell: Cell): void {
  board[rowOf(key)][colOf(key)] = cell;
}

export function cloneTile(tile: Tile): Tile {
  return { id: tile.id, base: tile.base, special: tile.special };
}

export function cloneBoard(board: readonly (readonly Cell[])[]): WorkBoard {
  return board.map((row) => row.map((cell) => (cell ? cloneTile(cell) : null)));
}

export function emptyBoard(): WorkBoard {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, (): Cell => null));
}

export function tileRef(tile: Tile, key: number): TileRef {
  return { tileId: tile.id, pos: posOf(key), base: tile.base, special: tile.special };
}

export function emptyLayers(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));
}

export function cloneLayers(layers: readonly (readonly number[])[]): number[][] {
  return layers.map((row) => row.slice());
}

/** Builds the 11×11 layer grid from level overlays. Throws on invalid overlays. */
export function layersFromOverlays(overlays: readonly Overlay[]): number[][] {
  const layers = emptyLayers();
  for (const overlay of overlays) {
    if (!inBounds(overlay.row, overlay.col)) {
      throw new Error(`Overlay out of bounds: (${overlay.row}, ${overlay.col})`);
    }
    if (overlay.hp !== 1 && overlay.hp !== 2) {
      throw new Error(`Invalid overlay hp ${String(overlay.hp)} at (${overlay.row}, ${overlay.col})`);
    }
    layers[overlay.row][overlay.col] = overlay.hp;
  }
  return layers;
}

/** Throws unless every cell holds a tile and tile ids are unique. Returns the board typed as full. */
export function assertFullBoard(board: WorkBoard): Tile[][] {
  const ids = new Set<number>();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const tile = board[row][col];
      if (!tile) throw new EngineError(`Board not full at (${row}, ${col})`);
      if (ids.has(tile.id)) throw new EngineError(`Duplicate tile id ${tile.id}`);
      ids.add(tile.id);
    }
  }
  return board as Tile[][];
}
