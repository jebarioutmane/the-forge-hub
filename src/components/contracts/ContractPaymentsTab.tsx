import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { useContractMutations, type ContractPayment, type ContractRow } from "@/hooks/useContracts";

interface Props {
  contract: ContractRow;
  payments: ContractPayment[];
  currency: string;
  totalValue: number;
}

export default function ContractPaymentsTab({ contract, payments, currency, totalValue }: Props) {
  const { addPayment, updatePayment, deletePayment } = useContractMutations();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", payment_date: "", status: "pending" });

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
  const remaining = totalValue - totalPaid;
  const pctPaid = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0;

  function handleAdd() {
    if (!form.amount) return;
    addPayment.mutate({
      contract_id: contract.id,
      amount: Number(form.amount),
      payment_date: form.payment_date || null,
      status: form.status,
      expense_id: null,
    });
    setForm({ amount: "", payment_date: "", status: "pending" });
    setShowForm(false);
  }

  function toggleStatus(p: ContractPayment) {
    updatePayment.mutate({ id: p.id, status: p.status === "paid" ? "pending" : "paid" });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Paid</p>
          <p className="font-bold text-emerald-600">{totalPaid.toLocaleString()} {currency}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className="font-bold text-orange-600">{remaining.toLocaleString()} {currency}</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground">Progress</p>
          <div className="mt-1">
            <Progress value={pctPaid} className="h-2" />
            <p className="text-xs mt-1 font-medium">{pctPaid}%</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="mr-1 h-3 w-3" /> Add Payment
        </Button>
      </div>

      {showForm && (
        <div className="grid grid-cols-4 gap-3 items-end rounded-lg border p-3 bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">Amount *</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.payment_date} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8" onClick={handleAdd} disabled={!form.amount}>Add</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No payments recorded yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">{p.payment_date || "—"}</TableCell>
                <TableCell className="text-right font-medium">{Number(p.amount).toLocaleString()} {currency}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`cursor-pointer ${p.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}`}
                    onClick={() => toggleStatus(p)}
                  >
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deletePayment.mutate(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
