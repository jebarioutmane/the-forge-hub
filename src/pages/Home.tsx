import { useState } from "react";
import { Briefcase, CalendarDays, GraduationCap, Users, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import GlobalNetworkMap from "@/components/GlobalNetworkMap";
import EventCountdowns from "@/components/EventCountdowns";
import TeamPresence from "@/components/TeamPresence";
import FoundersLeaderboard from "@/components/FoundersLeaderboard";
import WeeklyFocusesPanel from "@/components/WeeklyFocusesPanel";
import BirthdaysPanel from "@/components/BirthdaysPanel";
import ForgeDoodle from "@/components/ForgeDoodle";
import { GlobalSearch } from "@/components/GlobalSearch";

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
    <div className="px-6 lg:px-10 py-8 space-y-8 max-w-7xl mx-auto">
      {/* Hero: doodle + centered search */}
      <div className="flex flex-col items-center gap-6 pt-4 pb-2">
        <div className="w-full max-w-[520px] md:max-w-[600px]">
          <ForgeDoodle />
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full max-w-xl h-12 bg-secondary rounded-full flex items-center px-5 text-muted-foreground cursor-text hover:bg-accent transition-colors gap-3 shadow-sm border border-border/40"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="text-sm">Search anything...</span>
        </button>
      </div>

      <div className="flex items-center justify-end">
        <TeamPresence />
      </div>


      {/* Shortcut Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {shortcuts.map((s) => (
          <Button
            key={s.title}
            variant="outline"
            className={`w-full h-14 rounded-xl bg-card border border-border/40 text-foreground hover:bg-secondary shadow-sm transition-all flex items-center justify-center gap-3 whitespace-nowrap text-base font-semibold`}
            onClick={() => navigate(s.route)}
          >
            <s.icon className="h-5 w-5 shrink-0" />
            {s.title}
          </Button>
        ))}
      </div>

      {/* Weekly Focuses */}
      <WeeklyFocusesPanel />

      {/* Two KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border border-border/40 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-module-founders/10 text-module-founders">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{founderLabel}</p>
                <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{founderCount}</p>
              </div>
              <button
                onClick={() => setShowAllFounders(!showAllFounders)}
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                title={showAllFounders ? "Show active only" : "Show all founders"}
              >
                {showAllFounders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/40 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-module-events/10 text-module-events">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active Events</p>
                <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{activeEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Countdowns */}
      <EventCountdowns />

      {/* Upcoming Birthdays */}
      <BirthdaysPanel />


      {/* Split Layout: Leaderboard + Map */}
      <div className="flex flex-col gap-8 w-full">
        <div className="w-full bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <FoundersLeaderboard />
        </div>
        <div className="w-full bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <GlobalNetworkMap />
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
