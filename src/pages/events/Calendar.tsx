import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO,
  getDay, addMonths, subMonths, isSameDay, isWithinInterval,
  startOfWeek, endOfWeek, addWeeks, subWeeks, addDays,
} from "date-fns";
import { COHORT_YEARS, getCurrentCohortYear } from "@/lib/cohortYears";
import { EventSlideOver } from "@/components/calendar/EventSlideOver";
import { EventFormDialog } from "@/components/calendar/EventFormDialog";
import { cn } from "@/lib/utils";

export type ProgramEvent = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  event_type: string;
  cohort_year: string;
  location: string | null;
  linked_founder_id: string | null;
  links: any;
  created_at: string;
  updated_at: string;
};

const EVENT_TYPES = ["Selection", "Workshop", "Pitch", "1-on-1", "Travel", "General"] as const;

const TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Selection:  { bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500"  },
  Workshop:   { bg: "bg-sky-50",     text: "text-sky-700",     dot: "bg-sky-500"     },
  Pitch:      { bg: "bg-amber-50",   text: "text-amber-800",   dot: "bg-amber-600"   },
  "1-on-1":   { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Travel:     { bg: "bg-rose-50",    text: "text-rose-700",    dot: "bg-rose-500"    },
  General:    { bg: "bg-slate-50",   text: "text-slate-700",   dot: "bg-slate-400"   },
};

function getTypeStyle(t: string) {
  return TYPE_STYLES[t] || TYPE_STYLES.General;
}

// Detect overlapping events that share a location
function detectConflicts(events: ProgramEvent[]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i], b = events[j];
      if (!a.location || !b.location) continue;
      if (a.location.trim().toLowerCase() !== b.location.trim().toLowerCase()) continue;
      const aS = parseISO(a.start_time), aE = parseISO(a.end_time);
      const bS = parseISO(b.start_time), bE = parseISO(b.end_time);
      if (aS < bE && bS < aE) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}

type View = "month" | "week" | "agenda";

