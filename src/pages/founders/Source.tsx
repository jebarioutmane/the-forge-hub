import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
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
  Users,
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
  BadgeCheck,
  UserCircle2,
  Building2,
  IdCard,
  BookOpen,
  Link2,
  ArchiveRestore,
  Filter,
  Rocket,
  TrendingUp,
  DollarSign,
  Landmark,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { TagPicker } from "@/components/TagPicker";
import { TagBadges } from "@/components/TagBadges";
import { format } from "date-fns";
import { formatUrl } from "@/lib/formatUrl";
import type { Tables } from "@/integrations/supabase/types";
import { usePermissions } from "@/hooks/usePermissions";
import { Sensitive } from "@/components/permissions/Sensitive";
import {
  useFounderSensitiveOne,
  upsertFounderSensitive,
  useInvalidateFounderSensitive,
} from "@/hooks/useFounderSensitive";

type Founder = Tables<"founders">;
type Cohort = Tables<"cohorts">;

interface LinkItem {
  title: string;
  url: string;
}

interface FounderForm {
  founder_name: string;
  startup_name: string;
  cohort_id: string;
  associate_id: string;
  nationalities: string[];
  phone: string;
  email: string;
  status: string;
  description: string;
  tag_ids: string[];
  links: LinkItem[];
  rib_number: string;
  cin_number: string;
  passport_number: string;
  birthday: string;
  photo_url: string;
  sector: string;
  stage: string;
  funding_raised: string;
  funding_currency: string;
}

const emptyForm: FounderForm = {
  founder_name: "",
  startup_name: "",
  cohort_id: "",
  associate_id: "",
  nationalities: [],
  phone: "",
  email: "",
  status: "",
  description: "",
  tag_ids: [],
  links: [],
  rib_number: "",
  cin_number: "",
  passport_number: "",
  birthday: "",
  photo_url: "",
  sector: "",
  stage: "",
  funding_raised: "",
  funding_currency: "MAD",
};

const NONE = "__none__";

