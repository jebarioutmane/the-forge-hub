import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Search, LayoutGrid, List as ListIcon, CalendarIcon, User as UserIcon,
  GraduationCap, CalendarDays, Sparkles, Pencil, Archive, ArchiveRestore,
  ArrowUpDown, ClipboardList, ChevronRight, X,
} from "lucide-react";
import { format } from "date-fns";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;
type Profile = { id: string; full_name: string | null; email: string | null; avatar_url: string | null };
type FounderLite = { id: string; founder_name: string | null; startup_name: string | null; cohort_id: string | null };
type EventLite = { id: string; title: string | null };

const STATUSES = ["To Do", "In Progress", "Done"] as const;
type Status = typeof STATUSES[number];
const PRIORITIES = ["Low", "Medium", "High"] as const;
type Priority = typeof PRIORITIES[number];

const priorityBadge = (p: string | null): "outline" | "secondary" | "destructive" => {
  if (p === "High") return "destructive";
  if (p === "Medium") return "secondary";
  return "outline";
};

const sourceLabel = (module: string | null) => {
  if (!module || module === "Operations") return null;
  if (module === "AutoRisk") return "Auto: At-risk";
  if (module === "Events") return "Event checklist";
  return `Auto: ${module}`;
};

type FormState = {
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  due_date: string; // YYYY-MM-DD
  assigned_to: string; // uuid or "" for none
  related_founder_id: string;
  related_event_id: string;
};

const emptyForm: FormState = {
  title: "", description: "", priority: "Medium", status: "To Do",
  due_date: "", assigned_to: "", related_founder_id: "", related_event_id: "",
};

const NONE = "__none__";

