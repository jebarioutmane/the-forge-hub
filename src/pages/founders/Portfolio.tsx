import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import {
  Users, AlertTriangle, ShieldCheck, Activity, ClipboardCheck,
  TrendingUp, Globe2, Layers, Building2, DollarSign, CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RISK_COLORS: Record<string, string> = {
  on_track: "#10b981",
  watch: "#f59e0b",
  at_risk: "#ef4444",
};

const DECISION_COLORS: Record<string, string> = {
  Stay: "#10b981",
  "At Risk": "#f59e0b",
  Exit: "#ef4444",
};

const PALETTE = ["#0071E3", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-56 text-center gap-2 text-muted-foreground">
      <Icon className="h-6 w-6 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, tone, onClick,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  tone?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
}) {
  const toneMap = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  } as const;
  return (
    <Card
      onClick={onClick}
      className={cn(
        "border border-border/60 shadow-none transition-all",
        onClick && "cursor-pointer hover:shadow-sm hover:border-border"
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
          <Icon className={cn("h-4 w-4", toneMap[tone ?? "default"])} />
        </div>
        <div className={cn("text-3xl font-semibold tracking-tight", toneMap[tone ?? "default"])}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">
      {children}
    </h2>
  );
}

export default function PortfolioDashboard() {
  const navigate = useNavigate();
  const { selectedCohortId, selectedCohortLabel, isLoading: cohortLoading } = useCohort();
  const isAll = selectedCohortId === ALL_COHORTS;

  const { data: founders = [], isLoading: fL } = useQuery({
    queryKey: ["portfolio-founders", selectedCohortId],
    enabled: !!selectedCohortId,
    queryFn: async () => {
      let q = supabase.from("founders").select("*").eq("is_archived", false);
      if (!isAll) q = q.eq("cohort_id", selectedCohortId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const founderIds = useMemo(() => founders.map(f => f.id), [founders]);

  const { data: engagement = [], isLoading: eL } = useQuery({
    queryKey: ["portfolio-engagement", founderIds.join(",")],
    enabled: founderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_engagement" as any)
        .select("*")
        .in("founder_id", founderIds);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ["portfolio-checkins", founderIds.join(",")],
    enabled: founderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_checkins")
        .select("*")
        .eq("is_archived", false)
        .in("founder_id", founderIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["portfolio-evaluations", founderIds.join(",")],
    enabled: founderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_evaluations")
        .select("*")
        .eq("is_archived", false)
        .in("founder_id", founderIds);
      if (error) throw error;
      return data;
    },
  });

  // === Section 1: Headline ===
  const riskCounts = useMemo(() => {
    const c = { on_track: 0, watch: 0, at_risk: 0 };
    engagement.forEach(e => {
      if (e.risk_status in c) c[e.risk_status as keyof typeof c]++;
    });
    return c;
  }, [engagement]);

  const avgAttendance = useMemo(() => {
    const rates = engagement.map(e => Number(e.attendance_rate)).filter(n => !isNaN(n) && n !== null);
    if (!rates.length) return null;
    return Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100);
  }, [engagement]);

  const latestBlock = useMemo(() => {
    const blocks = evaluations.map(e => e.block_number).filter(Boolean) as number[];
    return blocks.length ? Math.max(...blocks) : null;
  }, [evaluations]);

  const evalCompletion = useMemo(() => {
    if (!latestBlock) return { done: 0, pending: founders.length };
    const doneIds = new Set(
      evaluations.filter(e => e.block_number === latestBlock).map(e => e.founder_id)
    );
    return { done: doneIds.size, pending: founders.length - doneIds.size };
  }, [evaluations, latestBlock, founders]);

  // === Section 2: engagement ===
  const riskPie = useMemo(() => ([
    { name: "On track", value: riskCounts.on_track, key: "on_track" },
    { name: "Watch", value: riskCounts.watch, key: "watch" },
    { name: "At risk", value: riskCounts.at_risk, key: "at_risk" },
  ].filter(d => d.value > 0)), [riskCounts]);

  const needsAttention = useMemo(() => {
    const byId = new Map(founders.map(f => [f.id, f]));
    return engagement
      .filter(e => e.risk_status === "at_risk" || e.risk_status === "watch")
      .map(e => ({ ...e, founder: byId.get(e.founder_id) }))
      .sort((a, b) => {
        const rank = (r: string) => (r === "at_risk" ? 0 : 1);
        return rank(a.risk_status) - rank(b.risk_status);
      });
  }, [engagement, founders]);

  // === Section 3: progress trends ===
  const dimensionAvg = useMemo(() => {
    const dims = ["product", "team", "traction", "market", "funding"] as const;
    return dims.map(d => {
      const vals = checkins.map(c => (c as any)[`${d}_rating`]).filter(v => v != null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { dimension: d.charAt(0).toUpperCase() + d.slice(1), score: Number(avg.toFixed(2)) };
    });
  }, [checkins]);

  const scoreTrend = useMemo(() => {
    const buckets = new Map<string, number[]>();
    checkins.forEach(c => {
      if (c.overall_score == null || !c.checkin_date) return;
      const key = c.checkin_date.slice(0, 7); // YYYY-MM
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(c.overall_score);
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month,
        avg: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
      }));
  }, [checkins]);

  // === Section 4: evaluations ===
  const decisionDist = useMemo(() => {
    const counts: Record<string, number> = {};
    evaluations.forEach(e => {
      if (e.decision) counts[e.decision] = (counts[e.decision] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [evaluations]);

  const scoresByBlock = useMemo(() => {
    const buckets = new Map<number, number[]>();
    evaluations.forEach(e => {
      if (e.block_number == null || e.total_score == null) return;
      if (!buckets.has(e.block_number)) buckets.set(e.block_number, []);
      buckets.get(e.block_number)!.push(Number(e.total_score));
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([b, vals]) => ({
        block: `Block ${b}`,
        avg: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
      }));
  }, [evaluations]);

  // === Section 5: composition ===
  const groupBy = (field: keyof typeof founders[number]) => {
    const counts: Record<string, number> = {};
    founders.forEach(f => {
      const v = (f as any)[field];
      if (!v || (typeof v === "string" && !v.trim())) return;
      counts[v] = (counts[v] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const byCountry = useMemo(() => {
    const counts: Record<string, number> = {};
    founders.forEach(f => {
      const list = (f.nationalities?.length ? f.nationalities : (f.nationality ? [f.nationality] : [])) as string[];
      list.forEach(n => { if (n) counts[n] = (counts[n] ?? 0) + 1; });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [founders]);

  const bySector = useMemo(() => groupBy("sector"), [founders]);
  const byStage = useMemo(() => groupBy("stage"), [founders]);

  const fundingBySector = useMemo(() => {
    const sums: Record<string, number> = {};
    founders.forEach(f => {
      if (!f.sector || !f.funding_raised) return;
      sums[f.sector] = (sums[f.sector] ?? 0) + Number(f.funding_raised);
    });
    return Object.entries(sums).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [founders]);

  const loading = cohortLoading || fL || (founderIds.length > 0 && eL);

  const goToRisk = (risk: string) => {
    navigate(`/founders?risk=${risk}`);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-10">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Program health across <span className="text-foreground font-medium">{selectedCohortLabel || "…"}</span>
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{founders.length} active founders</Badge>
      </div>

      {loading && founders.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading portfolio…</div>
      ) : founders.length === 0 ? (
        <Card><CardContent className="p-12">
          <EmptyState icon={Users} message="No active founders in this cohort yet." />
        </CardContent></Card>
      ) : (
        <>
          {/* Section 1: Headline */}
          <section>
            <SectionTitle>Health headline</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={Users} label="Active founders" value={founders.length} />
              <StatCard
                icon={ShieldCheck} label="On track" value={riskCounts.on_track}
                tone="success" onClick={() => goToRisk("on_track")}
              />
              <StatCard
                icon={CircleAlert} label="Watch" value={riskCounts.watch}
                tone="warning" onClick={() => goToRisk("watch")}
              />
              <StatCard
                icon={AlertTriangle} label="At risk" value={riskCounts.at_risk}
                tone="danger" onClick={() => goToRisk("at_risk")}
              />
              <StatCard
                icon={Activity} label="Avg attendance"
                value={avgAttendance != null ? `${avgAttendance}%` : "—"}
              />
              <StatCard
                icon={ClipboardCheck}
                label={latestBlock ? `Block ${latestBlock} eval` : "Evaluations"}
                value={`${evalCompletion.done}/${founders.length}`}
                sub={latestBlock ? `${evalCompletion.pending} pending` : "No evaluations yet"}
              />
            </div>
          </section>

          {/* Section 2: Engagement & risk */}
          <section>
            <SectionTitle>Engagement & risk</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium">Risk breakdown</CardTitle></CardHeader>
                <CardContent>
                  {riskPie.length === 0 ? (
                    <EmptyState icon={ShieldCheck} message="No engagement data yet." />
                  ) : (
                    <ChartContainer config={{}} className="h-56">
                      <PieChart>
                        <Pie data={riskPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {riskPie.map(d => <Cell key={d.key} fill={RISK_COLORS[d.key]} />)}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend verticalAlign="bottom" height={24} iconSize={8} />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none lg:col-span-2">
                <CardHeader><CardTitle className="text-sm font-medium">Needs attention</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {needsAttention.length === 0 ? (
                    <div className="p-6"><EmptyState icon={ShieldCheck} message="Everyone's on track." /></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground border-b border-border/60">
                          <tr>
                            <th className="text-left font-medium px-4 py-2">Founder</th>
                            <th className="text-left font-medium px-4 py-2">Risk</th>
                            <th className="text-left font-medium px-4 py-2">Attendance</th>
                            <th className="text-left font-medium px-4 py-2">Effort</th>
                            <th className="text-left font-medium px-4 py-2">Last check-in</th>
                          </tr>
                        </thead>
                        <tbody>
                          {needsAttention.map(row => (
                            <tr
                              key={row.founder_id}
                              onClick={() => navigate(`/founders?founder=${row.founder_id}`)}
                              className="border-b border-border/40 last:border-0 hover:bg-accent/50 cursor-pointer"
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium">{row.founder?.founder_name ?? row.founder_name ?? "—"}</div>
                                <div className="text-xs text-muted-foreground">{row.founder?.startup_name ?? row.startup_name}</div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className="text-xs capitalize"
                                  style={{ color: RISK_COLORS[row.risk_status], borderColor: RISK_COLORS[row.risk_status] + "66" }}
                                >
                                  {row.risk_status?.replace("_", " ")}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {row.attendance_rate != null ? `${Math.round(Number(row.attendance_rate))}%` : "—"}
                              </td>
                              <td className="px-4 py-3 capitalize text-muted-foreground">
                                {row.latest_effort_signal ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {row.days_since_last_checkin != null
                                  ? `${row.days_since_last_checkin}d ago`
                                  : "Never"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 3: Progress trends */}
          <section>
            <SectionTitle>Progress trends</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium">Average score by dimension</CardTitle></CardHeader>
                <CardContent>
                  {checkins.length === 0 ? (
                    <EmptyState icon={TrendingUp} message="No check-ins recorded yet." />
                  ) : (
                    <ChartContainer config={{}} className="h-64">
                      <BarChart data={dimensionAvg}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="score" fill="#0071E3" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium">Overall score trend</CardTitle></CardHeader>
                <CardContent>
                  {scoreTrend.length === 0 ? (
                    <EmptyState icon={TrendingUp} message="Not enough check-ins for a trend." />
                  ) : (
                    <ChartContainer config={{}} className="h-64">
                      <LineChart data={scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="avg" stroke="#0071E3" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 4: Evaluation outcomes */}
          <section>
            <SectionTitle>Evaluation outcomes</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium">Decision distribution</CardTitle></CardHeader>
                <CardContent>
                  {decisionDist.length === 0 ? (
                    <EmptyState icon={ClipboardCheck} message="No evaluations recorded yet." />
                  ) : (
                    <ChartContainer config={{}} className="h-64">
                      <PieChart>
                        <Pie data={decisionDist} dataKey="value" nameKey="name" outerRadius={90} label>
                          {decisionDist.map(d => (
                            <Cell key={d.name} fill={DECISION_COLORS[d.name] ?? "#94a3b8"} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend verticalAlign="bottom" height={24} iconSize={8} />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium">Average score by block</CardTitle></CardHeader>
                <CardContent>
                  {scoresByBlock.length === 0 ? (
                    <EmptyState icon={ClipboardCheck} message="No evaluation scores yet." />
                  ) : (
                    <ChartContainer config={{}} className="h-64">
                      <BarChart data={scoresByBlock}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="block" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="avg" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 5: Composition */}
          <section>
            <SectionTitle>Composition</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Globe2 className="h-4 w-4 text-muted-foreground" />Founders by country</CardTitle></CardHeader>
                <CardContent>
                  {byCountry.length === 0 ? (
                    <EmptyState icon={Globe2} message="No nationality data yet — add it in the Directory." />
                  ) : (
                    <ChartContainer config={{}} className="h-64">
                      <BarChart data={byCountry} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="#0071E3" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />Founders by sector</CardTitle></CardHeader>
                <CardContent>
                  {bySector.length === 0 ? (
                    <EmptyState icon={Building2} message="No sector data yet — add it in the Directory." />
                  ) : (
                    <ChartContainer config={{}} className="h-64">
                      <PieChart>
                        <Pie data={bySector} dataKey="value" nameKey="name" outerRadius={90} label>
                          {bySector.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend verticalAlign="bottom" height={24} iconSize={8} />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground" />Founders by stage</CardTitle></CardHeader>
                <CardContent>
                  {byStage.length === 0 ? (
                    <EmptyState icon={Layers} message="No stage data yet — add it in the Directory." />
                  ) : (
                    <ChartContainer config={{}} className="h-64">
                      <BarChart data={byStage}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-none">
                <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" />Total funding by sector</CardTitle></CardHeader>
                <CardContent>
                  {fundingBySector.length === 0 ? (
                    <EmptyState icon={DollarSign} message="No funding data yet — add it in the Directory." />
                  ) : (
                    <ChartContainer config={{}} className="h-64">
                      <BarChart data={fundingBySector}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
