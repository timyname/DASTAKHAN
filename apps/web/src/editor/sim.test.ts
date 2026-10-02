import { getLevel } from '@dastakhan/content';
import { applyMove, createGame, getLegalMoves, type LevelDefinition } from '@dastakhan/game-core';
import { describe, expect, it } from 'vitest';
import {
  BOT_VERSION,
  chooseBotMove,
  describeOutcome,
  flagFor,
  median,
  scoreOutcome,
  simulateLevel,
  simulateRun,
  type LevelSummary,
} from './sim.ts';

const level = getLevel('level-05') as LevelDefinition;
const SEEDS = [1, 2];

describe('bot simulation core', () => {
  it('is deterministic for one level over two seeds', () => {
    const first = simulateLevel(level, SEEDS);
    const second = simulateLevel(level, SEEDS);
    expect(second).toEqual(first);
    expect(first.runs.map((r) => r.seed)).toEqual(SEEDS);
    for (const run of first.runs) {
      expect(run.error).toBeUndefined();
      expect(['won', 'lost']).toContain(run.status);
      expect(run.movesUsed + run.movesLeft).toBe(level.moveLimit);
      if (run.status === 'won') expect(run.stars).toBeGreaterThanOrEqual(1);
    }
    expect(first.summary.botVersion).toBe(BOT_VERSION);
    expect(first.summary.runs).toBe(2);
    expect(first.summary.technicalErrors).toBe(0);
    expect(first.summary.wins).toBe(first.runs.filter((r) => r.status === 'won').length);
  });

  it('repeats exactly per seed with the visible policy too', () => {
    const a = simulateRun(level, 1, 'greedy-visible-v1');
    const b = simulateRun(level, 1, 'greedy-visible-v1');
    expect(b).toEqual(a);
    expect(a.botVersion).toBe('greedy-visible-v1');
    expect(a.error).toBeUndefined();
  });

  it('picks the highest-valued legal move, ties broken by move order', () => {
    for (const seed of SEEDS) {
      const state = createGame(level, seed);
      const decision = chooseBotMove(state);
      expect(decision.kind).toBe('move');
      if (decision.kind !== 'move') return;
      const values = getLegalMoves(state).map((move) => {
        const result = applyMove(state, move);
        if (!result.ok) throw new Error('legal move rejected');
        return scoreOutcome(describeOutcome(state, result.state, result.events));
      });
      const best = Math.max(...values);
      expect(decision.choice.value).toBe(best);
      expect(decision.choice.index).toBe(values.indexOf(best));
      expect(decision.candidates).toBe(values.length);
    }
  });

  it('computes medians and playtest flags', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    const summary = (winRate: number) => ({ runs: 10, winRate }) as LevelSummary;
    expect(flagFor(summary(0.1))).toBe('tooHard');
    expect(flagFor(summary(0.2))).toBeNull();
    expect(flagFor(summary(0.95))).toBeNull();
    expect(flagFor(summary(1))).toBe('tooEasy');
  });
});
