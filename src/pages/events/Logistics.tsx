import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, ChevronsUpDown, ExternalLink, X, Plane } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { formatUrl } from "@/lib/formatUrl";
import { buildClickUpUrl } from "@/lib/clickupTransfer";
import type { Json } from "@/integrations/supabase/types";

const TRANSPORT_TYPES = ["Flight", "Train", "Car", "Bus"];
const CATERING_OPTIONS = ["Full Board", "Half Board", "Breakfast Only", "None"];

interface LinkItem { title: string; url: string; }

interface TransportEntry {
  person: string;
  type: string;
  departure_city: string;
  arrival_city: string;
  flight_number: string;
  departure_time: string;
  arrival_time: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  is_round_trip: boolean;
  return_departure_city: string;
  return_arrival_city: string;
  return_flight_number: string;
  return_time: string;
  links: LinkItem[];
}

interface AccommodationEntry {
  person: string;
  hotel_name: string;
  room_type: string;
  check_in: string;
  check_out: string;
  links: LinkItem[];
}

interface CateringEntry {
  person: string;
  option: string;
  comments: string;
  links: LinkItem[];
}

interface LogisticsForm {
  event_id: string;
  event_name: string;
  people_involved: string[];
  comments: string;
  transportations: TransportEntry[];
  accommodations: AccommodationEntry[];
  caterings: CateringEntry[];
}

const emptyTransport = (): TransportEntry => ({
  person: "", type: "Flight", departure_city: "", arrival_city: "",
  flight_number: "", departure_time: "", arrival_time: "",
  pickup_location: "", dropoff_location: "", pickup_time: "",
  is_round_trip: false, return_departure_city: "", return_arrival_city: "",
  return_flight_number: "", return_time: "", links: [],
});

const emptyAccommodation = (): AccommodationEntry => ({
  person: "", hotel_name: "", room_type: "", check_in: "", check_out: "", links: [],
});

const emptyCatering = (): CateringEntry => ({
  person: "", option: "None", comments: "", links: [],
});

const emptyForm: LogisticsForm = {
  event_id: "", event_name: "", people_involved: [], comments: "",
  transportations: [], accommodations: [], caterings: [],
};

function parseArr<T>(raw: Json | null): T[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as T[];
}

