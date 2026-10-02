import { describe, expect, it } from 'vitest';
import {
  FOOD_TYPES,
  RULES_VERSION,
  validateLevel,
  type FoodType,
  type Goal,
  type Move,
  type Overlay,
  type TutorialDefinition,
} from '@dastakhan/game-core';
import { getLevel, getTutorial, levelIndex, levels, tutorialAfterLevel, tutorials } from './index.ts';

/* ------------------------------------------------------------------ */
/* Campaign levels (GAME_SPEC v1.2 §9, rules v2)                        */
/* ------------------------------------------------------------------ */

const collect = (type: FoodType, count: number): Goal => ({ kind: 'collect', type, count });
const crumbs = (count: number): Goal => ({ kind: 'clearCrumbs', count });
/** Allowed types written as in the §9 table; returned in FOOD_TYPES order. */
const types = (...list: FoodType[]): FoodType[] => FOOD_TYPES.filter((type) => list.includes(type));

/** Overlay cells for every row/col on the 11×11 board matching `hp(row, col)` (0 = no layer). */
function overlaysWhere(hp: (row: number, col: number) => 0 | 1 | 2): Overlay[] {
  const out: Overlay[] = [];
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 11; col++) {
      const value = hp(row, col);
      if (value !== 0) out.push({ row, col, hp: value });
    }
  }
  return out;
}
const inRect = (r: number, c: number, r0: number, r1: number, c0: number, c1: number) =>
  r >= r0 && r <= r1 && c >= c0 && c <= c1;

const ORIGINAL_SIX = types('baursak', 'kurt', 'kazy', 'samsa', 'zhent', 'tea');

/** The §9 table, written out independently of the JSON files. */
const TABLE: { moves: number; types: FoodType[]; goals: Goal[]; overlays: Overlay[] }[] = [
  { moves: 20, types: types('baursak', 'kurt', 'kazy', 'samsa', 'tea'), goals: [collect('baursak', 25)], overlays: [] },
  {
    moves: 22,
    types: types('baursak', 'kurt', 'kazy', 'samsa', 'tea'),
    goals: [collect('kurt', 20), collect('kazy', 20)],
    overlays: [],
  },
  { moves: 24, types: ORIGINAL_SIX, goals: [collect('samsa', 30)], overlays: [] },
  { moves: 25, types: ORIGINAL_SIX, goals: [collect('tea', 25), collect('zhent', 25)], overlays: [] },
  {
    moves: 25,
    types: types('baursak', 'kurt', 'kazy', 'samsa', 'tea', 'manty'),
    goals: [crumbs(9)],
    overlays: overlaysWhere((r, c) => (inRect(r, c, 4, 6, 4, 6) ? 1 : 0)),
  },
  {
    moves: 26,
    types: types('baursak', 'kazy', 'samsa', 'tea', 'manty', 'shelpek'),
    goals: [crumbs(25)],
    overlays: overlaysWhere((r, c) => (inRect(r, c, 3, 7, 3, 7) ? 1 : 0)),
  },
  {
    moves: 26,
    types: types('baursak', 'kurt', 'samsa', 'tea', 'manty', 'shelpek'),
    goals: [crumbs(22), collect('baursak', 25)],
    overlays: overlaysWhere((r) => (r === 2 || r === 8 ? 1 : 0)),
  },
  {
    moves: 27,
    types: types('kurt', 'kazy', 'samsa', 'zhent', 'tea', 'chakchak'),
    goals: [crumbs(9)],
    overlays: overlaysWhere((r, c) => (inRect(r, c, 4, 6, 4, 6) ? 2 : 0)),
  },
  {
    moves: 28,
    types: types('baursak', 'kazy', 'tea', 'manty', 'shelpek', 'chakchak'),
    goals: [crumbs(21)],
    overlays: overlaysWhere((r, c) => (r === 5 || c === 5 ? 1 : 0)),
  },
  {
    moves: 28,
    types: types('kurt', 'kazy', 'samsa', 'tea', 'chakchak', 'plov'),
    goals: [collect('kurt', 35), collect('kazy', 35)],
    overlays: [],
  },
  {
    moves: 29,
    types: types('baursak', 'zhent', 'tea', 'manty', 'plov', 'lagman'),
    goals: [crumbs(25)],
    overlays: overlaysWhere((r, c) => (inRect(r, c, 4, 6, 4, 6) ? 2 : inRect(r, c, 3, 7, 3, 7) ? 1 : 0)),
  },
  {
    moves: 30,
    types: types('kurt', 'samsa', 'shelpek', 'chakchak', 'plov', 'lagman'),
    goals: [crumbs(40)],
    overlays: overlaysWhere((r, c) => (r === 0 || r === 10 || c === 0 || c === 10 ? 1 : 0)),
  },
  {
    moves: 30,
    types: types('baursak', 'kazy', 'zhent', 'manty', 'chakchak', 'lagman'),
    goals: [crumbs(16)],
    overlays: overlaysWhere((r, c) =>
      [
        [1, 1],
        [1, 8],
        [8, 1],
        [8, 8],
      ].some(([r0, c0]) => inRect(r, c, r0, r0 + 1, c0, c0 + 1))
        ? 2
        : 0,
    ),
  },
  { moves: 30, types: ORIGINAL_SIX, goals: ORIGINAL_SIX.map((type) => collect(type, 25)), overlays: [] },
  {
    moves: 32,
    types: types('baursak', 'kazy', 'tea', 'shelpek', 'plov', 'lagman'),
    goals: [crumbs(25), collect('tea', 40)],
    overlays: overlaysWhere((r, c) => (inRect(r, c, 3, 7, 3, 7) ? 2 : 0)),
  },
];

