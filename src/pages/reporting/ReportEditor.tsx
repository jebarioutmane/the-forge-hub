import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Zap, Hand, RefreshCw, Download, FileDown, Loader2, Plus, Trash2, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeMetric, formatMetric, type MetricContext } from "@/lib/reportMetrics";

type Instance = {
  id: string;
  title: string;
  template_id: string | null;
  cohort_id: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
};

type Answer = {
  id: string;
  instance_id: string;
  question_text: string;
  category: string | null;
  answer_type: string | null;
  answer_text: string | null;
  answer_number: number | null;
  is_auto: boolean;
  sort_order: number;
};

const AUTO_METRICS: { value: string; label: string }[] = [
  { value: "active_founders", label: "Active founders" },
  { value: "at_risk_count", label: "At-risk founders" },
  { value: "watch_count", label: "Watch-list founders" },
  { value: "on_track_count", label: "On-track founders" },
  { value: "avg_attendance_rate", label: "Average attendance rate" },
  { value: "total_checkins", label: "Total check-ins" },
  { value: "founders_by_stage", label: "Founders by stage" },
  { value: "total_funding_raised", label: "Total funding raised" },
  { value: "evaluation_decisions_breakdown", label: "Evaluation decisions breakdown" },
  { value: "avg_evaluation_score", label: "Average evaluation score" },
  { value: "total_events", label: "Total events" },
  { value: "total_mentoring_sessions", label: "Total mentoring sessions" },
  { value: "stakeholders_count", label: "Stakeholders count" },
  { value: "countries_represented", label: "Countries represented" },
  { value: "budget_allocated", label: "Budget allocated" },
  { value: "budget_spent", label: "Budget spent" },
  { value: "budget_committed", label: "Budget committed" },
  { value: "budget_remaining", label: "Budget remaining" },
  { value: "stipends_paid", label: "Stipends paid" },
  { value: "active_contracts_count", label: "Active contracts (count)" },
  { value: "active_contracts_value", label: "Active contracts (value)" },
];

const DEFAULT_CATEGORIES = ["Program Health", "Founder Achievements", "Financial", "Network"];

