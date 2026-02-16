import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import type { Tables, Json } from "@/integrations/supabase/types";

type Event = Tables<"events">;
type ChecklistItem = { id: string; text: string; done: boolean };

const LOGISTICS = ["Room", "Transport", "Catering"];
const STATUSES = ["Planning", "Active", "Completed"];

function parseChecklist(raw: Json | null): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ChecklistItem =>
      typeof item === "object" && item !== null && "id" in item && "text" in item && "done" in item
  );
}

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

const statusBadge = (s: string) => {
  if (s === "Active") return "bg-green-500/20 text-green-400";
  if (s === "Completed") return "bg-muted text-muted-foreground";
  return "bg-blue-500/20 text-blue-400";
};

export default function Planning() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", status: "Planning", needs: [] as string[], checklist: [] as ChecklistItem[] });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        needs: form.needs as unknown as Json,
        checklist: form.checklist as unknown as Json,
      };
      if (editing) {
        const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
        if (error) throw error;
        await syncTasks(editing.id, form.name, form.needs);
      } else {
        const { data, error } = await supabase.from("events").insert(payload).select().single();
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
    setForm({ name: "", start_date: "", end_date: "", status: "Planning", needs: [], checklist: [] });
    setNewItem("");
  }

  function openEdit(ev: Event) {
    const needs = Array.isArray(ev.needs) ? (ev.needs as string[]) : [];
    setForm({
      name: ev.name,
      start_date: ev.start_date || "",
      end_date: ev.end_date || "",
      status: ev.status || "Planning",
      needs,
      checklist: parseChecklist(ev.checklist),
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

  function addChecklistItem() {
    if (!newItem.trim()) return;
    setForm((f) => ({ ...f, checklist: [...f.checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }] }));
    setNewItem("");
  }

  function toggleChecklistItem(itemId: string) {
    setForm((f) => ({ ...f, checklist: f.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }));
  }

  function deleteChecklistItem(itemId: string) {
    setForm((f) => ({ ...f, checklist: f.checklist.filter((i) => i.id !== itemId) }));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Planning</h1>
        <Button onClick={() => { resetForm(); setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New Event</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Logistics</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : events.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No events yet</TableCell></TableRow>
              ) : (
                events.map((ev) => {
                  const needs = Array.isArray(ev.needs) ? (ev.needs as string[]) : [];
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-medium">{ev.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ev.start_date || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ev.end_date || "—"}</TableCell>
                      <TableCell><Badge className={statusBadge(ev.status || "Planning")}>{ev.status || "Planning"}</Badge></TableCell>
                      <TableCell>
                        {needs.length > 0 ? needs.map((n) => <Badge key={n} variant="outline" className="mr-1 text-xs">{n}</Badge>) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(ev)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(ev.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
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
            {/* Checklist */}
            <div className="space-y-2">
              <Label>Checklist</Label>
              {form.checklist.length === 0 && <p className="text-xs text-muted-foreground">No items yet.</p>}
              {form.checklist.map((item) => (
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
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name}>{editing ? "Save Changes" : "Create Event"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
