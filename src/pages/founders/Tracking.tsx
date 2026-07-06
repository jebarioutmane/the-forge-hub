import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StarRating } from "@/components/StarRating";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Link as LinkIcon,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Calendar as CalendarIcon,
  Activity,
  Users as UsersIcon,
  FileText,
  Archive,
  RotateCcw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatUrl } from "@/lib/formatUrl";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Founder = Tables<"founders">;
type Checkin = Tables<"founder_checkins">;

const AREAS = [
  { key: "product", label: "Product" },
  { key: "team", label: "Team" },
  { key: "traction", label: "Traction" },
  { key: "market", label: "Market" },
  { key: "funding", label: "Funding" },
] as const;

const EFFORT_OPTIONS = [
  { value: "strong", label: "Strong", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "steady", label: "Steady", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "coasting", label: "Coasting", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "at_risk", label: "At Risk", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200" },
] as const;

type LinkItem = { title: string; url: string };

type CheckinForm = {
  id?: string;
  checkin_type: "weekly" | "one_on_one";
  checkin_date: string;
  effort_signal: string;
  product_rating: number; product_note: string;
  team_rating: number; team_note: string;
  traction_rating: number; traction_note: string;
  market_rating: number; market_note: string;
  funding_rating: number; funding_note: string;
  notes: string;
  links: LinkItem[];
};

const emptyCheckin = (): CheckinForm => ({
  checkin_type: "weekly",
  checkin_date: new Date().toISOString().split("T")[0],
  effort_signal: "steady",
  product_rating: 0, product_note: "",
  team_rating: 0, team_note: "",
  traction_rating: 0, traction_note: "",
  market_rating: 0, market_note: "",
  funding_rating: 0, funding_note: "",
  notes: "",
  links: [],
});

function effortBadge(value: string | null | undefined) {
  const opt = EFFORT_OPTIONS.find((o) => o.value === value);
  if (!opt) return <span className="text-[11px] text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium", opt.badge)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", opt.dot)} />
      {opt.label}
    </span>
  );
}

