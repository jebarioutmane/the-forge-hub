import { Briefcase, CalendarDays, GraduationCap, TrendingUp, FileText, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const modules = [
  {
    title: "Operations",
    description: "Budgets, stipends & contracts",
    icon: Briefcase,
    route: "/operations",
    color: "bg-module-operations/10 text-module-operations",
    borderColor: "hover:border-module-operations/50",
  },
  {
    title: "Events",
    description: "Calendar, planning & mentoring",
    icon: CalendarDays,
    route: "/events",
    color: "bg-module-events/10 text-module-events",
    borderColor: "hover:border-module-events/50",
  },
  {
    title: "Founders",
    description: "Directory & progress tracking",
    icon: GraduationCap,
    route: "/founders",
    color: "bg-module-founders/10 text-module-founders",
    borderColor: "hover:border-module-founders/50",
  },
];

export default function Home() {
  const navigate = useNavigate();

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

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: founders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*");
      if (error) throw error;
      return data;
    },
  });

  const totalSpent = expenses
    .filter((e) => e.status === "Confirmed" || e.status === "Paid")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingCount = expenses.filter((e) => e.status === "Pending").length;
  const activeContracts = contracts.filter((c) => c.status === "Signed" || c.status === "Active").length;
  const activeEvents = events.filter((e) => e.status === "Active" || e.status === "Planning").length;

  const stats = [
    { label: "Total Spent", value: `${totalSpent.toLocaleString()} MAD`, icon: TrendingUp, color: "text-module-operations" },
    { label: "Pending Expenses", value: String(pendingCount), icon: FileText, color: "text-primary" },
    { label: "Active Contracts", value: String(activeContracts), icon: Briefcase, color: "text-module-operations" },
    { label: "Active Events", value: String(activeEvents), icon: CalendarDays, color: "text-module-events" },
    { label: "Founders", value: String(founders.length), icon: Users, color: "text-module-founders" },
  ];

  return (
    <div className="p-6 lg:p-10 space-y-10 max-w-7xl mx-auto">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          Command Center
        </h1>
        <p className="text-muted-foreground mt-1 text-lg">Welcome back. Here's your overview.</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center bg-muted ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {modules.map((mod) => (
          <Card
            key={mod.title}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-2 border-transparent ${mod.borderColor}`}
            onClick={() => navigate(mod.route)}
          >
            <CardContent className="p-6">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${mod.color}`}>
                <mod.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-1">{mod.title}</h3>
              <p className="text-sm text-muted-foreground">{mod.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
