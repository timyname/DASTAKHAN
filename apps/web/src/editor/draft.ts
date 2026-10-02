/**
 * Level editor draft model (dev-only tool, prompt 06). Pure functions: no DOM or storage.
 * The draft keeps crumbs as an 11×11 HP grid so overlays can never duplicate a cell;
 * `draftToLevel` produces the LevelDefinition that is validated with the shared
 * `validateLevel` schema and exported as JSON.
 */
import {
  BOARD_SIZE,
  FOOD_TYPES,
  RULES_VERSION,
  type FoodType,
  type Goal,
  type LevelDefinition,
  type Overlay,
} from '@dastakhan/game-core';

/** Mirrors MIN/MAX_ALLOWED_TYPES in game-core level-schema.ts (validateLevel enforces them). */
export const EDITOR_MIN_TYPES = 4;
export const EDITOR_MAX_TYPES = 8;

export interface Draft {
  id: string;
  version: number;
  rulesVersion: number;
  /** Always kept in FOOD_TYPES order. */
  allowedTypes: FoodType[];
  moveLimit: number;
  goals: Goal[];
  /** hp[row][col] in 0..2. */
  hp: number[][];
  /** Empty string = no tutorialId. */
  tutorialId: string;
}

export function emptyGrid(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));
}

export function blankDraft(): Draft {
  return {
    id: 'level-new',
    version: 1,
    rulesVersion: RULES_VERSION,
    allowedTypes: ['baursak', 'kurt', 'kazy', 'samsa', 'tea'],
    moveLimit: 25,
    goals: [{ kind: 'collect', type: 'baursak', count: 25 }],
    hp: emptyGrid(),
    tutorialId: '',
  };
}

export function sortTypes(types: Iterable<FoodType>): FoodType[] {
  const set = new Set(types);
  return FOOD_TYPES.filter((type) => set.has(type));
}

/** Overlays in row-major order. */
export function overlaysOf(hp: number[][]): Overlay[] {
  const out: Overlay[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const value = hp[row]?.[col] ?? 0;
      if (value === 1 || value === 2) out.push({ row, col, hp: value });
    }
  }
  return out;
}

export function draftToLevel(draft: Draft): LevelDefinition {
  const level: LevelDefinition = {
    id: draft.id,
    version: draft.version,
    rulesVersion: draft.rulesVersion,
    rows: BOARD_SIZE,
    cols: BOARD_SIZE,
    allowedTypes: draft.allowedTypes.slice(),
    moveLimit: draft.moveLimit,
    goals: draft.goals.map((goal) => ({ ...goal })),
    overlays: overlaysOf(draft.hp),
  };
  if (draft.tutorialId.trim() !== '') level.tutorialId = draft.tutorialId;
  return level;
}

