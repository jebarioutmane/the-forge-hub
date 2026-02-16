import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, GraduationCap, Briefcase } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { TagPicker } from "@/components/TagPicker";
import { TagBadges } from "@/components/TagBadges";
import { Progress } from "@/components/ui/progress";
import type { Tables } from "@/integrations/supabase/types";

type Founder = Tables<"founders">;

export default function FoundersSource() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Founder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ founder_name: "", startup_name: "", cohort: "", tag_ids: [] as string[] });

  const { data: founders = [], isLoading } = useQuery({
    queryKey: ["founders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders").select("*").order("founder_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tracking = [] } = useQuery({
    queryKey: ["founders_tracking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("founders_tracking").select("*").order("tracking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        founder_name: form.founder_name,
        startup_name: form.startup_name,
        cohort: form.cohort || null,
        tag_ids: form.tag_ids,
      };
      if (editing) {
        const { error } = await supabase.from("founders").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("founders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      toast.success(editing ? "Founder updated" : "Founder added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("founders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founders"] });
      setDeleteId(null);
      toast.success("Founder deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ founder_name: "", startup_name: "", cohort: "", tag_ids: [] });
  }

  function openEdit(f: Founder) {
    setForm({
      founder_name: f.founder_name,
      startup_name: f.startup_name,
      cohort: f.cohort || "",
      tag_ids: (f.tag_ids as string[]) || [],
    });
    setEditing(f);
    setDialogOpen(true);
  }

  function getLatestScore(founderId: string) {
    const latest = tracking.find((t) => t.founder_id === founderId);
    if (!latest) return 0;
    const scores = [
      latest.product_dev_rating,
      latest.clients_traction_rating,
      latest.team_structure_rating,
      latest.market_presence_rating,
      latest.funding_update_rating,
    ].filter((s): s is number => s !== null);
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20);
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Founders Directory</h1>
          <p className="text-sm text-muted-foreground">Manage founders and track their progress</p>
        </div>
        <Button onClick={() => { resetForm(); setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Founder</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading founders...</p>
      ) : founders.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No founders yet. Add your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {founders.map((f) => {
            const score = getLatestScore(f.id);
            return (
              <Card key={f.id} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer border" onClick={() => openEdit(f)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-full bg-module-founders/10 flex items-center justify-center text-module-founders font-bold text-sm">
                      {f.founder_name.charAt(0).toUpperCase()}
                    </div>
                    {f.cohort && (
                      <Badge variant="outline" className="text-[10px]">{f.cohort}</Badge>
                    )}
                  </div>
                  <h3 className="font-bold text-sm mb-0.5">{f.founder_name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{f.startup_name}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Progress Score</span>
                      <span className="font-semibold">{score}%</span>
                    </div>
                    <Progress value={score} className="h-1.5" />
                  </div>
                  <div className="mt-3">
                    <TagBadges tagIds={f.tag_ids as string[] | null} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Founder" : "New Founder"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Founder Name</Label>
                <Input value={form.founder_name} onChange={(e) => setForm((f) => ({ ...f, founder_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Startup Name</Label>
                <Input value={form.startup_name} onChange={(e) => setForm((f) => ({ ...f, startup_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cohort</Label>
              <Input value={form.cohort} onChange={(e) => setForm((f) => ({ ...f, cohort: e.target.value }))} placeholder="e.g. Cohort 1" />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagPicker value={form.tag_ids} onChange={(ids) => setForm((f) => ({ ...f, tag_ids: ids }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing && (
              <Button variant="destructive" size="sm" onClick={() => { setDialogOpen(false); setDeleteId(editing.id); }}>Delete</Button>
            )}
            <Button onClick={() => saveMutation.mutate()} disabled={!form.founder_name || !form.startup_name}>
              {editing ? "Save Changes" : "Add Founder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
