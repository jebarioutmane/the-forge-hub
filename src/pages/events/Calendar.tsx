import { QueryErrorState, QueryErrorRow, SkeletonTableRows, SkeletonBlocks } from "@/components/QueryStates";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";

export type CalendarEvent = Tables<"events"> & { _start: string; _end: string };

const EVENT_TYPES = ["Masterclass", "Mentorship", "Pitch Session", "Networking", "Social", "General"] as const;
const TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Masterclass:     { bg: "bg-primary/10", text: "text-primary",    dot: "bg-primary" },
  Mentorship:      { bg: "bg-primary/10", text: "text-primary",    dot: "bg-primary/75" },
  "Pitch Session": { bg: "bg-primary/10", text: "text-primary",    dot: "bg-primary/50" },
  Networking:      { bg: "bg-primary/10", text: "text-primary",    dot: "bg-primary/25" },
  Social:          { bg: "bg-secondary",  text: "text-foreground", dot: "bg-muted-foreground" },
  General:         { bg: "bg-secondary",  text: "text-foreground", dot: "bg-muted-foreground/50" },
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


  const { data: rawEvents = [], isLoading, isError, refetch } = useQuery({
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
          "w-full text-left rounded px-1 py-1 flex items-center gap-1 text-xs transition-colors hover:bg-primary/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          s.bg, s.text
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
        <span className="truncate flex-1">{ev.name}</span>
        {attn && <Users className="h-3 w-3 opacity-70 shrink-0" />}
        {log && <ClipboardList className="h-3 w-3 opacity-70 shrink-0" />}
      </button>
    );
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Programme calendar"
        description="One workspace per event — attendance, stakeholders, logistics and checklist"
        actions={
          <Button onClick={() => setTypeChooserOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New event
          </Button>
        }
      />

      <div className="py-2 flex flex-wrap items-center gap-2 border-y border-border">
        <div className="inline-flex items-center rounded border border-border bg-secondary p-0.5 gap-0.5">
          {(["month", "week"] as View[]).map(v => (
            <Button key={v} size="sm" variant="ghost"
              className={cn("h-8 rounded-sm px-3 text-xs capitalize", view === v && "bg-card text-foreground border border-border")}
              onClick={() => setView(v)}>{v}</Button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="icon" className="h-8 w-8"
            aria-label={view === "week" ? "Previous week" : "Previous month"}
            onClick={() => setCursor(d => view === "week" ? subWeeks(d, 1) : subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            aria-label={view === "week" ? "Next week" : "Next month"}
            onClick={() => setCursor(d => view === "week" ? addWeeks(d, 1) : addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2 tabular-nums">{headerLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
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
      </div>

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
        <Card className="p-4 bg-status-watch/10 border-status-watch/30 shadow-none">
          <div className="text-xs text-foreground mb-2">Viewing archived events. Click restore to bring one back.</div>
          <div className="space-y-1">
            {filtered.map(ev => (
              <div key={ev.id} className="flex items-center justify-between gap-2 text-sm">
                <button onClick={() => openEvent(ev.id)} className="text-left hover:underline flex-1 truncate">
                  {ev.name} <span className="text-muted-foreground text-xs">· {ev.start_date}</span>
                </button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => restore.mutate(ev.id)}>
                  <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-4" aria-busy="true">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="min-h-28 w-full" />)}
          </div>
        </Card>
      ) : isError ? (
        <QueryErrorState className="border-y" message="The events calendar could not be loaded. Check your connection, then try again." onRetry={() => refetch()} />
      ) : !showArchived && view === "month" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-border border-b border-border">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="bg-secondary text-xs font-medium text-muted-foreground text-center py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border">
            {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} className="min-h-28 bg-secondary" />)}
            {monthDays.map(day => {
              const dayEvents = eventsOnDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={cn(
                  "min-h-28 bg-card p-1 transition-colors hover:bg-secondary"
                )}>
                  <div className="mb-1 px-1">
                    <span
                      className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded text-xs tabular-nums", isToday ? "border border-primary text-primary font-semibold" : "text-muted-foreground")}
                      aria-current={isToday ? "date" : undefined}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => renderEventChip(ev, "sm"))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1 tabular-nums">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !showArchived ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-border">
            {weekDays.map(day => {
              const dayEvents = eventsOnDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={cn(
                  "min-h-96 bg-card p-2",
                  isToday && "bg-secondary"
                )}>
                  <div className="text-xs font-medium text-muted-foreground">{format(day, "EEE")}</div>
                  <div aria-current={isToday ? "date" : undefined} className={cn("text-lg tabular-nums mb-2", isToday ? "text-primary font-semibold" : "text-foreground")}>{format(day, "d")}</div>
                  <div className="space-y-1">
                    {dayEvents.map(ev => (
                      <div key={ev.id}>
                        {renderEventChip(ev, "md")}
                        <div className="text-xs text-muted-foreground tabular-nums px-1 mt-0.5">
                          {format(parseISO(ev._start), "HH:mm")} – {format(parseISO(ev._end), "HH:mm")}
                        </div>
                      </div>
                    ))}
                    {dayEvents.length === 0 && (
                      <div className="text-xs text-muted-foreground px-1">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <EventWorkspace open={wsOpen} onOpenChange={setWsOpen} eventId={wsEventId} initialIsMultipart={wsInitialMultipart} />

      <EventTypeChooser open={typeChooserOpen} onOpenChange={setTypeChooserOpen} onPick={openNewEvent} />
    </PageContainer>
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
            className="text-left rounded-lg border border-border p-4 hover:bg-secondary hover:border-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarDays className="h-5 w-5 mb-2 text-primary" />
            <div className="font-medium text-sm">Simple event</div>
            <div className="text-xs text-muted-foreground mt-1">
              A single meeting, class, or session. Attendance is tracked for the whole event.
            </div>
          </button>
          <button
            onClick={() => onPick(true)}
            className="text-left rounded-lg border border-border p-4 hover:bg-secondary hover:border-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
