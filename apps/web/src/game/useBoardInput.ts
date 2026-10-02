import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { BOARD_SIZE, type Move, type Pos } from '@dastakhan/game-core';
import { isAdjacent, samePos } from './scene.ts';

export interface BoardInputOptions {
  interactive: boolean;
  selected: Pos | null;
  cursor: Pos | null;
  onSelect(pos: Pos | null): void;
  onSwap(move: Move): void;
  onCursor(pos: Pos): void;
  /** Any user interaction (resets the hint timer, unlocks audio). */
  onActivity?(): void;
}

interface Gesture {
  pointerId: number;
  start: Pos;
  x0: number;
  y0: number;
  consumed: boolean;
}

/** Swipe threshold as a fraction of the cell pitch (prompt 03). */
export const SWIPE_THRESHOLD = 0.25;

function inBounds(p: Pos): boolean {
  return p.row >= 0 && p.row < BOARD_SIZE && p.col >= 0 && p.col < BOARD_SIZE;
}

/**
 * Pointer (swipe + tap-first/tap-neighbour) and keyboard input for the board.
 * One gesture produces at most one swap; additional pointers are ignored.
 */
export function useBoardInput(boardRef: RefObject<HTMLElement | null>, options: BoardInputOptions) {
  const opts = useRef(options);
  opts.current = options;
  const gesture = useRef<Gesture | null>(null);

  // Drop an in-flight gesture when input gets locked (e.g. animation started).
  useEffect(() => {
    if (!options.interactive) gesture.current = null;
  }, [options.interactive]);

  const cellAt = useCallback(
    (clientX: number, clientY: number): Pos | null => {
      const el = boardRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const pitch = r.width / BOARD_SIZE;
      const pos = { row: Math.floor((clientY - r.top) / pitch), col: Math.floor((clientX - r.left) / pitch) };
      return inBounds(pos) ? pos : null;
    },
    [boardRef],
  );

  const tap = useCallback((pos: Pos) => {
    const o = opts.current;
    if (!o.interactive) return;
    o.onCursor(pos);
    if (!o.selected) {
      o.onSelect(pos);
    } else if (samePos(o.selected, pos)) {
      o.onSelect(null);
    } else if (isAdjacent(o.selected, pos)) {
      const from = o.selected;
      o.onSelect(null);
      o.onSwap({ from, to: pos });
    } else {
      o.onSelect(pos);
    }
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      opts.current.onActivity?.();
      if (!opts.current.interactive || gesture.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const start = cellAt(e.clientX, e.clientY);
      if (!start) return;
      gesture.current = { pointerId: e.pointerId, start, x0: e.clientX, y0: e.clientY, consumed: false };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best effort */
      }
    },
    [cellAt],
  );

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    const el = boardRef.current;
    if (!g || g.pointerId !== e.pointerId || g.consumed || !el) return;
    const pitch = el.getBoundingClientRect().width / BOARD_SIZE;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD * pitch) return;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const to = horizontal
      ? { row: g.start.row, col: g.start.col + Math.sign(dx) }
      : { row: g.start.row + Math.sign(dy), col: g.start.col };
    g.consumed = true;
    const o = opts.current;
    if (!o.interactive || !inBounds(to)) return;
    o.onSelect(null);
    o.onCursor(to);
    o.onSwap({ from: g.start, to });
  }, [boardRef]);

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      gesture.current = null;
      if (!g.consumed) tap(g.start);
    },
    [tap],
  );

  const onPointerCancel = useCallback((e: PointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId === e.pointerId) gesture.current = null;
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const o = opts.current;
      o.onActivity?.();
      const cur = o.cursor ?? { row: 5, col: 5 };
      const moves: Record<string, Pos> = {
        ArrowUp: { row: cur.row - 1, col: cur.col },
        ArrowDown: { row: cur.row + 1, col: cur.col },
        ArrowLeft: { row: cur.row, col: cur.col - 1 },
        ArrowRight: { row: cur.row, col: cur.col + 1 },
      };
      const next = moves[e.key];
      if (next) {
        e.preventDefault();
        o.onCursor(inBounds(next) ? next : cur);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!o.cursor) o.onCursor(cur);
        else tap(cur);
        return;
      }
      if (e.key === 'Escape' && o.selected) {
        e.preventDefault();
        e.stopPropagation();
        o.onSelect(null);
      }
    },
    [tap],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown };
}
