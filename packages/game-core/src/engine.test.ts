import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createGame,
  createGameFromBoard,
  formatBoardFixture,
  getLegalMoves,
  parseBoardFixture,
  replay,
  restoreState,
  serializeState,
} from './index.ts';
import { findRuns } from './match.ts';
import { Rng } from './rng.ts';
import { RULES_VERSION, type GameEvent, type GameState, type LevelDefinition, type Move, type Overlay } from './types.ts';
import { checkEventGrammar, deepFreeze, fixture, ofType, p, reconstructBoard, testLevel } from './test-utils.ts';

const crumbs: Overlay[] = [
  { row: 4, col: 4, hp: 2 },
  { row: 4, col: 5, hp: 2 },
  { row: 5, col: 4, hp: 1 },
  { row: 5, col: 5, hp: 1 },
  { row: 0, col: 0, hp: 1 },
  { row: 10, col: 10, hp: 2 },
];

describe('rng', () => {
  it('mulberry32 is deterministic and stays in [0, 1)', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const values = Array.from({ length: 1000 }, () => a.next());
    expect(Array.from({ length: 1000 }, () => b.next())).toEqual(values);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(a.state).toBe(b.state);
    expect(Number.isInteger(a.state) && a.state >= 0 && a.state <= 0xffffffff).toBe(true);
  });

  it('matches the reference mulberry32 sequence', () => {
    // Reference implementation (public domain), inlined for comparison.
    let s = 7 | 0;
    const ref = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rng = new Rng(7);
    for (let i = 0; i < 100; i++) expect(rng.next()).toBe(ref());
  });
});

describe('createGame', () => {
  it('produces a valid starting board', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const level = testLevel({ overlays: crumbs });
      const state = createGame(level, seed);
      const ids = state.board.flat().map((t) => t.id);
      expect(ids).toEqual(Array.from({ length: 121 }, (_, i) => i + 1));
      expect(state.nextTileId).toBe(122);
      expect(state.board.flat().every((t) => t.special === null && t.base !== null)).toBe(true);
      expect(findRuns(state.board)).toEqual([]);
      expect(getLegalMoves(state).length).toBeGreaterThan(0);
      expect(state).toMatchObject({
        rulesVersion: RULES_VERSION,
        levelId: 'test-level',
        levelVersion: 1,
        seed,
        status: 'playing',
        stars: 0,
        score: 0,
        movesLeft: 20,
        moveLimit: 20,
        moveLog: [],
      });
      expect(state.goals).toEqual([{ kind: 'collect', type: 'baursak', count: 999, done: 0 }]);
      expect(state.layers[4][4]).toBe(2);
      expect(state.layers[5][5]).toBe(1);
      expect(state.layers[3][3]).toBe(0);
    }
  });

  it('is deterministic per seed and differs across seeds', () => {
    const level = testLevel();
    expect(serializeState(createGame(level, 99))).toBe(serializeState(createGame(level, 99)));
    expect(serializeState(createGame(level, 99))).not.toBe(serializeState(createGame(level, 100)));
  });

  it('uses only the allowed types (levels 1–2 exclude zhent)', () => {
    const level = testLevel({ allowedTypes: ['baursak', 'kurt', 'kazy', 'samsa', 'tea'] });
    for (let seed = 1; seed <= 10; seed++) {
      const state = createGame(level, seed);
      expect(state.board.flat().some((t) => t.base === 'zhent')).toBe(false);
    }
  });

  it('does not mutate the level', () => {
    const level = deepFreeze(testLevel({ overlays: crumbs }));
    expect(() => createGame(level, 5)).not.toThrow();
  });
});

