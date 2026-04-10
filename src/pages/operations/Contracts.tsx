import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVendors } from "@/hooks/useRelationalData";
import { useContracts, useContractPayments, type ContractRow } from "@/hooks/useContracts";
import { logAction } from "@/lib/logAction";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { ViewToggle } from "@/components/ViewToggle";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import ContractFormDialog from "@/components/contracts/ContractFormDialog";
import ContractDetailDialog from "@/components/contracts/ContractDetailDialog";
import ContractCard from "@/components/contracts/ContractCard";
import { useQuery } from "@tanstack/react-query";

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function OperationsContracts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: contracts = [], isLoading } = useContracts();
  const { data: vendors = [] } = useVendors();

  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [formOpen, setFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null);
  const [viewingContract, setViewingContract] = useState<ContractRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Fetch all payments for summary calculations
  const { data: allPayments = [] } = useQuery({
    queryKey: ["all-contract-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_payments" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const paidByContract = useMemo(() => {
    const map: Record<string, number> = {};
    allPayments.filter((p: any) => p.status === "paid").forEach((p: any) => {
      map[p.contract_id] = (map[p.contract_id] || 0) + Number(p.amount);
    });
    return map;
  }, [allPayments]);

  const getVendorName = (c: ContractRow) => {
    if (c.vendor_id) {
      const v = vendors.find((x) => x.id === c.vendor_id);
      return v?.name || c.stakeholder_name;
    }
    return c.stakeholder_name;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      const deleted = contracts.find((c) => c.id === id);
      logAction("Operations-Contracts", "DELETE", id, deleted as any, null, user?.email || "Unknown");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["all-contract-payments"] });
      setDeleteId(null);
      toast.success("Contract deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("contracts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["all-contract-payments"] });
      setSelected(new Set());
      setBulkDeleteOpen(false);
      toast.success("Contracts deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAll() {
    if (selected.size === contracts.length) setSelected(new Set());
    else setSelected(new Set(contracts.map((c) => c.id)));
  }

  // Summary stats
  const totalContractValue = contracts.reduce((s, c) => s + (c.value ? Number(c.value) : 0), 0);
  const totalPaidAll = Object.values(paidByContract).reduce((s, v) => s + v, 0);
  const totalRemaining = totalContractValue - totalPaidAll;
  const overallPct = totalContractValue > 0 ? Math.round((totalPaidAll / totalContractValue) * 100) : 0;

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">Contracts</h1>
          <p className="text-sm text-muted-foreground">Manage contracts, payments, and vendor relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <Button onClick={() => { setEditingContract(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Contract
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Contracts</p>
            <p className="text-2xl font-bold">{contracts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">{totalContractValue.toLocaleString()} <span className="text-sm font-normal">MAD</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-600">{totalPaidAll.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-2xl font-bold text-orange-600">{totalRemaining.toLocaleString()}</p>
            <Progress value={overallPct} className="h-1.5 mt-2" />
            <p className="text-[10px] text-muted-foreground mt-1">{overallPct}% paid</p>
          </CardContent>
        </Card>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      )}

      {viewMode === "table" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={contracts.length > 0 && selected.size === contracts.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : contracts.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No contracts yet</TableCell></TableRow>
                ) : (
                  contracts.map((c) => {
                    const paid = paidByContract[c.id] || 0;
                    const val = c.value ? Number(c.value) : 0;
                    const pct = val > 0 ? Math.round((paid / val) * 100) : 0;
                    const cur = (c as any).currency || "MAD";
                    return (
                      <TableRow key={c.id} className={selected.has(c.id) ? "bg-muted/50" : ""}>
                        <TableCell><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></TableCell>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell>{getVendorName(c)}</TableCell>
                        <TableCell><span className="capitalize text-sm">{c.type}</span></TableCell>
                        <TableCell>
                          <Badge className={statusColors[c.status || "Draft"]}>{c.status || "Draft"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{val.toLocaleString()} {cur}</TableCell>
                        <TableCell className="text-right text-emerald-600">{paid.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewingContract(c)}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditingContract(c); setFormOpen(true); }}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        isLoading ? (
          <p className="text-muted-foreground text-center py-12">Loading contracts...</p>
        ) : contracts.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No contracts yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {contracts.map((c) => (
              <ContractCard
                key={c.id}
                contract={c}
                vendorName={getVendorName(c)}
                totalPaid={paidByContract[c.id] || 0}
                onView={() => setViewingContract(c)}
                onEdit={() => { setEditingContract(c); setFormOpen(true); }}
                onDelete={() => setDeleteId(c.id)}
              />
            ))}
          </div>
        )
      )}

      <ContractFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingContract(null); }}
        editingContract={editingContract}
      />

      <ContractDetailDialog
        contract={viewingContract}
        onClose={() => setViewingContract(null)}
      />

      <ConfirmDeleteDialog open={!!deleteId} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onConfirm={() => bulkDeleteMutation.mutate()} onCancel={() => setBulkDeleteOpen(false)} />
    </div>
  );
}
