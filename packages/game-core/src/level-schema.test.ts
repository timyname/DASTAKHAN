import { describe, expect, it } from 'vitest';
import { validateLevel } from './level-schema.ts';
import { RULES_VERSION } from './types.ts';

/** A fresh, fully valid level; tests mutate their own copy. */
function validLevel(): Record<string, unknown> {
  return {
    id: 'level-test',
    version: 1,
    rulesVersion: 1,
    rows: 11,
    cols: 11,
    allowedTypes: ['baursak', 'kurt', 'kazy', 'samsa', 'zhent', 'tea'],
    moveLimit: 25,
    goals: [
      { kind: 'clearCrumbs', count: 2 },
      { kind: 'collect', type: 'tea', count: 20 },
    ],
    overlays: [
      { row: 0, col: 0, hp: 1 },
      { row: 10, col: 10, hp: 2 },
    ],
  };
}

function errorsFor(mutate: (level: Record<string, unknown>) => void): string[] {
  const level = validLevel();
  mutate(level);
  const result = validateLevel(level);
  expect(result.ok).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  return result.errors;
}

describe('validateLevel: valid input', () => {
  it('accepts a complete valid level', () => {
    expect(validateLevel(validLevel())).toEqual({ ok: true, errors: [] });
  });

  it('accepts a level with a tutorialId, no overlays and five types', () => {
    const level = validLevel();
    level.tutorialId = 'tutorial-line';
    level.overlays = [];
    level.allowedTypes = ['baursak', 'kurt', 'kazy', 'samsa', 'tea'];
    level.goals = [{ kind: 'collect', type: 'kurt', count: 3 }];
    expect(validateLevel(level)).toEqual({ ok: true, errors: [] });
  });

  it('accepts exactly four allowed types and move limits 1 and 99', () => {
    for (const moveLimit of [1, 99]) {
      const level = validLevel();
      level.allowedTypes = ['baursak', 'kurt', 'kazy', 'tea'];
      level.moveLimit = moveLimit;
      expect(validateLevel(level).ok).toBe(true);
    }
  });

  it('accepts eight allowed types including the rules-v2 dishes', () => {
    const level = validLevel();
    level.allowedTypes = ['baursak', 'kurt', 'tea', 'manty', 'shelpek', 'chakchak', 'plov', 'lagman'];
    level.goals = [{ kind: 'collect', type: 'lagman', count: 10 }];
    expect(validateLevel(level)).toEqual({ ok: true, errors: [] });
  });

  it('accepts every rulesVersion from 1 to RULES_VERSION', () => {
    expect(RULES_VERSION).toBeGreaterThanOrEqual(2);
    for (let rulesVersion = 1; rulesVersion <= RULES_VERSION; rulesVersion++) {
      const level = validLevel();
      level.rulesVersion = rulesVersion;
      expect(validateLevel(level).ok).toBe(true);
    }
  });

  it('accepts a level parsed from JSON', () => {
    expect(validateLevel(JSON.parse(JSON.stringify(validLevel()))).ok).toBe(true);
  });
});

describe('validateLevel: top-level structure', () => {
  it.each([null, undefined, 42, 'level', [], [validLevel()]])('rejects non-object %j', (input) => {
    const result = validateLevel(input);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/^level must be a plain object/);
  });

  it('rejects class instances and other non-plain objects', () => {
    expect(validateLevel(new Date()).ok).toBe(false);
    expect(validateLevel(new Map()).ok).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(errorsFor((l) => (l.seed = 7))).toContain('seed is not an allowed property');
  });

  it('reports every missing required key', () => {
    const errors = validateLevel({}).errors;
    for (const key of ['id', 'version', 'rulesVersion', 'rows', 'cols', 'allowedTypes', 'moveLimit', 'goals', 'overlays']) {
      expect(errors).toContain(`${key} is required`);
    }
    expect(errors).not.toContain('tutorialId is required');
  });
});

describe('validateLevel: scalar fields', () => {
  it.each(['', '   ', 5, null])('rejects id %j', (id) => {
    expect(errorsFor((l) => (l.id = id)).some((e) => e.startsWith('id must be a non-empty string'))).toBe(true);
  });

  it.each([0, -1, 1.5, '1', null])('rejects version %j', (version) => {
    expect(errorsFor((l) => (l.version = version)).some((e) => e.startsWith('version must be a positive integer'))).toBe(
      true,
    );
  });

  it.each([0, RULES_VERSION + 1, 1.5, '1'])('rejects rulesVersion %j', (rulesVersion) => {
    expect(
      errorsFor((l) => (l.rulesVersion = rulesVersion)).some((e) =>
        e.startsWith(`rulesVersion must be an integer from 1 to ${RULES_VERSION}`),
      ),
    ).toBe(true);
  });

  it.each([10, 12, '11'])('rejects rows/cols %j', (size) => {
    expect(errorsFor((l) => (l.rows = size)).some((e) => e.startsWith('rows must be 11'))).toBe(true);
    expect(errorsFor((l) => (l.cols = size)).some((e) => e.startsWith('cols must be 11'))).toBe(true);
  });

  it.each([0, 100, -3, 2.5, '20', Number.NaN, Number.POSITIVE_INFINITY])('rejects moveLimit %j', (moveLimit) => {
    expect(
      errorsFor((l) => (l.moveLimit = moveLimit)).some((e) => e.startsWith('moveLimit must be an integer from 1 to 99')),
    ).toBe(true);
  });

  it.each(['', 3, null])('rejects tutorialId %j', (tutorialId) => {
    expect(
      errorsFor((l) => (l.tutorialId = tutorialId)).some((e) => e.startsWith('tutorialId must be a non-empty string')),
    ).toBe(true);
  });
});