function initials(name?: string | null) {
  if (!name) return "—";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function overallOf(c: Pick<Checkin, "product_rating" | "team_rating" | "traction_rating" | "market_rating" | "funding_rating"> | null | undefined) {
  if (!c) return null;
  const vals = [c.product_rating, c.team_rating, c.traction_rating, c.market_rating, c.funding_rating]
    .map((v) => (typeof v === "number" ? v : null))
    .filter((v): v is number => v !== null && v > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function TrendArrow({ latest, previous }: { latest: number | null; previous: number | null }) {
  if (latest == null || previous == null) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground/60" />;
  }
  const diff = latest - previous;
  if (Math.abs(diff) < 0.15) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  return diff > 0
    ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
    : <TrendingDown className="h-3.5 w-3.5 text-rose-600" />;
}

function LinksEditor({ links, onChange }: { links: LinkItem[]; onChange: (v: LinkItem[]) => void }) {
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="Title"
            value={l.title}
            onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
            className="h-9 text-xs flex-1"
          />
          <Input
            placeholder="https://..."
            value={l.url}
            onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
            className="h-9 text-xs flex-1"
          />
          <button
            type="button"
            onClick={() => onChange(links.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove link"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...(links ?? []), { title: "", url: "" }])}
        className="h-8 text-xs text-muted-foreground"
      >
        <LinkIcon className="h-3.5 w-3.5 mr-1.5" /> Add link
      </Button>
    </div>
  );
}

export default function Tracking() {
  const { selectedCohortId, selectedCohortLabel } = useCohort();
  const qc = useQueryClient();

  const [query, setQuery] = useState("");
  const [selectedFounderId, setSelectedFounderId] = useState<string | null>(null);
  const [form, setForm] = useState<CheckinForm>(emptyCheckin());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewingCheckin, setViewingCheckin] = useState<Checkin | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Founders in selected cohort
  const { data: founders = [], isLoading: foundersLoading } = useQuery({
    queryKey: ["tracking-founders", selectedCohortId],
    queryFn: async () => {
      let q = supabase
        .from("founders")
        .select("id, founder_name, startup_name, cohort_id, associate_id, is_archived")
        .eq("is_archived", false);
      if (selectedCohortId !== ALL_COHORTS) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q.order("startup_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<Founder, "id" | "founder_name" | "startup_name" | "cohort_id" | "associate_id" | "is_archived">[];
    },
  });

  const founderIds = useMemo(() => founders.map((f) => f.id), [founders]);

  // Latest & previous check-in per founder (for list summaries)
  const { data: allCheckins = [] } = useQuery({
    queryKey: ["tracking-checkins-summary", founderIds.join(",")],
    enabled: founderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_checkins")
        .select("*")
        .in("founder_id", founderIds)
        .eq("is_archived", false)
        .order("checkin_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Checkin[];
    },
  });

  const summaries = useMemo(() => {
    const byFounder = new Map<string, Checkin[]>();
    for (const c of allCheckins) {
      const arr = byFounder.get(c.founder_id) ?? [];
      arr.push(c);
      byFounder.set(c.founder_id, arr);
    }
    const result = new Map<string, { latest?: Checkin; previous?: Checkin; latestOverall: number | null; prevOverall: number | null }>();
    for (const [fid, arr] of byFounder) {
      const latest = arr[0];
      const previous = arr[1];
      result.set(fid, {
        latest,
        previous,
        latestOverall: overallOf(latest ?? null),
        prevOverall: overallOf(previous ?? null),
      });
    }
    return result;
  }, [allCheckins]);

  const filteredFounders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? founders.filter(
          (f) =>
            (f.founder_name ?? "").toLowerCase().includes(q) ||
            (f.startup_name ?? "").toLowerCase().includes(q),
        )
      : founders;
    return list;
  }, [founders, query]);

  // Auto-select the first founder when cohort changes
  useEffect(() => {
    if (!filteredFounders.length) {
      setSelectedFounderId(null);
      return;
    }
    if (!selectedFounderId || !filteredFounders.some((f) => f.id === selectedFounderId)) {
      setSelectedFounderId(filteredFounders[0].id);
    }
  }, [filteredFounders, selectedFounderId]);

  const selectedFounder = useMemo(
    () => founders.find((f) => f.id === selectedFounderId) ?? null,
    [founders, selectedFounderId],
  );

  // Full check-in timeline for the selected founder
  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ["tracking-timeline", selectedFounderId, showArchived],
    enabled: !!selectedFounderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_checkins")
        .select("*")
        .eq("founder_id", selectedFounderId!)
        .eq("is_archived", showArchived)
        .order("checkin_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Checkin[];
    },
  });

  const previousCheckin = useMemo<Checkin | null>(() => {
    if (editingId) {
      // when editing, "previous" is the check-in immediately before this one by date
      const idx = timeline.findIndex((c) => c.id === editingId);
      return idx >= 0 ? (timeline[idx + 1] ?? null) : null;
    }
    return timeline[0] ?? null;
  }, [timeline, editingId]);

  // Reset the form whenever the selected founder or editing target changes
  useEffect(() => {
    setEditingId(null);
    setForm(emptyCheckin());
    setExpanded(new Set());
  }, [selectedFounderId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFounder) throw new Error("No founder selected");
      const overall = overallOf({
        product_rating: form.product_rating || null,
        team_rating: form.team_rating || null,
        traction_rating: form.traction_rating || null,
        market_rating: form.market_rating || null,
        funding_rating: form.funding_rating || null,
      });
      const payload = {
        founder_id: selectedFounder.id,
        associate_id: selectedFounder.associate_id ?? null,
        checkin_type: form.checkin_type,
        checkin_date: form.checkin_date,
        effort_signal: form.effort_signal || null,
        product_rating: form.product_rating || null,
        product_note: form.product_note || null,
        team_rating: form.team_rating || null,
        team_note: form.team_note || null,
        traction_rating: form.traction_rating || null,
        traction_note: form.traction_note || null,
        market_rating: form.market_rating || null,
        market_note: form.market_note || null,
        funding_rating: form.funding_rating || null,
        funding_note: form.funding_note || null,
        notes: form.notes || null,
        links: form.links as any,
        overall_score: overall != null ? Math.round(overall) : null,
      };
      if (editingId) {
        const { error } = await supabase.from("founder_checkins").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("founder_checkins").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Check-in updated" : "Check-in logged");
      setForm(emptyCheckin());
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["tracking-timeline"] });
      qc.invalidateQueries({ queryKey: ["tracking-checkins-summary"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save check-in"),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("founder_checkins")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check-in removed");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["tracking-timeline"] });
      qc.invalidateQueries({ queryKey: ["tracking-checkins-summary"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to remove"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("founder_checkins")
        .update({ is_archived: false, archived_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check-in restored");
      qc.invalidateQueries({ queryKey: ["tracking-timeline"] });
      qc.invalidateQueries({ queryKey: ["tracking-checkins-summary"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to restore"),
  });

  function beginEdit(c: Checkin) {
    setEditingId(c.id);
    setForm({
      id: c.id,
      checkin_type: (c.checkin_type as "weekly" | "one_on_one") ?? "weekly",
      checkin_date: c.checkin_date,
      effort_signal: c.effort_signal ?? "steady",
      product_rating: c.product_rating ?? 0, product_note: c.product_note ?? "",
      team_rating: c.team_rating ?? 0, team_note: c.team_note ?? "",
      traction_rating: c.traction_rating ?? 0, traction_note: c.traction_note ?? "",
      market_rating: c.market_rating ?? 0, market_note: c.market_note ?? "",
      funding_rating: c.funding_rating ?? 0, funding_note: c.funding_note ?? "",
      notes: c.notes ?? "",
      links: Array.isArray(c.links) ? (c.links as any as LinkItem[]) : [],
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // === Render ===

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Founders · Progress Tracker
            </div>
            <h1 className="mt-1 text-[26px] font-semibold text-[#1D1D1F] tracking-tight">
              Progress Tracker
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Weekly and 1:1 check-ins for {selectedCohortLabel}. Track movement, not absolutes.
            </p>
          </div>
        </div>

        {/* Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left: founder list */}
          <div className="rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="border-b border-black/5 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search founders…"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{filteredFounders.length} founders</span>
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="h-3 w-3" /> {selectedCohortLabel}
                </span>
              </div>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {foundersLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-black/[0.03] animate-pulse" />
                  ))}
                </div>
              ) : filteredFounders.length === 0 ? (
                <div className="p-10 text-center">
                  <UsersIcon className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-[#1D1D1F]">No founders in this cohort</p>
                  <p className="mt-1 text-xs text-muted-foreground">Switch cohorts from the header selector.</p>
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {filteredFounders.map((f) => {
                    const s = summaries.get(f.id);
                    const latest = s?.latest;
                    const isActive = selectedFounderId === f.id;
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedFounderId(f.id)}
                          className={cn(
                            "w-full text-left px-4 py-3 transition-colors",
                            isActive ? "bg-[#0071E3]/[0.06]" : "hover:bg-black/[0.02]",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-[11px] font-medium text-white">
                              {initials(f.founder_name || f.startup_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-[13.5px] font-medium text-[#1D1D1F]">
                                  {f.startup_name || "Untitled startup"}
                                </p>
                                <TrendArrow latest={s?.latestOverall ?? null} previous={s?.prevOverall ?? null} />
                              </div>
                              <p className="truncate text-[12px] text-muted-foreground">
                                {f.founder_name || "—"}
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                {effortBadge(latest?.effort_signal)}
                                <span className="text-[11px] text-muted-foreground">
                                  {latest ? format(parseISO(latest.checkin_date), "MMM d") : "No check-ins"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: workspace */}
          <div className="space-y-6">
            {!selectedFounder ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white p-16 text-center">
                <Activity className="mx-auto h-6 w-6 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-[#1D1D1F]">Pick a founder to log a check-in</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select someone from the list to start.
                </p>
              </div>
            ) : (
              <>
                {/* Founder header */}
                <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1D1D1F] text-sm font-medium text-white">
                        {initials(selectedFounder.founder_name || selectedFounder.startup_name)}
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Founder</p>
                        <h2 className="text-[20px] font-semibold text-[#1D1D1F] leading-tight">
                          {selectedFounder.startup_name || "Untitled startup"}
                        </h2>
                        <p className="text-sm text-muted-foreground">{selectedFounder.founder_name || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Previous overall
                      </p>
                      <p className="mt-1 text-[22px] font-semibold tabular-nums text-[#1D1D1F]">
                        {previousCheckin && overallOf(previousCheckin) != null
                          ? overallOf(previousCheckin)!.toFixed(1)
                          : "—"}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">/ 5</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Check-in form */}
                <div className="rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="flex items-center justify-between border-b border-black/5 p-6">
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
                        {editingId ? "Edit check-in" : "New check-in"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Rate each dimension 1–5. Previous scores shown for comparison.
                      </p>
                    </div>
                    {editingId && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setForm(emptyCheckin()); }}>
                        Cancel edit
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</Label>
                      <Select value={form.checkin_type} onValueChange={(v) => setForm({ ...form, checkin_type: v as any })}>
                        <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="one_on_one">1:1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={form.checkin_date}
                        onChange={(e) => setForm({ ...form, checkin_date: e.target.value })}
                        className="mt-1.5 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Effort signal</Label>
                      <Select value={form.effort_signal} onValueChange={(v) => setForm({ ...form, effort_signal: v })}>
                        <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EFFORT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              <span className="inline-flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", o.dot)} />
                                {o.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border-t border-black/5 p-6 space-y-5">
                    {AREAS.map((a) => {
                      const key = `${a.key}_rating` as keyof CheckinForm;
                      const noteKey = `${a.key}_note` as keyof CheckinForm;
                      const prev = previousCheckin?.[`${a.key}_rating` as keyof Checkin] as number | null | undefined;
                      const value = form[key] as number;
                      return (
                        <div key={a.key} className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 items-start">
                          <div>
                            <div className="text-sm font-medium text-[#1D1D1F]">{a.label}</div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              last: {prev ? `${prev}/5` : "—"}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <StarRating value={value} onChange={(v) => setForm({ ...form, [key]: v } as any)} size={18} />
                              <span className="text-[12px] tabular-nums text-muted-foreground">
                                {value ? `${value}/5` : "unrated"}
                              </span>
                            </div>
                            <Textarea
                              placeholder={`Notes on ${a.label.toLowerCase()}…`}
                              value={form[noteKey] as string}
                              onChange={(e) => setForm({ ...form, [noteKey]: e.target.value } as any)}
                              className="min-h-[60px] text-sm"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-black/5 p-6 space-y-4">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Overall notes</Label>
                      <Textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="What's the headline this week? What changed?"
                        className="mt-1.5 min-h-[80px] text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Links</Label>
                      <div className="mt-1.5">
                        <LinksEditor links={form.links} onChange={(v) => setForm({ ...form, links: v })} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-black/5 p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setForm(emptyCheckin()); setEditingId(null); }}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="bg-[#0071E3] hover:bg-[#0071E3]/90 text-white"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      {editingId ? "Save changes" : "Log check-in"}
                    </Button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="border-b border-black/5 p-6">
                    <h3 className="text-[15px] font-semibold text-[#1D1D1F]">History</h3>
                    <p className="text-xs text-muted-foreground">All past check-ins, newest first.</p>
                  </div>

                  {timelineLoading ? (
                    <div className="p-6 space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-14 rounded-lg bg-black/[0.03] animate-pulse" />
                      ))}
                    </div>
                  ) : timeline.length === 0 ? (
                    <div className="p-12 text-center">
                      <FileText className="mx-auto h-6 w-6 text-muted-foreground/50" />
                      <p className="mt-3 text-sm font-medium text-[#1D1D1F]">No check-ins yet for this founder</p>
                      <p className="mt-1 text-xs text-muted-foreground">Log the first one above.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-black/5">
                      {timeline.map((c) => {
                        const isOpen = expanded.has(c.id);
                        const overall = overallOf(c);
                        return (
                          <li key={c.id}>
                            <div className="flex items-center gap-3 px-6 py-3">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(c.id)}
                                className="flex flex-1 items-center gap-3 text-left"
                              >
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm font-medium text-[#1D1D1F] tabular-nums">
                                  {format(parseISO(c.checkin_date), "MMM d, yyyy")}
                                </span>
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {c.checkin_type === "one_on_one" ? "1:1" : "Weekly"}
                                </Badge>
                                {effortBadge(c.effort_signal)}
                                <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
                                  {overall != null ? `${overall.toFixed(1)}/5` : "—"}
                                </span>
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setViewingCheckin(c)}>
                                    <Eye className="h-3.5 w-3.5 mr-2" /> View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => beginEdit(c)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setDeleteId(c.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {isOpen && (
                              <div className="bg-black/[0.015] px-6 py-4 border-t border-black/5">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                  {AREAS.map((a) => {
                                    const r = c[`${a.key}_rating` as keyof Checkin] as number | null;
                                    const n = c[`${a.key}_note` as keyof Checkin] as string | null;
                                    return (
                                      <div key={a.key} className="rounded-lg bg-white p-3 border border-black/5">
                                        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{a.label}</div>
                                        <div className="mt-0.5 text-sm font-medium tabular-nums text-[#1D1D1F]">
                                          {r ? `${r}/5` : "—"}
                                        </div>
                                        {n && <div className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed line-clamp-3">{n}</div>}
                                      </div>
                                    );
                                  })}
                                </div>
                                {c.notes && (
                                  <div className="mt-3 rounded-lg border border-black/5 bg-white p-3 text-[13px] text-[#1D1D1F] whitespace-pre-wrap">
                                    {c.notes}
                                  </div>
                                )}
                                {Array.isArray(c.links) && (c.links as any[]).length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {(c.links as any as LinkItem[]).map((l, i) => (
                                      <a
                                        key={i}
                                        href={formatUrl(l.url)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-white px-2 py-1 text-[11.5px] text-[#0071E3] hover:bg-[#0071E3]/[0.06]"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        {l.title || l.url}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* View dialog */}
      <Dialog open={!!viewingCheckin} onOpenChange={(o) => !o && setViewingCheckin(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Check-in details</DialogTitle>
            <DialogDescription>
              {viewingCheckin ? format(parseISO(viewingCheckin.checkin_date), "MMMM d, yyyy") : ""}
            </DialogDescription>
          </DialogHeader>
          {viewingCheckin && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{viewingCheckin.checkin_type === "one_on_one" ? "1:1" : "Weekly"}</Badge>
                {effortBadge(viewingCheckin.effort_signal)}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {AREAS.map((a) => {
                  const r = viewingCheckin[`${a.key}_rating` as keyof Checkin] as number | null;
                  return (
                    <div key={a.key} className="rounded-lg border border-black/5 p-3">
                      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{a.label}</div>
                      <div className="mt-0.5 text-sm font-medium tabular-nums">{r ? `${r}/5` : "—"}</div>
                    </div>
                  );
                })}
              </div>
              {AREAS.map((a) => {
                const n = viewingCheckin[`${a.key}_note` as keyof Checkin] as string | null;
                if (!n) return null;
                return (
                  <div key={a.key}>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{a.label} notes</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#1D1D1F]">{n}</p>
                  </div>
                );
              })}
              {viewingCheckin.notes && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Overall</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#1D1D1F]">{viewingCheckin.notes}</p>
                </div>
              )}
              {Array.isArray(viewingCheckin.links) && (viewingCheckin.links as any[]).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(viewingCheckin.links as any as LinkItem[]).map((l, i) => (
                    <a
                      key={i}
                      href={formatUrl(l.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-black/10 px-2 py-1 text-[11.5px] text-[#0071E3] hover:bg-[#0071E3]/[0.06]"
                    >
                      <ArrowUpRight className="h-3 w-3" /> {l.title || l.url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingCheckin(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && archiveMutation.mutate(deleteId)}
        title="Remove this check-in?"
        description="It will be archived and hidden from history."
      />
    </div>
  );
}
