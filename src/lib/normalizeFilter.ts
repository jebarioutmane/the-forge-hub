/**
 * Global case-insensitive filter normalization utilities.
 *
 * Use `getUniqueFilterValues` to extract deduplicated, title-cased options
 * from raw data for filter dropdowns.
 *
 * Use `matchesFilter` for case-insensitive filter comparison.
 */

/** Convert a string to Title Case: "hello world" → "Hello World" */
export function toTitleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (match) => match.toUpperCase());
}

/**
 * Extract unique, title-cased values from an array of raw strings.
 * Deduplicates case-insensitively: ["Outmane", "outmane", "OUTMANE"] → ["Outmane"]
 */
export function getUniqueFilterValues(values: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>(); // lowercased → title-cased display
  for (const raw of values) {
    if (!raw || !raw.trim()) continue;
    const key = raw.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, toTitleCase(raw));
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Case-insensitive filter match.
 * Returns true if the item value matches the selected filter value
 * (ignoring case and whitespace).
 * If filterValue is "all", always returns true.
 */
export function matchesFilter(
  itemValue: string | null | undefined,
  filterValue: string
): boolean {
  if (filterValue === "all") return true;
  if (!itemValue) return false;
  return itemValue.trim().toLowerCase() === filterValue.trim().toLowerCase();
}

/**
 * Case-insensitive check for multi-select filters (e.g., countries).
 * Returns true if any of the item's values match any of the selected filter values.
 */
export function matchesMultiFilter(
  itemValues: (string | null | undefined)[],
  filterValues: string[]
): boolean {
  if (filterValues.length === 0) return true;
  const filterSet = new Set(filterValues.map((v) => v.trim().toLowerCase()));
  return itemValues.some((v) => v && filterSet.has(v.trim().toLowerCase()));
}
