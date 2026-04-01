import { useState, useMemo } from "react";
import { getUniqueFilterValues, matchesFilter, matchesMultiFilter } from "@/lib/normalizeFilter";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, GraduationCap, Eye, Pencil, Trash2, MoreHorizontal, Search, ExternalLink, ChevronsUpDown, X, CalendarIcon } from "lucide-react";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { TagPicker } from "@/components/TagPicker";
import { TagBadges } from "@/components/TagBadges";
import { FounderCard } from "@/components/FounderCard";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatUrl } from "@/lib/formatUrl";
import type { Tables } from "@/integrations/supabase/types";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ViewToggle } from "@/components/ViewToggle";

type Founder = Tables<"founders">;

const COHORT_YEARS = Array.from({ length: 81 }, (_, i) => String(2020 + i));

interface LinkItem {
  title: string;
  url: string;
}

interface FounderForm {
  founder_name: string;
  startup_name: string;
  cohort: string;
  venture_associate: string;
  nationalities: string[];
  phone: string;
  email: string;
  status: string;
  description: string;
  tag_ids: string[];
  links: LinkItem[];
  cin_number: string;
  passport_number: string;
  rib_number: string;
  birthday: Date | undefined;
  photo_url: string;
}

const emptyForm: FounderForm = {
  founder_name: "", startup_name: "", cohort: "", venture_associate: "",
  nationalities: [], phone: "", email: "", status: "", description: "", tag_ids: [],
  links: [],
  cin_number: "", passport_number: "", rib_number: "", birthday: undefined, photo_url: "",
};

/* ── Multi-select country combobox (fetches from Supabase) ── */
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

  const toggle = (country: string) => {
    onChange(value.includes(country) ? value.filter(c => c !== country) : [...value, country]);
  };

  const remove = (country: string) => {
    onChange(value.filter(c => c !== country));
  };

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
                  <span
                    role="button"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(c); }}
                    className="cursor-pointer"
                  >
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

