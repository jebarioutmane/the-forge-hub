import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, History as HistoryIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type HistoryLog = Tables<"history_logs">;

const actionColor: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
  UPDATE: "bg-amber-500/15 text-amber-700 border-amber-500/20",
  DELETE: "bg-destructive/15 text-destructive border-destructive/20",
};

function JsonView({ data }: { data: any }) {
  if (!data || typeof data !== "object")
    return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-1 text-sm">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="font-medium text-muted-foreground min-w-[140px]">
            {key}:
          </span>
          <span className="text-foreground break-all">
            {value === null ? (
              <span className="text-muted-foreground italic">null</span>
            ) : typeof value === "object" ? (
              JSON.stringify(value)
            ) : (
              String(value)
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HistoryLog() {
  const [viewLog, setViewLog] = useState<HistoryLog | null>(null);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["history_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("history_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as HistoryLog[];
    },
  });

  const sections = useMemo(
    () =>
      Array.from(new Set(logs.map((l) => l.section_name).filter(Boolean))).sort(),
    [logs],
  );
  const users = useMemo(
    () =>
      Array.from(
        new Set(logs.map((l) => l.changed_by_name).filter(Boolean) as string[]),
      ).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (sectionFilter !== "all" && l.section_name !== sectionFilter)
        return false;
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (userFilter !== "all" && (l.changed_by_name || "") !== userFilter)
        return false;
      if (dateFrom && new Date(l.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(l.created_at) > end) return false;
      }
      if (q) {
        const hay = [
          l.section_name,
          l.action,
          l.changed_by_name,
          l.record_id,
          JSON.stringify(l.old_data ?? ""),
          JSON.stringify(l.new_data ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, sectionFilter, actionFilter, userFilter, dateFrom, dateTo]);

  const hasFilters =
    !!search ||
    sectionFilter !== "all" ||
    actionFilter !== "all" ||
    userFilter !== "all" ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setSearch("");
    setSectionFilter("all");
    setActionFilter("all");
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const columns: DataTableColumn<HistoryLog>[] = [
    {
      key: "created_at",
      label: "When",
      render: (row) => (
        <span className="text-sm tabular-nums text-[#1D1D1F]">
          {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
        </span>
      ),
    },
    {
      key: "changed_by_name",
      label: "Who",
      render: (row) => (
        <span className="text-sm">{row.changed_by_name || "System"}</span>
      ),
    },
    {
      key: "section_name",
      label: "Section",
      render: (row) => (
        <Badge variant="outline" className="font-normal">
          {row.section_name}
        </Badge>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <Badge className={actionColor[row.action] || ""} variant="outline">
          {row.action}
        </Badge>
      ),
    },
    {
      key: "record_id",
      label: "Record",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.record_id.slice(0, 8)}…
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-6xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <HistoryIcon className="h-3.5 w-3.5" />
          System · Audit Trail
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#1D1D1F]">
          History Log
        </h1>
        <p className="text-sm text-muted-foreground">
          Read-only audit trail — every change across the workspace. Recovery is
          handled in each section's Archived view.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records, values…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="INSERT">Insert</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-sm"
              aria-label="From date"
            />
          </div>
          <div className="flex items-center gap-2 lg:col-start-6">
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-sm"
              aria-label="To date"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {isLoading
              ? "Loading…"
              : `${filtered.length} of ${logs.length} entries`}
          </span>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" /> Clear filters
            </Button>
          )}
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        pageSize={20}
        actionColumn={(row) => (
          <div className="flex gap-1 justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setViewLog(row)}
              aria-label="View details"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      {/* View Detail Dialog (read-only) */}
      <Dialog open={!!viewLog} onOpenChange={(open) => !open && setViewLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change details</DialogTitle>
            <DialogDescription>
              Read-only view of this audit entry.
            </DialogDescription>
          </DialogHeader>
          {viewLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Action
                  </div>
                  <Badge
                    className={actionColor[viewLog.action] || ""}
                    variant="outline"
                  >
                    {viewLog.action}
                  </Badge>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Section
                  </div>
                  <div>{viewLog.section_name}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Who
                  </div>
                  <div>{viewLog.changed_by_name || "System"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    When
                  </div>
                  <div>{format(new Date(viewLog.created_at), "PPpp")}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Record ID
                  </div>
                  <div className="font-mono text-xs break-all">
                    {viewLog.record_id}
                  </div>
                </div>
              </div>

              {viewLog.action !== "INSERT" && viewLog.old_data && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-destructive">
                    Previous values
                  </p>
                  <div className="bg-destructive/5 rounded-md p-3 border border-destructive/10">
                    <JsonView data={viewLog.old_data} />
                  </div>
                </div>
              )}

              {viewLog.action !== "DELETE" && viewLog.new_data && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-emerald-600">
                    New values
                  </p>
                  <div className="bg-emerald-500/5 rounded-md p-3 border border-emerald-500/10">
                    <JsonView data={viewLog.new_data} />
                  </div>
                </div>
              )}

              {viewLog.action === "DELETE" && !viewLog.old_data && (
                <p className="text-sm text-muted-foreground">
                  No data snapshot was captured for this deletion.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
