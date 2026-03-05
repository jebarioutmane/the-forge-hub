-- Fix founders table: replace permissive USING(true) with auth check
DROP POLICY IF EXISTS "Team Access" ON public.founders;
CREATE POLICY "Team Access Founders"
  ON public.founders
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix stakeholders table
DROP POLICY IF EXISTS "Team Access Stakeholders" ON public.stakeholders;
CREATE POLICY "Team Access Stakeholders"
  ON public.stakeholders
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix founder_evaluations table
DROP POLICY IF EXISTS "Team Access Evaluations" ON public.founder_evaluations;
CREATE POLICY "Team Access Evaluations"
  ON public.founder_evaluations
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix founder_progress table
DROP POLICY IF EXISTS "Team Access Progress" ON public.founder_progress;
CREATE POLICY "Team Access Progress"
  ON public.founder_progress
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix founders_tracking table
DROP POLICY IF EXISTS "Team Access" ON public.founders_tracking;
CREATE POLICY "Team Access Tracking"
  ON public.founders_tracking
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix event_attendance table
DROP POLICY IF EXISTS "Team Access Attendance" ON public.event_attendance;
CREATE POLICY "Team Access Attendance"
  ON public.event_attendance
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix event_logistics table
DROP POLICY IF EXISTS "Team Access Logistics" ON public.event_logistics;
CREATE POLICY "Team Access Logistics"
  ON public.event_logistics
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix resource_library table
DROP POLICY IF EXISTS "Team Access Library" ON public.resource_library;
CREATE POLICY "Team Access Library"
  ON public.resource_library
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix tags table
DROP POLICY IF EXISTS "Team Access Tags" ON public.tags;
CREATE POLICY "Team Access Tags"
  ON public.tags
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix mentors table
DROP POLICY IF EXISTS "Team Access Mentors" ON public.mentors;
CREATE POLICY "Team Access Mentors"
  ON public.mentors
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix venture_associates table
DROP POLICY IF EXISTS "Team Access" ON public.venture_associates;
CREATE POLICY "Team Access Associates"
  ON public.venture_associates
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix countries table
DROP POLICY IF EXISTS "Team Access Countries" ON public.countries;
CREATE POLICY "Team Access Countries"
  ON public.countries
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix mentoring_sessions: remove duplicate permissive policies
DROP POLICY IF EXISTS "Team Access Mentoring" ON public.mentoring_sessions;
DROP POLICY IF EXISTS "Team Access Sessions" ON public.mentoring_sessions;