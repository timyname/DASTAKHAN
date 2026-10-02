/**
 * Match detection (GAME_SPEC §3):
 * 1. maximal horizontal/vertical runs (length >= 3) of equal base among tiles with a base
 *    (ordinary, LINE_H, LINE_V, BOMB; RAM and BESH have no base and never match);
 * 2. runs merged into components only when they share an actual cell;
 * 3. component classification.
 */
import { BOARD_SIZE, type FoodType, type MatchShape, type SpecialKind } from './types.ts';
import { keyOf, type WorkBoard } from './board.ts';

export interface Run {
  dir: 'h' | 'v';
  base: FoodType;
  /** Cell keys along the run, in increasing order. */
  cells: number[];
}

export interface MatchComponent {
  base: FoodType;
  shape: MatchShape;
  /** Unique cell keys, row-major. */
  cells: number[];
  runs: Run[];
}

function baseAt(board: WorkBoard, row: number, col: number): FoodType | null {
  return board[row][col]?.base ?? null;
}

/** All maximal runs of length >= 3: horizontal runs first (row-major), then vertical (column-major). */
export function findRuns(board: WorkBoard): Run[] {
  const runs: Run[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    let col = 0;
    while (col < BOARD_SIZE) {
      const base = baseAt(board, row, col);
      let end = col + 1;
      if (base !== null) {
        while (end < BOARD_SIZE && baseAt(board, row, end) === base) end++;
        if (end - col >= 3) {
          const cells: number[] = [];
          for (let c = col; c < end; c++) cells.push(keyOf(row, c));
          runs.push({ dir: 'h', base, cells });
        }
      }
      col = end;
    }
  }
  for (let col = 0; col < BOARD_SIZE; col++) {
    let row = 0;
    while (row < BOARD_SIZE) {
      const base = baseAt(board, row, col);
      let end = row + 1;
      if (base !== null) {
        while (end < BOARD_SIZE && baseAt(board, end, col) === base) end++;
        if (end - row >= 3) {
          const cells: number[] = [];
          for (let r = row; r < end; r++) cells.push(keyOf(r, col));
          runs.push({ dir: 'v', base, cells });
        }
      }
      row = end;
    }
  }
  return runs;
}

function sharesCell(a: Run, b: Run): boolean {
  return a.cells.some((key) => b.cells.includes(key));
}

/**
 * Classification priority (GAME_SPEC §3): BESH (a run >= 5 sharing a cell with a perpendicular run >= 4)
 * > RAM (run >= 5) > BOMB (L/T) > LINE (run of exactly 4) > plain line of 3.
 */
export function classifyRuns(runs: readonly Run[]): MatchShape {
  const long = runs.filter((run) => run.cells.length >= 5);
  const besh = long.some((a) => runs.some((b) => b.dir !== a.dir && b.cells.length >= 4 && sharesCell(a, b)));
  if (besh) return 'besh';
  if (long.length > 0) return 'line5';
  const hasH = runs.some((run) => run.dir === 'h');
  const hasV = runs.some((run) => run.dir === 'v');
  if (hasH && hasV) return 'lt';
  const four = runs.find((run) => run.cells.length === 4);
  if (four) return four.dir === 'h' ? 'line4h' : 'line4v';
  return 'line3';
}

/** Special created by a component of this shape, or null for a plain line of 3. */
export function specialForShape(shape: MatchShape): SpecialKind | null {
  switch (shape) {
    case 'besh':
      return 'BESH';
    case 'line5':
      return 'RAM';
    case 'lt':
      return 'BOMB';
    case 'line4h':
      return 'LINE_H';
    case 'line4v':
      return 'LINE_V';
    case 'line3':
      return null;
  }
}

/** Components of runs that share at least one cell, ordered by their first (row-major) cell. */
export function findComponents(board: WorkBoard): MatchComponent[] {
  const runs = findRuns(board);
  if (runs.length === 0) return [];
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const owner = new Map<number, number>();
  runs.forEach((run, i) => {
    for (const key of run.cells) {
      const other = owner.get(key);
      if (other === undefined) {
        owner.set(key, i);
      } else {
        const a = find(i);
        const b = find(other);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  });
  const groups = new Map<number, Run[]>();
  runs.forEach((run, i) => {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(run);
    else groups.set(root, [run]);
  });
  const components: MatchComponent[] = [];
  for (const groupRuns of groups.values()) {
    const cells = [...new Set(groupRuns.flatMap((run) => run.cells))].sort((a, b) => a - b);
    components.push({ base: groupRuns[0].base, shape: classifyRuns(groupRuns), cells, runs: groupRuns });
  }
  components.sort((a, b) => a.cells[0] - b.cells[0]);
  return components;
}

export function hasAnyMatch(board: WorkBoard): boolean {
  return findRuns(board).length > 0;
}

/** True when a run of >= 3 passes through (row, col), reading bases through `baseOf`. */
export function hasRunThrough(baseOf: (row: number, col: number) => FoodType | null, row: number, col: number): boolean {
  const base = baseOf(row, col);
  if (base === null) return false;
  let h = 1;
  for (let c = col - 1; c >= 0 && baseOf(row, c) === base; c--) h++;
  for (let c = col + 1; c < BOARD_SIZE && baseOf(row, c) === base; c++) h++;
  if (h >= 3) return true;
  let v = 1;
  for (let r = row - 1; r >= 0 && baseOf(r, col) === base; r--) v++;
  for (let r = row + 1; r < BOARD_SIZE && baseOf(r, col) === base; r++) v++;
  return v >= 3;
}
