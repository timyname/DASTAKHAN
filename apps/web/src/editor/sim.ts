/**
 * Balance simulation bot core (prompt 06). Pure and deterministic: no DOM, timers,
 * storage, Date.now or Math.random. Shared by the Node script `scripts/simulate.ts`
 * and the dev-only level editor (apps/web/editor.html).
 *
 * Bot results are technical signals (crashes, shuffle frequency, rough difficulty
 * ordering), not predictions of human success rates. Nothing here edits levels.
 *
 * Bot v1 policy ("greedy-1ply-v1", the default): for every legal move from getLegalMoves(),
 * resolve it with applyMove() and score the outcome with BOT_V1_WEIGHTS (goal progress
 * weighted highest, then specials created/activated, then crumbs damage, then score delta).
 * The highest value wins; ties keep the earliest move in getLegalMoves() order.
 * Because applyMove() resolves the full cascade including seeded refills, the bot sees
 * refill outcomes a human cannot see; it also never plans more than one move ahead.
 *
 * Supplementary variant "greedy-visible-v1": same weights and tie-break, but a move is
 * scored only from its wave-1 events (the swap's own matches/activations, before gravity
 * and refill) — closer to the information a human player has. Both are deterministic.
 */
import {
  applyMove,
  createGame,
  getLegalMoves,
  type GameEvent,
  type GameState,
  type GoalProgress,
  type LevelDefinition,
  type Move,
  type SpecialKind,
} from '@dastakhan/game-core';

/** Bot policies: full-cascade lookahead (default, bot v1) and the wave-1-only variant. */
export const BOT_POLICIES = ['greedy-1ply-v1', 'greedy-visible-v1'] as const;
export type BotPolicy = (typeof BOT_POLICIES)[number];
/** Default bot version recorded in reports. */
export const BOT_VERSION: BotPolicy = 'greedy-1ply-v1';

export const SPECIAL_KINDS: readonly SpecialKind[] = ['LINE_H', 'LINE_V', 'BOMB', 'RAM', 'BESH'];

/** Integer weights of bot v1. Goal progress has the highest per-unit weight. */
export const BOT_V1_WEIGHTS = {
  /** Added when the move wins the level. */
  win: 1_000_000_000,
  /** Per collected piece / fully cleared crumb cell that counts toward an unfinished goal. */
  goalUnit: 10_000,
  /** Per special created during the move's cascade, by kind. */
  created: { LINE_H: 3_000, LINE_V: 3_000, BOMB: 4_000, RAM: 6_000, BESH: 7_000 } as Record<SpecialKind, number>,
  /** Per specialActivated event (a pair effect counts once). */
  activation: 1_000,
  /** Per crumb cell fully destroyed. */
  crumbDestroyed: 2_000,
  /** Per crumb cell damaged but not destroyed (HP2 → HP1). */
  crumbDamaged: 500,
  /** Per score point gained (lowest priority). */
  scorePoint: 1,
} as const;

/** Win-rate bounds used to flag levels for human playtesting (not balance verdicts). */
export const TOO_HARD_WIN_RATE = 0.2;
export const TOO_EASY_WIN_RATE = 0.95;

export type SpecialCounts = Record<SpecialKind, number>;

export function emptySpecialCounts(): SpecialCounts {
  return { LINE_H: 0, LINE_V: 0, BOMB: 0, RAM: 0, BESH: 0 };
}

/** Sum of clamped goal progress (each goal's `done` is already clamped to its count). */
export function goalUnits(goals: readonly GoalProgress[]): number {
  return goals.reduce((sum, goal) => sum + Math.min(goal.done, goal.count), 0);
}

/** Fraction of all goal units completed, 0..1. */
export function goalCompletion(goals: readonly GoalProgress[]): number {
  const total = goals.reduce((sum, goal) => sum + goal.count, 0);
  return total > 0 ? goalUnits(goals) / total : 1;
}

export interface MoveOutcome {
  goalProgress: number;
  created: SpecialCounts;
  activations: number;
  crumbsDestroyed: number;
  crumbsDamaged: number;
  scoreDelta: number;
  shuffles: number;
  regenerations: number;
  won: boolean;
}

