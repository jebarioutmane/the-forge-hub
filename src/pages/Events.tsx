import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { addDays, differenceInDays, format, parseISO, min, max } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { TagPicker } from "@/components/TagPicker";
import { TagBadges } from "@/components/TagBadges";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type EventWithProfile = Tables<"events"> & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
};

const LOGISTICS = ["Room", "Transport", "Catering"];
const STATUSES = ["Planning", "Active", "Completed"];

export default function Events() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventWithProfile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", status: "Planning", needs: [] as string[], tag_ids: [] as string[] });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*, profiles!events_created_by_fkey(full_name, avatar_url)").order("start_date");
      if (error) throw error;
      return data as EventWithProfile[];
    },
  });

  async function syncTasks(eventId: string, eventName: string, needs: string[]) {
    await supabase.from("tasks").delete().eq("source_module", "Events").eq("source_id", eventId);
    if (needs.length > 0) {
      const tasks = needs.map((need) => ({
        title: `Arrange ${need} for ${eventName}`,
        source_module: "Events",
        source_id: eventId,
        status: "To Do",
      }));
      await supabase.from("tasks").insert(tasks);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        needs: form.needs,
        tag_ids: form.tag_ids,
      };
      if (editing) {
        const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
        if (error) throw error;
        await syncTasks(editing.id, form.name, form.needs);
      } else {
        const { data, error } = await supabase.from("events").insert({ ...payload, created_by: user?.id }).select().single();
        if (error) throw error;
        await syncTasks(data.id, form.name, form.needs);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      toast.success(editing ? "Event updated" : "Event created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("tasks").delete().eq("source_module", "Events").eq("source_id", id);
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDeleteId(null);
      toast.success("Event deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ name: "", start_date: "", end_date: "", status: "Planning", needs: [], tag_ids: [] });
  }

  function openEdit(ev: EventWithProfile) {
    const needs = Array.isArray(ev.needs) ? (ev.needs as string[]) : [];
    setForm({
      name: ev.name,
      start_date: ev.start_date || "",
      end_date: ev.end_date || "",
      status: ev.status || "Planning",
      needs,
      tag_ids: (ev.tag_ids as string[]) || [],
    });
    setEditing(ev);
    setDialogOpen(true);
  }

  function toggleNeed(need: string) {
    setForm((f) => ({
      ...f,
      needs: f.needs.includes(need) ? f.needs.filter((n) => n !== need) : [...f.needs, need],
    }));
  }

  // Gantt calculation
  const gantt = useMemo(() => {
    const dated = events.filter((e) => e.start_date && e.end_date);
    if (dated.length === 0) return null;
    const starts = dated.map((e) => parseISO(e.start_date!));
    const ends = dated.map((e) => parseISO(e.end_date!));
    const ganttStart = min(starts);
    const ganttEnd = max(ends);
    const totalDays = differenceInDays(ganttEnd, ganttStart) + 1;
    const cols = Math.max(totalDays, 1);
    return { ganttStart, cols, dated };
  }, [events]);

  const statusColor = (s: string) => {
    if (s === "Active") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (s === "Completed") return "bg-muted text-muted-foreground";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Events</h1>
        <Button onClick={() => { resetForm(); setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New Event</Button>
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Timeline</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
          ) : !gantt ? (
            <p className="text-muted-foreground text-sm text-center py-8">No events with dates yet.</p>
          ) : (
            <div className="overflow-x-auto">
              {/* Date headers */}
              <div className="grid gap-px mb-1" style={{ gridTemplateColumns: `160px repeat(${gantt.cols}, minmax(28px, 1fr))` }}>
                <div className="text-xs text-muted-foreground px-1">Event</div>
                {Array.from({ length: gantt.cols }).map((_, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground text-center truncate">
                    {i % Math.max(1, Math.floor(gantt.cols / 10)) === 0 ? format(addDays(gantt.ganttStart, i), "MMM d") : ""}
                  </div>
                ))}
              </div>
              {/* Event rows */}
              {gantt.dated.map((ev) => {
                const startOff = differenceInDays(parseISO(ev.start_date!), gantt.ganttStart) + 1;
                const span = differenceInDays(parseISO(ev.end_date!), parseISO(ev.start_date!)) + 1;
                return (
                  <div key={ev.id} className="grid gap-px items-center min-h-[32px]" style={{ gridTemplateColumns: `160px repeat(${gantt.cols}, minmax(28px, 1fr))` }}>
                    <div className="text-sm font-medium truncate px-1 flex items-center gap-2">
                      {ev.profiles && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={ev.profiles.avatar_url ? `${ev.profiles.avatar_url}?t=${Date.now()}` : undefined} />
                                <AvatarFallback className="text-[10px] bg-muted">{ev.profiles.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}</AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>Created by {ev.profiles.full_name || "Unknown"}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <span className="truncate">{ev.name}</span>
                      <TagBadges tagIds={ev.tag_ids as string[] | null} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0"><MoreHorizontal className="h-3 w-3" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => openEdit(ev)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(ev.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Empty cells + bar */}
                    {Array.from({ length: gantt.cols }).map((_, i) => {
                      const col = i + 1;
                      const isInBar = col >= startOff && col < startOff + span;
                      const isStart = col === startOff;
                      const isEnd = col === startOff + span - 1;
                      return (
                        <div key={i} className={`h-6 ${isInBar ? `${statusColor(ev.status || "Planning")} border ${isStart ? "rounded-l" : ""} ${isEnd ? "rounded-r" : ""}` : ""}`} />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Event Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Logistics Needs</Label>
              <div className="flex flex-col gap-3 pt-1">
                {LOGISTICS.map((need) => (
                  <div key={need} className="flex items-center justify-between">
                    <span className="text-sm">{need}</span>
                    <Switch checked={form.needs.includes(need)} onCheckedChange={() => toggleNeed(need)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagPicker value={form.tag_ids} onChange={(ids) => setForm((f) => ({ ...f, tag_ids: ids }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name}>{editing ? "Save Changes" : "Create Event"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
