import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCohort, ALL_COHORTS } from "@/contexts/CohortContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Search, Copy, ListTree, ArchiveRestore,
  ChevronRight, ChevronDown, Layers,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";

type Currency = "MAD" | "USD" | "EUR";

type BudgetLine = {
  id: string;
  cohort_id: string | null;
  parent_id: string | null;
  name: string;
  code: string | null;
  allocated_amount: number | null;
  currency: Currency | null;
  sort_order: number | null;
  is_archived: boolean | null;
};

function fmt(n: number, ccy: Currency = "MAD") {
  const s = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  const sym: Record<Currency, string> = { MAD: "MAD", USD: "$", EUR: "€" };
  return ccy === "MAD" ? `${s} MAD` : `${sym[ccy]}${s}`;
}

export default function BudgetLines() {
  const qc = useQueryClient();
  const { selectedCohortId, selectedCohortLabel, selectedCohort, cohorts, isLoading: cohortLoading } = useCohort();
  const cohortScoped = selectedCohortId && selectedCohortId !== ALL_COHORTS;


  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetLine | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["budget_lines", "manager", selectedCohortId, showArchived],
    queryFn: async () => {
      let q = supabase.from("budget_lines").select("*").order("sort_order").order("code");
      if (cohortScoped) q = q.eq("cohort_id", selectedCohortId);
      if (!showArchived) q = q.eq("is_archived", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BudgetLine[];
    },
  });

  const lineIds = useMemo(() => lines.map((l) => l.id), [lines]);

  // Spend rollup: expenses + paid stipends + paid contract_payments
  const { data: spendByLine = {} } = useQuery({
    queryKey: ["budget_lines", "spend", lineIds.join(",")],
    enabled: lineIds.length > 0,
    queryFn: async () => {
      const [exp, stp, pay] = await Promise.all([
        supabase.from("expenses")
          .select("amount, budget_line_id, status, is_archived")
          .in("budget_line_id", lineIds).eq("is_archived", false),
        supabase.from("stipend_records")
          .select("total_net, budget_line_id, status, is_archived")
          .in("budget_line_id", lineIds).eq("is_archived", false).eq("status", "paid"),
        supabase.from("contract_payments")
          .select("amount, budget_line_id, status")
          .in("budget_line_id", lineIds),
      ]);
      const m: Record<string, { committed: number; spent: number }> = {};
      const add = (id: string | null | undefined, key: "committed" | "spent", amt: number) => {
        if (!id) return;
        if (!m[id]) m[id] = { committed: 0, spent: 0 };
        m[id][key] += amt;
      };
      for (const e of exp.data || []) {
        const paid = String((e as any).status).toLowerCase() === "paid";
        add((e as any).budget_line_id, paid ? "spent" : "committed", Number((e as any).amount || 0));
      }
      for (const s of stp.data || []) {
        add((s as any).budget_line_id, "spent", Number((s as any).total_net || 0));
      }
      for (const p of pay.data || []) {
        const st = String((p as any).status).toLowerCase();
        if (st === "paid") add((p as any).budget_line_id, "spent", Number((p as any).amount || 0));
        else if (st === "scheduled" || st === "committed")
          add((p as any).budget_line_id, "committed", Number((p as any).amount || 0));
      }
      return m;
    },
  });

  // Filter + build tree
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return lines;
    // keep matched + their ancestors so tree stays coherent
    const byId = new Map(lines.map((l) => [l.id, l]));
    const keep = new Set<string>();
    for (const l of lines) {
      const hit = (l.code || "").toLowerCase().includes(s) || l.name.toLowerCase().includes(s);
      if (hit) {
        keep.add(l.id);
        let p = l.parent_id;
        while (p && byId.has(p)) { keep.add(p); p = byId.get(p)!.parent_id; }
      }
    }
    return lines.filter((l) => keep.has(l.id));
  }, [lines, search]);

  const tree = useMemo(() => {
    const byParent: Record<string, BudgetLine[]> = {};
    for (const l of filtered) {
      const k = l.parent_id || "__root__";
      (byParent[k] ||= []).push(l);
    }
    return byParent;
  }, [filtered]);

  const totals = useMemo(() => {
    let allocated = 0, committed = 0, spent = 0;
    for (const l of lines) {
      allocated += Number(l.allocated_amount || 0);
      const s = spendByLine[l.id];
      if (s) { committed += s.committed; spent += s.spent; }
    }
    return { allocated, committed, spent, remaining: allocated - spent - committed };
  }, [lines, spendByLine]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const target = lines.find((l) => l.id === id);
      const archive = !target?.is_archived;
      const { error } = await supabase.from("budget_lines")
        .update({ is_archived: archive, archived_at: archive ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_lines"] });
      setDeleteId(null);
      toast({ title: "Updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const canWrite = cohortScoped;

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Budget Lines
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Official sponsor budget lines for {selectedCohortLabel || "the selected cohort"}. All modules (expenses, stipends, contracts) draw against these.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" disabled={!canWrite} onClick={() => setCopyOpen(true)}>
            <Copy className="h-4 w-4" /> Copy from cohort
          </Button>
          <Button variant="outline" className="gap-2" disabled={!canWrite} onClick={() => setBulkOpen(true)}>
            <ListTree className="h-4 w-4" /> Bulk add
          </Button>
          <Button className="gap-2" disabled={!canWrite} onClick={() => { setEditing(null); setParentForNew(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </div>
      </header>

      {cohortLoading && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">Loading cohort…</CardContent>
        </Card>
      )}

      {!cohortLoading && !cohortScoped && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Select a specific cohort to manage its budget lines.
          </CardContent>
        </Card>
      )}


      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Lines" value={String(lines.filter((l) => !l.is_archived).length)} />
        <Kpi label="Allocated" value={fmt(totals.allocated)} />
        <Kpi label="Committed" value={fmt(totals.committed)} />
        <Kpi label="Spent" value={fmt(totals.spent)} warning={totals.remaining < 0} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search by code or title…" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="archived" className="text-sm cursor-pointer">Show archived</Label>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Budget structure</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Layers className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                {lines.length === 0 ? "No budget lines yet. Add one, bulk-paste, or copy from another cohort." : "No lines match your search."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <div className="col-span-5">Code / Title</div>
                <div className="col-span-2 text-right">Allocated</div>
                <div className="col-span-2 text-right">Committed</div>
                <div className="col-span-2 text-right">Spent</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
              <TreeRows
                nodes={tree["__root__"] || []}
                childrenMap={tree}
                depth={0}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                spendByLine={spendByLine}
                onEdit={(l) => { setEditing(l); setParentForNew(null); setFormOpen(true); }}
                onAddChild={(pid) => { setEditing(null); setParentForNew(pid); setFormOpen(true); }}
                onArchiveToggle={(l) => l.is_archived ? deleteMutation.mutate(l.id) : setDeleteId(l.id)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) { setEditing(null); setParentForNew(null); } }}>
        <LineFormDialog
          editing={editing}
          parentId={parentForNew}
          cohortId={cohortScoped ? (selectedCohortId as string) : null}
          allLines={lines}
          onClose={() => { setFormOpen(false); setEditing(null); setParentForNew(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["budget_lines"] }); setFormOpen(false); setEditing(null); setParentForNew(null); }}
        />
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <BulkAddDialog
          cohortId={cohortScoped ? (selectedCohortId as string) : null}
          onClose={() => setBulkOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["budget_lines"] }); setBulkOpen(false); }}
        />
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <CopyFromCohortDialog
          currentCohortId={cohortScoped ? (selectedCohortId as string) : null}
          currentCohortLabel={selectedCohort?.label || ""}
          cohorts={cohorts as any[]}
          onClose={() => setCopyOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["budget_lines"] }); setCopyOpen(false); }}
        />
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        title="Archive budget line?"
        description="Linked expenses, stipends and contract payments keep their reference. Toggle 'Show archived' to restore later."
      />
    </div>
  );
}

