import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVendors } from "@/hooks/useRelationalData";
import { useBudgetLinesByCohort, type ContractRow } from "@/hooks/useContracts";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { TagPicker } from "@/components/TagPicker";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const CONTRACT_TYPES = ["mentor", "expert", "consultant", "service provider"];
const CONTRACT_STATUSES = ["Draft", "Active", "Completed", "Terminated"];
const CURRENCIES = ["MAD", "USD", "EUR"];
const PAYMENT_STRUCTURES = ["one-time", "milestone-based", "recurring"];

interface ContractFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingContract?: ContractRow | null;
}

export default function ContractFormDialog({ open, onClose, editingContract }: ContractFormDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: vendors = [] } = useVendors();

  const [form, setForm] = useState({
    title: "",
    description: "",
    vendor_id: null as string | null,
    type: "service provider",
    status: "Draft",
    value: "",
    currency: "MAD",
    payment_structure: "one-time",
    cohort_id: null as string | null,
    budget_line_id: null as string | null,
    start_date: "",
    end_date: "",
    tag_ids: [] as string[],
  });

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cohorts").select("id, name, year").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: budgetLines = [] } = useBudgetLinesByCohort(form.cohort_id);

  useEffect(() => {
    if (editingContract) {
      setForm({
        title: editingContract.title,
        description: editingContract.description || "",
        vendor_id: editingContract.vendor_id,
        type: editingContract.type || "service provider",
        status: editingContract.status || "Draft",
        value: editingContract.value ? String(editingContract.value) : "",
        currency: (editingContract as any).currency || "MAD",
        payment_structure: (editingContract as any).payment_structure || "one-time",
        cohort_id: (editingContract as any).cohort_id || null,
        budget_line_id: (editingContract as any).budget_line_id || null,
        start_date: editingContract.start_date || "",
        end_date: editingContract.end_date || "",
        tag_ids: (editingContract.tag_ids as string[]) || [],
      });
    } else {
      resetForm();
    }
  }, [editingContract, open]);

  function resetForm() {
    setForm({
      title: "", description: "", vendor_id: null, type: "service provider", status: "Draft",
      value: "", currency: "MAD", payment_structure: "one-time", cohort_id: null, budget_line_id: null,
      start_date: "", end_date: "", tag_ids: [],
    });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const vendor = vendors.find((v) => v.id === form.vendor_id);
      const payload = {
        title: form.title,
        description: form.description || null,
        stakeholder_name: vendor?.name || "",
        vendor_id: form.vendor_id,
        type: form.type,
        status: form.status,
        value: form.value ? Number(form.value) : 0,
        currency: form.currency,
        payment_structure: form.payment_structure,
        cohort_id: form.cohort_id,
        budget_line_id: form.budget_line_id,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        tag_ids: form.tag_ids,
      } as any;

      if (editingContract) {
        const { error } = await supabase.from("contracts").update(payload).eq("id", editingContract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(editingContract ? "Contract updated" : "Contract created");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const vendorOptions = vendors.map((v) => ({ id: v.id, label: v.name, sublabel: v.type || undefined }));
  const cohortOptions = cohorts.map((c) => ({ id: c.id, label: c.name, sublabel: String(c.year) }));
  const blOptions = budgetLines.map((bl) => ({ id: bl.id, label: `${bl.code || "—"} — ${bl.name}`, sublabel: bl.allocated_amount ? `${Number(bl.allocated_amount).toLocaleString()} MAD` : undefined }));

  const isValid = form.title && form.vendor_id && form.cohort_id && form.budget_line_id && form.value;

  async function handleCreateVendor(name: string) {
    const { data, error } = await supabase.from("vendors").insert({ name }).select("id").single();
    if (error) { toast.error(error.message); return null; }
    qc.invalidateQueries({ queryKey: ["vendors-list"] });
    return data.id;
  }

  async function handleCreateBudgetLine(name: string) {
    if (!form.cohort_id) { toast.error("Select a cohort first"); return null; }
    const { data, error } = await supabase.from("budget_lines").insert({ name, cohort_id: form.cohort_id } as any).select("id").single();
    if (error) { toast.error(error.message); return null; }
    qc.invalidateQueries({ queryKey: ["budget-lines-by-cohort"] });
    return data.id;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingContract ? "Edit Contract" : "New Contract"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <SearchableSelect
                value={form.vendor_id}
                onValueChange={(v) => setForm((f) => ({ ...f, vendor_id: v }))}
                options={vendorOptions}
                placeholder="Select vendor..."
                searchPlaceholder="Search vendors..."
                onCreateNew={handleCreateVendor}
                createLabel="Add vendor"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Structure</Label>
              <Select value={form.payment_structure} onValueChange={(v) => setForm((f) => ({ ...f, payment_structure: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STRUCTURES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total Value *</Label>
              <Input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cohort *</Label>
              <SearchableSelect
                value={form.cohort_id}
                onValueChange={(v) => setForm((f) => ({ ...f, cohort_id: v, budget_line_id: null }))}
                options={cohortOptions}
                placeholder="Select cohort..."
                searchPlaceholder="Search cohorts..."
              />
            </div>
            <div className="space-y-2">
              <Label>Budget Line *</Label>
              <SearchableSelect
                value={form.budget_line_id}
                onValueChange={(v) => setForm((f) => ({ ...f, budget_line_id: v }))}
                options={blOptions}
                placeholder="Select budget line..."
                searchPlaceholder="Search budget lines..."
                disabled={!form.cohort_id}
                onCreateNew={handleCreateBudgetLine}
                createLabel="Add budget line"
              />
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!isValid || saveMutation.isPending}>
            {editingContract ? "Save Changes" : "Create Contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
