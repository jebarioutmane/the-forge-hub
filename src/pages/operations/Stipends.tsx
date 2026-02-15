import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, CheckCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Stipend = Tables<"stipends">;

export default function Stipends() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ founder_name: "", base_amount: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDeduction, setEditDeduction] = useState("");

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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipends"] });
      setOpen(false);
      setForm({ founder_name: "", base_amount: "" });
      toast.success("Stipend added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDeduction = useMutation({
    mutationFn: async ({ id, deductions }: { id: string; deductions: number }) => {
      const { error } = await supabase.from("stipends").update({ deductions }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stipends"] });
      setEditingId(null);
      toast.success("Deduction updated");
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

  const statusColor = (s: string) => {
    if (s === "Paid") return "default";
    return "secondary";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Stipend Manager</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Stipend</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Stipend</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Founder Name</Label>
                <Input value={form.founder_name} onChange={(e) => setForm((f) => ({ ...f, founder_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Base Amount (MAD)</Label>
                <Input type="number" value={form.base_amount} onChange={(e) => setForm((f) => ({ ...f, base_amount: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => addMutation.mutate()} disabled={!form.founder_name || !form.base_amount}>
                Add Stipend
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                    <TableCell className="text-right">
                      {editingId === s.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            className="w-24 h-8 text-right"
                            value={editDeduction}
                            onChange={(e) => setEditDeduction(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") updateDeduction.mutate({ id: s.id, deductions: Number(editDeduction) });
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={() => updateDeduction.mutate({ id: s.id, deductions: Number(editDeduction) })}>✓</Button>
                        </div>
                      ) : (
                        <button
                          className="hover:underline text-muted-foreground"
                          onClick={() => { setEditingId(s.id); setEditDeduction(String(s.deductions)); }}
                        >
                          {Number(s.deductions).toLocaleString()} MAD
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{Number(s.final_payout).toLocaleString()} MAD</TableCell>
                    <TableCell><Badge variant={statusColor(s.status)}>{s.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {s.status !== "Paid" && (
                        <Button size="sm" variant="outline" onClick={() => processPayment.mutate(s.id)}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
