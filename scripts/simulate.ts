/**
 * Balance simulation over the campaign levels (prompt 06).
 *
 *   npm run simulate          # seeds 1..50, writes docs/SIMULATION.md and prints it
 *   npm run simulate:quick    # seeds 1..10, prints only (docs untouched)
 *   node scripts/simulate.ts [--seeds N] [--levels level-01,level-05] [--no-write] [--out path]
 *
 * Reads levels from content/ and never modifies them. The bot core is shared with the
 * dev-only level editor (apps/web/src/editor/sim.ts). Exit code 1 on any technical error.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES_VERSION, type LevelDefinition } from '@dastakhan/game-core';
import { levels as campaignLevels } from '../content/index.ts';
import {
  BOT_V1_WEIGHTS,
  BOT_VERSION,
  SIMULATION_CAVEAT,
  TOO_EASY_WIN_RATE,
  TOO_HARD_WIN_RATE,
  comparisonTable,
  flagFor,
  outcomeTable,
  pct,
  seedRange,
  simulateLevel,
  specialsTable,
  type BotPolicy,
  type LevelSummary,
} from '../apps/web/src/editor/sim.ts';

/** Supplementary policy reported next to the default bot v1. */
const SECONDARY_POLICY: BotPolicy = 'greedy-visible-v1';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SEEDS = 50;
const DEFAULT_OUT = 'docs/SIMULATION.md';

