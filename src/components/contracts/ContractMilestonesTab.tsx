import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useContractMutations, type ContractMilestone, type ContractRow } from "@/hooks/useContracts";

interface Props {
  contract: ContractRow;
  milestones: ContractMilestone[];
  currency: string;
}

export default function ContractMilestonesTab({ contract, milestones, currency }: Props) {
  const { addMilestone, updateMilestone, deleteMilestone } = useContractMutations();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", payment_amount: "" });

  const isMilestoneBased = (contract as any).payment_structure === "milestone-based";

  function handleAdd() {
    if (!form.title) return;
    addMilestone.mutate({
      contract_id: contract.id,
      title: form.title,
      description: form.description || null,
      due_date: form.due_date || null,
      payment_amount: form.payment_amount ? Number(form.payment_amount) : 0,
      status: "pending",
    });
    setForm({ title: "", description: "", due_date: "", payment_amount: "" });
    setShowForm(false);
  }

  function toggleStatus(m: ContractMilestone) {
    updateMilestone.mutate({ id: m.id, status: m.status === "completed" ? "pending" : "completed" });
  }

  if (!isMilestoneBased) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Milestones are only available for milestone-based contracts.</p>
        <p className="text-xs text-muted-foreground mt-1">Change the payment structure to "milestone-based" to enable this feature.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="mr-1 h-3 w-3" /> Add Milestone
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Amount</Label>
              <Input type="number" value={form.payment_amount} onChange={(e) => setForm((f) => ({ ...f, payment_amount: e.target.value }))} className="h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="h-8" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8" onClick={handleAdd} disabled={!form.title}>Add</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No milestones added yet</p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <Card key={m.id} className="group">
              <CardContent className="p-4 flex items-start gap-3">
                <button onClick={() => toggleStatus(m)} className="mt-0.5 shrink-0">
                  {m.status === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${m.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{m.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {m.payment_amount ? `${Number(m.payment_amount).toLocaleString()} ${currency}` : "No payment"}
                    </Badge>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                  {m.due_date && <p className="text-xs text-muted-foreground mt-1">Due: {m.due_date}</p>}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteMilestone.mutate(m.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
