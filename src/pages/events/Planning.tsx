import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, ChevronsUpDown, CalendarIcon, ExternalLink, Clock, Users } from "lucide-react";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { TagPicker } from "@/components/TagPicker";
import { TagBadges } from "@/components/TagBadges";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatUrl } from "@/lib/formatUrl";
import type { Tables, Json } from "@/integrations/supabase/types";

type Event = Tables<"events">;

const EVENT_TYPES = ["Masterclass", "Mentorship", "Pitch Session", "Networking", "Social"];
const STATUSES = ["Planning", "Active", "Completed"];

interface LinkItem { title: string; url: string; }
interface SlotItem { founder_id: string; founder_name: string; date: string; start_time: string; end_time: string; }
interface LogisticsItem { need: string; done: boolean; }

interface PlanningForm {
  name: string;
  description: string;
  event_type: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  status: string;
  expert_id: string;
  expert_name: string;
  tag_ids: string[];
  all_founders: boolean;
  links: LinkItem[];
  slots: SlotItem[];
  logistics: LogisticsItem[];
}

const emptyForm: PlanningForm = {
  name: "", description: "", event_type: "Masterclass",
  start_date: "", end_date: "", start_time: "", end_time: "",
  location: "", status: "Planning", expert_id: "", expert_name: "",
  tag_ids: [], all_founders: false, links: [], slots: [], logistics: [],
};

const statusBadgeClass = (s: string) => {
  if (s === "Active") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400";
  if (s === "Completed") return "bg-muted text-muted-foreground";
  return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400";
};