describe('campaign levels', () => {
  it('has 15 levels with ids level-01 … level-15 in order', () => {
    expect(levels.map((level) => level.id)).toEqual(
      Array.from({ length: 15 }, (_, i) => `level-${String(i + 1).padStart(2, '0')}`),
    );
  });

  it.each(levels.map((level, i) => [level.id, i] as const))('%s passes the shared schema', (_id, i) => {
    expect(validateLevel(levels[i])).toEqual({ ok: true, errors: [] });
  });

  it.each(levels.map((level, i) => [level.id, i] as const))('%s matches the §9 table', (_id, i) => {
    const level = levels[i];
    const row = TABLE[i];
    expect(level.version).toBe(1);
    expect(level.rulesVersion).toBe(RULES_VERSION);
    expect(level.rulesVersion).toBe(2);
    expect(level.rows).toBe(11);
    expect(level.cols).toBe(11);
    expect(level.moveLimit).toBe(row.moves);
    expect(level.allowedTypes).toEqual(row.types);
    expect(level.goals).toEqual(row.goals);
    expect(level.overlays).toEqual(row.overlays);
    expect(level.tutorialId).toBeUndefined();
  });

  it('uses 5–6 food types per level, never all 11', () => {
    for (const level of levels) {
      expect(level.allowedTypes.length).toBeGreaterThanOrEqual(5);
      expect(level.allowedTypes.length).toBeLessThanOrEqual(6);
    }
  });

  it('introduces new dishes in the §9 order', () => {
    const firstLevel = (type: FoodType) => levels.find((level) => level.allowedTypes.includes(type))?.id;
    expect(firstLevel('manty')).toBe('level-05');
    expect(firstLevel('shelpek')).toBe('level-06');
    expect(firstLevel('chakchak')).toBe('level-08');
    expect(firstLevel('plov')).toBe('level-10');
    expect(firstLevel('lagman')).toBe('level-11');
  });

  it('uses the expected overlay cell counts and HP', () => {
    const summary = levels.map((level) => [
      level.id,
      level.overlays.length,
      level.overlays.filter((o) => o.hp === 2).length,
    ]);
    expect(summary).toEqual([
      ['level-01', 0, 0],
      ['level-02', 0, 0],
      ['level-03', 0, 0],
      ['level-04', 0, 0],
      ['level-05', 9, 0],
      ['level-06', 25, 0],
      ['level-07', 22, 0],
      ['level-08', 9, 9],
      ['level-09', 21, 0],
      ['level-10', 0, 0],
      ['level-11', 25, 9],
      ['level-12', 40, 0],
      ['level-13', 16, 16],
      ['level-14', 0, 0],
      ['level-15', 25, 25],
    ]);
  });

  it('sets every clearCrumbs count to the number of overlay cells (not total HP)', () => {
    for (const level of levels) {
      const crumbGoals = level.goals.filter((goal) => goal.kind === 'clearCrumbs');
      if (level.overlays.length === 0) {
        expect(crumbGoals).toEqual([]);
      } else {
        expect(crumbGoals).toEqual([{ kind: 'clearCrumbs', count: level.overlays.length }]);
      }
    }
  });

  it('lists overlays in row-major order', () => {
    for (const level of levels) {
      const keys = level.overlays.map((o) => o.row * 11 + o.col);
      expect(keys).toEqual([...keys].sort((a, b) => a - b));
    }
  });

  it('exposes lookup helpers', () => {
    expect(getLevel('level-07')).toBe(levels[6]);
    expect(getLevel('level-16')).toBeUndefined();
    expect(levelIndex('level-01')).toBe(0);
    expect(levelIndex('level-15')).toBe(14);
    expect(levelIndex('nope')).toBe(-1);
  });
});

