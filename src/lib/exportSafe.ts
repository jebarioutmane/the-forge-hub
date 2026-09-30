/**
 * Neutralises spreadsheet formula injection in exported cells.
 * Strings starting with = + - @ tab or CR are prefixed with an apostrophe
 * so Excel / Google Sheets treat them as text. Non-strings pass through untouched.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function exportSafe<T>(value: T): T | string {
  if (typeof value === "string" && FORMULA_TRIGGER.test(value)) return `'${value}`;
  return value;
}

/** Applies exportSafe to every value of a row object. */
export function exportSafeRow<T extends Record<string, unknown>>(row: T): T {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(row)) out[k] = exportSafe(v);
  return out as T;
}
