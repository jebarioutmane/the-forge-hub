import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import {
  useContractMutations, isCommitted, isPaid,
  type ContractPayment, type ContractRow,
} from "@/hooks/useContracts";
import { cn } from "@/lib/utils";

const PAYMENT_STATUSES = ["pending", "scheduled", "committed", "paid"] as const;

function statusTone(s: string) {
  switch (s) {
    case "paid": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "committed": return "bg-amber-50 text-amber-700 border-amber-200";
    case "scheduled": return "bg-blue-50 text-blue-700 border-blue-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", payment_date: "", status: "pending" });

  const totalPaid = payments.filter((p) => isPaid(p.status)).reduce((s, p) => s + Number(p.amount), 0);
  const totalCommitted = payments.filter((p) => isCommitted(p.status)).reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(totalValue - totalPaid, 0);
  const pctPaid = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0;
  const pctCommitted = totalValue > 0 ? Math.round((totalCommitted / totalValue) * 100) : 0;

  /** Stamp paid_at + budget_line_id when moving to paid; clear when leaving paid. */
  function statusPayload(newStatus: string, existing?: ContractPayment) {
    if (isPaid(newStatus)) {
      return {
        status: newStatus,
        paid_at: existing?.paid_at || new Date().toISOString(),
        budget_line_id: existing?.budget_line_id || contract.budget_line_id || null,
      };
    }
    return { status: newStatus, paid_at: null, budget_line_id: null };
  }

  function handleAdd() {
    if (!form.amount) return;
    const stamp = statusPayload(form.status);
    addPayment.mutate({
      contract_id: contract.id,
      amount: Number(form.amount),
      payment_date: form.payment_date || null,
      status: stamp.status,
      paid_at: stamp.paid_at,
      budget_line_id: stamp.budget_line_id,
      expense_id: null,
    });
    setForm({ amount: "", payment_date: "", status: "pending" });
    setShowForm(false);
  }

  function startEdit(p: ContractPayment) {
    setEditingId(p.id);
    setEditForm({ amount: String(p.amount), payment_date: p.payment_date || "", status: p.status });
  }

  function saveEdit(p: ContractPayment) {
    const stamp = statusPayload(editForm.status, p);
    updatePayment.mutate({
      id: p.id,
      amount: Number(editForm.amount),
      payment_date: editForm.payment_date || null,
      status: stamp.status,
      paid_at: stamp.paid_at,
      budget_line_id: stamp.budget_line_id,
    });
    setEditingId(null);
  }

  function changeStatus(p: ContractPayment, newStatus: string) {
    const stamp = statusPayload(newStatus, p);
    updatePayment.mutate({ id: p.id, ...stamp });
  }

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryTile label="Committed" value={totalCommitted} currency={currency} tone="text-amber-700" pct={pctCommitted} />
        <SummaryTile label="Paid" value={totalPaid} currency={currency} tone="text-emerald-700" pct={pctPaid} />
        <SummaryTile label="Remaining" value={remaining} currency={currency} tone="text-foreground" />
        <SummaryTile label="Contract Value" value={totalValue} currency={currency} tone="text-muted-foreground" />
      </div>

      {!contract.budget_line_id && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          This contract has no budget line set. Paid payments will not be linked to a budget until you add one in the Overview tab.
        </p>
      )}

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
                {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
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
        <p className="text-sm text-muted-foreground text-center py-8">No payments recorded yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid At</TableHead>
              <TableHead className="text-right w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => {
              const isEditing = editingId === p.id;
              return (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">
                    {isEditing ? (
                      <Input type="date" value={editForm.payment_date} onChange={(e) => setEditForm((f) => ({ ...f, payment_date: e.target.value }))} className="h-7 w-36" />
                    ) : (p.payment_date || "—")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {isEditing ? (
                      <Input type="number" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} className="h-7 w-28 ml-auto text-right" />
                    ) : (`${Number(p.amount).toLocaleString()} ${currency}`)}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                        <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={p.status} onValueChange={(v) => changeStatus(p, v)}>
                        <SelectTrigger className={cn("h-7 w-32 border capitalize", statusTone(p.status))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(p)}><Check className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deletePayment.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function SummaryTile({ label, value, currency, tone, pct }: { label: string; value: number; currency: string; tone: string; pct?: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-semibold text-sm mt-0.5", tone)}>{value.toLocaleString()} {currency}</p>
      {typeof pct === "number" && <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% of value</p>}
    </div>
  );
}
