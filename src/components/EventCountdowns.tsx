import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

function FlipDigit({ value }: { value: string }) {
  return (
    <div className="relative w-[28px] h-[38px] rounded-md overflow-hidden shadow-lg">
      {/* Top half */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-[#1a1a1a] overflow-hidden border-b border-black/60">
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-[28px] font-bold text-white leading-none"
          style={{ fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}>
          {value}
        </span>
      </div>
      {/* Bottom half */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#111111] overflow-hidden">
        <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[28px] font-bold text-white/90 leading-none"
          style={{ fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}>
          {value}
        </span>
      </div>
      {/* Center line */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-black/40 z-10" />
      {/* Subtle shine */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
    </div>
  );
}

function FlipUnit({ value, label }: { value: number; label: string }) {
  const padded = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-[3px]">
        <FlipDigit value={padded[0]} />
        <FlipDigit value={padded[1]} />
      </div>
      <span className="text-[9px] font-medium text-muted-foreground/70 uppercase tracking-[0.15em]">{label}</span>
    </div>
  );
}

function CountdownCard({ name, date, creator }: { name: string; date: string; creator?: { full_name: string | null; avatar_url: string | null } | null }) {
  const target = parseISO(date);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!timeLeft) return null;

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl min-w-[220px] shrink-0 px-5 py-4 space-y-3 shadow-xl">
      <div className="flex items-center gap-2">
        {creator && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-5 w-5 shrink-0 ring-1 ring-white/10">
                  <AvatarImage src={creator.avatar_url ? `${creator.avatar_url}?t=${Date.now()}` : undefined} />
                  <AvatarFallback className="text-[8px] bg-white/10 text-white/60">{creator.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>Created by {creator.full_name || "Unknown"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <p className="font-semibold text-[13px] text-white truncate leading-tight">{name}</p>
      </div>
      <p className="text-[10px] text-white/40 leading-none">{format(target, "MMM d, yyyy")}</p>
      <div className="flex items-start gap-2.5">
        <FlipUnit value={timeLeft.days} label="Days" />
        <span className="text-white/30 text-lg font-light mt-1.5">:</span>
        <FlipUnit value={timeLeft.hours} label="Hrs" />
        <span className="text-white/30 text-lg font-light mt-1.5">:</span>
        <FlipUnit value={timeLeft.mins} label="Min" />
        <span className="text-white/30 text-lg font-light mt-1.5">:</span>
        <FlipUnit value={timeLeft.secs} label="Sec" />
      </div>
    </div>
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
