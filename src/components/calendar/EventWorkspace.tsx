import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TagPicker } from "@/components/TagPicker";
import { toast } from "sonner";
import {
  Plus, X, Trash2, Archive, ArchiveRestore, Link as LinkIcon,
  Users, UserPlus, Utensils, Bed, Plane, ClipboardList, ExternalLink,
  ArrowUp, ArrowDown, Layers,
} from "lucide-react";
import type { Tables, Json } from "@/integrations/supabase/types";

const EVENT_TYPES = ["Masterclass", "Mentorship", "Pitch Session", "Networking", "Social", "General"];
const STATUSES = ["Planning", "Active", "Completed"];
const STAKEHOLDER_ROLES = ["Speaker", "Mentor", "Guest", "Judge"];
const STAKEHOLDER_STATUSES = ["invited", "confirmed", "attended", "declined", "no_show"];
const ATTENDANCE_STATUSES = ["Present", "Absent", "Excused"];

interface LinkItem { title: string; url: string }
interface SlotItem { founder_id: string; founder_name: string; date: string; start_time: string; end_time: string }
interface ChecklistItem { text: string; done: boolean; assignee?: string }
interface TransportItem { person: string; type: string; from: string; to: string; time: string; notes: string }
interface AccommodationItem { person: string; hotel: string; check_in: string; check_out: string; notes: string }
interface CateringItem { label: string; option: string; notes: string }

function asArr<T>(j: Json | null | undefined): T[] {
  return Array.isArray(j) ? (j as unknown as T[]) : [];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventId: string | null;
  initialIsMultipart?: boolean;
}

export function EventWorkspace({ open, onOpenChange, eventId, initialIsMultipart = false }: Props) {
  const qc = useQueryClient();
  const { selectedCohortId, selectedCohort, cohorts } = useCohort();
  const [tab, setTab] = useState("overview");
  const [currentId, setCurrentId] = useState<string | null>(eventId);

  useEffect(() => {
    if (open) {
      setCurrentId(eventId);
      setTab("overview");
    }
  }, [open, eventId]);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", currentId],
    queryFn: async () => {
      if (!currentId) return null;
      const { data, error } = await supabase.from("events").select("*").eq("id", currentId).maybeSingle();
      if (error) throw error;
      return data as Tables<"events"> | null;
    },
    enabled: !!currentId && open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["event", currentId] });
    qc.invalidateQueries({ queryKey: ["event-attendance", currentId] });
    qc.invalidateQueries({ queryKey: ["event-stakeholders", currentId] });
    qc.invalidateQueries({ queryKey: ["event-logistics", currentId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 bg-white/95 backdrop-blur-2xl max-h-[92vh] overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {currentId ? event?.name || "Event" : "New Event"}
          </DialogTitle>
          <DialogDescription className="sr-only">Unified event workspace</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3 border-b">
            <TabsList className="bg-transparent p-0 h-auto gap-1">
              <WTab v="overview" label="Overview" />
              <WTab v="attendance" label="Attendance" disabled={!currentId} />
              <WTab v="stakeholders" label="Stakeholders" disabled={!currentId} />
              <WTab v="logistics" label="Logistics" disabled={!currentId} />
              <WTab v="checklist" label="Checklist" disabled={!currentId} />
            </TabsList>
          </div>

          <ScrollArea className="flex-1 max-h-[70vh]">
            <div className="p-6">
              {isLoading && currentId ? (
                <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
              ) : (
                <>
                  <TabsContent value="overview" className="m-0">
                    <OverviewTab
                      event={event ?? null}
                      cohorts={cohorts}
                      fallbackCohortLabel={selectedCohort?.label ?? ""}
                      initialIsMultipart={initialIsMultipart}
                      onSaved={(id) => { setCurrentId(id); invalidate(); }}
                      onArchivedToggle={invalidate}
                      onClose={() => onOpenChange(false)}
                    />
                  </TabsContent>
                  {currentId && event && (
                    <>
                      <TabsContent value="attendance" className="m-0">
                        <AttendanceTab event={event} />
                      </TabsContent>
                      <TabsContent value="stakeholders" className="m-0">
                        <StakeholdersTab event={event} />
                      </TabsContent>
                      <TabsContent value="logistics" className="m-0">
                        <LogisticsTab event={event} />
                      </TabsContent>
                      <TabsContent value="checklist" className="m-0">
                        <ChecklistTab event={event} onSaved={invalidate} />
                      </TabsContent>
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function WTab({ v, label, disabled }: { v: string; label: string; disabled?: boolean }) {
  return (
    <TabsTrigger
      value={v}
      disabled={disabled}
      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-lg text-xs px-3 py-1.5"
    >
      {label}
    </TabsTrigger>
  );
}

/* ============================== OVERVIEW ============================== */
function OverviewTab({
  event, cohorts, fallbackCohortLabel, initialIsMultipart, onSaved, onArchivedToggle, onClose,
}: {
  event: Tables<"events"> | null;
  cohorts: Tables<"cohorts">[];
  fallbackCohortLabel: string;
  initialIsMultipart: boolean;
  onSaved: (id: string) => void;
  onArchivedToggle: () => void;
  onClose: () => void;
}) {
  const isMultipart = event ? !!(event as any).is_multipart : initialIsMultipart;
  const qc = useQueryClient();
  const toTimeInput = (v: unknown): string => {
    if (typeof v !== "string" || !v) return "";
    // Already an HH:MM(:SS) time string
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.slice(0, 5);
    // Full timestamp — extract local HH:MM
    const d = new Date(v);
    if (isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };
  const toTimestamp = (dateStr: string, timeStr: string): string | null => {
    if (!dateStr || !timeStr) return null;
    const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    const d = new Date(`${dateStr}T${t}`);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const [form, setForm] = useState(() => ({
    name: event?.name ?? "",
    event_type: event?.event_type ?? "General",
    start_date: event?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: event?.end_date ?? event?.start_date ?? new Date().toISOString().slice(0, 10),
    start_time: toTimeInput(event?.start_time) || "09:00",
    end_time: toTimeInput(event?.end_time) || "17:00",
    location: event?.location ?? "",
    status: event?.status ?? "Planning",
    cohort_year: event?.cohort_year ?? fallbackCohortLabel,
    all_founders: event?.all_founders ?? true,
    tag_ids: event?.tag_ids ?? [],
    links: asArr<LinkItem>(event?.links),
    one_on_one_slots: asArr<SlotItem>(event?.one_on_one_slots),
    description: (event?.needs && typeof event.needs === "object" && !Array.isArray(event.needs)
      ? (event.needs as any).description ?? "" : ""),
  }));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Title is required");
      const endDate = form.end_date || form.start_date;
      const payload: any = {
        name: form.name.trim(),
        event_type: form.event_type,
        start_date: form.start_date,
        end_date: endDate,
        start_time: toTimestamp(form.start_date, form.start_time),
        end_time: toTimestamp(endDate, form.end_time),
        location: form.location || null,
        status: form.status,
        cohort_year: form.cohort_year || null,
        all_founders: form.all_founders,
        tag_ids: form.tag_ids,
        links: form.links.filter(l => l.url) as unknown as Json,
        one_on_one_slots: form.one_on_one_slots as unknown as Json,
        needs: { description: form.description } as unknown as Json,
      };

      if (event) {
        const { error } = await supabase.from("events").update(payload).eq("id", event.id);
        if (error) throw error;
        return event.id;
      } else {
        const { data, error } = await supabase.from("events").insert({ ...payload, is_multipart: initialIsMultipart }).select("id").single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      toast.success(event ? "Event updated" : "Event created");
      onSaved(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleArchive = useMutation({
    mutationFn: async () => {
      if (!event) return;
      const { error } = await supabase.from("events").update({
        is_archived: !event.is_archived,
        archived_at: !event.is_archived ? new Date().toISOString() : null,
      }).eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(event?.is_archived ? "Event restored" : "Event archived");
      onArchivedToggle();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {isMultipart ? <><Layers className="h-3 w-3 mr-1" /> Multi-part event</> : "Simple event"}
        </Badge>
      </div>
      <div>
        <Label className="text-xs">Title</Label>
        <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Event title" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={form.event_type} onValueChange={v => set("event_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Start</Label>
          <div className="flex gap-2">
            <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            <Input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} className="w-28" />
          </div>
        </div>
        <div>
          <Label className="text-xs">End</Label>
          <div className="flex gap-2">
            <Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} className="w-28" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Location</Label>
          <Input value={form.location} onChange={e => set("location", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Cohort</Label>
          <Select value={form.cohort_year || "none"} onValueChange={v => set("cohort_year", v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {cohorts.map(c => <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">All cohort founders</div>
          <div className="text-xs text-muted-foreground">When on, attendance defaults to every founder in the cohort.</div>
        </div>
        <Switch checked={form.all_founders} onCheckedChange={v => set("all_founders", v)} />
      </div>

      <div>
        <Label className="text-xs">Description</Label>
        <Textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} />
      </div>

      <div>
        <Label className="text-xs">Tags</Label>
        <TagPicker value={form.tag_ids} onChange={ids => set("tag_ids", ids)} />
      </div>

      <LinksEditor value={form.links} onChange={v => set("links", v)} />

      <SlotsEditor value={form.one_on_one_slots} onChange={v => set("one_on_one_slots", v)} />

      {isMultipart && (
        event
          ? <SessionsEditor eventId={event.id} />
          : (
            <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              <Layers className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Save the event first, then add its sessions here.
            </div>
          )
      )}


      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          {event && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => toggleArchive.mutate()}
              disabled={toggleArchive.isPending}
            >
              {event.is_archived
                ? <><ArchiveRestore className="h-4 w-4 mr-1.5" /> Restore</>
                : <><Archive className="h-4 w-4 mr-1.5" /> Archive</>}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {event ? "Save changes" : "Create event"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LinksEditor({ value, onChange }: { value: LinkItem[]; onChange: (v: LinkItem[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs">Links</Label>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([...value, { title: "", url: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Add link
        </Button>
      </div>
      {value.length === 0 && <div className="text-xs text-muted-foreground">No links added.</div>}
      <div className="space-y-1.5">
        {value.map((l, i) => (
          <div key={i} className="flex gap-2">
            <Input className="h-8 text-xs" placeholder="Title" value={l.title}
              onChange={e => onChange(value.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="https://…" value={l.url}
              onChange={e => onChange(value.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotsEditor({ value, onChange }: { value: SlotItem[]; onChange: (v: SlotItem[]) => void }) {
  const [founderOpen, setFounderOpen] = useState<number | null>(null);
  const { data: founders = [] } = useQuery({
    queryKey: ["founders-slot-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders")
        .select("id, founder_name, startup_name").eq("is_archived", false).order("founder_name");
      if (error) throw error;
      return data;
    },
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs">1:1 slots (post-session)</Label>
        <Button variant="ghost" size="sm" className="h-7 text-xs"
          onClick={() => onChange([...value, { founder_id: "", founder_name: "", date: "", start_time: "", end_time: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Add slot
        </Button>
      </div>
      {value.length === 0 && <div className="text-xs text-muted-foreground">No 1:1s scheduled.</div>}
      <div className="space-y-1.5">
        {value.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 items-center">
            <Popover open={founderOpen === i} onOpenChange={o => setFounderOpen(o ? i : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs justify-start truncate">
                  {s.founder_name || "Select founder"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-64">
                <Command>
                  <CommandInput placeholder="Search founders…" />
                  <CommandList><CommandEmpty>None</CommandEmpty>
                    <CommandGroup>
                      {founders.map(f => (
                        <CommandItem key={f.id} onSelect={() => {
                          onChange(value.map((x, j) => j === i ? { ...x, founder_id: f.id, founder_name: f.founder_name } : x));
                          setFounderOpen(null);
                        }}>{f.founder_name} <span className="ml-1 text-xs text-muted-foreground">{f.startup_name}</span></CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Input type="date" className="h-8 text-xs w-36" value={s.date}
              onChange={e => onChange(value.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
            <Input type="time" className="h-8 text-xs w-24" value={s.start_time}
              onChange={e => onChange(value.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))} />
            <Input type="time" className="h-8 text-xs w-24" value={s.end_time}
              onChange={e => onChange(value.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x))} />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== ATTENDANCE ============================== */
function AttendanceTab({ event }: { event: Tables<"events"> }) {
  const qc = useQueryClient();
  const [session, setSession] = useState("");

  // Founders in event's cohort_year (if set), else all
  const { data: founders = [] } = useQuery({
    queryKey: ["founders-for-attendance", event.cohort_year],
    queryFn: async () => {
      let q = supabase.from("founders").select("id, founder_name, startup_name, cohort_year").eq("is_archived", false);
      if (event.cohort_year) q = q.eq("cohort_year", event.cohort_year);
      const { data, error } = await q.order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["event-attendance", event.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_attendance").select("*").eq("event_id", event.id);
      if (error) throw error;
      return data;
    },
  });

  const sessionFilter = (r: any) => {
    if (!session) return !r.notes || !r.notes.startsWith("session:");
    return r.notes === `session:${session}`;
  };
  const relevantRecords = records.filter(sessionFilter);

  // If not all_founders, only show founders that already have any attendance record for this event
  const founderList = useMemo(() => {
    if (event.all_founders) return founders;
    const withRec = new Set(records.map(r => r.founder_id));
    return founders.filter(f => withRec.has(f.id));
  }, [founders, records, event.all_founders]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const availableToAdd = founders.filter(f => !founderList.find(x => x.id === f.id));

  const setStatus = useMutation({
    mutationFn: async ({ founder_id, status }: { founder_id: string; status: string }) => {
      const notes = session ? `session:${session}` : null;
      const existing = records.find(r => r.founder_id === founder_id && ((r.notes || null) === notes));
      if (existing) {
        const { error } = await supabase.from("event_attendance").update({ status }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_attendance").insert({ event_id: event.id, founder_id, status, notes });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-attendance", event.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addFounder = useMutation({
    mutationFn: async (founder_id: string) => {
      const notes = session ? `session:${session}` : null;
      const { error } = await supabase.from("event_attendance").insert({ event_id: event.id, founder_id, status: null, notes });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-attendance", event.id] }); setPickerOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const attended = relevantRecords.filter(r => r.status === "Present").length;

  const bulkSet = useMutation({
    mutationFn: async (status: string) => {
      const notes = session ? `session:${session}` : null;
      const updates: { id: string }[] = [];
      const inserts: { event_id: string; founder_id: string; status: string; notes: string | null }[] = [];
      for (const f of founderList) {
        const existing = records.find(r => r.founder_id === f.id && ((r.notes || null) === notes));
        if (existing) updates.push({ id: existing.id });
        else inserts.push({ event_id: event.id, founder_id: f.id, status, notes });
      }
      if (updates.length) {
        const { error } = await supabase.from("event_attendance").update({ status }).in("id", updates.map(u => u.id));
        if (error) throw error;
      }
      if (inserts.length) {
        const { error } = await supabase.from("event_attendance").insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: (_d, status) => {
      qc.invalidateQueries({ queryKey: ["event-attendance", event.id] });
      toast.success(`Marked all ${status.toLowerCase()}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">Session label</Label>
          <Input value={session} onChange={e => setSession(e.target.value)}
            placeholder="Whole event" className="h-8 w-52 text-xs" />
        </div>
        <div className="ml-auto text-sm">
          <span className="font-mono tabular-nums font-semibold">{attended}</span>
          <span className="text-muted-foreground"> / {founderList.length} present</span>
        </div>
      </div>

      {founderList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Bulk:</span>
          <Button variant="outline" size="sm" className="h-7 text-xs"
            disabled={bulkSet.isPending} onClick={() => bulkSet.mutate("Present")}>
            Mark all present
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs"
            disabled={bulkSet.isPending} onClick={() => bulkSet.mutate("Absent")}>
            Mark all absent
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs"
            disabled={bulkSet.isPending} onClick={() => bulkSet.mutate("Excused")}>
            Mark all excused
          </Button>
        </div>
      )}


      {!event.all_founders && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add founder
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-72">
            <Command>
              <CommandInput placeholder="Search…" />
              <CommandList><CommandEmpty>No founders</CommandEmpty>
                <CommandGroup>
                  {availableToAdd.map(f => (
                    <CommandItem key={f.id} onSelect={() => addFounder.mutate(f.id)}>
                      {f.founder_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {founderList.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-10 border rounded-xl">
          No founders in this cohort. {event.all_founders ? "Set a cohort on the event." : "Add founders above."}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {founderList.map((f, idx) => {
            const rec = relevantRecords.find(r => r.founder_id === f.id);
            const status = rec?.status ?? "";
            return (
              <div key={f.id} className={"flex items-center gap-3 px-3 py-2 " + (idx > 0 ? "border-t" : "")}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{f.founder_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{f.startup_name}</div>
                </div>
                <div className="inline-flex rounded-full border p-0.5 bg-muted/40">
                  {ATTENDANCE_STATUSES.map(s => (
                    <button key={s}
                      onClick={() => setStatus.mutate({ founder_id: f.id, status: s })}
                      className={
                        "text-[11px] px-2.5 py-1 rounded-full transition-colors " +
                        (status === s
                          ? (s === "Present" ? "bg-emerald-100 text-emerald-700"
                            : s === "Absent" ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700")
                          : "text-muted-foreground hover:text-foreground")
                      }
                    >{s}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== STAKEHOLDERS ============================== */
function StakeholdersTab({ event }: { event: Tables<"events"> }) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["stakeholders-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stakeholders")
        .select("id, full_name, type, institution_name").eq("is_archived", false).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["event-stakeholders", event.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_stakeholders")
        .select("*, stakeholders(id, full_name, type, institution_name)").eq("event_id", event.id);
      if (error) throw error;
      return data as any[];
    },
  });

  const attached = new Set(rows.map(r => r.stakeholder_id));
  const available = stakeholders.filter(s => !attached.has(s.id));

  const attach = useMutation({
    mutationFn: async (stakeholder_id: string) => {
      const { error } = await supabase.from("event_stakeholders")
        .insert({ event_id: event.id, stakeholder_id, role: "Guest", attendance_status: "invited" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-stakeholders", event.id] }); setPickerOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("event_stakeholders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-stakeholders", event.id] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_stakeholders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-stakeholders", event.id] }),
  });

  return (
    <div className="space-y-4">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Attach stakeholder
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80">
          <Command>
            <CommandInput placeholder="Search stakeholders…" />
            <CommandList><CommandEmpty>No results</CommandEmpty>
              <CommandGroup>
                {available.map(s => (
                  <CommandItem key={s.id} onSelect={() => attach.mutate(s.id)}>
                    <div>
                      <div className="text-sm">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s.type} · {s.institution_name}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-10 border rounded-xl">No stakeholders attached yet.</div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {rows.map((r, idx) => (
            <div key={r.id} className={"grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2 " + (idx > 0 ? "border-t" : "")}>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.stakeholders?.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.stakeholders?.type} · {r.stakeholders?.institution_name}</div>
              </div>
              <Select value={r.role || "Guest"} onValueChange={v => update.mutate({ id: r.id, patch: { role: v } })}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STAKEHOLDER_ROLES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={r.attendance_status || "invited"} onValueChange={v => update.mutate({ id: r.id, patch: { attendance_status: v } })}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STAKEHOLDER_STATUSES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove.mutate(r.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== LOGISTICS ============================== */
function LogisticsTab({ event }: { event: Tables<"events"> }) {
  const qc = useQueryClient();
  const { data: row } = useQuery({
    queryKey: ["event-logistics", event.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_logistics").select("*").eq("event_id", event.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [transports, setTransports] = useState<TransportItem[]>([]);
  const [accomm, setAccomm] = useState<AccommodationItem[]>([]);
  const [caterings, setCaterings] = useState<CateringItem[]>([]);
  const [people, setPeople] = useState<string>("");
  const [comments, setComments] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    setTransports(asArr<TransportItem>(row?.transportations));
    setAccomm(asArr<AccommodationItem>(row?.accommodations));
    setCaterings(asArr<CateringItem>(row?.caterings));
    setPeople((row?.people_involved ?? []).join(", "));
    setComments(row?.comments ?? "");
    if (row !== undefined) setHydrated(true);
  }, [row, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        event_id: event.id,
        transportations: transports as unknown as Json,
        accommodations: accomm as unknown as Json,
        caterings: caterings as unknown as Json,
        people_involved: people.split(",").map(s => s.trim()).filter(Boolean),
        comments: comments || null,
      };
      if (row) {
        const { error } = await supabase.from("event_logistics").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_logistics").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Logistics saved"); qc.invalidateQueries({ queryKey: ["event-logistics", event.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <LogisticsSection
        icon={<Plane className="h-4 w-4" />}
        title="Transportation"
        items={transports}
        empty="No transport arranged yet."
        onAdd={() => setTransports([...transports, { person: "", type: "Flight", from: "", to: "", time: "", notes: "" }])}
        renderItem={(t, i) => (
          <div className="grid grid-cols-6 gap-1.5">
            <Input className="h-8 text-xs" placeholder="Person" value={t.person} onChange={e => setTransports(transports.map((x, j) => j === i ? { ...x, person: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="Type" value={t.type} onChange={e => setTransports(transports.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="From" value={t.from} onChange={e => setTransports(transports.map((x, j) => j === i ? { ...x, from: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="To" value={t.to} onChange={e => setTransports(transports.map((x, j) => j === i ? { ...x, to: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="Time" value={t.time} onChange={e => setTransports(transports.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="Notes" value={t.notes} onChange={e => setTransports(transports.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
          </div>
        )}
        onRemove={i => setTransports(transports.filter((_, j) => j !== i))}
      />

      <LogisticsSection
        icon={<Bed className="h-4 w-4" />}
        title="Accommodation"
        items={accomm}
        empty="No lodging arranged yet."
        onAdd={() => setAccomm([...accomm, { person: "", hotel: "", check_in: "", check_out: "", notes: "" }])}
        renderItem={(a, i) => (
          <div className="grid grid-cols-5 gap-1.5">
            <Input className="h-8 text-xs" placeholder="Person" value={a.person} onChange={e => setAccomm(accomm.map((x, j) => j === i ? { ...x, person: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="Hotel" value={a.hotel} onChange={e => setAccomm(accomm.map((x, j) => j === i ? { ...x, hotel: e.target.value } : x))} />
            <Input className="h-8 text-xs" type="date" value={a.check_in} onChange={e => setAccomm(accomm.map((x, j) => j === i ? { ...x, check_in: e.target.value } : x))} />
            <Input className="h-8 text-xs" type="date" value={a.check_out} onChange={e => setAccomm(accomm.map((x, j) => j === i ? { ...x, check_out: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="Notes" value={a.notes} onChange={e => setAccomm(accomm.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
          </div>
        )}
        onRemove={i => setAccomm(accomm.filter((_, j) => j !== i))}
      />

      <LogisticsSection
        icon={<Utensils className="h-4 w-4" />}
        title="Catering"
        items={caterings}
        empty="No catering arranged yet."
        onAdd={() => setCaterings([...caterings, { label: "", option: "", notes: "" }])}
        renderItem={(c, i) => (
          <div className="grid grid-cols-3 gap-1.5">
            <Input className="h-8 text-xs" placeholder="Label (e.g. Lunch)" value={c.label} onChange={e => setCaterings(caterings.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="Option" value={c.option} onChange={e => setCaterings(caterings.map((x, j) => j === i ? { ...x, option: e.target.value } : x))} />
            <Input className="h-8 text-xs" placeholder="Notes" value={c.notes} onChange={e => setCaterings(caterings.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
          </div>
        )}
        onRemove={i => setCaterings(caterings.filter((_, j) => j !== i))}
      />

      <div>
        <Label className="text-xs">People involved (comma-separated)</Label>
        <Input value={people} onChange={e => setPeople(e.target.value)} placeholder="Amine, Sara, …" />
      </div>

      <div>
        <Label className="text-xs">Comments</Label>
        <Textarea rows={3} value={comments} onChange={e => setComments(e.target.value)} />
      </div>

      <div className="flex justify-end pt-3 border-t">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save logistics</Button>
      </div>
    </div>
  );
}

function LogisticsSection<T>({
  icon, title, items, empty, onAdd, renderItem, onRemove,
}: {
  icon: React.ReactNode; title: string; items: T[]; empty: string;
  onAdd: () => void; renderItem: (item: T, i: number) => React.ReactNode; onRemove: (i: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium"><span className="text-muted-foreground">{icon}</span>{title}</div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground border rounded-lg px-3 py-4 text-center">{empty}</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">{renderItem(it, i)}</div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(i)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== CHECKLIST ============================== */
function ChecklistTab({ event, onSaved }: { event: Tables<"events">; onSaved: () => void }) {
  const [items, setItems] = useState<ChecklistItem[]>(asArr<ChecklistItem>(event.checklist));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").update({ checklist: items as unknown as Json }).eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Checklist saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium"><ClipboardList className="h-4 w-4 text-muted-foreground" />Checklist</div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setItems([...items, { text: "", done: false, assignee: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Add item
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground border rounded-lg px-3 py-6 text-center">No items yet.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="checkbox" checked={it.done} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, done: e.target.checked } : x))} />
              <Input className="h-8 text-xs flex-1" placeholder="Task" value={it.text}
                onChange={e => setItems(items.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
              <Input className="h-8 text-xs w-40" placeholder="Assignee" value={it.assignee ?? ""}
                onChange={e => setItems(items.map((x, j) => j === i ? { ...x, assignee: e.target.value } : x))} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end pt-3 border-t">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save checklist</Button>
      </div>
    </div>
  );
}
