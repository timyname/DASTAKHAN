import { describe, expect, it } from 'vitest';
import { parseBoardFixture } from './fixture.ts';
import { findComponents, findRuns } from './match.ts';
import { posOf } from './board.ts';
import { BG4, BG6, fixture, p } from './test-utils.ts';

function components(overrides: Record<string, string>) {
  return findComponents(parseBoardFixture(fixture(overrides)));
}

function cellsOf(keys: number[]) {
  return keys.map(posOf);
}

function hRun(row: number, col: number, length: number, token = 'B.'): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < length; i++) out[`${row},${col + i}`] = token;
  return out;
}

function vRun(row: number, col: number, length: number, token = 'B.'): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < length; i++) out[`${row + i},${col}`] = token;
  return out;
}

describe('background fixtures', () => {
  it('4- and 6-type backgrounds contain no matches', () => {
    expect(findRuns(parseBoardFixture(fixture({}, BG4)))).toEqual([]);
    expect(findRuns(parseBoardFixture(fixture({}, BG6)))).toEqual([]);
  });
});

describe('run detection', () => {
  it.each([
    [3, 'line3'],
    [4, 'line4h'],
    [5, 'line5'],
    [6, 'line5'],
  ] as const)('horizontal run of %i → %s', (length, shape) => {
    const comps = components(hRun(5, 2, length));
    expect(comps).toHaveLength(1);
    expect(comps[0].shape).toBe(shape);
    expect(comps[0].base).toBe('baursak');
    expect(cellsOf(comps[0].cells)).toEqual(Array.from({ length }, (_, i) => p(5, 2 + i)));
    expect(comps[0].runs).toHaveLength(1);
  });

  it.each([
    [3, 'line3'],
    [4, 'line4v'],
    [5, 'line5'],
    [6, 'line5'],
  ] as const)('vertical run of %i → %s', (length, shape) => {
    const comps = components(vRun(2, 4, length, 'T.'));
    expect(comps).toHaveLength(1);
    expect(comps[0].shape).toBe(shape);
    expect(comps[0].base).toBe('tea');
    expect(cellsOf(comps[0].cells)).toEqual(Array.from({ length }, (_, i) => p(2 + i, 4)));
  });

  it('a run of 2 is not a match', () => {
    expect(components(hRun(5, 2, 2))).toEqual([]);
  });

  it('diagonals are not matches', () => {
    expect(components({ '2,2': 'B.', '3,3': 'B.', '4,4': 'B.', '5,5': 'B.' })).toEqual([]);
  });

  it('2×2 squares are not matches', () => {
    expect(components({ '2,2': 'B.', '2,3': 'B.', '3,2': 'B.', '3,3': 'B.' })).toEqual([]);
  });

  it('RAM and BESH never match and break runs', () => {
    expect(components({ '5,2': 'B.', '5,3': 'B.', '5,4': 'RR', '5,5': 'B.', '5,6': 'B.' })).toEqual([]);
    expect(components({ '5,2': 'B.', '5,3': 'B.', '5,4': 'XX', '5,5': 'B.', '5,6': 'B.' })).toEqual([]);
    expect(components({ '5,2': 'RR', '5,3': 'RR', '5,4': 'RR' })).toEqual([]);
    expect(components({ '5,2': 'XX', '5,3': 'XX', '5,4': 'XX' })).toEqual([]);
  });

  it('new food types match like the original six', () => {
    const comps = components({ ...hRun(1, 1, 3, 'M.'), ...vRun(6, 8, 4, 'Lv') });
    expect(comps.map((c) => [c.base, c.shape])).toEqual([
      ['manty', 'line3'],
      ['lagman', 'line4v'],
    ]);
  });

  it('LINE/BOMB keep their base and participate in matches', () => {
    const comps = components({ '5,2': 'Bh', '5,3': 'Bb', '5,4': 'Bv' });
    expect(comps).toHaveLength(1);
    expect(comps[0].shape).toBe('line3');
  });
});

