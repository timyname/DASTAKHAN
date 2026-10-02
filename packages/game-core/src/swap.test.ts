import { describe, expect, it } from 'vitest';
import { applyMove, createGameFromBoard, getLegalMoves, serializeState } from './engine.ts';
import type { GameState, Move } from './types.ts';
import { deepFreeze, firstOfType, fixture, fixtureId, ofType, p, testLevel, waveEvents } from './test-utils.ts';

function game(overrides: Record<string, string>, seed = 7): GameState {
  return createGameFromBoard(testLevel(), fixture(overrides), seed);
}

function mv(fr: number, fc: number, tr: number, tc: number): Move {
  return { from: p(fr, fc), to: p(tr, tc) };
}

describe('swap validation', () => {
  const base = { '5,3': 'B.', '5,4': 'B.', '4,5': 'B.' };

  it.each([
    ['outOfBounds', mv(10, 10, 11, 10)],
    ['outOfBounds', mv(-1, 0, 0, 0)],
    ['notAdjacent', mv(0, 0, 0, 2)],
    ['notAdjacent', mv(0, 0, 1, 1)],
    ['notAdjacent', mv(3, 3, 3, 3)],
    ['noMatch', mv(0, 0, 0, 1)],
  ] as const)('rejects with %s', (reason, move) => {
    const state = deepFreeze(game(base));
    const before = serializeState(state);
    const result = applyMove(state, move);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(reason);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: 'swapRejected', reason, from: move.from, to: move.to });
    expect(serializeState(result.state)).toBe(before);
  });

  it('rejected swaps do not advance RNG, moves, score or goals', () => {
    const state = game(base);
    const rejected = applyMove(state, mv(0, 0, 0, 1));
    expect(rejected.ok).toBe(false);
    expect(rejected.state.rngState).toBe(state.rngState);
    expect(rejected.state.movesLeft).toBe(state.movesLeft);
    // The next legal move gives exactly the same result as without the rejected attempt.
    const a = applyMove(rejected.state, mv(4, 5, 5, 5));
    const b = applyMove(game(base), mv(4, 5, 5, 5));
    expect(serializeState(a.state)).toBe(serializeState(b.state));
    expect(a.events).toEqual(b.events);
  });

  it('swapRejected reports tile ids, -1 outside the board', () => {
    const state = game(base);
    const r1 = applyMove(state, mv(0, 0, 0, 1));
    expect(r1.events[0]).toMatchObject({ tileA: fixtureId(0, 0), tileB: fixtureId(0, 1) });
    const r2 = applyMove(state, mv(10, 10, 11, 10));
    expect(r2.events[0]).toMatchObject({ tileA: fixtureId(10, 10), tileB: -1 });
  });

  it('rejects any swap once the game is over', () => {
    const state: GameState = { ...game(base), status: 'won' };
    const result = applyMove(state, mv(4, 5, 5, 5));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('gameOver');
    expect(getLegalMoves(state)).toEqual([]);
  });

  it('a legal swap consumes one move, logs it and emits swap first', () => {
    const state = game(base);
    const result = applyMove(state, mv(4, 5, 5, 5));
    expect(result.ok).toBe(true);
    expect(result.state.movesLeft).toBe(state.movesLeft - 1);
    expect(result.state.moveLog).toEqual([mv(4, 5, 5, 5)]);
    expect(result.events[0]).toEqual({
      type: 'swap',
      from: p(4, 5),
      to: p(5, 5),
      tileA: fixtureId(4, 5),
      tileB: fixtureId(5, 5),
    });
    expect(result.state.rngState).not.toBe(state.rngState);
  });

  it('a special next to ordinary food without a match is rejected', () => {
    const state = game({ '5,5': 'Bh' });
    const result = applyMove(state, mv(5, 5, 5, 6));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('noMatch');
  });

  it.each([
    ['LINE_H + LINE_V', 'Bh', 'Tv'],
    ['LINE + BOMB', 'Bh', 'Tb'],
    ['BOMB + BOMB', 'Bb', 'Tb'],
    ['RAM + LINE', 'RR', 'Bv'],
    ['RAM + BOMB', 'RR', 'Bb'],
    ['RAM + RAM', 'RR', 'RR'],
    ['RAM + food', 'RR', 'T.'],
    ['BESH + food', 'XX', 'T.'],
    ['BESH + LINE', 'XX', 'Bh'],
    ['BESH + BOMB', 'XX', 'Bb'],
    ['BESH + RAM', 'XX', 'RR'],
    ['BESH + BESH', 'XX', 'XX'],
  ])('%s is legal without a match', (_name, a, b) => {
    const state = game({ '5,5': a, '5,6': b });
    const result = applyMove(state, mv(5, 5, 5, 6));
    expect(result.ok).toBe(true);
  });

  it('getLegalMoves scans row-major, right before down', () => {
    const state = game({ '5,5': 'RR' });
    expect(getLegalMoves(state)).toEqual([mv(4, 5, 5, 5), mv(5, 4, 5, 5), mv(5, 5, 5, 6), mv(5, 5, 6, 5)]);
  });

  it('getLegalMoves includes every BESH swap', () => {
    const state = game({ '0,0': 'XX' });
    expect(getLegalMoves(state)).toEqual([mv(0, 0, 0, 1), mv(0, 0, 1, 0)]);
  });

  it('a dead background has no legal moves', () => {
    expect(getLegalMoves(game({}))).toEqual([]);
  });
});

