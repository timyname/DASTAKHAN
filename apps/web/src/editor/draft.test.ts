import { levels } from '@dastakhan/content';
import { validateLevel } from '@dastakhan/game-core';
import { describe, expect, it } from 'vitest';
import { blankDraft, draftFromLevel, draftFromUnknown, draftToLevel, editorHints, formatLevelJson } from './draft.ts';

describe('level editor draft model', () => {
  it('round-trips every campaign level through the draft and the JSON export', () => {
    for (const level of levels) {
      const exported = formatLevelJson(draftToLevel(draftFromLevel(level)));
      expect(JSON.parse(exported)).toEqual(level);
      expect(validateLevel(JSON.parse(exported)).ok).toBe(true);
    }
  });

  it('keeps invalid imported values so validation can report them', () => {
    const { draft, notes } = draftFromUnknown({
      id: 'x',
      version: 1,
      rulesVersion: 2,
      rows: 11,
      cols: 11,
      allowedTypes: ['baursak', 'pizza'],
      moveLimit: 0,
      goals: [{ kind: 'clearCrumbs', count: 3 }],
      overlays: [{ row: 0, col: 0, hp: 2 }, { row: 20, col: 0, hp: 1 }],
    });
    expect(notes.length).toBeGreaterThan(0);
    expect(draft.hp[0]![0]).toBe(2);
    const result = validateLevel(draftToLevel(draft));
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/moveLimit/);
    expect(result.errors.join('\n')).toMatch(/exceeds the number of overlay cells/);
  });

  it('warns about crumbs without a clearCrumbs goal', () => {
    const draft = blankDraft();
    draft.hp[5]![5] = 1;
    expect(editorHints(draft, levels).some((h) => h.includes('no clearCrumbs goal'))).toBe(true);
  });
});
