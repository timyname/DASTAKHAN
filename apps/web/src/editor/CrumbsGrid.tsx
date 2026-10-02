import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { BOARD_SIZE } from '@dastakhan/game-core';
import { CrumbsArt } from '../art/TileArt.tsx';

export type Brush = 0 | 1 | 2;

export interface CrumbsGridProps {
  hp: number[][];
  brush: Brush;
  onBrush(brush: Brush): void;
  onPaint(row: number, col: number): void;
}

/**
 * 11×11 crumbs painter: press and drag to paint with the current HP brush (pointer capture,
 * so touch works too). Cells are buttons for keyboard painting; keys 0/1/2 switch the brush.
 */
export function CrumbsGrid({ hp, brush, onBrush, onPaint }: CrumbsGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const painting = useRef(false);
  /** Last painted cell during a drag; fast moves are interpolated so no cell is skipped. */
  const last = useRef<{ row: number; col: number } | null>(null);

  const cellAt = (e: PointerEvent): { row: number; col: number } | null => {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * BOARD_SIZE);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * BOARD_SIZE);
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return { row, col };
  };

  const paintAt = (e: PointerEvent) => {
    const cell = cellAt(e);
    if (!cell) return;
    const from = last.current ?? cell;
    const steps = Math.max(Math.abs(cell.row - from.row), Math.abs(cell.col - from.col));
    for (let i = 1; i <= steps; i++) {
      onPaint(Math.round(from.row + ((cell.row - from.row) * i) / steps), Math.round(from.col + ((cell.col - from.col) * i) / steps));
    }
    if (steps === 0) onPaint(cell.row, cell.col);
    last.current = cell;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    painting.current = true;
    last.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    paintAt(e);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (painting.current) paintAt(e);
  };

  const stop = () => {
    painting.current = false;
    last.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === '0' || e.key === '1' || e.key === '2') {
      onBrush(Number(e.key) as Brush);
      e.preventDefault();
    }
  };

  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const value = hp[row]?.[col] ?? 0;
      cells.push(
        <button
          key={`${row}-${col}`}
          type="button"
          className={`ed-cell ${(row + col) % 2 === 0 ? 'ed-cell-a' : 'ed-cell-b'}`}
          data-hp={value}
          data-testid={`crumb-${row}-${col}`}
          aria-label={`row ${row}, col ${col}: HP ${value}`}
          onClick={(e) => {
            // Pointer painting already handled mouse/touch; this path is for the keyboard.
            if (e.detail === 0) onPaint(row, col);
          }}
        >
          <CrumbsArt hp={value} className="ed-cell-crumbs" />
          {value > 0 && <span className="ed-cell-hp">{value}</span>}
        </button>,
      );
    }
  }

  return (
    <div
      ref={ref}
      className="ed-grid"
      data-testid="crumbs-grid"
      data-brush={brush}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={onKeyDown}
    >
      {cells}
    </div>
  );
}
