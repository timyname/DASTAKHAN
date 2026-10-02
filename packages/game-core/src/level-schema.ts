/**
 * Shared level schema validator (GAME_SPEC §6, §9; prompt 06).
 *
 * One hand-written validator is used by the runtime content loader, the internal
 * level editor and the later backend. It has no dependencies and never throws:
 * every problem is reported as a readable message prefixed with its JSON path,
 * e.g. `goals[1].count must be a positive integer`.
 */
import { BOARD_SIZE, FOOD_TYPES, RULES_VERSION } from './types.ts';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Inclusive range for the number of allowed food types. Campaign levels use 5–6
 * (GAME_SPEC §2); the schema accepts a slightly wider editor range.
 */
export const MIN_ALLOWED_TYPES = 4;
export const MAX_ALLOWED_TYPES = 8;
/** Inclusive move limit range. */
export const MIN_MOVE_LIMIT = 1;
export const MAX_MOVE_LIMIT = 99;

const LEVEL_KEYS = [
  'id',
  'version',
  'rulesVersion',
  'rows',
  'cols',
  'allowedTypes',
  'moveLimit',
  'goals',
  'overlays',
  'tutorialId',
] as const;
const OPTIONAL_LEVEL_KEYS: ReadonlySet<string> = new Set(['tutorialId']);
const COLLECT_GOAL_KEYS = ['kind', 'type', 'count'] as const;
const CRUMBS_GOAL_KEYS = ['kind', 'count'] as const;
const OVERLAY_KEYS = ['row', 'col', 'hp'] as const;
const FOOD_TYPE_SET: ReadonlySet<string> = new Set(FOOD_TYPES);

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return typeof value;
}

/** Reports keys outside `allowed` (sorted, so messages are deterministic). */
function checkUnknownKeys(obj: PlainObject, allowed: readonly string[], path: string, errors: string[]): void {
  const unknown = Object.keys(obj)
    .filter((key) => !allowed.includes(key))
    .sort();
  for (const key of unknown) {
    errors.push(`${path ? `${path}.` : ''}${key} is not an allowed property`);
  }
}

function checkRequiredKeys(
  obj: PlainObject,
  required: readonly string[],
  path: string,
  errors: string[],
): void {
  for (const key of required) {
    if (!(key in obj) || obj[key] === undefined) {
      errors.push(`${path ? `${path}.` : ''}${key} is required`);
    }
  }
}

/**
 * Validates allowedTypes. Returns the set of allowed types when every entry is a
 * known food type (duplicates are reported but still collected), otherwise null.
 */
function validateAllowedTypes(value: unknown, errors: string[]): ReadonlySet<string> | null {
  if (!Array.isArray(value)) {
    errors.push(`allowedTypes must be an array of food types, got ${describe(value)}`);
    return null;
  }
  const seen = new Set<string>();
  let allKnown = true;
  value.forEach((entry: unknown, index) => {
    if (typeof entry !== 'string' || !FOOD_TYPE_SET.has(entry)) {
      allKnown = false;
      errors.push(
        `allowedTypes[${index}] must be one of ${FOOD_TYPES.join(', ')}, got ${describe(entry)}`,
      );
      return;
    }
    if (seen.has(entry)) {
      errors.push(`allowedTypes[${index}] duplicates "${entry}"`);
      return;
    }
    seen.add(entry);
  });
  if (value.length === 0) {
    errors.push('allowedTypes must not be empty');
  } else if (seen.size < MIN_ALLOWED_TYPES) {
    errors.push(`allowedTypes must contain at least ${MIN_ALLOWED_TYPES} distinct food types, got ${seen.size}`);
  } else if (value.length > MAX_ALLOWED_TYPES) {
    errors.push(`allowedTypes must contain at most ${MAX_ALLOWED_TYPES} food types, got ${value.length}`);
  }
  return allKnown ? seen : null;
}

/** Validates overlays. Returns the number of overlay cells (array length) or null if not an array. */
function validateOverlays(value: unknown, errors: string[]): number | null {
  if (!Array.isArray(value)) {
    errors.push(`overlays must be an array, got ${describe(value)}`);
    return null;
  }
  const max = BOARD_SIZE - 1;
  const positions = new Map<string, number>();
  value.forEach((entry: unknown, index) => {
    const path = `overlays[${index}]`;
    if (!isPlainObject(entry)) {
      errors.push(`${path} must be an object with row, col and hp, got ${describe(entry)}`);
      return;
    }
    checkUnknownKeys(entry, OVERLAY_KEYS, path, errors);
    checkRequiredKeys(entry, OVERLAY_KEYS, path, errors);
    const { row, col, hp } = entry;
    const rowOk = isInteger(row) && row >= 0 && row <= max;
    const colOk = isInteger(col) && col >= 0 && col <= max;
    if (row !== undefined && !rowOk) {
      errors.push(`${path}.row must be an integer from 0 to ${max}, got ${describe(row)}`);
    }
    if (col !== undefined && !colOk) {
      errors.push(`${path}.col must be an integer from 0 to ${max}, got ${describe(col)}`);
    }
    if (hp !== undefined && hp !== 1 && hp !== 2) {
      errors.push(`${path}.hp must be 1 or 2, got ${describe(hp)}`);
    }
    if (rowOk && colOk) {
      const key = `${row},${col}`;
      const first = positions.get(key);
      if (first !== undefined) {
        errors.push(`${path} duplicates position (${row},${col}) of overlays[${first}]`);
      } else {
        positions.set(key, index);
      }
    }
  });
  return value.length;
}