/* ------------------------------------------------------------------ */
/* Tutorials: tiny local resolver over known tiles (no engine)         */
/* Refilled cells are unknown (null) and never match.                  */
/* ------------------------------------------------------------------ */

interface Cell {
  /** Food letter, or null for RAM/BESH. */
  base: string | null;
  /** '.', 'h', 'v', 'b', 'R' (RAM) or 'X' (BESH). */
  kind: string;
}
type Grid = (Cell | null)[][];
interface Run {
  horizontal: boolean;
  cells: string[];
}
interface Component {
  runs: Run[];
  cells: Set<string>;
}
type Shape = 'line3' | 'line4h' | 'line4v' | 'lt' | 'line5' | 'besh';
interface Wave {
  shapes: { shape: Shape; base: string; size: number }[];
  created: { at: string; shape: Shape }[];
}

const TOKEN = /^(?:[BKZSJTMHCPL][.hvb]|RR|XX)$/;
const LETTER: Record<FoodType, string> = {
  baursak: 'B',
  kurt: 'K',
  kazy: 'Z',
  samsa: 'S',
  zhent: 'J',
  tea: 'T',
  manty: 'M',
  shelpek: 'H',
  chakchak: 'C',
  plov: 'P',
  lagman: 'L',
};
const key = (row: number, col: number) => `${row},${col}`;
const rowOf = (cell: string) => Number(cell.split(',')[0]);
const colOf = (cell: string) => Number(cell.split(',')[1]);

function parse(board: string[]): Grid {
  return board.map((line) =>
    line.split(' ').map((token) => {
      if (token === 'RR') return { base: null, kind: 'R' };
      if (token === 'XX') return { base: null, kind: 'X' };
      return { base: token[0], kind: token[1] };
    }),
  );
}

function swapped(grid: Grid, move: Move): Grid {
  const next = grid.map((row) => row.slice());
  const a = next[move.from.row][move.from.col];
  next[move.from.row][move.from.col] = next[move.to.row][move.to.col];
  next[move.to.row][move.to.col] = a;
  return next;
}

/** Maximal straight runs (≥3) of one food base; RAM/BESH and unknown cells never match. */
function runs(grid: Grid): Run[] {
  const out: Run[] = [];
  for (const horizontal of [true, false]) {
    for (let i = 0; i < 11; i++) {
      const at = (k: number) => (horizontal ? grid[i][k] : grid[k][i]);
      let j = 0;
      while (j < 11) {
        const base = at(j)?.base ?? null;
        let end = j + 1;
        if (base !== null) while (end < 11 && at(end)?.base === base) end++;
        if (base !== null && end - j >= 3) {
          const cells: string[] = [];
          for (let k = j; k < end; k++) cells.push(horizontal ? key(i, k) : key(k, i));
          out.push({ horizontal, cells });
        }
        j = end;
      }
    }
  }
  return out;
}

