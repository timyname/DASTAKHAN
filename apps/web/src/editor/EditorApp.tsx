/**
 * DASTAKHAN internal level editor (dev-only, prompt 06). English UI (developer tool).
 *
 * Edits a level draft in memory only: it never writes to content/ files, player saves
 * or browser storage. Export the JSON and commit it by hand after review; changed
 * campaign levels need a new version.
 */
import { levels as campaignLevels } from '@dastakhan/content';
import { FOOD_TYPES, createGame, validateLevel, type FoodType, type GameState, type Goal } from '@dastakhan/game-core';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { FoodIcon } from '../art/TileArt.tsx';
import { CrumbsGrid, type Brush } from './CrumbsGrid.tsx';
import {
  EDITOR_MAX_TYPES,
  EDITOR_MIN_TYPES,
  blankDraft,
  draftFromLevel,
  draftFromUnknown,
  draftToLevel,
  editorHints,
  emptyGrid,
  formatLevelJson,
  sortTypes,
  type Draft,
} from './draft.ts';
import { SimPanel } from './SimPanel.tsx';
import { TestPlay } from './TestPlay.tsx';

const NEW_LEVEL = '__new__';

/** Run seed in the uint32 range; randomness stays in the UI, game-core is deterministic. */
function randomSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }
}

function numberValue(e: ChangeEvent<HTMLInputElement>): number {
  return e.target.value === '' ? Number.NaN : e.target.valueAsNumber;
}

interface PlayRun {
  key: number;
  seed: number;
  initial: GameState;
  levelKey: string;
}

