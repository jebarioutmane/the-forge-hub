import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import type { Tables } from "@/integrations/supabase/types";

type Session = Tables<"mentoring_sessions">;

export default function Mentoring() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ mentor_name: "", founder_name: "", session_date: "", time_slot: "" });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["mentoring_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mentoring_sessions").select("*").order("session_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        mentor_name: form.mentor_name,
        founder_name: form.founder_name,
        session_date: form.session_date || null,
        time_slot: form.time_slot || null,
      };
      if (editing) {
        const { error } = await supabase.from("mentoring_sessions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mentoring_sessions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentoring_sessions"] });
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      toast.success(editing ? "Session updated" : "Session added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mentoring_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentoring_sessions"] });
      setDeleteId(null);
      toast.success("Session deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ mentor_name: "", founder_name: "", session_date: "", time_slot: "" });
  }

  function openEdit(s: Session) {
    setForm({
      mentor_name: s.mentor_name,
      founder_name: s.founder_name,
      session_date: s.session_date || "",
      time_slot: s.time_slot || "",
    });
    setEditing(s);
    setDialogOpen(true);
  }

  const formContent = (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Mentor Name</Label>
          <Input value={form.mentor_name} onChange={(e) => setForm((f) => ({ ...f, mentor_name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Founder Name</Label>
          <Input value={form.founder_name} onChange={(e) => setForm((f) => ({ ...f, founder_name: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Session Date</Label>
          <Input type="date" value={form.session_date} onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Time Slot</Label>
          <Input value={form.time_slot} onChange={(e) => setForm((f) => ({ ...f, time_slot: e.target.value }))} placeholder="e.g. 10:00 - 11:00" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mentoring</h1>
        <Button onClick={() => { resetForm(); setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Session</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mentor</TableHead>
                <TableHead>Founder</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time Slot</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : sessions.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sessions yet</TableCell></TableRow>
              ) : (
                sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.mentor_name}</TableCell>
                    <TableCell>{s.founder_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.session_date || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.time_slot || "—"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Session" : "New Session"}</DialogTitle></DialogHeader>
          {formContent}
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.mentor_name || !form.founder_name}>
              {editing ? "Save Changes" : "Add Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
