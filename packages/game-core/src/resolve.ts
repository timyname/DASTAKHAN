/**
 * Cascade resolution after a legal swap (GAME_SPEC §3–§6).
 *
 * Per wave, events are emitted in this fixed order (renderer contract):
 *   cascadeStarted → matched? → (specialActivated | tilesConverted)* → cellsHit → obstacleDamaged?
 *   → tilesRemoved → specialCreated* → tilesFell → tilesSpawned
 *
 * Within a wave the working board is the pre-removal snapshot: activations only read it
 * (except RAM+LINE/RAM+BOMB conversions, which replace tiles in place with new ids);
 * removal, layer damage, special creation, gravity and refill are applied once at the end.
 */
import {
  RULE_LIMITS,
  SCORE_PER_OBSTACLE,
  SCORE_PER_PIECE,
  WAVE_MULTIPLIER_CAP,
  type EffectKind,
  type FoodType,
  type GameEvent,
  type GoalProgress,
  type MatchShape,
  type Move,
  type SpecialKind,
  type Tile,
  type TileRef,
} from './types.ts';
import {
  EngineError,
  assertFullBoard,
  cellAt,
  colOf,
  keyOfPos,
  keysToPositions,
  posOf,
  rowOf,
  setCell,
  sortKeys,
  tileAt,
  tileRef,
  type WorkBoard,
} from './board.ts';
import {
  allCells,
  beshEffect,
  cellsWithBase,
  isBasedSpecial,
  linePairEffect,
  mostFrequentBase,
  singleEffect,
} from './effects.ts';
import { applyGravity, refill } from './gravity.ts';
import { findComponents, specialForShape, type MatchComponent } from './match.ts';
import type { SwapKind } from './moves.ts';
import type { Rng } from './rng.ts';

/** Mutable resolution context; owned by one applyMove call. */
export interface ResolveContext {
  board: WorkBoard;
  layers: number[][];
  goals: GoalProgress[];
  allowedTypes: readonly FoodType[];
  rng: Rng;
  ids: { next: number };
  score: number;
  events: GameEvent[];
}

interface Creation {
  key: number;
  kind: SpecialKind;
  base: FoodType;
  shape: MatchShape;
}

/**
 * Resolves all waves after the swap has been applied to ctx.board.
 * Wave 1 of a 'pair', 'ramFood' or 'besh' swap applies only that effect; every other wave detects matches.
 * Throws EngineError on cascade overflow or invariant failure.
 */
export function resolveCascade(ctx: ResolveContext, move: Move, swapKind: SwapKind): void {
  for (let wave = 1; ; wave++) {
    const swapWave = wave === 1 && swapKind !== 'match';
    const components = swapWave ? [] : findComponents(ctx.board);
    if (!swapWave && components.length === 0) {
      if (wave === 1) throw new EngineError('Legal swap produced no match');
      return;
    }
    if (wave > RULE_LIMITS.maxCascadeWaves) {
      throw new EngineError(`Cascade exceeded ${RULE_LIMITS.maxCascadeWaves} waves`);
    }
    runWave(ctx, wave, components, swapWave ? swapKind : null, move);
  }
}

/** Activation queue for one wave: pops the smallest (row, col, tileId); each special activates at most once. */
class WaveActivations {
  /** Union of every cell directly affected by an activation in this wave. */
  readonly affected = new Set<number>();
  private readonly queue: { key: number; id: number }[] = [];
  /** Tile ids queued, activated, or consumed by a pair/RAM swap this wave. */
  private readonly seen = new Set<number>();
  private readonly ctx: ResolveContext;
  private readonly wave: number;

  constructor(ctx: ResolveContext, wave: number) {
    this.ctx = ctx;
    this.wave = wave;
  }

  /** Marks a tile as processed without queueing it (pair tiles, RAM in a RAM+food swap). */
  consume(tile: Tile): void {
    this.seen.add(tile.id);
  }

  /** Queues the special at `key` unless it already activated or is queued this wave. */
  enqueue(key: number): void {
    const tile = cellAt(this.ctx.board, key);
    if (!tile || tile.special === null || this.seen.has(tile.id)) return;
    this.seen.add(tile.id);
    this.queue.push({ key, id: tile.id });
  }

