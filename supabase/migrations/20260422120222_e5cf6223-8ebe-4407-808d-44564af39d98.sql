-- 1. Extend cohorts table
ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Backfill labels from existing name/year if missing
UPDATE public.cohorts
SET label = COALESCE(label, name)
WHERE label IS NULL;

-- 2. Backfill cohort rows from all distinct cohort_year values across tables
INSERT INTO public.cohorts (name, year, label)
SELECT DISTINCT cy, CAST(SPLIT_PART(cy, '-', 1) AS INTEGER), cy
FROM (
  SELECT cohort_year AS cy FROM public.founders WHERE cohort_year IS NOT NULL
  UNION SELECT cohort_year FROM public.stipend_records WHERE cohort_year IS NOT NULL
  UNION SELECT cohort_year FROM public.program_events WHERE cohort_year IS NOT NULL
  UNION SELECT cohort_year FROM public.budget_transactions WHERE cohort_year IS NOT NULL
) AS d
WHERE cy ~ '^[0-9]{4}-[0-9]{4}$'
  AND NOT EXISTS (SELECT 1 FROM public.cohorts c WHERE c.label = d.cy);

-- Ensure prev2..next2 around 2025-2026 exist
INSERT INTO public.cohorts (name, year, label)
SELECT v.label, v.yr, v.label
FROM (VALUES
  ('2023-2024', 2023),
  ('2024-2025', 2024),
  ('2025-2026', 2025),
  ('2026-2027', 2026),
  ('2027-2028', 2027)
) AS v(label, yr)
WHERE NOT EXISTS (SELECT 1 FROM public.cohorts c WHERE c.label = v.label);

-- Set start_date / end_date defaults (Sep 1 – May 31) for rows missing them
UPDATE public.cohorts
SET start_date = COALESCE(start_date, MAKE_DATE(year, 9, 1)),
    end_date   = COALESCE(end_date, MAKE_DATE(year + 1, 5, 31))
WHERE label ~ '^[0-9]{4}-[0-9]{4}$';

-- Make label unique & required
ALTER TABLE public.cohorts ALTER COLUMN label SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cohorts_label_unique') THEN
    ALTER TABLE public.cohorts ADD CONSTRAINT cohorts_label_unique UNIQUE (label);
  END IF;
END $$;

-- 3. App settings table (key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Team read app_settings') THEN
    CREATE POLICY "Team read app_settings" ON public.app_settings
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Team write app_settings') THEN
    CREATE POLICY "Team write app_settings" ON public.app_settings
      FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Seed defaults: Sept start, May end (matches user's program)
INSERT INTO public.app_settings (key, value) VALUES
  ('cohort_start_month', '9'::jsonb),
  ('cohort_end_month', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;
