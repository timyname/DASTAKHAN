import { describe, expect, it } from 'vitest';
import { applyMove, createGame, createGameFromBoard, getLegalMoves, serializeState, starsFor } from './engine.ts';
import { parseBoardFixture } from './fixture.ts';
import { findRuns } from './match.ts';
import { hasLegalMove } from './moves.ts';
import { Rng } from './rng.ts';
import { shuffleBoard } from './shuffle.ts';
import type { GameState, LevelDefinition, Move, Overlay } from './types.ts';
import {
  BG6,
  checkEventGrammar,
  firstOfType,
  fixture,
  fixtureId,
  ofType,
  p,
  testLevel,
  waveEvents,
} from './test-utils.ts';

function mv(fr: number, fc: number, tr: number, tc: number): Move {
  return { from: p(fr, fc), to: p(tr, tc) };
}

function game(overrides: Record<string, string>, level: LevelDefinition = testLevel(), seed = 3): GameState {
  return createGameFromBoard(level, fixture(overrides), seed);
}

describe('cascades, gravity and stationary layers', () => {
  // Wave 1: T line at row 6 cols 3..5. Columns 3..5 fall by one, bringing B(5,3), B(5,4) next to B(6,2).
  // Wave 2: B line at row 6 cols 2..4.
  const overrides = { '6,3': 'T.', '6,4': 'T.', '7,5': 'T.', '5,3': 'B.', '5,4': 'B.', '6,2': 'B.' };
  const overlays: Overlay[] = [
    { row: 6, col: 3, hp: 2 },
    { row: 2, col: 4, hp: 1 },
  ];
  const level = testLevel({ overlays });

  it('resolves a deterministic cascade with multiplier ×2', () => {
    const state = game(overrides, level);
    const result = applyMove(state, mv(7, 5, 6, 5));
    expect(result.ok).toBe(true);
    checkEventGrammar(result.events);

    const w1 = waveEvents(result.events, 1);
    expect(firstOfType(w1, 'cascadeStarted').multiplier).toBe(1);
    expect(firstOfType(w1, 'matched').groups).toEqual([
      {
        shape: 'line3',
        base: 'tea',
        cells: [p(6, 3), p(6, 4), p(6, 5)],
        tileIds: [fixtureId(6, 3), fixtureId(6, 4), fixtureId(7, 5)],
      },
    ]);
    expect(firstOfType(w1, 'obstacleDamaged').cells).toEqual([{ pos: p(6, 3), hp: 1, destroyed: false }]);
    expect(firstOfType(w1, 'tilesRemoved')).toMatchObject({ scoreDelta: 30, multiplier: 1 });

    // Gravity: columns 3..5 rows 0..5 fall by exactly one row; layers stay where they are.
    const fell = firstOfType(w1, 'tilesFell').moves;
    expect(fell).toHaveLength(18);
    for (const m of fell) {
      expect(m.to).toEqual(p(m.from.row + 1, m.from.col));
      expect([3, 4, 5]).toContain(m.from.col);
    }
    expect(fell).toContainEqual({ tileId: fixtureId(2, 4), from: p(2, 4), to: p(3, 4) });
    const spawned = firstOfType(w1, 'tilesSpawned').tiles;
    expect(spawned.map((s) => [s.tile.pos, s.fromRow])).toEqual([
      [p(0, 3), -1],
      [p(0, 4), -1],
      [p(0, 5), -1],
    ]);
    expect(spawned.map((s) => s.tile.tileId)).toEqual([122, 123, 124]);

    const w2 = waveEvents(result.events, 2);
    expect(firstOfType(w2, 'cascadeStarted').multiplier).toBe(2);
    expect(firstOfType(w2, 'matched').groups).toContainEqual({
      shape: 'line3',
      base: 'baursak',
      cells: [p(6, 2), p(6, 3), p(6, 4)],
      tileIds: [fixtureId(6, 2), fixtureId(5, 3), fixtureId(5, 4)],
    });
    const damaged2 = firstOfType(w2, 'obstacleDamaged').cells;
    expect(damaged2).toContainEqual({ pos: p(6, 3), hp: 0, destroyed: true });
    const removed2 = firstOfType(w2, 'tilesRemoved');
    const destroyed2 = damaged2.filter((d) => d.destroyed).length;
    expect(removed2.multiplier).toBe(2);
    expect(removed2.scoreDelta).toBe((removed2.tiles.length * 10 + destroyed2 * 20) * 2);

    // The layer at (2,4) did not move with its tile and was not damaged in wave 1.
    expect(firstOfType(w1, 'obstacleDamaged').cells.some((c) => c.pos.row === 2 && c.pos.col === 4)).toBe(false);
    const hitsAt24 = ofType(result.events, 'obstacleDamaged').flatMap((e) => e.cells.filter((c) => c.pos.row === 2 && c.pos.col === 4));
    expect(result.state.layers[2][4]).toBe(1 - hitsAt24.length);

    const totalDelta = ofType(result.events, 'tilesRemoved').reduce((sum, e) => sum + e.scoreDelta, 0);
    expect(result.state.score).toBe(totalDelta);
    expect(firstOfType(result.events, 'goalsUpdated').score).toBe(result.state.score);
  });

  it('cascade waves create specials with the fallback cell rule', () => {
    // T moves (6,6)→(6,5) completing T at row 6 cols 3..5. Column 5 then falls by one, so B(4,5), B(5,5)
    // land on (5,5), (6,5) above the stationary B(7,5), B(8,5): a wave-2 vertical line of 4 that contains
    // the swap destination (6,5), yet the cascade uses the fallback rule → LINE_V at (8,5).
    const state = game({
      '6,3': 'T.',
      '6,4': 'T.',
      '6,6': 'T.',
      '4,5': 'B.',
      '5,5': 'B.',
      '7,5': 'B.',
      '8,5': 'B.',
    });
    const result = applyMove(state, mv(6, 6, 6, 5));
    expect(result.ok).toBe(true);
    const w2 = waveEvents(result.events, 2);
    const group = firstOfType(w2, 'matched').groups.find((g) => g.base === 'baursak');
    expect(group).toMatchObject({ shape: 'line4v', cells: [p(5, 5), p(6, 5), p(7, 5), p(8, 5)] });
    const created = ofType(w2, 'specialCreated').filter((c) => c.tile.base === 'baursak');
    expect(created).toHaveLength(1);
    expect(created[0].tile).toMatchObject({ pos: p(8, 5), special: 'LINE_V' });
    expect(created[0].fromTileId).toBe(fixtureId(8, 5));
  });
});

