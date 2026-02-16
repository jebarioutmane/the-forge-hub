import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, CheckCircle } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import type { Tables } from "@/integrations/supabase/types";

type Stipend = Tables<"stipends">;

export default function Stipends() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editingStipend, setEditingStipend] = useState<Stipend | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ founder_name: "", base_amount: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: stipends = [], isLoading } = useQuery({
    queryKey: ["stipends"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stipends").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stipends").insert({
        founder_name: form.founder_name,
        base_amount: Number(form.base_amount),
        deductions: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipends"] });
      setAddOpen(false);
      resetForm();
      toast.success("Stipend added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingStipend) return;
      const { error } = await supabase.from("stipends").update({
        founder_name: form.founder_name,
        base_amount: Number(form.base_amount),
      }).eq("id", editingStipend.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipends"] });
      setEditingStipend(null);
      resetForm();
      toast.success("Stipend updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stipends").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipends"] });
      setDeleteId(null);
      toast.success("Stipend deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("stipends").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipends"] });
      setSelected(new Set());
      setBulkDeleteOpen(false);
      toast.success("Stipends deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const processPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stipends").update({ status: "Paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipends"] });
      toast.success("Payment processed");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() { setForm({ founder_name: "", base_amount: "" }); }

  function openEdit(s: Stipend) {
    setForm({ founder_name: s.founder_name, base_amount: String(s.base_amount) });
    setEditingStipend(s);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAll() {
    if (selected.size === stipends.length) setSelected(new Set());
    else setSelected(new Set(stipends.map((s) => s.id)));
  }

  const statusColor = (s: string) => s === "Paid" ? "default" as const : "secondary" as const;

  const stipendFormContent = (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Founder Name</Label>
        <Input value={form.founder_name} onChange={(e) => setForm((f) => ({ ...f, founder_name: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Amount (MAD)</Label>
        <Input type="number" value={form.base_amount} onChange={(e) => setForm((f) => ({ ...f, base_amount: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Stipend Manager</h1>
        <Button onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Stipend</Button>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => { const first = stipends.find((s) => selected.has(s.id)); if (first) openEdit(first); }}>
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={stipends.length > 0 && selected.size === stipends.length} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Founder</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : stipends.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No stipends yet</TableCell></TableRow>
              ) : (
                stipends.map((s) => (
                  <TableRow key={s.id} className={selected.has(s.id) ? "bg-muted/50" : ""}>
                    <TableCell><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></TableCell>
                    <TableCell className="font-medium">{s.founder_name}</TableCell>
                    <TableCell className="text-right">{Number(s.base_amount).toLocaleString()} MAD</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                          {s.status !== "Paid" && (
                            <DropdownMenuItem onClick={() => processPayment.mutate(s.id)}><CheckCircle className="mr-2 h-3 w-3" /> Mark Paid</DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Stipend</DialogTitle></DialogHeader>
          {stipendFormContent}
          <DialogFooter>
            <Button onClick={() => addMutation.mutate()} disabled={!form.founder_name || !form.base_amount}>Add Stipend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingStipend} onOpenChange={(o) => !o && setEditingStipend(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Stipend</DialogTitle></DialogHeader>
          {stipendFormContent}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!form.founder_name || !form.base_amount}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onConfirm={() => bulkDeleteMutation.mutate()} onCancel={() => setBulkDeleteOpen(false)} />
    </div>
  );
}