export function draftFromLevel(level: LevelDefinition): Draft {
  return draftFromUnknown(level).draft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keeps numbers as-is (validation reports bad values); anything else becomes NaN. */
function numberOrNaN(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN;
}

function inBoard(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < BOARD_SIZE;
}

/**
 * Tolerant conversion of imported JSON into a draft. Usable fields are kept (even if the
 * schema rejects their values, so the editor can show and fix the error); unusable ones
 * fall back to defaults and are listed in `notes`.
 */
export function draftFromUnknown(raw: unknown): { draft: Draft; notes: string[] } {
  const draft = blankDraft();
  const notes: string[] = [];
  if (!isRecord(raw)) {
    notes.push('Imported value is not an object; started from a blank draft.');
    return { draft, notes };
  }
  if (typeof raw.id === 'string') draft.id = raw.id;
  else notes.push('id missing or not a string; kept "level-new".');
  if (typeof raw.version === 'number') draft.version = raw.version;
  else notes.push('version missing or not a number; kept 1.');
  if (typeof raw.rulesVersion === 'number') draft.rulesVersion = raw.rulesVersion;
  else notes.push(`rulesVersion missing or not a number; kept ${RULES_VERSION}.`);
  if (typeof raw.moveLimit === 'number') draft.moveLimit = raw.moveLimit;
  else notes.push('moveLimit missing or not a number; kept 25.');
  draft.tutorialId = typeof raw.tutorialId === 'string' ? raw.tutorialId : '';

  if (Array.isArray(raw.allowedTypes)) {
    const known = raw.allowedTypes.filter((t): t is FoodType => (FOOD_TYPES as readonly unknown[]).includes(t));
    if (known.length !== raw.allowedTypes.length) notes.push('Unknown or duplicate allowedTypes entries were dropped.');
    draft.allowedTypes = sortTypes(known);
  } else {
    notes.push('allowedTypes missing; kept the default five types.');
  }

  if (Array.isArray(raw.goals)) {
    const goals: Goal[] = [];
    raw.goals.forEach((goal: unknown, index) => {
      if (!isRecord(goal)) {
        notes.push(`goals[${index}] is not an object; dropped.`);
      } else if (goal.kind === 'collect' && (FOOD_TYPES as readonly unknown[]).includes(goal.type)) {
        goals.push({ kind: 'collect', type: goal.type as FoodType, count: numberOrNaN(goal.count) });
      } else if (goal.kind === 'clearCrumbs') {
        goals.push({ kind: 'clearCrumbs', count: numberOrNaN(goal.count) });
      } else {
        notes.push(`goals[${index}] has an unsupported kind/type; dropped.`);
      }
    });
    draft.goals = goals;
  } else {
    notes.push('goals missing; kept the default goal.');
  }

  draft.hp = emptyGrid();
  if (Array.isArray(raw.overlays)) {
    raw.overlays.forEach((overlay: unknown, index) => {
      if (isRecord(overlay) && inBoard(overlay.row) && inBoard(overlay.col) && (overlay.hp === 1 || overlay.hp === 2)) {
        draft.hp[overlay.row]![overlay.col] = overlay.hp;
      } else {
        notes.push(`overlays[${index}] is invalid; dropped.`);
      }
    });
  } else if (raw.overlays !== undefined) {
    notes.push('overlays is not an array; no crumbs imported.');
  }
  return { draft, notes };
}

/* ------------------------------------------------------------------ */
/* JSON export in the same layout as content/levels/*.json.             */
/* ------------------------------------------------------------------ */

function inlineObject(obj: object): string {
  const parts = Object.entries(obj).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  return `{ ${parts.join(', ')} }`;
}

function block(items: object[]): string {
  if (items.length === 0) return '[]';
  return `[\n${items.map((item) => `    ${inlineObject(item)}`).join(',\n')}\n  ]`;
}

/** Pretty JSON matching the hand-written campaign files (2-space indent, one goal/overlay per line). */
export function formatLevelJson(level: LevelDefinition): string {
  const lines = [
    `  "id": ${JSON.stringify(level.id)}`,
    `  "version": ${JSON.stringify(level.version)}`,
    `  "rulesVersion": ${JSON.stringify(level.rulesVersion)}`,
    `  "rows": ${JSON.stringify(level.rows)}`,
    `  "cols": ${JSON.stringify(level.cols)}`,
    `  "allowedTypes": [${level.allowedTypes.map((t) => JSON.stringify(t)).join(', ')}]`,
    `  "moveLimit": ${JSON.stringify(level.moveLimit)}`,
    `  "goals": ${block(level.goals)}`,
    `  "overlays": ${block(level.overlays)}`,
  ];
  if (level.tutorialId !== undefined) lines.push(`  "tutorialId": ${JSON.stringify(level.tutorialId)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

/** Order-insensitive comparison of two level definitions (overlays compared as a set). */
export function sameLevel(a: LevelDefinition, b: LevelDefinition): boolean {
  const norm = (level: LevelDefinition) =>
    formatLevelJson({
      ...level,
      allowedTypes: sortTypes(level.allowedTypes),
      overlays: [...level.overlays].sort((x, y) => x.row - y.row || x.col - y.col),
    });
  return norm(a) === norm(b);
}

/* ------------------------------------------------------------------ */
/* Editor hints: non-schema advice. validateLevel errors are separate.  */
/* ------------------------------------------------------------------ */

export function editorHints(draft: Draft, campaign: readonly LevelDefinition[]): string[] {
  const hints: string[] = [];
  const level = draftToLevel(draft);
  const types = draft.allowedTypes.length;
  if (types >= EDITOR_MIN_TYPES && types <= EDITOR_MAX_TYPES && (types < 5 || types > 6)) {
    hints.push(`Campaign levels use 5–6 food types (GAME_SPEC §2); this draft has ${types}.`);
  }
  const overlayCount = level.overlays.length;
  const crumbsGoal = draft.goals.find((goal) => goal.kind === 'clearCrumbs');
  if (overlayCount > 0 && !crumbsGoal) {
    hints.push(`${overlayCount} crumb cells but no clearCrumbs goal: crumbs are decoration only.`);
  }
  if (crumbsGoal && Number.isInteger(crumbsGoal.count) && crumbsGoal.count < overlayCount) {
    hints.push(`clearCrumbs requires ${crumbsGoal.count} of ${overlayCount} crumb cells (not all).`);
  }
  const twin = campaign.find((c) => c.id === level.id);
  if (twin) {
    if (sameLevel(twin, level)) {
      hints.push(`Identical to campaign ${twin.id} v${twin.version}.`);
    } else if (twin.version === level.version) {
      hints.push(
        `Differs from campaign ${twin.id} v${twin.version} but keeps the same version: a changed level must get a new version (never mutate a published level).`,
      );
    } else {
      hints.push(`Variant of campaign ${twin.id} (campaign v${twin.version}, draft v${level.version}).`);
    }
  }
  if (level.tutorialId !== undefined) hints.push('tutorialId is set: campaign levels must not set tutorialId.');
  return hints;
}