/* ─────────── Multi-select combobox ─────────── */
function MultiSelect({
  value,
  onChange,
  options,
  placeholder,
  renderOption,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string; hint?: string }[];
  placeholder: string;
  renderOption?: (o: { value: string; label: string; hint?: string }) => React.ReactNode;
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
                  <span className="flex-1">{renderOption ? renderOption(o) : o.label}</span>
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
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const queryClient = useQueryClient();
  const { canEdit, canDelete, canSeeSensitive } = usePermissions();
  const mayEdit = canEdit("founders");
  const mayDelete = canDelete("founders");
  const maySeeSensitive = canSeeSensitive("founders");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Founder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Founder | null>(null);
  const [form, setForm] = useState<FounderForm>(emptyForm);

  // Sensitive identifiers live in the internal-only `founder_sensitive` table.
  const { data: viewingSensitive } = useFounderSensitiveOne(viewing?.id, maySeeSensitive);
  const invalidateSensitive = useInvalidateFounderSensitive();

  // Global cohort selection lives in shared context (header switcher drives it).
  const { selectedCohortId, cohorts } = useCohort();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCountries, setFilterCountries] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterAssociates, setFilterAssociates] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);


  const { data: founders = [], isLoading } = useQuery({
    queryKey: ["founders", "directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders")
        .select("*")
        .order("founder_name");
      if (error) throw error;
      return data as Founder[];
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

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", "directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const cohortLabel = (id: string | null | undefined) =>
    (id && cohorts.find((c) => c.id === id)?.label) || "";
  const associateName = (id: string | null | undefined) =>
    (id && (profiles.find((p) => p.id === id)?.full_name ||
      profiles.find((p) => p.id === id)?.email)) || "";
  const countryEmoji = (name: string | null | undefined) =>
    (name && countries.find((c) => c.name === name)?.emoji) || "🏳️";

  function getFounderNationalities(f: Founder): string[] {
    const arr = f.nationalities as string[] | null;
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

  /* ─────────── Filter options ─────────── */
  const uniqueCountries = useMemo(() => {
    const s = new Set<string>();
    founders.forEach((f) => getFounderNationalities(f).forEach((n) => n && s.add(n)));
    return [...s].sort();
  }, [founders]);

  const uniqueStatuses = useMemo(() => {
    const s = new Set<string>();
    founders.forEach((f) => f.status && s.add(f.status));
    return [...s].sort();
  }, [founders]);

  const uniqueAssociates = useMemo(() => {
    const s = new Set<string>();
    founders.forEach((f) => f.associate_id && s.add(f.associate_id));
    return [...s];
  }, [founders]);

  /* ─────────── Filtering ─────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return founders.filter((f) => {
      if (showArchived ? !f.is_archived : f.is_archived) return false;
      if (selectedCohortId !== ALL_COHORTS && f.cohort_id !== selectedCohortId) return false;
      if (q) {
        const hay = [f.founder_name, f.startup_name, f.email].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterCountries.length > 0) {
        const nats = getFounderNationalities(f);
        if (!nats.some((n) => filterCountries.includes(n))) return false;
      }
      if (filterStatuses.length > 0 && !filterStatuses.includes(f.status || "")) return false;
      if (filterAssociates.length > 0 && !filterAssociates.includes(f.associate_id || "")) return false;
      if (filterTags.length > 0) {
        const tids = (f.tag_ids as string[] | null) || [];
        if (!tids.some((t) => filterTags.includes(t))) return false;
      }
      return true;
    });
  }, [
    founders,
    search,
    showArchived,
    selectedCohortId,
    filterCountries,
    filterStatuses,
    filterAssociates,
    filterTags,
  ]);

  const activeFilterCount =
    (search ? 1 : 0) +
    filterCountries.length +
    filterStatuses.length +
    filterAssociates.length +
    filterTags.length;

  const clearAllFilters = () => {
    setSearch("");
    setFilterCountries([]);
    setFilterStatuses([]);
    setFilterAssociates([]);
    setFilterTags([]);
  };

  /* ─────────── Mutations ─────────── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        founder_name: form.founder_name,
        startup_name: form.startup_name,
        cohort_id: form.cohort_id || null,
        cohort: form.cohort_id ? cohortLabel(form.cohort_id) : null,
        associate_id: form.associate_id || null,
        venture_associate: form.associate_id ? associateName(form.associate_id) : null,
        nationality: form.nationalities[0] || null,
        nationalities: form.nationalities,
        phone: form.phone || null,
        email: form.email || null,
        status: form.status || null,
        description: form.description || null,
        tag_ids: form.tag_ids,
        links: form.links.filter((l) => l.url) as any,
        link_title: form.links[0]?.title || null,
        link_url: form.links[0]?.url || null,
        birthday: form.birthday || null,
        photo_url: form.photo_url || null,
        sector: form.sector || null,
        stage: form.stage || null,
        funding_raised: form.funding_raised ? Number(form.funding_raised) : null,
        funding_currency: form.funding_currency || "MAD",
      };
      const sensitiveValues = {
        rib_number: form.rib_number || null,
        cin_number: form.cin_number || null,
        passport_number: form.passport_number || null,
      };
      if (editing) {
        const { error } = await supabase.from("founders").update(payload).eq("id", editing.id);
        if (error) throw error;
        await upsertFounderSensitive(editing.id, sensitiveValues);
      } else {
        const { data, error } = await supabase.from("founders").insert(payload).select("id").single();
        if (error) throw error;
        if (data?.id) await upsertFounderSensitive(data.id, sensitiveValues);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      invalidateSensitive();
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Founder updated" : "Founder added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("founders")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      setDeleteId(null);
      setViewing(null);
      toast.success("Founder archived");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("founders")
        .update({ is_archived: false, archived_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      toast.success("Founder restored");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function openEdit(f: Founder) {
    let sensitive: { rib_number: string | null; cin_number: string | null; passport_number: string | null } | null = null;
    if (maySeeSensitive) {
      const { data } = await supabase
        .from("founder_sensitive")
        .select("rib_number, cin_number, passport_number")
        .eq("founder_id", f.id)
        .maybeSingle();
      sensitive = (data as any) ?? null;
    }
    const nats = getFounderNationalities(f);
    const links = getFounderLinks(f);
    setForm({
      founder_name: f.founder_name,
      startup_name: f.startup_name,
      cohort_id: f.cohort_id || "",
      associate_id: f.associate_id || "",
      nationalities: nats,
      phone: f.phone || "",
      email: f.email || "",
      status: f.status || "",
      description: f.description || "",
      tag_ids: (f.tag_ids as string[]) || [],
      links: links.length > 0 ? links : [],
      rib_number: sensitive?.rib_number || "",
      cin_number: sensitive?.cin_number || "",
      passport_number: sensitive?.passport_number || "",
      birthday: f.birthday || "",
      photo_url: f.photo_url || "",
      sector: (f as any).sector || "",
      stage: (f as any).stage || "",
      funding_raised: (f as any).funding_raised != null ? String((f as any).funding_raised) : "",
      funding_currency: (f as any).funding_currency || "MAD",
    });
    setEditing(f);
    setDialogOpen(true);
  }

  const set = (key: keyof FounderForm, val: any) => setForm((f) => ({ ...f, [key]: val }));
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
      .map((w) => w[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 2);

  /* ─────────── Render ─────────── */
  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Founders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Directory of founders and their startups.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {mayEdit && (
            <Button
              onClick={() => {
                setForm({
                  ...emptyForm,
                  cohort_id:
                    selectedCohortId !== ALL_COHORTS ? selectedCohortId : "",
                });
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add founder
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, startup, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <MultiSelect
              value={filterCountries}
              onChange={setFilterCountries}
              placeholder="Country"
              options={uniqueCountries.map((c) => ({
                value: c,
                label: `${countryEmoji(c)} ${c}`,
              }))}
            />
            <MultiSelect
              value={filterStatuses}
              onChange={setFilterStatuses}
              placeholder="Status"
              options={uniqueStatuses.map((s) => ({ value: s, label: s }))}
            />
            <MultiSelect
              value={filterAssociates}
              onChange={setFilterAssociates}
              placeholder="Venture associate"
              options={uniqueAssociates.map((id) => ({
                value: id,
                label: associateName(id) || "Unassigned",
              }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px] flex-1">
              <MultiSelect
                value={filterTags}
                onChange={setFilterTags}
                placeholder="Tags"
                options={tags.map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <Switch
                id="archived-toggle"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
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
                  <button onClick={() => setSearch("")}><X className="h-3 w-3" /></button>
                </Badge>
              )}
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
              {filterAssociates.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1">
                  <UserCircle2 className="h-3 w-3" /> {associateName(id) || "Unassigned"}
                  <button onClick={() => setFilterAssociates(filterAssociates.filter((x) => x !== id))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filterTags.map((id) => {
                const t = tags.find((x) => x.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {t?.name || "Tag"}
                    <button onClick={() => setFilterTags(filterTags.filter((x) => x !== id))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filtered.length} founder{filtered.length !== 1 ? "s" : ""}
          {showArchived ? " · archived" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <Filter className="h-3 w-3" />
          {activeFilterCount === 0 ? "No filters" : `${activeFilterCount} active`}
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-16">Loading founders…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-card">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {showArchived ? "No archived founders." : "No founders match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Founder</th>
                <th className="text-left font-medium px-4 py-3">Startup</th>
                <th className="text-left font-medium px-4 py-3">Cohort</th>
                <th className="text-left font-medium px-4 py-3">Country</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Associate</th>
                <th className="text-left font-medium px-4 py-3">Contact</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const nats = getFounderNationalities(f);
                return (
                  <tr
                    key={f.id}
                    className={`border-t transition-colors cursor-pointer hover:bg-muted/40 ${
                      highlightId === f.id ? "animate-target-flash" : ""
                    }`}
                    onClick={() => setViewing(f)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {f.photo_url ? (
                            <img
                              src={f.photo_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">
                              {initials(f.founder_name)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{f.founder_name}</div>
                          {f.email && (
                            <div className="text-xs text-muted-foreground truncate">
                              {f.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {f.startup_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cohortLabel(f.cohort_id) || f.cohort || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {nats.length > 0 ? (
                        <span className="text-muted-foreground">
                          {nats.slice(0, 2).map((n) => countryEmoji(n)).join(" ")}{" "}
                          <span className="text-xs">
                            {nats.length > 2 ? `+${nats.length - 2}` : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {f.status ? (
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium"
                        >
                          {f.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {associateName(f.associate_id) || f.venture_associate || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-3 text-xs">
                        {f.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {maySeeSensitive ? f.phone : <span className="italic">•••• (restricted)</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(f)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> View
                          </DropdownMenuItem>
                          {mayEdit && (
                            <DropdownMenuItem onClick={() => openEdit(f)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                          )}
                          {mayDelete && (f.is_archived ? (
                            <DropdownMenuItem onClick={() => restoreMutation.mutate(f.id)}>
                              <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(f.id)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Archive
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">Founder details</SheetTitle>
            <SheetDescription className="sr-only">
              Full record for the selected founder.
            </SheetDescription>
          </SheetHeader>
          {viewing && (
            <div className="space-y-6 pt-2">
              {/* Identity block */}
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {viewing.photo_url ? (
                    <img
                      src={viewing.photo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium text-muted-foreground">
                      {initials(viewing.founder_name)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold leading-tight">
                    {viewing.founder_name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {viewing.startup_name}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {viewing.status && (
                      <Badge variant="secondary" className="text-[11px]">
                        {viewing.status}
                      </Badge>
                    )}
                    {cohortLabel(viewing.cohort_id) && (
                      <Badge variant="outline" className="text-[11px]">
                        {cohortLabel(viewing.cohort_id)}
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

              {/* Profile */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Profile
                </h3>
                <DetailRow icon={<UserCircle2 className="h-4 w-4" />} label="Founder" value={viewing.founder_name} />
                <DetailRow icon={<Building2 className="h-4 w-4" />} label="Startup" value={viewing.startup_name} />
                <DetailRow icon={<BadgeCheck className="h-4 w-4" />} label="Status" value={viewing.status} />
                <DetailRow icon={<Users className="h-4 w-4" />} label="Cohort" value={cohortLabel(viewing.cohort_id)} />
              </section>

              {/* Contact */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Contact
                </h3>
                <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={viewing.email} />
                <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={<Sensitive section="founders" value={viewing.phone} />} />
                <DetailRow
                  icon={<UserCircle2 className="h-4 w-4" />}
                  label="Venture associate"
                  value={associateName(viewing.associate_id) || viewing.venture_associate}
                />
              </section>

              {/* Nationalities */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Nationality
                </h3>
                {getFounderNationalities(viewing).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {getFounderNationalities(viewing).map((n) => (
                      <Badge key={n} variant="outline" className="gap-1">
                        <Globe className="h-3 w-3" /> {countryEmoji(n)} {n}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </section>

              {/* Startup profile */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Startup profile
                </h3>
                <DetailRow
                  icon={<Rocket className="h-4 w-4" />}
                  label="Sector"
                  value={(viewing as any).sector}
                />
                <DetailRow
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Stage"
                  value={(viewing as any).stage}
                />
                <DetailRow
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Funding raised"
                  value={
                    (viewing as any).funding_raised != null
                      ? `${Number((viewing as any).funding_raised).toLocaleString()} ${(viewing as any).funding_currency || "MAD"}`
                      : null
                  }
                />
              </section>

              {/* Identity docs */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Identity
                </h3>
                <DetailRow
                  icon={<Landmark className="h-4 w-4" />}
                  label="RIB"
                  value={<Sensitive section="founders" value={viewingSensitive?.rib_number} />}
                />
                <DetailRow
                  icon={<IdCard className="h-4 w-4" />}
                  label="CIN"
                  value={<Sensitive section="founders" value={viewingSensitive?.cin_number} />}
                />
                <DetailRow
                  icon={<BadgeCheck className="h-4 w-4" />}
                  label="Passport"
                  value={<Sensitive section="founders" value={viewingSensitive?.passport_number} />}

                />
                <DetailRow
                  icon={<BookOpen className="h-4 w-4" />}
                  label="Birthday"
                  value={
                    viewing.birthday
                      ? format(new Date(viewing.birthday), "PPP")
                      : null
                  }
                />
              </section>

              {/* Links */}
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Links
                </h3>
                {getFounderLinks(viewing).length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {getFounderLinks(viewing).map((l, i) => (
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
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </section>

              {/* Description */}
              <section className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  About
                </h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {viewing.description || "—"}
                </p>
              </section>

              {/* Tags */}
              <section className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Tags
                </h3>
                {viewing.tag_ids && (viewing.tag_ids as string[]).length > 0 ? (
                  <TagBadges tagIds={viewing.tag_ids as string[] | null} />
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </section>
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
            <DialogTitle>{editing ? "Edit founder" : "New founder"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the founder's record."
                : "Add a new founder and their startup to the directory."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-2">
            {/* Section: Basics */}
            <FormSection
              title="Basics"
              hint="Who they are and which cohort they belong to."
            >
              <div className="grid grid-cols-2 gap-4">
                <Field label="Founder name *" htmlFor="founder-name">
                  <Input
                    id="founder-name"
                    name="founder_name"
                    value={form.founder_name}
                    onChange={(e) => set("founder_name", e.target.value)}
                    placeholder="Jane Doe"
                  />
                </Field>
                <Field label="Startup name *" htmlFor="startup-name">
                  <Input
                    id="startup-name"
                    name="startup_name"
                    value={form.startup_name}
                    onChange={(e) => set("startup_name", e.target.value)}
                    placeholder="Acme Inc."
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cohort">
                  <Select
                    value={form.cohort_id || NONE}
                    onValueChange={(v) => set("cohort_id", v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {cohorts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Venture associate">
                  <Select
                    value={form.associate_id || NONE}
                    onValueChange={(v) => set("associate_id", v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign someone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email || "Unnamed"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Status" htmlFor="founder-status">
                  <Input
                    id="founder-status"
                    name="status"
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    placeholder="Active, Dismissed…"
                  />
                </Field>
                <Field label="Photo URL" htmlFor="photo-url">
                  <Input
                    id="photo-url"
                    name="photo_url"
                    value={form.photo_url}
                    onChange={(e) => set("photo_url", e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
              </div>
            </FormSection>

            {/* Section: Startup profile */}
            <FormSection title="Startup profile" hint="Sector, stage & funding — feeds the Portfolio Dashboard.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Sector" htmlFor="founder-sector">
                  <Input
                    id="founder-sector"
                    name="sector"
                    value={form.sector}
                    onChange={(e) => set("sector", e.target.value)}
                    placeholder="Fintech, HealthTech, EdTech…"
                  />
                </Field>
                <Field label="Stage">
                  <Select
                    value={form.stage || NONE}
                    onValueChange={(v) => set("stage", v === NONE ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      <SelectItem value="Idea">Idea</SelectItem>
                      <SelectItem value="MVP">MVP</SelectItem>
                      <SelectItem value="Early Revenue">Early Revenue</SelectItem>
                      <SelectItem value="Growth">Growth</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Funding raised" htmlFor="funding-raised">
                  <Input
                    id="funding-raised"
                    name="funding_raised"
                    type="number"
                    min="0"
                    step="any"
                    value={form.funding_raised}
                    onChange={(e) => set("funding_raised", e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Currency">
                  <Select
                    value={form.funding_currency || "MAD"}
                    onValueChange={(v) => set("funding_currency", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAD">MAD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FormSection>

            {/* Section: Contact & nationality */}
            <FormSection title="Contact & nationality">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" htmlFor="founder-email">
                  <Input
                    id="founder-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="jane@acme.co"
                  />
                </Field>
                <Field label="Phone" htmlFor="founder-phone">
                  <Input
                    id="founder-phone"
                    name="phone"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+212…"
                  />
                </Field>
              </div>
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

            {/* Section: Identity */}
            <FormSection title="Identity" hint="Legal documents & date of birth.">
              {maySeeSensitive && (
                <Field label="Bank RIB" htmlFor="rib-number">
                  <Input
                    id="rib-number"
                    name="rib_number"
                    value={form.rib_number}
                    onChange={(e) => set("rib_number", e.target.value)}
                    placeholder="24 digits"
                  />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="CIN" htmlFor="cin-number">
                  <Input
                    id="cin-number"
                    name="cin_number"
                    value={form.cin_number}
                    onChange={(e) => set("cin_number", e.target.value)}
                    placeholder="AB123456"
                  />
                </Field>
                <Field label="Passport" htmlFor="passport-number">
                  <Input
                    id="passport-number"
                    name="passport_number"
                    value={form.passport_number}
                    onChange={(e) => set("passport_number", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Birthday">
                <Input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => set("birthday", e.target.value)}
                />
              </Field>
            </FormSection>

            {/* Section: Links & description */}
            <FormSection title="Links & description">
              <Field label="Tags">
                <TagPicker value={form.tag_ids} onChange={(ids) => set("tag_ids", ids)} />
              </Field>
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
              <Field label="Description" htmlFor="founder-description">
                <Textarea
                  id="founder-description"
                  name="description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={4}
                  placeholder="What are they building?"
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
              disabled={!form.founder_name || !form.startup_name || saveMutation.isPending}
            >
              {editing ? "Save changes" : "Add founder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onConfirm={() => deleteId && archiveMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
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
