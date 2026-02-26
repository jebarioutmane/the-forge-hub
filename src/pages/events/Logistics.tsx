import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, ChevronsUpDown, CalendarIcon, ExternalLink, X, Plane, Hotel, UtensilsCrossed } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatUrl } from "@/lib/formatUrl";
import type { Json } from "@/integrations/supabase/types";

const TRANSPORT_TYPES = ["Flight", "Train", "Car", "Bus"];
const CATERING_OPTIONS = ["Full Board", "Half Board", "Breakfast Only", "None"];

interface LinkItem { title: string; url: string; }

interface LogisticsForm {
  event_id: string;
  event_name: string;
  people_involved: string[];
  transportation_type: string;
  departure_city: string;
  arrival_city: string;
  flight_details: string;
  arrival_time: string;
  pickup_dropoff_details: string;
  is_round_trip: boolean;
  return_departure_city: string;
  return_arrival_city: string;
  return_flight_details: string;
  return_time: string;
  accommodation_name: string;
  room_options: string;
  check_in_date: string;
  check_out_date: string;
  catering_options: string;
  comments: string;
  links: LinkItem[];
}

const emptyForm: LogisticsForm = {
  event_id: "", event_name: "",
  people_involved: [],
  transportation_type: "Flight",
  departure_city: "", arrival_city: "", flight_details: "", arrival_time: "",
  pickup_dropoff_details: "",
  is_round_trip: false,
  return_departure_city: "", return_arrival_city: "", return_flight_details: "", return_time: "",
  accommodation_name: "", room_options: "", check_in_date: "", check_out_date: "",
  catering_options: "None", comments: "",
  links: [],
};

function parseLinks(raw: Json | null): LinkItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as LinkItem[];
}