/** Runs merged when they share an actual cell (GAME_SPEC §3). */
function components(grid: Grid): Component[] {
  const comps: Component[] = [];
  for (const run of runs(grid)) {
    const merged: Component = { runs: [run], cells: new Set(run.cells) };
    for (let i = comps.length - 1; i >= 0; i--) {
      if ([...comps[i].cells].some((cell) => merged.cells.has(cell))) {
        const other = comps.splice(i, 1)[0];
        merged.runs.push(...other.runs);
        other.cells.forEach((cell) => merged.cells.add(cell));
      }
    }
    comps.push(merged);
  }
  return comps;
}

function classify(comp: Component): Shape {
  const { runs: rs } = comp;
  const crossesFour = (a: Run) =>
    rs.some((b) => b.horizontal !== a.horizontal && b.cells.length >= 4 && b.cells.some((cell) => a.cells.includes(cell)));
  if (rs.some((a) => a.cells.length >= 5 && crossesFour(a))) return 'besh';
  if (rs.some((r) => r.cells.length >= 5)) return 'line5';
  if (rs.some((r) => r.horizontal) && rs.some((r) => !r.horizontal)) return 'lt';
  if (rs.length === 1 && rs[0].cells.length === 4) return rs[0].horizontal ? 'line4h' : 'line4v';
  return 'line3';
}

const CREATED: Partial<Record<Shape, (base: string) => Cell>> = {
  besh: () => ({ base: null, kind: 'X' }),
  line5: () => ({ base: null, kind: 'R' }),
  lt: (base) => ({ base, kind: 'b' }),
  line4h: (base) => ({ base, kind: 'h' }),
  line4v: (base) => ({ base, kind: 'v' }),
};

function gravity(grid: Grid, removed: Set<string>): Grid {
  const next: Grid = grid.map((row) => row.slice());
  for (let col = 0; col < 11; col++) {
    const kept: (Cell | null)[] = [];
    for (let row = 10; row >= 0; row--) if (!removed.has(key(row, col))) kept.push(grid[row][col]);
    for (let row = 10, i = 0; row >= 0; row--, i++) next[row][col] = i < kept.length ? kept[i] : null;
  }
  return next;
}

/**
 * Resolves an ordinary-match swap over known tiles: matches, special creation
 * (swap destination, then origin, then greatest row/smallest col; cascades use the
 * fallback), removal and gravity, until no known match remains. Throws if a match
 * contains an existing special (step 1 of every tutorial must not).
 */
function resolveKnown(start: Grid, move: Move): { grid: Grid; waves: Wave[]; maxRow: number } {
  let grid = swapped(start, move);
  const touched = new Set([key(move.from.row, move.from.col), key(move.to.row, move.to.col)]);
  const waves: Wave[] = [];
  for (let wave = 1; wave <= 20; wave++) {
    const comps = components(grid);
    if (comps.length === 0) break;
    const removed = new Set<string>();
    const result: Wave = { shapes: [], created: [] };
    const placed: [string, Cell][] = [];
    for (const comp of comps) {
      const cells = [...comp.cells];
      const base = grid[rowOf(cells[0])][colOf(cells[0])]!.base!;
      for (const cell of cells) {
        if (grid[rowOf(cell)][colOf(cell)]!.kind !== '.') throw new Error(`existing special matched at ${cell}`);
        touched.add(cell);
      }
      const shape = classify(comp);
      result.shapes.push({ shape, base, size: cells.length });
      let at: string | null = null;
      const make = CREATED[shape];
      if (make) {
        const dest = key(move.to.row, move.to.col);
        const origin = key(move.from.row, move.from.col);
        if (wave === 1 && comp.cells.has(dest)) at = dest;
        else if (wave === 1 && comp.cells.has(origin)) at = origin;
        else at = [...cells].sort((a, b) => rowOf(b) - rowOf(a) || colOf(a) - colOf(b))[0];
        placed.push([at, make(base)]);
        result.created.push({ at, shape });
      }
      for (const cell of cells) if (cell !== at) removed.add(cell);
    }
    for (const [at, cell] of placed) grid[rowOf(at)][colOf(at)] = cell;
    grid = gravity(grid, removed);
    waves.push(result);
  }
  return { grid, waves, maxRow: Math.max(...[...touched].map(rowOf)) };
}

