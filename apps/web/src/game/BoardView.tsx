import { memo, useMemo, useRef } from 'react';
import { BOARD_SIZE, type FoodType, type Move, type Pos, type SpecialKind } from '@dastakhan/game-core';
import { CrumbsArt, TileArt } from '../art/TileArt.tsx';
import { Effects } from './Effects.tsx';
import type { Scene, SceneTile } from './scene.ts';
import { useBoardInput } from './useBoardInput.ts';
import './board.css';

export interface BoardViewProps {
  scene: Scene;
  interactive: boolean;
  selected: Pos | null;
  cursor: Pos | null;
  /** Idle hint (pulsing). */
  hint: Move | null;
  /** Tutorial-required move (strong highlight). */
  guide: Move | null;
  reducedMotion: boolean;
  ariaLabel: string;
  labelFor(base: FoodType | null, special: SpecialKind | null): string;
  onSelect(pos: Pos | null): void;
  onSwap(move: Move): void;
  onCursor(pos: Pos): void;
  onActivity?(): void;
}

const TileView = memo(function TileView({ tile, label }: { tile: SceneTile; label: string }) {
  return (
    <div
      className={`bd-tile bd-fx-${tile.fx}`}
      data-tile-id={tile.id}
      data-row={tile.row}
      data-col={tile.col}
      data-base={tile.base ?? 'none'}
      data-special={tile.special ?? 'none'}
      style={{
        transform: `translate(${tile.col * 100}%, ${tile.row * 100}%)`,
        transitionDuration: `${tile.moveMs}ms`,
      }}
    >
      <div className="bd-tile-inner">
        <TileArt base={tile.base} special={tile.special} label={label} className="bd-art" />
      </div>
    </div>
  );
});

function Marker({ pos, kind }: { pos: Pos; kind: 'selected' | 'cursor' | 'hint' | 'guide' }) {
  return (
    <div
      className={`bd-marker bd-marker-${kind}`}
      style={{ transform: `translate(${pos.col * 100}%, ${pos.row * 100}%)` }}
      aria-hidden="true"
    />
  );
}

/**
 * Renders the 11×11 board: stationary cells with crumbs layers, 121 tiles keyed by
 * stable tile id (transform/opacity animations only), markers and an effects layer.
 */
export function BoardView(props: BoardViewProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const handlers = useBoardInput(boardRef, props);
  const { scene } = props;

  const cells = useMemo(() => {
    const out = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const hp = scene.layers[row]?.[col] ?? 0;
        out.push(
          <div
            key={`${row}-${col}`}
            className={`bd-cell ${(row + col) % 2 === 0 ? 'bd-cell-a' : 'bd-cell-b'}`}
            data-hp={hp}
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
          >
            <CrumbsArt hp={hp} className="bd-crumbs" />
          </div>,
        );
      }
    }
    return out;
  }, [scene.layers]);

  const tiles = useMemo(() => [...scene.tiles.values()].sort((a, b) => a.id - b.id), [scene.tiles]);

  return (
    <div
      ref={boardRef}
      className={`bd-board${props.interactive ? '' : ' bd-locked'}`}
      data-testid="board"
      data-interactive={props.interactive}
      role="application"
      aria-roledescription="игровое поле"
      aria-label={props.ariaLabel}
      tabIndex={0}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      onKeyDown={handlers.onKeyDown}
    >
      <div className="bd-cells">{cells}</div>
      <div className="bd-markers">
        {props.guide && (
          <>
            <Marker pos={props.guide.from} kind="guide" />
            <Marker pos={props.guide.to} kind="guide" />
          </>
        )}
        {props.hint && !props.guide && (
          <>
            <Marker pos={props.hint.from} kind="hint" />
            <Marker pos={props.hint.to} kind="hint" />
          </>
        )}
      </div>
      <div className="bd-tiles">
        {tiles.map((t) => (
          <TileView key={t.id} tile={t} label={props.labelFor(t.base, t.special)} />
        ))}
      </div>
      <div className="bd-markers bd-markers-top">
        {props.cursor && <Marker pos={props.cursor} kind="cursor" />}
        {props.selected && <Marker pos={props.selected} kind="selected" />}
      </div>
      <Effects effects={scene.effects} reducedMotion={props.reducedMotion} />
    </div>
  );
}
