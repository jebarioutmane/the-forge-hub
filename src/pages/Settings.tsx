import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
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
  const [deleteCohortId, setDeleteCohortId] = useState<string | null>(null);
  const [newCohort, setNewCohort] = useState({ label: "", start_date: "", end_date: "" });

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
        .select("id,label,year,start_date,end_date,is_archived" as any)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const active = computeActiveCohort(startMonth);

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
      queryClient.invalidateQueries({ queryKey: ["cohorts-all"] });
      setNewCohort({ label: "", start_date: "", end_date: "" });
      toast.success("Cohort added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCohortMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cohorts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      const deleted = cohorts.find((c: any) => c.id === id);
      queryClient.invalidateQueries({ queryKey: ["cohorts-all"] });
      setDeleteCohortId(null);
      toast.success("Cohort deleted");
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
            {cohorts.map((c: any) => {
              const s = statusOf(c.label);
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="font-medium w-24">{formatCohortLabel(c.label)}</span>
                  <span className="text-xs text-muted-foreground flex-1">
                    {formatCohortWindow(c.label, startMonth, endMonth)}
                  </span>
                  <Badge className={statusColor[s] + " text-[10px]"}>{s}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteCohortId(c.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            {cohorts.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">No cohorts yet.</p>}
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
      </CardContent>

      <ConfirmDeleteDialog open={!!deleteCohortId} onConfirm={() => deleteCohortId && deleteCohortMutation.mutate(deleteCohortId)} onCancel={() => setDeleteCohortId(null)} />
    </Card>
  );
}
