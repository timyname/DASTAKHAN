/**
 * On-demand bot simulation of the edited level, reusing the pure core from sim.ts.
 * Runs one seed per macrotask so the page stays responsive; a newer run or an
 * unmount cancels the previous one.
 */
import { useEffect, useRef, useState } from 'react';
import type { LevelDefinition } from '@dastakhan/game-core';
import {
  BOT_POLICIES,
  BOT_VERSION,
  SIMULATION_CAVEAT,
  SPECIAL_KINDS,
  fixed,
  flagFor,
  flagLabel,
  pct,
  seedRange,
  simulateRun,
  summarizeRuns,
  type BotPolicy,
  type LevelSummary,
  type RunResult,
} from './sim.ts';

export interface SimPanelProps {
  /** Valid level to simulate, or null while the draft is invalid. */
  level: LevelDefinition | null;
  /** Canonical JSON of `level`, used to mark results as stale after edits. */
  levelKey: string;
  onPlaySeed(seed: number): void;
}

interface SimResult {
  levelKey: string;
  policy: BotPolicy;
  summary: LevelSummary;
  runs: RunResult[];
  ms: number;
}

const MAX_SEEDS = 200;

export function SimPanel({ level, levelKey, onPlaySeed }: SimPanelProps) {
  const [seedCount, setSeedCount] = useState(20);
  const [policy, setPolicy] = useState<BotPolicy>(BOT_VERSION);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const token = useRef(0);

  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );

  const running = progress !== null;
  const seedsValid = Number.isInteger(seedCount) && seedCount >= 1 && seedCount <= MAX_SEEDS;

  async function run() {
    if (!level || !seedsValid) return;
    const my = ++token.current;
    const seeds = seedRange(seedCount);
    const runs: RunResult[] = [];
    const started = performance.now();
    setProgress({ done: 0, total: seeds.length });
    for (const seed of seeds) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (token.current !== my) return;
      runs.push(simulateRun(level, seed, policy));
      setProgress({ done: runs.length, total: seeds.length });
    }
    setResult({ levelKey, policy, summary: summarizeRuns(level, runs, policy), runs, ms: performance.now() - started });
    setProgress(null);
  }

  function cancel() {
    token.current++;
    setProgress(null);
  }

  const s = result?.summary;
  const stale = result !== null && result.levelKey !== levelKey;

  return (
    <div className="ed-sim" data-testid="sim-panel">
      <div className="ed-row">
        <label className="ed-field ed-field-inline">
          <span>Seeds 1..N</span>
          <input
            type="number"
            min={1}
            max={MAX_SEEDS}
            value={Number.isNaN(seedCount) ? '' : seedCount}
            onChange={(e) => setSeedCount(e.target.valueAsNumber)}
          />
        </label>
        <label className="ed-field ed-field-inline">
          <span>Bot</span>
          <select value={policy} onChange={(e) => setPolicy(e.target.value as BotPolicy)}>
            {BOT_POLICIES.map((p) => (
              <option key={p} value={p}>
                {p}
                {p === BOT_VERSION ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>
        {running ? (
          <button type="button" className="ed-btn" onClick={cancel}>
            Cancel ({progress.done}/{progress.total})
          </button>
        ) : (
          <button type="button" className="ed-btn ed-btn-primary" disabled={!level || !seedsValid} onClick={() => void run()} data-testid="sim-run">
            Run bot simulation
          </button>
        )}
      </div>
      {!level && <p className="ed-muted">Fix validation errors to simulate this draft.</p>}
      {!seedsValid && <p className="ed-muted">Seeds must be an integer from 1 to {MAX_SEEDS}.</p>}
      <p className="ed-muted">Same seed set (1..N) and bot core as <code>npm run simulate</code>.</p>

      {s && result && (
        <div className={stale ? 'ed-sim-result is-stale' : 'ed-sim-result'} data-testid="sim-result">
          {stale && <p className="ed-warn">The draft changed after this run — results describe the previous draft.</p>}
          <table className="ed-table">
            <tbody>
              <tr><th>Level</th><td>{s.levelId} v{s.levelVersion}</td></tr>
              <tr><th>Bot</th><td>{s.botVersion}</td></tr>
              <tr><th>Runs</th><td>{s.runs} (seeds 1..{s.runs}, {(result.ms / 1000).toFixed(1)} s)</td></tr>
              <tr><th>Bot wins</th><td data-testid="sim-winrate">{s.wins} ({pct(s.winRate)})</td></tr>
              <tr><th>Median moves left (wins)</th><td>{fixed(s.medianMovesLeftOnWins, 1)}</td></tr>
              <tr><th>Avg stars (wins)</th><td>{fixed(s.avgStarsOnWins, 2)}</td></tr>
              <tr><th>Goal completion (losses)</th><td>{s.avgCompletionOnLosses === null ? '—' : pct(s.avgCompletionOnLosses)}</td></tr>
              <tr><th>Avg moves used</th><td>{s.avgMovesUsed.toFixed(1)}</td></tr>
              <tr><th>Shuffles / run</th><td>{s.shufflesPerRun.toFixed(2)} (regenerations {s.regenerationsPerRun.toFixed(2)})</td></tr>
              <tr>
                <th>Specials created / run</th>
                <td>{SPECIAL_KINDS.map((k) => `${k} ${s.createdPerRun[k].toFixed(2)}`).join(' · ')}</td>
              </tr>
              <tr><th>Activations / run</th><td>{s.activationsPerRun.toFixed(2)}</td></tr>
              <tr><th>Technical errors</th><td className={s.technicalErrors ? 'ed-bad' : undefined}>{s.technicalErrors}</td></tr>
              <tr><th>Playtest flag</th><td>{flagLabel(flagFor(s)) || 'none'}</td></tr>
            </tbody>
          </table>
          {s.errorSamples.length > 0 && (
            <ul className="ed-errors">
              {s.errorSamples.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <details className="ed-details">
            <summary>Per-seed results (click a seed to test-play it)</summary>
            <div className="ed-seeds">
              {result.runs.map((r) => (
                <button
                  key={r.seed}
                  type="button"
                  className={`ed-seed ed-seed-${r.status}`}
                  title={r.error ?? `${r.status}, ${r.movesLeft} moves left, ${r.stars} stars, score ${r.score}`}
                  onClick={() => onPlaySeed(r.seed)}
                >
                  {r.seed}: {r.status === 'won' ? `won +${r.movesLeft}` : r.status === 'lost' ? `lost ${pct(r.completion)}` : 'error'}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}
      <p className="ed-caveat">{SIMULATION_CAVEAT}</p>
    </div>
  );
}
