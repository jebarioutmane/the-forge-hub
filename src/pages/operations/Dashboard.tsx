import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Wallet, TrendingDown, PiggyBank, AlertTriangle, ShieldCheck,
  Lock, Flame, Timer, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

type BudgetLine = {
  id: string;
  cohort_id: string | null;
  parent_id: string | null;
  name: string;
  code: string | null;
  allocated_amount: number | null;
  currency: string | null;
  is_archived: boolean | null;
};

function fmt(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.round(n));
  return `${sign}${new Intl.NumberFormat("en-US").format(v)} MAD`;
}
function fmtCompact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export default function OperationsDashboard() {
  const { selectedCohortId, selectedCohort, selectedCohortLabel } = useCohort();
  const cohortScoped = selectedCohortId && selectedCohortId !== ALL_COHORTS;
  const cohortLabel = cohortScoped ? selectedCohort?.label ?? null : null;

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ["ops-dashboard", "lines", selectedCohortId],
    queryFn: async () => {
      let q = supabase.from("budget_lines").select("*").eq("is_archived", false);
      if (cohortScoped) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BudgetLine[];
    },
  });

  const lineIds = useMemo(() => lines.map((l) => l.id), [lines]);

  const { data: expenses = [] } = useQuery({
    queryKey: ["ops-dashboard", "expenses", selectedCohortId],
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("id, amount, budget_line_id, status, is_archived, cohort_id, created_at")
        .eq("is_archived", false);
      if (cohortScoped) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stipends = [] } = useQuery({
    queryKey: ["ops-dashboard", "stipends", cohortLabel],
    queryFn: async () => {
      let q = supabase
        .from("stipend_records")
        .select("id, total_net, budget_line_id, status, is_archived, cohort_year, paid_at, created_at")
        .eq("is_archived", false);
      if (cohortLabel) q = q.eq("cohort_year", cohortLabel);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["ops-dashboard", "contract_payments", lineIds.join(",")],
    enabled: lineIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_payments")
        .select("id, amount, budget_line_id, status, paid_at, due_date, created_at, contract_id")
        .in("budget_line_id", lineIds);
      if (error) throw error;
      return data || [];
    },
  });

  // Active contracts (for committed calculation). Also fetch archived-flag false.
  const { data: contracts = [] } = useQuery({
    queryKey: ["ops-dashboard", "contracts", selectedCohortId],
    queryFn: async () => {
      let q = supabase
        .from("contracts")
        .select("id, title, value, status, budget_line_id, is_archived, cohort_id")
        .eq("is_archived", false);
      if (cohortScoped) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Paid-payments-per-contract map (used to offset active-contract commitment).
  const paidByContract = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of payments as any[]) {
      if (String(p.status).toLowerCase() === "paid" && p.contract_id) {
        m[p.contract_id] = (m[p.contract_id] || 0) + Number(p.amount || 0);
      }
    }
    return m;
  }, [payments]);

  // Active contracts without a budget line — surface to the user.
  const unassignedContracts = useMemo(
    () => (contracts as any[]).filter(
      (c) => String(c.status).toLowerCase() === "active" && !c.budget_line_id
    ),
    [contracts]
  );

  // Per-line rollup
  const rollup = useMemo(() => {
    const m: Record<string, { spent: number; committed: number }> = {};
    for (const l of lines) m[l.id] = { spent: 0, committed: 0 };
    const add = (id: string | null | undefined, key: "spent" | "committed", amt: number) => {
      if (!id || !m[id]) return;
      m[id][key] += amt;
    };
    // Spent: paid expenses + paid stipends + paid contract payments
    for (const e of expenses as any[]) {
      if (String(e.status || "").toLowerCase() === "paid")
        add(e.budget_line_id, "spent", Number(e.amount || 0));
    }
    for (const s of stipends as any[]) {
      const st = String(s.status || "").toLowerCase();
      const amt = Number(s.total_net || 0);
      if (st === "paid") add(s.budget_line_id, "spent", amt);
      else if (st === "approved") add(s.budget_line_id, "committed", amt);
    }
    for (const p of payments as any[]) {
      if (String(p.status || "").toLowerCase() === "paid")
        add(p.budget_line_id, "spent", Number(p.amount || 0));
    }
    // Committed from contracts: active contracts commit their remaining (value − paid) to the budget line.
    for (const c of contracts as any[]) {
      if (String(c.status || "").toLowerCase() !== "active") continue;
      if (!c.budget_line_id) continue;
      const total = Number(c.value || 0);
      const paid = paidByContract[c.id] || 0;
      const remaining = Math.max(0, total - paid);
      add(c.budget_line_id, "committed", remaining);
    }
    return m;
  }, [lines, expenses, stipends, payments, contracts, paidByContract]);

  const totals = useMemo(() => {
    let allocated = 0, spent = 0, committed = 0;
    for (const l of lines) {
      allocated += Number(l.allocated_amount || 0);
      const r = rollup[l.id];
      if (r) { spent += r.spent; committed += r.committed; }
    }
    return {
      allocated,
      spent,
      committed,
      remainingActual: allocated - spent,
      remainingAvailable: allocated - spent - committed,
    };
  }, [lines, rollup]);

  const overcommitted = totals.spent + totals.committed > totals.allocated && totals.allocated > 0;
  const depleted = totals.remainingActual < 0;

  // Spend trend: cumulative spent per day from paid events
  const trend = useMemo(() => {
    type Ev = { at: string; amt: number };
    const evts: Ev[] = [];
    for (const e of expenses as any[]) {
      if (String(e.status).toLowerCase() === "paid") {
        evts.push({ at: (e.created_at || "").slice(0, 10), amt: Number(e.amount || 0) });
      }
    }
    for (const s of stipends as any[]) {
      if (String(s.status).toLowerCase() === "paid") {
        evts.push({ at: (s.paid_at || s.created_at || "").slice(0, 10), amt: Number(s.total_net || 0) });
      }
    }
    for (const p of payments as any[]) {
      if (String(p.status).toLowerCase() === "paid") {
        evts.push({ at: (p.paid_at || p.due_date || p.created_at || "").slice(0, 10), amt: Number(p.amount || 0) });
      }
    }
    evts.sort((a, b) => a.at.localeCompare(b.at));
    const byDay: Record<string, number> = {};
    for (const e of evts) {
      if (!e.at) continue;
      byDay[e.at] = (byDay[e.at] || 0) + e.amt;
    }
    let cum = 0;
    return Object.keys(byDay).sort().map((d) => {
      cum += byDay[d];
      return { date: d, cumulative: cum, daily: byDay[d] };
    });
  }, [expenses, stipends, payments]);

  // Burn rate + runway
  const { burnPerDay, runwayDays, daysActive } = useMemo(() => {
    if (trend.length === 0) return { burnPerDay: 0, runwayDays: 0, daysActive: 0 };
    const first = new Date(trend[0].date).getTime();
    const last = new Date(trend[trend.length - 1].date).getTime();
    const days = Math.max(1, Math.round((last - first) / (1000 * 60 * 60 * 24)) + 1);
    const per = totals.spent / days;
    const runway = per > 0 ? Math.floor(totals.remainingAvailable / per) : Infinity;
    return { burnPerDay: per, runwayDays: runway, daysActive: days };
  }, [trend, totals]);

  const sortedLines = useMemo(() => {
    return [...lines].sort((a, b) => {
      const usageA = totals.allocated > 0 ? (rollup[a.id]?.spent || 0) + (rollup[a.id]?.committed || 0) : 0;
      const usageB = totals.allocated > 0 ? (rollup[b.id]?.spent || 0) + (rollup[b.id]?.committed || 0) : 0;
      return usageB - usageA;
    });
  }, [lines, rollup, totals.allocated]);

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Budget Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Committed-vs-spent view for {selectedCohortLabel || "the selected cohort"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overcommitted && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Overcommitted
            </Badge>
          )}
          {depleted && !overcommitted && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Actuals exceed allocation
            </Badge>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Allocated" value={fmt(totals.allocated)} icon={PiggyBank} tone="neutral" />
        <Kpi label="Committed" value={fmt(totals.committed)} icon={Lock} tone="neutral"
             hint="Obligated but not yet paid" />
        <Kpi label="Spent" value={fmt(totals.spent)} icon={TrendingDown} tone="neutral" />
        <Kpi label="Remaining (actual)" value={fmt(totals.remainingActual)} icon={Wallet}
             tone={totals.remainingActual < 0 ? "danger" : "neutral"}
             hint="Allocated − Spent" />
        <Kpi label="Remaining (available)" value={fmt(totals.remainingAvailable)} icon={ShieldCheck}
             tone={totals.remainingAvailable < 0 ? "danger" : "accent"}
             hint="What you can still safely spend" emphasized />
      </div>

      {unassignedContracts.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {unassignedContracts.length} active contract{unassignedContracts.length === 1 ? "" : "s"} without a budget line
              </p>
              <p className="text-muted-foreground mt-0.5">
                These aren't counted in Committed. Assign a budget line on each contract to include them:
                {" "}
                {unassignedContracts.slice(0, 5).map((c: any, i: number) => (
                  <span key={c.id} className="text-foreground">
                    {i > 0 && ", "}{c.title}
                  </span>
                ))}
                {unassignedContracts.length > 5 && <span> …and {unassignedContracts.length - 5} more</span>}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Burn + Runway */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flame className="h-4 w-4" /> Burn rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {burnPerDay > 0 ? fmt(burnPerDay) : "—"}
              <span className="text-sm font-normal text-muted-foreground"> / day</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Averaged over {daysActive} day{daysActive === 1 ? "" : "s"} of paid activity.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Timer className="h-4 w-4" /> Runway (available)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {burnPerDay <= 0 ? "—" :
                runwayDays === Infinity ? "∞" :
                runwayDays < 0 ? "0 days" : `${runwayDays} days`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              At current burn, using Remaining (available).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {totals.allocated > 0
                ? `${(((totals.spent + totals.committed) / totals.allocated) * 100).toFixed(1)}%`
                : "—"}
            </p>
            <Progress
              value={totals.allocated > 0
                ? Math.min(((totals.spent + totals.committed) / totals.allocated) * 100, 100)
                : 0}
              className={`h-1 mt-2 ${overcommitted ? "[&>div]:bg-destructive" : ""}`}
            />
            <p className="text-xs text-muted-foreground mt-1">Spent + Committed vs Allocated</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cumulative spend over time</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No paid activity yet.</p>
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtCompact(v)} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))"
                        strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-line table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Budget lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {linesLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : lines.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No budget lines for this cohort yet. Add them from the Budget Lines manager (System).
            </div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <div className="col-span-4">Code / Title</div>
                <div className="col-span-2 text-right">Allocated</div>
                <div className="col-span-2 text-right">Committed</div>
                <div className="col-span-2 text-right">Spent</div>
                <div className="col-span-2 text-right">Available</div>
              </div>
              {sortedLines.map((l) => {
                const r = rollup[l.id] || { spent: 0, committed: 0 };
                const allocated = Number(l.allocated_amount || 0);
                const spent = r.spent;
                const committed = r.committed;
                const available = allocated - spent - committed;
                const over = allocated > 0 && spent + committed > allocated;
                const spentPct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
                const commPct = allocated > 0 ? Math.min((committed / allocated) * 100, 100 - spentPct) : 0;
                return (
                  <div key={l.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-muted/20">
                    <div className="col-span-4 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {l.code && (
                          <Badge variant="outline" className="font-mono text-[11px] shrink-0">{l.code}</Badge>
                        )}
                        <span className="text-sm font-medium truncate">{l.name}</span>
                      </div>
                      {/* stacked bar */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                        <div
                          className={over ? "bg-destructive" : "bg-primary"}
                          style={{ width: `${spentPct}%` }}
                          title={`Spent ${fmt(spent)}`}
                        />
                        <div
                          className={over ? "bg-destructive/40" : "bg-primary/40"}
                          style={{
                            width: `${commPct}%`,
                            backgroundImage:
                              "repeating-linear-gradient(45deg, transparent 0 3px, hsl(var(--background)/0.35) 3px 6px)",
                          }}
                          title={`Committed ${fmt(committed)}`}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 text-right text-sm tabular-nums">
                      {allocated > 0 ? fmt(allocated) : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="col-span-2 text-right text-sm tabular-nums text-muted-foreground">
                      {committed > 0 ? fmt(committed) : "—"}
                    </div>
                    <div className={`col-span-2 text-right text-sm tabular-nums ${over ? "text-destructive" : ""}`}>
                      {spent > 0 ? fmt(spent) : "—"}
                    </div>
                    <div className={`col-span-2 text-right text-sm tabular-nums font-medium ${available < 0 ? "text-destructive" : ""}`}>
                      {fmt(available)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, tone = "neutral", hint, emphasized,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: "neutral" | "accent" | "danger";
  hint?: string;
  emphasized?: boolean;
}) {
  const border =
    tone === "danger" ? "border-destructive/40"
    : emphasized ? "border-primary/40 ring-1 ring-primary/10"
    : "";
  const valueColor = tone === "danger" ? "text-destructive" : "";
  return (
    <Card className={border}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${tone === "danger" ? "text-destructive" : emphasized ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${valueColor}`}
           style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
