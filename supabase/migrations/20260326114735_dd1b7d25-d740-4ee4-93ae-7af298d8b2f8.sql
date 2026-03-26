CREATE POLICY "Team Access Stipend Records"
ON public.stipend_records
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated'::text)
WITH CHECK (auth.role() = 'authenticated'::text);