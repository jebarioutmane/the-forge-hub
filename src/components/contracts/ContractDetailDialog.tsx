import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TagBadges } from "@/components/TagBadges";
import type { ContractRow } from "@/hooks/useContracts";
import { useContractPayments, useContractMilestones, isCommitted, isPaid, useAllBudgetLines } from "@/hooks/useContracts";
import { useVendors } from "@/hooks/useRelationalData";
import ContractPaymentsTab from "./ContractPaymentsTab";
import ContractMilestonesTab from "./ContractMilestonesTab";
import ContractDocumentsTab from "./ContractDocumentsTab";

interface ContractDetailDialogProps {
  contract: ContractRow | null;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function ContractDetailDialog({ contract, onClose }: ContractDetailDialogProps) {
  const [tab, setTab] = useState("overview");
  const { data: vendors = [] } = useVendors();
  const { data: payments = [] } = useContractPayments(contract?.id ?? null);
  const { data: milestones = [] } = useContractMilestones(contract?.id ?? null);

  const { data: budgetLines = [] } = useAllBudgetLines();

  if (!contract) return null;

  const vendor = vendors.find((v) => v.id === contract.vendor_id);
  const budgetLine = budgetLines.find((b) => b.id === contract.budget_line_id);
  const totalValue = contract.value ? Number(contract.value) : 0;
  const totalPaid = payments.filter((p) => isPaid(p.status)).reduce((s, p) => s + Number(p.amount), 0);
  const totalCommitted = payments.filter((p) => isCommitted(p.status)).reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(totalValue - totalPaid, 0);
  const pctPaid = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0;
  const pctCommitted = totalValue > 0 ? Math.round((totalCommitted / totalValue) * 100) : 0;
  const currency = (contract as any).currency || "MAD";

  return (
    <Dialog open={!!contract} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{contract.title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{vendor?.name || contract.stakeholder_name}</p>
            </div>
            <Badge className={statusColors[contract.status || "Draft"]}>{contract.status || "Draft"}</Badge>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Financial Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Total Value</p>
                <p className="text-lg font-semibold">{totalValue.toLocaleString()} {currency}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Committed</p>
                <p className="text-lg font-semibold text-amber-700">{totalCommitted.toLocaleString()} {currency}</p>
                <p className="text-[10px] text-muted-foreground">{pctCommitted}% of value</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Paid</p>
                <p className="text-lg font-semibold text-emerald-700">{totalPaid.toLocaleString()} {currency}</p>
                <p className="text-[10px] text-muted-foreground">{pctPaid}% of value</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Remaining</p>
                <p className="text-lg font-semibold">{remaining.toLocaleString()} {currency}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Payment Progress</span>
                <span>Paid {pctPaid}% · Committed {pctCommitted}%</span>
              </div>
              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-amber-400/60" style={{ width: `${Math.min(pctPaid + pctCommitted, 100)}%` }} />
                <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${Math.min(pctPaid, 100)}%` }} />
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <DetailRow label="Type" value={<span className="capitalize">{contract.type}</span>} />
              <DetailRow label="Payment Structure" value={<span className="capitalize">{(contract as any).payment_structure || "one-time"}</span>} />
              <DetailRow label="Start Date" value={contract.start_date || "—"} />
              <DetailRow label="End Date" value={contract.end_date || "—"} />
              <DetailRow label="Vendor Email" value={vendor?.email || "—"} />
              <DetailRow label="Vendor Type" value={vendor?.type || "—"} />
            </div>

            {contract.description && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="text-sm whitespace-pre-wrap">{contract.description}</p>
              </div>
            )}

            {contract.tag_ids && (contract.tag_ids as string[]).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tags</p>
                <TagBadges tagIds={contract.tag_ids as string[]} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <ContractPaymentsTab contract={contract} payments={payments} currency={currency} totalValue={totalValue} />
          </TabsContent>

          <TabsContent value="milestones" className="mt-4">
            <ContractMilestonesTab contract={contract} milestones={milestones} currency={currency} />
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <ContractDocumentsTab contractId={contract.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
