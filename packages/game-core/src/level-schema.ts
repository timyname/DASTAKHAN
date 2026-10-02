/**
 * TEMPORARY STUB — replaced by the shared level schema validator (prompt 06).
 * One validator is used by runtime, editor and the later backend.
 */
export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateLevel(_input: unknown): ValidationResult {
  return { ok: false, errors: ['not implemented'] };
}
