import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import type { ContractRow } from "@/hooks/useContracts";

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

interface Props {
  contract: ContractRow;
  vendorName: string;
  totalPaid: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ContractCard({ contract, vendorName, totalPaid, onView, onEdit, onDelete }: Props) {
  const totalValue = contract.value ? Number(contract.value) : 0;
  const remaining = totalValue - totalPaid;
  const pctPaid = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0;
  const currency = (contract as any).currency || "MAD";

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <Badge className={statusColors[contract.status || "Draft"]}>{contract.status || "Draft"}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}><Eye className="mr-2 h-3 w-3" /> View</DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="font-bold text-sm mb-0.5 truncate">{contract.title}</h3>
        <p className="text-xs text-muted-foreground mb-3 truncate">{vendorName}</p>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Value</span>
            <span className="font-semibold">{totalValue.toLocaleString()} {currency}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-emerald-600">Paid</span>
            <span className="font-medium text-emerald-600">{totalPaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-orange-600">Remaining</span>
            <span className="font-medium text-orange-600">{remaining.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Progress</span>
            <span>{pctPaid}%</span>
          </div>
          <Progress value={pctPaid} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