describe('special creation', () => {
  it('run of 4 creates LINE_H at the swap destination', () => {
    const state = game({ '5,3': 'B.', '5,4': 'B.', '5,6': 'B.', '4,5': 'B.' });
    const { events } = applyMove(state, mv(4, 5, 5, 5));
    const w1 = waveEvents(events, 1);
    const matched = firstOfType(w1, 'matched');
    expect(matched.groups).toHaveLength(1);
    expect(matched.groups[0]).toMatchObject({ shape: 'line4h', base: 'baursak' });
    expect(matched.groups[0].cells).toEqual([p(5, 3), p(5, 4), p(5, 5), p(5, 6)]);
    expect(matched.groups[0].tileIds).toEqual([fixtureId(5, 3), fixtureId(5, 4), fixtureId(4, 5), fixtureId(5, 6)]);
    const created = ofType(w1, 'specialCreated');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      tile: { tileId: 122, pos: p(5, 5), base: 'baursak', special: 'LINE_H' },
      shape: 'line4h',
      fromTileId: fixtureId(4, 5),
    });
    const removed = firstOfType(w1, 'tilesRemoved');
    expect(removed.tiles.map((t) => t.pos)).toEqual([p(5, 3), p(5, 4), p(5, 6)]);
    expect(removed.scoreDelta).toBe(30);
    expect(ofType(w1, 'specialActivated')).toEqual([]);
  });

  it('uses the swap origin when the destination is not in the component', () => {
    const state = game({ '5,3': 'B.', '5,4': 'B.', '5,6': 'B.', '4,5': 'B.' });
    const { events } = applyMove(state, mv(5, 5, 4, 5));
    const created = ofType(waveEvents(events, 1), 'specialCreated');
    expect(created).toHaveLength(1);
    expect(created[0].tile.pos).toEqual(p(5, 5));
  });

  it('vertical run of 4 creates LINE_V', () => {
    const state = game({ '3,5': 'T.', '4,5': 'T.', '6,5': 'T.', '5,6': 'T.' });
    const { events } = applyMove(state, mv(5, 6, 5, 5));
    const created = ofType(waveEvents(events, 1), 'specialCreated');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ tile: { pos: p(5, 5), base: 'tea', special: 'LINE_V' }, shape: 'line4v' });
  });

  it('L shape creates BOMB', () => {
    const state = game({ '5,3': 'B.', '5,4': 'B.', '3,5': 'B.', '4,5': 'B.', '5,6': 'B.' });
    const { events } = applyMove(state, mv(5, 6, 5, 5));
    const w1 = waveEvents(events, 1);
    expect(firstOfType(w1, 'matched').groups[0].shape).toBe('lt');
    const created = ofType(w1, 'specialCreated');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ tile: { pos: p(5, 5), base: 'baursak', special: 'BOMB' }, shape: 'lt' });
    expect(firstOfType(w1, 'tilesRemoved').tiles).toHaveLength(4);
  });

  it('run of 5 creates RAM without a base', () => {
    const state = game({ '5,3': 'B.', '5,4': 'B.', '5,6': 'B.', '5,7': 'B.', '4,5': 'B.' });
    const { events } = applyMove(state, mv(4, 5, 5, 5));
    const created = ofType(waveEvents(events, 1), 'specialCreated');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ tile: { pos: p(5, 5), base: null, special: 'RAM' }, shape: 'line5' });
  });

  it('run of 6 creates exactly one RAM', () => {
    const state = game({ '5,2': 'B.', '5,3': 'B.', '5,4': 'B.', '5,6': 'B.', '5,7': 'B.', '4,5': 'B.' });
    const { events } = applyMove(state, mv(4, 5, 5, 5));
    const w1 = waveEvents(events, 1);
    expect(firstOfType(w1, 'matched').groups[0].cells).toHaveLength(6);
    const created = ofType(w1, 'specialCreated');
    expect(created).toHaveLength(1);
    expect(created[0].tile.special).toBe('RAM');
    expect(firstOfType(w1, 'tilesRemoved').tiles).toHaveLength(5);
  });

  it('run of 5 crossing a run of 3 creates RAM, not BOMB', () => {
    const state = game({ '5,3': 'B.', '5,4': 'B.', '5,6': 'B.', '5,7': 'B.', '3,5': 'B.', '4,5': 'B.', '6,5': 'B.' });
    const { events } = applyMove(state, mv(6, 5, 5, 5));
    const w1 = waveEvents(events, 1);
    const matched = firstOfType(w1, 'matched');
    expect(matched.groups).toHaveLength(1);
    expect(matched.groups[0].shape).toBe('line5');
    const created = ofType(w1, 'specialCreated');
    expect(created).toHaveLength(1);
    expect(created[0].tile).toMatchObject({ pos: p(5, 5), special: 'RAM' });
    expect(firstOfType(w1, 'tilesRemoved').tiles).toHaveLength(6);
  });

  it('run of 5 crossing a run of 4 creates BESH at the swap destination (fixture runs merge)', () => {
    // Fixture matches are not auto-resolved: B(5,6..9) and B(6..8,5) already exist; B moving into
    // the corner (5,5) joins them into H5 + V4.
    const state = game({
      '5,6': 'B.',
      '5,7': 'B.',
      '5,8': 'B.',
      '5,9': 'B.',
      '6,5': 'B.',
      '7,5': 'B.',
      '8,5': 'B.',
      '4,5': 'B.',
    });
    const { events } = applyMove(state, mv(4, 5, 5, 5));
    const w1 = waveEvents(events, 1);
    const matched = firstOfType(w1, 'matched');
    expect(matched.groups).toHaveLength(1);
    expect(matched.groups[0]).toMatchObject({ shape: 'besh', base: 'baursak' });
    const created = ofType(w1, 'specialCreated');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      tile: { tileId: 122, pos: p(5, 5), base: null, special: 'BESH' },
      shape: 'besh',
      fromTileId: fixtureId(4, 5),
    });
    const removed = firstOfType(w1, 'tilesRemoved');
    expect(removed.tiles).toHaveLength(7);
    expect(removed.scoreDelta).toBe(70);
  });

  it('vertical run of 5 crossing a horizontal run of 4 also creates BESH', () => {
    const state = game({
      '6,5': 'B.',
      '7,5': 'B.',
      '8,5': 'B.',
      '9,5': 'B.',
      '5,6': 'B.',
      '5,7': 'B.',
      '5,8': 'B.',
      '4,5': 'B.',
    });
    const { events } = applyMove(state, mv(4, 5, 5, 5));
    const created = ofType(waveEvents(events, 1), 'specialCreated');
    expect(created.map((c) => [c.tile.pos, c.tile.special, c.shape])).toEqual([[p(5, 5), 'BESH', 'besh']]);
  });

  it('run of 4 crossing a run of 4 creates BOMB, not BESH', () => {
    const state = game({ '5,6': 'B.', '5,7': 'B.', '5,8': 'B.', '6,5': 'B.', '7,5': 'B.', '8,5': 'B.', '4,5': 'B.' });
    const { events } = applyMove(state, mv(4, 5, 5, 5));
    const created = ofType(waveEvents(events, 1), 'specialCreated');
    expect(created.map((c) => [c.tile.special, c.shape])).toEqual([['BOMB', 'lt']]);
  });

  it('independent components each create one special', () => {
    // B moves to (5,6) completing a vertical B run of 4; T moves to (5,5) completing a vertical T run of 4.
    const state = game({
      '5,5': 'B.',
      '5,6': 'T.',
      '3,6': 'B.',
      '4,6': 'B.',
      '6,6': 'B.',
      '3,5': 'T.',
      '4,5': 'T.',
      '6,5': 'T.',
    });
    const { events } = applyMove(state, mv(5, 5, 5, 6));
    const w1 = waveEvents(events, 1);
    expect(firstOfType(w1, 'matched').groups.map((g) => [g.base, g.shape])).toEqual([
      ['tea', 'line4v'],
      ['baursak', 'line4v'],
    ]);
    const created = ofType(w1, 'specialCreated');
    expect(created.map((c) => [c.tile.pos, c.tile.base, c.tile.special, c.tile.tileId])).toEqual([
      [p(5, 5), 'tea', 'LINE_V', 122],
      [p(5, 6), 'baursak', 'LINE_V', 123],
    ]);
    expect(firstOfType(w1, 'tilesRemoved').tiles).toHaveLength(6);
  });

  it('components without the swapped cells use greatest row, then smallest col', () => {
    // Fixture matches are not auto-resolved, so these two components already exist and resolve in wave 1.
    const state = game({
      // vertical T run of 4 in column 8 → LINE_V at (4,8)
      '1,8': 'T.',
      '2,8': 'T.',
      '3,8': 'T.',
      '4,8': 'T.',
      // L of B: horizontal (9,1..3) + vertical (7..9,3) → BOMB at (9,1)
      '9,1': 'B.',
      '9,2': 'B.',
      '9,3': 'B.',
      '7,3': 'B.',
      '8,3': 'B.',
      // the actual swap: B into (5,5) completing a line of 3 with (5,3),(5,4)
      '5,3': 'B.',
      '5,4': 'B.',
      '4,5': 'B.',
    });
    const { events } = applyMove(state, mv(4, 5, 5, 5));
    const created = ofType(waveEvents(events, 1), 'specialCreated');
    expect(created.map((c) => [c.tile.pos, c.tile.special])).toEqual([
      [p(4, 8), 'LINE_V'],
      [p(9, 1), 'BOMB'],
    ]);
  });

  it('a component containing an existing special creates nothing and activates it', () => {
    const state = game({ '5,3': 'B.', '5,4': 'Bv', '5,6': 'B.', '4,5': 'B.' });
    const { events } = applyMove(state, mv(4, 5, 5, 5));
    const w1 = waveEvents(events, 1);
    expect(firstOfType(w1, 'matched').groups[0].shape).toBe('line4h');
    expect(ofType(w1, 'specialCreated')).toEqual([]);
    const activated = ofType(w1, 'specialActivated');
    expect(activated).toHaveLength(1);
    expect(activated[0]).toMatchObject({ effect: 'col', center: p(5, 4), tile: { tileId: fixtureId(5, 4) } });
    expect(activated[0].cells).toHaveLength(11);
    // Row-5 match cells + column 4.
    expect(firstOfType(w1, 'tilesRemoved').tiles).toHaveLength(14);
  });
});
