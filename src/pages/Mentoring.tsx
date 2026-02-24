import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, ChevronsUpDown, CalendarIcon, ExternalLink, Clock, Users } from "lucide-react";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Tables, Json } from "@/integrations/supabase/types";

type Session = Tables<"mentoring_sessions">;

interface LinkItem { title: string; url: string; }
interface SlotItem { founder_id: string; founder_name: string; date: string; start_time: string; end_time: string; }

interface FormState {
  title: string;
  mentor_id: string;
  mentor_name: string;
  description: string;
  all_founders: boolean;
  links: LinkItem[];
  slots: SlotItem[];
}

const emptyForm: FormState = {
  title: "", mentor_id: "", mentor_name: "", description: "", all_founders: false, links: [], slots: [],
};

export default function Mentoring() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Session | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [mentorOpen, setMentorOpen] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  // Data fetching
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["mentoring_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mentoring_sessions").select("*").order("created_at", { ascending: false });
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title || null,
        mentor_id: form.mentor_id || null,
        mentor_name: form.mentor_name || "—",
        founder_name: form.all_founders ? "All Founders" : (form.slots.map(s => s.founder_name).join(", ") || "—"),
        description: form.description || null,
        all_founders: form.all_founders,
        links: form.links.filter(l => l.url) as unknown as Json,
        one_on_one_slots: form.slots.map(s => ({ founder_id: s.founder_id, founder_name: s.founder_name, date: s.date, start_time: s.start_time, end_time: s.end_time })) as unknown as Json,
      };
      if (editing) {
        const { error } = await supabase.from("mentoring_sessions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mentoring_sessions").insert({ ...payload, session_date: null, time_slot: null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentoring_sessions"] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      toast.success(editing ? "Session updated" : "Session added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mentoring_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mentoring_sessions"] }); setDeleteId(null); toast.success("Session deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(s: Session) {
    const links = Array.isArray(s.links) ? (s.links as unknown as LinkItem[]) : [];
    const slots = Array.isArray(s.one_on_one_slots) ? (s.one_on_one_slots as unknown as SlotItem[]) : [];
    setForm({
      title: s.title || "",
      mentor_id: s.mentor_id || "",
      mentor_name: s.mentor_name || "",
      description: s.description || "",
      all_founders: s.all_founders || false,
      links,
      slots,
    });
    setEditing(s);
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
    const next = [...form.links];
    next[i] = { ...next[i], [field]: val };
    set("links", next);
  };

  // Slot helpers
  const addSlot = () => set("slots", [...form.slots, { founder_id: "", founder_name: "", date: "", start_time: "", end_time: "" }]);
  const removeSlot = (i: number) => set("slots", form.slots.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, field: keyof SlotItem, val: string) => {
    const next = [...form.slots];
    next[i] = { ...next[i], [field]: val };
    set("slots", next);
  };

  // View fields
  const viewSlots = viewing ? (Array.isArray(viewing.one_on_one_slots) ? (viewing.one_on_one_slots as unknown as SlotItem[]) : []) : [];
  const viewLinks = viewing ? (Array.isArray(viewing.links) ? (viewing.links as unknown as LinkItem[]) : []) : [];

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mentoring Sessions</h1>
          <p className="text-sm text-muted-foreground">Schedule mentor sessions and 1-on-1 meetings with founders</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Session</Button>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Mentor</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>1-on-1 Slots</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : sessions.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sessions yet</TableCell></TableRow>
              ) : sessions.map(s => {
                const slots = Array.isArray(s.one_on_one_slots) ? s.one_on_one_slots : [];
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.title || "Untitled"}</TableCell>
                    <TableCell>{s.mentor_name}</TableCell>
                    <TableCell>
                      {s.all_founders ? (
                        <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> All Founders</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">{s.founder_name || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{slots.length} slot{slots.length !== 1 ? "s" : ""}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(s)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Session" : "New Mentoring Session"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. AI & Startups Workshop" />
            </div>

            {/* Mentor Select */}
            <div className="space-y-2">
              <Label>Mentor (Stakeholder)</Label>
              <Popover open={mentorOpen} onOpenChange={setMentorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {form.mentor_name || "Select mentor..."}
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
                            set("mentor_id", st.id);
                            set("mentor_name", st.full_name);
                            setMentorOpen(false);
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

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Session description..." rows={3} />
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

            {/* All Founders Switch */}
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <Switch checked={form.all_founders} onCheckedChange={v => set("all_founders", v)} />
              <div>
                <Label className="text-sm font-medium">All Founders Attending</Label>
                <p className="text-xs text-muted-foreground">Toggle if this is a general session for all founders</p>
              </div>
            </div>

            {/* 1-on-1 Slots */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">1-on-1 Slots</Label>
                <Button variant="outline" size="sm" onClick={addSlot}><Plus className="mr-1 h-3 w-3" /> Add Slot</Button>
              </div>
              {form.slots.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">No 1-on-1 slots added yet.</p>
              )}
              {form.slots.map((slot, i) => (
                <SlotRow key={i} slot={slot} index={i} founders={founders} onUpdate={updateSlot} onRemove={removeSlot} />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.mentor_name}>
              {editing ? "Save Changes" : "Create Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.title || "Session Details"}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm font-medium text-muted-foreground">Mentor</span>
                <span className="text-sm col-span-2">{viewing.mentor_name}</span>
              </div>
              {viewing.description && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Description</span>
                  <span className="text-sm col-span-2 whitespace-pre-wrap">{viewing.description}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm font-medium text-muted-foreground">Attendance</span>
                <span className="text-sm col-span-2">{viewing.all_founders ? "All Founders" : (viewing.founder_name || "—")}</span>
              </div>

              {/* Links */}
              {viewLinks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Links</span>
                  <div className="space-y-1">
                    {viewLinks.map((l, i) => (
                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> {l.title || l.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 1-on-1 Slots View */}
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
                            <TableCell className="text-muted-foreground">
                              {s.start_time && s.end_time ? `${s.start_time} – ${s.end_time}` : "—"}
                            </TableCell>
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
        {/* Founder Combobox */}
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

        {/* Date Picker */}
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

      {/* Time inputs */}
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
