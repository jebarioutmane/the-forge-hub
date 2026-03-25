
-- Add RLS policies for vendors table (currently has NO policies)
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Vendors"
ON public.vendors FOR ALL TO authenticated
USING (auth.role() = 'authenticated'::text)
WITH CHECK (auth.role() = 'authenticated'::text);