function tokensOf(tutorial: TutorialDefinition): string[][] {
  return tutorial.board.map((line) => line.split(' '));
}

function specials(tutorial: TutorialDefinition): { row: number; col: number; token: string }[] {
  const out: { row: number; col: number; token: string }[] = [];
  tokensOf(tutorial).forEach((row, r) =>
    row.forEach((token, c) => {
      if (token[1] !== '.') out.push({ row: r, col: c, token });
    }),
  );
  return out;
}

/** Food types shown on the fixture, in FOOD_TYPES order. */
function boardTypes(tutorial: TutorialDefinition): FoodType[] {
  const letters = new Set(tokensOf(tutorial).flat().map((token) => token[0]));
  return FOOD_TYPES.filter((type) => letters.has(LETTER[type]));
}

const SLUGS: Record<TutorialDefinition['id'], string> = {
  'tutorial-line': 'line',
  'tutorial-bomb': 'bomb',
  'tutorial-ram': 'ram',
  'tutorial-ram-ram': 'ramRam',
  'tutorial-besh': 'besh',
};

describe('local fixture resolver', () => {
  const filler = (shift: number) =>
    Array.from({ length: 11 }, (_, c) => ['B.', 'K.', 'Z.', 'S.', 'J.', 'T.'][(c + shift) % 6]).join(' ');
  const base = Array.from({ length: 11 }, (_, r) => filler(r * 2));
  const withTokens = (cells: [number, number, string][]) => {
    const board = base.map((line) => line.split(' '));
    for (const [r, c, token] of cells) board[r][c] = token;
    return board.map((tokens) => tokens.join(' '));
  };

  it('finds no runs on a diagonal pattern', () => {
    expect(runs(parse(base))).toEqual([]);
  });

  it('detects runs of specials by base and ignores RAM, BESH and unknown cells', () => {
    const board = base.slice();
    board[0] = 'B. Bh Bb K. RR RR RR XX XX XX T.';
    expect(runs(parse(board))).toEqual([{ horizontal: true, cells: ['0,0', '0,1', '0,2'] }]);
    const grid = parse(base);
    grid[5][5] = null;
    expect(runs(grid)).toEqual([]);
  });

  it('classifies L/T, straight 5 and the BESH cross', () => {
    const lt = withTokens([[0, 0, 'T.'], [0, 1, 'T.'], [0, 2, 'T.'], [1, 0, 'T.'], [2, 0, 'T.']]);
    expect(components(parse(lt)).map(classify)).toEqual(['lt']);
    const five = withTokens([[3, 0, 'M.'], [3, 1, 'M.'], [3, 2, 'M.'], [3, 3, 'M.'], [3, 4, 'M.']]);
    expect(components(parse(five)).map(classify)).toEqual(['line5']);
    const cross = withTokens([
      [3, 0, 'M.'], [3, 1, 'M.'], [3, 2, 'M.'], [3, 3, 'M.'], [3, 4, 'M.'],
      [4, 2, 'M.'], [5, 2, 'M.'], [6, 2, 'M.'],
    ]);
    expect(components(parse(cross)).map(classify)).toEqual(['besh']);
  });
});

