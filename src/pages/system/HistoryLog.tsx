import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Eye, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type HistoryLog = Tables<"history_logs">;

const SECTION_TABLE_MAP: Record<string, string> = {
  "Ops-Expenses": "expenses",
  "Ops-Contracts": "contracts",
  "Ops-Stipends": "stipends",
  "Ops-Tasks": "tasks",
  "Events-Timeline": "events",
  "Events-Logistics": "event_logistics",
  "Events-Stakeholders": "stakeholders",
  "Founders-Directory": "founders",
  "Founders-Tracking": "founders_tracking",
  "Founders-Evaluations": "founder_evaluations",
  "Founders-Progress": "founder_progress",
  "System-Profiles": "profiles",
};

const actionColor: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  UPDATE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  DELETE: "bg-destructive/15 text-destructive",
};

function JsonView({ data }: { data: any }) {
  if (!data || typeof data !== "object") return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-1 text-sm">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="font-medium text-muted-foreground min-w-[120px]">{key}:</span>
          <span className="text-foreground break-all">
            {value === null ? <span className="text-muted-foreground italic">null</span> : typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HistoryLog() {
  const queryClient = useQueryClient();
  const [viewLog, setViewLog] = useState<HistoryLog | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<HistoryLog | null>(null);

  const { data: logs = [] } = useQuery({
    queryKey: ["history_logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("history_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (log: HistoryLog) => {
      const tableName = SECTION_TABLE_MAP[log.section_name];
      if (!tableName) throw new Error(`Unknown section: ${log.section_name}`);
      if (!log.old_data) throw new Error("No old data to restore");

      const restoreData = { ...(log.old_data as Record<string, any>) };
      // Remove fields that shouldn't be upserted
      delete restoreData.created_at;

      const { error } = await supabase.from(tableName as any).upsert(restoreData as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setRestoreTarget(null);
      toast.success("Record restored successfully");
    },
    onError: (e) => {
      toast.error(e.message);
      setRestoreTarget(null);
    },
  });

  const columns: DataTableColumn<HistoryLog>[] = [
    {
      key: "created_at",
      label: "Date",
      render: (row) => format(new Date(row.created_at), "MMM d, yyyy HH:mm"),
    },
    {
      key: "changed_by_name",
      label: "User",
      render: (row) => row.changed_by_name || "System",
    },
    {
      key: "section_name",
      label: "Section",
      render: (row) => <Badge variant="outline">{row.section_name}</Badge>,
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <Badge className={actionColor[row.action] || ""}>{row.action}</Badge>
      ),
    },
    {
      key: "record_id",
      label: "Record",
      render: (row) => <span className="font-mono text-xs">{row.record_id.slice(0, 8)}...</span>,
    },
  ];

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">History Log</h1>
        <p className="text-sm text-muted-foreground">Universal audit trail — view, inspect, and restore changes across all sections</p>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        pageSize={15}
        actionColumn={(row) => (
          <div className="flex gap-1 justify-end">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewLog(row)}>
              <Eye className="h-4 w-4" />
            </Button>
            {(row.action === "DELETE" || row.action === "UPDATE") && row.old_data && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" onClick={() => setRestoreTarget(row)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />

      {/* View Detail Dialog */}
      <Dialog open={!!viewLog} onOpenChange={(open) => !open && setViewLog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Details</DialogTitle>
          </DialogHeader>
          {viewLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Action:</span> <Badge className={actionColor[viewLog.action] || ""}>{viewLog.action}</Badge></div>
                <div><span className="text-muted-foreground">Section:</span> {viewLog.section_name}</div>
                <div><span className="text-muted-foreground">By:</span> {viewLog.changed_by_name || "System"}</div>
                <div><span className="text-muted-foreground">Date:</span> {format(new Date(viewLog.created_at), "PPpp")}</div>
              </div>

              {viewLog.action !== "INSERT" && viewLog.old_data && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-destructive">Previous Data</p>
                  <div className="bg-destructive/5 rounded-md p-3 border border-destructive/10">
                    <JsonView data={viewLog.old_data} />
                  </div>
                </div>
              )}

              {viewLog.action !== "DELETE" && viewLog.new_data && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-emerald-600">New Data</p>
                  <div className="bg-emerald-500/5 rounded-md p-3 border border-emerald-500/10">
                    <JsonView data={viewLog.new_data} />
                  </div>
                </div>
              )}

              {viewLog.action === "DELETE" && !viewLog.old_data && (
                <p className="text-sm text-muted-foreground">No data snapshot was captured for this deletion.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will upsert the previous data back into the <strong>{restoreTarget?.section_name}</strong> table, effectively undoing the {restoreTarget?.action?.toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => restoreTarget && restoreMutation.mutate(restoreTarget)}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