/** Counts what a resolved move achieved from its events and the states around it. */
export function describeOutcome(before: GameState, after: GameState, events: readonly GameEvent[]): MoveOutcome {
  const outcome: MoveOutcome = {
    goalProgress: goalUnits(after.goals) - goalUnits(before.goals),
    created: emptySpecialCounts(),
    activations: 0,
    crumbsDestroyed: 0,
    crumbsDamaged: 0,
    scoreDelta: after.score - before.score,
    shuffles: 0,
    regenerations: 0,
    won: after.status === 'won',
  };
  for (const event of events) {
    switch (event.type) {
      case 'specialCreated':
        if (event.tile.special) outcome.created[event.tile.special] += 1;
        break;
      case 'specialActivated':
        outcome.activations += 1;
        break;
      case 'obstacleDamaged':
        for (const cell of event.cells) {
          if (cell.destroyed) outcome.crumbsDestroyed += 1;
          else outcome.crumbsDamaged += 1;
        }
        break;
      case 'shuffled':
        outcome.shuffles += 1;
        if (event.regenerated) outcome.regenerations += 1;
        break;
      default:
        break;
    }
  }
  return outcome;
}

/**
 * What a player can see of a move before gravity and refill: wave-1 events only.
 * Goal progress is counted from removed tiles / destroyed crumbs, capped by what each
 * goal still needs; `won` means this visible progress alone completes every goal.
 * Shuffle counts are copied from the full events (they are statistics, not scoring).
 */
export function describeVisibleOutcome(before: GameState, events: readonly GameEvent[]): MoveOutcome {
  const outcome: MoveOutcome = {
    goalProgress: 0,
    created: emptySpecialCounts(),
    activations: 0,
    crumbsDestroyed: 0,
    crumbsDamaged: 0,
    scoreDelta: 0,
    shuffles: 0,
    regenerations: 0,
    won: false,
  };
  const collected = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'shuffled') {
      outcome.shuffles += 1;
      if (event.regenerated) outcome.regenerations += 1;
      continue;
    }
    if (!('wave' in event) || event.wave !== 1) continue;
    switch (event.type) {
      case 'tilesRemoved':
        outcome.scoreDelta += event.scoreDelta;
        for (const tile of event.tiles) {
          // RAM/BESH have no base type and never count toward collect goals.
          if (tile.base !== null) collected.set(tile.base, (collected.get(tile.base) ?? 0) + 1);
        }
        break;
      case 'specialCreated':
        if (event.tile.special) outcome.created[event.tile.special] += 1;
        break;
      case 'specialActivated':
        outcome.activations += 1;
        break;
      case 'obstacleDamaged':
        for (const cell of event.cells) {
          if (cell.destroyed) outcome.crumbsDestroyed += 1;
          else outcome.crumbsDamaged += 1;
        }
        break;
      default:
        break;
    }
  }
  let allDone = true;
  for (const goal of before.goals) {
    const need = Math.max(0, goal.count - goal.done);
    const got = goal.kind === 'collect' ? (collected.get(goal.type) ?? 0) : outcome.crumbsDestroyed;
    const gained = Math.min(need, got);
    outcome.goalProgress += gained;
    if (gained < need) allDone = false;
  }
  outcome.won = allDone;
  return outcome;
}

/** Bot v1 value of an outcome (higher is better). Integer arithmetic only. */
export function scoreOutcome(outcome: MoveOutcome, weights = BOT_V1_WEIGHTS): number {
  let value = 0;
  if (outcome.won) value += weights.win;
  value += outcome.goalProgress * weights.goalUnit;
  for (const kind of SPECIAL_KINDS) value += outcome.created[kind] * weights.created[kind];
  value += outcome.activations * weights.activation;
  value += outcome.crumbsDestroyed * weights.crumbDestroyed;
  value += outcome.crumbsDamaged * weights.crumbDamaged;
  value += outcome.scoreDelta * weights.scorePoint;
  return value;
}