describe('fixtures', () => {
  it('parse assigns ids row-major from 1 and format round-trips', () => {
    const rows = fixture({ '0,0': 'RR', '1,2': 'Bh', '3,4': 'Tv', '10,10': 'Zb' });
    const board = parseBoardFixture(rows);
    expect(board[0][0]).toEqual({ id: 1, base: null, special: 'RAM' });
    expect(board[1][2]).toEqual({ id: 14, base: 'baursak', special: 'LINE_H' });
    expect(board[3][4]).toEqual({ id: 38, base: 'tea', special: 'LINE_V' });
    expect(board[10][10]).toEqual({ id: 121, base: 'kazy', special: 'BOMB' });
    expect(formatBoardFixture(board)).toEqual(rows);
    expect(parseBoardFixture(formatBoardFixture(board))).toEqual(board);
  });

  it('supports all 11 food letters and the BESH token', () => {
    const rows = fixture({ '0,0': 'M.', '0,1': 'Hh', '0,2': 'Cv', '0,3': 'Pb', '0,4': 'L.', '0,5': 'XX', '0,6': 'RR' });
    const board = parseBoardFixture(rows);
    expect(board[0].slice(0, 7).map((t) => [t.base, t.special])).toEqual([
      ['manty', null],
      ['shelpek', 'LINE_H'],
      ['chakchak', 'LINE_V'],
      ['plov', 'BOMB'],
      ['lagman', null],
      [null, 'BESH'],
      [null, 'RAM'],
    ]);
    expect(formatBoardFixture(board)).toEqual(rows);
    expect(() => parseBoardFixture(fixture({ '1,1': 'Xh' }))).toThrow();
    const state = createGameFromBoard(testLevel(), rows, 1);
    expect(serializeState(restoreState(serializeState(state)))).toBe(serializeState(state));
  });

  it('createGameFromBoard keeps fixture matches unresolved and sets nextTileId', () => {
    const state = createGameFromBoard(testLevel({ overlays: crumbs }), fixture({ '0,0': 'B.', '0,1': 'B.', '0,2': 'B.' }), 5);
    expect(state.board[0][0]).toEqual({ id: 1, base: 'baursak', special: null });
    expect(findRuns(state.board)).toHaveLength(1);
    expect(state.nextTileId).toBe(122);
    expect(state.rngState).toBe(5);
    expect(state.layers[4][5]).toBe(2);
  });

  it.each([
    ['10 rows', () => fixture().slice(0, 10)],
    ['12 tokens', () => fixture().map((r, i) => (i === 3 ? `${r} B.` : r))],
    ['unknown food', () => fixture({ '2,2': 'X.' })],
    ['unknown kind', () => fixture({ '2,2': 'Bx' })],
    ['3-char token', () => fixture({ '2,2': 'B..' })],
  ])('rejects malformed fixtures: %s', (_name, make) => {
    expect(() => parseBoardFixture(make())).toThrow();
    expect(() => createGameFromBoard(testLevel(), make(), 1)).toThrow();
  });
});

