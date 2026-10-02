import { describe, expect, it } from 'vitest';
import { applyMove, createGameFromBoard } from './engine.ts';
import { crossCells, mostFrequentBase, squareCells, wideCrossCells } from './effects.ts';
import { parseBoardFixture } from './fixture.ts';
import { posOf } from './board.ts';
import type { GameEvent, GameState, LevelDefinition, Move, Pos } from './types.ts';
import {
  BG4,
  firstOfType,
  fixture,
  fixtureId,
  ofType,
  p,
  rect,
  sortPositions,
  testLevel,
  unionCells,
  waveEvents,
} from './test-utils.ts';

const twoGoals = testLevel({
  goals: [
    { kind: 'collect', type: 'baursak', count: 999 },
    { kind: 'collect', type: 'tea', count: 999 },
  ],
});

function game(overrides: Record<string, string>, level: LevelDefinition = twoGoals, palette: readonly string[] = BG4): GameState {
  return createGameFromBoard(level, fixture(overrides, palette), 11);
}

function mv(fr: number, fc: number, tr: number, tc: number): Move {
  return { from: p(fr, fc), to: p(tr, tc) };
}

function wave1(state: GameState, move: Move): GameEvent[] {
  const result = applyMove(state, move);
  expect(result.ok).toBe(true);
  return waveEvents(result.events, 1);
}

const row = (r: number): Pos[] => rect(r, 0, r, 10);
const col = (c: number): Pos[] => rect(0, c, 10, c);

describe('effect areas', () => {
  it('cross = 21, wideCross = 57, square5 = 25 at the center', () => {
    expect(crossCells(p(5, 5))).toHaveLength(21);
    expect(wideCrossCells(p(5, 5))).toHaveLength(57);
    expect(squareCells(p(5, 5), 2)).toHaveLength(25);
    expect(squareCells(p(5, 5), 1)).toHaveLength(9);
  });

  it('clips at edges and never wraps', () => {
    expect(crossCells(p(0, 0))).toHaveLength(21);
    expect(wideCrossCells(p(0, 0))).toHaveLength(40);
    expect(wideCrossCells(p(0, 5))).toHaveLength(2 * 11 + 3 * 11 - 6);
    expect(squareCells(p(0, 0), 2)).toHaveLength(9);
    expect(squareCells(p(10, 10), 1)).toHaveLength(4);
    expect(squareCells(p(0, 5), 1).map(posOf)).toEqual(rect(0, 4, 1, 6));
  });

  it('mostFrequentBase breaks ties by FOOD_TYPES order and returns null without bases', () => {
    const allRam = parseBoardFixture(Array.from({ length: 11 }, () => Array(11).fill('RR').join(' ')));
    expect(mostFrequentBase(allRam)).toBeNull();
  });
});

