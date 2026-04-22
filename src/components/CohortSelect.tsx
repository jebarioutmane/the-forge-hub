import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCohorts } from "@/hooks/useCohorts";
import { formatCohortLabel, formatCohortWindow } from "@/lib/cohortYears";

interface CohortSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** When true, includes all DB cohorts; otherwise the prev2..next2 window. */
  showAll?: boolean;
}

export function CohortSelect({ value, onChange, placeholder = "Select cohort", className, showAll }: CohortSelectProps) {
  const { visible, all, startMonth, endMonth } = useCohorts();
  const labels = showAll
    ? Array.from(new Set([...all.map((c) => c.label), ...visible]))
    : Array.from(new Set([...visible, value].filter(Boolean)));

  // Sort newest first
  labels.sort((a, b) => b.localeCompare(a));

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {value ? formatCohortLabel(value) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <TooltipProvider delayDuration={200}>
          {labels.map((label) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <SelectItem value={label}>{formatCohortLabel(label)}</SelectItem>
              </TooltipTrigger>
              <TooltipContent side="right">
                {formatCohortWindow(label, startMonth, endMonth)}
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </SelectContent>
    </Select>
  );
}