describe('validateLevel: allowedTypes', () => {
  it('rejects a non-array', () => {
    expect(errorsFor((l) => (l.allowedTypes = 'tea'))[0]).toMatch(/^allowedTypes must be an array/);
  });

  it('rejects an empty list', () => {
    expect(errorsFor((l) => (l.allowedTypes = []))).toContain('allowedTypes must not be empty');
  });

  it('rejects unknown food types with the entry path', () => {
    const errors = errorsFor((l) => (l.allowedTypes = ['baursak', 'kurt', 'kazy', 'pizza', 'tea']));
    expect(
      errors.some((e) =>
        e.startsWith(
          'allowedTypes[3] must be one of baursak, kurt, kazy, samsa, zhent, tea, manty, shelpek, chakchak, plov, lagman',
        ),
      ),
    ).toBe(true);
  });

  it('rejects more than eight types', () => {
    const errors = errorsFor(
      (l) =>
        (l.allowedTypes = ['baursak', 'kurt', 'kazy', 'samsa', 'zhent', 'tea', 'manty', 'shelpek', 'chakchak']),
    );
    expect(errors).toEqual(['allowedTypes must contain at most 8 food types, got 9']);
  });

  it('rejects duplicates', () => {
    const errors = errorsFor((l) => (l.allowedTypes = ['baursak', 'kurt', 'kazy', 'tea', 'kurt']));
    expect(errors).toContain('allowedTypes[4] duplicates "kurt"');
  });

  it('rejects fewer than four distinct types', () => {
    const errors = errorsFor((l) => {
      l.allowedTypes = ['baursak', 'kurt', 'tea'];
      l.goals = [{ kind: 'collect', type: 'tea', count: 3 }];
    });
    expect(errors).toContain('allowedTypes must contain at least 4 distinct food types, got 3');
  });
});

