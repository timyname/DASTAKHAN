import type { CSSProperties } from 'react';
import { BOARD_SIZE, type Pos } from '@dastakhan/game-core';
import type { SceneEffect } from './scene.ts';

const CELL = 100 / BOARD_SIZE;
const MAX_BEAMS = 48;
const PARTICLES = 24;

function fullLines(cells: Pos[]): { rows: number[]; cols: number[] } {
  const rowCount = new Map<number, number>();
  const colCount = new Map<number, number>();
  for (const c of cells) {
    rowCount.set(c.row, (rowCount.get(c.row) ?? 0) + 1);
    colCount.set(c.col, (colCount.get(c.col) ?? 0) + 1);
  }
  return {
    rows: [...rowCount].filter(([, n]) => n === BOARD_SIZE).map(([r]) => r),
    cols: [...colCount].filter(([, n]) => n === BOARD_SIZE).map(([c]) => c),
  };
}

function bounds(cells: Pos[]) {
  const rows = cells.map((c) => c.row);
  const cols = cells.map((c) => c.col);
  return { r0: Math.min(...rows), r1: Math.max(...rows), c0: Math.min(...cols), c1: Math.max(...cols) };
}

/** Centered 5×5 square, clipped (visual only; the engine supplies the real cells). */
function square5(center: Pos): Pos[] {
  const out: Pos[] = [];
  for (let r = center.row - 2; r <= center.row + 2; r++) {
    for (let c = center.col - 2; c <= center.col + 2; c++) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) out.push({ row: r, col: c });
    }
  }
  return out;
}

/** Deterministic pseudo-random for particle placement (purely visual). */
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function LineBands({ effect }: { effect: SceneEffect }) {
  const { rows, cols } = fullLines(effect.cells);
  const style = (extra: CSSProperties): CSSProperties => ({ ...extra, animationDuration: `${effect.ms}ms` });
  return (
    <>
      {rows.map((r) => (
        <div
          key={`r${r}`}
          className="fx-band fx-band-h"
          style={style({
            top: `${r * CELL}%`,
            height: `${CELL}%`,
            transformOrigin: `${(effect.center.col + 0.5) * CELL}% 50%`,
          })}
        />
      ))}
      {cols.map((c) => (
        <div
          key={`c${c}`}
          className="fx-band fx-band-v"
          style={style({
            left: `${c * CELL}%`,
            width: `${CELL}%`,
            transformOrigin: `50% ${(effect.center.row + 0.5) * CELL}%`,
          })}
        />
      ))}
    </>
  );
}

function AreaFlash({ effect }: { effect: SceneEffect }) {
  if (effect.cells.length === 0) return null;
  const b = bounds(effect.cells);
  return (
    <div
      className="fx-area"
      style={{
        top: `${b.r0 * CELL}%`,
        left: `${b.c0 * CELL}%`,
        height: `${(b.r1 - b.r0 + 1) * CELL}%`,
        width: `${(b.c1 - b.c0 + 1) * CELL}%`,
        animationDuration: `${effect.ms}ms`,
      }}
    />
  );
}

function CellGlows({ effect }: { effect: SceneEffect }) {
  return (
    <>
      {effect.cells.map((c) => (
        <div
          key={`${c.row}-${c.col}`}
          className="fx-cell"
          style={{
            top: `${c.row * CELL}%`,
            left: `${c.col * CELL}%`,
            width: `${CELL}%`,
            height: `${CELL}%`,
            animationDuration: `${effect.ms}ms`,
          }}
        />
      ))}
    </>
  );
}

function RamBeams({ effect }: { effect: SceneEffect }) {
  const cx = effect.center.col + 0.5;
  const cy = effect.center.row + 0.5;
  const targets = effect.cells.filter((c) => !(c.row === effect.center.row && c.col === effect.center.col)).slice(0, MAX_BEAMS);
  return (
    <svg className="fx-svg" viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`} preserveAspectRatio="none" aria-hidden="true">
      {targets.map((t, i) => {
        const tx = t.col + 0.5;
        const ty = t.row + 0.5;
        // Arc control point: perpendicular offset from the midpoint.
        const mx = (cx + tx) / 2 - (ty - cy) * 0.25;
        const my = (cy + ty) / 2 + (tx - cx) * 0.25;
        return (
          <path
            key={i}
            className="fx-beam"
            d={`M ${cx} ${cy} Q ${mx} ${my} ${tx} ${ty}`}
            pathLength={1}
            style={{ animationDuration: `${effect.ms}ms` }}
          />
        );
      })}
      <circle className="fx-wave" cx={cx} cy={cy} r={1.2} style={{ animationDuration: `${effect.ms}ms` }} />
    </svg>
  );
}

function BigToi({ effect, reducedMotion }: { effect: SceneEffect; reducedMotion: boolean }) {
  const cx = (effect.center.col + 0.5) * CELL;
  const cy = (effect.center.row + 0.5) * CELL;
  return (
    <>
      <div className="fx-ring" style={{ left: `${cx}%`, top: `${cy}%`, animationDuration: `${effect.ms}ms` }} />
      {!reducedMotion &&
        Array.from({ length: PARTICLES }, (_, i) => {
          const angle = (i / PARTICLES) * Math.PI * 2 + jitter(i) * 0.4;
          const dist = 30 + jitter(i + 99) * 45;
          return (
            <div
              key={i}
              className={`fx-spark fx-spark-${i % 3}`}
              style={
                {
                  left: `${cx}%`,
                  top: `${cy}%`,
                  animationDuration: `${effect.ms}ms`,
                  '--dx': `${Math.cos(angle) * dist}cqw`,
                  '--dy': `${Math.sin(angle) * dist}cqw`,
                } as CSSProperties
              }
            />
          );
        })}
    </>
  );
}

/** Effects layer. Never intercepts input (pointer-events: none in CSS). */
export function Effects({ effects, reducedMotion }: { effects: SceneEffect[]; reducedMotion: boolean }) {
  return (
    <div className="bd-effects" aria-hidden="true">
      {effects.map((e) => {
        switch (e.kind) {
          case 'row':
          case 'col':
          case 'cross':
          case 'wideCross':
            return <LineBands key={e.key} effect={e} />;
          case 'square3':
          case 'square5':
            return <AreaFlash key={e.key} effect={e} />;
          case 'ramColor':
          case 'ramLine':
          case 'ramBomb':
            return reducedMotion ? <CellGlows key={e.key} effect={e} /> : <RamBeams key={e.key} effect={e} />;
          case 'bigToi':
            return <BigToi key={e.key} effect={e} reducedMotion={reducedMotion} />;
          case 'besh':
            // «Дастархан для всех»: beams to every target plus the 5×5 platter wave.
            return reducedMotion ? (
              <CellGlows key={e.key} effect={e} />
            ) : (
              <span key={e.key}>
                <AreaFlash effect={{ ...e, cells: square5(e.center) }} />
                <RamBeams effect={e} />
              </span>
            );
          case 'none':
            return <CellGlows key={e.key} effect={{ ...e, cells: [e.center] }} />;
        }
      })}
    </div>
  );
}
