import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy } from "lucide-react";
import { FounderSparkline } from "@/components/FounderSparkline";
import { useIsMobile } from "@/hooks/use-mobile";

interface LeaderboardEntry {
  id: string;
  founder_name: string;
  startup_name: string;
  photo_url: string | null;
  avgScore: number;
}

export default function FoundersLeaderboard() {
  const { data: founders = [] } = useQuery({
    queryKey: ["founders-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders")
        .select("id, founder_name, startup_name, photo_url");
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["evaluations-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_evaluations")
        .select("founder_id, total_score");
      if (error) throw error;
      return data;
    },
  });

  const { data: tracking = [] } = useQuery({
    queryKey: ["founders_tracking_leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founders_tracking")
        .select("founder_id, overall_score, tracking_date")
        .order("tracking_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: absences = [] } = useQuery({
    queryKey: ["program_attendance_absences"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("program_event_attendance")
        .select("founder_id, status")
        .eq("status", "Absent");
      if (error) throw error;
      return data as { founder_id: string; status: string }[];
    },
  });

  const absenceCount = useMemo(() => {
    const m: Record<string, number> = {};
    absences.forEach((a) => { m[a.founder_id] = (m[a.founder_id] || 0) + 1; });
    return m;
  }, [absences]);

  const sparklineMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    const dateMap: Record<string, string[]> = {};
    tracking.forEach((t) => {
      if (!t.founder_id || t.overall_score == null) return;
      if (!map[t.founder_id]) { map[t.founder_id] = []; dateMap[t.founder_id] = []; }
      map[t.founder_id].push(t.overall_score);
      dateMap[t.founder_id].push(t.tracking_date || "");
    });
    return { scores: map, dates: dateMap };
  }, [tracking]);

  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    const scoreMap: Record<string, { total: number; count: number }> = {};
    evaluations.forEach((ev) => {
      if (!ev.founder_id || ev.total_score == null) return;
      if (!scoreMap[ev.founder_id]) scoreMap[ev.founder_id] = { total: 0, count: 0 };
      scoreMap[ev.founder_id].total += Number(ev.total_score);
      scoreMap[ev.founder_id].count += 1;
    });

    return founders
      .map((f) => ({
        id: f.id,
        founder_name: f.founder_name,
        startup_name: f.startup_name,
        photo_url: f.photo_url,
        avgScore: scoreMap[f.id] ? Math.round(scoreMap[f.id].total / scoreMap[f.id].count) : 0,
      }))
      .filter((f) => f.avgScore > 0)
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [founders, evaluations]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-amber-100 text-amber-700 border-amber-200";
    if (rank === 2) return "bg-slate-100 text-slate-600 border-slate-200";
    if (rank === 3) return "bg-orange-50 text-orange-600 border-orange-200";
    return "bg-muted text-muted-foreground border-border";
  };

  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
          <Trophy className="h-4 w-4 text-amber-600" />
        </div>
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
          Founders Leaderboard
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-2">
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No evaluation data yet.
            </p>
          ) : isMobile ? (
            /* ── Mobile: stacked card layout ── */
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.id}
                  className="rounded-xl bg-card border border-border/60 p-3.5 shadow-sm"
                >
                  {/* Top row: rank, avatar, name, score */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border ${getRankStyle(i + 1)}`}
                    >
                      {i + 1}
                    </span>
                    <Avatar className="h-9 w-9 shrink-0">
                      {entry.photo_url && (
                        <AvatarImage src={entry.photo_url} alt={entry.founder_name} />
                      )}
                      <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                        {getInitials(entry.founder_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-foreground truncate leading-tight flex items-center gap-1.5">
                        {entry.founder_name}
                        {absenceCount[entry.id] > 0 && (
                          <span title={`${absenceCount[entry.id]} absence(s)`} className="inline-flex items-center h-4 px-1.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-semibold">
                            ⚑ {absenceCount[entry.id]}
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate leading-tight">
                        {entry.startup_name}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold text-foreground bg-secondary px-2.5 py-1 rounded-lg shrink-0">
                      {entry.avgScore}
                    </span>
                  </div>

                  {/* Second row: sparkline with inline label */}
                  {(sparklineMap.scores[entry.id]?.length ?? 0) >= 2 && (
                    <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-3">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                        Consistency
                      </span>
                      <FounderSparkline
                        scores={sparklineMap.scores[entry.id] || []}
                        dates={sparklineMap.dates[entry.id] || []}
                        width={100}
                        height={28}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── Desktop: grid row layout ── */
            <>
              <div className="grid grid-cols-[auto_auto_1fr_100px_70px] items-center gap-3 px-3 pb-1.5 mb-1">
                <div className="h-7 w-7" />
                <div className="h-9 w-9" />
                <div />
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">Consistency Pattern</span>
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center">Blocks Evaluation</span>
              </div>
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[auto_auto_1fr_100px_70px] items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-colors"
                >
                  <span
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border ${getRankStyle(i + 1)}`}
                  >
                    {i + 1}
                  </span>
                  <Avatar className="h-9 w-9">
                    {entry.photo_url && (
                      <AvatarImage src={entry.photo_url} alt={entry.founder_name} />
                    )}
                    <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                      {getInitials(entry.founder_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-foreground truncate leading-tight flex items-center gap-1.5">
                      {entry.founder_name}
                      {absenceCount[entry.id] > 0 && (
                        <span title={`${absenceCount[entry.id]} absence(s)`} className="inline-flex items-center h-4 px-1.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-semibold">
                          ⚑ {absenceCount[entry.id]}
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate leading-tight">
                      {entry.startup_name}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <FounderSparkline scores={sparklineMap.scores[entry.id] || []} dates={sparklineMap.dates[entry.id] || []} />
                  </div>
                  <div className="flex justify-center">
                    <span className="text-[13px] font-semibold text-foreground bg-secondary px-2.5 py-1 rounded-lg text-center min-w-[50px]">
                      {entry.avgScore}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
