/**
 * Text board fixtures for tutorials and tests (format documented on BoardFixture in types.ts).
 * 11 rows of 11 space-separated 2-char tokens; ids are assigned row-major from 1 when parsing
 * and ignored when formatting.
 */
import { BOARD_SIZE, type BoardFixture, type FoodType, type SpecialKind, type Tile } from './types.ts';

const FOOD_TO_CHAR: Record<FoodType, string> = {
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

const CHAR_TO_FOOD: Record<string, FoodType> = Object.fromEntries(
  Object.entries(FOOD_TO_CHAR).map(([food, char]) => [char, food as FoodType]),
);

type BasedKind = Exclude<SpecialKind, 'RAM' | 'BESH'>;

const CHAR_TO_KIND: Record<string, BasedKind | null> = {
  '.': null,
  h: 'LINE_H',
  v: 'LINE_V',
  b: 'BOMB',
};

const KIND_TO_CHAR: Record<BasedKind, string> = {
  LINE_H: 'h',
  LINE_V: 'v',
  BOMB: 'b',
};

/** Universal specials have no base and use whole-token codes. */
const UNIVERSAL_TOKENS: Record<'RAM' | 'BESH', string> = { RAM: 'RR', BESH: 'XX' };

function parseToken(token: string, row: number, col: number): Omit<Tile, 'id'> {
  if (token === UNIVERSAL_TOKENS.RAM) return { base: null, special: 'RAM' };
  if (token === UNIVERSAL_TOKENS.BESH) return { base: null, special: 'BESH' };
  if (token.length !== 2) throw new Error(`Fixture token "${token}" at (${row}, ${col}) must have 2 characters`);
  const base = Object.prototype.hasOwnProperty.call(CHAR_TO_FOOD, token[0]) ? CHAR_TO_FOOD[token[0]] : undefined;
  if (!base) throw new Error(`Unknown food "${token[0]}" in fixture token "${token}" at (${row}, ${col})`);
  if (!Object.prototype.hasOwnProperty.call(CHAR_TO_KIND, token[1])) {
    throw new Error(`Unknown kind "${token[1]}" in fixture token "${token}" at (${row}, ${col})`);
  }
  return { base, special: CHAR_TO_KIND[token[1]] };
}

/** Parses a fixture into a full board with ids 1..121 assigned row-major. Throws on malformed input. */
export function parseBoardFixture(rows: BoardFixture): Tile[][] {
  if (!Array.isArray(rows) || rows.length !== BOARD_SIZE) {
    throw new Error(`Board fixture must have exactly ${BOARD_SIZE} rows`);
  }
  let nextId = 1;
  return rows.map((line, row) => {
    if (typeof line !== 'string') throw new Error(`Fixture row ${row} is not a string`);
    const tokens = line.trim().split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length !== BOARD_SIZE) {
      throw new Error(`Fixture row ${row} must have exactly ${BOARD_SIZE} tokens, got ${tokens.length}`);
    }
    return tokens.map((token, col) => ({ id: nextId++, ...parseToken(token, row, col) }));
  });
}

function formatTile(tile: Tile, row: number, col: number): string {
  if (tile.special === 'RAM' || tile.special === 'BESH') {
    if (tile.base !== null) throw new Error(`${tile.special} at (${row}, ${col}) must have no base`);
    return UNIVERSAL_TOKENS[tile.special];
  }
  if (tile.base === null || !Object.prototype.hasOwnProperty.call(FOOD_TO_CHAR, tile.base)) {
    throw new Error(`Tile at (${row}, ${col}) has an invalid base`);
  }
  const kindChar = tile.special === null ? '.' : KIND_TO_CHAR[tile.special as BasedKind];
  if (!kindChar) throw new Error(`Tile at (${row}, ${col}) has an invalid special kind`);
  return FOOD_TO_CHAR[tile.base] + kindChar;
}

/** Formats a full board as a fixture (ids are not represented). */
export function formatBoardFixture(board: Tile[][]): BoardFixture {
  if (!Array.isArray(board) || board.length !== BOARD_SIZE) {
    throw new Error(`Board must have exactly ${BOARD_SIZE} rows`);
  }
  return board.map((line, row) => {
    if (!Array.isArray(line) || line.length !== BOARD_SIZE) {
      throw new Error(`Board row ${row} must have exactly ${BOARD_SIZE} cells`);
    }
    return line
      .map((tile, col) => {
        if (!tile) throw new Error(`Board cell (${row}, ${col}) is empty`);
        return formatTile(tile, row, col);
      })
      .join(' ');
  });
}
