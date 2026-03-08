import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { BLOCKS, getRiskTag } from "@/config/evaluationBlocks";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, Users, AlertTriangle, DollarSign } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Evaluation = Tables<"founder_evaluations">;
type Founder = Tables<"founders">;

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

export default function PortfolioDashboard() {
  const [blockFilter, setBlockFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");

  const { data: evaluations = [] } = useQuery({
    queryKey: ["founder_evaluations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founder_evaluations").select("*").order("evaluation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: founders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const cohorts = useMemo(() => getUniqueFilterValues(founders.map((f) => f.cohort)), [founders]);

  const filteredFounderIds = useMemo(() => {
    if (cohortFilter === "all") return founders.map((f) => f.id);
    return founders.filter((f) => matchesFilter(f.cohort, cohortFilter)).map((f) => f.id);
  }, [founders, cohortFilter]);

  const filteredEvals = useMemo(() => {
    let evals = evaluations.filter((e) => filteredFounderIds.includes(e.founder_id));
    if (blockFilter !== "all") evals = evals.filter((e) => e.block_name === blockFilter);
    return evals;
  }, [evaluations, filteredFounderIds, blockFilter]);

  // Latest eval per founder
  const latestPerFounder = useMemo(() => {
    const map = new Map<string, Evaluation>();
    filteredEvals.forEach((e) => {
      if (!map.has(e.founder_id)) map.set(e.founder_id, e);
    });
    return [...map.values()];
  }, [filteredEvals]);

  const avgScore = latestPerFounder.length > 0
    ? Math.round(latestPerFounder.reduce((s, e) => s + (e.total_score || 0), 0) / latestPerFounder.length)
    : 0;

  // Distribution
  const distribution = useMemo(() => {
    let high = 0, medium = 0, atRisk = 0;
    latestPerFounder.forEach((e) => {
      const score = e.total_score || 0;
      if (score >= 70) high++;
      else if (score >= 40) medium++;
      else atRisk++;
    });
    return [
      { name: "High Performer", value: high },
      { name: "On Track", value: medium },
      { name: "At Risk", value: atRisk },
    ];
  }, [latestPerFounder]);

  // Scores by block
  const scoresByBlock = useMemo(() => {
    return BLOCKS.map((b) => {
      const blockEvals = filteredEvals.filter((e) => e.block_name === b.name);
      const latestMap = new Map<string, number>();
      blockEvals.forEach((e) => {
        if (!latestMap.has(e.founder_id)) latestMap.set(e.founder_id, e.total_score || 0);
      });
      const vals = [...latestMap.values()];
      const avg = vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
      return { name: b.name, avg };
    });
  }, [filteredEvals]);

  // Top 5 + attention
  const ranked = useMemo(() => {
    return latestPerFounder
      .map((e) => ({
        ...e,
        founder: founders.find((f) => f.id === e.founder_id),
      }))
      .sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
  }, [latestPerFounder, founders]);

  const top5 = ranked.slice(0, 5);
  const attention = ranked.filter((e) => (e.total_score || 0) < 40);

  // Metrics aggregation
  const aggregatedMetrics = useMemo(() => {
    let totalRevenue = 0, totalRaised = 0, totalCustomers = 0;
    latestPerFounder.forEach((e) => {
      const qm = e.quantitative_metrics as Record<string, { value?: number }> | null;
      if (!qm) return;
      totalRevenue += qm.monthly_revenue?.value || qm.mrr?.value || 0;
      totalRaised += qm.funding_raised_usd?.value || qm.capital_raised_total?.value || 0;
      totalCustomers += qm.paying_customers?.value || qm.beta_users?.value || 0;
    });
    return { totalRevenue, totalRaised, totalCustomers };
  }, [latestPerFounder]);

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Portfolio Dashboard</h1>
        <p className="text-sm text-muted-foreground">Aggregate founder performance & metrics</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Block</Label>
          <Select value={blockFilter} onValueChange={setBlockFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Blocks</SelectItem>
              {BLOCKS.map((b) => (
                <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cohort</Label>
          <Select value={cohortFilter} onValueChange={setCohortFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cohorts</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c} value={c!}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">Avg Portfolio Score</p>
            <p className="text-2xl font-bold">{avgScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto text-module-founders mb-1" />
            <p className="text-xs text-muted-foreground">Total Customers</p>
            <p className="text-2xl font-bold">{aggregatedMetrics.totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-module-operations mb-1" />
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">${aggregatedMetrics.totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-module-events mb-1" />
            <p className="text-xs text-muted-foreground">Total Raised</p>
            <p className="text-2xl font-bold">${aggregatedMetrics.totalRaised.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution Pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Performance Distribution</CardTitle></CardHeader>
          <CardContent>
            {latestPerFounder.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No evaluations yet</p>
            ) : (
              <ChartContainer config={{ high: { label: "High", color: "#10b981" }, medium: { label: "Medium", color: "#f59e0b" }, risk: { label: "At Risk", color: "#ef4444" } }} className="h-[250px]">
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {distribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Scores by Block */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Average Score by Block</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ avg: { label: "Avg Score", color: "hsl(var(--primary))" } }} className="h-[250px]">
              <BarChart data={scoresByBlock}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="avg" fill="var(--color-avg)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 Founders</CardTitle></CardHeader>
          <CardContent>
            {top5.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-2">
                {top5.map((e, i) => {
                  const risk = getRiskTag(e.total_score || 0);
                  return (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{e.founder?.founder_name}</p>
                          <p className="text-xs text-muted-foreground">{e.founder?.startup_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{e.total_score}</span>
                        <Badge className={`text-white text-xs ${risk.color}`}>{risk.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attention */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Requiring Attention</CardTitle></CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">All founders on track 🎉</p>
            ) : (
              <div className="space-y-2">
                {attention.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{e.founder?.founder_name}</p>
                      <p className="text-xs text-muted-foreground">{e.block_name}</p>
                    </div>
                    <Badge className="bg-red-500 text-white">{e.total_score}/100</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
