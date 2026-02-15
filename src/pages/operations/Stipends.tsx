import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const [form, setForm] = useState({ founder_name: "", base_amount: "", deductions: "0" });

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
        deductions: Number(form.deductions) || 0,
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
        deductions: Number(form.deductions) || 0,
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

  function resetForm() {
    setForm({ founder_name: "", base_amount: "", deductions: "0" });
  }

  function openEdit(s: Stipend) {
    setForm({
      founder_name: s.founder_name,
      base_amount: String(s.base_amount),
      deductions: String(s.deductions),
    });
    setEditingStipend(s);
  }

  const statusColor = (s: string) => s === "Paid" ? "default" as const : "secondary" as const;

  const stipendFormContent = (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Founder Name</Label>
        <Input value={form.founder_name} onChange={(e) => setForm((f) => ({ ...f, founder_name: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Base Amount (MAD)</Label>
        <Input type="number" value={form.base_amount} onChange={(e) => setForm((f) => ({ ...f, base_amount: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Deductions (MAD)</Label>
        <Input type="number" value={form.deductions} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Stipend Manager</h1>
        <Button onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Stipend</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Founder</TableHead>
                <TableHead className="text-right">Base Amount</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Final Payout</TableHead>
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
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.founder_name}</TableCell>
                    <TableCell className="text-right">{Number(s.base_amount).toLocaleString()} MAD</TableCell>
                    <TableCell className="text-right">{Number(s.deductions).toLocaleString()} MAD</TableCell>
                    <TableCell className="text-right font-semibold">{Number(s.final_payout).toLocaleString()} MAD</TableCell>
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

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Stipend</DialogTitle></DialogHeader>
          {stipendFormContent}
          <DialogFooter>
            <Button onClick={() => addMutation.mutate()} disabled={!form.founder_name || !form.base_amount}>Add Stipend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingStipend} onOpenChange={(o) => !o && setEditingStipend(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Stipend</DialogTitle></DialogHeader>
          {stipendFormContent}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!form.founder_name || !form.base_amount}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
