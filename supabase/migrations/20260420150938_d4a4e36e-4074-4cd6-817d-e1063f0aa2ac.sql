-- 1. program_events table
CREATE TABLE public.program_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'General',
  cohort_year TEXT NOT NULL DEFAULT '2026-2027',
  location TEXT,
  linked_founder_id UUID,
  links JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.program_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Program Events"
ON public.program_events
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_program_events_cohort ON public.program_events(cohort_year);
CREATE INDEX idx_program_events_start ON public.program_events(start_time);

-- 2. program_event_attendance table
CREATE TABLE public.program_event_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.program_events(id) ON DELETE CASCADE,
  founder_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'Present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, founder_id)
);

ALTER TABLE public.program_event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Program Attendance"
ON public.program_event_attendance
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_program_attendance_event ON public.program_event_attendance(event_id);
CREATE INDEX idx_program_attendance_founder ON public.program_event_attendance(founder_id);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_program_events_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_program_events_updated
BEFORE UPDATE ON public.program_events
FOR EACH ROW
EXECUTE FUNCTION public.set_program_events_updated_at();

-- 4. Seed pre-filled events
INSERT INTO public.program_events (title, description, start_time, end_time, event_type, cohort_year, location)
VALUES
  ('GITEX Africa Marrakech', 'Major tech exhibition — The Forge cohort participation.', '2026-04-07 09:00:00+00', '2026-04-09 18:00:00+00', 'Travel', '2026-2027', 'Marrakech, Morocco'),
  ('Nexus Luxembourg', 'Nexus startup summit — cohort showcase and networking.', '2026-06-09 09:00:00+00', '2026-06-11 18:00:00+00', 'Travel', '2026-2027', 'Luxembourg');