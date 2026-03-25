-- Add RLS policies for expense_categories
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Expense Categories"
ON public.expense_categories FOR ALL TO authenticated
USING (auth.role() = 'authenticated'::text)
WITH CHECK (auth.role() = 'authenticated'::text);

-- Add RLS policies for expense_category_links
ALTER TABLE public.expense_category_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Expense Category Links"
ON public.expense_category_links FOR ALL TO authenticated
USING (auth.role() = 'authenticated'::text)
WITH CHECK (auth.role() = 'authenticated'::text);

-- Add RLS policies for budget_lines
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Budget Lines"
ON public.budget_lines FOR ALL TO authenticated
USING (auth.role() = 'authenticated'::text)
WITH CHECK (auth.role() = 'authenticated'::text);