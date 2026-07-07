import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface LeaderboardEntry {
  id: string;
  founder_name: string;
  startup_name: string;
  photo_url: string | null;
  avgScore: number;
  riskStatus: string | null;
  attendanceRate: number | null;
}

const RISK_STYLES: Record<string, string> = {
  on_track: "bg-emerald-100 text-emerald-700 border-emerald-200",
  watch: "bg-amber-100 text-amber-700 border-amber-200",
  at_risk: "bg-rose-100 text-rose-700 border-rose-200",
};
const RISK_LABELS: Record<string, string> = {
  on_track: "On Track",
  watch: "Watch",
  at_risk: "At Risk",
};

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

  const { data: engagement = [] } = useQuery({
    queryKey: ["founder-engagement-leaderboard"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("founder_engagement")
        .select("founder_id, risk_status, attendance_rate");
      if (error) throw error;
      return (data ?? []) as Array<{ founder_id: string; risk_status: string | null; attendance_rate: number | null }>;
    },
  });

  const engagementMap = useMemo(() => {
    const m: Record<string, { risk: string | null; attendance: number | null }> = {};
    engagement.forEach((e) => { m[e.founder_id] = { risk: e.risk_status, attendance: e.attendance_rate }; });
    return m;
  }, [engagement]);

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
        riskStatus: engagementMap[f.id]?.risk ?? null,
        attendanceRate: engagementMap[f.id]?.attendance ?? null,
      }))
      .filter((f) => f.avgScore > 0 || f.riskStatus)
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [founders, evaluations, engagementMap]);

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
          ) : (
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-colors"
                >
                  <span className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border ${getRankStyle(i + 1)}`}>
                    {i + 1}
                  </span>
                  <Avatar className="h-9 w-9 shrink-0">
                    {entry.photo_url && <AvatarImage src={entry.photo_url} alt={entry.founder_name} />}
                    <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                      {getInitials(entry.founder_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-foreground truncate leading-tight">
                      {entry.founder_name}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate leading-tight">
                      {entry.startup_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {entry.riskStatus && (
                      <Badge className={`text-[10px] border ${RISK_STYLES[entry.riskStatus] || ""}`}>
                        {RISK_LABELS[entry.riskStatus] || entry.riskStatus}
                      </Badge>
                    )}
                    {entry.attendanceRate != null && (
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round(Number(entry.attendanceRate))}%
                      </Badge>
                    )}
                    {entry.avgScore > 0 && (
                      <span className="text-[13px] font-semibold text-foreground bg-secondary px-2.5 py-1 rounded-lg">
                        {entry.avgScore}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
