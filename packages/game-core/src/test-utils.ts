/**
 * Test-only helpers (imported by *.test.ts, never by runtime code).
 *
 * Background boards: cell (r, c) holds palette[(r + 2c) % palette.length]. With 4 or 6 types this
 * pattern has no matches and no legal moves (a dead board), and the default palette never uses
 * baursak (B) or tea (T), so test pieces of those types cannot form accidental runs with it.
 */
import { BOARD_SIZE, type BoardFixture, type FoodType, type GameEvent, type LevelDefinition, type Pos, type Tile } from './types.ts';

/** The six original food types (a typical 6-type level subset). */
export const CLASSIC_SIX: FoodType[] = ['baursak', 'kurt', 'kazy', 'samsa', 'zhent', 'tea'];

export const BG4 = ['K', 'Z', 'S', 'J'] as const;
export const BG6 = ['B', 'K', 'Z', 'S', 'J', 'T'] as const;

export function bgToken(row: number, col: number, palette: readonly string[] = BG4): string {
  return `${palette[(row + 2 * col) % palette.length]}.`;
}

/** Fixture rows from a background palette plus overrides keyed "row,col". */
export function fixture(overrides: Record<string, string> = {}, palette: readonly string[] = BG4): BoardFixture {
  const rows: string[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    const tokens: string[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) tokens.push(overrides[`${row},${col}`] ?? bgToken(row, col, palette));
    rows.push(tokens.join(' '));
  }
  return rows;
}

export function testLevel(partial: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    id: 'test-level',
    version: 1,
    rulesVersion: 1,
    rows: 11,
    cols: 11,
    allowedTypes: [...CLASSIC_SIX],
    moveLimit: 20,
    goals: [{ kind: 'collect', type: 'baursak', count: 999 }],
    overlays: [],
    ...partial,
  };
}

/** Id of the tile at (row, col) on a freshly parsed fixture (row-major from 1). */
export function fixtureId(row: number, col: number): number {
  return row * BOARD_SIZE + col + 1;
}

export function p(row: number, col: number): Pos {
  return { row, col };
}

export function posKey(pos: Pos): string {
  return `${pos.row},${pos.col}`;
}

export function sortPositions(cells: Pos[]): Pos[] {
  return cells.slice().sort((a, b) => a.row - b.row || a.col - b.col);
}

export function waveEvents(events: GameEvent[], wave: number): GameEvent[] {
  return events.filter((e) => 'wave' in e && e.wave === wave);
}

export function ofType<T extends GameEvent['type']>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

export function firstOfType<T extends GameEvent['type']>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }> {
  const found = ofType(events, type)[0];
  if (!found) throw new Error(`No ${type} event`);
  return found;
}

/** Row-major cells of a rectangular area, clipped to the board. */
export function rect(r0: number, c0: number, r1: number, c1: number): Pos[] {
  const out: Pos[] = [];
  for (let row = Math.max(0, r0); row <= Math.min(BOARD_SIZE - 1, r1); row++) {
    for (let col = Math.max(0, c0); col <= Math.min(BOARD_SIZE - 1, c1); col++) out.push({ row, col });
  }
  return out;
}

export function unionCells(...lists: Pos[][]): Pos[] {
  const map = new Map<string, Pos>();
  for (const list of lists) for (const pos of list) map.set(posKey(pos), pos);
  return sortPositions([...map.values()]);
}

/**
 * Replays visual events on a copy of the previous board, exactly as a renderer would.
 * Throws if an event references a tile that is not where the event claims.
 */
