import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logAction } from "@/lib/logAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Download, Trash2, Pencil, DollarSign, Users, CheckCircle, Clock, Zap, MoreHorizontal, Eye, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import type { Tables } from "@/integrations/supabase/types";

type StipendRecord = Tables<"stipend_records">;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currentYear = new Date().getFullYear();
const currentMonthIndex = new Date().getMonth();
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

function calcNet(base: number, dedPct: number, dedFixed: number, addPct: number, addFixed: number, reimb: number) {
  return (base * (1 - dedPct / 100) - dedFixed) + (base * (addPct / 100) + addFixed) + reimb;
}

export default function Stipends() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: founders = [] } = useQuery({
    queryKey: ["founders-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name, cohort_year, rib_number")
        .order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const [cohortYear, setCohortYear] = useState(String(currentYear));
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

  const cohortFounders = useMemo(
    () => founders.filter((f) => f.cohort_year === cohortYear),
    [founders, cohortYear]
  );

  const monthKey = `${paymentMonth} ${cohortYear}`;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["stipend_records", cohortYear, paymentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stipend_records")
        .select("*")
        .eq("cohort_year", cohortYear)
        .eq("payment_month", monthKey);
      if (error) throw error;
      return data;
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
      const f = founders.find((x) => x.id === id);
      return f ? f.rib_number || "" : "";
    },
    [founders]
  );

  // Initialize a record for a founder
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

  // Inline field update
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
        .update({ [field]: value, total_net: net })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Status toggle
  const toggleStatus = (rec: StipendRecord) => {
    const order = ["pending", "approved", "paid"];
    const idx = order.indexOf(rec.status || "pending");
    const next = order[(idx + 1) % order.length];
    updateFieldMutation.mutate({ id: rec.id, field: "status", value: next });
    logAction("Operations-Stipends", "UPDATE", rec.id, { status: rec.status }, { status: next }, user?.email || "Unknown");
  };

  // Edit dialog save
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
      logAction("Operations-Stipends", "UPDATE", editRecord!.id, editRecord as any, editForm as any, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      setEditOpen(false);
      setEditRecord(null);
      toast.success("Record updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stipend_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logAction("Operations-Stipends", "DELETE", id, null, null, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      setDeleteId(null);
      toast.success("Record deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = records.map((r) => r.id);
      if (!ids.length) return;
      const { error } = await supabase.from("stipend_records").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipend_records", cohortYear, paymentMonth] });
      setBulkDeleteOpen(false);
      toast.success("All records for this month deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkBaseMutation = useMutation({
    mutationFn: async () => {
      const base = Number(bulkBaseAmount) || 0;
      const ids = records.map((r) => r.id);
      if (!ids.length) return;
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

  // Initialize all founders at once
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

  // Summary stats
  const totalDisbursement = records.reduce((sum, r) => sum + (Number(r.total_net) || 0), 0);
  const paidCount = records.filter((r) => r.status === "paid").length;
  const pendingCount = records.filter((r) => r.status === "pending").length;
  const approvedCount = records.filter((r) => r.status === "approved").length;

  const uninitializedCount = cohortFounders.filter((f) => !recordsByFounder.has(f.id)).length;

  // Export CSV
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
          <Button variant="outline" size="sm" onClick={() => setBulkBaseOpen(true)} disabled={records.length === 0}>
            <DollarSign className="mr-1 h-3.5 w-3.5" /> Apply Base to All
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={records.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
          </Button>
          {records.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete All
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">Cohort Year</Label>
            <Select value={cohortYear} onValueChange={setCohortYear}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
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
          {uninitializedCount > 0 && (
            <Button size="sm" onClick={() => initAllMutation.mutate()} disabled={initAllMutation.isPending}>
              <Zap className="mr-1 h-3.5 w-3.5" /> Initialize All ({uninitializedCount})
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {cohortFounders.length} founder{cohortFounders.length !== 1 ? "s" : ""} in cohort
          </span>
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
                    const rib = founder.rib_number || "";
                    if (!rec) {
                      return (
                        <TableRow key={founder.id} className="bg-muted/30">
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{founder.founder_name}</p>
                              <p className="text-xs text-muted-foreground">{founder.startup_name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {rib ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-mono truncate max-w-[150px]">{rib}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(rib); toast.success("RIB copied"); }}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell colSpan={8} className="text-center text-muted-foreground text-sm">
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

                    return (
                      <TableRow key={rec.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{founder.founder_name}</p>
                            <p className="text-xs text-muted-foreground">{founder.startup_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rib ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono truncate max-w-[150px]">{rib}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(rib); toast.success("RIB copied"); }}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
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
                              <DropdownMenuItem onClick={() => openEdit(rec)}>
                                <Pencil className="mr-2 h-3 w-3" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(rec.id)}>
                                <Trash2 className="mr-2 h-3 w-3" /> Delete
                              </DropdownMenuItem>
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

      {/* View Detail */}
      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Stipend Record Details"
        fields={viewing ? [
          { label: "Founder", value: getFounderName(viewing.founder_id) },
          { label: "Startup", value: getStartupName(viewing.founder_id) },
          { label: "RIB Number", value: getRib(viewing.founder_id) || "—" },
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
        ] : []}
      />
    </div>
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