export default function Planning() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Event | null>(null);
  const [form, setForm] = useState<PlanningForm>({ ...emptyForm });
  const [expertOpen, setExpertOpen] = useState(false);

  const set = <K extends keyof PlanningForm>(k: K, v: PlanningForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stakeholders").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: founders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  // Helpers
  const getExpertName = (id: string | null) => {
    if (!id) return "—";
    return stakeholders.find(s => s.id === id)?.full_name || "—";
  };

  function parseLinks(raw: Json | null): LinkItem[] {
    if (!Array.isArray(raw)) return [];
    return raw as unknown as LinkItem[];
  }
  function parseSlots(raw: Json | null): SlotItem[] {
    if (!Array.isArray(raw)) return [];
    return raw as unknown as SlotItem[];
  }
  function parseLogistics(raw: Json | null): LogisticsItem[] {
    if (!Array.isArray(raw)) return [];
    return raw as unknown as LogisticsItem[];
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        event_type: form.event_type || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        expert_id: form.expert_id || null,
        all_founders: form.all_founders,
        tag_ids: form.tag_ids,
        links: form.links.filter(l => l.url) as unknown as Json,
        one_on_one_slots: form.slots.map(s => ({
          founder_id: s.founder_id, founder_name: s.founder_name,
          date: s.date, start_time: s.start_time, end_time: s.end_time,
        })) as unknown as Json,
        logistics_needs: form.logistics as unknown as Json,
      };
      // Use needs for storing description + times + location as JSON
      payload.needs = JSON.stringify({
        description: form.description,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location,
      }) as unknown as Json;

      if (editing) {
        const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      toast.success(editing ? "Event updated" : "Event created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setDeleteId(null);
      toast.success("Event deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function parseNeedsExtra(ev: Event) {
    try {
      if (typeof ev.needs === "string") return JSON.parse(ev.needs);
      if (typeof ev.needs === "object" && ev.needs && !Array.isArray(ev.needs)) return ev.needs as any;
    } catch {}
    return { description: "", start_time: "", end_time: "", location: "" };
  }

  function openEdit(ev: Event) {
    const extra = parseNeedsExtra(ev);
    setForm({
      name: ev.name,
      description: extra.description || "",
      event_type: ev.event_type || "Masterclass",
      start_date: ev.start_date || "",
      end_date: ev.end_date || "",
      start_time: extra.start_time || "",
      end_time: extra.end_time || "",
      location: extra.location || (ev as any).location || "",
      status: ev.status || "Planning",
      expert_id: ev.expert_id || "",
      expert_name: ev.expert_id ? getExpertName(ev.expert_id) : "",
      tag_ids: (ev.tag_ids as string[]) || [],
      all_founders: ev.all_founders || false,
      links: parseLinks(ev.links),
      slots: parseSlots(ev.one_on_one_slots),
      logistics: parseLogistics(ev.logistics_needs),
    });
    setEditing(ev);
    setDialogOpen(true);
  }

  function openNew() {
    setForm({ ...emptyForm });
    setEditing(null);
    setDialogOpen(true);
  }

  // Link helpers
  const addLink = () => set("links", [...form.links, { title: "", url: "" }]);
  const removeLink = (i: number) => set("links", form.links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: keyof LinkItem, val: string) => {
    const next = [...form.links]; next[i] = { ...next[i], [field]: val }; set("links", next);
  };

  // Slot helpers
  const addSlot = () => set("slots", [...form.slots, { founder_id: "", founder_name: "", date: "", start_time: "", end_time: "" }]);
  const removeSlot = (i: number) => set("slots", form.slots.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, field: keyof SlotItem, val: string) => {
    const next = [...form.slots]; next[i] = { ...next[i], [field]: val }; set("slots", next);
  };

  // Logistics helpers
  const addLogistic = () => set("logistics", [...form.logistics, { need: "", done: false }]);
  const removeLogistic = (i: number) => set("logistics", form.logistics.filter((_, idx) => idx !== i));
  const updateLogistic = (i: number, field: keyof LogisticsItem, val: any) => {
    const next = [...form.logistics]; next[i] = { ...next[i], [field]: val }; set("logistics", next);
  };

  // View data
  const viewExtra = viewing ? parseNeedsExtra(viewing) : { description: "", start_time: "", end_time: "", location: "" };
  const viewLinks = viewing ? parseLinks(viewing.links) : [];
  const viewSlots = viewing ? parseSlots(viewing.one_on_one_slots) : [];
  const viewLogistics = viewing ? parseLogistics(viewing.logistics_needs) : [];

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planning</h1>
          <p className="text-sm text-muted-foreground">Manage events, mentorships, and sessions</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Event</Button>
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Expert</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : events.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No events yet</TableCell></TableRow>
              ) : events.map(ev => {
                const slots = Array.isArray(ev.one_on_one_slots) ? ev.one_on_one_slots : [];
                return (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium">
                      {ev.name}
                      {slots.length > 0 && <Badge variant="outline" className="ml-2 text-[10px]">{slots.length} slot{slots.length !== 1 ? "s" : ""}</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{ev.event_type || "General"}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ev.start_date || "—"}</TableCell>
                    <TableCell className="text-sm">{getExpertName(ev.expert_id)}</TableCell>
                    <TableCell>
                      <Badge className={`${statusBadgeClass(ev.status || "Planning")} border-0 font-medium`}>{ev.status || "Planning"}</Badge>
                    </TableCell>
                    <TableCell><TagBadges tagIds={ev.tag_ids as string[] | null} /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(ev)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(ev)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(ev.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">

            {/* Basic Info */}
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Event title" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={form.event_type} onValueChange={v => set("event_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Event description..." rows={2} />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Room A3, UM6P Campus" />
            </div>

            {/* Expert */}
            <div className="space-y-2">
              <Label>Expert (Stakeholder)</Label>
              <Popover open={expertOpen} onOpenChange={setExpertOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {form.expert_name || "Select expert..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                  <Command>
                    <CommandInput placeholder="Search stakeholders..." />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>No stakeholders found.</CommandEmpty>
                      <CommandGroup>
                        {stakeholders.map(st => (
                          <CommandItem key={st.id} value={st.full_name} onSelect={() => {
                            set("expert_id", st.id);
                            set("expert_name", st.full_name);
                            setExpertOpen(false);
                          }}>
                            {st.full_name}
                            {st.title && <span className="ml-2 text-xs text-muted-foreground">({st.title})</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Target Cohorts / Tags</Label>
              <TagPicker value={form.tag_ids} onChange={ids => set("tag_ids", ids)} />
            </div>

            {/* All Founders Switch */}
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <Switch checked={form.all_founders} onCheckedChange={v => set("all_founders", v)} />
              <div>
                <Label className="text-sm font-medium">All Founders Attending</Label>
                <p className="text-xs text-muted-foreground">Toggle for general session attendance</p>
              </div>
            </div>

            {/* 1-on-1 Slots */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">1-on-1 Slots</Label>
                <Button variant="outline" size="sm" onClick={addSlot}><Plus className="mr-1 h-3 w-3" /> Add Slot</Button>
              </div>
              {form.slots.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">No 1-on-1 slots added yet.</p>
              )}
              {form.slots.map((slot, i) => (
                <SlotRow key={i} slot={slot} index={i} founders={founders} onUpdate={updateSlot} onRemove={removeSlot} />
              ))}
            </div>

            {/* Dynamic Logistics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Logistics Needs</Label>
                <Button variant="outline" size="sm" onClick={addLogistic}><Plus className="mr-1 h-3 w-3" /> Add Need</Button>
              </div>
              {form.logistics.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">No logistics needs added yet.</p>
              )}
              {form.logistics.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={item.done} onCheckedChange={v => updateLogistic(i, "done", !!v)} />
                  <Input value={item.need} onChange={e => updateLogistic(i, "need", e.target.value)} placeholder="e.g. Room booking, Catering" className="flex-1" />
                  <Button size="icon" variant="ghost" onClick={() => removeLogistic(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>

            {/* Links */}
            <div className="space-y-2">
              <Label>Links</Label>
              {form.links.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Title" value={l.title} onChange={e => updateLink(i, "title", e.target.value)} className="flex-1" />
                  <Input placeholder="URL" value={l.url} onChange={e => updateLink(i, "url", e.target.value)} className="flex-1" />
                  <Button size="icon" variant="ghost" onClick={() => removeLink(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLink}><Plus className="mr-1 h-3 w-3" /> Add Link</Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name}>
              {editing ? "Save Changes" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.name || "Event Details"}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm font-medium text-muted-foreground">Type</span>
                <span className="text-sm col-span-2">{viewing.event_type || "General"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <span className="text-sm col-span-2"><Badge className={`${statusBadgeClass(viewing.status || "Planning")} border-0`}>{viewing.status || "Planning"}</Badge></span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm font-medium text-muted-foreground">Date</span>
                <span className="text-sm col-span-2">{viewing.start_date || "—"}{viewing.end_date ? ` → ${viewing.end_date}` : ""}</span>
              </div>
              {(viewExtra.start_time || viewExtra.end_time) && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Time</span>
                  <span className="text-sm col-span-2">{viewExtra.start_time || "—"} – {viewExtra.end_time || "—"}</span>
                </div>
              )}
              {viewExtra.location && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Location</span>
                  <span className="text-sm col-span-2">{viewExtra.location}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm font-medium text-muted-foreground">Expert</span>
                <span className="text-sm col-span-2">{getExpertName(viewing.expert_id)}</span>
              </div>
              {viewExtra.description && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Description</span>
                  <span className="text-sm col-span-2 whitespace-pre-wrap">{viewExtra.description}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm font-medium text-muted-foreground">Attendance</span>
                <span className="text-sm col-span-2">{viewing.all_founders ? <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />All Founders</Badge> : "Selected"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm font-medium text-muted-foreground">Tags</span>
                <span className="col-span-2"><TagBadges tagIds={viewing.tag_ids as string[] | null} /></span>
              </div>

              {/* Links */}
              {viewLinks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Links</span>
                  <div className="space-y-1">
                    {viewLinks.map((l, i) => (
                      <a key={i} href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> {l.title || l.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Logistics */}
              {viewLogistics.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Logistics</span>
                  <div className="space-y-1">
                    {viewLogistics.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span>{l.done ? "✅" : "⬜"}</span>
                        <span>{l.need}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 1-on-1 Slots */}
              {viewSlots.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">1-on-1 Schedule</span>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Founder</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewSlots.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{s.founder_name || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{s.date || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{s.start_time && s.end_time ? `${s.start_time} – ${s.end_time}` : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Slot Row Component ─── */
function SlotRow({ slot, index, founders, onUpdate, onRemove }: {
  slot: SlotItem; index: number; founders: Tables<"founders">[];
  onUpdate: (i: number, field: keyof SlotItem, val: string) => void;
  onRemove: (i: number) => void;
}) {
  const [founderOpen, setFounderOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <div className="p-3 border rounded-lg space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Slot #{index + 1}</span>
        <Button size="icon" variant="ghost" onClick={() => onRemove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Founder</Label>
          <Popover open={founderOpen} onOpenChange={setFounderOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm h-9">
                {slot.founder_name || "Select founder..."}
                <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
              <Command>
                <CommandInput placeholder="Search founders..." />
                <CommandList className="max-h-[200px]">
                  <CommandEmpty>No founders found.</CommandEmpty>
                  <CommandGroup>
                    {founders.map(f => (
                      <CommandItem key={f.id} value={f.founder_name} onSelect={() => {
                        onUpdate(index, "founder_id", f.id);
                        onUpdate(index, "founder_name", f.founder_name);
                        setFounderOpen(false);
                      }}>
                        {f.founder_name}
                        <span className="ml-2 text-xs text-muted-foreground">{f.startup_name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start font-normal text-sm h-9", !slot.date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-3 w-3" />
                {slot.date || "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
              <Calendar
                mode="single"
                selected={slot.date ? new Date(slot.date + "T00:00:00") : undefined}
                onSelect={d => { if (d) { onUpdate(index, "date", format(d, "yyyy-MM-dd")); setDateOpen(false); } }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <div className="relative">
            <Clock className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
            <Input type="time" value={slot.start_time} onChange={e => onUpdate(index, "start_time", e.target.value)} className="pl-7 h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <div className="relative">
            <Clock className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
            <Input type="time" value={slot.end_time} onChange={e => onUpdate(index, "end_time", e.target.value)} className="pl-7 h-9 text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
