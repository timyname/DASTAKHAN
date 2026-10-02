/**
 * Public API of @dastakhan/game-core (GAME_SPEC §8).
 * Pure logic only: no DOM, React, network, timers, storage, Date.now or Math.random.
 */
export * from './types.ts';
export {
  createGame,
  createGameFromBoard,
  applyMove,
  getLegalMoves,
  serializeState,
  restoreState,
  replay,
  parseBoardFixture,
  formatBoardFixture,
} from './engine.ts';
export { validateLevel, type ValidationResult } from './level-schema.ts';