export default function OperationsTasks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { selectedCohortId, selectedCohortLabel } = useCohort();
  const cohortScoped = selectedCohortId && selectedCohortId !== ALL_COHORTS;

  // Filters / view state
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "automated">("all");
  const [founderFilter, setFounderFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  // List sort
  const [sortKey, setSortKey] = useState<"due_date" | "priority" | "status" | "title">("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState<Task | null>(null);

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Queries
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_archived", showArchived)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: founders = [] } = useQuery({
    queryKey: ["founders-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name, cohort_id");
      if (error) throw error;
      return (data ?? []) as FounderLite[];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventLite[];
    },
  });

  // Lookup maps
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);
  const founderMap = useMemo(() => Object.fromEntries(founders.map(f => [f.id, f])), [founders]);
  const eventMap = useMemo(() => Object.fromEntries(events.map(e => [e.id, e])), [events]);

  // Resolve linked founder id for a task (handles AutoRisk source_id fallback)
  const linkedFounderId = (t: Task): string | null => {
    if (t.related_founder_id) return t.related_founder_id as string;
    if (t.source_module === "AutoRisk" && t.source_id) return t.source_id as string;
    return null;
  };

  // Filter pipeline
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !(
        t.title.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      )) return false;
      if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (sourceFilter !== "all") {
        const auto = t.source_module && t.source_module !== "Operations";
        if (sourceFilter === "manual" && auto) return false;
        if (sourceFilter === "automated" && !auto) return false;
      }
      if (founderFilter !== "all" && linkedFounderId(t) !== founderFilter) return false;
      if (eventFilter !== "all" && t.related_event_id !== eventFilter) return false;
      // Cohort scoping (via linked founder)
      if (cohortScoped) {
        const fid = linkedFounderId(t);
        if (fid) {
          const f = founderMap[fid];
          if (!f || f.cohort_id !== selectedCohortId) return false;
        }
        // Tasks with no founder link stay visible so ops-only work isn't hidden
      }
      return true;
    });
  }, [tasks, search, assigneeFilter, priorityFilter, statusFilter, sourceFilter, founderFilter, eventFilter, cohortScoped, selectedCohortId, founderMap]);

  const sortedList = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const priRank: Record<string, number> = { Low: 0, Medium: 1, High: 2 };
    const stRank: Record<string, number> = { "To Do": 0, "In Progress": 1, Done: 2 };
    arr.sort((a, b) => {
      switch (sortKey) {
        case "title": return a.title.localeCompare(b.title) * dir;
        case "priority": return ((priRank[a.priority || ""] ?? -1) - (priRank[b.priority || ""] ?? -1)) * dir;
        case "status": return ((stRank[a.status || ""] ?? -1) - (stRank[b.status || ""] ?? -1)) * dir;
        case "due_date": {
          const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return (ad - bd) * dir;
        }
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const byStatus = useMemo(() => {
    const g: Record<Status, Task[]> = { "To Do": [], "In Progress": [], "Done": [] };
    for (const t of filtered) {
      const s = (t.status as Status) || "To Do";
      if (STATUSES.includes(s)) g[s].push(t);
    }
    return g;
  }, [filtered]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assigned_to: form.assigned_to || null,
        related_founder_id: form.related_founder_id || null,
        related_event_id: form.related_event_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({ ...payload, source_module: "Operations" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setDialogOpen(false); setEditing(null); setForm(emptyForm);
      toast({ title: editing ? "Task updated" : "Task created" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["tasks", showArchived] });
      const prev = qc.getQueryData<Task[]>(["tasks", showArchived]);
      if (prev) {
        qc.setQueryData<Task[]>(["tasks", showArchived], prev.map(t => t.id === id ? { ...t, status } : t));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", showArchived], ctx.prev);
      toast({ title: "Could not update status", variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase.from("tasks").update({
        is_archived: archive,
        archived_at: archive ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: v.archive ? "Task archived" : "Task restored" });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || "",
      priority: (t.priority as Priority) || "Medium",
      status: (t.status as Status) || "To Do",
      due_date: t.due_date ? new Date(t.due_date).toISOString().slice(0, 10) : "",
      assigned_to: t.assigned_to || "",
      related_founder_id: (t.related_founder_id as string) || "",
      related_event_id: (t.related_event_id as string) || "",
    });
    setDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch(""); setAssigneeFilter("all"); setPriorityFilter("all");
    setStatusFilter("all"); setSourceFilter("all"); setFounderFilter("all"); setEventFilter("all");
  };
  const hasActiveFilters =
    search || assigneeFilter !== "all" || priorityFilter !== "all" || statusFilter !== "all" ||
    sourceFilter !== "all" || founderFilter !== "all" || eventFilter !== "all";

  // DnD handlers
  const onDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const targetStatus = String(overId) as Status;
    if (!STATUSES.includes(targetStatus)) return;
    const task = tasks.find(t => t.id === String(e.active.id));
    if (!task || task.status === targetStatus) return;
    statusMutation.mutate({ id: task.id, status: targetStatus });
  };
  const activeTask = activeDragId ? tasks.find(t => t.id === activeDragId) || null : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Team task hub — manual work and automated follow-ups in one place.
            {cohortScoped && <> Scoped to <span className="font-medium text-foreground">{selectedCohortLabel}</span> for founder-linked tasks.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <div className="flex items-center gap-2 text-sm border rounded-md px-3 h-9">
            <Switch id="arch" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="arch" className="cursor-pointer text-xs">
              {showArchived ? "Archived" : "Active"}
            </Label>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="task-search" name="task-search"
            placeholder="Search title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <FilterSelect value={assigneeFilter} onChange={setAssigneeFilter} placeholder="Assignee"
          options={[{ value: "all", label: "All assignees" }, ...profiles.map(p => ({ value: p.id, label: p.full_name || p.email || "Unnamed" }))]} />
        <FilterSelect value={priorityFilter} onChange={setPriorityFilter} placeholder="Priority"
          options={[{ value: "all", label: "Any priority" }, ...PRIORITIES.map(p => ({ value: p, label: p }))]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Status"
          options={[{ value: "all", label: "Any status" }, ...STATUSES.map(s => ({ value: s, label: s }))]} />
        <FilterSelect value={sourceFilter} onChange={(v) => setSourceFilter(v as any)} placeholder="Source"
          options={[
            { value: "all", label: "All sources" },
            { value: "manual", label: "Manual only" },
            { value: "automated", label: "Automated only" },
          ]} />
        <FilterSelect value={founderFilter} onChange={setFounderFilter} placeholder="Founder"
          options={[{ value: "all", label: "Any founder" }, ...founders.map(f => ({ value: f.id, label: f.founder_name || f.startup_name || "Founder" }))]} />
        <FilterSelect value={eventFilter} onChange={setEventFilter} placeholder="Event"
          options={[{ value: "all", label: "Any event" }, ...events.map(e => ({ value: e.id, label: e.title || "Event" }))]} />
      </div>
      {hasActiveFilters && (
        <div className="flex items-center gap-2 -mt-2">
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" />Clear filters
          </Button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={openAdd} archived={showArchived} filtered={hasActiveFilters} />
      ) : view === "kanban" ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-3">
            {STATUSES.map((s) => (
              <KanbanColumn key={s} status={s} tasks={byStatus[s]}>
                {byStatus[s].map((t) => (
                  <TaskCardItem
                    key={t.id}
                    task={t}
                    profile={t.assigned_to ? profileMap[t.assigned_to] : undefined}
                    founder={(() => { const fid = linkedFounderId(t); return fid ? founderMap[fid] : undefined; })()}
                    event={t.related_event_id ? eventMap[t.related_event_id as string] : undefined}
                    onEdit={() => openEdit(t)}
                    onArchive={() => setArchiveTarget(t)}
                    onNavigateFounder={(id) => navigate(`/founders?highlight=${id}`)}
                    onNavigateEvent={(id) => navigate(`/events?highlight=${id}`)}
                    draggable
                  />
                ))}
                {byStatus[s].length === 0 && (
                  <p className="text-xs text-muted-foreground italic px-1 py-6 text-center">
                    Drop tasks here
                  </p>
                )}
              </KanbanColumn>
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rotate-2 opacity-90">
                <TaskCardItem
                  task={activeTask}
                  profile={activeTask.assigned_to ? profileMap[activeTask.assigned_to] : undefined}
                  founder={(() => { const fid = linkedFounderId(activeTask); return fid ? founderMap[fid] : undefined; })()}
                  event={activeTask.related_event_id ? eventMap[activeTask.related_event_id as string] : undefined}
                  onEdit={() => {}} onArchive={() => {}}
                  onNavigateFounder={() => {}} onNavigateEvent={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <TaskListView
          tasks={sortedList}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(k) => {
            if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
            else { setSortKey(k); setSortDir("asc"); }
          }}
          profileMap={profileMap}
          founderMap={founderMap}
          eventMap={eventMap}
          linkedFounderId={linkedFounderId}
          onEdit={openEdit}
          onArchive={(t) => setArchiveTarget(t)}
          onNavigateFounder={(id) => navigate(`/founders?highlight=${id}`)}
          onNavigateEvent={(id) => navigate(`/events?highlight=${id}`)}
        />
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Task" : "New Task"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update task details." : "Create a new task for the team."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="t-title">Title</Label>
              <Input id="t-title" name="t-title" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Prepare cohort onboarding pack" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">Description</Label>
              <Textarea id="t-desc" name="t-desc" rows={3} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Context, links, acceptance criteria..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: Status) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v: Priority) => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Due date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !form.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {form.due_date ? format(new Date(form.due_date), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.due_date ? new Date(form.due_date) : undefined}
                      onSelect={(d) => setForm(f => ({ ...f, due_date: d ? format(d, "yyyy-MM-dd") : "" }))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={form.assigned_to || NONE} onValueChange={(v) => setForm(f => ({ ...f, assigned_to: v === NONE ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || "Unnamed"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Related founder</Label>
                <Select value={form.related_founder_id || NONE} onValueChange={(v) => setForm(f => ({ ...f, related_founder_id: v === NONE ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {founders.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.founder_name || f.startup_name || "Founder"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Related event</Label>
                <Select value={form.related_event_id || NONE} onValueChange={(v) => setForm(f => ({ ...f, related_event_id: v === NONE ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {events.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.title || "Event"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!archiveTarget}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (archiveTarget) {
            archiveMutation.mutate({ id: archiveTarget.id, archive: !archiveTarget.is_archived });
            setArchiveTarget(null);
          }
        }}
        title={archiveTarget?.is_archived ? "Restore task?" : "Archive task?"}
        description={archiveTarget?.is_archived
          ? "The task will move back into the active list."
          : "The task will be hidden from active views but preserved. You can restore it from the Archived toggle."}
      />
    </div>
  );
}

/* ---------- Sub-components ---------- */

function ViewToggle({ view, onChange }: { view: "kanban" | "list"; onChange: (v: "kanban" | "list") => void }) {
  return (
    <div className="inline-flex border rounded-md h-9 overflow-hidden">
      <button
        onClick={() => onChange("kanban")}
        className={cn("px-3 flex items-center gap-1.5 text-xs", view === "kanban" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
      >
        <LayoutGrid className="h-3.5 w-3.5" />Kanban
      </button>
      <button
        onClick={() => onChange("list")}
        className={cn("px-3 flex items-center gap-1.5 text-xs border-l", view === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
      >
        <ListIcon className="h-3.5 w-3.5" />List
      </button>
    </div>
  );
}

function FilterSelect({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 min-w-[130px] text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function EmptyState({ onAdd, archived, filtered }: { onAdd: () => void; archived: boolean; filtered: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <ClipboardList className="h-10 w-10 mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground mb-4">
          {archived
            ? "No archived tasks."
            : filtered
              ? "No tasks match these filters."
              : "No tasks yet. Create the first one to get started."}
        </p>
        {!archived && !filtered && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />New Task
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  status, tasks, children,
}: { status: Status; tasks: Task[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-muted/20 p-3 min-h-[300px] space-y-2 transition-colors",
        isOver && "bg-primary/5 border-primary/40"
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {status}
        </h3>
        <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded">
          {tasks.length}
        </span>
      </div>
      {children}
    </div>
  );
}

function TaskCardItem({
  task, profile, founder, event, onEdit, onArchive, onNavigateFounder, onNavigateEvent, draggable,
}: {
  task: Task;
  profile?: Profile;
  founder?: FounderLite;
  event?: EventLite;
  onEdit: () => void;
  onArchive: () => void;
  onNavigateFounder: (id: string) => void;
  onNavigateEvent: (id: string) => void;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id, disabled: !draggable,
  });
  const src = sourceLabel(task.source_module);
  return (
    <Card
      ref={draggable ? setNodeRef : undefined}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={cn(
        "group bg-background hover:border-primary/40 transition-colors cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onArchive(); }}>
              {task.is_archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 items-center">
          <Badge variant={priorityBadge(task.priority)} className="text-[10px] px-1.5 py-0 h-5">
            {task.priority || "Medium"}
          </Badge>
          {src && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-400/50 text-amber-700 bg-amber-50">
              <Sparkles className="h-2.5 w-2.5 mr-1" />{src}
            </Badge>
          )}
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />{format(new Date(task.due_date), "MMM d")}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {founder && (
            <ChipButton
              icon={GraduationCap}
              label={founder.founder_name || founder.startup_name || "Founder"}
              onClick={(e) => { e.stopPropagation(); onNavigateFounder(founder.id); }}
            />
          )}
          {event && (
            <ChipButton
              icon={CalendarDays}
              label={event.title || "Event"}
              onClick={(e) => { e.stopPropagation(); onNavigateEvent(event.id); }}
            />
          )}
        </div>
        {profile && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t">
            <UserIcon className="h-3 w-3" />
            {profile.full_name || profile.email || "Assigned"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChipButton({
  icon: Icon, label, onClick,
}: { icon: any; label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-background hover:bg-accent hover:border-primary/40 transition-colors"
    >
      <Icon className="h-3 w-3" />
      <span className="max-w-[120px] truncate">{label}</span>
      <ChevronRight className="h-2.5 w-2.5 opacity-50" />
    </button>
  );
}

function TaskListView({
  tasks, sortKey, sortDir, onSort, profileMap, founderMap, eventMap, linkedFounderId,
  onEdit, onArchive, onNavigateFounder, onNavigateEvent,
}: {
  tasks: Task[];
  sortKey: "due_date" | "priority" | "status" | "title";
  sortDir: "asc" | "desc";
  onSort: (k: "due_date" | "priority" | "status" | "title") => void;
  profileMap: Record<string, Profile>;
  founderMap: Record<string, FounderLite>;
  eventMap: Record<string, EventLite>;
  linkedFounderId: (t: Task) => string | null;
  onEdit: (t: Task) => void;
  onArchive: (t: Task) => void;
  onNavigateFounder: (id: string) => void;
  onNavigateEvent: (id: string) => void;
}) {
  const SortH = ({ label, k }: { label: string; k: typeof sortKey }) => (
    <button onClick={() => onSort(k)}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
      {label}
      <ArrowUpDown className={cn("h-3 w-3", sortKey === k && "text-primary")} />
    </button>
  );
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr className="text-left">
                <th className="p-3"><SortH label="Task" k="title" /></th>
                <th className="p-3"><SortH label="Status" k="status" /></th>
                <th className="p-3"><SortH label="Priority" k="priority" /></th>
                <th className="p-3"><SortH label="Due" k="due_date" /></th>
                <th className="p-3 text-xs font-medium text-muted-foreground">Assignee</th>
                <th className="p-3 text-xs font-medium text-muted-foreground">Related</th>
                <th className="p-3 text-xs font-medium text-muted-foreground">Source</th>
                <th className="p-3 w-0"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const fid = linkedFounderId(t);
                const founder = fid ? founderMap[fid] : undefined;
                const event = t.related_event_id ? eventMap[t.related_event_id as string] : undefined;
                const profile = t.assigned_to ? profileMap[t.assigned_to as string] : undefined;
                const src = sourceLabel(t.source_module);
                return (
                  <tr key={t.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-medium">{t.title}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                      )}
                    </td>
                    <td className="p-3 text-xs">{t.status}</td>
                    <td className="p-3">
                      <Badge variant={priorityBadge(t.priority)} className="text-[10px]">
                        {t.priority || "Medium"}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="p-3 text-xs">
                      {profile ? (profile.full_name || profile.email) : <span className="text-muted-foreground">Unassigned</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {founder && (
                          <ChipButton icon={GraduationCap}
                            label={founder.founder_name || founder.startup_name || "Founder"}
                            onClick={(e) => { e.stopPropagation(); onNavigateFounder(founder.id); }} />
                        )}
                        {event && (
                          <ChipButton icon={CalendarDays}
                            label={event.title || "Event"}
                            onClick={(e) => { e.stopPropagation(); onNavigateEvent(event.id); }} />
                        )}
                        {!founder && !event && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      {src ? (
                        <Badge variant="outline" className="text-[10px] border-amber-400/50 text-amber-700 bg-amber-50">
                          <Sparkles className="h-2.5 w-2.5 mr-1" />{src}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">Manual</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onArchive(t)}>
                          {t.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