  /** Records affected cells and queues any specials standing on them. */
  hit(cells: readonly number[]): void {
    for (const key of cells) {
      this.affected.add(key);
      this.enqueue(key);
    }
  }

  /** Records affected cells without triggering specials there (RAM+RAM absorption). */
  absorb(cells: readonly number[]): void {
    for (const key of cells) this.affected.add(key);
  }

  emitActivation(
    tile: TileRef,
    effect: EffectKind,
    center: number,
    cells: readonly number[],
    extra: { partner?: TileRef; targetType?: FoodType; targetTypes?: FoodType[] } = {},
  ): void {
    const event: Extract<GameEvent, { type: 'specialActivated' }> = {
      type: 'specialActivated',
      wave: this.wave,
      tile,
      effect,
      center: posOf(center),
      cells: keysToPositions(cells),
    };
    if (extra.partner) event.partner = extra.partner;
    if (extra.targetType) event.targetType = extra.targetType;
    if (extra.targetTypes) event.targetTypes = extra.targetTypes;
    this.ctx.events.push(event);
  }

  /** Processes the queue until empty. */
  drain(): void {
    while (this.queue.length > 0) {
      let best = 0;
      for (let i = 1; i < this.queue.length; i++) {
        const a = this.queue[i];
        const b = this.queue[best];
        if (a.key < b.key || (a.key === b.key && a.id < b.id)) best = i;
      }
      const [item] = this.queue.splice(best, 1);
      this.activate(item.key, item.id);
    }
  }

  private activate(key: number, id: number): void {
    const board = this.ctx.board;
    const tile = tileAt(board, key);
    if (tile.id !== id || tile.special === null) throw new EngineError(`Queued special ${id} is no longer at its cell`);
    const ref = tileRef(tile, key);
    if (tile.special === 'RAM') {
      const target = mostFrequentBase(board);
      if (target === null) {
        this.emitActivation(ref, 'none', key, [key]);
        this.hit([key]);
        return;
      }
      const cells = sortKeys([key, ...cellsWithBase(board, target)]);
      this.emitActivation(ref, 'ramColor', key, cells, { targetType: target });
      this.hit(cells);
      return;
    }
    if (tile.special === 'BESH') {
      this.activateBesh(tile, key);
      return;
    }
    const { effect, cells } = singleEffect(tile.special, posOf(key));
    this.emitActivation(ref, effect, key, cells);
    this.hit(cells);
  }

  /** BESH «Дастархан для всех» at `key` (its post-swap or current position). */
  private activateBesh(besh: Tile, key: number): void {
    const { targetTypes, cells } = beshEffect(this.ctx.board, posOf(key));
    this.emitActivation(tileRef(besh, key), 'besh', key, cells, { targetTypes });
    this.hit(cells);
  }

  /** BESH + ordinary food, LINE or BOMB: only the BESH effect; the partner is hit by it. */
  runBesh(move: Move): void {
    const board = this.ctx.board;
    const toKey = keyOfPos(move.to);
    const beshKey = tileAt(board, toKey).special === 'BESH' ? toKey : keyOfPos(move.from);
    const besh = tileAt(board, beshKey);
    if (besh.special !== 'BESH') throw new EngineError('Invalid BESH swap');
    this.consume(besh);
    this.activateBesh(besh, beshKey);
  }

  /** RAM + ordinary food: RAM consumed, every tile with the food's base is hit. */
  runRamFood(move: Move): void {
    const board = this.ctx.board;
    const fromKey = keyOfPos(move.from);
    const toKey = keyOfPos(move.to);
    const ramKey = tileAt(board, toKey).special === 'RAM' ? toKey : fromKey;
    const foodKey = ramKey === toKey ? fromKey : toKey;
    const ram = tileAt(board, ramKey);
    const food = tileAt(board, foodKey);
    if (ram.special !== 'RAM' || food.special !== null || food.base === null) {
      throw new EngineError('Invalid RAM + food swap');
    }
    this.consume(ram);
    const target = food.base;
    const cells = sortKeys([ramKey, ...cellsWithBase(board, target)]);
    this.emitActivation(tileRef(ram, ramKey), 'ramColor', ramKey, cells, { targetType: target });
    this.hit(cells);
  }