describe('single activations', () => {
  it('LINE_H in a match clears its whole row', () => {
    const events = wave1(game({ '5,3': 'B.', '5,4': 'Bh', '4,5': 'B.' }), mv(4, 5, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ effect: 'row', center: p(5, 4), tile: { special: 'LINE_H', base: 'baursak' } });
    expect(act[0].cells).toEqual(row(5));
    const removed = firstOfType(events, 'tilesRemoved');
    expect(removed.tiles.map((t) => t.pos)).toEqual(row(5));
    expect(removed.scoreDelta).toBe(110);
  });

  it('LINE_V in a match clears its whole column', () => {
    const events = wave1(game({ '5,3': 'B.', '5,4': 'Bv', '4,5': 'B.' }), mv(4, 5, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ effect: 'col', center: p(5, 4) });
    expect(act[0].cells).toEqual(col(4));
    expect(firstOfType(events, 'tilesRemoved').tiles.map((t) => t.pos)).toEqual(unionCells(col(4), [p(5, 3), p(5, 5)]));
  });

  it('BOMB in a match clears a centered 3×3', () => {
    const events = wave1(game({ '5,3': 'B.', '5,4': 'Bb', '4,5': 'B.' }), mv(4, 5, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ effect: 'square3', center: p(5, 4) });
    expect(act[0].cells).toEqual(rect(4, 3, 6, 5));
    expect(firstOfType(events, 'tilesRemoved').tiles).toHaveLength(9);
  });

  it('BOMB at the edge is clipped', () => {
    const events = wave1(game({ '0,0': 'B.', '0,1': 'Bb', '1,2': 'B.' }), mv(1, 2, 0, 2));
    const act = firstOfType(events, 'specialActivated');
    expect(act.cells).toEqual(rect(0, 0, 1, 2));
    expect(firstOfType(events, 'tilesRemoved').tiles).toHaveLength(6);
  });

  it('RAM + food removes every tile of that type and activates its specials', () => {
    const state = game({ '5,5': 'RR', '5,6': 'T.', '1,1': 'T.', '9,9': 'T.', '0,10': 'T.', '8,2': 'Th' });
    const events = wave1(state, mv(5, 5, 5, 6));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(2);
    expect(act[0]).toMatchObject({
      effect: 'ramColor',
      targetType: 'tea',
      center: p(5, 6),
      tile: { tileId: fixtureId(5, 5), special: 'RAM', base: null, pos: p(5, 6) },
    });
    expect(act[0].partner).toBeUndefined();
    expect(act[0].cells).toEqual([p(0, 10), p(1, 1), p(5, 5), p(5, 6), p(8, 2), p(9, 9)]);
    expect(act[1]).toMatchObject({ effect: 'row', center: p(8, 2), tile: { special: 'LINE_H', base: 'tea' } });
    const removed = firstOfType(events, 'tilesRemoved');
    expect(removed.tiles.map((t) => t.pos)).toEqual(unionCells(act[0].cells, row(8)));
    expect(ofType(events, 'matched')).toEqual([]);
  });
});

