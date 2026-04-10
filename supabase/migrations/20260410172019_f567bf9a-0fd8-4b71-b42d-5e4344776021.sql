-- Update founders cohort_year from single year to academic year format
UPDATE public.founders SET cohort_year = '2025-2026' WHERE cohort_year = '2026';
UPDATE public.founders SET cohort_year = '2024-2025' WHERE cohort_year = '2025';
UPDATE public.founders SET cohort_year = '2023-2024' WHERE cohort_year = '2024';

-- Update stipend_records
UPDATE public.stipend_records SET cohort_year = '2025-2026' WHERE cohort_year = '2026';
UPDATE public.stipend_records SET cohort_year = '2024-2025' WHERE cohort_year = '2025';
UPDATE public.stipend_records SET cohort_year = '2023-2024' WHERE cohort_year = '2024';

-- Update stipend_records payment_month references too
UPDATE public.stipend_records SET payment_month = REPLACE(payment_month, ' 2026', ' 2025-2026') WHERE payment_month LIKE '% 2026';
UPDATE public.stipend_records SET payment_month = REPLACE(payment_month, ' 2025', ' 2025-2026') WHERE payment_month LIKE '% 2025' AND payment_month NOT LIKE '% 2025-2026';
UPDATE public.stipend_records SET payment_month = REPLACE(payment_month, ' 2024', ' 2024-2025') WHERE payment_month LIKE '% 2024' AND payment_month NOT LIKE '% 2024-2025';

-- Update cohorts table name
UPDATE public.cohorts SET name = '2025-2026' WHERE name = 'COHORT 2';

-- Change default for founders.cohort_year
ALTER TABLE public.founders ALTER COLUMN cohort_year SET DEFAULT to_char(CURRENT_DATE, 'YYYY') || '-' || to_char(CURRENT_DATE + interval '1 year', 'YYYY');