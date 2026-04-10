/**
 * Generates cohort year labels in "YYYY-YYYY+1" academic format.
 * e.g. "2020-2021", "2021-2022", ...
 */
export const COHORT_YEARS = Array.from({ length: 81 }, (_, i) => {
  const start = 2020 + i;
  return `${start}-${start + 1}`;
});

const currentYear = new Date().getFullYear();

/** Returns the current academic cohort year, e.g. "2025-2026" */
export function getCurrentCohortYear(): string {
  return `${currentYear}-${currentYear + 1}`;
}

/** Short list for stipends (5 years centered on current) */
export const STIPEND_YEARS = Array.from({ length: 5 }, (_, i) => {
  const start = currentYear - 2 + i;
  return `${start}-${start + 1}`;
});
