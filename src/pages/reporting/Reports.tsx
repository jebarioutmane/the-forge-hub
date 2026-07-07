import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import {
  FileSpreadsheet, Plus, Eye, Pencil, Archive, ArchiveRestore, Loader2, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { computeMetric, type MetricContext } from "@/lib/reportMetrics";

type Instance = {
  id: string;
  title: string;
  template_id: string | null;
  cohort_id: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  is_archived: boolean;
  created_at: string;
};

type TemplateRow = { id: string; name: string };

function todayISO() { return new Date().toISOString().slice(0, 10); }

function preset(kind: "month" | "quarter" | "year"): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (kind === "month") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (kind === "quarter") {
    const qStart = Math.floor(m / 3) * 3;
    const start = new Date(y, qStart, 1);
    const end = new Date(y, qStart + 3, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export default function Reports() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { selectedCohortId, cohorts } = useCohort();

  const [showArchived, setShowArchived] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [archiving, setArchiving] = useState<Instance | null>(null);

  const defaultCohort = selectedCohortId && selectedCohortId !== ALL_COHORTS ? selectedCohortId : "";
  const q = preset("quarter");
  const [form, setForm] = useState({
    title: "",
    template_id: "__blank__",
    cohort_id: defaultCohort || "__none__",
    period_start: q.start,
    period_end: q.end,
  });

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["report_instances", showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_instances")
        .select("id,title,template_id,cohort_id,period_start,period_end,status,is_archived,created_at")
        .eq("is_archived", showArchived)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Instance[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["report_templates_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_templates").select("id,name").eq("is_archived", false).order("name");
      if (error) throw error;
      return data as TemplateRow[];
    },
  });

  const templateName = useMemo(() => {
    const m: Record<string, string> = {};
    templates.forEach((t) => (m[t.id] = t.name));
    return m;
  }, [templates]);

  const cohortLabel = useMemo(() => {
    const m: Record<string, string> = {};
    cohorts.forEach((c) => (m[c.id] = c.label));
    return m;
  }, [cohorts]);

  const createReport = useMutation({
    mutationFn: async () => {
      const cohortId = form.cohort_id === "__none__" ? null : form.cohort_id;
      const templateId = form.template_id === "__blank__" ? null : form.template_id;

      // 1. Create the instance
      const { data: inst, error: e1 } = await supabase
        .from("report_instances")
        .insert({
          title: form.title.trim(),
          template_id: templateId,
          cohort_id: cohortId,
          period_start: form.period_start,
          period_end: form.period_end,
          status: "draft",
        })
        .select("id")
        .single();
      if (e1) throw e1;
      const instanceId = inst.id as string;

      // 2. If template chosen, snapshot its questions into report_answers
      if (templateId) {
        const { data: qs, error: e2 } = await supabase
          .from("report_questions")
          .select("id,question_text,category,answer_type,source_type,auto_metric,sort_order")
          .eq("template_id", templateId)
          .order("sort_order", { ascending: true });
        if (e2) throw e2;

        const ctx: MetricContext = {
          cohortId,
          periodStart: form.period_start,
          periodEnd: form.period_end,
        };

        // Compute auto values in parallel
        const rows = await Promise.all((qs ?? []).map(async (q: any, idx: number) => {
          let is_auto = false;
          let answer_number: number | null = null;
          let answer_text: string | null = null;
          if (q.source_type === "auto" && q.auto_metric) {
            is_auto = true;
            const v = await computeMetric(q.auto_metric, ctx);
            answer_number = v.number;
            answer_text = v.text;
          }
          return {
            instance_id: instanceId,
            question_text: q.question_text,
            category: q.category,
            answer_type: q.answer_type,
            is_auto,
            answer_number,
            answer_text,
            sort_order: q.sort_order ?? idx,
          };
        }));

        if (rows.length > 0) {
          const { error: e3 } = await supabase.from("report_answers").insert(rows);
          if (e3) throw e3;
        }
      }

      return instanceId;
    },
    onSuccess: (id) => {
      toast.success("Report created");
      setLaunching(false);
      qc.invalidateQueries({ queryKey: ["report_instances"] });
      navigate(`/reporting/reports/${id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("report_instances")
        .update({ is_archived: archived, archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report_instances"] });
      setArchiving(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function applyPreset(kind: "month" | "quarter" | "year") {
    const p = preset(kind);
    setForm((f) => ({ ...f, period_start: p.start, period_end: p.end }));
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground">Launch, fill, review, and export reports from your templates.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            Archived
          </label>
          <Button onClick={() => setLaunching(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Report
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : instances.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-20 text-center">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium">{showArchived ? "No archived reports" : "No reports yet"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {showArchived ? "Archived reports will appear here." : "Launch your first report from a template — or start blank."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {instances.map((r) => (
            <div key={r.id} className="group border rounded-xl p-5 bg-card hover:shadow-sm transition-all flex items-start justify-between gap-4">
              <Link to={`/reporting/reports/${r.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{r.title}</h3>
                  <Badge
                    variant={r.status === "final" ? "default" : "secondary"}
                    className="text-[10px] font-normal capitalize"
                  >{r.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span>{r.template_id ? (templateName[r.template_id] ?? "Template") : "Ad-hoc"}</span>
                  <span>·</span>
                  <span>{r.cohort_id ? (cohortLabel[r.cohort_id] ?? "Cohort") : "All cohorts"}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {r.period_start} → {r.period_end}
                  </span>
                </div>
              </Link>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/reporting/reports/${r.id}`)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> View
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/reporting/reports/${r.id}`)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                {showArchived ? (
                  <Button size="sm" variant="ghost" onClick={() => archiveMut.mutate({ id: r.id, archived: false })}>
                    <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setArchiving(r)}>
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={launching} onOpenChange={setLaunching}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New report</DialogTitle>
            <DialogDescription>Pick a template (or start blank), set the scope, and we'll compute the auto values.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="rp-title" className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                id="rp-title" name="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Q3 2026 Board Report"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__blank__">Blank / ad-hoc</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cohort</label>
              <Select value={form.cohort_id} onValueChange={(v) => setForm({ ...form, cohort_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All cohorts</SelectItem>
                  {cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Period</label>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset("month")}>This month</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset("quarter")}>Quarter</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset("year")}>Year</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
                <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLaunching(false)}>Cancel</Button>
            <Button
              onClick={() => createReport.mutate()}
              disabled={!form.title.trim() || !form.period_start || !form.period_end || createReport.isPending}
            >
              {createReport.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!archiving}
        onCancel={() => setArchiving(null)}
        onConfirm={() => archiving && archiveMut.mutate({ id: archiving.id, archived: true })}
        title="Archive report?"
        description="You can restore it later from the Archived toggle."
      />
    </div>
  );
}
