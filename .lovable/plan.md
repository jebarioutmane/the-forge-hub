## Cohort Year Standardization

Right now cohort years are generated from a code constant (`COHORT_YEARS` in `src/lib/cohortYears.ts`), 80+ entries, and "current" always equals `today.year-today.year+1`. That breaks for your real program: a cohort that runs **Nov 2025 → Jun 2026** should already be the active "2025–2026" cohort by November, not wait until January.

This plan promotes the existing `cohorts` table to the single source of truth, makes the active cohort time-aware via a configurable rollover month, and standardizes the label to **"YYYY–YYYY+1"** (with en-dash) everywhere.

### What you'll see in the app

1. **Settings → Cohort Settings** (new section)
  - "Cohort start month" picker (default: November)
  - "Cohort end month" picker (default: June) — display only, used for tooltips
  - List of all cohorts (Name, Start date, End date, Status: Past / Active / Upcoming) with Add / Edit / Delete
  - Each cohort row shows a colored Active/Upcoming/Past badge
2. **Every cohort dropdown** (Founders Source, Tracking, Evaluation, Operations Source, Stipends, anywhere else)
  - Pulls from the `cohorts` table instead of the hardcoded array
  - Shows only **5 cohorts**: previous 2, current, next 2 — sorted newest-first
  - Default selected = the **active** cohort based on today's date and the configured start month
  - Label format: **"2025–2026"** (en-dash, full years)
  - Tooltip on hover shows the actual window: "Nov 2025 – Jun 2026"
3. **Founder cards & badges** display the same standardized label

### How "current cohort" is computed

```text
configured start month = November (default, editable in Settings)

if today.month >= startMonth:
    activeCohort = "{today.year}–{today.year + 1}"
else:
    activeCohort = "{today.year - 1}–{today.year}"
```

So today (April 2026) the active cohort is **2025–2026**. On Nov 1 2026 it flips to **2026–2027** automatically.

### Database changes (one migration)

1. **Extend `cohorts` table** with:
  - `label TEXT UNIQUE` (e.g. "2025-2026") — the canonical string written into all `cohort_year` columns
  - `start_date DATE`, `end_date DATE`
  - `is_archived BOOLEAN DEFAULT false`
2. **Create `app_settings` table** (key/value, single row pattern) to store:
  - `cohort_start_month` (int, 1–12, default 11)
  - `cohort_end_month` (int, 1–12, default 6)
3. **Backfill**: insert rows for every existing distinct value in `founders.cohort_year`, `stipend_records.cohort_year`, `program_events.cohort_year`, `budget_transactions.cohort_year` — plus prev 2 / next 2 around the active one.
4. **Normalize existing data** — your DB already uses `"2025-2026"` / `"2026-2027"` (good). No row updates needed; the visual en-dash is render-only.

### Code changes

- `**src/lib/cohortYears.ts**` — replace static array with helpers:
  - `formatCohortLabel(stored: string)` → `"2025–2026"` (en-dash for display)
  - `parseCohort(stored: string)` → `{ startYear, endYear }`
  - `computeActiveCohort(startMonth: number, today = new Date())` → stored label
  - Keep stored value as `"2025-2026"` (hyphen) for DB compatibility — display only swaps to en-dash
- **New hook `useCohorts()**` in `src/hooks/useCohorts.ts`:
  - Fetches cohorts from DB, returns `{ all, visible (prev2…next2), active, startMonth }`
  - Used by every dropdown and every "default selected cohort" call site
- **New `<CohortSelect>` component** wrapping the standard Shadcn Select — drop-in replacement for the ~6 manually-built selects today, includes the hover tooltip
- **Settings page** — add a "Cohorts" section: month pickers + cohort CRUD table
- **Replace `getCurrentCohortYear()` and `COHORT_YEARS`/`STIPEND_YEARS` usages** in:
  - `src/pages/founders/Source.tsx`
  - `src/pages/founders/Tracking.tsx`
  - `src/pages/founders/Evaluation.tsx`
  - `src/pages/operations/Source.tsx`
  - `src/pages/operations/Stipends.tsx`
  - `src/components/FounderCard.tsx` (display formatting only)
- **GlobalSearch** — index the `cohorts` table so searching "2025" or "2026-2027" jumps to the right place

### Out of scope (not changed)

- The `cohort` free-text column on `founders` (used as a separate label like "Cohort A") — left alone
- The legacy `fiscal_year` integer on `budgets` — left alone
- No retroactive renaming of stored cohort_year values; only display changes  
  
Ok great, but the default cohort currently across the whole website should be 2025-2026 since we started around September 2025 and will end in the end of May 2026. 