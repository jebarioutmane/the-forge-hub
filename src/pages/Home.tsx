import { Briefcase, Users, CalendarDays, Target, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const modules = [
  {
    title: "Operations & Finance",
    description: "Manage budgets, stipends, and contracts.",
    icon: Briefcase,
    route: "/operations",
    active: true,
  },
  {
    title: "Founders",
    description: "Track founder profiles and cohorts.",
    icon: Users,
    route: null,
    active: false,
  },
  {
    title: "Events",
    description: "Plan and manage events and workshops.",
    icon: CalendarDays,
    route: null,
    active: false,
  },
  {
    title: "Strategy",
    description: "OKRs, KPIs, and strategic planning.",
    icon: Target,
    route: null,
    active: false,
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[calc(100vh-3.5rem)]">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-wider">
          Welcome to <span className="text-primary">THE FORGE HUB</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">Select a module to get started</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl w-full">
        {modules.map((mod) => (
          <Card
            key={mod.title}
            className={`relative transition-all duration-200 ${
              mod.active
                ? "cursor-pointer hover:border-primary hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"
                : "opacity-50 cursor-not-allowed"
            }`}
            onClick={() => mod.active && mod.route && navigate(mod.route)}
          >
            {!mod.active && (
              <div className="absolute top-3 right-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <CardHeader className="pb-3">
              <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-3 ${
                mod.active
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                <mod.icon className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">{mod.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{mod.description}</CardDescription>
              {!mod.active && (
                <span className="inline-block mt-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Coming Soon
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
