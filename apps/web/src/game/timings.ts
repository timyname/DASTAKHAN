import type { EffectKind } from '@dastakhan/game-core';

/** Animation timings in ms (prompt 03). All values are configurable here. */
export interface Timings {
  swap: number;
  reject: number;
  remove: number;
  fallBase: number;
  fallPerCell: number;
  fallMax: number;
  line: number;
  bomb: number;
  ram: number;
  bigToi: number;
  besh: number;
  convert: number;
  created: number;
  shuffle: number;
  none: number;
}

export const NORMAL_TIMINGS: Timings = {
  swap: 140,
  reject: 140,
  remove: 160,
  fallBase: 90,
  fallPerCell: 25,
  fallMax: 280,
  line: 240,
  bomb: 280,
  ram: 450,
  bigToi: 700,
  besh: 520,
  convert: 200,
  created: 120,
  shuffle: 320,
  none: 150,
};

/** Reduced motion: shorter, no travelling particles; short highlights are kept. */
export const REDUCED_TIMINGS: Timings = {
  swap: 110,
  reject: 110,
  remove: 120,
  fallBase: 110,
  fallPerCell: 0,
  fallMax: 110,
  line: 160,
  bomb: 160,
  ram: 220,
  bigToi: 280,
  besh: 240,
  convert: 120,
  created: 80,
  shuffle: 160,
  none: 120,
};

export function fallMs(t: Timings, cells: number): number {
  return Math.min(t.fallMax, t.fallBase + t.fallPerCell * Math.max(0, cells));
}

export function effectMs(t: Timings, kind: EffectKind): number {
  switch (kind) {
    case 'row':
    case 'col':
    case 'cross':
      return t.line;
    case 'square3':
    case 'square5':
    case 'wideCross':
      return t.bomb;
    case 'ramColor':
    case 'ramLine':
    case 'ramBomb':
      return t.ram;
    case 'bigToi':
      return t.bigToi;
    case 'besh':
      return t.besh;
    case 'none':
      return t.none;
  }
}
