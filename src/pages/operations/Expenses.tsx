import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { useVendors } from "@/hooks/useRelationalData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, X, PiggyBank, TrendingDown, Wallet, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Expense = Tables<"expenses">;
type Cohort = Tables<"cohorts">;
type BudgetLine = Tables<"budget_lines">;

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

/* ─── Generic Multi-Select with Inline Creation ─── */
function MultiSelectPicker({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  onCreateNew,
  createLabel,
  onDelete,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  options: { id: string; label: string; sublabel?: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  onCreateNew?: (name: string) => Promise<string | null>;
  createLabel?: string;
  onDelete?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  async function handleCreate() {
    if (!newName.trim() || !onCreateNew) return;
    setSaving(true);
    const newId = await onCreateNew(newName.trim());
    setSaving(false);
    if (newId) {
      onChange([...value, newId]);
      setIsCreating(false);
      setNewName("");
    }
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setIsCreating(false); setNewName(""); } }}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-9">
            <span className="truncate text-left">
              {value.length > 0 ? `${value.length} selected` : placeholder || "Select..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder={searchPlaceholder || "Search..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-[200px]">
            {filtered.length === 0 && !isCreating ? (
              <p className="text-sm text-muted-foreground text-center py-4">No results found</p>
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
                          onChange(isSelected ? value.filter((id) => id !== option.id) : [...value, option.id]);
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                      >
                        <Check className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{option.label}</span>
                          {option.sublabel && (
                            <span className="text-xs text-muted-foreground truncate">{option.sublabel}</span>
                          )}
                        </div>
                      </button>
                      {onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(option.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-destructive shrink-0 transition-opacity"
                          title="Delete"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {onCreateNew && (
            <div className="border-t p-1">
              {isCreating ? (
                <div className="flex items-center gap-1.5 p-1">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name..."
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setIsCreating(false); }}
                  />
                  <Button size="sm" className="h-8 px-2.5 shrink-0" onClick={handleCreate} disabled={!newName.trim() || saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-primary font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {createLabel || "Add new"}
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options
            .filter((o) => value.includes(o.id))
            .map((o) => (
              <Badge key={o.id} variant="secondary" className="gap-1 pr-1">
                {o.label}
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

/* ─── Vendor Multi-Select with Type Field ─── */
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
              {value.length > 0 ? `${value.length} selected` : "Select stakeholders..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2">
            <Input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" autoFocus />
          </div>
          <ScrollArea className="max-h-[200px]">
            {filtered.length === 0 && !isCreating ? (
              <p className="text-sm text-muted-foreground text-center py-4">No vendors found</p>
            ) : (
              <div className="p-1">
                {filtered.map((option) => {
                  const isSelected = value.includes(option.id);
                  return (
                    <div key={option.id} className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left group", isSelected && "bg-accent")}>
                      <button
                        onClick={() => onChange(isSelected ? value.filter((id) => id !== option.id) : [...value, option.id])}
                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                      >
                        <Check className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{option.name}</span>
                          {option.type && <span className="text-xs text-muted-foreground truncate">{option.type}</span>}
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

          {onCreateNew && (
            <div className="border-t p-1">
              {isCreating ? (
                <div className="space-y-1.5 p-1">
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vendor name..." className="h-8 text-sm" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setIsCreating(false); }} />
                  <div className="flex items-center gap-1.5">
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Type (optional)" /></SelectTrigger>
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
                <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-primary font-medium">
                  <Plus className="h-3.5 w-3.5" /> Add new stakeholder
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.filter((o) => value.includes(o.id)).map((o) => (
            <Badge key={o.id} variant="secondary" className="gap-1 pr-1">
              {o.name}
              <button onClick={() => onChange(value.filter((id) => id !== o.id))} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
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

  // Budget line management
  const [budgetLineDialogOpen, setBudgetLineDialogOpen] = useState(false);
  const [editingBudgetLine, setEditingBudgetLine] = useState<BudgetLine | null>(null);
  const [deleteBudgetLineId, setDeleteBudgetLineId] = useState<string | null>(null);
  const [budgetLineForm, setBudgetLineForm] = useState({ name: "", code: "", allocated_amount: "" });

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [form, setForm] = useState({
    description: "",
    detail: "",
    budget_line_id: null as string | null,
    category_ids: [] as string[],
    currency: "MAD",
    amount: "",
    stakeholder_ids: [] as string[],
    links: [] as { title: string; url: string }[],
  });

  const { data: vendors = [] } = useVendors();

  // Expense categories
  const { data: expenseCategories = [] } = useQuery({
    queryKey: ["expense-categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const categoryOptions = expenseCategories.map((c) => ({
    id: c.id,
    label: c.name,
  }));

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cohorts").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const activeCohortId = selectedCohortId || (cohorts.length > 0 ? cohorts[0].id : null);
  const activeCohort = cohorts.find((c) => c.id === activeCohortId);

  // Budget lines for active cohort
  const { data: budgetLines = [] } = useQuery({
    queryKey: ["budget-lines", activeCohortId],
    queryFn: async () => {
      if (!activeCohortId) return [];
      const { data, error } = await supabase.from("budget_lines").select("*").eq("cohort_id", activeCohortId).order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!activeCohortId,
  });

  const budgetLineOptions = budgetLines.map((bl) => ({
    id: bl.id,
    label: bl.code ? `${bl.code} — ${bl.name}` : bl.name,
    sublabel: bl.allocated_amount ? `${Number(bl.allocated_amount).toLocaleString()} MAD` : undefined,
  }));

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

  const [viewStakeholders, setViewStakeholders] = useState<string[]>([]);
  const [viewLinks, setViewLinks] = useState<{ title: string; url: string }[]>([]);
  const [viewCategoryIds, setViewCategoryIds] = useState<string[]>([]);

  const totalBudget = Number(activeCohort?.total_budget || 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const remaining = totalBudget - totalExpenses;

  // ─── Cohort Mutations ───
  const createCohortMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("cohorts").insert({
        name: cohortForm.name,
        label: cohortForm.name,
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

  const deleteCohortMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: expenseIds } = await supabase.from("expenses").select("id").eq("cohort_id", id);
      if (expenseIds && expenseIds.length > 0) {
        const ids = expenseIds.map((e) => e.id);
        await supabase.from("expense_stakeholders").delete().in("expense_id", ids);
        await supabase.from("expense_links").delete().in("expense_id", ids);
        await supabase.from("expense_category_links").delete().in("expense_id", ids);
        await supabase.from("expenses").delete().eq("cohort_id", id);
      }
      await supabase.from("budget_lines").delete().eq("cohort_id", id);
      const { error } = await supabase.from("cohorts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["budget-lines"] });
      setSelectedCohortId(null);
      setDeleteCohortId(null);
      toast.success("Cohort deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Budget Line Mutations ───
  const createBudgetLineMutation = useMutation({
    mutationFn: async () => {
      const trimmedCode = budgetLineForm.code.trim();
      if (trimmedCode) {
        const dup = budgetLines.find((bl) => bl.code?.trim().toLowerCase() === trimmedCode.toLowerCase());
        if (dup) throw new Error(`Code "${trimmedCode}" already exists in this cohort`);
      }
      const { data, error } = await supabase.from("budget_lines").insert({
        name: budgetLineForm.name.trim(),
        code: trimmedCode || null,
        cohort_id: activeCohortId,
        allocated_amount: budgetLineForm.allocated_amount ? Number(budgetLineForm.allocated_amount) : 0,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-lines"] });
      setBudgetLineDialogOpen(false);
      setBudgetLineForm({ name: "", code: "", allocated_amount: "" });
      toast.success("Budget line created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateBudgetLineMutation = useMutation({
    mutationFn: async () => {
      if (!editingBudgetLine) return;
      const trimmedCode = budgetLineForm.code.trim();
      if (trimmedCode) {
        const dup = budgetLines.find((bl) => bl.id !== editingBudgetLine.id && bl.code?.trim().toLowerCase() === trimmedCode.toLowerCase());
        if (dup) throw new Error(`Code "${trimmedCode}" already exists in this cohort`);
      }
      const { error } = await supabase.from("budget_lines").update({
        name: budgetLineForm.name.trim(),
        code: trimmedCode || null,
        allocated_amount: budgetLineForm.allocated_amount ? Number(budgetLineForm.allocated_amount) : 0,
      }).eq("id", editingBudgetLine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-lines"] });
      setBudgetLineDialogOpen(false);
      setEditingBudgetLine(null);
      setBudgetLineForm({ name: "", code: "", allocated_amount: "" });
      toast.success("Budget line updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteBudgetLineMutation = useMutation({
    mutationFn: async (id: string) => {
      // Unlink expenses from this budget line
      await supabase.from("expenses").update({ budget_line_id: null } as any).eq("budget_line_id", id);
      const { error } = await supabase.from("budget_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-lines"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setDeleteBudgetLineId(null);
      toast.success("Budget line deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Inline create budget line from dropdown
  async function handleCreateBudgetLine(name: string): Promise<string | null> {
    const trimmed = name.trim();
    const existing = budgetLines.find((bl) => bl.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      toast.info(`"${existing.name}" already exists — selected it.`);
      return existing.id;
    }
    const { data, error } = await supabase.from("budget_lines").insert({
      name: trimmed,
      cohort_id: activeCohortId,
    }).select().single();
    if (error) { toast.error(error.message); return null; }
    queryClient.invalidateQueries({ queryKey: ["budget-lines"] });
    toast.success(`Budget line "${trimmed}" created`);
    return data.id;
  }

  // ─── Expense Mutations ───
  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const { data: expense, error } = await supabase.from("expenses").insert({
        cohort_id: activeCohortId,
        description: form.description,
        budget_line_id: form.budget_line_id,
        currency: form.currency,
        amount: Number(form.amount),
        beneficiary_name: form.detail || null,
      } as any).select().single();
      if (error) throw error;

      // Insert category links
      if (form.category_ids.length > 0) {
        await supabase.from("expense_category_links").insert(
          form.category_ids.map((category_id) => ({ expense_id: expense.id, category_id }))
        );
      }

      // Insert stakeholders
      if (form.stakeholder_ids.length > 0) {
        await supabase.from("expense_stakeholders").insert(
          form.stakeholder_ids.map((vendor_id) => ({ expense_id: expense.id, vendor_id }))
        );
      }

      // Insert links
      const validLinks = form.links.filter((l) => l.url.trim());
      if (validLinks.length > 0) {
        await supabase.from("expense_links").insert(
          validLinks.map((l) => ({ expense_id: expense.id, title: l.title || null, url: l.url }))
        );
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

  const updateExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!editingExpense) return;
      const { error } = await supabase.from("expenses").update({
        description: form.description,
        budget_line_id: form.budget_line_id,
        currency: form.currency,
        amount: Number(form.amount),
        beneficiary_name: form.detail || null,
      } as any).eq("id", editingExpense.id);
      if (error) throw error;

      // Replace category links
      await supabase.from("expense_category_links").delete().eq("expense_id", editingExpense.id);
      if (form.category_ids.length > 0) {
        await supabase.from("expense_category_links").insert(
          form.category_ids.map((category_id) => ({ expense_id: editingExpense.id, category_id }))
        );
      }

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
      await supabase.from("expense_category_links").delete().eq("expense_id", id);
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
        await supabase.from("expense_category_links").delete().eq("expense_id", id);
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
    setForm({ description: "", detail: "", budget_line_id: null, category_ids: [], currency: "MAD", amount: "", stakeholder_ids: [], links: [] });
  }

  async function openEdit(e: Expense) {
    const { data: sData } = await supabase.from("expense_stakeholders").select("vendor_id").eq("expense_id", e.id);
    const stakeholderIds = (sData || []).map((s) => s.vendor_id).filter(Boolean) as string[];

    const { data: lData } = await supabase.from("expense_links").select("title, url").eq("expense_id", e.id);
    const links = (lData || []).map((l) => ({ title: l.title || "", url: l.url || "" }));

    const { data: cData } = await supabase.from("expense_category_links").select("category_id").eq("expense_id", e.id);
    const catIds = (cData || []).map((c) => c.category_id).filter(Boolean) as string[];

    setForm({
      description: e.description,
      detail: e.beneficiary_name || "",
      budget_line_id: e.budget_line_id || null,
      category_ids: catIds,
      currency: e.currency || "MAD",
      amount: String(e.amount),
      stakeholder_ids: stakeholderIds,
      links,
    });
    setEditingExpense(e);
  }

  async function openView(e: Expense) {
    const { data: sData } = await supabase.from("expense_stakeholders").select("vendor_id").eq("expense_id", e.id);
    setViewStakeholders((sData || []).map((s) => s.vendor_id).filter(Boolean) as string[]);

    const { data: lData } = await supabase.from("expense_links").select("title, url").eq("expense_id", e.id);
    setViewLinks((lData || []).map((l) => ({ title: l.title || "", url: l.url || "" })));

    const { data: cData } = await supabase.from("expense_category_links").select("category_id").eq("expense_id", e.id);
    setViewCategoryIds((cData || []).map((c) => c.category_id).filter(Boolean) as string[]);

    setViewing(e);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll() {
    if (selected.size === expenses.length) setSelected(new Set());
    else setSelected(new Set(expenses.map((e) => e.id)));
  }

  const getBudgetLineName = (budgetId: string | null) => {
    if (!budgetId) return "—";
    const bl = budgetLines.find((b) => b.id === budgetId);
    if (!bl) return "—";
    return bl.code ? `${bl.code} — ${bl.name}` : bl.name;
  };

  // Inline creation: Expense Category (duplicate-safe)
  async function handleCreateCategory(name: string): Promise<string | null> {
    const trimmed = name.trim();
    const existing = expenseCategories.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      toast.info(`"${existing.name}" already exists — selected it.`);
      return existing.id;
    }
    const { data, error } = await supabase.from("expense_categories").insert({ name: trimmed }).select().single();
    if (error) { toast.error(error.message); return null; }
    queryClient.invalidateQueries({ queryKey: ["expense-categories-list"] });
    toast.success(`Category "${trimmed}" created`);
    return data.id;
  }

  async function handleDeleteCategory(id: string) {
    await supabase.from("expense_category_links").delete().eq("category_id", id);
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["expense-categories-list"] });
    setForm((f) => ({ ...f, category_ids: f.category_ids.filter((cid) => cid !== id) }));
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

  async function handleDeleteVendor(id: string) {
    setForm((f) => ({ ...f, stakeholder_ids: f.stakeholder_ids.filter((sid) => sid !== id) }));
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["vendors-list"] });
    toast.success("Stakeholder deleted");
  }

  async function handleDeleteBudgetLine(id: string) {
    setForm((f) => ({ ...f, budget_line_id: f.budget_line_id === id ? null : f.budget_line_id }));
    await supabase.from("expenses").update({ budget_line_id: null } as any).eq("budget_line_id", id);
    const { error } = await supabase.from("budget_lines").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["budget-lines"] });
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    toast.success("Budget line deleted");
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

        {/* Budget Line */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Budget Line</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => {
                setEditingBudgetLine(null);
                setBudgetLineForm({ name: "", code: "", allocated_amount: "" });
                setBudgetLineDialogOpen(true);
              }}
            >
              <Plus className="mr-1 h-3 w-3" /> Manage
            </Button>
          </div>
          <SearchableSelect
            value={form.budget_line_id}
            onValueChange={(v) => setForm((f) => ({ ...f, budget_line_id: v }))}
            options={budgetLineOptions}
            placeholder="Select budget line..."
            searchPlaceholder="Search budget lines..."
            onCreateNew={handleCreateBudgetLine}
            createLabel="Add budget line"
            onDelete={handleDeleteBudgetLine}
          />
        </div>

        {/* Categories (multi-select) */}
        <div className="space-y-2">
          <Label>Categories</Label>
          <MultiSelectPicker
            value={form.category_ids}
            onChange={(ids) => setForm((f) => ({ ...f, category_ids: ids }))}
            options={categoryOptions}
            placeholder="Select categories..."
            searchPlaceholder="Search categories..."
            onCreateNew={handleCreateCategory}
            createLabel="Add new category"
            onDelete={handleDeleteCategory}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
          </div>
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
          onDelete={handleDeleteVendor}
        />
      </div>

      {/* Links */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Links</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, links: [...f.links, { title: "", url: "" }] }))}>
            <Plus className="mr-1 h-3 w-3" /> Add Link
          </Button>
        </div>
        {form.links.length === 0 && <p className="text-sm text-muted-foreground">No links added yet.</p>}
        {form.links.map((link, i) => (
          <div key={i} className="flex gap-2 items-start">
            <Input placeholder="Title" value={link.title} onChange={(e) => { const updated = [...form.links]; updated[i] = { ...updated[i], title: e.target.value }; setForm((f) => ({ ...f, links: updated })); }} className="flex-1" />
            <Input placeholder="https://..." value={link.url} onChange={(e) => { const updated = [...form.links]; updated[i] = { ...updated[i], url: e.target.value }; setForm((f) => ({ ...f, links: updated })); }} className="flex-[2]" />
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setForm((f) => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }))}><X className="h-4 w-4" /></Button>
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
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><PiggyBank className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Budget</p>
                <p className="text-xl font-bold">{totalBudget.toLocaleString()} MAD</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-destructive" /></div>
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

      {/* Budget Lines Section */}
      {activeCohort && budgetLines.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Budget Lines</h3>
              <Button variant="outline" size="sm" onClick={() => { setEditingBudgetLine(null); setBudgetLineForm({ name: "", code: "", allocated_amount: "" }); setBudgetLineDialogOpen(true); }}>
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {budgetLines.map((bl) => (
                <div key={bl.id} className="group flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{bl.code || "—"}</span>
                  <span className="font-medium">{bl.name}</span>
                  <span className="text-xs text-muted-foreground">({Number(bl.allocated_amount || 0).toLocaleString()} MAD)</span>
                  <button
                    onClick={() => {
                      setEditingBudgetLine(bl);
                      setBudgetLineForm({ name: bl.name, code: bl.code || "", allocated_amount: String(bl.allocated_amount || 0) });
                      setBudgetLineDialogOpen(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-opacity"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setDeleteBudgetLineId(bl.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!activeCohort ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">No cohort selected. Create one to start tracking expenses.</p>
            <Button onClick={() => setCohortDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Cohort</Button>
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
                    <TableHead className="w-10"><Checkbox checked={expenses.length > 0 && selected.size === expenses.length} onCheckedChange={toggleAll} /></TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Budget Line</TableHead>
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
                        <TableCell className="text-sm">{getBudgetLineName(e.budget_line_id)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{e.currency || "MAD"}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{Number(e.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
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

      {/* Cohort Dialog */}
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
            <Button onClick={() => editingCohort ? updateCohortMutation.mutate() : createCohortMutation.mutate()} disabled={!cohortForm.name || !cohortForm.year}>
              {editingCohort ? "Save Changes" : "Create Cohort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget Line Dialog */}
      <Dialog open={budgetLineDialogOpen} onOpenChange={(o) => { setBudgetLineDialogOpen(o); if (!o) setEditingBudgetLine(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingBudgetLine ? "Edit Budget Line" : "New Budget Line"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={budgetLineForm.name} onChange={(e) => setBudgetLineForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Events" />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={budgetLineForm.code} onChange={(e) => setBudgetLineForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. EVT-2025-001" />
            </div>
            <div className="space-y-2">
              <Label>Allocated Amount (MAD)</Label>
              <Input type="number" value={budgetLineForm.allocated_amount} onChange={(e) => setBudgetLineForm((f) => ({ ...f, allocated_amount: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => editingBudgetLine ? updateBudgetLineMutation.mutate() : createBudgetLineMutation.mutate()}
              disabled={!budgetLineForm.name.trim()}
            >
              {editingBudgetLine ? "Save Changes" : "Create Budget Line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialogs */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
          {expenseFormContent}
          <DialogFooter>
            <Button onClick={() => addExpenseMutation.mutate()} disabled={!form.description || !form.amount}>Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingExpense} onOpenChange={(o) => !o && setEditingExpense(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          {expenseFormContent}
          <DialogFooter>
            <Button onClick={() => updateExpenseMutation.mutate()} disabled={!form.description || !form.amount}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialogs */}
      <ConfirmDeleteDialog open={!!deleteCohortId} onConfirm={() => deleteCohortId && deleteCohortMutation.mutate(deleteCohortId)} onCancel={() => setDeleteCohortId(null)} />
      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onConfirm={() => bulkDeleteMutation.mutate()} onCancel={() => setBulkDeleteOpen(false)} />
      <ConfirmDeleteDialog open={!!deleteBudgetLineId} onConfirm={() => deleteBudgetLineId && deleteBudgetLineMutation.mutate(deleteBudgetLineId)} onCancel={() => setDeleteBudgetLineId(null)} />

      {/* View Dialog */}
      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Expense Details"
        fields={viewing ? [
          { label: "Description", value: viewing.description },
          { label: "Details", value: viewing.beneficiary_name || "—" },
          { label: "Budget Line", value: getBudgetLineName(viewing.budget_line_id) },
          { label: "Categories", value: viewCategoryIds.length > 0 ? expenseCategories.filter((c) => viewCategoryIds.includes(c.id)).map((c) => c.name).join(", ") : "—" },
          { label: "Currency", value: viewing.currency || "MAD" },
          { label: "Amount", value: `${Number(viewing.amount).toLocaleString()} ${viewing.currency || "MAD"}` },
          { label: "Stakeholders", value: viewStakeholders.length > 0 ? vendors.filter((v) => viewStakeholders.includes(v.id)).map((v) => v.name).join(", ") : "—" },
          { label: "Links", value: viewLinks.length > 0 ? (
            <div className="flex flex-col gap-1">
              {viewLinks.map((l, i) => (
                <a key={i} href={/^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}`} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80 truncate">
                  {l.title || l.url}
                </a>
              ))}
            </div>
          ) : "—" },
          { label: "Date", value: viewing.created_at ? new Date(viewing.created_at).toLocaleDateString() : "—" },
        ] : []}
      />
    </div>
  );
}
