
-- 1. Fix avatar storage: add ownership checks to INSERT and UPDATE policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Fix history_logs: replace permissive INSERT with scoped policy
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.history_logs;

CREATE POLICY "Authenticated users can insert own log entries"
  ON public.history_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
  );

-- 3. Fix profiles role escalation: replace user update policy to block role changes
DROP POLICY IF EXISTS "Users can update own profile no role change" ON public.profiles;

CREATE POLICY "Users can update own profile no role change"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );
