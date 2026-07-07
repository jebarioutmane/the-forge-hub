import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";

function relativeCountdown(target: Date): string {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "starting now";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days >= 2) return `in ${days} days`;
  if (days === 1) return `in 1 day · ${hours}h`;
  if (hours >= 1) return `in ${hours}h ${mins}m`;
  if (mins >= 1) return `in ${mins} min`;
  return "in under a minute";
}

export default function EventCountdowns() {
  const navigate = useNavigate();
  const { selectedCohortId, selectedCohort } = useCohort();
  const [, setTick] = useState(0);

  // Re-render every 60s so the relative countdown stays fresh.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const cohortScope = selectedCohortId === ALL_COHORTS ? "all" : (selectedCohort?.label ?? "");

  const { data: nextEvent } = useQuery({
    queryKey: ["next-upcoming-event", cohortScope],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("events")
        .select("id, name, start_time, start_date")
        .eq("is_archived", false)
        .not("status", "in", '("Completed","done","deleted")')
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(1);
      if (cohortScope !== "all" && cohortScope) q = q.eq("cohort_year", cohortScope);
      const { data, error } = await q;
      if (error) throw error;
      return data?.[0] ?? null;
    },
    refetchInterval: 5 * 60_000,
  });

  const startsAt = nextEvent?.start_time
    ? parseISO(nextEvent.start_time)
    : nextEvent?.start_date
      ? parseISO(nextEvent.start_date)
      : null;

  if (!nextEvent || !startsAt) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        <span>No upcoming events</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/events/calendar?event=${nextEvent.id}`)}
      className="group inline-flex items-center gap-3 rounded-full border border-border/70 bg-background/60 hover:bg-accent/40 transition-colors px-4 py-2 text-left max-w-full"
    >
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        Next up
      </span>
      <span className="h-3 w-px bg-border/80" aria-hidden />
      <span
        className="text-sm text-foreground truncate max-w-[240px]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {nextEvent.name}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {format(startsAt, "MMM d")}
      </span>
      <span className="text-xs font-medium text-primary tabular-nums">
        {relativeCountdown(startsAt)}
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}
