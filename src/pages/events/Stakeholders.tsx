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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Eye, Pencil, Trash2, MoreHorizontal, Search, ExternalLink, ChevronsUpDown, X, Users2 } from "lucide-react";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { TagPicker } from "@/components/TagPicker";
import { TagBadges } from "@/components/TagBadges";
import { cn } from "@/lib/utils";
import { formatUrl } from "@/lib/formatUrl";
import type { Tables } from "@/integrations/supabase/types";

type Stakeholder = Tables<"stakeholders">;

const TYPES = ["Mentor", "Investor", "Corporate Partner", "Guest Speaker", "Government", "Other"];
const SECTORS = ["Technology", "Finance", "Healthcare", "Education", "Energy", "Agriculture", "Real Estate", "Consulting", "Other"];

interface LinkItem { title: string; url: string; }

interface StakeholderForm {
  full_name: string;
  title: string;
  sector: string;
  type: string;
  point_of_contact: string;
  nationalities: string[];
  phone: string;
  email: string;
  status: string;
  description: string;
  links: LinkItem[];
  institution_name: string;
  based_in_country: string;
}

const emptyForm: StakeholderForm = {
  full_name: "", title: "", sector: "", type: "", point_of_contact: "",
  nationalities: [], phone: "", email: "", status: "", description: "", links: [],
  institution_name: "", based_in_country: "",
};

