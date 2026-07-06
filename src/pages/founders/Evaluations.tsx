import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Search,
  Users as UsersIcon,
  ClipboardCheck,
  Target,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Circle,
  Plus,
  X,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Activity,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Founder = Tables<"founders">;
type Evaluation = Tables<"founder_evaluations">;
type Checkin = Tables<"founder_checkins">;

const BLOCKS = [
  { number: 1, name: "Block 1", label: "Validation" },
  { number: 2, name: "Block 2", label: "Build" },
  { number: 3, name: "Block 3", label: "Market Entry" },
  { number: 4, name: "Block 4", label: "Scale" },
] as const;

const STARTUP_DIMS = [
  { key: "product", label: "Product" },
  { key: "team", label: "Team" },
  { key: "traction", label: "Traction" },
  { key: "market", label: "Market" },
  { key: "funding", label: "Funding" },
] as const;

const FOUNDER_DIMS = [
  { key: "coachability", label: "Coachability" },
  { key: "vision", label: "Vision & Ambition" },
  { key: "execution", label: "Execution & Effort" },
  { key: "resilience", label: "Resilience" },
] as const;

const ALL_DIMS = [...STARTUP_DIMS, ...FOUNDER_DIMS];
type DimKey = (typeof ALL_DIMS)[number]["key"];

type DimensionScore = { rating: number; note: string };
type AbsoluteTarget = { id: string; label: string; met: boolean };

type Decision = "stay" | "at_risk" | "exit";

const DECISIONS: { value: Decision; label: string; icon: typeof ShieldCheck; tone: string; ring: string; dot: string }[] = [
  { value: "stay", label: "Stay", icon: ShieldCheck, tone: "text-emerald-700", ring: "ring-emerald-500/50 bg-emerald-50 border-emerald-300", dot: "bg-emerald-500" },
  { value: "at_risk", label: "At Risk", icon: AlertTriangle, tone: "text-amber-700", ring: "ring-amber-500/50 bg-amber-50 border-amber-300", dot: "bg-amber-500" },
  { value: "exit", label: "Exit", icon: XCircle, tone: "text-rose-700", ring: "ring-rose-500/50 bg-rose-50 border-rose-300", dot: "bg-rose-500" },
];

const EFFORT_LABEL: Record<string, string> = {
  strong: "Strong",
  steady: "Steady",
  coasting: "Coasting",
  at_risk: "At Risk",
};

type EvalForm = {
  block_number: number;
  block_name: string;
  evaluation_date: string;
  dimension_scores: Record<DimKey, DimensionScore>;
  absolute_targets: AbsoluteTarget[];
  decision: Decision | "";
  summary_note: string;
};

function emptyEval(block_number = 1, block_name = "Block 1"): EvalForm {
  const dims = Object.fromEntries(
    ALL_DIMS.map((d) => [d.key, { rating: 0, note: "" }]),
  ) as Record<DimKey, DimensionScore>;
  return {
    block_number,
    block_name,
    evaluation_date: new Date().toISOString().split("T")[0],
    dimension_scores: dims,
    absolute_targets: [],
    decision: "",
    summary_note: "",
  };
}

