import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const columns = ["To Do", "In Progress", "Done"];

export default function OperationsTasks() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const priorityVariant = (p: string | null) => {
    if (p === "High") return "destructive";
    if (p === "Medium") return "secondary";
    return "outline";
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading tasks...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Tasks</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col);
          return (
            <div key={col} className="space-y-3">
              <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">{col} ({colTasks.length})</h3>
              {colTasks.length === 0 ? (
                <Card className="border-dashed"><CardContent className="p-4 text-center text-sm text-muted-foreground">No tasks</CardContent></Card>
              ) : (
                colTasks.map((t) => (
                  <Card key={t.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium text-sm">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                      <div className="flex items-center gap-2">
                        <Badge variant={priorityVariant(t.priority)} className="text-xs">{t.priority}</Badge>
                        {t.due_date && <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString()}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