export default function FoundersSource() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Founder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Founder | null>(null);
  const [form, setForm] = useState<FounderForm>(emptyForm);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Filters
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState("all");
  const [filterCountries, setFilterCountries] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVA, setFilterVA] = useState("all");

  const { data: founders = [], isLoading } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
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

  const { data: tracking = [] } = useQuery({
    queryKey: ["founders_tracking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders_tracking").select("*").order("tracking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Build sparkline scores map (chronological order: oldest→newest)
  const sparklineMap = useMemo(() => {
    const scoreMap: Record<string, number[]> = {};
    const dateMap: Record<string, string[]> = {};
    const sorted = [...tracking].reverse();
    sorted.forEach((t) => {
      if (!t.founder_id || t.overall_score == null) return;
      if (!scoreMap[t.founder_id]) { scoreMap[t.founder_id] = []; dateMap[t.founder_id] = []; }
      scoreMap[t.founder_id].push(t.overall_score);
      dateMap[t.founder_id].push(t.tracking_date || "");
    });
    return { scores: scoreMap, dates: dateMap };
  }, [tracking]);

  // Derive unique values for filter dropdowns (case-insensitive dedup)
  const uniqueCohorts = useMemo(() => getUniqueFilterValues(founders.map(f => f.cohort)), [founders]);
  const uniqueCountries = useMemo(() => {
    const all = founders.flatMap(f => (f.nationalities as string[] | null) || (f.nationality ? [f.nationality] : []));
    return getUniqueFilterValues(all);
  }, [founders]);
  const uniqueStatuses = useMemo(() => getUniqueFilterValues(founders.map(f => f.status)), [founders]);
  const uniqueVAs = useMemo(() => getUniqueFilterValues(founders.map(f => f.venture_associate)), [founders]);

  function getFounderNationalities(f: Founder): string[] {
    const arr = (f.nationalities as string[] | null);
    if (arr && arr.length > 0) return arr;
    if (f.nationality) return [f.nationality];
    return [];
  }

  function getFounderLinks(f: Founder): LinkItem[] {
    const linksJson = f.links as unknown;
    if (Array.isArray(linksJson) && linksJson.length > 0) return linksJson as LinkItem[];
    if (f.link_title || f.link_url) return [{ title: f.link_title || "", url: f.link_url || "" }];
    return [];
  }


  const filtered = useMemo(() => {
    return founders.filter((f) => {
      const q = search.toLowerCase();
      if (q && !f.founder_name.toLowerCase().includes(q) && !f.startup_name.toLowerCase().includes(q)) return false;
      if (!matchesFilter(f.cohort, filterCohort)) return false;
      if (!matchesMultiFilter(getFounderNationalities(f), filterCountries)) return false;
      if (!matchesFilter(f.status, filterStatus)) return false;
      if (!matchesFilter(f.venture_associate, filterVA)) return false;
      return true;
    });
  }, [founders, search, filterCohort, filterCountries, filterStatus, filterVA]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        founder_name: form.founder_name,
        startup_name: form.startup_name,
        cohort: form.cohort || null,
        venture_associate: form.venture_associate || null,
        nationality: form.nationalities[0] || null,
        nationalities: form.nationalities,
        phone: form.phone || null,
        email: form.email || null,
        status: form.status || null,
        description: form.description || null,
        tag_ids: form.tag_ids,
        links: form.links.filter(l => l.url) as any,
        link_title: form.links[0]?.title || null,
        link_url: form.links[0]?.url || null,
        cin_number: form.cin_number || null,
        passport_number: form.passport_number || null,
        rib_number: form.rib_number || null,
        birthday: form.birthday ? format(form.birthday, "yyyy-MM-dd") : null,
        photo_url: form.photo_url || null,
      };
      if (editing) {
        const { error } = await supabase.from("founders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("founders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      logAction("Founders-Directory", editing ? "UPDATE" : "INSERT", editing?.id || "new", editing ? (editing as any) : null, { founder_name: form.founder_name, startup_name: form.startup_name }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Founder updated" : "Founder added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("founders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const deleted = founders.find(f => f.id === id);
      logAction("Founders-Directory", "DELETE", id, deleted as any, null, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      setDeleteId(null);
      toast.success("Founder deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(f: Founder) {
    const nats = getFounderNationalities(f);
    const links = getFounderLinks(f);
    setForm({
      founder_name: f.founder_name,
      startup_name: f.startup_name,
      cohort: f.cohort || "",
      venture_associate: f.venture_associate || "",
      nationalities: nats,
      phone: f.phone || "",
      email: f.email || "",
      status: f.status || "",
      description: f.description || "",
      tag_ids: (f.tag_ids as string[]) || [],
      links: links.length > 0 ? links : [],
      cin_number: f.cin_number || "",
      passport_number: f.passport_number || "",
      rib_number: f.rib_number || "",
      birthday: f.birthday ? new Date(f.birthday) : undefined,
      photo_url: f.photo_url || "",
    });
    setEditing(f);
    setDialogOpen(true);
  }

  function getLatestScore(founderId: string) {
    const latest = tracking.find((t) => t.founder_id === founderId);
    if (!latest) return 0;
    const scores = [
      latest.product_dev_rating, latest.clients_traction_rating,
      latest.team_structure_rating, latest.market_presence_rating, latest.funding_update_rating,
    ].filter((s): s is number => s !== null);
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20);
  }

  const set = (key: keyof FounderForm, val: any) => setForm((f) => ({ ...f, [key]: val }));

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
          <h1 className="text-3xl font-bold">Founders Directory</h1>
          <p className="text-sm text-muted-foreground">Manage founders and track their progress</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <Button onClick={() => { setForm(emptyForm); setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Founder
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or startup..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterCohort} onValueChange={setFilterCohort}>
              <SelectTrigger><SelectValue placeholder="All Cohorts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {uniqueCohorts.map((c) => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <CountryMultiSelect value={filterCountries} onChange={setFilterCountries} placeholder="Filter countries..." />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map((s) => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterVA} onValueChange={setFilterVA}>
              <SelectTrigger><SelectValue placeholder="All VAs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venture Associates</SelectItem>
                {uniqueVAs.map((va) => <SelectItem key={va} value={va!}>{va}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{filtered.length} founder{filtered.length !== 1 ? "s" : ""} found</p>

      {/* Grid / Table View */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading founders...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No founders match your filters.</p>
        </div>
      ) : viewMode === "table" ? (
        <DataTable
          data={filtered}
          columns={[
            { key: "founder_name", label: "Name" },
            { key: "startup_name", label: "Startup" },
            { key: "cohort", label: "Cohort" },
            { key: "status", label: "Status", render: (f: Founder) => f.status ? <Badge className="text-[10px] bg-module-founders/10 text-module-founders border-module-founders/20">{f.status}</Badge> : "—" },
            { key: "venture_associate", label: "Venture Associate" },
          ] as DataTableColumn<Founder>[]}
          searchable={false}
          actionColumn={(f: Founder) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewing(f)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(f)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(f.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((f) => {
            const nats = getFounderNationalities(f);
            return (
              <FounderCard
                key={f.id}
                founder={f}
                nationalities={nats}
                getFlag={getFlag}
                onView={setViewing}
                onEdit={openEdit}
                onDelete={(id) => setDeleteId(id)}
                highlightId={highlightId}
              />
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Founder" : "New Founder"}</DialogTitle>
            <DialogDescription className="sr-only">Fill in the details to {editing ? "update" : "add"} a founder profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="founder-name">Full Name *</Label>
                <Input id="founder-name" name="founder_name" value={form.founder_name} onChange={(e) => set("founder_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startup-name">Startup Name *</Label>
                <Input id="startup-name" name="startup_name" value={form.startup_name} onChange={(e) => set("startup_name", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cohort Year</Label>
                <Select value={form.cohort} onValueChange={(v) => set("cohort", v)}>
                  <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>
                    {COHORT_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="venture-associate">Venture Associate</Label>
                <Input id="venture-associate" name="venture_associate" value={form.venture_associate} onChange={(e) => set("venture_associate", e.target.value)} placeholder="Assigned VA" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nationalities</Label>
              <CountryMultiSelect value={form.nationalities} onChange={(v) => set("nationalities", v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="founder-status">Status</Label>
                <Input id="founder-status" name="status" value={form.status} onChange={(e) => set("status", e.target.value)} placeholder="e.g. Active, Dismissed" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="founder-email">Email</Label>
                <Input id="founder-email" name="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="founder-phone">Phone</Label>
                <Input id="founder-phone" name="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+212..." />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <TagPicker value={form.tag_ids} onChange={(ids) => set("tag_ids", ids)} />
              </div>
            </div>

            {/* Identity Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cin-number">CIN Number</Label>
                <Input id="cin-number" name="cin_number" value={form.cin_number} onChange={(e) => set("cin_number", e.target.value)} placeholder="e.g. AB123456" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passport-number">Passport Number</Label>
                <Input id="passport-number" name="passport_number" value={form.passport_number} onChange={(e) => set("passport_number", e.target.value)} placeholder="e.g. AB1234567" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rib-number">RIB Number</Label>
                <Input id="rib-number" name="rib_number" value={form.rib_number} onChange={(e) => set("rib_number", e.target.value)} placeholder="24-digit Moroccan bank RIB" maxLength={24} />
              </div>
              <div className="space-y-2">
                <Label>Birthday</Label>
                <Input
                  type="date"
                  value={form.birthday ? format(form.birthday, "yyyy-MM-dd") : ""}
                  onChange={(e) => set("birthday", e.target.value ? new Date(e.target.value) : undefined)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Dynamic Links */}
            <div className="space-y-2">
              <Label>Links</Label>
              {form.links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input value={link.title} onChange={(e) => updateLink(idx, "title", e.target.value)} placeholder="Link Title" className="flex-1" />
                  <Input value={link.url} onChange={(e) => updateLink(idx, "url", e.target.value)} placeholder="https://..." className="flex-1" />
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
              <Label htmlFor="founder-description">Description / Business Idea</Label>
              <Textarea id="founder-description" name="description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Brief description of the startup..." />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing && (
              <Button variant="destructive" size="sm" onClick={() => { setDialogOpen(false); setDeleteId(editing.id); }}>Delete</Button>
            )}
            <Button onClick={() => saveMutation.mutate()} disabled={!form.founder_name || !form.startup_name}>
              {editing ? "Save Changes" : "Add Founder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Founder Details"
        fields={viewing ? [
          { label: "Name", value: viewing.founder_name },
          { label: "Startup", value: viewing.startup_name },
          { label: "Cohort", value: viewing.cohort },
          { label: "Nationalities", value: (() => {
            const nats = getFounderNationalities(viewing);
            return nats.length > 0 ? nats.map(n => `${getFlag(n)} ${n}`).join(", ") : null;
          })() },
          { label: "Status", value: viewing.status },
          { label: "Venture Associate", value: viewing.venture_associate },
          { label: "Email", value: viewing.email },
          { label: "Phone", value: viewing.phone },
          { label: "CIN Number", value: viewing.cin_number },
          { label: "Passport", value: viewing.passport_number },
          { label: "RIB Number", value: viewing.rib_number },
          { label: "Birthday", value: viewing.birthday ? format(new Date(viewing.birthday), "PPP") : null },
          { label: "Links", value: (() => {
            const links = getFounderLinks(viewing);
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
          { label: "Description", value: viewing.description },
          { label: "Tags", value: <TagBadges tagIds={viewing.tag_ids as string[] | null} /> },
          
        ] : []}
      />
    </div>
  );
}
