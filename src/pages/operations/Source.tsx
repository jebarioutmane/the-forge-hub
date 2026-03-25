import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/logAction";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import ViewDetailDialog from "@/components/ViewDetailDialog";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import type { Tables } from "@/integrations/supabase/types";

type Budget = Tables<"budgets">;
type BudgetCategory = Tables<"budget_categories">;

export default function Source() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Budget | null>(null);
  const [form, setForm] = useState({ category: "", total_amount: "" });

  // Also manage budget_categories for the relational dropdown source
  const [catAddOpen, setCatAddOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<BudgetCategory | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [viewingCat, setViewingCat] = useState<BudgetCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", total_amount: "" });

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*").order("category");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ["budget-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const totalMaster = budgets.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const totalCatBudget = categories.reduce((sum, c) => sum + Number(c.total_amount || 0), 0);

  // Budget mutations (keep existing)
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("budgets").insert({
        category: form.category,
        total_amount: Number(form.total_amount),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      logAction("Operations-Budgets", "INSERT", "new", null, { category: form.category, total_amount: form.total_amount }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setAddOpen(false);
      resetForm();
      toast.success("Budget category added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("budgets").update({
        category: form.category,
        total_amount: Number(form.total_amount),
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      logAction("Operations-Budgets", "UPDATE", editing?.id || "", editing as any, { category: form.category, total_amount: form.total_amount }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setEditing(null);
      resetForm();
      toast.success("Budget updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const deleted = budgets.find(b => b.id === id);
      logAction("Operations-Budgets", "DELETE", id, deleted as any, null, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setDeleteId(null);
      toast.success("Budget deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Budget category mutations
  const addCatMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("budget_categories").insert({
        name: catForm.name,
        total_amount: catForm.total_amount ? Number(catForm.total_amount) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      logAction("Operations-BudgetCategories", "INSERT", "new", null, { name: catForm.name, total_amount: catForm.total_amount }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["budget-categories", "budget-categories-list"] });
      setCatAddOpen(false);
      resetCatForm();
      toast.success("Category added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCatMutation = useMutation({
    mutationFn: async () => {
      if (!editingCat) return;
      const { error } = await supabase.from("budget_categories").update({
        name: catForm.name,
        total_amount: catForm.total_amount ? Number(catForm.total_amount) : 0,
      }).eq("id", editingCat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      logAction("Operations-BudgetCategories", "UPDATE", editingCat?.id || "", editingCat as any, { name: catForm.name, total_amount: catForm.total_amount }, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["budget-categories", "budget-categories-list"] });
      setEditingCat(null);
      resetCatForm();
      toast.success("Category updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      const deleted = categories.find(c => c.id === id);
      logAction("Operations-BudgetCategories", "DELETE", id, deleted as any, null, user?.email || "Unknown");
      queryClient.invalidateQueries({ queryKey: ["budget-categories", "budget-categories-list"] });
      setDeleteCatId(null);
      toast.success("Category deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ category: "", total_amount: "" });
  }

  function resetCatForm() {
    setCatForm({ name: "", total_amount: "" });
  }

  function openEdit(b: Budget) {
    setForm({ category: b.category, total_amount: String(b.total_amount) });
    setEditing(b);
  }

  function openEditCat(c: BudgetCategory) {
    setCatForm({ name: c.name, total_amount: String(c.total_amount || 0) });
    setEditingCat(c);
  }

  const formContent = (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Category Name</Label>
        <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Stipends, Events, Marketing" />
      </div>
      <div className="space-y-2">
        <Label>Total Amount (MAD)</Label>
        <Input type="number" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} />
      </div>
    </div>
  );

  const catFormContent = (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Category Name</Label>
        <Input value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Marketing, Logistics" />
      </div>
      <div className="space-y-2">
        <Label>Budget Amount (MAD)</Label>
        <Input type="number" value={catForm.total_amount} onChange={(e) => setCatForm((f) => ({ ...f, total_amount: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Budget Categories Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Budget Source</h1>
            <p className="text-sm text-muted-foreground">Manage budget categories used across expenses</p>
          </div>
          <Button onClick={() => { resetCatForm(); setCatAddOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget (MAD)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : categories.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No budget categories yet</TableCell></TableRow>
                ) : (
                  <>
                    {categories.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{Number(c.total_amount || 0).toLocaleString()} MAD</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewingCat(c)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditCat(c)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteCatId(c.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total Categories Budget</TableCell>
                      <TableCell className="text-right">{totalCatBudget.toLocaleString()} MAD</TableCell>
                      <TableCell />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Legacy Budgets Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Legacy Budget Allocations</h2>
            <p className="text-sm text-muted-foreground">Original budget allocations by category</p>
          </div>
          <Button variant="outline" onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Allocation</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount (MAD)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : budgets.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No budget allocations yet</TableCell></TableRow>
                ) : (
                  <>
                    {budgets.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.category}</TableCell>
                        <TableCell className="text-right">{Number(b.total_amount).toLocaleString()} MAD</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(b)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(b)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total Master Budget</TableCell>
                      <TableCell className="text-right">{totalMaster.toLocaleString()} MAD</TableCell>
                      <TableCell />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Budget allocation dialogs */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Budget Allocation</DialogTitle></DialogHeader>
          {formContent}
          <DialogFooter>
            <Button onClick={() => addMutation.mutate()} disabled={!form.category || !form.total_amount}>Add Allocation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Budget Allocation</DialogTitle></DialogHeader>
          {formContent}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!form.category || !form.total_amount}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Budget Details"
        fields={viewing ? [
          { label: "Category", value: viewing.category },
          { label: "Total Amount", value: `${Number(viewing.total_amount).toLocaleString()} MAD` },
          { label: "Currency", value: viewing.currency },
          { label: "Fiscal Year", value: viewing.fiscal_year },
        ] : []}
      />

      {/* Budget category dialogs */}
      <Dialog open={catAddOpen} onOpenChange={setCatAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Budget Category</DialogTitle></DialogHeader>
          {catFormContent}
          <DialogFooter>
            <Button onClick={() => addCatMutation.mutate()} disabled={!catForm.name}>Add Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCat} onOpenChange={(o) => !o && setEditingCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Budget Category</DialogTitle></DialogHeader>
          {catFormContent}
          <DialogFooter>
            <Button onClick={() => updateCatMutation.mutate()} disabled={!catForm.name}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteCatId} onConfirm={() => deleteCatId && deleteCatMutation.mutate(deleteCatId)} onCancel={() => setDeleteCatId(null)} />

      <ViewDetailDialog
        open={!!viewingCat}
        onClose={() => setViewingCat(null)}
        title="Category Details"
        fields={viewingCat ? [
          { label: "Name", value: viewingCat.name },
          { label: "Budget Amount", value: `${Number(viewingCat.total_amount || 0).toLocaleString()} MAD` },
        ] : []}
      />
    </div>
  );
}
