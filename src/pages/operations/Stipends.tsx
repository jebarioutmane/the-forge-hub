import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useFounderSensitiveMap } from "@/hooks/useFounderSensitive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Download, Trash2, Pencil, DollarSign, Users, CheckCircle, Clock, Zap, MoreHorizontal, Eye, Copy, Plus, Link as LinkIcon, ExternalLink, AlertTriangle, ArchiveRestore, History, Wallet } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import { formatUrl } from "@/lib/formatUrl";
import type { Tables } from "@/integrations/supabase/types";

type StipendRecord = Tables<"stipend_records">;
type StipendLink = { title: string; url: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currentYear = new Date().getFullYear();
const currentMonthIndex = new Date().getMonth();
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";

function calcNet(base: number, dedPct: number, dedFixed: number, addPct: number, addFixed: number, reimb: number) {
  return (base * (1 - dedPct / 100) - dedFixed) + (base * (addPct / 100) + addFixed) + reimb;
}

function maskRib(rib: string): string {
  if (!rib || rib.length <= 4) return rib;
  return "*".repeat(rib.length - 4) + rib.slice(-4);
}

function parseLinks(raw: any): StipendLink[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as StipendLink[];
  try { return JSON.parse(raw); } catch { return []; }
}

export default function Stipends() {
  const { user } = useAuth();
  const { canEdit, canDelete, canSeeSensitive } = usePermissions();
  const mayEdit = canEdit("stipends");
  const mayDelete = canDelete("stipends");
  const maySeeRib = canSeeSensitive("stipends");
  const queryClient = useQueryClient();

  const { data: founders = [] } = useQuery({
    queryKey: ["founders-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name, cohort_year")
        .order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  // RIBs live in the internal-only `founder_sensitive` table.
  const { data: sensitiveMap } = useFounderSensitiveMap(maySeeRib);

  const { selectedCohortId, selectedCohortLabel, isLoading: cohortLoading } = useCohort();
  const isAllCohorts = selectedCohortId === ALL_COHORTS;
  const cohortYear = isAllCohorts ? "" : selectedCohortLabel;

  const [paymentMonth, setPaymentMonth] = useState(MONTHS[currentMonthIndex]);

  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<StipendRecord | null>(null);
  const [editForm, setEditForm] = useState({
    base_amount: "",
    deduction_percent: "",
    deduction_fixed: "",
    addition_percent: "",
    addition_fixed: "",
    reimbursement: "",
    notes: "",
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [viewing, setViewing] = useState<StipendRecord | null>(null);
  const [bulkBaseOpen, setBulkBaseOpen] = useState(false);
  const [bulkBaseAmount, setBulkBaseAmount] = useState("12000");
  const [showRisk, setShowRisk] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedBudgetLineId, setSelectedBudgetLineId] = useState<string>("");
  const [bulkStatusTarget, setBulkStatusTarget] = useState<"pending" | "approved" | "paid" | "">("");
  const [bulkStatusConfirmOpen, setBulkStatusConfirmOpen] = useState(false);

  const cohortFounders = useMemo(
    () => founders.filter((f) => f.cohort_year === cohortYear),
    [founders, cohortYear]
  );

  const monthKey = `${paymentMonth} ${cohortYear}`;

  // Resolve current cohort_id (uuid) from the label for budget_lines / engagement.
  const { data: cohortRow } = useQuery({
    queryKey: ["cohort-by-label", cohortYear],
    queryFn: async () => {
      const { data, error } = await supabase.from("cohorts").select("id,label").eq("label", cohortYear).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const cohortId = cohortRow?.id ?? null;

  const { data: budgetLines = [] } = useQuery({
    queryKey: ["budget_lines-for-stipends", cohortId],
    enabled: !!cohortId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_lines")
        .select("id,name,cohort_id,allocated_amount,is_archived")
        .eq("cohort_id", cohortId as string)
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select default 'Stipends' line (or first) when the list arrives / cohort changes.
  useMemo(() => {
    if (!budgetLines.length) { if (selectedBudgetLineId) setSelectedBudgetLineId(""); return; }
    const stillValid = budgetLines.some((b: any) => b.id === selectedBudgetLineId);
    if (stillValid) return;
    const stipendsLine = budgetLines.find((b: any) => (b.name || "").trim().toLowerCase() === "stipends");
    setSelectedBudgetLineId((stipendsLine || budgetLines[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetLines, cohortId]);

  const { data: engagement = [] } = useQuery({
    queryKey: ["founder_engagement-for-stipends", cohortId],
    enabled: !!cohortId && showRisk,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_engagement" as any)
        .select("founder_id,risk_status,attendance_rate")
        .eq("cohort_id", cohortId as string);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  const engagementByFounder = useMemo(() => {
    const m = new Map<string, { risk_status: string | null; attendance_rate: number | null }>();
    engagement.forEach((e: any) => m.set(e.founder_id, { risk_status: e.risk_status, attendance_rate: e.attendance_rate }));
    return m;
  }, [engagement]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["stipend_records", cohortYear, paymentMonth, showArchived],
    queryFn: async () => {
      let q = supabase
        .from("stipend_records")
        .select("*")
        .eq("cohort_year", cohortYear)
        .eq("payment_month", monthKey);
      if (!showArchived) q = q.eq("is_archived", false);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Previous-month lookup for carry-forward base only. We look at every prior month
  // for this cohort and take each founder's most recent base.
  const { data: priorMonthMeta } = useQuery({
    queryKey: ["stipend_records-prev-for-carry", cohortYear, paymentMonth],
    enabled: records.length === 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stipend_records")
        .select("founder_id,payment_month,base_amount,created_at")
        .eq("cohort_year", cohortYear)
        .eq("is_archived", false)
        .neq("payment_month", monthKey)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Reduce to latest per founder.
      const latest = new Map<string, { base: number; month: string }>();
      (data || []).forEach((r: any) => {
        if (!r.founder_id) return;
        if (!latest.has(r.founder_id)) latest.set(r.founder_id, { base: Number(r.base_amount) || 0, month: r.payment_month });
      });
      // pick the most common source month (best label)
      const monthCounts = new Map<string, number>();
      latest.forEach((v) => monthCounts.set(v.month, (monthCounts.get(v.month) || 0) + 1));
      let sourceMonth: string | null = null;
      let best = 0;
      monthCounts.forEach((n, m) => { if (n > best) { best = n; sourceMonth = m; } });
      return { latest, sourceMonth };
    },
  });

  const recordsByFounder = useMemo(() => {
    const map = new Map<string, StipendRecord>();
    records.forEach((r) => { if (r.founder_id) map.set(r.founder_id, r); });
    return map;
  }, [records]);

  const getFounderName = useCallback(
    (id: string | null) => {
      if (!id) return "—";
      const f = founders.find((x) => x.id === id);
      return f ? f.founder_name : "—";
    },
    [founders]
  );

  const getStartupName = useCallback(
    (id: string | null) => {
      if (!id) return "";
      const f = founders.find((x) => x.id === id);
      return f ? f.startup_name : "";
    },
    [founders]
  );

  const getRib = useCallback(
    (id: string | null) => {
      if (!id) return "";
      return sensitiveMap?.get(id)?.rib_number || "";
    },
    [sensitiveMap]
  );

  const initMutation = useMutation({
    mutationFn: async (founderId: string) => {
      const base = 12000;
      const { error } = await supabase.from("stipend_records").insert({
        founder_id: founderId,
        cohort_year: cohortYear,
        payment_month: monthKey,
        base_amount: base,
        deduction_percent: 0,
        deduction_fixed: 0,
        addition_percent: 0,
        addition_fixed: 0,
        reimbursement: 0,
        total_net: base,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      toast.success("Record initialized");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recordsQueryKey = ["stipend_records", cohortYear, paymentMonth, showArchived] as const;

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const rec = records.find((r) => r.id === id);
      if (!rec) return;
      const updated = { ...rec, [field]: value };
      const net = calcNet(
        Number(updated.base_amount) || 0,
        Number(updated.deduction_percent) || 0,
        Number(updated.deduction_fixed) || 0,
        Number(updated.addition_percent) || 0,
        Number(updated.addition_fixed) || 0,
        Number(updated.reimbursement) || 0
      );
      const { error } = await supabase
        .from("stipend_records")
        .update({ [field]: value, total_net: net } as any)
        .eq("id", id);
      if (error) throw error;
    },
    // Optimistic: patch cache immediately so Net + KPIs update live without waiting on the roundtrip.
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: recordsQueryKey });
      const prev = queryClient.getQueryData<StipendRecord[]>(recordsQueryKey);
      if (prev) {
        queryClient.setQueryData<StipendRecord[]>(recordsQueryKey, prev.map((r) => {
          if (r.id !== id) return r;
          const updated: any = { ...r, [field]: value };
          updated.total_net = calcNet(
            Number(updated.base_amount) || 0,
            Number(updated.deduction_percent) || 0,
            Number(updated.deduction_fixed) || 0,
            Number(updated.addition_percent) || 0,
            Number(updated.addition_fixed) || 0,
            Number(updated.reimbursement) || 0
          );
          return updated;
        }));
      }
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(recordsQueryKey, ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
    },
  });

  // Status flow is manual. When moving into "paid" we also stamp paid_at and
  // attach the currently selected budget line so the Budget Dashboard rolls it up.
  const setStatusMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
      const patch: any = { status: next };
      if (next === "paid") {
        patch.paid_at = new Date().toISOString();
        if (selectedBudgetLineId) patch.budget_line_id = selectedBudgetLineId;
      } else {
        // Reversing a payment: clear paid_at / budget link so it stops counting against budget.
        patch.paid_at = null;
        patch.budget_line_id = null;
      }
      const { error } = await supabase.from("stipend_records").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      if (v.next === "paid" && !selectedBudgetLineId) {
        toast.warning("Marked Paid, but no budget line selected — won't count against budget.");
      } else {
        toast.success(`Marked ${v.next}`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = (rec: StipendRecord) => {
    const order = ["pending", "approved", "paid"];
    const idx = order.indexOf(rec.status || "pending");
    const next = order[(idx + 1) % order.length];
    setStatusMutation.mutate({ id: rec.id, next });
  };

  // Bulk status action: apply the SAME per-row logic (paid_at + budget_line_id stamping
  // on Paid; cleared when moved out of Paid) to every currently visible record.
  const bulkStatusMutation = useMutation({
    mutationFn: async (next: "pending" | "approved" | "paid") => {
      const visibleIds = records.filter((r) => !r.is_archived).map((r) => r.id);
      if (!visibleIds.length) return 0;
      const patch: any = { status: next };
      if (next === "paid") {
        patch.paid_at = new Date().toISOString();
        if (selectedBudgetLineId) patch.budget_line_id = selectedBudgetLineId;
      } else {
        patch.paid_at = null;
        patch.budget_line_id = null;
      }
      const { error } = await supabase.from("stipend_records").update(patch).in("id", visibleIds);
      if (error) throw error;
      return visibleIds.length;
    },
    onSuccess: (n, next) => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setBulkStatusConfirmOpen(false);
      setBulkStatusTarget("");
      if (next === "paid" && !selectedBudgetLineId) {
        toast.warning(`Marked ${n} record${n === 1 ? "" : "s"} Paid, but no budget line selected — won't count against budget.`);
      } else {
        toast.success(`Marked ${n} record${n === 1 ? "" : "s"} ${next}`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!editRecord) return;
      const base = Number(editForm.base_amount) || 0;
      const net = calcNet(
        base,
        Number(editForm.deduction_percent) || 0,
        Number(editForm.deduction_fixed) || 0,
        Number(editForm.addition_percent) || 0,
        Number(editForm.addition_fixed) || 0,
        Number(editForm.reimbursement) || 0
      );
      const { error } = await supabase.from("stipend_records").update({
        base_amount: base,
        deduction_percent: Number(editForm.deduction_percent) || 0,
        deduction_fixed: Number(editForm.deduction_fixed) || 0,
        addition_percent: Number(editForm.addition_percent) || 0,
        addition_fixed: Number(editForm.addition_fixed) || 0,
        reimbursement: Number(editForm.reimbursement) || 0,
        total_net: net,
        notes: editForm.notes || null,
      }).eq("id", editRecord.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      setEditOpen(false);
      setEditRecord(null);
      toast.success("Record updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Soft-delete: mark archived instead of hard delete. Restore is available via the Archived toggle.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const rec = records.find((r) => r.id === id);
      const archiving = !rec?.is_archived;
      const { error } = await supabase
        .from("stipend_records")
        .update({ is_archived: archiving, archived_at: archiving ? new Date().toISOString() : null } as any)
        .eq("id", id);
      if (error) throw error;
      return archiving;
    },
    onSuccess: (archiving) => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      setDeleteId(null);
      toast.success(archiving ? "Record archived" : "Record restored");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = records.filter((r) => !r.is_archived).map((r) => r.id);
      if (!ids.length) return;
      const { error } = await supabase
        .from("stipend_records")
        .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      setBulkDeleteOpen(false);
      toast.success("All records for this month archived");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkBaseMutation = useMutation({
    mutationFn: async () => {
      const base = Number(bulkBaseAmount) || 0;
      if (!records.length) return;
      for (const rec of records) {
        const net = calcNet(
          base,
          Number(rec.deduction_percent) || 0,
          Number(rec.deduction_fixed) || 0,
          Number(rec.addition_percent) || 0,
          Number(rec.addition_fixed) || 0,
          Number(rec.reimbursement) || 0
        );
        await supabase.from("stipend_records").update({ base_amount: base, total_net: net }).eq("id", rec.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      setBulkBaseOpen(false);
      toast.success("Base stipend applied to all");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Apply links from first record to all others
  const applyLinksToAllMutation = useMutation({
    mutationFn: async () => {
      if (records.length < 2) return;
      const firstRec = records[0];
      const links = firstRec.stipend_links || [];
      for (let i = 1; i < records.length; i++) {
        await supabase.from("stipend_records").update({ stipend_links: links }).eq("id", records[i].id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      toast.success("Links applied to all founders");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const initAllMutation = useMutation({
    mutationFn: async () => {
      const missing = cohortFounders.filter((f) => !recordsByFounder.has(f.id));
      if (!missing.length) return;
      const base = 12000;
      const rows = missing.map((f) => ({
        founder_id: f.id,
        cohort_year: cohortYear,
        payment_month: monthKey,
        base_amount: base,
        deduction_percent: 0,
        deduction_fixed: 0,
        addition_percent: 0,
        addition_fixed: 0,
        reimbursement: 0,
        total_net: base,
        status: "pending",
      }));
      const { error } = await supabase.from("stipend_records").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      toast.success("All founders initialized");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Carry-forward BASE only from each founder's most recent prior month.
  // Explicit action — never automatic. Deductions / additions / reimbursement reset to 0.
  const carryForwardMutation = useMutation({
    mutationFn: async () => {
      const latest = priorMonthMeta?.latest;
      if (!latest || latest.size === 0) return 0;
      const missing = cohortFounders.filter((f) => !recordsByFounder.has(f.id));
      const rows = missing
        .filter((f) => latest.has(f.id))
        .map((f) => {
          const base = latest.get(f.id)!.base || 0;
          return {
            founder_id: f.id,
            cohort_year: cohortYear,
            payment_month: monthKey,
            base_amount: base,
            deduction_percent: 0,
            deduction_fixed: 0,
            addition_percent: 0,
            addition_fixed: 0,
            reimbursement: 0,
            total_net: base,
            status: "pending",
          };
        });
      if (!rows.length) return 0;
      const { error } = await supabase.from("stipend_records").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      toast.success(n ? `Carried forward base for ${n} founder${n === 1 ? "" : "s"}` : "Nothing to carry forward");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Update links for a single record
  const updateLinksMutation = useMutation({
    mutationFn: async ({ id, links }: { id: string; links: StipendLink[] }) => {
      const { error } = await supabase.from("stipend_records").update({ stipend_links: links as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(rec: StipendRecord) {
    setEditRecord(rec);
    setEditForm({
      base_amount: String(rec.base_amount || 0),
      deduction_percent: String(rec.deduction_percent || 0),
      deduction_fixed: String(rec.deduction_fixed || 0),
      addition_percent: String(rec.addition_percent || 0),
      addition_fixed: String(rec.addition_fixed || 0),
      reimbursement: String(rec.reimbursement || 0),
      notes: rec.notes || "",
    });
    setEditOpen(true);
  }

  const editNet = useMemo(() => {
    return calcNet(
      Number(editForm.base_amount) || 0,
      Number(editForm.deduction_percent) || 0,
      Number(editForm.deduction_fixed) || 0,
      Number(editForm.addition_percent) || 0,
      Number(editForm.addition_fixed) || 0,
      Number(editForm.reimbursement) || 0
    );
  }, [editForm]);

  const totalDisbursement = records.reduce((sum, r) => sum + (Number(r.total_net) || 0), 0);
  const paidCount = records.filter((r) => r.status === "paid").length;
  const pendingCount = records.filter((r) => r.status === "pending").length;
  const approvedCount = records.filter((r) => r.status === "approved").length;
  const uninitializedCount = cohortFounders.filter((f) => !recordsByFounder.has(f.id)).length;

  function exportCSV() {
    const headers = ["Founder", "Startup", "RIB", "Base", "Ded%", "DedFixed", "Add%", "AddFixed", "Reimb", "Net", "Status"];
    const rows = records.map((r) => [
      getFounderName(r.founder_id),
      getStartupName(r.founder_id),
      getRib(r.founder_id),
      r.base_amount,
      r.deduction_percent,
      r.deduction_fixed,
      r.addition_percent,
      r.addition_fixed,
      r.reimbursement,
      r.total_net,
      r.status,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stipends_${cohortYear}_${paymentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-orange-100 text-orange-700 border-0",
      approved: "bg-blue-100 text-blue-700 border-0",
      paid: "bg-emerald-100 text-emerald-700 border-0",
    };
    return styles[status] || styles.pending;
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stipends Tracker</h1>
          <p className="text-sm text-muted-foreground">Monthly financial distributions for founders</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => applyLinksToAllMutation.mutate()} disabled={records.length < 2 || applyLinksToAllMutation.isPending}>
            <LinkIcon className="mr-1 h-3.5 w-3.5" /> Apply Links to All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkBaseOpen(true)} disabled={records.length === 0}>
            <DollarSign className="mr-1 h-3.5 w-3.5" /> Apply Base to All
          </Button>
          <div className="flex items-center gap-1">
            <Select
              value={bulkStatusTarget || undefined}
              onValueChange={(v) => {
                setBulkStatusTarget(v as any);
                setBulkStatusConfirmOpen(true);
              }}
              disabled={records.filter((r) => !r.is_archived).length === 0}
            >
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Set all to…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={records.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
          </Button>
          {mayDelete && records.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete All
            </Button>
          )}
        </div>
      </div>

      {cohortLoading && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading cohort…</CardContent></Card>
      )}

      {!cohortLoading && isAllCohorts && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-900">
              Stipends are managed per cohort. Pick a specific cohort in the header to view or edit records.
            </p>
          </CardContent>
        </Card>
      )}


      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Cohort</Label>
              <Badge variant="outline" className="h-9 px-3 flex items-center text-sm font-medium">
                {isAllCohorts ? "All cohorts" : (selectedCohortLabel || "—")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Payment Month</Label>
              <Select value={paymentMonth} onValueChange={setPaymentMonth}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Budget Line</Label>
              <Select value={selectedBudgetLineId || "none"} onValueChange={(v) => setSelectedBudgetLineId(v === "none" ? "" : v)}>
                <SelectTrigger className="w-52 h-9"><SelectValue placeholder={cohortId ? "Select budget line" : "No cohort match"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None (won't draw)</SelectItem>
                  {budgetLines.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {uninitializedCount > 0 && (
              <Button size="sm" onClick={() => initAllMutation.mutate()} disabled={initAllMutation.isPending}>
                <Zap className="mr-1 h-3.5 w-3.5" /> Initialize All ({uninitializedCount})
              </Button>
            )}
            {records.length === 0 && priorMonthMeta?.latest && priorMonthMeta.latest.size > 0 && (
              <Button size="sm" variant="outline" onClick={() => carryForwardMutation.mutate()} disabled={carryForwardMutation.isPending}>
                <History className="mr-1 h-3.5 w-3.5" />
                Carry forward base{priorMonthMeta.sourceMonth ? ` from ${priorMonthMeta.sourceMonth.replace(` ${cohortYear}`, "")}` : ""}
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {cohortFounders.length} founder{cohortFounders.length !== 1 ? "s" : ""} in cohort
            </span>
          </div>
          <div className="flex items-center gap-6 pt-1 border-t">
            <label className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Switch checked={showRisk} onCheckedChange={setShowRisk} />
              <AlertTriangle className="h-3.5 w-3.5" /> Show founder risk
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              <ArchiveRestore className="h-3.5 w-3.5" /> Show archived
            </label>
            {selectedBudgetLineId && (
              <span className="text-xs text-muted-foreground pt-2 ml-auto">
                Paid stipends will draw against <span className="font-medium text-foreground">{budgetLines.find((b: any) => b.id === selectedBudgetLineId)?.name}</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Disbursement</p>
              <p className="text-lg font-bold">{totalDisbursement.toLocaleString()} MAD</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-lg font-bold">{paidCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-lg font-bold">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Founder</TableHead>
                  <TableHead className="min-w-[180px]">RIB</TableHead>
                  <TableHead className="text-right min-w-[100px]">Base (MAD)</TableHead>
                  <TableHead className="text-right min-w-[70px]">Ded %</TableHead>
                  <TableHead className="text-right min-w-[90px]">Ded Fixed</TableHead>
                  <TableHead className="text-right min-w-[70px]">Add %</TableHead>
                  <TableHead className="text-right min-w-[90px]">Add Fixed</TableHead>
                  <TableHead className="text-right min-w-[90px]">Reimb.</TableHead>
                  <TableHead className="text-right min-w-[100px] font-bold">Net Total</TableHead>
                  <TableHead className="min-w-[90px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Evidence</TableHead>
                  <TableHead className="text-right min-w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                   <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : cohortFounders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No founders found for cohort year {cohortYear}
                    </TableCell>
                  </TableRow>
                ) : (
                  cohortFounders.map((founder) => {
                    const rec = recordsByFounder.get(founder.id);
                    const rib = sensitiveMap?.get(founder.id)?.rib_number || "";
                    if (!rec) {
                      return (
                        <TableRow key={founder.id} className="bg-muted/30">
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm flex items-center gap-1.5">
                                {founder.founder_name}
                                {showRisk && <RiskBadge info={engagementByFounder.get(founder.id)} />}
                              </p>
                              <p className="text-xs text-muted-foreground">{founder.startup_name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <RibDisplay rib={rib} allowed={maySeeRib} />
                          </TableCell>
                          <TableCell colSpan={9} className="text-center text-muted-foreground text-sm">
                            No record for this month
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => initMutation.mutate(founder.id)} disabled={initMutation.isPending}>
                              Initialize
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    const liveNet = calcNet(
                      Number(rec.base_amount) || 0,
                      Number(rec.deduction_percent) || 0,
                      Number(rec.deduction_fixed) || 0,
                      Number(rec.addition_percent) || 0,
                      Number(rec.addition_fixed) || 0,
                      Number(rec.reimbursement) || 0
                    );

                    const links = parseLinks(rec.stipend_links);

                    return (
                      <TableRow key={rec.id} className={rec.is_archived ? "opacity-60" : ""}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm flex items-center gap-1.5">
                              {founder.founder_name}
                              {rec.is_archived && <Badge variant="outline" className="text-[10px] px-1 py-0">Archived</Badge>}
                              {showRisk && <RiskBadge info={engagementByFounder.get(founder.id)} />}
                            </p>
                            <p className="text-xs text-muted-foreground">{founder.startup_name}</p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <RibDisplay rib={rib} allowed={maySeeRib} />
                        </TableCell>
                        <TableCell className="text-right">
                          <InlineInput
                            value={rec.base_amount}
                            onCommit={(v) => updateFieldMutation.mutate({ id: rec.id, field: "base_amount", value: Number(v) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <InlineInput
                            value={rec.deduction_percent}
                            onCommit={(v) => updateFieldMutation.mutate({ id: rec.id, field: "deduction_percent", value: Number(v) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <InlineInput
                            value={rec.deduction_fixed}
                            onCommit={(v) => updateFieldMutation.mutate({ id: rec.id, field: "deduction_fixed", value: Number(v) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <InlineInput
                            value={rec.addition_percent}
                            onCommit={(v) => updateFieldMutation.mutate({ id: rec.id, field: "addition_percent", value: Number(v) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <InlineInput
                            value={rec.addition_fixed}
                            onCommit={(v) => updateFieldMutation.mutate({ id: rec.id, field: "addition_fixed", value: Number(v) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <InlineInput
                            value={rec.reimbursement}
                            onCommit={(v) => updateFieldMutation.mutate({ id: rec.id, field: "reimbursement", value: Number(v) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-sm">{liveNet.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`cursor-pointer select-none ${statusBadge(rec.status || "pending")}`}
                            onClick={() => toggleStatus(rec)}
                          >
                            {(rec.status || "pending").charAt(0).toUpperCase() + (rec.status || "pending").slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <LinksCell
                            links={links}
                            onUpdate={(newLinks) => updateLinksMutation.mutate({ id: rec.id, links: newLinks })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(rec)}>
                                <Eye className="mr-2 h-3 w-3" /> View
                              </DropdownMenuItem>
                              {mayEdit && (
                                <DropdownMenuItem onClick={() => openEdit(rec)}>
                                  <Pencil className="mr-2 h-3 w-3" /> Edit
                                </DropdownMenuItem>
                              )}
                              {mayDelete && (
                                <DropdownMenuItem className={rec.is_archived ? "" : "text-destructive"} onClick={() => setDeleteId(rec.id)}>
                                  {rec.is_archived ? (<><ArchiveRestore className="mr-2 h-3 w-3" /> Restore</>) : (<><Trash2 className="mr-2 h-3 w-3" /> Archive</>)}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditRecord(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Stipend — {getFounderName(editRecord?.founder_id || null)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Base Amount</Label>
                <Input type="number" value={editForm.base_amount} onChange={(e) => setEditForm((f) => ({ ...f, base_amount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reimbursement</Label>
                <Input type="number" value={editForm.reimbursement} onChange={(e) => setEditForm((f) => ({ ...f, reimbursement: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Deduction %</Label>
                <Input type="number" value={editForm.deduction_percent} onChange={(e) => setEditForm((f) => ({ ...f, deduction_percent: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deduction Fixed</Label>
                <Input type="number" value={editForm.deduction_fixed} onChange={(e) => setEditForm((f) => ({ ...f, deduction_fixed: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Addition %</Label>
                <Input type="number" value={editForm.addition_percent} onChange={(e) => setEditForm((f) => ({ ...f, addition_percent: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Addition Fixed</Label>
                <Input type="number" value={editForm.addition_fixed} onChange={(e) => setEditForm((f) => ({ ...f, addition_fixed: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground">Calculated Net Total</p>
              <p className="text-xl font-bold">{editNet.toLocaleString()} MAD</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveEditMutation.mutate()} disabled={saveEditMutation.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Base Dialog */}
      <Dialog open={bulkBaseOpen} onOpenChange={setBulkBaseOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Apply Base Stipend to All</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Base Amount (MAD)</Label>
            <Input type="number" value={bulkBaseAmount} onChange={(e) => setBulkBaseAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => bulkBaseMutation.mutate()} disabled={bulkBaseMutation.isPending}>Apply to All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onConfirm={() => bulkDeleteMutation.mutate()} onCancel={() => setBulkDeleteOpen(false)} />

      {/* Bulk status confirm */}
      <Dialog open={bulkStatusConfirmOpen} onOpenChange={(o) => { if (!o) { setBulkStatusConfirmOpen(false); setBulkStatusTarget(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set all visible records to {bulkStatusTarget || "…"}?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              This will change status on <span className="font-semibold text-foreground">{records.filter((r) => !r.is_archived).length}</span> stipend record{records.filter((r) => !r.is_archived).length === 1 ? "" : "s"} in {paymentMonth} {cohortYear}.
            </p>
            {bulkStatusTarget === "paid" && (
              selectedBudgetLineId ? (
                <p>They will be stamped as Paid now and drawn against budget line <span className="font-medium text-foreground">{budgetLines.find((b: any) => b.id === selectedBudgetLineId)?.name}</span>.</p>
              ) : (
                <p className="text-orange-600">No budget line selected — records will be marked Paid but won't count against any budget line.</p>
              )
            )}
            {bulkStatusTarget && bulkStatusTarget !== "paid" && (
              <p>Any previously stamped payment date and budget line will be cleared on these records.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkStatusConfirmOpen(false); setBulkStatusTarget(""); }}>Cancel</Button>
            <Button
              onClick={() => bulkStatusTarget && bulkStatusMutation.mutate(bulkStatusTarget)}
              disabled={!bulkStatusTarget || bulkStatusMutation.isPending}
            >
              {bulkStatusMutation.isPending ? "Applying…" : `Set all to ${bulkStatusTarget || ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* View Detail */}
      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Stipend Record Details"
        fields={viewing ? [
          { label: "Founder", value: getFounderName(viewing.founder_id) },
          { label: "Startup", value: getStartupName(viewing.founder_id) },
          { label: "RIB Number", value: (() => {
            const rib = getRib(viewing.founder_id);
            if (!rib) return "—";
            return (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{maskRib(rib)}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(rib); toast.success("Full RIB copied"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            );
          })() },
          { label: "Cohort Year", value: viewing.cohort_year },
          { label: "Payment Month", value: viewing.payment_month },
          { label: "Base Amount", value: `${Number(viewing.base_amount).toLocaleString()} MAD` },
          { label: "Deduction %", value: `${viewing.deduction_percent}%` },
          { label: "Deduction Fixed", value: `${Number(viewing.deduction_fixed).toLocaleString()} MAD` },
          { label: "Addition %", value: `${viewing.addition_percent}%` },
          { label: "Addition Fixed", value: `${Number(viewing.addition_fixed).toLocaleString()} MAD` },
          { label: "Reimbursement", value: `${Number(viewing.reimbursement).toLocaleString()} MAD` },
          { label: "Net Total", value: `${Number(viewing.total_net).toLocaleString()} MAD` },
          { label: "Status", value: (viewing.status || "pending").charAt(0).toUpperCase() + (viewing.status || "pending").slice(1) },
          { label: "Notes", value: viewing.notes || "—" },
          { label: "Evidence Links", value: (() => {
            const links = parseLinks(viewing.stipend_links);
            if (!links.length) return "—";
            return (
              <div className="space-y-1">
                {links.map((l, i) => (
                  <a key={i} href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-sm">
                    <ExternalLink className="h-3 w-3 shrink-0" /> {l.title || l.url}
                  </a>
                ))}
              </div>
            );
          })() },
        ] : []}
      />
    </div>
  );
}

/* ── RIB Display with masking ── */
function RibDisplay({ rib, allowed = true }: { rib: string; allowed?: boolean }) {
  if (!rib) return <span className="text-xs text-muted-foreground">—</span>;
  if (!allowed) {
    return <span className="text-xs italic text-muted-foreground">•••• (restricted)</span>;
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-mono truncate max-w-[150px]">{maskRib(rib)}</span>
      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(rib); toast.success("Full RIB copied"); }}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

/* ── Evidence Links Cell ── */
function LinksCell({ links, onUpdate }: { links: StipendLink[]; onUpdate: (links: StipendLink[]) => void }) {
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [popOpen, setPopOpen] = useState(false);

  const addLink = () => {
    const t = newTitle.trim();
    const u = newUrl.trim();
    if (!u) { toast.error("URL is required"); return; }
    onUpdate([...links, { title: t || u, url: u }]);
    setNewTitle("");
    setNewUrl("");
  };

  const removeLink = (idx: number) => {
    onUpdate(links.filter((_, i) => i !== idx));
  };

  if (links.length === 0) {
    return (
      <Popover open={popOpen} onOpenChange={setPopOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
            <Plus className="h-3 w-3" /> Add
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-2" align="start">
          <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-7 text-xs" />
          <Input placeholder="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="h-7 text-xs" />
          <Button size="sm" className="w-full h-7 text-xs" onClick={addLink}>Add Link</Button>
        </PopoverContent>
      </Popover>
    );
  }

  if (links.length <= 2) {
    return (
      <div className="space-y-1">
        {links.map((l, i) => (
          <div key={i} className="flex items-center gap-1">
            <a href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[80px]">
              {l.title || l.url}
            </a>
            <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => removeLink(i)}>
              <Trash2 className="h-2.5 w-2.5 text-destructive" />
            </Button>
          </div>
        ))}
        <Popover open={popOpen} onOpenChange={setPopOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] gap-0.5">
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 space-y-2" align="start">
            <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-7 text-xs" />
            <Input placeholder="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="h-7 text-xs" />
            <Button size="sm" className="w-full h-7 text-xs" onClick={addLink}>Add Link</Button>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // More than 2 links: show badge that opens popover
  return (
    <Popover open={popOpen} onOpenChange={setPopOpen}>
      <PopoverTrigger asChild>
        <Badge variant="secondary" className="cursor-pointer text-xs gap-1">
          <LinkIcon className="h-3 w-3" /> {links.length} links
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-1">Evidence Links</p>
        {links.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <a href={formatUrl(l.url)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
              {l.title || l.url}
            </a>
            <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => removeLink(i)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="border-t pt-2 space-y-1.5">
          <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-7 text-xs" />
          <Input placeholder="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="h-7 text-xs" />
          <Button size="sm" className="w-full h-7 text-xs" onClick={addLink}>Add Link</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Compact inline editable input
function InlineInput({ value, onCommit }: { value: number | null; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(String(value || 0));
  const [focused, setFocused] = useState(false);

  const displayed = focused ? local : String(value || 0);

  return (
    <Input
      type="number"
      className="h-7 w-20 text-right text-xs px-1.5 tabular-nums"
      value={displayed}
      onFocus={() => { setLocal(String(value || 0)); setFocused(true); }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { setFocused(false); if (local !== String(value || 0)) onCommit(local); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/* ── Founder Risk badge (informational only — never auto-applies a deduction) ── */
function RiskBadge({ info }: { info?: { risk_status: string | null; attendance_rate: number | null } }) {
  if (!info || !info.risk_status) {
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">no signal</Badge>;
  }
  const risk = (info.risk_status || "").toLowerCase();
  const style =
    risk === "high" || risk === "at_risk" || risk === "at risk"
      ? "bg-red-100 text-red-700 border-0"
      : risk === "medium" || risk === "watch"
      ? "bg-orange-100 text-orange-700 border-0"
      : "bg-emerald-100 text-emerald-700 border-0";
  const rate = info.attendance_rate != null ? ` · ${Math.round(Number(info.attendance_rate))}%` : "";
  return (
    <Badge className={`text-[10px] px-1.5 py-0 font-normal gap-0.5 ${style}`}>
      <AlertTriangle className="h-2.5 w-2.5" />
      {info.risk_status}{rate}
    </Badge>
  );
}

