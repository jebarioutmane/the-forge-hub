/**
 * Cohort year utilities.
 *
 * Storage format (DB): "YYYY-YYYY+1" with hyphen, e.g. "2025-2026".
 * Display format (UI): "YYYY–YYYY+1" with en-dash, e.g. "2025–2026".
 *
 * The active cohort is time-aware via a configurable start month (default
 * September = 9 for our program). If today's month >= startMonth, the active
 * cohort starts this year; otherwise it started last year.
 */

export const DEFAULT_COHORT_START_MONTH = 9; // September
export const DEFAULT_COHORT_END_MONTH = 5; // May

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a stored cohort label ("2025-2026") for display ("2025–2026"). */
export function formatCohortLabel(stored: string | null | undefined): string {
  if (!stored) return "";
  return stored.replace("-", "\u2013");
}

/** Parse a stored cohort string into start/end years. */
export function parseCohort(stored: string): { startYear: number; endYear: number } | null {
  const m = stored.match(/^(\d{4})-(\d{4})$/);
  if (!m) return null;
  return { startYear: Number(m[1]), endYear: Number(m[2]) };
}

/** Compute the active cohort label (stored format) given a start month. */
export function computeActiveCohort(
  startMonth: number = DEFAULT_COHORT_START_MONTH,
  today: Date = new Date(),
): string {
  const m = today.getMonth() + 1; // 1..12
  const y = today.getFullYear();
  const startYear = m >= startMonth ? y : y - 1;
  return `${startYear}-${startYear + 1}`;
}

/** Build a "Sep 2025 – May 2026" tooltip from a cohort + month config. */
export function formatCohortWindow(
  stored: string,
  startMonth: number = DEFAULT_COHORT_START_MONTH,
  endMonth: number = DEFAULT_COHORT_END_MONTH,
): string {
  const p = parseCohort(stored);
  if (!p) return formatCohortLabel(stored);
  return `${MONTH_SHORT[startMonth - 1]} ${p.startYear} \u2013 ${MONTH_SHORT[endMonth - 1]} ${p.endYear}`;
}

/** Build a centered window of cohort labels: prev N, current, next N. */
export function buildVisibleCohorts(activeStored: string, before = 2, after = 2): string[] {
  const p = parseCohort(activeStored);
  if (!p) return [activeStored];
  const out: string[] = [];
  for (let i = -before; i <= after; i++) {
    const s = p.startYear + i;
    out.push(`${s}-${s + 1}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Backward-compatible legacy exports (used in places not yet migrated to the
// useCohorts() hook). Computed from the default start month (September).
// ---------------------------------------------------------------------------

/** Returns the active academic cohort label using the default start month. */
export function getCurrentCohortYear(): string {
  return computeActiveCohort();
}

/** Visible 5-cohort window centered on the current active cohort. */
export const COHORT_YEARS = buildVisibleCohorts(getCurrentCohortYear()).reverse();

/** Same compact window, used by stipends. */
export const STIPEND_YEARS = buildVisibleCohorts(getCurrentCohortYear());
