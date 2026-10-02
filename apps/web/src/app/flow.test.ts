import type { LevelDefinition, TutorialDefinition } from '@dastakhan/game-core';
import { describe, expect, it } from 'vitest';
import { continueLevelId, levelNumber, newDishesByLevel, nextLevelId, screenAfterLevelWin } from './flow.ts';
import { screenFromHash } from './screens.ts';

const level = (id: string) => ({ id }) as LevelDefinition;
const levels = ['level-01', 'level-02', 'level-03'].map(level);
const tutorial = (id: TutorialDefinition['id']) => ({ id }) as TutorialDefinition;
const tutorials = [tutorial('tutorial-line'), tutorial('tutorial-bomb')];
const after = { 'level-02': 'tutorial-line', 'level-03': 'tutorial-ram' } as const;

describe('flow helpers', () => {
  it('numbers levels by campaign order with an id fallback', () => {
    expect(levelNumber(levels, 'level-02')).toBe(2);
    expect(levelNumber([], 'level-07')).toBe(7);
  });

  it('finds the next level or null at the end', () => {
    expect(nextLevelId(levels, 'level-01')).toBe('level-02');
    expect(nextLevelId(levels, 'level-03')).toBeNull();
    expect(nextLevelId(levels, 'unknown')).toBeNull();
  });

  it('offers an unseen tutorial after the configured level, then returns to the list', () => {
    expect(screenAfterLevelWin('level-02', [], after, tutorials)).toEqual({
      name: 'tutorial',
      tutorialId: 'tutorial-line',
      next: { name: 'levels' },
    });
    expect(screenAfterLevelWin('level-02', ['tutorial-line'], after, tutorials)).toEqual({ name: 'levels' });
    expect(screenAfterLevelWin('level-01', [], after, tutorials)).toEqual({ name: 'levels' });
    // Tutorial id configured but its definition is missing: do not navigate into nothing.
    expect(screenAfterLevelWin('level-03', [], after, tutorials)).toEqual({ name: 'levels' });
  });

  it('continues at the highest unlocked level', () => {
    expect(continueLevelId(levels, 1)).toBe('level-01');
    expect(continueLevelId(levels, 3)).toBe('level-03');
    expect(continueLevelId(levels, 99)).toBe('level-03');
    expect(continueLevelId([], 4)).toBeNull();
  });

  it('lists dishes a level introduces for the first time', () => {
    const withTypes = (id: string, allowedTypes: string[]) => ({ id, allowedTypes }) as LevelDefinition;
    const campaign = [
      withTypes('level-01', ['baursak', 'kurt', 'kazy', 'samsa', 'tea']),
      withTypes('level-02', ['baursak', 'kurt', 'kazy', 'samsa', 'tea']),
      withTypes('level-03', ['baursak', 'kurt', 'kazy', 'samsa', 'zhent', 'tea']),
      withTypes('level-04', ['baursak', 'kazy', 'samsa', 'tea', 'manty', 'shelpek']),
      withTypes('level-05', ['kurt', 'zhent', 'manty']),
    ];
    expect(newDishesByLevel(campaign)).toEqual({ 'level-03': ['zhent'], 'level-04': ['manty', 'shelpek'] });
    expect(newDishesByLevel([])).toEqual({});
  });

  it('parses the DEV layout demo hash only in development', () => {
    expect(screenFromHash('#layout-demo', true)).toEqual({ name: 'layoutDemo', variant: undefined });
    expect(screenFromHash('#layout-demo:win', true)).toEqual({ name: 'layoutDemo', variant: 'win' });
    expect(screenFromHash('#layout-demo', false)).toBeNull();
    expect(screenFromHash('#other', true)).toBeNull();
  });
});
