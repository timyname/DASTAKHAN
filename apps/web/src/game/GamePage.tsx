/**
 * TEMPORARY STUB — replaced in stage 2 by the real game container
 * (controller, board renderer, input, animations, saves, tutorials).
 * The props are the contract between the screen shell (App) and the game.
 */
export interface GamePageProps {
  mode: 'level' | 'tutorial';
  /** Campaign level id (e.g. "level-01") or tutorial id (e.g. "tutorial-line"). */
  id: string;
}

export function GamePage({ mode, id }: GamePageProps) {
  return (
    <div data-testid="game-page-stub">
      {mode}: {id}
    </div>
  );
}