describe('special pairs (center = swap destination)', () => {
  it('LINE + LINE → cross of 21 cells; pair replaces both activations', () => {
    const events = wave1(game({ '5,5': 'Bh', '5,6': 'Tv' }), mv(5, 6, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({
      effect: 'cross',
      center: p(5, 5),
      tile: { tileId: fixtureId(5, 6), special: 'LINE_V', pos: p(5, 5) },
      partner: { tileId: fixtureId(5, 5), special: 'LINE_H', pos: p(5, 6) },
    });
    expect(act[0].cells).toHaveLength(21);
    expect(act[0].cells).toEqual(unionCells(row(5), col(5)));
    const removed = firstOfType(events, 'tilesRemoved');
    expect(removed.tiles).toHaveLength(21);
    expect(removed.scoreDelta).toBe(210);
    expect(ofType(events, 'matched')).toEqual([]);
  });

  it('LINE_H + LINE_H also makes a cross', () => {
    const events = wave1(game({ '5,5': 'Bh', '5,6': 'Th' }), mv(5, 6, 5, 5));
    expect(firstOfType(events, 'specialActivated')).toMatchObject({ effect: 'cross' });
  });

  it('LINE + BOMB → wide cross of 57 cells', () => {
    const events = wave1(game({ '5,5': 'Bh', '5,6': 'Tb' }), mv(5, 6, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0].effect).toBe('wideCross');
    expect(act[0].cells).toHaveLength(57);
    expect(firstOfType(events, 'tilesRemoved').tiles).toHaveLength(57);
  });

  it('BOMB + BOMB → one 5×5 square, single damage wave', () => {
    const level = { ...twoGoals, overlays: [{ row: 5, col: 5, hp: 2 as const }] };
    const events = wave1(game({ '5,5': 'Bb', '5,6': 'Tb' }, level), mv(5, 6, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0].effect).toBe('square5');
    expect(act[0].cells).toEqual(rect(3, 3, 7, 7));
    expect(firstOfType(events, 'tilesRemoved').tiles).toHaveLength(25);
    expect(firstOfType(events, 'obstacleDamaged').cells).toEqual([{ pos: p(5, 5), hp: 1, destroyed: false }]);
  });

  it('pairs clip at the corner', () => {
    const cross = wave1(game({ '0,0': 'Bh', '0,1': 'Tv' }), mv(0, 1, 0, 0));
    expect(firstOfType(cross, 'specialActivated').cells).toHaveLength(21);
    const wide = wave1(game({ '0,0': 'Bh', '0,1': 'Tb' }), mv(0, 1, 0, 0));
    expect(firstOfType(wide, 'specialActivated').cells).toHaveLength(40);
    const square = wave1(game({ '0,0': 'Bb', '0,1': 'Tb' }), mv(0, 1, 0, 0));
    expect(firstOfType(square, 'specialActivated').cells).toEqual(rect(0, 0, 2, 2));
  });

  it('RAM + LINE converts every ordinary piece of that type to the LINE orientation', () => {
    const state = game({
      '5,5': 'RR',
      '5,6': 'Bh',
      '1,1': 'B.',
      '3,8': 'B.',
      '8,2': 'B.',
      '9,9': 'Bb', // existing special of that base keeps its kind
      '3,0': 'Tb', // other type: activates only because row 3 hits it
      '0,6': 'Tv', // other type, never hit
    });
    const events = wave1(state, mv(5, 5, 5, 6));
    const act = ofType(events, 'specialActivated');
    expect(act[0]).toMatchObject({
      effect: 'ramLine',
      targetType: 'baursak',
      center: p(5, 6),
      tile: { tileId: fixtureId(5, 5), special: 'RAM', pos: p(5, 6) },
      partner: { tileId: fixtureId(5, 6), special: 'LINE_H', pos: p(5, 5) },
    });
    expect(act[0].cells).toEqual([p(1, 1), p(3, 8), p(5, 5), p(5, 6), p(8, 2), p(9, 9)]);
    // tilesConverted immediately follows the pair activation.
    const pairIndex = events.indexOf(act[0]);
    const converted = events[pairIndex + 1];
    expect(converted.type).toBe('tilesConverted');
    if (converted.type !== 'tilesConverted') return;
    expect(converted.conversions).toEqual([
      { fromTileId: fixtureId(1, 1), tile: { tileId: 122, pos: p(1, 1), base: 'baursak', special: 'LINE_H' } },
      { fromTileId: fixtureId(3, 8), tile: { tileId: 123, pos: p(3, 8), base: 'baursak', special: 'LINE_H' } },
      { fromTileId: fixtureId(8, 2), tile: { tileId: 124, pos: p(8, 2), base: 'baursak', special: 'LINE_H' } },
    ]);
    // Queue order: smallest (row, col, id); (3,0) is enqueued by row 3 and then pops first.
    expect(act.slice(1).map((a) => [a.tile.tileId, a.effect, a.center])).toEqual([
      [122, 'row', p(1, 1)],
      [123, 'row', p(3, 8)],
      [fixtureId(3, 0), 'square3', p(3, 0)],
      [124, 'row', p(8, 2)],
      [fixtureId(9, 9), 'square3', p(9, 9)],
    ]);
    const ids = act.map((a) => a.tile.tileId);
    expect(new Set(ids).size).toBe(ids.length);
    const removed = firstOfType(events, 'tilesRemoved');
    const expected = unionCells(act[0].cells, row(1), row(3), row(8), rect(2, 0, 4, 1), rect(8, 8, 10, 10));
    expect(removed.tiles.map((t) => t.pos)).toEqual(expected);
    expect(removed.tiles.some((t) => t.tileId === fixtureId(0, 6))).toBe(false);
    // Converted tiles are removed with their new ids; originals are not double-counted.
    expect(removed.tiles.filter((t) => t.base === 'baursak').map((t) => t.tileId)).toEqual([
      122,
      123,
      fixtureId(5, 6),
      124,
      fixtureId(9, 9),
    ]);
  });

  it('RAM + BOMB converts ordinary pieces to BOMB; existing specials keep their kind', () => {
    const state = game({ '5,5': 'RR', '5,6': 'Bb', '1,1': 'B.', '8,2': 'B.', '9,9': 'Bh' });
    const events = wave1(state, mv(5, 6, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act[0]).toMatchObject({
      effect: 'ramBomb',
      targetType: 'baursak',
      center: p(5, 5),
      tile: { special: 'BOMB', pos: p(5, 5) },
      partner: { special: 'RAM', pos: p(5, 6) },
    });
    const converted = firstOfType(events, 'tilesConverted');
    expect(converted.conversions.map((c) => [c.fromTileId, c.tile.special, c.tile.pos])).toEqual([
      [fixtureId(1, 1), 'BOMB', p(1, 1)],
      [fixtureId(8, 2), 'BOMB', p(8, 2)],
    ]);
    expect(act.slice(1).map((a) => [a.effect, a.center])).toEqual([
      ['square3', p(1, 1)],
      ['square3', p(8, 2)],
      ['row', p(9, 9)],
    ]);
  });

  it('RAM + RAM removes all 121 pieces, absorbs other specials and deals exactly 1 HP per layer', () => {
    const level = {
      ...twoGoals,
      overlays: [
        { row: 4, col: 4, hp: 2 as const },
        { row: 6, col: 6, hp: 1 as const },
        { row: 0, col: 0, hp: 2 as const },
      ],
    };
    const state = game({ '5,5': 'RR', '5,6': 'RR', '2,2': 'Bh', '8,8': 'Tb', '0,0': 'RR', '10,10': 'Bv' }, level);
    const result = applyMove(state, mv(5, 6, 5, 5));
    expect(result.ok).toBe(true);
    const events = waveEvents(result.events, 1);
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ effect: 'bigToi', center: p(5, 5) });
    expect(act[0].cells).toHaveLength(121);
    expect(firstOfType(events, 'cellsHit').cells).toHaveLength(121);
    expect(firstOfType(events, 'obstacleDamaged').cells).toEqual([
      { pos: p(0, 0), hp: 1, destroyed: false },
      { pos: p(4, 4), hp: 1, destroyed: false },
      { pos: p(6, 6), hp: 0, destroyed: true },
    ]);
    const removed = firstOfType(events, 'tilesRemoved');
    expect(removed.tiles).toHaveLength(121);
    expect(removed.scoreDelta).toBe((121 * 10 + 20) * 1);
    expect(firstOfType(events, 'tilesSpawned').tiles).toHaveLength(121);
    expect(result.state.status).toBe('playing');
    expect(result.state.layers[4][4]).toBeLessThanOrEqual(1);
    // Absorbed specials are collected by base: two baursak LINEs and one tea BOMB.
    expect(removed.tiles.filter((t) => t.base === 'baursak')).toHaveLength(2);
    expect(removed.tiles.filter((t) => t.base === 'tea')).toHaveLength(1);
    expect(removed.tiles.filter((t) => t.special === 'RAM')).toHaveLength(3);
  });
});

describe('BESH «Бешбармак»', () => {
  function cellsOfTypes(state: GameState, types: string[]): Pos[] {
    const out: Pos[] = [];
    state.board.forEach((line, r) => line.forEach((t, c) => t.base && types.includes(t.base) && out.push(p(r, c))));
    return out;
  }

  it('BESH + food hits the 3 most frequent types (FOOD_TYPES tie-break) plus a 5×5 around the BESH', () => {
    // BG4 = K,Z,S,J → kurt 33, kazy 28, samsa 33, zhent 27. XX replaces a J, T replaces a Z:
    // kurt 33, samsa 33, kazy 27, zhent 26, tea 1 → targets kurt, samsa (tie broken by order), kazy.
    const state = game({ '5,5': 'XX', '5,6': 'T.' });
    const events = wave1(state, mv(5, 5, 5, 6));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({
      effect: 'besh',
      center: p(5, 6),
      targetTypes: ['kurt', 'samsa', 'kazy'],
      tile: { tileId: fixtureId(5, 5), special: 'BESH', base: null, pos: p(5, 6) },
    });
    expect(act[0].partner).toBeUndefined();
    expect(act[0].targetType).toBeUndefined();
    const expected = unionCells(rect(3, 4, 7, 8), cellsOfTypes(state, ['kurt', 'samsa', 'kazy']));
    expect(act[0].cells).toEqual(expected);
    const removed = firstOfType(events, 'tilesRemoved');
    expect(removed.tiles.map((t) => t.pos)).toEqual(expected);
    // The food partner (tea, now at (5,5)) is inside the 5×5 and removed; BESH scores 10 but is not collected.
    expect(removed.tiles.find((t) => t.pos.row === 5 && t.pos.col === 5)?.base).toBe('tea');
    expect(removed.tiles.filter((t) => t.special === 'BESH')).toHaveLength(1);
    expect(removed.scoreDelta).toBe(expected.length * 10);
    expect(ofType(events, 'matched')).toEqual([]);
  });

  it('targets fewer types when fewer exist on the board', () => {
    const rows = Array.from({ length: 11 }, (_, r) =>
      Array.from({ length: 11 }, (_, c) => (r === 0 && c === 0 ? 'XX' : (r + c) % 2 === 0 ? 'RR' : 'B.')).join(' '),
    );
    // Checkerboard of RAM and baursak: only one base type exists.
    const state = createGameFromBoard(twoGoals, rows, 1);
    const events = wave1(state, mv(0, 0, 0, 1));
    expect(firstOfType(events, 'specialActivated')).toMatchObject({ effect: 'besh', targetTypes: ['baursak'] });
  });

  it('BESH + LINE: only the BESH effect; the LINE partner is hit and activates normally', () => {
    const events = wave1(game({ '5,5': 'XX', '5,6': 'Bh' }), mv(5, 6, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act.map((a) => [a.effect, a.center, a.tile.special])).toEqual([
      ['besh', p(5, 6), 'BESH'],
      ['row', p(5, 5), 'LINE_H'],
    ]);
    expect(act[0].partner).toBeUndefined();
    expect(ofType(events, 'tilesConverted')).toEqual([]);
  });

  it('BESH + BOMB: the BOMB partner is hit and activates normally', () => {
    const events = wave1(game({ '5,5': 'XX', '5,6': 'Tb' }), mv(5, 5, 5, 6));
    const act = ofType(events, 'specialActivated');
    expect(act.map((a) => [a.effect, a.center])).toEqual([
      ['besh', p(5, 6)],
      ['square3', p(5, 5)],
    ]);
  });

  it('BESH hit by a LINE blast activates once, centered on its own cell; RAM inside its 5×5 chains', () => {
    const state = game({ '5,0': 'Bh', '5,1': 'Bv', '5,8': 'XX', '6,9': 'RR' });
    const events = wave1(state, mv(5, 1, 5, 0));
    const act = ofType(events, 'specialActivated');
    expect(act.map((a) => [a.effect, a.center])).toEqual([
      ['cross', p(5, 0)],
      ['besh', p(5, 8)],
      ['ramColor', p(6, 9)],
    ]);
    expect(act[1].cells).toEqual(expect.arrayContaining(rect(3, 6, 7, 10)));
    expect(act.filter((a) => a.tile.special === 'BESH')).toHaveLength(1);
  });

  it.each([
    ['BESH + RAM', 'XX', 'RR'],
    ['BESH + BESH', 'XX', 'XX'],
    ['RAM + BESH', 'RR', 'XX'],
  ])('%s triggers «Большой той» exactly like RAM + RAM', (_name, a, b) => {
    const level = { ...twoGoals, overlays: [{ row: 2, col: 2, hp: 2 as const }] };
    const state = game({ '5,5': a, '5,6': b, '8,8': 'XX', '1,1': 'Bh' }, level);
    const events = wave1(state, mv(5, 6, 5, 5));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(1);
    expect(act[0]).toMatchObject({ effect: 'bigToi', center: p(5, 5) });
    expect(act[0].cells).toHaveLength(121);
    expect(firstOfType(events, 'tilesRemoved').tiles).toHaveLength(121);
    expect(firstOfType(events, 'obstacleDamaged').cells).toEqual([{ pos: p(2, 2), hp: 1, destroyed: false }]);
  });
});

describe('chains and overlaps', () => {
  it('overlapping blasts never double-count score, collection or damage; cyclic hits activate once', () => {
    const level = { ...twoGoals, overlays: [{ row: 8, col: 4, hp: 2 as const }] };
    // Match B(5,3)=LINE_H, B(5,4)=LINE_V, B→(5,5). LINE_V hits the tea BOMB at (8,4);
    // the BOMB hits the tea LINE_H at (8,5), whose row hits the BOMB again (already activated).
    const state = game({ '5,3': 'Bh', '5,4': 'Bv', '4,5': 'B.', '8,4': 'Tb', '8,5': 'Th' }, level);
    const result = applyMove(state, mv(4, 5, 5, 5));
    const events = waveEvents(result.events, 1);
    const act = ofType(events, 'specialActivated');
    expect(act.map((a) => [a.effect, a.center])).toEqual([
      ['row', p(5, 3)],
      ['col', p(5, 4)],
      ['square3', p(8, 4)],
      ['row', p(8, 5)],
    ]);
    const union = unionCells(row(5), col(4), rect(7, 3, 9, 5), row(8));
    const removed = firstOfType(events, 'tilesRemoved');
    expect(removed.tiles.map((t) => t.pos)).toEqual(union);
    expect(new Set(removed.tiles.map((t) => t.tileId)).size).toBe(union.length);
    expect(removed.scoreDelta).toBe(union.length * 10);
    expect(firstOfType(events, 'cellsHit').cells).toEqual(union);
    expect(firstOfType(events, 'obstacleDamaged').cells).toEqual([{ pos: p(8, 4), hp: 1, destroyed: false }]);
    const goals = firstOfType(result.events, 'goalsUpdated').goals;
    // Wave 1 alone collects 3 baursak and 2 tea; later random cascades may add more.
    expect(goals[0].done).toBeGreaterThanOrEqual(3);
    expect(goals[1].done).toBeGreaterThanOrEqual(2);
    const collectedW1 = removed.tiles.filter((t) => t.base === 'baursak').length;
    expect(collectedW1).toBe(3);
    expect(removed.tiles.filter((t) => t.base === 'tea').length).toBe(2);
  });

  it('a RAM hit by another effect targets the most frequent type with FOOD_TYPES tie-break', () => {
    // Palette S,Z,K,J gives S=33, Z=28, K=33, J=27. Replacing (5,0)=Z, (5,1)=J, (5,5)=J keeps S and K tied
    // at 33; the first tile in row-major order is samsa, but the FOOD_TYPES tie-break picks kurt.
    const palette = ['S', 'Z', 'K', 'J'];
    const state = game({ '5,0': 'Bh', '5,1': 'Bv', '5,5': 'RR' }, twoGoals, palette);
    const counts = new Map<string, number>();
    for (const line of state.board) for (const t of line) if (t.base) counts.set(t.base, (counts.get(t.base) ?? 0) + 1);
    expect(counts.get('samsa')).toBe(33);
    expect(counts.get('kurt')).toBe(33);
    expect(state.board[0][0].base).toBe('samsa');

    const events = wave1(state, mv(5, 1, 5, 0));
    const act = ofType(events, 'specialActivated');
    expect(act).toHaveLength(2);
    expect(act[0]).toMatchObject({ effect: 'cross', center: p(5, 0) });
    expect(act[1]).toMatchObject({ effect: 'ramColor', targetType: 'kurt', center: p(5, 5), tile: { special: 'RAM' } });
    const kurtCells: Pos[] = [];
    state.board.forEach((line, r) => line.forEach((t, c) => t.base === 'kurt' && kurtCells.push(p(r, c))));
    expect(act[1].cells).toEqual(sortPositions([...kurtCells, p(5, 5)]));
  });
});