/* ── Country Multi-Select (same as Founders) ── */
function CountryMultiSelect({ value, onChange, placeholder = "Select countries..." }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("countries").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const toggle = (country: string) => onChange(value.includes(country) ? value.filter(c => c !== country) : [...value, country]);
  const remove = (country: string) => onChange(value.filter(c => c !== country));
  const getEmoji = (name: string) => countries.find(c => c.name === name)?.emoji || "🏳️";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-auto min-h-10 font-normal">
          {value.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {value.map(c => (
                <Badge key={c} variant="secondary" className="text-xs gap-1">
                  {getEmoji(c)} {c}
                  <span role="button" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }} onClick={e => { e.preventDefault(); e.stopPropagation(); remove(c); }} className="cursor-pointer">
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map(c => (
                <CommandItem key={c.id} onSelect={() => toggle(c.name)} className="flex items-center gap-2">
                  <Checkbox checked={value.includes(c.name)} className="pointer-events-none" />
                  <span>{c.emoji} {c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function StakeholdersDirectory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Stakeholder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Stakeholder | null>(null);
  const [form, setForm] = useState<StakeholderForm>(emptyForm);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPOC, setFilterPOC] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCountries, setFilterCountries] = useState<string[]>([]);

  const { data: stakeholders = [], isLoading } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stakeholders").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("countries").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const getFlag = (name: string | null | undefined) => {
    if (!name) return "";
    return countries.find(c => c.name === name)?.emoji || "🏳️";
  };

  function getNationalities(s: Stakeholder): string[] {
    return (s.nationalities as string[] | null) || [];
  }
  function getLinks(s: Stakeholder): LinkItem[] {
    const raw = s.links as unknown;
    if (Array.isArray(raw) && raw.length > 0) return raw as LinkItem[];
    return [];
  }

  // Unique filter values
  const uniqueSectors = useMemo(() => [...new Set(stakeholders.map(s => s.sector).filter(Boolean))].sort(), [stakeholders]);
  const uniqueTypes = useMemo(() => [...new Set(stakeholders.map(s => s.type).filter(Boolean))].sort(), [stakeholders]);
  const uniquePOCs = useMemo(() => [...new Set(stakeholders.map(s => s.point_of_contact).filter(Boolean))].sort(), [stakeholders]);
  const uniqueStatuses = useMemo(() => [...new Set(stakeholders.map(s => s.status).filter(Boolean))].sort(), [stakeholders]);

  const filtered = useMemo(() => {
    return stakeholders.filter(s => {
      const q = search.toLowerCase();
      if (q && !s.full_name.toLowerCase().includes(q) && !(s.title || "").toLowerCase().includes(q)) return false;
      if (filterSector !== "all" && s.sector !== filterSector) return false;
      if (filterType !== "all" && s.type !== filterType) return false;
      if (filterPOC !== "all" && s.point_of_contact !== filterPOC) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (filterCountries.length > 0) {
        const nats = getNationalities(s);
        if (!filterCountries.some(c => nats.includes(c))) return false;
      }
      return true;
    });
  }, [stakeholders, search, filterSector, filterType, filterPOC, filterStatus, filterCountries]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name,
        title: form.title || null,
        sector: form.sector || null,
        type: form.type || null,
        point_of_contact: form.point_of_contact || null,
        nationalities: form.nationalities,
        phone: form.phone || null,
        email: form.email || null,
        status: form.status || null,
        description: form.description || null,
        links: form.links.filter(l => l.url) as any,
        institution_name: form.institution_name || null,
        based_in_country: form.based_in_country || null,
      };
      if (editing) {
        const { error } = await supabase.from("stakeholders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stakeholders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      logAction("Events-Stakeholders", editing ? "UPDATE" : "INSERT", editing?.id || "new", editing ? (editing as any) : null, { full_name: form.full_name, type: form.type }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Stakeholder updated" : "Stakeholder added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stakeholders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      setDeleteId(null);
      toast.success("Stakeholder deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(s: Stakeholder) {
    setForm({
      full_name: s.full_name,
      title: s.title || "",
      sector: s.sector || "",
      type: s.type || "",
      point_of_contact: s.point_of_contact || "",
      nationalities: getNationalities(s),
      phone: s.phone || "",
      email: s.email || "",
      status: s.status || "",
      description: s.description || "",
      links: getLinks(s),
      institution_name: s.institution_name || "",
      based_in_country: s.based_in_country || "",
    });
    setEditing(s);
    setDialogOpen(true);
  }

  const set = (key: keyof StakeholderForm, val: any) => setForm(f => ({ ...f, [key]: val }));
  const addLink = () => set("links", [...form.links, { title: "", url: "" }]);
  const removeLink = (idx: number) => set("links", form.links.filter((_, i) => i !== idx));
  const updateLink = (idx: number, field: "title" | "url", val: string) => {
    const updated = [...form.links];
    updated[idx] = { ...updated[idx], [field]: val };
    set("links", updated);
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stakeholders Directory</h1>
          <p className="text-sm text-muted-foreground">Manage mentors, investors, partners & speakers</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Stakeholder
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or title..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger><SelectValue placeholder="All Sectors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {uniqueSectors.map(s => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(t => <SelectItem key={t} value={t!}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPOC} onValueChange={setFilterPOC}>
              <SelectTrigger><SelectValue placeholder="All Contacts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Point of Contacts</SelectItem>
                {uniquePOCs.map(p => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map(s => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <CountryMultiSelect value={filterCountries} onChange={setFilterCountries} placeholder="Filter countries..." />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{filtered.length} stakeholder{filtered.length !== 1 ? "s" : ""} found</p>

      {/* Grid */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading stakeholders...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No stakeholders match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => {
            const nats = getNationalities(s);
            return (
              <Card key={s.id} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border relative overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-11 w-11 rounded-full bg-module-events/10 flex items-center justify-center text-module-events font-bold text-base">
                      {(s.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewing(s)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-bold text-sm mb-0.5 truncate">{s.full_name}</h3>
                  {s.title && <p className="text-xs text-muted-foreground mb-0.5 truncate">{s.title}</p>}
                  {nats.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mb-2 truncate">
                      {nats.map(n => `${getFlag(n)} ${n}`).join(", ")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {s.type && <Badge variant="outline" className="text-[10px] font-medium">{s.type}</Badge>}
                    {s.sector && <Badge variant="secondary" className="text-[10px]">{s.sector}</Badge>}
                    {s.status && (
                      <Badge className="text-[10px] bg-module-events/10 text-module-events border-module-events/20 hover:bg-module-events/20">{s.status}</Badge>
                    )}
                  </div>
                  {s.point_of_contact && (
                    <p className="text-[11px] text-muted-foreground truncate">POC: {s.point_of_contact}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Stakeholder" : "New Stakeholder"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => set("full_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Title / Role</Label>
                <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. CEO, Professor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sector</Label>
                <Select value={form.sector} onValueChange={v => set("sector", v)}>
                  <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => set("type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Institution Name</Label>
                <Input value={form.institution_name} onChange={e => set("institution_name", e.target.value)} placeholder="e.g. MIT, Stanford" />
              </div>
              <div className="space-y-2">
                <Label>Based In Country</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {form.based_in_country ? (
                        <span>{getFlag(form.based_in_country)} {form.based_in_country}</span>
                      ) : (
                        <span className="text-muted-foreground">Select country...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 z-50" align="start">
                    <Command>
                      <CommandInput placeholder="Search country..." />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {countries.map(c => (
                            <CommandItem key={c.id} onSelect={() => set("based_in_country", c.name)}>
                              {c.emoji} {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Point of Contact</Label>
                <Input value={form.point_of_contact} onChange={e => set("point_of_contact", e.target.value)} placeholder="UM6P team member" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input value={form.status} onChange={e => set("status", e.target.value)} placeholder="e.g. Active, Inactive" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nationalities</Label>
              <CountryMultiSelect value={form.nationalities} onChange={v => set("nationalities", v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+212..." />
              </div>
            </div>

            {/* Dynamic Links */}
            <div className="space-y-2">
              <Label>Links</Label>
              {form.links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input value={link.title} onChange={e => updateLink(idx, "title", e.target.value)} placeholder="Link Title" className="flex-1" />
                  <Input value={link.url} onChange={e => updateLink(idx, "url", e.target.value)} placeholder="https://..." className="flex-1" />
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeLink(idx)} className="shrink-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLink}>
                <Plus className="mr-1 h-3 w-3" /> Add Link
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Brief description..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing && (
              <Button variant="destructive" size="sm" onClick={() => { setDialogOpen(false); setDeleteId(editing.id); }}>Delete</Button>
            )}
            <Button onClick={() => saveMutation.mutate()} disabled={!form.full_name}>
              {editing ? "Save Changes" : "Add Stakeholder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Stakeholder Details"
        fields={viewing ? [
          { label: "Full Name", value: viewing.full_name },
          { label: "Title", value: viewing.title },
          { label: "Institution", value: viewing.institution_name },
          { label: "Based In", value: viewing.based_in_country ? `${getFlag(viewing.based_in_country)} ${viewing.based_in_country}` : null },
          { label: "Sector", value: viewing.sector },
          { label: "Type", value: viewing.type },
          { label: "Point of Contact", value: viewing.point_of_contact },
          { label: "Nationalities", value: (() => {
            const nats = getNationalities(viewing);
            return nats.length > 0 ? nats.map(n => `${getFlag(n)} ${n}`).join(", ") : null;
          })() },
          { label: "Email", value: viewing.email },
          { label: "Phone", value: viewing.phone },
          { label: "Links", value: (() => {
            const links = getLinks(viewing);
            if (links.length === 0) return null;
            return (
              <div className="flex flex-col gap-1">
                {links.map((l, i) => (
                  <a key={i} href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                    {l.title || l.url} <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            );
          })() },
          { label: "Status", value: viewing.status },
          { label: "Description", value: viewing.description },
        ] : []}
      />
    </div>
  );
}
