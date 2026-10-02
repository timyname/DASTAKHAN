import { GamePage } from '../game/GamePage.tsx';

/** Campaign level. The game container owns rules, rendering, saves and results. */
export function GameScreen({ levelId }: { levelId: string }) {
  return <GamePage key={levelId} mode="level" id={levelId} />;
}

/**
 * Fixed tutorial scene. The container reads `screen.next` from useApp()
 * to know where to go when the tutorial ends or is skipped.
 */
export function TutorialScreen({ tutorialId }: { tutorialId: string }) {
  return <GamePage key={tutorialId} mode="tutorial" id={tutorialId} />;
}