export interface BotChoice {
  move: Move;
  /** Index of the move in getLegalMoves() order. */
  index: number;
  value: number;
  state: GameState;
  events: GameEvent[];
  /** Actual full-cascade outcome (used for statistics with every policy). */
  outcome: MoveOutcome;
}

export type BotDecision =
  | { kind: 'move'; choice: BotChoice; candidates: number }
  | { kind: 'noLegalMove' }
  | { kind: 'error'; message: string };

/**
 * Picks the bot move: maximum value, ties broken by getLegalMoves() order.
 * A legal move that applyMove rejects is reported as a technical error.
 */
export function chooseBotMove(state: GameState, policy: BotPolicy = BOT_VERSION): BotDecision {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return { kind: 'noLegalMove' };
  let best: BotChoice | null = null;
  for (let index = 0; index < moves.length; index++) {
    const move = moves[index]!;
    const result = applyMove(state, move);
    if (!result.ok) {
      const technical = result.events.find((e) => e.type === 'technicalError');
      const detail = technical && technical.type === 'technicalError' ? `: ${technical.message}` : '';
      return {
        kind: 'error',
        message: `legal move ${formatMove(move)} rejected (${result.reason})${detail}`,
      };
    }
    const outcome = describeOutcome(state, result.state, result.events);
    const value = scoreOutcome(policy === 'greedy-visible-v1' ? describeVisibleOutcome(state, result.events) : outcome);
    if (best === null || value > best.value) {
      best = { move, index, value, state: result.state, events: result.events, outcome };
    }
  }
  return { kind: 'move', choice: best!, candidates: moves.length };
}

export function formatMove(move: Move): string {
  return `(${move.from.row},${move.from.col})->(${move.to.row},${move.to.col})`;
}

export type RunStatus = 'won' | 'lost' | 'error';

export interface RunResult {
  levelId: string;
  levelVersion: number;
  botVersion: BotPolicy;
  seed: number;
  status: RunStatus;
  movesUsed: number;
  movesLeft: number;
  stars: number;
  score: number;
  /** Fraction of goal units completed at the end, 0..1. */
  completion: number;
  shuffles: number;
  regenerations: number;
  created: SpecialCounts;
  activations: number;
  /** Total legal moves evaluated over the run. */
  candidates: number;
  error?: string;
}

/** Plays one full game of `level` with run seed `seed` using the bot policy. Never throws. */
export function simulateRun(level: LevelDefinition, seed: number, policy: BotPolicy = BOT_VERSION): RunResult {
  const run: RunResult = {
    levelId: level.id,
    levelVersion: level.version,
    botVersion: policy,
    seed,
    status: 'error',
    movesUsed: 0,
    movesLeft: level.moveLimit,
    stars: 0,
    score: 0,
    completion: 0,
    shuffles: 0,
    regenerations: 0,
    created: emptySpecialCounts(),
    activations: 0,
    candidates: 0,
  };
  let state: GameState;
  try {
    state = createGame(level, seed);
  } catch (error) {
    run.error = `createGame failed: ${errorMessage(error)}`;
    return run;
  }
  // Every accepted move consumes one move, so moveLimit steps always end the game.
  const maxSteps = level.moveLimit + 1;
  try {
    for (let step = 0; state.status === 'playing'; step++) {
      if (step >= maxSteps) {
        run.error = `game still playing after ${maxSteps} bot steps`;
        return finishRun(run, state);
      }
      const decision = chooseBotMove(state, policy);
      if (decision.kind === 'noLegalMove') {
        run.error = 'no legal move while playing (missing shuffle)';
        return finishRun(run, state);
      }
      if (decision.kind === 'error') {
        run.error = decision.message;
        return finishRun(run, state);
      }
      const { choice } = decision;
      run.candidates += decision.candidates;
      run.shuffles += choice.outcome.shuffles;
      run.regenerations += choice.outcome.regenerations;
      run.activations += choice.outcome.activations;
      for (const kind of SPECIAL_KINDS) run.created[kind] += choice.outcome.created[kind];
      state = choice.state;
    }
  } catch (error) {
    run.error = `exception: ${errorMessage(error)}`;
    return finishRun(run, state);
  }
  run.status = state.status === 'won' ? 'won' : 'lost';
  return finishRun(run, state);
}

