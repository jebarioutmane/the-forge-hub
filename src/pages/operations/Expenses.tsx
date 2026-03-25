import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { useVendors, useBudgetCategories } from "@/hooks/useRelationalData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, Link2, X, PiggyBank, TrendingDown, Wallet, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Expense = Tables<"expenses">;
type Cohort = Tables<"cohorts">;

/* ─── Cohort Selector ─── */
function CohortSelector({
  cohorts,
  selectedId,
  onSelect,
  onCreateNew,
  onEdit,
  onDelete,
}: {
  cohorts: Cohort[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={selectedId || ""} onValueChange={onSelect}>
        <SelectTrigger className="w-[260px]">
          <SelectValue placeholder="Select a cohort..." />
        </SelectTrigger>
        <SelectContent>
          {cohorts.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} ({c.year})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedId && (
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit cohort">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} title="Delete cohort">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
      <Button variant="outline" size="sm" onClick={onCreateNew}>
        <Plus className="mr-1 h-3.5 w-3.5" /> New Cohort
      </Button>
    </div>
  );
}

/* ─── Multi-Select Vendors with Inline Creation ─── */
function VendorMultiSelect({
  value,
  onChange,
  options,
  onCreateNew,
  onDelete,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  options: { id: string; name: string; type: string | null }[];
  onCreateNew?: (name: string, type: string | null) => Promise<string | null>;
  onDelete?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || (o.type && o.type.toLowerCase().includes(q))
    );
  }, [options, search]);

  const selectedNames = options.filter((o) => value.includes(o.id)).map((o) => o.name);

  async function handleCreate() {
    if (!newName.trim() || !onCreateNew) return;
    setSaving(true);
    const newId = await onCreateNew(newName.trim(), newType.trim() || null);
    setSaving(false);
    if (newId) {
      onChange([...value, newId]);
      setIsCreating(false);
      setNewName("");
      setNewType("");
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setIsCreating(false); setNewName(""); setNewType(""); } }}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-9">
            <span className="truncate text-left">
              {selectedNames.length > 0 ? `${selectedNames.length} selected` : "Select stakeholders..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-[200px]">
            {filtered.length === 0 && !isCreating ? (
              <p className="text-sm text-muted-foreground text-center py-4">No vendors found</p>
            ) : (
              <div className="p-1">
                {filtered.map((option) => {
                  const isSelected = value.includes(option.id);
                  return (
                     <div
                      key={option.id}
                      className={cn(
                        "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left group",
                        isSelected && "bg-accent"
                      )}
                    >
                      <button
                        onClick={() => {
                          onChange(
                            isSelected
                              ? value.filter((id) => id !== option.id)
                              : [...value, option.id]
                          );
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                      >
                        <Check
                          className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{option.name}</span>
                          {option.type && (
                            <span className="text-xs text-muted-foreground truncate">{option.type}</span>
                          )}
                        </div>
                      </button>
                      {onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(option.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-destructive shrink-0 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Inline vendor creation */}
          {onCreateNew && (
            <div className="border-t p-1">
              {isCreating ? (
                <div className="space-y-1.5 p-1">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Vendor name..."
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setIsCreating(false); }}
                  />
                  <div className="flex items-center gap-1.5">
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue placeholder="Type (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mentor">Mentor</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8 px-2.5 shrink-0" onClick={handleCreate} disabled={!newName.trim() || saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-primary font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add new stakeholder
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options
            .filter((o) => value.includes(o.id))
            .map((o) => (
              <Badge key={o.id} variant="secondary" className="gap-1 pr-1">
                {o.name}
                <button
                  onClick={() => onChange(value.filter((id) => id !== o.id))}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function Expenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [cohortDialogOpen, setCohortDialogOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [deleteCohortId, setDeleteCohortId] = useState<string | null>(null);
  const [cohortForm, setCohortForm] = useState({ name: "", year: String(new Date().getFullYear()), total_budget: "" });

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [form, setForm] = useState({
    description: "",
    detail: "",
    category_id: null as string | null,
    currency: "MAD",
    amount: "",
    stakeholder_ids: [] as string[],
    links: [] as { title: string; url: string }[],
  });

  const { data: vendors = [] } = useVendors();
  const { data: categories = [] } = useBudgetCategories();

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    label: c.name,
    sublabel: c.total_amount ? `${Number(c.total_amount).toLocaleString()} MAD` : undefined,
  }));

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cohorts").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Auto-select first cohort
  const activeCohortId = selectedCohortId || (cohorts.length > 0 ? cohorts[0].id : null);
  const activeCohort = cohorts.find((c) => c.id === activeCohortId);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", activeCohortId],
    queryFn: async () => {
      if (!activeCohortId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("cohort_id", activeCohortId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeCohortId,
  });

  // Load stakeholders and links for viewing
  const [viewStakeholders, setViewStakeholders] = useState<string[]>([]);
  const [viewLinks, setViewLinks] = useState<{ title: string; url: string }[]>([]);

  // Budget tracking
  const totalBudget = Number(activeCohort?.total_budget || 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const remaining = totalBudget - totalExpenses;

  // Cohort creation
  const createCohortMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("cohorts").insert({
        name: cohortForm.name,
        year: Number(cohortForm.year),
        total_budget: cohortForm.total_budget ? Number(cohortForm.total_budget) : 0,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      setSelectedCohortId(data.id);
      setCohortDialogOpen(false);
      setCohortForm({ name: "", year: String(new Date().getFullYear()), total_budget: "" });
      toast.success("Cohort created");
    },
    onError: (e) => toast.error(e.message),
  });

  // Cohort update
  const updateCohortMutation = useMutation({
    mutationFn: async () => {
      if (!editingCohort) return;
      const { error } = await supabase.from("cohorts").update({
        name: cohortForm.name,
        year: Number(cohortForm.year),
        total_budget: cohortForm.total_budget ? Number(cohortForm.total_budget) : 0,
      }).eq("id", editingCohort.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      setCohortDialogOpen(false);
      setEditingCohort(null);
      setCohortForm({ name: "", year: String(new Date().getFullYear()), total_budget: "" });
      toast.success("Cohort updated");
    },
    onError: (e) => toast.error(e.message),
  });

  // Cohort delete
  const deleteCohortMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete related expenses first
      const { data: expenseIds } = await supabase.from("expenses").select("id").eq("cohort_id", id);
      if (expenseIds && expenseIds.length > 0) {
        const ids = expenseIds.map((e) => e.id);
        await supabase.from("expense_stakeholders").delete().in("expense_id", ids);
        await supabase.from("expense_links").delete().in("expense_id", ids);
        await supabase.from("expenses").delete().eq("cohort_id", id);
      }
      const { error } = await supabase.from("cohorts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSelectedCohortId(null);
      setDeleteCohortId(null);
      toast.success("Cohort deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Expense creation
  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      // Insert expense
      const { data: expense, error } = await supabase.from("expenses").insert({
        cohort_id: activeCohortId,
        description: form.description,
        category_id: form.category_id,
        currency: form.currency,
        amount: Number(form.amount),
        beneficiary_name: form.detail || null,
      } as any).select().single();
      if (error) throw error;

      // Insert stakeholders
      if (form.stakeholder_ids.length > 0) {
        const stakeholderRows = form.stakeholder_ids.map((vendor_id) => ({
          expense_id: expense.id,
          vendor_id,
        }));
        const { error: sErr } = await supabase.from("expense_stakeholders").insert(stakeholderRows);
        if (sErr) throw sErr;
      }

      // Insert links
      if (form.links.length > 0) {
        const linkRows = form.links
          .filter((l) => l.url.trim())
          .map((l) => ({
            expense_id: expense.id,
            title: l.title || null,
            url: l.url,
          }));
        if (linkRows.length > 0) {
          const { error: lErr } = await supabase.from("expense_links").insert(linkRows);
          if (lErr) throw lErr;
        }
      }

      return expense;
    },
    onSuccess: (expense) => {
      logAction("Operations-Expenses", "INSERT", expense.id, null, { description: form.description, amount: form.amount }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setExpenseDialogOpen(false);
      resetForm();
      toast.success("Expense added");
    },
    onError: (e) => toast.error(e.message),
  });

  // Expense update
  const updateExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!editingExpense) return;
      const { error } = await supabase.from("expenses").update({
        description: form.description,
        category_id: form.category_id,
        currency: form.currency,
        amount: Number(form.amount),
        beneficiary_name: form.detail || null,
      } as any).eq("id", editingExpense.id);
      if (error) throw error;

      // Replace stakeholders
      await supabase.from("expense_stakeholders").delete().eq("expense_id", editingExpense.id);
      if (form.stakeholder_ids.length > 0) {
        await supabase.from("expense_stakeholders").insert(
          form.stakeholder_ids.map((vendor_id) => ({ expense_id: editingExpense.id, vendor_id }))
        );
      }

      // Replace links
      await supabase.from("expense_links").delete().eq("expense_id", editingExpense.id);
      const validLinks = form.links.filter((l) => l.url.trim());
      if (validLinks.length > 0) {
        await supabase.from("expense_links").insert(
          validLinks.map((l) => ({ expense_id: editingExpense.id, title: l.title || null, url: l.url }))
        );
      }
    },
    onSuccess: () => {
      logAction("Operations-Expenses", "UPDATE", editingExpense?.id || "", editingExpense as any, { description: form.description, amount: form.amount }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setEditingExpense(null);
      resetForm();
      toast.success("Expense updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("expense_stakeholders").delete().eq("expense_id", id);
      await supabase.from("expense_links").delete().eq("expense_id", id);
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      logAction("Operations-Expenses", "DELETE", id, null, null, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setDeleteId(null);
      toast.success("Expense deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      for (const id of ids) {
        await supabase.from("expense_stakeholders").delete().eq("expense_id", id);
        await supabase.from("expense_links").delete().eq("expense_id", id);
      }
      const { error } = await supabase.from("expenses").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setSelected(new Set());
      setBulkDeleteOpen(false);
      toast.success("Expenses deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ description: "", detail: "", category_id: null, currency: "MAD", amount: "", stakeholder_ids: [], links: [] });
  }

  async function openEdit(e: Expense) {
    // Load stakeholders
    const { data: sData } = await supabase.from("expense_stakeholders").select("vendor_id").eq("expense_id", e.id);
    const stakeholderIds = (sData || []).map((s) => s.vendor_id).filter(Boolean) as string[];

    // Load links
    const { data: lData } = await supabase.from("expense_links").select("title, url").eq("expense_id", e.id);
    const links = (lData || []).map((l) => ({ title: l.title || "", url: l.url || "" }));

    setForm({
      description: e.description,
      detail: e.beneficiary_name || "",
      category_id: e.category_id || null,
      currency: e.currency || "MAD",
      amount: String(e.amount),
      stakeholder_ids: stakeholderIds,
      links,
    });
    setEditingExpense(e);
  }

  async function openView(e: Expense) {
    const { data: sData } = await supabase.from("expense_stakeholders").select("vendor_id").eq("expense_id", e.id);
    const ids = (sData || []).map((s) => s.vendor_id).filter(Boolean) as string[];
    setViewStakeholders(ids);

    const { data: lData } = await supabase.from("expense_links").select("title, url").eq("expense_id", e.id);
    setViewLinks((lData || []).map((l) => ({ title: l.title || "", url: l.url || "" })));
    setViewing(e);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll() {
    if (selected.size === expenses.length) setSelected(new Set());
    else setSelected(new Set(expenses.map((e) => e.id)));
  }

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "—";
    return categories.find((c) => c.id === catId)?.name || "—";
  };

  // Inline creation: Budget Category (duplicate-safe)
  async function handleCreateCategory(name: string): Promise<string | null> {
    const trimmed = name.trim();
    const existing = categories.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      toast.info(`"${existing.name}" already exists — selected it.`);
      return existing.id;
    }
    const { data, error } = await supabase.from("budget_categories").insert({ name: trimmed }).select().single();
    if (error) { toast.error(error.message); return null; }
    queryClient.invalidateQueries({ queryKey: ["budget-categories-list"] });
    toast.success(`Category "${trimmed}" created`);
    return data.id;
  }

  // Delete budget category
  async function handleDeleteCategory(id: string) {
    const { error } = await supabase.from("budget_categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["budget-categories-list"] });
    if (form.category_id === id) setForm((f) => ({ ...f, category_id: null }));
    toast.success("Category deleted");
  }

  // Inline creation: Vendor (duplicate-safe)
  async function handleCreateVendor(name: string, type: string | null): Promise<string | null> {
    const trimmed = name.trim();
    const existing = vendors.find((v) => v.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      toast.info(`"${existing.name}" already exists — added it.`);
      return existing.id;
    }
    const { data, error } = await supabase.from("vendors").insert({ name: trimmed, type }).select().single();
    if (error) { toast.error(error.message); return null; }
    queryClient.invalidateQueries({ queryKey: ["vendors-list"] });
    toast.success(`Stakeholder "${trimmed}" created`);
    return data.id;
  }

  // Delete vendor
  async function handleDeleteVendor(id: string) {
    // Remove from current selection first
    setForm((f) => ({ ...f, stakeholder_ids: f.stakeholder_ids.filter((sid) => sid !== id) }));
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["vendors-list"] });
    toast.success("Stakeholder deleted");
  }

  const expenseFormContent = (
    <div className="space-y-6 py-2">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h3>
        <div className="space-y-2">
          <Label>Title / Description</Label>
          <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Venue rental for Demo Day" />
        </div>
        <div className="space-y-2">
          <Label>Details</Label>
          <Textarea value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="Additional details..." rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Budget Category</Label>
            <SearchableSelect
              value={form.category_id}
              onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
              options={categoryOptions}
              placeholder="Select category..."
              searchPlaceholder="Search categories..."
              onCreateNew={handleCreateCategory}
              createLabel="Add new category"
              onDelete={handleDeleteCategory}
            />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MAD">MAD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
        </div>
      </div>

      {/* Stakeholders */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Stakeholders</h3>
        <VendorMultiSelect
          value={form.stakeholder_ids}
          onChange={(ids) => setForm((f) => ({ ...f, stakeholder_ids: ids }))}
          options={vendors}
          onCreateNew={handleCreateVendor}
        />
      </div>

      {/* Links */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Links</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm((f) => ({ ...f, links: [...f.links, { title: "", url: "" }] }))}
          >
            <Plus className="mr-1 h-3 w-3" /> Add Link
          </Button>
        </div>
        {form.links.length === 0 && (
          <p className="text-sm text-muted-foreground">No links added yet.</p>
        )}
        {form.links.map((link, i) => (
          <div key={i} className="flex gap-2 items-start">
            <Input
              placeholder="Title"
              value={link.title}
              onChange={(e) => {
                const updated = [...form.links];
                updated[i] = { ...updated[i], title: e.target.value };
                setForm((f) => ({ ...f, links: updated }));
              }}
              className="flex-1"
            />
            <Input
              placeholder="https://..."
              value={link.url}
              onChange={(e) => {
                const updated = [...form.links];
                updated[i] = { ...updated[i], url: e.target.value };
                setForm((f) => ({ ...f, links: updated }));
              }}
              className="flex-[2]"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => {
                setForm((f) => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }));
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Cohort-based expense tracking</p>
        </div>
        <CohortSelector
          cohorts={cohorts}
          selectedId={activeCohortId}
          onSelect={(id) => setSelectedCohortId(id)}
          onCreateNew={() => { setEditingCohort(null); setCohortForm({ name: "", year: String(new Date().getFullYear()), total_budget: "" }); setCohortDialogOpen(true); }}
          onEdit={() => {
            if (activeCohort) {
              setEditingCohort(activeCohort);
              setCohortForm({ name: activeCohort.name, year: String(activeCohort.year), total_budget: String(activeCohort.total_budget || 0) });
              setCohortDialogOpen(true);
            }
          }}
          onDelete={() => activeCohortId && setDeleteCohortId(activeCohortId)}
        />
      </div>

      {/* Budget Summary */}
      {activeCohort && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <PiggyBank className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Budget</p>
                <p className="text-xl font-bold">{totalBudget.toLocaleString()} MAD</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Expenses</p>
                <p className="text-xl font-bold">{totalExpenses.toLocaleString()} MAD</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", remaining >= 0 ? "bg-emerald-500/10" : "bg-destructive/10")}>
                <Wallet className={cn("h-5 w-5", remaining >= 0 ? "text-emerald-600" : "text-destructive")} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Remaining</p>
                <p className={cn("text-xl font-bold", remaining < 0 && "text-destructive")}>{remaining.toLocaleString()} MAD</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!activeCohort ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">No cohort selected. Create one to start tracking expenses.</p>
            <Button onClick={() => setCohortDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Cohort
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div>
              {selected.size > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
                  <span className="text-sm font-medium">{selected.size} selected</span>
                  <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                  </Button>
                </div>
              )}
            </div>
            <Button onClick={() => { resetForm(); setExpenseDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Expense
            </Button>
          </div>

          {/* Expenses Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={expenses.length > 0 && selected.size === expenses.length} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : expenses.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No expenses yet for this cohort</TableCell></TableRow>
                  ) : (
                    expenses.map((e) => (
                      <TableRow key={e.id} className={selected.has(e.id) ? "bg-muted/50" : ""}>
                        <TableCell><Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} /></TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{e.description}</TableCell>
                        <TableCell>{getCategoryName(e.category_id)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{e.currency || "MAD"}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{Number(e.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openView(e)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(e)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create/Edit Cohort Dialog */}
      <Dialog open={cohortDialogOpen} onOpenChange={(o) => { setCohortDialogOpen(o); if (!o) setEditingCohort(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingCohort ? "Edit Cohort" : "New Cohort"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={cohortForm.name} onChange={(e) => setCohortForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Cohort 5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" value={cohortForm.year} onChange={(e) => setCohortForm((f) => ({ ...f, year: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Total Budget (MAD)</Label>
                <Input type="number" value={cohortForm.total_budget} onChange={(e) => setCohortForm((f) => ({ ...f, total_budget: e.target.value }))} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => editingCohort ? updateCohortMutation.mutate() : createCohortMutation.mutate()}
              disabled={!cohortForm.name || !cohortForm.year}
            >
              {editingCohort ? "Save Changes" : "Create Cohort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
          {expenseFormContent}
          <DialogFooter>
            <Button onClick={() => addExpenseMutation.mutate()} disabled={!form.description || !form.amount}>
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(o) => !o && setEditingExpense(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          {expenseFormContent}
          <DialogFooter>
            <Button onClick={() => updateExpenseMutation.mutate()} disabled={!form.description || !form.amount}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialogs */}
      <ConfirmDeleteDialog open={!!deleteCohortId} onConfirm={() => deleteCohortId && deleteCohortMutation.mutate(deleteCohortId)} onCancel={() => setDeleteCohortId(null)} />
      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onConfirm={() => bulkDeleteMutation.mutate()} onCancel={() => setBulkDeleteOpen(false)} />

      {/* View Dialog */}
      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Expense Details"
        fields={viewing ? [
          { label: "Description", value: viewing.description },
          { label: "Details", value: viewing.beneficiary_name || "—" },
          { label: "Category", value: getCategoryName(viewing.category_id) },
          { label: "Currency", value: viewing.currency || "MAD" },
          { label: "Amount", value: `${Number(viewing.amount).toLocaleString()} ${viewing.currency || "MAD"}` },
          { label: "Stakeholders", value: viewStakeholders.length > 0 ? vendors.filter((v) => viewStakeholders.includes(v.id)).map((v) => v.name).join(", ") : "—" },
          { label: "Links", value: viewLinks.length > 0 ? viewLinks.map((l) => `${l.title || "Link"}: ${l.url}`).join("\n") : "—" },
          { label: "Date", value: viewing.created_at ? new Date(viewing.created_at).toLocaleDateString() : "—" },
        ] : []}
      />
    </div>
  );
}
