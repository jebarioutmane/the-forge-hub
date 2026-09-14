import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Search, Users } from "lucide-react";
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
import { ALL_COHORTS, useCohort } from "@/contexts/CohortContext";
import ForgeDoodle from "@/components/ForgeDoodle";

export default function Home() {
  const [showAllFounders, setShowAllFounders] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { selectedCohortId } = useCohort();
  const cohortFilter = selectedCohortId && selectedCohortId !== ALL_COHORTS ? selectedCohortId : null;

  const { data: founders = [] } = useQuery({
    queryKey: ["founders", "home", cohortFilter],
    queryFn: async () => {
      let query = supabase.from("founders").select("id,status,cohort_id");
      if (cohortFilter) query = query.eq("cohort_id", cohortFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", "home", cohortFilter],
    queryFn: async () => {
      let query = supabase.from("events").select("id,status,cohort_id");
      if (cohortFilter) query = query.eq("cohort_id", cohortFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const activeFounders = founders.filter((f) => f.status === "Active" || f.status === "Current");
  const activeEvents = events.filter((e) => e.status === "Active" || e.status === "Planning");
  const founderCount = showAllFounders ? founders.length : activeFounders.length;
  const founderLabel = showAllFounders ? "All-time founders" : "Active founders";

  return (
    <PageContainer className="space-y-6">
      <ForgeDoodle />
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <WeeklyFocusesPanel />
          <FoundersLeaderboard />
        </div>

        <div className="space-y-6 lg:col-span-4">
          {/* KPI figures */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{founderLabel}</p>
                  <p className="stat-figure text-3xl">{founderCount}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllFounders(!showAllFounders)}
                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
                title={showAllFounders ? "Show active only" : "Show all founders"}
              >
                {showAllFounders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            <div className="border-t border-border p-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Active events</p>
                  <p className="stat-figure text-3xl">{activeEvents.length}</p>
                </div>
              </div>
            </div>
          </div>

          <EventCountdowns />
          <BirthdaysPanel />
        </div>
      </div>

      <GlobalNetworkMap />

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </PageContainer>
  );
}
