import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, Archive, ArchiveRestore, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCohortLabel, formatCohortWindow, computeActiveCohort, parseCohort } from "@/lib/cohortYears";


export default function Settings() {
  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">System preferences and cohort configuration</p>
      </div>

      <CohortSettingsCard />
    </div>
  );
}

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

function CohortSettingsCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);
  const [newCohort, setNewCohort] = useState({ label: "", start_date: "", end_date: "" });
  const [showArchived, setShowArchived] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["app_settings", "cohort"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("key,value")
        .in("key", ["cohort_start_month", "cohort_end_month"]);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const v = typeof r.value === "number" ? r.value : Number(r.value);
        if (!Number.isNaN(v)) map[r.key] = v;
      });
      return map;
    },
  });

  const startMonth = settings?.cohort_start_month ?? 9;
  const endMonth = settings?.cohort_end_month ?? 5;

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohorts")
        .select("id,label,year,start_date,end_date,is_archived,is_active" as any)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Usage counts across every table that references cohorts, so archive can
  // warn the user how much data is attached before soft-deleting.
  const { data: usage = {} } = useQuery({
    queryKey: ["cohort-usage-all"],
    queryFn: async () => {
      const [founders, expenses, contracts, events, stipends, budgetLines] = await Promise.all([
        supabase.from("founders").select("cohort_id,cohort_year"),
        supabase.from("expenses").select("cohort_id"),
        supabase.from("contracts").select("cohort_id"),
        supabase.from("events").select("cohort_year"),
        supabase.from("stipend_records").select("cohort_year"),
        supabase.from("budget_lines").select("cohort_id"),
      ]);
      const map: Record<string, { founders: number; expenses: number; contracts: number; events: number; stipends: number; budgetLines: number }> = {};
      const bump = (id: string | null | undefined, key: keyof (typeof map)[string]) => {
        if (!id) return;
        map[id] = map[id] || { founders: 0, expenses: 0, contracts: 0, events: 0, stipends: 0, budgetLines: 0 };
        (map[id][key] as number)++;
      };
      // For text-label lookups we need to translate label → id, done at read time.
      return { rows: { founders, expenses, contracts, events, stipends, budgetLines }, map, bump } as any;
    },
  });

  // Build the actual per-cohort counts once cohorts are known.
  const usageById = useMemo(() => {
    const raw = (usage as any)?.rows;
    if (!raw) return {} as Record<string, any>;
    const byLabel: Record<string, string> = {};
    cohorts.forEach((c: any) => { byLabel[c.label] = c.id; });
    const out: Record<string, { founders: number; expenses: number; contracts: number; events: number; stipends: number; budgetLines: number }> = {};
    const ensure = (id: string) => (out[id] = out[id] || { founders: 0, expenses: 0, contracts: 0, events: 0, stipends: 0, budgetLines: 0 });
    (raw.founders.data ?? []).forEach((r: any) => {
      const id = r.cohort_id ?? byLabel[r.cohort_year];
      if (id) ensure(id).founders++;
    });
    (raw.expenses.data ?? []).forEach((r: any) => { if (r.cohort_id) ensure(r.cohort_id).expenses++; });
    (raw.contracts.data ?? []).forEach((r: any) => { if (r.cohort_id) ensure(r.cohort_id).contracts++; });
    (raw.events.data ?? []).forEach((r: any) => { const id = byLabel[r.cohort_year]; if (id) ensure(id).events++; });
    (raw.stipends.data ?? []).forEach((r: any) => { const id = byLabel[r.cohort_year]; if (id) ensure(id).stipends++; });
    (raw.budgetLines.data ?? []).forEach((r: any) => { if (r.cohort_id) ensure(r.cohort_id).budgetLines++; });
    return out;
  }, [usage, cohorts]);

  function totalUsage(id: string) {
    const u = usageById[id];
    if (!u) return 0;
    return u.founders + u.expenses + u.contracts + u.events + u.stipends + u.budgetLines;
  }

  const active = computeActiveCohort(startMonth);
  const visibleCohorts = cohorts.filter((c: any) => !c.is_archived);
  const archivedCohorts = cohorts.filter((c: any) => c.is_archived);

  // Any mutation that changes the cohorts list must refresh BOTH the local
  // query and the shared CohortProvider query so the header switcher updates.
  function invalidateCohortLists() {
    queryClient.invalidateQueries({ queryKey: ["cohorts-all"] });
    queryClient.invalidateQueries({ queryKey: ["cohorts", "global"] });
    queryClient.invalidateQueries({ queryKey: ["cohort-usage-all"] });
  }

  const setMonthMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { error } = await supabase
        .from("app_settings" as any)
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings", "cohort"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCohortMutation = useMutation({
    mutationFn: async () => {
      const p = parseCohort(newCohort.label.trim());
      if (!p) throw new Error("Use format YYYY-YYYY (e.g. 2025-2026)");
      const { error } = await supabase.from("cohorts").insert({
        name: newCohort.label.trim(),
        label: newCohort.label.trim(),
        year: p.startYear,
        start_date: newCohort.start_date || null,
        end_date: newCohort.end_date || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCohortLists();
      setNewCohort({ label: "", start_date: "", end_date: "" });
      toast.success("Cohort added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const target = cohorts.find((c: any) => c.id === id);
      if (target?.is_active) throw new Error("The active cohort can't be archived. Switch active status first.");
      const { error } = await supabase
        .from("cohorts")
        .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCohortLists();
      setArchiveTarget(null);
      toast.success("Cohort archived — linked data preserved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cohorts")
        .update({ is_archived: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCohortLists();
      toast.success("Cohort restored");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function statusOf(label: string): "Active" | "Upcoming" | "Past" {
    const p = parseCohort(label);
    const a = parseCohort(active);
    if (!p || !a) return "Past";
    if (p.startYear === a.startYear) return "Active";
    if (p.startYear > a.startYear) return "Upcoming";
    return "Past";
  }

  const statusColor: Record<string, string> = {
    Active: "bg-primary text-primary-foreground",
    Upcoming: "bg-secondary text-secondary-foreground",
    Past: "bg-muted text-muted-foreground",
  };

  const archiveUsage = archiveTarget ? usageById[archiveTarget.id] : null;
  const archiveTotal = archiveTarget ? totalUsage(archiveTarget.id) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cohort Settings</CardTitle>
        <CardDescription>
          Configure when each cohort year rolls over and manage the list of cohorts.
          The active cohort is currently <strong>{formatCohortLabel(active)}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cohort start month</Label>
            <Select value={String(startMonth)} onValueChange={(v) => setMonthMutation.mutate({ key: "cohort_start_month", value: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cohort end month</Label>
            <Select value={String(endMonth)} onValueChange={(v) => setMonthMutation.mutate({ key: "cohort_end_month", value: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Cohorts</Label>
          <div className="rounded-lg border divide-y">
            {visibleCohorts.map((c: any) => {
              const s = statusOf(c.label);
              const count = totalUsage(c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="font-medium w-24">{formatCohortLabel(c.label)}</span>
                  <span className="text-xs text-muted-foreground flex-1">
                    {formatCohortWindow(c.label, startMonth, endMonth)}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {count} linked record{count === 1 ? "" : "s"}
                    </span>
                  )}
                  <Badge className={statusColor[s] + " text-[10px]"}>{s}</Badge>
                  {c.is_active && (
                    <Badge variant="outline" className="text-[10px]">Active</Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={c.is_active}
                    title={c.is_active ? "Active cohort can't be archived" : "Archive cohort"}
                    onClick={() => setArchiveTarget(c)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            {visibleCohorts.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">No cohorts yet.</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">New cohort</Label>
            <Input
              value={newCohort.label}
              onChange={(e) => setNewCohort({ ...newCohort, label: e.target.value })}
              placeholder="2026-2027"
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Start date</Label>
            <Input type="date" value={newCohort.start_date} onChange={(e) => setNewCohort({ ...newCohort, start_date: e.target.value })} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End date</Label>
            <Input type="date" value={newCohort.end_date} onChange={(e) => setNewCohort({ ...newCohort, end_date: e.target.value })} className="w-40" />
          </div>
          <Button size="sm" onClick={() => addCohortMutation.mutate()} disabled={!newCohort.label.trim()}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </div>

        {/* Archived cohorts */}
        <div className="pt-2 border-t">
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showArchived ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Archived cohorts ({archivedCohorts.length})
          </button>
          {showArchived && (
            <div className="mt-3 rounded-lg border divide-y bg-muted/20">
              {archivedCohorts.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">No archived cohorts.</p>
              )}
              {archivedCohorts.map((c: any) => {
                const count = totalUsage(c.id);
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium w-24 text-muted-foreground">{formatCohortLabel(c.label)}</span>
                    <span className="text-xs text-muted-foreground flex-1">
                      {formatCohortWindow(c.label, startMonth, endMonth)}
                    </span>
                    {count > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {count} linked record{count === 1 ? "" : "s"}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => restoreMutation.mutate(c.id)}
                      disabled={restoreMutation.isPending}
                    >
                      <ArchiveRestore className="h-3 w-3 mr-1" /> Restore
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Archive cohort {archiveTarget ? formatCohortLabel(archiveTarget.label) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  The cohort will be hidden from the header switcher and normal views, but
                  <strong> all linked data is preserved</strong> and can be restored anytime.
                </p>
                {archiveUsage && archiveTotal > 0 && (
                  <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                    <p className="font-medium text-foreground">{archiveTotal} linked record{archiveTotal === 1 ? "" : "s"}:</p>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                      {archiveUsage.founders > 0 && <li>{archiveUsage.founders} founder{archiveUsage.founders === 1 ? "" : "s"}</li>}
                      {archiveUsage.expenses > 0 && <li>{archiveUsage.expenses} expense{archiveUsage.expenses === 1 ? "" : "s"}</li>}
                      {archiveUsage.contracts > 0 && <li>{archiveUsage.contracts} contract{archiveUsage.contracts === 1 ? "" : "s"}</li>}
                      {archiveUsage.events > 0 && <li>{archiveUsage.events} event{archiveUsage.events === 1 ? "" : "s"}</li>}
                      {archiveUsage.stipends > 0 && <li>{archiveUsage.stipends} stipend{archiveUsage.stipends === 1 ? "" : "s"}</li>}
                      {archiveUsage.budgetLines > 0 && <li>{archiveUsage.budgetLines} budget line{archiveUsage.budgetLines === 1 ? "" : "s"}</li>}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (archiveTarget) archiveMutation.mutate(archiveTarget.id); }}
              disabled={archiveMutation.isPending}
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