function initials(name?: string | null) {
  if (!name) return "—";
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function meanOf(scores: Record<DimKey, DimensionScore>) {
  const vals = ALL_DIMS.map((d) => scores[d.key]?.rating || 0).filter((v) => v > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function toDimScores(raw: unknown): Record<DimKey, DimensionScore> {
  const base = Object.fromEntries(
    ALL_DIMS.map((d) => [d.key, { rating: 0, note: "" }]),
  ) as Record<DimKey, DimensionScore>;
  if (raw && typeof raw === "object") {
    for (const d of ALL_DIMS) {
      const v = (raw as any)[d.key];
      if (v && typeof v === "object") {
        base[d.key] = {
          rating: Number(v.rating) || 0,
          note: typeof v.note === "string" ? v.note : "",
        };
      }
    }
  }
  return base;
}

function toTargets(raw: unknown): AbsoluteTarget[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t: any, i: number) => ({
      id: typeof t?.id === "string" ? t.id : String(i),
      label: typeof t?.label === "string" ? t.label : "",
      met: Boolean(t?.met),
    }))
    .filter((t) => t.label);
}

export default function Evaluations() {
  const { selectedCohortId, selectedCohortLabel } = useCohort();
  const qc = useQueryClient();

  const [blockNumber, setBlockNumber] = useState<number>(1);
  const activeBlock = BLOCKS.find((b) => b.number === blockNumber)!;

  const [query, setQuery] = useState("");
  const [selectedFounderId, setSelectedFounderId] = useState<string | null>(null);
  const [form, setForm] = useState<EvalForm>(emptyEval());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<Evaluation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newTargetLabel, setNewTargetLabel] = useState("");

  // Founders in selected cohort
  const { data: founders = [], isLoading: foundersLoading } = useQuery({
    queryKey: ["eval-founders", selectedCohortId],
    queryFn: async () => {
      let q = supabase
        .from("founders")
        .select("id, founder_name, startup_name, cohort_id, is_archived")
        .eq("is_archived", false);
      if (selectedCohortId !== ALL_COHORTS) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q.order("startup_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<Founder, "id" | "founder_name" | "startup_name" | "cohort_id" | "is_archived">[];
    },
  });

  const founderIds = useMemo(() => founders.map((f) => f.id), [founders]);

  // All evaluations for this block × these founders (used for badges in the left rail)
  const { data: blockEvals = [] } = useQuery({
    queryKey: ["eval-block-evals", founderIds.join(","), blockNumber],
    enabled: founderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_evaluations")
        .select("*")
        .in("founder_id", founderIds)
        .eq("block_number", blockNumber)
        .eq("is_archived", false)
        .order("evaluation_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Evaluation[];
    },
  });

  const latestByFounder = useMemo(() => {
    const m = new Map<string, Evaluation>();
    for (const e of blockEvals) if (!m.has(e.founder_id)) m.set(e.founder_id, e);
    return m;
  }, [blockEvals]);

  const filteredFounders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? founders.filter(
          (f) =>
            (f.founder_name ?? "").toLowerCase().includes(q) ||
            (f.startup_name ?? "").toLowerCase().includes(q),
        )
      : founders;
  }, [founders, query]);

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

  // Evidence: check-ins for the selected founder
  const { data: checkins = [] } = useQuery({
    queryKey: ["eval-checkins", selectedFounderId],
    enabled: !!selectedFounderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_checkins")
        .select("*")
        .eq("founder_id", selectedFounderId!)
        .eq("is_archived", false)
        .order("checkin_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Checkin[];
    },
  });

  const evidence = useMemo(() => {
    if (!checkins.length) return null;
    const dims = ["product", "team", "traction", "market", "funding"] as const;
    const avgs = dims.map((k) => {
      const vals = checkins
        .map((c) => (c[`${k}_rating` as keyof Checkin] as number | null))
        .filter((v): v is number => typeof v === "number" && v > 0);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { key: k, label: k.charAt(0).toUpperCase() + k.slice(1), avg };
    });
    const latestSignal = checkins[0]?.effort_signal ?? null;
    // effort trend: strong=4 steady=3 coasting=2 at_risk=1
    const map: Record<string, number> = { strong: 4, steady: 3, coasting: 2, at_risk: 1 };
    const recent = checkins.slice(0, 3).map((c) => map[c.effort_signal ?? ""] ?? 0).filter(Boolean);
    const older = checkins.slice(3, 6).map((c) => map[c.effort_signal ?? ""] ?? 0).filter(Boolean);
    const trendVal =
      recent.length && older.length
        ? recent.reduce((a, b) => a + b, 0) / recent.length - older.reduce((a, b) => a + b, 0) / older.length
        : 0;
    return {
      count: checkins.length,
      latestDate: checkins[0]?.checkin_date ?? null,
      latestSignal,
      avgs,
      trend: trendVal > 0.3 ? "up" : trendVal < -0.3 ? "down" : "flat",
    };
  }, [checkins]);

  // Timeline of evaluations for the selected founder
  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ["eval-timeline", selectedFounderId, showArchived],
    enabled: !!selectedFounderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_evaluations")
        .select("*")
        .eq("founder_id", selectedFounderId!)
        .eq("is_archived", showArchived)
        .order("evaluation_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Evaluation[];
    },
  });

  // Reset form when founder or block changes
  useEffect(() => {
    setEditingId(null);
    setForm(emptyEval(blockNumber, activeBlock.name));
    setExpanded(new Set());
    setNewTargetLabel("");
  }, [selectedFounderId, blockNumber, activeBlock.name]);

  const overall = meanOf(form.dimension_scores);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFounder) throw new Error("No founder selected");
      if (!form.decision) throw new Error("Please choose a decision");
      const total = overall != null ? Math.round(overall * 20) : null; // 5 → 100 scale
      const payload = {
        founder_id: selectedFounder.id,
        block_number: form.block_number,
        block_name: form.block_name,
        evaluation_date: form.evaluation_date,
        dimension_scores: form.dimension_scores as any,
        absolute_targets: form.absolute_targets as any,
        decision: form.decision,
        summary_note: form.summary_note || null,
        total_score: total,
      };
      if (editingId) {
        const { error } = await supabase.from("founder_evaluations").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("founder_evaluations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Evaluation updated" : "Evaluation recorded");
      setForm(emptyEval(blockNumber, activeBlock.name));
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["eval-timeline"] });
      qc.invalidateQueries({ queryKey: ["eval-block-evals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("founder_evaluations")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evaluation archived");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["eval-timeline"] });
      qc.invalidateQueries({ queryKey: ["eval-block-evals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to archive"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("founder_evaluations")
        .update({ is_archived: false, archived_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evaluation restored");
      qc.invalidateQueries({ queryKey: ["eval-timeline"] });
      qc.invalidateQueries({ queryKey: ["eval-block-evals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to restore"),
  });

  function beginEdit(e: Evaluation) {
    setEditingId(e.id);
    setForm({
      block_number: e.block_number ?? blockNumber,
      block_name: e.block_name ?? activeBlock.name,
      evaluation_date: e.evaluation_date ?? new Date().toISOString().split("T")[0],
      dimension_scores: toDimScores(e.dimension_scores),
      absolute_targets: toTargets(e.absolute_targets),
      decision: (e.decision as Decision) || "",
      summary_note: e.summary_note ?? "",
    });
    // switch block context if needed
    if (e.block_number && e.block_number !== blockNumber) {
      setBlockNumber(e.block_number);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyEval(blockNumber, activeBlock.name));
  }

  function toggleExpanded(id: string) {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function updateDim(key: DimKey, patch: Partial<DimensionScore>) {
    setForm((f) => ({
      ...f,
      dimension_scores: { ...f.dimension_scores, [key]: { ...f.dimension_scores[key], ...patch } },
    }));
  }

  function addTarget() {
    const label = newTargetLabel.trim();
    if (!label) return;
    setForm((f) => ({
      ...f,
      absolute_targets: [
        ...f.absolute_targets,
        { id: crypto.randomUUID(), label, met: false },
      ],
    }));
    setNewTargetLabel("");
  }

  function toggleTarget(id: string) {
    setForm((f) => ({
      ...f,
      absolute_targets: f.absolute_targets.map((t) => (t.id === id ? { ...t, met: !t.met } : t)),
    }));
  }

  function removeTarget(id: string) {
    setForm((f) => ({
      ...f,
      absolute_targets: f.absolute_targets.filter((t) => t.id !== id),
    }));
  }

  // === Render ===

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Founders · Evaluations
            </div>
            <h1 className="mt-1 text-[26px] font-semibold text-[#1D1D1F] tracking-tight">
              End-of-Block Evaluations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Formal decision reviews for {selectedCohortLabel}. Backed by check-in evidence.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Block
            </Label>
            <Select value={String(blockNumber)} onValueChange={(v) => setBlockNumber(Number(v))}>
              <SelectTrigger className="h-9 w-[220px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCKS.map((b) => (
                  <SelectItem key={b.number} value={String(b.number)}>
                    {b.name} · {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {foundersLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-black/[0.03] animate-pulse" />
                  ))}
                </div>
              ) : filteredFounders.length === 0 ? (
                <div className="p-10 text-center">
                  <UsersIcon className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-[#1D1D1F]">
                    No founders in this cohort
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Switch cohorts from the global selector above.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {filteredFounders.map((f) => {
                    const latest = latestByFounder.get(f.id);
                    const isSelected = f.id === selectedFounderId;
                    const dec = latest?.decision as Decision | null | undefined;
                    const decMeta = dec ? DECISIONS.find((d) => d.value === dec) : null;
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedFounderId(f.id)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                            isSelected ? "bg-[#0071E3]/[0.06]" : "hover:bg-black/[0.02]",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                              isSelected ? "bg-[#0071E3] text-white" : "bg-black/[0.05] text-[#1D1D1F]",
                            )}
                          >
                            {initials(f.startup_name || f.founder_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-[#1D1D1F]">
                              {f.startup_name || "—"}
                            </div>
                            <div className="truncate text-[11.5px] text-muted-foreground">
                              {f.founder_name || "—"}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {latest ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Done
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <Circle className="h-2.5 w-2.5" />
                                Pending
                              </span>
                            )}
                            {decMeta && (
                              <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", decMeta.tone)}>
                                <span className={cn("h-1.5 w-1.5 rounded-full", decMeta.dot)} />
                                {decMeta.label}
                              </span>
                            )}
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
              <div className="rounded-2xl border border-black/5 bg-white p-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <ClipboardCheck className="mx-auto h-6 w-6 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-[#1D1D1F]">
                  Select a founder to begin
                </p>
              </div>
            ) : (
              <>
                {/* Founder header */}
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {activeBlock.name} · {activeBlock.label}
                    </div>
                    <h2 className="mt-1 text-[22px] font-semibold text-[#1D1D1F] tracking-tight">
                      {selectedFounder.startup_name || "—"}
                    </h2>
                    <p className="text-sm text-muted-foreground">{selectedFounder.founder_name}</p>
                  </div>
                  {editingId && (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                      Editing existing evaluation
                    </Badge>
                  )}
                </div>

                {/* Evidence summary */}
                <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#0071E3]" />
                      <h3 className="text-sm font-semibold text-[#1D1D1F]">Evidence summary</h3>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      From check-ins · read-only
                    </div>
                  </div>

                  {!evidence ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No check-ins yet for this founder.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                      <div className="col-span-2 lg:col-span-1">
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Check-ins</div>
                        <div className="mt-1 text-2xl font-semibold text-[#1D1D1F]">{evidence.count}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Latest {evidence.latestDate ? format(parseISO(evidence.latestDate), "MMM d, yyyy") : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Latest effort</div>
                        <div className="mt-1 text-sm font-medium text-[#1D1D1F]">
                          {evidence.latestSignal ? EFFORT_LABEL[evidence.latestSignal] ?? "—" : "—"}
                        </div>
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <TrendingUp className={cn(
                            "h-3 w-3",
                            evidence.trend === "up" && "text-emerald-600",
                            evidence.trend === "down" && "rotate-180 text-rose-600",
                            evidence.trend === "flat" && "text-muted-foreground",
                          )} />
                          Trend {evidence.trend}
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        {evidence.avgs.map((a) => (
                          <div key={a.key} className="flex items-center gap-2">
                            <div className="w-16 text-[11px] text-muted-foreground">{a.label}</div>
                            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full bg-[#0071E3]"
                                style={{ width: `${((a.avg ?? 0) / 5) * 100}%` }}
                              />
                            </div>
                            <div className="w-10 text-right text-[11px] font-medium text-[#1D1D1F]">
                              {a.avg != null ? a.avg.toFixed(1) : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Scoring workspace */}
                <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#0071E3]" />
                      <h3 className="text-sm font-semibold text-[#1D1D1F]">Nine-dimension score</h3>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Overall {overall != null ? overall.toFixed(2) : "—"} / 5
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <DimensionGroup
                      label="Startup"
                      dims={STARTUP_DIMS as any}
                      scores={form.dimension_scores}
                      onUpdate={updateDim}
                    />
                    <DimensionGroup
                      label="Founder"
                      dims={FOUNDER_DIMS as any}
                      scores={form.dimension_scores}
                      onUpdate={updateDim}
                    />
                  </div>
                </div>

                {/* Absolute targets */}
                <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#0071E3]" />
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">Absolute targets</h3>
                  </div>

                  {form.absolute_targets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Add binary milestones this block hinges on (e.g. "MVP live", "First paying customer").
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {form.absolute_targets.map((t) => (
                        <li key={t.id} className="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-black/[0.015] px-3 py-2">
                          <Checkbox
                            checked={t.met}
                            onCheckedChange={() => toggleTarget(t.id)}
                            id={`target-${t.id}`}
                          />
                          <label
                            htmlFor={`target-${t.id}`}
                            className={cn(
                              "flex-1 text-sm cursor-pointer",
                              t.met ? "text-muted-foreground line-through" : "text-[#1D1D1F]",
                            )}
                          >
                            {t.label}
                          </label>
                          <span className={cn(
                            "text-[10.5px] font-medium",
                            t.met ? "text-emerald-700" : "text-muted-foreground",
                          )}>
                            {t.met ? "Met" : "Not met"}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeTarget(t.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove target"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      value={newTargetLabel}
                      onChange={(e) => setNewTargetLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTarget();
                        }
                      }}
                      placeholder="Add a target…"
                      className="h-9 text-sm"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addTarget} className="h-9">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* Decision */}
                <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#0071E3]" />
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">Decision</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {DECISIONS.map((d) => {
                      const selected = form.decision === d.value;
                      const Icon = d.icon;
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, decision: d.value }))}
                          className={cn(
                            "group relative rounded-xl border-2 px-4 py-4 text-left transition-all",
                            selected
                              ? `${d.ring} ring-2 shadow-sm`
                              : "border-black/[0.08] bg-white hover:border-black/20",
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className={cn("flex items-center gap-2 text-sm font-semibold", selected ? d.tone : "text-[#1D1D1F]")}>
                                <Icon className="h-4 w-4" />
                                {d.label}
                              </div>
                              <div className="mt-1 text-[11.5px] text-muted-foreground">
                                {d.value === "stay" && "Continue in program"}
                                {d.value === "at_risk" && "Continue with concerns"}
                                {d.value === "exit" && "Recommend removal"}
                              </div>
                            </div>
                            {selected && <CheckCircle2 className={cn("h-4 w-4", d.tone)} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
                    <div>
                      <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={form.evaluation_date}
                        onChange={(e) => setForm((f) => ({ ...f, evaluation_date: e.target.value }))}
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Summary note</Label>
                      <Textarea
                        value={form.summary_note}
                        onChange={(e) => setForm((f) => ({ ...f, summary_note: e.target.value }))}
                        placeholder="Rationale for the decision, evidence, next steps…"
                        className="mt-1 min-h-[90px] text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2">
                    {editingId && (
                      <Button type="button" variant="ghost" onClick={cancelEdit} className="h-9">
                        Cancel edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending || !form.decision}
                      className="h-9 bg-[#0071E3] hover:bg-[#0060c0]"
                    >
                      {saveMutation.isPending
                        ? "Saving…"
                        : editingId
                        ? "Update evaluation"
                        : "Record evaluation"}
                    </Button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-[#0071E3]" />
                      <h3 className="text-sm font-semibold text-[#1D1D1F]">
                        {showArchived ? "Archived evaluations" : "Evaluation history"}
                      </h3>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowArchived((v) => !v)}
                      className="h-8 text-xs"
                    >
                      {showArchived ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          Show active
                        </>
                      ) : (
                        <>
                          <Archive className="h-3.5 w-3.5 mr-1.5" />
                          Show archived
                        </>
                      )}
                    </Button>
                  </div>

                  {timelineLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-14 animate-pulse rounded-lg bg-black/[0.03]" />
                      ))}
                    </div>
                  ) : timeline.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {showArchived
                        ? "No archived evaluations."
                        : "No evaluations yet for this founder."}
                    </div>
                  ) : (
                    <ul className="divide-y divide-black/5">
                      {timeline.map((e) => {
                        const dec = DECISIONS.find((d) => d.value === e.decision);
                        const isOpen = expanded.has(e.id);
                        const dims = toDimScores(e.dimension_scores);
                        const targets = toTargets(e.absolute_targets);
                        return (
                          <li key={e.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(e.id)}
                                className="text-muted-foreground hover:text-[#1D1D1F]"
                                aria-label="Toggle"
                              >
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-[#1D1D1F]">
                                    {e.block_name || `Block ${e.block_number ?? "—"}`}
                                  </span>
                                  {dec && (
                                    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", dec.tone)}>
                                      <span className={cn("h-1.5 w-1.5 rounded-full", dec.dot)} />
                                      {dec.label}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11.5px] text-muted-foreground">
                                  {e.evaluation_date ? format(parseISO(e.evaluation_date), "MMM d, yyyy") : "—"} · Score {e.total_score ?? "—"}
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setViewing(e)}>
                                    <Eye className="h-3.5 w-3.5 mr-2" /> View
                                  </DropdownMenuItem>
                                  {showArchived ? (
                                    <DropdownMenuItem onClick={() => restoreMutation.mutate(e.id)}>
                                      <RotateCcw className="h-3.5 w-3.5 mr-2" /> Restore
                                    </DropdownMenuItem>
                                  ) : (
                                    <>
                                      <DropdownMenuItem onClick={() => beginEdit(e)}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => setDeleteId(e.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {isOpen && (
                              <div className="ml-7 mt-3 space-y-3 rounded-lg bg-black/[0.02] p-3">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 md:grid-cols-3">
                                  {ALL_DIMS.map((d) => (
                                    <div key={d.key} className="flex items-center justify-between text-[12px]">
                                      <span className="text-muted-foreground">{d.label}</span>
                                      <span className="font-medium text-[#1D1D1F]">
                                        {dims[d.key]?.rating || "—"}/5
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {targets.length > 0 && (
                                  <div className="border-t border-black/5 pt-2">
                                    <div className="mb-1 text-[10.5px] uppercase tracking-widest text-muted-foreground">
                                      Targets
                                    </div>
                                    <ul className="space-y-0.5">
                                      {targets.map((t) => (
                                        <li key={t.id} className="flex items-center gap-2 text-[12px]">
                                          {t.met ? (
                                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                          ) : (
                                            <Circle className="h-3 w-3 text-muted-foreground" />
                                          )}
                                          <span className={cn(t.met ? "text-muted-foreground line-through" : "text-[#1D1D1F]")}>
                                            {t.label}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {e.summary_note && (
                                  <div className="border-t border-black/5 pt-2 text-[12px] text-[#1D1D1F] whitespace-pre-wrap">
                                    {e.summary_note}
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
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {viewing?.block_name || "Evaluation"} ·{" "}
              {viewing?.evaluation_date ? format(parseISO(viewing.evaluation_date), "MMM d, yyyy") : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Read-only view of this evaluation record.
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const dec = DECISIONS.find((d) => d.value === viewing.decision);
                  if (!dec) return <span className="text-sm text-muted-foreground">No decision</span>;
                  const Icon = dec.icon;
                  return (
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", dec.ring, dec.tone)}>
                      <Icon className="h-3.5 w-3.5" />
                      {dec.label}
                    </span>
                  );
                })()}
                <span className="text-sm text-muted-foreground">
                  Total {viewing.total_score ?? "—"} / 100
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 md:grid-cols-3 text-sm">
                {ALL_DIMS.map((d) => {
                  const dims = toDimScores(viewing.dimension_scores);
                  return (
                    <div key={d.key} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="font-medium">{dims[d.key]?.rating || "—"}/5</span>
                    </div>
                  );
                })}
              </div>

              {toTargets(viewing.absolute_targets).length > 0 && (
                <div>
                  <div className="mb-1 text-[10.5px] uppercase tracking-widest text-muted-foreground">Targets</div>
                  <ul className="space-y-0.5 text-sm">
                    {toTargets(viewing.absolute_targets).map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        {t.met ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={cn(t.met && "text-muted-foreground line-through")}>{t.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {viewing.summary_note && (
                <div className="rounded-lg bg-black/[0.02] p-3 text-sm whitespace-pre-wrap">
                  {viewing.summary_note}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && archiveMutation.mutate(deleteId)}
        title="Archive evaluation?"
        description="This evaluation will be moved to the archived list. You can restore it later."
      />
    </div>
  );
}

function DimensionGroup({
  label,
  dims,
  scores,
  onUpdate,
}: {
  label: string;
  dims: { key: DimKey; label: string }[];
  scores: Record<DimKey, DimensionScore>;
  onUpdate: (key: DimKey, patch: Partial<DimensionScore>) => void;
}) {
  return (
    <div>
      <div className="mb-3 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="space-y-3">
        {dims.map((d) => {
          const s = scores[d.key];
          return (
            <div key={d.key} className="rounded-lg border border-black/[0.06] bg-black/[0.015] p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-[#1D1D1F]">{d.label}</div>
                <StarRating value={s.rating} onChange={(v) => onUpdate(d.key, { rating: v })} size={16} />
              </div>
              <Input
                value={s.note}
                onChange={(e) => onUpdate(d.key, { note: e.target.value })}
                placeholder="Optional note…"
                className="mt-2 h-8 border-transparent bg-white text-xs focus-visible:border-input"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