describe('serialization and replay', () => {
  function playRandom(level: LevelDefinition, seed: number, count: number): GameState {
    let state = createGame(level, seed);
    const picker = new Rng(seed ^ 0x5bd1e995);
    for (let i = 0; i < count && state.status === 'playing'; i++) {
      const moves = getLegalMoves(state);
      const result = applyMove(state, picker.pick(moves));
      expect(result.ok).toBe(true);
      state = result.state;
    }
    return state;
  }

  it('serializeState is canonical (sorted keys) and restore round-trips exactly', () => {
    const state = playRandom(testLevel({ overlays: crumbs }), 17, 6);
    const json = serializeState(state);
    expect(json.startsWith('{"allowedTypes":')).toBe(true);
    expect(json).toContain('{"base":');
    const restored = restoreState(json);
    expect(restored).toEqual(state);
    expect(serializeState(restored)).toBe(json);
  });

  it('replay of the move log reproduces the identical canonical state', () => {
    const level = testLevel({ overlays: crumbs });
    for (const seed of [3, 8, 21]) {
      const state = playRandom(level, seed, 12);
      expect(serializeState(replay(level, seed, state.moveLog))).toBe(serializeState(state));
    }
  });

  it('a restored state continues identically to the original', () => {
    const level = testLevel({ overlays: crumbs });
    const state = playRandom(level, 4, 5);
    const restored = restoreState(serializeState(state));
    const move = getLegalMoves(state)[0];
    const a = applyMove(state, move);
    const b = applyMove(restored, move);
    expect(serializeState(b.state)).toBe(serializeState(a.state));
    expect(b.events).toEqual(a.events);
  });

  it('replay throws on a rejected move', () => {
    expect(() => replay(testLevel(), 1, [{ from: p(0, 0), to: p(0, 3) }])).toThrow(/rejected/);
  });

  it.each([
    ['not JSON', 'nope'],
    ['empty object', '{}'],
    ['array', '[]'],
  ])('restoreState rejects garbage: %s', (_name, input) => {
    expect(() => restoreState(input)).toThrow();
  });

  it('restoreState rejects structural corruption', () => {
    const state = createGame(testLevel(), 1);
    const shortBoard = { ...state, board: state.board.slice(0, 10) };
    expect(() => restoreState(JSON.stringify(shortBoard))).toThrow();
    const dupBoard = { ...state, board: state.board.map((row, r) => (r === 0 ? [state.board[1][0], ...row.slice(1)] : row)) };
    expect(() => restoreState(JSON.stringify(dupBoard))).toThrow(/duplicate/);
    expect(() => restoreState(JSON.stringify({ ...state, status: 'paused' }))).toThrow();
    expect(() => restoreState(JSON.stringify({ ...state, layers: state.layers.map((r) => r.map(() => 3)) }))).toThrow();
    expect(() => restoreState(JSON.stringify({ ...state, nextTileId: 5 }))).toThrow();
  });

  it('applyMove is deterministic and never mutates its input', () => {
    const state = deepFreeze(createGame(testLevel({ overlays: crumbs }), 33));
    const before = serializeState(state);
    const move = getLegalMoves(state)[0];
    const a = applyMove(state, move);
    const b = applyMove(state, move);
    expect(a.ok).toBe(true);
    expect(serializeState(state)).toBe(before);
    expect(serializeState(a.state)).toBe(serializeState(b.state));
    expect(a.events).toEqual(b.events);
  });
});

