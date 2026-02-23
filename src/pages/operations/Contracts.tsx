import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Settings, MoreHorizontal, Pencil, Trash2, X, Eye } from "lucide-react";
import StatusPipeline from "@/components/StatusPipeline";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import type { Tables } from "@/integrations/supabase/types";
import { TagPicker } from "@/components/TagPicker";
import { TagBadges } from "@/components/TagBadges";
import ViewDetailDialog from "@/components/ViewDetailDialog";

type Contract = Tables<"contracts">;

const DEFAULT_STAGES = ["Drafting", "Sent", "Signed"];

function getStages(): string[] {
  try {
    const stored = localStorage.getItem("forge_contract_stages");
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_STAGES;
}

export default function OperationsContracts() {
  const queryClient = useQueryClient();
  const [stages, setStages] = useState(getStages);
  const [contractDialog, setContractDialog] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempStages, setTempStages] = useState(stages);
  const [newStage, setNewStage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [viewing, setViewing] = useState<Contract | null>(null);

  const [form, setForm] = useState({ title: "", stakeholder_name: "", value: "", type: "External", start_date: "", end_date: "", tag_ids: [] as string[] });

  useEffect(() => { localStorage.setItem("forge_contract_stages", JSON.stringify(stages)); }, [stages]);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contracts").insert({
        title: form.title,
        stakeholder_name: form.stakeholder_name,
        value: form.value ? Number(form.value) : 0,
        type: form.type,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: stages[0],
        tag_ids: form.tag_ids,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setContractDialog(false);
      resetForm();
      toast.success("Contract added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingContract) return;
      const { error } = await supabase.from("contracts").update({
        title: form.title,
        stakeholder_name: form.stakeholder_name,
        value: form.value ? Number(form.value) : 0,
        type: form.type,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        tag_ids: form.tag_ids,
      }).eq("id", editingContract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setEditingContract(null);
      resetForm();
      toast.success("Contract updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setDeleteId(null);
      toast.success("Contract deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("contracts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setSelected(new Set());
      setBulkDeleteOpen(false);
      toast.success("Contracts deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("contracts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contracts"] }),
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ title: "", stakeholder_name: "", value: "", type: "External", start_date: "", end_date: "", tag_ids: [] });
  }

  function openEdit(c: Contract) {
    setForm({
      title: c.title,
      stakeholder_name: c.stakeholder_name,
      value: c.value ? String(c.value) : "",
      type: c.type || "External",
      start_date: c.start_date || "",
      end_date: c.end_date || "",
      tag_ids: (c.tag_ids as string[]) || [],
    });
    setEditingContract(c);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAll() {
    if (selected.size === contracts.length) setSelected(new Set());
    else setSelected(new Set(contracts.map((c) => c.id)));
  }

  const contractFormContent = (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Stakeholder</Label>
          <Input value={form.stakeholder_name} onChange={(e) => setForm((f) => ({ ...f, stakeholder_name: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Value (MAD)</Label>
          <Input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="External">External</SelectItem>
              <SelectItem value="Internal">Internal</SelectItem>
              <SelectItem value="Partnership">Partnership</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Tags</Label>
        <TagPicker value={form.tag_ids} onChange={(ids) => setForm((f) => ({ ...f, tag_ids: ids }))} />
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">Contracts</h1>
          <p className="text-sm text-muted-foreground">Manage contract lifecycle and vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setTempStages([...stages]); setSettingsOpen(true); }}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => { resetForm(); setContractDialog(true); }}><Plus className="mr-2 h-4 w-4" /> Add Contract</Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => { const first = contracts.find((c) => selected.has(c.id)); if (first) openEdit(first); }}>
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={contracts.length > 0 && selected.size === contracts.length} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Stakeholder</TableHead>
                <TableHead className="text-right">Value (MAD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : contracts.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No contracts yet</TableCell></TableRow>
              ) : (
                contracts.map((c) => (
                  <TableRow key={c.id} className={selected.has(c.id) ? "bg-muted/50" : ""}>
                    <TableCell><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></TableCell>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.stakeholder_name}</TableCell>
                    <TableCell className="text-right">{c.value ? Number(c.value).toLocaleString() : "—"}</TableCell>
                    <TableCell>
                      <StatusPipeline stages={stages} currentStage={c.status || stages[0]} onStageClick={(s) => statusMutation.mutate({ id: c.id, status: s })} />
                    </TableCell>
                    <TableCell><TagBadges tagIds={c.tag_ids as string[] | null} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.start_date || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.end_date || "—"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(c)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
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

      <Dialog open={contractDialog} onOpenChange={setContractDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Contract</DialogTitle></DialogHeader>
          {contractFormContent}
          <DialogFooter>
            <Button onClick={() => addMutation.mutate()} disabled={!form.title || !form.stakeholder_name}>Add Contract</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingContract} onOpenChange={(o) => !o && setEditingContract(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Contract</DialogTitle></DialogHeader>
          {contractFormContent}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={!form.title || !form.stakeholder_name}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onConfirm={() => bulkDeleteMutation.mutate()} onCancel={() => setBulkDeleteOpen(false)} />

      <ViewDetailDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Contract Details"
        fields={viewing ? [
          { label: "Title", value: viewing.title },
          { label: "Stakeholder", value: viewing.stakeholder_name },
          { label: "Value", value: viewing.value ? `${Number(viewing.value).toLocaleString()} MAD` : "—" },
          { label: "Type", value: viewing.type },
          { label: "Status", value: viewing.status },
          { label: "Start Date", value: viewing.start_date },
          { label: "End Date", value: viewing.end_date },
          { label: "Tags", value: <TagBadges tagIds={viewing.tag_ids as string[] | null} /> },
        ] : []}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contract Stages</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {tempStages.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={s} onChange={(e) => setTempStages((ss) => ss.map((x, j) => j === i ? e.target.value : x))} className="h-8" />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setTempStages((ss) => ss.filter((_, j) => j !== i))} disabled={tempStages.length <= 1}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="New stage..." className="h-8" />
              <Button size="sm" variant="outline" disabled={!newStage.trim()} onClick={() => { setTempStages((ss) => [...ss, newStage.trim()]); setNewStage(""); }}>Add</Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setStages(tempStages.filter(Boolean)); setSettingsOpen(false); toast.success("Stages updated"); }}>Save Stages</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