describe('components and classification', () => {
  it('L shape → lt (BOMB)', () => {
    const comps = components({ ...hRun(5, 3, 3), ...vRun(3, 5, 3) });
    expect(comps).toHaveLength(1);
    expect(comps[0].shape).toBe('lt');
    expect(comps[0].cells).toHaveLength(5);
  });

  it('T shape → lt (BOMB)', () => {
    const comps = components({ ...hRun(5, 3, 3), ...vRun(5, 4, 3) });
    expect(comps).toHaveLength(1);
    expect(comps[0].shape).toBe('lt');
    expect(comps[0].cells).toHaveLength(5);
  });

  it('plus shape with run of 4 and run of 3 → lt', () => {
    const comps = components({ ...hRun(5, 2, 4), ...vRun(4, 3, 3) });
    expect(comps).toHaveLength(1);
    expect(comps[0].shape).toBe('lt');
  });

  it('intersection with a run of 5 → line5 (RAM priority over BOMB)', () => {
    const comps = components({ ...hRun(5, 2, 5), ...vRun(3, 4, 3) });
    expect(comps).toHaveLength(1);
    expect(comps[0].shape).toBe('line5');
    expect(comps[0].cells).toHaveLength(7);
  });

  it('run of 5 crossing a perpendicular run of 4 → besh (BESH)', () => {
    const plus = components({ ...hRun(5, 2, 5), ...vRun(3, 4, 4) });
    expect(plus).toHaveLength(1);
    expect(plus[0].shape).toBe('besh');
    expect(plus[0].cells).toHaveLength(8);
    const vertical5 = components({ ...vRun(2, 6, 5), ...hRun(4, 3, 4) });
    expect(vertical5.map((c) => c.shape)).toEqual(['besh']);
    const corner = components({ ...hRun(5, 5, 5), ...vRun(5, 5, 4) });
    expect(corner.map((c) => c.shape)).toEqual(['besh']);
  });

  it('BESH has priority over RAM: 5 crossing 5 and 6 crossing 4 are besh', () => {
    expect(components({ ...hRun(5, 1, 5), ...vRun(3, 3, 5) }).map((c) => c.shape)).toEqual(['besh']);
    expect(components({ ...hRun(5, 1, 6), ...vRun(2, 4, 4) }).map((c) => c.shape)).toEqual(['besh']);
  });

  it('4 crossing 4 is a BOMB; 5 reaching a 4 only through a 3 is a RAM', () => {
    expect(components({ ...hRun(5, 3, 4), ...vRun(3, 4, 4) }).map((c) => c.shape)).toEqual(['lt']);
    // H5 (row 5) shares (5,2) with V3 (col 2, rows 5..7); V3 shares (7,2) with H4 (row 7), which is
    // parallel to the H5. No perpendicular run of 4+ touches the run of 5 directly.
    const chain = components({ ...hRun(5, 2, 5), ...vRun(5, 2, 3), ...hRun(7, 2, 4) });
    expect(chain).toHaveLength(1);
    expect(chain[0].shape).toBe('line5');
  });

  it('parallel adjacent runs do not merge without a shared cell', () => {
    const comps = components({ ...hRun(2, 1, 3), ...hRun(3, 1, 3) });
    // Columns 1..3 have vertical pairs only (length 2), so no shared cells.
    expect(comps).toHaveLength(2);
    expect(comps.map((c) => c.shape)).toEqual(['line3', 'line3']);
  });

  it('runs of different bases never merge', () => {
    const comps = components({ ...hRun(5, 2, 3, 'B.'), ...vRun(2, 5, 3, 'T.') });
    expect(comps).toHaveLength(2);
    expect(comps.map((c) => c.base)).toEqual(['tea', 'baursak']);
  });

  it('independent components are ordered by their first cell', () => {
    const comps = components({ ...hRun(8, 6, 4, 'T.'), ...vRun(1, 1, 3, 'B.') });
    expect(comps.map((c) => [c.base, c.shape])).toEqual([
      ['baursak', 'line3'],
      ['tea', 'line4h'],
    ]);
  });
});
