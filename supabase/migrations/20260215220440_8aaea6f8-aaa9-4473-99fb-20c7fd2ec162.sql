
CREATE TABLE public.stipends (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  founder_name text NOT NULL,
  base_amount numeric NOT NULL,
  deductions numeric NOT NULL DEFAULT 0,
  final_payout numeric GENERATED ALWAYS AS (base_amount - deductions) STORED,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stipends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Stipends"
  ON public.stipends
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated'::text);