function Kpi({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <Card className={warning ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold mt-1 ${warning ? "text-destructive" : ""}`}
           style={{ fontFamily: "var(--font-display)" }}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TreeRows({
  nodes, childrenMap, depth, collapsed, setCollapsed, spendByLine, onEdit, onAddChild, onArchiveToggle,
}: {
  nodes: BudgetLine[];
  childrenMap: Record<string, BudgetLine[]>;
  depth: number;
  collapsed: Record<string, boolean>;
  setCollapsed: (v: Record<string, boolean>) => void;
  spendByLine: Record<string, { committed: number; spent: number }>;
  onEdit: (l: BudgetLine) => void;
  onAddChild: (pid: string) => void;
  onArchiveToggle: (l: BudgetLine) => void;
}) {
  return (
    <>
      {nodes.map((l) => {
        const kids = childrenMap[l.id] || [];
        const hasKids = kids.length > 0;
        const isCollapsed = collapsed[l.id];
        const roll = spendByLine[l.id] || { committed: 0, spent: 0 };
        const allocated = Number(l.allocated_amount || 0);
        const usage = allocated > 0 ? Math.min(((roll.spent + roll.committed) / allocated) * 100, 100) : 0;
        const over = allocated > 0 && roll.spent + roll.committed > allocated;
        const ccy = (l.currency || "MAD") as Currency;
        return (
          <div key={l.id}>
            <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-muted/30 ${l.is_archived ? "opacity-50" : ""}`}>
              <div className="col-span-5 flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 20 }}>
                {hasKids ? (
                  <button
                    onClick={() => setCollapsed({ ...collapsed, [l.id]: !isCollapsed })}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                  >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                ) : <span className="h-5 w-5 inline-block" />}
                {l.code && (
                  <Badge variant="outline" className="font-mono text-[11px] shrink-0">{l.code}</Badge>
                )}
                <span className="truncate font-medium text-sm">{l.name}</span>
                {l.is_archived && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
              </div>
              <div className="col-span-2 text-right text-sm tabular-nums">
                {allocated > 0 ? fmt(allocated, ccy) : <span className="text-muted-foreground">—</span>}
              </div>
              <div className="col-span-2 text-right text-sm tabular-nums text-muted-foreground">
                {roll.committed > 0 ? fmt(roll.committed, ccy) : "—"}
              </div>
              <div className="col-span-2 text-right text-sm tabular-nums">
                <div className={over ? "text-destructive" : ""}>{roll.spent > 0 ? fmt(roll.spent, ccy) : "—"}</div>
                {allocated > 0 && (
                  <Progress value={usage} className={`h-1 mt-1 ${over ? "[&>div]:bg-destructive" : ""}`} />
                )}
              </div>
              <div className="col-span-1 flex items-center justify-end gap-0.5">
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Add sub-line"
                        onClick={() => onAddChild(l.id)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"
                        onClick={() => onEdit(l)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        title={l.is_archived ? "Restore" : "Archive"}
                        onClick={() => onArchiveToggle(l)}>
                  {l.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            {hasKids && !isCollapsed && (
              <TreeRows
                nodes={kids} childrenMap={childrenMap} depth={depth + 1}
                collapsed={collapsed} setCollapsed={setCollapsed}
                spendByLine={spendByLine}
                onEdit={onEdit} onAddChild={onAddChild} onArchiveToggle={onArchiveToggle}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- Dialogs ---------------- */

function LineFormDialog({
  editing, parentId, cohortId, allLines, onClose, onSaved,
}: {
  editing: BudgetLine | null;
  parentId: string | null;
  cohortId: string | null;
  allLines: BudgetLine[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: editing?.code || "",
    name: editing?.name || "",
    allocated_amount: editing?.allocated_amount != null ? String(editing.allocated_amount) : "",
    currency: (editing?.currency || "MAD") as Currency,
    parent_id: editing?.parent_id || parentId || "__none__",
    sort_order: editing?.sort_order != null ? String(editing.sort_order) : "0",
  });

  // Prevent self/descendant as parent
  const forbidden = useMemo(() => {
    if (!editing) return new Set<string>();
    const s = new Set<string>([editing.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const l of allLines) {
        if (l.parent_id && s.has(l.parent_id) && !s.has(l.id)) { s.add(l.id); grew = true; }
      }
    }
    return s;
  }, [editing, allLines]);

  const parentOptions = allLines.filter((l) => !forbidden.has(l.id));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        allocated_amount: Number(form.allocated_amount) || 0,
        currency: form.currency,
        parent_id: form.parent_id === "__none__" ? null : form.parent_id,
        sort_order: Number(form.sort_order) || 0,
        cohort_id: editing?.cohort_id ?? cohortId,
      };
      if (editing) {
        const { error } = await supabase.from("budget_lines").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_lines").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: editing ? "Line updated" : "Line added" }); onSaved(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit budget line" : "New budget line"}</DialogTitle>
        <DialogDescription>
          Define an official sponsor line the whole platform can draw against.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bl-code">Code</Label>
            <Input id="bl-code" name="code" value={form.code} placeholder="BL-4.2"
                   onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="bl-name">Title</Label>
            <Input id="bl-name" name="name" value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="bl-amount">Allocated amount</Label>
            <Input id="bl-amount" name="allocated_amount" type="number" value={form.allocated_amount}
                   onChange={(e) => setForm({ ...form, allocated_amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as Currency })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MAD">MAD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Parent (optional)</Label>
            <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
              <SelectTrigger><SelectValue placeholder="Top-level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Top-level (no parent)</SelectItem>
                {parentOptions.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.code ? `${l.code} — ${l.name}` : l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-sort">Sort order</Label>
            <Input id="bl-sort" name="sort_order" type="number" value={form.sort_order}
                   onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}>
          {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add line"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* -------- Bulk add -------- */

type ParsedRow = { code: string | null; name: string; amount: number; currency: Currency; ok: boolean; raw: string };

function parseBulk(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // split by tab or comma
    const parts = line.split(/\t|,/).map((p) => p.trim());
    let code: string | null = null, name = "", amountStr = "0", ccy: Currency = "MAD";
    if (parts.length === 1) { name = parts[0]; }
    else if (parts.length === 2) { code = parts[0] || null; name = parts[1]; }
    else if (parts.length === 3) { code = parts[0] || null; name = parts[1]; amountStr = parts[2]; }
    else { code = parts[0] || null; name = parts[1]; amountStr = parts[2]; ccy = (["MAD","USD","EUR"].includes(parts[3].toUpperCase()) ? parts[3].toUpperCase() : "MAD") as Currency; }
    const amount = Number(String(amountStr).replace(/[^\d.-]/g, "")) || 0;
    rows.push({ code, name, amount, currency: ccy, ok: !!name, raw });
  }
  return rows;
}

function BulkAddDialog({
  cohortId, onClose, onSaved,
}: { cohortId: string | null; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"input" | "preview">("input");
  const parsed = useMemo(() => parseBulk(text), [text]);
  const validCount = parsed.filter((r) => r.ok).length;

  const mutation = useMutation({
    mutationFn: async () => {
      const rows = parsed.filter((r) => r.ok).map((r, i) => ({
        code: r.code, name: r.name, allocated_amount: r.amount,
        currency: r.currency, cohort_id: cohortId, sort_order: i,
      }));
      if (rows.length === 0) return;
      const { error } = await supabase.from("budget_lines").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: `Added ${validCount} lines` }); onSaved(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Bulk add budget lines</DialogTitle>
        <DialogDescription>
          Paste one line per row. Formats supported: <code>title</code>, <code>code, title</code>, <code>code, title, amount</code>, <code>code, title, amount, currency</code>. Tabs also work (paste from a spreadsheet).
        </DialogDescription>
      </DialogHeader>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="preview">Preview ({validCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="input" className="mt-3">
          <Textarea
            value={text} onChange={(e) => setText(e.target.value)}
            rows={12} className="font-mono text-xs"
            placeholder={`BL-1, Travel, 50000\nBL-2, Catering, 30000\nBL-3, Speaker fees, 80000, USD`}
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-3">
          {parsed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nothing to preview.</p>
          ) : (
            <div className="max-h-72 overflow-auto border rounded-md divide-y text-sm">
              {parsed.map((r, i) => (
                <div key={i} className={`grid grid-cols-12 gap-2 px-3 py-1.5 ${!r.ok ? "bg-destructive/10" : ""}`}>
                  <div className="col-span-2 font-mono text-xs">{r.code || <span className="text-muted-foreground">—</span>}</div>
                  <div className="col-span-6 truncate">{r.name || <span className="text-destructive">Missing title</span>}</div>
                  <div className="col-span-3 text-right tabular-nums">{fmt(r.amount, r.currency)}</div>
                  <div className="col-span-1 text-right text-xs text-muted-foreground">{r.currency}</div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || validCount === 0 || !cohortId}>
          {mutation.isPending ? "Saving…" : `Add ${validCount} line${validCount === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* -------- Copy from cohort -------- */

function CopyFromCohortDialog({
  currentCohortId, currentCohortLabel, cohorts, onClose, onSaved,
}: {
  currentCohortId: string | null;
  currentCohortLabel: string;
  cohorts: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sourceId, setSourceId] = useState<string>("");
  const [preview, setPreview] = useState<BudgetLine[] | null>(null);

  const loadPreview = async (id: string) => {
    const { data, error } = await supabase.from("budget_lines").select("*")
      .eq("cohort_id", id).eq("is_archived", false).order("sort_order").order("code");
    if (error) { toast({ title: "Load failed", description: error.message, variant: "destructive" }); return; }
    setPreview((data || []) as BudgetLine[]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!preview || !currentCohortId) return;
      // Copy while remapping parent_id from old -> new
      const idMap: Record<string, string> = {};
      // Insert in parent-first order (topological)
      const remaining = [...preview];
      const inserted = new Set<string>();
      // Multi-pass: insert lines whose parent is null or already remapped
      while (remaining.length > 0) {
        const batch = remaining.filter((l) => !l.parent_id || idMap[l.parent_id]);
        if (batch.length === 0) {
          // Orphan cycle safeguard — insert rest with null parent
          for (const l of remaining) {
            const { data, error } = await supabase.from("budget_lines").insert({
              code: l.code, name: l.name, allocated_amount: l.allocated_amount || 0,
              currency: (l.currency || "MAD"), sort_order: l.sort_order || 0,
              cohort_id: currentCohortId, parent_id: null,
            }).select("id").single();
            if (error) throw error;
            idMap[l.id] = data!.id;
          }
          break;
        }
        for (const l of batch) {
          const { data, error } = await supabase.from("budget_lines").insert({
            code: l.code, name: l.name, allocated_amount: l.allocated_amount || 0,
            currency: (l.currency || "MAD"), sort_order: l.sort_order || 0,
            cohort_id: currentCohortId,
            parent_id: l.parent_id ? idMap[l.parent_id] : null,
          }).select("id").single();
          if (error) throw error;
          idMap[l.id] = data!.id;
          inserted.add(l.id);
        }
        const stillLeft = remaining.filter((l) => !inserted.has(l.id));
        remaining.length = 0;
        remaining.push(...stillLeft);
      }
    },
    onSuccess: () => { toast({ title: "Budget lines copied" }); onSaved(); },
    onError: (e: any) => toast({ title: "Copy failed", description: e.message, variant: "destructive" }),
  });

  const sources = cohorts.filter((c) => c.id !== currentCohortId);

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Copy budget lines to {currentCohortLabel}</DialogTitle>
        <DialogDescription>
          Pick a source cohort. All its non-archived lines will be duplicated (codes, titles, amounts, currency and nesting). Amounts remain editable after.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="space-y-1.5">
          <Label>Source cohort</Label>
          <Select value={sourceId} onValueChange={(v) => { setSourceId(v); loadPreview(v); }}>
            <SelectTrigger><SelectValue placeholder="Choose a cohort…" /></SelectTrigger>
            <SelectContent>
              {sources.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {preview && (
          <div className="border rounded-md max-h-72 overflow-auto divide-y text-sm">
            {preview.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No lines in that cohort.</p>
            ) : preview.map((l) => (
              <div key={l.id} className="grid grid-cols-12 gap-2 px-3 py-1.5">
                <div className="col-span-2 font-mono text-xs">{l.code || "—"}</div>
                <div className="col-span-7 truncate">{l.name}</div>
                <div className="col-span-3 text-right tabular-nums">
                  {fmt(Number(l.allocated_amount || 0), (l.currency || "MAD") as Currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !preview || preview.length === 0 || !currentCohortId}>
          {mutation.isPending ? "Copying…" : `Copy ${preview?.length ?? 0} lines`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
