import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Archive, ArchiveRestore, AlertTriangle, ChevronDown, ChevronRight,
  CalendarRange, Play, Lock, RotateCcw, Rocket, Settings2, Sparkles, X,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCohortLabel, formatCohortWindow, parseCohort } from "@/lib/cohortYears";

export default function Settings() {
  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">System preferences and cohort lifecycle</p>
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

type CohortStatus = "upcoming" | "active" | "closed";

interface Usage {
  founders: number;
  events: number;
  expenses: number;
  contracts: number;
  budgetLines: number;
  reports: number;
}

const EMPTY_USAGE: Usage = { founders: 0, events: 0, expenses: 0, contracts: 0, budgetLines: 0, reports: 0 };

const USAGE_LABELS: { key: keyof Usage; singular: string; plural: string }[] = [
  { key: "founders", singular: "founder", plural: "founders" },
  { key: "events", singular: "event", plural: "events" },
  { key: "expenses", singular: "expense", plural: "expenses" },
  { key: "contracts", singular: "contract", plural: "contracts" },
  { key: "budgetLines", singular: "budget line", plural: "budget lines" },
  { key: "reports", singular: "report", plural: "reports" },
];

function describeUsage(u: Usage): string[] {
  return USAGE_LABELS
    .filter((l) => u[l.key] > 0)
    .map((l) => `${u[l.key]} ${u[l.key] === 1 ? l.singular : l.plural}`);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Validate a cohort draft. Returns { error } (blocking) and { warning } (soft). */
function validateDraft(draft: { label: string; start_date: string; end_date: string }) {
  const label = draft.label.trim();
  const p = parseCohort(label);
  if (!p) return { error: "Use the format YYYY-YYYY (e.g. 2026-2027)." };
  if (p.endYear !== p.startYear + 1) return { error: "The label must span consecutive years (e.g. 2026-2027)." };
  if (draft.start_date && draft.end_date && draft.end_date <= draft.start_date) {
    return { error: "The end date must be after the start date." };
  }
  let warning: string | undefined;
  const sy = draft.start_date ? Number(draft.start_date.slice(0, 4)) : null;
  const ey = draft.end_date ? Number(draft.end_date.slice(0, 4)) : null;
  if ((sy !== null && sy !== p.startYear) || (ey !== null && ey !== p.endYear)) {
    warning = `Dates don't match the label years (${p.startYear}–${p.endYear}). Save anyway if this is intentional.`;
  }
  return { warning };
}

function CohortSettingsCard() {
  const queryClient = useQueryClient();
  const { canEdit, isSuperAdmin } = usePermissions();
  const mayManage = isSuperAdmin || canEdit("settings");

  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCohort, setNewCohort] = useState({ label: "", start_date: "", end_date: "" });
  const [lifecycle, setLifecycle] = useState<{ action: "start" | "close" | "reopen"; cohort: any } | null>(null);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [rollover, setRollover] = useState({ label: "", start_date: "", end_date: "" });

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
        .select("id,label,year,start_date,end_date,is_archived,is_active,status" as any)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Linked-record counts, all resolved through the real cohort_id uuid column
  // (events included — the old cohort_year text field is no longer used here).
  const { data: usageById = {} } = useQuery({
    queryKey: ["cohort-usage-all"],
    queryFn: async () => {
      const [founders, events, expenses, contracts, budgetLines, reports] = await Promise.all([
        supabase.from("founders").select("cohort_id"),
        supabase.from("events").select("cohort_id"),
        supabase.from("expenses").select("cohort_id"),
        supabase.from("contracts").select("cohort_id"),
        supabase.from("budget_lines").select("cohort_id"),
        supabase.from("report_instances").select("cohort_id"),
      ]);
      const out: Record<string, Usage> = {};
      const ensure = (id: string) => (out[id] = out[id] || { ...EMPTY_USAGE });
      const tally = (res: any, key: keyof Usage) => {
        (res?.data ?? []).forEach((r: any) => {
          if (r.cohort_id) ensure(r.cohort_id)[key]++;
        });
      };
      tally(founders, "founders");
      tally(events, "events");
      tally(expenses, "expenses");
      tally(contracts, "contracts");
      tally(budgetLines, "budgetLines");
      tally(reports, "reports");
      return out;
    },
  });

  const usageOf = (id: string): Usage => (usageById as Record<string, Usage>)[id] ?? EMPTY_USAGE;
  const totalUsage = (id: string) => {
    const u = usageOf(id);
    return u.founders + u.events + u.expenses + u.contracts + u.budgetLines + u.reports;
  };

  const statusOf = (c: any): CohortStatus => {
    const s = (c?.status ?? "").toLowerCase();
    if (s === "active" || s === "upcoming" || s === "closed") return s as CohortStatus;
    return c?.is_active ? "active" : "upcoming";
  };

  const liveCohorts = cohorts.filter((c: any) => !c.is_archived);
  const archivedCohorts = cohorts.filter((c: any) => c.is_archived);
  const activeCohort = liveCohorts.find((c: any) => statusOf(c) === "active") ?? null;

  function invalidateCohortLists() {
    queryClient.invalidateQueries({ queryKey: ["cohorts-all"] });
    queryClient.invalidateQueries({ queryKey: ["cohorts", "global"] });
    queryClient.invalidateQueries({ queryKey: ["cohort-usage-all"] });
  }

  /** Close every currently-active cohort except `keepId`. */
  async function closeOtherActives(keepId?: string) {
    const others = cohorts.filter((c: any) => c.id !== keepId && (c.is_active || statusOf(c) === "active"));
    for (const c of others) {
      const { error } = await supabase
        .from("cohorts")
        .update({ status: "closed", is_active: false } as any)
        .eq("id", c.id);
      if (error) throw error;
    }
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
      toast.success("Cohort defaults updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCohortMutation = useMutation({
    mutationFn: async () => {
      const { error: invalid } = validateDraft(newCohort) as any;
      if (invalid) throw new Error(invalid);
      const p = parseCohort(newCohort.label.trim())!;
      const { error } = await supabase.from("cohorts").insert({
        name: newCohort.label.trim(),
        label: newCohort.label.trim(),
        year: p.startYear,
        status: "upcoming",
        is_active: false,
        start_date: newCohort.start_date || null,
        end_date: newCohort.end_date || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCohortLists();
      setNewCohort({ label: "", start_date: "", end_date: "" });
      setShowCreate(false);
      toast.success("Cohort created as Upcoming");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const lifecycleMutation = useMutation({
    mutationFn: async ({ action, cohort }: { action: "start" | "close" | "reopen"; cohort: any }) => {
      if (action === "close") {
        const { error } = await supabase
          .from("cohorts")
          .update({ status: "closed", is_active: false } as any)
          .eq("id", cohort.id);
        if (error) throw error;
        return;
      }
      // start / reopen: exactly one active cohort at a time
      await closeOtherActives(cohort.id);
      const { error } = await supabase
        .from("cohorts")
        .update({ status: "active", is_active: true, is_archived: false, archived_at: null } as any)
        .eq("id", cohort.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      invalidateCohortLists();
      setLifecycle(null);
      toast.success(
        vars.action === "close"
          ? `${formatCohortLabel(vars.cohort.label)} closed — data kept as history`
          : `${formatCohortLabel(vars.cohort.label)} is now the active cohort`
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rolloverMutation = useMutation({
    mutationFn: async () => {
      const { error: invalid } = validateDraft(rollover) as any;
      if (invalid) throw new Error(invalid);
      const label = rollover.label.trim();
      const p = parseCohort(label)!;
      if (cohorts.some((c: any) => c.label === label)) {
        throw new Error(`Cohort ${formatCohortLabel(label)} already exists.`);
      }
      const { data: created, error } = await supabase
        .from("cohorts")
        .insert({
          name: label,
          label,
          year: p.startYear,
          status: "upcoming",
          is_active: false,
          start_date: rollover.start_date || null,
          end_date: rollover.end_date || null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      await closeOtherActives((created as any).id);
      const { error: activateErr } = await supabase
        .from("cohorts")
        .update({ status: "active", is_active: true } as any)
        .eq("id", (created as any).id);
      if (activateErr) throw activateErr;
    },
    onSuccess: () => {
      invalidateCohortLists();
      setRolloverOpen(false);
      toast.success("New cohort started — clean slate, previous cohort closed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const target = cohorts.find((c: any) => c.id === id);
      if (target && statusOf(target) === "active") {
        throw new Error("Close the cohort before archiving it.");
      }
      const { error } = await supabase
        .from("cohorts")
        .update({ is_archived: true, archived_at: new Date().toISOString(), is_active: false } as any)
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
        .update({ is_archived: false, archived_at: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCohortLists();
      toast.success("Cohort restored");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openRollover() {
    const base = activeCohort ? parseCohort(activeCohort.label)?.startYear ?? new Date().getFullYear() : new Date().getFullYear();
    const nextStart = base + 1;
    const label = `${nextStart}-${nextStart + 1}`;
    setRollover({
      label,
      start_date: `${nextStart}-${pad(startMonth)}-01`,
      end_date: `${nextStart + 1}-${pad(endMonth)}-01`,
    });
    setRolloverOpen(true);
  }

  const archiveUsage = archiveTarget ? usageOf(archiveTarget.id) : EMPTY_USAGE;
  const archiveTotal = archiveTarget ? totalUsage(archiveTarget.id) : 0;
  const newDraftCheck = newCohort.label.trim() ? validateDraft(newCohort) : {};
  const rolloverCheck = rollover.label.trim() ? validateDraft(rollover) : {};

  const statusBadge = (s: CohortStatus) => {
    if (s === "active") return <Badge className="bg-primary text-primary-foreground text-[10px]">Active</Badge>;
    if (s === "upcoming") return <Badge variant="secondary" className="text-[10px]">Upcoming</Badge>;
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">Closed</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Cohort Settings</CardTitle>
        <CardDescription>
          Manage the program year lifecycle — start, close, and archive cohorts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active cohort banner */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <CalendarRange className="h-3.5 w-3.5" /> Active cohort
              </p>
              {activeCohort ? (
                <>
                  <p className="font-serif text-2xl font-bold leading-tight">{formatCohortLabel(activeCohort.label)}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeCohort.start_date && activeCohort.end_date
                      ? `${activeCohort.start_date} → ${activeCohort.end_date}`
                      : formatCohortWindow(activeCohort.label, startMonth, endMonth)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-serif text-xl font-bold leading-tight">No active cohort</p>
                  <p className="text-xs text-muted-foreground">Start a cohort below to activate the program year.</p>
                </>
              )}
            </div>
            {mayManage && (
              <Button size="sm" onClick={openRollover}>
                <Rocket className="mr-1.5 h-3.5 w-3.5" /> Start next cohort
              </Button>
            )}
          </div>
        </div>

        {/* Cohort list */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Cohorts</Label>
          <div className="rounded-lg border divide-y overflow-hidden">
            {liveCohorts.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No cohorts yet. Create one to get started.
              </p>
            )}
            {liveCohorts.map((c: any) => {
              const s = statusOf(c);
              const total = totalUsage(c.id);
              const u = usageOf(c.id);
              const open = expandedId === c.id;
              return (
                <div key={c.id} className={s === "active" ? "bg-primary/[0.03]" : undefined}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : c.id)}
                      className="flex flex-1 items-center gap-2 text-left transition-colors hover:text-primary"
                    >
                      {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      <span className="font-medium w-24">{formatCohortLabel(c.label)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCohortWindow(c.label, startMonth, endMonth)}
                      </span>
                    </button>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {total === 0 ? "No records yet" : `${total} linked record${total === 1 ? "" : "s"}`}
                    </span>
                    {statusBadge(s)}
                    {mayManage && (
                      <div className="flex items-center gap-1">
                        {s === "upcoming" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLifecycle({ action: "start", cohort: c })}>
                            <Play className="mr-1 h-3 w-3" /> Start
                          </Button>
                        )}
                        {s === "active" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLifecycle({ action: "close", cohort: c })}>
                            <Lock className="mr-1 h-3 w-3" /> Close
                          </Button>
                        )}
                        {s === "closed" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLifecycle({ action: "reopen", cohort: c })}>
                            <RotateCcw className="mr-1 h-3 w-3" /> Reopen
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={s === "active"}
                          title={s === "active" ? "Close the cohort before archiving" : "Archive cohort"}
                          onClick={() => setArchiveTarget(c)}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {open && (
                    <div className="border-t bg-muted/20 px-4 py-3 pl-11">
                      {total === 0 ? (
                        <p className="text-xs text-muted-foreground">No records linked to this cohort yet.</p>
                      ) : (
                        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                          {USAGE_LABELS.map((l) => (
                            <li key={l.key} className={u[l.key] === 0 ? "opacity-50" : undefined}>
                              <span className="font-medium text-foreground tabular-nums">{u[l.key]}</span>{" "}
                              {u[l.key] === 1 ? l.singular : l.plural}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Create new cohort (collapsed) */}
        {mayManage && (
          <div>
            {!showCreate ? (
              <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Create new cohort
              </Button>
            ) : (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">New cohort</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCreate(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-cohort-label" className="text-xs">Label</Label>
                    <Input
                      id="new-cohort-label"
                      name="new-cohort-label"
                      value={newCohort.label}
                      onChange={(e) => setNewCohort({ ...newCohort, label: e.target.value })}
                      placeholder="2026-2027"
                      className="w-32"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-cohort-start" className="text-xs">Start date</Label>
                    <Input id="new-cohort-start" name="new-cohort-start" type="date" value={newCohort.start_date}
                      onChange={(e) => setNewCohort({ ...newCohort, start_date: e.target.value })} className="w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-cohort-end" className="text-xs">End date</Label>
                    <Input id="new-cohort-end" name="new-cohort-end" type="date" value={newCohort.end_date}
                      onChange={(e) => setNewCohort({ ...newCohort, end_date: e.target.value })} className="w-40" />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addCohortMutation.mutate()}
                    disabled={!newCohort.label.trim() || !!(newDraftCheck as any).error || addCohortMutation.isPending}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                </div>
                {(newDraftCheck as any).error && (
                  <p className="text-xs text-destructive">{(newDraftCheck as any).error}</p>
                )}
                {(newDraftCheck as any).warning && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> {(newDraftCheck as any).warning}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">New cohorts start as Upcoming — start them when the year begins.</p>
              </div>
            )}
          </div>
        )}

        {/* Cohort defaults (tucked away) */}
        <div className="pt-2 border-t">
          <button
            type="button"
            onClick={() => setShowDefaults((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {showDefaults ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Settings2 className="h-3.5 w-3.5" /> Cohort defaults
          </button>
          {showDefaults && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Default start month</Label>
                <Select value={String(startMonth)} onValueChange={(v) => setMonthMutation.mutate({ key: "cohort_start_month", value: Number(v) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default end month</Label>
                <Select value={String(endMonth)} onValueChange={(v) => setMonthMutation.mutate({ key: "cohort_end_month", value: Number(v) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Archived cohorts */}
        <div className="pt-2 border-t">
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
                const total = totalUsage(c.id);
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-24 font-medium text-muted-foreground">{formatCohortLabel(c.label)}</span>
                    <span className="flex-1 text-xs text-muted-foreground">
                      {formatCohortWindow(c.label, startMonth, endMonth)}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {total === 0 ? "No records" : `${total} linked record${total === 1 ? "" : "s"}`}
                    </span>
                    {mayManage && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => restoreMutation.mutate(c.id)} disabled={restoreMutation.isPending}>
                        <ArchiveRestore className="mr-1 h-3 w-3" /> Restore
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      {/* Lifecycle confirmation */}
      <AlertDialog open={!!lifecycle} onOpenChange={(o) => !o && setLifecycle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              {lifecycle?.action === "close"
                ? `Close ${lifecycle ? formatCohortLabel(lifecycle.cohort.label) : ""}?`
                : `Make ${lifecycle ? formatCohortLabel(lifecycle.cohort.label) : ""} the active cohort?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {lifecycle?.action === "close" ? (
                  <p>
                    The cohort will be marked <strong>Closed</strong>. Nothing is deleted — all founders,
                    events and financial records stay as history.
                  </p>
                ) : (
                  <>
                    <p>
                      Only one cohort can be active at a time. This cohort becomes <strong>Active</strong>
                      {activeCohort && activeCohort.id !== lifecycle?.cohort.id ? (
                        <> and <strong>{formatCohortLabel(activeCohort.label)}</strong> will be closed.</>
                      ) : (
                        <>.</>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The header cohort switcher will default to the new active cohort.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={lifecycleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (lifecycle) lifecycleMutation.mutate(lifecycle); }}
              disabled={lifecycleMutation.isPending}
            >
              {lifecycle?.action === "close" ? "Close cohort" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Guided rollover */}
      <Dialog open={rolloverOpen} onOpenChange={setRolloverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Start next cohort
            </DialogTitle>
            <DialogDescription>
              Creates the next program year, makes it active, and closes the current active cohort.
              Nothing is copied over — the new cohort starts clean.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="rollover-label" className="text-xs">Label</Label>
                <Input id="rollover-label" name="rollover-label" value={rollover.label}
                  onChange={(e) => setRollover({ ...rollover, label: e.target.value })} placeholder="2026-2027" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rollover-start" className="text-xs">Start date</Label>
                <Input id="rollover-start" name="rollover-start" type="date" value={rollover.start_date}
                  onChange={(e) => setRollover({ ...rollover, start_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rollover-end" className="text-xs">End date</Label>
                <Input id="rollover-end" name="rollover-end" type="date" value={rollover.end_date}
                  onChange={(e) => setRollover({ ...rollover, end_date: e.target.value })} />
              </div>
            </div>
            {(rolloverCheck as any).error && (
              <p className="text-xs text-destructive">{(rolloverCheck as any).error}</p>
            )}
            {(rolloverCheck as any).warning && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" /> {(rolloverCheck as any).warning}
              </p>
            )}
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">What happens</p>
              <p>1. Cohort {rollover.label ? formatCohortLabel(rollover.label) : "—"} is created.</p>
              <p>2. It becomes the active cohort.</p>
              <p>
                3. {activeCohort ? `${formatCohortLabel(activeCohort.label)} is closed (history preserved).` : "No cohort to close."}
              </p>
              <p>4. No founders, events, or budget data are copied.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolloverOpen(false)} disabled={rolloverMutation.isPending}>Cancel</Button>
            <Button
              onClick={() => rolloverMutation.mutate()}
              disabled={!rollover.label.trim() || !!(rolloverCheck as any).error || rolloverMutation.isPending}
            >
              <Rocket className="mr-1.5 h-3.5 w-3.5" /> Start cohort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-serif">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Archive cohort {archiveTarget ? formatCohortLabel(archiveTarget.label) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  The cohort will be hidden from the header switcher and normal views, but
                  <strong> all linked data is preserved</strong> and can be restored anytime.
                </p>
                {archiveTotal > 0 ? (
                  <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                    <p className="font-medium text-foreground">
                      {archiveTotal} linked record{archiveTotal === 1 ? "" : "s"}:
                    </p>
                    <p className="text-muted-foreground">{describeUsage(archiveUsage).join(", ")}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No records are linked to this cohort.</p>
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
              <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
