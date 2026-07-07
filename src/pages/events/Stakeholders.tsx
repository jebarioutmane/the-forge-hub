import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Users2,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Search,
  ExternalLink,
  ChevronsUpDown,
  X,
  Mail,
  Phone,
  Globe,
  Building2,
  Briefcase,
  MapPin,
  UserCircle2,
  Link2,
  ArchiveRestore,
  Filter,
  Calendar,
  History,
  CheckCircle2,
  Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { format } from "date-fns";
import { formatUrl } from "@/lib/formatUrl";
import type { Tables } from "@/integrations/supabase/types";

type Stakeholder = Tables<"stakeholders">;

const TYPES = ["Mentor", "Investor", "Corporate Partner", "Guest Speaker", "Government", "Other"];
const SECTORS = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "Energy",
  "Agriculture",
  "Real Estate",
  "Consulting",
  "Other",
];

interface LinkItem {
  title: string;
  url: string;
}

interface InvolvementEntry {
  event: string | null;
  date: string | null;
  role: string | null;
  status: string | null;
}

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
  full_name: "",
  title: "",
  sector: "",
  type: "",
  point_of_contact: "",
  nationalities: [],
  phone: "",
  email: "",
  status: "",
  description: "",
  links: [],
  institution_name: "",
  based_in_country: "",
};

const NONE = "__none__";

