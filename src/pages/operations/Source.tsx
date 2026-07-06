import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, TrendingDown, PiggyBank, Flame, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

function fmtMAD(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

type BudgetLine = {
  id: string;
  cohort_id: string | null;
  name: string;
  code: string | null;
  allocated_amount: number | null;
  is_archived: boolean | null;
};

export default function Source() {
  const qc = useQueryClient();
  const { selectedCohortId, selectedCohortLabel, selectedCohort } = useCohort();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetLine | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const cohortScoped = selectedCohortId && selectedCohortId !== ALL_COHORTS;

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["budget_lines", selectedCohortId],
    queryFn: async () => {
      let q = supabase.from("budget_lines").select("*").eq("is_archived", false).order("name");
      if (cohortScoped) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BudgetLine[];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", "for-budget", selectedCohortId],
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("id, amount, budget_line_id, cohort_id, status")
        .eq("is_archived", false);
      if (cohortScoped) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Paid stipends also draw against a budget line. Additional spend sources
  // (e.g. contract payments) should be added the same way: query, then merge
  // into spentByLine below.
  const cohortLabelForStipends = cohortScoped
    ? (useCohort().selectedCohort?.label ?? null)
    : null;
  const { data: paidStipends = [] } = useQuery({
    queryKey: ["stipend_records", "for-budget", selectedCohortId, cohortLabelForStipends],
    queryFn: async () => {
      let q = supabase
        .from("stipend_records")
        .select("id, total_net, budget_line_id, status, is_archived, cohort_year")
        .eq("is_archived", false)
        .eq("status", "paid");
      if (cohortScoped && cohortLabelForStipends) {
        q = q.eq("cohort_year", cohortLabelForStipends);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const spentByLine = useMemo(() => {
    const m: Record<string, number> = {};
    const add = (lineId: string | null | undefined, amt: number) => {
      if (!lineId) return;
      m[lineId] = (m[lineId] || 0) + amt;
    };
    for (const e of expenses as any[]) add(e.budget_line_id, Number(e.amount || 0));
    for (const s of paidStipends as any[]) add(s.budget_line_id, Number(s.total_net || 0));
    return m;
  }, [expenses, paidStipends]);

  const totalAllocated = useMemo(
    () => lines.reduce((s, l) => s + Number(l.allocated_amount || 0), 0),
    [lines]
  );
  const totalSpent = useMemo(
    () => Object.values(spentByLine).reduce((s, n) => s + n, 0),
    [spentByLine]
  );
  const remaining = totalAllocated - totalSpent;
  const burnRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("budget_lines")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_lines"] });
      setDeleteId(null);
      toast({ title: "Budget line archived" });
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Budget Source</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Budget lines and actual spend for {selectedCohortLabel || "the selected cohort"}.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" /> Add budget line
            </Button>
          </DialogTrigger>
          <BudgetLineDialog
            editing={editing}
            cohortId={cohortScoped ? (selectedCohortId as string) : null}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["budget_lines"] });
              setOpen(false);
              setEditing(null);
            }}
          />
        </Dialog>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Allocated" value={fmtMAD(totalAllocated)} icon={PiggyBank} />
        <KpiCard label="Actual Spend" value={fmtMAD(totalSpent)} icon={TrendingDown} />
        <KpiCard
          label="Remaining"
          value={fmtMAD(remaining)}
          icon={Wallet}
          warning={remaining < 0}
        />
        <KpiCard
          label="Burn Rate"
          value={`${burnRate.toFixed(1)}%`}
          icon={Flame}
          warning={burnRate > 90}
        />
      </div>

      {/* Budget vs Actual per line */}
      <Card>
        <CardHeader>
          <CardTitle>Budget vs. Actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No budget lines yet for this cohort.
            </p>
          ) : (
            lines.map((l) => {
              const allocated = Number(l.allocated_amount || 0);
              const spent = spentByLine[l.id] || 0;
              const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
              const over = allocated > 0 && spent > allocated;
              return (
                <div key={l.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {l.name}
                      {l.code && (
                        <span className="ml-2 text-xs text-muted-foreground">{l.code}</span>
                      )}
                    </span>
                    <span className={over ? "text-destructive" : "text-muted-foreground"}>
                      {fmtMAD(spent)} / {fmtMAD(allocated)}
                    </span>
                  </div>
                  <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="w-20 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No budget lines yet.
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((l) => {
                  const allocated = Number(l.allocated_amount || 0);
                  const spent = spentByLine[l.id] || 0;
                  const rem = allocated - spent;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {l.code || "—"}
                      </TableCell>
                      <TableCell className="text-right">{fmtMAD(allocated)}</TableCell>
                      <TableCell className="text-right">{fmtMAD(spent)}</TableCell>
                      <TableCell
                        className={`text-right ${rem < 0 ? "text-destructive" : ""}`}
                      >
                        {fmtMAD(rem)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditing(l);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(l.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        title="Archive budget line?"
        description="Linked expenses will keep their reference. You can restore it later from the database."
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  warning,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  warning?: boolean;
}) {
  return (
    <Card className={warning ? "border-destructive/40" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p
              className={`text-2xl font-semibold ${warning ? "text-destructive" : ""}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {value}
            </p>
          </div>
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              warning ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetLineDialog({
  editing,
  cohortId,
  onClose,
  onSaved,
}: {
  editing: BudgetLine | null;
  cohortId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: editing?.name || "",
    code: editing?.code || "",
    allocated_amount: editing?.allocated_amount != null ? String(editing.allocated_amount) : "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        code: form.code || null,
        allocated_amount: Number(form.allocated_amount) || 0,
        cohort_id: editing?.cohort_id ?? cohortId,
      };
      if (editing) {
        const { error } = await supabase.from("budget_lines").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_lines").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Budget line updated" : "Budget line added" });
      onSaved();
    },
    onError: (e: any) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit budget line" : "New budget line"}</DialogTitle>
        <DialogDescription>
          Allocate a portion of the cohort budget to a named line.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="bl-name">Name</Label>
          <Input
            id="bl-name"
            name="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Events, Travel, Marketing…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bl-code">Code</Label>
            <Input
              id="bl-code"
              name="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="EV-01"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-amount">Allocated (MAD)</Label>
            <Input
              id="bl-amount"
              name="allocated_amount"
              type="number"
              value={form.allocated_amount}
              onChange={(e) => setForm({ ...form, allocated_amount: e.target.value })}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name}
        >
          {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add line"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