/** Small debounce hook for auto-save. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ReportEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [addingQ, setAddingQ] = useState(false);
  const [newQ, setNewQ] = useState<{ question_text: string; category: string; answer_type: string; source_type: "manual" | "auto"; auto_metric: string | null }>({
    question_text: "", category: "Program Health", answer_type: "qualitative", source_type: "manual", auto_metric: null,
  });

  const { data: instance, isLoading: loadingInst } = useQuery({
    queryKey: ["report_instance", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_instances")
        .select("id,title,template_id,cohort_id,period_start,period_end,status")
        .eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Instance | null;
    },
    enabled: !!id,
  });

  const { data: cohort } = useQuery({
    queryKey: ["cohort", instance?.cohort_id],
    queryFn: async () => {
      if (!instance?.cohort_id) return null;
      const { data } = await supabase.from("cohorts").select("id,label").eq("id", instance.cohort_id).maybeSingle();
      return data;
    },
    enabled: !!instance?.cohort_id,
  });

  const { data: answers = [], isLoading: loadingAns } = useQuery({
    queryKey: ["report_answers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_answers")
        .select("*").eq("instance_id", id!)
        .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Answer[];
    },
    enabled: !!id,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Answer[]>();
    answers.forEach((a) => {
      const k = a.category ?? "Uncategorized";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    });
    return Array.from(map.entries());
  }, [answers]);

  const metricCtx: MetricContext | null = useMemo(() => {
    if (!instance?.period_start || !instance?.period_end) return null;
    return { cohortId: instance.cohort_id, periodStart: instance.period_start, periodEnd: instance.period_end };
  }, [instance]);

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("report_instances").update({ status }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_instance", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateAnswer = useMutation({
    mutationFn: async ({ answerId, patch }: { answerId: string; patch: Partial<Answer> }) => {
      const { error } = await supabase.from("report_answers").update(patch).eq("id", answerId);
      if (error) throw error;
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addQuestion = useMutation({
    mutationFn: async () => {
      const nextOrder = (answers[answers.length - 1]?.sort_order ?? -1) + 1;
      let payload: any = {
        instance_id: id,
        question_text: newQ.question_text.trim(),
        category: newQ.category,
        answer_type: newQ.answer_type,
        is_auto: newQ.source_type === "auto",
        sort_order: nextOrder,
      };
      if (newQ.source_type === "auto" && newQ.auto_metric && metricCtx) {
        const v = await computeMetric(newQ.auto_metric, metricCtx);
        payload.answer_number = v.number;
        payload.answer_text = v.text ?? (newQ.auto_metric); // store metric key hint in text if no formatted text
      }
      const { error } = await supabase.from("report_answers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question added");
      setAddingQ(false);
      setNewQ({ question_text: "", category: "Program Health", answer_type: "qualitative", source_type: "manual", auto_metric: null });
      qc.invalidateQueries({ queryKey: ["report_answers", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeAnswer = useMutation({
    mutationFn: async (aid: string) => {
      const { error } = await supabase.from("report_answers").delete().eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_answers", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const [refreshing, setRefreshing] = useState(false);
  async function refreshAll() {
    if (!metricCtx) return;
    setRefreshing(true);
    try {
      // Try to look up the metric key: we stored it in template question. For robustness,
      // if we can find matching template question by text+category, use its auto_metric.
      let templateQs: any[] = [];
      if (instance?.template_id) {
        const { data } = await supabase.from("report_questions").select("question_text,category,auto_metric,source_type")
          .eq("template_id", instance.template_id);
        templateQs = data ?? [];
      }
      const autoRows = answers.filter((a) => a.is_auto);
      await Promise.all(autoRows.map(async (a) => {
        const tq = templateQs.find((q) => q.question_text === a.question_text && (q.category ?? null) === (a.category ?? null) && q.source_type === "auto");
        // fallback: if answer_text encodes the metric key (from ad-hoc add), try to use that
        const metric = tq?.auto_metric || (AUTO_METRICS.some((m) => m.value === (a.answer_text ?? "")) ? a.answer_text! : null);
        if (!metric) return;
        const v = await computeMetric(metric, metricCtx);
        await supabase.from("report_answers").update({ answer_number: v.number, answer_text: v.text ?? metric }).eq("id", a.id);
      }));
      qc.invalidateQueries({ queryKey: ["report_answers", id] });
      toast.success("Auto values refreshed");
    } finally {
      setRefreshing(false);
    }
  }

  async function exportPDF() {
    if (!instance) return;
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default as any;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(instance.title, 40, 60);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    const meta = [
      cohort?.label ? `Cohort: ${cohort.label}` : "All cohorts",
      `Period: ${instance.period_start} to ${instance.period_end}`,
      `Status: ${instance.status}`,
    ].join("   ·   ");
    doc.text(meta, 40, 80);
    doc.setDrawColor(220); doc.line(40, 92, pageW - 40, 92);

    let y = 112;
    for (const [cat, items] of grouped) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0);
      doc.text(cat, 40, y); y += 8;
      const rows = items.map((a) => [
        a.question_text,
        renderAnswerText(a),
      ]);
      autoTable(doc, {
        startY: y,
        head: [["Question", "Answer"]],
        body: rows,
        styles: { fontSize: 10, cellPadding: 8, valign: "top" },
        headStyles: { fillColor: [245, 245, 247], textColor: 60 },
        columnStyles: { 0: { cellWidth: 260 } },
        margin: { left: 40, right: 40 },
      });
      y = (doc as any).lastAutoTable.finalY + 24;
      if (y > 760) { doc.addPage(); y = 60; }
    }

    doc.save(`${instance.title.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
  }

  async function exportExcel() {
    if (!instance) return;
    const XLSX = await import("xlsx");
    const rows = answers.map((a) => ({
      Category: a.category ?? "",
      Question: a.question_text,
      Type: a.answer_type ?? "",
      Source: a.is_auto ? "Auto" : "Manual",
      Answer: renderAnswerText(a),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${instance.title.replace(/[^a-z0-9]+/gi, "_")}.xlsx`);
  }

  function renderAnswerText(a: Answer): string {
    if (a.is_auto) {
      // if we stored a metric key in answer_text without formatted string, treat it as key
      const isKey = AUTO_METRICS.some((m) => m.value === (a.answer_text ?? ""));
      const metric = isKey ? a.answer_text! : "";
      return formatMetric(metric, { number: a.answer_number, text: isKey ? null : a.answer_text });
    }
    const parts: string[] = [];
    if (a.answer_number !== null && a.answer_number !== undefined) parts.push(String(a.answer_number));
    if (a.answer_text) parts.push(a.answer_text);
    return parts.join(" — ") || "—";
  }

  if (loadingInst || loadingAns) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!instance) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-sm text-muted-foreground">Report not found.</p>
        <Button asChild variant="link"><Link to="/reporting/reports">Back to reports</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/reporting/reports")} className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> All reports
        </Button>

        <div className="border rounded-2xl p-6 bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Report</p>
                <h1 className="text-xl font-semibold tracking-tight truncate">{instance.title}</h1>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                  <span>{cohort?.label ?? "All cohorts"}</span><span>·</span>
                  <span>{instance.period_start} → {instance.period_end}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={instance.status} onValueChange={(v) => setStatus.mutate(v)}>
                <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Refresh auto
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> Excel
              </Button>
              <Button size="sm" onClick={exportPDF}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {answers.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-16 text-center">
          <p className="text-sm font-medium">No questions in this report yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Add your first question below.</p>
          <Button size="sm" onClick={() => setAddingQ(true)}><Plus className="h-4 w-4 mr-1" /> Add question</Button>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([cat, items]) => (
            <section key={cat}>
              <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">{cat}</h2>
              <div className="space-y-3">
                {items.map((a) => (
                  <AnswerRow
                    key={a.id}
                    answer={a}
                    onSave={(patch) => updateAnswer.mutate({ answerId: a.id, patch })}
                    onDelete={() => removeAnswer.mutate(a.id)}
                    renderAuto={() => renderAnswerText(a)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => setAddingQ(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add question
        </Button>
      </div>

      <Dialog open={addingQ} onOpenChange={setAddingQ}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add question</DialogTitle>
            <DialogDescription>Add a new question to this specific report.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Question…" value={newQ.question_text} onChange={(e) => setNewQ({ ...newQ, question_text: e.target.value })} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newQ.category} onValueChange={(v) => setNewQ({ ...newQ, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newQ.answer_type} onValueChange={(v) => setNewQ({ ...newQ, answer_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualitative">Qualitative</SelectItem>
                  <SelectItem value="quantitative">Quantitative</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setNewQ({ ...newQ, source_type: "manual", auto_metric: null })}
                className={cn("border rounded-lg p-3 text-left", newQ.source_type === "manual" ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                <div className="flex items-center gap-2 text-sm font-medium"><Hand className="h-3.5 w-3.5" /> Manual</div>
              </button>
              <button type="button" onClick={() => setNewQ({ ...newQ, source_type: "auto" })}
                className={cn("border rounded-lg p-3 text-left", newQ.source_type === "auto" ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                <div className="flex items-center gap-2 text-sm font-medium"><Zap className="h-3.5 w-3.5" /> Auto</div>
              </button>
            </div>
            {newQ.source_type === "auto" && (
              <Select value={newQ.auto_metric ?? ""} onValueChange={(v) => setNewQ({ ...newQ, auto_metric: v })}>
                <SelectTrigger><SelectValue placeholder="Select metric" /></SelectTrigger>
                <SelectContent>
                  {AUTO_METRICS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddingQ(false)}>Cancel</Button>
            <Button onClick={() => addQuestion.mutate()} disabled={!newQ.question_text.trim() || (newQ.source_type === "auto" && !newQ.auto_metric) || addQuestion.isPending}>
              {addQuestion.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnswerRow({
  answer, onSave, onDelete, renderAuto,
}: {
  answer: Answer;
  onSave: (patch: Partial<Answer>) => void;
  onDelete: () => void;
  renderAuto: () => string;
}) {
  const [text, setText] = useState(answer.answer_text ?? "");
  const [num, setNum] = useState<string>(answer.answer_number?.toString() ?? "");

  // reset local state if server changed (e.g. refresh)
  useEffect(() => { setText(answer.answer_text ?? ""); }, [answer.answer_text]);
  useEffect(() => { setNum(answer.answer_number?.toString() ?? ""); }, [answer.answer_number]);

  const debouncedText = useDebounced(text, 600);
  const debouncedNum = useDebounced(num, 600);

  useEffect(() => {
    if (answer.is_auto) return;
    if ((debouncedText ?? "") === (answer.answer_text ?? "")) return;
    onSave({ answer_text: debouncedText || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText]);
  useEffect(() => {
    if (answer.is_auto) return;
    const parsed = debouncedNum === "" ? null : Number(debouncedNum);
    if (parsed === answer.answer_number) return;
    if (parsed !== null && Number.isNaN(parsed)) return;
    onSave({ answer_number: parsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNum]);

  const type = answer.answer_type ?? "qualitative";

  return (
    <div className="group border rounded-xl p-4 bg-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug flex-1">{answer.question_text}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {answer.is_auto ? (
            <Badge variant="outline" className="text-[10px] font-normal border-primary/40 text-primary gap-1">
              <Zap className="h-2.5 w-2.5" /> Auto
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground gap-1">
              <Hand className="h-2.5 w-2.5" /> Manual
            </Badge>
          )}
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {answer.is_auto ? (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
          {renderAuto()}
        </div>
      ) : (
        <div className="space-y-2">
          {(type === "quantitative" || type === "both") && (
            <Input
              type="number"
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder="Numeric value"
              id={`num-${answer.id}`}
              name={`num-${answer.id}`}
            />
          )}
          {(type === "qualitative" || type === "both") && (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your answer…"
              rows={3}
              id={`txt-${answer.id}`}
              name={`txt-${answer.id}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