// Nested link builder component
function NestedLinks({ links, onChange }: { links: LinkItem[]; onChange: (l: LinkItem[]) => void }) {
  const add = () => onChange([...links, { title: "", url: "" }]);
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof LinkItem, v: string) => {
    const n = [...links]; n[i] = { ...n[i], [f]: v }; onChange(n);
  };
  return (
    <div className="space-y-2">
      <Label className="text-xs">Links</Label>
      {links.map((l, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input placeholder="Title" value={l.title} onChange={e => update(i, "title", e.target.value)} className="flex-1 h-8 text-xs" />
          <Input placeholder="URL" value={l.url} onChange={e => update(i, "url", e.target.value)} className="flex-1 h-8 text-xs" />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(i)}><X className="h-3 w-3 text-destructive" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={add}><Plus className="mr-1 h-3 w-3" /> Add Link</Button>
    </div>
  );
}

// Person dropdown component
function PersonSelect({ value, people, onChange }: { value: string; people: string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder="Select person..." /></SelectTrigger>
      <SelectContent>
        {people.length === 0 && <SelectItem value="__none" disabled>Add people above first</SelectItem>}
        {people.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function Logistics() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [form, setForm] = useState<LogisticsForm>({ ...emptyForm });
  const [eventOpen, setEventOpen] = useState(false);
  const [personInput, setPersonInput] = useState("");

  const set = <K extends keyof LogisticsForm>(k: K, v: LogisticsForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const updateTransport = (i: number, patch: Partial<TransportEntry>) => {
    const n = [...form.transportations]; n[i] = { ...n[i], ...patch }; set("transportations", n);
  };
  const updateAccommodation = (i: number, patch: Partial<AccommodationEntry>) => {
    const n = [...form.accommodations]; n[i] = { ...n[i], ...patch }; set("accommodations", n);
  };
  const updateCatering = (i: number, patch: Partial<CateringEntry>) => {
    const n = [...form.caterings]; n[i] = { ...n[i], ...patch }; set("caterings", n);
  };

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

  const getEventName = (id: string | null) => events.find(e => e.id === id)?.name || "—";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        event_id: form.event_id || null,
        people_involved: form.people_involved,
        comments: form.comments || null,
        transportations: form.transportations as unknown as Json,
        accommodations: form.accommodations as unknown as Json,
        caterings: form.caterings as unknown as Json,
        links: [] as unknown as Json,
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
      logAction("Events-Logistics", editing ? "UPDATE" : "INSERT", editing?.id || "new", editing ? (editing as any) : null, { event_id: form.event_id, people_involved: form.people_involved }, user?.email || "Unknown");
      qc.invalidateQueries({ queryKey: ["event_logistics"] });
      setDialogOpen(false); setEditing(null); setForm({ ...emptyForm });
      toast.success(editing ? "Logistics updated" : "Logistics created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_logistics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const deleted = logistics.find(l => l.id === id);
      logAction("Events-Logistics", "DELETE", id, deleted as any, null, user?.email || "Unknown");
      qc.invalidateQueries({ queryKey: ["event_logistics"] });
      setDeleteId(null); toast.success("Logistics deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(item: any) {
    setForm({
      event_id: item.event_id || "",
      event_name: getEventName(item.event_id),
      people_involved: item.people_involved || [],
      comments: item.comments || "",
      transportations: parseArr<TransportEntry>(item.transportations),
      accommodations: parseArr<AccommodationEntry>(item.accommodations),
      caterings: parseArr<CateringEntry>(item.caterings),
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
    if (v && !form.people_involved.includes(v)) set("people_involved", [...form.people_involved, v]);
    setPersonInput("");
  };

  // Summary helpers for list table
  const countItems = (item: any) => {
    const t = parseArr<any>(item.transportations).length;
    const a = parseArr<any>(item.accommodations).length;
    const c = parseArr<any>(item.caterings).length;
    return { t, a, c };
  };

  const transferToClickUp = (item: any, personName?: string) => {
    const transports = parseArr<TransportEntry>(item.transportations);
    const accoms = parseArr<AccommodationEntry>(item.accommodations);
    const eventName = getEventName(item.event_id);
    const people = (item.people_involved as string[]) || [];

    // If a specific person is provided, filter to their entries; otherwise use first
    const targetPerson = personName || people[0] || "";
    const transport = transports.find(t => t.person === targetPerson) || transports[0];
    const accom = accoms.find(a => a.person === targetPerson) || accoms[0];

    const url = buildClickUpUrl({
      personName: targetPerson,
      travelType: transport?.type,
      departureDate: transport?.departure_time?.split("T")[0],
      arrivalDate: transport?.arrival_time?.split("T")[0],
      departureCity: transport?.departure_city,
      arrivalCity: transport?.arrival_city,
      arrivalFlightNumber: transport?.flight_number,
      departureFlightNumber: transport?.is_round_trip ? transport?.return_flight_number : undefined,
      accommodationType: accom?.room_type,
      housingArrivalDate: accom?.check_in,
      housingDepartureDate: accom?.check_out,
      numberOfPassengers: String(people.length),
      allPassengerNames: people.join(", "),
      eventName,
      comments: item.comments || undefined,
    });

    window.open(url, "_blank");
  };

  // VIEW helpers
  const vTransports = viewing ? parseArr<TransportEntry>(viewing.transportations) : [];
  const vAccommodations = viewing ? parseArr<AccommodationEntry>(viewing.accommodations) : [];
  const vCaterings = viewing ? parseArr<CateringEntry>(viewing.caterings) : [];

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logistics</h1>
          <p className="text-sm text-muted-foreground">Per-person travel, accommodation & catering</p>
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
                <TableHead>People</TableHead>
                <TableHead>Transports</TableHead>
                <TableHead>Accommodations</TableHead>
                <TableHead>Caterings</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : logistics.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No logistics records yet</TableCell></TableRow>
              ) : logistics.map(item => {
                const c = countItems(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{getEventName(item.event_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{(item.people_involved as string[] || []).length} people</Badge>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.t}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.a}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.c}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(item)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(item)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => transferToClickUp(item)}><Plane className="mr-2 h-3 w-3" /> Transfer to ClickUp</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Logistics" : "New Logistics Plan"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">

            {/* General Info */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">📋 General Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target Event *</Label>
                  <Popover open={eventOpen} onOpenChange={setEventOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {form.event_name || "Select event..."}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
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
                                set("event_id", ev.id); set("event_name", ev.name); setEventOpen(false);
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
                  <Label>People Involved (People Pool)</Label>
                  <div className="flex gap-2">
                    <Input value={personInput} onChange={e => setPersonInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPerson(); } }}
                      placeholder="Type a name and press Enter" className="flex-1" />
                    <Button variant="outline" size="sm" onClick={addPerson} type="button">Add</Button>
                  </div>
                  {form.people_involved.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {form.people_involved.map((p, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          {p}
                          <button onClick={() => set("people_involved", form.people_involved.filter((_, idx) => idx !== i))} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>General Comments</Label>
                  <Input value={form.comments} onChange={e => set("comments", e.target.value)} placeholder="Overall notes..." />
                </div>
              </CardContent>
            </Card>

            {/* Transportations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">✈️ Transportation</h3>
                <Button variant="outline" size="sm" onClick={() => set("transportations", [...form.transportations, emptyTransport()])}>
                  <Plus className="mr-1 h-3 w-3" /> Add Transportation
                </Button>
              </div>
              {form.transportations.map((t, i) => (
                <Card key={i} className="border-primary/20">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Transport #{i + 1}{t.person && ` — ${t.person}`}</CardTitle>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set("transportations", form.transportations.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Person</Label>
                        <PersonSelect value={t.person} people={form.people_involved} onChange={v => updateTransport(i, { person: v })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select value={t.type} onValueChange={v => updateTransport(i, { type: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{TRANSPORT_TYPES.map(tt => <SelectItem key={tt} value={tt}>{tt}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">Outbound</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Departure City</Label><Input className="h-9" value={t.departure_city} onChange={e => updateTransport(i, { departure_city: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Arrival City</Label><Input className="h-9" value={t.arrival_city} onChange={e => updateTransport(i, { arrival_city: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Flight/Train #</Label><Input className="h-9" value={t.flight_number} onChange={e => updateTransport(i, { flight_number: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Departure Date/Time</Label><Input type="datetime-local" className="h-9" value={t.departure_time} onChange={e => updateTransport(i, { departure_time: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Arrival Date/Time</Label><Input type="datetime-local" className="h-9" value={t.arrival_time} onChange={e => updateTransport(i, { arrival_time: e.target.value })} /></div>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">Ground Transport</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Pickup Location</Label><Input className="h-9" value={t.pickup_location} onChange={e => updateTransport(i, { pickup_location: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Drop-off Location</Label><Input className="h-9" value={t.dropoff_location} onChange={e => updateTransport(i, { dropoff_location: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Pickup Time</Label><Input type="datetime-local" className="h-9" value={t.pickup_time} onChange={e => updateTransport(i, { pickup_time: e.target.value })} /></div>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                      <Switch checked={t.is_round_trip} onCheckedChange={v => updateTransport(i, { is_round_trip: v })} />
                      <Label className="text-xs">Round Trip</Label>
                    </div>
                    {t.is_round_trip && (
                      <div className="space-y-3 pl-3 border-l-2 border-primary/20">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Return Journey</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Return Departure</Label><Input className="h-9" value={t.return_departure_city} onChange={e => updateTransport(i, { return_departure_city: e.target.value })} /></div>
                          <div className="space-y-1"><Label className="text-xs">Return Arrival</Label><Input className="h-9" value={t.return_arrival_city} onChange={e => updateTransport(i, { return_arrival_city: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Return Flight #</Label><Input className="h-9" value={t.return_flight_number} onChange={e => updateTransport(i, { return_flight_number: e.target.value })} /></div>
                          <div className="space-y-1"><Label className="text-xs">Return Date/Time</Label><Input type="datetime-local" className="h-9" value={t.return_time} onChange={e => updateTransport(i, { return_time: e.target.value })} /></div>
                        </div>
                      </div>
                    )}
                    <NestedLinks links={t.links || []} onChange={links => updateTransport(i, { links })} />
                  </CardContent>
                </Card>
              ))}
              {form.transportations.length === 0 && <p className="text-xs text-muted-foreground italic">No transportation entries yet.</p>}
            </div>

            {/* Accommodations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">🏨 Accommodation</h3>
                <Button variant="outline" size="sm" onClick={() => set("accommodations", [...form.accommodations, emptyAccommodation()])}>
                  <Plus className="mr-1 h-3 w-3" /> Add Accommodation
                </Button>
              </div>
              {form.accommodations.map((a, i) => (
                <Card key={i} className="border-primary/20">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Accommodation #{i + 1}{a.person && ` — ${a.person}`}</CardTitle>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set("accommodations", form.accommodations.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Person</Label><PersonSelect value={a.person} people={form.people_involved} onChange={v => updateAccommodation(i, { person: v })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Hotel Name</Label><Input className="h-9" value={a.hotel_name} onChange={e => updateAccommodation(i, { hotel_name: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Room Type</Label><Input className="h-9" value={a.room_type} onChange={e => updateAccommodation(i, { room_type: e.target.value })} placeholder="Single, Double..." /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Check-In</Label><Input type="date" className="h-9" value={a.check_in} onChange={e => updateAccommodation(i, { check_in: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Check-Out</Label><Input type="date" className="h-9" value={a.check_out} onChange={e => updateAccommodation(i, { check_out: e.target.value })} /></div>
                    </div>
                    <NestedLinks links={a.links || []} onChange={links => updateAccommodation(i, { links })} />
                  </CardContent>
                </Card>
              ))}
              {form.accommodations.length === 0 && <p className="text-xs text-muted-foreground italic">No accommodation entries yet.</p>}
            </div>

            {/* Caterings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">🍽️ Catering</h3>
                <Button variant="outline" size="sm" onClick={() => set("caterings", [...form.caterings, emptyCatering()])}>
                  <Plus className="mr-1 h-3 w-3" /> Add Catering
                </Button>
              </div>
              {form.caterings.map((c, i) => (
                <Card key={i} className="border-primary/20">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Catering #{i + 1}{c.person && ` — ${c.person}`}</CardTitle>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set("caterings", form.caterings.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Person</Label><PersonSelect value={c.person} people={form.people_involved} onChange={v => updateCatering(i, { person: v })} /></div>
                      <div className="space-y-1">
                        <Label className="text-xs">Catering Option</Label>
                        <Select value={c.option} onValueChange={v => updateCatering(i, { option: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATERING_OPTIONS.map(co => <SelectItem key={co} value={co}>{co}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">Dietary / Comments</Label><Input className="h-9" value={c.comments} onChange={e => updateCatering(i, { comments: e.target.value })} /></div>
                    </div>
                    <NestedLinks links={c.links || []} onChange={links => updateCatering(i, { links })} />
                  </CardContent>
                </Card>
              ))}
              {form.caterings.length === 0 && <p className="text-xs text-muted-foreground italic">No catering entries yet.</p>}
            </div>

          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.event_id}>
              {editing ? "Save Changes" : "Create Logistics"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logistics — {getEventName(viewing?.event_id)}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-5 py-2">
              {/* Transfer to ClickUp */}
              <div className="flex items-center gap-3">
                {(viewing.people_involved as string[] || []).length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="default" size="sm">
                        <Plane className="mr-2 h-4 w-4" /> ✈️ Transfer to ClickUp
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {(viewing.people_involved as string[]).map((p: string, i: number) => (
                        <DropdownMenuItem key={i} onClick={() => transferToClickUp(viewing, p)}>
                          {p}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button variant="default" size="sm" onClick={() => transferToClickUp(viewing)}>
                    <Plane className="mr-2 h-4 w-4" /> ✈️ Transfer to ClickUp
                  </Button>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted">ℹ️ Note</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[200px]">PEC and Passport files must be uploaded manually on the ClickUp form.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {/* People */}
              {(viewing.people_involved as string[] || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">📋 People Involved</h4>
                  <div className="flex flex-wrap gap-1">{(viewing.people_involved as string[]).map((p: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>)}</div>
                </div>
              )}
              {viewing.comments && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Comments</span>
                  <span className="text-sm col-span-2">{viewing.comments}</span>
                </div>
              )}

              {/* Transports */}
              {vTransports.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">✈️ Transportation</h4>
                  {vTransports.map((t, i) => (
                    <Card key={i} className="border-muted">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{t.type}</Badge>
                          {t.person && <span className="text-sm font-medium">{t.person}</span>}
                        </div>
                        {(t.departure_city || t.arrival_city) && (
                          <p className="text-sm">{t.departure_city} → {t.arrival_city}</p>
                        )}
                        {t.flight_number && <p className="text-xs text-muted-foreground">Flight/Train: {t.flight_number}</p>}
                        {t.departure_time && <p className="text-xs text-muted-foreground">Departs: {t.departure_time}</p>}
                        {t.arrival_time && <p className="text-xs text-muted-foreground">Arrives: {t.arrival_time}</p>}
                        {(t.pickup_location || t.dropoff_location) && (
                          <div className="pl-3 border-l-2 border-muted-foreground/20 space-y-0.5">
                            <p className="text-xs font-semibold text-muted-foreground">Ground Transport</p>
                            {t.pickup_location && <p className="text-xs">Pickup: {t.pickup_location} {t.pickup_time && `@ ${t.pickup_time}`}</p>}
                            {t.dropoff_location && <p className="text-xs">Drop-off: {t.dropoff_location}</p>}
                          </div>
                        )}
                        {t.is_round_trip && (
                          <div className="pl-3 border-l-2 border-primary/20 space-y-0.5 mt-1">
                            <p className="text-xs font-semibold text-muted-foreground">Return</p>
                            <p className="text-sm">{t.return_departure_city} → {t.return_arrival_city}</p>
                            {t.return_flight_number && <p className="text-xs text-muted-foreground">{t.return_flight_number}</p>}
                            {t.return_time && <p className="text-xs text-muted-foreground">{t.return_time}</p>}
                          </div>
                        )}
                        {(t.links || []).length > 0 && (
                          <div className="space-y-0.5 pt-1">
                            {t.links.map((l, li) => (
                              <a key={li} href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" /> {l.title || l.url}
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Accommodations */}
              {vAccommodations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">🏨 Accommodation</h4>
                  {vAccommodations.map((a, i) => (
                    <Card key={i} className="border-muted">
                      <CardContent className="p-4 space-y-1">
                        {a.person && <span className="text-sm font-medium">{a.person}</span>}
                        <p className="text-sm">{a.hotel_name || "—"} {a.room_type && `(${a.room_type})`}</p>
                        <p className="text-xs text-muted-foreground">{a.check_in || "—"} → {a.check_out || "—"}</p>
                        {(a.links || []).length > 0 && (
                          <div className="space-y-0.5 pt-1">
                            {a.links.map((l, li) => (
                              <a key={li} href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" /> {l.title || l.url}
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Caterings */}
              {vCaterings.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">🍽️ Catering</h4>
                  {vCaterings.map((c, i) => (
                    <Card key={i} className="border-muted">
                      <CardContent className="p-4 space-y-1">
                        {c.person && <span className="text-sm font-medium">{c.person}</span>}
                        <p className="text-sm">{c.option || "—"}</p>
                        {c.comments && <p className="text-xs text-muted-foreground">{c.comments}</p>}
                        {(c.links || []).length > 0 && (
                          <div className="space-y-0.5 pt-1">
                            {c.links.map((l, li) => (
                              <a key={li} href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" /> {l.title || l.url}
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
