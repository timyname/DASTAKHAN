/**
 * Shared DASTAKHAN contract. docs/GAME_SPEC.md is canonical; these types encode it.
 * Every consumer (engine, web UI, content, editor, later server replay) imports from here.
 */

export const RULES_VERSION = 1;
export const BOARD_SIZE = 11;

/** Food types. This order is also the RAM tie-break order (GAME_SPEC §4). */
export const FOOD_TYPES = ['baursak', 'kurt', 'kazy', 'samsa', 'zhent', 'tea'] as const;
export type FoodType = (typeof FOOD_TYPES)[number];

export type SpecialKind = 'LINE_H' | 'LINE_V' | 'BOMB' | 'RAM';

/** Bounds recorded with the rules version (GAME_SPEC §5). */
export const RULE_LIMITS = {
  maxCascadeWaves: 100,
  maxGenerationAttempts: 500,
  maxShuffleAttempts: 50,
} as const;

/** Wave multipliers ×1, ×2, ×3, ×4, then capped at ×5. */
export const WAVE_MULTIPLIER_CAP = 5;
export const SCORE_PER_PIECE = 10;
export const SCORE_PER_OBSTACLE = 20;

export interface Tile {
  /** Stable deterministic id; survives falls, never reused within a game. */
  id: number;
  /** Food base type. null only for RAM. */
  base: FoodType | null;
  /** null for an ordinary food piece. */
  special: SpecialKind | null;
}

export interface Pos {
  row: number;
  col: number;
}

/** A player swap between two orthogonally adjacent cells. */
export interface Move {
  from: Pos;
  to: Pos;
}

/** Crumbs layer under a cell («Крошки на скатерти»). */
export interface Overlay {
  row: number;
  col: number;
  hp: 1 | 2;
}

export type Goal =
  | { kind: 'collect'; type: FoodType; count: number }
  /** Number of crumb CELLS to fully destroy (not total HP). */
  | { kind: 'clearCrumbs'; count: number };

/** A goal plus progress. `done` is clamped to the goal count. */
export type GoalProgress = Goal & { done: number };

export interface LevelDefinition {
  id: string;
  version: number;
  rulesVersion: number;
  rows: 11;
  cols: 11;
  allowedTypes: FoodType[];
  moveLimit: number;
  goals: Goal[];
  overlays: Overlay[];
  tutorialId?: string;
}

export type GameStatus = 'playing' | 'won' | 'lost';

/**
 * Stable (idle) game state. The engine never exposes intermediate states;
 * intermediate scenes are reconstructed from events.
 */
export interface GameState {
  rulesVersion: number;
  levelId: string;
  levelVersion: number;
  seed: number;
  /** uint32 RNG state after the last stable step. */
  rngState: number;
  allowedTypes: FoodType[];
  /** board[row][col]; every cell holds a tile when stable. Row 0 is the top. */
  board: Tile[][];
  /** layers[row][col] = remaining crumbs HP (0, 1 or 2). Layers never fall. */
  layers: number[][];
  moveLimit: number;
  movesLeft: number;
  score: number;
  goals: GoalProgress[];
  status: GameStatus;
  /** Stars on victory (1–3), 0 otherwise. */
  stars: number;
  nextTileId: number;
  moveLog: Move[];
}

export type RejectReason = 'outOfBounds' | 'notAdjacent' | 'noMatch' | 'gameOver' | 'technicalError';

export type MoveResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: RejectReason; state: GameState; events: GameEvent[] };

/* ------------------------------------------------------------------ */
/* Ordered visual events (GAME_SPEC §5, prompt 02).                    */
/* The renderer plays them in order; it never calculates rules.        */
/* `wave` starts at 1 for the first resolution after a player swap.    */
/* ------------------------------------------------------------------ */

export interface TileRef {
  tileId: number;
  pos: Pos;
  base: FoodType | null;
  special: SpecialKind | null;
}

/** Shape of a detected matching component. */
export type MatchShape = 'line3' | 'line4h' | 'line4v' | 'lt' | 'line5';

export type EffectKind =
  | 'row' // LINE_H
  | 'col' // LINE_V
  | 'square3' // BOMB
  | 'ramColor' // RAM + food or RAM hit by an effect
  | 'cross' // LINE + LINE (21 cells)
  | 'wideCross' // LINE + BOMB (up to 57 cells)
  | 'square5' // BOMB + BOMB
  | 'ramLine' // RAM + LINE conversion
  | 'ramBomb' // RAM + BOMB conversion
  | 'bigToi' // RAM + RAM «Большой той»
  | 'none'; // RAM hit with no baseType left on the board