function finishRun(run: RunResult, state: GameState): RunResult {
  run.movesUsed = state.moveLimit - state.movesLeft;
  run.movesLeft = state.movesLeft;
  run.stars = state.status === 'won' ? state.stars : 0;
  run.score = state.score;
  run.completion = goalCompletion(state.goals);
  return run;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface LevelSummary {
  levelId: string;
  levelVersion: number;
  botVersion: BotPolicy;
  runs: number;
  wins: number;
  winRate: number;
  /** null when the bot never won. */
  medianMovesLeftOnWins: number | null;
  /** Average stars over won runs; null when the bot never won. */
  avgStarsOnWins: number | null;
  /** Average stars over all runs (losses count as 0). */
  avgStarsAll: number;
  /** Average goal completion (0..1) over lost runs; null when there were no losses. */
  avgCompletionOnLosses: number | null;
  shufflesPerRun: number;
  regenerationsPerRun: number;
  createdPerRun: SpecialCounts;
  activationsPerRun: number;
  avgMovesUsed: number;
  technicalErrors: number;
  /** First few technical error messages with their seeds. */
  errorSamples: string[];
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarizeRuns(
  level: LevelDefinition,
  runs: readonly RunResult[],
  policy: BotPolicy = BOT_VERSION,
): LevelSummary {
  const wins = runs.filter((r) => r.status === 'won');
  const losses = runs.filter((r) => r.status === 'lost');
  const errors = runs.filter((r) => r.status === 'error');
  const n = runs.length;
  const createdPerRun = emptySpecialCounts();
  for (const kind of SPECIAL_KINDS) createdPerRun[kind] = n ? runs.reduce((s, r) => s + r.created[kind], 0) / n : 0;
  return {
    levelId: level.id,
    levelVersion: level.version,
    botVersion: policy,
    runs: n,
    wins: wins.length,
    winRate: n ? wins.length / n : 0,
    medianMovesLeftOnWins: median(wins.map((r) => r.movesLeft)),
    avgStarsOnWins: wins.length ? mean(wins.map((r) => r.stars)) : null,
    avgStarsAll: mean(runs.map((r) => r.stars)),
    avgCompletionOnLosses: losses.length ? mean(losses.map((r) => r.completion)) : null,
    shufflesPerRun: mean(runs.map((r) => r.shuffles)),
    regenerationsPerRun: mean(runs.map((r) => r.regenerations)),
    createdPerRun,
    activationsPerRun: mean(runs.map((r) => r.activations)),
    avgMovesUsed: mean(runs.map((r) => r.movesUsed)),
    technicalErrors: errors.length,
    errorSamples: errors.slice(0, 5).map((r) => `seed ${r.seed}: ${r.error ?? 'unknown error'}`),
  };
}

/** Fixed seed set 1..n (the documented default for comparisons). */
export function seedRange(n: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => i + 1);
}

export function simulateLevel(
  level: LevelDefinition,
  seeds: readonly number[],
  policy: BotPolicy = BOT_VERSION,
): { summary: LevelSummary; runs: RunResult[] } {
  const runs = seeds.map((seed) => simulateRun(level, seed, policy));
  return { summary: summarizeRuns(level, runs, policy), runs };
}

export type Flag = 'tooHard' | 'tooEasy' | null;

/** Proposal flag for human playtesting: < 20% bot wins → tooHard, > 95% → tooEasy. */
export function flagFor(summary: LevelSummary): Flag {
  if (summary.runs === 0) return null;
  if (summary.winRate < TOO_HARD_WIN_RATE) return 'tooHard';
  if (summary.winRate > TOO_EASY_WIN_RATE) return 'tooEasy';
  return null;
}

/* ------------------------------------------------------------------ */
/* Formatting (shared by the script's markdown and the editor panel).  */
/* ------------------------------------------------------------------ */

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function fixed(value: number | null, digits: number): string {
  return value === null ? '—' : value.toFixed(digits);
}

export function goalsLabel(level: LevelDefinition): string {
  return level.goals
    .map((goal) => (goal.kind === 'collect' ? `${goal.type} ×${goal.count}` : `crumbs ×${goal.count}`))
    .join(', ');
}

export function flagLabel(flag: Flag): string {
  if (flag === 'tooHard') return 'playtest: bot < 20%';
  if (flag === 'tooEasy') return 'playtest: bot > 95%';
  return '';
}

/** Markdown table of outcomes, one row per level. */
export function outcomeTable(levels: readonly LevelDefinition[], summaries: readonly LevelSummary[]): string {
  const header =
    '| Level | Moves | Goals | Runs | Bot wins | Win rate | Median moves left (wins) | Avg stars (wins) | Goal completion (losses) | Avg moves used | Shuffles/run | Tech errors | Flag |\n' +
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |';
  const rows = summaries.map((s, i) => {
    const level = levels[i]!;
    return `| ${s.levelId} v${s.levelVersion} | ${level.moveLimit} | ${goalsLabel(level)} | ${s.runs} | ${s.wins} | ${pct(s.winRate)} | ${fixed(s.medianMovesLeftOnWins, 1)} | ${fixed(s.avgStarsOnWins, 2)} | ${s.avgCompletionOnLosses === null ? '—' : pct(s.avgCompletionOnLosses)} | ${fixed(s.avgMovesUsed, 1)} | ${fixed(s.shufflesPerRun, 2)} | ${s.technicalErrors} | ${flagLabel(flagFor(s))} |`;
  });
  return [header, ...rows].join('\n');
}

/** Markdown table of average specials created / activations per run. */
export function specialsTable(summaries: readonly LevelSummary[]): string {
  const header =
    '| Level | LINE_H «Учпучмак» | LINE_V «Кумыс» | BOMB «Казан» | RAM «Золотой барашек» | BESH «Бешбармак» | Activations/run |\n' +
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |';
  const rows = summaries.map(
    (s) =>
      `| ${s.levelId} | ${SPECIAL_KINDS.map((k) => s.createdPerRun[k].toFixed(2)).join(' | ')} | ${s.activationsPerRun.toFixed(2)} |`,
  );
  return [header, ...rows].join('\n');
}

/**
 * Side-by-side win rates of the same levels under two bot policies; the remaining
 * columns describe the secondary policy.
 */
export function comparisonTable(primary: readonly LevelSummary[], secondary: readonly LevelSummary[]): string {
  const a = primary[0]?.botVersion ?? BOT_VERSION;
  const b = secondary[0]?.botVersion ?? 'greedy-visible-v1';
  const header =
    `| Level | Win rate ${a} | Win rate ${b} | Median moves left (wins) | Avg stars (wins) | Goal completion (losses) | Shuffles/run | Tech errors | Flag |\n` +
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |';
  const rows = primary.map((p, i) => {
    const s = secondary[i]!;
    return `| ${p.levelId} | ${pct(p.winRate)} (${p.wins}/${p.runs}) | ${pct(s.winRate)} (${s.wins}/${s.runs}) | ${fixed(s.medianMovesLeftOnWins, 1)} | ${fixed(s.avgStarsOnWins, 2)} | ${s.avgCompletionOnLosses === null ? '—' : pct(s.avgCompletionOnLosses)} | ${fixed(s.shufflesPerRun, 2)} | ${s.technicalErrors} | ${flagLabel(flagFor(s))} |`;
  });
  return [header, ...rows].join('\n');
}

export const SIMULATION_CAVEAT =
  'Bot results are technical signals, not predictions of human success. The default bot (greedy-1ply-v1) ' +
  'plays a greedy one-move lookahead that also sees the seeded refill outcome of each candidate move ' +
  '(information a human does not have) but never plans ahead; the supplementary greedy-visible-v1 bot scores ' +
  'only what is visible before gravity and refill. No level is called balanced on the basis of these numbers; ' +
  'flagged levels are proposals for human playtesting only.';