interface Options {
  seeds: number;
  levelIds: string[] | null;
  write: boolean;
  out: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { seeds: DEFAULT_SEEDS, levelIds: null, write: true, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--seeds') {
      const n = Number(value());
      if (!Number.isInteger(n) || n < 1 || n > 10_000) throw new Error('--seeds must be an integer from 1 to 10000');
      options.seeds = n;
    } else if (arg === '--levels') {
      options.levelIds = value()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === '--no-write') {
      options.write = false;
    } else if (arg === '--out') {
      options.out = value();
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/simulate.ts [--seeds N] [--levels id,id] [--no-write] [--out path]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function selectLevels(ids: string[] | null): LevelDefinition[] {
  if (!ids) return campaignLevels;
  return ids.map((id) => {
    const level = campaignLevels.find((l) => l.id === id);
    if (!level) throw new Error(`Unknown level id: ${id}`);
    return level;
  });
}

function seedSetLabel(seeds: number[]): string {
  return seeds.length === 0 ? '(none)' : `${seeds[0]}..${seeds[seeds.length - 1]} (${seeds.length} seeds)`;
}

function flagLists(summaries: LevelSummary[]): string[] {
  const hard = summaries.filter((s) => flagFor(s) === 'tooHard');
  const easy = summaries.filter((s) => flagFor(s) === 'tooEasy');
  const line = (s: LevelSummary) => `- ${s.levelId} v${s.levelVersion}: bot win rate ${pct(s.winRate)} (${s.wins}/${s.runs})`;
  const bot = summaries[0]?.botVersion ?? BOT_VERSION;
  return [
    `Possibly too hard for \`${bot}\` (< ${pct(TOO_HARD_WIN_RATE)}):`,
    '',
    ...(hard.length ? hard.map(line) : ['- none']),
    '',
    `Possibly too easy for \`${bot}\` (> ${pct(TOO_EASY_WIN_RATE)}):`,
    '',
    ...(easy.length ? easy.map(line) : ['- none']),
  ];
}

function flaggedSection(primary: LevelSummary[], secondary: LevelSummary[]): string {
  return [
    '## Proposals for human playtesting',
    '',
    `Thresholds: bot win rate below ${pct(TOO_HARD_WIN_RATE)} → possibly too hard; above ${pct(TOO_EASY_WIN_RATE)} → possibly too easy. ` +
      'These are prompts to playtest, not verdicts. No level file was changed by this run.',
    '',
    ...flagLists(primary),
    '',
    ...flagLists(secondary),
  ].join('\n');
}

function errorSection(groups: LevelSummary[][]): string {
  const all = groups.flat();
  const total = all.reduce((sum, s) => sum + s.technicalErrors, 0);
  const out = ['## Technical errors', '', `Total technical errors over both bots: ${total} (must be 0).`];
  for (const s of all) {
    if (s.errorSamples.length) out.push('', `${s.levelId} (${s.botVersion}):`, ...s.errorSamples.map((e) => `- ${e}`));
  }
  return out.join('\n');
}

function runPolicy(selected: LevelDefinition[], seeds: number[], policy: BotPolicy): LevelSummary[] {
  return selected.map((level) => {
    const t0 = performance.now();
    const { summary } = simulateLevel(level, seeds, policy);
    const ms = performance.now() - t0;
    process.stderr.write(
      `[${policy}] ${level.id}: ${summary.wins}/${summary.runs} bot wins, ${summary.technicalErrors} errors (${(ms / 1000).toFixed(1)} s)\n`,
    );
    return summary;
  });
}

function methodSection(): string {
  const w = BOT_V1_WEIGHTS;
  return [
    '## Method',
    '',
    `Bot \`${BOT_VERSION}\` (deterministic). For every legal move returned by \`getLegalMoves\` it resolves the move with ` +
      '`applyMove` (full cascade, gravity and seeded refill) and scores the outcome with integer weights:',
    '',
    `- win: +${w.win}`,
    `- goal progress (clamped collected pieces / fully cleared crumb cells toward unfinished goals): +${w.goalUnit} per unit (highest per-unit weight)`,
    `- specials created: LINE_H +${w.created.LINE_H}, LINE_V +${w.created.LINE_V}, BOMB +${w.created.BOMB}, RAM +${w.created.RAM}, BESH +${w.created.BESH}`,
    `- special activations: +${w.activation} per \`specialActivated\` event`,
    `- crumbs: +${w.crumbDestroyed} per cell destroyed, +${w.crumbDamaged} per HP2 → HP1 hit`,
    `- score delta: +${w.scorePoint} per point (lowest priority)`,
    '',
    'The highest value is played; ties keep the earliest move in `getLegalMoves` order (row-major, right before down). ' +
      'Each run starts from `createGame(level, seed)` with seeds 1..N and plays until the engine reports won or lost.',
    '',
    `Supplementary bot \`${SECONDARY_POLICY}\`: identical weights and tie-break, but each candidate is scored only from its ` +
      'wave-1 events (the swap\'s own matches, special activations, removals and crumb hits before gravity and refill); ' +
      'collect/crumb progress is counted from removed tiles and destroyed crumbs, capped by what each goal still needs. ' +
      'It never sees cascades produced by refills, so it is closer to what a human can see — still not a human model. ' +
      'Statistics (specials, shuffles, outcome) always come from the real resolved move.',
    '',
    'Metrics: win rate = won runs / runs; median moves left over won runs; average stars over won runs (stars are 0 on ' +
      'losses); goal completion on losses = average fraction of all goal units completed when the bot lost; shuffles/run = ' +
      '`shuffled` events per run (dead-board reshuffles, including regenerations); specials = `specialCreated` events per run ' +
      'by kind; technical errors = runs where `createGame`/`applyMove` threw or rejected a move from `getLegalMoves`, a ' +
      'playing state had no legal move, or a run exceeded moveLimit steps.',
  ].join('\n');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const selected = selectLevels(options.levelIds);
  const seeds = seedRange(options.seeds);
  const started = performance.now();
  const summaries = runPolicy(selected, seeds, BOT_VERSION);
  const secondary = runPolicy(selected, seeds, SECONDARY_POLICY);
  const seconds = (performance.now() - started) / 1000;

  const npmScript = process.env.npm_lifecycle_event;
  const direct = ['node', 'scripts/simulate.ts', ...process.argv.slice(2)].join(' ');
  const command = npmScript ? `npm run ${npmScript} (${direct})` : direct;
  const totalErrors = [...summaries, ...secondary].reduce((sum, s) => sum + s.technicalErrors, 0);
  const totalRuns = [...summaries, ...secondary].reduce((sum, s) => sum + s.runs, 0);

  const markdown = [
    '# DASTAKHAN — Bot Balance Simulation',
    '',
    '> Generated by `scripts/simulate.ts`. Do not edit by hand; re-run the command below.',
    '',
    `> **Caveat.** ${SIMULATION_CAVEAT}`,
    '',
    `- Date (UTC): ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
    `- Command: \`${command}\``,
    `- Bot version: \`${BOT_VERSION}\` (main tables); supplementary \`${SECONDARY_POLICY}\``,
    `- Rules version: ${RULES_VERSION}`,
    `- Seed set: ${seedSetLabel(seeds)} per level and bot, \`createGame(level, seed)\``,
    `- Levels: ${selected.length} (${totalRuns} runs in total over both bots)`,
    `- Runtime: ${seconds.toFixed(1)} s for both bots (Node ${process.version}, single thread)`,
    `- Technical errors: ${totalErrors}`,
    '',
    `## Outcomes — \`${BOT_VERSION}\``,
    '',
    outcomeTable(selected, summaries),
    '',
    `## Specials created per run (average) — \`${BOT_VERSION}\``,
    '',
    specialsTable(summaries),
    '',
    `## Supplementary bot — \`${SECONDARY_POLICY}\``,
    '',
    `Same seeds. Columns after the two win rates describe \`${SECONDARY_POLICY}\`.`,
    '',
    comparisonTable(summaries, secondary),
    '',
    `Specials created per run (average) — \`${SECONDARY_POLICY}\`:`,
    '',
    specialsTable(secondary),
    '',
    flaggedSection(summaries, secondary),
    '',
    errorSection([summaries, secondary]),
    '',
    methodSection(),
    '',
  ].join('\n');

  console.log(markdown);
  if (options.write) {
    const target = resolve(ROOT, options.out);
    writeFileSync(target, markdown, 'utf8');
    process.stderr.write(`Wrote ${target}\n`);
  } else {
    process.stderr.write('Not written (--no-write).\n');
  }
  process.stderr.write(`Total runtime: ${seconds.toFixed(1)} s\n`);
  if (totalErrors > 0) process.exitCode = 1;
}

main();
