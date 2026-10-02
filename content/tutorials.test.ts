/**
 * Engine replay of every tutorial (stage-3 verification): each scripted step must be a
 * legal move on the real game-core engine, create/activate the special being taught,
 * and the final step must win. Refills use the tutorial `seed`, so results are exact.
 */
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createGameFromBoard,
  type GameEvent,
  type GameState,
  type Pos,
  type SpecialKind,
  type TutorialDefinition,
} from '@dastakhan/game-core';
import { getTutorial, tutorials } from './index.ts';

type Created = Extract<GameEvent, { type: 'specialCreated' }>;
type Activated = Extract<GameEvent, { type: 'specialActivated' }>;

interface StepResult {
  state: GameState;
  events: GameEvent[];
  created: Created[];
  activated: Activated[];
  waves: number;
}

/** Replays all steps; every step must be accepted by the engine. */
function play(tutorial: TutorialDefinition): StepResult[] {
  let state = createGameFromBoard(tutorial.level, tutorial.board, tutorial.seed);
  expect(state.status).toBe('playing');
  return tutorial.steps.map(({ move }, i) => {
    const result = applyMove(state, move);
    if (!result.ok) throw new Error(`${tutorial.id} step ${i + 1} rejected: ${result.reason}`);
    state = result.state;
    const { events } = result;
    return {
      state,
      events,
      created: events.filter((e): e is Created => e.type === 'specialCreated'),
      activated: events.filter((e): e is Activated => e.type === 'specialActivated'),
      waves: events.filter((e) => e.type === 'cascadeStarted').length,
    };
  });
}

const pos = (p: Pos) => ({ row: p.row, col: p.col });
const kinds = (list: { tile: { special: SpecialKind | null } }[]) => list.map((e) => e.tile.special);

/** Position of the only pre-placed fixture token matching `test`. */
function preplaced(tutorial: TutorialDefinition, test: (token: string) => boolean): Pos[] {
  const out: Pos[] = [];
  tutorial.board.forEach((line, row) =>
    line.split(' ').forEach((token, col) => {
      if (test(token)) out.push({ row, col });
    }),
  );
  return out;
}

describe('tutorial replay on the game-core engine', () => {
  describe.each(tutorials.map((t) => [t.id, t] as const))('%s', (_id, tutorial) => {
    it('accepts every step, never shuffles or errors, and wins exactly on the final step', () => {
      const steps = play(tutorial);
      steps.forEach((step, i) => {
        const last = i === steps.length - 1;
        const types = step.events.map((e) => e.type);
        expect(types).not.toContain('technicalError');
        expect(types).not.toContain('shuffled');
        expect(types).not.toContain('gameLost');
        expect(step.state.status).toBe(last ? 'won' : 'playing');
        expect(types.includes('gameWon')).toBe(last);
      });
    });

    it('is deterministic for its seed', () => {
      const a = play(tutorial).map((s) => s.events);
      const b = play(tutorial).map((s) => s.events);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  it('tutorial-line: step 1 creates LINE_H at the swap destination; step 2 fires the pre-placed line', () => {
    const tutorial = getTutorial('tutorial-line')!;
    const [s1, s2] = play(tutorial);
    expect(s1.waves).toBe(1);
    expect(s1.created).toHaveLength(1);
    expect(s1.created[0]).toMatchObject({ wave: 1, shape: 'line4h', tile: { special: 'LINE_H', base: 'samsa' } });
    expect(pos(s1.created[0].tile.pos)).toEqual(pos(tutorial.steps[0].move.to));
    expect(s1.activated).toEqual([]);

    const [line] = preplaced(tutorial, (t) => t[1] === 'h');
    const fired = s2.activated.find((e) => e.wave === 1 && e.effect === 'row');
    expect(fired).toBeDefined();
    expect(fired!.tile).toMatchObject({ special: 'LINE_H', base: 'baursak' });
    expect(pos(fired!.tile.pos)).toEqual(line);
  });

  it('tutorial-bomb: step 1 creates BOMB at the swap destination; step 2 fires the pre-placed bomb', () => {
    const tutorial = getTutorial('tutorial-bomb')!;
    const [s1, s2] = play(tutorial);
    expect(s1.waves).toBe(1);
    expect(s1.created).toHaveLength(1);
    expect(s1.created[0]).toMatchObject({ wave: 1, shape: 'lt', tile: { special: 'BOMB', base: 'kazy' } });
    expect(pos(s1.created[0].tile.pos)).toEqual(pos(tutorial.steps[0].move.to));
    expect(s1.activated).toEqual([]);

    const [bomb] = preplaced(tutorial, (t) => t[1] === 'b');
    const fired = s2.activated.find((e) => e.wave === 1 && e.effect === 'square3');
    expect(fired).toBeDefined();
    expect(fired!.tile).toMatchObject({ special: 'BOMB', base: 'kurt' });
    expect(pos(fired!.tile.pos)).toEqual(bomb);
  });

  it('tutorial-ram: step 1 creates RAM at the swap destination; step 2 RAM + baursak clears baursak', () => {
    const tutorial = getTutorial('tutorial-ram')!;
    const [s1, s2] = play(tutorial);
    expect(s1.waves).toBe(1);
    expect(s1.created).toHaveLength(1);
    expect(s1.created[0]).toMatchObject({ wave: 1, shape: 'line5', tile: { special: 'RAM', base: null } });
    expect(pos(s1.created[0].tile.pos)).toEqual(pos(tutorial.steps[0].move.to));
    expect(s1.activated).toEqual([]);

    const first = s2.activated.filter((e) => e.wave === 1);
    expect(kinds(first)).toEqual(['RAM']);
    expect(first[0]).toMatchObject({ effect: 'ramColor', targetType: 'baursak' });
    expect(first[0].partner).toBeUndefined();
  });

  it('tutorial-ram-ram: swapping the two RAM pieces triggers «Большой той»', () => {
    const tutorial = getTutorial('tutorial-ram-ram')!;
    const [s1] = play(tutorial);
    const first = s1.activated.filter((e) => e.wave === 1);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ effect: 'bigToi', tile: { special: 'RAM' }, partner: { special: 'RAM' } });
    expect(pos(first[0].center)).toEqual(pos(tutorial.steps[0].move.to));
  });

  it('tutorial-besh: step 1 cascades into BESH (wave 2); step 2 fires the pre-placed BESH on shelpek', () => {
    const tutorial = getTutorial('tutorial-besh')!;
    const [s1, s2] = play(tutorial);
    expect(s1.waves).toBe(2);
    expect(s1.created).toHaveLength(1);
    expect(s1.created[0]).toMatchObject({ wave: 2, shape: 'besh', tile: { special: 'BESH', base: null } });
    expect(pos(s1.created[0].tile.pos)).toEqual({ row: 7, col: 3 });
    expect(s1.activated).toEqual([]);
    expect(s1.state.goals[0].done).toBe(0);

    const [besh] = preplaced(tutorial, (t) => t === 'XX');
    const first = s2.activated.filter((e) => e.wave === 1 && e.tile.special === 'BESH');
    expect(first).toHaveLength(1);
    expect(first[0].effect).toBe('besh');
    expect(pos(first[0].center)).toEqual(pos(tutorial.steps[1].move.to));
    expect(first[0].targetTypes?.[0]).toBe('shelpek');
    expect(pos(besh)).toEqual(pos(tutorial.steps[1].move.from));
  });
});
