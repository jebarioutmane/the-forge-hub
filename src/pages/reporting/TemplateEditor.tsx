import { useState, useEffect, useMemo } from "react";
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
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import {
  ArrowLeft, Plus, Pencil, Trash2, GripVertical, ArrowUp, ArrowDown,
  Zap, Hand, Loader2, Save, FileBarChart,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_CATEGORIES = ["Program Health", "Founder Achievements", "Financial", "Network"];

const AUTO_METRICS: { value: string; label: string; group: string }[] = [
  { value: "active_founders", label: "Active founders", group: "Founders" },
  { value: "at_risk_count", label: "At-risk founders", group: "Founders" },
  { value: "watch_count", label: "Watch-list founders", group: "Founders" },
  { value: "on_track_count", label: "On-track founders", group: "Founders" },
  { value: "avg_attendance_rate", label: "Average attendance rate", group: "Founders" },
  { value: "total_checkins", label: "Total check-ins", group: "Founders" },
  { value: "founders_by_stage", label: "Founders by stage", group: "Founders" },
  { value: "total_funding_raised", label: "Total funding raised", group: "Founders" },
  { value: "evaluation_decisions_breakdown", label: "Evaluation decisions breakdown", group: "Evaluations" },
  { value: "avg_evaluation_score", label: "Average evaluation score", group: "Evaluations" },
  { value: "total_events", label: "Total events", group: "Events" },
  { value: "total_mentoring_sessions", label: "Total mentoring sessions", group: "Events" },
  { value: "stakeholders_count", label: "Stakeholders count", group: "Network" },
  { value: "countries_represented", label: "Countries represented", group: "Network" },
  { value: "budget_allocated", label: "Budget allocated", group: "Finance" },
  { value: "budget_spent", label: "Budget spent", group: "Finance" },
  { value: "budget_committed", label: "Budget committed", group: "Finance" },
  { value: "budget_remaining", label: "Budget remaining", group: "Finance" },
  { value: "stipends_paid", label: "Stipends paid", group: "Finance" },
  { value: "active_contracts_count", label: "Active contracts (count)", group: "Finance" },
  { value: "active_contracts_value", label: "Active contracts (value)", group: "Finance" },
];

type Question = {
  id: string;
  template_id: string;
  question_text: string;
  category: string | null;
  answer_type: "qualitative" | "quantitative" | "both";
  source_type: "manual" | "auto";
  auto_metric: string | null;
  sort_order: number;
};

type QuestionDraft = {
  question_text: string;
  category: string;
  answer_type: Question["answer_type"];
  source_type: Question["source_type"];
  auto_metric: string | null;
};

const EMPTY_DRAFT: QuestionDraft = {
  question_text: "",
  category: "Program Health",
  answer_type: "qualitative",
  source_type: "manual",
  auto_metric: null,
};

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [meta, setMeta] = useState({ name: "", description: "" });
  const [metaDirty, setMetaDirty] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [creatingQuestion, setCreatingQuestion] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<Question | null>(null);

  const { data: template, isLoading: loadingTpl } = useQuery({
    queryKey: ["report_template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("id,name,description,is_archived")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (template) {
      setMeta({ name: template.name ?? "", description: template.description ?? "" });
      setMetaDirty(false);
    }
  }, [template]);

  const { data: questions = [], isLoading: loadingQ } = useQuery({
    queryKey: ["report_questions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_questions")
        .select("*")
        .eq("template_id", id!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Question[];
    },
    enabled: !!id,
  });

  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    questions.forEach((q) => q.category && set.add(q.category));
    return Array.from(set);
  }, [questions]);

  const saveMeta = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("report_templates")
        .update({ name: meta.name.trim(), description: meta.description.trim() || null })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template saved");
      setMetaDirty(false);
      qc.invalidateQueries({ queryKey: ["report_template", id] });
      qc.invalidateQueries({ queryKey: ["report_templates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveQuestion = useMutation({
    mutationFn: async () => {
      if (editingQuestion) {
        const { error } = await supabase
          .from("report_questions")
          .update({
            question_text: draft.question_text.trim(),
            category: draft.category || null,
            answer_type: draft.answer_type,
            source_type: draft.source_type,
            auto_metric: draft.source_type === "auto" ? draft.auto_metric : null,
          })
          .eq("id", editingQuestion.id);
        if (error) throw error;
      } else {
        const nextOrder = (questions[questions.length - 1]?.sort_order ?? -1) + 1;
        const { error } = await supabase.from("report_questions").insert({
          template_id: id,
          question_text: draft.question_text.trim(),
          category: draft.category || null,
          answer_type: draft.answer_type,
          source_type: draft.source_type,
          auto_metric: draft.source_type === "auto" ? draft.auto_metric : null,
          sort_order: nextOrder,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingQuestion ? "Question updated" : "Question added");
      setEditingQuestion(null);
      setCreatingQuestion(false);
      setDraft(EMPTY_DRAFT);
      qc.invalidateQueries({ queryKey: ["report_questions", id] });
      qc.invalidateQueries({ queryKey: ["report_template_question_counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (qid: string) => {
      const { error } = await supabase.from("report_questions").delete().eq("id", qid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question removed");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["report_questions", id] });
      qc.invalidateQueries({ queryKey: ["report_template_question_counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const target = index + dir;
      if (target < 0 || target >= questions.length) return;
      const a = questions[index];
      const b = questions[target];
      const { error: e1 } = await supabase.from("report_questions").update({ sort_order: b.sort_order }).eq("id", a.id);
      const { error: e2 } = await supabase.from("report_questions").update({ sort_order: a.sort_order }).eq("id", b.id);
      if (e1 || e2) throw e1 || e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_questions", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(q: Question) {
    setEditingQuestion(q);
    setDraft({
      question_text: q.question_text,
      category: q.category ?? "Program Health",
      answer_type: q.answer_type,
      source_type: q.source_type,
      auto_metric: q.auto_metric,
    });
  }

  function openCreate() {
    setEditingQuestion(null);
    setDraft(EMPTY_DRAFT);
    setCreatingQuestion(true);
  }

  if (loadingTpl) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-sm text-muted-foreground">Template not found.</p>
        <Button asChild variant="link"><Link to="/reporting/templates">Back to templates</Link></Button>
      </div>
    );
  }

  const dialogOpen = creatingQuestion || !!editingQuestion;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/reporting/templates")} className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> All templates
        </Button>

        <div className="border rounded-2xl p-6 bg-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileBarChart className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Template</p>
              <Input
                value={meta.name}
                onChange={(e) => { setMeta({ ...meta, name: e.target.value }); setMetaDirty(true); }}
                className="text-lg font-semibold border-0 px-0 h-auto focus-visible:ring-0 shadow-none"
                placeholder="Template name"
                id="tpl-editor-name"
                name="name"
              />
            </div>
            {metaDirty && (
              <Button size="sm" onClick={() => saveMeta.mutate()} disabled={!meta.name.trim() || saveMeta.isPending}>
                {saveMeta.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save
              </Button>
            )}
          </div>
          <Textarea
            value={meta.description}
            onChange={(e) => { setMeta({ ...meta, description: e.target.value }); setMetaDirty(true); }}
            className="border-0 px-0 focus-visible:ring-0 shadow-none resize-none text-sm text-muted-foreground"
            placeholder="Add a description for this template…"
            rows={2}
            id="tpl-editor-desc"
            name="description"
          />
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Questions</h2>
            <p className="text-xs text-muted-foreground">{questions.length} total · drag order with arrows</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add question
          </Button>
        </div>

        {loadingQ ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <div className="border border-dashed rounded-2xl py-16 text-center">
            <p className="text-sm font-medium">No questions yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Add the first question to shape this report.</p>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add question
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {questions.map((q, i) => {
              const metric = AUTO_METRICS.find((m) => m.value === q.auto_metric);
              return (
                <div key={q.id} className="group border rounded-xl bg-card p-4 flex items-start gap-3 hover:shadow-sm transition-all">
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button
                      onClick={() => reorder.mutate({ index: i, dir: -1 })}
                      disabled={i === 0}
                      className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30"
                      aria-label="Move up"
                    ><ArrowUp className="h-3.5 w-3.5" /></button>
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30" />
                    <button
                      onClick={() => reorder.mutate({ index: i, dir: 1 })}
                      disabled={i === questions.length - 1}
                      className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30"
                      aria-label="Move down"
                    ><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{q.question_text}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {q.category && <Badge variant="secondary" className="text-[10px] font-normal">{q.category}</Badge>}
                      <Badge variant="outline" className="text-[10px] font-normal capitalize">{q.answer_type}</Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-normal gap-1",
                          q.source_type === "auto" ? "border-primary/40 text-primary" : "text-muted-foreground",
                        )}
                      >
                        {q.source_type === "auto" ? <Zap className="h-2.5 w-2.5" /> : <Hand className="h-2.5 w-2.5" />}
                        {q.source_type === "auto" ? (metric?.label ?? "Auto") : "Manual"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(q)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(q)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setEditingQuestion(null); setCreatingQuestion(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit question" : "New question"}</DialogTitle>
            <DialogDescription>Define what this question captures and how the answer is sourced.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="q-text" className="text-xs font-medium text-muted-foreground">Question</label>
              <Textarea
                id="q-text"
                name="question_text"
                value={draft.question_text}
                onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
                placeholder="e.g. How is the cohort tracking against its goals this quarter?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__custom__">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {draft.category === "__custom__" && (
                  <Input
                    autoFocus
                    className="mt-2"
                    placeholder="New category name"
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    value=""
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Answer type</label>
                <Select value={draft.answer_type} onValueChange={(v: any) => setDraft({ ...draft, answer_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualitative">Qualitative</SelectItem>
                    <SelectItem value="quantitative">Quantitative</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Source</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, source_type: "manual", auto_metric: null })}
                  className={cn(
                    "border rounded-lg p-3 text-left transition-all",
                    draft.source_type === "manual" ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-medium"><Hand className="h-3.5 w-3.5" /> Manual</div>
                  <p className="text-xs text-muted-foreground mt-0.5">Team fills this in.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, source_type: "auto" })}
                  className={cn(
                    "border rounded-lg p-3 text-left transition-all",
                    draft.source_type === "auto" ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-medium"><Zap className="h-3.5 w-3.5" /> Auto</div>
                  <p className="text-xs text-muted-foreground mt-0.5">Pulled from platform data.</p>
                </button>
              </div>
            </div>

            {draft.source_type === "auto" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Metric</label>
                <Select value={draft.auto_metric ?? ""} onValueChange={(v) => setDraft({ ...draft, auto_metric: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a metric" /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(AUTO_METRICS.map((m) => m.group))).map((group) => (
                      <div key={group}>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{group}</div>
                        {AUTO_METRICS.filter((m) => m.group === group).map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingQuestion(null); setCreatingQuestion(false); }}>Cancel</Button>
            <Button
              onClick={() => saveQuestion.mutate()}
              disabled={
                !draft.question_text.trim() ||
                (draft.source_type === "auto" && !draft.auto_metric) ||
                saveQuestion.isPending
              }
            >
              {saveQuestion.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingQuestion ? "Save changes" : "Add question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteQuestion.mutate(deleting.id)}
        title="Remove question?"
        description="This permanently removes the question from the template."
      />
    </div>
  );
}
