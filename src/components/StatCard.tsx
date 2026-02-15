import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  warning?: boolean;
}

export function StatCard({ title, value, icon: Icon, warning }: StatCardProps) {
  return (
    <Card className={warning ? "border-destructive/50" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-bold ${warning ? "text-destructive" : "text-foreground"}`} style={{ fontFamily: "var(--font-display)" }}>
              {value}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${warning ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
