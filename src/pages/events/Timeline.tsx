import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO,
  differenceInDays, getDay, addMonths, subMonths, isSameDay, isWithinInterval,
} from "date-fns";
import type { Tables, Json } from "@/integrations/supabase/types";

type Event = Tables<"events">;
type ChecklistItem = { id: string; text: string; done: boolean };

function parseChecklist(raw: Json | null): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ChecklistItem =>
      typeof item === "object" && item !== null && "id" in item && "text" in item && "done" in item
  );
}

const statusColor = (s: string) => {
  if (s === "Active") return "bg-green-500/20 text-green-400 border-green-500/30";
  if (s === "Completed") return "bg-muted text-muted-foreground border-border";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
};

const statusBadge = (s: string) => {
  if (s === "Active") return "bg-green-500/20 text-green-400";
  if (s === "Completed") return "bg-muted text-muted-foreground";
  return "bg-blue-500/20 text-blue-400";
};

export default function Timeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"gantt" | "calendar">("gantt");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [newItem, setNewItem] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const checklistMutation = useMutation({
    mutationFn: async ({ id, checklist }: { id: string; checklist: ChecklistItem[] }) => {
      const { error } = await supabase.from("events").update({ checklist: checklist as unknown as Json }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      logAction("Events-Timeline", "UPDATE", vars.id, null, { checklist: vars.checklist }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e) => toast.error(e.message),
  });

  // Keep selectedEvent in sync with fresh data
  const liveSelected = selectedEvent ? events.find((e) => e.id === selectedEvent.id) ?? selectedEvent : null;
  const checklist = parseChecklist(liveSelected?.checklist);

  function addChecklistItem() {
    if (!newItem.trim() || !liveSelected) return;
    const updated = [...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }];
    checklistMutation.mutate({ id: liveSelected.id, checklist: updated });
    setNewItem("");
  }

  function toggleChecklistItem(itemId: string) {
    if (!liveSelected) return;
    const updated = checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i));
    checklistMutation.mutate({ id: liveSelected.id, checklist: updated });
  }

  function deleteChecklistItem(itemId: string) {
    if (!liveSelected) return;
    const updated = checklist.filter((i) => i.id !== itemId);
    checklistMutation.mutate({ id: liveSelected.id, checklist: updated });
  }

  // Month days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Gantt: events that overlap with current month
  const ganttEvents = useMemo(() => {
    return events.filter((e) => {
      if (!e.start_date || !e.end_date) return false;
      const s = parseISO(e.start_date);
      const en = parseISO(e.end_date);
      return s <= monthEnd && en >= monthStart;
    });
  }, [events, monthStart, monthEnd]);

  // Calendar: group events by day
  const calendarEvents = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((e) => {
      if (!e.start_date) return;
      const s = parseISO(e.start_date);
      const en = e.end_date ? parseISO(e.end_date) : s;
      daysInMonth.forEach((day) => {
        if (isWithinInterval(day, { start: s, end: en })) {
          const key = format(day, "yyyy-MM-dd");
          map.set(key, [...(map.get(key) || []), e]);
        }
      });
    });
    return map;
  }, [events, daysInMonth]);

  // Calendar grid padding
  const startDayOfWeek = getDay(monthStart);

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timeline</h1>
          <p className="text-sm text-muted-foreground">View events in Gantt or calendar format</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={view === "gantt" ? "default" : "outline"} size="sm" onClick={() => setView("gantt")}>Gantt</Button>
          <Button variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => setView("calendar")}>Calendar</Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-lg font-semibold min-w-[160px] text-center">{format(currentMonth, "MMMM yyyy")}</span>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">{view === "gantt" ? "Gantt Chart" : "Monthly Calendar"}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
          ) : view === "gantt" ? (
            /* ---- GANTT VIEW ---- */
            ganttEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No events this month.</p>
            ) : (
              <div className="overflow-x-auto">
                {/* Day headers */}
                <div className="grid gap-px mb-1" style={{ gridTemplateColumns: `160px repeat(${daysInMonth.length}, minmax(28px, 1fr))` }}>
                  <div className="text-xs text-muted-foreground px-1">Event</div>
                  {daysInMonth.map((d) => (
                    <div key={d.toISOString()} className="text-[10px] text-muted-foreground text-center">{format(d, "d")}</div>
                  ))}
                </div>
                {/* Event rows */}
                {ganttEvents.map((ev) => {
                  const evStart = parseISO(ev.start_date!);
                  const evEnd = parseISO(ev.end_date!);
                  const clampedStart = evStart < monthStart ? monthStart : evStart;
                  const clampedEnd = evEnd > monthEnd ? monthEnd : evEnd;
                  const startCol = differenceInDays(clampedStart, monthStart) + 2; // +2 because col 1 is label
                  const span = differenceInDays(clampedEnd, clampedStart) + 1;
                  return (
                    <div
                      key={ev.id}
                      className="grid gap-px items-center min-h-[32px] cursor-pointer hover:bg-muted/30 rounded"
                      style={{ gridTemplateColumns: `160px repeat(${daysInMonth.length}, minmax(28px, 1fr))` }}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      <div className="text-sm font-medium truncate px-1">{ev.name}</div>
                      {daysInMonth.map((_, i) => {
                        const col = i + 2;
                        const isInBar = col >= startCol && col < startCol + span;
                        const isStart = col === startCol;
                        const isEnd = col === startCol + span - 1;
                        return (
                          <div key={i} className={`h-6 ${isInBar ? `${statusColor(ev.status || "Planning")} border ${isStart ? "rounded-l" : ""} ${isEnd ? "rounded-r" : ""}` : ""}`} />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ---- CALENDAR VIEW ---- */
            <div>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">{d}</div>
                ))}
              </div>
              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`pad-${i}`} className="min-h-[80px]" />
                ))}
                {daysInMonth.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = calendarEvents.get(key) || [];
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={key} className={`min-h-[80px] border border-border rounded p-1 ${isToday ? "bg-primary/5 border-primary/30" : ""}`}>
                      <div className="text-xs text-muted-foreground mb-1">{format(day, "d")}</div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className={`text-[10px] px-1 py-0.5 rounded cursor-pointer truncate ${statusBadge(ev.status || "Planning")}`}
                            onClick={() => setSelectedEvent(ev)}
                          >
                            {ev.name}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Card Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(o) => { if (!o) setSelectedEvent(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{liveSelected?.name}</DialogTitle></DialogHeader>
          {liveSelected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={statusBadge(liveSelected.status || "Planning")}>{liveSelected.status || "Planning"}</Badge>
                {liveSelected.start_date && <span className="text-sm text-muted-foreground">{liveSelected.start_date} → {liveSelected.end_date || "—"}</span>}
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Checklist</h3>
                {checklist.length === 0 && <p className="text-xs text-muted-foreground">No items yet.</p>}
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <Checkbox checked={item.done} onCheckedChange={() => toggleChecklistItem(item.id)} />
                    <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteChecklistItem(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input placeholder="Add item..." value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addChecklistItem()} className="h-8 text-sm" />
                  <Button size="sm" onClick={addChecklistItem} disabled={!newItem.trim()}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

