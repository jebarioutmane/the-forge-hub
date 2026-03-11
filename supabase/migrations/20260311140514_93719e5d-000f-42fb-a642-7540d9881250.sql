
-- 1. Create a security definer function to safely check if a user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

-- 2. Create a security definer function to update roles (server-side admin check)
CREATE OR REPLACE FUNCTION public.update_user_role(_target_id uuid, _new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins/super_admins or the hardcoded super admin can change roles
  IF NOT (
    public.is_admin(auth.uid())
    OR (auth.jwt() ->> 'email') = 'outmane.jebari@um6p.ma'
  ) THEN
    RAISE EXCEPTION 'Only administrators can change user roles';
  END IF;

  -- Validate role value
  IF _new_role NOT IN ('user', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role: %', _new_role;
  END IF;

  UPDATE public.profiles SET role = _new_role WHERE id = _target_id;
END;
$$;

-- 3. Drop the existing permissive "Users can update own profile" policy and replace
--    with one that prevents users from changing their own role column
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile no role change"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Either the role hasn't changed
      role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      -- Or the caller is an admin / super admin
      OR public.is_admin(auth.uid())
      -- Or the caller is the hardcoded super admin
      OR (auth.jwt() ->> 'email') = 'outmane.jebari@um6p.ma'
    )
  );
