import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, Users, ClipboardList, ArchiveRestore, Archive,
  CalendarDays, Layers,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO,
  getDay, addMonths, subMonths, isSameDay, isWithinInterval,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
} from "date-fns";
import { EventWorkspace } from "@/components/calendar/EventWorkspace";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export type CalendarEvent = Tables<"events"> & { _start: string; _end: string };

const EVENT_TYPES = ["Masterclass", "Mentorship", "Pitch Session", "Networking", "Social", "General"] as const;
const TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Masterclass:     { bg: "bg-sky-50 dark:bg-sky-500/15",         text: "text-sky-700 dark:text-sky-200",         dot: "bg-sky-500" },
  Mentorship:      { bg: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-200", dot: "bg-emerald-500" },
  "Pitch Session": { bg: "bg-amber-50 dark:bg-amber-500/15",     text: "text-amber-800 dark:text-amber-200",     dot: "bg-amber-600" },
  Networking:      { bg: "bg-violet-50 dark:bg-violet-500/15",   text: "text-violet-700 dark:text-violet-200",   dot: "bg-violet-500" },
  Social:          { bg: "bg-rose-50 dark:bg-rose-500/15",       text: "text-rose-700 dark:text-rose-200",       dot: "bg-rose-500" },
  General:         { bg: "bg-muted",                              text: "text-foreground",                        dot: "bg-muted-foreground" },
};
function typeStyle(t?: string | null) { return TYPE_STYLES[t || "General"] || TYPE_STYLES.General; }

