import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { CurrencyToggle, Currency, convertCurrency, formatCurrency } from "@/components/CurrencyToggle";
import { Wallet, TrendingDown, PiggyBank, AlertTriangle, TrendingUp, FileText, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

export default function OperationsDashboard() {
  const [currency, setCurrency] = useState<Currency>("MAD");

  const { data: budgetLines = [] } = useQuery({
    queryKey: ["budget_lines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_lines").select("*").eq("is_archived", false);
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*");
      if (error) throw error;
      return data;
    },
  });

  const totalBudget = budgetLines.reduce((sum, b) => sum + Number(b.allocated_amount || 0), 0);
  const totalSpent = expenses
    .filter((e) => e.status === "Confirmed" || e.status === "Paid")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const forecastedSpent = expenses
    .filter((e) => e.status === "Pending" || e.status === "Planned")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const remaining = totalBudget - totalSpent;
  const pendingCount = expenses.filter((e) => e.status === "Pending").length;
  const activeContracts = contracts.filter((c) => c.status === "Signed" || c.status === "Active").length;

  // Chart data: group by budget line
  const chartData = budgetLines.map((b) => {
    const lineExpenses = expenses
      .filter((e) => (e as any).budget_line_id === b.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      category: b.name,
      budget: convertCurrency(Number(b.allocated_amount || 0), currency),
      spent: convertCurrency(lineExpenses, currency),
    };
  });


  const chartConfig = {
    budget: { label: "Budget", color: "hsl(35 90% 55%)" },
    spent: { label: "Spent", color: "hsl(215 16% 47%)" },
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track spending across all categories</p>
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      {remaining <= 0 && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Budget depleted — no remaining funds
        </Badge>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Budget"
          value={formatCurrency(convertCurrency(totalBudget, currency), currency)}
          icon={PiggyBank}
        />
        <StatCard
          title="Total Spent"
          value={formatCurrency(convertCurrency(totalSpent, currency), currency)}
          icon={TrendingDown}
        />
        <StatCard
          title="Forecasted Spent"
          value={formatCurrency(convertCurrency(forecastedSpent, currency), currency)}
          icon={TrendingUp}
        />
        <StatCard
          title="Remaining"
          value={formatCurrency(convertCurrency(remaining, currency), currency)}
          icon={Wallet}
          warning={remaining <= 0}
        />
        <StatCard
          title="Pending Expenses"
          value={String(pendingCount)}
          icon={FileText}
        />
        <StatCard
          title="Active Contracts"
          value={String(activeContracts)}
          icon={Briefcase}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Budget vs Expenses by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="category" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="budget" fill="var(--color-budget)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" fill="var(--color-spent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">No budget data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
