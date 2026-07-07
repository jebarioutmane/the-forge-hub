import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { FileBarChart, Plus, Pencil, Archive, ArchiveRestore, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
};

export default function ReportTemplates() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [archiving, setArchiving] = useState<Template | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["report_templates", showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("id,name,description,is_archived,created_at")
        .eq("is_archived", showArchived)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["report_template_question_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_questions").select("template_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { if (r.template_id) map[r.template_id] = (map[r.template_id] ?? 0) + 1; });
      return map;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .insert({ name: form.name.trim(), description: form.description.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Template created");
      setCreating(false);
      setForm({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["report_templates"] });
      navigate(`/reporting/templates/${id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("report_templates")
        .update({ is_archived: archived, archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report_templates"] });
      setArchiving(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileBarChart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Report Templates</h1>
              <p className="text-sm text-muted-foreground">Reusable templates that structure the reports you generate.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            Archived
          </label>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Template
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-20 text-center">
          <FileBarChart className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium">{showArchived ? "No archived templates" : "No templates yet"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {showArchived ? "Archived templates will appear here." : "Create your first template to start building reports."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group border rounded-xl p-5 bg-card hover:shadow-sm transition-all flex items-start justify-between gap-4"
            >
              <Link to={`/reporting/templates/${t.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{t.name}</h3>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {counts[t.id] ?? 0} {(counts[t.id] ?? 0) === 1 ? "question" : "questions"}
                  </Badge>
                </div>
                {t.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                )}
              </Link>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/reporting/templates/${t.id}`)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> View
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/reporting/templates/${t.id}`)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                {showArchived ? (
                  <Button size="sm" variant="ghost" onClick={() => archiveMut.mutate({ id: t.id, archived: false })}>
                    <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setArchiving(t)}>
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New report template</DialogTitle>
            <DialogDescription>Give your template a name. You can add questions next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="tpl-name" className="text-xs font-medium text-muted-foreground">Name</label>
              <Input id="tpl-name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Quarterly Program Report" />
            </div>
            <div>
              <label htmlFor="tpl-desc" className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea id="tpl-desc" name="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this report covers" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.name.trim() || createMut.isPending}>
              {createMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!archiving}
        onCancel={() => setArchiving(null)}
        onConfirm={() => archiving && archiveMut.mutate({ id: archiving.id, archived: true })}
        title="Archive template?"
        description="You can restore it later from the Archived toggle."
      />
    </div>
  );
}
