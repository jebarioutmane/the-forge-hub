import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = {
  founder_id: string;
  founder_name: string | null;
  startup_name: string | null;
  risk_status: string | null;
  attendance_rate: number | null;
  days_since_last_checkin: number | null;
};

const RISK_STYLES: Record<string, string> = {
  at_risk: "bg-rose-100 text-rose-700 border-rose-200",
  watch: "bg-amber-100 text-amber-700 border-amber-200",
};
const RISK_LABELS: Record<string, string> = {
  at_risk: "At Risk",
  watch: "Watch",
};

export default function NeedsAttentionPanel() {
  const { data = [] } = useQuery({
    queryKey: ["needs-attention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_engagement" as any)
        .select("founder_id, founder_name, startup_name, risk_status, attendance_rate, days_since_last_checkin")
        .in("risk_status", ["at_risk", "watch"]);
      if (error) throw error;
      return (data as unknown as Row[]) || [];
    },
  });

  const sorted = [...data].sort((a, b) => {
    const rank = (r: string | null) => (r === "at_risk" ? 0 : r === "watch" ? 1 : 2);
    const rd = rank(a.risk_status) - rank(b.risk_status);
    if (rd !== 0) return rd;
    return Number(a.attendance_rate ?? 0) - Number(b.attendance_rate ?? 0);
  });

  return (
    <Card className="border border-border/40 shadow-elev-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">All founders on track</p>
        ) : (
          <div className="divide-y divide-border/60">
            {sorted.map((r) => (
              <Link
                key={r.founder_id}
                to={`/founders?highlight=${r.founder_id}`}
                className="flex items-center justify-between gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{r.startup_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.founder_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`text-[10px] border ${RISK_STYLES[r.risk_status || ""] || ""}`}>
                    {RISK_LABELS[r.risk_status || ""] || r.risk_status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {r.attendance_rate != null ? `${Math.round(Number(r.attendance_rate))}%` : "—"}
                  </Badge>
                  <span className="text-xs text-muted-foreground w-24 text-right">
                    {r.days_since_last_checkin != null
                      ? `${r.days_since_last_checkin}d since check-in`
                      : "No check-in"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