  /** Special pair: the pair effect replaces both individual activations. Center = move.to. */
  runPair(move: Move): void {
    const board = this.ctx.board;
    const centerKey = keyOfPos(move.to);
    const partnerKey = keyOfPos(move.from);
    const tile = tileAt(board, centerKey);
    const partner = tileAt(board, partnerKey);
    if (tile.special === null || partner.special === null) throw new EngineError('Invalid special pair');
    this.consume(tile);
    this.consume(partner);
    const tileRefAtCenter = tileRef(tile, centerKey);
    const partnerRef = tileRef(partner, partnerKey);

    const universal = (t: Tile) => t.special === 'RAM' || t.special === 'BESH';
    if (universal(tile) && universal(partner)) {
      // «Большой той» (RAM+RAM, BESH+RAM, BESH+BESH): everything removed, other specials absorbed.
      const cells = allCells();
      this.emitActivation(tileRefAtCenter, 'bigToi', centerKey, cells, { partner: partnerRef });
      this.absorb(cells);
      return;
    }

    if (tile.special === 'RAM' || partner.special === 'RAM') {
      const other = tile.special === 'RAM' ? partner : tile;
      const target = other.base;
      const convertTo = other.special;
      if (target === null || !isBasedSpecial(convertTo)) throw new EngineError('Invalid RAM pair');
      // Snapshot of the pre-removal board, row-major.
      const ordinaryKeys: number[] = [];
      const specialKeys: number[] = [];
      for (const key of cellsWithBase(board, target)) {
        const t = tileAt(board, key);
        if (t.special === null) ordinaryKeys.push(key);
        else if (t.id !== tile.id && t.id !== partner.id) specialKeys.push(key);
      }
      const conversions: { fromTileId: number; tile: TileRef }[] = [];
      for (const key of ordinaryKeys) {
        const original = tileAt(board, key);
        const converted: Tile = { id: this.ctx.ids.next++, base: target, special: convertTo };
        setCell(board, key, converted);
        conversions.push({ fromTileId: original.id, tile: tileRef(converted, key) });
      }
      const cells = sortKeys([centerKey, partnerKey, ...ordinaryKeys, ...specialKeys]);
      this.emitActivation(tileRefAtCenter, convertTo === 'BOMB' ? 'ramBomb' : 'ramLine', centerKey, cells, {
        partner: partnerRef,
        targetType: target,
      });
      if (conversions.length > 0) {
        this.ctx.events.push({ type: 'tilesConverted', wave: this.wave, conversions });
      }
      // Converted tiles and existing specials of that base are queued; the pair tiles are consumed.
      this.hit(cells);
      return;
    }

    if (!isBasedSpecial(tile.special) || !isBasedSpecial(partner.special)) {
      throw new EngineError('BESH pairs with LINE/BOMB resolve as a BESH swap, not a pair');
    }
    const { effect, cells } = linePairEffect(tile.special, partner.special, posOf(centerKey));
    this.emitActivation(tileRefAtCenter, effect, centerKey, cells, { partner: partnerRef });
    this.hit(cells);
  }
}

/** Creation cell: move.to if in the component, else move.from, else greatest row then smallest col. */
function creationCell(component: MatchComponent, move: Move | null): number {
  if (move) {
    const toKey = keyOfPos(move.to);
    if (component.cells.includes(toKey)) return toKey;
    const fromKey = keyOfPos(move.from);
    if (component.cells.includes(fromKey)) return fromKey;
  }
  let best = component.cells[0];
  for (const key of component.cells) {
    if (rowOf(key) > rowOf(best) || (rowOf(key) === rowOf(best) && colOf(key) < colOf(best))) best = key;
  }
  return best;
}

