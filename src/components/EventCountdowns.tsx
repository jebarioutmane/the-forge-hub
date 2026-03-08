import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TimeLeft {
  days: number;
  hours: number;
  mins: number;
  secs: number;
}

function getTimeLeft(target: Date): TimeLeft | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

function CountdownCard({ name, date, creator }: { name: string; date: string; creator?: { full_name: string | null; avatar_url: string | null } | null }) {
  const target = parseISO(date);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => {
      const tl = getTimeLeft(target);
      setTimeLeft(tl);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!timeLeft) return null;

  return (
    <Card className="border border-border/40 shadow-sm min-w-[260px] shrink-0">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          {creator && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={creator.avatar_url ? `${creator.avatar_url}?t=${Date.now()}` : undefined} />
                    <AvatarFallback className="text-[9px] bg-muted">{creator.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>Created by {creator.full_name || "Unknown"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <p className="font-bold text-sm text-foreground truncate">{name}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">{format(target, "MMM d, yyyy")}</p>
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          {[
            { value: timeLeft.days, label: "Days" },
            { value: timeLeft.hours, label: "Hrs" },
            { value: timeLeft.mins, label: "Min" },
            { value: timeLeft.secs, label: "Sec" },
          ].map((block) => (
            <div key={block.label} className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-secondary rounded-xl border border-border/30">
              <span className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                {String(block.value).padStart(2, "0")}
              </span>
              <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {block.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventCountdowns() {
  const now = new Date().toISOString().split("T")[0];

  const { data: events = [] } = useQuery({
    queryKey: ["upcoming-events-countdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, start_date, status, profiles!events_created_by_fkey(full_name, avatar_url)")
        .gt("start_date", now)
        .not("status", "in", '("Completed","done","deleted")')
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const upcomingEvents = events.filter((e) => e.start_date && getTimeLeft(parseISO(e.start_date)));

  if (upcomingEvents.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-module-events" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Upcoming Events</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {upcomingEvents.map((e) => (
          <CountdownCard key={e.id} name={e.name} date={e.start_date!} creator={(e as any).profiles} />
        ))}
      </div>
    </div>
  );
}
