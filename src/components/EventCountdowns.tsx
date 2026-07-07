import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays, MapPin, Users, GraduationCap, Presentation, Sparkles, Coffee, Handshake,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";

type UpcomingEvent = {
  id: string;
  name: string;
  start_time: string | null;
  start_date: string | null;
  event_type: string | null;
  location: string | null;
};

function relativeCountdown(target: Date): string {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "starting now";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days >= 2) return `in ${days} days`;
  if (days === 1) return `in 1 day`;
  if (hours >= 1) return `in ${hours}h ${mins}m`;
  if (mins >= 1) return `in ${mins} min`;
  return "in under a minute";
}

const TYPE_ICON: Record<string, typeof CalendarDays> = {
  Masterclass: GraduationCap,
  Mentorship: Handshake,
  "Pitch Session": Presentation,
  Networking: Users,
  Social: Coffee,
  General: Sparkles,
};

function iconFor(type: string | null | undefined) {
  return TYPE_ICON[type || "General"] || CalendarDays;
}

export default function EventCountdowns() {
  const navigate = useNavigate();
  const { selectedCohortId, selectedCohort } = useCohort();
  const [, setTick] = useState(0);

  // Tick every 60s to refresh the "in X days" label.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const cohortScope = selectedCohortId === ALL_COHORTS ? "all" : (selectedCohort?.label ?? "");

  const { data: events = [] } = useQuery({
    queryKey: ["upcoming-events-carousel", cohortScope],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("events")
        .select("id, name, start_time, start_date, event_type, location")
        .eq("is_archived", false)
        .not("status", "in", '("Completed","done","deleted")')
        .gt("start_time", nowIso)
        .order("start_time", { ascending: true });
      if (cohortScope !== "all" && cohortScope) q = q.eq("cohort_year", cohortScope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UpcomingEvent[];
    },
    refetchInterval: 5 * 60_000,
  });

  // Auto-scrolling marquee. Duplicate the list so it can loop seamlessly.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || events.length === 0) return;
    let raf = 0;
    let last = performance.now();
    const speedPxPerSec = 30;
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!paused) {
        el.scrollLeft += speedPxPerSec * dt;
        // Loop halfway (we render the list twice)
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [events.length, paused]);

  const cards = useMemo(() => events.map(ev => {
    const startsAt = ev.start_time ? parseISO(ev.start_time)
      : ev.start_date ? parseISO(ev.start_date) : null;
    return { ev, startsAt };
  }).filter(x => x.startsAt), [events]);

  return (
    <section className="rounded-md border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-md border border-border bg-secondary flex items-center justify-center">
          <CalendarDays className="h-4 w-4 text-ink" />
        </div>
        <h3 className="font-serif text-base font-semibold text-ink tracking-tight">
          Upcoming Events
        </h3>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {cards.length > 0 ? `${cards.length} scheduled` : ""}
        </span>
      </div>

      {cards.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground text-center">
          No upcoming events
        </div>
      ) : (
        <div
          ref={scrollerRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className="flex gap-3 overflow-x-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollBehavior: paused ? "smooth" : "auto" }}
        >
          {/* Rendered twice for seamless marquee loop */}
          {[...cards, ...cards].map(({ ev, startsAt }, i) => {
            const Icon = iconFor(ev.event_type);
            const hasTime = !!ev.start_time;
            return (
              <button
                key={`${ev.id}-${i}`}
                type="button"
                onClick={() => navigate(`/events?event=${ev.id}`)}
                className="group shrink-0 w-72 text-left rounded-2xl border border-border/60 bg-background/60 backdrop-blur-xl hover:bg-accent/40 hover:border-border transition-colors px-4 py-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-semibold text-foreground truncate"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                    >
                      {ev.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="tabular-nums">
                        {format(startsAt!, hasTime ? "MMM d · HH:mm" : "MMM d")}
                      </span>
                      <span className="opacity-40">·</span>
                      <span className="text-primary font-medium tabular-nums">
                        {relativeCountdown(startsAt!)}
                      </span>
                    </div>
                    {(ev.event_type || ev.location) && (
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground truncate">
                        {ev.event_type && (
                          <span className="uppercase tracking-wider">{ev.event_type}</span>
                        )}
                        {ev.location && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="h-2.5 w-2.5" />
                              <span className="truncate">{ev.location}</span>
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