function validateGoals(
  value: unknown,
  allowedTypes: ReadonlySet<string> | null,
  overlayCount: number | null,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push(`goals must be an array, got ${describe(value)}`);
    return;
  }
  if (value.length === 0) {
    errors.push('goals must contain at least one goal');
    return;
  }
  const collectTypes = new Map<string, number>();
  let crumbsIndex: number | null = null;
  value.forEach((goal: unknown, index) => {
    const path = `goals[${index}]`;
    if (!isPlainObject(goal)) {
      errors.push(`${path} must be an object, got ${describe(goal)}`);
      return;
    }
    const { kind, count } = goal;
    if (kind === 'collect') {
      checkUnknownKeys(goal, COLLECT_GOAL_KEYS, path, errors);
      checkRequiredKeys(goal, COLLECT_GOAL_KEYS, path, errors);
      const { type } = goal;
      if (type !== undefined) {
        if (typeof type !== 'string' || !FOOD_TYPE_SET.has(type)) {
          errors.push(`${path}.type must be one of ${FOOD_TYPES.join(', ')}, got ${describe(type)}`);
        } else {
          if (allowedTypes !== null && !allowedTypes.has(type)) {
            errors.push(`${path}.type "${type}" is not in allowedTypes`);
          }
          const first = collectTypes.get(type);
          if (first !== undefined) {
            errors.push(`${path} duplicates the collect goal for "${type}" in goals[${first}]`);
          } else {
            collectTypes.set(type, index);
          }
        }
      }
      if (count !== undefined && !isPositiveInteger(count)) {
        errors.push(`${path}.count must be a positive integer, got ${describe(count)}`);
      }
    } else if (kind === 'clearCrumbs') {
      checkUnknownKeys(goal, CRUMBS_GOAL_KEYS, path, errors);
      checkRequiredKeys(goal, CRUMBS_GOAL_KEYS, path, errors);
      if (crumbsIndex !== null) {
        errors.push(`${path} duplicates the clearCrumbs goal in goals[${crumbsIndex}]`);
      } else {
        crumbsIndex = index;
      }
      if (count !== undefined) {
        if (!isPositiveInteger(count)) {
          errors.push(`${path}.count must be a positive integer, got ${describe(count)}`);
        } else if (overlayCount !== null && count > overlayCount) {
          errors.push(
            `${path}.count (${count}) exceeds the number of overlay cells (${overlayCount})`,
          );
        }
      }
    } else if (kind === undefined) {
      errors.push(`${path}.kind is required`);
    } else {
      errors.push(`${path}.kind must be "collect" or "clearCrumbs", got ${describe(kind)}`);
    }
  });
}

/**
 * Validates an untrusted value against the LevelDefinition contract.
 * `ok` is true exactly when `errors` is empty; then the value may be treated as a
 * LevelDefinition.
 */
export function validateLevel(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    errors.push(`level must be a plain object, got ${describe(input)}`);
    return { ok: false, errors };
  }

  checkUnknownKeys(input, LEVEL_KEYS, '', errors);
  checkRequiredKeys(
    input,
    LEVEL_KEYS.filter((key) => !OPTIONAL_LEVEL_KEYS.has(key)),
    '',
    errors,
  );

  const { id, version, rulesVersion, rows, cols, allowedTypes, moveLimit, goals, overlays, tutorialId } =
    input;

  if (id !== undefined && !isNonEmptyString(id)) {
    errors.push(`id must be a non-empty string, got ${describe(id)}`);
  }
  if (version !== undefined && !isPositiveInteger(version)) {
    errors.push(`version must be a positive integer, got ${describe(version)}`);
  }
  if (rulesVersion !== undefined && !(isInteger(rulesVersion) && rulesVersion >= 1 && rulesVersion <= RULES_VERSION)) {
    errors.push(`rulesVersion must be an integer from 1 to ${RULES_VERSION}, got ${describe(rulesVersion)}`);
  }
  if (rows !== undefined && rows !== BOARD_SIZE) {
    errors.push(`rows must be ${BOARD_SIZE}, got ${describe(rows)}`);
  }
  if (cols !== undefined && cols !== BOARD_SIZE) {
    errors.push(`cols must be ${BOARD_SIZE}, got ${describe(cols)}`);
  }
  if (
    moveLimit !== undefined &&
    !(isInteger(moveLimit) && moveLimit >= MIN_MOVE_LIMIT && moveLimit <= MAX_MOVE_LIMIT)
  ) {
    errors.push(`moveLimit must be an integer from ${MIN_MOVE_LIMIT} to ${MAX_MOVE_LIMIT}, got ${describe(moveLimit)}`);
  }
  if (tutorialId !== undefined && !isNonEmptyString(tutorialId)) {
    errors.push(`tutorialId must be a non-empty string when present, got ${describe(tutorialId)}`);
  }

  const allowed = allowedTypes === undefined ? null : validateAllowedTypes(allowedTypes, errors);
  const overlayCount = overlays === undefined ? null : validateOverlays(overlays, errors);
  if (goals !== undefined) validateGoals(goals, allowed, overlayCount, errors);

  return { ok: errors.length === 0, errors };
}
