
-- Add new columns to contracts table
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MAD',
  ADD COLUMN IF NOT EXISTS payment_structure text DEFAULT 'one-time',
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.cohorts(id),
  ADD COLUMN IF NOT EXISTS budget_line_id uuid REFERENCES public.budget_lines(id);

-- Update type default
ALTER TABLE public.contracts ALTER COLUMN type SET DEFAULT 'service provider';

-- Update status default  
ALTER TABLE public.contracts ALTER COLUMN status SET DEFAULT 'Draft';

-- Add unique constraint to prevent duplicate vendor+title
CREATE UNIQUE INDEX IF NOT EXISTS contracts_vendor_title_unique ON public.contracts (vendor_id, title) WHERE vendor_id IS NOT NULL;

-- Contract Payments table
CREATE TABLE public.contract_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  status text NOT NULL DEFAULT 'pending',
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.contract_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Contract Payments"
  ON public.contract_payments FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- Contract Milestones table
CREATE TABLE public.contract_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  payment_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.contract_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Contract Milestones"
  ON public.contract_milestones FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- Contract Links table
CREATE TABLE public.contract_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text,
  url text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.contract_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Contract Links"
  ON public.contract_links FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- Contract Documents table
CREATE TABLE public.contract_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Contract Documents"
  ON public.contract_documents FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- Storage bucket for contract documents
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-documents', 'contract-documents', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users can upload contract docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contract-documents');

CREATE POLICY "Auth users can view contract docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contract-documents');

CREATE POLICY "Auth users can delete contract docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contract-documents');