describe('protected spawn cell layer rule', () => {
  const swapIn = { '5,3': 'T.', '5,4': 'T.', '5,6': 'T.', '4,5': 'T.' };

  it('the generating match does not damage the layer under the new special', () => {
    const level = testLevel({
      overlays: [
        { row: 5, col: 5, hp: 1 },
        { row: 5, col: 3, hp: 2 },
      ],
    });
    const result = applyMove(game(swapIn, level), mv(4, 5, 5, 5));
    const w1 = waveEvents(result.events, 1);
    expect(firstOfType(w1, 'specialCreated').tile).toMatchObject({ pos: p(5, 5), special: 'LINE_H', base: 'tea' });
    expect(firstOfType(w1, 'cellsHit').cells).toEqual([p(5, 3), p(5, 4), p(5, 6)]);
    expect(firstOfType(w1, 'obstacleDamaged').cells).toEqual([{ pos: p(5, 3), hp: 1, destroyed: false }]);
  });

  it('an independent blast damages that layer but the protected special survives', () => {
    const level = testLevel({ overlays: [{ row: 5, col: 5, hp: 1 }] });
    // Pre-existing B match in row 9 contains a LINE_V at (9,5) whose column covers (5,5).
    const state = game({ ...swapIn, '9,4': 'B.', '9,5': 'Bv', '9,6': 'B.' }, level);
    const result = applyMove(state, mv(4, 5, 5, 5));
    const w1 = waveEvents(result.events, 1);
    const act = ofType(w1, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ effect: 'col', center: p(9, 5) });
    expect(firstOfType(w1, 'obstacleDamaged').cells).toContainEqual({ pos: p(5, 5), hp: 0, destroyed: true });
    expect(firstOfType(w1, 'cellsHit').cells).toContainEqual(p(5, 5));
    const removed = firstOfType(w1, 'tilesRemoved');
    expect(removed.tiles.some((t) => t.pos.row === 5 && t.pos.col === 5)).toBe(false);
    expect(removed.tiles.some((t) => t.tileId === fixtureId(4, 5))).toBe(false);
    expect(removed.tiles).toHaveLength(15);
    expect(removed.scoreDelta).toBe(15 * 10 + 20);
    const created = firstOfType(w1, 'specialCreated');
    expect(created).toMatchObject({ tile: { pos: p(5, 5), special: 'LINE_H' }, fromTileId: fixtureId(4, 5) });
  });
});

