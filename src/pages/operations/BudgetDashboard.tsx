import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Wallet,
  TrendingDown,
  PiggyBank,
  Flame,
  Plus,
  ExternalLink,
} from "lucide-react";
import { COHORT_YEARS, getCurrentCohortYear } from "@/lib/cohortYears";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = [
  "Founder Stipends",
  "Events",
  "Marketing",
  "Travel",
  "Operations",
] as const;

function fmtMAD(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

export default function BudgetDashboard() {
  const qc = useQueryClient();
  const [cohort, setCohort] = useState<string>(getCurrentCohortYear());
  const [open, setOpen] = useState(false);

  const { data: txns = [] } = useQuery({
    queryKey: ["budget_transactions", cohort],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_transactions")
        .select("*")
        .eq("cohort_year", cohort)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: stipendRecords = [] } = useQuery({
    queryKey: ["stipend_records", cohort],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stipend_records")
        .select("total_net")
        .eq("cohort_year", cohort);
      if (error) throw error;
      return data;
    },
  });

  const stipendsTotal = useMemo(
    () => stipendRecords.reduce((s, r: any) => s + Number(r.total_net || 0), 0),
    [stipendRecords]
  );

  const { totalIncome, totalExpense, byCategory } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const cat: Record<string, { allocated: number; spent: number }> = {};
    CATEGORIES.forEach((c) => (cat[c] = { allocated: 0, spent: 0 }));
    txns.forEach((t: any) => {
      const amt = Number(t.amount || 0);
      if (t.transaction_type === "income") {
        inc += amt;
        if (cat[t.category]) cat[t.category].allocated += amt;
      } else {
        exp += amt;
        if (cat[t.category]) cat[t.category].spent += amt;
      }
    });
    // Override Founder Stipends spend from stipend_records
    cat["Founder Stipends"].spent = stipendsTotal;
    return { totalIncome: inc, totalExpense: exp + stipendsTotal, byCategory: cat };
  }, [txns, stipendsTotal]);

  const remaining = totalIncome - totalExpense;
  const burnRate = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  // Cumulative spending line chart
  const cumulative = useMemo(() => {
    const sorted = [...txns]
      .filter((t: any) => t.transaction_type === "expense")
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    let running = 0;
    return sorted.map((t: any) => {
      running += Number(t.amount || 0);
      return { date: t.date, cumulative: running };
    });
  }, [txns]);

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Budget Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cohort-based financial oversight
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={cohort} onValueChange={setCohort}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COHORT_YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Transaction
              </Button>
            </DialogTrigger>
            <AddTransactionDialog
              cohort={cohort}
              onClose={() => setOpen(false)}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["budget_transactions", cohort] });
                setOpen(false);
              }}
            />
          </Dialog>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Allocated" value={fmtMAD(totalIncome)} icon={PiggyBank} />
        <KpiCard label="Actual Spend" value={fmtMAD(totalExpense)} icon={TrendingDown} />
        <KpiCard
          label="Remaining Balance"
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

      {/* Budget vs Actual */}
      <Card>
        <CardHeader>
          <CardTitle>Budget vs. Actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {CATEGORIES.map((c) => {
            const { allocated, spent } = byCategory[c];
            const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
            const over = allocated > 0 && spent > allocated;
            return (
              <div key={c} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {c}
                    {c === "Founder Stipends" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (auto from Stipends)
                      </span>
                    )}
                  </span>
                  <span className={over ? "text-destructive" : "text-muted-foreground"}>
                    {fmtMAD(spent)} / {fmtMAD(allocated)}
                  </span>
                </div>
                <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cumulative Spending */}
      <Card>
        <CardHeader>
          <CardTitle>Cumulative Spending</CardTitle>
        </CardHeader>
        <CardContent>
          {cumulative.length > 0 ? (
            <ChartContainer
              config={{ cumulative: { label: "Spent", color: "hsl(var(--primary))" } }}
              className="h-[280px] w-full"
            >
              <LineChart data={cumulative}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="var(--color-cumulative)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">
              No expenses recorded yet for this cohort.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount (MAD)</TableHead>
                <TableHead className="text-center">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              ) : (
                txns.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.date}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          t.transaction_type === "income"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {t.transaction_type}
                      </span>
                    </TableCell>
                    <TableCell>{t.category}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{t.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {fmtMAD(Number(t.amount))}
                    </TableCell>
                    <TableCell className="text-center">
                      {t.evidence_url ? (
                        <a
                          href={t.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
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

function AddTransactionDialog({
  cohort,
  onClose,
  onSaved,
}: {
  cohort: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    transaction_type: "expense" as "income" | "expense",
    category: "Operations",
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    evidence_url: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("budget_transactions").insert({
        cohort_year: cohort,
        transaction_type: form.transaction_type,
        category: form.category,
        amount: Number(form.amount) || 0,
        description: form.description || null,
        date: form.date,
        evidence_url: form.evidence_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Transaction added" });
      onSaved();
    },
    onError: (e: any) =>
      toast({ title: "Failed to add", description: e.message, variant: "destructive" }),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Transaction</DialogTitle>
        <DialogDescription>Log income or an expense for {cohort}.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select
              value={form.transaction_type}
              onValueChange={(v: "income" | "expense") =>
                setForm({ ...form, transaction_type: v })
              }
            >
              <SelectTrigger id="type" name="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v })}
            >
              <SelectTrigger id="category" name="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (MAD)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="evidence_url">Evidence URL</Label>
          <Input
            id="evidence_url"
            name="evidence_url"
            placeholder="https://..."
            value={form.evidence_url}
            onChange={(e) => setForm({ ...form, evidence_url: e.target.value })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.amount}>
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
