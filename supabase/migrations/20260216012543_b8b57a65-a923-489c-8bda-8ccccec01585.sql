
-- Add RLS policies for events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Events"
ON public.events
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Add RLS policies for mentoring_sessions table
ALTER TABLE public.mentoring_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team Access Mentoring Sessions"
ON public.mentoring_sessions
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
