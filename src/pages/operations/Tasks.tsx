import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Settings, Users, X } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;

const STATUS_KEYS = ["To Do", "In Progress", "Done"];

function getColumnLabels(): Record<string, string> {
  try {
    const stored = localStorage.getItem("forge_task_columns");
    if (stored) return JSON.parse(stored);
  } catch {}
  return { "To Do": "To Do", "In Progress": "In Progress", Done: "Done" };
}

function getTaskLabels(): string[] {
  try {
    const stored = localStorage.getItem("forge_task_labels");
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export default function OperationsTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [columnLabels, setColumnLabels] = useState(getColumnLabels);
  const [taskLabels, setTaskLabels] = useState(getTaskLabels);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateName, setDelegateName] = useState("");

  // Form
  const [form, setForm] = useState({ title: "", description: "", priority: "Medium", due_date: "" });

  // Settings temp state
  const [tempLabels, setTempLabels] = useState(columnLabels);
  const [tempTaskLabels, setTempTaskLabels] = useState(taskLabels);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => { localStorage.setItem("forge_task_columns", JSON.stringify(columnLabels)); }, [columnLabels]);
  useEffect(() => { localStorage.setItem("forge_task_labels", JSON.stringify(taskLabels)); }, [taskLabels]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date || null,
        status: "To Do",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      logAction("Operations-Tasks", "INSERT", "new", null, { title: form.title, priority: form.priority }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTaskDialog(false);
      resetForm();
      toast.success("Task created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTask) return;
      const { error } = await supabase.from("tasks").update({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date || null,
      }).eq("id", editingTask.id);
      if (error) throw error;
    },
    onSuccess: () => {
      logAction("Operations-Tasks", "UPDATE", editingTask?.id || "", editingTask as any, { title: form.title, priority: form.priority }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setEditingTask(null);
      resetForm();
      toast.success("Task updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const deleted = tasks.find(t => t.id === id);
      logAction("Operations-Tasks", "DELETE", id, deleted as any, null, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDeleteId(null);
      toast.success("Task deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      logAction("Operations-Tasks", "UPDATE", vars.id, { status: "previous" }, { status: vars.status }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const delegateMutation = useMutation({
    mutationFn: async () => {
      const validatedName = delegateName.trim().slice(0, 100);
      if (!validatedName || !/^[\p{L}\p{N}\s\-_.,']+$/u.test(validatedName)) {
        throw new Error("Invalid team member name. Use only letters, numbers, spaces, and basic punctuation.");
      }
      const selectedTasks = tasks.filter((t) => selected.has(t.id));
      for (const t of selectedTasks) {
        const currentDesc = (t.description || "").slice(0, 4900);
        const newDesc = currentDesc + `\n\nAssigned to: ${validatedName}`;
        const { error } = await supabase.from("tasks").update({ description: newDesc }).eq("id", t.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelected(new Set());
      setDelegateOpen(false);
      setDelegateName("");
      toast.success(`Delegated ${selected.size} task(s)`);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ title: "", description: "", priority: "Medium", due_date: "" });
  }

  function openEdit(task: Task) {
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "Medium",
      due_date: task.due_date ? task.due_date.split("T")[0] : "",
    });
    setEditingTask(task);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const taskFormContent = (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea rows={5} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
        </div>
      </div>
    </div>
  );

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading tasks...</div>;

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Kanban board for task management</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Popover open={delegateOpen} onOpenChange={setDelegateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline"><Users className="mr-2 h-4 w-4" /> Delegate ({selected.size})</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <Label>Team Member Name</Label>
                  <Input value={delegateName} onChange={(e) => setDelegateName(e.target.value)} placeholder="e.g. Ahmed" />
                  <Button className="w-full" disabled={!delegateName} onClick={() => delegateMutation.mutate()}>Assign</Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="ghost" size="icon" onClick={() => { setTempLabels(columnLabels); setTempTaskLabels(taskLabels); setSettingsOpen(true); }}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => { resetForm(); setTaskDialog(true); }}><Plus className="mr-2 h-4 w-4" /> New Task</Button>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_KEYS.map((statusKey, colIdx) => {
          const colTasks = tasks.filter((t) => t.status === statusKey);
          return (
            <div key={statusKey} className="space-y-3">
              <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                {columnLabels[statusKey] || statusKey} ({colTasks.length})
              </h3>
              {colTasks.length === 0 ? (
                <Card className="border-dashed"><CardContent className="p-4 text-center text-sm text-muted-foreground">No tasks</CardContent></Card>
              ) : (
                colTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    selected={selected.has(t.id)}
                    onSelect={toggleSelect}
                    onMoveLeft={colIdx > 0 ? () => moveMutation.mutate({ id: t.id, status: STATUS_KEYS[colIdx - 1] }) : undefined}
                    onMoveRight={colIdx < 2 ? () => moveMutation.mutate({ id: t.id, status: STATUS_KEYS[colIdx + 1] }) : undefined}
                    onEdit={() => openEdit(t)}
                    onDelete={() => setDeleteId(t.id)}
                    labels={taskLabels}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* New Task Dialog */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
          {taskFormContent}
          <DialogFooter>
            <Button onClick={() => addMutation.mutate()} disabled={!form.title}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(o) => !o && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          {taskFormContent}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!form.title}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Task Board Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-semibold">Column Labels</Label>
              {STATUS_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">{key}:</span>
                  <Input value={tempLabels[key] || key} onChange={(e) => setTempLabels((l) => ({ ...l, [key]: e.target.value }))} className="h-8" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Task Labels</Label>
              <div className="flex flex-wrap gap-1">
                {tempTaskLabels.map((l) => (
                  <Badge key={l} variant="secondary" className="gap-1">
                    {l}
                    <button onClick={() => setTempTaskLabels((ls) => ls.filter((x) => x !== l))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New label..." className="h-8" onKeyDown={(e) => {
                  if (e.key === "Enter" && newLabel.trim()) { setTempTaskLabels((ls) => [...ls, newLabel.trim()]); setNewLabel(""); }
                }} />
                <Button size="sm" variant="outline" disabled={!newLabel.trim()} onClick={() => { setTempTaskLabels((ls) => [...ls, newLabel.trim()]); setNewLabel(""); }}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setColumnLabels(tempLabels); setTaskLabels(tempTaskLabels); setSettingsOpen(false); toast.success("Settings saved"); }}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
