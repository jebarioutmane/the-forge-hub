import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { useVendors } from "@/hooks/useRelationalData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { TagPicker } from "@/components/TagPicker";
import { cn } from "@/lib/utils";
import {
  Plus, MoreHorizontal, Pencil, Trash2, Eye, X, Search, Check, ChevronsUpDown,
  Filter, Wallet, CheckCircle2, Clock, CircleDollarSign, Archive, ArchiveRestore,
  ExternalLink, Loader2, Receipt,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Expense = Tables<"expenses">;

const STATUS_OPTIONS = ["Pending", "Approved", "Paid"] as const;
const TYPE_OPTIONS = ["Purchase", "Reimbursement", "Payment", "Stipend", "Service", "Other"] as const;
const CURRENCIES = ["MAD", "USD", "EUR", "GBP"] as const;

function formatMoney(amount: number, currency: string | null) {
  const c = currency || "MAD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${c}`;
  }
}

function statusTone(s: string | null) {
  switch (s) {
    case "Paid": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Approved": return "bg-blue-50 text-blue-700 border-blue-200";
    case "Pending": return "bg-amber-50 text-amber-700 border-amber-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

/* ─── Multi-select filter dropdown ─── */
function FilterMultiSelect({
  label, icon: Icon, options, value, onChange,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const s = q.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 font-normal">
          {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
          {label}
          {value.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{value.length}</Badge>
          )}
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <Input placeholder={`Search ${label.toLowerCase()}...`} value={q} onChange={(e) => setQ(e.target.value)} className="h-8" />
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No options</p>
            )}
            {filtered.map((o) => {
              const on = value.includes(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
                  className={cn("flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent text-left", on && "bg-accent")}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", on ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        {value.length > 0 && (
          <div className="border-t p-1">
            <button
              onClick={() => onChange([])}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 px-2 rounded hover:bg-accent"
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Main ─── */
export default function Expenses() {
  const qc = useQueryClient();
  const { selectedCohortId, selectedCohortLabel, cohorts } = useCohort();
  const isAllCohorts = selectedCohortId === ALL_COHORTS;

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [fType, setFType] = useState<string[]>([]);
  const [fBudget, setFBudget] = useState<string[]>([]);
  const [fCategory, setFCategory] = useState<string[]>([]);
  const [fVendor, setFVendor] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = {
    description: "",
    amount: "",
    currency: "MAD",
    type: "" as string,
    status: "Pending" as string,
    beneficiary_name: "",
    due_date: "",
    budget_line_id: null as string | null,
    category_id: null as string | null,
    vendor_id: null as string | null,
    tag_ids: [] as string[],
    proof_document_url: "",
  };
  const [form, setForm] = useState(emptyForm);
  function set<K extends keyof typeof emptyForm>(k: K, v: typeof emptyForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /* ─── Data ─── */
  const { data: vendors = [] } = useVendors();

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: budgetLines = [] } = useQuery({
    queryKey: ["budget-lines", isAllCohorts ? "all" : selectedCohortId],
    queryFn: async () => {
      let q = supabase.from("budget_lines").select("*").eq("is_archived", false).order("name");
      if (!isAllCohorts && selectedCohortId) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCohortId,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", isAllCohorts ? "all" : selectedCohortId, showArchived],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*").order("created_at", { ascending: false });
      if (!isAllCohorts && selectedCohortId) q = q.eq("cohort_id", selectedCohortId);
      q = q.eq("is_archived", showArchived);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCohortId,
  });

  /* ─── Lookups ─── */
  const budgetMap = useMemo(() => new Map(budgetLines.map((b) => [b.id, b])), [budgetLines]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (s && !(
        e.description?.toLowerCase().includes(s) ||
        e.beneficiary_name?.toLowerCase().includes(s)
      )) return false;
      if (fStatus.length && !fStatus.includes(e.status || "")) return false;
      if (fType.length && !fType.includes(e.type || "")) return false;
      if (fBudget.length && !fBudget.includes(e.budget_line_id || "")) return false;
      if (fCategory.length && !fCategory.includes(e.category_id || "")) return false;
      if (fVendor.length && !fVendor.includes(e.vendor_id || "")) return false;
      return true;
    });
  }, [expenses, search, fStatus, fType, fBudget, fCategory, fVendor]);

  const totals = useMemo(() => {
    const t = { all: 0, Paid: 0, Approved: 0, Pending: 0 };
    for (const e of filtered) {
      const a = Number(e.amount) || 0;
      t.all += a;
      if (e.status === "Paid") t.Paid += a;
      else if (e.status === "Approved") t.Approved += a;
      else if (e.status === "Pending") t.Pending += a;
    }
    return t;
  }, [filtered]);

  const activeFilterCount =
    fStatus.length + fType.length + fBudget.length + fCategory.length + fVendor.length + (search ? 1 : 0);

  function clearAllFilters() {
    setSearch(""); setFStatus([]); setFType([]); setFBudget([]); setFCategory([]); setFVendor([]);
  }

  /* ─── Mutations ─── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.description.trim()) throw new Error("Description is required");
      if (!form.amount || Number.isNaN(Number(form.amount))) throw new Error("Amount is required");
      if (!selectedCohortId || isAllCohorts) throw new Error("Select a specific cohort first");

      const payload = {
        description: form.description.trim(),
        amount: Number(form.amount),
        currency: form.currency || "MAD",
        type: form.type || null,
        status: form.status || null,
        beneficiary_name: form.beneficiary_name.trim() || null,
        due_date: form.due_date || null,
        budget_line_id: form.budget_line_id,
        category_id: form.category_id,
        vendor_id: form.vendor_id,
        tag_ids: form.tag_ids.length ? form.tag_ids : null,
        proof_document_url: form.proof_document_url.trim() || null,
        cohort_id: selectedCohortId,
      };

      if (editing) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setDialogOpen(false); setEditing(null); setForm(emptyForm);
      toast.success(editing ? "Expense updated" : "Expense added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("expenses").update({
        is_archived: archived,
        archived_at: archived ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setDeleteId(null);
      setViewing(null);
      toast.success(v.archived ? "Expense archived" : "Expense restored");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openCreate() {
    if (isAllCohorts) { toast.error("Select a specific cohort to add an expense"); return; }
    setEditing(null); setForm(emptyForm); setDialogOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      description: e.description || "",
      amount: String(e.amount ?? ""),
      currency: e.currency || "MAD",
      type: e.type || "",
      status: e.status || "Pending",
      beneficiary_name: e.beneficiary_name || "",
      due_date: e.due_date || "",
      budget_line_id: e.budget_line_id,
      category_id: e.category_id,
      vendor_id: e.vendor_id,
      tag_ids: (e.tag_ids as string[] | null) || [],
      proof_document_url: e.proof_document_url || "",
    });
    setDialogOpen(true);
  }

  /* ─── Render ─── */
  if (!selectedCohortId && cohorts.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          title="No cohorts yet"
          hint="Create a cohort in Settings to start tracking expenses."
        />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedCohortLabel ? `Cohort — ${selectedCohortLabel}` : "All cohorts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border px-3 h-9">
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="arch" className="text-sm font-normal cursor-pointer">Archived</Label>
            <Switch id="arch" checked={showArchived} onCheckedChange={setShowArchived} />
          </div>
          <Button onClick={openCreate} disabled={isAllCohorts}>
            <Plus className="mr-1.5 h-4 w-4" /> New expense
          </Button>
        </div>
      </div>

      {/* Totals bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total (filtered)" value={formatMoney(totals.all, "MAD")} icon={Wallet} tone="default" sub={`${filtered.length} expenses`} />
        <StatCard label="Paid" value={formatMoney(totals.Paid, "MAD")} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Approved" value={formatMoney(totals.Approved, "MAD")} icon={CircleDollarSign} tone="blue" />
        <StatCard label="Pending" value={formatMoney(totals.Pending, "MAD")} icon={Clock} tone="amber" />
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search description or beneficiary..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <FilterMultiSelect
              label="Status" icon={Filter}
              options={STATUS_OPTIONS.map((s) => ({ id: s, label: s }))}
              value={fStatus} onChange={setFStatus}
            />
            <FilterMultiSelect
              label="Type" icon={Filter}
              options={TYPE_OPTIONS.map((s) => ({ id: s, label: s }))}
              value={fType} onChange={setFType}
            />
            <FilterMultiSelect
              label="Budget line" icon={Filter}
              options={budgetLines.map((b) => ({ id: b.id, label: b.code ? `${b.code} — ${b.name}` : b.name }))}
              value={fBudget} onChange={setFBudget}
            />
            <FilterMultiSelect
              label="Category" icon={Filter}
              options={categories.map((c) => ({ id: c.id, label: c.name }))}
              value={fCategory} onChange={setFCategory}
            />
            <FilterMultiSelect
              label="Vendor" icon={Filter}
              options={vendors.map((v) => ({ id: v.id, label: v.name }))}
              value={fVendor} onChange={setFVendor}
            />
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-muted-foreground">
                <X className="mr-1 h-3.5 w-3.5" /> Clear all
              </Button>
            )}
          </div>

          {/* Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {search && <FilterChip label={`Search: ${search}`} onRemove={() => setSearch("")} />}
              {fStatus.map((s) => <FilterChip key={"s" + s} label={`Status: ${s}`} onRemove={() => setFStatus(fStatus.filter((x) => x !== s))} />)}
              {fType.map((s) => <FilterChip key={"t" + s} label={`Type: ${s}`} onRemove={() => setFType(fType.filter((x) => x !== s))} />)}
              {fBudget.map((id) => <FilterChip key={"b" + id} label={`Budget: ${budgetMap.get(id)?.name || id}`} onRemove={() => setFBudget(fBudget.filter((x) => x !== id))} />)}
              {fCategory.map((id) => <FilterChip key={"c" + id} label={`Category: ${categoryMap.get(id)?.name || id}`} onRemove={() => setFCategory(fCategory.filter((x) => x !== id))} />)}
              {fVendor.map((id) => <FilterChip key={"v" + id} label={`Vendor: ${vendorMap.get(id)?.name || id}`} onRemove={() => setFVendor(fVendor.filter((x) => x !== id))} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading expenses...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState
                title={expenses.length === 0 ? (showArchived ? "No archived expenses" : "No expenses yet") : "No expenses match your filters"}
                hint={expenses.length === 0 && !showArchived ? "Add your first expense to start tracking spend." : "Try clearing some filters."}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Budget line</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const bl = e.budget_line_id ? budgetMap.get(e.budget_line_id) : null;
                    const v = e.vendor_id ? vendorMap.get(e.vendor_id) : null;
                    const c = e.category_id ? categoryMap.get(e.category_id) : null;
                    return (
                      <TableRow key={e.id} className="cursor-pointer" onClick={() => setViewing(e)}>
                        <TableCell className="font-medium max-w-[280px] truncate">{e.description}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(Number(e.amount), e.currency)}</TableCell>
                        <TableCell className="text-muted-foreground">{e.type || "—"}</TableCell>
                        <TableCell>
                          {e.status ? (
                            <Badge variant="outline" className={cn("font-normal", statusTone(e.status))}>{e.status}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[160px] truncate">{e.beneficiary_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{e.due_date || "—"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[180px] truncate">
                          {bl ? (bl.code ? `${bl.code} — ${bl.name}` : bl.name) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[140px] truncate">{v?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[140px] truncate">{c?.name || "—"}</TableCell>
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(e)}>
                                <Eye className="mr-2 h-3.5 w-3.5" /> View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(e)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              {e.is_archived ? (
                                <DropdownMenuItem onClick={() => archiveMutation.mutate({ id: e.id, archived: false })}>
                                  <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setDeleteId(e.id)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Archive
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "New expense"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update expense details below." : "Add a new expense to the current cohort."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Basics */}
            <FormSection title="Basics">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="desc">Description *</Label>
                  <Textarea
                    id="desc" name="description" rows={2}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="What is this expense for?"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="amount">Amount *</Label>
                    <Input
                      id="amount" name="amount" type="number" step="0.01"
                      value={form.amount}
                      onChange={(e) => set("amount", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                      <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select value={form.type || undefined} onValueChange={(v) => set("type", v)}>
                      <SelectTrigger id="type"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={form.status || undefined} onValueChange={(v) => set("status", v)}>
                      <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Beneficiary & timing */}
            <FormSection title="Beneficiary & timing">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="beneficiary">Beneficiary</Label>
                  <Input
                    id="beneficiary" name="beneficiary_name"
                    value={form.beneficiary_name}
                    onChange={(e) => set("beneficiary_name", e.target.value)}
                    placeholder="Person or entity paid"
                  />
                </div>
                <div>
                  <Label htmlFor="due">Due date</Label>
                  <Input
                    id="due" name="due_date" type="date"
                    value={form.due_date}
                    onChange={(e) => set("due_date", e.target.value)}
                  />
                </div>
              </div>
            </FormSection>

            {/* Classification */}
            <FormSection title="Classification">
              <div className="space-y-3">
                <div>
                  <Label>Budget line</Label>
                  <Select value={form.budget_line_id || "__none"} onValueChange={(v) => set("budget_line_id", v === "__none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Select budget line" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {budgetLines.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.code ? `${b.code} — ${b.name}` : b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {budgetLines.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No budget lines in this cohort yet — add them in Operations · Source.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category_id || "__none"} onValueChange={(v) => set("category_id", v === "__none" ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vendor</Label>
                    <Select value={form.vendor_id || "__none"} onValueChange={(v) => set("vendor_id", v === "__none" ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Tags</Label>
                  <TagPicker value={form.tag_ids} onChange={(ids) => set("tag_ids", ids)} />
                </div>
              </div>
            </FormSection>

            {/* Proof */}
            <FormSection title="Proof">
              <div>
                <Label htmlFor="proof">Proof document URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="proof" name="proof_document_url" type="url"
                    value={form.proof_document_url}
                    onChange={(e) => set("proof_document_url", e.target.value)}
                    placeholder="https://..."
                  />
                  {form.proof_document_url && (
                    <Button type="button" variant="outline" size="icon" asChild>
                      <a href={form.proof_document_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </FormSection>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2">
              <Receipt className="h-4 w-4 mt-1 text-muted-foreground" />
              <span>{viewing?.description}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">Expense details</DialogDescription>
          </DialogHeader>

          {viewing && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl font-semibold tabular-nums">
                  {formatMoney(Number(viewing.amount), viewing.currency)}
                </span>
                {viewing.status && (
                  <Badge variant="outline" className={cn("font-normal", statusTone(viewing.status))}>{viewing.status}</Badge>
                )}
                {viewing.type && <Badge variant="secondary" className="font-normal">{viewing.type}</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Beneficiary" value={viewing.beneficiary_name} />
                <Field label="Due date" value={viewing.due_date} />
                <Field
                  label="Budget line"
                  value={viewing.budget_line_id
                    ? (() => { const b = budgetMap.get(viewing.budget_line_id!); return b ? (b.code ? `${b.code} — ${b.name}` : b.name) : "—"; })()
                    : "—"}
                />
                <Field label="Vendor" value={viewing.vendor_id ? vendorMap.get(viewing.vendor_id)?.name : "—"} />
                <Field label="Category" value={viewing.category_id ? categoryMap.get(viewing.category_id)?.name : "—"} />
                <Field label="Currency" value={viewing.currency} />
              </div>

              {viewing.tag_ids && viewing.tag_ids.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(viewing.tag_ids as string[]).map((id) => {
                      const t = tagMap.get(id);
                      if (!t) return null;
                      return (
                        <Badge key={id} className="font-normal text-xs" style={{ backgroundColor: t.color, color: "#fff" }}>
                          {t.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {viewing.proof_document_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Proof</p>
                  <a
                    href={viewing.proof_document_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open document
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {viewing && !viewing.is_archived && (
              <Button variant="outline" onClick={() => { const e = viewing; setViewing(null); openEdit(e); }}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {viewing?.is_archived ? (
              <Button variant="outline" onClick={() => archiveMutation.mutate({ id: viewing.id, archived: false })}>
                <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Restore
              </Button>
            ) : (
              viewing && (
                <Button variant="destructive" onClick={() => setDeleteId(viewing.id)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Archive
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && archiveMutation.mutate({ id: deleteId, archived: true })}
        title="Archive expense?"
        description="This expense will be hidden from the main list. You can restore it later from the Archived view."
      />
    </div>
  );
}

/* ─── Small helpers ─── */
function StatCard({
  label, value, sub, icon: Icon, tone,
}: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "default" | "emerald" | "blue" | "amber";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className={cn("h-4 w-4", tones[tone])} />
        </div>
        <p className={cn("mt-2 text-xl font-semibold tabular-nums", tones[tone])}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 font-normal">
      {label}
      <button onClick={onRemove} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">{value || "—"}</p>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-8">
      <Receipt className="h-8 w-8 mx-auto text-muted-foreground/40" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