export default function Calendar() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const [cohort, setCohort] = useState(getCurrentCohortYear());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ProgramEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProgramEvent | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["program_events", cohort],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("program_events")
        .select("*")
        .eq("cohort_year", cohort)
        .order("start_time");
      if (error) throw error;
      return data as ProgramEvent[];
    },
  });

  const filtered = useMemo(
    () => (typeFilter === "all" ? events : events.filter((e) => e.event_type === typeFilter)),
    [events, typeFilter]
  );

  const conflicts = useMemo(() => detectConflicts(filtered), [filtered]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("program_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted");
      queryClient.invalidateQueries({ queryKey: ["program_events"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---------- Month view ----------
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  function eventsOnDay(day: Date) {
    return filtered.filter((ev) => {
      const s = parseISO(ev.start_time);
      const e = parseISO(ev.end_time);
      return isWithinInterval(day, { start: new Date(s.getFullYear(), s.getMonth(), s.getDate()), end: e });
    });
  }

  // ---------- Week view ----------
  const weekStart = startOfWeek(cursor, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(cursor, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // ---------- Agenda ----------
  const agenda = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime()
    );
    const groups = new Map<string, ProgramEvent[]>();
    sorted.forEach((ev) => {
      const key = format(parseISO(ev.start_time), "yyyy-MM-dd");
      groups.set(key, [...(groups.get(key) || []), ev]);
    });
    return Array.from(groups.entries());
  }, [filtered]);

  function navPrev() {
    if (view === "month") setCursor((d) => subMonths(d, 1));
    else if (view === "week") setCursor((d) => subWeeks(d, 1));
    else setCursor((d) => subMonths(d, 1));
  }
  function navNext() {
    if (view === "month") setCursor((d) => addMonths(d, 1));
    else if (view === "week") setCursor((d) => addWeeks(d, 1));
    else setCursor((d) => addMonths(d, 1));
  }

  const headerLabel =
    view === "week"
      ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
      : format(cursor, "MMMM yyyy");

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Program Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Cohort-synced schedule with conflict detection</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="rounded-full">
          <Plus className="h-4 w-4 mr-1.5" />
          New Event
        </Button>
      </div>

      {/* Controls */}
      <Card className="p-3 flex flex-wrap items-center gap-2 bg-white/70 backdrop-blur-xl border-border/60 shadow-sm">
        <div className="inline-flex items-center rounded-full border bg-muted/50 p-0.5 gap-0.5">
          {(["month", "week", "agenda"] as View[]).map((v) => (
            <Button
              key={v}
              size="sm"
              variant="ghost"
              className={cn("h-7 rounded-full px-3 text-xs capitalize", view === v && "bg-background shadow-sm")}
              onClick={() => setView(v)}
            >
              {v}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={navPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={navNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2 font-mono tabular-nums">{headerLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select value={cohort} onValueChange={setCohort}>
            <SelectTrigger className="h-8 w-[140px] rounded-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COHORT_YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[130px] rounded-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {EVENT_TYPES.map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", getTypeStyle(t).dot)} />
            {t}
          </div>
        ))}
      </div>

      {isLoading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : view === "month" ? (
        <Card className="p-4 bg-white/70 backdrop-blur-xl border-border/60 shadow-sm">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-[10px] font-medium tracking-wider text-muted-foreground text-center py-1 uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} className="min-h-[100px]" />)}
            {monthDays.map((day) => {
              const dayEvents = eventsOnDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[100px] rounded-xl p-1.5 border border-transparent transition-colors",
                    isToday ? "bg-primary/5 border-primary/30" : "hover:bg-muted/40"
                  )}
                >
                  <div className={cn("text-[11px] font-mono tabular-nums mb-1 px-1", isToday ? "text-primary font-semibold" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const s = getTypeStyle(ev.event_type);
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelected(ev)}
                          className={cn("w-full text-left text-[10px] px-1.5 py-0.5 rounded-md truncate flex items-center gap-1 transition-transform hover:scale-[1.02]", s.bg, s.text)}
                        >
                          {conflicts.has(ev.id) && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
                          <span className="truncate">{ev.title}</span>
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : view === "week" ? (
        <Card className="p-4 bg-white/70 backdrop-blur-xl border-border/60 shadow-sm">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayEvents = filtered.filter((ev) => {
                const s = parseISO(ev.start_time);
                const e = parseISO(ev.end_time);
                return isWithinInterval(day, { start: new Date(s.getFullYear(), s.getMonth(), s.getDate()), end: e });
              });
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={cn("rounded-xl p-2 min-h-[360px] border", isToday ? "bg-primary/5 border-primary/30" : "border-border/60")}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(day, "EEE")}</div>
                  <div className={cn("text-lg font-mono tabular-nums mb-2", isToday && "text-primary font-semibold")}>{format(day, "d")}</div>
                  <div className="space-y-1">
                    {dayEvents.map((ev) => {
                      const s = getTypeStyle(ev.event_type);
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelected(ev)}
                          className={cn("w-full text-left px-2 py-1.5 rounded-md text-xs transition-transform hover:scale-[1.02]", s.bg, s.text)}
                        >
                          <div className="flex items-center gap-1 font-medium">
                            {conflicts.has(ev.id) && <AlertTriangle className="h-3 w-3" />}
                            <span className="truncate">{ev.title}</span>
                          </div>
                          <div className="font-mono tabular-nums text-[10px] opacity-80 mt-0.5">
                            {format(parseISO(ev.start_time), "HH:mm")} – {format(parseISO(ev.end_time), "HH:mm")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        // Agenda
        <Card className="p-6 bg-white/70 backdrop-blur-xl border-border/60 shadow-sm">
          {agenda.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events scheduled.</p>
          ) : (
            <div className="space-y-6">
              {agenda.map(([key, list]) => {
                const day = parseISO(key);
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={key}>
                    <div className="flex items-baseline gap-3 mb-3">
                      <div className={cn("text-2xl font-mono tabular-nums font-semibold", isToday && "text-primary")}>
                        {format(day, "d")}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{format(day, "EEEE")}</div>
                        <div className="text-xs text-muted-foreground">{format(day, "MMMM yyyy")}</div>
                      </div>
                    </div>
                    <div className="space-y-2 pl-10">
                      {list.map((ev) => {
                        const s = getTypeStyle(ev.event_type);
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setSelected(ev)}
                            className={cn("w-full text-left rounded-xl p-3 flex items-center gap-3 transition-transform hover:scale-[1.01]", s.bg)}
                          >
                            <span className={cn("h-8 w-1 rounded-full", s.dot)} />
                            <div className="flex-1 min-w-0">
                              <div className={cn("text-sm font-medium flex items-center gap-1.5", s.text)}>
                                {conflicts.has(ev.id) && <AlertTriangle className="h-3.5 w-3.5" />}
                                <span className="truncate">{ev.title}</span>
                              </div>
                              <div className="text-xs text-muted-foreground font-mono tabular-nums">
                                {format(parseISO(ev.start_time), "HH:mm")} – {format(parseISO(ev.end_time), "HH:mm")}
                                {ev.location && <span className="ml-2 font-sans">· {ev.location}</span>}
                              </div>
                            </div>
                            <span className={cn("text-[10px] uppercase tracking-wider font-medium", s.text)}>{ev.event_type}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <EventSlideOver
        event={selected}
        hasConflict={selected ? conflicts.has(selected.id) : false}
        onClose={() => setSelected(null)}
        onEdit={(ev) => { setEditTarget(ev); setSelected(null); setFormOpen(true); }}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editTarget}
        defaultCohort={cohort}
      />
    </div>
  );
}
