import { useState } from "react";
import { Briefcase, CalendarDays, GraduationCap, Users, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import GlobalNetworkMap from "@/components/GlobalNetworkMap";
import EventCountdowns from "@/components/EventCountdowns";

import FoundersLeaderboard from "@/components/FoundersLeaderboard";
import WeeklyFocusesPanel from "@/components/WeeklyFocusesPanel";
import BirthdaysPanel from "@/components/BirthdaysPanel";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";


const shortcuts = [
  {
    title: "Founders",
    icon: GraduationCap,
    route: "/founders",
    color: "bg-module-founders/10 text-module-founders hover:bg-module-founders/20",
    border: "border-module-founders/30",
  },
  {
    title: "Events",
    icon: CalendarDays,
    route: "/events",
    color: "bg-module-events/10 text-module-events hover:bg-module-events/20",
    border: "border-module-events/30",
  },
  {
    title: "Operations",
    icon: Briefcase,
    route: "/operations",
    color: "bg-module-operations/10 text-module-operations hover:bg-module-operations/20",
    border: "border-module-operations/30",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [showAllFounders, setShowAllFounders] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: founders = [] } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*");
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

  const activeFounders = founders.filter((f) => f.status === "Active" || f.status === "Current");
  const activeEvents = events.filter((e) => e.status === "Active" || e.status === "Planning");
  const founderCount = showAllFounders ? founders.length : activeFounders.length;
  const founderLabel = showAllFounders ? "All-Time Founders" : "Active Founders";

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Programme status across founders, events and operations."
        actions={
          <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4" />
            Search
          </Button>
        }
      />

      {/* Section shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {shortcuts.map((s) => (
          <Button
            key={s.title}
            variant="outline"
            className="w-full h-12 justify-start gap-3 text-sm font-medium"
            onClick={() => navigate(s.route)}
          >
            <s.icon className="h-4 w-4 shrink-0" />
            {s.title}
          </Button>
        ))}
      </div>

      {/* Weekly Focuses */}
      <WeeklyFocusesPanel />

      {/* KPI figures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded flex items-center justify-center bg-secondary text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">{founderLabel}</p>
                <p className="stat-figure text-3xl">{founderCount}</p>
              </div>
              <button
                onClick={() => setShowAllFounders(!showAllFounders)}
                className="h-7 w-7 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground"
                title={showAllFounders ? "Show active only" : "Show all founders"}
              >
                {showAllFounders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded flex items-center justify-center bg-secondary text-primary">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active events</p>
                <p className="stat-figure text-3xl">{activeEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <EventCountdowns />

      <BirthdaysPanel />

      <div className="flex flex-col gap-6 w-full">
        <div className="w-full bg-card rounded-lg border border-border overflow-hidden flex flex-col h-[500px]">
          <FoundersLeaderboard />
        </div>
        <div className="w-full bg-card rounded-lg border border-border overflow-hidden flex flex-col h-[500px]">
          <GlobalNetworkMap />
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </PageContainer>
  );
}
