import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  warning?: boolean;
}

export function StatCard({ title, value, icon: Icon, warning }: StatCardProps) {
  return (
    <Card className={cn("hover:shadow-elev-sm hover:border-border", warning && "border-destructive/40")}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.12em]">{title}</p>
            <p className={cn("stat-figure text-3xl", warning && "text-destructive")}>
              {value}
            </p>
          </div>
          <div className={cn("h-10 w-10 rounded-md flex items-center justify-center border border-border",
            warning ? "bg-destructive/5 text-destructive border-destructive/30" : "bg-secondary text-primary")}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
