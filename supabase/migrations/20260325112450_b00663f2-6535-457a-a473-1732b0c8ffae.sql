
-- Add founder_id to stipends (relational link to founders)
ALTER TABLE public.stipends ADD COLUMN IF NOT EXISTS founder_id uuid REFERENCES public.founders(id) ON DELETE SET NULL;

-- Add vendor_id to contracts (relational link to vendors)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Add vendor_id and category_id to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.budget_categories(id) ON DELETE SET NULL;
