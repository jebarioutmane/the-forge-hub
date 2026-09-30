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

/**
 * One CSV cell: formula guard first, then RFC 4180 quoting.
 * Numbers stay unquoted; null/undefined become an empty cell.
 */
export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const s = String(exportSafe(value instanceof Date ? value.toISOString() : String(value)));
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Joins a row of values into one CSV line. */
export function toCsvRow(values: unknown[]): string {
  return values.map(toCsvCell).join(",");
}
