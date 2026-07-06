import { Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_COHORTS, useCohort } from "@/contexts/CohortContext";
import { cn } from "@/lib/utils";

interface CohortSwitcherProps {
  className?: string;
  compact?: boolean;
}

/**
 * Global cohort selector rendered in the app header.
 * Reads from and writes to the shared CohortContext.
 */
export function CohortSwitcher({ className, compact }: CohortSwitcherProps) {
  const { cohorts, selectedCohortId, setSelectedCohortId, activeCohort } = useCohort();

  return (
    <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
      <SelectTrigger
        aria-label="Select cohort"
        className={cn(
          "h-8 gap-1.5 rounded-full border-border/70 bg-secondary/60 pl-3 pr-2 text-[13px] font-medium text-foreground hover:bg-secondary transition-colors focus:ring-0 focus:ring-offset-0 [&>svg]:opacity-60",
          compact ? "w-auto min-w-[130px]" : "w-auto min-w-[160px]",
          className,
        )}
      >
        <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <SelectValue placeholder="Cohort" />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[200px]">
        <SelectItem value={ALL_COHORTS}>All cohorts</SelectItem>
        {cohorts.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              {c.label}
              {activeCohort?.id === c.id && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  active
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
