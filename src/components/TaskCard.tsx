import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;

interface TaskCardProps {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  labels: string[];
}

const priorityVariant = (p: string | null) => {
  if (p === "High") return "destructive" as const;
  if (p === "Medium") return "secondary" as const;
  return "outline" as const;
};

export default function TaskCard({ task, selected, onSelect, onMoveLeft, onMoveRight, onEdit, onDelete, labels }: TaskCardProps) {
  const assignedMatch = task.description?.match(/Assigned to:\s*(.+)/);
  const matchedLabels = labels.filter((l) => task.description?.includes(l));

  return (
    <Card className={`hover:border-primary/30 transition-colors ${selected ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Checkbox checked={selected} onCheckedChange={() => onSelect(task.id)} className="mt-1" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{task.title}</p>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {task.description.replace(/\n\nAssigned to:.+/, "")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant={priorityVariant(task.priority)} className="text-xs">{task.priority}</Badge>
          {task.due_date && <span className="text-xs text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</span>}
          {matchedLabels.map((l) => (
            <Badge key={l} variant="outline" className="text-xs bg-accent/50">{l}</Badge>
          ))}
        </div>

        {assignedMatch && (
          <p className="text-xs text-primary font-medium">👤 {assignedMatch[1]}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-1">
            {onMoveLeft && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveLeft}><ChevronLeft className="h-3 w-3" /></Button>}
            {onMoveRight && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveRight}><ChevronRight className="h-3 w-3" /></Button>}
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
