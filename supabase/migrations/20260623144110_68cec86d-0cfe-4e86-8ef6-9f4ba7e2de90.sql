
-- 1. Fix handle_new_user search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, status)
  VALUES (new.id, new.email, 'user', 'Active')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

-- 2. Restrict app_settings writes to admins
DROP POLICY IF EXISTS "Team write app_settings" ON public.app_settings;

CREATE POLICY "Admins manage app_settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3. Replace hardcoded-email SuperAdmin profile policy with role-based check
DROP POLICY IF EXISTS "SuperAdmin can update all profiles" ON public.profiles;

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 4. Remove broad listing policy on avatars; public URLs still work via CDN
DROP POLICY IF EXISTS "Avatars are viewable by everyone" ON storage.objects;