function isValidTime(t?: string | null): t is string {
  return typeof t === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(t);
}
function extractTime(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.slice(0, 5);
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function enrich(ev: Tables<"events">): CalendarEvent | null {
  if (!ev.start_date) return null;
  const start = extractTime(ev.start_time) || "09:00";
  const end = extractTime(ev.end_time) || "17:00";
  const endDate = ev.end_date || ev.start_date;
  const s = new Date(`${ev.start_date}T${start}:00`);
  const e = new Date(`${endDate}T${end}:00`);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  return { ...ev, _start: s.toISOString(), _end: e.toISOString() };
}


type View = "month" | "week";

export default function Calendar() {
  const qc = useQueryClient();
  const { selectedCohortId, selectedCohort } = useCohort();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [wsEventId, setWsEventId] = useState<string | null>(null);
  const [wsInitialMultipart, setWsInitialMultipart] = useState(false);
  const [typeChooserOpen, setTypeChooserOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link: /events/calendar?event=<id> opens that event in the workspace.
  useEffect(() => {
    const id = searchParams.get("event");
    if (id) {
      setWsEventId(id);
      setWsInitialMultipart(false);
      setWsOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("event");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const { data: rawEvents = [], isLoading } = useQuery({
    queryKey: ["events", showArchived],
    queryFn: async () => {
      const { data, error } = await supabase.from("events")
        .select("*").eq("is_archived", showArchived).order("start_date");
      if (error) throw error;
      return data as Tables<"events">[];
    },
  });

  // Load related tables to compute status indicators
  const eventIds = rawEvents.map(e => e.id);
  const { data: attendance = [] } = useQuery({
    queryKey: ["events-attendance-summary", eventIds.join(",")],
    queryFn: async () => {
      if (!eventIds.length) return [];
      const { data, error } = await supabase.from("event_attendance").select("event_id").in("event_id", eventIds);
      if (error) throw error;
      return data;
    },
  });
  const { data: logistics = [] } = useQuery({
    queryKey: ["events-logistics-summary", eventIds.join(",")],
    queryFn: async () => {
      if (!eventIds.length) return [];
      const { data, error } = await supabase.from("event_logistics").select("event_id").in("event_id", eventIds);
      if (error) throw error;
      return data;
    },
  });
  const attendanceSet = useMemo(() => new Set(attendance.map((a: any) => a.event_id)), [attendance]);
  const logisticsSet = useMemo(() => new Set(logistics.map((l: any) => l.event_id)), [logistics]);

  const events = useMemo(() => rawEvents.map(enrich).filter((e): e is CalendarEvent => !!e), [rawEvents]);

  const cohortLabel = selectedCohort?.label;
  const filtered = useMemo(() => events.filter(e => {
    if (typeFilter !== "all" && (e.event_type || "General") !== typeFilter) return false;
    if (selectedCohortId !== ALL_COHORTS && cohortLabel && e.cohort_year && e.cohort_year !== cohortLabel) return false;
    return true;
  }), [events, typeFilter, selectedCohortId, cohortLabel]);

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").update({ is_archived: false, archived_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Event restored"); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);
  const weekStart = startOfWeek(cursor, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(cursor, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  function eventsOnDay(day: Date) {
    return filtered.filter(ev => isWithinInterval(day, {
      start: new Date(parseISO(ev._start).setHours(0, 0, 0, 0)),
      end: parseISO(ev._end),
    }));
  }

  const headerLabel = view === "week"
    ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`
    : format(cursor, "MMMM yyyy");

  function openEvent(id: string | null) { setWsEventId(id); setWsInitialMultipart(false); setWsOpen(true); }
  function openNewEvent(isMultipart: boolean) {
    setWsEventId(null); setWsInitialMultipart(isMultipart); setTypeChooserOpen(false); setWsOpen(true);
  }

  const renderEventChip = (ev: CalendarEvent, size: "sm" | "md" = "sm") => {
    const s = typeStyle(ev.event_type);
    const attn = attendanceSet.has(ev.id);
    const log = logisticsSet.has(ev.id);
    return (
      <button
        key={ev.id}
        onClick={() => openEvent(ev.id)}
        className={cn(
          "w-full text-left rounded-md px-1.5 py-1 flex items-center gap-1 transition-transform hover:scale-[1.02]",
          s.bg, s.text, size === "sm" ? "text-[10px]" : "text-xs"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
        <span className="truncate flex-1">{ev.name}</span>
        {attn && <Users className="h-2.5 w-2.5 opacity-70 shrink-0" />}
        {log && <ClipboardList className="h-2.5 w-2.5 opacity-70 shrink-0" />}
      </button>
    );
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Program Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One workspace per event · attendance, stakeholders, logistics & checklist
          </p>
        </div>
        <Button onClick={() => setTypeChooserOpen(true)} className="rounded-full">
          <Plus className="h-4 w-4 mr-1.5" /> New Event
        </Button>
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2 bg-white/70 backdrop-blur-xl border-border/60 shadow-sm">
        <div className="inline-flex items-center rounded-full border bg-muted/50 p-0.5 gap-0.5">
          {(["month", "week"] as View[]).map(v => (
            <Button key={v} size="sm" variant="ghost"
              className={cn("h-7 rounded-full px-3 text-xs capitalize", view === v && "bg-background shadow-sm")}
              onClick={() => setView(v)}>{v}</Button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"
            onClick={() => setCursor(d => view === "week" ? subWeeks(d, 1) : subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"
            onClick={() => setCursor(d => view === "week" ? addWeeks(d, 1) : addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2 font-mono tabular-nums">{headerLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[150px] rounded-full text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Archive className="h-3.5 w-3.5" /> Archived
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {EVENT_TYPES.map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", typeStyle(t).dot)} />{t}
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-3"><Users className="h-3 w-3" /> Attendance logged</div>
        <div className="flex items-center gap-1.5"><ClipboardList className="h-3 w-3" /> Logistics set</div>
      </div>

      {showArchived && filtered.length > 0 && (
        <Card className="p-4 bg-amber-50/50 border-amber-200/60">
          <div className="text-xs text-amber-900 mb-2">Viewing archived events. Click restore to bring one back.</div>
          <div className="space-y-1">
            {filtered.map(ev => (
              <div key={ev.id} className="flex items-center justify-between gap-2 text-sm">
                <button onClick={() => openEvent(ev.id)} className="text-left hover:underline flex-1 truncate">
                  {ev.name} <span className="text-muted-foreground text-xs">· {ev.start_date}</span>
                </button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => restore.mutate(ev.id)}>
                  <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : !showArchived && view === "month" ? (
        <Card className="p-4 bg-white/70 backdrop-blur-xl border-border/60 shadow-sm">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="text-[10px] font-medium tracking-wider text-muted-foreground text-center py-1 uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} className="min-h-[110px]" />)}
            {monthDays.map(day => {
              const dayEvents = eventsOnDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={cn(
                  "min-h-[110px] rounded-xl p-1.5 border border-transparent transition-colors",
                  isToday ? "bg-primary/5 border-primary/30" : "hover:bg-muted/40"
                )}>
                  <div className={cn("text-[11px] font-mono tabular-nums mb-1 px-1", isToday ? "text-primary font-semibold" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => renderEventChip(ev, "sm"))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : !showArchived ? (
        <Card className="p-4 bg-white/70 backdrop-blur-xl border-border/60 shadow-sm">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayEvents = eventsOnDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={cn(
                  "rounded-xl p-2 min-h-[380px] border",
                  isToday ? "bg-primary/5 border-primary/30" : "border-border/60"
                )}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(day, "EEE")}</div>
                  <div className={cn("text-lg font-mono tabular-nums mb-2", isToday && "text-primary font-semibold")}>{format(day, "d")}</div>
                  <div className="space-y-1">
                    {dayEvents.map(ev => (
                      <div key={ev.id}>
                        {renderEventChip(ev, "md")}
                        <div className="text-[10px] text-muted-foreground font-mono tabular-nums px-1.5 mt-0.5">
                          {format(parseISO(ev._start), "HH:mm")} – {format(parseISO(ev._end), "HH:mm")}
                        </div>
                      </div>
                    ))}
                    {dayEvents.length === 0 && (
                      <div className="text-[10px] text-muted-foreground/60 italic px-1">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <EventWorkspace open={wsOpen} onOpenChange={setWsOpen} eventId={wsEventId} initialIsMultipart={wsInitialMultipart} />

      <EventTypeChooser open={typeChooserOpen} onOpenChange={setTypeChooserOpen} onPick={openNewEvent} />
    </div>
  );
}

function EventTypeChooser({
  open, onOpenChange, onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (isMultipart: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>What kind of event?</DialogTitle>
          <DialogDescription>Pick a format. You can't change this later.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onPick(false)}
            className="text-left rounded-xl border p-4 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <CalendarDays className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium text-sm">Simple event</div>
            <div className="text-xs text-muted-foreground mt-1">
              A single meeting, class, or session. Attendance is tracked for the whole event.
            </div>
          </button>
          <button
            onClick={() => onPick(true)}
            className="text-left rounded-xl border p-4 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <Layers className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium text-sm">Multi-part event</div>
            <div className="text-xs text-muted-foreground mt-1">
              A bootcamp, week, or program with several named sessions. Attendance is tracked per session.
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