export default function Logistics() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<LogisticsForm>({ ...emptyForm });
  const [eventOpen, setEventOpen] = useState(false);
  const [personInput, setPersonInput] = useState("");

  const set = <K extends keyof LogisticsForm>(k: K, v: LogisticsForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const { data: logistics = [], isLoading } = useQuery({
    queryKey: ["event_logistics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_logistics").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const getEventName = (id: string | null) => {
    if (!id) return "—";
    return events.find(e => e.id === id)?.name || "—";
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        event_id: form.event_id || null,
        people_involved: form.people_involved,
        transportation_type: form.transportation_type || null,
        departure_city: form.departure_city || null,
        arrival_city: form.arrival_city || null,
        flight_details: form.flight_details || null,
        arrival_time: form.arrival_time || null,
        pickup_dropoff_details: form.pickup_dropoff_details || null,
        is_round_trip: form.is_round_trip,
        return_departure_city: form.is_round_trip ? (form.return_departure_city || null) : null,
        return_arrival_city: form.is_round_trip ? (form.return_arrival_city || null) : null,
        return_flight_details: form.is_round_trip ? (form.return_flight_details || null) : null,
        return_time: form.is_round_trip ? (form.return_time || null) : null,
        accommodation_name: form.accommodation_name || null,
        room_options: form.room_options || null,
        check_in_date: form.check_in_date || null,
        check_out_date: form.check_out_date || null,
        catering_options: form.catering_options || null,
        comments: form.comments || null,
        links: form.links.filter(l => l.url) as unknown as Json,
      };
      if (editing) {
        const { error } = await supabase.from("event_logistics").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_logistics").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_logistics"] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      toast.success(editing ? "Logistics updated" : "Logistics created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_logistics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event_logistics"] });
      setDeleteId(null);
      toast.success("Logistics deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(item: any) {
    setForm({
      event_id: item.event_id || "",
      event_name: getEventName(item.event_id),
      people_involved: item.people_involved || [],
      transportation_type: item.transportation_type || "Flight",
      departure_city: item.departure_city || "",
      arrival_city: item.arrival_city || "",
      flight_details: item.flight_details || "",
      arrival_time: item.arrival_time || "",
      pickup_dropoff_details: item.pickup_dropoff_details || "",
      is_round_trip: item.is_round_trip || false,
      return_departure_city: item.return_departure_city || "",
      return_arrival_city: item.return_arrival_city || "",
      return_flight_details: item.return_flight_details || "",
      return_time: item.return_time || "",
      accommodation_name: item.accommodation_name || "",
      room_options: item.room_options || "",
      check_in_date: item.check_in_date ? item.check_in_date.split("T")[0] : "",
      check_out_date: item.check_out_date ? item.check_out_date.split("T")[0] : "",
      catering_options: item.catering_options || "None",
      comments: item.comments || "",
      links: parseLinks(item.links),
    });
    setEditing(item);
    setDialogOpen(true);
  }

  function openNew() {
    setForm({ ...emptyForm });
    setEditing(null);
    setDialogOpen(true);
  }

  const addPerson = () => {
    const v = personInput.trim();
    if (v && !form.people_involved.includes(v)) {
      set("people_involved", [...form.people_involved, v]);
    }
    setPersonInput("");
  };
  const removePerson = (i: number) => set("people_involved", form.people_involved.filter((_, idx) => idx !== i));

  const addLink = () => set("links", [...form.links, { title: "", url: "" }]);
  const removeLink = (i: number) => set("links", form.links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: keyof LinkItem, val: string) => {
    const next = [...form.links]; next[i] = { ...next[i], [field]: val }; set("links", next);
  };

  const viewLinks = viewing ? parseLinks(viewing.links) : [];

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logistics</h1>
          <p className="text-sm text-muted-foreground">Manage travel, accommodation & catering for events</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Logistics Plan</Button>
      </div>

      {/* List Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Catering</TableHead>
                <TableHead>People</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : logistics.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No logistics records yet</TableCell></TableRow>
              ) : logistics.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{getEventName(item.event_id)}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{item.transportation_type || "—"}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.departure_city && item.arrival_city ? `${item.departure_city} → ${item.arrival_city}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{item.accommodation_name || "—"}</TableCell>
                  <TableCell className="text-sm">{item.catering_options || "—"}</TableCell>
                  <TableCell>
                    {(item.people_involved as string[] || []).length > 0 && (
                      <Badge variant="outline" className="text-xs">{(item.people_involved as string[]).length} people</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewing(item)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(item)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Logistics" : "New Logistics Plan"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">

            {/* General Info Card */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">📋 General Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target Event *</Label>
                  <Popover open={eventOpen} onOpenChange={setEventOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {form.event_name || "Select event..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                      <Command>
                        <CommandInput placeholder="Search events..." />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty>No events found.</CommandEmpty>
                          <CommandGroup>
                            {events.map(ev => (
                              <CommandItem key={ev.id} value={ev.name} onSelect={() => {
                                set("event_id", ev.id);
                                set("event_name", ev.name);
                                setEventOpen(false);
                              }}>
                                {ev.name}
                                {ev.event_type && <span className="ml-2 text-xs text-muted-foreground">({ev.event_type})</span>}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>People Involved</Label>
                  <div className="flex gap-2">
                    <Input
                      value={personInput}
                      onChange={e => setPersonInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPerson(); } }}
                      placeholder="Type a name and press Enter"
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={addPerson} type="button">Add</Button>
                  </div>
                  {form.people_involved.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {form.people_involved.map((p, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          {p}
                          <button onClick={() => removePerson(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Transportation Card */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">✈️ Transportation</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.transportation_type} onValueChange={v => set("transportation_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Departure City</Label>
                    <Input value={form.departure_city} onChange={e => set("departure_city", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Arrival City</Label>
                    <Input value={form.arrival_city} onChange={e => set("arrival_city", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Flight / Ticket Details</Label>
                    <Input value={form.flight_details} onChange={e => set("flight_details", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Arrival Time</Label>
                    <Input type="datetime-local" value={form.arrival_time} onChange={e => set("arrival_time", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pickup & Drop-off Details</Label>
                  <Textarea value={form.pickup_dropoff_details} onChange={e => set("pickup_dropoff_details", e.target.value)} rows={2} placeholder="Ground transport arrangements..." />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Switch checked={form.is_round_trip} onCheckedChange={v => set("is_round_trip", v)} />
                  <div>
                    <Label className="text-sm font-medium">Round Trip</Label>
                    <p className="text-xs text-muted-foreground">Enable to add return journey details</p>
                  </div>
                </div>
                {form.is_round_trip && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Return Journey</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Return Departure City</Label>
                        <Input value={form.return_departure_city} onChange={e => set("return_departure_city", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Return Arrival City</Label>
                        <Input value={form.return_arrival_city} onChange={e => set("return_arrival_city", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Return Flight Details</Label>
                        <Input value={form.return_flight_details} onChange={e => set("return_flight_details", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Return Time</Label>
                        <Input type="datetime-local" value={form.return_time} onChange={e => set("return_time", e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Accommodation Card */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">🏨 Accommodation</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hotel / Accommodation Name</Label>
                    <Input value={form.accommodation_name} onChange={e => set("accommodation_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Room Options</Label>
                    <Input value={form.room_options} onChange={e => set("room_options", e.target.value)} placeholder="e.g. Single, Double, Suite" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Check-In</Label>
                    <Input type="date" value={form.check_in_date} onChange={e => set("check_in_date", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Check-Out</Label>
                    <Input type="date" value={form.check_out_date} onChange={e => set("check_out_date", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Catering Card */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">🍽️ Catering & Extras</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Catering Options</Label>
                  <Select value={form.catering_options} onValueChange={v => set("catering_options", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATERING_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Comments</Label>
                  <Textarea value={form.comments} onChange={e => set("comments", e.target.value)} rows={2} placeholder="Dietary restrictions, special requests..." />
                </div>
                <div className="space-y-2">
                  <Label>Reference Links</Label>
                  {form.links.map((l, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="Title" value={l.title} onChange={e => updateLink(i, "title", e.target.value)} className="flex-1" />
                      <Input placeholder="URL" value={l.url} onChange={e => updateLink(i, "url", e.target.value)} className="flex-1" />
                      <Button size="icon" variant="ghost" onClick={() => removeLink(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addLink}><Plus className="mr-1 h-3 w-3" /> Add Link</Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.event_id}>
              {editing ? "Save Changes" : "Create Logistics"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Logistics — {getEventName(viewing?.event_id)}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-5 py-2">
              {/* General */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">📋 General</h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Event</span>
                  <span className="text-sm col-span-2">{getEventName(viewing.event_id)}</span>
                </div>
                {(viewing.people_involved as string[] || []).length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm font-medium text-muted-foreground">People</span>
                    <div className="col-span-2 flex flex-wrap gap-1">
                      {(viewing.people_involved as string[]).map((p: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Transport */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">✈️ Transportation</h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Type</span>
                  <span className="text-sm col-span-2">{viewing.transportation_type || "—"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Route</span>
                  <span className="text-sm col-span-2">{viewing.departure_city && viewing.arrival_city ? `${viewing.departure_city} → ${viewing.arrival_city}` : "—"}</span>
                </div>
                {viewing.flight_details && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Details</span>
                    <span className="text-sm col-span-2">{viewing.flight_details}</span>
                  </div>
                )}
                {viewing.arrival_time && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Arrival</span>
                    <span className="text-sm col-span-2">{viewing.arrival_time}</span>
                  </div>
                )}
                {viewing.pickup_dropoff_details && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Ground Transport</span>
                    <span className="text-sm col-span-2 whitespace-pre-wrap">{viewing.pickup_dropoff_details}</span>
                  </div>
                )}
                {viewing.is_round_trip && (
                  <div className="pl-3 border-l-2 border-primary/20 space-y-2 mt-2">
                    <p className="text-xs font-semibold text-muted-foreground">Return Journey</p>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Route</span>
                      <span className="text-sm col-span-2">{viewing.return_departure_city} → {viewing.return_arrival_city}</span>
                    </div>
                    {viewing.return_flight_details && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Details</span>
                        <span className="text-sm col-span-2">{viewing.return_flight_details}</span>
                      </div>
                    )}
                    {viewing.return_time && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Return Time</span>
                        <span className="text-sm col-span-2">{viewing.return_time}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Accommodation */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">🏨 Accommodation</h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Hotel</span>
                  <span className="text-sm col-span-2">{viewing.accommodation_name || "—"}</span>
                </div>
                {viewing.room_options && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Rooms</span>
                    <span className="text-sm col-span-2">{viewing.room_options}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Check-In / Out</span>
                  <span className="text-sm col-span-2">
                    {viewing.check_in_date ? viewing.check_in_date.split("T")[0] : "—"} → {viewing.check_out_date ? viewing.check_out_date.split("T")[0] : "—"}
                  </span>
                </div>
              </div>

              {/* Catering */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">🍽️ Catering & Extras</h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Catering</span>
                  <span className="text-sm col-span-2">{viewing.catering_options || "—"}</span>
                </div>
                {viewing.comments && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Comments</span>
                    <span className="text-sm col-span-2 whitespace-pre-wrap">{viewing.comments}</span>
                  </div>
                )}
              </div>

              {/* Links */}
              {viewLinks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">🔗 Links</h4>
                  <div className="space-y-1">
                    {viewLinks.map((l, i) => (
                      <a key={i} href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> {l.title || l.url}
                      </a>
                    ))}
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