/* ─────────── Multi-select combobox ─────────── */
function MultiSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-auto min-h-9 font-normal"
        >
          {value.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {value.map((v) => (
                <Badge key={v} variant="secondary" className="text-xs gap-1">
                  {labelFor(v)}
                  <span
                    role="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(v);
                    }}
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
      <PopoverContent className="w-[320px] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList className="max-h-[280px] overflow-y-auto">
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  onSelect={() => toggle(o.value)}
                  className="flex items-center gap-2"
                >
                  <Checkbox checked={value.includes(o.value)} className="pointer-events-none" />
                  <span className="flex-1">{o.label}</span>
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
  const queryClient = useQueryClient();
  const { canEdit, canDelete, canSeeSensitive } = usePermissions();
  const mayEdit = canEdit("stakeholders");
  const mayDelete = canDelete("stakeholders");
  const maySeeSensitive = canSeeSensitive("stakeholders");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Stakeholder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Stakeholder | null>(null);
  const [form, setForm] = useState<StakeholderForm>(emptyForm);

  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterSectors, setFilterSectors] = useState<string[]>([]);
  const [filterCountries, setFilterCountries] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  const { data: stakeholders = [], isLoading } = useQuery({
    queryKey: ["stakeholders", "directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stakeholders")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Stakeholder[];
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

  const { data: involvement } = useQuery({
    queryKey: ["stakeholder_involvement", viewing?.id],
    enabled: !!viewing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stakeholder_involvement")
        .select("*")
        .eq("stakeholder_id", viewing!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const countryEmoji = (name: string | null | undefined) =>
    (name && countries.find((c) => c.name === name)?.emoji) || "🏳️";

  function getNationalities(s: Stakeholder): string[] {
    return (s.nationalities as string[] | null) || [];
  }
  function getLinks(s: Stakeholder): LinkItem[] {
    const raw = s.links as unknown;
    if (Array.isArray(raw) && raw.length > 0) return raw as LinkItem[];
    return [];
  }

  /* ─────────── Filter options ─────────── */
  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    stakeholders.forEach((x) => x.type && s.add(x.type));
    TYPES.forEach((t) => s.add(t));
    return [...s].sort();
  }, [stakeholders]);

  const uniqueSectors = useMemo(() => {
    const s = new Set<string>();
    stakeholders.forEach((x) => x.sector && s.add(x.sector));
    SECTORS.forEach((t) => s.add(t));
    return [...s].sort();
  }, [stakeholders]);

  const uniqueCountries = useMemo(() => {
    const s = new Set<string>();
    stakeholders.forEach((x) => {
      if (x.based_in_country) s.add(x.based_in_country);
      getNationalities(x).forEach((n) => n && s.add(n));
    });
    return [...s].sort();
  }, [stakeholders]);

  const uniqueStatuses = useMemo(() => {
    const s = new Set<string>();
    stakeholders.forEach((x) => x.status && s.add(x.status));
    return [...s].sort();
  }, [stakeholders]);

  /* ─────────── Filtering ─────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stakeholders.filter((s) => {
      if (showArchived ? !s.is_archived : s.is_archived) return false;
      if (q) {
        const hay = [s.full_name, s.institution_name, s.email, s.title]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterTypes.length > 0 && !filterTypes.includes(s.type || "")) return false;
      if (filterSectors.length > 0 && !filterSectors.includes(s.sector || "")) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(s.status || "")) return false;
      if (filterCountries.length > 0) {
        const pool = [s.based_in_country, ...getNationalities(s)].filter(Boolean) as string[];
        if (!pool.some((c) => filterCountries.includes(c))) return false;
      }
      return true;
    });
  }, [stakeholders, search, showArchived, filterTypes, filterSectors, filterStatuses, filterCountries]);

  const activeFilterCount =
    (search ? 1 : 0) +
    filterTypes.length +
    filterSectors.length +
    filterStatuses.length +
    filterCountries.length;

  const clearAllFilters = () => {
    setSearch("");
    setFilterTypes([]);
    setFilterSectors([]);
    setFilterStatuses([]);
    setFilterCountries([]);
  };

  /* ─────────── Mutations ─────────── */
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
        links: form.links.filter((l) => l.url) as any,
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
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Stakeholder updated" : "Stakeholder added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("stakeholders")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      setDeleteId(null);
      setViewing(null);
      toast.success("Stakeholder archived");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("stakeholders")
        .update({ is_archived: false, archived_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      toast.success("Stakeholder restored");
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

  const set = (key: keyof StakeholderForm, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const addLink = () => set("links", [...form.links, { title: "", url: "" }]);
  const removeLink = (idx: number) => set("links", form.links.filter((_, i) => i !== idx));
  const updateLink = (idx: number, field: "title" | "url", val: string) => {
    const updated = [...form.links];
    updated[idx] = { ...updated[idx], [field]: val };
    set("links", updated);
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const involvementLog: InvolvementEntry[] = useMemo(() => {
    const raw = involvement?.involvement_log as unknown;
    if (!Array.isArray(raw)) return [];
    return raw as InvolvementEntry[];
  }, [involvement]);

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Stakeholders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Network CRM — mentors, investors, partners & speakers.
          </p>
        </div>
        {mayEdit && (
          <Button
            onClick={() => {
              setForm(emptyForm);
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add stakeholder
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, institution, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <MultiSelect
              value={filterTypes}
              onChange={setFilterTypes}
              placeholder="Type"
              options={uniqueTypes.map((t) => ({ value: t, label: t }))}
            />
            <MultiSelect
              value={filterSectors}
              onChange={setFilterSectors}
              placeholder="Sector"
              options={uniqueSectors.map((t) => ({ value: t, label: t }))}
            />
            <MultiSelect
              value={filterCountries}
              onChange={setFilterCountries}
              placeholder="Country"
              options={uniqueCountries.map((c) => ({
                value: c,
                label: `${countryEmoji(c)} ${c}`,
              }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <MultiSelect
                value={filterStatuses}
                onChange={setFilterStatuses}
                placeholder="Status"
                options={uniqueStatuses.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <Switch id="archived-toggle" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="archived-toggle" className="text-sm cursor-pointer">
                Archived
              </Label>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="mr-1 h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {search && (
                <Badge variant="secondary" className="gap-1">
                  <Search className="h-3 w-3" />"{search}"
                  <button onClick={() => setSearch("")}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filterTypes.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  <Briefcase className="h-3 w-3" /> {t}
                  <button onClick={() => setFilterTypes(filterTypes.filter((x) => x !== t))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filterSectors.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1">
                  {s}
                  <button onClick={() => setFilterSectors(filterSectors.filter((x) => x !== s))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filterCountries.map((c) => (
                <Badge key={c} variant="secondary" className="gap-1">
                  {countryEmoji(c)} {c}
                  <button onClick={() => setFilterCountries(filterCountries.filter((x) => x !== c))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filterStatuses.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1">
                  {s}
                  <button onClick={() => setFilterStatuses(filterStatuses.filter((x) => x !== s))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filtered.length} stakeholder{filtered.length !== 1 ? "s" : ""}
          {showArchived ? " · archived" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <Filter className="h-3 w-3" />
          {activeFilterCount === 0 ? "No filters" : `${activeFilterCount} active`}
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-16">Loading stakeholders…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-card">
          <Users2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {showArchived ? "No archived stakeholders." : "No stakeholders match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">Type</th>
                <th className="text-left font-medium px-4 py-3">Institution</th>
                <th className="text-left font-medium px-4 py-3">Sector</th>
                <th className="text-left font-medium px-4 py-3">Country</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-t transition-colors cursor-pointer hover:bg-muted/40"
                  onClick={() => setViewing(s)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-muted-foreground">
                          {initials(s.full_name)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.full_name}</div>
                        {s.title && (
                          <div className="text-xs text-muted-foreground truncate">{s.title}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.type ? (
                      <Badge variant="outline" className="text-[11px] font-medium">
                        {s.type}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.institution_name ? (
                      <div className="flex items-center gap-2 text-foreground">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{s.institution_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.sector || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.based_in_country ? (
                      <span>
                        {countryEmoji(s.based_in_country)} {s.based_in_country}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.status ? (
                      <Badge variant="secondary" className="text-[11px] font-medium">
                        {s.status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewing(s)}>
                          <Eye className="mr-2 h-3.5 w-3.5" /> View
                        </DropdownMenuItem>
                        {mayEdit && (
                          <DropdownMenuItem onClick={() => openEdit(s)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                        )}
                        {mayDelete && (s.is_archived ? (
                          <DropdownMenuItem onClick={() => restoreMutation.mutate(s.id)}>
                            <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Archive
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">Stakeholder details</SheetTitle>
            <SheetDescription className="sr-only">
              Full record and involvement history for the selected stakeholder.
            </SheetDescription>
          </SheetHeader>
          {viewing && (
            <div className="space-y-6 pt-2">
              {/* Identity */}
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-lg font-medium text-muted-foreground">
                    {initials(viewing.full_name)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold leading-tight">{viewing.full_name}</h2>
                  {viewing.title && (
                    <p className="text-sm text-muted-foreground mt-0.5">{viewing.title}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {viewing.type && (
                      <Badge variant="outline" className="text-[11px]">
                        {viewing.type}
                      </Badge>
                    )}
                    {viewing.status && (
                      <Badge variant="secondary" className="text-[11px]">
                        {viewing.status}
                      </Badge>
                    )}
                    {viewing.is_archived && (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        Archived
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => openEdit(viewing)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                {viewing.is_archived ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreMutation.mutate(viewing.id)}
                  >
                    <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Restore
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(viewing.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Archive
                  </Button>
                )}
              </div>

              {/* Involvement summary */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Involvement
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> Total
                    </div>
                    <div className="text-xl font-semibold mt-1">
                      {involvement?.total_events ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" /> Attended
                    </div>
                    <div className="text-xl font-semibold mt-1">
                      {involvement?.events_attended ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3" /> Last
                    </div>
                    <div className="text-sm font-medium mt-1">
                      {involvement?.last_involved
                        ? format(new Date(involvement.last_involved), "MMM d, yyyy")
                        : "—"}
                    </div>
                  </div>
                </div>

                {involvementLog.length > 0 ? (
                  <div className="rounded-lg border divide-y">
                    {involvementLog.map((e, i) => (
                      <div key={i} className="p-3 flex items-start gap-3">
                        <History className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{e.event || "—"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {e.date ? format(new Date(e.date), "MMM d, yyyy") : "—"}
                            {e.role && <> · {e.role}</>}
                          </div>
                        </div>
                        {e.status && (
                          <Badge
                            variant={e.status === "attended" ? "default" : "outline"}
                            className="text-[10px] capitalize"
                          >
                            {e.status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No event involvement yet.</p>
                )}
              </section>

              {/* Contact */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Contact
                </h3>
                <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={viewing.email} />
                <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={viewing.phone} />
                <DetailRow
                  icon={<UserCircle2 className="h-4 w-4" />}
                  label="Point of contact"
                  value={viewing.point_of_contact}
                />
              </section>

              {/* Professional */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Professional
                </h3>
                <DetailRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Institution"
                  value={viewing.institution_name}
                />
                <DetailRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Sector"
                  value={viewing.sector}
                />
                <DetailRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Based in"
                  value={
                    viewing.based_in_country
                      ? `${countryEmoji(viewing.based_in_country)} ${viewing.based_in_country}`
                      : null
                  }
                />
              </section>

              {/* Nationalities */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Nationality
                </h3>
                {getNationalities(viewing).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {getNationalities(viewing).map((n) => (
                      <Badge key={n} variant="outline" className="gap-1">
                        <Globe className="h-3 w-3" /> {countryEmoji(n)} {n}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </section>

              {/* Links */}
              {getLinks(viewing).length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Links
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {getLinks(viewing).map((l, i) => (
                      <a
                        key={i}
                        href={formatUrl(l.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {l.title || l.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Description */}
              {viewing.description && (
                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    About
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {viewing.description}
                  </p>
                </section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDialogOpen(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit stakeholder" : "New stakeholder"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the stakeholder's record."
                : "Add a new stakeholder to your network."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-2">
            {/* Identity */}
            <FormSection title="Identity" hint="Who they are and their role.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full name *" htmlFor="sh-name">
                  <Input
                    id="sh-name"
                    name="full_name"
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                    placeholder="Jane Doe"
                  />
                </Field>
                <Field label="Title / role" htmlFor="sh-title">
                  <Input
                    id="sh-title"
                    name="title"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="CEO, Professor…"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Type">
                  <Select
                    value={form.type || NONE}
                    onValueChange={(v) => set("type", v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status" htmlFor="sh-status">
                  <Input
                    id="sh-status"
                    name="status"
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    placeholder="Active, Inactive…"
                  />
                </Field>
              </div>
            </FormSection>

            {/* Contact */}
            <FormSection title="Contact">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" htmlFor="sh-email">
                  <Input
                    id="sh-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="jane@acme.co"
                  />
                </Field>
                <Field label="Phone" htmlFor="sh-phone">
                  <Input
                    id="sh-phone"
                    name="phone"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+212…"
                  />
                </Field>
              </div>
              <Field label="Point of contact" htmlFor="sh-poc">
                <Input
                  id="sh-poc"
                  name="point_of_contact"
                  value={form.point_of_contact}
                  onChange={(e) => set("point_of_contact", e.target.value)}
                  placeholder="UM6P team member"
                />
              </Field>
              <Field label="Nationalities">
                <MultiSelect
                  value={form.nationalities}
                  onChange={(v) => set("nationalities", v)}
                  placeholder="Select countries…"
                  options={countries.map((c) => ({
                    value: c.name,
                    label: `${c.emoji} ${c.name}`,
                  }))}
                />
              </Field>
            </FormSection>

            {/* Professional */}
            <FormSection title="Professional" hint="Where they work and what they do.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Institution" htmlFor="sh-inst">
                  <Input
                    id="sh-inst"
                    name="institution_name"
                    value={form.institution_name}
                    onChange={(e) => set("institution_name", e.target.value)}
                    placeholder="MIT, Stanford…"
                  />
                </Field>
                <Field label="Sector">
                  <Select
                    value={form.sector || NONE}
                    onValueChange={(v) => set("sector", v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {SECTORS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Based in country">
                <Select
                  value={form.based_in_country || NONE}
                  onValueChange={(v) => set("based_in_country", v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.emoji} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FormSection>

            {/* Links */}
            <FormSection title="Links & description">
              <Field label="Links">
                <div className="space-y-2">
                  {form.links.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={link.title}
                        onChange={(e) => updateLink(idx, "title", e.target.value)}
                        placeholder="Title"
                        className="w-40"
                      />
                      <Input
                        value={link.url}
                        onChange={(e) => updateLink(idx, "url", e.target.value)}
                        placeholder="https://…"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeLink(idx)}
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLink}>
                    <Plus className="mr-1 h-3 w-3" /> Add link
                  </Button>
                </div>
              </Field>
              <Field label="Description" htmlFor="sh-desc">
                <Textarea
                  id="sh-desc"
                  name="description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={4}
                  placeholder="Background, expertise, why they matter…"
                />
              </Field>
            </FormSection>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.full_name || saveMutation.isPending}
            >
              {editing ? "Save changes" : "Add stakeholder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onConfirm={() => deleteId && archiveMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        title="Archive stakeholder?"
        description="They'll be hidden from the directory but can be restored from the Archived view."
      />
    </div>
  );
}

/* ─────────── Small presentational helpers ─────────── */
function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-foreground break-words">{value || "—"}</div>
      </div>
    </div>
  );
}
