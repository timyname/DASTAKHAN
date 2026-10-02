import type { EffectKind, FoodType, GameState, Pos, SpecialKind, Tile } from '@dastakhan/game-core';

/**
 * Visual scene played by the renderer. It mirrors engine events and is rebuilt
 * from the stable engine state after every move, so it can never drift from the rules.
 */

export type TileFx = 'none' | 'removing' | 'created' | 'converted';

export interface SceneTile {
  id: number;
  base: FoodType | null;
  special: SpecialKind | null;
  /** Display position; row may be negative while a spawned tile waits above the board. */
  row: number;
  col: number;
  fx: TileFx;
  /** Duration of the transform transition towards the current position. */
  moveMs: number;
}

export interface SceneEffect {
  key: number;
  kind: EffectKind;
  center: Pos;
  cells: Pos[];
  ms: number;
}

export interface Scene {
  tiles: Map<number, SceneTile>;
  layers: number[][];
  effects: SceneEffect[];
}

export function sceneTileFromTile(tile: Tile, row: number, col: number, fx: TileFx = 'none'): SceneTile {
  return { id: tile.id, base: tile.base, special: tile.special, row, col, fx, moveMs: 0 };
}

export function sceneFromState(state: GameState): Scene {
  const tiles = new Map<number, SceneTile>();
  state.board.forEach((rowTiles, row) => {
    rowTiles.forEach((tile, col) => {
      tiles.set(tile.id, sceneTileFromTile(tile, row, col));
    });
  });
  return { tiles, layers: state.layers.map((r) => [...r]), effects: [] };
}

/** Copy suitable for an immutable React state update. */
export function cloneScene(scene: Scene): Scene {
  const tiles = new Map<number, SceneTile>();
  for (const [id, t] of scene.tiles) tiles.set(id, { ...t });
  return { tiles, layers: scene.layers.map((r) => [...r]), effects: [...scene.effects] };
}

export function tileAt(scene: Scene, pos: Pos): SceneTile | undefined {
  for (const t of scene.tiles.values()) {
    if (t.row === pos.row && t.col === pos.col && t.fx !== 'removing') return t;
  }
  return undefined;
}

export function samePos(a: Pos | null | undefined, b: Pos | null | undefined): boolean {
  return !!a && !!b && a.row === b.row && a.col === b.col;
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