export type GameEvent =
  | { type: 'swap'; from: Pos; to: Pos; tileA: number; tileB: number }
  | { type: 'swapRejected'; from: Pos; to: Pos; tileA: number; tileB: number; reason: RejectReason }
  | { type: 'cascadeStarted'; wave: number; multiplier: number }
  | {
      type: 'matched';
      wave: number;
      groups: { shape: MatchShape; base: FoodType; cells: Pos[]; tileIds: number[] }[];
    }
  | {
      type: 'specialActivated';
      wave: number;
      /** The activating special (for pairs: the tile that ended at the swap destination). */
      tile: TileRef;
      /** Second special for a pair effect. */
      partner?: TileRef;
      effect: EffectKind;
      /** Center of the effect (pair center = swap destination). */
      center: Pos;
      /** Food type targeted by RAM effects. */
      targetType?: FoodType;
      /** Unique cells affected by this activation, row-major order. */
      cells: Pos[];
    }
  | {
      type: 'tilesConverted';
      wave: number;
      /** RAM+LINE / RAM+BOMB conversions from the pre-removal snapshot. */
      conversions: { fromTileId: number; tile: TileRef }[];
    }
  /** Union of all cells hit in this wave (removal or direct effect). */
  | { type: 'cellsHit'; wave: number; cells: Pos[] }
  | {
      type: 'obstacleDamaged';
      wave: number;
      cells: { pos: Pos; hp: number; destroyed: boolean }[];
    }
  | {
      type: 'tilesRemoved';
      wave: number;
      tiles: TileRef[];
      /** Points awarded this wave (pieces + obstacles) after the multiplier. */
      scoreDelta: number;
      multiplier: number;
    }
  /** Emitted after removal; created specials stay in place (protected this wave). */
  | { type: 'specialCreated'; wave: number; tile: TileRef; shape: MatchShape; fromTileId: number }
  | { type: 'tilesFell'; wave: number; moves: { tileId: number; from: Pos; to: Pos }[] }
  | {
      type: 'tilesSpawned';
      wave: number;
      /** `fromRow` is negative: the virtual row above the board the tile drops from. */
      tiles: { tile: TileRef; fromRow: number }[];
    }
  | {
      type: 'shuffled';
      /** Final positions of every tile after the shuffle. */
      moves: { tileId: number; from: Pos; to: Pos }[];
      /** True when bounded shuffling failed and ordinary pieces were regenerated. */
      regenerated: boolean;
      /** Full board after shuffling (needed when regenerated). */
      board: Tile[][];
    }
  | { type: 'goalsUpdated'; goals: GoalProgress[]; score: number; movesLeft: number }
  | { type: 'gameWon'; stars: number; score: number; movesLeft: number }
  | { type: 'gameLost'; score: number }
  | { type: 'technicalError'; message: string };

export type GameEventType = GameEvent['type'];

/* ------------------------------------------------------------------ */
/* Fixtures (tutorials and tests).                                      */
/* ------------------------------------------------------------------ */

/**
 * Board fixture: 11 strings, each with 11 space-separated 2-char tokens.
 * First char = food: B baursak, K kurt, Z kazy, S samsa, J zhent, T tea.
 * Second char = kind: '.' ordinary, 'h' LINE_H, 'v' LINE_V, 'b' BOMB.
 * RAM is written as "RR".
 * Example row: "B. K. Zh S. J. T. RR B. K. Z. S."
 */
export type BoardFixture = string[];

export interface TutorialStep {
  /** Swap the player must perform (other swaps are blocked in the tutorial). */
  move: Move;
  /** i18n key of the instruction shown before the move. */
  textKey: string;
}

export interface TutorialDefinition {
  id: 'tutorial-line' | 'tutorial-bomb' | 'tutorial-ram' | 'tutorial-ram-ram';
  version: number;
  rulesVersion: number;
  titleKey: string;
  /** Level frame (goals/moves) used while the tutorial runs. */
  level: LevelDefinition;
  board: BoardFixture;
  /** Seed for deterministic refills after each step. */
  seed: number;
  steps: TutorialStep[];
  /** i18n key shown when the tutorial ends. */
  doneTextKey: string;
}

/** Shape of a saved game (apps/web local saves; later server). */
export interface SavedGame {
  schemaVersion: 1;
  rulesVersion: number;
  levelId: string;
  levelVersion: number;
  seed: number;
  /** Canonical JSON from serializeState() of the last stable state. */
  snapshot: string;
}