describe('terminal states and stars', () => {
  const swap3 = { '5,3': 'B.', '5,4': 'B.', '4,5': 'B.' };

  it('a last-move win is checked before defeat and earns 1 star', () => {
    const level = testLevel({ moveLimit: 1, goals: [{ kind: 'collect', type: 'baursak', count: 3 }] });
    const result = applyMove(game(swap3, level), mv(4, 5, 5, 5));
    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({ status: 'won', stars: 1, movesLeft: 0 });
    expect(ofType(result.events, 'gameLost')).toEqual([]);
    expect(result.events.at(-1)).toEqual({ type: 'gameWon', stars: 1, score: result.state.score, movesLeft: 0 });
    expect(result.state.goals[0].done).toBe(3);
  });

  it('defeat requires zero moves and incomplete goals', () => {
    const level = testLevel({ moveLimit: 1, goals: [{ kind: 'collect', type: 'baursak', count: 500 }] });
    const result = applyMove(game(swap3, level), mv(4, 5, 5, 5));
    expect(result.state.status).toBe('lost');
    expect(result.state.stars).toBe(0);
    expect(result.events.at(-1)).toEqual({ type: 'gameLost', score: result.state.score });
    const again = applyMove(result.state, mv(0, 0, 0, 1));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('gameOver');
  });

  it('awards 3 stars with >= 40% of moves left', () => {
    const level = testLevel({ moveLimit: 5, goals: [{ kind: 'collect', type: 'baursak', count: 3 }] });
    const result = applyMove(game(swap3, level), mv(4, 5, 5, 5));
    expect(result.state).toMatchObject({ status: 'won', stars: 3, movesLeft: 4 });
  });

  it('star thresholds: >= 40% → 3, >= 20% → 2, else 1', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map((left) => starsFor(left, 10))).toEqual([1, 1, 2, 2, 3, 3, 3]);
    expect([3, 4, 7, 8].map((left) => starsFor(left, 20))).toEqual([1, 2, 2, 3]);
    expect([0, 4, 5, 9, 10].map((left) => starsFor(left, 23))).toEqual([1, 1, 2, 2, 3]);
  });

  it('clearCrumbs goals count destroyed layers, clamped to the goal count', () => {
    const level = testLevel({
      goals: [{ kind: 'clearCrumbs', count: 1 }],
      overlays: [
        { row: 5, col: 3, hp: 1 },
        { row: 5, col: 4, hp: 1 },
      ],
    });
    const result = applyMove(game(swap3, level), mv(4, 5, 5, 5));
    expect(result.state.goals[0].done).toBe(1);
    expect(result.state.status).toBe('won');
    const removed = firstOfType(waveEvents(result.events, 1), 'tilesRemoved');
    expect(removed.scoreDelta).toBe(3 * 10 + 2 * 20);
  });
});