describe('validateLevel: goals', () => {
  it('rejects a non-array and an empty list', () => {
    expect(errorsFor((l) => (l.goals = {}))[0]).toMatch(/^goals must be an array/);
    expect(errorsFor((l) => (l.goals = []))).toContain('goals must contain at least one goal');
  });

  it('rejects non-object goals and unknown kinds', () => {
    expect(errorsFor((l) => (l.goals = [5])).some((e) => e.startsWith('goals[0] must be an object'))).toBe(true);
    expect(errorsFor((l) => (l.goals = [{ kind: 'score', count: 5 }]))).toContain(
      'goals[0].kind must be "collect" or "clearCrumbs", got "score"',
    );
    expect(errorsFor((l) => (l.goals = [{ count: 5 }]))).toContain('goals[0].kind is required');
  });

  it('rejects collect goals with an invalid count', () => {
    for (const count of [0, -2, 1.5, '3']) {
      const errors = errorsFor((l) => (l.goals = [{ kind: 'collect', type: 'tea', count: 1 }, { kind: 'collect', type: 'kurt', count }]));
      expect(errors.some((e) => e.startsWith('goals[1].count must be a positive integer'))).toBe(true);
    }
  });

  it('rejects collect goals with an unknown or disallowed type', () => {
    expect(
      errorsFor((l) => (l.goals = [{ kind: 'collect', type: 'pizza', count: 3 }])).some((e) =>
        e.startsWith('goals[0].type must be one of'),
      ),
    ).toBe(true);
    const errors = errorsFor((l) => {
      l.allowedTypes = ['baursak', 'kurt', 'kazy', 'samsa', 'tea'];
      l.goals = [{ kind: 'collect', type: 'zhent', count: 3 }];
    });
    expect(errors).toContain('goals[0].type "zhent" is not in allowedTypes');
  });

  it('rejects duplicate collect types', () => {
    const errors = errorsFor(
      (l) =>
        (l.goals = [
          { kind: 'collect', type: 'tea', count: 3 },
          { kind: 'collect', type: 'tea', count: 4 },
        ]),
    );
    expect(errors).toContain('goals[1] duplicates the collect goal for "tea" in goals[0]');
  });

  it('rejects missing and unknown goal properties', () => {
    expect(errorsFor((l) => (l.goals = [{ kind: 'collect', count: 3 }]))).toContain('goals[0].type is required');
    expect(errorsFor((l) => (l.goals = [{ kind: 'collect', type: 'tea' }]))).toContain('goals[0].count is required');
    expect(errorsFor((l) => (l.goals = [{ kind: 'collect', type: 'tea', count: 3, bonus: 1 }]))).toContain(
      'goals[0].bonus is not an allowed property',
    );
    expect(errorsFor((l) => (l.goals = [{ kind: 'clearCrumbs', count: 1, type: 'tea' }]))).toContain(
      'goals[0].type is not an allowed property',
    );
  });

  it('rejects clearCrumbs with an invalid count', () => {
    for (const count of [0, -1, 2.5, null]) {
      const errors = errorsFor((l) => (l.goals = [{ kind: 'clearCrumbs', count }]));
      expect(errors.some((e) => e.startsWith('goals[0].count must be a positive integer'))).toBe(true);
    }
  });

  it('rejects more than one clearCrumbs goal', () => {
    const errors = errorsFor(
      (l) =>
        (l.goals = [
          { kind: 'clearCrumbs', count: 1 },
          { kind: 'clearCrumbs', count: 2 },
        ]),
    );
    expect(errors).toContain('goals[1] duplicates the clearCrumbs goal in goals[0]');
  });

  it('rejects a clearCrumbs count above the number of overlay cells', () => {
    expect(errorsFor((l) => (l.goals = [{ kind: 'clearCrumbs', count: 3 }]))).toContain(
      'goals[0].count (3) exceeds the number of overlay cells (2)',
    );
    expect(
      errorsFor((l) => {
        l.overlays = [];
        l.goals = [{ kind: 'clearCrumbs', count: 1 }];
      }),
    ).toContain('goals[0].count (1) exceeds the number of overlay cells (0)');
  });

  it('counts overlay cells, not total HP', () => {
    // Two cells with 1 + 2 = 3 HP still allow at most 2 cleared cells.
    expect(errorsFor((l) => (l.goals = [{ kind: 'clearCrumbs', count: 3 }])).length).toBe(1);
  });
});

describe('validateLevel: overlays', () => {
  it('rejects a non-array', () => {
    expect(errorsFor((l) => (l.overlays = null))[0]).toMatch(/^overlays must be an array/);
  });

  it('rejects non-object entries', () => {
    expect(errorsFor((l) => (l.overlays = [[1, 1, 1], { row: 1, col: 1, hp: 1 }])).some((e) => e.startsWith('overlays[0] must be an object'))).toBe(true);
  });

  it.each([-1, 11, 1.5, '3'])('rejects row/col %j', (value) => {
    const rowErrors = errorsFor((l) => (l.overlays = [{ row: 0, col: 0, hp: 1 }, { row: value, col: 2, hp: 1 }]));
    expect(rowErrors.some((e) => e.startsWith('overlays[1].row must be an integer from 0 to 10'))).toBe(true);
    const colErrors = errorsFor((l) => (l.overlays = [{ row: 0, col: 0, hp: 1 }, { row: 2, col: value, hp: 1 }]));
    expect(colErrors.some((e) => e.startsWith('overlays[1].col must be an integer from 0 to 10'))).toBe(true);
  });

  it.each([0, 3, 1.5, '1'])('rejects hp %j', (hp) => {
    expect(
      errorsFor((l) => (l.overlays = [{ row: 0, col: 0, hp: 1 }, { row: 1, col: 1, hp }])).some((e) =>
        e.startsWith('overlays[1].hp must be 1 or 2'),
      ),
    ).toBe(true);
  });

  it('rejects duplicate positions', () => {
    const errors = errorsFor(
      (l) =>
        (l.overlays = [
          { row: 4, col: 5, hp: 1 },
          { row: 0, col: 0, hp: 1 },
          { row: 4, col: 5, hp: 2 },
        ]),
    );
    expect(errors).toContain('overlays[2] duplicates position (4,5) of overlays[0]');
  });

  it('rejects missing and unknown overlay properties', () => {
    const errors = errorsFor((l) => (l.overlays = [{ row: 0, col: 0 }, { row: 1, col: 1, hp: 1, kind: 'ice' }]));
    expect(errors).toContain('overlays[0].hp is required');
    expect(errors).toContain('overlays[1].kind is not an allowed property');
  });
});

describe('validateLevel: determinism', () => {
  it('returns the same errors for the same input', () => {
    const bad = { ...validLevel(), zeta: 1, alpha: 2, moveLimit: 0 };
    expect(validateLevel(bad)).toEqual(validateLevel(bad));
    expect(validateLevel(bad).errors.slice(0, 2)).toEqual(['alpha is not an allowed property', 'zeta is not an allowed property']);
  });
});
