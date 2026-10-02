import type { EffectKind, GameEvent, Pos } from '@dastakhan/game-core';
import { cloneScene, sceneTileFromTile, tileAt, type Scene, type SceneEffect } from './scene.ts';
import { effectMs, fallMs, type Timings } from './timings.ts';
import type { SfxName } from '../audio/sfx.ts';

export type { SfxName };

/** Short banners shown under the board for big moments. */
export type Banner = 'bigToi' | 'besh' | 'shuffle';

export interface PlayerApi {
  getScene(): Scene;
  setScene(scene: Scene): void;
  timings: Timings;
  sfx(name: SfxName): void;
  onWave?(wave: number, multiplier: number): void;
  onScoreDelta?(delta: number): void;
  onBanner?(banner: Banner): void;
  /** True when remaining animations must be skipped (tab hidden, unmounted, restarted). */
  skip(): boolean;
}

let effectKeySeq = 1;

function sleep(ms: number, api: PlayerApi): Promise<void> {
  if (api.skip() || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits until the browser has painted the current scene (bounded, works in hidden tabs). */
function nextPaint(api: PlayerApi): Promise<void> {
  if (api.skip()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 60);
  });
}

function update(api: PlayerApi, fn: (draft: Scene) => void): void {
  const draft = cloneScene(api.getScene());
  fn(draft);
  api.setScene(draft);
}

function sfxForEffect(kind: EffectKind): SfxName {
  switch (kind) {
    case 'row':
    case 'col':
    case 'cross':
      return 'line';
    case 'square3':
    case 'square5':
    case 'wideCross':
      return 'bomb';
    case 'ramColor':
    case 'ramLine':
    case 'ramBomb':
      return 'ram';
    case 'bigToi':
      return 'bigToi';
    case 'besh':
      return 'besh';
    case 'none':
      return 'special';
  }
}

async function playSwap(from: Pos, to: Pos, api: PlayerApi, rejected: boolean): Promise<void> {
  const scene = api.getScene();
  const a = tileAt(scene, from);
  const b = tileAt(scene, to);
  if (!a || !b) return;
  const ms = api.timings.swap;
  update(api, (s) => {
    const ta = s.tiles.get(a.id)!;
    const tb = s.tiles.get(b.id)!;
    ta.row = to.row;
    ta.col = to.col;
    ta.moveMs = ms;
    tb.row = from.row;
    tb.col = from.col;
    tb.moveMs = ms;
  });
  api.sfx(rejected ? 'reject' : 'swap');
  await sleep(ms, api);
  if (!rejected) return;
  const back = api.timings.reject;
  update(api, (s) => {
    const ta = s.tiles.get(a.id)!;
    const tb = s.tiles.get(b.id)!;
    ta.row = from.row;
    ta.col = from.col;
    ta.moveMs = back;
    tb.row = to.row;
    tb.col = to.col;
    tb.moveMs = back;
  });
  await sleep(back, api);
}

type ActivationEvent = Extract<GameEvent, { type: 'specialActivated' }>;
type ConversionEvent = Extract<GameEvent, { type: 'tilesConverted' }>;

async function playEffects(activations: ActivationEvent[], api: PlayerApi): Promise<void> {
  if (activations.length === 0) return;
  const added: SceneEffect[] = activations.map((ev) => ({
    key: effectKeySeq++,
    kind: ev.effect,
    center: ev.center,
    cells: ev.cells,
    ms: effectMs(api.timings, ev.effect),
  }));
  const sounds = new Set(activations.map((ev) => sfxForEffect(ev.effect)));
  for (const ev of activations) {
    if (ev.effect === 'bigToi' || ev.effect === 'besh') api.onBanner?.(ev.effect);
  }
  sounds.forEach((name) => api.sfx(name));
  update(api, (s) => {
    s.effects.push(...added);
  });
  // Effects inside one wave run in parallel: wait for the longest only.
  await sleep(Math.max(...added.map((e) => e.ms)), api);
  const keys = new Set(added.map((e) => e.key));
  update(api, (s) => {
    s.effects = s.effects.filter((e) => !keys.has(e.key));
  });
}

function applyConversions(conversions: ConversionEvent[], api: PlayerApi): void {
  update(api, (s) => {
    for (const ev of conversions) {
      for (const c of ev.conversions) {
        s.tiles.delete(c.fromTileId);
        s.tiles.set(
          c.tile.tileId,
          sceneTileFromTile(
            { id: c.tile.tileId, base: c.tile.base, special: c.tile.special },
            c.tile.pos.row,
            c.tile.pos.col,
            'converted',
          ),
        );
      }
    }
  });
}

/** Plays a run of specialActivated / tilesConverted events of one wave. */
async function playActivations(batch: GameEvent[], api: PlayerApi): Promise<void> {
  const firstConversion = batch.findIndex((e) => e.type === 'tilesConverted');
  if (firstConversion < 0) {
    await playEffects(batch as ActivationEvent[], api);
    return;
  }
  // RAM beams first, then the converted pieces appear, then their own blasts.
  const before = batch.slice(0, firstConversion).filter((e): e is ActivationEvent => e.type === 'specialActivated');
  const conversions = batch.filter((e): e is ConversionEvent => e.type === 'tilesConverted');
  const after = batch.slice(firstConversion).filter((e): e is ActivationEvent => e.type === 'specialActivated');
  await playEffects(before, api);
  applyConversions(conversions, api);
  await sleep(api.timings.convert, api);
  await playEffects(after, api);
}

