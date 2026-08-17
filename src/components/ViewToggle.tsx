import { LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  viewMode: "grid" | "table";
  onChange: (mode: "grid" | "table") => void;
}

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border/70 bg-secondary p-0.5 gap-0.5">
      <Button
        size="sm"
        variant="ghost"
        className={cn("h-7 px-2.5 gap-1.5", viewMode === "grid" && "bg-card shadow-elev-xs")}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="text-xs">Grid</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={cn("h-7 px-2.5 gap-1.5", viewMode === "table" && "bg-card shadow-elev-xs")}
        onClick={() => onChange("table")}
      >
        <Table2 className="h-3.5 w-3.5" />
        <span className="text-xs">Table</span>
      </Button>
    </div>
  );
}