export function EditorApp() {
  const [draft, setDraft] = useState<Draft>(() => draftFromLevel(campaignLevels[0]!));
  const [source, setSource] = useState<string>(campaignLevels[0]!.id);
  const [loadChoice, setLoadChoice] = useState<string>(campaignLevels[0]!.id);
  const [brush, setBrush] = useState<Brush>(1);
  const [importText, setImportText] = useState('');
  const [importReport, setImportReport] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [copyNote, setCopyNote] = useState('');
  const [seed, setSeed] = useState(1);
  const [play, setPlay] = useState<PlayRun | null>(null);
  const [playError, setPlayError] = useState('');
  const playKey = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const level = useMemo(() => draftToLevel(draft), [draft]);
  const json = useMemo(() => formatLevelJson(level), [level]);
  const validation = useMemo(() => validateLevel(level), [level]);
  const hints = useMemo(() => editorHints(draft, campaignLevels), [draft]);
  const validLevel = validation.ok ? level : null;
  const overlayCount = level.overlays.length;
  const hp2Count = level.overlays.filter((o) => o.hp === 2).length;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  /* ---------------- loading / import / export ---------------- */

  function loadSelected() {
    if (loadChoice === NEW_LEVEL) {
      setDraft(blankDraft());
      setSource('blank draft');
    } else {
      const found = campaignLevels.find((l) => l.id === loadChoice);
      if (!found) return;
      setDraft(draftFromLevel(found));
      setSource(`${found.id} v${found.version}`);
    }
    setImportReport(null);
  }

  function importJson(text: string, origin: string) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      setImportReport({ ok: false, lines: [`${origin}: not valid JSON — ${error instanceof Error ? error.message : String(error)}`] });
      return;
    }
    const check = validateLevel(raw);
    const { draft: next, notes } = draftFromUnknown(raw);
    setDraft(next);
    setSource(origin);
    setImportReport({
      ok: check.ok && notes.length === 0,
      lines: [
        check.ok ? `${origin}: valid level imported.` : `${origin}: imported with ${check.errors.length} schema error(s):`,
        ...check.errors.map((e) => `schema: ${e}`),
        ...notes.map((n) => `import: ${n}`),
      ],
    });
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    importJson(await file.text(), file.name);
  }

  function download() {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${level.id || 'level'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopyNote('Copied to clipboard.');
    } catch {
      setCopyNote('Clipboard unavailable — select the JSON text and copy it manually.');
    }
  }

  /* ---------------- allowed types / goals / crumbs ---------------- */

  function toggleType(type: FoodType) {
    setDraft((d) => {
      const has = d.allowedTypes.includes(type);
      const next = has ? d.allowedTypes.filter((t) => t !== type) : [...d.allowedTypes, type];
      return { ...d, allowedTypes: sortTypes(next) };
    });
  }

  function setGoal(index: number, goal: Goal) {
    setDraft((d) => ({ ...d, goals: d.goals.map((g, i) => (i === index ? goal : g)) }));
  }

  function removeGoal(index: number) {
    setDraft((d) => ({ ...d, goals: d.goals.filter((_, i) => i !== index) }));
  }

  function addGoal(kind: Goal['kind']) {
    setDraft((d) => {
      const goal: Goal =
        kind === 'collect'
          ? { kind: 'collect', type: d.allowedTypes[0] ?? FOOD_TYPES[0], count: 25 }
          : { kind: 'clearCrumbs', count: overlaysCount(d) };
      return { ...d, goals: [...d.goals, goal] };
    });
  }

  function paint(row: number, col: number) {
    setDraft((d) => {
      if (d.hp[row]![col] === brush) return d;
      const hp = d.hp.map((r) => r.slice());
      hp[row]![col] = brush;
      return { ...d, hp };
    });
  }

  function fillAll(value: Brush) {
    update({ hp: emptyGrid().map((r) => r.map(() => value)) });
  }

  /* ---------------- test play ---------------- */

  function startPlay(withSeed = seed) {
    setPlayError('');
    if (!validLevel) {
      setPlayError('Fix validation errors before test play.');
      return;
    }
    if (!Number.isInteger(withSeed) || withSeed < 0 || withSeed > 0xffffffff) {
      setPlayError('Seed must be an integer from 0 to 4294967295.');
      return;
    }
    try {
      const initial = createGame(validLevel, withSeed);
      playKey.current += 1;
      setSeed(withSeed);
      setPlay({ key: playKey.current, seed: withSeed, initial, levelKey: json });
    } catch (error) {
      setPlay(null);
      setPlayError(`createGame failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div className="ed-app">
      <header className="ed-header">
        <div>
          <h1>DASTAKHAN level editor</h1>
          <p className="ed-muted">
            Dev-only tool. Edits stay in memory: nothing is written to <code>content/</code>, player saves or storage. Export
            JSON and commit by hand; a changed campaign level needs a new version.
          </p>
        </div>
        <div className="ed-load">
          <label className="ed-field ed-field-inline">
            <span>Start from</span>
            <select value={loadChoice} onChange={(e) => setLoadChoice(e.target.value)} data-testid="load-select">
              <option value={NEW_LEVEL}>New blank level</option>
              {campaignLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} v{l.version}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ed-btn" onClick={loadSelected} data-testid="load-button">
            Load
          </button>
          <span className="ed-muted">Draft source: {source}</span>
        </div>
      </header>

      <main className="ed-main">
        {/* ---------------- Level settings ---------------- */}
        <section className="ed-panel ed-settings" aria-labelledby="ed-h-settings">
          <h2 id="ed-h-settings">Level</h2>
          <div className="ed-grid2">
            <label className="ed-field">
              <span>id</span>
              <input value={draft.id} onChange={(e) => update({ id: e.target.value })} spellCheck={false} />
            </label>
            <label className="ed-field">
              <span>version</span>
              <input type="number" min={1} value={Number.isNaN(draft.version) ? '' : draft.version} onChange={(e) => update({ version: numberValue(e) })} />
            </label>
            <label className="ed-field">
              <span>rulesVersion</span>
              <input
                type="number"
                min={1}
                value={Number.isNaN(draft.rulesVersion) ? '' : draft.rulesVersion}
                onChange={(e) => update({ rulesVersion: numberValue(e) })}
              />
            </label>
            <label className="ed-field">
              <span>moveLimit</span>
              <input
                type="number"
                min={1}
                max={99}
                value={Number.isNaN(draft.moveLimit) ? '' : draft.moveLimit}
                onChange={(e) => update({ moveLimit: numberValue(e) })}
                data-testid="move-limit"
              />
            </label>
            <label className="ed-field ed-span2">
              <span>tutorialId (optional, tutorials only)</span>
              <input value={draft.tutorialId} onChange={(e) => update({ tutorialId: e.target.value })} spellCheck={false} />
            </label>
          </div>

          <h3>
            Allowed types <span className="ed-muted">({draft.allowedTypes.length} selected; schema {EDITOR_MIN_TYPES}–{EDITOR_MAX_TYPES}, campaign 5–6)</span>
          </h3>
          <div className="ed-types" role="group" aria-label="Allowed food types">
            {FOOD_TYPES.map((type) => {
              const on = draft.allowedTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={on ? 'ed-type is-on' : 'ed-type'}
                  aria-pressed={on}
                  onClick={() => toggleType(type)}
                  data-testid={`type-${type}`}
                >
                  <FoodIcon type={type} size={30} />
                  <span>{type}</span>
                </button>
              );
            })}
          </div>

          <h3>Goals</h3>
          <ol className="ed-goals">
            {draft.goals.map((goal, index) => (
              <li key={index} className="ed-goal">
                <select
                  aria-label={`goal ${index + 1} kind`}
                  value={goal.kind}
                  onChange={(e) =>
                    setGoal(
                      index,
                      e.target.value === 'collect'
                        ? { kind: 'collect', type: draft.allowedTypes[0] ?? FOOD_TYPES[0], count: goal.count }
                        : { kind: 'clearCrumbs', count: goal.count },
                    )
                  }
                >
                  <option value="collect">collect</option>
                  <option value="clearCrumbs">clearCrumbs</option>
                </select>
                {goal.kind === 'collect' && (
                  <>
                    <FoodIcon type={goal.type} size={26} />
                    <select
                      aria-label={`goal ${index + 1} type`}
                      value={goal.type}
                      onChange={(e) => setGoal(index, { ...goal, type: e.target.value as FoodType })}
                    >
                      {FOOD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                          {draft.allowedTypes.includes(type) ? '' : ' (not allowed)'}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <input
                  type="number"
                  min={1}
                  aria-label={`goal ${index + 1} count`}
                  value={Number.isNaN(goal.count) ? '' : goal.count}
                  onChange={(e) => setGoal(index, { ...goal, count: numberValue(e) })}
                />
                {goal.kind === 'clearCrumbs' && (
                  <button type="button" className="ed-btn ed-btn-small" onClick={() => setGoal(index, { ...goal, count: overlayCount })}>
                    = overlay cells ({overlayCount})
                  </button>
                )}
                <button type="button" className="ed-btn ed-btn-small ed-btn-danger" onClick={() => removeGoal(index)} aria-label={`remove goal ${index + 1}`}>
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <div className="ed-row">
            <button type="button" className="ed-btn ed-btn-small" onClick={() => addGoal('collect')}>
              + collect
            </button>
            <button type="button" className="ed-btn ed-btn-small" onClick={() => addGoal('clearCrumbs')}>
              + clearCrumbs
            </button>
          </div>
        </section>

        {/* ---------------- Crumbs ---------------- */}
        <section className="ed-panel ed-crumbs" aria-labelledby="ed-h-crumbs">
          <h2 id="ed-h-crumbs">Crumbs «Крошки на скатерти»</h2>
          <div className="ed-row" role="radiogroup" aria-label="HP brush">
            {([0, 1, 2] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={brush === value}
                className={brush === value ? 'ed-btn ed-brush is-on' : 'ed-btn ed-brush'}
                onClick={() => setBrush(value)}
                data-testid={`brush-${value}`}
              >
                {value === 0 ? 'Erase (HP 0)' : `HP ${value}`}
              </button>
            ))}
          </div>
          <CrumbsGrid hp={draft.hp} brush={brush} onBrush={setBrush} onPaint={paint} />
          <p className="ed-muted" data-testid="crumb-counts">
            {overlayCount} crumb cells ({overlayCount - hp2Count} HP1, {hp2Count} HP2; total HP {overlayCount + hp2Count}). Click or drag to
            paint; keys 0/1/2 switch the brush.
          </p>
          <div className="ed-row">
            <button type="button" className="ed-btn ed-btn-small" onClick={() => fillAll(0)}>
              Clear all
            </button>
            <button type="button" className="ed-btn ed-btn-small" onClick={() => fillAll(brush)} disabled={brush === 0}>
              Fill board with HP {brush || '—'}
            </button>
          </div>
        </section>

        {/* ---------------- Validation + JSON ---------------- */}
        <section className="ed-panel ed-io" aria-labelledby="ed-h-validation">
          <h2 id="ed-h-validation">Validation</h2>
          {validation.ok ? (
            <p className="ed-ok" data-testid="validation-ok">
              Valid — shared <code>validateLevel</code> reports no errors.
            </p>
          ) : (
            <ul className="ed-errors" data-testid="validation-errors">
              {validation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {hints.length > 0 && (
            <ul className="ed-hints">
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}

          <h2>Export</h2>
          <textarea className="ed-json" readOnly value={json} rows={12} spellCheck={false} aria-label="Level JSON" data-testid="export-json" />
          <div className="ed-row">
            <button type="button" className="ed-btn" onClick={download}>
              Download {level.id || 'level'}.json
            </button>
            <button type="button" className="ed-btn" onClick={() => void copy()}>
              Copy JSON
            </button>
            {!validation.ok && <span className="ed-warn">Draft is invalid.</span>}
          </div>
          {copyNote && <p className="ed-muted">{copyNote}</p>}

          <h2>Import</h2>
          <textarea
            className="ed-json"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
            placeholder="Paste level JSON here"
            spellCheck={false}
            aria-label="JSON to import"
          />
          <div className="ed-row">
            <button type="button" className="ed-btn" disabled={importText.trim() === ''} onClick={() => importJson(importText, 'pasted JSON')}>
              Import pasted JSON
            </button>
            <button type="button" className="ed-btn" onClick={() => fileInput.current?.click()}>
              Import file…
            </button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => void importFile(e)} />
          </div>
          {importReport && (
            <ul className={importReport.ok ? 'ed-hints' : 'ed-errors'}>
              {importReport.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------- Test play ---------------- */}
        <section className="ed-panel ed-testplay" aria-labelledby="ed-h-play">
          <h2 id="ed-h-play">Test play</h2>
          <div className="ed-row">
            <label className="ed-field ed-field-inline">
              <span>Seed</span>
              <input
                type="number"
                min={0}
                value={Number.isNaN(seed) ? '' : seed}
                onChange={(e) => setSeed(numberValue(e))}
                data-testid="seed-input"
              />
            </label>
            <button type="button" className="ed-btn ed-btn-primary" onClick={() => startPlay()} disabled={!validLevel} data-testid="play-start">
              {play ? 'Restart' : 'Start'}
            </button>
            <button type="button" className="ed-btn" onClick={() => startPlay(randomSeed())} disabled={!validLevel}>
              Random seed
            </button>
          </div>
          {playError && <p className="ed-error">{playError}</p>}
          {play && play.levelKey !== json && (
            <p className="ed-warn">The draft changed since this game started — press Restart to apply the edits.</p>
          )}
          {play ? (
            <TestPlay key={play.key} initial={play.initial} seed={play.seed} />
          ) : (
            <p className="ed-muted">Start a real game: <code>createGame(level, seed)</code> with the shared board renderer.</p>
          )}
        </section>

        {/* ---------------- Simulation ---------------- */}
        <section className="ed-panel ed-simulation" aria-labelledby="ed-h-sim">
          <h2 id="ed-h-sim">Bot simulation</h2>
          <SimPanel level={validLevel} levelKey={json} onPlaySeed={(s) => startPlay(s)} />
        </section>
      </main>
    </div>
  );
}

function overlaysCount(draft: Draft): number {
  return draft.hp.reduce((sum, row) => sum + row.filter((v) => v > 0).length, 0);
}