export function reconstructBoard(previous: Tile[][], events: GameEvent[]): (Tile | null)[][] {
  let board: (Tile | null)[][] = previous.map((row) => row.map((t) => ({ ...t })));
  const at = (pos: Pos) => board[pos.row][pos.col];
  const expectId = (pos: Pos, id: number, what: string) => {
    const tile = at(pos);
    if (!tile || tile.id !== id) {
      throw new Error(`${what}: expected tile ${id} at ${posKey(pos)}, found ${tile ? tile.id : 'empty'}`);
    }
  };
  for (const event of events) {
    switch (event.type) {
      case 'swap': {
        expectId(event.from, event.tileA, 'swap');
        expectId(event.to, event.tileB, 'swap');
        const a = at(event.from);
        board[event.from.row][event.from.col] = at(event.to);
        board[event.to.row][event.to.col] = a;
        break;
      }
      case 'tilesConverted':
        for (const conv of event.conversions) {
          expectId(conv.tile.pos, conv.fromTileId, 'tilesConverted');
          board[conv.tile.pos.row][conv.tile.pos.col] = {
            id: conv.tile.tileId,
            base: conv.tile.base,
            special: conv.tile.special,
          };
        }
        break;
      case 'tilesRemoved':
        for (const ref of event.tiles) {
          expectId(ref.pos, ref.tileId, 'tilesRemoved');
          board[ref.pos.row][ref.pos.col] = null;
        }
        break;
      case 'specialCreated':
        expectId(event.tile.pos, event.fromTileId, 'specialCreated');
        board[event.tile.pos.row][event.tile.pos.col] = {
          id: event.tile.tileId,
          base: event.tile.base,
          special: event.tile.special,
        };
        break;
      case 'tilesFell': {
        const lifted = event.moves.map((m) => {
          expectId(m.from, m.tileId, 'tilesFell');
          const tile = at(m.from);
          board[m.from.row][m.from.col] = null;
          return { tile, to: m.to };
        });
        for (const { tile, to } of lifted) {
          if (at(to) !== null) throw new Error(`tilesFell: destination ${posKey(to)} occupied`);
          board[to.row][to.col] = tile;
        }
        break;
      }
      case 'tilesSpawned':
        for (const s of event.tiles) {
          if (at(s.tile.pos) !== null) throw new Error(`tilesSpawned: ${posKey(s.tile.pos)} occupied`);
          if (s.fromRow >= 0) throw new Error('tilesSpawned: fromRow must be negative');
          board[s.tile.pos.row][s.tile.pos.col] = { id: s.tile.tileId, base: s.tile.base, special: s.tile.special };
        }
        break;
      case 'shuffled':
        for (const m of event.moves) {
          const tile = event.board[m.to.row][m.to.col];
          if (tile.id !== m.tileId) throw new Error('shuffled: move does not match board');
        }
        board = event.board.map((row) => row.map((t) => ({ ...t })));
        break;
      default:
        break;
    }
  }
  return board;
}

/** Validates the fixed per-move event grammar. Returns the number of waves. Throws on violation. */
export function checkEventGrammar(events: GameEvent[]): number {
  const fail = (msg: string): never => {
    throw new Error(`Event grammar: ${msg} (types: ${events.map((e) => e.type).join(',')})`);
  };
  let i = 0;
  const type = () => events[i]?.type;
  if (type() !== 'swap') fail('first event must be swap');
  i++;
  let wave = 0;
  while (type() === 'cascadeStarted') {
    wave++;
    const started = events[i] as Extract<GameEvent, { type: 'cascadeStarted' }>;
    if (started.wave !== wave) fail(`wave ${started.wave} != ${wave}`);
    if (started.multiplier !== Math.min(wave, 5)) fail('bad multiplier');
    const waveStart = i;
    i++;
    if (type() === 'matched') i++;
    let lastActivation: GameEvent | null = null;
    while (type() === 'specialActivated' || type() === 'tilesConverted') {
      const e = events[i];
      if (e.type === 'tilesConverted') {
        if (!lastActivation || lastActivation.type !== 'specialActivated') fail('tilesConverted without activation');
        const act = lastActivation as Extract<GameEvent, { type: 'specialActivated' }>;
        if (act.effect !== 'ramLine' && act.effect !== 'ramBomb') fail('tilesConverted after non-RAM pair');
      } else if (e.type === 'specialActivated') {
        const keys = e.cells.map((c) => c.row * BOARD_SIZE + c.col);
        for (let k = 1; k < keys.length; k++) if (keys[k] <= keys[k - 1]) fail('activation cells not unique/sorted');
      }
      lastActivation = e;
      i++;
    }
    if (type() !== 'cellsHit') fail('expected cellsHit');
    i++;
    if (type() === 'obstacleDamaged') i++;
    if (type() !== 'tilesRemoved') fail('expected tilesRemoved');
    i++;
    while (type() === 'specialCreated') i++;
    if (type() !== 'tilesFell') fail('expected tilesFell');
    i++;
    if (type() !== 'tilesSpawned') fail('expected tilesSpawned');
    i++;
    for (let k = waveStart; k < i; k++) {
      const e = events[k];
      if (!('wave' in e) || e.wave !== wave) fail('event with wrong wave number');
    }
  }
  if (wave === 0) fail('no waves');
  if (type() !== 'goalsUpdated') fail('expected goalsUpdated');
  i++;
  if (type() === 'gameWon' || type() === 'gameLost' || type() === 'shuffled') i++;
  if (i !== events.length) fail('unexpected trailing events');
  return wave;
}

/** Deep-freezes an object graph (to prove inputs are never mutated). */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