function runWave(
  ctx: ResolveContext,
  wave: number,
  components: MatchComponent[],
  swapEffect: Exclude<SwapKind, 'match'> | null,
  move: Move,
): void {
  const { board, events } = ctx;
  const multiplier = Math.min(wave, WAVE_MULTIPLIER_CAP);
  events.push({ type: 'cascadeStarted', wave, multiplier });

  const activations = new WaveActivations(ctx, wave);
  const componentCells = new Set<number>();
  const creations: Creation[] = [];

  if (components.length > 0) {
    events.push({
      type: 'matched',
      wave,
      groups: components.map((component) => ({
        shape: component.shape,
        base: component.base,
        cells: component.cells.map(posOf),
        tileIds: component.cells.map((key) => tileAt(board, key).id),
      })),
    });
    // Only wave 1 of an ordinary swap uses the move for the creation cell.
    const creationMove = wave === 1 ? move : null;
    for (const component of components) {
      for (const key of component.cells) componentCells.add(key);
      const specialKeys = component.cells.filter((key) => tileAt(board, key).special !== null);
      if (specialKeys.length > 0) {
        // Existing specials activate; the component creates no new special.
        for (const key of specialKeys) activations.enqueue(key);
        continue;
      }
      const kind = specialForShape(component.shape);
      if (kind) {
        creations.push({ key: creationCell(component, creationMove), kind, base: component.base, shape: component.shape });
      }
    }
  }

  if (swapEffect === 'pair') activations.runPair(move);
  else if (swapEffect === 'ramFood') activations.runRamFood(move);
  else if (swapEffect === 'besh') activations.runBesh(move);
  activations.drain();

  // Removal and damage sets. Creation cells are protected: never removed this wave; their layer
  // is damaged only when an activation (independent blast) affects the cell.
  const creationKeys = new Set(creations.map((creation) => creation.key));
  const removal = new Set<number>();
  for (const key of componentCells) if (!creationKeys.has(key)) removal.add(key);
  for (const key of activations.affected) if (!creationKeys.has(key)) removal.add(key);
  const damage = new Set<number>(removal);
  for (const key of activations.affected) damage.add(key);

  events.push({ type: 'cellsHit', wave, cells: keysToPositions(damage) });

  // Layers: at most 1 HP per cell per wave.
  const damaged: { pos: { row: number; col: number }; hp: number; destroyed: boolean }[] = [];
  let destroyed = 0;
  for (const key of sortKeys(damage)) {
    const row = rowOf(key);
    const col = colOf(key);
    const hp = ctx.layers[row][col];
    if (hp <= 0) continue;
    const left = hp - 1;
    ctx.layers[row][col] = left;
    damaged.push({ pos: { row, col }, hp: left, destroyed: left === 0 });
    if (left === 0) destroyed++;
  }
  if (damaged.length > 0) events.push({ type: 'obstacleDamaged', wave, cells: damaged });

  // Removal, score and collection.
  const removed: TileRef[] = [];
  const collected = new Map<FoodType, number>();
  for (const key of sortKeys(removal)) {
    const tile = tileAt(board, key);
    removed.push(tileRef(tile, key));
    if (tile.base !== null) collected.set(tile.base, (collected.get(tile.base) ?? 0) + 1);
    setCell(board, key, null);
  }
  const scoreDelta = (SCORE_PER_PIECE * removed.length + SCORE_PER_OBSTACLE * destroyed) * multiplier;
  ctx.score += scoreDelta;
  for (const goal of ctx.goals) {
    const gained = goal.kind === 'collect' ? (collected.get(goal.type) ?? 0) : destroyed;
    goal.done = Math.min(goal.count, goal.done + gained);
  }
  events.push({ type: 'tilesRemoved', wave, tiles: removed, scoreDelta, multiplier });

  // New specials replace the retained tile at the creation cell (not removed/scored/collected).
  creations.sort((a, b) => a.key - b.key);
  for (const creation of creations) {
    const replaced = tileAt(board, creation.key);
    if (replaced.special !== null) throw new EngineError('Creation cell holds a special');
    const created: Tile = {
      id: ctx.ids.next++,
      base: creation.kind === 'RAM' || creation.kind === 'BESH' ? null : creation.base,
      special: creation.kind,
    };
    setCell(board, creation.key, created);
    events.push({
      type: 'specialCreated',
      wave,
      tile: tileRef(created, creation.key),
      shape: creation.shape,
      fromTileId: replaced.id,
    });
  }

  events.push({ type: 'tilesFell', wave, moves: applyGravity(board) });
  events.push({ type: 'tilesSpawned', wave, tiles: refill(board, ctx.rng, ctx.allowedTypes, ctx.ids) });
  assertFullBoard(board);
}
