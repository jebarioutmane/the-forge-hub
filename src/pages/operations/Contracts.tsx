import { useState, useMemo } from "react";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { useVendors } from "@/hooks/useRelationalData";
import {
  useContracts, useAllContractPayments, useAllBudgetLines, useContractMutations,
  isCommitted, isPaid, type ContractRow,
} from "@/hooks/useContracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import ContractFormDialog from "@/components/contracts/ContractFormDialog";
import ContractDetailDialog from "@/components/contracts/ContractDetailDialog";
import {
  Plus, MoreHorizontal, Pencil, Eye, X, Search, Check, ChevronsUpDown,
  Filter, Wallet, CheckCircle2, Clock, Briefcase, Archive, ArchiveRestore,
  Building2, Tag as TagIcon, Loader2, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["Draft", "Active", "Completed", "Terminated"] as const;
const TYPE_OPTIONS = ["mentor", "expert", "consultant", "service provider"] as const;

function statusTone(s: string | null) {
  switch (s) {
    case "Active": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Completed": return "bg-blue-50 text-blue-700 border-blue-200";
    case "Terminated": return "bg-red-50 text-red-700 border-red-200";
    case "Draft":
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function formatMoney(amount: number, currency: string | null) {
  const c = currency || "MAD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${c}`;
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
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No options</p>}
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
            <button onClick={() => onChange([])} className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 px-2 rounded hover:bg-accent">
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function OperationsContracts() {
  const { selectedCohortId, selectedCohortLabel } = useCohort();
  const [showArchived, setShowArchived] = useState(false);
  const { data: allContracts = [], isLoading } = useContracts({ includeArchived: showArchived });
  const { data: vendors = [] } = useVendors();
  const { data: allBudgetLines = [] } = useAllBudgetLines();
  const { data: allPayments = [] } = useAllContractPayments();
  const { archiveContract, restoreContract } = useContractMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null);
  const [viewingContract, setViewingContract] = useState<ContractRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ContractRow | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [budgetLineFilter, setBudgetLineFilter] = useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);

  const budgetLineById = useMemo(() => Object.fromEntries(allBudgetLines.map((b) => [b.id, b])), [allBudgetLines]);
  const vendorById = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v])), [vendors]);

  // Cohort filter
  const cohortScoped = useMemo(() => {
    if (selectedCohortId === ALL_COHORTS) return allContracts;
    return allContracts.filter((c) => c.cohort_id === selectedCohortId);
  }, [allContracts, selectedCohortId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cohortScoped.filter((c) => {
      if (statusFilter.length && !statusFilter.includes(c.status || "Draft")) return false;
      if (typeFilter.length && !typeFilter.includes(c.type || "")) return false;
      if (budgetLineFilter.length && !budgetLineFilter.includes(c.budget_line_id || "")) return false;
      if (vendorFilter.length && !vendorFilter.includes(c.vendor_id || "")) return false;
      if (q) {
        const vendorName = c.vendor_id ? vendorById[c.vendor_id]?.name : c.stakeholder_name;
        const hay = [c.title, c.description, vendorName, c.stakeholder_name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cohortScoped, search, statusFilter, typeFilter, budgetLineFilter, vendorFilter, vendorById]);

  // Payments aggregated per contract
  const paymentsByContract = useMemo(() => {
    const m: Record<string, { committed: number; paid: number }> = {};
    allPayments.forEach((p) => {
      const bucket = m[p.contract_id] || (m[p.contract_id] = { committed: 0, paid: 0 });
      if (isPaid(p.status)) bucket.paid += Number(p.amount);
      else if (isCommitted(p.status)) bucket.committed += Number(p.amount);
    });
    return m;
  }, [allPayments]);

  // KPI totals over filtered
  const totals = useMemo(() => {
    let value = 0, paid = 0, committed = 0;
    filtered.forEach((c) => {
      value += Number(c.value || 0);
      const agg = paymentsByContract[c.id];
      if (agg) { paid += agg.paid; committed += agg.committed; }
    });
    return { value, paid, committed, remaining: Math.max(value - paid, 0) };
  }, [filtered, paymentsByContract]);

  const activeFilterCount = statusFilter.length + typeFilter.length + budgetLineFilter.length + vendorFilter.length + (search ? 1 : 0);
  function clearFilters() {
    setSearch(""); setStatusFilter([]); setTypeFilter([]); setBudgetLineFilter([]); setVendorFilter([]);
  }

  const budgetLineOptions = allBudgetLines
    .filter((b) => selectedCohortId === ALL_COHORTS || b.cohort_id === selectedCohortId)
    .map((b) => ({ id: b.id, label: `${b.code || "—"} — ${b.name}` }));
  const vendorOptions = vendors.map((v) => ({ id: v.id, label: v.name }));

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full lifecycle contract manager — milestones, payments, and budget commitments · {selectedCohortLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 pr-3 border-r">
            <Switch id="archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="archived" className="text-xs cursor-pointer flex items-center gap-1">
              <Archive className="h-3 w-3" /> Archived
            </Label>
          </div>
          <Button onClick={() => { setEditingContract(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Contract
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Briefcase} label="Contracts" value={String(filtered.length)} tone="text-foreground" />
        <KpiCard icon={Wallet} label="Total Value" value={formatMoney(totals.value, "MAD")} tone="text-foreground" />
        <KpiCard icon={Clock} label="Committed" value={formatMoney(totals.committed, "MAD")} tone="text-amber-700" hint="Unpaid scheduled/committed" />
        <KpiCard icon={CheckCircle2} label="Paid" value={formatMoney(totals.paid, "MAD")} tone="text-emerald-700" hint={`Remaining ${formatMoney(totals.remaining, "MAD")}`} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search title, vendor, description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <FilterMultiSelect label="Status" icon={Filter} options={STATUS_OPTIONS.map((s) => ({ id: s, label: s }))} value={statusFilter} onChange={setStatusFilter} />
        <FilterMultiSelect label="Type" icon={TagIcon} options={TYPE_OPTIONS.map((t) => ({ id: t, label: t }))} value={typeFilter} onChange={setTypeFilter} />
        <FilterMultiSelect label="Budget line" icon={Wallet} options={budgetLineOptions} value={budgetLineFilter} onChange={setBudgetLineFilter} />
        <FilterMultiSelect label="Vendor" icon={Building2} options={vendorOptions} value={vendorFilter} onChange={setVendorFilter} />
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground">
            <X className="mr-1 h-3 w-3" /> Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Budget line</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="w-[180px]">Progress</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading contracts...
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-16">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {activeFilterCount > 0 ? "No contracts match these filters" : "No contracts yet"}
                  </p>
                </TableCell></TableRow>
              ) : (
                filtered.map((c) => {
                  const agg = paymentsByContract[c.id] || { committed: 0, paid: 0 };
                  const val = Number(c.value || 0);
                  const pctPaid = val > 0 ? Math.round((agg.paid / val) * 100) : 0;
                  const pctCommitted = val > 0 ? Math.round((agg.committed / val) * 100) : 0;
                  const bl = c.budget_line_id ? budgetLineById[c.budget_line_id] : null;
                  const vendorName = c.vendor_id ? vendorById[c.vendor_id]?.name : c.stakeholder_name;
                  const dateRange = [c.start_date, c.end_date].filter(Boolean).join(" → ") || "—";
                  return (
                    <TableRow key={c.id} className={cn("group cursor-pointer", c.is_archived && "opacity-60")} onClick={() => setViewingContract(c)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {c.title}
                          {c.is_archived && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{vendorName || "—"}</TableCell>
                      <TableCell><span className="capitalize text-xs text-muted-foreground">{c.type || "—"}</span></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusTone(c.status)}>{c.status || "Draft"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatMoney(val, c.currency)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {bl ? `${bl.code || "—"} · ${bl.name}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{dateRange}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-amber-400/60" style={{ width: `${Math.min(pctPaid + pctCommitted, 100)}%` }} />
                            <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${Math.min(pctPaid, 100)}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                            <span className="text-emerald-700">{pctPaid}% paid</span>
                            <span className="text-amber-700">{pctCommitted}% comm.</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingContract(c)}><Eye className="mr-2 h-3.5 w-3.5" /> View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingContract(c); setFormOpen(true); }}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                            {c.is_archived ? (
                              <DropdownMenuItem onClick={() => restoreContract.mutate(c.id)}>
                                <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="text-destructive" onClick={() => setArchiveTarget(c)}>
                                <Archive className="mr-2 h-3.5 w-3.5" /> Archive
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
        </CardContent>
      </Card>

      <ContractFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingContract(null); }}
        editingContract={editingContract}
      />

      <ContractDetailDialog
        contract={viewingContract}
        onClose={() => setViewingContract(null)}
      />

      <ConfirmDeleteDialog
        open={!!archiveTarget}
        onConfirm={() => { if (archiveTarget) { archiveContract.mutate(archiveTarget.id); setArchiveTarget(null); } }}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, tone, hint,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className={cn("text-2xl font-semibold mt-1", tone)}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}
