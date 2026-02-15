import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StatusPipelineProps {
  stages: string[];
  currentStage: string;
  onStageClick?: (stage: string) => void;
}

export default function StatusPipeline({ stages, currentStage, onStageClick }: StatusPipelineProps) {
  const currentIdx = stages.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={stage} className="flex items-center gap-1">
            <button
              onClick={() => onStageClick?.(stage)}
              className={cn(
                "flex items-center justify-center rounded-full text-xs font-medium transition-all",
                "h-6 w-6 shrink-0",
                isCompleted && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary/20 text-primary ring-2 ring-primary",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              title={stage}
            >
              {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
            </button>
            {i < stages.length - 1 && (
              <div className={cn("h-0.5 w-4", i < currentIdx ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        );
      })}
      <span className="ml-2 text-xs text-muted-foreground">{currentStage}</span>
    </div>
  );
}