describe('randomized invariants', () => {
  // Plain assertions (not expect) keep thousands of per-tile checks fast.
  function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(`Invariant failed: ${message}`);
  }

  function checkBoard(state: GameState): void {
    assert(state.board.length === 11, 'board has 11 rows');
    const ids = new Set<number>();
    for (const row of state.board) {
      assert(row.length === 11, 'row has 11 cells');
      for (const tile of row) {
        assert(!!tile, 'cell occupied');
        assert(!ids.has(tile.id), `unique id ${tile.id}`);
        ids.add(tile.id);
        assert(tile.id < state.nextTileId, 'id below nextTileId');
        const universal = tile.special === 'RAM' || tile.special === 'BESH';
        assert(universal ? tile.base === null : tile.base !== null, 'base matches kind');
      }
    }
    assert(ids.size === 121, '121 tiles');
    assert(findRuns(state.board).length === 0, 'no matches in idle');
    for (const row of state.layers) for (const hp of row) assert(hp >= 0 && hp <= 2, 'layer hp in 0..2');
    assert(state.movesLeft >= 0, 'movesLeft >= 0');
    for (const goal of state.goals) assert(goal.done >= 0 && goal.done <= goal.count, 'goal clamped');
    if (state.status === 'playing') assert(getLegalMoves(state).length > 0, 'legal move exists while playing');
  }

  function checkMove(prev: GameState, next: GameState, events: GameEvent[]): void {
    checkEventGrammar(events);
    assert(next.movesLeft === prev.movesLeft - 1, 'exactly one move consumed');
    assert(next.moveLog.length === prev.moveLog.length + 1, 'move logged');
    // Events alone reconstruct the next board (renderer contract).
    assert(JSON.stringify(reconstructBoard(prev.board, events)) === JSON.stringify(next.board), 'events reconstruct board');
    // Score is the sum of wave deltas; spawned tiles equal removed tiles per wave.
    const removed = ofType(events, 'tilesRemoved');
    const spawned = ofType(events, 'tilesSpawned');
    assert(next.score === prev.score + removed.reduce((sum, e) => sum + e.scoreDelta, 0), 'score = sum of deltas');
    removed.forEach((e, i) => assert(spawned[i].tiles.length === e.tiles.length, 'spawned = removed'));
    // Layers only change through obstacleDamaged, at most 1 HP per cell per wave.
    const expected = prev.layers.map((row) => row.slice());
    for (const e of ofType(events, 'obstacleDamaged')) {
      const seen = new Set<string>();
      for (const c of e.cells) {
        const key = `${c.pos.row},${c.pos.col}`;
        assert(!seen.has(key), 'one damage per cell per wave');
        seen.add(key);
        expected[c.pos.row][c.pos.col] -= 1;
        assert(expected[c.pos.row][c.pos.col] === c.hp, 'reported hp');
        assert(c.destroyed === (c.hp === 0), 'destroyed flag');
      }
    }
    assert(JSON.stringify(next.layers) === JSON.stringify(expected), 'layers follow obstacleDamaged');
    next.goals.forEach((g, i) => assert(g.done >= prev.goals[i].done, 'goals never decrease'));
    // Each special activates at most once per wave.
    const perWave = new Set<string>();
    for (const a of ofType(events, 'specialActivated')) {
      for (const ref of a.partner ? [a.tile, a.partner] : [a.tile]) {
        const key = `${a.wave}:${ref.tileId}`;
        assert(!perWave.has(key), 'special activates once per wave');
        perWave.add(key);
      }
    }
  }

  function pickMove(state: GameState, picker: Rng): Move {
    const moves = getLegalMoves(state);
    // Prefer swaps involving specials half of the time to exercise pairs and RAM effects.
    const special = moves.filter(
      (m) => state.board[m.from.row][m.from.col].special !== null || state.board[m.to.row][m.to.col].special !== null,
    );
    if (special.length > 0 && picker.next() < 0.5) return picker.pick(special);
    return picker.pick(moves);
  }

  it.each([
    ['6 types with crumbs', testLevel({ overlays: crumbs, moveLimit: 40 })],
    ['5 types', testLevel({ allowedTypes: ['baursak', 'kurt', 'kazy', 'samsa', 'tea'], moveLimit: 40 })],
    [
      '6 types incl. new dishes (level 13 set)',
      testLevel({ allowedTypes: ['baursak', 'kazy', 'zhent', 'manty', 'chakchak', 'lagman'], moveLimit: 40, overlays: crumbs }),
    ],
    [
      '6 new-heavy types (level 12 set)',
      testLevel({ allowedTypes: ['kurt', 'samsa', 'shelpek', 'chakchak', 'plov', 'lagman'], moveLimit: 40 }),
    ],
    [
      '4 types with crumbs (frequent specials)',
      testLevel({ allowedTypes: ['baursak', 'kurt', 'kazy', 'samsa'], moveLimit: 40, overlays: crumbs }),
    ],
  ])('random play keeps invariants: %s', (_name, level) => {
    const effects = new Set<string>();
    let moves = 0;
    for (let seed = 1; seed <= 25; seed++) {
      let state = createGame(level, seed);
      checkBoard(state);
      const picker = new Rng(seed * 7919);
      while (state.status === 'playing') {
        const result = applyMove(state, pickMove(state, picker));
        if (!result.ok) throw new Error(`seed ${seed}: move rejected (${result.reason}) ${JSON.stringify(result.events)}`);
        checkMove(state, result.state, result.events);
        checkBoard(result.state);
        for (const a of ofType(result.events, 'specialActivated')) effects.add(a.effect);
        moves++;
        state = result.state;
      }
      expect(state.status).toBe('lost');
      expect(serializeState(replay(level, seed, state.moveLog))).toBe(serializeState(state));
    }
    expect(moves).toBe(25 * 40);
    // The random sweep must actually exercise special effects.
    expect(effects.size).toBeGreaterThanOrEqual(4);
  });
});