describe('dead boards and shuffle', () => {
  it('shuffles a dead board for free, preserving specials, layers, goals and score', () => {
    // Background is dead; RAM + the only tea removes 2 tiles in row 0. Specials Sh/Zb sit on matching
    // background bases so they add no moves. Search seeds until the refilled board is dead.
    const overrides = { '0,0': 'RR', '0,1': 'T.', '2,2': 'Sh', '7,7': 'Zb' };
    const overlays: Overlay[] = [
      { row: 10, col: 10, hp: 2 },
      { row: 6, col: 6, hp: 1 },
    ];
    const level = testLevel({ overlays, goals: [{ kind: 'collect', type: 'kurt', count: 999 }] });
    let found = false;
    for (let seed = 1; seed <= 300 && !found; seed++) {
      const state = createGameFromBoard(level, fixture(overrides), seed);
      const result = applyMove(state, mv(0, 0, 0, 1));
      expect(result.ok).toBe(true);
      const shuffled = ofType(result.events, 'shuffled');
      if (shuffled.length === 0) continue;
      found = true;
      checkEventGrammar(result.events);
      const ev = shuffled[0];
      expect(result.events.at(-1)).toBe(ev);
      const goals = firstOfType(result.events, 'goalsUpdated');
      expect(result.state.movesLeft).toBe(state.movesLeft - 1);
      expect(goals.movesLeft).toBe(result.state.movesLeft);
      expect(goals.score).toBe(result.state.score);
      expect(goals.goals).toEqual(result.state.goals);
      expect(result.state.layers).toEqual(state.layers);
      expect(result.state.board).toEqual(ev.board);
      // Specials survive with their ids and kinds.
      const specials = result.state.board.flat().filter((t) => t.special !== null);
      expect(specials.map((t) => [t.id, t.base, t.special]).sort()).toEqual(
        [
          [fixtureId(2, 2), 'samsa', 'LINE_H'],
          [fixtureId(7, 7), 'kazy', 'BOMB'],
        ].sort(),
      );
      if (ev.regenerated) {
        expect(result.state.board[2][2].id).toBe(fixtureId(2, 2));
        expect(result.state.board[7][7].id).toBe(fixtureId(7, 7));
      }
      expect(findRuns(result.state.board)).toEqual([]);
      expect(getLegalMoves(result.state).length).toBeGreaterThan(0);
      const ids = result.state.board.flat().map((t) => t.id);
      expect(new Set(ids).size).toBe(121);
      expect(Math.max(...ids)).toBeLessThan(result.state.nextTileId);
    }
    expect(found).toBe(true);
  });

  it('Fisher–Yates shuffle permutes existing tiles (ids kept), with a regeneration fallback', () => {
    // Specials keep the background base of their cell ((2,2) → B, (7,7) → S), so the board stays dead.
    const dead = parseBoardFixture(fixture({ '2,2': 'Bh', '7,7': 'Sb' }, BG6));
    expect(hasLegalMove(dead)).toBe(false);
    expect(findRuns(dead)).toEqual([]);
    const allowed = ['baursak', 'kurt', 'kazy', 'samsa', 'zhent', 'tea'] as const;
    let permuted = 0;
    let regenerated = 0;
    for (let seed = 1; seed <= 120 && (permuted === 0 || regenerated === 0); seed++) {
      const result = shuffleBoard(dead, new Rng(seed), allowed, 122);
      expect(findRuns(result.board)).toEqual([]);
      expect(hasLegalMove(result.board)).toBe(true);
      if (!result.regenerated) {
        permuted++;
        const before = dead.flat().map((t) => JSON.stringify(t)).sort();
        const after = result.board.flat().map((t) => JSON.stringify(t)).sort();
        expect(after).toEqual(before);
        expect(result.moves).toHaveLength(121);
        for (const m of result.moves) {
          expect(dead[m.from.row][m.from.col].id).toBe(m.tileId);
          expect(result.board[m.to.row][m.to.col].id).toBe(m.tileId);
        }
        expect(result.nextTileId).toBe(122);
      } else {
        regenerated++;
        expect(result.board[2][2]).toEqual(dead[2][2]);
        expect(result.board[7][7]).toEqual(dead[7][7]);
        expect(result.moves).toEqual([
          { tileId: dead[2][2].id, from: p(2, 2), to: p(2, 2) },
          { tileId: dead[7][7].id, from: p(7, 7), to: p(7, 7) },
        ]);
        const fresh = result.board.flat().filter((t) => t.special === null);
        expect(fresh).toHaveLength(119);
        expect(fresh.every((t) => t.id >= 122 && t.id < result.nextTileId)).toBe(true);
      }
    }
    expect(permuted).toBeGreaterThan(0);
    expect(regenerated).toBeGreaterThan(0);
  });

  it('shuffle is deterministic for a given RNG state', () => {
    const dead = parseBoardFixture(fixture({}, BG6));
    const a = shuffleBoard(dead, new Rng(42), ['kurt', 'kazy', 'samsa', 'zhent'], 122);
    const b = shuffleBoard(dead, new Rng(42), ['kurt', 'kazy', 'samsa', 'zhent'], 122);
    expect(a).toEqual(b);
  });
});

describe('technical errors', () => {
  it('cascade overflow returns the original state and a technicalError event', () => {
    // A single allowed type refills row 0 with the same food forever.
    const level = testLevel({ allowedTypes: ['baursak'] });
    const state = game({ '5,3': 'B.', '5,4': 'B.', '4,5': 'B.' }, level);
    const before = serializeState(state);
    const result = applyMove(state, mv(4, 5, 5, 5));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('technicalError');
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('technicalError');
    expect(serializeState(state)).toBe(before);
  });

  it('createGame throws when generation is exhausted', () => {
    expect(() => createGame(testLevel({ allowedTypes: ['baursak'] }), 1)).toThrow(/generation failed/);
  });
});