describe('tutorials', () => {
  it('ships the five tutorials in order with the campaign mapping', () => {
    expect(tutorials.map((t) => t.id)).toEqual([
      'tutorial-line',
      'tutorial-bomb',
      'tutorial-ram',
      'tutorial-ram-ram',
      'tutorial-besh',
    ]);
    expect(tutorialAfterLevel).toEqual({
      'level-02': 'tutorial-line',
      'level-04': 'tutorial-bomb',
      'level-07': 'tutorial-ram',
      'level-10': 'tutorial-ram-ram',
      'level-12': 'tutorial-besh',
    });
    for (const [levelId, tutorialId] of Object.entries(tutorialAfterLevel)) {
      expect(getLevel(levelId)).toBeDefined();
      expect(getTutorial(tutorialId)?.id).toBe(tutorialId);
    }
    expect(getTutorial('tutorial-nope')).toBeUndefined();
  });

  describe.each(tutorials.map((t) => [t.id, t] as const))('%s', (id, tutorial) => {
    const slug = SLUGS[id];

    it('has a valid rules-v2 level frame bound to the tutorial', () => {
      expect(tutorial.version).toBe(1);
      expect(tutorial.rulesVersion).toBe(2);
      expect(tutorial.level.rulesVersion).toBe(2);
      expect(validateLevel(tutorial.level)).toEqual({ ok: true, errors: [] });
      expect(tutorial.level.id).toBe(id);
      expect(tutorial.level.tutorialId).toBe(id);
      expect(tutorial.level.overlays).toEqual([]);
      expect(tutorial.level.moveLimit).toBeGreaterThanOrEqual(tutorial.steps.length + 3);
      expect(tutorial.level.goals.length).toBeGreaterThan(0);
      expect(tutorial.level.goals.every((goal) => goal.kind === 'collect')).toBe(true);
      expect(Number.isInteger(tutorial.seed) && tutorial.seed >= 0).toBe(true);
    });

    it('allows exactly the 5–6 food types shown on its board', () => {
      expect(tutorial.level.allowedTypes).toEqual(boardTypes(tutorial));
      expect(tutorial.level.allowedTypes.length).toBeGreaterThanOrEqual(5);
      expect(tutorial.level.allowedTypes.length).toBeLessThanOrEqual(6);
    });

    it('uses the agreed i18n keys', () => {
      expect(tutorial.titleKey).toBe(`tutorial.${slug}.title`);
      expect(tutorial.doneTextKey).toBe(`tutorial.${slug}.done`);
      expect(tutorial.steps.map((step) => step.textKey)).toEqual(
        tutorial.steps.map((_, i) => `tutorial.${slug}.step${i + 1}`),
      );
    });

    it('has a well-formed 11×11 fixture without a starting run of 3+', () => {
      expect(tutorial.board).toHaveLength(11);
      for (const row of tokensOf(tutorial)) {
        expect(row).toHaveLength(11);
        for (const token of row) expect(token).toMatch(TOKEN);
      }
      expect(runs(parse(tutorial.board))).toEqual([]);
    });

    it('has in-bounds, orthogonally adjacent step moves', () => {
      expect(tutorial.steps.length).toBe(id === 'tutorial-ram-ram' ? 1 : 2);
      for (const { move } of tutorial.steps) {
        for (const p of [move.from, move.to]) {
          expect(p.row >= 0 && p.row < 11 && p.col >= 0 && p.col < 11).toBe(true);
        }
        expect(Math.abs(move.from.row - move.to.row) + Math.abs(move.from.col - move.to.col)).toBe(1);
      }
    });
  });

  /** Step 1 must create exactly one special in its first (or given) wave and nothing else among known tiles. */
  function step1(tutorial: TutorialDefinition) {
    return resolveKnown(parse(tutorial.board), tutorial.steps[0].move);
  }

  it.each([
    ['tutorial-line', 'line4h', 'h'],
    ['tutorial-bomb', 'lt', 'b'],
  ] as const)('%s: step 1 creates the special, step 2 matches a pre-placed one below it', (id, shape, kind) => {
    const tutorial = getTutorial(id)!;
    const { grid, waves, maxRow } = step1(tutorial);
    const move1 = tutorial.steps[0].move;
    expect(waves).toHaveLength(1);
    expect(waves[0].shapes.map((s) => s.shape)).toEqual([shape]);
    expect(waves[0].created).toEqual([{ at: key(move1.to.row, move1.to.col), shape }]);

    const pre = specials(tutorial);
    expect(pre).toHaveLength(1);
    expect(pre[0].token[1]).toBe(kind);
    expect(pre[0].row).toBeGreaterThan(maxRow);

    const move2 = tutorial.steps[1].move;
    expect(Math.min(move2.from.row, move2.to.row)).toBeGreaterThan(maxRow);
    const comps2 = components(swapped(grid, move2));
    expect(comps2).toHaveLength(1);
    expect(comps2[0].cells.has(key(pre[0].row, pre[0].col))).toBe(true);
    expect([...comps2[0].cells].every((cell) => rowOf(cell) > maxRow)).toBe(true);
  });

  it('tutorial-ram: step 1 makes a straight 5, step 2 swaps a pre-placed RAM with ordinary food below it', () => {
    const tutorial = getTutorial('tutorial-ram')!;
    const { grid, waves, maxRow } = step1(tutorial);
    const move1 = tutorial.steps[0].move;
    expect(waves).toHaveLength(1);
    expect(waves[0].created).toEqual([{ at: key(move1.to.row, move1.to.col), shape: 'line5' }]);
    const pre = specials(tutorial);
    expect(pre.map((p) => p.token)).toEqual(['RR']);
    const move2 = tutorial.steps[1].move;
    expect(Math.min(move2.from.row, move2.to.row)).toBeGreaterThan(maxRow);
    const pair = [grid[move2.from.row][move2.from.col], grid[move2.to.row][move2.to.col]];
    expect(pair.filter((cell) => cell?.kind === 'R')).toHaveLength(1);
    expect(pair.filter((cell) => cell?.kind === '.')).toHaveLength(1);
  });

  it('tutorial-ram-ram: the only step swaps two adjacent pre-placed RAM pieces', () => {
    const tutorial = getTutorial('tutorial-ram-ram')!;
    expect(specials(tutorial).map((p) => p.token)).toEqual(['RR', 'RR']);
    const { from, to } = tutorial.steps[0].move;
    const tokens = tokensOf(tutorial);
    expect(tokens[from.row][from.col]).toBe('RR');
    expect(tokens[to.row][to.col]).toBe('RR');
  });

  it('tutorial-besh: one swap cascades into a 5+4 cross from fixture tiles only, then BESH is swapped below it', () => {
    const tutorial = getTutorial('tutorial-besh')!;
    const { grid, waves, maxRow } = step1(tutorial);
    // Wave 1: the swap's own 3-match. Wave 2: known tiles fall into the cross (cascade → fallback cell).
    expect(waves).toHaveLength(2);
    expect(waves[0].shapes).toEqual([{ shape: 'line3', base: 'C', size: 3 }]);
    expect(waves[0].created).toEqual([]);
    expect(waves[1].shapes).toEqual([{ shape: 'besh', base: 'P', size: 8 }]);
    expect(waves[1].created).toEqual([{ at: '7,3', shape: 'besh' }]);

    expect(specials(tutorial).map((p) => p.token)).toEqual(['XX']);
    const move2 = tutorial.steps[1].move;
    expect(Math.min(move2.from.row, move2.to.row)).toBeGreaterThan(maxRow);
    const pair = [grid[move2.from.row][move2.from.col], grid[move2.to.row][move2.to.col]];
    expect(pair.filter((cell) => cell?.kind === 'X')).toHaveLength(1);
    expect(pair.filter((cell) => cell?.kind === '.')).toHaveLength(1);

    // The goal type must stay the most frequent food even if every refill were one other type.
    const [goal] = tutorial.level.goals;
    if (goal.kind !== 'collect') throw new Error('expected a collect goal');
    const counts = new Map<string, number>();
    let unknown = 0;
    for (const cell of grid.flat()) {
      if (cell === null) unknown++;
      else if (cell.base !== null) counts.set(cell.base, (counts.get(cell.base) ?? 0) + 1);
    }
    const goalCount = counts.get(LETTER[goal.type]) ?? 0;
    const maxOther = Math.max(...[...counts].filter(([letter]) => letter !== LETTER[goal.type]).map(([, n]) => n));
    expect(goalCount - maxOther).toBeGreaterThan(unknown);
    expect(goalCount).toBeGreaterThanOrEqual(goal.count);
  });

  it('keeps collect goals off every type step 1 matches, so step 1 cannot finish a tutorial early', () => {
    for (const tutorial of tutorials) {
      if (tutorial.steps.length < 2) continue;
      const matchedBases = new Set(step1(tutorial).waves.flatMap((wave) => wave.shapes.map((s) => s.base)));
      for (const goal of tutorial.level.goals) {
        if (goal.kind === 'collect') expect(matchedBases.has(LETTER[goal.type])).toBe(false);
      }
    }
  });
});