async function playFall(
  fell: Extract<GameEvent, { type: 'tilesFell' }> | null,
  spawned: Extract<GameEvent, { type: 'tilesSpawned' }> | null,
  api: PlayerApi,
): Promise<void> {
  const t = api.timings;
  let longest = 0;
  // 1. Put spawned tiles above the board without a transition.
  if (spawned && spawned.tiles.length > 0) {
    update(api, (s) => {
      for (const sp of spawned.tiles) {
        const tile = sceneTileFromTile(
          { id: sp.tile.tileId, base: sp.tile.base, special: sp.tile.special },
          sp.fromRow,
          sp.tile.pos.col,
        );
        s.tiles.set(tile.id, tile);
      }
    });
    await nextPaint(api);
  }
  // 2. Move falling and spawned tiles to their targets together.
  update(api, (s) => {
    for (const m of fell?.moves ?? []) {
      const tile = s.tiles.get(m.tileId);
      if (!tile) continue;
      const ms = fallMs(t, m.to.row - m.from.row);
      longest = Math.max(longest, ms);
      tile.row = m.to.row;
      tile.col = m.to.col;
      tile.moveMs = ms;
      tile.fx = 'none';
    }
    for (const sp of spawned?.tiles ?? []) {
      const tile = s.tiles.get(sp.tile.tileId);
      if (!tile) continue;
      const ms = fallMs(t, sp.tile.pos.row - sp.fromRow);
      longest = Math.max(longest, ms);
      tile.row = sp.tile.pos.row;
      tile.col = sp.tile.pos.col;
      tile.moveMs = ms;
    }
  });
  await sleep(longest, api);
}

/**
 * Plays the ordered engine events of one move. Game rules are never evaluated here;
 * the caller rebuilds the scene from the stable engine state afterwards.
 */
export async function playEvents(events: readonly GameEvent[], api: PlayerApi): Promise<void> {
  let i = 0;
  while (i < events.length) {
    if (api.skip()) return;
    const ev = events[i]!;
    switch (ev.type) {
      case 'swap':
        await playSwap(ev.from, ev.to, api, false);
        i++;
        break;
      case 'swapRejected':
        await playSwap(ev.from, ev.to, api, true);
        i++;
        break;
      case 'cascadeStarted':
        api.onWave?.(ev.wave, ev.multiplier);
        i++;
        break;
      case 'matched':
        api.sfx('match');
        i++;
        break;
      case 'specialActivated':
      case 'tilesConverted': {
        let j = i;
        while (j < events.length && (events[j]!.type === 'specialActivated' || events[j]!.type === 'tilesConverted')) j++;
        await playActivations(events.slice(i, j), api);
        i = j;
        break;
      }
      case 'obstacleDamaged':
        update(api, (s) => {
          for (const c of ev.cells) s.layers[c.pos.row]![c.pos.col] = c.hp;
        });
        i++;
        break;
      case 'tilesRemoved': {
        const ids = new Set(ev.tiles.map((t) => t.tileId));
        update(api, (s) => {
          for (const id of ids) {
            const tile = s.tiles.get(id);
            if (tile) tile.fx = 'removing';
          }
        });
        api.onScoreDelta?.(ev.scoreDelta);
        await sleep(api.timings.remove, api);
        update(api, (s) => {
          for (const id of ids) s.tiles.delete(id);
        });
        i++;
        break;
      }
      case 'specialCreated':
        update(api, (s) => {
          s.tiles.delete(ev.fromTileId);
          s.tiles.set(
            ev.tile.tileId,
            sceneTileFromTile(
              { id: ev.tile.tileId, base: ev.tile.base, special: ev.tile.special },
              ev.tile.pos.row,
              ev.tile.pos.col,
              'created',
            ),
          );
        });
        api.sfx('special');
        await sleep(api.timings.created, api);
        i++;
        break;
      case 'tilesFell': {
        const next = events[i + 1];
        const spawned = next && next.type === 'tilesSpawned' && next.wave === ev.wave ? next : null;
        await playFall(ev, spawned, api);
        i += spawned ? 2 : 1;
        break;
      }
      case 'tilesSpawned':
        await playFall(null, ev, api);
        i++;
        break;
      case 'shuffled': {
        const ms = api.timings.shuffle;
        api.onBanner?.('shuffle');
        update(api, (s) => {
          const keep = new Set<number>();
          ev.board.forEach((rowTiles, row) =>
            rowTiles.forEach((tile, col) => {
              keep.add(tile.id);
              const existing = s.tiles.get(tile.id);
              if (existing) {
                existing.row = row;
                existing.col = col;
                existing.moveMs = ms;
                existing.fx = 'none';
              } else {
                s.tiles.set(tile.id, sceneTileFromTile(tile, row, col, 'created'));
              }
            }),
          );
          for (const id of [...s.tiles.keys()]) if (!keep.has(id)) s.tiles.delete(id);
        });
        await sleep(ms, api);
        i++;
        break;
      }
      default:
        // goalsUpdated / gameWon / gameLost / technicalError / cellsHit are handled by the controller.
        i++;
    }
  }
}
